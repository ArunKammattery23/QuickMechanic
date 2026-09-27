import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/services/api_service.dart';
import '../lib/screens/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(() => ApiService.token = null);
  test('customer session survives a new app instance and logout clears it',
      () async {
    final jwt = 'header.${base64Url.encode(utf8.encode(jsonEncode({
          'role': 'CUSTOMER',
          'exp': DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600
        })))}.signature';
    SharedPreferences.setMockInitialValues({'customer_jwt': jwt});
    ApiService.token = null;
    await ApiService.restoreSession();
    expect(ApiService.token, jwt);
    await ApiService.clearSession();
    await ApiService.restoreSession();
    expect(ApiService.token, isNull);
  });
  test('expired customer session returns to sign in', () async {
    SharedPreferences.setMockInitialValues({
      'customer_jwt':
          'header.${base64Url.encode(utf8.encode('{"role":"CUSTOMER","exp":1}'))}.signature'
    });
    await ApiService.restoreSession();
    expect(ApiService.token, isNull);
  });
  testWidgets('reopened home resumes a pending job from the server',
      (tester) async {
    ApiService.token = 'test-session';
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Job details'), findsOneWidget);
      expect(find.text('Requested'), findsOneWidget);
    },
        () => MockClient((r) async {
              if (r.url.path == '/services') return http.Response('[]', 200);
              if (r.url.path == '/dispatch/customer-active-job')
                return http.Response(
                    '{"job":{"id":"resumed-job","status":"REQUESTED"}}', 200);
              return http.Response(
                  jsonEncode({
                    'job': {
                      'id': 'resumed-job',
                      'status': 'REQUESTED',
                      'serviceType': 'Repair',
                      'totalAmount': '0.00'
                    },
                    'events': [],
                    'payments': []
                  }),
                  200);
            }));
  });
}
