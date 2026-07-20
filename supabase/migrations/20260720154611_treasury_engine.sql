create type public.financial_transaction_direction as enum ('in', 'out', 'neutral');
create type public.financial_transaction_type as enum (
  'customer_receipt',
  'supplier_payment',
  'cash_sale',
  'cash_purchase',
  'general_receipt',
  'general_payment',
  'expense',
  'bank_deposit',
  'cash_withdrawal',
  'account_transfer_out',
  'account_transfer_in',
  'mpesa_receipt',
  'mpesa_payment',
  'bank_charge',
  'mobile_money_charge',
  'interest_income',
  'interest_expense',
  'owner_capital',
  'owner_drawing',
  'owner_loan_received',
  'owner_loan_repayment',
  'owner_reimbursement',
  'staff_advance',
  'staff_advance_surrender',
  'staff_refund',
  'customer_refund',
  'supplier_refund',
  'route_collection',
  'driver_cash_handover',
  'route_expense',
  'cash_shortage',
  'cash_surplus',
  'cheque_received',
  'cheque_cleared',
  'cheque_bounced',
  'opening_balance',
  'adjustment',
  'reversal',
  'other'
);
create type public.financial_reconciliation_status as enum ('unreconciled', 'matched', 'partially_matched', 'cleared', 'reconciled', 'disputed', 'reversed');
create type public.treasury_document_status as enum ('draft', 'submitted', 'pending_approval', 'approved', 'posted', 'verified', 'rejected', 'closed', 'cancelled', 'reversed');
create type public.expense_claim_status as enum ('draft', 'submitted', 'pending_approval', 'partially_approved', 'approved', 'rejected', 'paid', 'partially_paid', 'closed', 'cancelled');
create type public.transfer_status_treasury as enum ('draft', 'pending_approval', 'approved', 'sent', 'in_transit', 'received', 'partially_received', 'cancelled', 'reversed');
create type public.cheque_status as enum ('received', 'issued', 'post_dated', 'deposited', 'cleared', 'bounced', 'cancelled', 'stale', 'replaced');
create type public.staff_advance_status as enum ('draft', 'pending_approval', 'approved', 'issued', 'partially_surrendered', 'fully_surrendered', 'overdue', 'written_off_placeholder', 'cancelled', 'reversed');
create type public.statement_import_status as enum ('uploaded', 'mapped', 'validated', 'has_errors', 'committed', 'cancelled', 'rolled_back');
create type public.statement_line_match_status as enum ('unmatched', 'suggested', 'matched', 'partially_matched', 'ignored', 'duplicate', 'reversed');
create type public.cash_count_status as enum ('draft', 'submitted', 'verified', 'variance_found', 'approved', 'closed');
create type public.cashup_status as enum ('draft', 'submitted', 'under_review', 'approved', 'closed', 'reopened');

alter table public.finance_accounts
  drop constraint if exists finance_accounts_account_type_check;

alter table public.finance_accounts
  add column if not exists institution_or_provider text,
  add column if not exists bank_branch text,
  add column if not exists bank_account_name text,
  add column if not exists mobile_money_number text,
  add column if not exists merchant_identifier text,
  add column if not exists default_status text not null default 'active',
  add column if not exists opening_balance_date date,
  add column if not exists minimum_balance numeric(18, 2),
  add column if not exists maximum_transaction_limit numeric(18, 2),
  add column if not exists daily_transaction_limit numeric(18, 2),
  add column if not exists approval_threshold numeric(18, 2),
  add column if not exists allow_negative_balance boolean not null default false,
  add column if not exists linked_gl_account_placeholder text,
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists swift_code text,
  add column if not exists statement_frequency text,
  add column if not exists reconciliation_start_date date,
  add column if not exists cheque_book_enabled boolean not null default false,
  add column if not exists online_banking_reference_placeholder text,
  add column if not exists settlement_finance_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists statement_import_format text,
  add column if not exists transaction_fee_rules jsonb not null default '{}'::jsonb,
  add column if not exists shortcode_configuration_reference text,
  add column if not exists callback_url_status text not null default 'not_configured',
  add column if not exists account_metadata jsonb not null default '{}'::jsonb;

alter table public.finance_accounts
  add constraint finance_accounts_account_type_check check (account_type in (
    'cash',
    'petty_cash',
    'bank',
    'mpesa',
    'mpesa_paybill',
    'mpesa_till',
    'mpesa_wallet',
    'mobile_money',
    'card_settlement',
    'cheque_clearing',
    'cash_in_transit',
    'driver_cash_custody',
    'customer_collection_clearing',
    'supplier_payment_clearing',
    'owner_current',
    'staff_advance',
    'other'
  ));

