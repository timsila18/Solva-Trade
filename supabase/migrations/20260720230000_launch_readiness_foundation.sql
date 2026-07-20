do $$
begin
  create type public.business_lifecycle_status as enum (
    'pending_verification',
    'onboarding',
    'trial',
    'active',
    'grace_period',
    'payment_overdue',
    'restricted',
    'suspended',
    'cancelled',
    'archived',
    'scheduled_for_deletion'
  );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.platform_role as enum (
    'super_administrator',
    'operations_administrator',
    'support_agent',
    'finance_administrator',
    'security_reviewer',
    'read_only_auditor'
  );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.saas_subscription_status as enum (
    'trialing',
    'active',
    'payment_pending',
    'past_due',
    'grace_period',
    'restricted',
    'suspended',
    'cancelled',
    'expired',
    'pending_activation'
  );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.billing_payment_status as enum (
    'created',
    'pending',
    'submitted',
    'processing',
    'paid',
    'failed',
    'cancelled',
    'expired',
    'reversed',
    'needs_review'
  );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.billing_provider as enum (
    'mpesa',
    'card',
    'bank_transfer',
    'manual',
    'invoice_billing',
    'partner_paid',
    'promotional'
  );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.job_status as enum ('queued','running','succeeded','failed','retry_scheduled','cancelled','dead_letter');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.import_status as enum ('draft','mapping','validating','preview','ready','committing','committed','failed','rolled_back');
exception when duplicate_object then null;
end;
$$;

alter table public.businesses
  add column if not exists lifecycle_status public.business_lifecycle_status not null default 'onboarding',
  add column if not exists lifecycle_status_changed_at timestamptz not null default now(),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists grace_period_ends_at timestamptz,
  add column if not exists retention_ends_at timestamptz,
  add column if not exists scheduled_deletion_at timestamptz,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists go_live_date date,
  add column if not exists onboarding_owner_id uuid references public.profiles(id),
  add column if not exists support_contact_name text,
  add column if not exists support_contact_email text,
  add column if not exists security_settings jsonb not null default '{}'::jsonb,
  add column if not exists locale_settings jsonb not null default '{"currency":"KES","date_format":"dd/MM/yyyy","time_zone":"Africa/Nairobi","week_start":"monday"}'::jsonb;

create table public.platform_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null,
  active boolean not null default true,
  mfa_required boolean not null default true,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (user_id, role)
);

create table public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid references public.platform_users(id),
  business_id uuid references public.businesses(id),
  action text not null,
  sensitivity text not null default 'standard' check (sensitivity in ('standard','sensitive','restricted')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform_user_id uuid not null references public.platform_users(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  reason text not null,
  access_scope text not null default 'support_metadata',
  status text not null default 'pending' check (status in ('pending','approved','active','expired','revoked','rejected')),
  starts_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  plan_name text not null,
  description text not null,
  currency text not null default 'KES',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','quarterly','annual','custom')),
  base_price numeric(18, 4) not null default 0 check (base_price >= 0),
  onboarding_fee numeric(18, 4) not null default 0 check (onboarding_fee >= 0),
  trial_days integer not null default 14 check (trial_days >= 0),
  included_users integer,
  included_branches integer,
  included_warehouses integer,
  included_products integer,
  included_monthly_invoices integer,
  included_storage_mb integer,
  included_etims_submissions integer,
  included_report_exports integer,
  included_integrations integer,
  support_level text not null default 'standard',
  feature_entitlements jsonb not null default '{}'::jsonb,
  overage_rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  public boolean not null default true,
  effective_start_date date not null default current_date,
  effective_end_date date,
  display_order integer not null default 100,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  entitlement_code text not null unique,
  name text not null,
  description text not null,
  category text not null,
  backend_enforcement_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  entitlement_id uuid not null references public.feature_entitlements(id) on delete cascade,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  unique (plan_id, entitlement_id)
);

create table public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id),
  plan_version jsonb not null,
  status public.saas_subscription_status not null default 'pending_activation',
  billing_interval text not null,
  currency text not null,
  base_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  subscription_start_at timestamptz,
  current_period_start date,
  current_period_end date,
  renewal_date date,
  cancellation_requested_at timestamptz,
  cancellation_effective_at timestamptz,
  grace_period_end_at timestamptz,
  suspended_at timestamptz,
  external_billing_reference text,
  payment_method_reference text,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  active boolean not null default true
);

