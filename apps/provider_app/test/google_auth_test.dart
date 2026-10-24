import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider_app/screens/login_screen.dart';
import 'package:provider_app/screens/signup_screen.dart';
import 'package:provider_app/services/google_auth_service.dart';
import 'package:provider_app/widgets/google_auth_dialogs.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeGoogleIdentity implements GoogleIdentityTokenProvider {
  FakeGoogleIdentity(this.token);
  final String? token;
  int calls = 0;
  @override
  Future<String?> authenticate() async {
    calls++;
    return token;
  }
}

class PendingGoogleIdentity implements GoogleIdentityTokenProvider {
  final completer = Completer<String?>();
  int calls = 0;
  @override
  Future<String?> authenticate() {
    calls++;
    return completer.future;
  }
}

http.Response sessionResponse({String role = 'MECHANIC'}) => http.Response(
    jsonEncode({'accessToken': 'provider-session', 'role': role}), 200);

void main() {
  group('Provider Google API contract', () {
    test('login sends ID token and Provider account type only', () async {
      final auth = ProviderGoogleAuthService(
        baseUrl: 'http://localhost:3000',
        client: MockClient((request) async {
          expect(request.method, 'POST');
          expect(request.url.toString(), 'http://localhost:3000/auth/google');
          expect(request.headers['content-type'], 'application/json');
          expect(jsonDecode(request.body), {
            'idToken': 'verified-google-token',
            'accountType': 'PROVIDER',
            'intent': 'login',
          });
          return sessionResponse();
        }),
      );
      final session = await auth.exchange(
          idToken: 'verified-google-token', intent: 'login');
      expect(session.accessToken, 'provider-session');
      expect(session.role, 'MECHANIC');
    });

    test('signup sends mobile and selected provider type, without password',
        () async {
      final auth =
          ProviderGoogleAuthService(client: MockClient((request) async {
        expect(jsonDecode(request.body), {
          'idToken': 'verified-google-token',
          'accountType': 'PROVIDER',
          'intent': 'signup',
          'phoneNumber': '+919876543210',
          'providerType': 'Towing Fleet',
        });
        return sessionResponse(role: 'FLEET_DRIVER');
      }));
      expect(
          (await auth.exchange(
                  idToken: 'verified-google-token',
                  intent: 'signup',
                  phoneNumber: '+919876543210',
                  providerType: 'Towing Fleet'))
              .role,
          'FLEET_DRIVER');
    });

    test('linking response retains code and status for the password dialog',
        () async {
      final auth = ProviderGoogleAuthService(client: MockClient((_) async {
        return http.Response(
            jsonEncode({
              'code': 'ACCOUNT_LINK_REQUIRED',
              'message': 'Verify your existing account password.',
            }),
            409);
      }));
      await expectLater(
          auth.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.needsAccountLink, 'needsAccountLink', isTrue)));
    });

    test('unregistered Google account explains how to sign up', () async {
      final auth = ProviderGoogleAuthService(client: MockClient((_) async {
        return http.Response(
            jsonEncode({'code': 'GOOGLE_ACCOUNT_NOT_REGISTERED'}), 404);
      }));
      await expectLater(
          auth.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.message,
              'message',
              contains('Sign up with Google first'))));
    });

    test('rejects customer and all admin roles before saving a session',
        () async {
      for (final role in ['CUSTOMER', 'SUPER_ADMIN', 'MANAGER', 'CEO']) {
        final auth = ProviderGoogleAuthService(
            client: MockClient((_) async => sessionResponse(role: role)));
        await expectLater(
            auth.exchange(idToken: 'id-token', intent: 'login'),
            throwsA(isA<ProviderGoogleAuthException>()
                .having((error) => error.code, 'code', 'WRONG_ACCOUNT_TYPE')));
      }
    });

    test('rejects a success response without a valid session token', () async {
      final auth = ProviderGoogleAuthService(
          client: MockClient(
              (_) async => http.Response('{"role":"MECHANIC"}', 200)));
      await expectLater(
          auth.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.code, 'code', 'INVALID_SERVER_RESPONSE')));
    });

    test('non-JSON server failures produce a safe retry message', () async {
      final auth = ProviderGoogleAuthService(
          client: MockClient((_) async => http.Response('Bad Gateway', 502)));
      await expectLater(
          auth.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.code, 'code', 'INVALID_SERVER_RESPONSE')));
    });

    test('network failures and request timeouts are recoverable', () async {
      final network = ProviderGoogleAuthService(client: MockClient((_) async {
        throw http.ClientException('unavailable');
      }));
      await expectLater(
          network.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>()
              .having((error) => error.code, 'code', 'NETWORK_ERROR')));
      final timeout = ProviderGoogleAuthService(
          timeout: const Duration(milliseconds: 1),
          client: MockClient((_) => Completer<http.Response>().future));
      await expectLater(
          timeout.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>()
              .having((error) => error.code, 'code', 'NETWORK_TIMEOUT')));
    });

    test('missing build client ID is detected before accessing the plugin',
        () async {
      await expectLater(
          GoogleSignInTokenProvider(serverClientId: '').authenticate(),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.message,
              'message',
              contains('GOOGLE_WEB_CLIENT_ID'))));
    });

    test(
        'release missing-client message offers email login without build details',
        () async {
      await expectLater(
          GoogleSignInTokenProvider(
                  serverClientId: '', includeConfigurationDetails: false)
              .authenticate(),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.message,
              'message',
              googleSignInUnavailableMessage)));
    });

    test('native Google initialization times out and can be retried', () async {
      var attempts = 0;
      final provider = GoogleSignInTokenProvider(
        serverClientId: 'web-client.apps.googleusercontent.com',
        initializationTimeout: const Duration(milliseconds: 1),
        initializeForTesting: (_) {
          attempts++;
          return Completer<void>().future;
        },
      );
      for (var index = 0; index < 2; index++) {
        await expectLater(
            provider.authenticate(),
            throwsA(isA<ProviderGoogleAuthException>().having(
                (error) => error.code,
                'code',
                'GOOGLE_INITIALIZATION_TIMEOUT')));
      }
      expect(attempts, 2);
    });

    test('server configuration response uses the same friendly fallback',
        () async {
      final auth = ProviderGoogleAuthService(client: MockClient((_) async {
        return http.Response(
            '{"code":"GOOGLE_SIGN_IN_NOT_CONFIGURED","message":"GOOGLE_WEB_CLIENT_ID is missing on this server."}',
            503);
      }));
      await expectLater(
          auth.exchange(idToken: 'id-token', intent: 'login'),
          throwsA(isA<ProviderGoogleAuthException>().having(
              (error) => error.message,
              'message',
              googleSignInUnavailableMessage)));
    });

    test('Provider mobile validator accepts only 10 to 15 digit numbers', () {
      expect(isValidProviderMobile('9876543210'), isTrue);
      expect(isValidProviderMobile('+919876543210'), isTrue);
      expect(isValidProviderMobile('987654321'), isFalse);
      expect(isValidProviderMobile('0987654321'), isFalse);
      expect(isValidProviderMobile('1234567890123456'), isFalse);
      expect(isValidProviderMobile('name@example.com'), isFalse);
    });
  });

  group('Provider Google buttons', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    Future<void> render(WidgetTester tester, Widget screen) async {
      await tester.binding.setSurfaceSize(const Size(1080, 2400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(MaterialApp(home: screen));
      await tester.pump(const Duration(seconds: 1));
    }

    Future<void> tick(WidgetTester tester) async {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump();
    }

    Future<void> close(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
    }

    testWidgets('login Google button saves the returned Provider session',
        (tester) async {
      final identity = FakeGoogleIdentity('id-token');
      ProviderGoogleSession? result;
      final auth = ProviderGoogleAuthService(
          identity: identity,
          client: MockClient((_) async => sessionResponse()));
      await render(
          tester,
          LoginScreen(
              googleAuthService: auth,
              onGoogleAuthenticated: (session) => result = session));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      expect(identity.calls, 1);
      expect(result?.accessToken, 'provider-session');
      expect((await SharedPreferences.getInstance()).getString('jwt_token'),
          'provider-session');
      expect(find.text('Continue with Google'), findsOneWidget);
      await close(tester);
    });

    testWidgets('Google cancellation is quiet and makes no API request',
        (tester) async {
      var requests = 0;
      final auth = ProviderGoogleAuthService(
          identity: FakeGoogleIdentity(null),
          client: MockClient((_) async {
            requests++;
            return sessionResponse();
          }));
      await render(tester, LoginScreen(googleAuthService: auth));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      expect(requests, 0);
      expect(find.byType(SnackBar), findsNothing);
      expect((await SharedPreferences.getInstance()).getString('jwt_token'),
          isNull);
      expect(find.text('Continue with Google'), findsOneWidget);
      await close(tester);
    });

    testWidgets('pending authentication disables repeated Google taps',
        (tester) async {
      final identity = PendingGoogleIdentity();
      final auth = ProviderGoogleAuthService(identity: identity);
      await render(tester, LoginScreen(googleAuthService: auth));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      expect(find.text('Signing in with Google…'), findsOneWidget);
      await tester.tap(find.byKey(const Key('provider-google-login')));
      expect(identity.calls, 1);
      identity.completer.complete(null);
      await tick(tester);
      await close(tester);
    });

    testWidgets(
        'account linking requests obscured existing password then retries same ID token',
        (tester) async {
      final identity = FakeGoogleIdentity('one-google-id-token');
      final payloads = <Map<String, dynamic>>[];
      final auth = ProviderGoogleAuthService(
          identity: identity,
          client: MockClient((request) async {
            payloads.add(jsonDecode(request.body) as Map<String, dynamic>);
            return payloads.length == 1
                ? http.Response('{"code":"ACCOUNT_LINK_REQUIRED"}', 409)
                : sessionResponse();
          }));
      ProviderGoogleSession? result;
      await render(
          tester,
          LoginScreen(
              googleAuthService: auth,
              onGoogleAuthenticated: (session) => result = session));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      expect(find.text('Link your existing Provider account'), findsOneWidget);
      expect(
          tester
              .widget<TextField>(find.descendant(
                  of: find.byKey(const Key('google-link-password')),
                  matching: find.byType(TextField)))
              .obscureText,
          isTrue);
      await tester.tap(find.text('Link account'));
      await tick(tester);
      expect(payloads.length, 1);
      await tester.enterText(
          find.byKey(const Key('google-link-password')), 'ExistingPassword!');
      await tester.tap(find.text('Link account'));
      await tick(tester);
      expect(identity.calls, 1);
      expect(payloads.length, 2);
      expect(payloads[1]['idToken'], payloads[0]['idToken']);
      expect(payloads[1]['linkPassword'], 'ExistingPassword!');
      expect(payloads[1]['accountType'], 'PROVIDER');
      expect(result?.role, 'MECHANIC');
      await close(tester);
    });

    testWidgets('canceling account linking keeps the app signed out',
        (tester) async {
      var requests = 0;
      final auth = ProviderGoogleAuthService(
          identity: FakeGoogleIdentity('id-token'),
          client: MockClient((_) async {
            requests++;
            return http.Response('{"code":"ACCOUNT_LINK_REQUIRED"}', 409);
          }));
      await render(tester, LoginScreen(googleAuthService: auth));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      await tester.tap(find.text('Cancel'));
      await tick(tester);
      expect(requests, 1);
      expect((await SharedPreferences.getInstance()).getString('jwt_token'),
          isNull);
      expect(find.byType(SnackBar), findsNothing);
      await close(tester);
    });

    testWidgets('failed linking preserves any existing app session',
        (tester) async {
      SharedPreferences.setMockInitialValues({'jwt_token': 'previous-session'});
      var requests = 0;
      final auth = ProviderGoogleAuthService(
          identity: FakeGoogleIdentity('id-token'),
          client: MockClient((_) async {
            requests++;
            return requests == 1
                ? http.Response('{"code":"ACCOUNT_LINK_REQUIRED"}', 409)
                : http.Response(
                    '{"code":"ACCOUNT_LINK_PASSWORD_INVALID","message":"The existing account password is incorrect."}',
                    401);
          }));
      await render(tester, LoginScreen(googleAuthService: auth));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      await tester.enterText(
          find.byKey(const Key('google-link-password')), 'WrongPassword');
      await tester.tap(find.text('Link account'));
      await tick(tester);
      expect(requests, 2);
      expect(find.text('The existing account password is incorrect.'),
          findsOneWidget);
      expect((await SharedPreferences.getInstance()).getString('jwt_token'),
          'previous-session');
      expect(find.text('Continue with Google'), findsOneWidget);
      await close(tester);
    });

    testWidgets('unregistered login displays the sign-up guidance',
        (tester) async {
      final auth = ProviderGoogleAuthService(
          identity: FakeGoogleIdentity('id-token'),
          client: MockClient((_) async =>
              http.Response('{"code":"GOOGLE_ACCOUNT_NOT_REGISTERED"}', 404)));
      await render(tester, LoginScreen(googleAuthService: auth));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      expect(find.textContaining('Sign up with Google first'), findsOneWidget);
      expect((await SharedPreferences.getInstance()).getString('jwt_token'),
          isNull);
      await close(tester);
    });

    testWidgets(
        'signup uses mobile from form and the selected fleet type without password',
        (tester) async {
      Map<String, dynamic>? payload;
      ProviderGoogleSession? result;
      final auth = ProviderGoogleAuthService(
          identity: FakeGoogleIdentity('id-token'),
          client: MockClient((request) async {
            payload = jsonDecode(request.body) as Map<String, dynamic>;
            return sessionResponse(role: 'FLEET_DRIVER');
          }));
      await render(
          tester,
          SignupScreen(
              googleAuthService: auth,
              onGoogleAuthenticated: (session) => result = session));
      await tester.enterText(
          find.widgetWithText(TextField, 'Mobile Number'), '9876543210');
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tick(tester);
      await tester.tap(find.text('Towing Fleet').last);
      await tick(tester);
      await tester
          .ensureVisible(find.byKey(const Key('provider-google-signup')));
      await tester.tap(find.byKey(const Key('provider-google-signup')));
      await tick(tester);
      expect(payload, {
        'idToken': 'id-token',
        'accountType': 'PROVIDER',
        'intent': 'signup',
        'phoneNumber': '9876543210',
        'providerType': 'Towing Fleet',
      });
      expect(result?.role, 'FLEET_DRIVER');
      expect((await SharedPreferences.getInstance()).getString('jwt_token'),
          'provider-session');
      await close(tester);
    });

    testWidgets(
        'signup mobile dialog validates number before Google authentication',
        (tester) async {
      final identity = FakeGoogleIdentity(null);
      await render(
          tester,
          SignupScreen(
              googleAuthService:
                  ProviderGoogleAuthService(identity: identity)));
      await tester
          .ensureVisible(find.byKey(const Key('provider-google-signup')));
      await tester.tap(find.byKey(const Key('provider-google-signup')));
      await tick(tester);
      expect(find.text('Add your mobile number'), findsOneWidget);
      await tester.enterText(
          find.byKey(const Key('google-signup-phone')), '123');
      await tester.tap(find.text('Continue'));
      await tick(tester);
      expect(identity.calls, 0);
      expect(find.text('Enter a valid 10 to 15 digit mobile number.'),
          findsOneWidget);
      await tester.enterText(
          find.byKey(const Key('google-signup-phone')), '+919876543210');
      await tester.tap(find.text('Continue'));
      await tick(tester);
      expect(identity.calls, 1);
      expect(find.byType(SnackBar), findsNothing);
      await close(tester);
    });

    testWidgets('missing client configuration displays an actionable error',
        (tester) async {
      final auth = ProviderGoogleAuthService(
          identity: GoogleSignInTokenProvider(serverClientId: ''));
      await render(tester, LoginScreen(googleAuthService: auth));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      expect(find.textContaining('GOOGLE_WEB_CLIENT_ID'), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      await close(tester);
    });

    testWidgets(
        'leaving login during Google authentication has no disposed-state update',
        (tester) async {
      final identity = PendingGoogleIdentity();
      await render(
          tester,
          LoginScreen(
              googleAuthService:
                  ProviderGoogleAuthService(identity: identity)));
      await tester.tap(find.byKey(const Key('provider-google-login')));
      await tick(tester);
      await close(tester);
      identity.completer.complete('id-token');
      await tick(tester);
      expect(tester.takeException(), isNull);
    });
  });
}
