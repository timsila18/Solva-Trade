import { spawnSync } from "node:child_process";

const suites = [
  "permissions",
  "configuration",
  "inventory",
  "purchasing",
  "distribution",
  "treasury",
  "accounting",
  "financial-reporting",
  "tax-compliance",
  "business-intelligence",
  "saas-platform",
  "workflow-loading",
  "transaction-form",
  "global-search",
  "service-worker",
  "sales-metrics",
  "dashboard-loading",
  "sales-dashboard-data",
  "sales-history",
  "map-with-concurrency",
  "export-performance",
];

for (const suite of suites) {
  const result = spawnSync(process.execPath, [`tests/${suite}.test.mjs`], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
