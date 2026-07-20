export type DashboardAudience =
  | "owner"
  | "general_manager"
  | "finance_manager"
  | "sales_manager"
  | "warehouse_manager"
  | "operations_manager"
  | "branch_manager"
  | "storekeeper"
  | "driver"
  | "salesperson"
  | "accountant";

export type WidgetKind =
  | "kpi_card"
  | "line_chart"
  | "bar_chart"
  | "pie_chart"
  | "donut_chart"
  | "heatmap"
  | "leaderboard"
  | "timeline"
  | "calendar"
  | "task_list"
  | "alert_list"
  | "table"
  | "gauge"
  | "sparkline"
  | "map_foundation";

export type Severity = "information" | "warning" | "critical" | "escalation";
export type TrendDirection = "higher_is_better" | "lower_is_better" | "neutral";
export type TrendLabel = "up" | "down" | "flat" | "no_data";

export type KpiDefinition = {
  code: string;
  name: string;
  category: string;
  calculationKey: string;
  owner: DashboardAudience;
  target?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  trendDirection: TrendDirection;
  permission?: string;
  displayOrder: number;
};

export type KpiSnapshot = {
  code: string;
  value: number | null;
  previousValue?: number | null;
  target?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  trendDirection: TrendDirection;
};

export type HealthComponent = {
  category: string;
  score: number | null;
  trend: TrendLabel;
  explanation: string;
  recommendation?: string;
  weight: number;
};

export type TimelineEvent = {
  time: string;
  module: string;
  title: string;
  importance: Severity;
  branch?: string;
  quickAction?: string;
};

export type AlertInput = {
  code: string;
  title: string;
  description: string;
  module: string;
  severity: Severity;
  value?: number;
  threshold?: number;
};

export type RecommendationInput = {
  code: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  priority: Severity;
  sourceModule: string;
};

export type DashboardFact = {
  label: string;
  value: number | string | null;
  source: string;
  permission?: string;
  forecast?: boolean;
};

const scoreOrder: Record<Severity, number> = {
  information: 0,
  warning: 1,
  critical: 2,
  escalation: 3,
};

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