create unique index saas_subscriptions_one_active_business
  on public.saas_subscriptions(business_id)
  where active = true;

create table public.business_usage_limits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.saas_subscriptions(id) on delete set null,
  metric_code text not null,
  billing_period_start date not null,
  billing_period_end date not null,
  included_amount numeric(18, 4),
  actual_amount numeric(18, 4) not null default 0,
  overage_amount numeric(18, 4) not null default 0,
  warn_at_percentage numeric(9, 4) not null default 80,
  hard_limit boolean not null default false,
  override_amount numeric(18, 4),
  override_reason text,
  override_expires_at timestamptz,
  last_calculated_at timestamptz not null default now(),
  unique (business_id, metric_code, billing_period_start, billing_period_end)
);

create table public.subscription_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id),
  billing_interval text not null,
  status text not null default 'draft' check (status in ('draft','reviewed','payment_created','payment_verified','activated','cancelled','expired','failed')),
  currency text not null,
  subtotal_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  coupon_code text,
  consent_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (business_id, idempotency_key)
);

create table public.subscription_payment_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  checkout_session_id uuid references public.subscription_checkout_sessions(id) on delete set null,
  provider public.billing_provider not null,
  status public.billing_payment_status not null default 'created',
  amount numeric(18, 4) not null check (amount >= 0),
  currency text not null default 'KES',
  provider_reference text,
  checkout_request_id text,
  merchant_request_id text,
  masked_phone text,
  customer_reference text,
  payment_intent_reference text,
  payment_method_token_reference text,
  idempotency_key text not null,
  submitted_at timestamptz,
  verified_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, provider, idempotency_key),
  unique (provider, provider_reference)
);

create table public.subscription_payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.subscription_payment_requests(id) on delete cascade,
  provider public.billing_provider not null,
  event_reference text not null,
  event_type text not null,
  verified boolean not null default false,
  replay_detected boolean not null default false,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  unique (provider, event_reference, payload_hash)
);

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.saas_subscriptions(id),
  invoice_number text not null,
  invoice_date date not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  currency text not null default 'KES',
  subtotal_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  amount_due numeric(18, 4) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','part_paid','paid','void','written_off')),
  receipt_reference text,
  billing_entity_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table public.subscription_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.subscription_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(18, 4) not null default 1,
  unit_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0
);

create table public.subscription_plan_changes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.saas_subscriptions(id),
  from_plan_id uuid references public.saas_plans(id),
  to_plan_id uuid references public.saas_plans(id),
  change_type text not null check (change_type in ('upgrade_now','upgrade_renewal','downgrade_renewal','manual_enterprise','trial_conversion')),
  effective_date date not null,
  price_snapshot jsonb not null,
  usage_check_snapshot jsonb not null default '{}'::jsonb,
  consent_by uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','payment_required','approved','active','blocked','cancelled')),
  created_at timestamptz not null default now()
);

create table public.subscription_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.saas_subscriptions(id),
  requested_by uuid references public.profiles(id),
  reason text,
  effective_date date not null,
  access_effects jsonb not null default '{}'::jsonb,
  retention_policy jsonb not null default '{}'::jsonb,
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','reactivated','completed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  name text not null,
  description text not null,
  suggested_configuration jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  display_order integer not null default 100
);

create table public.business_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  stage_key text not null,
  stage_name text not null,
  required boolean not null default true,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','skipped','waived','blocked')),
  blocker_reason text,
  waiver_reason text,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  display_order integer not null default 100,
  unique (business_id, stage_key)
);

create table public.import_centre_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_type text not null,
  status public.import_status not null default 'draft',
  template_version text not null default 'v1',
  original_filename text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  committed_rows integer not null default 0,
  column_mapping jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  rollback_reference text,
  created_by uuid references public.profiles(id),
  committed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table public.go_live_checklist_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  check_key text not null,
  label text not null,
  blocking boolean not null default true,
  status text not null default 'pending' check (status in ('pending','passed','failed','waived')),
  waiver_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  unique (business_id, check_key)
);

