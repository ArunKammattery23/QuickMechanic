# Admin pricing and test payments

The web admin dashboard is `apps/admin_dashboard_web`, with `/` and `/finance` showing the authenticated finance console. Run `npm run dev` there (port 3001). The native Android admin app is `apps/admin_app` (see `docs/ADMIN_ANDROID_APP.md`). Set `NEXT_PUBLIC_API_URL` to the backend address for the web dashboard. Sign in with an existing `ADM_USER` SUPER_ADMIN or CEO account; no dummy admin credentials or hardcoded tokens are used. The older `admin-dashboard` entry also exposes the same finance screen.

## Agreed calculation

The provider can select multiple services and enter a quotation for each service/vehicle combination. Service Config and the job quotation form show the current commission percentage and net earnings while typing. Commission is deducted from the entered quotation. For a ₹1,000 quotation and 15% commission:

| Item | Amount |
|---|---:|
| Provider earnings | ₹850 |
| Commission retained by company | ₹150 |
| Customer quotation (includes commission) | ₹1,000 |
| Customer platform fee (default) | ₹2 |
| Customer pays | ₹1,002 |

The customer sees quotation, platform fee and total; no commission line. The provider and admin see the breakdown. Admin can set commission from 0–100% and the customer platform fee from ₹2–₹5 (two decimal places), or 0 to disable. Default commission is 0 until configured. Rates are global and only affect future quotes. Provider submissions include the pricing revision and deduction model; a changed revision requires refresh/review, and older app submissions without the deduction model are rejected. Monetary calculations use integer paise and round commission half up. Already-issued quotations retain their saved settlement amounts, including quotations issued under the earlier additive calculation.

After customer completion approval, escrow transfers the provider net, company commission, and platform fee atomically into separate ledger accounts. Cancellation before approval refunds the entire customer total, including the platform fee, and earns no company revenue. Existing pre-migration jobs retain their original totals and zero new fees. Each policy change records its administrator and timestamp and cannot be edited or deleted.

## Test now, activate real payments later

`PAYMENT_MODE=simulation` offers explicit **Simulate success**, **Simulate failure**, and **Cancel** in customer job details. It does not contact a gateway or require a store URL or keys. The regular quote, acceptance, escrow, cancellation, completion and withdrawal reservation flow runs against the database. Test labels appear in quotes, wallet/history, admin and payment confirmation.

Use a **separate database** such as `QuickMechanicDemo` for simulation. Existing money cannot be converted into simulated or real balances. The first financial operation records an immutable database payment mode; changing the environment variable against that database is rejected. Do not copy simulated ledger, wallet balances, or funded jobs into the live database.

For a local demo, run `scripts/start-payment-demo.ps1 -AdminEmail <your-admin-email>`. It creates the dedicated local `QuickMechanicDemo` database if missing, applies migrations, prompts privately for your administrator password, and starts the API on port 3000. Existing passwords are not overwritten. Register customer/provider demo accounts through the apps. Point mobile builds at your computer's LAN address using `--dart-define=API_BASE_URL=http://<LAN-IP>:3000`. Do not run another backend on the same port.

For real gateway sandbox testing, use another database and `PAYMENT_MODE=razorpay_test`, `RAZORPAY_KEY_ID=rzp_test_...`, the matching secret, and webhook secret. For live activation use the live database, `PAYMENT_MODE=live`, `rzp_live_...` keys and the live webhook secret. Keys stay on the server. Configure `POST /payments/razorpay/webhook` for `payment_link.paid`; payment release still requires customer completion approval.

Store publishing and merchant activation are separate external steps. Submit the actual published Play Store URL during onboarding; do not enter a fabricated URL. Cashfree onboarding supports sandbox exploration before live activation, and Razorpay has separate test/live modes:
- [Cashfree account activation](https://www.cashfree.com/docs/help/account/account-activation)
- [Razorpay test/live modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/)

Razorpay collection is implemented; Cashfree is not a second implemented adapter. Bank-payout execution still needs a real payout-service integration and verified beneficiary details. Withdrawal requests reserve funds and report pending processing; simulation never transfers money to a bank.

## Database and verification

Apply in order against the local Docker database before any deployment:
1. Existing `scripts/provider-performance-migration.sql`, if pending.
2. `scripts/job-ledger-migration.sql`.
3. `scripts/pricing-policy-migration.sql`.

For a new demo database, use development schema synchronization to create application tables first, then apply the migrations to install immutable-history triggers. Production uses explicit migrations; never enable synchronization against production.

Run `scripts/test-realtime-local.ps1 -Database -FlutterExecutable <flutter path>` for isolated PostgreSQL lifecycle/pricing tests and both app test suites. Admin build: `npm run build` in `apps/admin_dashboard_web`. No production deployment or live money transfer is performed by these changes.
