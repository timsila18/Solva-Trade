create type public.branch_type as enum (
  'head_office',
  'shop',
  'depot',
  'warehouse_branch',
  'distribution_centre',
  'restaurant_branch',
  'production_site',
  'mobile_outlet',
  'other'
);

create type public.warehouse_type as enum (
  'main_warehouse',
  'branch_store',
  'shop_floor',
  'cold_store',
  'returns_store',
  'damaged_goods_store',
  'transit_store',
  'vehicle_stock',
  'production_store',
  'other'
);

create type public.vehicle_type as enum ('van', 'pickup', 'truck', 'motorcycle', 'bicycle', 'other');
create type public.vehicle_ownership_type as enum ('owned', 'leased', 'hired', 'third_party');
create type public.unit_type as enum ('count', 'weight', 'volume', 'length', 'area', 'time', 'service', 'packaging', 'other');
create type public.reset_frequency as enum ('never', 'monthly', 'annually', 'financial_year');
create type public.notification_priority as enum ('information', 'action_required', 'warning', 'critical');
create type public.tax_document_status as enum ('not_required', 'pending', 'generated', 'synced', 'failed', 'manual', 'cancelled', 'needs_review');

alter table public.businesses
  add column if not exists alternative_phone text,
  add column if not exists postal_address text,
  add column if not exists town text,
  add column if not exists stamp_path text,
  add column if not exists signature_path text,
  add column if not exists invoice_footer text,
  add column if not exists terms_and_conditions text,
  add column if not exists default_customer_message text,
  add column if not exists default_payment_instructions text,
  add column if not exists industry_profile_code text,
  add column if not exists advanced_settings_enabled boolean not null default false;

alter table public.business_memberships
  add column if not exists branch_access_mode text not null default 'all' check (branch_access_mode in ('all', 'selected')),
  add column if not exists default_branch_id uuid,
  add column if not exists branch_ids uuid[] not null default '{}';

alter table public.notifications
  add column if not exists priority public.notification_priority not null default 'information';

create table public.industry_profiles (
  code text primary key,
  name text not null,
  description text,
  feature_flags jsonb not null default '{}'::jsonb,
  default_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.industry_profiles (code, name, description, feature_flags, default_preferences)
values
  ('distributor', 'Distributor', 'Routes, delivery vehicles, customer credit and returnable packaging.', '{"sales_routes":true,"delivery_vehicles":true,"drivers":true,"delivery_notes":true,"customer_credit":true,"wholesale_pricing":true,"route_collections":true,"vehicle_stock":true,"product_returns":true,"returnable_packaging":true,"multiple_suppliers":true,"delivery_proof":true,"customer_specific_pricing":true}'::jsonb, '{"stock_costing_method":"weighted_average"}'::jsonb),
  ('retail', 'Retail', 'Barcode support, quick sales, cashier workflow and stock counts.', '{"barcode_support":true,"quick_sales":true,"cashier_workflow":true,"retail_prices":true,"reorder_levels":true,"stock_counts":true}'::jsonb, '{}'::jsonb),
  ('fish_seafood', 'Fish and Seafood', 'Weight-based units, fresh stock, spoilage and cold storage.', '{"weight_based_units":true,"kilograms":true,"crates":true,"pieces":true,"fresh_stock":true,"spoilage_tracking":true,"daily_purchasing":true,"source_details":true,"cold_storage":true}'::jsonb, '{}'::jsonb),
  ('hardware', 'Hardware', 'Pieces, metres, bundles, bags, sheets and product variations.', '{"pieces":true,"length":true,"metres":true,"bundles":true,"bags":true,"sheets":true,"wholesale_prices":true,"retail_prices":true,"product_variations":true}'::jsonb, '{}'::jsonb),
  ('restaurant', 'Restaurant', 'Ingredients, wastage, preparation units and menu products.', '{"ingredients":true,"recipes":true,"wastage":true,"preparation_units":true,"branch_stock":true,"menu_products":true}'::jsonb, '{}'::jsonb),
  ('pharmacy', 'Pharmacy', 'Batch numbers, expiry dates and controlled stock preparation.', '{"batch_numbers":true,"expiry_dates":true,"prescription_required":true,"controlled_stock_permissions":true}'::jsonb, '{}'::jsonb),
  ('service_business', 'Service Business', 'Service items, non-stock invoices and time-based billing.', '{"service_items":true,"non_stock_invoices":true,"time_based_billing":true,"job_references":true}'::jsonb, '{}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  feature_flags = excluded.feature_flags,
  default_preferences = excluded.default_preferences;

create table public.business_activities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  activity_type text not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  custom_activity_name text,
  configuration jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index business_activities_one_primary
  on public.business_activities (business_id)
  where is_primary = true and active = true;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_name text not null,
  branch_code text not null,
  branch_type public.branch_type not null default 'head_office',
  phone text,
  email text,
  physical_address text,
  county text,
  town text,
  contact_person text,
  active boolean not null default true,
  is_default boolean not null default false,
  sales_enabled boolean not null default true,
  purchasing_enabled boolean not null default true,
  inventory_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  financial_reporting_enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, branch_code)
);