create table public.financial_account_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  finance_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  transaction_date timestamptz not null default now(),
  value_date date not null default current_date,
  transaction_type public.financial_transaction_type not null,
  direction public.financial_transaction_direction not null,
  amount numeric(18, 2) not null check (amount >= 0),
  currency text not null default 'KES',
  reference_number text,
  external_reference text,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  counterparty_type text,
  counterparty_id uuid,
  source_module text,
  source_transaction_type text,
  source_transaction_id uuid,
  description text,
  approval_status public.approval_status not null default 'posted',
  reconciliation_status public.financial_reconciliation_status not null default 'unreconciled',
  statement_line_id uuid,
  idempotency_key text,
  is_reversal boolean not null default false,
  reversal_transaction_id uuid references public.financial_account_transactions(id),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  check (not is_reversal or reversal_transaction_id is not null)
);

create table public.financial_account_balances (
  finance_account_id uuid primary key references public.finance_accounts(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  currency text not null default 'KES',
  opening_balance numeric(18, 2) not null default 0,
  total_money_in numeric(18, 2) not null default 0,
  total_money_out numeric(18, 2) not null default 0,
  current_ledger_balance numeric(18, 2) not null default 0,
  cleared_balance numeric(18, 2) not null default 0,
  unreconciled_money_in numeric(18, 2) not null default 0,
  unreconciled_money_out numeric(18, 2) not null default 0,
  available_balance numeric(18, 2) not null default 0,
  last_transaction_date timestamptz,
  last_reconciliation_date date,
  reconciliation_difference numeric(18, 2) not null default 0,
  pending_transactions integer not null default 0,
  rebuilt_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.general_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  receipt_number text not null,
  receipt_date date not null default current_date,
  finance_account_id uuid not null references public.finance_accounts(id),
  received_from text not null,
  counterparty_type text,
  counterparty_reference text,
  amount numeric(18, 2) not null check (amount >= 0),
  currency text not null default 'KES',
  payment_method_id uuid references public.payment_methods(id),
  transaction_reference text,
  receipt_category text not null,
  tax_treatment text,
  description text,
  attachment_path text,
  approval_status public.approval_status not null default 'draft',
  posted_status public.treasury_document_status not null default 'draft',
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, receipt_number)
);

create table public.general_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  payment_number text not null,
  payment_date date not null default current_date,
  finance_account_id uuid not null references public.finance_accounts(id),
  paid_to text not null,
  counterparty_type text,
  counterparty_reference text,
  amount numeric(18, 2) not null check (amount >= 0),
  currency text not null default 'KES',
  payment_method_id uuid references public.payment_methods(id),
  transaction_reference text,
  payment_category text not null,
  tax_treatment text,
  withholding_tax_status text,
  description text,
  attachment_path text,
  approval_status public.approval_status not null default 'draft',
  posted_status public.treasury_document_status not null default 'draft',
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, payment_number)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  expense_number text not null,
  expense_date date not null default current_date,
  expense_category text not null,
  payee text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  finance_account_id uuid references public.finance_accounts(id),
  payment_method_id uuid references public.payment_methods(id),
  amount numeric(18, 2) not null default 0 check (amount >= 0),
  tax_amount numeric(18, 2) not null default 0 check (tax_amount >= 0),
  withholding_tax_amount numeric(18, 2) not null default 0 check (withholding_tax_amount >= 0),
  total_paid numeric(18, 2) not null default 0 check (total_paid >= 0),
  description text,
  cost_centre_placeholder text,
  delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  related_employee_id uuid references public.profiles(id) on delete set null,
  attachment_path text,
  recurring_rule jsonb not null default '{}'::jsonb,
  split_details jsonb not null default '[]'::jsonb,
  approval_status public.approval_status not null default 'draft',
  posted_status public.treasury_document_status not null default 'draft',
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, expense_number)
);

create table public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  claim_number text not null,
  employee_user_id uuid not null references public.profiles(id),
  claim_period_start date,
  claim_period_end date,
  purpose text,
  total_claimed numeric(18, 2) not null default 0,
  total_approved numeric(18, 2) not null default 0,
  total_paid numeric(18, 2) not null default 0,
  status public.expense_claim_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  payment_reference text,
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, claim_number)
);

create table public.expense_claim_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  expense_claim_id uuid not null references public.expense_claims(id) on delete cascade,
  expense_date date not null,
  category text not null,
  description text,
  amount numeric(18, 2) not null check (amount >= 0),
  tax_amount numeric(18, 2) not null default 0,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  attachment_path text,
  approved_amount numeric(18, 2),
  rejection_reason text
);

