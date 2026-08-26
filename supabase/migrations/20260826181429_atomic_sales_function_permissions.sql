do $$
begin
  execute 'revoke all on function public.post_customer_payment_atomic(uuid, uuid, uuid, uuid, numeric, text, timestamptz, text, text, text, uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.post_customer_payment_atomic(uuid, uuid, uuid, uuid, numeric, text, timestamptz, text, text, text, uuid, text) to service_role';
  execute 'revoke all on function public.reverse_sales_invoice_atomic(uuid, uuid, uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.reverse_sales_invoice_atomic(uuid, uuid, uuid, text) to service_role';
end;
$$;
