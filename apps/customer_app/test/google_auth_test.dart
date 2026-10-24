import 'dart:async';
import 'dart:convert';

import 'package:customer_app/screens/google_auth_flow.dart';
import 'package:customer_app/screens/home_screen.dart';
import 'package:customer_app/screens/login_screen.dart';
import 'package:customer_app/screens/signup_screen.dart';
import 'package:customer_app/services/api_service.dart';
import 'package:customer_app/services/google_auth_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeGoogleTokenProvider implements GoogleTokenProvider {
  FakeGoogleTokenProvider(this.token);
  final String? token;
  int calls = 0;

  @override
  Future<String?> authenticate() async {
    calls++;
    return token;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    ApiService.token = null;
  });
  tearDown(() => ApiService.token = null);

  http.Response success() => http.Response(
      '{"accessToken":"customer-google-session","role":"CUSTOMER"}', 201);

  Future<void> tapGoogle(WidgetTester tester, String key) async {
    await tester.pump(const Duration(seconds: 2));
    final button = find.byKey(ValueKey(key));
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  test(
      'Google token exchange sends only verified token and Customer intent and saves session',
      () async {
    await http.runWithClient(() async {
      final result = await ApiService.googleAuthenticate(
          idToken: 'google-id-token', intent: 'login');
      expect(result['success'], true);
      expect(ApiService.token, 'customer-google-session');
      expect((await SharedPreferences.getInstance()).getString('customer_jwt'),
          'customer-google-session');
    },
        () => MockClient((request) async {
              expect(request.url.path, '/auth/google');
              expect(jsonDecode(request.body), {
                'idToken': 'google-id-token',
                'accountType': 'CUSTOMER',
                'intent': 'login',
              });
              return success();
            }));
  });

  test('Google token exchange refuses a Provider session', () async {
    final result = await http.runWithClient(
      () => ApiService.googleAuthenticate(
          idToken: 'google-token', intent: 'login'),
      () => MockClient((_) async =>
          http.Response('{"accessToken":"wrong-role","role":"MECHANIC"}', 201)),
    );
    expect(result['success'], false);
    expect(ApiService.token, isNull);
    expect((await SharedPreferences.getInstance()).getString('customer_jwt'),
        isNull);
  });

  test(
      'Google token exchange distinguishes timeout and malformed server response',
      () async {
    final timeout = await http.runWithClient(
      () => ApiService.googleAuthenticate(idToken: 'token', intent: 'login'),
      () => MockClient((_) async => throw TimeoutException('slow local API')),
    );
    expect(timeout['message'], contains('timed out'));
    final malformed = await http.runWithClient(
      () => ApiService.googleAuthenticate(idToken: 'token', intent: 'login'),
      () => MockClient((_) async => http.Response('not JSON', 502)),
    );
    expect(malformed['message'], contains('invalid sign-in response'));
  });

  test(
      'missing OAuth configuration gives an actionable error before launching picker',
      () async {
    expect(
      const NativeGoogleTokenProvider(serverClientId: '').authenticate(),
      throwsA(isA<GoogleAuthenticationException>().having(
          (e) => e.message, 'message', contains('GOOGLE_WEB_CLIENT_ID'))),
    );
  });

  testWidgets(
      'Customer Google login button invokes picker, saves session and opens home',
      (tester) async {
    final provider = FakeGoogleTokenProvider('chosen-account-token');
    await http.runWithClient(() async {
      await tester.pumpWidget(
          MaterialApp(home: LoginScreen(googleTokenProvider: provider)));
      await tapGoogle(tester, 'customer-google-login');
      await tester.pumpAndSettle();
      expect(provider.calls, 1);
      expect(ApiService.token, 'customer-google-session');
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
        () => MockClient((request) async {
              if (request.url.path == '/auth/google') {
                expect(jsonDecode(request.body)['intent'], 'login');
                return success();
              }
              if (request.url.path == '/services')
                return http.Response('[]', 200);
              return http.Response('{"job":null}', 200);
            }));
  });

  testWidgets(
      'unknown Google login offers signup instead of creating an account silently',
      (tester) async {
    final provider = FakeGoogleTokenProvider('new-account-token');
    await http.runWithClient(() async {
      await tester.pumpWidget(
          MaterialApp(home: LoginScreen(googleTokenProvider: provider)));
      await tapGoogle(tester, 'customer-google-login');
      expect(
          find.text(
              'This Google account has not registered yet. Use Sign up with Google.'),
          findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('customer-google-signup-action')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(SignupScreen), findsOneWidget);
      expect(ApiService.token, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
        () => MockClient((_) async => http.Response(
            '{"code":"GOOGLE_ACCOUNT_NOT_REGISTERED","message":"Use signup"}',
            404)));
  });

  testWidgets(
      'canceling Google picker leaves login ready and makes no backend request',
      (tester) async {
    final provider = FakeGoogleTokenProvider(null);
    var requests = 0;
    await http.runWithClient(() async {
      await tester.pumpWidget(
          MaterialApp(home: LoginScreen(googleTokenProvider: provider)));
      await tapGoogle(tester, 'customer-google-login');
      expect(provider.calls, 1);
      expect(requests, 0);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
        () => MockClient((_) async {
              requests++;
              return success();
            }));
  });

  testWidgets(
      'Google signup asks for valid mobile and does not require name, email or password',
      (tester) async {
    final provider = FakeGoogleTokenProvider('signup-token');
    var requests = 0;
    await http.runWithClient(() async {
      await tester.pumpWidget(
          MaterialApp(home: SignupScreen(googleTokenProvider: provider)));
      await tapGoogle(tester, 'customer-google-signup');
      expect(find.text('Your mobile number'), findsOneWidget);
      await tester.enterText(
          find.byKey(const ValueKey('google-phone-input')), '123');
      await tester.tap(find.byKey(const ValueKey('google-phone-confirm')));
      await tester.pump();
      expect(find.text('Enter a valid 10 to 15 digit mobile number'),
          findsOneWidget);
      expect(requests, 0);
      await tester.enterText(
          find.byKey(const ValueKey('google-phone-input')), '+919876543210');
      await tester.tap(find.byKey(const ValueKey('google-phone-confirm')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(provider.calls, 1);
      expect(requests, 1);
      expect(find.byType(HomeScreen), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
        () => MockClient((request) async {
              if (request.url.path == '/auth/google') {
                requests++;
                expect(jsonDecode(request.body), {
                  'idToken': 'signup-token',
                  'accountType': 'CUSTOMER',
                  'intent': 'signup',
                  'phoneNumber': '+919876543210',
                });
                return success();
              }
              if (request.url.path == '/services')
                return http.Response('[]', 200);
              return http.Response('{"job":null}', 200);
            }));
  });

  testWidgets(
      'existing account asks password once and retries same Google token to link',
      (tester) async {
    final provider = FakeGoogleTokenProvider('verified-token');
    Map<String, dynamic>? result;
    var requests = 0;
    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(
          home: Scaffold(
              body: Builder(
                  builder: (context) => TextButton(
                        onPressed: () async => result =
                            await GoogleAuthFlow.authenticate(context,
                                intent: GoogleAuthIntent.login,
                                tokenProvider: provider),
                        child: const Text('Authenticate'),
                      )))));
      await tester.tap(find.text('Authenticate'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Link your existing account'), findsOneWidget);
      await tester.enterText(
          find.byKey(const ValueKey('google-link-password-input')),
          'Existing password!');
      await tester.tap(find.byKey(const ValueKey('google-link-confirm')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(provider.calls, 1);
      expect(requests, 2);
      expect(result?['success'], true);
      expect(ApiService.token, 'customer-google-session');
      await tester.pumpWidget(const SizedBox.shrink());
    },
        () => MockClient((request) async {
              requests++;
              final body = jsonDecode(request.body);
              expect(body['idToken'], 'verified-token');
              if (requests == 1) {
                expect(body.containsKey('linkPassword'), false);
                return http.Response(
                    '{"code":"ACCOUNT_LINK_REQUIRED","message":"Enter existing password"}',
                    409);
              }
              expect(body['linkPassword'], 'Existing password!');
              return success();
            }));
  });
}
