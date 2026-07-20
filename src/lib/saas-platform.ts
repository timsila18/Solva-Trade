export type BusinessLifecycleStatus =
  | "pending_verification"
  | "onboarding"
  | "trial"
  | "active"
  | "grace_period"
  | "payment_overdue"
  | "restricted"
  | "suspended"
  | "cancelled"
  | "archived"
  | "scheduled_for_deletion";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "payment_pending"
  | "past_due"
  | "grace_period"
  | "restricted"
  | "suspended"
  | "cancelled"
  | "expired"
  | "pending_activation";

export type PaymentStatus =
  | "created"
  | "pending"
  | "submitted"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "reversed"
  | "needs_review";

export type PlatformRole =
  | "super_administrator"
  | "operations_administrator"
  | "support_agent"
  | "finance_administrator"
  | "security_reviewer"
  | "read_only_auditor";

export type LaunchClassification =
  | "Not Ready"
  | "Internal Testing"
  | "Pilot Ready"
  | "Limited Production"
  | "Production Ready";

export type Plan = {
  code: string;
  name: string;
  currency: string;
  interval: "monthly" | "quarterly" | "annual" | "custom";
  basePrice: number;
  trialDays: number;
  limits: Record<string, number | null>;
  entitlements: Record<string, boolean>;
};

export type UsageSnapshot = {
  metric: string;
  includedAmount: number | null;
  actualAmount: number;
  hardLimit: boolean;
  overrideAmount?: number | null;
};

export type PaymentRequest = {
  idempotencyKey: string;
  provider: "mpesa" | "card" | "bank_transfer" | "manual" | "invoice_billing" | "partner_paid" | "promotional";
  status: PaymentStatus;
  amount: number;
  verifiedAt?: string;
  providerReference?: string;
};

export type WebhookReceipt = {
  provider: string;
  eventId: string;
  payloadHash: string;
  signatureVerified: boolean;
};

export type LaunchArea = {
  area: string;
  score: number;
  criticalBlocker?: boolean;
  note: string;
};

export type PlatformAccessArea = "admin" | "support" | "finance" | "security" | "audit";

const lifecycleRestrictions: Record<BusinessLifecycleStatus, { readOnly: boolean; canTransact: boolean; canExport: boolean; message: string }> = {
  pending_verification: { readOnly: true, canTransact: false, canExport: true, message: "Workspace awaits verification." },
  onboarding: { readOnly: false, canTransact: false, canExport: true, message: "Setup may continue; live operations are held until go-live checks pass." },
  trial: { readOnly: false, canTransact: true, canExport: true, message: "Trial access follows the selected trial plan and limits." },
  active: { readOnly: false, canTransact: true, canExport: true, message: "Workspace is fully active within subscription limits." },
  grace_period: { readOnly: false, canTransact: true, canExport: true, message: "Payment grace period is active; owners should resolve billing." },
  payment_overdue: { readOnly: false, canTransact: true, canExport: true, message: "Billing is overdue and restrictions may begin after grace policy." },
  restricted: { readOnly: false, canTransact: false, canExport: true, message: "High-risk new operational transactions are restricted." },
  suspended: { readOnly: true, canTransact: false, canExport: true, message: "Read-only access is preserved with billing and export access." },
  cancelled: { readOnly: true, canTransact: false, canExport: true, message: "Workspace is cancelled within retention policy." },
  archived: { readOnly: true, canTransact: false, canExport: false, message: "Workspace is archived and not available for normal operations." },
  scheduled_for_deletion: { readOnly: true, canTransact: false, canExport: true, message: "Workspace is scheduled for deletion pending retention policy." },
};

export function lifecycleEffect(status: BusinessLifecycleStatus) {
  return lifecycleRestrictions[status];
}

