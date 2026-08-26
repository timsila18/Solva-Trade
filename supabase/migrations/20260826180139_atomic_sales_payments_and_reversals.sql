alter table public.customer_payments
  add column if not exists idempotency_key text;

create unique index if not exists customer_payments_idempotency_idx
  on public.customer_payments (business_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists stock_movements_one_reversal_idx
  on public.stock_movements (reversal_reference_id)
  where is_reversal = true and reversal_reference_id is not null;

create or replace function public.post_customer_payment_atomic(
  target_business_id uuid,
  target_branch_id uuid,
  target_customer_id uuid,
  target_invoice_id uuid,
  target_amount numeric,
  target_payment_number text,
  target_payment_date timestamptz,
  target_method_code text,
  target_reference text,
  target_payer_name text,
  target_collected_by uuid,
  target_idempotency_key text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  existing_payment record;
  payment_id uuid;
  payment_method_id uuid;
  resolved_customer_id uuid := target_customer_id;
  remaining numeric(18, 2) := round(target_amount, 2);
  invoice record;
  allocation numeric(18, 2);
  allocation_rows jsonb := '[]'::jsonb;
  allocated_total numeric(18, 2) := 0;
  customer_outstanding numeric(18, 2);
begin
  if target_amount is null or round(target_amount, 2) <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;
  if nullif(trim(target_idempotency_key), '') is null then
    raise exception 'A payment request key is required.';
  end if;

  select cp.id, cp.payment_number, cp.amount_received
  into existing_payment
  from public.customer_payments cp
  where cp.business_id = target_business_id
    and cp.idempotency_key = target_idempotency_key;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'invoiceId', cpa.invoice_id,
      'invoiceNumber', si.invoice_number,
      'amount', cpa.allocated_amount,
      'balanceDue', si.balance_due
    ) order by si.invoice_date, si.created_at, si.id), '[]'::jsonb)
    into allocation_rows
    from public.customer_payment_allocations cpa
    join public.sales_invoices si on si.id = cpa.invoice_id
    where cpa.business_id = target_business_id
      and cpa.customer_payment_id = existing_payment.id;

    return jsonb_build_object(
      'paymentId', existing_payment.id,
      'paymentNumber', existing_payment.payment_number,
      'amountReceived', existing_payment.amount_received,
      'allocatedAmount', existing_payment.amount_received,
      'allocations', allocation_rows,
      'replayed', true
    );
  end if;

  if target_invoice_id is not null then
    select si.customer_id into resolved_customer_id
    from public.sales_invoices si
    where si.id = target_invoice_id
      and si.business_id = target_business_id
      and si.status not in ('reversed', 'cancelled')
    for update;
    if not found then raise exception 'The selected invoice is unavailable.'; end if;
  end if;
  if resolved_customer_id is null then raise exception 'Select a customer with unpaid invoices.'; end if;

  select coalesce(sum(si.balance_due), 0)
  into customer_outstanding
  from public.sales_invoices si
  where si.business_id = target_business_id
    and si.customer_id = resolved_customer_id
    and si.balance_due > 0
    and si.status not in ('reversed', 'cancelled')
    and (target_invoice_id is null or si.id = target_invoice_id);

  if remaining > customer_outstanding then
    raise exception 'Payment exceeds the selected outstanding balance of KES %.', customer_outstanding;
  end if;

  select pm.id into payment_method_id
  from public.payment_methods pm
  where pm.business_id = target_business_id
    and pm.active = true
    and pm.code = coalesce(nullif(target_method_code, ''), 'cash')
  order by pm.created_at
  limit 1;

  insert into public.customer_payments (
    business_id, branch_id, customer_id, payment_number, payment_date,
    payment_method_id, amount_received, currency, transaction_reference,
    payer_name, collected_by, status, source_document_type, source_document_id,
    idempotency_key
  ) values (
    target_business_id, target_branch_id, resolved_customer_id, target_payment_number,
    coalesce(target_payment_date, now()), payment_method_id, round(target_amount, 2),
    'KES', nullif(trim(target_reference), ''), nullif(trim(target_payer_name), ''),
    target_collected_by, 'allocated',
    case when target_invoice_id is null then 'customer_account' else 'sales_invoice' end,
    target_invoice_id, target_idempotency_key
  ) returning id into payment_id;

  for invoice in
    select si.id, si.invoice_number, si.total_amount, si.amount_paid, si.balance_due
    from public.sales_invoices si
    where si.business_id = target_business_id
      and si.customer_id = resolved_customer_id
      and si.balance_due > 0
      and si.status not in ('reversed', 'cancelled')
      and (target_invoice_id is null or si.id = target_invoice_id)
    order by si.invoice_date, si.created_at, si.id
    for update
  loop
    exit when remaining <= 0;
    allocation := least(remaining, round(invoice.balance_due, 2));

    insert into public.customer_payment_allocations (
      business_id, customer_payment_id, invoice_id, allocated_amount
    ) values (target_business_id, payment_id, invoice.id, allocation);

    update public.sales_invoices
    set amount_paid = least(total_amount, round(coalesce(amount_paid, 0) + allocation, 2)),
        balance_due = greatest(0, round(total_amount - (coalesce(amount_paid, 0) + allocation), 2)),
        status = case
          when round(total_amount - (coalesce(amount_paid, 0) + allocation), 2) <= 0 then 'paid'::public.sales_invoice_status
          else 'partially_paid'::public.sales_invoice_status
        end,
        updated_at = now()
    where id = invoice.id
    returning balance_due into invoice.balance_due;

    allocation_rows := allocation_rows || jsonb_build_array(jsonb_build_object(
      'invoiceId', invoice.id,
      'invoiceNumber', invoice.invoice_number,
      'amount', allocation,
      'balanceDue', invoice.balance_due
    ));
    remaining := round(remaining - allocation, 2);
    allocated_total := round(allocated_total + allocation, 2);
  end loop;

  if remaining <> 0 then raise exception 'The payment could not be fully allocated.'; end if;

  insert into public.audit_logs (business_id, user_id, action, module, entity_type, entity_id, new_value)
  values (target_business_id, target_collected_by, 'customer_payment.allocated', 'Sales', 'customer_payment', payment_id,
    jsonb_build_object('payment_number', target_payment_number, 'amount', target_amount, 'allocations', allocation_rows));

  return jsonb_build_object(
    'paymentId', payment_id,
    'paymentNumber', target_payment_number,
    'amountReceived', round(target_amount, 2),
    'allocatedAmount', allocated_total,
    'allocations', allocation_rows,
    'replayed', false
  );
end;
$$;
