create or replace function public.reverse_sales_invoice_atomic(
  target_business_id uuid,
  target_invoice_id uuid,
  target_user_id uuid,
  target_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  invoice record;
  reversal_number text;
  reversed_count integer := 0;
  payment_count integer := 0;
begin
  select si.* into invoice
  from public.sales_invoices si
  where si.business_id = target_business_id and si.id = target_invoice_id
  for update;
  if not found then raise exception 'That invoice was not found in this business.'; end if;

  reversal_number := 'REV-' || regexp_replace(coalesce(invoice.invoice_number, invoice.id::text), '[^A-Za-z0-9-]+', '-', 'g');
  if invoice.status in ('reversed', 'cancelled') then
    return jsonb_build_object('performed', false, 'invoiceNumber', invoice.invoice_number, 'reversalNumber', reversal_number, 'stockMovements', 0);
  end if;

  insert into public.stock_movements (
    business_id, branch_id, warehouse_id, product_id, variant_id, batch_id,
    display_unit_id, movement_type, direction, quantity_base, display_quantity,
    unit_conversion_factor, unit_cost, total_cost, reference_document_type,
    reference_document_id, reference_number, reason, notes, movement_date,
    created_by, approval_status, reversal_reference_id, is_reversal,
    source_type, source_supplier_id, source_supplier_name
  )
  select sm.business_id, sm.branch_id, sm.warehouse_id, sm.product_id, sm.variant_id,
    sm.batch_id, sm.display_unit_id, 'reversal'::public.stock_movement_type,
    'in'::public.stock_direction, sm.quantity_base, sm.display_quantity,
    sm.unit_conversion_factor, sm.unit_cost, sm.total_cost, 'sales_invoice_reversal',
    invoice.id, reversal_number, coalesce(nullif(trim(target_reason), ''), 'Sale cancelled or entered by mistake.'),
    'Reversal of stock issue ' || sm.id || ' for invoice ' || coalesce(invoice.invoice_number, invoice.id::text) || '.',
    now(), target_user_id, 'posted'::public.approval_status, sm.id, true,
    coalesce(ssa.source_type, 'unspecified'), ssa.source_supplier_id, ssa.source_supplier_name
  from public.stock_movements sm
  left join lateral (
    select a.source_type, a.source_supplier_id, a.source_supplier_name
    from public.sales_source_allocations a
    where a.business_id = target_business_id and a.stock_movement_id = sm.id
    order by a.created_at limit 1
  ) ssa on true
  where sm.business_id = target_business_id
    and sm.reference_document_type = 'sales_invoice'
    and sm.reference_document_id = invoice.id
    and sm.direction = 'out'
  on conflict (reversal_reference_id) where is_reversal = true and reversal_reference_id is not null do nothing;
  get diagnostics reversed_count = row_count;

  with removed as (
    delete from public.customer_payment_allocations cpa
    where cpa.business_id = target_business_id and cpa.invoice_id = invoice.id
    returning cpa.customer_payment_id
  )
  update public.customer_payments cp
  set status = case
      when exists (select 1 from public.customer_payment_allocations other where other.customer_payment_id = cp.id)
        then 'partially_allocated'::public.delivery_collection_status
      else 'reversed'::public.delivery_collection_status
    end,
    notes = concat_ws(E'\n', nullif(cp.notes, ''), 'Invoice ' || coalesce(invoice.invoice_number, invoice.id::text) || ' reversed: ' || coalesce(target_reason, 'Sale cancelled.'))
  where cp.business_id = target_business_id and cp.id in (select customer_payment_id from removed);
  get diagnostics payment_count = row_count;

  delete from public.sales_source_allocations
  where business_id = target_business_id and sales_invoice_id = invoice.id;

  update public.sales_invoices
  set status = 'reversed', delivery_status = 'cancelled', amount_paid = 0,
      balance_due = 0, updated_at = now()
  where id = invoice.id;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, previous_value, new_value)
  values (target_business_id, target_user_id, 'invoice.reversed', 'Sales', 'sales_invoice', invoice.id,
    to_jsonb(invoice), jsonb_build_object('reversal_number', reversal_number, 'reason', target_reason,
      'stock_movements_reversed', reversed_count, 'related_payments_updated', payment_count));

  return jsonb_build_object('performed', true, 'invoiceNumber', invoice.invoice_number,
    'reversalNumber', reversal_number, 'stockMovements', reversed_count, 'paymentsUpdated', payment_count,
    'totalAmount', invoice.total_amount);
end;
$$;