alter table public.business_memberships
  add constraint business_memberships_default_branch_fk foreign key (default_branch_id) references public.branches(id) on delete set null;

create unique index branches_one_default
  on public.branches (business_id)
  where is_default = true and active = true;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  warehouse_name text not null,
  warehouse_code text not null,
  warehouse_type public.warehouse_type not null default 'main_warehouse',
  description text,
  address text,
  contact_person text,
  active boolean not null default true,
  is_default boolean not null default false,
  allow_sales_dispatch boolean not null default true,
  allow_purchase_receiving boolean not null default true,
  allow_stock_transfers boolean not null default true,
  allow_adjustments boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, warehouse_code)
);

create unique index warehouses_one_default
  on public.warehouses (business_id)
  where is_default = true and active = true;

create table public.warehouse_bins (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  zone text,
  aisle text,
  rack text,
  shelf text,
  bin text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  registration_number text not null,
  vehicle_name text,
  vehicle_type public.vehicle_type not null default 'van',
  carrying_capacity numeric(18, 4),
  capacity_unit text,
  default_driver_id uuid,
  active boolean not null default true,
  ownership_type public.vehicle_ownership_type not null default 'owned',
  insurance_expiry date,
  inspection_expiry date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, registration_number)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  national_id_or_employee_reference text,
  driving_licence_number text,
  licence_expiry date,
  assigned_vehicle_id uuid references public.vehicles(id) on delete set null,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicles
  add constraint vehicles_default_driver_fk foreign key (default_driver_id) references public.drivers(id) on delete set null;

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  route_name text not null,
  route_code text not null,
  description text,
  towns_or_areas text[] not null default '{}',
  assigned_manager_id uuid references public.profiles(id) on delete set null,
  default_vehicle_id uuid references public.vehicles(id) on delete set null,
  default_driver_id uuid references public.drivers(id) on delete set null,
  active boolean not null default true,
  planned_operating_days text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, route_code)
);

create table public.returnable_packaging_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_name text not null,
  code text not null,
  description text,
  unit text,
  deposit_value numeric(18, 2) not null default 0,
  replacement_value numeric(18, 2) not null default 0,
  active boolean not null default true,
  brand_id uuid,
  track_by_customer boolean not null default true,
  track_by_supplier boolean not null default false,
  track_by_vehicle boolean not null default false,
  track_by_warehouse boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create table public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  symbol text not null,
  unit_type public.unit_type not null,
  decimal_precision integer not null default 0 check (decimal_precision between 0 and 6),
  active boolean not null default true,
  system_defined boolean not null default false,
  business_defined boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, symbol),
  check ((system_defined = true and business_id is null) or (system_defined = false and business_id is not null))
);

insert into public.units_of_measure (business_id, name, symbol, unit_type, decimal_precision, system_defined, business_defined)
values
  (null, 'Piece', 'pc', 'count', 0, true, false),
  (null, 'Pack', 'pack', 'packaging', 0, true, false),
  (null, 'Packet', 'pkt', 'packaging', 0, true, false),
  (null, 'Bottle', 'btl', 'packaging', 0, true, false),
  (null, 'Can', 'can', 'packaging', 0, true, false),
  (null, 'Carton', 'ctn', 'packaging', 0, true, false),
  (null, 'Crate', 'crate', 'packaging', 0, true, false),
  (null, 'Case', 'case', 'packaging', 0, true, false),
  (null, 'Box', 'box', 'packaging', 0, true, false),
  (null, 'Bag', 'bag', 'packaging', 0, true, false),
  (null, 'Bundle', 'bdl', 'packaging', 0, true, false),
  (null, 'Tray', 'tray', 'packaging', 0, true, false),
  (null, 'Pallet', 'plt', 'packaging', 0, true, false),
  (null, 'Kilogram', 'kg', 'weight', 3, true, false),
  (null, 'Gram', 'g', 'weight', 3, true, false),
  (null, 'Tonne', 't', 'weight', 3, true, false),
  (null, 'Litre', 'l', 'volume', 3, true, false),
  (null, 'Millilitre', 'ml', 'volume', 3, true, false),
  (null, 'Metre', 'm', 'length', 3, true, false),
  (null, 'Centimetre', 'cm', 'length', 3, true, false),
  (null, 'Foot', 'ft', 'length', 3, true, false),
  (null, 'Square Metre', 'sqm', 'area', 3, true, false),
  (null, 'Hour', 'hr', 'time', 2, true, false),
  (null, 'Day', 'day', 'time', 2, true, false),
  (null, 'Service', 'svc', 'service', 0, true, false),
  (null, 'Other', 'other', 'other', 2, true, false)
