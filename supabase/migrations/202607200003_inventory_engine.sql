create type public.product_type as enum (
  'stock_item',
  'service',
  'non_stock_item',
  'returnable_packaging',
  'raw_material',
  'finished_good',
  'consumable',
  'expense_item',
  'other'
);

create type public.costing_method as enum ('weighted_average', 'fifo', 'standard');
create type public.stock_direction as enum ('in', 'out', 'neutral');
create type public.approval_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'posted');
create type public.stock_movement_type as enum (
  'opening_stock',
  'purchase_receipt',
  'sale',
  'customer_return',
  'supplier_return',
  'transfer_out',
  'transfer_in',
  'adjustment_increase',
  'adjustment_decrease',
  'damaged',
  'expired',
  'lost',
  'stolen',
  'spoilage',
  'internal_use',
  'promotional_issue',
  'production_consumption',
  'production_output',
  'reservation',
  'reservation_release',
  'returnable_packaging_issue',
  'returnable_packaging_return',
  'cost_revaluation',
  'reversal',
  'other'
);
create type public.transfer_status as enum ('draft', 'pending_approval', 'approved', 'dispatched', 'in_transit', 'partially_received', 'received', 'cancelled', 'rejected');
create type public.stock_count_status as enum ('draft', 'in_progress', 'submitted', 'under_review', 'approved', 'posted', 'cancelled');
create type public.batch_status as enum ('active', 'near_expiry', 'expired', 'quarantined', 'recalled', 'depleted', 'closed');
create type public.serial_status as enum ('available', 'reserved', 'sold', 'returned', 'damaged', 'lost', 'in_transit', 'archived');
create type public.reservation_status as enum ('active', 'partially_used', 'used', 'released', 'expired', 'cancelled');
create type public.inventory_period_status as enum ('open', 'soft_closed', 'closed', 'reopened');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_name text not null,
  short_name text,
  product_code text not null,
  sku text,
  barcode text,
  description text,
  product_type public.product_type not null default 'stock_item',
  category_id uuid references public.product_categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  manufacturer text,
  base_unit_id uuid references public.units_of_measure(id),
  purchase_unit_id uuid references public.units_of_measure(id),
  selling_unit_id uuid references public.units_of_measure(id),
  track_inventory boolean not null default true,
  track_batches boolean not null default false,
  track_expiry boolean not null default false,
  track_serial_numbers boolean not null default false,
  track_returnable_packaging boolean not null default false,
  tax_category text,
  vat_status text,
  default_sales_tax_id uuid references public.tax_rates(id) on delete set null,
  default_purchase_tax_id uuid references public.tax_rates(id) on delete set null,
  preferred_costing_method public.costing_method not null default 'weighted_average',
  standard_cost numeric(18, 4),
  default_selling_price_placeholder numeric(18, 2),
  minimum_selling_price numeric(18, 2),
  reorder_level numeric(18, 4) not null default 0,
  reorder_quantity numeric(18, 4) not null default 0,
  maximum_stock_level numeric(18, 4),
  lead_time_days integer,
  shelf_life_days integer,
  weight numeric(18, 4),
  volume numeric(18, 4),
  image_path text,
  active boolean not null default true,
  archived boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_code),
  unique (business_id, sku),
  unique (business_id, barcode),
  check (product_type not in ('service', 'non_stock_item') or track_inventory = false)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null,
  variant_code text not null,
  sku text,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  base_unit_id uuid references public.units_of_measure(id),
  purchase_unit_id uuid references public.units_of_measure(id),
  selling_unit_id uuid references public.units_of_measure(id),
  weight numeric(18, 4),
  volume numeric(18, 4),
  reorder_level numeric(18, 4),
  minimum_selling_price numeric(18, 2),
  track_stock boolean not null default true,
  shares_parent_classification boolean not null default true,
  own_barcode boolean not null default false,
  own_sku boolean not null default false,
  separate_pricing boolean not null default false,
  separate_reorder_levels boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, variant_code),
  unique (business_id, sku),
  unique (business_id, barcode)
);

create table public.product_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  attribute_id uuid not null references public.product_attribute_definitions(id) on delete cascade,
  value text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, attribute_id, value)
);

create table public.product_variant_attribute_values (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  attribute_value_id uuid not null references public.product_attribute_values(id) on delete cascade,
  primary key (variant_id, attribute_value_id)
);