create table public.ownership_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  current_owner_id uuid not null references public.profiles(id),
  new_owner_id uuid not null references public.profiles(id),
  status text not null default 'pending_new_owner_confirmation' check (status in ('pending_new_owner_confirmation','pending_secondary_approval','approved','completed','cancelled','expired')),
  confirmation_message text not null,
  effective_at timestamptz,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  unique (business_id, current_owner_id, new_owner_id, requested_at)
);

create table public.user_security_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mfa_enabled boolean not null default false,
  mfa_method text,
  mfa_enrolled_at timestamptz,
  mfa_last_verified_at timestamptz,
  recovery_codes_regenerated_at timestamptz,
  account_locked_until timestamptz,
  suspicious_login_count integer not null default 0,
  trusted_device_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.user_session_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_hash text not null,
  device_label text,
  browser_label text,
  approximate_location text,
  signed_in_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  unique (user_id, session_hash)
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  name text not null,
  scopes text[] not null default '{}',
  active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  endpoint_type text not null,
  target_url text not null,
  secret_reference text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid references public.webhook_endpoints(id) on delete set null,
  provider text not null,
  event_id text not null,
  payload_hash text not null,
  signature_verified boolean not null default false,
  replay_detected boolean not null default false,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, event_id, payload_hash)
);

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  job_type text not null,
  status public.job_status not null default 'queued',
  idempotency_key text not null,
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_type, idempotency_key)
);

create table public.application_error_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  severity text not null default 'error',
  source text not null,
  message text not null,
  fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity public.alert_severity not null default 'information',
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.backup_verification_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  backup_reference text not null,
  status text not null default 'pending' check (status in ('pending','verified','failed','needs_review')),
  recovery_point_objective_minutes integer,
  recovery_time_objective_minutes integer,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  export_scope text not null default 'full_business',
  status text not null default 'requested' check (status in ('requested','processing','ready','downloaded','expired','failed','cancelled')),
  file_reference text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.account_closure_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  reason text,
  status text not null default 'requested' check (status in ('requested','confirmed','retention_hold','scheduled_for_deletion','cancelled','completed')),
  confirmed_at timestamptz,
  scheduled_deletion_at timestamptz,
  retention_hold_reason text,
  created_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_code text not null,
  title text not null,
  version text not null,
  status text not null default 'draft' check (status in ('draft','review','published','retired')),
  public_url text,
  effective_date date,
  created_at timestamptz not null default now(),
  unique (document_code, version)
);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  requester_id uuid references public.profiles(id),
  subject text not null,
  category text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','waiting_on_customer','waiting_on_support','resolved','closed')),
  assigned_platform_user_id uuid references public.platform_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  module_key text not null,
  title text not null,
  description text not null,
  active boolean not null default true,
  display_order integer not null default 100,
  unique (audience, module_key)
);

create table public.user_training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  training_module_id uuid not null references public.training_modules(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','skipped')),
  completed_at timestamptz,
  unique (user_id, business_id, training_module_id)
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null,
  description text not null,
  enabled boolean not null default false,
  environment text not null default 'all',
  business_id uuid references public.businesses(id) on delete cascade,
  rollout_percentage numeric(9, 4),
  created_at timestamptz not null default now(),
  unique (flag_key, environment, business_id)
);

create or replace view public.platform_admin_overview
with (security_invoker = true)
as
select
  count(*) as total_businesses,
  count(*) filter (where active = true) as active_businesses,
  count(*) filter (where lifecycle_status = 'trial') as trial_businesses,
  count(*) filter (where subscription_status = 'active') as paying_businesses,
  count(*) filter (where lifecycle_status = 'suspended') as suspended_businesses,
  count(*) filter (where lifecycle_status = 'cancelled') as cancelled_businesses,
  count(*) filter (where onboarding_status <> 'complete') as businesses_pending_onboarding,
  coalesce((select count(*) from public.business_memberships bm where bm.active = true), 0) as total_active_users,
  coalesce((select sum(total_amount) from public.saas_subscriptions ss where ss.status = 'active' and ss.billing_interval = 'monthly'), 0) as monthly_recurring_revenue_foundation,
  coalesce((select count(*) from public.subscription_payment_requests spr where spr.status in ('failed','needs_review')), 0) as failed_payments,
  coalesce((select count(*) from public.application_error_events aee where aee.resolved_at is null), 0) as open_application_errors,
  coalesce((select count(*) from public.security_events se where se.reviewed_at is null and se.severity in ('critical','escalation')), 0) as open_security_alerts,
  coalesce((select count(*) from public.support_cases sc where sc.status not in ('resolved','closed')), 0) as open_support_cases
