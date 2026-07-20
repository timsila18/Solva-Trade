export type CostingMethod = "weighted_average" | "fifo" | "standard";
export type StockStatus = "healthy" | "approaching_reorder" | "reorder_now" | "out_of_stock" | "overstocked";

export type StockBalanceInput = {
  quantityOnHand: number;
  reservedQuantity: number;
  averageUnitCost: number;
};

export type StockReceiptInput = StockBalanceInput & {
  receiptQuantity: number;
  receiptUnitCost: number;
};

export type CostLayer = {
  id: string;
  receiptDate: string;
  remainingQuantity: number;
  unitCost: number;
};

export type ExpiryBatch = {
  id: string;
  expiryDate: string | null;
  receivedDate: string;
  remainingQuantity: number;
};

export type ReorderInput = {
  availableQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  maximumStockLevel?: number;
};

export function calculateAvailableQuantity({
  quantityOnHand,
  reservedQuantity,
}: Pick<StockBalanceInput, "quantityOnHand" | "reservedQuantity">) {
  return quantityOnHand - reservedQuantity;
}

export function calculateWeightedAverageCost({
  quantityOnHand,
  averageUnitCost,
  receiptQuantity,
  receiptUnitCost,
}: StockReceiptInput) {
  if (receiptQuantity <= 0) throw new Error("Receipt quantity must be positive.");
  const existingValue = quantityOnHand * averageUnitCost;
  const receiptValue = receiptQuantity * receiptUnitCost;
  const totalQuantity = quantityOnHand + receiptQuantity;
  if (totalQuantity <= 0) return 0;
  return (existingValue + receiptValue) / totalQuantity;
}

export function consumeFifoLayers(layers: CostLayer[], quantity: number) {
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  let remaining = quantity;
  const allocations: { layerId: string; quantity: number; unitCost: number }[] = [];

  for (const layer of [...layers].sort((a, b) => a.receiptDate.localeCompare(b.receiptDate))) {
    if (remaining <= 0) break;
    const used = Math.min(layer.remainingQuantity, remaining);
    if (used > 0) {
      allocations.push({ layerId: layer.id, quantity: used, unitCost: layer.unitCost });
      remaining -= used;
    }
  }

  if (remaining > 0) {
    throw new Error("Insufficient FIFO cost layers.");
  }

  return allocations;
}

export function allocateFefoBatches(batches: ExpiryBatch[], quantity: number) {
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  let remaining = quantity;
  const allocations: { batchId: string; quantity: number }[] = [];

  const sorted = [...batches].sort((a, b) => {
    const expiryA = a.expiryDate ?? "9999-12-31";
    const expiryB = b.expiryDate ?? "9999-12-31";
    return expiryA.localeCompare(expiryB) || a.receivedDate.localeCompare(b.receivedDate) || a.id.localeCompare(b.id);
  });

  for (const batch of sorted) {
    if (remaining <= 0) break;
    const used = Math.min(batch.remainingQuantity, remaining);
    if (used > 0) {
      allocations.push({ batchId: batch.id, quantity: used });
      remaining -= used;
    }
  }

  if (remaining > 0) {
    throw new Error("Insufficient FEFO batch quantity.");
  }

  return allocations;
}

export function convertToBaseQuantity(quantity: number, conversionFactor: number) {
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new Error("Conversion factor must be positive.");
  }
  return quantity * conversionFactor;
}

export function preventNegativeStock({
  availableQuantity,
  requestedQuantity,
  allowNegativeStock,
}: {
  availableQuantity: number;
  requestedQuantity: number;
  allowNegativeStock: boolean;
}) {
  if (!allowNegativeStock && requestedQuantity > availableQuantity) {
    throw new Error(`Insufficient stock. Available: ${availableQuantity}. Requested: ${requestedQuantity}.`);
  }
}

export function calculateReorderStatus({
  availableQuantity,
  reorderPoint,
  maximumStockLevel,
}: ReorderInput): StockStatus {
  if (availableQuantity <= 0) return "out_of_stock";
  if (maximumStockLevel !== undefined && availableQuantity > maximumStockLevel) return "overstocked";
  if (availableQuantity <= reorderPoint) return "reorder_now";
  if (availableQuantity <= reorderPoint * 1.25) return "approaching_reorder";
  return "healthy";
}

export function recommendedReorderQuantity({
  availableQuantity,
  reorderPoint,
  reorderQuantity,
  maximumStockLevel,
}: ReorderInput) {
  if (availableQuantity > reorderPoint) return 0;
  if (maximumStockLevel !== undefined) {
    return Math.max(0, maximumStockLevel - availableQuantity);
  }
  return reorderQuantity;
}

export function expiryStatus(expiryDate: string | null, now = new Date(), warningDays = 30) {
  if (!expiryDate) return "safe";
  const expiry = new Date(`${expiryDate}T00:00:00.000Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 7) return "urgent";
  if (days <= warningDays) return "near_expiry";
  return "safe";
}

export const inventoryReports = [
  "Stock on Hand",
  "Available Stock",
  "Stock by Branch",
  "Stock by Warehouse",
  "Stock by Category",
  "Stock by Brand",
  "Inventory Valuation",
  "Stock Movement Report",
  "Opening Stock Report",
  "Stock Adjustment Report",
  "Damaged Stock Report",
  "Expired Stock Report",
  "Spoilage Report",
  "Transfer Report",
  "Stock Count Variance Report",
  "Batch Report",
  "Expiry Report",
  "Serial Number Report",
  "Reorder Report",
  "Negative Stock Report",
  "Returnable Packaging Report",
  "Stock Without Cost Report",
  "Inactive Products with Stock",
  "Archived Products with Stock",
];
