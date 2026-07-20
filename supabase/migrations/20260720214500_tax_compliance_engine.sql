create type public.tax_type as enum (
  'vat',
  'withholding_tax',
  'withholding_vat',
  'turnover_tax',
  'excise_duty',
  'railway_development_levy',
  'import_declaration_fee',
  'affordable_housing_levy',
  'other_levy',
  'custom_tax'
);

create type public.tax_document_category as enum (
  'tax_invoice',
  'simplified_invoice',
  'cash_sale_receipt',
  'export_invoice',
  'exempt_supply_invoice',
  'credit_note',
  'debit_note',
  'pro_forma',
  'delivery_note',
  'quotation',
  'purchase_tax_document',
  'withholding_certificate',
  'tax_payment',
  'tax_refund'
);

create type public.external_submission_status as enum (
  'not_required',
  'pending',
  'queued',
  'submitting',
  'submitted',
  'acknowledged',
  'accepted',
  'rejected',
  'failed',
  'retry_scheduled',
  'needs_review',
  'cancelled',
  'adjusted',
  'duplicate_prevented'
);

create type public.tax_period_status as enum ('future','open','soft_closed','closed','reopened');
create type public.tax_return_status as enum ('draft','prepared','under_review','approved','filed','paid','superseded','cancelled');

alter table public.products
  add column if not exists default_sales_vat_code text,
  add column if not exists default_purchase_vat_code text,
  add column if not exists tax_classification text,
  add column if not exists etims_item_classification_code text,
  add column if not exists external_uom_code text,
  add column if not exists excise_category text,
  add column if not exists tax_exemption_reference text;

alter table public.customers
  add column if not exists legal_name text,
  add column if not exists tax_trading_name text,
  add column if not exists kra_pin text,
  add column if not exists vat_registration_status text not null default 'unknown',
  add column if not exists taxpayer_type text,
  add column if not exists tax_jurisdiction text not null default 'KE',
  add column if not exists export_customer boolean not null default false,
  add column if not exists tax_exempt boolean not null default false,
  add column if not exists exemption_certificate_reference text,
  add column if not exists withholding_agent boolean not null default false,
  add column if not exists government_or_special_customer boolean not null default false,
  add column if not exists default_invoice_tax_treatment text,
  add column if not exists etims_buyer_identifier text,
  add column if not exists tax_identity_source text not null default 'manual',
  add column if not exists tax_verification_status text not null default 'unverified',
  add column if not exists tax_last_verified_at timestamptz,
  add column if not exists tax_notes text;

alter table public.suppliers
  add column if not exists legal_name text,
  add column if not exists tax_trading_name text,
  add column if not exists kra_pin text,
  add column if not exists vat_registration_status text not null default 'unknown',
  add column if not exists withholding_tax_applicable boolean not null default false,
  add column if not exists withholding_vat_applicable boolean not null default false,
  add column if not exists taxpayer_type text,
  add column if not exists residency_status text not null default 'resident',
  add column if not exists tax_jurisdiction text not null default 'KE',
  add column if not exists tax_exempt boolean not null default false,
  add column if not exists exemption_reference text,
  add column if not exists default_withholding_code text,
  add column if not exists default_purchase_vat_treatment text,
  add column if not exists etims_supplier_identifier text,
  add column if not exists tax_verification_status text not null default 'unverified',
  add column if not exists tax_last_verified_at timestamptz,
  add column if not exists tax_notes text;

create table public.business_tax_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  legal_business_name text not null,
  trading_name text not null,
  kra_pin text,
  vat_registration_number text,
  taxpayer_type text not null default 'other' check (taxpayer_type in ('sole_proprietor','partnership','limited_company','cooperative','non_profit','trust','branch','other')),
  business_registration_number text,
  country text not null default 'Kenya',
  county text,
  postal_address text,
  physical_address text,
  email text,
  telephone text,
  primary_business_activity text,
  tax_registration_status text not null default 'unknown',
  vat_registered boolean not null default false,
  vat_effective_date date,
  vat_deregistration_date date,
  etims_registration_status text not null default 'not_configured',
  etims_taxpayer_type text,
  etims_branch_identifier text,
  tax_invoice_enabled boolean not null default false,
  withholding_tax_obligation boolean not null default false,
  withholding_vat_obligation boolean not null default false,
  turnover_tax_status text not null default 'not_applicable',
  excise_registration_status text not null default 'not_applicable',
  digital_service_tax_flags jsonb not null default '{}'::jsonb,
  tax_representative text,
  tax_contact text,
  tax_filing_frequency text not null default 'monthly',
  default_tax_currency text not null default 'KES',
  tax_jurisdiction text not null default 'KE',
  last_verified_at timestamptz,
  verification_status text not null default 'unverified',
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vat_deregistration_date is null or vat_effective_date is null or vat_deregistration_date >= vat_effective_date)
);