from public.businesses;

create or replace view public.tenant_subscription_overview
with (security_invoker = true)
as
select
  b.id as business_id,
  b.lifecycle_status,
  b.trial_ends_at,
  b.grace_period_ends_at,
  sp.plan_name,
  ss.status as subscription_status,
  ss.renewal_date,
  ss.current_period_start,
  ss.current_period_end,
  ss.currency,
  ss.total_amount
from public.businesses b
left join public.saas_subscriptions ss on ss.business_id = b.id and ss.active = true
left join public.saas_plans sp on sp.id = ss.plan_id;

create index businesses_lifecycle_idx on public.businesses(lifecycle_status, subscription_status, active);
create index platform_users_user_idx on public.platform_users(user_id, active, role);
create index support_access_business_idx on public.support_access_grants(business_id, status, expires_at);
create index saas_subscriptions_business_idx on public.saas_subscriptions(business_id, status, renewal_date);
create index usage_limits_business_idx on public.business_usage_limits(business_id, metric_code, billing_period_start, billing_period_end);
create index payment_requests_business_idx on public.subscription_payment_requests(business_id, status, provider, created_at);
create index import_batches_business_idx on public.import_centre_batches(business_id, import_type, status, created_at);
create index background_jobs_status_idx on public.background_jobs(status, run_after, job_type);
create index security_events_business_idx on public.security_events(business_id, severity, created_at desc);
create index error_events_business_idx on public.application_error_events(business_id, severity, created_at desc);
create index data_export_business_idx on public.data_export_requests(business_id, status, created_at);

alter table public.platform_users enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.support_access_grants enable row level security;
alter table public.saas_plans enable row level security;
alter table public.feature_entitlements enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.business_usage_limits enable row level security;
alter table public.subscription_checkout_sessions enable row level security;
alter table public.subscription_payment_requests enable row level security;
alter table public.subscription_payment_events enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_invoice_lines enable row level security;
alter table public.subscription_plan_changes enable row level security;
alter table public.subscription_cancellation_requests enable row level security;
alter table public.onboarding_templates enable row level security;
alter table public.business_onboarding_progress enable row level security;
alter table public.import_centre_batches enable row level security;
alter table public.go_live_checklist_items enable row level security;
alter table public.ownership_transfer_requests enable row level security;
alter table public.user_security_profiles enable row level security;
alter table public.user_session_registry enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_receipts enable row level security;
alter table public.background_jobs enable row level security;
alter table public.application_error_events enable row level security;
alter table public.security_events enable row level security;
alter table public.backup_verification_runs enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.account_closure_requests enable row level security;
alter table public.legal_documents enable row level security;
alter table public.support_cases enable row level security;
alter table public.training_modules enable row level security;
alter table public.user_training_progress enable row level security;
alter table public.feature_flags enable row level security;

create policy platform_users_self_read on public.platform_users for select to authenticated using (user_id = (select auth.uid()));
create policy platform_users_admin_read on public.platform_users for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true and pu.role in ('super_administrator','security_reviewer','read_only_auditor')));
create policy platform_audit_platform_read on public.platform_audit_logs for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true));
create policy support_access_platform_read on public.support_access_grants for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true));
create policy businesses_platform_metadata_read on public.businesses for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true));
create policy memberships_platform_metadata_read on public.business_memberships for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true and pu.role in ('super_administrator','operations_administrator','support_agent','security_reviewer','read_only_auditor')));

