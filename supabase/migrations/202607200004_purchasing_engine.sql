create type public.supplier_type as enum (
  'manufacturer',
  'distributor',
  'wholesaler',
  'farmer_producer',
  'importer',
  'service_provider',
  'contractor',
  'transporter',
  'utility_provider',
  'government_entity',
  'individual',
  'other'
);

create type public.supplier_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'on_hold', 'archived');
create type public.purchase_requisition_status as enum ('draft', 'submitted', 'pending_approval', 'approved', 'partially_converted', 'fully_converted', 'rejected', 'cancelled', 'closed');
create type public.purchase_order_status as enum ('draft', 'pending_approval', 'approved', 'sent', 'acknowledged', 'partially_received', 'fully_received', 'partially_billed', 'fully_billed', 'closed', 'cancelled', 'rejected');
create type public.grn_status as enum ('draft', 'pending_inspection', 'pending_approval', 'posted', 'partially_posted', 'rejected', 'reversed', 'cancelled');
create type public.quality_status as enum ('accepted', 'accepted_with_issues', 'quarantined', 'rejected', 'pending_inspection');
create type public.supplier_bill_status as enum ('draft', 'pending_approval', 'approved', 'posted', 'partially_paid', 'paid', 'overdue', 'disputed', 'cancelled', 'reversed');
create type public.matching_status as enum ('matched', 'quantity_variance', 'price_variance', 'tax_variance', 'missing_grn', 'missing_purchase_order', 'overbilled', 'underbilled', 'needs_review');
create type public.supplier_return_status as enum ('draft', 'pending_approval', 'approved', 'dispatched', 'acknowledged', 'credit_pending', 'credited', 'rejected', 'cancelled', 'closed');
create type public.supplier_payment_status as enum ('draft', 'pending_approval', 'approved', 'posted', 'partially_allocated', 'fully_allocated', 'failed', 'reversed', 'cancelled');
create type public.supplier_transaction_type as enum ('opening_balance', 'bill', 'payment', 'credit_note', 'debit_note', 'advance', 'advance_application', 'refund', 'reversal', 'adjustment');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_type public.supplier_type not null default 'other',
  legal_name text not null,
  trading_name text,
  supplier_code text not null,
  kra_pin text,
  vat_registered boolean not null default false,
  vat_number text,
  registration_number text,
  primary_phone text,
  alternative_phone text,
  email text,
  website text,
  physical_address text,
  postal_address text,
  county text,
  town text,
  country text not null default 'Kenya',
  primary_contact_person text,
  default_currency text not null default 'KES',
  default_payment_terms text not null default '30_days',
  credit_limit_granted numeric(18, 2) not null default 0,
  tax_withholding_config jsonb not null default '{}'::jsonb,
  preferred_payment_method_id uuid references public.payment_methods(id) on delete set null,
  preferred_finance_account_id uuid references public.finance_accounts(id) on delete set null,
  default_purchase_tax_id uuid references public.tax_rates(id) on delete set null,
  default_receiving_branch_id uuid references public.branches(id) on delete set null,
  default_receiving_warehouse_id uuid references public.warehouses(id) on delete set null,
  active boolean not null default true,
  on_hold boolean not null default false,
  on_hold_reason text,
  approved_supplier boolean not null default false,
  supplier_category text,
  status public.supplier_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (business_id, supplier_code)
);

create unique index suppliers_email_idx on public.suppliers(business_id, lower(email)) where email is not null and active = true;

create table public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  contact_name text not null,
  job_title text,
  phone text,
  alternative_phone text,
  email text,
  contact_type text not null default 'other',
  preferred_contact boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index supplier_contacts_one_preferred_type on public.supplier_contacts(supplier_id, contact_type) where preferred_contact = true and active = true;

