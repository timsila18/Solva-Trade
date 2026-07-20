# Operations, Support And Monitoring

## Platform Administration

Internal platform roles are independent from tenant roles:

- Platform Super Administrator
- Platform Operations Administrator
- Platform Support Agent
- Platform Finance Administrator
- Platform Security Reviewer
- Read-Only Platform Auditor

Aggregated platform metadata is exposed through `platform_admin_overview`. Tenant transaction detail must not be browsed casually by platform staff.

## Support

Support cases live in `support_cases`. Sensitive support access requires `support_access_grants` with business, platform user, scope, reason, approval and expiry. All high-risk access should produce `platform_audit_logs`.

## Background Jobs

`background_jobs` stores job type, status, idempotency key, attempts, retry schedule, lock time and payload. Jobs should be environment-aware and authorized with `CRON_SECRET`.

Scheduled jobs to configure:

- Trial expiry checks
- Subscription renewal checks
- Payment overdue checks
- Usage aggregation
- Morning Brief generation
- Business Health generation
- Tax reminders
- Inventory alerts
- Customer and supplier due alerts
- Expiry alerts
- Scheduled reports
- Backup verification
- Retention jobs
- Queue cleanup
- Integration health checks

## Observability

Application errors are stored in `application_error_events`; security events in `security_events`; backup checks in `backup_verification_runs`. External monitoring provider setup remains manual before production-ready classification.

## Data Retention

Cancellation and closure flows must preserve export access during policy-defined retention. Deletion requires confirmation, advance notice, audit record and legal-hold checks.
