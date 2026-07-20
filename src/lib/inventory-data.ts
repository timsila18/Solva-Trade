import { inventoryReports } from "./inventory";

export const inventorySummary = {
  activeProducts: 0,
  totalStockQuantity: 0,
  inventoryValue: "KES 0.00",
  lowStockProducts: 0,
  outOfStockProducts: 0,
  nearExpiryValue: "KES 0.00",
  expiredStockValue: "KES 0.00",
  transfersInProgress: 0,
  pendingStockCounts: 0,
  recentAdjustments: 0,
};

export const productSetupSections = [
  "Basic Details",
  "Classification",
  "Units & Packaging",
  "Inventory Tracking",
  "Pricing Foundation",
  "Tax Setup",
  "Reorder Settings",
  "Batch & Expiry",
  "Images",
  "Advanced Settings",
];

export const productTypes = [
  "Stock Item",
  "Service",
  "Non-Stock Item",
  "Returnable Packaging",
  "Raw Material",
  "Finished Good",
  "Consumable",
  "Expense Item",
  "Other",
];

export const stockMovementTypes = [
  "Opening Stock",
  "Purchase Receipt",
  "Sale",
  "Customer Return",
  "Supplier Return",
  "Transfer Out",
  "Transfer In",
  "Adjustment Increase",
  "Adjustment Decrease",
  "Damaged",
  "Expired",
  "Lost",
  "Stolen",
  "Spoilage",
  "Internal Use",
  "Promotional Issue",
  "Production Consumption",
  "Production Output",
  "Reservation",
  "Reservation Release",
  "Returnable Packaging Issue",
  "Returnable Packaging Return",
  "Cost Revaluation",
  "Reversal",
  "Other",
];

export const inventoryWorkflows = [
  {
    title: "Opening stock",
    href: "/inventory/opening-stock",
    description: "Post initial quantities, cost, batches, expiry dates and serial numbers through immutable movements.",
  },
  {
    title: "Transfers",
    href: "/inventory/transfers",
    description: "Move stock between branches, warehouses, shop floor, vehicle stock, returns and damaged stores.",
  },
  {
    title: "Adjustments",
    href: "/inventory/adjustments",
    description: "Record damaged, expired, lost, found, internal-use and data-correction adjustments with approvals.",
  },
  {
    title: "Stock counts",
    href: "/inventory/counts",
    description: "Run full, cycle, category, warehouse, selected product, batch, blind and non-blind stock counts.",
  },
  {
    title: "Reorder Centre",
    href: "/inventory/reorder",
    description: "Monitor reorder status using configured minimums, reorder points, safety stock and maximum levels.",
  },
  {
    title: "Inventory reports",
    href: "/inventory/reports",
    description: `${inventoryReports.length} stock, movement, valuation, batch, expiry and returnable-packaging reports.`,
  },
];

export const distributorQuickSetup = [
  "Brand",
  "Pack size",
  "Bottles per crate or case",
  "Returnable crate association",
  "Reorder level",
  "Wholesale price level",
  "Retail price level",
  "Batch tracking",
  "Multiple supplier support",
];
