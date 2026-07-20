export type SettingsSection = {
  slug: string;
  title: string;
  description: string;
  category: string;
  permission?: string;
  advanced?: boolean;
  industryFlags?: string[];
  fields: string[];
  metrics: { label: string; value: string }[];
};

export const businessActivities = [
  "Distributor",
  "Wholesaler",
  "Retailer",
  "Supplier",
  "General Trading",
  "Fish and Seafood",
  "Hardware",
  "Restaurant",
  "Pharmacy",
  "Manufacturing",
  "Service Business",
  "Agriculture and Agrovet",
  "Electronics",
  "Building Materials",
  "Other",
];

export const industryProfiles = {
  distributor: {
    label: "Distributor",
    flags: [
      "sales_routes",
      "delivery_vehicles",
      "drivers",
      "delivery_notes",
      "customer_credit",
      "wholesale_pricing",
      "route_collections",
      "vehicle_stock",
      "product_returns",
      "returnable_packaging",
      "multiple_suppliers",
      "delivery_proof",
      "customer_specific_pricing",
    ],
  },
  retail: {
    label: "Retail",
    flags: ["barcode_support", "quick_sales", "cashier_workflow", "retail_prices", "reorder_levels", "stock_counts"],
  },
  fish_seafood: {
    label: "Fish and Seafood",
    flags: ["weight_based_units", "kilograms", "crates", "pieces", "fresh_stock", "spoilage_tracking", "daily_purchasing", "source_details", "cold_storage"],
  },
  hardware: {
    label: "Hardware",
    flags: ["pieces", "length", "metres", "bundles", "bags", "sheets", "wholesale_prices", "retail_prices", "product_variations"],
  },
  restaurant: {
    label: "Restaurant",
    flags: ["ingredients", "recipes", "wastage", "preparation_units", "branch_stock", "menu_products"],
  },
  pharmacy: {
    label: "Pharmacy",
    flags: ["batch_numbers", "expiry_dates", "prescription_required", "controlled_stock_permissions"],
  },
  service_business: {
    label: "Service Business",
    flags: ["service_items", "non_stock_invoices", "time_based_billing", "job_references"],
  },
};

export const setupPresets = [
  "Beverage distributor",
  "General trader",
  "Fish supplier",
  "Service business",
];

