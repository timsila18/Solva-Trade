create table if not exists public.sales_source_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete cascade,
  sales_invoice_item_id uuid not null references public.sales_invoice_items(id) on delete cascade,
  stock_movement_id uuid not null references public.stock_movements(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  fifo_cost_layer_id uuid references public.fifo_cost_layers(id) on delete set null,
  receipt_movement_id uuid references public.stock_movements(id) on delete set null,
  source_type text not null default 'unspecified',
  source_supplier_id uuid references public.suppliers(id) on delete set null,
  source_supplier_name text,
  quantity numeric(18, 8) not null check (quantity > 0),
  unit_cost numeric(18, 4) not null default 0,
  total_cost numeric(18, 4) not null default 0,
  sale_unit_price numeric(18, 4) not null default 0,
  sale_value numeric(18, 4) not null default 0,
  gross_profit numeric(18, 4) not null default 0,
  allocated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sales_source_allocations_business_idx
  on public.sales_source_allocations(business_id, sales_invoice_id, product_id);

create index if not exists sales_source_allocations_source_idx
  on public.sales_source_allocations(business_id, source_type, source_supplier_id);

alter table public.sales_source_allocations enable row level security;

drop policy if exists sales_source_allocations_member_read on public.sales_source_allocations;
create policy sales_source_allocations_member_read
  on public.sales_source_allocations
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

create or replace function public.allocate_sale_fifo_source(
  target_business_id uuid,
  target_invoice_id uuid,
  target_invoice_item_id uuid,
  target_stock_movement_id uuid,
  target_product_id uuid,
  target_branch_id uuid,
  target_warehouse_id uuid,
  target_quantity numeric,
  target_sale_unit_price numeric
) returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining numeric(18, 8) := target_quantity;
  take_qty numeric(18, 8);
  layer record;
begin
  if public.current_user_business_role(target_business_id) not in ('owner', 'manager') then
    raise exception 'You do not have permission to allocate sale cost for this business.';
  end if;

  if target_quantity <= 0 then
    raise exception 'Sale quantity must be greater than zero.';
  end if;

  delete from public.sales_source_allocations
  where business_id = target_business_id
    and sales_invoice_item_id = target_invoice_item_id
    and stock_movement_id = target_stock_movement_id;

  for layer in
    select
      fcl.id,
      fcl.receipt_movement_id,
      fcl.remaining_quantity,
      fcl.unit_cost,
      sm.source_type,
      sm.source_supplier_id,
      sm.source_supplier_name
    from public.fifo_cost_layers fcl
    left join public.stock_movements sm on sm.id = fcl.receipt_movement_id
    where fcl.business_id = target_business_id
      and fcl.product_id = target_product_id
      and (target_branch_id is null or fcl.branch_id = target_branch_id)
      and (target_warehouse_id is null or fcl.warehouse_id = target_warehouse_id)
      and fcl.remaining_quantity > 0
      and fcl.active = true
    order by fcl.receipt_date, fcl.created_at, fcl.id
    for update of fcl
  loop
    take_qty := least(remaining, layer.remaining_quantity);

    insert into public.sales_source_allocations (
      business_id,
      sales_invoice_id,
      sales_invoice_item_id,
      stock_movement_id,
      product_id,
      fifo_cost_layer_id,
      receipt_movement_id,
      source_type,
      source_supplier_id,
      source_supplier_name,
      quantity,
      unit_cost,
      total_cost,
      sale_unit_price,
      sale_value,
      gross_profit
    ) values (
      target_business_id,
      target_invoice_id,
      target_invoice_item_id,
      target_stock_movement_id,
      target_product_id,
      layer.id,
      layer.receipt_movement_id,
      coalesce(layer.source_type, 'unspecified'),
      layer.source_supplier_id,
      layer.source_supplier_name,
      take_qty,
      coalesce(layer.unit_cost, 0),
      take_qty * coalesce(layer.unit_cost, 0),
      coalesce(target_sale_unit_price, 0),
      take_qty * coalesce(target_sale_unit_price, 0),
      take_qty * (coalesce(target_sale_unit_price, 0) - coalesce(layer.unit_cost, 0))
    );

    update public.fifo_cost_layers
    set
      remaining_quantity = remaining_quantity - take_qty,
      active = (remaining_quantity - take_qty) > 0,
      updated_at = now()
    where id = layer.id;

    remaining := remaining - take_qty;
    exit when remaining <= 0;
  end loop;

  if remaining > 0 then
    raise exception 'Insufficient FIFO cost layers for this sale. Receive stock for this product before selling.';
  end if;

  return target_quantity;
end;
$$;

revoke all on function public.allocate_sale_fifo_source(uuid, uuid, uuid, uuid, uuid, uuid, uuid, numeric, numeric) from public;
grant execute on function public.allocate_sale_fifo_source(uuid, uuid, uuid, uuid, uuid, uuid, uuid, numeric, numeric) to authenticated;

grant select on public.sales_source_allocations to authenticated;