create table public.product_pack_units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  from_unit_id uuid not null references public.units_of_measure(id),
  to_unit_id uuid not null references public.units_of_measure(id),
  conversion_factor numeric(18, 8) not null check (conversion_factor > 0),
  purchase_enabled boolean not null default true,
  sales_enabled boolean not null default true,
  barcode text,
  sku text,
  default_purchase_unit boolean not null default false,
  default_sales_unit boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, variant_id, from_unit_id, to_unit_id)
);

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  pack_unit_id uuid references public.product_pack_units(id) on delete cascade,
  barcode text not null,
  barcode_type text not null default 'manual',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, barcode)
);

create table public.product_bundle_components (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  component_variant_id uuid references public.product_variants(id) on delete restrict,
  quantity numeric(18, 8) not null check (quantity > 0),
  unit_id uuid not null references public.units_of_measure(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  batch_number text not null,
  supplier_batch_reference text,
  manufacturing_date date,
  received_date date not null default current_date,
  expiry_date date,
  initial_quantity numeric(18, 8) not null default 0,
  remaining_quantity numeric(18, 8) not null default 0,
  unit_cost numeric(18, 4),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  status public.batch_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, variant_id, batch_number, branch_id, warehouse_id),
  check (expiry_date is null or manufacturing_date is null or expiry_date >= manufacturing_date)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  serial_number text,
  movement_type public.stock_movement_type not null,
  direction public.stock_direction not null,
  quantity_base numeric(18, 8) not null check (quantity_base >= 0),
  display_quantity numeric(18, 8) not null check (display_quantity >= 0),
  display_unit_id uuid references public.units_of_measure(id),
  unit_conversion_factor numeric(18, 8) not null default 1 check (unit_conversion_factor > 0),
  unit_cost numeric(18, 4),
  total_cost numeric(18, 4),
  currency text not null default 'KES',
  reference_document_type text,
  reference_document_id uuid,
  reference_number text,
  reason text,
  notes text,
  movement_date timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approval_status public.approval_status not null default 'posted',
  reversal_reference_id uuid references public.stock_movements(id),
  is_reversal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  quantity_on_hand numeric(18, 8) not null default 0,
  reserved_quantity numeric(18, 8) not null default 0,
  available_quantity numeric(18, 8) generated always as (quantity_on_hand - reserved_quantity) stored,
  average_unit_cost numeric(18, 4) not null default 0,
  total_inventory_value numeric(18, 4) not null default 0,
  last_movement_at timestamptz,
  last_count_at timestamptz,
  reorder_status text not null default 'healthy',
  updated_at timestamptz not null default now(),
  unique (business_id, branch_id, warehouse_id, product_id, variant_id, batch_id)
);

create table public.fifo_cost_layers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  receipt_movement_id uuid references public.stock_movements(id),
  receipt_date timestamptz not null default now(),
  original_quantity numeric(18, 8) not null check (original_quantity >= 0),
  remaining_quantity numeric(18, 8) not null check (remaining_quantity >= 0),
  unit_cost numeric(18, 4) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.serial_numbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  branch_id uuid references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  batch_id uuid references public.inventory_batches(id),
  serial_number text not null,
  status public.serial_status not null default 'available',
  received_date date,
  cost numeric(18, 4),
  current_location text,
  last_movement_id uuid references public.stock_movements(id),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index serial_numbers_one_active on public.serial_numbers (business_id, serial_number) where active = true;

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_number text not null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  batch_id uuid references public.inventory_batches(id),
  quantity_base numeric(18, 8) not null check (quantity_base > 0),
  unit_id uuid references public.units_of_measure(id),
  reference_type text,
  reference_id uuid,
  reserved_by uuid references public.profiles(id),
  reservation_date timestamptz not null default now(),
  expiry_date timestamptz,
  status public.reservation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reservation_number)
);

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transfer_number text not null,
  from_branch_id uuid not null references public.branches(id),
  from_warehouse_id uuid not null references public.warehouses(id),
  to_branch_id uuid not null references public.branches(id),
  to_warehouse_id uuid not null references public.warehouses(id),
  transfer_date date not null default current_date,
  expected_arrival_date date,
  status public.transfer_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  dispatched_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  dispatch_date timestamptz,
  receipt_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, transfer_number)
);