create table public.supplier_addresses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  address_name text not null,
  address_type text not null default 'other',
  physical_address text,
  town text,
  county text,
  country text not null default 'Kenya',
  contact_person text,
  phone text,
  delivery_instructions text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  document_type text not null,
  file_path text not null,
  issue_date date,
  expiry_date date,
  verification_status text not null default 'unverified',
  verified_by uuid references public.profiles(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  supplier_product_code text,
  supplier_product_name text,
  supplier_barcode text,
  purchase_unit_id uuid references public.units_of_measure(id),
  conversion_to_base_unit numeric(18, 8) not null default 1 check (conversion_to_base_unit > 0),
  last_purchase_price numeric(18, 4),
  current_quoted_price numeric(18, 4),
  currency text not null default 'KES',
  minimum_order_quantity numeric(18, 8),
  standard_pack_size numeric(18, 8),
  lead_time_days integer,
  preferred_supplier boolean not null default false,
  active boolean not null default true,
  valid_from date,
  valid_to date,
  tax_treatment text,
  rebate_or_discount_info jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, supplier_id, product_id, variant_id, branch_id)
);
create unique index supplier_products_one_preferred on public.supplier_products(business_id, product_id, variant_id, branch_id) where preferred_supplier = true and active = true;

create table public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  purchase_unit_id uuid references public.units_of_measure(id),
  unit_conversion_factor numeric(18, 8) not null check (unit_conversion_factor > 0),
  quoted_unit_price numeric(18, 4) not null check (quoted_unit_price >= 0),
  base_unit_price numeric(18, 4) not null check (base_unit_price >= 0),
  currency text not null default 'KES',
  tax_inclusive boolean not null default false,
  effective_date date not null,
  expiry_date date,
  source text not null default 'manual_update',
  reference_number text,
  entered_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= effective_date)
);

create table public.purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  requesting_warehouse_id uuid references public.warehouses(id),
  requisition_number text not null,
  requested_by uuid references public.profiles(id),
  department_or_activity text,
  request_date date not null default current_date,
  required_date date,
  priority text not null default 'normal',
  reason text,
  status public.purchase_requisition_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  approved_by uuid references public.profiles(id),
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, requisition_number)
);

create table public.purchase_requisition_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requisition_id uuid not null references public.purchase_requisitions(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  description text,
  requested_quantity numeric(18, 8) not null check (requested_quantity > 0),
  unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null check (base_quantity > 0),
  preferred_supplier_id uuid references public.suppliers(id) on delete set null,
  estimated_price numeric(18, 4),
  estimated_total numeric(18, 4),
  required_warehouse_id uuid references public.warehouses(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  supplier_address_id uuid references public.supplier_addresses(id),
  supplier_contact_id uuid references public.supplier_contacts(id),
  purchase_order_number text not null,
  order_date date not null default current_date,
  expected_delivery_date date,
  currency text not null default 'KES',
  exchange_rate_placeholder numeric(18, 8) not null default 1,
  payment_terms text,
  delivery_location text,
  receiving_warehouse_id uuid references public.warehouses(id),
  buyer_id uuid references public.profiles(id),
  related_requisition_id uuid references public.purchase_requisitions(id),
  supplier_quotation_reference text,
  tax_inclusive boolean not null default false,
  subtotal numeric(18, 4) not null default 0,
  discount_total numeric(18, 4) not null default 0,
  tax_total numeric(18, 4) not null default 0,
  other_charges numeric(18, 4) not null default 0,
  total numeric(18, 4) not null default 0,
  amount_received_placeholder numeric(18, 4) not null default 0,
  amount_billed numeric(18, 4) not null default 0,
  status public.purchase_order_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  notes text,
  terms_and_conditions text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  sent_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, purchase_order_number)
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  supplier_product_code text,
  description text,
  ordered_quantity numeric(18, 8) not null check (ordered_quantity > 0),
  purchase_unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null check (base_quantity > 0),
  unit_conversion numeric(18, 8) not null default 1 check (unit_conversion > 0),
  unit_price numeric(18, 4) not null default 0,
  base_unit_price numeric(18, 4) not null default 0,
  discount_type text,
  discount_value numeric(18, 4) not null default 0,
  tax_id uuid references public.tax_rates(id),
  line_subtotal numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,
  expected_warehouse_id uuid references public.warehouses(id),
  received_quantity numeric(18, 8) not null default 0,
  billed_quantity numeric(18, 8) not null default 0,
  cancelled_quantity numeric(18, 8) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_approval_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  requisition_id uuid references public.purchase_requisitions(id) on delete cascade,
  requester_id uuid references public.profiles(id),
  total_amount numeric(18, 4),
  triggered_rule text,
  approver_id uuid references public.profiles(id),
  decision text,
  comments text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.goods_received_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  grn_number text not null,
  supplier_delivery_note_number text,
  supplier_invoice_reference text,
  receipt_date date not null default current_date,
  warehouse_id uuid not null references public.warehouses(id),
  received_by uuid references public.profiles(id),
  inspected_by uuid references public.profiles(id),
  vehicle_registration text,
  driver_name text,
  delivery_condition text,
  status public.grn_status not null default 'draft',
  notes text,
  attachment_path text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, grn_number)
);

