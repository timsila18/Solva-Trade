do $$
begin
  execute 'revoke all on function public.post_customer_collection_atomic(uuid, uuid, uuid[], text, numeric, text, timestamptz, text, text, uuid, text) from public, anon, authenticated';
  execute 'grant execute on function public.post_customer_collection_atomic(uuid, uuid, uuid[], text, numeric, text, timestamptz, text, text, uuid, text) to service_role';
end;
$$;
