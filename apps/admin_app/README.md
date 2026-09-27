# QuickMechanic Admin (Android)

Dedicated Android app for QuickMechanic administrators. It uses the same backend and admin accounts as the separate browser dashboard in `../admin_dashboard_web`. The Android app contains its own Dashboard, Support, Provider KYC, Finance, Profile, and Settings screens. Backend roles limit access to each section.

From this directory run `flutter pub get` and `flutter run`. For a USB-connected phone and local API on port 3000, run `adb reverse tcp:3000 tcp:3000` first. For another backend use `flutter run --dart-define=API_BASE_URL=https://your-test-api`. See `../../docs/ADMIN_ANDROID_APP.md` for roles and local administrator setup.
