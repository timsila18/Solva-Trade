# Environment Variable Guide

Use real secrets only in the hosting provider or local `.env.local`; never commit them.

| Variable | Purpose | Environments | Scope | Example |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL and auth redirects | all | public | `https://solva-trade.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | all | public | `https://project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key | all | public | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only maintenance jobs | production, CI | server | stored in Vercel env only |
| `DATABASE_URL` | Migration and job database URL | production, CI | server | `postgresql://...` |
| `EMAIL_PROVIDER_API_KEY` | Transactional email adapter | production | server | provider secret |
| `MPESA_CONSUMER_KEY` | M-Pesa adapter credential | production | server | provider key |
| `MPESA_CONSUMER_SECRET` | M-Pesa adapter credential | production | server | provider secret |
| `CARD_PROVIDER_SECRET_KEY` | Card payment adapter secret | production | server | provider secret |
| `ETIMS_PROVIDER_SECRET` | eTIMS adapter credential reference | production | server | credential reference |
| `WEBHOOK_SIGNING_SECRET` | Webhook signature validation | production | server | random secret |
| `CRON_SECRET` | Scheduled job authorization | production | server | random secret |
| `ERROR_MONITORING_DSN` | Error monitoring provider | production | server | DSN |
| `SUPPORT_EMAIL` | Tenant-visible support contact | all | public | `support@example.com` |
| `PLATFORM_ADMIN_ALLOWLIST` | Initial platform-admin bootstrap | production | server | comma-separated emails |

If a required server secret is missing, billing, cron, webhook and provider integrations must fail closed and leave records in `needs_review`, `failed` or `pending_activation` rather than pretending success.