create table public.branch_tax_configurations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  tax_outlet_name text not null,
  external_branch_identifier text,
  location_code text,
  device_or_integration_identifier text,
  default_invoice_series text,
  default_credit_note_series text,
  default_debit_note_series text,
  default_receipt_series text,
  active boolean not null default true,
  effective_date date not null default current_date,
  end_date date,
  submission_mode text not null default 'manual' check (submission_mode in ('on_posting','on_payment','approval','scheduled_batch','manual','offline_queue')),
  responsible_user_id uuid references public.profiles(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, branch_id, effective_date),
  check (end_date is null or end_date >= effective_date)
);

create unique index branch_tax_external_identifier_unique
  on public.branch_tax_configurations(business_id, external_branch_identifier)
  where active = true and external_branch_identifier is not null;

create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  tax_jurisdiction text not null default 'KE',
  tax_type public.tax_type not null,
  tax_code text not null,
  name text not null,
  description text,
  rate numeric(9, 4) not null default 0 check (rate >= 0),
  calculation_basis text not null default 'taxable_amount' check (calculation_basis in ('taxable_amount','gross_amount','payment_amount','quantity','custom')),
  price_behavior text not null default 'exclusive' check (price_behavior in ('inclusive','exclusive','not_applicable')),
  recoverable boolean not null default false,
  payable boolean not null default true,
  effective_start_date date not null,
  effective_end_date date,
  minimum_threshold numeric(18, 4),
  maximum_threshold numeric(18, 4),
  rounding_rule text not null default 'nearest_cent' check (rounding_rule in ('nearest_cent','nearest_shilling','round_down','round_up')),
  filing_category text,
  external_tax_code text,
  active boolean not null default true,
  system_rule boolean not null default false,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, tax_jurisdiction, tax_type, tax_code, effective_start_date),
  check (effective_end_date is null or effective_end_date >= effective_start_date),
  check (maximum_threshold is null or minimum_threshold is null or maximum_threshold >= minimum_threshold)
);

create table public.vat_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  vat_code text not null,
  name text not null,
  rate numeric(9, 4) not null default 0 check (rate >= 0),
  applies_to_sales boolean not null default true,
  applies_to_purchases boolean not null default true,
  recoverable_percentage numeric(9, 4) not null default 100 check (recoverable_percentage between 0 and 100),
  output_vat_account_id uuid references public.chart_of_accounts(id) on delete set null,
  input_vat_account_id uuid references public.chart_of_accounts(id) on delete set null,
  vat_payable_account_id uuid references public.chart_of_accounts(id) on delete set null,
  etims_tax_category_code text,
  effective_start_date date not null,
  effective_end_date date,
  active boolean not null default true,
  evidence_requirement text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, vat_code, effective_start_date),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create table public.product_tax_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  product_category_id uuid references public.product_categories(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sales_vat_code_id uuid references public.vat_codes(id) on delete restrict,
  purchase_vat_code_id uuid references public.vat_codes(id) on delete restrict,
  tax_classification text,
  etims_item_classification_code text,
  external_uom_code text,
  excise_rule_id uuid references public.tax_rules(id) on delete set null,
  exemption_reference text,
  precedence integer not null default 100,
  active boolean not null default true,
  effective_start_date date not null default current_date,
  effective_end_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (product_id is not null or product_category_id is not null),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create table public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  tax_type public.tax_type not null,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  filing_due_date date,
  payment_due_date date,
  status public.tax_period_status not null default 'future',
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  reopening_reason text,
  notes text,
  created_at timestamptz not null default now(),
  unique (business_id, tax_type, start_date, end_date),
  check (end_date >= start_date)
);

