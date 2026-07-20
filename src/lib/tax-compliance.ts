export type TaxType =
  | "vat"
  | "withholding_tax"
  | "withholding_vat"
  | "turnover_tax"
  | "excise_duty"
  | "other_levy";

export type VatTreatment = "standard" | "zero_rated" | "exempt" | "out_of_scope" | "non_recoverable" | "partial";
export type ExternalStatus = "pending" | "queued" | "submitted" | "acknowledged" | "accepted" | "rejected" | "failed" | "retry_scheduled" | "needs_review" | "duplicate_prevented";

export type TaxRule = {
  code: string;
  type: TaxType;
  name: string;
  rate: number;
  effectiveStart: string;
  effectiveEnd?: string;
  recoverable?: boolean;
  recoverablePercentage?: number;
  externalCode?: string;
  statutory?: boolean;
};

export type VatLineInput = {
  quantity: number;
  unitPrice: number;
  vatRate: number;
  taxInclusive?: boolean;
  lineDiscount?: number;
  documentDiscountShare?: number;
  treatment?: VatTreatment;
};

export type VatLineResult = {
  grossLineAmount: number;
  discountAmount: number;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  netAmount: number;
  grossAmount: number;
  taxInclusive: boolean;
  roundingAdjustment: number;
  treatment: VatTreatment;
};

export type TaxDocumentLine = VatLineResult & {
  taxCode: string;
  taxRuleVersion: string;
  externalTaxCategory?: string;
};

export type ExternalDocument = {
  businessId: string;
  branchId?: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  documentVersion: number;
  payloadHash: string;
  status: ExternalStatus;
  externalRequestId?: string;
};

export type TaxPeriodStatus = "future" | "open" | "soft_closed" | "closed" | "reopened";

function money(value: number) {
  return Number(value.toFixed(2));
}

export function resolveEffectiveTaxRule(rules: TaxRule[], code: string, taxDate: string) {
  const date = new Date(taxDate).getTime();
  const match = rules.find((rule) => {
    const starts = new Date(rule.effectiveStart).getTime() <= date;
    const ends = !rule.effectiveEnd || new Date(rule.effectiveEnd).getTime() >= date;
    return rule.code === code && starts && ends;
  });
  if (!match) throw new Error(`No effective tax rule for ${code} on ${taxDate}.`);
  return match;
}

export function detectOverlappingTaxRules(rules: Pick<TaxRule, "code" | "effectiveStart" | "effectiveEnd">[]) {
  return rules.some((rule, index) =>
    rules.slice(index + 1).some((other) => {
      if (rule.code !== other.code) return false;
      const startA = new Date(rule.effectiveStart).getTime();
      const endA = rule.effectiveEnd ? new Date(rule.effectiveEnd).getTime() : Number.POSITIVE_INFINITY;
      const startB = new Date(other.effectiveStart).getTime();
      const endB = other.effectiveEnd ? new Date(other.effectiveEnd).getTime() : Number.POSITIVE_INFINITY;
      return startA <= endB && startB <= endA;
    }),
  );
}

export function calculateVatLine(input: VatLineInput): VatLineResult {
  if (input.quantity < 0 || input.unitPrice < 0 || input.vatRate < 0) throw new Error("VAT inputs cannot be negative.");
  const treatment = input.treatment ?? "standard";
  const grossLineAmount = money(input.quantity * input.unitPrice);
  const discountAmount = money((input.lineDiscount ?? 0) + (input.documentDiscountShare ?? 0));
  if (discountAmount > grossLineAmount) throw new Error("Discount cannot exceed gross line amount.");
  const discounted = money(grossLineAmount - discountAmount);
  const taxable = treatment === "exempt" || treatment === "out_of_scope" ? 0 : discounted;
  const rate = treatment === "zero_rated" || treatment === "exempt" || treatment === "out_of_scope" ? 0 : input.vatRate;

  if (input.taxInclusive) {
    const netAmount = rate === 0 ? taxable : money(taxable / (1 + rate / 100));
    const vatAmount = money(taxable - netAmount);
    return {
      grossLineAmount,
      discountAmount,
      taxableAmount: netAmount,
      vatRate: rate,
      vatAmount,
      netAmount,
      grossAmount: discounted,
      taxInclusive: true,
      roundingAdjustment: money(discounted - netAmount - vatAmount),
      treatment,
    };
  }

  const vatAmount = money(taxable * rate / 100);
  return {
    grossLineAmount,
    discountAmount,
    taxableAmount: taxable,
    vatRate: rate,
    vatAmount,
    netAmount: taxable,
    grossAmount: money(discounted + vatAmount),
    taxInclusive: false,
    roundingAdjustment: 0,
    treatment,
  };
}

