do $$
begin
  create type public.dashboard_audience as enum (
    'owner',
    'general_manager',
    'finance_manager',
    'sales_manager',
    'warehouse_manager',
    'operations_manager',
    'branch_manager',
    'storekeeper',
    'driver',
    'salesperson',
    'accountant'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.intelligence_frequency as enum ('daily','weekly','monthly','quarterly','annual','rolling');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.alert_severity as enum ('information','warning','critical','escalation');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.alert_status as enum ('open','acknowledged','resolved','expired','muted');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.recommendation_status as enum ('open','accepted','dismissed','completed','expired');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.widget_kind as enum ('kpi_card','line_chart','bar_chart','pie_chart','donut_chart','heatmap','leaderboard','timeline','calendar','task_list','alert_list','table','gauge','sparkline','map_foundation');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.trend_period as enum ('day','week','month','quarter','year','rolling');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.trend_comparison as enum ('previous','budget','forecast','target','branch','last_year');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.notification_priority as enum ('low','normal','high','urgent');
exception
  when duplicate_object then null;
end;
$$;

create table public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  kpi_code text not null,
  name text not null,
  description text not null,
  category text not null,
  owner_role public.dashboard_audience not null default 'owner',
  calculation_key text not null,
  target numeric(18, 4),
  warning_threshold numeric(18, 4),
  critical_threshold numeric(18, 4),
  frequency public.intelligence_frequency not null default 'daily',
  trend_direction text not null default 'higher_is_better' check (trend_direction in ('higher_is_better','lower_is_better','neutral')),
  icon text,
  display_order integer not null default 100,
  required_permission text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, kpi_code)
);

create table public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  kpi_definition_id uuid not null references public.kpi_definitions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  frequency public.intelligence_frequency not null,
  value numeric(18, 4),
  target numeric(18, 4),
  warning_threshold numeric(18, 4),
  critical_threshold numeric(18, 4),
  trend_value numeric(18, 4),
  comparison_label text,
  status text not null default 'no_data' check (status in ('healthy','watch','critical','no_data')),
  explanation text,
  source_hash text,
  generated_at timestamptz not null default now(),
  unique (business_id, branch_id, kpi_definition_id, period_start, period_end)
);

create table public.business_health_weights (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null,
  weight numeric(9, 4) not null check (weight >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, category)
);

create table public.business_health_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  score_date date not null,
  overall_score numeric(9, 4) check (overall_score between 0 and 100),
  previous_score numeric(9, 4),
  trend text not null default 'flat' check (trend in ('up','down','flat','no_data')),
  generated_from text not null default 'kpi_snapshots',
  generated_at timestamptz not null default now(),
  unique (business_id, branch_id, score_date)
);

create table public.business_health_components (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  health_score_id uuid references public.business_health_scores(id) on delete cascade,
  category text not null,
  score numeric(9, 4) check (score between 0 and 100),
  trend text not null default 'flat' check (trend in ('up','down','flat','no_data')),
  explanation text not null,
  recommendation text,
  source_metric_code text,
  weight numeric(9, 4) not null default 1,
  created_at timestamptz not null default now()
);

create table public.morning_briefs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  brief_date date not null,
  audience public.dashboard_audience not null default 'owner',
  greeting text not null default 'Good morning.',
  summary text not null,
  statements jsonb not null default '[]'::jsonb,
  source_snapshot_id uuid,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id),
  unique (business_id, branch_id, brief_date, audience)
);

create table public.business_timeline_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  event_time timestamptz not null default now(),
  user_id uuid references public.profiles(id),
  module text not null,
  event_type text not null,
  title text not null,
  description text,
  importance public.alert_severity not null default 'information',
  source_record_type text,
  source_record_id uuid,
  quick_action_label text,
  quick_action_href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.business_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  alert_code text not null,
  title text not null,
  description text not null,
  severity public.alert_severity not null,
  status public.alert_status not null default 'open',
  module text not null,
  detected_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  source_record_type text,
  source_record_id uuid,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.recommendation_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  rule_code text not null,
  title text not null,
  category text not null,
  trigger_key text not null,
  severity public.alert_severity not null default 'information',
  recommendation_template text not null,
  required_permission text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, rule_code)
);