export function daysRemaining(endDate: string, now = new Date()) {
  const diff = new Date(endDate).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function canUseFeature(plan: Plan, entitlement: string, override?: boolean) {
  return Boolean(override || plan.entitlements[entitlement]);
}

export function evaluateUsage(snapshot: UsageSnapshot) {
  const limit = snapshot.overrideAmount ?? snapshot.includedAmount;
  if (limit == null) return { status: "unlimited" as const, overage: 0, percentage: null, allowed: true };
  const percentage = limit === 0 ? 100 : Number(((snapshot.actualAmount / limit) * 100).toFixed(2));
  const overage = Math.max(0, snapshot.actualAmount - limit);
  const status = overage > 0 ? "over_limit" : percentage >= 100 ? "at_limit" : percentage >= 80 ? "warning" : "ok";
  return { status, overage, percentage, allowed: !snapshot.hardLimit || overage <= 0 };
}

export function canActivateSubscription(payment: PaymentRequest) {
  return payment.status === "paid" && Boolean(payment.verifiedAt && payment.providerReference);
}

export function requireVerifiedActivation(payment: PaymentRequest) {
  if (!canActivateSubscription(payment)) {
    throw new Error("Subscription activation requires verified provider confirmation.");
  }
  return true;
}

export function validatePlanChange(currentUsage: UsageSnapshot[], targetPlan: Plan) {
  const blockers = currentUsage.flatMap((usage) => {
    const targetLimit = targetPlan.limits[usage.metric];
    if (targetLimit == null) return [];
    return usage.actualAmount > targetLimit ? [`${usage.metric} exceeds target plan limit by ${usage.actualAmount - targetLimit}.`] : [];
  });
  return { allowed: blockers.length === 0, blockers };
}

export function detectWebhookReplay(existing: WebhookReceipt[], next: WebhookReceipt) {
  return existing.some(
    (receipt) =>
      receipt.provider === next.provider &&
      receipt.eventId === next.eventId &&
      receipt.payloadHash === next.payloadHash,
  );
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

export function canAccessPlatform(role: PlatformRole, area: PlatformAccessArea) {
  const matrix: Record<PlatformAccessArea, PlatformRole[]> = {
    admin: ["super_administrator"],
    support: ["super_administrator", "operations_administrator", "support_agent"],
    finance: ["super_administrator", "finance_administrator"],
    security: ["super_administrator", "security_reviewer"],
    audit: ["super_administrator", "read_only_auditor", "security_reviewer"],
  };
  return matrix[area].includes(role);
}

export function supportAccessActive(grant: { status: string; startsAt?: string; expiresAt: string }, now = new Date()) {
  const starts = !grant.startsAt || new Date(grant.startsAt) <= now;
  const notExpired = new Date(grant.expiresAt) > now;
  return grant.status === "active" && starts && notExpired;
}

export function classifyLaunchReadiness(areas: LaunchArea[]): LaunchClassification {
  if (areas.some((area) => area.criticalBlocker)) return "Not Ready";
  const average = areas.reduce((sum, area) => sum + area.score, 0) / Math.max(1, areas.length);
  if (average >= 95 && areas.every((area) => area.score >= 90)) return "Production Ready";
  if (average >= 85 && areas.every((area) => area.score >= 75)) return "Limited Production";
  if (average >= 70) return "Pilot Ready";
  if (average >= 50) return "Internal Testing";
  return "Not Ready";
}

export function csvSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function idempotencyKey(parts: string[]) {
  return parts.map((part) => part.trim().toLowerCase()).join(":");
}

export const launchReadinessAreas: LaunchArea[] = [
  { area: "Security", score: 78, note: "Security foundations exist; MFA/provider setup remains manual." },
  { area: "Tenant isolation", score: 86, note: "RLS is broad and tenant-scoped; full automated RLS harness remains next." },
  { area: "Billing", score: 74, note: "Provider-neutral billing foundation exists; live provider credentials and callbacks remain manual." },
  { area: "Data integrity", score: 82, note: "Core invariant tests pass; large-scale integration tests remain to be expanded." },
  { area: "Performance", score: 72, note: "Indexes and cache foundations exist; large-data profiling remains limited." },
  { area: "Backups", score: 68, note: "Backup verification records and documentation exist; managed backup drills remain manual.", criticalBlocker: true },
  { area: "Monitoring", score: 70, note: "Error, security, queue and integration event foundations exist; external monitoring provider setup remains manual." },
  { area: "Support", score: 80, note: "Support cases and controlled access grants exist." },
  { area: "Documentation", score: 84, note: "Launch docs are present and scoped to actual implementation." },
  { area: "Legal", score: 65, note: "Legal document versioning exists; lawyer review is required before commercial launch.", criticalBlocker: true },
];
