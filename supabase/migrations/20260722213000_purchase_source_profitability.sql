alter table public.stock_movements
  add column if not exists source_type text not null default 'unspecified'
    check (source_type in ('direct_supplier', 'local_market', 'spot_purchase', 'alternative_supplier', 'emergency_purchase', 'mixed_stock', 'unspecified')),
  add column if not exists source_supplier_id uuid references public.suppliers(id),
  add column if not exists source_supplier_name text,
  add column if not exists direct_reference_unit_cost numeric(18, 4),
  add column if not exists local_reference_unit_cost numeric(18, 4),
  add column if not exists source_unit_cost_variance numeric(18, 4),
  add column if not exists source_reason text;

alter table public.goods_received_notes
  add column if not exists source_type text not null default 'unspecified'
    check (source_type in ('direct_supplier', 'local_market', 'spot_purchase', 'alternative_supplier', 'emergency_purchase', 'mixed_stock', 'unspecified')),
  add column if not exists source_reason text,
  add column if not exists direct_reference_unit_cost numeric(18, 4),
  add column if not exists local_reference_unit_cost numeric(18, 4),
  add column if not exists source_unit_cost_variance numeric(18, 4);

alter table public.goods_received_note_items
  add column if not exists source_type text not null default 'unspecified'
    check (source_type in ('direct_supplier', 'local_market', 'spot_purchase', 'alternative_supplier', 'emergency_purchase', 'mixed_stock', 'unspecified')),
  add column if not exists direct_reference_unit_cost numeric(18, 4),
  add column if not exists local_reference_unit_cost numeric(18, 4),
  add column if not exists source_unit_cost_variance numeric(18, 4),
  add column if not exists source_reason text;

alter table public.purchase_orders
  add column if not exists source_type text not null default 'unspecified'
    check (source_type in ('direct_supplier', 'local_market', 'spot_purchase', 'alternative_supplier', 'emergency_purchase', 'mixed_stock', 'unspecified')),
  add column if not exists source_reason text;

create index if not exists stock_movements_source_report_idx
  on public.stock_movements (business_id, source_type, product_id, movement_date desc)
  where direction = 'in';

create index if not exists grn_source_report_idx
  on public.goods_received_notes (business_id, source_type, receipt_date desc);
