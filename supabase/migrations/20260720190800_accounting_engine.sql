create type public.account_class as enum ('assets','liabilities','equity','revenue','cost_of_sales','expenses','other_income','other_expenses');
create type public.normal_balance as enum ('debit','credit');
create type public.accounting_event_status as enum ('pending','validating','ready','posted','partially_posted','failed','reversed','cancelled','needs_review');
create type public.accounting_period_status as enum ('future','open','soft_closed','closed','reopened');
create type public.financial_year_status as enum ('planned','open','closing','closed','reopened','archived');
create type public.journal_status as enum ('draft','pending_approval','approved','posted','rejected','reversed','cancelled','failed');
create type public.journal_approval_status as enum ('not_required','pending','approved','rejected');
create type public.journal_type as enum (
  'sales_journal','purchase_journal','cash_receipt_journal','cash_payment_journal','bank_journal',
  'inventory_journal','tax_journal','general_journal','opening_journal','closing_journal_placeholder',
  'adjustment_journal','reversal_journal','transfer_journal','owner_transaction_journal',
  'payroll_journal_placeholder','depreciation_journal_placeholder'
);

create table public.account_role_definitions (
  role_code text primary key,
  role_name text not null,
  description text,
  default_account_class public.account_class not null,
  normal_balance public.normal_balance not null,
  critical boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  description text,
  account_class public.account_class not null,
  account_type text not null,
  account_subtype text,
  parent_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  hierarchy_level integer not null default 0 check (hierarchy_level >= 0),
  normal_balance public.normal_balance not null,
  is_control_account boolean not null default false,
  is_posting_account boolean not null default true,
  is_header_account boolean not null default false,
  is_system_account boolean not null default false,
  reconciliation_required boolean not null default false,
  restricted_currency text,
  restricted_branch_id uuid references public.branches(id) on delete set null,
  tax_category text,
  cash_flow_category text,
  financial_statement_section text not null,
  active boolean not null default true,
  allow_manual_posting boolean not null default true,
  effective_start_date date not null default current_date,
  effective_end_date date,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (business_id, account_code),
  check (effective_end_date is null or effective_end_date >= effective_start_date),
  check (not (is_header_account and is_posting_account))
);

create table public.account_role_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  role_code text not null references public.account_role_definitions(role_code),
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete cascade,
  effective_start_date date not null default current_date,
  effective_end_date date,
  active boolean not null default true,
  is_system_mapping boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create unique index account_role_mappings_no_conflict
  on public.account_role_mappings(
    business_id,
    role_code,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where active = true;

create table public.account_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  mapping_type text not null check (mapping_type in ('transaction','product','product_category','customer','supplier','branch','tax_code','payment_account','expense_category','financial_account','owner_transaction','staff_advance','route_expense','business_default')),
  role_code text not null references public.account_role_definitions(role_code),
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  priority integer not null default 100 check (priority > 0),
  product_id uuid references public.products(id) on delete cascade,
  product_category_id uuid references public.product_categories(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  finance_account_id uuid references public.finance_accounts(id) on delete cascade,
  tax_code text,
  source_transaction_id uuid,
  expense_category text,
  active boolean not null default true,
  effective_start_date date not null default current_date,
  effective_end_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create unique index account_mappings_no_conflict
  on public.account_mappings(
    business_id, mapping_type, role_code, priority,
    coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(product_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(finance_account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(tax_code, ''),
    coalesce(source_transaction_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(expense_category, '')
  )
  where active = true;

create table public.accounting_setup_progress (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  current_step text not null default 'accounting_basics',
  use_recommended_chart boolean not null default true,
  accounting_active boolean not null default false,
  readiness_checks jsonb not null default '{}'::jsonb,
  missing_critical_roles text[] not null default '{}',
  completed_steps text[] not null default '{}',
  saved_payload jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  activated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_years (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status public.financial_year_status not null default 'planned',
  is_current boolean not null default false,
  created_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name),
  check (end_date >= start_date)
);

create unique index financial_years_one_current on public.financial_years(business_id) where is_current = true;
create index financial_years_date_idx on public.financial_years(business_id, start_date, end_date);

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_year_id uuid not null references public.financial_years(id) on delete cascade,
  period_name text not null,
  period_type text not null default 'monthly' check (period_type in ('monthly','four_week','quarterly','custom')),
  start_date date not null,
  end_date date not null,
  sequence integer not null check (sequence > 0),
  status public.accounting_period_status not null default 'future',
  sales_locked boolean not null default false,
  purchasing_locked boolean not null default false,
  inventory_locked boolean not null default false,
  cash_locked boolean not null default false,
  general_ledger_locked boolean not null default false,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, financial_year_id, sequence),
  check (end_date >= start_date)
);

create index accounting_periods_date_idx on public.accounting_periods(business_id, start_date, end_date, status);

create table public.accounting_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  activity_id uuid,
  source_module text not null,
  source_transaction_type text not null,
  source_transaction_id uuid not null,
  source_line_id uuid,
  event_type text not null,
  event_date date not null,
  posting_date date not null,
  currency text not null default 'KES',
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  cost_amount numeric(18, 4) not null default 0,
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.profiles(id) on delete set null,
  finance_account_id uuid references public.finance_accounts(id) on delete set null,
  reference text,
  idempotency_key text not null,
  status public.accounting_event_status not null default 'pending',
  error_code text,
  error_message text,
  retry_count integer not null default 0,
  event_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (business_id, idempotency_key)
);

create table public.posting_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  event_type text not null,
  conditions jsonb not null default '{}'::jsonb,
  tax_handling text not null default 'separate_vat' check (tax_handling in ('none','inclusive','exclusive','separate_vat','withholding')),
  branch_handling text not null default 'event_branch',
  activity_handling text not null default 'event_activity',
  description_template text not null,
  journal_type public.journal_type not null,
  effective_start_date date not null default current_date,
  effective_end_date date,
  priority integer not null default 100,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create table public.posting_rule_lines (
  id uuid primary key default gen_random_uuid(),
  posting_rule_id uuid not null references public.posting_rules(id) on delete cascade,
  line_sequence integer not null,
  side text not null check (side in ('debit','credit')),
  account_role_code text not null references public.account_role_definitions(role_code),
  amount_source text not null check (amount_source in ('amount','tax_amount','cost_amount','net_of_tax','payload')),
  payload_amount_key text,
  customer_reference boolean not null default false,
  supplier_reference boolean not null default false,
  product_reference boolean not null default false,
  tax_reference boolean not null default false,
  description_template text,
  active boolean not null default true,
  unique (posting_rule_id, line_sequence)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  journal_number text not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  financial_year_id uuid references public.financial_years(id) on delete restrict,
  accounting_period_id uuid references public.accounting_periods(id) on delete restrict,
  journal_type public.journal_type not null,
  journal_source text not null,
  journal_date date not null,
  posting_date date not null,
  currency text not null default 'KES',
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  reference text,
  description text not null,
  source_module text,
  source_transaction_type text,
  source_transaction_id uuid,
  accounting_event_id uuid references public.accounting_events(id) on delete set null,
  total_debit numeric(18, 4) not null default 0,
  total_credit numeric(18, 4) not null default 0,
  base_total_debit numeric(18, 4) not null default 0,
  base_total_credit numeric(18, 4) not null default 0,
  status public.journal_status not null default 'draft',
  approval_status public.journal_approval_status not null default 'not_required',
  posted_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  reversed boolean not null default false,
  reversal_journal_id uuid references public.journal_entries(id) on delete set null,
  reversal_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (business_id, journal_number),
  unique (business_id, accounting_event_id),
  check (total_debit >= 0 and total_credit >= 0)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  line_sequence integer not null,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  account_code_snapshot text not null,
  account_name_snapshot text not null,
  description text not null,
  debit_amount numeric(18, 4) not null default 0,
  credit_amount numeric(18, 4) not null default 0,
  currency text not null default 'KES',
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  base_currency_debit numeric(18, 4) not null default 0,
  base_currency_credit numeric(18, 4) not null default 0,
  branch_id uuid references public.branches(id) on delete set null,
  activity_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  staff_member_id uuid references public.profiles(id) on delete set null,
  tax_code text,
  tax_amount numeric(18, 4) not null default 0,
  due_date date,
  reference text,
  reconciliation_status text not null default 'unreconciled',
  created_at timestamptz not null default now(),
  unique (journal_entry_id, line_sequence),
  check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0)),
  check ((base_currency_debit > 0 and base_currency_credit = 0) or (base_currency_credit > 0 and base_currency_debit = 0))
);

