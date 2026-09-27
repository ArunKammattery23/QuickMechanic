import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String liveBaseUrl =
      'https://quickmechanic-api-production.a.run.app';

  // Android USB development uses `adb reverse tcp:3000 tcp:3000`.
  // Or pass a LAN address with --dart-define=API_BASE_URL=http://<LAN-IP>:3000.
  static const String testBaseUrl = 'http://127.0.0.1:3000';

  /// `APP_ENV=local` always selects the locally running API.
  /// `APP_ENV=live` always selects Cloud Run. Without a value, release builds
  /// use Cloud Run and debug/profile builds use the local API.
  static const String _environment = String.fromEnvironment('APP_ENV');

  static bool get isLiveMode {
    if (_environment == 'local') return false;
    if (_environment == 'live') return true;
    return kReleaseMode;
  }

  static String get baseUrl {
    const override = String.fromEnvironment('API_BASE_URL');
    if (override.isNotEmpty) return override;
    if (isLiveMode) {
      return liveBaseUrl;
    } else {
      return testBaseUrl;
    }
  }
}