on conflict (business_id, symbol) do nothing;

create table public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_unit_id uuid not null references public.units_of_measure(id),
  to_unit_id uuid not null references public.units_of_measure(id),
  conversion_factor numeric(18, 8) not null check (conversion_factor > 0),
  product_specific boolean not null default false,
  product_id uuid,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, from_unit_id, to_unit_id, product_id)
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_name text not null,
  category_code text,
  parent_category_id uuid references public.product_categories(id) on delete restrict,
  description text,
  image_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, category_code),
  unique (business_id, parent_category_id, category_name)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  brand_name text not null,
  brand_code text,
  description text,
  logo_path text,
  manufacturer_or_owner text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, brand_code)
);

alter table public.returnable_packaging_items
  add constraint returnable_packaging_brand_fk foreign key (brand_id) references public.brands(id) on delete set null;

create table public.price_levels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  priority integer not null default 100,
  tax_inclusive boolean not null default false,
  active boolean not null default true,
  is_default boolean not null default false,
  minimum_quantity numeric(18, 4),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create unique index price_levels_one_default
  on public.price_levels (business_id)
  where is_default = true and active = true;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  code text not null,
  method_type text not null,
  active boolean not null default true,
  requires_reference_number boolean not null default false,
  requires_account_selection boolean not null default false,
  supports_partial_payment boolean not null default true,
  is_default boolean not null default false,
  payment_instructions text,
  branch_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  account_type text not null check (account_type in ('cash', 'bank', 'mpesa', 'mobile_money')),
  account_name text not null,
  account_code text not null,
  bank_name text,
  account_number_masked text,
  till_number text,
  paybill_number text,
  account_reference_pattern text,
  phone_number text,
  currency text not null default 'KES',
  active boolean not null default true,
  opening_balance_placeholder numeric(18, 2),
  reconciliation_enabled boolean not null default false,
  integration_status text not null default 'not_connected',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, account_code)
);

create table public.document_numbering_sequences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null,
  prefix text not null,
  starting_number bigint not null default 1,
  current_number bigint not null default 0,
  number_length integer not null default 6,
  suffix text,
  include_branch_code boolean not null default false,
  include_financial_year boolean not null default false,
  include_month boolean not null default false,
  reset_frequency public.reset_frequency not null default 'never',
  scope_key text not null default 'business',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, document_type, scope_key)
);

