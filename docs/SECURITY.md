# Security And Tenant Isolation

## Tenant Isolation

Tenant-owned tables must include `business_id`, enable RLS and check membership with `current_user_has_business_access` or `current_user_business_role`. Branch-scoped tables should also use `can_access_branch`.

Platform administration is separate from tenant roles. Platform roles are stored in `platform_users`; tenant Owners do not become platform administrators. Support access to tenant-sensitive records must use `support_access_grants` with scope, reason, approval, expiry and platform audit.

## Authentication

Auth uses Supabase SSR cookies. Active business and branch cookies are `httpOnly`, `sameSite=lax`, path-scoped and secure in production. User-facing auth errors are generic to reduce account enumeration risk.

MFA, recovery codes, trusted devices, suspicious-login counters and session registry foundations are stored in `user_security_profiles` and `user_session_registry`.

## Webhooks And API Keys

Webhook receipts store provider, event id, payload hash, signature verification and replay detection. API keys store prefix and hash only; raw keys must be shown once and never stored.

## Export Safety

CSV exports must prefix formula-like cells (`=`, `+`, `-`, `@`) before download. Data exports are requested through `data_export_requests` and should expire.

## Security Headers

`next.config.ts` disables the powered-by header and sets frame, content-type, referrer, permissions-policy and HSTS headers.

## Remaining Manual Security Work

- Configure production MFA for platform admins.
- Connect external error/security monitoring.
- Run a dedicated RLS cross-tenant test suite against a seeded staging database.
- Rotate any credentials pasted into chat or temporary tooling.