create table public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  quantity numeric(18, 8) not null check (quantity > 0),
  unit_id uuid references public.units_of_measure(id),
  base_quantity numeric(18, 8) not null check (base_quantity > 0),
  unit_cost numeric(18, 4),
  sent_quantity numeric(18, 8) not null default 0,
  received_quantity numeric(18, 8) not null default 0,
  difference numeric(18, 8) not null default 0,
  difference_reason text,
  created_at timestamptz not null default now()
);

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  adjustment_number text not null,
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  adjustment_date date not null default current_date,
  reason text not null,
  notes text,
  supporting_attachment_path text,
  created_by uuid references public.profiles(id),
  approval_status public.approval_status not null default 'draft',
  approved_by uuid references public.profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, adjustment_number)
);

create table public.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  adjustment_id uuid not null references public.stock_adjustments(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  current_quantity numeric(18, 8) not null default 0,
  adjustment_quantity numeric(18, 8) not null,
  new_quantity numeric(18, 8) not null,
  unit_id uuid references public.units_of_measure(id),
  unit_cost numeric(18, 4),
  value_effect numeric(18, 4),
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.stock_count_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  count_number text not null,
  count_type text not null,
  status public.stock_count_status not null default 'draft',
  snapshot_at timestamptz,
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  assigned_user_ids uuid[] not null default '{}',
  count_instructions text,
  blind_count boolean not null default false,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, count_number)
);

create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  count_session_id uuid not null references public.stock_count_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id),
  expected_quantity numeric(18, 8),
  counted_quantity numeric(18, 8),
  variance numeric(18, 8),
  variance_value numeric(18, 4),
  notes text,
  created_at timestamptz not null default now()
);

create table public.reorder_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  branch_id uuid references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  minimum_stock_level numeric(18, 8) not null default 0,
  reorder_point numeric(18, 8) not null default 0,
  reorder_quantity numeric(18, 8) not null default 0,
  maximum_stock_level numeric(18, 8),
  supplier_lead_time_days integer,
  safety_stock numeric(18, 8) not null default 0,
  preferred_supplier_id uuid,
  review_frequency text not null default 'monthly',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, variant_id, branch_id, warehouse_id)
);

create table public.inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  branch_id uuid references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  batch_id uuid references public.inventory_batches(id),
  alert_type text not null,
  priority public.notification_priority not null default 'information',
  title text not null,
  body text,
  status text not null default 'active',
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  snoozed_until timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, product_id, variant_id, branch_id, warehouse_id, batch_id, alert_type, status)
);

create table public.inventory_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status public.inventory_period_status not null default 'open',
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, period_start, period_end),
  check (period_end >= period_start)
);

create table public.inventory_approval_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_type text not null,
  transaction_type text not null,
  transaction_id uuid not null,
  requester_id uuid references public.profiles(id),
  reason text,
  value_effect numeric(18, 4),
  approver_id uuid references public.profiles(id),
  decision text,
  comments text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.product_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_type text not null check (import_type in ('products', 'opening_stock')),
  file_name text,
  status text not null default 'draft',
  row_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.product_import_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_batch_id uuid not null references public.product_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (import_batch_id, row_number)
);

create index products_business_active_idx on public.products(business_id, active, archived);
create index products_category_brand_idx on public.products(business_id, category_id, brand_id);
create index variants_product_idx on public.product_variants(business_id, product_id, active);
create index movements_business_date_idx on public.stock_movements(business_id, movement_date desc);
create index movements_product_location_idx on public.stock_movements(business_id, product_id, variant_id, branch_id, warehouse_id);
create index balances_location_idx on public.stock_balances(business_id, branch_id, warehouse_id, product_id, variant_id);
create index fifo_layers_available_idx on public.fifo_cost_layers(business_id, product_id, variant_id, branch_id, warehouse_id, receipt_date) where active = true and remaining_quantity > 0;
create index batches_expiry_idx on public.inventory_batches(business_id, expiry_date, status);
create index transfers_status_idx on public.stock_transfers(business_id, status, transfer_date);
create index alerts_active_idx on public.inventory_alerts(business_id, status, priority);

create or replace function public.prevent_stock_movement_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Posted stock movements are immutable. Use a reversal or adjustment.';
end;
$$;

create trigger stock_movements_immutable_update
before update or delete on public.stock_movements
for each row execute function public.prevent_stock_movement_update();

create or replace function public.apply_stock_movement_to_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signed_quantity numeric(18, 8);
  existing_quantity numeric(18, 8);
  existing_cost numeric(18, 4);
  new_quantity numeric(18, 8);
  new_average_cost numeric(18, 4);
