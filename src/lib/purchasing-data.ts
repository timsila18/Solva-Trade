import { purchasingReports } from "./purchasing";

export const purchasingSummary = {
  approvedSuppliers: 0,
  pendingSupplierApprovals: 0,
  openPurchaseOrders: 0,
  expectedReceipts: 0,
  unmatchedBills: 0,
  supplierBalance: "KES 0.00",
  overdueSupplierBills: "KES 0.00",
  pendingPayments: "KES 0.00",
};

export const supplierTypes = [
  "Manufacturer",
  "Distributor",
  "Wholesaler",
  "Farmer / Producer",
  "Importer",
  "Service Provider",
  "Contractor",
  "Transporter",
  "Utility Provider",
  "Government Entity",
  "Individual",
  "Other",
];

export const supplierSetupSections = [
  "Identity",
  "Tax & Compliance",
  "Contacts",
  "Addresses",
  "Payment Terms",
  "Credit Controls",
  "Products & Prices",
  "Documents",
  "Approval",
  "Audit",
];

export const purchasingWorkflows = [
  {
    title: "Purchase requisitions",
    href: "/purchases/requisitions",
    description: "Raise internal requests, enforce approvals and convert approved demand into purchase orders.",
  },
  {
    title: "Purchase orders",
    href: "/purchases/purchase-orders",
    description: "Create, approve, send, acknowledge, amend and close supplier commitments.",
  },
  {
    title: "Goods received notes",
    href: "/purchases/goods-received",
    description: "Receive ordered goods with quantity checks, batch capture, expiry dates and inspection outcomes.",
  },
  {
    title: "Supplier bills",
    href: "/purchases/supplier-bills",
    description: "Record supplier invoices, run two-way or three-way matching and post approved creditor balances.",
  },
  {
    title: "Supplier returns",
    href: "/purchases/returns",
    description: "Return damaged, rejected or excess stock to suppliers and track credit-note recovery.",
  },
  {
    title: "Supplier payments",
    href: "/purchases/payments",
    description: "Approve payments, allocate them to oldest bills first and block over-allocation.",
  },
  {
    title: "Creditor ageing",
    href: "/purchases/creditor-ageing",
    description: "Monitor supplier balances by due date bucket, branch, currency and supplier group.",
  },
  {
    title: "Purchasing reports",
    href: "/purchases/reports",
    description: `${purchasingReports.length} supplier, order, receiving, billing, matching, return and creditor reports.`,
  },
  {
    title: "Supplier imports",
    href: "/purchases/imports",
    description: "Validate bulk supplier, opening balance, price list and purchase document imports before posting.",
  },
];

export const supplierRiskChecks = [
  "KRA PIN format",
  "Duplicate supplier code",
  "Duplicate tax PIN",
  "Expired compliance document",
  "Payment terms approval",
  "Credit limit approval",
  "Bank details verification",
];
