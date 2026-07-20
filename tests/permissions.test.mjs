import assert from "node:assert/strict";

const owner = {
  userId: "u1",
  businessId: "b1",
  role: "owner",
  permissions: [],
  active: true,
};

const staff = {
  userId: "u2",
  businessId: "b1",
  role: "staff",
  permissions: ["sales.create"],
  active: true,
};

const roleDefaults = {
  owner: ["administration.manage_users", "finance.view_owner_transactions", "sales.create"],
  manager: ["dashboard.view_manager", "sales.create"],
  staff: ["dashboard.view_staff"],
};

function canPerformAction(membership, permission) {
  if (!membership?.active) return false;
  if (membership.role === "owner") return true;
  return [...new Set([...roleDefaults[membership.role], ...membership.permissions])].includes(permission);
}

function assertOwnerProtection({ target, activeOwnerCount, nextRole, deactivate }) {
  if (target.role === "owner" && (deactivate || nextRole !== "owner") && activeOwnerCount <= 1) {
    throw new Error("A business must retain at least one active Owner.");
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("owner can perform every protected action", () => {
  assert.equal(canPerformAction(owner, "administration.manage_users"), true);
  assert.equal(canPerformAction(owner, "finance.view_owner_transactions"), true);
});

test("staff needs explicit permission overrides for operational actions", () => {
  assert.equal(canPerformAction(staff, "sales.create"), true);
  assert.equal(canPerformAction(staff, "administration.manage_users"), false);
});

test("last active owner cannot be demoted or deactivated", () => {
  assert.throws(
    () => assertOwnerProtection({ target: owner, activeOwnerCount: 1, nextRole: "manager" }),
    /at least one active Owner/,
  );
  assert.throws(
    () => assertOwnerProtection({ target: owner, activeOwnerCount: 1, deactivate: true }),
    /at least one active Owner/,
  );
});
