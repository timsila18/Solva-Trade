export type DocumentCategory =
  | "Sales"
  | "Purchasing"
  | "Inventory"
  | "Distribution"
  | "Finance"
  | "Tax"
  | "Customers"
  | "Suppliers"
  | "Executive"
  | "Operations"
  | "Compliance"
  | "System";

export type BusinessDocument = {
  category: DocumentCategory;
  name: string;
  description: string;
  strategicPlacement: string;
  formats: ("pdf" | "excel" | "print")[];
  standout?: boolean;
};

const formats: BusinessDocument["formats"] = ["pdf", "excel", "print"];

export const documentCatalog: BusinessDocument[] = [
  ...[
    "Quotation",
    "Proforma Invoice",
    "Tax Invoice",
    "Simplified Invoice",
    "Credit Note",
    "Debit Note",
    "Sales Receipt",
    "Delivery Note",
    "Dispatch Note",
    "Customer Statement",
    "Outstanding Balance Statement",
    "Sales Order",
    "Sales Return Note",
    "Sales Summary Report",
    "Daily Sales Report",
    "Monthly Sales Report",
  ].map((name) => ({
    category: "Sales" as const,
    name,
    description: "Customer-facing sales document with item lines, taxes, totals, payment and delivery context.",
    strategicPlacement: name === "Sales Receipt" ? "Shown after submitting a sale or customer payment." : "Available inside Sales workflows and the document centre.",
    formats,
  })),
  ...[
    "Purchase Requisition",
    "Request for Quotation (RFQ)",
    "Supplier Quotation Comparison",
    "Purchase Order (PO)",
    "Goods Received Note (GRN)",
    "Supplier Delivery Note",
    "Supplier Invoice Register",
    "Supplier Statement",
    "Purchase Return Note",
    "Outstanding Supplier Balance Statement",
  ].map((name) => ({
    category: "Purchasing" as const,
    name,
    description: "Supplier and stock-receiving document with purchase, approval, receipt and matching details.",
    strategicPlacement: name === "Goods Received Note (GRN)" ? "Shown below the goods-received workflow after stock is received." : "Available inside Purchasing workflows and the document centre.",
    formats,
  })),
  ...[
    "Stock Card",
    "Bin Card",
    "Stock Movement Report",
    "Stock Adjustment Report",
    "Stock Transfer Note",
    "Warehouse Transfer Note",
    "Physical Stock Count Sheet",
    "Stock Variance Report",
    "Damaged Stock Report",
    "Expired Stock Report",
    "Slow-Moving Stock Report",
    "Fast-Moving Stock Report",
    "Inventory Valuation Report",
    "Reorder List",
  ].map((name) => ({
    category: "Inventory" as const,
    name,
    description: "Inventory control document for quantities, warehouses, batches, movements and valuation.",
    strategicPlacement: "Available from Inventory, product records, stock counts, transfers and the document centre.",
    formats,
  })),
  ...[
    "Delivery Manifest",
    "Vehicle Loading Sheet",
    "Route Sheet",
    "Driver Dispatch Form",
    "Proof of Delivery (POD)",
    "Delivery Confirmation",
    "Return Goods Note",
    "Route Performance Report",
    "Driver Collection Summary",
    "Vehicle Stock Report",
    "Packaging/Crate Return Report",
  ].map((name) => ({
    category: "Distribution" as const,
    name,
    description: "Route and delivery document for drivers, vehicle stock, proof, returns and collections.",
    strategicPlacement: "Available from delivery runs, route sales, dispatch, reconciliation and the document centre.",
    formats,
  })),
  ...[
    "Cashbook",
    "Petty Cash Report",
    "Payment Voucher",
    "Receipt Voucher",
    "Journal Voucher",
    "Bank Deposit Slip",
    "Bank Reconciliation Report",
    "Cash Flow Statement",
    "Income Statement (Profit & Loss)",
    "Balance Sheet",
    "Trial Balance",
    "General Ledger",
    "Account Ledger",
    "Budget vs Actual Report",
    "Expense Analysis Report",
  ].map((name) => ({
    category: "Finance" as const,
    name,
    description: "Finance and accounting document with audit-ready references, balances, journals and approvals.",
    strategicPlacement: "Available from Cash & Bank, Accounting, Financials and the document centre.",
    formats,
  })),
  ...[
    "VAT Report",
    "VAT Purchase Schedule",
    "VAT Sales Schedule",
    "Withholding Tax Report",
    "Tax Summary",
    "eTIMS Submission Report",
    "Tax Compliance Summary",
  ].map((name) => ({
    category: "Tax" as const,
    name,
    description: "Tax compliance document with taxable values, references, filing periods and evidence.",
    strategicPlacement: "Available from Tax workflows and the document centre.",
    formats,
  })),
  ...[
    "Customer Profile",
    "Customer Credit Application",
    "Customer Aging Report",
    "Customer Transaction History",
    "Customer Purchase History",
    "Customer Loyalty Report",
    "Customer Performance Report",
  ].map((name) => ({
    category: "Customers" as const,
    name,
    description: "Customer document with profile, credit, ageing, buying history and performance details.",
    strategicPlacement: "Available from customer profiles, Sales and the document centre.",
    formats,
  })),
  ...[
    "Supplier Profile",
    "Supplier Performance Report",
    "Supplier Purchase History",
    "Supplier Aging Report",
    "Supplier Payment History",
  ].map((name) => ({
    category: "Suppliers" as const,
    name,
    description: "Supplier document with profile, purchasing, payment and performance details.",
    strategicPlacement: "Available from supplier profiles, Purchasing and the document centre.",
    formats,
  })),
  ...[
    "Executive Dashboard Pack",
    "Business Health Report",
    "Morning Business Brief",
    "KPI Report",
    "Top Customers Report",
    "Top Products Report",
    "Least Performing Products",
    "Profitability by Product",
    "Profitability by Customer",
    "Branch Performance Report",
    "Salesperson Performance Report",
    "Driver Performance Report",
    "Warehouse Performance Report",
    "Cash Position Report",
    "Profit Leakage Report",
    "Cash Recovery Report",
    "Inventory Opportunity Report",
    "Route Profitability Report",
    "Customer Intelligence Report",
    "Executive Board Report",
    "Business Action Plan",
  ].map((name) => ({
    category: "Executive" as const,
    name,
    description: "Insight-led report with KPIs, commentary, recommendations and management-ready presentation.",
    strategicPlacement: "Pinned inside the Business Documents & Reports Centre and owner dashboard.",
    formats,
    standout: [
      "Business Health Report",
      "Morning Business Brief",
      "Profit Leakage Report",
      "Cash Recovery Report",
      "Inventory Opportunity Report",
      "Route Profitability Report",
      "Customer Intelligence Report",
      "Executive Board Report",
      "Business Action Plan",
    ].includes(name),
  })),
  ...[
    "Driver Handover Sheet",
    "Driver Cash Declaration",
    "Fuel Consumption Report",
    "Vehicle Maintenance Log",
    "Vehicle Inspection Checklist",
    "Incident Report",
    "Daily Operations Report",
  ].map((name) => ({
    category: "Operations" as const,
    name,
    description: "Daily operations document for drivers, vehicles, incidents and field accountability.",
    strategicPlacement: "Available from Distribution, Operations and the document centre.",
    formats,
  })),
  ...[
    "Audit Trail Report",
    "User Activity Report",
    "Login History",
    "Approval History",
    "Inventory Adjustment Audit",
    "Financial Audit Report",
    "Data Change Log",
  ].map((name) => ({
    category: "Compliance" as const,
    name,
    description: "Audit and compliance document with user, approval, login and data-change evidence.",
    strategicPlacement: "Available from Audit, Settings and the document centre.",
    formats,
  })),
  ...[
    "Subscription Invoice",
    "Payment Receipt",
    "Renewal Notice",
    "Usage Report",
    "License Certificate",
    "Business Setup Summary",
  ].map((name) => ({
    category: "System" as const,
    name,
    description: "System and subscription document for billing, license, usage and setup records.",
    strategicPlacement: "Available from Billing, Settings and the document centre.",
    formats,
  })),
];

export const documentCategories = Array.from(new Set(documentCatalog.map((document) => document.category)));

export function documentsForCategory(category: DocumentCategory) {
  return documentCatalog.filter((document) => document.category === category);
}