create table public.goods_received_note_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  grn_id uuid not null references public.goods_received_notes(id) on delete cascade,
  purchase_order_item_id uuid references public.purchase_order_items(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  supplier_batch text,
  manufacturing_date date,
  expiry_date date,
  serial_numbers text[] not null default '{}',
  ordered_quantity numeric(18, 8) not null default 0,
  previously_received_quantity numeric(18, 8) not null default 0,
  delivered_quantity numeric(18, 8) not null default 0,
  accepted_quantity numeric(18, 8) not null default 0,
  rejected_quantity numeric(18, 8) not null default 0,
  damaged_quantity numeric(18, 8) not null default 0,
  short_quantity numeric(18, 8) not null default 0,
  excess_quantity numeric(18, 8) not null default 0,
  purchase_unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null default 0,
  unit_cost numeric(18, 4) not null default 0,
  tax_id uuid references public.tax_rates(id),
  warehouse_id uuid references public.warehouses(id),
  bin_id uuid references public.warehouse_bins(id),
  returnable_packaging_received jsonb not null default '{}'::jsonb,
  quality_status public.quality_status not null default 'accepted',
  notes text,
  created_at timestamptz not null default now(),
  check (expiry_date is null or manufacturing_date is null or expiry_date >= manufacturing_date)
);

create table public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  grn_id uuid references public.goods_received_notes(id),
  internal_bill_number text not null,
  supplier_invoice_number text,
  bill_date date not null default current_date,
  due_date date,
  currency text not null default 'KES',
  payment_terms text,
  tax_inclusive boolean not null default false,
  supplier_tax_document_status public.tax_document_status not null default 'pending',
  supplier_invoice_attachment_path text,
  etims_or_etr_reference text,
  subtotal numeric(18, 4) not null default 0,
  discount_total numeric(18, 4) not null default 0,
  tax_total numeric(18, 4) not null default 0,
  withholding_tax_total numeric(18, 4) not null default 0,
  other_charges numeric(18, 4) not null default 0,
  total numeric(18, 4) not null default 0,
  amount_paid numeric(18, 4) not null default 0,
  outstanding_balance numeric(18, 4) not null default 0,
  status public.supplier_bill_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, internal_bill_number),
  unique (business_id, supplier_id, supplier_invoice_number)
);