create table public.tax_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tax_period_id uuid references public.tax_periods(id) on delete set null,
  document_category public.tax_document_category not null,
  source_module text not null,
  source_document_type text not null,
  source_document_id uuid not null,
  source_document_number text not null,
  original_document_id uuid references public.tax_documents(id) on delete set null,
  document_version integer not null default 1,
  tax_date date not null,
  posting_date date,
  currency text not null default 'KES',
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  seller_pin text,
  buyer_pin text,
  supplier_pin text,
  taxable_amount numeric(18, 4) not null default 0 check (taxable_amount >= 0),
  exempt_amount numeric(18, 4) not null default 0 check (exempt_amount >= 0),
  zero_rated_amount numeric(18, 4) not null default 0 check (zero_rated_amount >= 0),
  out_of_scope_amount numeric(18, 4) not null default 0 check (out_of_scope_amount >= 0),
  vat_amount numeric(18, 4) not null default 0 check (vat_amount >= 0),
  gross_amount numeric(18, 4) not null default 0 check (gross_amount >= 0),
  withholding_tax_amount numeric(18, 4) not null default 0 check (withholding_tax_amount >= 0),
  withholding_vat_amount numeric(18, 4) not null default 0 check (withholding_vat_amount >= 0),
  status text not null default 'draft' check (status in ('draft','posted','approved','cancelled','reversed','adjusted')),
  tax_rule_snapshot jsonb not null default '{}'::jsonb,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (business_id, source_document_type, source_document_id, document_version),
  check (vat_amount <= gross_amount)
);

create table public.tax_document_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  tax_document_id uuid not null references public.tax_documents(id) on delete cascade,
  source_line_id uuid,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(18, 4) not null default 1 check (quantity >= 0),
  unit_code text,
  unit_price numeric(18, 4) not null default 0 check (unit_price >= 0),
  gross_line_amount numeric(18, 4) not null default 0 check (gross_line_amount >= 0),
  discount_amount numeric(18, 4) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(18, 4) not null default 0 check (taxable_amount >= 0),
  vat_code_id uuid references public.vat_codes(id) on delete restrict,
  vat_rate numeric(9, 4) not null default 0 check (vat_rate >= 0),
  vat_amount numeric(18, 4) not null default 0 check (vat_amount >= 0),
  net_amount numeric(18, 4) not null default 0 check (net_amount >= 0),
  tax_inclusive boolean not null default false,
  tax_rule_id uuid references public.tax_rules(id) on delete set null,
  tax_rule_version jsonb not null default '{}'::jsonb,
  rounding_adjustment numeric(18, 4) not null default 0,
  external_tax_category text,
  resolved_rule_source text not null default 'business_default',
  created_at timestamptz not null default now()
);

create table public.tax_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tax_period_id uuid references public.tax_periods(id) on delete set null,
  tax_document_id uuid references public.tax_documents(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  tax_type public.tax_type not null,
  tax_code text not null,
  direction text not null check (direction in ('payable','recoverable','credit','payment','refund','non_recoverable','withheld')),
  source_module text not null,
  source_document_type text not null,
  source_document_id uuid not null,
  tax_date date not null,
  taxable_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  recoverable_amount numeric(18, 4) not null default 0,
  non_recoverable_amount numeric(18, 4) not null default 0,
  currency text not null default 'KES',
  tax_rule_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'posted' check (status in ('draft','posted','reversed','adjusted','disallowed')),
  created_at timestamptz not null default now()
);

create table public.tax_integration_configurations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  provider text not null default 'manual_tracking',
  environment text not null default 'disabled' check (environment in ('disabled','test','sandbox','production')),
  integration_mode text not null default 'online_portal_manual_tracking' check (integration_mode in ('direct_api','middleware','virtual_sales_control_unit','online_portal_manual_tracking','offline_export','other')),
  taxpayer_identifier text,
  branch_identifier text,
  device_identifier text,
  credential_reference text,
  certificate_reference text,
  callback_configuration jsonb not null default '{}'::jsonb,
  last_successful_connection_at timestamptz,
  last_failed_connection_at timestamptz,
  integration_status text not null default 'not_configured',
  active boolean not null default false,
  adapter_version text not null default 'manual-v1',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.external_tax_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tax_document_id uuid references public.tax_documents(id) on delete set null,
  source_document_type text not null,
  source_document_id uuid not null,
  source_document_number text not null,
  document_category public.tax_document_category not null,
  original_document_reference text,
  internal_posting_date date,
  tax_date date not null,
  submission_status public.external_submission_status not null default 'pending',
  submission_mode text not null default 'manual',
  external_request_id text,
  external_document_number text,
  external_receipt_number text,
  control_unit_invoice_number text,
  signature_or_verification_value text,
  qr_data_reference text,
  submitted_payload_hash text,
  response_payload_hash text,
  last_submission_at timestamptz,
  acknowledgement_at timestamptz,
  retry_count integer not null default 0,
  error_code text,
  error_message text,
  cancellation_or_adjustment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, source_document_type, source_document_id, submitted_payload_hash),
  unique (business_id, external_request_id)
);