create table public.business_recommendations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  recommendation_rule_id uuid references public.recommendation_rules(id) on delete set null,
  title text not null,
  explanation text not null,
  recommended_action text not null,
  status public.recommendation_status not null default 'open',
  priority public.alert_severity not null default 'information',
  source_module text not null,
  source_record_type text,
  source_record_id uuid,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  acted_by uuid references public.profiles(id),
  acted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  audience public.dashboard_audience not null,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, audience, name)
);

create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  dashboard_layout_id uuid references public.dashboard_layouts(id) on delete cascade,
  widget_key text not null,
  title text not null,
  widget_kind public.widget_kind not null,
  module text not null,
  required_permission text,
  x integer not null default 0,
  y integer not null default 0,
  width integer not null default 4 check (width between 1 and 12),
  height integer not null default 2 check (height between 1 and 12),
  hidden boolean not null default false,
  favourite boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dashboard_layout_id, widget_key)
);

create table public.dashboard_widget_cache (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  widget_key text not null,
  cache_key text not null,
  payload jsonb not null,
  source_hash text,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (business_id, branch_id, cache_key)
);

create table public.trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  metric_code text not null,
  period public.trend_period not null,
  comparison public.trend_comparison not null,
  period_start date not null,
  period_end date not null,
  current_value numeric(18, 4),
  comparison_value numeric(18, 4),
  absolute_change numeric(18, 4),
  percentage_change numeric(18, 4),
  explanation text,
  generated_at timestamptz not null default now(),
  unique (business_id, branch_id, metric_code, period, comparison, period_start, period_end)
);

create table public.forecast_indicators (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  indicator_code text not null,
  name text not null,
  forecast_date date not null,
  projected_value numeric(18, 4),
  confidence_label text not null default 'foundation',
  method text not null,
  source_metric_code text,
  explanation text not null,
  generated_at timestamptz not null default now(),
  unique (business_id, branch_id, indicator_code, forecast_date)
);

create table public.data_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  snapshot_date date not null,
  metric_code text not null,
  issue_count integer not null default 0 check (issue_count >= 0),
  severity public.alert_severity not null default 'information',
  explanation text not null,
  source_query_key text not null,
  generated_at timestamptz not null default now(),
  unique (business_id, snapshot_date, metric_code)
);

create table public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  snapshot_time timestamptz not null default now(),
  component text not null,
  status text not null check (status in ('healthy','watch','critical','unknown')),
  metric_value numeric(18, 4),
  explanation text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table public.report_catalog (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  report_code text not null,
  name text not null,
  category text not null,
  description text not null,
  required_permission text,
  output_modes text[] not null default array['screen','csv','pdf'],
  active boolean not null default true,
  display_order integer not null default 100,
  unique (business_id, report_code)
);

create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  report_catalog_id uuid not null references public.report_catalog(id) on delete cascade,
  user_id uuid references public.profiles(id),
  name text not null,
  frequency public.intelligence_frequency not null,
  delivery_mode text not null default 'download_ready' check (delivery_mode in ('download_ready','email_ready','both')),
  recipients jsonb not null default '[]'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.pinned_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_catalog_id uuid not null references public.report_catalog(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  unique (business_id, user_id, report_catalog_id)
);

alter table public.notifications
  add column if not exists priority public.notification_priority not null default 'normal',
  add column if not exists pinned boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists muted_until timestamptz,
  add column if not exists source_module text,
  add column if not exists source_record_type text,
  add column if not exists source_record_id uuid;

create or replace view public.command_centre_overview
with (security_invoker = true)
as
select
  b.id as business_id,
  b.trading_name,
  count(distinct ba.id) filter (where ba.status = 'open' and ba.severity in ('critical','escalation')) as critical_alerts,
  count(distinct br.id) filter (where br.brief_date = current_date) as briefs_today,
  count(distinct rec.id) filter (where rec.status = 'open') as open_recommendations,
  count(distinct te.id) filter (where te.event_time >= now() - interval '24 hours') as timeline_events_24h,
  max(bhs.overall_score) filter (where bhs.score_date = current_date) as health_score_today
from public.businesses b
left join public.business_alerts ba on ba.business_id = b.id
left join public.morning_briefs br on br.business_id = b.id
left join public.business_recommendations rec on rec.business_id = b.id
left join public.business_timeline_events te on te.business_id = b.id
left join public.business_health_scores bhs on bhs.business_id = b.id
group by b.id, b.trading_name;