create policy public_plans_read on public.saas_plans for select to authenticated using (public = true and active = true);
create policy platform_plans_read on public.saas_plans for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true));
create policy entitlements_read on public.feature_entitlements for select to authenticated using (active = true);
create policy plan_entitlements_read on public.plan_entitlements for select to authenticated using (true);
create policy onboarding_templates_read on public.onboarding_templates for select to authenticated using (active = true);
create policy legal_documents_read on public.legal_documents for select to authenticated using (status = 'published');
create policy training_modules_read on public.training_modules for select to authenticated using (active = true);

create policy tenant_subscriptions_owner_read on public.saas_subscriptions for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy usage_owner_read on public.business_usage_limits for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy checkout_owner_write on public.subscription_checkout_sessions for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy payment_requests_owner_read on public.subscription_payment_requests for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy payment_events_owner_read on public.subscription_payment_events for select to authenticated using (exists (select 1 from public.subscription_payment_requests pr where pr.id = payment_request_id and public.current_user_business_role(pr.business_id) = 'owner'));
create policy subscription_invoices_owner_read on public.subscription_invoices for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy subscription_invoice_lines_owner_read on public.subscription_invoice_lines for select to authenticated using (exists (select 1 from public.subscription_invoices si where si.id = invoice_id and public.current_user_business_role(si.business_id) = 'owner'));
create policy plan_changes_owner_read on public.subscription_plan_changes for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy cancellation_owner_write on public.subscription_cancellation_requests for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy onboarding_progress_member_read on public.business_onboarding_progress for select to authenticated using (public.current_user_has_business_access(business_id));
create policy onboarding_progress_owner_write on public.business_onboarding_progress for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy import_centre_member_read on public.import_centre_batches for select to authenticated using (public.current_user_has_business_access(business_id));
create policy import_centre_manager_write on public.import_centre_batches for all to authenticated using (public.current_user_business_role(business_id) in ('owner','manager')) with check (public.current_user_business_role(business_id) in ('owner','manager'));
create policy go_live_member_read on public.go_live_checklist_items for select to authenticated using (public.current_user_has_business_access(business_id));
create policy go_live_owner_write on public.go_live_checklist_items for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy ownership_transfer_owner_read on public.ownership_transfer_requests for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy user_security_self_read on public.user_security_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy user_sessions_self_read on public.user_session_registry for select to authenticated using (user_id = (select auth.uid()));
create policy user_sessions_self_update on public.user_session_registry for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy api_keys_owner_read on public.api_keys for select to authenticated using (public.current_user_business_role(business_id) = 'owner');
create policy webhooks_owner_read on public.webhook_endpoints for select to authenticated using (business_id is null or public.current_user_business_role(business_id) = 'owner');
create policy webhook_receipts_owner_read on public.webhook_receipts for select to authenticated using (exists (select 1 from public.webhook_endpoints we where we.id = endpoint_id and (we.business_id is null or public.current_user_business_role(we.business_id) = 'owner')));
create policy background_jobs_owner_read on public.background_jobs for select to authenticated using (business_id is null or public.current_user_business_role(business_id) = 'owner');
create policy error_events_owner_read on public.application_error_events for select to authenticated using (business_id is null or public.current_user_business_role(business_id) = 'owner');
create policy security_events_owner_read on public.security_events for select to authenticated using (business_id is null or public.current_user_business_role(business_id) = 'owner');
create policy backup_platform_read on public.backup_verification_runs for select to authenticated using (exists (select 1 from public.platform_users pu where pu.user_id = (select auth.uid()) and pu.active = true));
create policy data_export_owner_write on public.data_export_requests for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy account_closure_owner_write on public.account_closure_requests for all to authenticated using (public.current_user_business_role(business_id) = 'owner') with check (public.current_user_business_role(business_id) = 'owner');
create policy support_cases_member_read on public.support_cases for select to authenticated using (business_id is not null and public.current_user_has_business_access(business_id));
create policy support_cases_member_write on public.support_cases for all to authenticated using (business_id is not null and public.current_user_has_business_access(business_id)) with check (business_id is not null and public.current_user_has_business_access(business_id));
create policy training_progress_self on public.user_training_progress for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy feature_flags_member_read on public.feature_flags for select to authenticated using (business_id is null or public.current_user_has_business_access(business_id));

