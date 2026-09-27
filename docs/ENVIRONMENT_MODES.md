# QuickMechanic: Environment Modes (Live vs Test)

The QuickMechanic Flutter applications (`mobile_app` and `provider_app`) are designed to seamlessly switch between local development and production environments. This is controlled via a centralized configuration file located at `lib/config/api_config.dart`.

## Selecting the API environment
Inside both Flutter apps, `ApiConfig` selects where all HTTP and WebSocket traffic is routed. Release builds use Cloud Run by default; debug/profile builds use the local API by default.

```dart
class ApiConfig {
  static const String liveBaseUrl = 'https://quickmechanic-api-production.a.run.app';
  static const String testBaseUrl = 'http://127.0.0.1:3000';
  // ...
}
```

### 1. Test Mode (debug/profile or `APP_ENV=local`)
**When to use:** When you are actively writing code, testing new features, or running the backend on your own computer.
- **Base URL:** `http://localhost:3000`
- **Behavior:** The mobile apps will attempt to connect to the NestJS server running on your local machine port 3000. 
- *Note:* On Android, run `adb reverse tcp:3000 tcp:3000` before `flutter run`, or use `--dart-define=API_BASE_URL=http://<your-LAN-IP>:3000`.

### 2. Live Mode (release or `APP_ENV=live`)
**When to use:** When you are compiling the final APK to publish to the Google Play Store, or when you want to test the app against your real Google Cloud database.
- **Base URL:** `https://quickmechanic-api-production.a.run.app`
- **Behavior:** The mobile apps will route all HTTP logins and WebSocket location pings to your live, auto-scaling Google Cloud Run container.

## How to Override
Use build-time values instead of editing source code:
```dart
flutter run --dart-define=APP_ENV=live
flutter run --dart-define=APP_ENV=local
flutter run --dart-define=API_BASE_URL=http://192.168.1.15:3000
```
`API_BASE_URL` has priority over the environment setting. Because the entire app uses `ApiConfig.baseUrl` for all networking, one override updates every screen and service.
