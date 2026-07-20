create extension if not exists pgcrypto;

create type public.core_role as enum ('owner', 'manager', 'staff');
create type public.invitation_status as enum ('pending', 'accepted', 'cancelled', 'expired');
create type public.onboarding_status as enum ('not_started', 'in_progress', 'complete');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  profile_photo_path text,
  active boolean not null default true,
  preferred_language text not null default 'en',
  time_zone text not null default 'Africa/Nairobi',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  max_users integer not null,
  max_businesses integer not null,
  max_branches integer not null,
  feature_limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, max_users, max_businesses, max_branches, feature_limits)
values
  ('starter', 'Starter', 3, 1, 1, '{"core_invoicing": true, "core_inventory": true}'::jsonb),
  ('business', 'Business', 10, 1, 10, '{"accounting": true, "distribution": true}'::jsonb),
  ('growth', 'Growth', 50, 5, 50, '{"advanced_reporting": true, "controls": true}'::jsonb)
on conflict (code) do nothing;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text not null,
  logo_path text,
  business_type text,
  activities text[] not null default '{}',
  registration_number text,
  kra_pin text,
  vat_registered boolean not null default false,
  vat_number text,
  phone text,
  email text,
  website text,
  physical_address text,
  county text,
  country text not null default 'Kenya',
  default_currency text not null default 'KES',
  time_zone text not null default 'Africa/Nairobi',
  financial_year_start_month integer not null default 1 check (financial_year_start_month between 1 and 12),
  default_tax_config jsonb not null default '{}'::jsonb,
  default_document_theme jsonb not null default '{}'::jsonb,
  operating_flags jsonb not null default '{}'::jsonb,
  stock_costing_method text not null default 'weighted_average' check (stock_costing_method in ('weighted_average', 'fifo')),
  subscription_plan_id uuid references public.subscription_plans(id),
  subscription_status public.subscription_status not null default 'trialing',
  onboarding_status public.onboarding_status not null default 'not_started',
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role public.core_role not null,
  permission_overrides jsonb not null default '[]'::jsonb,
  invitation_status public.invitation_status not null default 'accepted',
  joined_at timestamptz,
  invited_by uuid references public.profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index business_memberships_one_active
  on public.business_memberships (user_id, business_id)
  where active = true;

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role public.core_role not null,
  staff_template text,
  permission_overrides jsonb not null default '[]'::jsonb,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  module text not null,
  entity_type text,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.business_setup_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key text not null,
  label text not null,
  critical boolean not null default false,
  complete boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, key)
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status public.subscription_status not null default 'trialing',
  trial_start_at timestamptz not null default now(),
  trial_end_at timestamptz,
  billing_cycle text,
  grace_period_ends_at timestamptz,
  suspended_at timestamptz,
  feature_limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_created_by_idx on public.businesses(created_by);
create index businesses_active_idx on public.businesses(active) where deleted_at is null;
create index memberships_business_idx on public.business_memberships(business_id, active);
create index invitations_business_status_idx on public.business_invitations(business_id, status);
create index audit_logs_business_created_idx on public.audit_logs(business_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, business_id) where read_at is null;
create index setup_items_business_idx on public.business_setup_items(business_id);

create or replace function public.current_user_has_business_access(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_memberships bm
    join public.profiles p on p.id = bm.user_id
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.active = true
      and p.active = true
  );
$$;

create or replace function public.current_user_business_role(target_business_id uuid)
returns public.core_role
language sql
security definer
set search_path = public
stable
as $$
  select bm.role
  from public.business_memberships bm
  where bm.business_id = target_business_id
    and bm.user_id = auth.uid()
    and bm.active = true
  limit 1;
$$;

create or replace function public.prevent_last_owner_change()
returns trigger
language plpgsql
as $$
declare
  owner_count integer;
begin
  if old.role = 'owner' and (new.active = false or new.role <> 'owner') then
    select count(*) into owner_count
    from public.business_memberships
    where business_id = old.business_id
      and role = 'owner'
      and active = true
      and id <> old.id;

    if owner_count = 0 then
      raise exception 'A business must retain at least one active Owner.';
    end if;
  end if;
  return new;
end;
$$;

create trigger business_memberships_keep_owner
before update on public.business_memberships
for each row execute function public.prevent_last_owner_change();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.business_invitations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.business_setup_items enable row level security;
alter table public.business_subscriptions enable row level security;

create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy businesses_member_select on public.businesses
  for select using (public.current_user_has_business_access(id));
create policy businesses_owner_update on public.businesses
  for update using (public.current_user_business_role(id) = 'owner')
  with check (public.current_user_business_role(id) = 'owner');
create policy businesses_authenticated_insert on public.businesses
  for insert with check (created_by = auth.uid());

create policy memberships_member_select on public.business_memberships
  for select using (public.current_user_has_business_access(business_id));
create policy memberships_creator_bootstrap_owner on public.business_memberships
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.created_by = auth.uid()
    )
  );
create policy memberships_owner_write on public.business_memberships
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy invitations_owner_manage on public.business_invitations
  for all using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy audit_owner_read on public.audit_logs
  for select using (public.current_user_business_role(business_id) = 'owner');

create policy notifications_member_select on public.notifications
  for select using (user_id = auth.uid() and public.current_user_has_business_access(business_id));
create policy notifications_member_update_read on public.notifications
  for update using (user_id = auth.uid() and public.current_user_has_business_access(business_id))
  with check (user_id = auth.uid() and public.current_user_has_business_access(business_id));

create policy setup_items_member_select on public.business_setup_items
  for select using (public.current_user_has_business_access(business_id));
create policy setup_items_owner_update on public.business_setup_items
  for update using (public.current_user_business_role(business_id) = 'owner')
  with check (public.current_user_business_role(business_id) = 'owner');

create policy subscriptions_owner_select on public.business_subscriptions
  for select using (public.current_user_business_role(business_id) = 'owner');

insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', false),
       ('business-documents', 'business-documents', false)
on conflict (id) do nothing;
