export type CapacityStatus = "within_capacity" | "near_capacity" | "over_capacity" | "missing_product_data" | "approval_required";
export type StockRecognitionPoint = "on_invoice" | "on_dispatch" | "on_delivery_confirmation";
export type DeliveryOutcome = "full" | "partial" | "failed";
export type AgeingWarning = "ok" | "expiring_soon" | "expired" | "quarantined";

export function calculateCapacityStatus({
  loadValue,
  maxValue,
  loadWeight,
  maxWeight,
  loadVolume,
  maxVolume,
  stopCount,
  maxStops,
}: {
  loadValue?: number;
  maxValue?: number;
  loadWeight?: number;
  maxWeight?: number;
  loadVolume?: number;
  maxVolume?: number;
  stopCount?: number;
  maxStops?: number;
}): CapacityStatus {
  const pairs = [
    [loadValue, maxValue],
    [loadWeight, maxWeight],
    [loadVolume, maxVolume],
    [stopCount, maxStops],
  ];
  if (pairs.some(([load, max]) => load !== undefined && max === undefined)) return "missing_product_data";
  const ratios = pairs
    .filter((pair): pair is [number, number] => pair[0] !== undefined && pair[1] !== undefined && pair[1] > 0)
    .map(([load, max]) => load / max);
  if (ratios.some((ratio) => ratio > 1)) return "over_capacity";
  if (ratios.some((ratio) => ratio >= 0.9)) return "near_capacity";
  return "within_capacity";
}

export function detectAssignmentConflict(existingRuns: { assigneeId: string; deliveryDate: string; status: string }[], assigneeId: string, deliveryDate: string) {
  return existingRuns.some((run) => run.assigneeId === assigneeId && run.deliveryDate === deliveryDate && !["closed", "cancelled", "rejected"].includes(run.status));
}

export function sortStopsByManualSequence<T extends { sequence: number; priority?: "high" | "normal" | "low" }>(stops: T[]) {
  const priorityRank = { high: 0, normal: 1, low: 2 };
  return [...stops].sort((a, b) => a.sequence - b.sequence || priorityRank[a.priority ?? "normal"] - priorityRank[b.priority ?? "normal"]);
}

export function allocateFefoForLoading<T extends { id: string; expiryDate?: string | null; receivedDate: string; status?: string; availableQuantity: number }>(
  batches: T[],
  requiredQuantity: number,
) {
  if (requiredQuantity <= 0) throw new Error("Required quantity must be positive.");
  let remaining = requiredQuantity;
  const allocations: { batchId: string; quantity: number }[] = [];
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

export function validateBatchForLoading({ status, expiryDate, asOf = new Date() }: { status?: string; expiryDate?: string | null; asOf?: Date }): AgeingWarning {
  if (status === "quarantined" || status === "recalled") return "quarantined";
  if (!expiryDate) return "ok";
  const expiry = Date.parse(expiryDate);
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const days = Math.floor((expiry - today) / (24 * 60 * 60 * 1000));
  if (days < 0 || status === "expired") return "expired";
  if (days <= 14) return "expiring_soon";
  return "ok";
}

export function stockMovementsForRecognition(point: StockRecognitionPoint) {
  if (point === "on_invoice") {
    return { dispatchTransfer: false, deliveryStockOut: false, note: "Invoice posting already recognised stock-out." };
  }
  if (point === "on_dispatch") {
    return { dispatchTransfer: true, deliveryStockOut: true, note: "Dispatch moves stock to vehicle; delivery issues vehicle stock." };
  }
  return { dispatchTransfer: true, deliveryStockOut: true, note: "Dispatch stages stock; delivery confirmation recognises stock-out." };
}

export function deliveryOutcome({ loadedQuantity, deliveredQuantity, rejectedQuantity }: { loadedQuantity: number; deliveredQuantity: number; rejectedQuantity: number }): DeliveryOutcome {
  if (deliveredQuantity < 0 || rejectedQuantity < 0) throw new Error("Delivery quantities cannot be negative.");
  if (deliveredQuantity + rejectedQuantity > loadedQuantity) throw new Error("Delivered and rejected quantity cannot exceed loaded quantity.");
  if (deliveredQuantity === 0) return "failed";
  if (deliveredQuantity < loadedQuantity || rejectedQuantity > 0) return "partial";
  return "full";
}

export function canCompleteCodDelivery({
  amountDue,
  amountCollected,
  creditAllowed,
  creditCheckPassed,
  overrideApproved,
}: {
  amountDue: number;
  amountCollected: number;
  creditAllowed?: boolean;
  creditCheckPassed?: boolean;
  overrideApproved?: boolean;
}) {
  if (amountCollected >= amountDue) return true;
  return Boolean((creditAllowed && creditCheckPassed) || overrideApproved);
}

export function reconcileRouteCash({ expected, submitted, expenses = 0, refunds = 0 }: { expected: number; submitted: number; expenses?: number; refunds?: number }) {
  const netExpected = expected - expenses - refunds;
  return {
    netExpected,
    variance: submitted - netExpected,
  };
}

export function applyPackagingTransaction(currentQuantity: number, transactionType: string, quantity: number) {
  if (quantity < 0) throw new Error("Packaging quantity cannot be negative.");
  if (["issued_to_customer", "lost", "damaged", "opening_balance"].includes(transactionType)) return currentQuantity + quantity;
  if (["returned_by_customer", "collected_from_customer", "returned_to_warehouse", "reversal"].includes(transactionType)) return currentQuantity - quantity;
  return currentQuantity;
}

export function canCloseRun(checks: Record<string, boolean>) {
  return Object.values(checks).every(Boolean);
}

export const distributionReports = [
  "Delivery Run Report",
  "Delivery Schedule",
  "Delivery Stop Report",
  "Delivery Note Register",
  "Delivery Completion Report",
  "On-Time Delivery Report",
  "Failed Delivery Report",
  "Partial Delivery Report",
  "Delivery Exception Report",
  "Loading Sheet Report",
  "Vehicle Loading Report",
  "Vehicle Stock Report",
  "Vehicle Stock Movement Report",
  "Vehicle Stock Reconciliation",
  "Route Sales Report",
  "Sales by Route",
  "Sales by Driver",
  "Sales by Vehicle",
  "Delivery by Customer",
  "Delivery by Branch",
  "Delivery by Product",
  "Delivery by Route",
  "Driver Collection Report",
  "Route Collection Reconciliation",
  "Cash in Transit Report",
  "M-Pesa Collection Report",
  "Cheque Collection Report",
  "Route Expense Report",
  "Customer Return During Delivery Report",
  "Return-to-Depot Report",
  "Delivery Stock Variance Report",
  "Driver Cash Variance Report",
  "Proof of Delivery Report",
  "Missing Proof of Delivery Report",
  "Customer Packaging Balance",
  "Vehicle Packaging Balance",
  "Crates Issued Report",
  "Crates Returned Report",
  "Empty-Bottle Balance Report",
  "Packaging Loss Report",
  "Packaging Damage Report",
  "Packaging Deposit Report",
  "Vehicle Utilisation Report",
  "Driver Performance Report",
  "Route Performance Report",
  "Delivery Turnaround Report",
  "Run Closure Report",
  "Reopened Run Report",
];
