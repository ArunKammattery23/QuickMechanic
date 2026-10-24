# Provider local verification — 2026-10-07

No application source, original test source, Play Console, or cloud configuration was changed.

## Checks

- `flutter analyze --no-pub`: zero errors; 2 warnings; 248 informational lint findings (250 total). Warning locations: `lib/screens/dashboard_screen.dart:59` unused `_walletBalance`, and `:456` unnecessary null-aware fallback. Exit code 1 is lint policy, not a compilation failure.
- Initial `flutter test --no-pub --reporter expanded`: 21 passed, 8 failed. Five failures were stale compiled test shader output (`ink_sparkle.frag` runtime buffer verification).
- Sequential rerun reproduced those failures.
- Moved only `apps/provider_app/build/unit_test_assets` to `unit_test_assets-before-local-verification-2026-10-07` and regenerated test output. Fresh run: 25 passed, 4 failed out of 29; no shader errors.
- The four remaining failures are stale UI-label expectations in KYC/support tests. Diagnostic copies saved here use current UI labels, without changing application or original tests. All 5 KYC/support diagnostic tests passed. Therefore the exercised current behaviors passed, while the checked-in suite remains red until its assertions are updated.

## Stale assertions

- `test/kyc_verification_test.dart:15`: `Add front photo` -> `Front side`; back photo -> `Back side`.
- `test/kyc_verification_test.dart:19`: `Submit for review` -> `Submit for verification`.
- `test/kyc_verification_test.dart:31`: `KYC awaiting review` -> `Under review`.
- `test/support_screen_test.dart:17`: `Guide answer` -> `QUICK GUIDE`; standard job questions are now answered locally rather than through the mocked bot endpoint.
- `test/support_screen_test.dart:62`: `Support ticket` -> `Support conversation`.

## Source-review findings

- `lib/screens/login_screen.dart:693` rejects CUSTOMER only. The common backend login endpoint accepts admin users too, so SUPER_ADMIN/MANAGER/CEO users can enter the Provider dashboard. This is a wrong-role usability/validation bug; backend role authorization may still prevent data access. The UI should accept only MECHANIC and FLEET_DRIVER.
- `lib/screens/login_screen.dart:727` maps every non-2xx response to `Invalid email or password`, including server/rate-limit errors; this can mislead diagnosis.
- `lib/screens/login_screen.dart:683` updates state after an awaited request without checking `mounted`, so leaving the login screen during a request can produce setState-after-dispose.

## Local configuration and coverage

Debug/profile builds select http://127.0.0.1:3000 by default; APP_ENV=local explicitly selects local even for release, and API_BASE_URL can override host. Android needs adb reverse tcp:3000 tcp:3000 or a reachable LAN URL. Background location sockets use the same ApiConfig.

Android background configuration includes location foreground-service type, fine/coarse/background location, notifications, explicit disclosure on going online, permission checks, automatic startup disabled, 15-second background GPS updates, persistent notification, offline stop, and token change/invalid token stop checks.

Automated coverage exercised startup/login-screen rendering, session expiry/malformed token, ICE ordering/call decline/overlay controls, map road geometry/progress/reroute/retry/cache, provider service/pricing selection, quote calculations/failure retry, config-load recovery, wallet/history/customer-approval gating/cancellation, KYC required photos/pending state, and support guide/ticket failure/success.

These are mocked widget/unit tests. Real phone GPS/background operation, camera KYC upload, network interruption, full live socket/media calls, and end-to-end local Docker API/database flows require device/integration verification by the parent task.