grant select, insert, update, delete on
  public.platform_users,
  public.platform_audit_logs,
  public.support_access_grants,
  public.saas_plans,
  public.feature_entitlements,
  public.plan_entitlements,
  public.saas_subscriptions,
  public.business_usage_limits,
  public.subscription_checkout_sessions,
  public.subscription_payment_requests,
  public.subscription_payment_events,
  public.subscription_invoices,
  public.subscription_invoice_lines,
  public.subscription_plan_changes,
  public.subscription_cancellation_requests,
  public.onboarding_templates,
  public.business_onboarding_progress,
  public.import_centre_batches,
  public.go_live_checklist_items,
  public.ownership_transfer_requests,
  public.user_security_profiles,
  public.user_session_registry,
  public.api_keys,
  public.webhook_endpoints,
  public.webhook_receipts,
  public.background_jobs,
  public.application_error_events,
  public.security_events,
  public.backup_verification_runs,
  public.data_export_requests,
  public.account_closure_requests,
  public.legal_documents,
  public.support_cases,
  public.training_modules,
  public.user_training_progress,
  public.feature_flags
to authenticated;

grant select on public.platform_admin_overview, public.tenant_subscription_overview to authenticated;

insert into public.saas_plans (plan_code, plan_name, description, currency, billing_interval, base_price, trial_days, included_users, included_branches, included_warehouses, included_products, included_monthly_invoices, included_storage_mb, included_etims_submissions, included_report_exports, included_integrations, support_level, display_order)
values
  ('starter', 'Starter', 'Entry plan for small businesses starting structured operations.', 'KES', 'monthly', 2500, 14, 3, 1, 1, 500, 300, 1024, 300, 25, 1, 'standard', 10),
  ('growth', 'Growth', 'Growing SME plan with branches, reports and stronger controls.', 'KES', 'monthly', 6500, 14, 10, 3, 5, 5000, 2000, 5120, 2000, 100, 3, 'priority', 20),
  ('professional', 'Professional', 'Advanced operations, accounting, tax and dashboards for multi-branch teams.', 'KES', 'monthly', 14500, 14, 30, 10, 20, 25000, 10000, 20480, 10000, 500, 10, 'priority', 30),
  ('enterprise', 'Enterprise', 'Configurable enterprise plan with negotiated limits and support.', 'KES', 'monthly', 0, 30, null, null, null, null, null, null, null, null, null, 'dedicated', 40),
  ('custom', 'Custom', 'Custom commercial agreement managed by platform finance.', 'KES', 'custom', 0, 0, null, null, null, null, null, null, null, null, null, 'dedicated', 50)
on conflict (plan_code) do nothing;

insert into public.feature_entitlements (entitlement_code, name, description, category, backend_enforcement_key)
values
  ('inventory', 'Inventory', 'Products, stock balances and stock movements.', 'Operations', 'inventory'),
  ('purchasing', 'Purchasing', 'Suppliers, purchase orders, GRNs and supplier bills.', 'Operations', 'purchasing'),
  ('sales', 'Sales', 'Customers, quotations, orders, invoices and receipts.', 'Operations', 'sales'),
  ('distribution', 'Distribution', 'Routes, vehicles, drivers, deliveries and packaging.', 'Operations', 'distribution'),
  ('multiple_branches', 'Multiple branches', 'Operate more than one branch.', 'Scale', 'branches'),
  ('multiple_warehouses', 'Multiple warehouses', 'Operate more than one warehouse.', 'Scale', 'warehouses'),
  ('accounting', 'Accounting', 'Chart of accounts, journals, GL and trial balance.', 'Finance', 'accounting'),
  ('financial_statements', 'Financial statements', 'P&L, balance sheet, cash flow and management packs.', 'Finance', 'financial_reporting'),
  ('budgets', 'Budgets', 'Budgets, forecasts and variance reports.', 'Finance', 'budgets'),
  ('tax_management', 'Tax management', 'VAT, withholding and tax reports.', 'Compliance', 'tax'),
  ('etims_integration', 'eTIMS integration', 'External tax submission architecture.', 'Compliance', 'etims'),
  ('command_centre', 'Business Command Centre', 'Executive command centre and health score.', 'Intelligence', 'command_centre'),
  ('advanced_dashboards', 'Advanced dashboards', 'Role dashboards and insight centre.', 'Intelligence', 'dashboards'),
  ('custom_roles', 'Custom roles', 'Granular permission presets and overrides.', 'Administration', 'roles'),
  ('approval_workflows', 'Approval workflows', 'Approval policies and sensitive-action review.', 'Controls', 'approvals'),
  ('imports', 'Imports', 'Import centre with mapping and validation.', 'Data', 'imports'),
  ('exports', 'Exports', 'Business data export and report exports.', 'Data', 'exports'),
  ('api_access', 'API access', 'API key foundations.', 'Integrations', 'api'),
  ('scheduled_reports', 'Scheduled reports', 'Scheduled report foundation.', 'Reports', 'scheduled_reports'),
  ('premium_support', 'Premium support', 'Priority or dedicated support level.', 'Support', 'support'),
  ('custom_branding', 'Custom branding', 'Logo and document theme controls.', 'Branding', 'branding'),
  ('audit_exports', 'Audit exports', 'Audit trail export foundation.', 'Controls', 'audit_exports'),
  ('historical_retention', 'Historical data retention', 'Extended data-retention policies.', 'Compliance', 'retention'),
  ('advanced_forecasting', 'Advanced forecasting', 'Forecast indicators and trend engine.', 'Intelligence', 'forecasting'),
  ('multi_currency_foundation', 'Multi-currency foundation', 'Currency and exchange-rate foundations.', 'Finance', 'multi_currency')
