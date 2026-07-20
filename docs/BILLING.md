# Billing And Subscription Guide

Billing is separate from tenant sales invoices.

## Plans

Commercial plans live in `saas_plans`. Feature entitlements live in `feature_entitlements` and are linked through `plan_entitlements`. Prices, limits and entitlements are snapshotted into `saas_subscriptions` so future plan changes do not silently alter active contracts.

Initial plans: Starter, Growth, Professional, Enterprise and Custom.

## Usage Limits

`business_usage_limits` tracks each metric by business and billing period. Warnings should trigger before limit, notifications at limit, and hard blocking only where configured. Overrides require reason and expiry.

## Checkout

Checkout records in `subscription_checkout_sessions` preserve plan, interval, discount, tax, total, consent and idempotency. Paid activation must call backend verification and must not trust client success.

## Payments

`subscription_payment_requests` supports M-Pesa, card, bank transfer, manual, invoice billing, partner-paid and promotional foundations. `subscription_payment_events` stores verified callbacks and replay detection.

M-Pesa stores checkout request ID, merchant request ID, masked phone, receipt reference and reconciliation status. Card payments store provider session/intent/token references only; raw card details are never stored. Manual payment activation requires platform finance verification.

## Invoices

Subscription invoices live in `subscription_invoices` and `subscription_invoice_lines`, with customer and billing entity snapshots, amounts, due date, payment status and receipt reference.

## Changes And Cancellation

Plan upgrades/downgrades are stored in `subscription_plan_changes`. Downgrades check usage first and never delete excess data. Cancellation requests live in `subscription_cancellation_requests` with effective date, access effects, retention policy and audit trail.