begin
  if new.approval_status <> 'posted' then
    return new;
  end if;

  signed_quantity := case
    when new.direction = 'in' then new.quantity_base
    when new.direction = 'out' then -new.quantity_base
    else 0
  end;

  select quantity_on_hand, average_unit_cost
    into existing_quantity, existing_cost
  from public.stock_balances
  where business_id = new.business_id
    and branch_id = new.branch_id
    and warehouse_id = new.warehouse_id
    and product_id = new.product_id
    and variant_id is not distinct from new.variant_id
    and batch_id is not distinct from new.batch_id
  for update;

  if not found then
    existing_quantity := 0;
    existing_cost := coalesce(new.unit_cost, 0);
    insert into public.stock_balances (
      business_id, branch_id, warehouse_id, product_id, variant_id, batch_id,
      quantity_on_hand, average_unit_cost, total_inventory_value, last_movement_at
    )
    values (
      new.business_id, new.branch_id, new.warehouse_id, new.product_id, new.variant_id, new.batch_id,
      0, existing_cost, 0, new.movement_date
    );
  end if;

  new_quantity := existing_quantity + signed_quantity;

  if new.direction = 'in' and coalesce(new.unit_cost, 0) > 0 and (existing_quantity + new.quantity_base) > 0 then
    new_average_cost := ((existing_quantity * existing_cost) + (new.quantity_base * new.unit_cost)) / (existing_quantity + new.quantity_base);
  else
    new_average_cost := existing_cost;
  end if;

  update public.stock_balances
  set quantity_on_hand = new_quantity,
      average_unit_cost = new_average_cost,
      total_inventory_value = new_quantity * new_average_cost,
      last_movement_at = new.movement_date,
      updated_at = now()
  where business_id = new.business_id
    and branch_id = new.branch_id
    and warehouse_id = new.warehouse_id
    and product_id = new.product_id
    and variant_id is not distinct from new.variant_id
    and batch_id is not distinct from new.batch_id;

  if new.direction = 'in' and coalesce(new.unit_cost, 0) > 0 then
    insert into public.fifo_cost_layers (
      business_id, branch_id, warehouse_id, product_id, variant_id, batch_id,
      receipt_movement_id, receipt_date, original_quantity, remaining_quantity, unit_cost
    )
    values (
      new.business_id, new.branch_id, new.warehouse_id, new.product_id, new.variant_id, new.batch_id,
      new.id, new.movement_date, new.quantity_base, new.quantity_base, new.unit_cost
    );
  end if;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, new_value)
  values (new.business_id, new.created_by, 'stock_movement.posted', 'inventory', 'stock_movement', new.id, to_jsonb(new));

  return new;
end;
$$;

create trigger stock_movements_apply_balance
after insert on public.stock_movements
for each row execute function public.apply_stock_movement_to_balance();

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_attribute_definitions enable row level security;
alter table public.product_attribute_values enable row level security;
alter table public.product_variant_attribute_values enable row level security;
alter table public.product_pack_units enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.product_bundle_components enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_balances enable row level security;
alter table public.fifo_cost_layers enable row level security;
alter table public.serial_numbers enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.stock_count_sessions enable row level security;
alter table public.stock_count_items enable row level security;
alter table public.reorder_settings enable row level security;
alter table public.inventory_alerts enable row level security;
alter table public.inventory_periods enable row level security;
alter table public.inventory_approval_records enable row level security;
alter table public.product_import_batches enable row level security;
alter table public.product_import_rows enable row level security;

create policy products_member_read on public.products
  for select using (public.current_user_has_business_access(business_id));
create policy products_inventory_write on public.products
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy variants_member_read on public.product_variants
  for select using (public.current_user_has_business_access(business_id));
create policy variants_inventory_write on public.product_variants
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy inventory_config_member_read on public.product_attribute_definitions
  for select using (public.current_user_has_business_access(business_id));
create policy inventory_config_owner_write on public.product_attribute_definitions
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy inventory_attr_values_member_read on public.product_attribute_values
  for select using (public.current_user_has_business_access(business_id));
create policy inventory_attr_values_owner_write on public.product_attribute_values
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy variant_attribute_links_member_read on public.product_variant_attribute_values
  for select using (
    exists (
      select 1
      from public.product_variants pv
      where pv.id = variant_id
        and public.current_user_has_business_access(pv.business_id)
    )
  );
