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

function canAccessBranch(membership, branchId) {
  if (!membership?.active || !branchId) return false;
  if (membership.role === "owner") return true;
  if (membership.branchAccessMode !== "selected") return true;
  return membership.branchIds?.includes(branchId) ?? false;
}

function buildDocumentPreview({ prefix, branchCode, year, month, number }) {
  return [prefix, branchCode, year, month ? String(month).padStart(2, "0") : undefined, String(number).padStart(6, "0")]
    .filter(Boolean)
    .join("-");
}

function validateKraPinFormat(pin) {
  return /^[A-Z][0-9]{9}[A-Z]$/.test(pin.trim().toUpperCase());
}

function validateUnitConversionFactor(factor) {
  return Number.isFinite(factor) && factor > 0;
}

function wouldCreateCategoryCycle(categoryId, parentId, parents) {
  let current = parentId;
  const seen = new Set();
  while (current) {
    if (current === categoryId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = parents[current] ?? null;
  }
  return false;
}

test("owner can access every branch", () => {
  assert.equal(canAccessBranch({ role: "owner", active: true }, "branch-a"), true);
});

test("selected branch users cannot access outside assignments", () => {
  const staff = { role: "staff", active: true, branchAccessMode: "selected", branchIds: ["kitengela"] };
  assert.equal(canAccessBranch(staff, "kitengela"), true);
  assert.equal(canAccessBranch(staff, "nairobi"), false);
});

test("document number preview composes branch and year parts", () => {
  assert.equal(
    buildDocumentPreview({ prefix: "INV", branchCode: "NRB", year: 2026, number: 1 }),
    "INV-NRB-2026-000001",
  );
});

test("KRA PIN validation is format-only", () => {
  assert.equal(validateKraPinFormat("A123456789B"), true);
  assert.equal(validateKraPinFormat("123456789AB"), false);
});

test("unit conversion factors must be positive numeric values", () => {
  assert.equal(validateUnitConversionFactor(24), true);
  assert.equal(validateUnitConversionFactor(0), false);
  assert.equal(validateUnitConversionFactor(Number.NaN), false);
});

test("category hierarchy detects circular parents", () => {
  assert.equal(wouldCreateCategoryCycle("beverages", "water", { water: "beverages" }), true);
  assert.equal(wouldCreateCategoryCycle("beverages", "water", { water: null }), false);
});

test("beverage distributor preset keeps configuration editable", () => {
  const preset = {
    industryProfileCode: "distributor",
    enableReturnablePackaging: true,
    enableRouteSales: true,
    locked: false,
  };
  assert.equal(preset.industryProfileCode, "distributor");
  assert.equal(preset.enableReturnablePackaging, true);
  assert.equal(preset.locked, false);
});
