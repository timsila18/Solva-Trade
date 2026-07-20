create type public.financial_statement_type as enum (
  'profit_and_loss',
  'balance_sheet',
  'cash_flow_statement',
  'changes_in_equity',
  'management_income_statement',
  'branch_performance',
  'product_profitability',
  'route_profitability',
  'vehicle_profitability'
);

create type public.statement_section_type as enum (
  'header',
  'account_group',
  'account_range',
  'account_role',
  'subtotal',
  'calculated_total',
  'percentage_row',
  'spacer',
  'note'
);

create type public.budget_status as enum ('draft','submitted','approved','active','revised','archived','rejected');
create type public.forecast_status as enum ('draft','submitted','approved','active','superseded','archived');
create type public.close_cycle_status as enum ('not_started','in_progress','ready_for_soft_close','soft_closed','ready_for_hard_close','hard_closed','reopening_requested','reopened','reclosed','blocked','cancelled');
create type public.statement_snapshot_status as enum ('draft','management','approved','closed_period','superseded');

create table public.financial_statement_layouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  layout_name text not null,
  statement_type public.financial_statement_type not null,
  is_default boolean not null default false,
  reporting_currency text not null default 'KES',
  display_format text not null default 'standard' check (display_format in ('standard','compact','detailed','management_pack')),
  comparative_periods integer not null default 1 check (comparative_periods >= 0),
  show_zero_balances boolean not null default false,
  negative_number_format text not null default 'parentheses' check (negative_number_format in ('minus','parentheses')),
  rounding_preference text not null default 'none' check (rounding_preference in ('none','nearest_shilling','nearest_thousand','nearest_million')),
  show_account_codes boolean not null default true,
  show_percentages boolean not null default true,
  show_subtotals boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, layout_name, statement_type)
);

create unique index financial_layouts_one_default
  on public.financial_statement_layouts(business_id, statement_type)
  where is_default = true;

create table public.financial_statement_sections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  layout_id uuid not null references public.financial_statement_layouts(id) on delete cascade,
  section_name text not null,
  section_code text not null,
  sequence integer not null,
  parent_section_id uuid references public.financial_statement_sections(id) on delete restrict,
  section_type public.statement_section_type not null,
  account_filter jsonb not null default '{}'::jsonb,
  account_class public.account_class,
  account_type text,
  account_role_filter text[] not null default '{}',
  sign_convention text not null default 'natural' check (sign_convention in ('natural','debit_positive','credit_positive','invert')),
  subtotal_behavior text not null default 'sum_children' check (subtotal_behavior in ('none','sum_children','formula','running_total')),
  formula text,
  indentation_level integer not null default 0 check (indentation_level >= 0),
  bold boolean not null default false,
  hidden boolean not null default false,
  drill_down_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (layout_id, section_code),
  unique (layout_id, sequence)
);

create table public.financial_report_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  layout_id uuid references public.financial_statement_layouts(id) on delete set null,
  statement_type public.financial_statement_type not null,
  financial_year_id uuid references public.financial_years(id) on delete set null,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  date_from date not null,
  date_to date not null,
  comparative_date_from date,
  comparative_date_to date,
  currency text not null default 'KES',
  status text not null default 'draft' check (status in ('draft','generated','reviewed','approved','failed')),
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  report_payload jsonb not null default '{}'::jsonb,
  totals_payload jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '[]'::jsonb,
  check (date_to >= date_from)
);

create table public.management_account_packs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  pack_name text not null,
  pack_type text not null check (pack_type in ('monthly','quarterly','annual','custom')),
  financial_year_id uuid references public.financial_years(id) on delete restrict,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  date_from date not null,
  date_to date not null,
  status text not null default 'draft' check (status in ('draft','generated','under_review','approved','issued','superseded')),
  generated_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  report_file_path text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  check (date_to >= date_from)
);

