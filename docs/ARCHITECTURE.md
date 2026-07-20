# Solva Trade Architecture

Solva Trade is a tenant-first SaaS application. Every business-owned table uses `business_id`, and database Row Level Security checks active membership before returning data. Future inventory, sales, accounting and distribution tables must follow the same shape: UUID primary key, `business_id`, timestamps, indexes on tenant keys, and RLS policies backed by `current_user_has_business_access`.

The role model is intentionally small: Owner, Manager and Staff. Permissions are granular and centralized in `src/lib/permissions.ts`; UI navigation and backend actions should both call the same helpers. Staff job types are templates, not roles, so a cashier or driver remains a Staff member with selected permissions.

Active business context is stored in an HTTP-only cookie and must be validated against memberships on every protected read or write. Switching businesses should set that cookie, write an audit event, and refresh tenant-scoped data. Never trust a business ID from the client without checking membership.

Foundational modules in this phase are authentication screens, onboarding, business switching shell, team/permission management shell, settings, audit, notifications and role dashboards. Later modules should add transactional tables and server actions without bypassing the tenant helpers.

## Prompt 2 Configuration Foundation

Prompt 2 adds the operating configuration layer before transactional modules arrive. Branches are distinct from businesses: the active business determines tenant scope, while the active branch limits operational visibility for users assigned to selected branches. Use `getActiveBranch`, `getAccessibleBranches`, `canAccessBranch` and `requireBranchAccess` before reading or mutating branch-scoped records.

Configuration tables are business-owned and protected by RLS. Owners have full write access. Managers and Staff can read only where membership, permissions and branch access allow it. Sensitive finance-account and driver-identification fields are limited to owner-level policies.

Document numbering is generated in PostgreSQL by `generate_document_number`. The function locks the active sequence row, increments it server-side, writes immutable history, and never reuses numbers. Future sales, purchases and inventory modules should call this function inside the same transaction that creates the document.

Industry profiles are feature-flag bundles, not hard-coded behaviour. Presets prefill defaults for beverage distributors, general traders, fish suppliers and service businesses, but Owners can keep editing the resulting configuration.

## Prompt 3 Inventory Engine

Inventory is ledger-first. `stock_movements` is immutable and is the source of truth for every stock increase, decrease, transfer, reservation, adjustment, returnable-packaging event and cost revaluation. `stock_balances` is a performance table updated transactionally after posted movements.

Products are tenant-scoped and can represent stock items, services, non-stock items, returnable packaging, raw materials, finished goods, consumables, expense items or custom types. Services and non-stock items do not maintain stock. Variants can carry their own SKU, barcode, stock, pricing and reorder levels.

All quantities are stored in base units. Product pack units define product-specific conversions such as one crate to 24 bottles. Future purchase and sales flows should convert display quantities into base quantities before posting movements.

Weighted average costing is updated on inbound movements. FIFO layers are created for inbound stock so later issue flows can consume oldest layers. FEFO allocation is prepared for expiry-tracked stock and should be used by future sales/delivery allocation flows when expiry tracking is enabled.

## Prompt 4 Purchasing Engine

Purchasing is supplier-led and ledger-backed. Suppliers, contacts, addresses, documents, product mappings and price history are tenant-scoped records with approval-ready status fields. Supplier price changes, payment terms, bank detail changes and credit limits should be routed through the centralized permission model before becoming active.

Purchase requisitions, purchase orders, goods received notes and supplier bills are separate documents so each approval, acknowledgement, receipt and billing step can be audited. GRN posting calls `post_grn_stock_movements`, which writes purchase receipt stock movements into the inventory ledger instead of updating stock quantities directly.

Supplier bills should use two-way or three-way matching. Quantity, price, tax, missing-GRN and overbilling exceptions are stored in match records and require an override permission before posting.

Creditor balances are derived from immutable `supplier_transactions`. Bills, debit notes and opening balances increase supplier balances; payments, credit notes, refunds and advance applications reduce them. Reversals should be posted as new transactions rather than editing historical rows.

## Prompt 6 Distribution Engine

This repository did not contain Prompt 5 customer and sales tables, so the distribution migration first adds the minimum sales foundation required by delivery: customers, addresses, sales orders, invoices, customer payments and customer returns. Distribution should reuse those tables for route planning, delivery collections and customer returns instead of creating duplicate sales or payment engines.

Delivery runs are the operational header for route, vehicle, driver, warehouse, capacity, stop counts, order value, collections, crates, odometer, fuel, approval and closure state. Delivery stops are child records and can also link to multiple orders or invoices through `delivery_stop_documents`.

