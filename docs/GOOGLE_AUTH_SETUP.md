# Google authentication setup

Customer and Provider use the official Flutter `google_sign_in` package. The account picker obtains a Google ID token; `POST /auth/google` verifies it with `google-auth-library`, then issues the existing QuickMechanic session JWT. No Google client secret belongs in the apps or is required for this ID-token flow.

## Google configuration

The Google Cloud project is `project-8d23d91b-6c41-4eea-8cf`. With the user's approval, Google Auth Platform branding and three OAuth clients were registered on 8 October 2026. Branding is **QuickMechanic**, support/contact email is `arunkammattery@gmail.com`, and audience is **External / Testing**. Public client identifiers are saved in `config/google-auth.local.json`; the file contains no client secrets.

This flow uses only basic identity (`openid`, `email`, `profile`). Google explicitly exempts basic-identity Sign in with Google from the Testing allowlist requirement, so OAuth test users do **not** need to be added for this implementation. No OAuth test users were added. If additional OAuth scopes are introduced later, review the Testing restrictions again. Google Play closed-test membership remains a separate installation requirement. [Google: Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en), [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).

The registered **Web application** client is the backend token audience:

`180157507652-bo8jaicnc5gfau45l1vsn8b4uueb8vee.apps.googleusercontent.com`

Use this same Web client ID consistently:

- Backend environment: `GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com`.
- Customer/Provider Flutter build: `--dart-define=GOOGLE_WEB_CLIENT_ID=<same-web-client-id>.apps.googleusercontent.com`.

The local startup and build helpers read `config/google-auth.local.json` by default. An explicit `-GoogleWebClientId` parameter takes precedence, followed by the `GOOGLE_WEB_CLIENT_ID` environment variable. The saved JSON contains only public identifiers.

The registered **Android** clients use each app's application ID and the local debug signing certificate:

| App | Android package | Public Android client ID |
| --- | --- | --- |
| Customer | `com.quickmechanic.mobile_app` | `180157507652-jvue8jl10cgqgmg79e40tkh3rhs04hdf.apps.googleusercontent.com` |
| Provider | `com.quickmechanic.provider_app` | `180157507652-ih0rgmdg97i9bjbiduct9kc8l7o87qr3.apps.googleusercontent.com` |

Use the Web client ID in Dart's `serverClientId`; do not substitute either Android client ID. The Customer Gradle namespace `com.example.customer_app` is not its application ID. Because the apps pass `serverClientId` explicitly, this native flow does not require `google-services.json` or the Firebase Gradle registration plugin. [Official Android integration](https://pub.dev/packages/google_sign_in_android).

The local debug certificate on this computer has:

- SHA-1: `D2:97:3E:0F:7A:EC:0E:70:42:E5:6D:48:75:54:4A:EB:90:90:7C:F0`.
- SHA-256: `EF:70:71:67:0B:8A:DC:D3:9D:AE:BD:F1:74:DC:B5:21:CA:0C:27:F1:EB:90:C4:25:74:08:8A:A8:62:EA:B3:A5`.

For a future Play release, register each app's **Play App Signing** SHA-1. The upload certificate and debug certificate do not replace the certificate that signs the installed Play APK. No Play configuration is changed by this document or the local scripts.

Only basic Google identity is used. The flow does not request Contacts, Drive, Gmail, or payment access. No Firebase Auth service, new compute/database resource, billing upgrade, or paid API is needed by this implementation.

## Local-first run

1. Start the existing Docker PostgreSQL and Redis services. Ensure the dedicated local **QuickMechanicDemo** database exists and is initialized in **simulation** payment mode. `start-updated-demo-api.ps1` uses that database and does not create it; on a fresh machine, initialize it through the existing local demo workflow (`scripts/start-payment-demo.ps1`) first.
2. Build the backend from `backend`: `npm run build`.
3. Start the isolated Docker demo API:

   ```powershell
   $googleWebClientId = (Get-Content .\config\google-auth.local.json | ConvertFrom-Json).webClientId
   .\scripts\start-updated-demo-api.ps1 -Port 3003 -GoogleWebClientId $googleWebClientId
   ```

4. Build both apps locally:

   ```powershell
   .\scripts\build-google-auth-local.ps1 -GoogleWebClientId $googleWebClientId
   ```

5. Install the rebuilt debug APKs on an authorized Android device/emulator with Google Play services and network access, then run:

   ```powershell
   .\scripts\connect-android-local.ps1 -LocalApiPort 3003
   ```

6. Sign into a Google account on the device. Try Google signup with a valid mobile number, then sign out and try Google login. Existing email/password accounts require the existing password once to link Google. Provider signup retains the KYC review requirement.

The Web client ID is compiled into each APK, so registering clients alone does not update an older installation: rebuild and reinstall both apps, and restart the backend with its configured audience. The configured demo API was restarted on port 3003 (PID 4436 at the 8 October verification); Customer and Provider were rebuilt with the same Web ID.

Development TypeORM synchronization adds the nullable Google subject columns to the local database. Production synchronization stays disabled; the saved SQL migration must be reviewed and applied using the normal deployment workflow before any future backend release. No production migration or deployment is performed by these local instructions.

## Verification limits

Unit/widget tests fake the native Google picker and verification result, but exercise QuickMechanic token exchange, account creation/linking, role checks, session persistence, errors and cancellation. Backend cryptographic tests use signed RSA tokens with only certificate fetching substituted; localhost PostgreSQL acceptance tests exercise real transactions and constraints.

After the approved client registration and rebuild, both Customer and Provider Google buttons opened the Google Play services account-add/sign-in screen. The configured local API also rejected an invalid test token with HTTP 401 `GOOGLE_TOKEN_INVALID`. The emulator did not have a Google account signed in, so a successful real-account ID-token exchange and resulting QuickMechanic session remain **unverified**. The user chose to finish with the available local checks; no Google account was added to the emulator. Opening a Google screen is not evidence of completed application authentication.

Missing client configuration must produce a visible error. Do not work around it by trusting an email/profile from the app or disabling ID-token verification. Authentication remains disabled on the server when the configured audience is absent.

Official references: [Flutter Google Sign-In](https://pub.dev/packages/google_sign_in), [Android integration](https://pub.dev/packages/google_sign_in_android), [Google backend ID-token verification](https://developers.google.com/identity/sign-in/android/backend-auth).