create table public.management_account_commentary (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  management_pack_id uuid references public.management_account_packs(id) on delete cascade,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  section text not null,
  commentary text not null,
  author_id uuid references public.profiles(id),
  review_status text not null default 'draft' check (review_status in ('draft','submitted','reviewed','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_ratio_definitions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  ratio_code text not null,
  ratio_name text not null,
  category text not null check (category in ('profitability','liquidity','efficiency','leverage','growth')),
  formula text not null,
  numerator_key text not null,
  denominator_key text,
  target_min numeric(18, 4),
  target_max numeric(18, 4),
  warning_threshold numeric(18, 4),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, ratio_code)
);

create table public.financial_ratio_results (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  ratio_definition_id uuid not null references public.financial_ratio_definitions(id) on delete cascade,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  date_from date not null,
  date_to date not null,
  numerator_value numeric(18, 4),
  denominator_value numeric(18, 4),
  ratio_value numeric(18, 6),
  status text not null default 'calculated' check (status in ('calculated','not_enough_data','warning','critical')),
  calculation_inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table public.budget_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.financial_years(id) on delete cascade,
  version_name text not null,
  scenario text not null default 'base' check (scenario in ('base','optimistic','conservative','custom')),
  status public.budget_status not null default 'draft',
  is_active boolean not null default false,
  currency text not null default 'KES',
  submitted_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  activated_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  notes text,
  unique (business_id, financial_year_id, version_name)
);

create unique index budget_versions_one_active
  on public.budget_versions(business_id, financial_year_id)
  where is_active = true;

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  budget_version_id uuid not null references public.budget_versions(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  accounting_period_id uuid references public.accounting_periods(id) on delete restrict,
  activity_id uuid,
  product_id uuid references public.products(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  quantity numeric(18, 4),
  unit_price numeric(18, 4),
  amount numeric(18, 4) not null,
  assumption text,
  notes text,
  created_at timestamptz not null default now(),
  unique (budget_version_id, account_id, branch_id, accounting_period_id, activity_id, product_id, route_id, vehicle_id)
);

create table public.budget_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  budget_version_id uuid references public.budget_versions(id) on delete set null,
  file_name text not null,
  file_path text,
  column_mapping jsonb not null default '{}'::jsonb,
  status text not null default 'uploaded' check (status in ('uploaded','mapped','validated','committed','failed','cancelled')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table public.financial_forecasts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid references public.financial_years(id) on delete set null,
  forecast_name text not null,
  forecast_type text not null check (forecast_type in ('short_term_cash','profit_forecast','rolling_forecast','scenario_forecast')),
  scenario text not null default 'base',
  date_from date not null,
  date_to date not null,
  status public.forecast_status not null default 'draft',
  is_active boolean not null default false,
  currency text not null default 'KES',
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  superseded_by uuid references public.financial_forecasts(id) on delete set null,
  check (date_to >= date_from)
);

create table public.financial_forecast_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  forecast_id uuid not null references public.financial_forecasts(id) on delete cascade,
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  forecast_metric text not null,
  amount numeric(18, 4) not null default 0,
  quantity numeric(18, 4),
  basis text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.period_close_cycles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  accounting_period_id uuid not null references public.accounting_periods(id) on delete cascade,
  status public.close_cycle_status not null default 'not_started',
  started_by uuid references public.profiles(id),
  soft_closed_by uuid references public.profiles(id),
  hard_closed_by uuid references public.profiles(id),
  reopening_requested_by uuid references public.profiles(id),
  reopening_approved_by uuid references public.profiles(id),
  started_at timestamptz,
  soft_closed_at timestamptz,
  hard_closed_at timestamptz,
  reopened_at timestamptz,
  reclosed_at timestamptz,
  override_reason text,
  notes text,
  created_at timestamptz not null default now(),
  unique (business_id, accounting_period_id)
);

create table public.period_close_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  close_cycle_id uuid not null references public.period_close_cycles(id) on delete cascade,
  task_code text not null,
  task_name text not null,
  module text not null,
  sequence integer not null default 100,
  required boolean not null default true,
  blocking boolean not null default true,
  status text not null default 'pending' check (status in ('pending','assigned','completed','waived','blocked','failed')),
  assigned_to uuid references public.profiles(id),
  completed_by uuid references public.profiles(id),
  waived_by uuid references public.profiles(id),
  due_at timestamptz,
  completed_at timestamptz,
  waived_at timestamptz,
  waiver_reason text,
  notes text,
  created_at timestamptz not null default now(),
  unique (close_cycle_id, task_code)
);

