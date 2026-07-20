import { cookies } from "next/headers";
import type { BranchSummary, BusinessSummary, Membership } from "./types";

const ACTIVE_BUSINESS_COOKIE = "solva_active_business";
const ACTIVE_BRANCH_COOKIE = "solva_active_branch";

export async function getActiveBusinessId() {
  return (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
}

export async function setActiveBusinessCookie(businessId: string) {
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getActiveBranchId() {
  return (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value ?? null;
}

export async function setActiveBranchCookie(branchId: string) {
  (await cookies()).set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function requireBusinessAccess(
  memberships: Membership[],
  businessId: string | null,
) {
  const membership = memberships.find(
    (item) => item.businessId === businessId && item.active,
  );
  if (!membership) {
    throw new Error("No active business access was found for this user.");
  }
  return membership;
}

export async function getActiveBusiness(
  businesses: BusinessSummary[],
  memberships: Membership[],
) {
  const activeId = await getActiveBusinessId();
  const activeBusiness = businesses.find((business) => business.id === activeId) ?? businesses[0];
  if (!activeBusiness) return null;
  requireBusinessAccess(memberships, activeBusiness.id);
  return activeBusiness;
}

export function tenantScopedPath(businessId: string, path: string) {
  return `${businessId}/${path.replace(/^\/+/, "")}`;
}

export function canAccessBranch(membership: Membership | null, branchId: string | null) {
  if (!membership?.active || !branchId) return false;
  if (membership.role === "owner") return true;
  if (membership.branchAccessMode !== "selected") return true;
  return membership.branchIds?.includes(branchId) ?? false;
}

export function requireBranchAccess(membership: Membership | null, branchId: string | null) {
  if (!canAccessBranch(membership, branchId)) {
    throw new Error("You do not have access to this branch.");
  }
  return true;
}

export function getAccessibleBranches(branches: BranchSummary[], membership: Membership | null) {
  if (!membership?.active) return [];
  if (membership.role === "owner" || membership.branchAccessMode !== "selected") {
    return branches.filter((branch) => branch.active);
  }
  return branches.filter(
    (branch) => branch.active && membership.branchIds?.includes(branch.id),
  );
}

export async function getActiveBranch(branches: BranchSummary[], membership: Membership | null) {
  const accessible = getAccessibleBranches(branches, membership);
  const activeId = await getActiveBranchId();
  return (
    accessible.find((branch) => branch.id === activeId) ??
    accessible.find((branch) => branch.id === membership?.defaultBranchId) ??
    accessible.find((branch) => branch.isDefault) ??
    accessible[0] ??
    null
  );
}