export function trend(current: number | null | undefined, previous: number | null | undefined): TrendLabel {
  if (current == null || previous == null) return "no_data";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

export function scoreKpi(snapshot: KpiSnapshot) {
  if (snapshot.value == null) return null;
  const { value, target, warningThreshold, criticalThreshold, trendDirection } = snapshot;
  if (trendDirection === "neutral" || target == null) return clampScore(100);
  const higher = trendDirection === "higher_is_better";
  if (criticalThreshold != null && (higher ? value <= criticalThreshold : value >= criticalThreshold)) return 25;
  if (warningThreshold != null && (higher ? value <= warningThreshold : value >= warningThreshold)) return 60;
  const ratio = higher ? value / target : target / Math.max(value, 0.0001);
  return clampScore(Math.min(1.2, ratio) * 83.33);
}

export function calculateBusinessHealth(components: HealthComponent[]) {
  const usable = components.filter((component) => component.score != null && component.weight > 0);
  if (usable.length === 0) return null;
  const totalWeight = usable.reduce((sum, component) => sum + component.weight, 0);
  return clampScore(
    usable.reduce((sum, component) => sum + (component.score ?? 0) * component.weight, 0) / totalWeight,
  );
}

export function generateHealthComponents(snapshots: KpiSnapshot[], weights: Record<string, number> = {}) {
  return snapshots.map<HealthComponent>((snapshot) => {
    const score = scoreKpi(snapshot);
    const snapshotTrend = trend(snapshot.value, snapshot.previousValue);
    const hasData = score != null;
    return {
      category: snapshot.code,
      score,
      trend: snapshotTrend,
      explanation: hasData
        ? `${snapshot.code} is scored from the latest stored KPI snapshot and its configured threshold.`
        : `${snapshot.code} has no posted source data yet.`,
      recommendation: hasData && score < 60 ? "Review the source workflow and resolve the oldest exception first." : undefined,
      weight: weights[snapshot.code] ?? 1,
    };
  });
}

export function generateMorningBrief(facts: DashboardFact[], previousFacts: DashboardFact[] = []) {
  const statements = facts.flatMap((fact) => {
    if (fact.value == null || fact.value === "No data") return [];
    const previous = previousFacts.find((item) => item.label === fact.label);
    const numeric = typeof fact.value === "number" ? fact.value : null;
    const previousNumeric = typeof previous?.value === "number" ? previous.value : null;
    const change =
      numeric != null && previousNumeric != null && previousNumeric !== 0
        ? `, ${Math.abs(((numeric - previousNumeric) / previousNumeric) * 100).toFixed(1)}% ${numeric >= previousNumeric ? "higher" : "lower"} than the previous period`
        : "";
    return [`${fact.label}: ${fact.value}${change}. Source: ${fact.source}.`];
  });
  return {
    greeting: "Good morning.",
    summary: statements.length === 0 ? "No posted operating data is available for this morning's brief yet." : statements.join(" "),
    statements,
  };
}

export function rankAlerts(alerts: AlertInput[]) {
  return [...alerts].sort((a, b) => scoreOrder[b.severity] - scoreOrder[a.severity] || a.title.localeCompare(b.title));
}

export function generateRecommendations(alerts: AlertInput[]) {
  return rankAlerts(alerts).map<RecommendationInput>((alert) => ({
    code: `recommend_${alert.code}`,
    title: alert.title,
    explanation: alert.description,
    recommendedAction: alert.threshold == null
      ? "Review the related record and assign an owner before closing the alert."
      : `Review ${alert.module} because ${alert.value ?? "the metric"} crossed the ${alert.threshold} threshold.`,
    priority: alert.severity,
    sourceModule: alert.module,
  }));
}

export function compareTrend(current: number | null, comparison: number | null) {
  if (current == null || comparison == null) {
    return { absoluteChange: null, percentageChange: null, trend: "no_data" as const };
  }
  const absoluteChange = Number((current - comparison).toFixed(4));
  const percentageChange = comparison === 0 ? null : Number(((absoluteChange / Math.abs(comparison)) * 100).toFixed(4));
  return { absoluteChange, percentageChange, trend: trend(current, comparison) };
}

export function cacheFresh(generatedAt: string, ttlSeconds: number, now = new Date()) {
  return now.getTime() - new Date(generatedAt).getTime() <= ttlSeconds * 1000;
}

export function canSeeAudience(userRole: "owner" | "manager" | "staff", audience: DashboardAudience) {
  if (userRole === "owner") return true;
  if (userRole === "manager") return !["owner"].includes(audience);
  return ["storekeeper", "driver", "salesperson", "accountant"].includes(audience);
}

export function filterWidgetsByPermission<T extends { permission?: string }>(
  widgets: T[],
  canPerform: (permission: string) => boolean,
) {
  return widgets.filter((widget) => !widget.permission || canPerform(widget.permission));
}

export function dataQualityScore(issueCounts: number[]) {
  const total = issueCounts.reduce((sum, count) => sum + count, 0);
  return clampScore(100 - Math.min(100, total * 5));
}

export function systemHealthStatus(values: { status: "healthy" | "watch" | "critical" | "unknown" }[]) {
  if (values.some((value) => value.status === "critical")) return "critical";
  if (values.some((value) => value.status === "watch")) return "watch";
  if (values.some((value) => value.status === "unknown")) return "unknown";
  return "healthy";
}

export const widgetCatalog: { key: string; title: string; kind: WidgetKind; permission?: string }[] = [
  { key: "business_health", title: "Business Health", kind: "gauge", permission: "dashboard.view_business_health" },
  { key: "morning_brief", title: "Morning Brief", kind: "timeline", permission: "dashboard.view_business_insights" },
  { key: "cash_position", title: "Cash Position", kind: "kpi_card", permission: "finance.view_cashbook" },
  { key: "sales_today", title: "Sales Today", kind: "kpi_card", permission: "sales.view" },
  { key: "collections_today", title: "Collections Today", kind: "kpi_card", permission: "finance.create_receipts" },
  { key: "inventory_alerts", title: "Inventory Alerts", kind: "alert_list", permission: "inventory.view_stock" },
  { key: "route_performance", title: "Route Performance", kind: "bar_chart", permission: "distribution.view_deliveries" },
  { key: "tax_compliance", title: "Tax Compliance", kind: "kpi_card", permission: "tax.view_tax_reports" },
  { key: "accounting_status", title: "Accounting Status", kind: "kpi_card", permission: "accounting.view_general_ledger" },
  { key: "budget_performance", title: "Budget Performance", kind: "line_chart", permission: "financial_reporting.view_statements" },
  { key: "recommendations", title: "Recommended Actions", kind: "task_list", permission: "dashboard.view_business_insights" },
  { key: "business_timeline", title: "Business Timeline", kind: "timeline", permission: "dashboard.view_business_insights" },
  { key: "calendar", title: "Upcoming Obligations", kind: "calendar", permission: "dashboard.view_business_insights" },
  { key: "data_quality", title: "Data Quality", kind: "heatmap", permission: "dashboard.view_data_quality" },
  { key: "system_health", title: "System Health", kind: "table", permission: "dashboard.view_system_health" },
];

export const executiveReports = [
  "Executive Dashboard",
  "Business Health",
  "Morning Brief Archive",
  "KPI Report",
  "Alert Report",
  "Timeline Report",
  "Recommendation Report",
  "Trend Report",
  "Branch Dashboard",
  "Executive Pack",
  "Operational Dashboard",
  "Data Quality Report",
  "System Health Report",
];