create table public.document_number_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sequence_id uuid not null references public.document_numbering_sequences(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  document_type text not null,
  generated_number text not null,
  sequence_number bigint not null,
  manual_reference text,
  status text not null default 'reserved',
  entity_type text,
  entity_id uuid,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  unique (business_id, document_type, generated_number)
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  template_name text not null,
  template_style text not null check (template_style in ('classic', 'modern', 'compact')),
  brand_colour text,
  header_style text,
  footer_style text,
  address_placement text,
  tax_information_placement text,
  payment_instructions text,
  terms_and_conditions text,
  bank_details_enabled boolean not null default true,
  mpesa_instructions_enabled boolean not null default true,
  thank_you_message text,
  display_customer_pin boolean not null default true,
  display_etr_etims_fields boolean not null default true,
  display_salesperson boolean not null default false,
  display_delivery_details boolean not null default false,
  display_outstanding_balance boolean not null default true,
  display_page_numbers boolean not null default true,
  is_default boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  tax_name text not null,
  tax_code text not null,
  rate numeric(9, 4) not null check (rate >= 0),
  inclusive boolean not null default false,
  recoverable boolean not null default false,
  applies_to_sales boolean not null default true,
  applies_to_purchases boolean not null default true,
  effective_start_date date not null,
  effective_end_date date,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, tax_code, effective_start_date),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create table public.tax_document_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  etims_usage text not null default 'setup_pending' check (etims_usage in ('etims','etr','both','none','setup_pending')),
  etims_taxpayer_type text,
  etims_device_or_branch_identifier text,
  etr_device_serial_reference text,
  default_tax_invoice_status public.tax_document_status not null default 'pending',
  require_tax_invoice_reference boolean not null default false,
  allow_pending_tax_invoice_status boolean not null default true,
  allow_manual_invoice_capture boolean not null default true,
  require_manager_approval_for_non_tax_invoices boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  allow_credit_sales boolean not null default false,
  default_payment_terms text not null default 'due_immediately',
  default_credit_limit numeric(18, 2) not null default 0,
  maximum_overdue_days integer not null default 0,
  require_approval_above_credit_limit boolean not null default true,
  require_approval_for_overdue_customers boolean not null default true,
  stop_further_credit_after_threshold boolean not null default true,
  allow_partial_payments boolean not null default true,
  allow_customer_deposits boolean not null default true,
  statement_frequency text not null default 'monthly',
  reminder_frequency text not null default 'weekly',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  default_payment_terms text not null default '30_days',
  purchase_approval_required boolean not null default true,
  goods_receipt_required_before_supplier_bill boolean not null default true,
  allow_supplier_bill_before_stock_receipt boolean not null default false,
  require_supplier_tax_document boolean not null default true,
  allow_purchases_without_tax_document boolean not null default false,
  require_reason_where_document_missing boolean not null default true,
  track_supplier_price_history boolean not null default true,
  track_supplier_delivery_performance boolean not null default true,
  default_purchase_warehouse_id uuid references public.warehouses(id) on delete set null,
  default_currency text not null default 'KES',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_type text not null,
  threshold_amount numeric(18, 2),
  threshold_percentage numeric(9, 4),
  required_approver_role public.core_role not null default 'owner',
  specific_approver_id uuid references public.profiles(id) on delete set null,
  branch_id uuid references public.branches(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, rule_type, branch_id)
);

