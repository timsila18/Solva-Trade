# Production Launch Guide

## Launch Checklist

- Production domain, SSL and DNS verified.
- Vercel environment variables configured from `docs/ENVIRONMENT.md`.
- Supabase migrations applied and migration history checked.
- RLS advisors reviewed; no new launch-blocking tenant data exposure accepted.
- Production seed contains plans, entitlements and templates only; no fake tenants, users or transactions.
- Supabase Auth redirect URLs match production and preview URLs.
- Email domain, payment credentials, payment webhooks and eTIMS environment configured.
- Error monitoring, analytics, queue monitoring and integration monitoring connected.
- Backup policy enabled and restore drill completed.
- Cron jobs configured with `CRON_SECRET`.
- Platform administrator accounts enrolled with MFA before platform access.
- Legal documents reviewed, approved and published.
- Pilot support contact and status-page foundation available.
- Smoke tests completed and rollback plan rehearsed.

## Rollback

1. Identify the last healthy Vercel deployment.
2. Promote or roll back to that deployment.
3. Do not roll back database migrations destructively.
4. If a migration caused a blocker, apply a forward-fix migration.
5. Record the incident in platform audit and support notes.

## Backup And Restore

Backups are a launch blocker until the managed Supabase backup policy and at least one restore drill are verified. Record each drill in `backup_verification_runs` with RPO, RTO, backup reference, status and notes.

## Disaster Recovery

Minimum DR plan for pilot:

- Preserve database backups and migration history.
- Keep Vercel deployment rollback access.
- Keep provider credential rotation procedure.
- Document incident owner, customer communication owner and recovery timeline.
- Run restore verification before any production-ready classification.