create table public.etims_submission_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  external_tax_document_id uuid not null references public.external_tax_documents(id) on delete cascade,
  idempotency_key text not null,
  provider text not null,
  environment text not null,
  payload_schema_version text not null default 'ke-etims-canonical-v1',
  canonical_payload jsonb not null,
  payload_hash text not null,
  status public.external_submission_status not null default 'queued',
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  safe_to_retry boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  unique (business_id, payload_hash)
);

create table public.etims_payload_schemas (
  id uuid primary key default gen_random_uuid(),
  payload_schema_version text not null unique,
  provider text not null,
  provider_version text,
  effective_start_date date not null,
  effective_end_date date,
  migration_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create table public.etims_error_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  external_tax_document_id uuid references public.external_tax_documents(id) on delete cascade,
  queue_id uuid references public.etims_submission_queue(id) on delete set null,
  error_class text not null check (error_class in ('authentication','configuration','validation','missing_buyer_information','invalid_tax_code','invalid_item_classification','invalid_unit','duplicate_document','network','timeout','provider_unavailable','rejected_document','unknown_response','internal_system_error')),
  plain_language_message text not null,
  technical_detail text,
  suggested_action text not null,
  retry_safe boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.withholding_certificates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  tax_period_id uuid references public.tax_periods(id) on delete set null,
  certificate_type text not null check (certificate_type in ('withholding_tax','withholding_vat')),
  certificate_number text,
  gross_amount numeric(18, 4) not null default 0 check (gross_amount >= 0),
  rate numeric(9, 4) not null default 0 check (rate >= 0),
  tax_withheld numeric(18, 4) not null default 0 check (tax_withheld >= 0),
  payment_date date,
  filing_period text,
  status text not null default 'pending' check (status in ('pending','recorded','verified','filed','cancelled')),
  evidence_path text,
  created_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, certificate_type, certificate_number)
);

create table public.tax_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  tax_type public.tax_type not null,
  return_number text,
  output_tax numeric(18, 4) not null default 0,
  input_tax numeric(18, 4) not null default 0,
  recoverable_input_tax numeric(18, 4) not null default 0,
  non_recoverable_input_tax numeric(18, 4) not null default 0,
  withholding_tax numeric(18, 4) not null default 0,
  tax_payable numeric(18, 4) not null default 0,
  tax_credit numeric(18, 4) not null default 0,
  validation_summary jsonb not null default '{}'::jsonb,
  export_version integer not null default 1,
  status public.tax_return_status not null default 'draft',
  prepared_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  filed_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  filed_at timestamptz,
  filing_reference text,
  superseded_by uuid references public.tax_returns(id) on delete set null,
  unique (business_id, tax_period_id, tax_type, export_version)
);

create table public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tax_period_id uuid references public.tax_periods(id) on delete set null,
  tax_return_id uuid references public.tax_returns(id) on delete set null,
  tax_type public.tax_type not null,
  payment_date date not null,
  amount numeric(18, 4) not null check (amount > 0),
  payment_reference text not null,
  finance_account_id uuid references public.finance_accounts(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  status text not null default 'recorded' check (status in ('recorded','posted','reversed','cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, payment_reference)
);

create table public.tax_compliance_calendar (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tax_period_id uuid references public.tax_periods(id) on delete cascade,
  obligation_type text not null check (obligation_type in ('filing','payment','certificate','reconciliation','review','other')),
  title text not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','overdue','waived','cancelled')),
  assigned_to uuid references public.profiles(id),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.tax_audit_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  evidence_type text not null,
  file_name text,
  file_path text,
  content_type text,
  file_size_bytes bigint check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 10485760)),
  evidence_payload jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table public.tax_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_type text not null check (import_type in ('vat_opening_balances','historical_sales_tax_documents','historical_purchase_tax_documents','withholding_opening_records','withholding_certificates','external_etims_status_updates','tax_payment_history','tax_filing_history','tax_rules','product_tax_mappings')),
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

create table public.tax_import_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_batch_id uuid not null references public.tax_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  validation_errors jsonb not null default '[]'::jsonb,
  preview_data jsonb not null default '{}'::jsonb,
  committed_entity_type text,
  committed_entity_id uuid,
  created_at timestamptz not null default now(),
  unique (import_batch_id, row_number)
);

