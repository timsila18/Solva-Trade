do $$
declare
  function_definition text;
  old_lookup text := E'  select count(distinct c.id), min(c.id)\n  into valid_customer_count, representative_customer_id\n  from public.customers c\n  where c.business_id = target_business_id\n    and c.active = true\n    and c.id = any(target_customer_ids);';
  corrected_lookup text := E'  select count(distinct c.id)\n  into valid_customer_count\n  from public.customers c\n  where c.business_id = target_business_id\n    and c.active = true\n    and c.id = any(target_customer_ids);\n\n  select c.id\n  into representative_customer_id\n  from public.customers c\n  where c.business_id = target_business_id\n    and c.active = true\n    and c.id = any(target_customer_ids)\n  order by c.id::text\n  limit 1;';
begin
  select pg_get_functiondef(p.oid)
  into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'post_customer_collection_atomic'
    and pg_get_function_identity_arguments(p.oid) = 'target_business_id uuid, target_branch_id uuid, target_customer_ids uuid[], target_collection_name text, target_amount numeric, target_payment_number text, target_payment_date timestamp with time zone, target_method_code text, target_reference text, target_collected_by uuid, target_idempotency_key text';

  if function_definition is null then
    raise exception 'Grouped customer collection function was not found.';
  end if;

  if position(old_lookup in function_definition) > 0 then
    execute replace(function_definition, old_lookup, corrected_lookup);
  end if;
end;
$$;