create or replace view public.reporting_hub_catalog
with (security_invoker = true)
as
select
  rc.business_id,
  rc.report_code,
  rc.name,
  rc.category,
  rc.description,
  rc.required_permission,
  rc.output_modes,
  rc.active,
  rc.display_order,
  count(rs.id) as schedule_count
from public.report_catalog rc
left join public.report_schedules rs on rs.report_catalog_id = rc.id and rs.active = true
group by rc.business_id, rc.report_code, rc.name, rc.category, rc.description, rc.required_permission, rc.output_modes, rc.active, rc.display_order;

create index kpi_snapshots_business_idx on public.kpi_snapshots(business_id, branch_id, period_end, frequency);
create index health_scores_business_idx on public.business_health_scores(business_id, branch_id, score_date);
create index timeline_business_time_idx on public.business_timeline_events(business_id, branch_id, event_time desc);
create index alerts_business_status_idx on public.business_alerts(business_id, branch_id, status, severity, detected_at desc);
create index recommendations_business_status_idx on public.business_recommendations(business_id, branch_id, status, priority, generated_at desc);
create index widget_cache_expiry_idx on public.dashboard_widget_cache(business_id, branch_id, expires_at);
create index trend_snapshots_lookup_idx on public.trend_snapshots(business_id, branch_id, metric_code, period, comparison, period_end);
create index report_catalog_business_idx on public.report_catalog(business_id, category, active, display_order);

alter table public.kpi_definitions enable row level security;
alter table public.kpi_snapshots enable row level security;
alter table public.business_health_weights enable row level security;
alter table public.business_health_scores enable row level security;
alter table public.business_health_components enable row level security;
alter table public.morning_briefs enable row level security;
alter table public.business_timeline_events enable row level security;
alter table public.business_alerts enable row level security;
alter table public.recommendation_rules enable row level security;
alter table public.business_recommendations enable row level security;
alter table public.dashboard_layouts enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.dashboard_widget_cache enable row level security;
alter table public.trend_snapshots enable row level security;
alter table public.forecast_indicators enable row level security;
alter table public.data_quality_snapshots enable row level security;
alter table public.system_health_snapshots enable row level security;
alter table public.report_catalog enable row level security;
alter table public.report_schedules enable row level security;
alter table public.pinned_reports enable row level security;

create policy kpi_definitions_read on public.kpi_definitions for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy kpi_definitions_owner_write on public.kpi_definitions for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy recommendation_rules_read on public.recommendation_rules for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy recommendation_rules_owner_write on public.recommendation_rules for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy report_catalog_read on public.report_catalog for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy report_catalog_owner_write on public.report_catalog for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');

create policy kpi_snapshots_member_read on public.kpi_snapshots for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy health_weights_owner_write on public.business_health_weights for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy health_weights_member_read on public.business_health_weights for select to authenticated using (public.current_user_has_business_access(business_id));
create policy health_scores_member_read on public.business_health_scores for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy health_components_member_read on public.business_health_components for select to authenticated using (public.current_user_has_business_access(business_id));
create policy briefs_member_read on public.morning_briefs for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy timeline_member_read on public.business_timeline_events for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy alerts_member_read on public.business_alerts for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy alerts_manager_write on public.business_alerts for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy recommendations_member_read on public.business_recommendations for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy recommendations_manager_update on public.business_recommendations for update to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy layouts_member_read on public.dashboard_layouts for select to authenticated using (public.current_user_has_business_access(business_id) and (user_id is null or user_id = (select auth.uid())));
create policy layouts_member_write on public.dashboard_layouts for all to authenticated using (public.current_user_has_business_access(business_id) and (user_id is null or user_id = (select auth.uid()))) with check (public.current_user_has_business_access(business_id) and (user_id is null or user_id = (select auth.uid())));
create policy widgets_member_read on public.dashboard_widgets for select to authenticated using (public.current_user_has_business_access(business_id));
create policy widgets_member_write on public.dashboard_widgets for all to authenticated using (public.current_user_has_business_access(business_id)) with check (public.current_user_has_business_access(business_id));
create policy widget_cache_member_read on public.dashboard_widget_cache for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy trends_member_read on public.trend_snapshots for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy forecasts_member_read on public.forecast_indicators for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy data_quality_member_read on public.data_quality_snapshots for select to authenticated using (public.current_user_has_business_access(business_id));
create policy system_health_owner_read on public.system_health_snapshots for select to authenticated using (business_id is null or public.current_user_business_role(business_id) = 'owner');
create policy schedules_member_read on public.report_schedules for select to authenticated using (public.current_user_has_business_access(business_id));
create policy schedules_member_write on public.report_schedules for all to authenticated using (public.current_user_has_business_access(business_id) and (user_id is null or user_id = (select auth.uid()) or public.current_user_business_role(business_id) in ('owner','manager'))) with check (public.current_user_has_business_access(business_id));
create policy pinned_reports_member on public.pinned_reports for all to authenticated using (public.current_user_has_business_access(business_id) and user_id = (select auth.uid())) with check (public.current_user_has_business_access(business_id) and user_id = (select auth.uid()));