create table public.account_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  accounting_period_id uuid references public.accounting_periods(id) on delete cascade,
  currency text not null default 'KES',
  opening_debit numeric(18, 4) not null default 0,
  opening_credit numeric(18, 4) not null default 0,
  period_debit numeric(18, 4) not null default 0,
  period_credit numeric(18, 4) not null default 0,
  closing_debit numeric(18, 4) not null default 0,
  closing_credit numeric(18, 4) not null default 0,
  rebuilt_at timestamptz
);

create unique index account_balances_scope_idx
  on public.account_balances(
    business_id,
    account_id,
    accounting_period_id,
    currency,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table public.subledger_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  reconciliation_type text not null,
  account_id uuid references public.chart_of_accounts(id) on delete restrict,
  accounting_period_id uuid references public.accounting_periods(id) on delete set null,
  general_ledger_balance numeric(18, 4) not null default 0,
  operational_subledger_balance numeric(18, 4) not null default 0,
  difference numeric(18, 4) not null default 0,
  unposted_event_count integer not null default 0,
  failed_event_count integer not null default 0,
  manual_journal_impact numeric(18, 4) not null default 0,
  last_reconciled_at timestamptz,
  status text not null default 'needs_review' check (status in ('reconciled','small_difference','difference_found','unposted_transactions','failed_posting','needs_review')),
  assigned_reviewer uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.accounting_diagnostics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  severity text not null check (severity in ('info','warning','critical')),
  diagnostic_code text not null,
  title text not null,
  detail text not null,
  suggested_action text not null,
  source_module text,
  source_transaction_id uuid,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  accounting_event_id uuid references public.accounting_events(id) on delete set null,
  status text not null default 'open' check (status in ('open','assigned','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.accounting_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  import_type text not null check (import_type in ('chart_of_accounts','journal_import','opening_balances')),
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

create table public.accounting_import_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_batch_id uuid not null references public.accounting_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  validation_errors jsonb not null default '[]'::jsonb,
  preview_data jsonb not null default '{}'::jsonb,
  committed_account_id uuid references public.chart_of_accounts(id) on delete set null,
  committed_journal_id uuid references public.journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (import_batch_id, row_number)
);

create table public.accounting_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_path text not null,
  content_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.accounting_audit_trail (
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

insert into public.account_role_definitions (role_code, role_name, description, default_account_class, normal_balance)
values
  ('CUSTOMER_RECEIVABLES','Customer Receivables','Money customers owe the business.','assets','debit'),
  ('SUPPLIER_PAYABLES','Supplier Payables','Money owed to suppliers.','liabilities','credit'),
  ('SALES_REVENUE','Product Sales','Product revenue.','revenue','credit'),
  ('SERVICE_REVENUE','Service Revenue','Service revenue.','revenue','credit'),
  ('INVENTORY_ASSET','Inventory','Stock held for resale or production.','assets','debit'),
  ('VEHICLE_STOCK','Vehicle Stock','Stock assigned to vehicles.','assets','debit'),
  ('INVENTORY_IN_TRANSIT','Inventory in Transit','Stock moving between locations.','assets','debit'),
  ('GOODS_RECEIVED_NOT_INVOICED','Goods Received Not Invoiced','Inventory received before supplier bill.','liabilities','credit'),
  ('COST_OF_GOODS_SOLD','Cost of Goods Sold','Cost attached to sold stock.','cost_of_sales','debit'),
  ('PURCHASE_PRICE_VARIANCE','Purchase Price Variance','Difference between receipt and bill cost.','cost_of_sales','debit'),
  ('SALES_DISCOUNT','Discounts Allowed','Sales discounts.','revenue','debit'),
  ('SALES_RETURNS','Sales Returns','Revenue reduction for returns.','revenue','debit'),
  ('PURCHASE_RETURNS','Purchase Returns','Purchase return clearing.','liabilities','debit'),
  ('OUTPUT_VAT','Output VAT','VAT charged on sales.','liabilities','credit'),
  ('INPUT_VAT','Input VAT','VAT claimable on purchases.','assets','debit'),
  ('VAT_PAYABLE','VAT Payable','Net VAT payable.','liabilities','credit'),
  ('WITHHOLDING_TAX_PAYABLE','Withholding Tax Payable','Withholding tax due.','liabilities','credit'),
  ('CASH_ON_HAND','Cash on Hand','Physical cash.','assets','debit'),
  ('CASH_IN_TRANSIT','Cash in Transit','Cash moving between custody points.','assets','debit'),
  ('BANK_ACCOUNT','Bank Account','Bank balances.','assets','debit'),
  ('MOBILE_MONEY_ACCOUNT','M-Pesa and Mobile Money','Mobile money balances.','assets','debit'),
  ('CUSTOMER_DEPOSITS','Customer Deposits','Customer advances and deposits.','liabilities','credit'),
  ('SUPPLIER_ADVANCES','Supplier Advances','Advances paid to suppliers.','assets','debit'),
  ('STAFF_ADVANCES','Staff Advances','Recoverable staff advances.','assets','debit'),
  ('OWNER_CAPITAL','Owner Capital','Owner equity contributions.','equity','credit'),
  ('OWNER_DRAWINGS','Owner Drawings','Owner withdrawals.','equity','debit'),
  ('OWNER_LOAN','Owner Loan','Loans from owners.','liabilities','credit'),
  ('OWNER_CURRENT_ACCOUNT','Owner Current Account','Owner current account.','equity','credit'),
  ('CASH_SHORTAGE','Cash Shortage','Approved cash shortages.','expenses','debit'),
  ('CASH_SURPLUS','Cash Surplus','Cash surplus income.','other_income','credit'),
  ('BANK_CHARGES','Bank Charges','Bank charges expense.','expenses','debit'),
  ('MOBILE_MONEY_CHARGES','M-Pesa Charges','Mobile-money charges.','expenses','debit'),
  ('ROUTE_EXPENSE','Route Expense','Delivery and route expenses.','expenses','debit'),
  ('PACKAGING_ASSET','Returnable Packaging','Returnable packaging assets.','assets','debit'),
  ('PACKAGING_DEPOSIT_LIABILITY','Packaging Deposits','Packaging deposit liabilities.','liabilities','credit'),
  ('OPENING_BALANCE_EQUITY','Opening Balance Equity','Opening balance clearing.','equity','credit'),
  ('RETAINED_EARNINGS','Retained Earnings','Accumulated prior earnings.','equity','credit'),
  ('CURRENT_YEAR_EARNINGS','Current-Year Earnings','Current period profit accumulation.','equity','credit')
on conflict (role_code) do nothing;

with inserted_rules as (
  insert into public.posting_rules (event_type, description_template, journal_type, priority)
  values
    ('credit_sale','Credit sale posting','sales_journal',10),
    ('customer_payment','Customer payment posting','cash_receipt_journal',10),
    ('grn_received','Goods received before supplier bill','inventory_journal',10),
    ('supplier_bill_inventory','Supplier inventory bill posting','purchase_journal',10),
    ('supplier_payment','Supplier payment posting','cash_payment_journal',10),
    ('expense_paid','Paid expense posting','cash_payment_journal',10),
    ('owner_capital','Owner capital introduced','owner_transaction_journal',10),
    ('owner_drawing','Owner drawing posting','owner_transaction_journal',10),
    ('staff_advance','Staff advance issued','cash_payment_journal',10),
    ('cash_shortage','Cash shortage posting','cash_payment_journal',10)
  returning id, event_type
)
insert into public.posting_rule_lines (posting_rule_id, line_sequence, side, account_role_code, amount_source, customer_reference, supplier_reference, product_reference, tax_reference, description_template)
select id, line_sequence, side, account_role_code, amount_source, customer_reference, supplier_reference, product_reference, tax_reference, description_template
from inserted_rules
cross join lateral (
  values
    (case when event_type = 'credit_sale' then 10 end, 'debit', 'CUSTOMER_RECEIVABLES', 'amount', true, false, false, false, 'Money customers owe'),
    (case when event_type = 'credit_sale' then 20 end, 'credit', 'SALES_REVENUE', 'net_of_tax', false, false, true, false, 'Product sales'),
    (case when event_type = 'credit_sale' then 30 end, 'credit', 'OUTPUT_VAT', 'tax_amount', false, false, false, true, 'Output VAT'),
    (case when event_type = 'credit_sale' then 40 end, 'debit', 'COST_OF_GOODS_SOLD', 'cost_amount', false, false, true, false, 'Cost of goods sold'),
    (case when event_type = 'credit_sale' then 50 end, 'credit', 'INVENTORY_ASSET', 'cost_amount', false, false, true, false, 'Inventory issued'),
    (case when event_type = 'customer_payment' then 10 end, 'debit', 'BANK_ACCOUNT', 'amount', false, false, false, false, 'Cash or bank received'),
    (case when event_type = 'customer_payment' then 20 end, 'credit', 'CUSTOMER_RECEIVABLES', 'amount', true, false, false, false, 'Customer receivable cleared'),
    (case when event_type = 'grn_received' then 10 end, 'debit', 'INVENTORY_ASSET', 'cost_amount', false, true, true, false, 'Inventory received'),
    (case when event_type = 'grn_received' then 20 end, 'credit', 'GOODS_RECEIVED_NOT_INVOICED', 'cost_amount', false, true, true, false, 'GRNI liability'),
    (case when event_type = 'supplier_bill_inventory' then 10 end, 'debit', 'GOODS_RECEIVED_NOT_INVOICED', 'net_of_tax', false, true, true, false, 'Clear GRNI'),
    (case when event_type = 'supplier_bill_inventory' then 20 end, 'debit', 'INPUT_VAT', 'tax_amount', false, true, false, true, 'Input VAT'),
    (case when event_type = 'supplier_bill_inventory' then 30 end, 'credit', 'SUPPLIER_PAYABLES', 'amount', false, true, false, false, 'Supplier payable'),
    (case when event_type = 'supplier_payment' then 10 end, 'debit', 'SUPPLIER_PAYABLES', 'amount', false, true, false, false, 'Supplier payable settled'),
    (case when event_type = 'supplier_payment' then 20 end, 'credit', 'BANK_ACCOUNT', 'amount', false, false, false, false, 'Cash or bank paid'),
    (case when event_type = 'expense_paid' then 10 end, 'debit', 'ROUTE_EXPENSE', 'net_of_tax', false, false, false, false, 'Expense'),
    (case when event_type = 'expense_paid' then 20 end, 'debit', 'INPUT_VAT', 'tax_amount', false, false, false, true, 'Input VAT'),
    (case when event_type = 'expense_paid' then 30 end, 'credit', 'BANK_ACCOUNT', 'amount', false, false, false, false, 'Cash or bank paid'),
    (case when event_type = 'owner_capital' then 10 end, 'debit', 'BANK_ACCOUNT', 'amount', false, false, false, false, 'Cash or bank received'),
    (case when event_type = 'owner_capital' then 20 end, 'credit', 'OWNER_CAPITAL', 'amount', false, false, false, false, 'Owner capital'),
    (case when event_type = 'owner_drawing' then 10 end, 'debit', 'OWNER_DRAWINGS', 'amount', false, false, false, false, 'Owner drawing'),
    (case when event_type = 'owner_drawing' then 20 end, 'credit', 'BANK_ACCOUNT', 'amount', false, false, false, false, 'Cash or bank paid'),
    (case when event_type = 'staff_advance' then 10 end, 'debit', 'STAFF_ADVANCES', 'amount', false, false, false, false, 'Staff advance'),
    (case when event_type = 'staff_advance' then 20 end, 'credit', 'BANK_ACCOUNT', 'amount', false, false, false, false, 'Cash or bank paid'),
    (case when event_type = 'cash_shortage' then 10 end, 'debit', 'CASH_SHORTAGE', 'amount', false, false, false, false, 'Cash shortage'),
    (case when event_type = 'cash_shortage' then 20 end, 'credit', 'CASH_ON_HAND', 'amount', false, false, false, false, 'Cash reduced')
) as lines(line_sequence, side, account_role_code, amount_source, customer_reference, supplier_reference, product_reference, tax_reference, description_template)
where line_sequence is not null;

create or replace function public.install_default_chart_of_accounts(target_business_id uuid)
returns integer
language plpgsql
as $$
declare
  created_count integer := 0;
  current_user_id uuid := auth.uid();
begin
  if public.current_user_business_role(target_business_id) <> 'owner' then
    raise exception 'Only an Owner can install the default chart of accounts.';
  end if;

  insert into public.chart_of_accounts (
    business_id, account_code, account_name, description, account_class, account_type, normal_balance,
    is_control_account, is_posting_account, is_system_account, reconciliation_required,
    cash_flow_category, financial_statement_section, allow_manual_posting, created_by
  )
  values
    (target_business_id,'1000','Cash on Hand','Physical cash held by the business.','assets','Current Asset','debit',false,true,true,true,'operating','current_assets',true,current_user_id),
    (target_business_id,'1010','Petty Cash','Petty cash floats.','assets','Current Asset','debit',false,true,false,true,'operating','current_assets',true,current_user_id),
    (target_business_id,'1020','Cash in Transit','Cash moving between custody points.','assets','Current Asset','debit',false,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1030','Driver Cash Custody','Cash held by drivers during delivery runs.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1100','Bank Accounts','Bank account control.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',true,current_user_id),
    (target_business_id,'1110','M-Pesa and Mobile Money','Mobile money control.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',true,current_user_id),
    (target_business_id,'1120','Cheques in Clearing','Cheques awaiting clearance.','assets','Current Asset','debit',true,true,false,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1200','Customer Receivables','Money customers owe.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1210','Allowance for Doubtful Debts','Allowance for doubtful customer debt.','assets','Current Asset','credit',false,true,false,false,'operating','current_assets',true,current_user_id),
    (target_business_id,'1300','Supplier Advances','Advances paid to suppliers.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1310','Staff Advances','Advances issued to staff.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1320','Owner Receivable','Amounts recoverable from owners.','assets','Current Asset','debit',true,true,false,true,'operating','current_assets',true,current_user_id),
    (target_business_id,'1400','Inventory','Stock held for sale.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1410','Inventory in Transit','Stock in transit.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1420','Vehicle Stock','Stock held on vehicles.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1430','Quarantined Inventory','Stock under quarantine.','assets','Current Asset','debit',true,true,false,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1440','Damaged Inventory','Damaged stock awaiting disposal.','assets','Current Asset','debit',true,true,false,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1450','Returnable Packaging','Crates, bottles and returnable packaging.','assets','Current Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1500','Input VAT','VAT claimable on purchases.','assets','Tax Asset','debit',true,true,true,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1510','Withholding Tax Recoverable','Withholding tax recoverable.','assets','Tax Asset','debit',true,true,false,true,'operating','current_assets',false,current_user_id),
    (target_business_id,'1600','Prepayments','Prepaid expenses.','assets','Current Asset','debit',false,true,false,false,'operating','current_assets',true,current_user_id),
    (target_business_id,'1610','Deposits Paid','Deposits paid to third parties.','assets','Current Asset','debit',false,true,false,false,'operating','current_assets',true,current_user_id),
    (target_business_id,'1700','Property and Equipment Placeholder','Fixed asset placeholder.','assets','Non Current Asset','debit',false,true,false,false,'investing','non_current_assets',true,current_user_id),
    (target_business_id,'1790','Accumulated Depreciation Placeholder','Accumulated depreciation placeholder.','assets','Non Current Asset','credit',false,true,false,false,'investing','non_current_assets',true,current_user_id),
    (target_business_id,'1900','Other Current Assets','Other current assets.','assets','Current Asset','debit',false,true,false,false,'operating','current_assets',true,current_user_id),
    (target_business_id,'2000','Supplier Payables','Money owed to suppliers.','liabilities','Current Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2010','Goods Received Not Invoiced','Received stock awaiting supplier bill.','liabilities','Current Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2100','Customer Deposits','Customer advances and deposits.','liabilities','Current Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2110','Customer Credit Balances','Customer overpayments.','liabilities','Current Liability','credit',true,true,false,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2120','Packaging Deposits','Returnable packaging deposits.','liabilities','Current Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2200','Output VAT','VAT charged on sales.','liabilities','Tax Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2210','VAT Payable','Net VAT payable.','liabilities','Tax Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2220','Withholding Tax Payable','Withholding tax due.','liabilities','Tax Liability','credit',true,true,true,true,'operating','current_liabilities',false,current_user_id),
    (target_business_id,'2230','PAYE Payable Placeholder','PAYE liability placeholder.','liabilities','Tax Liability','credit',false,true,false,true,'operating','current_liabilities',true,current_user_id),
    (target_business_id,'2240','NSSF Payable Placeholder','NSSF liability placeholder.','liabilities','Current Liability','credit',false,true,false,true,'operating','current_liabilities',true,current_user_id),
    (target_business_id,'2250','SHIF Payable Placeholder','SHIF liability placeholder.','liabilities','Current Liability','credit',false,true,false,true,'operating','current_liabilities',true,current_user_id),
    (target_business_id,'2260','Affordable Housing Levy Payable Placeholder','AHL liability placeholder.','liabilities','Current Liability','credit',false,true,false,true,'operating','current_liabilities',true,current_user_id),
    (target_business_id,'2300','Accrued Expenses','Accrued operating costs.','liabilities','Current Liability','credit',false,true,false,false,'operating','current_liabilities',true,current_user_id),
    (target_business_id,'2400','Loans Payable','External loans payable.','liabilities','Non Current Liability','credit',false,true,false,true,'financing','non_current_liabilities',true,current_user_id),
    (target_business_id,'2410','Owner Loan Payable','Loans from owners.','liabilities','Current Liability','credit',true,true,true,true,'financing','current_liabilities',true,current_user_id),
    (target_business_id,'2900','Other Current Liabilities','Other current liabilities.','liabilities','Current Liability','credit',false,true,false,false,'operating','current_liabilities',true,current_user_id),
    (target_business_id,'3000','Owner Capital','Owner contributions.','equity','Equity','credit',false,true,true,false,'financing','equity',true,current_user_id),
    (target_business_id,'3010','Additional Capital','Additional owner capital.','equity','Equity','credit',false,true,false,false,'financing','equity',true,current_user_id),
    (target_business_id,'3100','Retained Earnings','Prior year retained earnings.','equity','Equity','credit',false,true,true,false,'financing','equity',false,current_user_id),
    (target_business_id,'3110','Current-Year Earnings','Current year profit clearing.','equity','Equity','credit',false,true,true,false,'financing','equity',false,current_user_id),
    (target_business_id,'3200','Owner Drawings','Owner drawings.','equity','Equity','debit',true,true,true,false,'financing','equity',true,current_user_id),
    (target_business_id,'3300','Opening Balance Equity','Opening balances clearing.','equity','Equity','credit',false,true,true,false,'financing','equity',false,current_user_id),
    (target_business_id,'3400','Revaluation Reserve Placeholder','Revaluation reserve placeholder.','equity','Equity','credit',false,true,false,false,'financing','equity',true,current_user_id),
    (target_business_id,'4000','Product Sales','Sales of products.','revenue','Operating Revenue','credit',false,true,true,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4010','Service Revenue','Service income.','revenue','Operating Revenue','credit',false,true,true,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4020','Delivery Income','Delivery fees charged.','revenue','Operating Revenue','credit',false,true,false,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4030','Packaging Charges','Packaging charges.','revenue','Operating Revenue','credit',false,true,false,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4090','Other Operating Revenue','Other operating revenue.','revenue','Operating Revenue','credit',false,true,false,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4100','Discounts Allowed','Sales discounts.','revenue','Contra Revenue','debit',false,true,true,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4110','Sales Returns','Sales returns.','revenue','Contra Revenue','debit',false,true,true,false,'operating','revenue',true,current_user_id),
    (target_business_id,'4900','Other Income','Other income.','other_income','Other Income','credit',false,true,false,false,'operating','other_income',true,current_user_id),
    (target_business_id,'4910','Interest Income','Interest income.','other_income','Other Income','credit',false,true,false,false,'investing','other_income',true,current_user_id),
    (target_business_id,'5000','Cost of Goods Sold','Cost of stock sold.','cost_of_sales','Cost of Sales','debit',false,true,true,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5010','Purchase Price Variance','Purchase price variance.','cost_of_sales','Cost of Sales','debit',false,true,true,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5020','Inventory Shrinkage','Stock count losses.','cost_of_sales','Cost of Sales','debit',false,true,false,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5030','Inventory Damage','Damaged stock losses.','cost_of_sales','Cost of Sales','debit',false,true,false,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5040','Inventory Expiry','Expired stock losses.','cost_of_sales','Cost of Sales','debit',false,true,false,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5050','Packaging Loss','Packaging losses.','cost_of_sales','Cost of Sales','debit',false,true,false,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5060','Freight and Landed Cost','Freight and landed cost.','cost_of_sales','Cost of Sales','debit',false,true,false,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'5070','Direct Labour Placeholder','Direct labour placeholder.','cost_of_sales','Cost of Sales','debit',false,true,false,false,'operating','cost_of_sales',true,current_user_id),
    (target_business_id,'6000','Rent','Rent expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6010','Utilities','Utilities expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6020','Salaries and Wages Placeholder','Payroll placeholder.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6030','Fuel','Fuel expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6040','Vehicle Expenses','Vehicle expenses.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6050','Delivery Expenses','Delivery expenses.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6060','Bank Charges','Bank charges.','expenses','Operating Expense','debit',false,true,true,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6070','M-Pesa Charges','Mobile money charges.','expenses','Operating Expense','debit',false,true,true,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6080','Marketing','Marketing expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6090','Travel','Travel expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6100','Accommodation','Accommodation expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6110','Communication','Communication expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6120','Office Expenses','Office expenses.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6130','Repairs and Maintenance','Repairs and maintenance.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6140','Insurance','Insurance expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6150','Professional Fees','Professional fees.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6160','Staff Welfare','Staff welfare.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6170','Training','Training expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6180','Licences and Permits','Licence and permit costs.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6190','Taxes and Levies','Non-income taxes and levies.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6200','Bad Debts','Bad debt expense.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6210','Cash Shortage','Approved cash shortage.','expenses','Operating Expense','debit',false,true,true,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6220','Depreciation Placeholder','Depreciation placeholder.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'6900','Other Operating Expenses','Other operating expenses.','expenses','Operating Expense','debit',false,true,false,false,'operating','expenses',true,current_user_id),
    (target_business_id,'7900','Cash Surplus','Cash surplus income.','other_income','Other Income','credit',false,true,true,false,'operating','other_income',true,current_user_id)
  on conflict (business_id, account_code) do nothing;

  get diagnostics created_count = row_count;

  insert into public.account_role_mappings (business_id, role_code, account_id, is_system_mapping, created_by)
  select target_business_id, role_code, coa.id, true, current_user_id
  from (
    values
      ('CUSTOMER_RECEIVABLES','1200'),('SUPPLIER_PAYABLES','2000'),('SALES_REVENUE','4000'),('SERVICE_REVENUE','4010'),
      ('INVENTORY_ASSET','1400'),('VEHICLE_STOCK','1420'),('INVENTORY_IN_TRANSIT','1410'),('GOODS_RECEIVED_NOT_INVOICED','2010'),
      ('COST_OF_GOODS_SOLD','5000'),('PURCHASE_PRICE_VARIANCE','5010'),('SALES_DISCOUNT','4100'),('SALES_RETURNS','4110'),
      ('OUTPUT_VAT','2200'),('INPUT_VAT','1500'),('VAT_PAYABLE','2210'),('WITHHOLDING_TAX_PAYABLE','2220'),
      ('CASH_ON_HAND','1000'),('CASH_IN_TRANSIT','1020'),('BANK_ACCOUNT','1100'),('MOBILE_MONEY_ACCOUNT','1110'),
      ('CUSTOMER_DEPOSITS','2100'),('SUPPLIER_ADVANCES','1300'),('STAFF_ADVANCES','1310'),('OWNER_CAPITAL','3000'),
      ('OWNER_DRAWINGS','3200'),('OWNER_LOAN','2410'),('OWNER_CURRENT_ACCOUNT','3000'),('CASH_SHORTAGE','6210'),
      ('CASH_SURPLUS','7900'),('BANK_CHARGES','6060'),('MOBILE_MONEY_CHARGES','6070'),('ROUTE_EXPENSE','6050'),
      ('PACKAGING_ASSET','1450'),('PACKAGING_DEPOSIT_LIABILITY','2120'),('OPENING_BALANCE_EQUITY','3300'),
      ('RETAINED_EARNINGS','3100'),('CURRENT_YEAR_EARNINGS','3110')
  ) as mapping(role_code, account_code)
  join public.chart_of_accounts coa on coa.business_id = target_business_id and coa.account_code = mapping.account_code
  where not exists (
    select 1 from public.account_role_mappings arm
    where arm.business_id = target_business_id
      and arm.role_code = mapping.role_code
      and arm.branch_id is null
      and arm.active = true
  );

  insert into public.accounting_setup_progress (business_id, current_step, completed_steps, readiness_checks)
  values (
    target_business_id,
    'account_role_mapping',
    array['accounting_basics','chart_of_accounts'],
    jsonb_build_object('chart_installed', true, 'critical_roles_mapped', true)
  )
  on conflict (business_id) do update
  set completed_steps = array(select distinct unnest(public.accounting_setup_progress.completed_steps || excluded.completed_steps)),
      readiness_checks = public.accounting_setup_progress.readiness_checks || excluded.readiness_checks,
      updated_at = now();

  return created_count;
end;
$$;

create or replace function public.prevent_account_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid;
  cursor_business uuid;
begin
  if new.parent_account_id is null then
    new.hierarchy_level := 0;
    return new;
  end if;

  select business_id into cursor_business from public.chart_of_accounts where id = new.parent_account_id;
  if cursor_business is distinct from new.business_id then
    raise exception 'Parent account must belong to the same business.';
  end if;

  cursor_id := new.parent_account_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Account hierarchy cannot be circular.';
    end if;
    select parent_account_id into cursor_id from public.chart_of_accounts where id = cursor_id;
  end loop;

  select hierarchy_level + 1 into new.hierarchy_level from public.chart_of_accounts where id = new.parent_account_id;
  return new;
end;
$$;

create trigger chart_of_accounts_prevent_cycle
before insert or update of parent_account_id, business_id
on public.chart_of_accounts
for each row execute function public.prevent_account_cycle();

create or replace function public.prevent_account_delete_with_history()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.journal_lines where account_id = old.id limit 1) then
    raise exception 'Accounts with journal history must be archived, not deleted.';
  end if;
  if old.is_system_account then
    raise exception 'System accounts must be archived through controlled setup, not deleted.';
  end if;
  return old;
end;
$$;

create trigger chart_of_accounts_protect_delete
before delete on public.chart_of_accounts
for each row execute function public.prevent_account_delete_with_history();

create or replace function public.prevent_posted_accounting_event_update()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('posted','reversed') then
    raise exception 'Posted accounting events are immutable. Use a reversal.';
  end if;
  return new;
end;
$$;

create trigger accounting_events_immutable_after_post
before update on public.accounting_events
for each row execute function public.prevent_posted_accounting_event_update();

create or replace function public.prepare_journal_line()
returns trigger
language plpgsql
as $$
declare
  account_record public.chart_of_accounts%rowtype;
  journal_record public.journal_entries%rowtype;
begin
  select * into account_record from public.chart_of_accounts where id = new.account_id;
  select * into journal_record from public.journal_entries where id = new.journal_entry_id;

  if journal_record.status in ('posted','reversed') then
    raise exception 'Posted journal entries cannot be edited.';
  end if;
  if account_record.business_id <> new.business_id or journal_record.business_id <> new.business_id then
    raise exception 'Journal line account and journal must belong to the same business.';
  end if;
  if account_record.is_header_account or not account_record.is_posting_account then
    raise exception 'Journal lines can only post to posting accounts.';
  end if;
  new.account_code_snapshot := account_record.account_code;
  new.account_name_snapshot := account_record.account_name;
  new.base_currency_debit := round(new.debit_amount * new.exchange_rate, 4);
  new.base_currency_credit := round(new.credit_amount * new.exchange_rate, 4);
  return new;
end;
$$;

create trigger journal_lines_prepare
before insert or update on public.journal_lines
for each row execute function public.prepare_journal_line();

create or replace function public.prevent_posted_journal_line_change()
returns trigger
language plpgsql
as $$
declare
  old_status public.journal_status;
begin
  select status into old_status from public.journal_entries where id = old.journal_entry_id;
  if old_status in ('posted','reversed') then
    raise exception 'Posted journal lines are immutable.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger journal_lines_no_update_after_post
before update or delete on public.journal_lines
for each row execute function public.prevent_posted_journal_line_change();

create or replace function public.refresh_journal_totals()
returns trigger
language plpgsql
as $$
declare
  target_journal_id uuid;
begin
  target_journal_id := coalesce(new.journal_entry_id, old.journal_entry_id);
  update public.journal_entries je
  set total_debit = coalesce(t.total_debit, 0),
      total_credit = coalesce(t.total_credit, 0),
      base_total_debit = coalesce(t.base_total_debit, 0),
      base_total_credit = coalesce(t.base_total_credit, 0)
  from (
    select journal_entry_id,
           sum(debit_amount) total_debit,
           sum(credit_amount) total_credit,
           sum(base_currency_debit) base_total_debit,
           sum(base_currency_credit) base_total_credit
    from public.journal_lines
    where journal_entry_id = target_journal_id
    group by journal_entry_id
  ) t
  where je.id = target_journal_id;
  return coalesce(new, old);
end;
$$;

create trigger journal_lines_refresh_totals
after insert or update or delete on public.journal_lines
for each row execute function public.refresh_journal_totals();

create or replace function public.validate_journal_posting()
returns trigger
language plpgsql
as $$
declare
  target_period public.accounting_periods%rowtype;
begin
  if new.status = 'posted' and old.status is distinct from 'posted' then
    if new.total_debit <= 0 or new.total_debit <> new.total_credit or new.base_total_debit <> new.base_total_credit then
      raise exception 'Posted journal entries must be balanced.';
    end if;

    select * into target_period from public.accounting_periods where id = new.accounting_period_id;
    if target_period.id is null or new.posting_date < target_period.start_date or new.posting_date > target_period.end_date then
      raise exception 'Posting date must belong to a valid accounting period.';
    end if;
    if target_period.status = 'closed' or target_period.general_ledger_locked then
      insert into public.accounting_diagnostics (business_id, branch_id, severity, diagnostic_code, title, detail, suggested_action, journal_entry_id)
      values (new.business_id, new.branch_id, 'critical', 'CLOSED_PERIOD_POSTING', 'Posting blocked by closed period', 'A journal attempted to post into a closed or locked period.', 'Reopen the period under controlled approval or post an authorised later-period reversal.', new.id);
      raise exception 'Cannot post into a closed or locked accounting period.';
    end if;

    new.posted_at := coalesce(new.posted_at, now());
    new.posted_by := coalesce(new.posted_by, auth.uid());
  end if;

  if old.status in ('posted','reversed')
     and new.status <> old.status
     and not (old.status = 'posted' and new.status = 'reversed') then
    raise exception 'Posted journals can only be reversed through reversal journals.';
  end if;
  return new;
end;
$$;

create trigger journal_entries_validate_posting
before update of status on public.journal_entries
for each row execute function public.validate_journal_posting();

create or replace function public.find_account_for_role(target_business_id uuid, target_role text, target_branch_id uuid default null)
returns uuid
language plpgsql
stable
as $$
declare
  resolved_account_id uuid;
begin
  select arm.account_id into resolved_account_id
  from public.account_role_mappings arm
  join public.chart_of_accounts coa on coa.id = arm.account_id
  where arm.business_id = target_business_id
    and arm.role_code = target_role
    and arm.active = true
    and coa.active = true
    and (arm.branch_id = target_branch_id or arm.branch_id is null)
  order by case when arm.branch_id = target_branch_id then 0 else 1 end, arm.effective_start_date desc
  limit 1;

  if resolved_account_id is null then
    raise exception 'Missing account role mapping: %', target_role;
  end if;
  return resolved_account_id;
end;
$$;

create or replace function public.process_accounting_event(target_event_id uuid)
returns uuid
language plpgsql
as $$
declare
  event_record public.accounting_events%rowtype;
  rule_record public.posting_rules%rowtype;
  period_record public.accounting_periods%rowtype;
  journal_id uuid;
  line_record public.posting_rule_lines%rowtype;
  resolved_account_id uuid;
  line_amount numeric(18, 4);
  generated_number text;
begin
  select * into event_record from public.accounting_events where id = target_event_id for update;
  if event_record.id is null then
    raise exception 'Accounting event not found.';
  end if;
  if event_record.status = 'posted' then
    select id into journal_id from public.journal_entries where accounting_event_id = target_event_id;
    return journal_id;
  end if;
  if event_record.status in ('cancelled','reversed') then
    raise exception 'Cancelled or reversed events cannot be posted.';
  end if;

  update public.accounting_events set status = 'validating', retry_count = retry_count + 1 where id = target_event_id;

  select * into period_record
  from public.accounting_periods
  where business_id = event_record.business_id
    and event_record.posting_date between start_date and end_date
    and status in ('open','soft_closed','reopened')
  order by start_date desc
  limit 1;
  if period_record.id is null then
    update public.accounting_events
    set status = 'needs_review', error_code = 'INVALID_PERIOD', error_message = 'No open accounting period covers the posting date.'
    where id = target_event_id;
    return null;
  end if;

  select * into rule_record
  from public.posting_rules
  where (business_id = event_record.business_id or business_id is null)
    and event_type = event_record.event_type
    and active = true
    and event_record.posting_date between effective_start_date and coalesce(effective_end_date, event_record.posting_date)
  order by case when business_id = event_record.business_id then 0 else 1 end, priority asc
  limit 1;

  if rule_record.id is null then
    update public.accounting_events
    set status = 'needs_review', error_code = 'MISSING_POSTING_RULE', error_message = 'No posting rule is configured for this event type.'
    where id = target_event_id;
    return null;
  end if;

  generated_number := public.generate_document_number(event_record.business_id, rule_record.journal_type::text, event_record.branch_id, event_record.created_by);

  insert into public.journal_entries (
    journal_number, business_id, branch_id, financial_year_id, accounting_period_id, journal_type,
    journal_source, journal_date, posting_date, currency, exchange_rate, reference, description,
    source_module, source_transaction_type, source_transaction_id, accounting_event_id, status, approval_status, created_by
  )
  values (
    generated_number, event_record.business_id, event_record.branch_id, period_record.financial_year_id, period_record.id,
    rule_record.journal_type, 'automatic', event_record.event_date, event_record.posting_date, event_record.currency,
    event_record.exchange_rate, event_record.reference, rule_record.description_template,
    event_record.source_module, event_record.source_transaction_type, event_record.source_transaction_id, event_record.id,
    'draft', 'not_required', event_record.created_by
  )
  returning id into journal_id;

  for line_record in select * from public.posting_rule_lines where posting_rule_id = rule_record.id and active = true order by line_sequence loop
    line_amount := case line_record.amount_source
      when 'amount' then event_record.amount
      when 'tax_amount' then event_record.tax_amount
      when 'cost_amount' then event_record.cost_amount
      when 'net_of_tax' then event_record.amount - event_record.tax_amount
      when 'payload' then coalesce((event_record.event_payload ->> line_record.payload_amount_key)::numeric, 0)
      else 0
    end;
    if line_amount <> 0 then
      resolved_account_id := public.find_account_for_role(event_record.business_id, line_record.account_role_code, event_record.branch_id);
      insert into public.journal_lines (
        journal_entry_id, business_id, line_sequence, account_id, account_code_snapshot, account_name_snapshot,
        description, debit_amount, credit_amount, currency, exchange_rate, branch_id, customer_id, supplier_id,
        product_id, variant_id, warehouse_id, route_id, vehicle_id, staff_member_id, tax_amount, reference
      )
      values (
        journal_id, event_record.business_id, line_record.line_sequence, resolved_account_id, '', '',
        coalesce(line_record.description_template, rule_record.description_template),
        case when line_record.side = 'debit' then line_amount else 0 end,
        case when line_record.side = 'credit' then line_amount else 0 end,
        event_record.currency, event_record.exchange_rate, event_record.branch_id,
        case when line_record.customer_reference then event_record.customer_id else null end,
        case when line_record.supplier_reference then event_record.supplier_id else null end,
        case when line_record.product_reference then event_record.product_id else null end,
        event_record.variant_id, event_record.warehouse_id, event_record.route_id, event_record.vehicle_id, event_record.driver_id,
        case when line_record.tax_reference then event_record.tax_amount else 0 end, event_record.reference
      );
    end if;
  end loop;

  update public.journal_entries set status = 'posted' where id = journal_id;
  update public.accounting_events set status = 'posted', processed_at = now(), error_code = null, error_message = null where id = target_event_id;
  insert into public.accounting_audit_trail (business_id, actor_id, action, entity_type, entity_id, new_value)
  values (event_record.business_id, auth.uid(), 'accounting_event_posted', 'journal_entry', journal_id, jsonb_build_object('event_id', target_event_id));
  return journal_id;
exception
  when others then
    update public.accounting_events
    set status = 'failed', error_code = sqlstate, error_message = sqlerrm
    where id = target_event_id;
    raise;
end;
$$;

create or replace function public.reverse_journal_entry(target_journal_id uuid, reason text)
returns uuid
language plpgsql
as $$
declare
  original public.journal_entries%rowtype;
  reversal_id uuid;
  generated_number text;
begin
  select * into original from public.journal_entries where id = target_journal_id for update;
  if original.id is null then
    raise exception 'Journal not found.';
  end if;
  if original.status <> 'posted' then
    raise exception 'Only posted journals can be reversed.';
  end if;
  if original.reversed then
    raise exception 'Journal has already been reversed.';
  end if;

  generated_number := public.generate_document_number(original.business_id, 'reversal_journal', original.branch_id, auth.uid());

  insert into public.journal_entries (
    journal_number, business_id, branch_id, financial_year_id, accounting_period_id, journal_type, journal_source,
    journal_date, posting_date, currency, exchange_rate, reference, description, source_module,
    source_transaction_type, source_transaction_id, accounting_event_id, status, approval_status, created_by, reversal_reason
  )
  values (
    generated_number, original.business_id, original.branch_id, original.financial_year_id, original.accounting_period_id,
    'reversal_journal', 'reversal', current_date, current_date, original.currency, original.exchange_rate,
    original.journal_number, 'Reversal of ' || original.journal_number, original.source_module,
    original.source_transaction_type, original.source_transaction_id, original.accounting_event_id, 'draft',
    'not_required', auth.uid(), reason
  )
  returning id into reversal_id;

  insert into public.journal_lines (
    journal_entry_id, business_id, line_sequence, account_id, account_code_snapshot, account_name_snapshot, description,
    debit_amount, credit_amount, currency, exchange_rate, branch_id, activity_id, customer_id, supplier_id,
    product_id, variant_id, warehouse_id, route_id, vehicle_id, staff_member_id, tax_code, tax_amount, due_date, reference
  )
  select reversal_id, business_id, line_sequence, account_id, account_code_snapshot, account_name_snapshot,
         'Reversal: ' || description, credit_amount, debit_amount, currency, exchange_rate, branch_id, activity_id,
         customer_id, supplier_id, product_id, variant_id, warehouse_id, route_id, vehicle_id, staff_member_id,
         tax_code, tax_amount, due_date, reference
  from public.journal_lines
  where journal_entry_id = target_journal_id
  order by line_sequence;

  update public.journal_entries set status = 'posted' where id = reversal_id;
  update public.journal_entries set status = 'reversed', reversed = true, reversal_journal_id = reversal_id, reversal_reason = reason where id = target_journal_id;
  return reversal_id;
end;
$$;

create or replace view public.general_ledger_entries
with (security_invoker = true)
as
select
  jl.business_id,
  jl.account_id,
  coa.account_code,
  coa.account_name,
  coa.account_class,
  je.journal_number,
  je.journal_type,
  je.journal_source,
  je.posting_date,
  je.reference,
  jl.description,
  jl.debit_amount,
  jl.credit_amount,
  jl.branch_id,
  jl.activity_id,
  jl.customer_id,
  jl.supplier_id,
  jl.product_id,
  jl.route_id,
  jl.vehicle_id,
  je.source_module,
  je.source_transaction_type,
  je.source_transaction_id,
  je.posted_by,
  je.status,
  je.reversed,
  sum(case when coa.normal_balance = 'debit' then jl.debit_amount - jl.credit_amount else jl.credit_amount - jl.debit_amount end)
    over (partition by jl.business_id, jl.account_id order by je.posting_date, je.journal_number, jl.line_sequence) as running_balance
from public.journal_lines jl
join public.journal_entries je on je.id = jl.journal_entry_id
join public.chart_of_accounts coa on coa.id = jl.account_id
where je.status in ('posted','reversed');

create or replace view public.trial_balance
with (security_invoker = true)
as
select
  jl.business_id,
  je.accounting_period_id,
  jl.account_id,
  coa.account_code,
  coa.account_name,
  coa.account_class,
  sum(jl.debit_amount) as period_debit,
  sum(jl.credit_amount) as period_credit,
  greatest(sum(jl.debit_amount) - sum(jl.credit_amount), 0) as closing_debit,
  greatest(sum(jl.credit_amount) - sum(jl.debit_amount), 0) as closing_credit
from public.journal_lines jl
join public.journal_entries je on je.id = jl.journal_entry_id
join public.chart_of_accounts coa on coa.id = jl.account_id
where je.status in ('posted','reversed')
group by jl.business_id, je.accounting_period_id, jl.account_id, coa.account_code, coa.account_name, coa.account_class;

create index coa_business_class_idx on public.chart_of_accounts(business_id, account_class, active);
create index coa_parent_idx on public.chart_of_accounts(business_id, parent_account_id);
create index account_role_mappings_business_idx on public.account_role_mappings(business_id, role_code, active);
create index accounting_events_queue_idx on public.accounting_events(business_id, status, posting_date, source_module);
create index posting_rules_event_idx on public.posting_rules(business_id, event_type, active, priority);
create index journal_entries_business_period_idx on public.journal_entries(business_id, accounting_period_id, posting_date, status);
create index journal_entries_source_idx on public.journal_entries(business_id, source_module, source_transaction_id);
create index journal_lines_account_date_idx on public.journal_lines(business_id, account_id, journal_entry_id);
create index diagnostics_business_status_idx on public.accounting_diagnostics(business_id, status, severity, created_at desc);

alter table public.account_role_definitions enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.account_role_mappings enable row level security;
alter table public.account_mappings enable row level security;
alter table public.accounting_setup_progress enable row level security;
alter table public.financial_years enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.accounting_events enable row level security;
alter table public.posting_rules enable row level security;
alter table public.posting_rule_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.account_balances enable row level security;
alter table public.subledger_reconciliations enable row level security;
alter table public.accounting_diagnostics enable row level security;
alter table public.accounting_import_batches enable row level security;
alter table public.accounting_import_rows enable row level security;
alter table public.accounting_attachments enable row level security;
alter table public.accounting_audit_trail enable row level security;

create policy account_roles_read on public.account_role_definitions for select to authenticated using (active = true);
create policy coa_member_read on public.chart_of_accounts for select to authenticated using (public.current_user_has_business_access(business_id));
create policy coa_owner_write on public.chart_of_accounts for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy account_role_mappings_member_read on public.account_role_mappings for select to authenticated using (public.current_user_has_business_access(business_id));
create policy account_role_mappings_owner_write on public.account_role_mappings for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy account_mappings_member_read on public.account_mappings for select to authenticated using (public.current_user_has_business_access(business_id));
create policy account_mappings_owner_write on public.account_mappings for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy setup_progress_member_read on public.accounting_setup_progress for select to authenticated using (public.current_user_has_business_access(business_id));
create policy setup_progress_owner_write on public.accounting_setup_progress for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy financial_years_member_read on public.financial_years for select to authenticated using (public.current_user_has_business_access(business_id));
create policy financial_years_owner_write on public.financial_years for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy accounting_periods_member_read on public.accounting_periods for select to authenticated using (public.current_user_has_business_access(business_id));
create policy accounting_periods_owner_write on public.accounting_periods for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy accounting_events_member_read on public.accounting_events for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy accounting_events_owner_manager_write on public.accounting_events for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy posting_rules_member_read on public.posting_rules for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy posting_rules_owner_write on public.posting_rules for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy posting_rule_lines_member_read on public.posting_rule_lines for select to authenticated using (exists (select 1 from public.posting_rules pr where pr.id = posting_rule_id and (pr.business_id is null or public.current_user_has_business_access(pr.business_id))));
create policy journal_entries_member_read on public.journal_entries for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy journal_entries_owner_manager_write on public.journal_entries for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy journal_entries_owner_manager_update on public.journal_entries for update to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy journal_lines_member_read on public.journal_lines for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy journal_lines_owner_manager_write on public.journal_lines for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy balances_member_read on public.account_balances for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy reconciliations_member_read on public.subledger_reconciliations for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy reconciliations_owner_manager_write on public.subledger_reconciliations for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy diagnostics_member_read on public.accounting_diagnostics for select to authenticated using (public.current_user_has_business_access(business_id));
create policy diagnostics_owner_manager_update on public.accounting_diagnostics for update to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy import_batches_member_read on public.accounting_import_batches for select to authenticated using (public.current_user_has_business_access(business_id));
create policy import_batches_owner_manager_write on public.accounting_import_batches for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy import_rows_member_read on public.accounting_import_rows for select to authenticated using (public.current_user_has_business_access(business_id));
create policy attachments_member_read on public.accounting_attachments for select to authenticated using (public.current_user_has_business_access(business_id));
create policy attachments_owner_manager_write on public.accounting_attachments for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy audit_trail_owner_read on public.accounting_audit_trail for select to authenticated using (public.current_user_business_role(business_id) = 'owner');

insert into public.document_numbering_sequences (business_id, document_type, prefix, include_branch_code, include_financial_year, created_by)
select b.id, doc.document_type, doc.prefix, false, true, b.created_by
from public.businesses b
cross join (
  values
    ('sales_journal','SJ'),('purchase_journal','PJ'),('cash_receipt_journal','CR'),('cash_payment_journal','CP'),
    ('bank_journal','BJ'),('inventory_journal','IJ'),('tax_journal','TJ'),('general_journal','GJ'),
    ('opening_journal','OJ'),('adjustment_journal','AJ'),('reversal_journal','RJ'),('transfer_journal','TR'),
    ('owner_transaction_journal','OT')
) as doc(document_type, prefix)
where not exists (
  select 1 from public.document_numbering_sequences dns
  where dns.business_id = b.id and dns.document_type = doc.document_type and dns.scope_key = 'business'
);

grant select on public.account_role_definitions to authenticated;
grant select, insert, update, delete on
  public.chart_of_accounts,
  public.account_role_mappings,
  public.account_mappings,
  public.accounting_setup_progress,
  public.financial_years,
  public.accounting_periods,
  public.accounting_events,
  public.posting_rules,
  public.posting_rule_lines,
  public.journal_entries,
  public.journal_lines,
  public.account_balances,
  public.subledger_reconciliations,
  public.accounting_diagnostics,
  public.accounting_import_batches,
  public.accounting_import_rows,
  public.accounting_attachments,
  public.accounting_audit_trail
to authenticated;

grant select on public.general_ledger_entries, public.trial_balance to authenticated;

revoke execute on function public.prevent_account_cycle() from public;
revoke execute on function public.install_default_chart_of_accounts(uuid) from public;
revoke execute on function public.prevent_account_delete_with_history() from public;
revoke execute on function public.prevent_posted_accounting_event_update() from public;
revoke execute on function public.prepare_journal_line() from public;
revoke execute on function public.prevent_posted_journal_line_change() from public;
revoke execute on function public.refresh_journal_totals() from public;
revoke execute on function public.validate_journal_posting() from public;
revoke execute on function public.find_account_for_role(uuid, text, uuid) from public;
revoke execute on function public.process_accounting_event(uuid) from public;
revoke execute on function public.reverse_journal_entry(uuid, text) from public;

grant execute on function public.find_account_for_role(uuid, text, uuid) to authenticated;
grant execute on function public.install_default_chart_of_accounts(uuid) to authenticated;
grant execute on function public.process_accounting_event(uuid) to authenticated;
grant execute on function public.reverse_journal_entry(uuid, text) to authenticated;
