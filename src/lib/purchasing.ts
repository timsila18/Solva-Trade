export type MatchStatus =
  | "matched"
  | "quantity_variance"
  | "price_variance"
  | "tax_variance"
  | "missing_grn"
  | "missing_purchase_order"
  | "overbilled"
  | "underbilled"
  | "needs_review";

export type AgeingBucket = "current" | "1_30" | "31_60" | "61_90" | "over_90";

export function validateKraPinFormat(pin: string) {
  return /^[A-Z][0-9]{9}[A-Z]$/.test(pin.trim().toUpperCase());
}

export function calculateBaseUnitPrice(unitPrice: number, conversionFactor: number) {
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("Unit price must be zero or greater.");
  }
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new Error("Conversion factor must be positive.");
  }
  return unitPrice / conversionFactor;
}

export function compareSupplierPrices(
  prices: { supplierId: string; baseUnitPrice: number; leadTimeDays?: number; reliabilityScore?: number }[],
) {
  return [...prices].sort((a, b) => {
    const priceCompare = a.baseUnitPrice - b.baseUnitPrice;
    if (Math.abs(priceCompare) > 0.0001) return priceCompare;
    return (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0) || (a.leadTimeDays ?? 999) - (b.leadTimeDays ?? 999);
  });
}

export function requiresReapproval({
  wasApproved,
  supplierChanged,
  quantityIncreased,
  priceIncreased,
  taxChanged,
  deliveryLocationChanged,
  totalBefore,
  totalAfter,
  approvalThreshold,
}: {
  wasApproved: boolean;
  supplierChanged?: boolean;
  quantityIncreased?: boolean;
  priceIncreased?: boolean;
  taxChanged?: boolean;
  deliveryLocationChanged?: boolean;
  totalBefore: number;
  totalAfter: number;
  approvalThreshold?: number;
}) {
  if (!wasApproved) return false;
  if (supplierChanged || quantityIncreased || priceIncreased || taxChanged || deliveryLocationChanged) return true;
  return approvalThreshold !== undefined && totalBefore <= approvalThreshold && totalAfter > approvalThreshold;
}

export function threeWayMatch({
  orderedQuantity,
  receivedQuantity,
  billedQuantity,
  orderUnitPrice,
  billUnitPrice,
  orderTax,
  billTax,
  quantityTolerance = 0,
  priceTolerance = 0,
  taxTolerance = 0,
}: {
  orderedQuantity?: number;
  receivedQuantity?: number;
  billedQuantity: number;
  orderUnitPrice?: number;
  billUnitPrice: number;
  orderTax?: number;
  billTax: number;
  quantityTolerance?: number;
  priceTolerance?: number;
  taxTolerance?: number;
}): MatchStatus {
  if (orderedQuantity === undefined) return "missing_purchase_order";
  if (receivedQuantity === undefined) return "missing_grn";
  if (billedQuantity > receivedQuantity + quantityTolerance) return "overbilled";
  if (billedQuantity < receivedQuantity - quantityTolerance) return "underbilled";
  if (Math.abs(billedQuantity - orderedQuantity) > quantityTolerance) return "quantity_variance";
  if (orderUnitPrice !== undefined && Math.abs(billUnitPrice - orderUnitPrice) > priceTolerance) return "price_variance";
  if (orderTax !== undefined && Math.abs(billTax - orderTax) > taxTolerance) return "tax_variance";
  return "matched";
}

export function allocatePaymentToOldestBills(
  paymentAmount: number,
  bills: { billId: string; dueDate: string; outstandingBalance: number }[],
) {
  if (paymentAmount <= 0) throw new Error("Payment amount must be positive.");
  let remaining = paymentAmount;
  const allocations: { billId: string; amount: number }[] = [];

  for (const bill of [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, bill.outstandingBalance);
    if (amount > 0) {
      allocations.push({ billId: bill.billId, amount });
      remaining -= amount;
    }
  }

  return { allocations, unallocatedAmount: remaining };
}

export function preventOverAllocation(paymentAmount: number, allocatedAmount: number, billOutstanding: number, allocationAmount: number) {
  if (allocatedAmount + allocationAmount > paymentAmount) {
    throw new Error("Allocations cannot exceed the supplier payment amount.");
  }
  if (allocationAmount > billOutstanding) {
    throw new Error("Allocation cannot exceed the supplier bill outstanding balance.");
  }
}

export function creditorAgeingBucket(dueDate: string, asOf = new Date()): AgeingBucket {
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "over_90";
}

export function supplierBalanceAfterTransaction(currentBalance: number, transactionType: string, amount: number) {
  if (amount < 0) throw new Error("Amount must be positive.");
  if (["bill", "debit_note", "opening_balance"].includes(transactionType)) return currentBalance + amount;
  if (["payment", "credit_note", "advance_application", "refund"].includes(transactionType)) return currentBalance - amount;
  return currentBalance;
}

export const purchasingReports = [
  "Supplier List",
  "Supplier Contact Report",
  "Supplier Product Catalogue",
  "Supplier Price Comparison",
  "Supplier Price History",
  "Purchase Requisition Report",
  "Purchase Order Report",
  "Open Purchase Orders",
  "Purchase Order Fulfilment",
  "Goods Received Report",
  "Goods Rejected Report",
  "Goods Inspection Report",
  "Purchase Report",
  "Purchase by Supplier",
  "Purchase by Product",
  "Purchase by Category",
  "Purchase by Branch",
  "Purchase Price Variance",
  "Supplier Bill Register",
  "Unmatched Bills",
  "Three-Way Match Exceptions",
  "Supplier Payment Report",
  "Supplier Advance Report",
  "Supplier Return Report",
  "Debit Note Report",
  "Supplier Credit Note Report",
  "Supplier Balance Report",
  "Supplier Statement",
  "Creditor Ageing",
  "Overdue Supplier Bills",
  "Supplier Performance Report",
  "Withholding Tax on Supplier Payments",
  "Purchases Without Tax Documents",
  "Purchases Without Purchase Orders",
  "GRNs Without Bills",
  "Bills Without GRNs",
  "Purchase Orders Not Received",
  "Supplier Documents Expiry Report",
];