create table public.petty_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  finance_account_id uuid not null unique references public.finance_accounts(id) on delete cascade,
  custodian_user_id uuid references public.profiles(id) on delete set null,
  float_amount numeric(18, 2) not null default 0,
  reorder_level numeric(18, 2),
  maximum_transaction_amount numeric(18, 2),
  approval_threshold numeric(18, 2),
  status public.treasury_document_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.petty_cash_vouchers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  voucher_number text not null,
  voucher_date date not null default current_date,
  payee text not null,
  purpose text not null,
  category text not null,
  amount numeric(18, 2) not null check (amount >= 0),
  receipt_path text,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  paid_by uuid references public.profiles(id),
  finance_account_id uuid not null references public.finance_accounts(id),
  status public.treasury_document_status not null default 'draft',
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_at timestamptz not null default now(),
  unique (business_id, voucher_number)
);

create table public.petty_cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  reconciliation_number text not null,
  finance_account_id uuid not null references public.finance_accounts(id),
  reconciliation_date date not null default current_date,
  opening_float numeric(18, 2) not null default 0,
  cash_received numeric(18, 2) not null default 0,
  vouchers_paid numeric(18, 2) not null default 0,
  cash_returned numeric(18, 2) not null default 0,
  expected_cash numeric(18, 2) not null default 0,
  counted_cash numeric(18, 2) not null default 0,
  variance_amount numeric(18, 2) not null default 0,
  notes text,
  status public.treasury_document_status not null default 'draft',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, reconciliation_number)
);

create table public.bank_deposits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  deposit_number text not null,
  deposit_date date not null default current_date,
  cash_account_id uuid not null references public.finance_accounts(id),
  bank_account_id uuid not null references public.finance_accounts(id),
  amount numeric(18, 2) not null check (amount >= 0),
  deposit_reference text,
  bank_slip_number text,
  deposited_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  attachment_path text,
  status public.treasury_document_status not null default 'draft',
  notes text,
  transfer_out_transaction_id uuid references public.financial_account_transactions(id),
  transfer_in_transaction_id uuid references public.financial_account_transactions(id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (business_id, deposit_number)
);

create table public.cash_withdrawals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  withdrawal_number text not null,
  bank_account_id uuid not null references public.finance_accounts(id),
  cash_account_id uuid not null references public.finance_accounts(id),
  withdrawal_date date not null default current_date,
  amount numeric(18, 2) not null check (amount >= 0),
  reference text,
  cheque_or_transaction_number text,
  withdrawn_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  attachment_path text,
  status public.treasury_document_status not null default 'draft',
  notes text,
  transfer_out_transaction_id uuid references public.financial_account_transactions(id),
  transfer_in_transaction_id uuid references public.financial_account_transactions(id),
  created_at timestamptz not null default now(),
  unique (business_id, withdrawal_number)
);

create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  transfer_number text not null,
  from_finance_account_id uuid not null references public.finance_accounts(id),
  to_finance_account_id uuid not null references public.finance_accounts(id),
  transfer_date date not null default current_date,
  amount_sent numeric(18, 2) not null check (amount_sent >= 0),
  fees numeric(18, 2) not null default 0 check (fees >= 0),
  amount_received numeric(18, 2) not null default 0 check (amount_received >= 0),
  currency text not null default 'KES',
  exchange_rate numeric(18, 8),
  reference text,
  status public.transfer_status_treasury not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  transfer_out_transaction_id uuid references public.financial_account_transactions(id),
  transfer_in_transaction_id uuid references public.financial_account_transactions(id),
  fee_transaction_id uuid references public.financial_account_transactions(id),
  created_at timestamptz not null default now(),
  unique (business_id, transfer_number),
  check (from_finance_account_id <> to_finance_account_id)
);

create table public.cheques (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  cheque_number text not null,
  bank_name text,
  bank_branch text,
  drawer_or_payee text not null,
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  amount numeric(18, 2) not null check (amount >= 0),
  cheque_date date not null,
  received_or_issued_date date not null default current_date,
  deposit_date date,
  clearance_date date,
  status public.cheque_status not null,
  related_invoice_id uuid references public.sales_invoices(id) on delete set null,
  related_bill_id uuid references public.supplier_bills(id) on delete set null,
  finance_account_id uuid references public.finance_accounts(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, cheque_number, bank_name)
);

create table public.owner_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  transaction_number text not null,
  owner_reference uuid references public.profiles(id) on delete set null,
  owner_transaction_type text not null check (owner_transaction_type in ('capital_introduced','additional_capital','owner_loan_to_business','owner_loan_repayment','owner_drawing','dividend_placeholder','owner_expense_reimbursement','business_expense_paid_personally','business_money_received_personally','owner_refund_to_business','other_approved_owner_transaction')),
  transaction_date date not null default current_date,
  amount numeric(18, 2) not null check (amount >= 0),
  currency text not null default 'KES',
  finance_account_id uuid references public.finance_accounts(id),
  related_expense_id uuid references public.expenses(id),
  related_payment_id uuid references public.general_payments(id),
  description text not null,
  attachment_path text,
  approval_status public.approval_status not null default 'draft',
  posted_status public.treasury_document_status not null default 'draft',
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, transaction_number)
);