create table public.supplier_bill_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  purchase_order_item_id uuid references public.purchase_order_items(id),
  grn_item_id uuid references public.goods_received_note_items(id),
  description text,
  quantity numeric(18, 8) not null check (quantity >= 0),
  unit_id uuid references public.units_of_measure(id),
  unit_price numeric(18, 4) not null default 0,
  discount numeric(18, 4) not null default 0,
  tax numeric(18, 4) not null default 0,
  withholding_tax numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,
  classification_placeholder text,
  branch_id uuid references public.branches(id),
  activity_id uuid references public.business_activities(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_match_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id),
  grn_id uuid references public.goods_received_notes(id),
  supplier_bill_id uuid references public.supplier_bills(id),
  matching_status public.matching_status not null default 'needs_review',
  ordered_quantity numeric(18, 8),
  received_quantity numeric(18, 8),
  billed_quantity numeric(18, 8),
  order_price numeric(18, 4),
  bill_price numeric(18, 4),
  tax_variance numeric(18, 4),
  discount_variance numeric(18, 4),
  other_charge_variance numeric(18, 4),
  tolerance_config jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_price_variances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  source_type text not null,
  previous_price numeric(18, 4),
  current_price numeric(18, 4) not null,
  percentage_change numeric(9, 4),
  quantity_affected numeric(18, 8),
  value_impact numeric(18, 4),
  reason text,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.supplier_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  original_purchase_order_id uuid references public.purchase_orders(id),
  original_grn_id uuid references public.goods_received_notes(id),
  original_bill_id uuid references public.supplier_bills(id),
  supplier_return_number text not null,
  return_date date not null default current_date,
  dispatch_warehouse_id uuid references public.warehouses(id),
  reason text not null,
  status public.supplier_return_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  supplier_acknowledgement text,
  expected_credit_note boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  dispatched_by uuid references public.profiles(id),
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, supplier_return_number)
);

create table public.supplier_return_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_return_id uuid not null references public.supplier_returns(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  serial_number text,
  quantity numeric(18, 8) not null check (quantity > 0),
  unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null check (base_quantity > 0),
  unit_cost numeric(18, 4),
  total_cost numeric(18, 4),
  reason text,
  condition text,
  related_grn_item_id uuid references public.goods_received_note_items(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.supplier_credit_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  credit_note_number text not null,
  supplier_credit_note_number text,
  related_bill_id uuid references public.supplier_bills(id),
  related_return_id uuid references public.supplier_returns(id),
  credit_note_date date not null default current_date,
  amount numeric(18, 4) not null check (amount >= 0),
  tax numeric(18, 4) not null default 0,
  unallocated_amount numeric(18, 4) not null default 0,
  attachment_path text,
  status text not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, credit_note_number)
);

create table public.supplier_debit_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  debit_note_number text not null,
  related_bill_id uuid references public.supplier_bills(id),
  debit_note_date date not null default current_date,
  amount numeric(18, 4) not null check (amount >= 0),
  tax numeric(18, 4) not null default 0,
  reason text,
  status text not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, debit_note_number)
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  payment_number text not null,
  payment_date date not null default current_date,
  payment_method_id uuid references public.payment_methods(id),
  finance_account_id uuid references public.finance_accounts(id),
  currency text not null default 'KES',
  amount numeric(18, 4) not null check (amount >= 0),
  reference_number text,
  cheque_number text,
  transaction_code text,
  payment_status public.supplier_payment_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  payee_name text,
  notes text,
  attachment_path text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, payment_number)
);

create table public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_payment_id uuid not null references public.supplier_payments(id) on delete cascade,
  supplier_bill_id uuid references public.supplier_bills(id),
  supplier_credit_note_id uuid references public.supplier_credit_notes(id),
  allocation_amount numeric(18, 4) not null check (allocation_amount > 0),
  allocation_date date not null default current_date,
  created_by uuid references public.profiles(id),
  reversal_reference_id uuid references public.supplier_payment_allocations(id),
  created_at timestamptz not null default now()
);

create table public.supplier_advances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  advance_number text not null,
  advance_type text not null default 'advance',
  original_amount numeric(18, 4) not null check (original_amount >= 0),
  applied_amount numeric(18, 4) not null default 0,
  remaining_amount numeric(18, 4) not null default 0,
  purpose text,
  related_purchase_order_id uuid references public.purchase_orders(id),
  review_date date,
  status text not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, advance_number)
);