grant select, insert, update, delete on
  public.kpi_definitions,
  public.kpi_snapshots,
  public.business_health_weights,
  public.business_health_scores,
  public.business_health_components,
  public.morning_briefs,
  public.business_timeline_events,
  public.business_alerts,
  public.recommendation_rules,
  public.business_recommendations,
  public.dashboard_layouts,
  public.dashboard_widgets,
  public.dashboard_widget_cache,
  public.trend_snapshots,
  public.forecast_indicators,
  public.data_quality_snapshots,
  public.system_health_snapshots,
  public.report_catalog,
  public.report_schedules,
  public.pinned_reports
to authenticated;

grant select on public.command_centre_overview, public.reporting_hub_catalog to authenticated;

insert into public.kpi_definitions (business_id, kpi_code, name, description, category, owner_role, calculation_key, frequency, trend_direction, icon, display_order, required_permission)
values
  (null, 'revenue_today', 'Revenue Today', 'Posted sales revenue for the current business day.', 'Sales', 'owner', 'posted_sales_revenue', 'daily', 'higher_is_better', 'line-chart', 10, 'sales.view'),
  (null, 'gross_profit', 'Gross Profit', 'Revenue less cost of sales from posted journals.', 'Profitability', 'owner', 'posted_gross_profit', 'daily', 'higher_is_better', 'chart-bar', 20, 'financial_reporting.view_statements'),
  (null, 'cash_available', 'Cash Available', 'Available cash, bank and mobile-money balances.', 'Cash', 'finance_manager', 'treasury_available_cash', 'daily', 'higher_is_better', 'banknote', 30, 'finance.view_cashbook'),
  (null, 'receivables_overdue', 'Overdue Receivables', 'Customer balances past their due dates.', 'Debtors', 'sales_manager', 'customer_overdue_balance', 'daily', 'lower_is_better', 'clock', 40, 'sales.view_customer_balances'),
  (null, 'inventory_at_risk', 'Inventory at Risk', 'Low, expired, negative or slow-moving stock.', 'Inventory', 'warehouse_manager', 'inventory_risk_count', 'daily', 'lower_is_better', 'boxes', 50, 'inventory.view_stock'),
  (null, 'tax_readiness', 'Tax Readiness', 'VAT/eTIMS/withholding readiness and due obligations.', 'Tax Compliance', 'accountant', 'tax_readiness_score', 'daily', 'higher_is_better', 'receipt-text', 60, 'tax.view_tax_reports'),
  (null, 'accounting_status', 'Accounting Status', 'Failed postings, unreconciled controls and period close state.', 'Accounting', 'accountant', 'accounting_control_status', 'daily', 'higher_is_better', 'book-open', 70, 'accounting.view_general_ledger'),
  (null, 'delivery_health', 'Delivery Health', 'Route closure, driver cash and vehicle availability health.', 'Delivery Performance', 'operations_manager', 'distribution_health_score', 'daily', 'higher_is_better', 'truck', 80, 'distribution.view_deliveries')
on conflict (business_id, kpi_code) do nothing;