export const settingsSections: SettingsSection[] = [
  {
    slug: "business-profile",
    title: "Business Profile",
    description: "Legal details, contacts, KRA PIN, address, logo, stamp, signature and customer-facing messages.",
    category: "Business setup",
    fields: ["Legal name", "Trading name", "KRA PIN", "VAT number", "Phone", "Email", "County", "Town", "Invoice footer"],
    metrics: [{ label: "Default country", value: "Kenya" }, { label: "Timezone", value: "Africa/Nairobi" }],
  },
  {
    slug: "activities",
    title: "Business Activities",
    description: "Select one primary activity and optional secondary activities for future activity-level reporting.",
    category: "Business setup",
    fields: businessActivities,
    metrics: [{ label: "Primary required", value: "Yes" }, { label: "Reporting dimension", value: "Prepared" }],
  },
  {
    slug: "industry-profiles",
    title: "Industry Profiles",
    description: "Apply reusable feature flags for distributors, retailers, fish suppliers, hardware shops and service teams.",
    category: "Business setup",
    fields: Object.values(industryProfiles).map((profile) => profile.label),
    metrics: [{ label: "Presets", value: setupPresets.length.toString() }, { label: "Editable after setup", value: "Yes" }],
  },
  {
    slug: "branches",
    title: "Branches",
    description: "Create operating locations, assign capabilities and choose the default branch.",
    category: "Locations",
    fields: ["Branch name", "Code", "Type", "County", "Town", "Default", "Sales", "Purchasing", "Inventory", "Delivery"],
    metrics: [{ label: "Active branches", value: "1" }, { label: "Default branch", value: "MAIN" }],
  },
  {
    slug: "warehouses",
    title: "Warehouses",
    description: "Configure stock locations such as main warehouse, branch store, shop floor, cold store or vehicle stock.",
    category: "Locations",
    fields: ["Warehouse name", "Code", "Branch", "Type", "Dispatch", "Receiving", "Transfers", "Adjustments"],
    metrics: [{ label: "Stock locations", value: "1" }, { label: "Advanced bins", value: "Optional" }],
  },
  {
    slug: "delivery",
    title: "Delivery Setup",
    description: "Configure vehicles, drivers, routes, operating days and returnable packaging foundations.",
    category: "Operations",
    industryFlags: ["delivery_vehicles", "sales_routes", "route_sales"],
    fields: ["Vehicle registration", "Driver", "Route code", "Areas covered", "Operating days", "Insurance expiry", "Licence expiry"],
    metrics: [{ label: "Routes", value: "Ready" }, { label: "Vehicle stock", value: "Prepared" }],
  },
  {
    slug: "units",
    title: "Units",
    description: "Manage standard and custom units, decimal precision and future unit conversions.",
    category: "Products",
    fields: ["Piece", "Bottle", "Carton", "Crate", "Kilogram", "Gram", "Litre", "Metre", "Hour", "Service"],
    metrics: [{ label: "System units", value: "26" }, { label: "Conversions", value: "Configured per business" }],
  },
  {
    slug: "categories",
    title: "Categories",
    description: "Build hierarchical product categories with circular-reference protection.",
    category: "Products",
    fields: ["Category name", "Code", "Parent category", "Description", "Sort order", "Active"],
    metrics: [{ label: "Hierarchy", value: "Enabled" }, { label: "Soft deactivate", value: "Yes" }],
  },
  {
    slug: "brands",
    title: "Brands",
    description: "Create brand records without seeding trademarks as production data.",
    category: "Products",
    fields: ["Brand name", "Code", "Manufacturer or owner", "Logo", "Description", "Active"],
    metrics: [{ label: "Manual setup", value: "Owner controlled" }, { label: "Demo trademarks", value: "Not seeded" }],
  },
  {
    slug: "pricing",
    title: "Pricing Setup",
    description: "Configure retail, wholesale, distributor and customer-specific price levels.",
    category: "Commercial",
    fields: ["Retail", "Wholesale", "Distributor", "Special Customer", "Promotional", "Custom"],
    metrics: [{ label: "Default level", value: "Retail" }, { label: "Tax-inclusive option", value: "Yes" }],
  },
  {
    slug: "payments",
    title: "Payment Methods",
    description: "Enable cash, M-Pesa, bank transfer, cheque, card, credit and account foundations.",
    category: "Commercial",
    fields: ["Cash", "M-Pesa", "Bank Transfer", "Cheque", "Card", "Credit", "Owner Account"],
    metrics: [{ label: "Default method", value: "Cash" }, { label: "M-Pesa integration", value: "Prepared" }],
  },
  {
    slug: "documents",
    title: "Documents & Numbering",
    description: "Configure sequence prefixes, branch codes, financial year, month and document template previews.",
    category: "Documents",
    fields: ["Quotation", "Sales Order", "Delivery Note", "Invoice", "Receipt", "Purchase Order", "GRN", "Stock Transfer"],
    metrics: [{ label: "Number generation", value: "Server-side" }, { label: "Concurrency", value: "Row locked" }],
  },
  {
    slug: "tax",
    title: "Tax & eTIMS Setup",
    description: "Configure VAT, zero-rated, exempt, no-tax and eTIMS or ETR document settings.",
    category: "Compliance",
    fields: ["VAT standard", "Zero-rated", "Exempt", "No tax", "eTIMS status", "ETR serial", "Manual invoice approval"],
    metrics: [{ label: "Rates", value: "Effective dated" }, { label: "KRA integration", value: "Not claimed" }],
  },
  {
    slug: "credit",
    title: "Credit Control",
    description: "Set customer credit defaults, payment terms, approval thresholds and reminders.",
    category: "Commercial",
    fields: ["Allow credit", "Payment terms", "Credit limit", "Overdue days", "Approval above limit", "Statement frequency"],
    metrics: [{ label: "Customer defaults", value: "Prepared" }, { label: "Deposits", value: "Prepared" }],
  },
  {
    slug: "suppliers",
    title: "Supplier Settings",
    description: "Set purchase defaults, goods receipt requirements, tax-document rules and supplier performance tracking.",
    category: "Purchases",
    fields: ["Payment terms", "Purchase approval", "Goods receipt", "Supplier tax document", "Price history", "Default warehouse"],
    metrics: [{ label: "Prompt 4 ready", value: "Yes" }, { label: "Currency", value: "KES" }],
  },
  {
    slug: "approvals",
    title: "Approval Settings",
    description: "Configure approval rules for purchases, discounts, below-cost sales, stock adjustments and exports.",
    category: "Controls",
    fields: ["Purchase threshold", "Discount threshold", "Sale below cost", "Stock adjustment", "Invoice cancellation", "Data export"],
    metrics: [{ label: "Core roles", value: "Owner, Manager, Staff" }, { label: "Workflow", value: "Prepared" }],
  },
  {
    slug: "preferences",
    title: "Operational Preferences",
    description: "Control stock, pricing, proof of delivery, batches, expiry dates, branch reporting and visibility rules.",
    category: "Controls",
    fields: ["Negative stock", "Sale below cost", "Require customer", "Require location", "Batches", "Expiry dates", "Route sales", "Profit visibility"],
    metrics: [{ label: "Editable defaults", value: "Owner controlled" }, { label: "Advanced mode", value: "Available" }],
  },
  {
    slug: "data-security",
    title: "Data & Security",
    description: "Export configuration lists, prepare import templates and review sensitive-account masking rules.",
    category: "Administration",
    fields: ["CSV export", "Import preview", "Row validation", "Duplicate-code checks", "Audit events", "Masked accounts"],
    metrics: [{ label: "Partial failures", value: "Blocked" }, { label: "Tenant scoped", value: "Yes" }],
  },
];

export function findSettingsSection(slug: string) {
  return settingsSections.find((section) => section.slug === slug);
}

export function buildDocumentPreview({
  prefix,
  branchCode,
  year,
  month,
  number,
}: {
  prefix: string;
  branchCode?: string;
  year?: number;
  month?: number;
  number: number;
}) {
  return [prefix, branchCode, year, month ? String(month).padStart(2, "0") : undefined, String(number).padStart(6, "0")]
    .filter(Boolean)
    .join("-");
}

export function validateKraPinFormat(pin: string) {
  return /^[A-Z][0-9]{9}[A-Z]$/.test(pin.trim().toUpperCase());
}

export function validateUnitConversionFactor(factor: number) {
  return Number.isFinite(factor) && factor > 0;
}

export function wouldCreateCategoryCycle(categoryId: string, parentId: string | null, parents: Record<string, string | null>) {
  let current = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === categoryId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = parents[current] ?? null;
  }
  return false;
}
