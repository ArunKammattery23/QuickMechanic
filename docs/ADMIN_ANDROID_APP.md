# QuickMechanic Admin Android app

The native admin app is in `apps/admin_app`. It signs in through `POST /auth/admin-login` with an existing `ADM_USER` account. There are no hardcoded admin credentials. Its token stays in memory and sign-out clears it; an app restart requires sign-in again.

Roles and screens:
- `SUPER_ADMIN`: Dashboard, Support, Provider KYC, Finance, Profile, Settings.
- `MANAGER`: Dashboard, Support, Provider KYC, Profile, Settings.
- `CEO`: Dashboard, Support, Finance, Profile, Settings.

Support shows the ticket queue, messages and status controls. KYC shows submitted provider details and authenticated front/back ID photos before approval. Finance shows provider collections, linked job amounts and future commission, platform fee and travel settings. The backend validates roles and ownership; hiding a tab in the app is not the security boundary.

Dashboard summarizes recent support activity, pending KYC reviews and finance data available to the signed-in role. Profile lets an admin update their display name and contact number. Settings lets them change their password or sign out. The Android project lives entirely in `apps/admin_app`; `apps/admin_dashboard_web` remains the separate web dashboard and is not required to build the Android APK.

For local Android USB testing, start the local API and run `scripts/connect-android-local.ps1 -LocalApiPort 3003` from the repository root when using the isolated demo API on PC port 3003 (or omit the parameter when the API uses port 3000). The script checks `/services` before forwarding the phone's port 3000. Re-run it after reconnecting the USB cable or restarting the phone. From `apps/admin_app`, run `flutter run` or `flutter build apk --debug`. To use a reachable test server, pass `--dart-define=API_BASE_URL=https://your-test-api`. Debug builds permit local HTTP; production builds should use HTTPS. Do not point a phone at `127.0.0.1` without `adb reverse`—that address is the phone itself.

For a local demo administrator, use `scripts/start-payment-demo.ps1 -AdminEmail <your-email>` after Docker Desktop is running. The script prompts privately for a password of at least 12 characters and creates the account only if it does not exist. It never overwrites an existing password. Do not use this demo account in production.
