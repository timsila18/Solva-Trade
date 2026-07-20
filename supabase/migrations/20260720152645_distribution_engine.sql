create type public.stock_recognition_point as enum ('on_invoice', 'on_dispatch', 'on_delivery_confirmation');
create type public.customer_status as enum ('draft', 'active', 'on_hold', 'blocked', 'archived');
create type public.sales_order_status as enum ('draft', 'pending_approval', 'approved', 'partially_fulfilled', 'fulfilled', 'cancelled', 'rejected', 'closed');
create type public.sales_invoice_status as enum ('draft', 'posted', 'partially_paid', 'paid', 'overdue', 'cancelled', 'reversed');
create type public.delivery_payment_status as enum ('not_expected', 'expected', 'partial', 'collected', 'short_paid', 'overpaid', 'credit_sale');
create type public.delivery_run_type as enum ('scheduled_delivery', 'route_sales', 'customer_collection', 'inter_branch_distribution', 'supplier_collection', 'special_delivery', 'other');
create type public.delivery_run_status as enum ('draft', 'pending_approval', 'approved', 'loading', 'ready_for_dispatch', 'dispatched', 'in_progress', 'partially_completed', 'returned_to_depot', 'pending_reconciliation', 'reconciled', 'closed', 'cancelled', 'rejected');
create type public.delivery_stop_status as enum ('planned', 'ready', 'en_route', 'arrived', 'partially_delivered', 'delivered', 'delivery_rejected', 'customer_unavailable', 'rescheduled', 'cancelled', 'returned_to_depot', 'needs_review');
create type public.capacity_status as enum ('within_capacity', 'near_capacity', 'over_capacity', 'missing_product_data', 'approval_required');
create type public.loading_sheet_status as enum ('draft', 'picking', 'ready_for_verification', 'verified', 'loaded', 'dispatched', 'cancelled', 'reversed');
create type public.delivery_note_status as enum ('draft', 'ready', 'dispatched', 'partially_delivered', 'delivered', 'rejected', 'returned', 'cancelled', 'reversed');
create type public.proof_of_delivery_type as enum ('customer_signature', 'recipient_name', 'recipient_phone', 'recipient_identification_reference', 'delivery_photo', 'signed_document_photo', 'gps_location', 'delivery_timestamp', 'delivery_confirmation_code', 'customer_stamp', 'other');
create type public.proof_verification_status as enum ('pending', 'verified', 'rejected', 'needs_review');
create type public.delivery_collection_status as enum ('draft', 'posted', 'verified', 'allocated', 'partially_allocated', 'reversed', 'rejected');
create type public.reconciliation_status as enum ('draft', 'submitted', 'under_review', 'approved', 'variance_approved', 'closed', 'reopened', 'cancelled');
create type public.route_expense_status as enum ('draft', 'submitted', 'approved', 'rejected', 'reimbursed', 'posted');
create type public.packaging_transaction_type as enum ('opening_balance', 'loaded_to_vehicle', 'issued_to_customer', 'returned_by_customer', 'collected_from_customer', 'returned_to_warehouse', 'returned_to_supplier', 'lost', 'damaged', 'written_off', 'adjustment', 'reversal');
create type public.delivery_exception_type as enum ('stock_shortage', 'wrong_product', 'damaged_in_transit', 'customer_unavailable', 'customer_rejection', 'payment_shortfall', 'missing_proof_of_delivery', 'packaging_variance', 'cash_variance', 'vehicle_breakdown', 'delivery_delay', 'unapproved_route_expense', 'missing_document', 'other');
create type public.delivery_exception_severity as enum ('information', 'warning', 'high', 'critical');
create type public.delivery_exception_status as enum ('open', 'assigned', 'in_review', 'resolved', 'accepted', 'cancelled');

alter table public.operational_preferences
  add column if not exists stock_recognition_point public.stock_recognition_point not null default 'on_dispatch',
  add column if not exists require_route_reconciliation_before_close boolean not null default true,
  add column if not exists require_pod_before_delivery_close boolean not null default false,
  add column if not exists allow_cod_short_payment_with_approval boolean not null default false;

