# Google authentication and selected logos — 8 October 2026

## Result

Customer and Provider Google login/signup are implemented, their local Android APKs build, and the backend verifies Google ID tokens before issuing existing QuickMechanic sessions. With the user's approval, Google Auth Platform branding and one Web plus two debug Android OAuth clients were registered. Both apps were rebuilt with the registered Web client ID and the configured local API was restarted. Both open Google's native account-add/sign-in screen, but a successful real-account exchange remains **unverified** because the emulator has no signed-in Google account. The user chose to finish with the available local checks. No Google Play, production database/deployment or billing changes were made.

Google Cloud still showed **Free Trial**, **₹27,099.99** credit and **36 days** remaining at the configuration check. This is an observed balance, not a guarantee that existing resources stop consuming trial credit.

## Registered OAuth configuration

- Project: `project-8d23d91b-6c41-4eea-8cf`.
- Branding: **QuickMechanic**; support/contact: `arunkammattery@gmail.com`.
- Audience: **External / Testing**.
- Public Web and Customer/Provider debug Android client IDs: `config/google-auth.local.json`; no client secrets are stored there.
- The same public Web client ID is compiled into Customer/Provider as `GOOGLE_WEB_CLIENT_ID` and supplied to the local backend audience. Android clients match the actual packages and documented debug SHA-1.
- No OAuth test users were added. Basic-identity Sign in with Google (`openid`, `email`, `profile`) is exempt from the Testing allowlist requirement; Google Play tester membership is separate. [Google: Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en), [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).

## Authentication behavior

- Both apps use the official `google_sign_in` 7.2.0 native account picker and send the ID token to `POST /auth/google` with an explicit Customer/Provider account type and login/signup intent.
- The official backend `google-auth-library` 10.9.1 verifies signature, issuer, expiration and the configured Web-client audience. This dependency supports the existing Node 20 Docker runtime.
- The verified Google subject is stored in nullable, unique `googleSubject` columns, separately for Customer and Provider. Client email/name/admin-role claims are never trusted.
- Existing password accounts require their correct QuickMechanic password once before linking Google. Conditional updates prevent a concurrent password reset or identity link from being overwritten.
- Google signup collects a valid mobile number; Provider also selects Mechanic/Towing Fleet. The server uses Google's verified name/email and creates Provider/profile atomically with pending KYC and offline status.
- Google-only accounts have an unguessable hashed password, not a shared temporary password.
- Successful authentication stores each app's existing session and opens its normal home/dashboard. Cancellation, linking errors, incorrect account types, malformed responses and timeouts are handled. Release configuration messages offer email login; debug builds show setup guidance.
- Unknown Google login asks the user to sign up first. Missing backend configuration fails closed with HTTP 503 `GOOGLE_SIGN_IN_NOT_CONFIGURED`.

## Validation

| Check | Result |
| --- | --- |
| Full backend regression | **100/100 passed**, 19 suites, real local Docker database/Redis/HTTP/socket tests enabled |
| Focused backend auth | **46/46 passed**, including 44 new Google tests, real RSA verification and six isolated PostgreSQL acceptance tests |
| Customer full suite | **31/31 passed**, including 9 new Google tests |
| Provider Google tests | **24/24 passed** |
| Provider full suite | **49 passed, 4 existing failures**; unchanged stale KYC/support expectations documented in the 7 October report |
| APKs | Customer, Provider and Admin debug APKs built and installed on `emulator-5554`; Customer/Provider then rebuilt with the registered Web client ID |
| Source analysis | New Google files have no analyzer issues; existing app lint findings remain |
| HTTP smoke check | Earlier unconfigured local `/auth/google` returned the expected safe 503; with the registered Web audience, an invalid test token returns **401 `GOOGLE_TOKEN_INVALID`** |
| Native OAuth smoke check | Customer and Provider Google buttons open Google Play services account-add/sign-in; no Google account is signed into the emulator, so no successful real-account exchange is claimed |

Real Google-account sign-in has **not** been claimed as verified. Tests fake the native picker and Google certificate fetch where needed; cryptographic tests still use signed RSA tokens. External routing and actual payment processing remain mocked/simulated. The configured local API runs on port 3003 with `QuickMechanicDemo`, payment mode simulation, and `adb reverse tcp:3000 tcp:3003`; its restart returned PID 4436 at this check. The database must already exist and be initialized before using `start-updated-demo-api.ps1`.

No unrelated password-login/recovery defects from the previous report were repaired by this task. Google authentication's explicit account type avoids the shared-email ambiguity for this new flow; the older password login issue remains separate.

## Logos

The selected Customer logo is the user's newly attached winged wheel and wrench artwork, applied only to the Android launcher icon. The user explicitly asked to preserve the existing login header; its original animated wrench design is retained. Provider uses the exact attached lime-wrench/white-location-pin artwork on black. The Admin creation adds a violet A with an integrated white approval check on black. Launcher exports use five Android densities; previous launcher files are backed up. All exploratory artwork is preserved separately.

Selected 512-pixel exports are in `../logos-2026-10-08`: `customer-selected-512.png`, `provider-selected-512.png`, `admin-final-512.png`. Master images, exact generation prompts and design notes are in the same folder. Only local app assets were changed; Play store listing icons were not uploaded or replaced.

## Verification limits and future release

See `docs/GOOGLE_AUTH_SETUP.md` and `config/google-auth.local.json` for the registered public clients, Android package names and debug signing fingerprints. `scripts/build-google-auth-local.ps1` builds both apps against loopback using the Web ID; `scripts/start-updated-demo-api.ps1` accepts the same ID. Both helpers use the saved public configuration by default, with explicit parameter/environment overrides. No client secret is needed in either app. A future test on an Android device with a signed-in Google account can establish real-account signup, returning login and existing-password linking. That full exchange remains outside the checks available on the current emulator; the user chose to finish this task with local checks.

For a future production release, review `backend/migrations/20261008_google_identity.sql`, configure the backend audience and register the appropriate Play App Signing certificates through the normal deployment workflow. Production database synchronization remains disabled. None of those production changes occurred here.

Approved OAuth client creation is complete. The project remains External / Testing, with no additional data scopes or OAuth test-user entries.

## Evidence

- `backend-results.json`, `backend-full-test.log`: complete backend regression results.
- `customer_app-final-test.log`, `provider_app-final-test.log`: final Flutter suites.
- `*-final-build.log`: final APK builds using selected logos.
- `customer-google-config.png`, `provider-google-config.png`: observed button feedback.
- `oauth-clients-created.jpg`: registered clients; `customer-google-native-signin.png` and `provider-google-native-signin.png`: native Google account-add/sign-in screens after configuration.
- `../local-verification-2026-10-08/google-auth-backend-tests.log`: focused backend auth tests.
- `docs/GOOGLE_AUTH_SETUP.md`, `scripts/apply-app-logos.ps1`: portable setup and asset export instructions.
