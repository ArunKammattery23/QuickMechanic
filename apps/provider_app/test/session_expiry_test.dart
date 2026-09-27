import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../lib/services/api_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  String token(int expiry) => 'header.${base64Url.encode(utf8.encode(jsonEncode({'exp': expiry})))}.signature';
  test('expired stored session returns to login and clears online preference', () async {
    SharedPreferences.setMockInitialValues({'jwt_token': token(1), 'provider_online': true});
    expect(await ApiService.getToken(), isNull);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('jwt_token'), isNull);
    expect(prefs.getBool('provider_online'), false);
  });
  test('valid session is preserved', () async {
    final valid = token(DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600);
    SharedPreferences.setMockInitialValues({'jwt_token': valid});
    expect(await ApiService.getToken(), valid);
  });
  test('malformed stored session returns to login', () async {
    SharedPreferences.setMockInitialValues({'jwt_token': 'broken'});
    expect(await ApiService.getToken(), isNull);
  });
}