alter table public.routes
  add column if not exists default_departure_time time,
  add column if not exists default_return_time time,
  add column if not exists default_delivery_staff_ids uuid[] not null default '{}',
  add column if not exists route_capacity numeric(18, 4),
  add column if not exists maximum_order_value numeric(18, 2),
  add column if not exists maximum_weight numeric(18, 4),
  add column if not exists maximum_volume numeric(18, 4),
  add column if not exists collection_target numeric(18, 2) not null default 0;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_code text not null,
  customer_name text not null,
  customer_type text not null default 'business',
  kra_pin text,
  phone text,
  email text,
  default_route_id uuid references public.routes(id) on delete set null,
  default_payment_terms text not null default 'due_immediately',
  credit_limit numeric(18, 2) not null default 0,
  current_balance numeric(18, 2) not null default 0,
  packaging_balance_summary jsonb not null default '{}'::jsonb,
  status public.customer_status not null default 'active',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, customer_code)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  address_label text not null default 'Main',
  physical_address text,
  town text,
  county text,
  contact_person text,
  contact_phone text,
  delivery_instructions text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  stop_sequence integer,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  customer_id uuid references public.customers(id) on delete set null,
  customer_address_id uuid references public.customer_addresses(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  sales_order_number text not null,
  order_date date not null default current_date,
  requested_delivery_date date,
  payment_status public.delivery_payment_status not null default 'expected',
  status public.sales_order_status not null default 'draft',
  subtotal numeric(18, 2) not null default 0,
  tax_total numeric(18, 2) not null default 0,
  total_amount numeric(18, 2) not null default 0,
  amount_paid numeric(18, 2) not null default 0,
  delivery_status public.delivery_stop_status not null default 'planned',
  fulfilment_status text not null default 'unfulfilled',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sales_order_number)
);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid references public.units_of_measure(id),
  ordered_quantity numeric(18, 8) not null check (ordered_quantity >= 0),
  delivered_quantity numeric(18, 8) not null default 0 check (delivered_quantity >= 0),
  base_quantity numeric(18, 8) not null check (base_quantity >= 0),
  unit_price numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  customer_id uuid references public.customers(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date,
  status public.sales_invoice_status not null default 'draft',
  delivery_status public.delivery_note_status not null default 'draft',
  subtotal numeric(18, 2) not null default 0,
  tax_total numeric(18, 2) not null default 0,
  total_amount numeric(18, 2) not null default 0,
  amount_paid numeric(18, 2) not null default 0,
  balance_due numeric(18, 2) not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table public.sales_invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.sales_invoices(id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items(id) on delete set null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid references public.units_of_measure(id),
  invoice_quantity numeric(18, 8) not null check (invoice_quantity >= 0),
  delivered_quantity numeric(18, 8) not null default 0 check (delivered_quantity >= 0),
  base_quantity numeric(18, 8) not null check (base_quantity >= 0),
  unit_price numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  customer_id uuid references public.customers(id) on delete set null,
  payment_number text not null,
  payment_date timestamptz not null default now(),
  payment_method_id uuid references public.payment_methods(id),
  amount_received numeric(18, 2) not null check (amount_received >= 0),
  currency text not null default 'KES',
  transaction_reference text,
  payer_name text,
  payer_phone text,
  collected_by uuid references public.profiles(id),
  status public.delivery_collection_status not null default 'draft',
  source_document_type text,
  source_document_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (business_id, payment_number)
);

create unique index customer_payments_mpesa_reference_idx
  on public.customer_payments(business_id, transaction_reference)
  where transaction_reference is not null and status <> 'reversed';

create table public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_payment_id uuid not null references public.customer_payments(id) on delete cascade,
  invoice_id uuid references public.sales_invoices(id) on delete set null,
  allocated_amount numeric(18, 2) not null check (allocated_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.customer_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  customer_id uuid references public.customers(id) on delete set null,
  return_number text not null,
  return_date timestamptz not null default now(),
  related_invoice_id uuid references public.sales_invoices(id) on delete set null,
  status text not null default 'draft',
  total_return_value numeric(18, 2) not null default 0,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, return_number)
);

create table public.customer_return_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_return_id uuid not null references public.customer_returns(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  unit_id uuid references public.units_of_measure(id),
  returned_quantity numeric(18, 8) not null check (returned_quantity >= 0),
  base_quantity numeric(18, 8) not null check (base_quantity >= 0),
  unit_value numeric(18, 4),
  disposition text not null default 'return_to_stock'
);

create table public.route_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  route_id uuid not null references public.routes(id) on delete cascade,
  operating_days text[] not null default '{}',
  default_departure_time time,
  default_return_time time,
  default_vehicle_id uuid references public.vehicles(id) on delete set null,
  default_driver_id uuid references public.drivers(id) on delete set null,
  default_delivery_staff_ids uuid[] not null default '{}',
  route_capacity numeric(18, 4),
  maximum_order_value numeric(18, 2),
  maximum_weight numeric(18, 4),
  maximum_volume numeric(18, 4),
  collection_target numeric(18, 2) not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  route_id uuid references public.routes(id) on delete set null,
  delivery_run_number text not null,
  delivery_date date not null,
  planned_start_time time,
  planned_end_time time,
  actual_departure_time timestamptz,
  actual_return_time timestamptz,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  primary_driver_id uuid references public.drivers(id) on delete set null,
  assistant_driver_id uuid references public.drivers(id) on delete set null,
  dispatch_warehouse_id uuid references public.warehouses(id) on delete set null,
  return_warehouse_id uuid references public.warehouses(id) on delete set null,
  vehicle_warehouse_id uuid references public.warehouses(id) on delete set null,
  run_type public.delivery_run_type not null default 'scheduled_delivery',
  priority text not null default 'normal',
  status public.delivery_run_status not null default 'draft',
  approval_status public.approval_status not null default 'draft',
  capacity_status public.capacity_status not null default 'missing_product_data',
  capacity_override_reason text,
  planned_stop_count integer not null default 0,
  completed_stop_count integer not null default 0,
  failed_stop_count integer not null default 0,
  total_planned_order_value numeric(18, 2) not null default 0,
  total_delivered_value numeric(18, 2) not null default 0,
  total_collections_expected numeric(18, 2) not null default 0,
  total_collections_received numeric(18, 2) not null default 0,
  total_crates_issued numeric(18, 4) not null default 0,
  total_crates_returned numeric(18, 4) not null default 0,
  total_distance numeric(18, 4),
  opening_odometer numeric(18, 2),
  closing_odometer numeric(18, 2),
  fuel_issued numeric(18, 4),
  fuel_used numeric(18, 4),
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  dispatched_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, delivery_run_number)
);

