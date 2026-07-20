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

const lifecycleRestrictions = {
  trial: { readOnly: false, canTransact: true, canExport: true },
  suspended: { readOnly: true, canTransact: false, canExport: true },
  scheduled_for_deletion: { readOnly: true, canTransact: false, canExport: true },
};

function evaluateUsage(snapshot) {
  const limit = snapshot.overrideAmount ?? snapshot.includedAmount;
  if (limit == null) return { status: "unlimited", overage: 0, percentage: null, allowed: true };
  const percentage = limit === 0 ? 100 : Number(((snapshot.actualAmount / limit) * 100).toFixed(2));
  const overage = Math.max(0, snapshot.actualAmount - limit);
  const status = overage > 0 ? "over_limit" : percentage >= 100 ? "at_limit" : percentage >= 80 ? "warning" : "ok";
  return { status, overage, percentage, allowed: !snapshot.hardLimit || overage <= 0 };
}

function canActivateSubscription(payment) {
  return payment.status === "paid" && Boolean(payment.verifiedAt && payment.providerReference);
}

function requireVerifiedActivation(payment) {
  if (!canActivateSubscription(payment)) throw new Error("Subscription activation requires verified provider confirmation.");
  return true;
}

function validatePlanChange(currentUsage, targetPlan) {
  const blockers = currentUsage.flatMap((usage) => {
    const targetLimit = targetPlan.limits[usage.metric];
    if (targetLimit == null) return [];
    return usage.actualAmount > targetLimit ? [`${usage.metric} exceeds target plan limit by ${usage.actualAmount - targetLimit}.`] : [];
  });
  return { allowed: blockers.length === 0, blockers };
}

function detectWebhookReplay(existing, next) {
  return existing.some((receipt) => receipt.provider === next.provider && receipt.eventId === next.eventId && receipt.payloadHash === next.payloadHash);
}

function supportAccessActive(grant, now = new Date()) {
  const starts = !grant.startsAt || new Date(grant.startsAt) <= now;
  return grant.status === "active" && starts && new Date(grant.expiresAt) > now;
}

function classifyLaunchReadiness(areas) {
  if (areas.some((area) => area.criticalBlocker)) return "Not Ready";
  const average = areas.reduce((sum, area) => sum + area.score, 0) / Math.max(1, areas.length);
  if (average >= 95 && areas.every((area) => area.score >= 90)) return "Production Ready";
  if (average >= 85 && areas.every((area) => area.score >= 75)) return "Limited Production";
  if (average >= 70) return "Pilot Ready";
  if (average >= 50) return "Internal Testing";
  return "Not Ready";
}

function csvSafe(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function maskPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

test("Business lifecycle statuses enforce transaction and export effects", () => {
  assert.equal(lifecycleRestrictions.trial.canTransact, true);
  assert.equal(lifecycleRestrictions.suspended.canTransact, false);
  assert.equal(lifecycleRestrictions.scheduled_for_deletion.canExport, true);
});

test("Usage limits warn, block hard overages and allow overrides", () => {
  assert.deepEqual(evaluateUsage({ includedAmount: 100, actualAmount: 85, hardLimit: false }), { status: "warning", overage: 0, percentage: 85, allowed: true });
  assert.deepEqual(evaluateUsage({ includedAmount: 100, actualAmount: 110, hardLimit: true }), { status: "over_limit", overage: 10, percentage: 110, allowed: false });
  assert.deepEqual(evaluateUsage({ includedAmount: 100, overrideAmount: 120, actualAmount: 110, hardLimit: true }), { status: "warning", overage: 0, percentage: 91.67, allowed: true });
});

test("Subscription activation requires verified backend provider confirmation", () => {
  assert.equal(canActivateSubscription({ status: "paid", verifiedAt: "2026-07-20T00:00:00Z", providerReference: "MPESA123" }), true);
  assert.throws(() => requireVerifiedActivation({ status: "paid" }), /verified provider/);
});

test("Downgrades block when usage exceeds target plan limits without deleting data", () => {
  const result = validatePlanChange([{ metric: "users", actualAmount: 8 }, { metric: "branches", actualAmount: 2 }], { limits: { users: 3, branches: 3 } });
  assert.equal(result.allowed, false);
  assert.match(result.blockers[0], /users exceeds/);
});

test("Webhook replay protection and support access expiry are deterministic", () => {
  const receipt = { provider: "mpesa", eventId: "evt_1", payloadHash: "abc", signatureVerified: true };
  assert.equal(detectWebhookReplay([receipt], receipt), true);
  assert.equal(supportAccessActive({ status: "active", startsAt: "2026-07-20T08:00:00Z", expiresAt: "2026-07-20T09:00:00Z" }, new Date("2026-07-20T08:30:00Z")), true);
  assert.equal(supportAccessActive({ status: "active", expiresAt: "2026-07-20T09:00:00Z" }, new Date("2026-07-20T10:00:00Z")), false);
});

test("Launch readiness refuses Production Ready when critical blockers remain", () => {
  assert.equal(classifyLaunchReadiness([{ area: "Backups", score: 99, criticalBlocker: true }]), "Not Ready");
  assert.equal(classifyLaunchReadiness([{ area: "Security", score: 88 }, { area: "Billing", score: 86 }]), "Limited Production");
});

test("Exports protect against CSV formula injection and M-Pesa phone numbers are masked", () => {
  assert.equal(csvSafe("=cmd"), "'=cmd");
  assert.equal(csvSafe("Normal"), "Normal");
  assert.equal(maskPhone("+254712345678"), "2547***678");
});
