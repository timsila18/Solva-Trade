import type { BusinessSummary, Membership } from "./types";

export const demoBusinesses: BusinessSummary[] = [];

export const demoBranches = [];

export const demoMemberships: Membership[] = [];

export const setupChecklist = [
  { label: "Complete business profile", complete: true, phase: "ready" },
  { label: "Upload logo", complete: true, phase: "ready" },
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
  activeBranches: 0,
  stockLocations: 0,
  activeUsers: 0,
  taxSetupStatus: "Not configured",
  etimsStatus: "Not connected",
  documentNumberingStatus: "Not configured",
};

export const completionPercent = Math.round(
  (setupChecklist.filter((item) => item.complete).length / setupChecklist.length) * 100,
);
