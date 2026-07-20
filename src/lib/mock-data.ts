import type { BusinessSummary, Membership } from "./types";
import { permissionsForRole } from "./permissions";

export const demoBusinesses: BusinessSummary[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    tradingName: "Aquamist Nairobi Distributor",
    legalName: "Aquamist Nairobi Distribution Ltd",
    role: "owner",
    onboardingStatus: "in_progress",
    industryProfileCode: "distributor",
    advancedSettingsEnabled: true,
  },
];

export const demoBranches = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    businessId: demoBusinesses[0].id,
    name: "Nairobi Depot",
    code: "NRB",
    type: "Distribution Centre",
    active: true,
    isDefault: true,
  },
];

export const demoMemberships: Membership[] = [
  {
    userId: "22222222-2222-4222-8222-222222222222",
    businessId: demoBusinesses[0].id,
    role: "owner",
    permissions: permissionsForRole("owner"),
    active: true,
    branchAccessMode: "all",
    defaultBranchId: demoBranches[0].id,
  },
];

export const setupChecklist = [
  { label: "Complete business profile", complete: true, phase: "ready" },
  { label: "Upload logo", complete: false, phase: "ready" },
  { label: "Configure tax status", complete: true, phase: "ready" },
  { label: "Add first branch", complete: true, phase: "ready" },
  { label: "Add first stock location", complete: true, phase: "ready" },
  { label: "Configure financial year", complete: true, phase: "ready" },
  { label: "Configure default currency", complete: true, phase: "ready" },
  { label: "Configure document numbering", complete: true, phase: "ready" },
  { label: "Configure payment methods", complete: true, phase: "ready" },
  { label: "Configure customer credit settings", complete: false, phase: "ready" },
  { label: "Select business profile", complete: true, phase: "ready" },
  { label: "Add first category", complete: false, phase: "ready" },
  { label: "Add first brand", complete: false, phase: "ready" },
];

export const configurationStats = {
  activeBranches: 1,
  stockLocations: 1,
  activeUsers: 1,
  taxSetupStatus: "Configured",
  etimsStatus: "Setup pending",
  documentNumberingStatus: "Configured",
};

export const completionPercent = Math.round(
  (setupChecklist.filter((item) => item.complete).length / setupChecklist.length) * 100,
);