create table public.supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id),
  supplier_id uuid not null references public.suppliers(id),
  transaction_type public.supplier_transaction_type not null,
  transaction_date date not null default current_date,
  reference_type text,
  reference_id uuid,
  reference_number text,
  debit_amount numeric(18, 4) not null default 0,
  credit_amount numeric(18, 4) not null default 0,
  currency text not null default 'KES',
  notes text,
  created_by uuid references public.profiles(id),
  reversal_reference_id uuid references public.supplier_transactions(id),
  created_at timestamptz not null default now()
);

create table public.supplier_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  branch_id uuid references public.branches(id),
  currency text not null default 'KES',
  opening_balance numeric(18, 4) not null default 0,
  bill_total numeric(18, 4) not null default 0,
  payment_total numeric(18, 4) not null default 0,
  credit_note_total numeric(18, 4) not null default 0,
  debit_note_total numeric(18, 4) not null default 0,
  advance_total numeric(18, 4) not null default 0,
  refund_total numeric(18, 4) not null default 0,
  unallocated_payment_total numeric(18, 4) not null default 0,
  current_balance numeric(18, 4) not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, supplier_id, branch_id, currency)
);

create table public.supplier_opening_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  branch_id uuid references public.branches(id),
  reference_number text not null,
  document_date date not null,
  due_date date,
  amount numeric(18, 4) not null check (amount >= 0),
  balance_type text not null check (balance_type in ('outstanding_bill', 'supplier_credit', 'supplier_advance', 'unallocated_payment')),
  notes text,
  approval_status public.approval_status not null default 'draft',
  posted_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, supplier_id, reference_number, balance_type)
);

create table public.supplier_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  period_start date not null,
  period_end date not null,
  on_time_delivery_rate numeric(9, 4),
  complete_delivery_rate numeric(9, 4),
  rejected_quantity_rate numeric(9, 4),
  damaged_quantity_rate numeric(9, 4),
  price_consistency numeric(9, 4),
  average_lead_time_days numeric(9, 2),
  bill_accuracy numeric(9, 4),
  return_rate numeric(9, 4),
  purchase_volume numeric(18, 8),
  purchase_value numeric(18, 4),
  last_purchase_date date,
  dispute_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, supplier_id, period_start, period_end)
);

create table public.purchase_accounting_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id),
  activity_id uuid references public.business_activities(id),
  transaction_type text not null,
  transaction_id uuid not null,
  transaction_date date not null,
  currency text not null default 'KES',
  debit_amount numeric(18, 4) not null default 0,
  credit_amount numeric(18, 4) not null default 0,
  suggested_account_role text not null,
  tax_details jsonb not null default '{}'::jsonb,
  supplier_id uuid references public.suppliers(id),
  reference_number text,
  posting_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.purchase_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_type text not null check (import_type in ('suppliers','supplier_contacts','supplier_products','supplier_prices','supplier_opening_balances','purchase_orders')),
  file_name text,
  status text not null default 'draft',
  row_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.purchase_import_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_batch_id uuid not null references public.purchase_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (import_batch_id, row_number)
);

create or replace function public.prevent_supplier_transaction_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Posted supplier transactions are immutable. Use a reversal.';
end;
$$;

create trigger supplier_transactions_immutable
before update or delete on public.supplier_transactions
for each row execute function public.prevent_supplier_transaction_update();