on conflict (entitlement_code) do nothing;

insert into public.onboarding_templates (template_code, name, description, suggested_configuration, display_order)
values
  ('distributor', 'Distributor', 'Products, suppliers, vehicles, routes, returnable packaging, driver cash and VAT setup.', '{"inventory":true,"distribution":true,"packaging":true}'::jsonb, 10),
  ('wholesaler', 'Wholesaler', 'Bulk products, supplier pricing, customer credit, warehouse controls and reports.', '{"inventory":true,"purchasing":true,"sales":true}'::jsonb, 20),
  ('retailer', 'Retailer', 'Fast product setup, cash/M-Pesa sales, stock counts and daily dashboard.', '{"sales":true,"inventory":true}'::jsonb, 30),
  ('restaurant', 'Restaurant', 'Ingredients, recipes foundation, cash controls, expenses and daily sales.', '{"inventory":true,"cash_controls":true}'::jsonb, 40),
  ('pharmacy', 'Pharmacy', 'Batches, expiry, suppliers, stock counts and compliance-ready tax setup.', '{"expiry_tracking":true,"batches":true}'::jsonb, 50),
  ('hardware', 'Hardware Store', 'Units, categories, supplier price lists, customer balances and branch stock.', '{"units":true,"credit_customers":true}'::jsonb, 60),
  ('manufacturer', 'Manufacturer', 'Raw materials, finished goods, costing, warehouses and accounting controls.', '{"raw_materials":true,"finished_goods":true}'::jsonb, 70),
  ('service_business', 'Service Business', 'Services, customers, invoices, expenses, tax and financial reports.', '{"services":true,"inventory":false}'::jsonb, 80),
  ('general_sme', 'General SME', 'Balanced setup for sales, purchases, inventory, cashbook and reports.', '{"general":true}'::jsonb, 90)
on conflict (template_code) do nothing;

insert into public.training_modules (audience, module_key, title, description, display_order)
values
  ('owner', 'getting_started', 'Getting started', 'Create business, select plan, invite team and go live.', 10),
  ('manager', 'daily_workflows', 'Daily workflows', 'Review dashboard, approvals, inventory and reports.', 20),
  ('cashier', 'receipts', 'Receipts and cash', 'Record receipts, cash counts and safe handover.', 30),
  ('salesperson', 'sales', 'Sales workflow', 'Create quotations, invoices and collection follow-up.', 40),
  ('storekeeper', 'stock', 'Stock workflow', 'Lookup stock, receive goods, count stock and resolve variances.', 50),
  ('driver', 'delivery', 'Driver workflow', 'Complete stops, collect payments, return packaging and hand over cash.', 60),
  ('accountant', 'month_end', 'Month-end workflow', 'Reconcile, post journals, prepare tax and close periods.', 70)
on conflict (audience, module_key) do nothing;