create table public.owner_current_account_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  owner_reference uuid references public.profiles(id) on delete set null,
  transaction_type text not null,
  direction public.financial_transaction_direction not null,
  amount numeric(18, 2) not null check (amount >= 0),
  currency text not null default 'KES',
  source_transaction_id uuid,
  reference text,
  is_reversal boolean not null default false,
  reversal_reference_id uuid references public.owner_current_account_ledger(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  advance_number text not null,
  staff_user_id uuid not null references public.profiles(id),
  purpose text not null,
  date_issued date,
  amount numeric(18, 2) not null check (amount >= 0),
  finance_account_id uuid references public.finance_accounts(id),
  expected_surrender_date date,
  related_delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  status public.staff_advance_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  amount_surrendered numeric(18, 2) not null default 0,
  amount_refunded numeric(18, 2) not null default 0,
  outstanding_amount numeric(18, 2) not null default 0,
  notes text,
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, advance_number)
);

create table public.advance_surrenders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  surrender_number text not null,
  staff_advance_id uuid not null references public.staff_advances(id) on delete cascade,
  surrender_date date not null default current_date,
  expense_lines jsonb not null default '[]'::jsonb,
  cash_returned numeric(18, 2) not null default 0,
  additional_amount_payable numeric(18, 2) not null default 0,
  attachment_paths text[] not null default '{}',
  approval_status public.approval_status not null default 'draft',
  status public.treasury_document_status not null default 'draft',
  reviewed_by uuid references public.profiles(id),
  financial_transaction_id uuid references public.financial_account_transactions(id),
  created_at timestamptz not null default now(),
  unique (business_id, surrender_number)
);

create table public.statement_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  finance_account_id uuid not null references public.finance_accounts(id),
  import_type text not null check (import_type in ('bank_statement','mpesa_statement','mobile_money_statement','financial_account_opening_balances','expenses','owner_opening_balances','staff_advance_opening_balances')),
  file_name text,
  file_path text,
  file_hash text,
  column_mapping jsonb not null default '{}'::jsonb,
  status public.statement_import_status not null default 'uploaded',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  committed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, finance_account_id, file_hash)
);

create table public.statement_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  statement_import_batch_id uuid not null references public.statement_import_batches(id) on delete cascade,
  finance_account_id uuid not null references public.finance_accounts(id),
  statement_date timestamptz not null,
  value_date date,
  description text,
  reference text,
  external_reference text,
  money_in numeric(18, 2) not null default 0,
  money_out numeric(18, 2) not null default 0,
  balance_after numeric(18, 2),
  payer_or_payee text,
  phone_number text,
  raw_payload jsonb not null default '{}'::jsonb,
  match_status public.statement_line_match_status not null default 'unmatched',
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, finance_account_id, external_reference)
);

create table public.reconciliation_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  finance_account_id uuid not null references public.finance_accounts(id),
  reconciliation_number text not null,
  reconciliation_type text not null check (reconciliation_type in ('bank','mpesa','mobile_money','till','paybill','petty_cash','cash')),
  period_start date not null,
  period_end date not null,
  statement_opening_balance numeric(18, 2) not null default 0,
  statement_closing_balance numeric(18, 2) not null default 0,
  ledger_opening_balance numeric(18, 2) not null default 0,
  ledger_closing_balance numeric(18, 2) not null default 0,
  matched_amount numeric(18, 2) not null default 0,
  unreconciled_amount numeric(18, 2) not null default 0,
  difference_amount numeric(18, 2) not null default 0,
  status public.reconciliation_status not null default 'draft',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  unique (business_id, reconciliation_number)
);

create table public.reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reconciliation_session_id uuid not null references public.reconciliation_sessions(id) on delete cascade,
  statement_line_id uuid not null references public.statement_lines(id) on delete cascade,
  financial_transaction_id uuid not null references public.financial_account_transactions(id) on delete cascade,
  matched_amount numeric(18, 2) not null check (matched_amount >= 0),
  match_type text not null check (match_type in ('one_to_one','one_to_many','many_to_one','partial','manual')),
  confidence_score numeric(9, 4),
  match_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.unidentified_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  finance_account_id uuid not null references public.finance_accounts(id),
  statement_line_id uuid references public.statement_lines(id) on delete set null,
  receipt_date timestamptz not null,
  amount numeric(18, 2) not null check (amount >= 0),
  reference text,
  payer_name text,
  payer_phone text,
  statement_description text,
  temporary_classification text,
  assigned_user_id uuid references public.profiles(id),
  status text not null default 'unidentified' check (status in ('unidentified','under_review','identified','allocated','refunded','written_off_placeholder')),
  notes text,
  allocated_transaction_id uuid,
  created_at timestamptz not null default now()
);

