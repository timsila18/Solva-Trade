# Testing And Quality Guide

## Current Automated Tests

Run:

```powershell
node tests\run-all.mjs
npx eslint .
npx tsc --noEmit --pretty false
.\node_modules\.bin\next.cmd build
```

Current suites cover permissions, configuration, inventory, purchasing, distribution, treasury, accounting, financial reporting, tax compliance, business intelligence and SaaS platform helpers.

## Required Expansion Before Production Ready

- Database RLS tests against separate tenants.
- API tests once API routes are introduced.
- Payment webhook tests with signed provider callbacks.
- Queue retry and idempotency integration tests.
- Import/export tests with large files and CSV formula injection.
- End-to-end critical flows for signup, onboarding, sale, payment, stock, journal, dashboard, billing and cancellation.
- Performance smoke tests with 10,000 products, 100,000 customers, 100,000 invoices and 1,000,000 journal-line foundations.

## Accessibility And Mobile Review

Major pages use semantic headings, responsive grids and named buttons/links. Before full production, run browser-based checks for keyboard focus, zoom, contrast, table headers, chart alternatives and mobile layouts on sign-in, dashboard, approvals, sales, receipts, stock count, delivery, notifications, reports and billing.

## Launch Classification Rule

Use `launchReadinessReport` from `src/lib/saas-platform-data.ts`. Do not mark Production Ready while critical blockers remain for backups, legal review, payment verification, RLS, production build or critical journeys.