create policy variant_attribute_links_owner_write on public.product_variant_attribute_values
  for all using (
    exists (
      select 1
      from public.product_variants pv
      where pv.id = variant_id
        and public.current_user_business_role(pv.business_id) = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.product_variants pv
      join public.product_attribute_values pav on pav.id = attribute_value_id
      where pv.id = variant_id
        and pv.business_id = pav.business_id
        and public.current_user_business_role(pv.business_id) = 'owner'
    )
  );

create policy inventory_pack_member_read on public.product_pack_units
  for select using (public.current_user_has_business_access(business_id));
create policy inventory_pack_write on public.product_pack_units
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy inventory_barcodes_member_read on public.product_barcodes
  for select using (public.current_user_has_business_access(business_id));
create policy inventory_barcodes_write on public.product_barcodes
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy inventory_bundle_member_read on public.product_bundle_components
  for select using (public.current_user_has_business_access(business_id));
create policy inventory_bundle_write on public.product_bundle_components
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy batches_member_read on public.inventory_batches
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy batches_inventory_write on public.inventory_batches
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy movements_member_read on public.stock_movements
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy movements_inventory_insert on public.stock_movements
  for insert with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy balances_member_read on public.stock_balances
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));

create policy fifo_owner_read on public.fifo_cost_layers
  for select using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy serials_member_read on public.serial_numbers
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy serials_inventory_write on public.serial_numbers
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy reservations_member_read on public.inventory_reservations
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy reservations_inventory_write on public.inventory_reservations
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy transfers_member_read on public.stock_transfers
  for select using (
    public.current_user_has_business_access(business_id)
    and public.can_access_branch(business_id, from_branch_id)
    and public.can_access_branch(business_id, to_branch_id)
  );
create policy transfers_inventory_write on public.stock_transfers
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy transfer_items_member_read on public.stock_transfer_items
  for select using (public.current_user_has_business_access(business_id));
create policy transfer_items_inventory_write on public.stock_transfer_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy adjustments_member_read on public.stock_adjustments
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy adjustments_inventory_write on public.stock_adjustments
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy adjustment_items_member_read on public.stock_adjustment_items
  for select using (public.current_user_has_business_access(business_id));
create policy adjustment_items_inventory_write on public.stock_adjustment_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy counts_member_read on public.stock_count_sessions
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, branch_id));
create policy counts_inventory_write on public.stock_count_sessions
  for all using (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id))
  with check (public.current_user_business_role(business_id) in ('owner','manager') and public.can_access_branch(business_id, branch_id));

create policy count_items_member_read on public.stock_count_items
  for select using (public.current_user_has_business_access(business_id));
create policy count_items_inventory_write on public.stock_count_items
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy reorder_member_read on public.reorder_settings
  for select using (public.current_user_has_business_access(business_id));
create policy reorder_inventory_write on public.reorder_settings
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy inventory_alerts_member_read on public.inventory_alerts
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy inventory_alerts_member_update on public.inventory_alerts
  for update using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy periods_member_read on public.inventory_periods
  for select using (public.current_user_has_business_access(business_id));
create policy periods_owner_write on public.inventory_periods
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy approvals_member_read on public.inventory_approval_records
  for select using (public.current_user_has_business_access(business_id));
create policy approvals_owner_write on public.inventory_approval_records
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy imports_member_read on public.product_import_batches
  for select using (public.current_user_has_business_access(business_id));
create policy imports_inventory_write on public.product_import_batches
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

create policy import_rows_member_read on public.product_import_rows
  for select using (public.current_user_has_business_access(business_id));
create policy import_rows_inventory_write on public.product_import_rows
  for all using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

grant select, insert, update, delete on
  public.products,
  public.product_variants,
  public.product_attribute_definitions,
  public.product_attribute_values,
  public.product_variant_attribute_values,
  public.product_pack_units,
  public.product_barcodes,
  public.product_bundle_components,
  public.inventory_batches,
  public.stock_movements,
  public.stock_balances,
  public.fifo_cost_layers,
  public.serial_numbers,
  public.inventory_reservations,
  public.stock_transfers,
  public.stock_transfer_items,
  public.stock_adjustments,
  public.stock_adjustment_items,
  public.stock_count_sessions,
  public.stock_count_items,
  public.reorder_settings,
  public.inventory_alerts,
  public.inventory_periods,
  public.inventory_approval_records,
  public.product_import_batches,
  public.product_import_rows
to authenticated;

revoke execute on function public.apply_stock_movement_to_balance() from public;