create or replace function public.apply_supplier_transaction_to_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.supplier_balances (
    business_id, supplier_id, branch_id, currency, current_balance
  )
  values (
    new.business_id,
    new.supplier_id,
    new.branch_id,
    new.currency,
    0
  )
  on conflict (business_id, supplier_id, branch_id, currency) do nothing;

  update public.supplier_balances
  set opening_balance = opening_balance + case when new.transaction_type = 'opening_balance' then new.debit_amount - new.credit_amount else 0 end,
      bill_total = bill_total + case when new.transaction_type = 'bill' then new.debit_amount else 0 end,
      payment_total = payment_total + case when new.transaction_type = 'payment' then new.credit_amount else 0 end,
      credit_note_total = credit_note_total + case when new.transaction_type = 'credit_note' then new.credit_amount else 0 end,
      debit_note_total = debit_note_total + case when new.transaction_type = 'debit_note' then new.debit_amount else 0 end,
      advance_total = advance_total + case when new.transaction_type in ('advance','advance_application') then new.credit_amount - new.debit_amount else 0 end,
      refund_total = refund_total + case when new.transaction_type = 'refund' then new.debit_amount else 0 end,
      current_balance = current_balance + new.debit_amount - new.credit_amount,
      updated_at = now()
  where business_id = new.business_id
    and supplier_id = new.supplier_id
    and branch_id is not distinct from new.branch_id
    and currency = new.currency;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, new_value)
  values (new.business_id, new.created_by, 'supplier_transaction.posted', 'purchases', 'supplier_transaction', new.id, to_jsonb(new));

  return new;
end;
$$;

create trigger supplier_transactions_apply_balance
after insert on public.supplier_transactions
for each row execute function public.apply_supplier_transaction_to_balance();

create or replace function public.post_grn_stock_movements(target_grn_id uuid, target_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  grn public.goods_received_notes%rowtype;
  item record;
begin
  select * into grn
  from public.goods_received_notes
  where id = target_grn_id
  for update;

  if not found then
    raise exception 'GRN was not found.';
  end if;

  if grn.status = 'posted' then
    raise exception 'GRN has already been posted.';
  end if;

  if not public.current_user_has_business_access(grn.business_id) or not public.can_access_branch(grn.business_id, grn.branch_id) then
    raise exception 'Not authorised to post this GRN.';
  end if;

  for item in
    select *
    from public.goods_received_note_items
    where grn_id = target_grn_id
  loop
    if item.accepted_quantity > 0 and item.quality_status in ('accepted','accepted_with_issues','pending_inspection') then
      insert into public.stock_movements (
        business_id, branch_id, warehouse_id, product_id, variant_id, batch_id,
        movement_type, direction, quantity_base, display_quantity, display_unit_id,
        unit_conversion_factor, unit_cost, total_cost, currency,
        reference_document_type, reference_document_id, reference_number,
        reason, notes, movement_date, created_by, approval_status
      )
      values (
        grn.business_id, grn.branch_id, coalesce(item.warehouse_id, grn.warehouse_id), item.product_id, item.variant_id, item.batch_id,
        'purchase_receipt', 'in', item.base_quantity, item.accepted_quantity, item.purchase_unit_id,
        case when item.accepted_quantity > 0 then item.base_quantity / item.accepted_quantity else 1 end,
        item.unit_cost, item.base_quantity * item.unit_cost, 'KES',
        'grn', grn.id, grn.grn_number,
        'Goods received', item.notes, grn.receipt_date::timestamptz, target_user_id, 'posted'
      );
    end if;
  end loop;

  update public.goods_received_notes
  set status = 'posted',
      posted_at = now(),
      updated_at = now()
  where id = target_grn_id;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, new_value)
  values (grn.business_id, target_user_id, 'grn.posted', 'purchases', 'goods_received_note', grn.id, jsonb_build_object('grn_number', grn.grn_number));
end;
$$;

