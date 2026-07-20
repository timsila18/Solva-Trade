import { taxReports } from "./tax-compliance";

export const taxSummary = {
  profileStatus: "Needs verification",
  kraPin: "Not captured",
  vatRegistration: "Not confirmed",
  etimsStatus: "Manual tracking mode",
  pendingEtimsDocuments: "0",
  failedEtimsDocuments: "0",
  acceptedEtimsDocuments: "0",
  currentVatBalance: "KES 0.00",
  outputVat: "KES 0.00",
  recoverableInputVat: "KES 0.00",
  nonRecoverableVat: "KES 0.00",
  withholdingCertificatesPending: "0",
  nextFilingDue: "No open filing period",
  taxPeriodStatus: "No open tax period",
  reconciliationStatus: "No posted tax ledger",
  auditEvidenceItems: "0",
};

export const taxWorkflows = [
  { title: "Business Tax Profile", href: "/tax/setup-profile", description: "Capture KRA PIN, VAT registration status, tax obligations, taxpayer type and verification notes." },
  { title: "Branch and Outlet Setup", href: "/tax/branch-outlets", description: "Map branches to tax outlets, invoice series, device references and submission modes." },
  { title: "Tax Rules", href: "/tax/tax-rules", description: "Maintain effective-dated VAT, withholding, turnover, excise and levy rules with overlap prevention." },
  { title: "VAT Codes", href: "/tax/vat-codes", description: "Configure standard, zero-rated, exempt, out-of-scope and recoverability treatment codes." },
  { title: "Product Tax Mappings", href: "/tax/mappings", description: "Resolve tax codes by product, category, branch, counterparty and line override precedence." },
  { title: "Customer Tax Profiles", href: "/tax/customers", description: "Track buyer PINs, exemption references, export status and withholding-agent flags." },
  { title: "Supplier Tax Profiles", href: "/tax/suppliers", description: "Track supplier PINs, VAT status, withholding applicability and default purchase treatment." },
  { title: "VAT Calculator", href: "/tax/vat-calculator", description: "Calculate exclusive and inclusive VAT, document discounts, rounding and mixed-tax totals." },
  { title: "Sales Tax Documents", href: "/tax/sales-documents", description: "Register invoices, receipts, credit notes and debit notes with immutable tax snapshots." },
  { title: "Purchase Tax Documents", href: "/tax/purchase-documents", description: "Verify supplier tax documents and route recoverable or non-recoverable input VAT." },
  { title: "Credit and Debit Notes", href: "/tax/credit-debit-notes", description: "Link adjustments to original documents and prevent credits above remaining eligible value." },
  { title: "eTIMS Configuration", href: "/tax/etims-config", description: "Store provider, environment, adapter and credential references without exposing secrets." },
  { title: "eTIMS Queue", href: "/tax/etims-queue", description: "Track canonical payloads, idempotency keys, retry safety and external response states." },
  { title: "External Document Registry", href: "/tax/external-registry", description: "Maintain external receipt, control-unit, QR and signature references for audit follow-up." },
  { title: "VAT Ledgers", href: "/tax/vat-ledgers", description: "Review payable, recoverable and non-recoverable VAT by period, branch, source and GL link." },
  { title: "VAT Return", href: "/tax/vat-return", description: "Prepare VAT returns from posted tax ledger entries and reconcile source, ledger and GL totals." },
  { title: "Withholding Tax", href: "/tax/withholding", description: "Calculate withholding tax, prepare schedules and maintain certificate references." },
  { title: "Withholding VAT", href: "/tax/withholding-vat", description: "Separate withholding VAT obligations from normal VAT and supplier payment workflows." },
  { title: "Turnover, Excise and Levies", href: "/tax/turnover-excise", description: "Foundation registers for turnover tax, excise duty, import levies and custom statutory charges." },
  { title: "Compliance Calendar", href: "/tax/calendar", description: "Track filing, payment, reminder, responsible user and completion status for obligations." },
  { title: "Tax Periods", href: "/tax/periods", description: "Open, soft close, close and reopen tax periods with immutable-posting controls." },
  { title: "Audit Evidence", href: "/tax/evidence", description: "Collect source documents, provider payload hashes, filings, payments and approval evidence." },
  { title: "Imports", href: "/tax/imports", description: "Stage supplier tax document, VAT ledger and external reference imports with validation results." },
  { title: "Reports", href: "/tax/reports", description: `${taxReports.length} statutory, reconciliation, diagnostic and audit reports are registered.` },
  { title: "Integration Health", href: "/tax/integration-health", description: "Monitor missing credential references, pending queues, failures and oldest pending documents." },
];

export const taxProfileChecklist = [
  "KRA PIN captured and format-reviewed",
  "VAT registration status and effective date confirmed",
  "eTIMS branch or outlet references mapped",
  "VAT, withholding and levy obligations selected",
  "Tax contact and evidence retention owner assigned",
  "Default VAT codes mapped to products and purchase categories",
];

export const vatCodes = [
  ["VAT_STD", "Standard VAT", "16%", "Sales and purchases", "Recoverable where eligible"],
  ["VAT_ZERO", "Zero-rated", "0%", "Exports and zero-rated supplies", "Report separately from exempt"],
  ["VAT_EXEMPT", "Exempt", "0%", "Exempt supplies", "No output VAT charged"],
  ["VAT_OUT_OF_SCOPE", "Out of scope", "0%", "Non-taxable movements", "Excluded from VAT return boxes"],
  ["VAT_NON_RECOVERABLE", "Non-recoverable input", "16%", "Blocked input VAT", "Posted to expense or asset cost"],
  ["VAT_PARTIAL", "Partially recoverable input", "16%", "Mixed-use purchases", "Recoverability percentage stored"],
];

export const taxStatusCards = [
  ["VAT return status", taxSummary.taxPeriodStatus],
  ["eTIMS failed docs", taxSummary.failedEtimsDocuments],
  ["eTIMS pending docs", taxSummary.pendingEtimsDocuments],
  ["Withholding certificates pending", taxSummary.withholdingCertificatesPending],
  ["Next tax filing due", taxSummary.nextFilingDue],
  ["Tax profile completeness", taxSummary.profileStatus],
];

export const etimsLifecycle = [
  "pending",
  "queued",
  "submitting",
  "submitted",
  "acknowledged",
  "accepted",
  "rejected",
  "failed",
  "retry_scheduled",
  "needs_review",
  "duplicate_prevented",
];

export const taxComplianceNotes = [
  "The eTIMS layer is provider-neutral and stores credential references only; certified adapter code can be added behind the same queue later.",
  "Tax returns are prepared from posted tax ledger entries so draft sales, purchases and journals do not leak into statutory reports.",
  "Closed tax periods reject new tax documents and tax ledger entries unless a controlled reopening workflow records the reason.",
];
