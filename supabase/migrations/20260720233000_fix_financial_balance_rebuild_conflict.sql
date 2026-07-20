create or replace function public.rebuild_financial_account_balance(target_finance_account_id uuid)
returns table(finance_account_id uuid, calculated_balance numeric, stored_balance numeric, difference numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  account_record public.finance_accounts%rowtype;
  total_in numeric(18, 2);
  total_out numeric(18, 2);
  current_balance numeric(18, 2);
  stored numeric(18, 2);
begin
  select * into account_record from public.finance_accounts where id = target_finance_account_id;
  if not found then
    raise exception 'Financial account not found.';
  end if;
  if public.current_user_business_role(account_record.business_id) <> 'owner' then
    raise exception 'Only an Owner can rebuild account balances.';
  end if;

  select
    coalesce(sum(case when direction = 'in' then amount else 0 end), 0),
    coalesce(sum(case when direction = 'out' then amount else 0 end), 0)
  into total_in, total_out
  from public.financial_account_transactions
  where financial_account_transactions.finance_account_id = target_finance_account_id;

  current_balance := coalesce(account_record.opening_balance_placeholder, 0) + total_in - total_out;
  select current_ledger_balance into stored
  from public.financial_account_balances
  where financial_account_balances.finance_account_id = target_finance_account_id;
  stored := coalesce(stored, 0);

  insert into public.financial_account_balances (
    finance_account_id, business_id, branch_id, currency, opening_balance, total_money_in, total_money_out, current_ledger_balance, available_balance, rebuilt_at
  )
  values (
    account_record.id, account_record.business_id, account_record.branch_id, account_record.currency,
    coalesce(account_record.opening_balance_placeholder, 0), total_in, total_out, current_balance, current_balance, now()
  )
  on conflict on constraint financial_account_balances_pkey do update
    set total_money_in = excluded.total_money_in,
        total_money_out = excluded.total_money_out,
        current_ledger_balance = excluded.current_ledger_balance,
        available_balance = excluded.available_balance,
        rebuilt_at = now(),
        updated_at = now();

  return query select target_finance_account_id, current_balance, stored, current_balance - stored;
end;
$$;