Loading sheets are generated from sales documents or route-sale planned stock. Dispatch calls `dispatch_delivery_run`, which posts paired `transfer_out` and `transfer_in` stock movements from dispatch warehouse to vehicle warehouse. Delivery confirmation calls `confirm_delivery_note_stock`; when stock recognition is `on_invoice`, it does not post another stock-out, and when recognition is `on_dispatch` or `on_delivery_confirmation`, it issues stock from vehicle stock.

Collections during delivery write route collection records and are designed to link to `customer_payments`. Route collection reconciliation and vehicle-stock reconciliation are separate so cash and stock variance approval can follow different permissions.

Crates, empty bottles and other returnable packaging use immutable `packaging_ledger` records. Customer and vehicle packaging balances are summaries updated from that ledger. Replacement charges, deposit refunds and packaging liabilities should create accounting-event records only when explicitly configured and approved.

Proof-of-delivery records support signatures, recipient details, photos, GPS, timestamps, confirmation codes and customer stamps. Files must remain tenant-scoped and customer personal data should be shown only to authorised users.

## Prompt 7 Treasury Engine

Treasury extends the existing `finance_accounts` table instead of introducing a competing account master. Account records now support cash, petty cash, bank, M-Pesa paybill, M-Pesa till, wallet, mobile money, card settlement, cheque clearing, cash in transit, driver custody, customer collection clearing, supplier payment clearing, owner-current and staff-advance account types.

`financial_account_transactions` is immutable and is the treasury source of truth. It records money in and money out for receipts, payments, expenses, deposits, withdrawals, transfers, owner transactions, staff advances, route handovers, cheques, charges, interest, variances and reversals. `financial_account_balances` is a performance summary updated by trigger and can be rebuilt with `rebuild_financial_account_balance`.

General receipts and payments exist only for money that is outside customer invoice allocation or supplier bill settlement. Customer payments, supplier payments and delivery collections should link into the treasury ledger rather than being duplicated.

Deposits, withdrawals and account transfers create linked ledger entries. Same-account transfers are blocked, cross-currency transfers require an exchange-rate workflow, and fees are preserved separately.

Statement imports create immutable batches, rows and statement lines. Reconciliation sessions and matches support one-to-one, one-to-many, many-to-one, partial and manual matching, with unidentified receipts preserved until allocated.

Owner transactions are deliberately separated from expenses: capital, loans, drawings, repayments and reimbursements feed the owner-current ledger and prepare accounting events for Prompt 8.

## Prompt 8 Accounting Engine

Accounting is journal-led. Operational modules emit standardized `accounting_events`; the posting engine resolves account roles and mappings, creates `journal_entries` and `journal_lines`, validates total debits equal total credits, and posts only inside valid accounting periods. Posted journal lines are immutable, and reversals are new offsetting journals.

The chart of accounts is tenant-scoped and supports account classes, normal balances, parent hierarchy, control accounts, posting flags, system protection, branch and currency restrictions, cash-flow categories and financial-statement sections. The recommended Kenyan SME chart is installable per business through `install_default_chart_of_accounts`, so a business can edit permitted accounts or import its own chart while keeping protected roles mapped.

Account roles are independent of account codes. Posting rules use roles such as `CUSTOMER_RECEIVABLES`, `SUPPLIER_PAYABLES`, `INVENTORY_ASSET`, `OUTPUT_VAT`, `BANK_ACCOUNT`, `OWNER_CAPITAL` and `STAFF_ADVANCES`; role mappings connect those roles to actual accounts. Account mappings add precedence for transaction, product, category, customer, supplier, branch, tax, payment-account and business-default scopes.

Financial years and accounting periods are separate from inventory or treasury operational periods. A posted journal date must fall inside a valid period, and closed or locked periods reject normal postings while diagnostics record blocked attempts.

General ledger and trial-balance views read from posted journal lines only. Subledger reconciliations compare control-account balances to customer, supplier, inventory, treasury, VAT, owner, staff, driver-cash and packaging ledgers without duplicating those operational ledgers.

Accounting imports, attachments, diagnostics and accounting audit trail tables are tenant-scoped and protected by RLS. The UI exposes setup, chart, mappings, queue, manual journals, opening balances, reversals, general ledger, trial balance, journal register, reconciliation, diagnostics, imports and reports under `/accounting`.

## Prompt 9 Financial Reporting Engine

Financial statements are generated from posted `journal_entries` and `journal_lines` only. Draft, rejected, cancelled and failed operational records are excluded from official reporting; reversal journals are included according to their posting dates.

Statement layouts are configurable per business for Profit and Loss, Balance Sheet, Cash Flow, Changes in Equity, management income statements, branch performance and profitability foundations. Sections support account classes, account roles, account filters, subtotals, calculated rows, percentage rows and notes. Formula text is constrained so report layouts cannot become SQL execution surfaces.