create table public.cash_counts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  count_number text not null,
  finance_account_id uuid not null references public.finance_accounts(id),
  count_time timestamptz not null default now(),
  custodian_user_id uuid references public.profiles(id),
  denomination_breakdown jsonb not null default '{}'::jsonb,
  expected_balance numeric(18, 2) not null default 0,
  counted_balance numeric(18, 2) not null default 0,
  variance_amount numeric(18, 2) not null default 0,
  notes text,
  status public.cash_count_status not null default 'draft',
  counted_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, count_number)
);

create table public.daily_cashups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  cashup_date date not null,
  opening_cash numeric(18, 2) not null default 0,
  cash_sales numeric(18, 2) not null default 0,
  customer_receipts numeric(18, 2) not null default 0,
  route_handovers numeric(18, 2) not null default 0,
  other_receipts numeric(18, 2) not null default 0,
  cash_expenses numeric(18, 2) not null default 0,
  supplier_payments numeric(18, 2) not null default 0,
  refunds numeric(18, 2) not null default 0,
  bank_deposits numeric(18, 2) not null default 0,
  petty_cash_movements numeric(18, 2) not null default 0,
  expected_closing_cash numeric(18, 2) not null default 0,
  physical_closing_cash numeric(18, 2) not null default 0,
  variance_amount numeric(18, 2) not null default 0,
  status public.cashup_status not null default 'draft',
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, branch_id, cashup_date)
);

create table public.cashflow_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  forecast_date date not null default current_date,
  period_label text not null check (period_label in ('next_7_days','next_14_days','next_30_days','next_90_days')),
  opening_available_cash numeric(18, 2) not null default 0,
  expected_inflows numeric(18, 2) not null default 0,
  expected_outflows numeric(18, 2) not null default 0,
  forecast_closing_cash numeric(18, 2) not null default 0,
  lowest_projected_point numeric(18, 2) not null default 0,
  funding_gap numeric(18, 2) not null default 0,
  surplus numeric(18, 2) not null default 0,
  source_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.treasury_accounting_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  finance_account_id uuid references public.finance_accounts(id) on delete set null,
  counterparty_type text,
  counterparty_id uuid,
  transaction_type text not null,
  transaction_id uuid,
  transaction_date timestamptz not null default now(),
  currency text not null default 'KES',
  debit_amount numeric(18, 2) not null default 0,
  credit_amount numeric(18, 2) not null default 0,
  suggested_account_role text,
  tax_details jsonb not null default '{}'::jsonb,
  reference text,
  posting_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.treasury_import_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  statement_import_batch_id uuid not null references public.statement_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending',
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.prevent_financial_transaction_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Posted financial account transactions are immutable. Use a reversal.';
end;
$$;

create trigger financial_transactions_immutable
before update or delete on public.financial_account_transactions
for each row execute function public.prevent_financial_transaction_update();

create or replace function public.apply_financial_transaction_to_balance()
returns trigger
language plpgsql
as $$
declare
  signed_amount numeric(18, 2);
begin
  signed_amount := case
    when new.direction = 'in' then new.amount
    when new.direction = 'out' then -new.amount
    else 0
  end;

  insert into public.financial_account_balances (
    finance_account_id, business_id, branch_id, currency, opening_balance, current_ledger_balance, available_balance
  )
  select id, business_id, branch_id, currency, coalesce(opening_balance_placeholder, 0), coalesce(opening_balance_placeholder, 0), coalesce(opening_balance_placeholder, 0)
  from public.finance_accounts
  where id = new.finance_account_id
  on conflict (finance_account_id) do nothing;

  update public.financial_account_balances
  set total_money_in = total_money_in + case when new.direction = 'in' and new.transaction_type <> 'opening_balance' then new.amount else 0 end,
      total_money_out = total_money_out + case when new.direction = 'out' then new.amount else 0 end,
      current_ledger_balance = current_ledger_balance + signed_amount,
      cleared_balance = cleared_balance + case when new.reconciliation_status in ('cleared','reconciled','matched') then signed_amount else 0 end,
      unreconciled_money_in = unreconciled_money_in + case when new.direction = 'in' and new.reconciliation_status = 'unreconciled' then new.amount else 0 end,
      unreconciled_money_out = unreconciled_money_out + case when new.direction = 'out' and new.reconciliation_status = 'unreconciled' then new.amount else 0 end,
      available_balance = available_balance + signed_amount,
      last_transaction_date = greatest(coalesce(last_transaction_date, new.transaction_date), new.transaction_date),
      pending_transactions = pending_transactions + case when new.approval_status = 'pending_approval' then 1 else 0 end,
      updated_at = now()
  where finance_account_id = new.finance_account_id;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, new_value)
  values (new.business_id, new.created_by, 'financial_transaction.posted', 'finance', 'financial_account_transaction', new.id, to_jsonb(new));

  return new;