create index suppliers_business_status_idx on public.suppliers(business_id, status, active);
create index supplier_products_product_idx on public.supplier_products(business_id, product_id, variant_id, active);
create index supplier_price_history_product_idx on public.supplier_price_history(business_id, product_id, variant_id, effective_date desc);
create index requisitions_branch_status_idx on public.purchase_requisitions(business_id, branch_id, status);
create index purchase_orders_supplier_status_idx on public.purchase_orders(business_id, supplier_id, status, order_date desc);
create index purchase_order_items_order_idx on public.purchase_order_items(business_id, purchase_order_id);
create index grn_supplier_status_idx on public.goods_received_notes(business_id, supplier_id, status, receipt_date desc);
create index supplier_bills_due_idx on public.supplier_bills(business_id, supplier_id, status, due_date);
create index supplier_transactions_supplier_idx on public.supplier_transactions(business_id, supplier_id, transaction_date desc);
create index supplier_balances_supplier_idx on public.supplier_balances(business_id, supplier_id, currency);
create index supplier_payments_supplier_idx on public.supplier_payments(business_id, supplier_id, payment_date desc);

alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.supplier_addresses enable row level security;
alter table public.supplier_documents enable row level security;
alter table public.supplier_products enable row level security;
alter table public.supplier_price_history enable row level security;
alter table public.purchase_requisitions enable row level security;
alter table public.purchase_requisition_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_approval_records enable row level security;
alter table public.goods_received_notes enable row level security;
alter table public.goods_received_note_items enable row level security;
alter table public.supplier_bills enable row level security;
alter table public.supplier_bill_items enable row level security;
alter table public.purchase_match_records enable row level security;
alter table public.purchase_price_variances enable row level security;
alter table public.supplier_returns enable row level security;
alter table public.supplier_return_items enable row level security;
alter table public.supplier_credit_notes enable row level security;
alter table public.supplier_debit_notes enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_payment_allocations enable row level security;
alter table public.supplier_advances enable row level security;
alter table public.supplier_transactions enable row level security;
alter table public.supplier_balances enable row level security;
alter table public.supplier_opening_balances enable row level security;
alter table public.supplier_performance_metrics enable row level security;
alter table public.purchase_accounting_events enable row level security;
alter table public.purchase_import_batches enable row level security;
alter table public.purchase_import_rows enable row level security;

create policy suppliers_member_read on public.suppliers
  for select using (public.current_user_has_business_access(business_id));
create policy suppliers_manager_write on public.suppliers
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_child_member_read on public.supplier_contacts
  for select using (public.current_user_has_business_access(business_id));
create policy supplier_child_manager_write on public.supplier_contacts
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_addresses_member_read on public.supplier_addresses
  for select using (public.current_user_has_business_access(business_id));
create policy supplier_addresses_manager_write on public.supplier_addresses
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_documents_owner_read on public.supplier_documents
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy supplier_documents_owner_write on public.supplier_documents
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy supplier_products_member_read on public.supplier_products
  for select using (public.current_user_has_business_access(business_id));
create policy supplier_products_manager_write on public.supplier_products
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_prices_manager_read on public.supplier_price_history
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy supplier_prices_manager_write on public.supplier_price_history
  for insert with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy purchase_requisitions_member_read on public.purchase_requisitions
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy purchase_requisitions_write on public.purchase_requisitions
  for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy requisition_items_member_read on public.purchase_requisition_items
  for select using (public.current_user_has_business_access(business_id));
create policy requisition_items_write on public.purchase_requisition_items
  for all using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy purchase_orders_member_read on public.purchase_orders
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy purchase_orders_manager_write on public.purchase_orders
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy purchase_order_items_member_read on public.purchase_order_items
  for select using (public.current_user_has_business_access(business_id));
create policy purchase_order_items_manager_write on public.purchase_order_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy purchasing_approvals_member_read on public.purchase_approval_records
  for select using (public.current_user_has_business_access(business_id));
create policy purchasing_approvals_owner_write on public.purchase_approval_records
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy grns_member_read on public.goods_received_notes
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy grns_manager_write on public.goods_received_notes
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy grn_items_member_read on public.goods_received_note_items
  for select using (public.current_user_has_business_access(business_id));
create policy grn_items_manager_write on public.goods_received_note_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_bills_member_read on public.supplier_bills
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy supplier_bills_manager_write on public.supplier_bills
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy supplier_bill_items_member_read on public.supplier_bill_items
  for select using (public.current_user_has_business_access(business_id));
