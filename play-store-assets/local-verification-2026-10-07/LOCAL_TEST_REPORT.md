# QuickMechanic local test report — 7 October 2026

All three apps were built and installed on the Android emulator, and successfully logged in against the local API and Docker database. The apps are **not ready to be called fully working**: Google authentication is unimplemented, and a reproduced shared-email login defect can reject a correct Provider password.

No Google Play changes, cloud deployments, billing changes, or real payments were made during this verification. Application source and original tests were not edited. A reusable local auth verification script and this evidence folder were added; generated QA credentials are excluded from Git.

## Environment

- Local API: `http://127.0.0.1:3003`, started using `scripts/start-updated-demo-api.ps1 -Port 3003`.
- Database: Docker PostgreSQL, `QuickMechanicDemo`, host `127.0.0.1:5432`. Redis runs locally on port 6379.
- Emulator: `emulator-5554`; `adb reverse tcp:3000 tcp:3003` connects all three local builds to the API.
- Customer and Provider builds used `APP_ENV=local` and `API_BASE_URL=http://127.0.0.1:3000`. Admin used the same API override.
- Payment mode: **simulation**. Amounts shown in Admin are local demo ledger data.
- Local test users and passwords: `local-qa-credentials.local.json` in this folder. These accounts exist only in the local demo database and will not log in to the Play-installed release using the cloud API.

## Automated checks

| Component | Result | Notes |
| --- | --- | --- |
| Backend | 56/56 tests passed, 16 suites | Includes real local PostgreSQL, PostGIS, Redis, HTTP, and Socket.IO tests. External routing/payment processing is mocked or simulated. |
| Customer | 22/22 tests passed | Analyzer: 0 errors, 0 warnings, 141 informational findings. |
| Provider | 25/29 original tests passed | Four remaining failures use outdated KYC/support UI expectations. Diagnostic copies with current expectations passed 5/5. Analyzer: 0 errors, 2 warnings, 248 informational findings. |
| Admin | 2/2 tests passed | Analyzer: 0 errors, 0 warnings, 13 informational findings. Existing automated UI coverage is limited. |
| Local auth API | 10 checks passed, 1 failed | Customer/Provider signup, duplicate rejection, all role logins, and wrong-password rejection passed. Shared-email Provider login failed. |
| Android APK builds | All 3 succeeded | Fresh debug builds installed on the emulator. |

Backend Nest build passed. A separate full TypeScript check failed with TS7016 in `backend/scripts/finalize-play-review-users.ts:4` and `backend/scripts/inspect-play-review-schema.ts:1`, because the `pg` declaration package is absent.

Backend tests also exercised pending-KYC restrictions, admin support resolution, role authorization, concurrent signup, one-use password reset tokens, configuration/pricing consistency, prevention of conflicting jobs, wallets and ledgers, GPS/socket signaling, and simulated payments. Concurrent tests included 20 customer/provider workflows with 490 HTTP requests and zero request failures, plus 200 authenticated sockets and 300 GPS updates. These are local test results, not a production-capacity guarantee.

## Emulator checks

| App | Observed result |
| --- | --- |
| Customer | Local login succeeded; service catalog and profile loaded; logout worked; email signup succeeded with the success message. Tapping Google login and signup produced only debug log messages. |
| Provider | Local login succeeded; service, vehicle and quotation configuration saved successfully. Google login produced only a debug log message. Going online showed the location disclosure and GPS acquisition; a successful online state was not observed. |
| Admin | Local login succeeded; dashboard, Support inbox, Provider KYC and Finance screens loaded. KYC displayed zero pending submissions. Finance explicitly displayed simulation mode. |

Screenshots in this folder record these results. Provider email signup also succeeded through the real local API; its signup UI was reviewed in source rather than fully exercised on-device.

## Functional defects requiring fixes

1. **Google login and signup do nothing.** Customer callbacks only print messages in `apps/customer_app/lib/screens/login_screen.dart:902` and `signup_screen.dart:164`. Provider does the same in `login_screen.dart:1085` and `signup_screen.dart:266`. No Google authentication dependency or backend Google token-verification route was found. Google authentication needs a complete implementation and configuration before these buttons can work.

2. **A correct Provider password fails when its email is also a Customer email.** Reproduced with two new local accounts: Provider signup returned 201, then Provider login returned 401. `backend/apps/backend/src/auth/auth.service.ts:144` selects Customer first; `:145` looks for Provider only if Customer does not exist; `:150–151` checks only the selected account's password. Registration permits an email in both tables. If both passwords match, the returned token still has the Customer role. Login must explicitly identify the intended app/account role.

3. **Customer Forgot Password is an empty callback.** `apps/customer_app/lib/screens/login_screen.dart:804`. The invalid-password message recommends this button, but it opens no recovery flow.

4. **Provider login accepts the wrong account roles in its UI.** `apps/provider_app/lib/screens/login_screen.dart:693` rejects only CUSTOMER; it should accept only MECHANIC/FLEET_DRIVER. The shared backend login also returns admin credentials. Backend authorization checks still protect role-restricted endpoints; this finding concerns the Provider sign-in flow and dashboard entry.

5. **Auth error handling and request lifecycle need attention.** Provider maps every non-success HTTP result, including server/rate-limit errors, to invalid password. Customer signup hides the useful server reason, lacks input trimming/format checks, and permits repeated submission while loading. Customer/Provider auth requests lack timeouts and several awaited UI callbacks lack mounted guards.

6. **Admin release connectivity guidance is misleading.** `apps/admin_app/lib/admin_api.dart:65` always tells users to start a local server and run a local connection script, even when the release build uses the cloud API.

## Test maintenance

Provider's initial run also had stale shader output. Only generated `build/unit_test_assets` was moved to a recoverable backup and regenerated, removing those shader failures. The four remaining original failures concern current KYC/support labels and one changed local-guide expectation. Original tests were preserved; diagnostic copies and logs are in this folder. See `provider-results.md` for exact assertions.

## Limits and release assessment

This verification does not establish perfect behavior on physical phones. Real Google authentication, background GPS over an extended session, camera/KYC uploads, actual audio/video media between two devices, the external routing service, and real payment processing were not fully exercised. Provider online success was not confirmed in the emulator. The local API and Docker services remain available for further local development.

Fix the authentication defects and refresh the outdated test expectations before preparing a production update. Then repeat the affected local API and device checks. Keep production deployment separate from this local verification; no release was submitted here.

## Evidence and repeatability

- `backend-results.json`: full backend test results.
- `customer-test.log`, `provider-test-fresh-assets.log`, `admin-test.log`: original Flutter results.
- `provider-test-diagnostics.log`: diagnostics using current UI expectations.
- `customer-analyze.log`, `provider-analyze.log`, `admin-analyze.log`: analyzer output.
- `auth-results.json`: actual local auth checks, including the reproduced failure.
- `scripts/verify-auth-local.cjs`: local-only auth verification. Running it creates new clearly named QA accounts and overwrites this folder's auth results/credential file. It never selects a cloud endpoint.
- `customer-*.png`, `provider-*.png`, `admin-*.png`: emulator observations.
