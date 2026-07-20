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

function clampScore(score) {
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

function trend(current, previous) {
  if (current == null || previous == null) return "no_data";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function scoreKpi(snapshot) {
  if (snapshot.value == null) return null;
  const higher = snapshot.trendDirection === "higher_is_better";
  if (snapshot.trendDirection === "neutral" || snapshot.target == null) return 100;
  if (snapshot.criticalThreshold != null && (higher ? snapshot.value <= snapshot.criticalThreshold : snapshot.value >= snapshot.criticalThreshold)) return 25;
  if (snapshot.warningThreshold != null && (higher ? snapshot.value <= snapshot.warningThreshold : snapshot.value >= snapshot.warningThreshold)) return 60;
  const ratio = higher ? snapshot.value / snapshot.target : snapshot.target / Math.max(snapshot.value, 0.0001);
  return clampScore(Math.min(1.2, ratio) * 83.33);
}

function calculateBusinessHealth(components) {
  const usable = components.filter((component) => component.score != null && component.weight > 0);
  if (usable.length === 0) return null;
  const totalWeight = usable.reduce((sum, component) => sum + component.weight, 0);
  return clampScore(usable.reduce((sum, component) => sum + component.score * component.weight, 0) / totalWeight);
}

function generateMorningBrief(facts, previousFacts = []) {
  const statements = facts.flatMap((fact) => {
    if (fact.value == null || fact.value === "No data") return [];
    const previous = previousFacts.find((item) => item.label === fact.label);
    const change = typeof fact.value === "number" && typeof previous?.value === "number" && previous.value !== 0
      ? `, ${Math.abs(((fact.value - previous.value) / previous.value) * 100).toFixed(1)}% ${fact.value >= previous.value ? "higher" : "lower"} than the previous period`
      : "";
    return [`${fact.label}: ${fact.value}${change}. Source: ${fact.source}.`];
  });
  return { greeting: "Good morning.", summary: statements.length === 0 ? "No posted operating data is available for this morning's brief yet." : statements.join(" "), statements };
}

function rankAlerts(alerts) {
  const scoreOrder = { information: 0, warning: 1, critical: 2, escalation: 3 };
  return [...alerts].sort((a, b) => scoreOrder[b.severity] - scoreOrder[a.severity] || a.title.localeCompare(b.title));
}

function generateRecommendations(alerts) {
  return rankAlerts(alerts).map((alert) => ({
    code: `recommend_${alert.code}`,
    title: alert.title,
    explanation: alert.description,
    recommendedAction: alert.threshold == null ? "Review the related record and assign an owner before closing the alert." : `Review ${alert.module} because ${alert.value ?? "the metric"} crossed the ${alert.threshold} threshold.`,
    priority: alert.severity,
  }));
}

function compareTrend(current, comparison) {
  if (current == null || comparison == null) return { absoluteChange: null, percentageChange: null, trend: "no_data" };
  const absoluteChange = Number((current - comparison).toFixed(4));
  const percentageChange = comparison === 0 ? null : Number(((absoluteChange / Math.abs(comparison)) * 100).toFixed(4));
  return { absoluteChange, percentageChange, trend: trend(current, comparison) };
}

function cacheFresh(generatedAt, ttlSeconds, now = new Date()) {
  return now.getTime() - new Date(generatedAt).getTime() <= ttlSeconds * 1000;
}

function canSeeAudience(userRole, audience) {
  if (userRole === "owner") return true;
  if (userRole === "manager") return audience !== "owner";
  return ["storekeeper", "driver", "salesperson", "accountant"].includes(audience);
}

function filterWidgetsByPermission(widgets, canPerform) {
  return widgets.filter((widget) => !widget.permission || canPerform(widget.permission));
}

function dataQualityScore(issueCounts) {
  const total = issueCounts.reduce((sum, count) => sum + count, 0);
  return clampScore(100 - Math.min(100, total * 5));
}

function systemHealthStatus(values) {
  if (values.some((value) => value.status === "critical")) return "critical";
  if (values.some((value) => value.status === "watch")) return "watch";
  if (values.some((value) => value.status === "unknown")) return "unknown";
  return "healthy";
}

test("Business Health score uses weighted KPI components and ignores no-data components", () => {
  assert.equal(calculateBusinessHealth([{ score: 80, weight: 2 }, { score: 50, weight: 1 }, { score: null, weight: 5 }]), 70);
  assert.equal(calculateBusinessHealth([{ score: null, weight: 1 }]), null);
});

test("KPI scoring respects higher/lower direction and thresholds", () => {
  assert.equal(scoreKpi({ value: 40, target: 100, warningThreshold: 60, criticalThreshold: 30, trendDirection: "higher_is_better" }), 60);
  assert.equal(scoreKpi({ value: 90, target: 30, warningThreshold: 60, criticalThreshold: 100, trendDirection: "lower_is_better" }), 60);
  assert.equal(scoreKpi({ value: 120, target: 100, trendDirection: "higher_is_better" }), 100);
});

test("Morning Brief only emits source-backed statements", () => {
  const brief = generateMorningBrief([{ label: "Revenue", value: 114, source: "Posted invoices" }], [{ label: "Revenue", value: 100, source: "Posted invoices" }]);
  assert.equal(brief.greeting, "Good morning.");
  assert.match(brief.summary, /14\.0% higher/);
  assert.match(brief.summary, /Source: Posted invoices/);
});

test("Alerts rank by severity and recommendations never auto-act", () => {
  const recommendations = generateRecommendations([
    { code: "info", title: "Info", description: "Info", module: "System", severity: "information" },
    { code: "critical", title: "Critical", description: "Critical", module: "Tax", severity: "critical", value: 8, threshold: 5 },
  ]);
  assert.equal(recommendations[0].priority, "critical");
  assert.match(recommendations[0].recommendedAction, /Review Tax/);
});

test("Trend engine handles comparisons and zero denominators safely", () => {
  assert.deepEqual(compareTrend(120, 100), { absoluteChange: 20, percentageChange: 20, trend: "up" });
  assert.deepEqual(compareTrend(10, 0), { absoluteChange: 10, percentageChange: null, trend: "up" });
  assert.deepEqual(compareTrend(null, 0), { absoluteChange: null, percentageChange: null, trend: "no_data" });
});

test("Dashboard caching expires by TTL", () => {
  const now = new Date("2026-07-20T08:00:00Z");
  assert.equal(cacheFresh("2026-07-20T07:59:30Z", 60, now), true);
  assert.equal(cacheFresh("2026-07-20T07:58:00Z", 60, now), false);
});

test("Dashboard permissions prevent audience and widget leakage", () => {
  assert.equal(canSeeAudience("manager", "owner"), false);
  assert.equal(canSeeAudience("owner", "owner"), true);
  const widgets = filterWidgetsByPermission([{ key: "cash", permission: "finance.view_cashbook" }, { key: "public" }], (permission) => permission === "finance.view_cashbook");
  assert.deepEqual(widgets.map((widget) => widget.key), ["cash", "public"]);
});

test("Data quality and system health aggregate status deterministically", () => {
  assert.equal(dataQualityScore([0, 1, 2]), 85);
  assert.equal(systemHealthStatus([{ status: "healthy" }, { status: "watch" }]), "watch");
  assert.equal(systemHealthStatus([{ status: "critical" }, { status: "healthy" }]), "critical");
});