export function allocateDocumentDiscount(lines: { grossLineAmount: number; eligible?: boolean }[], discount: number) {
  if (discount < 0) throw new Error("Discount cannot be negative.");
  const eligibleLines = lines.filter((line) => line.eligible !== false);
  const total = eligibleLines.reduce((sum, line) => sum + line.grossLineAmount, 0);
  if (discount > total) throw new Error("Document discount cannot exceed eligible taxable value.");
  let allocated = 0;
  return lines.map((line, index) => {
    if (line.eligible === false || total === 0) return 0;
    const share = index === lines.length - 1 ? money(discount - allocated) : money(discount * (line.grossLineAmount / total));
    allocated += share;
    return share;
  });
}

export function calculateVatDocument(lines: TaxDocumentLine[]) {
  return {
    taxableAmount: money(lines.reduce((sum, line) => sum + line.taxableAmount, 0)),
    vatAmount: money(lines.reduce((sum, line) => sum + line.vatAmount, 0)),
    netAmount: money(lines.reduce((sum, line) => sum + line.netAmount, 0)),
    grossAmount: money(lines.reduce((sum, line) => sum + line.grossAmount, 0)),
    roundingAdjustment: money(lines.reduce((sum, line) => sum + line.roundingAdjustment, 0)),
  };
}

export function taxMappingPrecedence(scope: "line_override" | "customer_supplier" | "product" | "category" | "business_default") {
  return ["line_override", "customer_supplier", "product", "category", "business_default"].indexOf(scope);
}

type TaxMappingScope = "line_override" | "customer_supplier" | "product" | "category" | "business_default";

export function resolveTaxMapping<T extends { code: string; scope: TaxMappingScope; scopeId?: string }>(
  mappings: T[],
  hints: Partial<Record<TaxMappingScope, string>> = {},
) {
  const match = mappings
    .filter((mapping) => mapping.scope === "business_default" || hints[mapping.scope] === mapping.scopeId)
    .sort((a, b) => taxMappingPrecedence(a.scope) - taxMappingPrecedence(b.scope))[0];
  if (!match) throw new Error("Missing tax mapping.");
  return match.code;
}

export function calculateWithholding(grossAmount: number, rate: number) {
  if (grossAmount < 0 || rate < 0) throw new Error("Withholding inputs cannot be negative.");
  const withheld = money(grossAmount * rate / 100);
  if (withheld > grossAmount) throw new Error("Withholding tax cannot exceed eligible taxable base.");
  return withheld;
}

export function validateCreditNote(originalEligible: number, priorCredits: number, requestedCredit: number) {
  if (requestedCredit < 0) throw new Error("Credit note cannot be negative.");
  if (priorCredits + requestedCredit > originalEligible) throw new Error("Credit note exceeds remaining eligible value.");
  return true;
}

export function canonicalTaxPayload(document: {
  sellerPin?: string;
  buyerPin?: string;
  documentNumber: string;
  taxDate: string;
  currency: string;
  lines: TaxDocumentLine[];
}) {
  const totals = calculateVatDocument(document.lines);
  return {
    schemaVersion: "ke-etims-canonical-v1",
    sellerPin: document.sellerPin ?? null,
    buyerPin: document.buyerPin ?? null,
    documentNumber: document.documentNumber,
    taxDate: document.taxDate,
    currency: document.currency,
    totals,
    lines: document.lines.map((line) => ({
      taxCode: line.taxCode,
      taxableAmount: line.taxableAmount,
      vatRate: line.vatRate,
      vatAmount: line.vatAmount,
      grossAmount: line.grossAmount,
      externalTaxCategory: line.externalTaxCategory ?? null,
    })),
  };
}

