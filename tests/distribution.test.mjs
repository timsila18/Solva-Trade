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

function calculateCapacityStatus({ loadValue, maxValue, loadWeight, maxWeight, loadVolume, maxVolume, stopCount, maxStops }) {
  const pairs = [
    [loadValue, maxValue],
    [loadWeight, maxWeight],
    [loadVolume, maxVolume],
    [stopCount, maxStops],
  ];
  if (pairs.some(([load, max]) => load !== undefined && max === undefined)) return "missing_product_data";
  const ratios = pairs.filter(([load, max]) => load !== undefined && max !== undefined && max > 0).map(([load, max]) => load / max);
  if (ratios.some((ratio) => ratio > 1)) return "over_capacity";
  if (ratios.some((ratio) => ratio >= 0.9)) return "near_capacity";
  return "within_capacity";
}

function detectAssignmentConflict(existingRuns, assigneeId, deliveryDate) {
  return existingRuns.some((run) => run.assigneeId === assigneeId && run.deliveryDate === deliveryDate && !["closed", "cancelled", "rejected"].includes(run.status));
}

function sortStopsByManualSequence(stops) {
  const priorityRank = { high: 0, normal: 1, low: 2 };
  return [...stops].sort((a, b) => a.sequence - b.sequence || priorityRank[a.priority ?? "normal"] - priorityRank[b.priority ?? "normal"]);
}

function allocateFefoForLoading(batches, requiredQuantity) {
  if (requiredQuantity <= 0) throw new Error("Required quantity must be positive.");
  let remaining = requiredQuantity;
  const allocations = [];
  const eligible = batches
    .filter((batch) => !["expired", "quarantined", "recalled"].includes(batch.status ?? "active"))
    .sort((a, b) => {
      const expiryA = a.expiryDate ?? "9999-12-31";
      const expiryB = b.expiryDate ?? "9999-12-31";
      return expiryA.localeCompare(expiryB) || a.receivedDate.localeCompare(b.receivedDate) || a.id.localeCompare(b.id);
    });
  for (const batch of eligible) {
    if (remaining <= 0) break;
    const quantity = Math.min(batch.availableQuantity, remaining);
    if (quantity > 0) allocations.push({ batchId: batch.id, quantity });
    remaining -= quantity;
  }
  if (remaining > 0) throw new Error("Insufficient eligible stock for loading.");
  return allocations;
}

function validateBatchForLoading({ status, expiryDate, asOf = new Date() }) {
  if (status === "quarantined" || status === "recalled") return "quarantined";
  if (!expiryDate) return "ok";
  const expiry = Date.parse(expiryDate);
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const days = Math.floor((expiry - today) / (24 * 60 * 60 * 1000));
  if (days < 0 || status === "expired") return "expired";
  if (days <= 14) return "expiring_soon";
  return "ok";
}

function stockMovementsForRecognition(point) {
  if (point === "on_invoice") return { dispatchTransfer: false, deliveryStockOut: false };
  if (point === "on_dispatch") return { dispatchTransfer: true, deliveryStockOut: true };
  return { dispatchTransfer: true, deliveryStockOut: true };
}

function deliveryOutcome({ loadedQuantity, deliveredQuantity, rejectedQuantity }) {
  if (deliveredQuantity < 0 || rejectedQuantity < 0) throw new Error("Delivery quantities cannot be negative.");
  if (deliveredQuantity + rejectedQuantity > loadedQuantity) throw new Error("Delivered and rejected quantity cannot exceed loaded quantity.");
  if (deliveredQuantity === 0) return "failed";
  if (deliveredQuantity < loadedQuantity || rejectedQuantity > 0) return "partial";
  return "full";
}

function canCompleteCodDelivery({ amountDue, amountCollected, creditAllowed, creditCheckPassed, overrideApproved }) {
  if (amountCollected >= amountDue) return true;
  return Boolean((creditAllowed && creditCheckPassed) || overrideApproved);
}

function reconcileRouteCash({ expected, submitted, expenses = 0, refunds = 0 }) {
  const netExpected = expected - expenses - refunds;
  return { netExpected, variance: submitted - netExpected };
}

function applyPackagingTransaction(currentQuantity, transactionType, quantity) {
  if (quantity < 0) throw new Error("Packaging quantity cannot be negative.");
  if (["issued_to_customer", "lost", "damaged", "opening_balance"].includes(transactionType)) return currentQuantity + quantity;
  if (["returned_by_customer", "collected_from_customer", "returned_to_warehouse", "reversal"].includes(transactionType)) return currentQuantity - quantity;
  return currentQuantity;
}

function canCloseRun(checks) {
  return Object.values(checks).every(Boolean);
}

test("capacity checks handle missing data, near capacity and over capacity", () => {
  assert.equal(calculateCapacityStatus({ loadWeight: 100 }), "missing_product_data");
  assert.equal(calculateCapacityStatus({ loadWeight: 91, maxWeight: 100 }), "near_capacity");
  assert.equal(calculateCapacityStatus({ loadValue: 1200, maxValue: 1000 }), "over_capacity");
  assert.equal(calculateCapacityStatus({ stopCount: 10, maxStops: 20 }), "within_capacity");
});

