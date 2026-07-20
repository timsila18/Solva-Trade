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

function money(value) {
  return Number(value.toFixed(2));
}

function resolveEffectiveTaxRule(rules, code, taxDate) {
  const date = new Date(taxDate).getTime();
  const match = rules.find((rule) => {
    const starts = new Date(rule.effectiveStart).getTime() <= date;
    const ends = !rule.effectiveEnd || new Date(rule.effectiveEnd).getTime() >= date;
    return rule.code === code && starts && ends;
  });
  if (!match) throw new Error(`No effective tax rule for ${code}.`);
  return match;
}

function detectOverlappingTaxRules(rules) {
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

function calculateVatLine(input) {
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
    return { grossLineAmount, discountAmount, taxableAmount: netAmount, vatRate: rate, vatAmount, netAmount, grossAmount: discounted, taxInclusive: true, roundingAdjustment: money(discounted - netAmount - vatAmount), treatment };
  }
  const vatAmount = money(taxable * rate / 100);
  return { grossLineAmount, discountAmount, taxableAmount: taxable, vatRate: rate, vatAmount, netAmount: taxable, grossAmount: money(discounted + vatAmount), taxInclusive: false, roundingAdjustment: 0, treatment };
}

function allocateDocumentDiscount(lines, discount) {
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

function calculateVatDocument(lines) {
  return {
    taxableAmount: money(lines.reduce((sum, line) => sum + line.taxableAmount, 0)),
    vatAmount: money(lines.reduce((sum, line) => sum + line.vatAmount, 0)),
    grossAmount: money(lines.reduce((sum, line) => sum + line.grossAmount, 0)),
  };
}

function resolveTaxMapping(mappings, hints = {}) {
  const order = ["line_override", "customer_supplier", "product", "category", "business_default"];
  const match = mappings
    .filter((mapping) => mapping.scope === "business_default" || hints[mapping.scope] === mapping.scopeId)
    .sort((a, b) => order.indexOf(a.scope) - order.indexOf(b.scope))[0];
  if (!match) throw new Error("Missing tax mapping.");
  return match.code;
}

function calculateWithholding(grossAmount, rate) {
  const withheld = money(grossAmount * rate / 100);
  if (withheld > grossAmount) throw new Error("Withholding tax cannot exceed eligible taxable base.");
  return withheld;
}

function validateCreditNote(originalEligible, priorCredits, requestedCredit) {
  if (priorCredits + requestedCredit > originalEligible) throw new Error("Credit note exceeds remaining eligible value.");
  return true;
}

function stablePayloadHash(payload) {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function preventDuplicateSubmission(existing, next) {
  const duplicate = existing.find(
    (document) =>
      document.businessId === next.businessId &&
      document.sourceDocumentType === next.sourceDocumentType &&
      document.sourceDocumentId === next.sourceDocumentId &&
      document.documentVersion === next.documentVersion &&
      document.payloadHash === next.payloadHash,
  );
  if (duplicate) throw new Error("Duplicate external tax document prevented.");
  return true;
}

function parseEtimsError(code) {
  const catalog = {
    NETWORK: { retrySafe: true },
    TIMEOUT: { retrySafe: true },
    AUTH: { retrySafe: false },
    INVALID_TAX_CODE: { retrySafe: false },
    DUPLICATE: { retrySafe: false },
  };
  return catalog[code] ?? { retrySafe: false };
}

function prepareVatReturn(entries) {
  const outputVat = money(entries.filter((entry) => entry.direction === "payable").reduce((sum, entry) => sum + entry.taxAmount, 0));
  const recoverableInputVat = money(entries.filter((entry) => entry.direction === "recoverable").reduce((sum, entry) => sum + (entry.recoverableAmount ?? entry.taxAmount), 0));
  return { outputVat, recoverableInputVat, netVatPayable: money(outputVat - recoverableInputVat) };
}

function reconcileTaxLedger(sourceTotal, ledgerTotal, glTotal) {
  return { sourceToLedgerDifference: money(sourceTotal - ledgerTotal), ledgerToGlDifference: money(ledgerTotal - glTotal), reconciled: money(sourceTotal - ledgerTotal) === 0 && money(ledgerTotal - glTotal) === 0 };
}

function canMutateTaxPeriod(status, reopened = false) {
  if (status === "closed" && !reopened) throw new Error("Closed tax periods are immutable without approved reopening.");
  return true;
}

test("effective-dated tax rules resolve by tax date and reject overlaps", () => {
  const rules = [
    { code: "VAT_STD", rate: 16, effectiveStart: "2026-01-01", effectiveEnd: "2026-12-31" },
    { code: "VAT_STD", rate: 14, effectiveStart: "2025-01-01", effectiveEnd: "2025-12-31" },
  ];
  assert.equal(resolveEffectiveTaxRule(rules, "VAT_STD", "2026-07-20").rate, 16);
  assert.equal(detectOverlappingTaxRules([{ code: "VAT_STD", effectiveStart: "2026-01-01" }, { code: "VAT_STD", effectiveStart: "2026-06-01" }]), true);
});

test("VAT calculation handles exclusive, inclusive, zero, exempt and out-of-scope treatment", () => {
  assert.equal(calculateVatLine({ quantity: 2, unitPrice: 100, vatRate: 16 }).vatAmount, 32);
  assert.deepEqual(calculateVatLine({ quantity: 1, unitPrice: 116, vatRate: 16, taxInclusive: true }).vatAmount, 16);
  assert.equal(calculateVatLine({ quantity: 1, unitPrice: 100, vatRate: 16, treatment: "zero_rated" }).taxableAmount, 100);
  assert.equal(calculateVatLine({ quantity: 1, unitPrice: 100, vatRate: 16, treatment: "exempt" }).taxableAmount, 0);
  assert.equal(calculateVatLine({ quantity: 1, unitPrice: 100, vatRate: 16, treatment: "out_of_scope" }).grossAmount, 100);
});

test("document discounts allocate proportionally and mixed-tax totals reconcile", () => {
  const discounts = allocateDocumentDiscount([{ grossLineAmount: 100 }, { grossLineAmount: 300 }], 40);
  assert.deepEqual(discounts, [10, 30]);
  const lines = [
    { ...calculateVatLine({ quantity: 1, unitPrice: 100, vatRate: 16, documentDiscountShare: discounts[0] }), taxCode: "VAT_STD", taxRuleVersion: "v1" },
    { ...calculateVatLine({ quantity: 1, unitPrice: 300, vatRate: 0, documentDiscountShare: discounts[1], treatment: "zero_rated" }), taxCode: "VAT_ZERO", taxRuleVersion: "v1" },
  ];
  assert.deepEqual(calculateVatDocument(lines), { taxableAmount: 360, vatAmount: 14.4, grossAmount: 374.4 });
});

test("mapping precedence prefers overrides before product, category and defaults", () => {
  const mappings = [
    { code: "VAT_STD", scope: "business_default" },
    { code: "VAT_ZERO", scope: "category", scopeId: "exports" },
    { code: "VAT_EXEMPT", scope: "line_override", scopeId: "line-1" },
  ];
  assert.equal(resolveTaxMapping(mappings, { category: "exports" }), "VAT_ZERO");
  assert.equal(resolveTaxMapping(mappings, { category: "exports", line_override: "line-1" }), "VAT_EXEMPT");
});

test("credit notes and withholding stay within eligible taxable bases", () => {
  assert.equal(validateCreditNote(1000, 400, 600), true);
  assert.throws(() => validateCreditNote(1000, 700, 400), /exceeds/);
  assert.equal(calculateWithholding(1000, 5), 50);
  assert.throws(() => calculateWithholding(100, 150), /cannot exceed/);
});

test("canonical payload hashing and duplicate prevention support idempotent submission", () => {
  const payload = { schemaVersion: "ke-etims-canonical-v1", documentNumber: "INV-1", totals: { vatAmount: 16 } };
  const payloadHash = stablePayloadHash(payload);
  assert.equal(payloadHash, stablePayloadHash({ schemaVersion: "ke-etims-canonical-v1", documentNumber: "INV-1", totals: { vatAmount: 16 } }));
  assert.throws(
    () => preventDuplicateSubmission([{ businessId: "b1", sourceDocumentType: "invoice", sourceDocumentId: "i1", documentVersion: 1, payloadHash }], { businessId: "b1", sourceDocumentType: "invoice", sourceDocumentId: "i1", documentVersion: 1, payloadHash }),
    /Duplicate/,
  );
});

test("eTIMS errors classify retry safety", () => {
  assert.equal(parseEtimsError("NETWORK").retrySafe, true);
  assert.equal(parseEtimsError("TIMEOUT").retrySafe, true);
  assert.equal(parseEtimsError("INVALID_TAX_CODE").retrySafe, false);
  assert.equal(parseEtimsError("DUPLICATE").retrySafe, false);
});

test("VAT return preparation and GL reconciliation use posted tax ledger totals", () => {
  const vatReturn = prepareVatReturn([
    { direction: "payable", taxAmount: 160 },
    { direction: "recoverable", taxAmount: 60, recoverableAmount: 60 },
  ]);
  assert.deepEqual(vatReturn, { outputVat: 160, recoverableInputVat: 60, netVatPayable: 100 });
  assert.deepEqual(reconcileTaxLedger(100, 100, 100), { sourceToLedgerDifference: 0, ledgerToGlDifference: 0, reconciled: true });
});

test("closed tax periods are immutable unless a reopening has been approved", () => {
  assert.equal(canMutateTaxPeriod("open"), true);
  assert.throws(() => canMutateTaxPeriod("closed"), /Closed tax periods/);
  assert.equal(canMutateTaxPeriod("closed", true), true);
});