end;
$$;

create trigger financial_transactions_apply_balance
after insert on public.financial_account_transactions
for each row execute function public.apply_financial_transaction_to_balance();

create or replace function public.rebuild_financial_account_balance(target_finance_account_id uuid)
returns table(finance_account_id uuid, calculated_balance numeric, stored_balance numeric, difference numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  account_record public.finance_accounts%rowtype;
  total_in numeric(18, 2);
  total_out numeric(18, 2);
  current_balance numeric(18, 2);
  stored numeric(18, 2);
begin
  select * into account_record from public.finance_accounts where id = target_finance_account_id;
  if not found then
    raise exception 'Financial account not found.';
  end if;
  if public.current_user_business_role(account_record.business_id) <> 'owner' then
    raise exception 'Only an Owner can rebuild account balances.';
  end if;

  select
    coalesce(sum(case when direction = 'in' then amount else 0 end), 0),
    coalesce(sum(case when direction = 'out' then amount else 0 end), 0)
  into total_in, total_out
  from public.financial_account_transactions
  where financial_account_transactions.finance_account_id = target_finance_account_id;

  current_balance := coalesce(account_record.opening_balance_placeholder, 0) + total_in - total_out;
  select current_ledger_balance into stored
  from public.financial_account_balances
  where financial_account_balances.finance_account_id = target_finance_account_id;
  stored := coalesce(stored, 0);

  insert into public.financial_account_balances (
    finance_account_id, business_id, branch_id, currency, opening_balance, total_money_in, total_money_out, current_ledger_balance, available_balance, rebuilt_at
  )
  values (
    account_record.id, account_record.business_id, account_record.branch_id, account_record.currency,
    coalesce(account_record.opening_balance_placeholder, 0), total_in, total_out, current_balance, current_balance, now()
  )
  on conflict (finance_account_id) do update
    set total_money_in = excluded.total_money_in,
        total_money_out = excluded.total_money_out,
        current_ledger_balance = excluded.current_ledger_balance,
        available_balance = excluded.available_balance,
        rebuilt_at = now(),
        updated_at = now();

  return query select target_finance_account_id, current_balance, stored, current_balance - stored;
end;
$$;

create or replace function public.post_account_transfer(target_transfer_id uuid, target_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.account_transfers%rowtype;
  from_account public.finance_accounts%rowtype;
  to_account public.finance_accounts%rowtype;
begin
  select * into transfer_record from public.account_transfers where id = target_transfer_id for update;
  if not found then
    raise exception 'Transfer not found.';
  end if;
  if transfer_record.transfer_out_transaction_id is not null then
    raise exception 'Transfer has already been posted.';
  end if;
  select * into from_account from public.finance_accounts where id = transfer_record.from_finance_account_id;
  select * into to_account from public.finance_accounts where id = transfer_record.to_finance_account_id;
  if from_account.business_id <> to_account.business_id or from_account.business_id <> transfer_record.business_id then
    raise exception 'Cross-business transfers are not allowed.';
  end if;
  if from_account.currency <> to_account.currency and transfer_record.exchange_rate is null then
    raise exception 'Cross-currency transfers require an exchange rate workflow.';
  end if;
  if public.current_user_business_role(transfer_record.business_id) not in ('owner','manager') then
    raise exception 'Not authorised to post account transfer.';
  end if;

  insert into public.financial_account_transactions (
    business_id, branch_id, finance_account_id, transaction_type, direction, amount, currency,
    reference_number, source_module, source_transaction_type, source_transaction_id, description, created_by, idempotency_key
  )
  values (
    transfer_record.business_id, transfer_record.branch_id, transfer_record.from_finance_account_id, 'account_transfer_out', 'out',
    transfer_record.amount_sent, transfer_record.currency, transfer_record.transfer_number, 'finance', 'account_transfer', transfer_record.id,
    'Account transfer out', target_user_id, transfer_record.id::text || ':out'
  )
  returning id into transfer_record.transfer_out_transaction_id;

  insert into public.financial_account_transactions (
    business_id, branch_id, finance_account_id, transaction_type, direction, amount, currency,
    reference_number, source_module, source_transaction_type, source_transaction_id, description, created_by, idempotency_key
  )
  values (
    transfer_record.business_id, transfer_record.branch_id, transfer_record.to_finance_account_id, 'account_transfer_in', 'in',
    coalesce(nullif(transfer_record.amount_received, 0), transfer_record.amount_sent - transfer_record.fees), transfer_record.currency,
    transfer_record.transfer_number, 'finance', 'account_transfer', transfer_record.id,
    'Account transfer in', target_user_id, transfer_record.id::text || ':in'
  )
  returning id into transfer_record.transfer_in_transaction_id;

  if transfer_record.fees > 0 then
    insert into public.financial_account_transactions (
      business_id, branch_id, finance_account_id, transaction_type, direction, amount, currency,
      reference_number, source_module, source_transaction_type, source_transaction_id, description, created_by, idempotency_key
    )
    values (
      transfer_record.business_id, transfer_record.branch_id, transfer_record.from_finance_account_id, 'bank_charge', 'out',
      transfer_record.fees, transfer_record.currency, transfer_record.transfer_number, 'finance', 'account_transfer_fee', transfer_record.id,
      'Transfer fee', target_user_id, transfer_record.id::text || ':fee'
    )
    returning id into transfer_record.fee_transaction_id;
  end if;

  update public.account_transfers
  set status = 'received',
      transfer_out_transaction_id = transfer_record.transfer_out_transaction_id,
      transfer_in_transaction_id = transfer_record.transfer_in_transaction_id,
      fee_transaction_id = transfer_record.fee_transaction_id,
      confirmed_by = target_user_id
  where id = target_transfer_id;
end;
$$;

create index finance_accounts_business_branch_idx on public.finance_accounts(business_id, branch_id, account_type, active);
create index financial_transactions_account_date_idx on public.financial_account_transactions(business_id, finance_account_id, transaction_date desc);
create index financial_transactions_reference_idx on public.financial_account_transactions(business_id, reference_number, external_reference);
create index financial_transactions_reconciliation_idx on public.financial_account_transactions(business_id, finance_account_id, reconciliation_status);
create index receipts_business_date_idx on public.general_receipts(business_id, branch_id, receipt_date desc, posted_status);
create index payments_business_date_idx on public.general_payments(business_id, branch_id, payment_date desc, posted_status);
create index expenses_business_date_idx on public.expenses(business_id, branch_id, expense_date desc, approval_status);
create index expense_claims_employee_idx on public.expense_claims(business_id, employee_user_id, status);
create index transfers_business_date_idx on public.account_transfers(business_id, transfer_date desc, status);
create index cheques_business_status_idx on public.cheques(business_id, status, cheque_date);
create index owner_transactions_business_idx on public.owner_transactions(business_id, owner_transaction_type, transaction_date desc);
create index staff_advances_business_status_idx on public.staff_advances(business_id, staff_user_id, status);
create index statement_lines_account_idx on public.statement_lines(business_id, finance_account_id, statement_date desc, match_status);
create index reconciliation_sessions_account_idx on public.reconciliation_sessions(business_id, finance_account_id, period_end desc, status);
create index unidentified_receipts_account_idx on public.unidentified_receipts(business_id, finance_account_id, status, receipt_date desc);
create index cash_counts_account_idx on public.cash_counts(business_id, finance_account_id, count_time desc);

alter table public.financial_account_transactions enable row level security;
alter table public.financial_account_balances enable row level security;
alter table public.general_receipts enable row level security;
alter table public.general_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_claims enable row level security;
alter table public.expense_claim_lines enable row level security;
alter table public.petty_cash_accounts enable row level security;
alter table public.petty_cash_vouchers enable row level security;
alter table public.petty_cash_reconciliations enable row level security;
alter table public.bank_deposits enable row level security;
alter table public.cash_withdrawals enable row level security;
alter table public.account_transfers enable row level security;
alter table public.cheques enable row level security;
alter table public.owner_transactions enable row level security;
alter table public.owner_current_account_ledger enable row level security;
alter table public.staff_advances enable row level security;
alter table public.advance_surrenders enable row level security;
alter table public.statement_import_batches enable row level security;
alter table public.statement_lines enable row level security;
alter table public.reconciliation_sessions enable row level security;
alter table public.reconciliation_matches enable row level security;
alter table public.unidentified_receipts enable row level security;
alter table public.cash_counts enable row level security;
alter table public.daily_cashups enable row level security;
alter table public.cashflow_forecast_snapshots enable row level security;
alter table public.treasury_accounting_events enable row level security;
alter table public.treasury_import_rows enable row level security;

create policy finance_accounts_member_read on public.finance_accounts
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy finance_accounts_owner_manager_write on public.finance_accounts
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));