create table public.delivery_run_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  delivery_run_id uuid not null references public.delivery_runs(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  assignment_role text not null check (assignment_role in ('primary_driver','assistant_driver','salesperson','delivery_assistant','route_supervisor','reconciliation_officer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.delivery_stops (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid not null references public.delivery_runs(id) on delete cascade,
  stop_sequence integer not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_address_id uuid references public.customer_addresses(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  invoice_id uuid references public.sales_invoices(id) on delete set null,
  delivery_note_id uuid,
  planned_arrival_time timestamptz,
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,
  priority text not null default 'normal',
  contact_person text,
  contact_phone text,
  delivery_instructions text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  delivery_value numeric(18, 2) not null default 0,
  collection_expected numeric(18, 2) not null default 0,
  returnable_packaging_expected jsonb not null default '{}'::jsonb,
  status public.delivery_stop_status not null default 'planned',
  arrival_time timestamptz,
  completion_time timestamptz,
  failure_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_run_id, stop_sequence)
);

create table public.delivery_stop_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  delivery_stop_id uuid not null references public.delivery_stops(id) on delete cascade,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  invoice_id uuid references public.sales_invoices(id) on delete set null,
  delivery_value numeric(18, 2) not null default 0,
  collection_expected numeric(18, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.loading_sheets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid not null references public.delivery_runs(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  loading_sheet_number text not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  loading_date date not null default current_date,
  status public.loading_sheet_status not null default 'draft',
  prepared_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  dispatch_time timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, loading_sheet_number)
);

create table public.loading_sheet_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  loading_sheet_id uuid not null references public.loading_sheets(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  serial_number text,
  ordered_quantity numeric(18, 8) not null default 0 check (ordered_quantity >= 0),
  delivery_quantity numeric(18, 8) not null default 0 check (delivery_quantity >= 0),
  bonus_quantity numeric(18, 8) not null default 0 check (bonus_quantity >= 0),
  promotional_quantity numeric(18, 8) not null default 0 check (promotional_quantity >= 0),
  returnable_packaging_quantity numeric(18, 8) not null default 0 check (returnable_packaging_quantity >= 0),
  unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null default 0 check (base_quantity >= 0),
  warehouse_id uuid not null references public.warehouses(id),
  stock_location text,
  picked_quantity numeric(18, 8) not null default 0 check (picked_quantity >= 0),
  loaded_quantity numeric(18, 8) not null default 0 check (loaded_quantity >= 0),
  short_quantity numeric(18, 8) not null default 0 check (short_quantity >= 0),
  difference_reason text,
  unit_cost numeric(18, 4),
  total_inventory_value numeric(18, 4),
  related_delivery_stop_ids uuid[] not null default '{}',
  picked_by uuid references public.profiles(id),
  checked_by uuid references public.profiles(id),
  loaded_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_address_id uuid references public.customer_addresses(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  invoice_id uuid references public.sales_invoices(id) on delete set null,
  delivery_note_number text not null,
  delivery_date date not null default current_date,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  status public.delivery_note_status not null default 'draft',
  delivery_instructions text,
  recipient_name text,
  recipient_phone text,
  recipient_identification_reference text,
  signed_status boolean not null default false,
  proof_of_delivery_status public.proof_verification_status not null default 'pending',
  notes text,
  created_by uuid references public.profiles(id),
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, delivery_note_number)
);

alter table public.delivery_stops
  add constraint delivery_stops_delivery_note_fk foreign key (delivery_note_id) references public.delivery_notes(id) on delete set null;

create table public.delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  delivery_note_id uuid not null references public.delivery_notes(id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items(id) on delete set null,
  invoice_item_id uuid references public.sales_invoice_items(id) on delete set null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  serial_number text,
  ordered_quantity numeric(18, 8) not null default 0 check (ordered_quantity >= 0),
  loaded_quantity numeric(18, 8) not null default 0 check (loaded_quantity >= 0),
  delivered_quantity numeric(18, 8) not null default 0 check (delivered_quantity >= 0),
  rejected_quantity numeric(18, 8) not null default 0 check (rejected_quantity >= 0),
  returned_quantity numeric(18, 8) not null default 0 check (returned_quantity >= 0),
  unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null default 0 check (base_quantity >= 0),
  returnable_packaging_issued jsonb not null default '{}'::jsonb,
  notes text,
  check (delivered_quantity + rejected_quantity + returned_quantity <= loaded_quantity)
);

create table public.proof_of_delivery_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_note_id uuid not null references public.delivery_notes(id) on delete cascade,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  proof_type public.proof_of_delivery_type not null,
  proof_value text,
  file_path text,
  captured_by uuid references public.profiles(id),
  captured_at timestamptz not null default now(),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  verification_status public.proof_verification_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  notes text
);

create table public.delivery_collections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_id uuid references public.sales_invoices(id) on delete set null,
  customer_payment_id uuid references public.customer_payments(id) on delete set null,
  amount_expected numeric(18, 2) not null default 0,
  amount_received numeric(18, 2) not null default 0,
  payment_method_id uuid references public.payment_methods(id),
  transaction_reference text,
  payer_name text,
  payer_phone text,
  collected_by uuid references public.profiles(id),
  collected_at timestamptz not null default now(),
  receipt_status text not null default 'not_generated',
  verification_status public.proof_verification_status not null default 'pending',
  status public.delivery_collection_status not null default 'draft',
  notes text,
  unique (business_id, transaction_reference)
);

