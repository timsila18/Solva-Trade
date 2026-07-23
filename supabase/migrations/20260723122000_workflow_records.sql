create table if not exists public.workflow_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  module_name text not null,
  process_name text not null,
  document_name text,
  intent text not null,
  status text not null default 'submitted' check (status in ('draft','validated','submitted','generated','posted','failed')),
  reference_number text not null,
  record_payload jsonb not null default '{}'::jsonb,
  source_table text,
  source_record_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, reference_number)
);

create index if not exists workflow_records_business_module_idx
  on public.workflow_records(business_id, module_name, process_name, created_at desc);

alter table public.workflow_records enable row level security;

drop policy if exists workflow_records_member_read on public.workflow_records;
create policy workflow_records_member_read
  on public.workflow_records
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists workflow_records_member_insert on public.workflow_records;
create policy workflow_records_member_insert
  on public.workflow_records
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

drop policy if exists workflow_records_manager_update on public.workflow_records;
create policy workflow_records_manager_update
  on public.workflow_records
  for update
  to authenticated
  using (public.current_user_business_role(business_id) in ('owner','manager'))
  with check (public.current_user_business_role(business_id) in ('owner','manager'));

grant select, insert, update on public.workflow_records to authenticated;