create policy finance_ledger_member_read on public.financial_account_transactions
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy finance_ledger_manager_insert on public.financial_account_transactions
  for insert with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));

create policy finance_balances_member_read on public.financial_account_balances
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));

create policy treasury_docs_member_read on public.general_receipts
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy treasury_docs_write on public.general_receipts
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy general_payments_member_read on public.general_payments
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy general_payments_write on public.general_payments
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy expenses_member_read on public.expenses
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy expenses_write on public.expenses
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy expense_claims_read on public.expense_claims
  for select using ((public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) or employee_user_id = auth.uid());
create policy expense_claims_write on public.expense_claims
  for all using ((employee_user_id = auth.uid()) or public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy expense_claim_lines_read on public.expense_claim_lines
  for select using (public.current_user_has_business_access(business_id));
create policy expense_claim_lines_write on public.expense_claim_lines
  for all using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy petty_cash_read on public.petty_cash_accounts
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy petty_cash_write on public.petty_cash_accounts
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy petty_vouchers_read on public.petty_cash_vouchers
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy petty_vouchers_write on public.petty_cash_vouchers
  for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy petty_recons_read on public.petty_cash_reconciliations
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy petty_recons_write on public.petty_cash_reconciliations
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy bank_deposits_read on public.bank_deposits for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy bank_deposits_write on public.bank_deposits for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy withdrawals_read on public.cash_withdrawals for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy withdrawals_write on public.cash_withdrawals for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy transfers_read on public.account_transfers for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy transfers_write on public.account_transfers for all using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id))) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));