create table public.route_collection_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid not null references public.delivery_runs(id) on delete cascade,
  reconciliation_number text not null,
  collector_id uuid references public.profiles(id),
  reconciliation_date date not null default current_date,
  cash_expected numeric(18, 2) not null default 0,
  cash_submitted numeric(18, 2) not null default 0,
  mobile_money_expected numeric(18, 2) not null default 0,
  mobile_money_verified numeric(18, 2) not null default 0,
  cheque_expected numeric(18, 2) not null default 0,
  cheque_submitted numeric(18, 2) not null default 0,
  other_expected numeric(18, 2) not null default 0,
  other_submitted numeric(18, 2) not null default 0,
  customer_credit_granted numeric(18, 2) not null default 0,
  refunds_issued numeric(18, 2) not null default 0,
  route_expenses numeric(18, 2) not null default 0,
  net_expected numeric(18, 2) not null default 0,
  net_submitted numeric(18, 2) not null default 0,
  variance_amount numeric(18, 2) not null default 0,
  variance_reason text,
  status public.reconciliation_status not null default 'draft',
  submitted_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reconciliation_number),
  unique (delivery_run_id)
);

create table public.route_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  expense_date date not null default current_date,
  expense_type text not null,
  amount numeric(18, 2) not null check (amount >= 0),
  payment_method_id uuid references public.payment_methods(id),
  receipt_file_path text,
  status public.route_expense_status not null default 'draft',
  recorded_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.delivery_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  delivery_note_id uuid references public.delivery_notes(id) on delete set null,
  customer_return_id uuid references public.customer_returns(id) on delete set null,
  return_reason text not null,
  status text not null default 'draft',
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.vehicle_stock_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid not null references public.delivery_runs(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_warehouse_id uuid references public.warehouses(id) on delete set null,
  reconciliation_number text not null,
  expected_stock_value numeric(18, 2) not null default 0,
  actual_stock_value numeric(18, 2) not null default 0,
  variance_value numeric(18, 2) not null default 0,
  status public.reconciliation_status not null default 'draft',
  reconciled_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, reconciliation_number),
  unique (delivery_run_id)
);

create table public.vehicle_stock_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reconciliation_id uuid not null references public.vehicle_stock_reconciliations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  expected_quantity numeric(18, 8) not null default 0,
  actual_quantity numeric(18, 8) not null default 0,
  variance_quantity numeric(18, 8) not null default 0,
  unit_cost numeric(18, 4),
  variance_value numeric(18, 4),
  variance_reason text
);

create table public.packaging_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  packaging_item_id uuid not null references public.returnable_packaging_items(id),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  delivery_run_id uuid references public.delivery_runs(id) on delete set null,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  transaction_type public.packaging_transaction_type not null,
  quantity numeric(18, 8) not null check (quantity >= 0),
  deposit_amount numeric(18, 2) not null default 0,
  replacement_charge_amount numeric(18, 2) not null default 0,
  reference_document_type text,
  reference_document_id uuid,
  reversal_reference_id uuid references public.packaging_ledger(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.customer_packaging_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  customer_id uuid not null references public.customers(id) on delete cascade,
  packaging_item_id uuid not null references public.returnable_packaging_items(id),
  closing_quantity numeric(18, 8) not null default 0,
  deposit_balance numeric(18, 2) not null default 0,
  damaged_quantity numeric(18, 8) not null default 0,
  lost_quantity numeric(18, 8) not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id, packaging_item_id, branch_id)
);

create table public.vehicle_packaging_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  delivery_run_id uuid references public.delivery_runs(id) on delete cascade,
  packaging_item_id uuid not null references public.returnable_packaging_items(id),
  closing_quantity numeric(18, 8) not null default 0,
  damaged_quantity numeric(18, 8) not null default 0,
  lost_quantity numeric(18, 8) not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, vehicle_id, delivery_run_id, packaging_item_id, branch_id)
);

create table public.distribution_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid references public.delivery_runs(id) on delete cascade,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  exception_type public.delivery_exception_type not null,
  severity public.delivery_exception_severity not null default 'warning',
  description text not null,
  reported_by uuid references public.profiles(id),
  reported_at timestamptz not null default now(),
  attachment_path text,
  assigned_user_id uuid references public.profiles(id),
  resolution_status public.delivery_exception_status not null default 'open',
  resolution_notes text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);

create table public.delivery_timeline_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  delivery_run_id uuid references public.delivery_runs(id) on delete cascade,
  delivery_stop_id uuid references public.delivery_stops(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  event_time timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id)
);