`financial_statement_account_activity` is the reporting aggregation base. Profit and Loss, Balance Sheet and Cash Flow summary views group posted journal lines by account class, statement section, cash-flow category, period and branch. Current-year earnings are calculated dynamically from posted revenue, cost-of-sales, expense, other-income and other-expense lines until a year-end closing journal transfers profit or loss to equity.

Budgets are versioned by financial year and scenario. Approved or active budgets are immutable; revisions create a new version. Forecasts are stored separately with assumptions and superseding links, so estimates do not change approved budgets or transactional data.

Period close is controlled through `period_close_cycles` and `period_close_tasks`. Close tasks cover failed accounting events, bank and M-Pesa reconciliation, customer and supplier controls, inventory-to-GL, trial balance and management review. Soft close and hard close functions update accounting-period locks; reopening requires a reason and creates a superseding-report expectation.

Financial statement snapshots are immutable and preserve the generated payload, layout, period, status, data hash and report-file reference. Snapshots are created for approved management packs, hard-closed periods, closed financial years and formally issued reports.

The `/financials` workspace exposes Profit and Loss, Balance Sheet, Cash Flow, Changes in Equity, management accounts, ratios, working capital, branch performance, product/customer profitability, route and vehicle profitability foundations, budgets, forecasts, close, adjustments, snapshots and reports.

## Prompt 10 Tax Compliance Engine

Tax compliance is tenant-scoped and ledger-backed. Business tax profiles, branch tax outlet configuration, effective-dated tax rules, VAT codes, product mappings, periods, documents, ledgers, external-submission records, withholding certificates, returns, payments, calendar tasks, imports and audit evidence all carry `business_id` and RLS policies.

VAT calculation separates standard-rated, zero-rated, exempt and out-of-scope treatment. Purchase VAT records recoverable and non-recoverable portions, while sales and purchase documents preserve rule snapshots, tax-date decisions, line discounts, document discounts and rounding adjustments.

The eTIMS architecture is provider-neutral. The database stores canonical payloads, hashes, idempotency keys, submission status, retry safety, external receipt/control-unit references and audit hashes, but secrets are represented by credential references only. A certified KRA/eTIMS adapter can later consume `etims_submission_queue` without changing tax documents or ledgers.

Tax returns are prepared from posted `tax_ledger_entries`, then reconciled back to source tax documents and posted journal lines. Closed tax periods block new tax documents and tax ledger entries unless a controlled reopening records the approver and reason.

The `/tax` workspace exposes setup, branch outlets, tax rules, VAT codes, product mappings, customer and supplier tax profiles, VAT calculations, sales/purchase tax documents, credit/debit notes, eTIMS configuration and queue, external registry, VAT ledgers, VAT return preparation, withholding tax and withholding VAT, turnover/excise/levy foundations, compliance calendar, tax periods, audit evidence, imports, reports and integration health.

## Prompt 11 Business Operating System

The command centre is an intelligence layer over the existing modules, not a replacement calculation engine. KPI definitions, snapshots, health scores, briefs, alerts, recommendations, timeline events, widget layouts, trend snapshots, forecast indicators, data-quality checks, system-health checks and report schedules are stored as tenant-scoped records with RLS. Widgets read cached or materialized summaries wherever possible and preserve source references so the UI can avoid fabricated explanations.

Morning briefs are historical records. Each statement stores source-backed facts and a generated summary for a specific business, branch and audience. If no posted operating data exists, the brief says so instead of inventing movement.

Business Health is a configurable weighted score from KPI snapshots. Components include sales, profitability, cash, liquidity, inventory, debtors, creditors, tax, accounting, delivery, stock accuracy, budget, collections, supplier performance, staff productivity, system usage, data quality and security. Each component stores score, trend, explanation and recommendation.

Timeline, alerts and recommendations share source module and source record references. Recommendations are advisory only and never perform transactions automatically. Alert status supports open, acknowledged, resolved, expired and muted states.

Dashboard customization is persisted through dashboard layouts and dashboard widgets. Widgets support move, resize, hide, favourite, personal layouts and restore-default behavior. The reusable widget catalog covers KPI cards, charts, gauges, tables, timelines, calendars, alerts, tasks, heatmaps, leaderboards, sparklines and map foundations.

The `/dashboard` page is the owner command centre. `/insights` exposes role dashboards, business memory, health, alerts, recommendations, trends, forecasts, data quality and system health. `/reports` is the unified reporting hub for executive, operational, financial, inventory, sales, purchasing, treasury, accounting, tax, budget and scheduled-report foundations.