create table public.year_end_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.financial_years(id) on delete restrict,
  closing_policy text not null default 'retained_earnings' check (closing_policy in ('retained_earnings','current_year_earnings')),
  profit_or_loss_amount numeric(18, 4) not null default 0,
  closing_journal_id uuid references public.journal_entries(id) on delete set null,
  retained_earnings_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','approved','posted','cancelled')),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  posted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (business_id, financial_year_id)
);

create table public.adjustment_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  schedule_type text not null check (schedule_type in ('accrual','prepayment','depreciation','bad_debt_provision','inventory_provision','cost_allocation')),
  schedule_name text not null,
  calculation_basis jsonb not null default '{}'::jsonb,
  source_amount numeric(18, 4) not null default 0,
  adjustment_amount numeric(18, 4) not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted','approved','posted','reversed','cancelled')),
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.cost_allocation_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_name text not null,
  source_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  allocation_target text not null check (allocation_target in ('branches','departments','routes','vehicles','products','cost_centres')),
  allocation_method text not null check (allocation_method in ('equal','revenue_percentage','gross_profit_percentage','headcount_placeholder','floor_area_placeholder','usage_basis','manual_percentage','custom_driver')),
  reporting_only boolean not null default true,
  active boolean not null default true,
  basis_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, rule_name)
);