export function stablePayloadHash(payload: unknown) {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function preventDuplicateSubmission(existing: ExternalDocument[], next: Omit<ExternalDocument, "status">) {
  const duplicate = existing.find(
    (document) =>
      document.businessId === next.businessId &&
      document.branchId === next.branchId &&
      document.sourceDocumentType === next.sourceDocumentType &&
      document.sourceDocumentId === next.sourceDocumentId &&
      document.documentVersion === next.documentVersion &&
      document.payloadHash === next.payloadHash,
  );
  if (duplicate) throw new Error("Duplicate external tax document prevented.");
  return true;
}

export function parseEtimsError(code: string) {
  const catalog: Record<string, { errorClass: string; retrySafe: boolean; message: string; action: string }> = {
    AUTH: { errorClass: "authentication", retrySafe: false, message: "The tax integration credentials were rejected.", action: "Review credential reference and rotate credentials if needed." },
    NETWORK: { errorClass: "network", retrySafe: true, message: "The provider could not be reached.", action: "Retry when connectivity is restored." },
    TIMEOUT: { errorClass: "timeout", retrySafe: true, message: "The provider did not respond in time.", action: "Retry using the same idempotency key." },
    INVALID_TAX_CODE: { errorClass: "invalid_tax_code", retrySafe: false, message: "The provider rejected a tax code.", action: "Correct the VAT or external tax category mapping before retrying." },
    DUPLICATE: { errorClass: "duplicate_document", retrySafe: false, message: "The provider reported a possible duplicate document.", action: "Review the external document registry before any retry." },
  };
  return catalog[code] ?? { errorClass: "unknown_response", retrySafe: false, message: "The provider returned an unknown response.", action: "Review technical details before retrying." };
}

export function canMutateTaxPeriod(status: TaxPeriodStatus, reopened = false) {
  if (status === "closed" && !reopened) throw new Error("Closed tax periods are immutable without approved reopening.");
  return status === "open" || status === "soft_closed" || status === "reopened" || reopened;
}

export function prepareVatReturn(entries: { direction: "payable" | "recoverable" | "non_recoverable"; taxAmount: number; recoverableAmount?: number; nonRecoverableAmount?: number }[]) {
  const outputVat = money(entries.filter((entry) => entry.direction === "payable").reduce((sum, entry) => sum + entry.taxAmount, 0));
  const recoverableInputVat = money(entries.filter((entry) => entry.direction === "recoverable").reduce((sum, entry) => sum + (entry.recoverableAmount ?? entry.taxAmount), 0));
  const nonRecoverableVat = money(entries.reduce((sum, entry) => sum + (entry.nonRecoverableAmount ?? 0), 0));
  const netVatPayable = money(outputVat - recoverableInputVat);
  return { outputVat, recoverableInputVat, nonRecoverableVat, netVatPayable, status: "prepared" as const };
}

export function reconcileTaxLedger(sourceTotal: number, ledgerTotal: number, glTotal: number) {
  return {
    sourceToLedgerDifference: money(sourceTotal - ledgerTotal),
    ledgerToGlDifference: money(ledgerTotal - glTotal),
    reconciled: money(sourceTotal - ledgerTotal) === 0 && money(ledgerTotal - glTotal) === 0,
  };
}

export const taxReports = [
  "Business Tax Profile",
  "Tax Rule Register",
  "VAT Code Register",
  "Product Tax Mapping",
  "Customer Tax Register",
  "Supplier Tax Register",
  "Sales Tax Invoice Register",
  "Sales VAT Ledger",
  "Purchase VAT Ledger",
  "Output VAT Report",
  "Input VAT Report",
  "Recoverable Input VAT Report",
  "Non-Recoverable VAT Report",
  "Zero-Rated Sales Report",
  "Exempt Sales Report",
  "Out-of-Scope Sales Report",
  "VAT Return Preparation",
  "VAT Reconciliation",
  "VAT Control Account Reconciliation",
  "VAT Credit Note Register",
  "VAT Debit Note Register",
  "eTIMS Submission Register",
  "eTIMS Failed Documents",
  "eTIMS Pending Documents",
  "eTIMS Accepted Documents",
  "eTIMS Retry Report",
  "External Document Audit Report",
  "Supplier Tax Document Verification",
  "Withholding Tax Register",
  "Withholding Tax Return Schedule",
  "Withholding Certificate Register",
  "Withholding VAT Register",
  "Turnover Tax Schedule foundation",
  "Excise and Levy Report foundation",
  "Tax Payment Register",
  "Tax Compliance Calendar",
  "Tax Period Status",
  "Tax Audit Evidence Register",
  "Tax Diagnostics Report",
  "Tax Audit Trail",
];
