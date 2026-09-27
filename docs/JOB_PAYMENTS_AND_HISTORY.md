# Job confirmation, payments and history

The provider accepts a request and sends a quote. The customer explicitly accepts the quote and pays. A sufficient customer wallet balance is transferred to the company's job-specific holding account; otherwise the backend creates/reuses a Razorpay payment link for the full charge. In that case the existing customer wallet balance remains available. The job becomes confirmed only after wallet payment or a verified Razorpay capture.

The provider may record journey start and request completion. Neither action releases payment. The customer must use **Confirm completed work & release funds**. That transaction credits the provider wallet, increments completed jobs and appends history exactly once. Either participant may cancel before that confirmation, with a reason; the full held amount is credited to the customer wallet. Cancellation after completed settlement is rejected and would require a separate dispute workflow.

## Database structure

- `service_requests`: current state, charge breakdown, acceptance/confirmation timestamps, completion request/approval times, cancellation reason/actor, and gateway checkout identifiers.
- `job_events`: append-only actor, event, timestamp and structured details for each transition. Existing jobs receive an explicitly labelled legacy snapshot during migration; missing past events are not invented.
- `wallet_accounts`: INR balances in integer paise. Separate provider, customer, job-specific company holding and pending-payout accounts. External clearing accounts record funding origins.
- `payment_ledger`: immutable two-sided transfers, unique idempotency reference, linked job, type, amount, currency and timestamp. Every credit has an equal debit. No floating-point arithmetic is used to move money.
- `withdrawal_allocations`: links one withdrawal to each job that funded it and the allocated amount. Legacy opening balances remain explicitly unallocated to a historic job rather than assigning a fabricated Job ID.

Ledger movements, balances and job changes commit in one PostgreSQL transaction. Row/advisory locks and unique references protect retries and races. SQL triggers reject modifications/deletions to ledger/history rows. The old wallet transaction table is retained for compatibility; the new ledger is the financial history source. Existing provider balances and held payments are imported lazily with explicit legacy entries. Reconcile any prior test balances against real payment records before live use.

History uses bounded 20-row cursor pages and indexed ownership/timestamp filters. The provider transaction tab includes job holds/refunds as well as provider credits and withdrawals. Job details show the timeline and payment movements without exposing user password/reset fields.

## Wallets and withdrawals

Provider **Settings → Wallet & job/payment history** shows current available funds, remaining withdrawal count, jobs and transactions. Profile also links to it. Customer Home has a history icon with refund balance, job history and completion/cancellation actions. Missed socket events do not prevent completion: refresh the persisted job details.

Up to five withdrawal requests are allowed in each Monday–Sunday week, using Asia/Kolkata midnight boundaries. Each request reserves the full available balance for payout; a stable request ID makes retries safe. Existing withdrawals from the old table in the same week count toward the limit.

**Bank payout is not yet connected.** A withdrawal is stored as `WITHDRAWAL_REQUESTED` and funds move to a pending-payout account, not a fictional successful bank transfer. RazorpayX activation, beneficiary onboarding, payout execution and payout success/failure/reversal webhooks must be configured/implemented before production withdrawals are advertised as bank transfers.

## Razorpay activation

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` on the backend only. Use test credentials in development and live credentials only after a test-mode end-to-end checkout. Configure `payment_link.paid` to POST to `https://YOUR_API/payments/razorpay/webhook`. This route verifies HMAC-SHA256 over the original raw body before processing. Captured status, currency, amount, job reference and known link ID are validated; the provider payment ID is deduplicated in the ledger. A paid browser redirect alone never marks a job paid. Notifications/reminders are disabled when creating links; the app opens the checkout URL itself.

Repeated checkout requests recover the same link using the unique job reference, including after a network timeout. A valid capture arriving after cancellation is credited to the customer's wallet and recorded as `LATE_PAYMENT_REFUND`. Refresh the job after returning from the external checkout. Local devices need a backend reachable by Razorpay webhooks to test actual capture delivery.

The holding accounts are application accounting records, not a separately provisioned banking escrow product. Gateway settlement, fees, chargebacks and bank payout reconciliation remain external integration work. Refunds here go to the customer wallet as requested, not automatically to the original card/UPI source.

Official references: [Payment Links API](https://razorpay.com/docs/api/payments/payment-links/create-standard/), [recover by reference](https://razorpay.com/docs/api/payments/payment-links/fetch-all-standard/), [raw webhook verification](https://razorpay.com/docs/webhooks/validate-test/).

## Local-first rollout and verification

1. Back up the database. Test `scripts/job-ledger-migration.sql` locally before applying it to a live database. Stop old writers before a production rollout; older apps must not continue using the previous OTP-release workflow.
2. Apply earlier pending migrations, including `scripts/provider-performance-migration.sql`, before the ledger migration. Production auto-synchronization is disabled; use the reviewed migration. Development auto-sync is retained.
3. Run `scripts/test-realtime-local.ps1 -Database -FlutterExecutable C:/path/to/flutter/bin/flutter.bat`. Ledger integration tests also apply the migration in an isolated disposable schema.
4. Build both apps together with the backend contract. Use `scripts/deploy.bat` for an authorized backend deployment only after local validation.

Verified locally: customer completion gating, duplicate payment/review/approval handling, both-party cancellation and exact refunds, cancel-versus-completion race, five-withdrawal weekly limit, repeat request IDs, per-job withdrawal allocations, raw signature rejection, duplicate/late Razorpay events, and the migration. The 1,000-operation acceptance test and 1,000 HTTP requests using 100 connections passed; this does not certify 1,000 simultaneous sockets or production throughput. No live capture, bank payout or production deployment was performed.

## Removed demonstrations

Removed self-approved KYC, hardcoded earned badges and ratings, local fabricated earnings/completions, simulation controls, fake subscription checkout/pricing, simulated rain, and sample job address. Provider profile/KYC/badges and customer service choices now load from the database. Customer payments use wallet/Razorpay; test funding exists only in automated backend tests and has no HTTP route. The separate `map_preview.dart` remains explicitly a development preview and is not the app entrypoint.