create policy supplier_bill_items_manager_write on public.supplier_bill_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy purchasing_financial_member_read on public.purchase_match_records
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy purchasing_financial_manager_write on public.purchase_match_records
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy purchase_variance_manager_read on public.purchase_price_variances
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy purchase_variance_manager_write on public.purchase_price_variances
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_returns_member_read on public.supplier_returns
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy supplier_returns_manager_write on public.supplier_returns
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy supplier_return_items_member_read on public.supplier_return_items
  for select using (public.current_user_has_business_access(business_id));
create policy supplier_return_items_manager_write on public.supplier_return_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy supplier_money_owner_read on public.supplier_payments
  for select using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy supplier_money_owner_write on public.supplier_payments
  for all using (public.current_user_business_role(business_id) = 'owner' and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) = 'owner' and public.can_access_branch(business_id, branch_id));

create policy supplier_finance_member_read on public.supplier_credit_notes
  for select using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy supplier_finance_owner_write on public.supplier_credit_notes
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy supplier_debit_member_read on public.supplier_debit_notes
  for select using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy supplier_debit_owner_write on public.supplier_debit_notes
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy allocations_owner_read on public.supplier_payment_allocations
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy allocations_owner_write on public.supplier_payment_allocations
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy advances_owner_read on public.supplier_advances
  for select using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy advances_owner_write on public.supplier_advances
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy supplier_ledger_owner_read on public.supplier_transactions
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy supplier_ledger_owner_insert on public.supplier_transactions
  for insert with check (public.current_user_business_role(business_id) = 'owner');

create policy supplier_balances_owner_read on public.supplier_balances
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));

create policy opening_balances_owner_read on public.supplier_opening_balances
  for select using (public.current_user_business_role(business_id) in ('owner','manager'));
create policy opening_balances_owner_write on public.supplier_opening_balances
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy supplier_performance_member_read on public.supplier_performance_metrics
  for select using (public.current_user_has_business_access(business_id));

create policy purchase_accounting_owner_read on public.purchase_accounting_events
  for select using (public.current_user_business_role(business_id) = 'owner');
create policy purchase_accounting_owner_insert on public.purchase_accounting_events
  for insert with check (public.current_user_business_role(business_id) = 'owner');

create policy purchase_imports_member_read on public.purchase_import_batches
  for select using (public.current_user_has_business_access(business_id));
create policy purchase_imports_manager_write on public.purchase_import_batches
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy purchase_import_rows_member_read on public.purchase_import_rows
  for select using (public.current_user_has_business_access(business_id));
create policy purchase_import_rows_manager_write on public.purchase_import_rows
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

grant select, insert, update, delete on
  public.suppliers,
  public.supplier_contacts,
  public.supplier_addresses,
  public.supplier_documents,
  public.supplier_products,
  public.supplier_price_history,
  public.purchase_requisitions,
  public.purchase_requisition_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.purchase_approval_records,
  public.goods_received_notes,
  public.goods_received_note_items,
  public.supplier_bills,
  public.supplier_bill_items,
  public.purchase_match_records,
  public.purchase_price_variances,
  public.supplier_returns,
  public.supplier_return_items,
  public.supplier_credit_notes,
  public.supplier_debit_notes,
  public.supplier_payments,
  public.supplier_payment_allocations,
  public.supplier_advances,
  public.supplier_transactions,
  public.supplier_balances,
  public.supplier_opening_balances,
  public.supplier_performance_metrics,
  public.purchase_accounting_events,
  public.purchase_import_batches,
  public.purchase_import_rows
to authenticated;

revoke execute on function public.apply_supplier_transaction_to_balance() from public;
revoke execute on function public.post_grn_stock_movements(uuid, uuid) from public;
grant execute on function public.post_grn_stock_movements(uuid, uuid) to authenticated;
