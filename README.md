# Solva Trade

Solva Trade is a multi-tenant SaaS business operating system for Kenyan and African SMEs: inventory, sales, purchasing, distribution, treasury, accounting, financial reporting, tax compliance, command centre, billing and launch-readiness foundations for growing businesses.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL and Storage
- Row Level Security for tenant isolation
- Central role and permission helpers

## Setup

1. Install dependencies with `npm install`.
2. Create `.env.local` with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` for server-only maintenance scripts, never browser code
3. Apply migrations from `supabase/migrations`.
4. Start locally with `npm run dev`.

## Commands

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Production Runbooks

- Architecture: `docs/ARCHITECTURE.md`
- Environment variables: `docs/ENVIRONMENT.md`
- Production launch, rollback, backup and disaster recovery: `docs/PRODUCTION_LAUNCH.md`
- Security and tenant isolation: `docs/SECURITY.md`
- Billing and subscriptions: `docs/BILLING.md`
- Operations, support and monitoring: `docs/OPERATIONS.md`
- Testing and quality: `docs/TESTING_AND_QUALITY.md`

## Foundation Notes

The first migration creates profiles, businesses, memberships, invitations, audit logs, notifications, setup checklist items and subscription-ready plan structures. All business-owned data is scoped by `business_id`.

The second migration adds the business configuration foundation: activities, industry profiles, branches, branch access, warehouses, delivery vehicles, drivers, routes, returnable packaging, units, conversions, categories, brands, price levels, payment methods, finance-account setup, document numbering, document templates, tax/eTIMS settings, credit settings, supplier settings, approval rules, operational preferences and guided presets.

The third migration adds the inventory engine: products, variants, attributes, pack units, product barcodes, bundle components, batches, serial numbers, immutable stock movements, stock balances, FIFO cost layers, reservations, transfers, adjustments, stock counts, reorder settings, inventory alerts, periods, approval records and import batches. Stock movements are immutable and update balances transactionally through a trigger.

The fourth migration adds the supplier and purchasing engine: suppliers, contacts, addresses, compliance documents, supplier products, price history, purchase requisitions, purchase orders, approval records, goods received notes, supplier bills, match records, price variances, supplier returns, credit notes, debit notes, payments, advances, immutable supplier transactions, balances, opening balances, performance metrics, accounting events and import batches. GRN posting creates purchase receipt stock movements, while supplier transactions update creditor balances through a trigger.

The distribution migration adds the delivery engine and also fills the missing customer/sales foundation needed by distribution: customers, customer addresses, sales orders, invoices, customer payments and customer returns. Distribution tables cover route schedules, delivery runs, assigned staff, stops, multi-document stops, loading sheets, delivery notes, proof of delivery, route collections, collection reconciliation, route expenses, delivery returns, vehicle-stock reconciliation, packaging ledgers, customer and vehicle packaging balances, exceptions, timeline events and accounting-event preparation.

The treasury migration extends the existing `finance_accounts` foundation into a unified financial-account model for cash, petty cash, bank, M-Pesa, mobile money, clearing, owner-current and staff-advance accounts. It adds immutable financial-account transactions, balance summaries, general receipts, general payments, expenses, expense claims, petty-cash vouchers and reconciliations, deposits, withdrawals, account transfers, cheques, owner transactions, owner-current ledger, staff advances, advance surrenders, statement imports, reconciliation matching, unidentified receipts, cash counts, daily cash-up, cashflow forecasts and accounting-event preparation.

Later migrations add accounting, financial reporting, Kenyan tax compliance, the command centre and final commercial SaaS launch foundations. Prompt 12 adds separate platform administration, business lifecycle states, plans and entitlements, usage limits, checkout and verified-payment foundations, M-Pesa/card/manual payment records, SaaS invoices, cancellation and retention workflows, Import Centre, go-live checklist, support access controls, API/webhook foundations, jobs, observability, backup verification, data export, account closure, legal documents, training and feature flags.

Launch classification is intentionally conservative. The codebase is **Not Ready** for broad production until manual backup drills, legal review, provider credentials/webhooks, platform-admin MFA, external monitoring and full staging security tests are completed. It is structured for pilot hardening without fake production data.

Authentication pages are present for sign in, account creation, password reset, invitation acceptance, inactive accounts and no-business state. Wire them to Supabase Auth by calling the server-side auth client and then redirecting users into onboarding or the active workspace.

Future modules must use `requireBusinessAccess`, `requireRole`, `requirePermission`, `getActiveBusiness` and `canPerformAction` equivalents before any protected operation.

For branch-scoped modules, also use `getActiveBranch`, `getAccessibleBranches`, `canAccessBranch` and `requireBranchAccess`.

For inventory modules, post quantity changes through the stock movement ledger. Product lists and reports should read `stock_balances` for fast current state, and historical valuation should derive from `stock_movements` and `fifo_cost_layers`.

For purchasing modules, approved suppliers and product price lists feed purchase orders. Posted GRNs create inventory receipts. Posted supplier bills, payments, credit notes, debit notes and opening balances flow through `supplier_transactions`; do not update creditor balances directly.

For distribution modules, dispatch and delivery confirmation must use the immutable stock movement ledger. `stock_recognition_point` controls whether stock was already recognised on invoice or should move through vehicle stock during dispatch and delivery confirmation. Customer collections should create customer-payment records, and crates or empty bottles should flow through the packaging ledger rather than direct balance edits.

For treasury modules, `financial_account_transactions` is the source of truth. Account balances are performance summaries updated transactionally and can be rebuilt from the ledger. Posted receipts, payments, expenses, transfers, owner transactions and staff advances must be corrected through reversal rather than direct mutation.

On Windows, if npm process spawning fails, set:

```powershell
$env:ComSpec='C:\Windows\System32\cmd.exe'
```