create table public.financial_statement_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  statement_type public.financial_statement_type not null,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  financial_year_id uuid references public.financial_years(id) on delete set null,
  layout_id uuid references public.financial_statement_layouts(id) on delete set null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id),
  approval_status public.statement_snapshot_status not null default 'draft',
  data_hash text not null,
  report_file_path text,
  statement_payload jsonb not null,
  superseded boolean not null default false,
  superseded_by uuid references public.financial_statement_snapshots(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.financial_reporting_audit_trail (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

insert into public.financial_ratio_definitions (ratio_code, ratio_name, category, formula, numerator_key, denominator_key)
values
  ('GROSS_MARGIN','Gross Margin','profitability','gross_profit / revenue','gross_profit','revenue'),
  ('OPERATING_MARGIN','Operating Margin','profitability','operating_profit / revenue','operating_profit','revenue'),
  ('NET_PROFIT_MARGIN','Net Profit Margin','profitability','net_profit / revenue','net_profit','revenue'),
  ('RETURN_ON_ASSETS','Return on Assets','profitability','net_profit / total_assets','net_profit','total_assets'),
  ('RETURN_ON_EQUITY','Return on Equity','profitability','net_profit / equity','net_profit','equity'),
  ('EXPENSE_TO_REVENUE','Expense-to-Revenue Ratio','profitability','expenses / revenue','expenses','revenue'),
  ('CURRENT_RATIO','Current Ratio','liquidity','current_assets / current_liabilities','current_assets','current_liabilities'),
  ('QUICK_RATIO','Quick Ratio','liquidity','(current_assets - inventory) / current_liabilities','quick_assets','current_liabilities'),
  ('CASH_RATIO','Cash Ratio','liquidity','cash / current_liabilities','cash','current_liabilities'),
  ('WORKING_CAPITAL','Working Capital','liquidity','current_assets - current_liabilities','working_capital',null),
  ('INVENTORY_TURNOVER','Inventory Turnover','efficiency','cost_of_sales / average_inventory','cost_of_sales','average_inventory'),
  ('DEBTOR_DAYS','Debtor Days','efficiency','receivables / revenue * days','receivables','revenue'),
  ('CREDITOR_DAYS','Creditor Days','efficiency','payables / cost_of_sales * days','payables','cost_of_sales'),
  ('CASH_CONVERSION_CYCLE','Cash Conversion Cycle','efficiency','inventory_days + debtor_days - creditor_days','cash_conversion_cycle',null),
  ('DEBT_TO_EQUITY','Debt-to-Equity Ratio','leverage','total_liabilities / equity','total_liabilities','equity'),
  ('DEBT_RATIO','Debt Ratio','leverage','total_liabilities / total_assets','total_liabilities','total_assets'),
  ('REVENUE_GROWTH','Revenue Growth','growth','(current_revenue - prior_revenue) / prior_revenue','revenue_change','prior_revenue')
on conflict (business_id, ratio_code) do nothing;

create or replace view public.financial_statement_account_activity
with (security_invoker = true)
as
select
  jl.business_id,
  jl.branch_id,
  je.financial_year_id,
  je.accounting_period_id,
  je.posting_date,
  coa.id as account_id,
  coa.account_code,
  coa.account_name,
  coa.account_class,
  coa.account_type,
  coa.financial_statement_section,
  coa.cash_flow_category,
  coa.normal_balance,
  jl.customer_id,
  jl.supplier_id,
  jl.product_id,
  jl.route_id,
  jl.vehicle_id,
  sum(jl.debit_amount) as debit_amount,
  sum(jl.credit_amount) as credit_amount,
  sum(case when coa.normal_balance = 'debit' then jl.debit_amount - jl.credit_amount else jl.credit_amount - jl.debit_amount end) as natural_amount
from public.journal_lines jl
join public.journal_entries je on je.id = jl.journal_entry_id
join public.chart_of_accounts coa on coa.id = jl.account_id
where je.status in ('posted','reversed')
group by jl.business_id, jl.branch_id, je.financial_year_id, je.accounting_period_id, je.posting_date, coa.id, coa.account_code, coa.account_name, coa.account_class, coa.account_type, coa.financial_statement_section, coa.cash_flow_category, coa.normal_balance, jl.customer_id, jl.supplier_id, jl.product_id, jl.route_id, jl.vehicle_id;

create or replace view public.profit_and_loss_summary
with (security_invoker = true)
as
select
  business_id,
  branch_id,
  financial_year_id,
  accounting_period_id,
  sum(case when account_class in ('revenue','other_income') then natural_amount else 0 end) as revenue,
  sum(case when account_class = 'cost_of_sales' then natural_amount else 0 end) as cost_of_sales,
  sum(case when account_class = 'expenses' then natural_amount else 0 end) as operating_expenses,
  sum(case when account_class = 'other_expenses' then natural_amount else 0 end) as other_expenses,
  sum(case when account_class in ('revenue','other_income') then natural_amount else 0 end)
    - sum(case when account_class = 'cost_of_sales' then natural_amount else 0 end) as gross_profit,
  sum(case when account_class in ('revenue','other_income') then natural_amount else 0 end)
    - sum(case when account_class in ('cost_of_sales','expenses','other_expenses') then natural_amount else 0 end) as net_profit
from public.financial_statement_account_activity
where account_class in ('revenue','cost_of_sales','expenses','other_income','other_expenses')
group by business_id, branch_id, financial_year_id, accounting_period_id;

create or replace view public.balance_sheet_summary
with (security_invoker = true)
as
select
  business_id,
  branch_id,
  financial_year_id,
  accounting_period_id,
  sum(case when account_class = 'assets' then natural_amount else 0 end) as total_assets,
  sum(case when account_class = 'liabilities' then natural_amount else 0 end) as total_liabilities,
  sum(case when account_class = 'equity' then natural_amount else 0 end) as equity_before_current_earnings,
  sum(case when account_class in ('revenue','other_income') then natural_amount else 0 end)
    - sum(case when account_class in ('cost_of_sales','expenses','other_expenses') then natural_amount else 0 end) as current_year_earnings,
  sum(case when account_class = 'assets' then natural_amount else 0 end)
    - (
      sum(case when account_class = 'liabilities' then natural_amount else 0 end)
      + sum(case when account_class = 'equity' then natural_amount else 0 end)
      + sum(case when account_class in ('revenue','other_income') then natural_amount else 0 end)
      - sum(case when account_class in ('cost_of_sales','expenses','other_expenses') then natural_amount else 0 end)
    ) as imbalance
from public.financial_statement_account_activity
group by business_id, branch_id, financial_year_id, accounting_period_id;

create or replace view public.cash_flow_summary
with (security_invoker = true)
as
select
  fsa.business_id,
  fsa.branch_id,
  fsa.financial_year_id,
  fsa.accounting_period_id,
  sum(case when fsa.cash_flow_category = 'operating' then fsa.natural_amount else 0 end) as operating_cash_flow,
  sum(case when fsa.cash_flow_category = 'investing' then fsa.natural_amount else 0 end) as investing_cash_flow,
  sum(case when fsa.cash_flow_category = 'financing' then fsa.natural_amount else 0 end) as financing_cash_flow,
  sum(case when account_role_filter.role_code is not null then natural_amount else 0 end) as cash_and_cash_equivalents
from public.financial_statement_account_activity fsa
left join public.account_role_mappings arm on arm.business_id = fsa.business_id and arm.account_id = fsa.account_id and arm.active = true
left join lateral (
  select arm.role_code
  where arm.role_code in ('CASH_ON_HAND','BANK_ACCOUNT','MOBILE_MONEY_ACCOUNT','CASH_IN_TRANSIT')
) account_role_filter on true
group by fsa.business_id, fsa.branch_id, fsa.financial_year_id, fsa.accounting_period_id;

create or replace function public.prevent_statement_section_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid;
begin
  cursor_id := new.parent_section_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Statement section hierarchy cannot be circular.';
    end if;
    select parent_section_id into cursor_id
    from public.financial_statement_sections
    where id = cursor_id;
  end loop;
  if new.formula is not null and new.formula ~* '(;|--|/\*|\*/|drop|delete|insert|update|alter|create)' then
    raise exception 'Statement formulas cannot contain SQL commands.';
  end if;
  return new;
end;
$$;

create trigger statement_sections_prevent_cycle
before insert or update on public.financial_statement_sections
for each row execute function public.prevent_statement_section_cycle();

create or replace function public.prevent_approved_budget_mutation()
returns trigger
language plpgsql
as $$
declare
  budget_status public.budget_status;
begin
  select status into budget_status from public.budget_versions where id = coalesce(new.budget_version_id, old.budget_version_id);
  if budget_status in ('approved','active','archived') then
    raise exception 'Approved or active budgets cannot be mutated. Create a revision.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger budget_lines_approved_guard
before insert or update or delete on public.budget_lines
for each row execute function public.prevent_approved_budget_mutation();

create or replace function public.prevent_statement_snapshot_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Financial statement snapshots are immutable. Create a superseding snapshot.';
end;
$$;

create trigger snapshots_immutable
before update or delete on public.financial_statement_snapshots
for each row execute function public.prevent_statement_snapshot_update();

create or replace function public.start_period_close(target_period_id uuid)
returns uuid
language plpgsql
as $$
declare
  period_record public.accounting_periods%rowtype;
  cycle_id uuid;
begin
  select * into period_record from public.accounting_periods where id = target_period_id;
  if period_record.id is null then
    raise exception 'Accounting period not found.';
  end if;
  if public.current_user_business_role(period_record.business_id) not in ('owner','manager') then
    raise exception 'You do not have permission to start period close.';
  end if;
  if period_record.status = 'future' then
    raise exception 'Future periods cannot be closed.';
  end if;

  insert into public.period_close_cycles (business_id, accounting_period_id, status, started_by, started_at)
  values (period_record.business_id, period_record.id, 'in_progress', auth.uid(), now())
  on conflict (business_id, accounting_period_id) do update
    set status = case when public.period_close_cycles.status = 'hard_closed' then public.period_close_cycles.status else 'in_progress' end,
        started_by = coalesce(public.period_close_cycles.started_by, auth.uid()),
        started_at = coalesce(public.period_close_cycles.started_at, now())
  returning id into cycle_id;

  insert into public.period_close_tasks (business_id, close_cycle_id, task_code, task_name, module, sequence)
  values
    (period_record.business_id, cycle_id, 'POSTING_QUEUE_CLEAR', 'Resolve failed accounting events', 'accounting', 10),
    (period_record.business_id, cycle_id, 'BANK_RECONCILIATION', 'Complete bank and M-Pesa reconciliations', 'treasury', 20),
    (period_record.business_id, cycle_id, 'CUSTOMER_CONTROL', 'Reconcile customer control account', 'sales', 30),
    (period_record.business_id, cycle_id, 'SUPPLIER_CONTROL', 'Reconcile supplier control account', 'purchases', 40),
    (period_record.business_id, cycle_id, 'INVENTORY_CONTROL', 'Reconcile inventory to GL', 'inventory', 50),
    (period_record.business_id, cycle_id, 'TRIAL_BALANCE', 'Confirm trial balance is balanced', 'accounting', 60),
    (period_record.business_id, cycle_id, 'MANAGEMENT_REVIEW', 'Review management accounts', 'reporting', 70)
  on conflict (close_cycle_id, task_code) do nothing;

  return cycle_id;
end;
$$;

create or replace function public.soft_close_period(target_period_id uuid)
returns uuid
language plpgsql
as $$
declare
  cycle_id uuid;
  blocker_count integer;
  period_business_id uuid;
begin
  select business_id into period_business_id from public.accounting_periods where id = target_period_id;
  if public.current_user_business_role(period_business_id) not in ('owner','manager') then
    raise exception 'You do not have permission to soft close this period.';
  end if;
  cycle_id := public.start_period_close(target_period_id);
  select count(*) into blocker_count from public.period_close_tasks where close_cycle_id = cycle_id and blocking = true and status not in ('completed','waived');
  if blocker_count > 0 then
    update public.period_close_cycles set status = 'blocked' where id = cycle_id;
    raise exception 'Blocking close tasks are incomplete.';
  end if;
  update public.accounting_periods set status = 'soft_closed', general_ledger_locked = false, updated_at = now() where id = target_period_id;
  update public.period_close_cycles set status = 'soft_closed', soft_closed_by = auth.uid(), soft_closed_at = now() where id = cycle_id;
  return cycle_id;
end;
$$;

create or replace function public.hard_close_period(target_period_id uuid, p_override_reason text default null)
returns uuid
language plpgsql
as $$
declare
  cycle_id uuid;
  blocker_count integer;
  period_business_id uuid;
begin
  select business_id into period_business_id from public.accounting_periods where id = target_period_id;
  if public.current_user_business_role(period_business_id) <> 'owner' then
    raise exception 'Only an Owner can hard close a period.';
  end if;
  cycle_id := public.start_period_close(target_period_id);
  select count(*) into blocker_count from public.period_close_tasks where close_cycle_id = cycle_id and blocking = true and status not in ('completed','waived');
  if blocker_count > 0 and coalesce(p_override_reason, '') = '' then
    update public.period_close_cycles set status = 'blocked' where id = cycle_id;
    raise exception 'Blocking close tasks are incomplete.';
  end if;
  update public.accounting_periods
  set status = 'closed',
      sales_locked = true,
      purchasing_locked = true,
      inventory_locked = true,
      cash_locked = true,
      general_ledger_locked = true,
      closed_by = auth.uid(),
      closed_at = now(),
      updated_at = now()
  where id = target_period_id;
  update public.period_close_cycles set status = 'hard_closed', hard_closed_by = auth.uid(), hard_closed_at = now(), override_reason = p_override_reason where id = cycle_id;
  return cycle_id;
end;
$$;

create or replace function public.reopen_accounting_period(target_period_id uuid, reason text)
returns uuid
language plpgsql
as $$
declare
  cycle_id uuid;
  period_business_id uuid;
begin
  select business_id into period_business_id from public.accounting_periods where id = target_period_id;
  if public.current_user_business_role(period_business_id) <> 'owner' then
    raise exception 'Only an Owner can reopen a period.';
  end if;
  if coalesce(reason, '') = '' then
    raise exception 'A reopening reason is required.';
  end if;
  update public.accounting_periods
  set status = 'reopened',
      general_ledger_locked = false,
      reopened_by = auth.uid(),
      reopened_at = now(),
      updated_at = now()
  where id = target_period_id
  returning id into cycle_id;

  update public.period_close_cycles
  set status = 'reopened', reopening_approved_by = auth.uid(), reopened_at = now(), override_reason = reason
  where accounting_period_id = target_period_id
  returning id into cycle_id;
  return cycle_id;
end;
$$;

create index fs_layouts_business_type_idx on public.financial_statement_layouts(business_id, statement_type, is_default);
create index fs_sections_layout_idx on public.financial_statement_sections(layout_id, sequence);
create index report_runs_business_period_idx on public.financial_report_runs(business_id, statement_type, accounting_period_id, generated_at desc);
create index management_packs_business_period_idx on public.management_account_packs(business_id, accounting_period_id, status);
create index ratio_results_business_period_idx on public.financial_ratio_results(business_id, accounting_period_id, ratio_definition_id);
create index budget_lines_period_idx on public.budget_lines(business_id, accounting_period_id, account_id, branch_id);
create index forecast_lines_period_idx on public.financial_forecast_lines(business_id, accounting_period_id, account_id, branch_id);
create index close_tasks_cycle_idx on public.period_close_tasks(close_cycle_id, status, blocking);
create index snapshots_business_period_idx on public.financial_statement_snapshots(business_id, statement_type, accounting_period_id, approval_status);
create index reporting_audit_business_idx on public.financial_reporting_audit_trail(business_id, created_at desc);

alter table public.financial_statement_layouts enable row level security;
alter table public.financial_statement_sections enable row level security;
alter table public.financial_report_runs enable row level security;
alter table public.management_account_packs enable row level security;
alter table public.management_account_commentary enable row level security;
alter table public.financial_ratio_definitions enable row level security;
alter table public.financial_ratio_results enable row level security;
alter table public.budget_versions enable row level security;
alter table public.budget_lines enable row level security;
alter table public.budget_import_batches enable row level security;
alter table public.financial_forecasts enable row level security;
alter table public.financial_forecast_lines enable row level security;
alter table public.period_close_cycles enable row level security;
alter table public.period_close_tasks enable row level security;
alter table public.year_end_closings enable row level security;
alter table public.adjustment_schedules enable row level security;
alter table public.cost_allocation_rules enable row level security;
alter table public.financial_statement_snapshots enable row level security;
alter table public.financial_reporting_audit_trail enable row level security;

create policy fs_layouts_member_read on public.financial_statement_layouts for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy fs_layouts_owner_write on public.financial_statement_layouts for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy fs_sections_member_read on public.financial_statement_sections for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy fs_sections_owner_write on public.financial_statement_sections for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy report_runs_member_read on public.financial_report_runs for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy report_runs_manager_write on public.financial_report_runs for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy management_packs_member_read on public.management_account_packs for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy management_packs_manager_write on public.management_account_packs for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy commentary_member_read on public.management_account_commentary for select to authenticated using (public.current_user_has_business_access(business_id));
create policy commentary_manager_write on public.management_account_commentary for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy ratio_defs_member_read on public.financial_ratio_definitions for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy ratio_defs_owner_write on public.financial_ratio_definitions for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy ratio_results_member_read on public.financial_ratio_results for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy budgets_member_read on public.budget_versions for select to authenticated using (public.current_user_has_business_access(business_id));
create policy budgets_manager_write on public.budget_versions for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy budget_lines_member_read on public.budget_lines for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy budget_lines_manager_write on public.budget_lines for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy budget_imports_member_read on public.budget_import_batches for select to authenticated using (public.current_user_has_business_access(business_id));
create policy budget_imports_manager_write on public.budget_import_batches for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy forecasts_member_read on public.financial_forecasts for select to authenticated using (public.current_user_has_business_access(business_id));
create policy forecasts_manager_write on public.financial_forecasts for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy forecast_lines_member_read on public.financial_forecast_lines for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy forecast_lines_manager_write on public.financial_forecast_lines for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy close_cycles_member_read on public.period_close_cycles for select to authenticated using (public.current_user_has_business_access(business_id));
create policy close_cycles_manager_write on public.period_close_cycles for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy close_tasks_member_read on public.period_close_tasks for select to authenticated using (public.current_user_has_business_access(business_id));
create policy close_tasks_manager_write on public.period_close_tasks for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy year_end_owner_read on public.year_end_closings for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy year_end_owner_write on public.year_end_closings for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy adjustments_member_read on public.adjustment_schedules for select to authenticated using (public.current_user_has_business_access(business_id));
create policy adjustments_manager_write on public.adjustment_schedules for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy allocation_rules_member_read on public.cost_allocation_rules for select to authenticated using (public.current_user_has_business_access(business_id));
create policy allocation_rules_owner_write on public.cost_allocation_rules for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy snapshots_member_read on public.financial_statement_snapshots for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy snapshots_manager_insert on public.financial_statement_snapshots for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy reporting_audit_owner_read on public.financial_reporting_audit_trail for select to authenticated using (public.current_user_business_role(business_id) = 'owner');

grant select, insert, update, delete on
  public.financial_statement_layouts,
  public.financial_statement_sections,
  public.financial_report_runs,
  public.management_account_packs,
  public.management_account_commentary,
  public.financial_ratio_definitions,
  public.financial_ratio_results,
  public.budget_versions,
  public.budget_lines,
  public.budget_import_batches,
  public.financial_forecasts,
  public.financial_forecast_lines,
  public.period_close_cycles,
  public.period_close_tasks,
  public.year_end_closings,
  public.adjustment_schedules,
  public.cost_allocation_rules,
  public.financial_statement_snapshots,
  public.financial_reporting_audit_trail
to authenticated;

grant select on public.financial_statement_account_activity, public.profit_and_loss_summary, public.balance_sheet_summary, public.cash_flow_summary to authenticated;

revoke execute on function public.prevent_statement_section_cycle() from public;
revoke execute on function public.prevent_approved_budget_mutation() from public;
revoke execute on function public.prevent_statement_snapshot_update() from public;
revoke execute on function public.start_period_close(uuid) from public;
revoke execute on function public.soft_close_period(uuid) from public;
revoke execute on function public.hard_close_period(uuid, text) from public;
revoke execute on function public.reopen_accounting_period(uuid, text) from public;

grant execute on function public.start_period_close(uuid) to authenticated;
grant execute on function public.soft_close_period(uuid) to authenticated;
grant execute on function public.hard_close_period(uuid, text) to authenticated;
grant execute on function public.reopen_accounting_period(uuid, text) to authenticated;