create policy cheques_read on public.cheques for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy cheques_write on public.cheques for all using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id))) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));

create policy owner_transactions_owner_read on public.owner_transactions for select using (public.current_user_business_role(business_id) = 'owner');
create policy owner_transactions_owner_write on public.owner_transactions for all using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy owner_ledger_owner_read on public.owner_current_account_ledger for select using (public.current_user_business_role(business_id) = 'owner');
create policy owner_ledger_owner_insert on public.owner_current_account_ledger for insert with check (public.current_user_business_role(business_id) = 'owner');

create policy staff_advances_read on public.staff_advances
  for select using ((public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) or staff_user_id = auth.uid());
create policy staff_advances_write on public.staff_advances
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy advance_surrenders_read on public.advance_surrenders for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy advance_surrenders_write on public.advance_surrenders for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy statement_imports_read on public.statement_import_batches for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy statement_imports_write on public.statement_import_batches for all using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id))) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy statement_lines_read on public.statement_lines for select using (public.current_user_has_business_access(business_id));
create policy statement_lines_write on public.statement_lines for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy treasury_import_rows_read on public.treasury_import_rows for select using (public.current_user_has_business_access(business_id));
create policy treasury_import_rows_write on public.treasury_import_rows for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy reconciliations_read on public.reconciliation_sessions for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy reconciliations_write on public.reconciliation_sessions for all using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id))) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy reconciliation_matches_read on public.reconciliation_matches for select using (public.current_user_has_business_access(business_id));
create policy reconciliation_matches_write on public.reconciliation_matches for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy unidentified_receipts_read on public.unidentified_receipts for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy unidentified_receipts_write on public.unidentified_receipts for all using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id))) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));

create policy cash_counts_read on public.cash_counts for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy cash_counts_write on public.cash_counts for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy daily_cashups_read on public.daily_cashups for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy daily_cashups_write on public.daily_cashups for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy forecasts_read on public.cashflow_forecast_snapshots for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy forecasts_owner_write on public.cashflow_forecast_snapshots for insert with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy treasury_accounting_owner_read on public.treasury_accounting_events for select using (public.current_user_business_role(business_id) = 'owner');
create policy treasury_accounting_owner_insert on public.treasury_accounting_events for insert with check (public.current_user_business_role(business_id) = 'owner');

grant select, insert, update, delete on
  public.financial_account_transactions,
  public.financial_account_balances,
  public.general_receipts,
  public.general_payments,
  public.expenses,
  public.expense_claims,
  public.expense_claim_lines,
  public.petty_cash_accounts,
  public.petty_cash_vouchers,
  public.petty_cash_reconciliations,
  public.bank_deposits,
  public.cash_withdrawals,
  public.account_transfers,
  public.cheques,
  public.owner_transactions,
  public.owner_current_account_ledger,
  public.staff_advances,
  public.advance_surrenders,
  public.statement_import_batches,
  public.statement_lines,
  public.reconciliation_sessions,
  public.reconciliation_matches,
  public.unidentified_receipts,
  public.cash_counts,
  public.daily_cashups,
  public.cashflow_forecast_snapshots,
  public.treasury_accounting_events,
  public.treasury_import_rows
to authenticated;

revoke execute on function public.prevent_financial_transaction_update() from public;
revoke execute on function public.apply_financial_transaction_to_balance() from public;
revoke execute on function public.rebuild_financial_account_balance(uuid) from public;
revoke execute on function public.post_account_transfer(uuid, uuid) from public;
grant execute on function public.rebuild_financial_account_balance(uuid) to authenticated;
grant execute on function public.post_account_transfer(uuid, uuid) to authenticated;
