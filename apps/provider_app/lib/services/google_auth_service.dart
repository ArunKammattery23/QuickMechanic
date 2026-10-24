import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

const googleSignInUnavailableMessage =
    'Google sign-in is not available yet. Please use email and password.';

/// Only the Google ID token is sent to our API. Google verifies the account
/// name and email; the app never supplies those as trusted identity fields.
abstract interface class GoogleIdentityTokenProvider {
  Future<String?> authenticate();
}

class GoogleSignInTokenProvider implements GoogleIdentityTokenProvider {
  GoogleSignInTokenProvider({
    this.serverClientId = const String.fromEnvironment('GOOGLE_WEB_CLIENT_ID'),
    this.includeConfigurationDetails = kDebugMode,
    this.initializationTimeout = const Duration(seconds: 20),
    this.initializeForTesting,
  });

  final String serverClientId;
  final bool includeConfigurationDetails;
  final Duration initializationTimeout;
  @visibleForTesting
  final Future<void> Function(String clientId)? initializeForTesting;
  static Future<void>? _initialization;

  Future<void> _initialize(GoogleSignIn signIn) async {
    try {
      await (initializeForTesting == null
              ? signIn.initialize(serverClientId: serverClientId.trim())
              : initializeForTesting!(serverClientId.trim()))
          .timeout(initializationTimeout);
    } catch (_) {
      // A transient initialization failure should allow another button press.
      _initialization = null;
      rethrow;
    }
  }

  @override
  Future<String?> authenticate() async {
    if (serverClientId.trim().isEmpty) {
      throw ProviderGoogleAuthException(
        includeConfigurationDetails
            ? '$googleSignInUnavailableMessage Build with GOOGLE_WEB_CLIENT_ID.'
            : googleSignInUnavailableMessage,
        code: 'GOOGLE_CONFIGURATION_REQUIRED',
      );
    }
    try {
      final signIn = GoogleSignIn.instance;
      await (_initialization ??= _initialize(signIn));
      if (!signIn.supportsAuthenticate()) {
        throw const ProviderGoogleAuthException(
          'Google sign-in is available in the Android app. Please sign in with email here.',
          code: 'GOOGLE_PLATFORM_UNSUPPORTED',
        );
      }
      final account = await signIn.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const ProviderGoogleAuthException(
          'Google could not verify this account. Please try again.',
          code: 'GOOGLE_ID_TOKEN_MISSING',
        );
      }
      return idToken;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) return null;
      throw const ProviderGoogleAuthException(
        'Google sign-in could not start. Check your connection and the Google sign-in setup for this app.',
        code: 'GOOGLE_SIGN_IN_FAILED',
      );
    } on TimeoutException {
      throw const ProviderGoogleAuthException(
        'Google sign-in took too long to start. Check your connection and try again.',
        code: 'GOOGLE_INITIALIZATION_TIMEOUT',
      );
    }
  }
}

class ProviderGoogleAuthException implements Exception {
  const ProviderGoogleAuthException(this.message, {this.code, this.statusCode});
  final String message;
  final String? code;
  final int? statusCode;
  bool get needsAccountLink =>
      statusCode == 409 && code == 'ACCOUNT_LINK_REQUIRED';
  @override
  String toString() => message;
}

class ProviderGoogleSession {
  const ProviderGoogleSession({required this.accessToken, required this.role});
  final String accessToken;
  final String role;
}

class ProviderGoogleAuthService {
  ProviderGoogleAuthService({
    GoogleIdentityTokenProvider? identity,
    http.Client? client,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
  })  : identity = identity ?? GoogleSignInTokenProvider(),
        _client = client,
        _baseUrl = baseUrl;

  final GoogleIdentityTokenProvider identity;
  final http.Client? _client;
  final String? _baseUrl;
  final Duration timeout;

  Future<ProviderGoogleSession> exchange({
    required String idToken,
    required String intent,
    String? phoneNumber,
    String? providerType,
    String? linkPassword,
  }) async {
    final payload = <String, dynamic>{
      'idToken': idToken,
      'accountType': 'PROVIDER',
      'intent': intent,
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
      if (providerType != null) 'providerType': providerType,
      if (linkPassword != null) 'linkPassword': linkPassword,
    };
    http.Response response;
    try {
      final uri = Uri.parse('${_baseUrl ?? ApiConfig.baseUrl}/auth/google');
      final body = jsonEncode(payload);
      const headers = {'Content-Type': 'application/json'};
      response = await (_client == null
              ? http.post(uri, headers: headers, body: body)
              : _client.post(uri, headers: headers, body: body))
          .timeout(timeout);
    } on TimeoutException {
      throw const ProviderGoogleAuthException(
        'The server did not respond. Check your connection and try again.',
        code: 'NETWORK_TIMEOUT',
      );
    } catch (_) {
      throw const ProviderGoogleAuthException(
        'Unable to connect. Check your internet connection and try again.',
        code: 'NETWORK_ERROR',
      );
    }
    Map<String, dynamic> data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw const ProviderGoogleAuthException(
        'Sign-in is temporarily unavailable. Please try again.',
        code: 'INVALID_SERVER_RESPONSE',
      );
    }
    if (response.statusCode != 200 && response.statusCode != 201) {
      final code = data['code']?.toString();
      final serverMessage = data['message'];
      throw ProviderGoogleAuthException(
        response.statusCode == 503 && code == 'GOOGLE_SIGN_IN_NOT_CONFIGURED'
            ? googleSignInUnavailableMessage
            : code == 'GOOGLE_ACCOUNT_NOT_REGISTERED'
                ? 'No Provider account is registered with this Google account. Choose Sign up with Google first.'
                : serverMessage is String && serverMessage.isNotEmpty
                    ? serverMessage
                    : 'Google sign-in failed. Please try again.',
        code: code,
        statusCode: response.statusCode,
      );
    }
    final token = data['accessToken'];
    final role = data['role'];
    if (!['MECHANIC', 'FLEET_DRIVER'].contains(role)) {
      throw const ProviderGoogleAuthException(
        'Use a Provider account to sign in to this app.',
        code: 'WRONG_ACCOUNT_TYPE',
      );
    }
    if (token is! String || token.isEmpty) {
      throw const ProviderGoogleAuthException(
        'The server did not create a valid session. Please try again.',
        code: 'INVALID_SERVER_RESPONSE',
      );
    }
    return ProviderGoogleSession(accessToken: token, role: role as String);
  }
}