create table public.tax_audit_trail (
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

insert into public.etims_payload_schemas (payload_schema_version, provider, provider_version, effective_start_date, migration_notes)
values ('ke-etims-canonical-v1', 'canonical', 'v1', current_date, 'Provider-neutral canonical payload foundation. Verify current KRA/eTIMS provider specifications before production use.')
on conflict (payload_schema_version) do nothing;

insert into public.tax_rules (business_id, tax_jurisdiction, tax_type, tax_code, name, rate, calculation_basis, price_behavior, recoverable, payable, effective_start_date, filing_category, external_tax_code, system_rule)
values
  (null, 'KE', 'vat', 'VAT_STD', 'VAT Standard Rated', 16.0000, 'taxable_amount', 'exclusive', true, true, current_date, 'vat_return', 'A', true),
  (null, 'KE', 'vat', 'VAT_ZERO', 'VAT Zero Rated', 0.0000, 'taxable_amount', 'exclusive', true, false, current_date, 'vat_return', 'B', true),
  (null, 'KE', 'vat', 'VAT_EXEMPT', 'VAT Exempt', 0.0000, 'taxable_amount', 'not_applicable', false, false, current_date, 'vat_return', 'C', true),
  (null, 'KE', 'vat', 'VAT_OUT_OF_SCOPE', 'VAT Out of Scope', 0.0000, 'taxable_amount', 'not_applicable', false, false, current_date, 'vat_return', 'OS', true),
  (null, 'KE', 'withholding_tax', 'WHT_DEFAULT', 'Withholding Tax foundation', 0.0000, 'payment_amount', 'not_applicable', false, true, current_date, 'withholding_return', 'WHT', true),
  (null, 'KE', 'withholding_vat', 'WHVAT_DEFAULT', 'Withholding VAT foundation', 0.0000, 'payment_amount', 'not_applicable', true, true, current_date, 'withholding_vat_return', 'WHVAT', true)
on conflict (business_id, tax_jurisdiction, tax_type, tax_code, effective_start_date) do nothing;

insert into public.vat_codes (business_id, vat_code, name, rate, applies_to_sales, applies_to_purchases, recoverable_percentage, etims_tax_category_code, effective_start_date, evidence_requirement)
values
  (null, 'VAT_STD', 'Standard Rated', 16.0000, true, true, 100, 'A', current_date, 'ordinary_tax_invoice'),
  (null, 'VAT_ZERO', 'Zero Rated', 0.0000, true, true, 100, 'B', current_date, 'zero_rate_support'),
  (null, 'VAT_EXEMPT', 'Exempt', 0.0000, true, true, 0, 'C', current_date, 'exemption_support'),
  (null, 'VAT_OUT_OF_SCOPE', 'Out of Scope', 0.0000, true, true, 0, 'OS', current_date, 'scope_support'),
  (null, 'VAT_NON_RECOVERABLE', 'Non-Recoverable Input VAT', 16.0000, false, true, 0, 'A', current_date, 'supplier_tax_document'),
  (null, 'VAT_PARTIAL', 'Partially Recoverable Input VAT', 16.0000, false, true, 50, 'A', current_date, 'eligibility_review')
on conflict (business_id, vat_code, effective_start_date) do nothing;

create or replace function public.prevent_tax_rule_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.tax_rules tr
    where tr.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and tr.active = true
      and new.active = true
      and tr.business_id is not distinct from new.business_id
      and tr.tax_jurisdiction = new.tax_jurisdiction
      and tr.tax_type = new.tax_type
      and tr.tax_code = new.tax_code
      and daterange(tr.effective_start_date, coalesce(tr.effective_end_date, 'infinity'::date), '[]')
          && daterange(new.effective_start_date, coalesce(new.effective_end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'Overlapping active tax rule for this code and jurisdiction.';
  end if;
  return new;
end;
$$;

create trigger tax_rules_no_overlap
before insert or update on public.tax_rules
for each row execute function public.prevent_tax_rule_overlap();

create or replace function public.prevent_vat_code_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.vat_codes vc
    where vc.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and vc.active = true
      and new.active = true
      and vc.business_id is not distinct from new.business_id
      and vc.vat_code = new.vat_code
      and daterange(vc.effective_start_date, coalesce(vc.effective_end_date, 'infinity'::date), '[]')
          && daterange(new.effective_start_date, coalesce(new.effective_end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'Overlapping active VAT code.';
  end if;
  return new;
end;
$$;

create trigger vat_codes_no_overlap
before insert or update on public.vat_codes
for each row execute function public.prevent_vat_code_overlap();

create or replace function public.prevent_accepted_external_document_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.submission_status in ('acknowledged','accepted') then
    raise exception 'Accepted external tax documents are immutable. Create an adjustment.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger external_tax_documents_accepted_guard
before update or delete on public.external_tax_documents
for each row execute function public.prevent_accepted_external_document_mutation();

create or replace function public.prevent_closed_tax_period_mutation()
returns trigger
language plpgsql
as $$
declare
  period_status public.tax_period_status;
begin
  if new.tax_period_id is null then
    return new;
  end if;
  select status into period_status from public.tax_periods where id = new.tax_period_id;
  if period_status = 'closed' then
    raise exception 'Cannot mutate tax documents or ledgers in a closed tax period.';
  end if;
  return new;
end;
$$;

create trigger tax_documents_closed_period_guard
before insert or update on public.tax_documents
for each row execute function public.prevent_closed_tax_period_mutation();

create trigger tax_ledger_closed_period_guard
before insert or update on public.tax_ledger_entries
for each row execute function public.prevent_closed_tax_period_mutation();

create or replace function public.calculate_vat_amount(taxable_amount numeric, vat_rate numeric, tax_inclusive boolean, rounding_rule text default 'nearest_cent')
returns table(net_amount numeric, vat_amount numeric, gross_amount numeric)
language plpgsql
stable
as $$
declare
  raw_net numeric;
  raw_vat numeric;
begin
  if taxable_amount < 0 or vat_rate < 0 then
    raise exception 'Taxable amount and VAT rate cannot be negative.';
  end if;
  if tax_inclusive then
    raw_net := taxable_amount / (1 + (vat_rate / 100));
    raw_vat := taxable_amount - raw_net;
    gross_amount := taxable_amount;
  else
    raw_net := taxable_amount;
    raw_vat := taxable_amount * vat_rate / 100;
    gross_amount := taxable_amount + raw_vat;
  end if;

  if rounding_rule = 'nearest_shilling' then
    net_amount := round(raw_net, 0);
    vat_amount := round(raw_vat, 0);
    gross_amount := round(gross_amount, 0);
  elsif rounding_rule = 'round_down' then
    net_amount := trunc(raw_net, 2);
    vat_amount := trunc(raw_vat, 2);
    gross_amount := trunc(gross_amount, 2);
  elsif rounding_rule = 'round_up' then
    net_amount := ceil(raw_net * 100) / 100;
    vat_amount := ceil(raw_vat * 100) / 100;
    gross_amount := ceil(gross_amount * 100) / 100;
  else
    net_amount := round(raw_net, 2);
    vat_amount := round(raw_vat, 2);
    gross_amount := round(gross_amount, 2);
  end if;
  return next;
end;
$$;

create or replace view public.tax_integration_health
with (security_invoker = true)
as
select
  tic.business_id,
  tic.branch_id,
  tic.provider,
  tic.environment,
  tic.integration_status,
  case when tic.credential_reference is null then 'missing_reference' else 'reference_configured' end as credential_status,
  tic.last_successful_connection_at,
  tic.last_failed_connection_at,
  count(q.id) filter (where q.status in ('queued','retry_scheduled','pending')) as pending_queue_size,
  count(q.id) filter (where q.status in ('failed','needs_review','rejected')) as failed_queue_size,
  min(q.created_at) filter (where q.status in ('queued','retry_scheduled','pending')) as oldest_pending_document,
  tic.adapter_version
from public.tax_integration_configurations tic
left join public.etims_submission_queue q on q.business_id = tic.business_id and (q.branch_id is not distinct from tic.branch_id)
group by tic.business_id, tic.branch_id, tic.provider, tic.environment, tic.integration_status, tic.credential_reference, tic.last_successful_connection_at, tic.last_failed_connection_at, tic.adapter_version;

create or replace view public.vat_return_preparation
with (security_invoker = true)
as
select
  tle.business_id,
  tle.branch_id,
  tle.tax_period_id,
  sum(tle.tax_amount) filter (where tle.tax_type = 'vat' and tle.direction = 'payable') as output_vat,
  sum(tle.recoverable_amount) filter (where tle.tax_type = 'vat' and tle.direction = 'recoverable') as recoverable_input_vat,
  sum(tle.non_recoverable_amount) filter (where tle.tax_type = 'vat') as non_recoverable_vat,
  coalesce(sum(tle.tax_amount) filter (where tle.tax_type = 'vat' and tle.direction = 'payable'), 0)
    - coalesce(sum(tle.recoverable_amount) filter (where tle.tax_type = 'vat' and tle.direction = 'recoverable'), 0) as net_vat_payable
from public.tax_ledger_entries tle
where tle.status = 'posted'
group by tle.business_id, tle.branch_id, tle.tax_period_id;

create or replace view public.withholding_return_schedule
with (security_invoker = true)
as
select
  wc.business_id,
  wc.branch_id,
  wc.tax_period_id,
  coalesce(s.kra_pin, c.kra_pin) as counterparty_pin,
  coalesce(s.legal_name, s.trading_name, c.legal_name, c.customer_name) as counterparty_name,
  wc.certificate_type,
  wc.gross_amount,
  wc.rate,
  wc.tax_withheld,
  wc.payment_date,
  wc.certificate_number,
  wc.filing_period,
  wc.status
from public.withholding_certificates wc
left join public.suppliers s on s.id = wc.supplier_id
left join public.customers c on c.id = wc.customer_id;

create index business_tax_profiles_status_idx on public.business_tax_profiles(verification_status, vat_registered);
create index branch_tax_config_business_idx on public.branch_tax_configurations(business_id, branch_id, active);
create index tax_rules_lookup_idx on public.tax_rules(business_id, tax_jurisdiction, tax_type, tax_code, effective_start_date, effective_end_date, active);
create index vat_codes_lookup_idx on public.vat_codes(business_id, vat_code, effective_start_date, effective_end_date, active);
create index tax_periods_business_idx on public.tax_periods(business_id, tax_type, start_date, end_date, status);
create index tax_documents_business_status_idx on public.tax_documents(business_id, tax_period_id, document_category, status, tax_date);
create index tax_ledger_business_period_idx on public.tax_ledger_entries(business_id, tax_period_id, tax_type, tax_code, tax_date);
create index external_docs_status_idx on public.external_tax_documents(business_id, branch_id, submission_status, tax_date);
create index etims_queue_status_idx on public.etims_submission_queue(business_id, status, next_retry_at, created_at);
create index tax_calendar_due_idx on public.tax_compliance_calendar(business_id, due_date, status);
create index tax_audit_business_idx on public.tax_audit_trail(business_id, created_at desc);

alter table public.business_tax_profiles enable row level security;
alter table public.branch_tax_configurations enable row level security;
alter table public.tax_rules enable row level security;
alter table public.vat_codes enable row level security;
alter table public.product_tax_mappings enable row level security;
alter table public.tax_periods enable row level security;
alter table public.tax_documents enable row level security;
alter table public.tax_document_lines enable row level security;
alter table public.tax_ledger_entries enable row level security;
alter table public.tax_integration_configurations enable row level security;
alter table public.external_tax_documents enable row level security;
alter table public.etims_submission_queue enable row level security;
alter table public.etims_payload_schemas enable row level security;
alter table public.etims_error_events enable row level security;
alter table public.withholding_certificates enable row level security;
alter table public.tax_returns enable row level security;
alter table public.tax_payments enable row level security;
alter table public.tax_compliance_calendar enable row level security;
alter table public.tax_audit_evidence enable row level security;
alter table public.tax_import_batches enable row level security;
alter table public.tax_import_rows enable row level security;
alter table public.tax_audit_trail enable row level security;

create policy business_tax_profiles_member_read on public.business_tax_profiles for select to authenticated using (public.current_user_has_business_access(business_id));
create policy business_tax_profiles_owner_write on public.business_tax_profiles for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy branch_tax_member_read on public.branch_tax_configurations for select to authenticated using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy branch_tax_owner_write on public.branch_tax_configurations for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy tax_rules_member_read on public.tax_rules for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy tax_rules_owner_write on public.tax_rules for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy vat_codes_member_read on public.vat_codes for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));
create policy vat_codes_owner_write on public.vat_codes for all to authenticated using (business_id is not null and public.current_user_business_role(business_id) = 'owner') with check (business_id is not null and public.current_user_business_role(business_id) = 'owner');
create policy product_tax_member_read on public.product_tax_mappings for select to authenticated using (public.current_user_has_business_access(business_id));
create policy product_tax_owner_manager_write on public.product_tax_mappings for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_periods_member_read on public.tax_periods for select to authenticated using (public.current_user_has_business_access(business_id));
create policy tax_periods_owner_write on public.tax_periods for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy tax_documents_member_read on public.tax_documents for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_documents_manager_write on public.tax_documents for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_lines_member_read on public.tax_document_lines for select to authenticated using (public.current_user_has_business_access(business_id));
create policy tax_lines_manager_write on public.tax_document_lines for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_ledger_member_read on public.tax_ledger_entries for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_ledger_manager_insert on public.tax_ledger_entries for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_integrations_owner_read on public.tax_integration_configurations for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy tax_integrations_owner_write on public.tax_integration_configurations for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy external_docs_member_read on public.external_tax_documents for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy external_docs_manager_write on public.external_tax_documents for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy etims_queue_owner_read on public.etims_submission_queue for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy etims_queue_owner_write on public.etims_submission_queue for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy etims_schemas_read on public.etims_payload_schemas for select to authenticated using (active = true);
create policy etims_errors_owner_read on public.etims_error_events for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy withholding_member_read on public.withholding_certificates for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy withholding_manager_write on public.withholding_certificates for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_returns_member_read on public.tax_returns for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_returns_manager_write on public.tax_returns for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_payments_member_read on public.tax_payments for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_payments_manager_write on public.tax_payments for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_calendar_member_read on public.tax_compliance_calendar for select to authenticated using (public.current_user_has_business_access(business_id));
create policy tax_calendar_manager_write on public.tax_compliance_calendar for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_evidence_member_read on public.tax_audit_evidence for select to authenticated using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy tax_evidence_manager_write on public.tax_audit_evidence for insert to authenticated with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_imports_member_read on public.tax_import_batches for select to authenticated using (public.current_user_has_business_access(business_id));
create policy tax_imports_manager_write on public.tax_import_batches for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy tax_import_rows_member_read on public.tax_import_rows for select to authenticated using (public.current_user_has_business_access(business_id));
create policy tax_audit_owner_read on public.tax_audit_trail for select to authenticated using (public.current_user_business_role(business_id) = 'owner');

grant select, insert, update, delete on
  public.business_tax_profiles,
  public.branch_tax_configurations,
  public.tax_rules,
  public.vat_codes,
  public.product_tax_mappings,
  public.tax_periods,
  public.tax_documents,
  public.tax_document_lines,
  public.tax_ledger_entries,
  public.tax_integration_configurations,
  public.external_tax_documents,
  public.etims_submission_queue,
  public.etims_payload_schemas,
  public.etims_error_events,
  public.withholding_certificates,
  public.tax_returns,
  public.tax_payments,
  public.tax_compliance_calendar,
  public.tax_audit_evidence,
  public.tax_import_batches,
  public.tax_import_rows,
  public.tax_audit_trail
to authenticated;

grant select on public.tax_integration_health, public.vat_return_preparation, public.withholding_return_schedule to authenticated;

revoke execute on function public.prevent_tax_rule_overlap() from public;
revoke execute on function public.prevent_vat_code_overlap() from public;
revoke execute on function public.prevent_accepted_external_document_mutation() from public;
revoke execute on function public.prevent_closed_tax_period_mutation() from public;
revoke execute on function public.calculate_vat_amount(numeric, numeric, boolean, text) from public;

grant execute on function public.calculate_vat_amount(numeric, numeric, boolean, text) to authenticated;