create table public.operational_preferences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  allow_negative_stock boolean not null default false,
  allow_sale_below_cost boolean not null default false,
  require_customer_on_every_sale boolean not null default false,
  require_supplier_on_every_purchase boolean not null default false,
  require_salesperson boolean not null default false,
  require_delivery_note boolean not null default false,
  require_stock_location boolean not null default true,
  enable_batches boolean not null default false,
  enable_expiry_dates boolean not null default false,
  enable_serial_numbers boolean not null default false,
  enable_returnable_packaging boolean not null default false,
  enable_customer_specific_prices boolean not null default false,
  enable_supplier_price_comparison boolean not null default false,
  enable_multiple_currencies boolean not null default false,
  enable_branch_level_reporting boolean not null default true,
  enable_activity_level_reporting boolean not null default false,
  enable_vehicle_stock boolean not null default false,
  enable_route_sales boolean not null default false,
  enable_proof_of_delivery boolean not null default false,
  enable_stock_reservations boolean not null default false,
  enable_stock_approval boolean not null default false,
  show_buying_prices_to_managers boolean not null default false,
  show_buying_prices_to_staff boolean not null default false,
  show_profit_to_managers boolean not null default false,
  show_profit_to_staff boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.setup_presets (
  code text primary key,
  name text not null,
  description text,
  industry_profile_code text references public.industry_profiles(code),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.setup_presets (code, name, description, industry_profile_code, configuration)
values
  ('beverage_distributor', 'Beverage distributor', 'Distributor setup with crates, route sales, delivery notes and customer credit.', 'distributor', '{"price_levels":["wholesale","retail"],"enable_returnable_packaging":true,"enable_route_sales":true,"enable_vehicle_stock":true,"enable_proof_of_delivery":true,"allow_credit_sales":true,"stock_costing_method":"weighted_average"}'::jsonb),
  ('general_trader', 'General trader', 'Inventory, sales, purchases, cash, M-Pesa and one default warehouse.', 'retail', '{"price_levels":["retail","wholesale"],"payment_methods":["cash","mpesa"],"default_warehouse":true}'::jsonb),
  ('fish_supplier', 'Fish supplier', 'Kilograms, crates, spoilage tracking, cold storage and delivery notes.', 'fish_seafood', '{"units":["kg","crate"],"enable_batches":true,"enable_expiry_dates":true,"cold_store":true,"daily_stock_count":true}'::jsonb),
  ('service_business', 'Service business', 'Non-stock services, quotations, invoices, customer credit and expense tracking.', 'service_business', '{"service_items":true,"warehouse_required":false,"allow_credit_sales":true}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  industry_profile_code = excluded.industry_profile_code,
  configuration = excluded.configuration;

create or replace function public.prevent_no_active_branch()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
begin
  if old.active = true and new.active = false then
    select count(*) into remaining
    from public.branches
    where business_id = old.business_id
      and active = true
      and id <> old.id;

    if remaining = 0 then
      raise exception 'A business must have at least one active branch.';
    end if;
  end if;
  return new;
end;
$$;

create trigger branches_keep_one_active
before update on public.branches
for each row execute function public.prevent_no_active_branch();

create or replace function public.prevent_category_cycle()
returns trigger
language plpgsql
as $$
declare
  found_cycle boolean;
begin
  if new.parent_category_id is null then
    return new;
  end if;

  with recursive ancestors(id) as (
    select new.parent_category_id
    union all
    select pc.parent_category_id
    from public.product_categories pc
    join ancestors a on a.id = pc.id
    where pc.parent_category_id is not null
  )
  select exists(select 1 from ancestors where id = new.id) into found_cycle;

  if found_cycle then
    raise exception 'Category hierarchy cannot contain a cycle.';
  end if;
  return new;
end;
$$;

create trigger product_categories_prevent_cycle
before insert or update on public.product_categories
for each row execute function public.prevent_category_cycle();

create or replace function public.can_access_branch(target_business_id uuid, target_branch_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_memberships bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.active = true
      and (
        bm.role = 'owner'
        or bm.branch_access_mode = 'all'
        or target_branch_id = any(bm.branch_ids)
      )
  );
$$;

create or replace function public.generate_document_number(
  target_business_id uuid,
  target_document_type text,
  target_branch_id uuid default null,
  target_generated_by uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq public.document_numbering_sequences%rowtype;
  next_number bigint;
  branch_code text;
  generated text;
begin
  select * into seq
  from public.document_numbering_sequences
  where business_id = target_business_id
    and document_type = target_document_type
    and active = true
  order by created_at
  limit 1
  for update;

  if not found then
    raise exception 'No active document sequence configured for %.', target_document_type;
  end if;

  next_number := greatest(seq.current_number + 1, seq.starting_number);

  if seq.include_branch_code and target_branch_id is not null then
    select b.branch_code into branch_code
    from public.branches b
    where b.id = target_branch_id and b.business_id = target_business_id;
  end if;

  generated := seq.prefix;
  if seq.include_branch_code and branch_code is not null then
    generated := generated || '-' || branch_code;
  end if;
  if seq.include_financial_year then
    generated := generated || '-' || extract(year from now())::text;
  end if;
  if seq.include_month then
    generated := generated || '-' || lpad(extract(month from now())::text, 2, '0');
  end if;
  generated := generated || '-' || lpad(next_number::text, seq.number_length, '0') || coalesce(seq.suffix, '');

  update public.document_numbering_sequences
  set current_number = next_number,
      updated_at = now()
  where id = seq.id;

  insert into public.document_number_history (
    business_id, sequence_id, branch_id, document_type, generated_number, sequence_number, generated_by
  ) values (
    target_business_id, seq.id, target_branch_id, target_document_type, generated, next_number, target_generated_by
  );

  return generated;
end;
$$;

create or replace function public.create_default_configuration_for_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_branch_id uuid;
  default_warehouse_id uuid;
begin
  insert into public.branches (
    business_id, branch_name, branch_code, branch_type, phone, email, physical_address, county, town,
    is_default, delivery_enabled, created_by
  )
  values (
    new.id,
    coalesce(new.trading_name, 'Main Branch'),
    'MAIN',
    'head_office',
    new.phone,
    new.email,
    new.physical_address,
    new.county,
    new.town,
    true,
    coalesce((new.operating_flags ->> 'delivery_vehicles')::boolean, false),
    new.created_by
  )
  on conflict (business_id, branch_code) do update set updated_at = now()
  returning id into default_branch_id;

  insert into public.warehouses (
    business_id, branch_id, warehouse_name, warehouse_code, warehouse_type, is_default, created_by
  )
  values (new.id, default_branch_id, 'Main Stock Location', 'MAIN', 'main_warehouse', true, new.created_by)
  on conflict (business_id, warehouse_code) do update set updated_at = now()
  returning id into default_warehouse_id;

  insert into public.price_levels (business_id, name, code, description, priority, is_default, created_by)
  values
    (new.id, 'Retail', 'retail', 'Default retail selling price level.', 10, true, new.created_by),
    (new.id, 'Wholesale', 'wholesale', 'Wholesale customer price level.', 20, false, new.created_by),
    (new.id, 'Distributor', 'distributor', 'Distributor or reseller price level.', 30, false, new.created_by),
    (new.id, 'Special Customer', 'special_customer', 'Negotiated customer price level.', 40, false, new.created_by),
    (new.id, 'Promotional', 'promotional', 'Temporary campaign price level.', 50, false, new.created_by),
    (new.id, 'Custom', 'custom', 'Custom price level.', 60, false, new.created_by)
  on conflict (business_id, code) do nothing;

  insert into public.payment_methods (business_id, name, code, method_type, requires_reference_number, requires_account_selection, is_default, created_by)
  values
    (new.id, 'Cash', 'cash', 'cash', false, false, true, new.created_by),
    (new.id, 'M-Pesa', 'mpesa', 'mobile_money', true, true, false, new.created_by),
    (new.id, 'Bank Transfer', 'bank_transfer', 'bank', true, true, false, new.created_by),
    (new.id, 'Cheque', 'cheque', 'bank', true, true, false, new.created_by),
    (new.id, 'Card', 'card', 'card', true, true, false, new.created_by),
    (new.id, 'Mobile Money', 'mobile_money', 'mobile_money', true, true, false, new.created_by),
    (new.id, 'Credit', 'credit', 'credit', false, false, false, new.created_by),
    (new.id, 'Customer Deposit', 'customer_deposit', 'deposit', true, true, false, new.created_by),
    (new.id, 'Owner Account', 'owner_account', 'owner', true, true, false, new.created_by),
    (new.id, 'Other', 'other', 'other', true, false, false, new.created_by)
  on conflict (business_id, code) do nothing;

  insert into public.finance_accounts (business_id, branch_id, account_type, account_name, account_code, currency, created_by)
  values
    (new.id, default_branch_id, 'cash', 'Main Cash', 'main_cash', new.default_currency, new.created_by),
    (new.id, default_branch_id, 'cash', 'Petty Cash', 'petty_cash', new.default_currency, new.created_by)
  on conflict (business_id, account_code) do nothing;

  insert into public.document_numbering_sequences (business_id, document_type, prefix, include_branch_code, include_financial_year, created_by)
  values
    (new.id, 'quotation', 'QT', false, false, new.created_by),
    (new.id, 'sales_order', 'SO', false, false, new.created_by),
    (new.id, 'delivery_note', 'DN', true, false, new.created_by),
    (new.id, 'sales_invoice', 'INV', false, false, new.created_by),
    (new.id, 'tax_invoice', 'TAX', false, false, new.created_by),
    (new.id, 'receipt', 'RCPT', true, false, new.created_by),
    (new.id, 'purchase_order', 'PO', false, false, new.created_by),
    (new.id, 'goods_received_note', 'GRN', true, false, new.created_by),
    (new.id, 'stock_transfer', 'ST', true, false, new.created_by),
    (new.id, 'stock_adjustment', 'SA', true, false, new.created_by)
  on conflict (business_id, document_type, scope_key) do nothing;

  insert into public.document_templates (business_id, template_name, template_style, brand_colour, thank_you_message, is_default, created_by)
  values
    (new.id, 'Classic', 'classic', '#047857', 'Thank you for your business.', true, new.created_by),
    (new.id, 'Modern', 'modern', '#0f172a', 'Thank you for your business.', false, new.created_by),
    (new.id, 'Compact', 'compact', '#334155', 'Thank you for your business.', false, new.created_by);

  insert into public.tax_rates (business_id, tax_name, tax_code, rate, applies_to_sales, applies_to_purchases, effective_start_date, created_by)
  values
    (new.id, 'VAT Standard Rate', 'vat_standard', 16.0000, true, true, current_date, new.created_by),
    (new.id, 'Zero-rated Supply', 'zero_rated', 0.0000, true, true, current_date, new.created_by),
    (new.id, 'Exempt Supply', 'exempt', 0.0000, true, true, current_date, new.created_by),
    (new.id, 'No Tax', 'no_tax', 0.0000, true, true, current_date, new.created_by)
  on conflict (business_id, tax_code, effective_start_date) do nothing;

  insert into public.tax_document_settings (business_id, created_by)
  values (new.id, new.created_by)
  on conflict (business_id) do nothing;

  insert into public.credit_settings (business_id, created_by)
  values (new.id, new.created_by)
  on conflict (business_id) do nothing;

  insert into public.supplier_settings (business_id, default_purchase_warehouse_id, default_currency, created_by)
  values (new.id, default_warehouse_id, new.default_currency, new.created_by)
  on conflict (business_id) do nothing;

  insert into public.operational_preferences (business_id, created_by)
  values (new.id, new.created_by)
  on conflict (business_id) do nothing;

  insert into public.business_setup_items (business_id, key, label, critical, complete)
  values
    (new.id, 'complete_business_profile', 'Complete business profile', true, true),
    (new.id, 'upload_logo', 'Upload logo', true, new.logo_path is not null),
    (new.id, 'configure_tax_status', 'Configure tax status', true, true),
    (new.id, 'add_first_branch', 'Add first branch', true, true),
    (new.id, 'add_first_stock_location', 'Add first stock location', true, true),
    (new.id, 'configure_financial_year', 'Configure financial year', true, true),
    (new.id, 'configure_default_currency', 'Configure default currency', true, true),
    (new.id, 'configure_document_numbering', 'Configure document numbering', false, true),
    (new.id, 'configure_payment_methods', 'Configure payment methods', false, true),
    (new.id, 'configure_customer_credit_settings', 'Configure customer credit settings', false, false),
    (new.id, 'select_business_profile', 'Select business profile', false, new.industry_profile_code is not null),
    (new.id, 'add_first_category', 'Add first category', false, false),
    (new.id, 'add_first_brand', 'Add first brand', false, false)
  on conflict (business_id, key) do nothing;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, new_value)
  values (new.id, new.created_by, 'configuration.defaults_created', 'settings', 'business', new.id, jsonb_build_object('branch_id', default_branch_id, 'warehouse_id', default_warehouse_id));

  return new;
end;
$$;

create trigger businesses_create_default_configuration
after insert on public.businesses
for each row execute function public.create_default_configuration_for_business();

create index business_activities_business_idx on public.business_activities(business_id, active);
create index branches_business_active_idx on public.branches(business_id, active);
create index warehouses_business_branch_idx on public.warehouses(business_id, branch_id, active);
create index vehicles_business_branch_idx on public.vehicles(business_id, branch_id, active);
create index drivers_business_branch_idx on public.drivers(business_id, branch_id, active);
create index routes_business_branch_idx on public.routes(business_id, branch_id, active);
create index units_business_active_idx on public.units_of_measure(business_id, active);
create index categories_business_parent_idx on public.product_categories(business_id, parent_category_id, active);
create index brands_business_active_idx on public.brands(business_id, active);
create index payment_methods_business_active_idx on public.payment_methods(business_id, active);
create index document_history_business_idx on public.document_number_history(business_id, document_type, generated_at desc);

alter table public.industry_profiles enable row level security;
alter table public.setup_presets enable row level security;
alter table public.business_activities enable row level security;
alter table public.branches enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_bins enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.routes enable row level security;
alter table public.returnable_packaging_items enable row level security;
alter table public.units_of_measure enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.product_categories enable row level security;
alter table public.brands enable row level security;
alter table public.price_levels enable row level security;
alter table public.payment_methods enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.document_numbering_sequences enable row level security;
alter table public.document_number_history enable row level security;
alter table public.document_templates enable row level security;
alter table public.tax_rates enable row level security;
alter table public.tax_document_settings enable row level security;
alter table public.credit_settings enable row level security;
alter table public.supplier_settings enable row level security;
alter table public.approval_rules enable row level security;
alter table public.operational_preferences enable row level security;

create policy industry_profiles_read on public.industry_profiles for select using (true);
create policy setup_presets_read on public.setup_presets for select using (true);

create policy units_read on public.units_of_measure
  for select using (system_defined = true or public.current_user_has_business_access(business_id));

create policy configuration_member_read on public.business_activities
  for select using (public.current_user_has_business_access(business_id));
create policy configuration_owner_write on public.business_activities
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy branches_member_read on public.branches
  for select using (public.current_user_has_business_access(business_id) and public.can_access_branch(business_id, id));
create policy branches_owner_write on public.branches
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy warehouses_member_read on public.warehouses
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy warehouses_owner_write on public.warehouses
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy bins_member_read on public.warehouse_bins
  for select using (public.current_user_has_business_access(business_id));
create policy bins_owner_write on public.warehouse_bins
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy vehicles_member_read on public.vehicles
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy vehicles_owner_write on public.vehicles
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy drivers_member_read on public.drivers
  for select using (public.current_user_business_role(business_id) in ('owner','manager') and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy drivers_owner_write on public.drivers
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy routes_member_read on public.routes
  for select using (public.current_user_has_business_access(business_id) and (branch_id is null or public.can_access_branch(business_id, branch_id)));
create policy routes_owner_write on public.routes
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy config_member_read_returnables on public.returnable_packaging_items
  for select using (public.current_user_has_business_access(business_id));
create policy config_owner_write_returnables on public.returnable_packaging_items
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy units_owner_write on public.units_of_measure
  for all using (system_defined = false and public.current_user_business_role(business_id) = 'owner')
  with check (system_defined = false and public.current_user_business_role(business_id) = 'owner');

create policy conversions_member_read on public.unit_conversions
  for select using (public.current_user_has_business_access(business_id));
create policy conversions_owner_write on public.unit_conversions
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy categories_member_read on public.product_categories
  for select using (public.current_user_has_business_access(business_id));
create policy categories_owner_write on public.product_categories
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy brands_member_read on public.brands
  for select using (public.current_user_has_business_access(business_id));
create policy brands_owner_write on public.brands
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy price_levels_member_read on public.price_levels
  for select using (public.current_user_has_business_access(business_id));
create policy price_levels_owner_write on public.price_levels
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy payment_methods_member_read on public.payment_methods
  for select using (public.current_user_has_business_access(business_id));
create policy payment_methods_owner_write on public.payment_methods
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy finance_accounts_owner_read on public.finance_accounts
  for select using (public.current_user_business_role(business_id) = 'owner');
create policy finance_accounts_owner_write on public.finance_accounts
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy doc_sequences_member_read on public.document_numbering_sequences
  for select using (public.current_user_has_business_access(business_id));
create policy doc_sequences_owner_write on public.document_numbering_sequences
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy doc_history_member_read on public.document_number_history
  for select using (public.current_user_has_business_access(business_id));

create policy doc_templates_member_read on public.document_templates
  for select using (public.current_user_has_business_access(business_id));
create policy doc_templates_owner_write on public.document_templates
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy tax_rates_member_read on public.tax_rates
  for select using (public.current_user_has_business_access(business_id));
create policy tax_rates_owner_write on public.tax_rates
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy tax_docs_member_read on public.tax_document_settings
  for select using (public.current_user_has_business_access(business_id));
create policy tax_docs_owner_write on public.tax_document_settings
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy credit_member_read on public.credit_settings
  for select using (public.current_user_has_business_access(business_id));
create policy credit_owner_write on public.credit_settings
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy supplier_member_read on public.supplier_settings
  for select using (public.current_user_has_business_access(business_id));
create policy supplier_owner_write on public.supplier_settings
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy approvals_member_read on public.approval_rules
  for select using (public.current_user_has_business_access(business_id));
create policy approvals_owner_write on public.approval_rules
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy preferences_member_read on public.operational_preferences
  for select using (public.current_user_has_business_access(business_id));
create policy preferences_owner_write on public.operational_preferences
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

insert into public.branches (business_id, branch_name, branch_code, branch_type, phone, email, physical_address, county, town, is_default, created_by)
select b.id, coalesce(b.trading_name, 'Main Branch'), 'MAIN', 'head_office', b.phone, b.email, b.physical_address, b.county, b.town, true, b.created_by
from public.businesses b
where not exists (select 1 from public.branches br where br.business_id = b.id);

insert into public.warehouses (business_id, branch_id, warehouse_name, warehouse_code, warehouse_type, is_default, created_by)
select b.id, br.id, 'Main Stock Location', 'MAIN', 'main_warehouse', true, b.created_by
from public.businesses b
join public.branches br on br.business_id = b.id and br.is_default = true
where not exists (select 1 from public.warehouses w where w.business_id = b.id);

grant usage on schema public to anon, authenticated;

grant select on public.industry_profiles, public.setup_presets to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.businesses,
  public.business_memberships,
  public.business_invitations,
  public.audit_logs,
  public.notifications,
  public.business_setup_items,
  public.business_subscriptions,
  public.business_activities,
  public.branches,
  public.warehouses,
  public.warehouse_bins,
  public.vehicles,
  public.drivers,
  public.routes,
  public.returnable_packaging_items,
  public.units_of_measure,
  public.unit_conversions,
  public.product_categories,
  public.brands,
  public.price_levels,
  public.payment_methods,
  public.finance_accounts,
  public.document_numbering_sequences,
  public.document_number_history,
  public.document_templates,
  public.tax_rates,
  public.tax_document_settings,
  public.credit_settings,
  public.supplier_settings,
  public.approval_rules,
  public.operational_preferences
to authenticated;

revoke execute on function public.current_user_has_business_access(uuid) from public;
revoke execute on function public.current_user_business_role(uuid) from public;
revoke execute on function public.can_access_branch(uuid, uuid) from public;
revoke execute on function public.generate_document_number(uuid, text, uuid, uuid) from public;

grant execute on function public.current_user_has_business_access(uuid) to authenticated;
grant execute on function public.current_user_business_role(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated;
grant execute on function public.generate_document_number(uuid, text, uuid, uuid) to authenticated;
