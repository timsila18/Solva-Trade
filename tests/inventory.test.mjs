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

function calculateWeightedAverageCost({ quantityOnHand, averageUnitCost, receiptQuantity, receiptUnitCost }) {
  if (receiptQuantity <= 0) throw new Error("Receipt quantity must be positive.");
  const totalQuantity = quantityOnHand + receiptQuantity;
  return ((quantityOnHand * averageUnitCost) + (receiptQuantity * receiptUnitCost)) / totalQuantity;
}

function consumeFifoLayers(layers, quantity) {
  let remaining = quantity;
  const allocations = [];
  for (const layer of [...layers].sort((a, b) => a.receiptDate.localeCompare(b.receiptDate))) {
    if (remaining <= 0) break;
    const used = Math.min(layer.remainingQuantity, remaining);
    allocations.push({ layerId: layer.id, quantity: used, unitCost: layer.unitCost });
    remaining -= used;
  }
  if (remaining > 0) throw new Error("Insufficient FIFO cost layers.");
  return allocations;
}

function allocateFefoBatches(batches, quantity) {
  let remaining = quantity;
  const allocations = [];
  const sorted = [...batches].sort((a, b) => {
    const expiryA = a.expiryDate ?? "9999-12-31";
    const expiryB = b.expiryDate ?? "9999-12-31";
    return expiryA.localeCompare(expiryB) || a.receivedDate.localeCompare(b.receivedDate) || a.id.localeCompare(b.id);
  });
  for (const batch of sorted) {
    if (remaining <= 0) break;
    const used = Math.min(batch.remainingQuantity, remaining);
    allocations.push({ batchId: batch.id, quantity: used });
    remaining -= used;
  }
  if (remaining > 0) throw new Error("Insufficient FEFO batch quantity.");
  return allocations;
}

function convertToBaseQuantity(quantity, conversionFactor) {
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) throw new Error("Conversion factor must be positive.");
  return quantity * conversionFactor;
}

function preventNegativeStock({ availableQuantity, requestedQuantity, allowNegativeStock }) {
  if (!allowNegativeStock && requestedQuantity > availableQuantity) {
    throw new Error(`Insufficient stock. Available: ${availableQuantity}. Requested: ${requestedQuantity}.`);
  }
}

function calculateReorderStatus({ availableQuantity, reorderPoint, maximumStockLevel }) {
  if (availableQuantity <= 0) return "out_of_stock";
  if (maximumStockLevel !== undefined && availableQuantity > maximumStockLevel) return "overstocked";
  if (availableQuantity <= reorderPoint) return "reorder_now";
  if (availableQuantity <= reorderPoint * 1.25) return "approaching_reorder";
  return "healthy";
}

test("weighted average costing recalculates after receipt", () => {
  const result = calculateWeightedAverageCost({
    quantityOnHand: 100,
    averageUnitCost: 50,
    receiptQuantity: 50,
    receiptUnitCost: 60,
  });
  assert.equal(Number(result.toFixed(4)), 53.3333);
});

test("FIFO consumes oldest eligible layers first", () => {
  const allocations = consumeFifoLayers([
    { id: "new", receiptDate: "2026-02-01", remainingQuantity: 20, unitCost: 60 },
    { id: "old", receiptDate: "2026-01-01", remainingQuantity: 10, unitCost: 50 },
  ], 25);
  assert.deepEqual(allocations, [
    { layerId: "old", quantity: 10, unitCost: 50 },
    { layerId: "new", quantity: 15, unitCost: 60 },
  ]);
});

test("FEFO allocation prioritises earliest expiry", () => {
  const allocations = allocateFefoBatches([
    { id: "safe", expiryDate: "2026-12-01", receivedDate: "2026-01-01", remainingQuantity: 10 },
    { id: "urgent", expiryDate: "2026-08-01", receivedDate: "2026-02-01", remainingQuantity: 8 },
  ], 12);
  assert.deepEqual(allocations, [
    { batchId: "urgent", quantity: 8 },
    { batchId: "safe", quantity: 4 },
  ]);
});

test("pack conversion posts base quantity", () => {
  assert.equal(convertToBaseQuantity(10, 24), 240);
});

test("negative stock prevention blocks over-issue", () => {
  assert.throws(
    () => preventNegativeStock({ availableQuantity: 5, requestedQuantity: 6, allowNegativeStock: false }),
    /Insufficient stock/,
  );
});

test("reorder status handles out, low, healthy and overstock", () => {
  assert.equal(calculateReorderStatus({ availableQuantity: 0, reorderPoint: 10 }), "out_of_stock");
  assert.equal(calculateReorderStatus({ availableQuantity: 9, reorderPoint: 10 }), "reorder_now");
  assert.equal(calculateReorderStatus({ availableQuantity: 12, reorderPoint: 10 }), "approaching_reorder");
  assert.equal(calculateReorderStatus({ availableQuantity: 20, reorderPoint: 10 }), "healthy");
  assert.equal(calculateReorderStatus({ availableQuantity: 60, reorderPoint: 10, maximumStockLevel: 50 }), "overstocked");
});