test("vehicle and driver assignment conflicts ignore closed or cancelled runs", () => {
  const runs = [
    { assigneeId: "driver-1", deliveryDate: "2026-07-20", status: "closed" },
    { assigneeId: "driver-1", deliveryDate: "2026-07-21", status: "approved" },
  ];
  assert.equal(detectAssignmentConflict(runs, "driver-1", "2026-07-20"), false);
  assert.equal(detectAssignmentConflict(runs, "driver-1", "2026-07-21"), true);
});

test("manual stop sequencing is stable", () => {
  assert.deepEqual(sortStopsByManualSequence([
    { id: "b", sequence: 2 },
    { id: "urgent", sequence: 1, priority: "high" },
    { id: "normal", sequence: 1, priority: "normal" },
  ]).map((stop) => stop.id), ["urgent", "normal", "b"]);
});

test("FEFO loading skips expired and quarantined stock", () => {
  const allocations = allocateFefoForLoading([
    { id: "bad", expiryDate: "2026-07-25", receivedDate: "2026-01-01", status: "quarantined", availableQuantity: 10 },
    { id: "soon", expiryDate: "2026-08-01", receivedDate: "2026-01-02", status: "active", availableQuantity: 8 },
    { id: "later", expiryDate: "2026-09-01", receivedDate: "2026-01-03", status: "active", availableQuantity: 10 },
  ], 12);
  assert.deepEqual(allocations, [{ batchId: "soon", quantity: 8 }, { batchId: "later", quantity: 4 }]);
  assert.throws(() => allocateFefoForLoading([{ id: "bad", expiryDate: "2026-01-01", receivedDate: "2026-01-01", status: "expired", availableQuantity: 10 }], 1), /Insufficient/);
});

test("batch validation blocks expired and quarantined goods", () => {
  const asOf = new Date("2026-07-20T00:00:00Z");
  assert.equal(validateBatchForLoading({ expiryDate: "2026-07-19", asOf }), "expired");
  assert.equal(validateBatchForLoading({ expiryDate: "2026-07-25", asOf }), "expiring_soon");
  assert.equal(validateBatchForLoading({ status: "quarantined", expiryDate: "2026-12-01", asOf }), "quarantined");
  assert.equal(validateBatchForLoading({ expiryDate: "2026-12-01", asOf }), "ok");
});

test("stock recognition settings prevent duplicate stock-out assumptions", () => {
  assert.deepEqual(stockMovementsForRecognition("on_invoice"), { dispatchTransfer: false, deliveryStockOut: false });
  assert.deepEqual(stockMovementsForRecognition("on_dispatch"), { dispatchTransfer: true, deliveryStockOut: true });
  assert.deepEqual(stockMovementsForRecognition("on_delivery_confirmation"), { dispatchTransfer: true, deliveryStockOut: true });
});

test("delivery outcome validates full, partial and failed delivery", () => {
  assert.equal(deliveryOutcome({ loadedQuantity: 10, deliveredQuantity: 10, rejectedQuantity: 0 }), "full");
  assert.equal(deliveryOutcome({ loadedQuantity: 10, deliveredQuantity: 8, rejectedQuantity: 2 }), "partial");
  assert.equal(deliveryOutcome({ loadedQuantity: 10, deliveredQuantity: 0, rejectedQuantity: 10 }), "failed");
  assert.throws(() => deliveryOutcome({ loadedQuantity: 10, deliveredQuantity: 11, rejectedQuantity: 0 }), /cannot exceed/);
});

test("cash-on-delivery shortfall requires credit pass or override", () => {
  assert.equal(canCompleteCodDelivery({ amountDue: 1000, amountCollected: 1000 }), true);
  assert.equal(canCompleteCodDelivery({ amountDue: 1000, amountCollected: 800 }), false);
  assert.equal(canCompleteCodDelivery({ amountDue: 1000, amountCollected: 800, creditAllowed: true, creditCheckPassed: true }), true);
  assert.equal(canCompleteCodDelivery({ amountDue: 1000, amountCollected: 800, overrideApproved: true }), true);
});

test("route cash reconciliation subtracts expenses and refunds", () => {
  assert.deepEqual(reconcileRouteCash({ expected: 10000, submitted: 9400, expenses: 500, refunds: 100 }), { netExpected: 9400, variance: 0 });
  assert.deepEqual(reconcileRouteCash({ expected: 10000, submitted: 9300, expenses: 500 }), { netExpected: 9500, variance: -200 });
});

test("customer packaging ledger tracks owed and returned crates", () => {
  let balance = 0;
  balance = applyPackagingTransaction(balance, "issued_to_customer", 14);
  balance = applyPackagingTransaction(balance, "returned_by_customer", 8);
  balance = applyPackagingTransaction(balance, "damaged", 3);
  assert.equal(balance, 9);
  assert.throws(() => applyPackagingTransaction(balance, "issued_to_customer", -1), /cannot be negative/);
});

test("run closure requires every configured reconciliation check", () => {
  assert.equal(canCloseRun({ stops: true, vehicle: true, stock: true, cash: true, proof: true }), true);
  assert.equal(canCloseRun({ stops: true, vehicle: true, stock: false, cash: true, proof: true }), false);
});