insert into public.recommendation_rules (business_id, rule_code, title, category, trigger_key, severity, recommendation_template, required_permission)
values
  (null, 'follow_up_overdue_customer', 'Follow up overdue customer', 'Collections', 'customer_overdue_balance', 'warning', 'Contact customers whose balances are past due and record the next promised payment date.', 'sales.view_customer_balances'),
  (null, 'replenish_low_stock', 'Replenish low stock', 'Inventory', 'inventory_low_stock', 'warning', 'Review reorder quantity and supplier lead time before creating a purchase order.', 'inventory.view_stock'),
  (null, 'complete_reconciliation', 'Complete reconciliation', 'Treasury', 'unreconciled_cash_bank', 'warning', 'Finish cash, bank or M-Pesa reconciliation before relying on cash position.', 'finance.reconcile_bank_accounts'),
  (null, 'complete_vat_filing', 'Complete VAT filing', 'Tax Compliance', 'tax_due_soon', 'critical', 'Prepare the VAT return and record filing or payment references before the due date.', 'tax.prepare_vat_returns'),
  (null, 'investigate_margin', 'Investigate margin', 'Profitability', 'gross_margin_drop', 'warning', 'Compare selling prices, discounts and supplier costs for products with margin decline.', 'financial_reporting.view_profitability_reports'),
  (null, 'review_driver_shortage', 'Review driver shortage', 'Operations', 'driver_cash_shortage', 'critical', 'Review route collections, cash handover and approved route expenses before closing the run.', 'distribution.reconcile_route_collections')
on conflict (business_id, rule_code) do nothing;

insert into public.report_catalog (business_id, report_code, name, category, description, required_permission, output_modes, display_order)
values
  (null, 'executive_dashboard', 'Executive Dashboard', 'Executive', 'Owner-level command centre with daily priorities, health, cash, sales, inventory, tax and accounting status.', 'dashboard.view_command_centre', array['screen','pdf'], 10),
  (null, 'business_health', 'Business Health', 'Executive', 'Overall and component health scores with explanations, trends and recommendations.', 'dashboard.view_business_health', array['screen','csv','pdf'], 20),
  (null, 'morning_brief_archive', 'Morning Brief Archive', 'Executive', 'Historical morning briefs with source-backed statements.', 'dashboard.view_business_insights', array['screen','pdf'], 30),
  (null, 'kpi_report', 'KPI Report', 'Executive', 'KPI definitions, snapshots, targets, thresholds, trends and owners.', 'dashboard.view_business_insights', array['screen','csv'], 40),
  (null, 'alert_report', 'Alert Report', 'Operations', 'Open, acknowledged, resolved and expired alerts by module, branch and severity.', 'dashboard.view_business_insights', array['screen','csv'], 50),
  (null, 'timeline_report', 'Timeline Report', 'Operations', 'Chronological business activity across modules and branches.', 'dashboard.view_business_insights', array['screen','csv'], 60),
  (null, 'recommendation_report', 'Recommendation Report', 'Operations', 'Open and completed recommendations with source modules and action history.', 'dashboard.view_business_insights', array['screen','csv'], 70),
  (null, 'trend_report', 'Trend Report', 'Executive', 'Period comparisons versus previous, budget, forecast, target, branch or last year.', 'dashboard.view_business_insights', array['screen','csv'], 80),
  (null, 'branch_dashboard', 'Branch Dashboard', 'Operations', 'Branch-scoped operational dashboard with restricted branch visibility.', 'dashboard.view_role_dashboards', array['screen','pdf'], 90),
  (null, 'executive_pack', 'Executive Pack', 'Executive', 'Download-ready executive pack combining financial, operational and compliance highlights.', 'dashboard.export_executive_pack', array['pdf'], 100),
  (null, 'operational_dashboard', 'Operational Dashboard', 'Operations', 'Operations dashboard for warehouse, routes, drivers, tasks and exceptions.', 'dashboard.view_role_dashboards', array['screen'], 110),
  (null, 'data_quality', 'Data Quality Report', 'Administration', 'Missing PINs, unmapped products, failed journals, unmatched payments and setup gaps.', 'dashboard.view_data_quality', array['screen','csv'], 120),
  (null, 'system_health', 'System Health Report', 'Administration', 'Database, queue, integration, storage, backup and runtime health foundations.', 'dashboard.view_system_health', array['screen','csv'], 130)
on conflict (business_id, report_code) do nothing;