create table public.distribution_accounting_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  transaction_type text not null,
  transaction_id uuid,
  transaction_date timestamptz not null default now(),
  currency text not null default 'KES',
  debit_amount numeric(18, 2) not null default 0,
  credit_amount numeric(18, 2) not null default 0,
  suggested_account_role text,
  reference text,
  posting_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace function public.current_user_assigned_to_delivery_run(target_run_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.delivery_run_staff_assignments a
    where a.delivery_run_id = target_run_id
      and a.profile_id = auth.uid()
      and a.active = true
  )
  or exists (
    select 1
    from public.delivery_runs dr
    join public.drivers d on d.id in (dr.primary_driver_id, dr.assistant_driver_id)
    where dr.id = target_run_id
      and d.profile_id = auth.uid()
      and d.active = true
  );
$$;

create or replace function public.prevent_closed_delivery_run_update()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'closed' and coalesce(new.reopen_reason, '') = coalesce(old.reopen_reason, '') then
    raise exception 'Closed delivery runs are immutable. Reopen with approval before changes.';
  end if;
  return new;
end;
$$;

create trigger delivery_runs_closed_guard
before update on public.delivery_runs
for each row execute function public.prevent_closed_delivery_run_update();

create or replace function public.dispatch_delivery_run(target_run_id uuid, target_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  run_record public.delivery_runs%rowtype;
  sheet_record public.loading_sheets%rowtype;
  item record;
begin
  select * into run_record from public.delivery_runs where id = target_run_id for update;
  if not found then
    raise exception 'Delivery run not found.';
  end if;
  if public.current_user_business_role(run_record.business_id) not in ('owner','manager') then
    raise exception 'Not authorised to dispatch this delivery run.';
  end if;
  if run_record.status not in ('approved','ready_for_dispatch','loading') then
    raise exception 'Delivery run is not ready for dispatch.';
  end if;
  if run_record.vehicle_id is null or run_record.primary_driver_id is null then
    raise exception 'Vehicle and primary driver are required before dispatch.';
  end if;
  if run_record.dispatch_warehouse_id is null or run_record.vehicle_warehouse_id is null then
    raise exception 'Dispatch and vehicle stock warehouses are required.';
  end if;
  if exists (
    select 1 from public.stock_movements
    where reference_document_type = 'delivery_run_dispatch'
      and reference_document_id = target_run_id
  ) then
    raise exception 'Dispatch stock movements have already been posted.';
  end if;

  select * into sheet_record
  from public.loading_sheets
  where delivery_run_id = target_run_id
    and status in ('verified','loaded','ready_for_verification')
  order by created_at desc
  limit 1;
  if not found then
    raise exception 'A verified loading sheet is required before dispatch.';
  end if;

  for item in
    select *
    from public.loading_sheet_items
    where loading_sheet_id = sheet_record.id
      and loaded_quantity > 0
  loop
    insert into public.stock_movements (
      business_id, branch_id, warehouse_id, product_id, variant_id, batch_id, serial_number,
      movement_type, direction, quantity_base, display_quantity, display_unit_id,
      unit_conversion_factor, unit_cost, total_cost, reference_document_type,
      reference_document_id, reference_number, reason, created_by
    )
    values (
      run_record.business_id, run_record.branch_id, item.warehouse_id, item.product_id, item.variant_id, item.batch_id, item.serial_number,
      'transfer_out', 'out', item.base_quantity, item.loaded_quantity, item.unit_id,
      case when item.loaded_quantity = 0 then 1 else item.base_quantity / item.loaded_quantity end,
      item.unit_cost, item.total_inventory_value, 'delivery_run_dispatch',
      target_run_id, run_record.delivery_run_number, 'Warehouse to vehicle stock', target_user_id
    );

    insert into public.stock_movements (
      business_id, branch_id, warehouse_id, product_id, variant_id, batch_id, serial_number,
      movement_type, direction, quantity_base, display_quantity, display_unit_id,
      unit_conversion_factor, unit_cost, total_cost, reference_document_type,
      reference_document_id, reference_number, reason, created_by
    )
    values (
      run_record.business_id, run_record.branch_id, run_record.vehicle_warehouse_id, item.product_id, item.variant_id, item.batch_id, item.serial_number,
      'transfer_in', 'in', item.base_quantity, item.loaded_quantity, item.unit_id,
      case when item.loaded_quantity = 0 then 1 else item.base_quantity / item.loaded_quantity end,
      item.unit_cost, item.total_inventory_value, 'delivery_run_dispatch',
      target_run_id, run_record.delivery_run_number, 'Vehicle stock received for delivery run', target_user_id
    );
  end loop;

  update public.loading_sheets
  set status = 'dispatched', dispatch_time = now(), updated_at = now()
  where id = sheet_record.id;

  update public.delivery_runs
  set status = 'dispatched', actual_departure_time = coalesce(actual_departure_time, now()), dispatched_by = target_user_id, updated_at = now()
  where id = target_run_id;

  update public.delivery_stops
  set status = 'en_route', updated_at = now()
  where delivery_run_id = target_run_id
    and status in ('planned','ready');

  insert into public.delivery_timeline_events (business_id, branch_id, delivery_run_id, route_id, vehicle_id, event_type, created_by)
  values (run_record.business_id, run_record.branch_id, target_run_id, run_record.route_id, run_record.vehicle_id, 'delivery_run_dispatched', target_user_id);
end;
$$;

create or replace function public.confirm_delivery_note_stock(target_delivery_note_id uuid, target_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  note_record public.delivery_notes%rowtype;
  run_record public.delivery_runs%rowtype;
  recognition public.stock_recognition_point;
  item record;
begin
  select * into note_record from public.delivery_notes where id = target_delivery_note_id for update;
  if not found then
    raise exception 'Delivery note not found.';
  end if;
  if public.current_user_business_role(note_record.business_id) not in ('owner','manager') and not public.current_user_assigned_to_delivery_run(note_record.delivery_run_id) then
    raise exception 'Not authorised to confirm this delivery.';
  end if;
  if exists (
    select 1 from public.stock_movements
    where reference_document_type = 'delivery_confirmation'
      and reference_document_id = target_delivery_note_id
  ) then
    raise exception 'Delivery stock movements have already been posted.';
  end if;

  select * into run_record from public.delivery_runs where id = note_record.delivery_run_id;
  select stock_recognition_point into recognition
  from public.operational_preferences
  where business_id = note_record.business_id;
  recognition := coalesce(recognition, 'on_dispatch');

  if recognition <> 'on_invoice' then
    if run_record.vehicle_warehouse_id is null then
      raise exception 'Vehicle stock warehouse is required for delivery stock-out.';
    end if;
    for item in
      select *
      from public.delivery_note_items
      where delivery_note_id = target_delivery_note_id
        and delivered_quantity > 0
    loop
      insert into public.stock_movements (
        business_id, branch_id, warehouse_id, product_id, variant_id, batch_id, serial_number,
        movement_type, direction, quantity_base, display_quantity, display_unit_id,
        unit_conversion_factor, reference_document_type, reference_document_id, reference_number, reason, created_by
      )
      values (
        note_record.business_id, note_record.branch_id, run_record.vehicle_warehouse_id, item.product_id, item.variant_id, item.batch_id, item.serial_number,
        'sale', 'out', item.base_quantity, item.delivered_quantity, item.unit_id,
        case when item.delivered_quantity = 0 then 1 else item.base_quantity / item.delivered_quantity end,
        'delivery_confirmation', target_delivery_note_id, note_record.delivery_note_number, 'Delivered from vehicle stock', target_user_id
      );
    end loop;
  end if;

  update public.delivery_notes
  set status = 'delivered', delivered_at = now(), proof_of_delivery_status = 'verified', updated_at = now()
  where id = target_delivery_note_id;

  update public.delivery_stops
  set status = 'delivered', completion_time = now(), updated_at = now()
  where id = note_record.delivery_stop_id;

  insert into public.delivery_timeline_events (business_id, branch_id, delivery_run_id, delivery_stop_id, customer_id, event_type, created_by)
  values (note_record.business_id, note_record.branch_id, note_record.delivery_run_id, note_record.delivery_stop_id, note_record.customer_id, 'delivery_completed', target_user_id);
end;
$$;

create or replace function public.apply_packaging_ledger_to_balances()
returns trigger
language plpgsql
as $$
declare
  signed_quantity numeric(18, 8);
begin
  signed_quantity := case
    when new.transaction_type in ('opening_balance','issued_to_customer','lost','damaged') then new.quantity
    when new.transaction_type in ('returned_by_customer','collected_from_customer','returned_to_warehouse','reversal') then -new.quantity
    else 0
  end;

  if new.customer_id is not null then
    insert into public.customer_packaging_balances (business_id, branch_id, customer_id, packaging_item_id, closing_quantity, deposit_balance)
    values (new.business_id, new.branch_id, new.customer_id, new.packaging_item_id, 0, 0)
    on conflict (business_id, customer_id, packaging_item_id, branch_id) do nothing;

    update public.customer_packaging_balances
    set closing_quantity = closing_quantity + signed_quantity,
        deposit_balance = deposit_balance + new.deposit_amount - new.replacement_charge_amount,
        damaged_quantity = damaged_quantity + case when new.transaction_type = 'damaged' then new.quantity else 0 end,
        lost_quantity = lost_quantity + case when new.transaction_type = 'lost' then new.quantity else 0 end,
        updated_at = now()
    where business_id = new.business_id
      and branch_id = new.branch_id
      and customer_id = new.customer_id
      and packaging_item_id = new.packaging_item_id;
  end if;

  if new.vehicle_id is not null then
    insert into public.vehicle_packaging_balances (business_id, branch_id, vehicle_id, delivery_run_id, packaging_item_id, closing_quantity)
    values (new.business_id, new.branch_id, new.vehicle_id, new.delivery_run_id, new.packaging_item_id, 0)
    on conflict (business_id, vehicle_id, delivery_run_id, packaging_item_id, branch_id) do nothing;

    update public.vehicle_packaging_balances
    set closing_quantity = closing_quantity + case
          when new.transaction_type in ('loaded_to_vehicle','collected_from_customer') then new.quantity
          when new.transaction_type in ('issued_to_customer','returned_to_warehouse','lost','damaged') then -new.quantity
          else 0
        end,
        damaged_quantity = damaged_quantity + case when new.transaction_type = 'damaged' then new.quantity else 0 end,
        lost_quantity = lost_quantity + case when new.transaction_type = 'lost' then new.quantity else 0 end,
        updated_at = now()
    where business_id = new.business_id
      and branch_id = new.branch_id
      and vehicle_id = new.vehicle_id
      and (delivery_run_id = new.delivery_run_id or (delivery_run_id is null and new.delivery_run_id is null))
      and packaging_item_id = new.packaging_item_id;
  end if;

  return new;
end;
$$;

create trigger packaging_ledger_apply_balances
after insert on public.packaging_ledger
for each row execute function public.apply_packaging_ledger_to_balances();

create index customers_business_route_idx on public.customers(business_id, default_route_id, status);
create index customer_addresses_customer_route_idx on public.customer_addresses(business_id, customer_id, route_id, active);
create index sales_orders_delivery_idx on public.sales_orders(business_id, branch_id, requested_delivery_date, status);
create index sales_invoices_delivery_idx on public.sales_invoices(business_id, branch_id, delivery_status, status);
create index route_schedules_route_idx on public.route_schedules(business_id, branch_id, route_id, active);
create index delivery_runs_date_status_idx on public.delivery_runs(business_id, branch_id, delivery_date, status);
create index delivery_runs_route_vehicle_idx on public.delivery_runs(business_id, route_id, vehicle_id, primary_driver_id);
create unique index delivery_vehicle_day_active_idx on public.delivery_runs(business_id, vehicle_id, delivery_date)
  where vehicle_id is not null and status not in ('closed','cancelled','rejected');
create unique index delivery_driver_day_active_idx on public.delivery_runs(business_id, primary_driver_id, delivery_date)
  where primary_driver_id is not null and status not in ('closed','cancelled','rejected');
create index delivery_stops_run_status_idx on public.delivery_stops(business_id, delivery_run_id, status, stop_sequence);
create index delivery_stops_customer_idx on public.delivery_stops(business_id, customer_id, status);
create index loading_sheets_run_idx on public.loading_sheets(business_id, delivery_run_id, status);
create index loading_items_sheet_product_idx on public.loading_sheet_items(business_id, loading_sheet_id, product_id, variant_id);
create index delivery_notes_run_status_idx on public.delivery_notes(business_id, delivery_run_id, status);
create index pod_delivery_note_idx on public.proof_of_delivery_records(business_id, delivery_note_id, proof_type);
create index collections_run_status_idx on public.delivery_collections(business_id, delivery_run_id, status);
create index route_expenses_run_idx on public.route_expenses(business_id, delivery_run_id, status);
create index packaging_ledger_customer_idx on public.packaging_ledger(business_id, customer_id, packaging_item_id, created_at desc);
create index packaging_ledger_vehicle_idx on public.packaging_ledger(business_id, vehicle_id, delivery_run_id, packaging_item_id);
create index exceptions_run_status_idx on public.distribution_exceptions(business_id, delivery_run_id, resolution_status, severity);
create index timeline_run_time_idx on public.delivery_timeline_events(business_id, delivery_run_id, event_time desc);

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_items enable row level security;
alter table public.customer_payments enable row level security;
alter table public.customer_payment_allocations enable row level security;
alter table public.customer_returns enable row level security;
alter table public.customer_return_items enable row level security;
alter table public.route_schedules enable row level security;
alter table public.delivery_runs enable row level security;
alter table public.delivery_run_staff_assignments enable row level security;
alter table public.delivery_stops enable row level security;
alter table public.delivery_stop_documents enable row level security;
alter table public.loading_sheets enable row level security;
alter table public.loading_sheet_items enable row level security;
alter table public.delivery_notes enable row level security;
alter table public.delivery_note_items enable row level security;
alter table public.proof_of_delivery_records enable row level security;
alter table public.delivery_collections enable row level security;
alter table public.route_collection_reconciliations enable row level security;
alter table public.route_expenses enable row level security;
alter table public.delivery_returns enable row level security;
alter table public.vehicle_stock_reconciliations enable row level security;
alter table public.vehicle_stock_reconciliation_items enable row level security;
alter table public.packaging_ledger enable row level security;
alter table public.customer_packaging_balances enable row level security;
alter table public.vehicle_packaging_balances enable row level security;
alter table public.distribution_exceptions enable row level security;
alter table public.delivery_timeline_events enable row level security;
alter table public.distribution_accounting_events enable row level security;

create policy customers_member_read on public.customers for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy customers_manager_write on public.customers for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy customer_addresses_member_read on public.customer_addresses for select using (public.current_user_has_business_access(business_id));
create policy customer_addresses_manager_write on public.customer_addresses for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy sales_docs_member_read on public.sales_orders for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy sales_docs_manager_write on public.sales_orders for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy sales_order_items_member_read on public.sales_order_items for select using (public.current_user_has_business_access(business_id));
create policy sales_order_items_manager_write on public.sales_order_items for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy invoices_member_read on public.sales_invoices for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy invoices_manager_write on public.sales_invoices for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy invoice_items_member_read on public.sales_invoice_items for select using (public.current_user_has_business_access(business_id));
create policy invoice_items_manager_write on public.sales_invoice_items for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy customer_payments_member_read on public.customer_payments for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy customer_payments_manager_write on public.customer_payments for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy payment_allocations_member_read on public.customer_payment_allocations for select using (public.current_user_has_business_access(business_id));
create policy payment_allocations_manager_write on public.customer_payment_allocations for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy customer_returns_member_read on public.customer_returns for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy customer_returns_manager_write on public.customer_returns for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy customer_return_items_member_read on public.customer_return_items for select using (public.current_user_has_business_access(business_id));
create policy customer_return_items_manager_write on public.customer_return_items for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy distribution_run_member_read on public.delivery_runs for select using ((public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) or public.current_user_assigned_to_delivery_run(id));
create policy distribution_run_manager_write on public.delivery_runs for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy distribution_child_member_read on public.delivery_stops for select using ((public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) or public.current_user_assigned_to_delivery_run(delivery_run_id));
create policy distribution_child_manager_write on public.delivery_stops for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy route_schedules_member_read on public.route_schedules for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy route_schedules_manager_write on public.route_schedules for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy distribution_run_assignments_read on public.delivery_run_staff_assignments for select using (public.current_user_has_business_access(business_id) or profile_id = auth.uid());
create policy distribution_run_assignments_manager_write on public.delivery_run_staff_assignments for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy distribution_stop_documents_read on public.delivery_stop_documents for select using (public.current_user_has_business_access(business_id));
create policy distribution_stop_documents_write on public.delivery_stop_documents for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy loading_sheets_read on public.loading_sheets for select using ((public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) or public.current_user_assigned_to_delivery_run(delivery_run_id));
create policy loading_sheets_write on public.loading_sheets for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy loading_items_read on public.loading_sheet_items for select using (public.current_user_has_business_access(business_id));
create policy loading_items_write on public.loading_sheet_items for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy delivery_notes_read on public.delivery_notes for select using ((public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) or public.current_user_assigned_to_delivery_run(delivery_run_id));
create policy delivery_notes_write on public.delivery_notes for all using ((public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) or public.current_user_assigned_to_delivery_run(delivery_run_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy delivery_note_items_read on public.delivery_note_items for select using (public.current_user_has_business_access(business_id));
create policy delivery_note_items_write on public.delivery_note_items for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy pod_records_read on public.proof_of_delivery_records for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy pod_records_write on public.proof_of_delivery_records for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy delivery_collections_read on public.delivery_collections for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy delivery_collections_write on public.delivery_collections for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy route_reconciliations_read on public.route_collection_reconciliations for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy route_reconciliations_owner_write on public.route_collection_reconciliations for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy route_expenses_read on public.route_expenses for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy route_expenses_write on public.route_expenses for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy delivery_returns_read on public.delivery_returns for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy delivery_returns_write on public.delivery_returns for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy vehicle_stock_reconciliations_read on public.vehicle_stock_reconciliations for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy vehicle_stock_reconciliations_write on public.vehicle_stock_reconciliations for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id)) with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));
create policy vehicle_stock_reconciliation_items_read on public.vehicle_stock_reconciliation_items for select using (public.current_user_has_business_access(business_id));
create policy vehicle_stock_reconciliation_items_write on public.vehicle_stock_reconciliation_items for all using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy packaging_ledger_read on public.packaging_ledger for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy packaging_ledger_write on public.packaging_ledger for insert with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy customer_packaging_read on public.customer_packaging_balances for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy vehicle_packaging_read on public.vehicle_packaging_balances for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy distribution_exceptions_read on public.distribution_exceptions for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy distribution_exceptions_write on public.distribution_exceptions for all using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id)) with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy timeline_read on public.delivery_timeline_events for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy timeline_insert on public.delivery_timeline_events for insert with check (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy distribution_accounting_owner_read on public.distribution_accounting_events for select using (public.current_user_business_role(business_id) = 'owner');
create policy distribution_accounting_owner_insert on public.distribution_accounting_events for insert with check (public.current_user_business_role(business_id) = 'owner');

grant select, insert, update, delete on
  public.customers,
  public.customer_addresses,
  public.sales_orders,
  public.sales_order_items,
  public.sales_invoices,
  public.sales_invoice_items,
  public.customer_payments,
  public.customer_payment_allocations,
  public.customer_returns,
  public.customer_return_items,
  public.route_schedules,
  public.delivery_runs,
  public.delivery_run_staff_assignments,
  public.delivery_stops,
  public.delivery_stop_documents,
  public.loading_sheets,
  public.loading_sheet_items,
  public.delivery_notes,
  public.delivery_note_items,
  public.proof_of_delivery_records,
  public.delivery_collections,
  public.route_collection_reconciliations,
  public.route_expenses,
  public.delivery_returns,
  public.vehicle_stock_reconciliations,
  public.vehicle_stock_reconciliation_items,
  public.packaging_ledger,
  public.customer_packaging_balances,
  public.vehicle_packaging_balances,
  public.distribution_exceptions,
  public.delivery_timeline_events,
  public.distribution_accounting_events
to authenticated;

revoke execute on function public.current_user_assigned_to_delivery_run(uuid) from public;
revoke execute on function public.prevent_closed_delivery_run_update() from public;
revoke execute on function public.dispatch_delivery_run(uuid, uuid) from public;
revoke execute on function public.confirm_delivery_note_stock(uuid, uuid) from public;
revoke execute on function public.apply_packaging_ledger_to_balances() from public;
grant execute on function public.dispatch_delivery_run(uuid, uuid) to authenticated;
grant execute on function public.confirm_delivery_note_stock(uuid, uuid) to authenticated;
grant execute on function public.current_user_assigned_to_delivery_run(uuid) to authenticated;
