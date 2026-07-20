import assert from "node:assert/strict";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function validateKraPinFormat(pin) {
  return /^[A-Z][0-9]{9}[A-Z]$/.test(pin.trim().toUpperCase());
}

function calculateBaseUnitPrice(unitPrice, conversionFactor) {
  if (unitPrice < 0) throw new Error("Unit price cannot be negative.");
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) throw new Error("Conversion factor must be positive.");
  return unitPrice / conversionFactor;
}

function compareSupplierPrices(currentPrice, newPrice) {
  if (currentPrice <= 0) return { difference: newPrice, percentageChange: 100 };
  const difference = newPrice - currentPrice;
  return { difference, percentageChange: (difference / currentPrice) * 100 };
}

function requiresReapproval({ currentPrice, newPrice, tolerancePercent, paymentTermsChanged, bankDetailsChanged, creditLimitChanged }) {
  const comparison = compareSupplierPrices(currentPrice, newPrice);
  return Math.abs(comparison.percentageChange) > tolerancePercent || Boolean(paymentTermsChanged || bankDetailsChanged || creditLimitChanged);
}

function threeWayMatch({ orderedQuantity, receivedQuantity, billedQuantity, orderedUnitPrice, billedUnitPrice, quantityTolerance = 0, priceTolerancePercent = 0 }) {
  const quantityVariance = billedQuantity - receivedQuantity;
  const priceVariancePercent = orderedUnitPrice <= 0 ? 100 : ((billedUnitPrice - orderedUnitPrice) / orderedUnitPrice) * 100;
  if (billedQuantity > orderedQuantity + quantityTolerance) return "overbilled";
  if (Math.abs(quantityVariance) > quantityTolerance) return "quantity_variance";
  if (Math.abs(priceVariancePercent) > priceTolerancePercent) return "price_variance";
  return "matched";
}

function allocatePaymentToOldestBills(paymentAmount, bills) {
  let remaining = paymentAmount;
  return [...bills]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.billNumber.localeCompare(b.billNumber))
    .map((bill) => {
      const amount = Math.min(remaining, bill.outstandingAmount);
      remaining -= amount;
      return { billId: bill.id, amount };
    })
    .filter((allocation) => allocation.amount > 0);
}

function preventOverAllocation(paymentAmount, allocatedAmount, billOutstanding, allocationAmount) {
  if (allocatedAmount + allocationAmount > paymentAmount) throw new Error("Allocation exceeds payment amount.");
  if (allocationAmount > billOutstanding) throw new Error("Allocation exceeds bill outstanding balance.");
}

function creditorAgeingBucket(dueDate, asOf = new Date()) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysPastDue = Math.floor((Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()) - Date.parse(dueDate)) / msPerDay);
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "1_30";
  if (daysPastDue <= 60) return "31_60";
  if (daysPastDue <= 90) return "61_90";
  return "over_90";
}

function supplierBalanceAfterTransaction(currentBalance, transactionType, amount) {
  const increases = new Set(["opening_balance", "bill", "debit_note", "reversal"]);
  const decreases = new Set(["payment", "credit_note", "advance_application", "refund"]);
  if (increases.has(transactionType)) return currentBalance + amount;
  if (decreases.has(transactionType)) return currentBalance - amount;
  return currentBalance;
}

test("Kenyan supplier KRA PIN format is enforced", () => {
  assert.equal(validateKraPinFormat("A123456789B"), true);
  assert.equal(validateKraPinFormat("123456789AB"), false);
});

test("supplier pack price converts to base unit price", () => {
  assert.equal(calculateBaseUnitPrice(2400, 24), 100);
  assert.throws(() => calculateBaseUnitPrice(100, 0), /Conversion factor/);
});

test("supplier price changes detect approval thresholds and bank changes", () => {
  assert.deepEqual(compareSupplierPrices(100, 115), { difference: 15, percentageChange: 15 });
  assert.equal(requiresReapproval({ currentPrice: 100, newPrice: 103, tolerancePercent: 5 }), false);
  assert.equal(requiresReapproval({ currentPrice: 100, newPrice: 107, tolerancePercent: 5 }), true);
  assert.equal(requiresReapproval({ currentPrice: 100, newPrice: 100, tolerancePercent: 5, bankDetailsChanged: true }), true);
});

test("three-way matching detects overbilling before ordinary quantity variance", () => {
  assert.equal(threeWayMatch({ orderedQuantity: 10, receivedQuantity: 10, billedQuantity: 12, orderedUnitPrice: 100, billedUnitPrice: 100 }), "overbilled");
  assert.equal(threeWayMatch({ orderedQuantity: 10, receivedQuantity: 8, billedQuantity: 10, orderedUnitPrice: 100, billedUnitPrice: 100, quantityTolerance: 1 }), "quantity_variance");
  assert.equal(threeWayMatch({ orderedQuantity: 10, receivedQuantity: 10, billedQuantity: 10, orderedUnitPrice: 100, billedUnitPrice: 110, priceTolerancePercent: 5 }), "price_variance");
  assert.equal(threeWayMatch({ orderedQuantity: 10, receivedQuantity: 10, billedQuantity: 10, orderedUnitPrice: 100, billedUnitPrice: 103, priceTolerancePercent: 5 }), "matched");
});

test("supplier payments allocate to oldest open bills and block over-allocation", () => {
  const allocations = allocatePaymentToOldestBills(150, [
    { id: "new", billNumber: "B-002", dueDate: "2026-03-01", outstandingAmount: 100 },
    { id: "old", billNumber: "B-001", dueDate: "2026-02-01", outstandingAmount: 100 },
  ]);
  assert.deepEqual(allocations, [
    { billId: "old", amount: 100 },
    { billId: "new", amount: 50 },
  ]);
  assert.throws(() => preventOverAllocation(100, 80, 40, 30), /payment amount/);
  assert.throws(() => preventOverAllocation(100, 20, 25, 30), /bill outstanding/);
});

test("creditor ageing buckets and immutable transaction signs are deterministic", () => {
  const asOf = new Date("2026-07-20T00:00:00Z");
  assert.equal(creditorAgeingBucket("2026-07-21", asOf), "current");
  assert.equal(creditorAgeingBucket("2026-07-01", asOf), "1_30");
  assert.equal(creditorAgeingBucket("2026-06-01", asOf), "31_60");
  assert.equal(creditorAgeingBucket("2026-05-01", asOf), "61_90");
  assert.equal(creditorAgeingBucket("2026-03-01", asOf), "over_90");
  assert.equal(supplierBalanceAfterTransaction(1000, "bill", 200), 1200);
  assert.equal(supplierBalanceAfterTransaction(1000, "payment", 200), 800);
});
