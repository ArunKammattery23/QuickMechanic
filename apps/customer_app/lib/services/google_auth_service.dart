import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Injectable account picker. A null token means the user canceled.
abstract class GoogleTokenProvider {
  Future<String?> authenticate();
}

class GoogleAuthenticationException implements Exception {
  const GoogleAuthenticationException(this.message);
  final String message;
}

class NativeGoogleTokenProvider implements GoogleTokenProvider {
  const NativeGoogleTokenProvider({
    this.serverClientId = const String.fromEnvironment('GOOGLE_WEB_CLIENT_ID'),
  });

  final String serverClientId;
  static Future<void>? _initialization;

  @override
  Future<String?> authenticate() async {
    if (serverClientId.trim().isEmpty) {
      throw const GoogleAuthenticationException(
        kReleaseMode
            ? 'Google sign-in is not available yet. Please use email and password.'
            : 'Google sign-in is not configured yet. Build with GOOGLE_WEB_CLIENT_ID '
                'and register this Android app and signing certificate in Google OAuth.',
      );
    }
    try {
      try {
        await (_initialization ??= GoogleSignIn.instance
            .initialize(serverClientId: serverClientId.trim())
            .timeout(const Duration(seconds: 20)));
      } catch (_) {
        _initialization = null;
        rethrow;
      }
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        throw const GoogleAuthenticationException(
          'Google sign-in is available in the Android app. Please use email '
          'and password on this platform.',
        );
      }
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw const GoogleAuthenticationException(
          kReleaseMode
              ? 'Google sign-in is not available yet. Please use email and password.'
              : 'Google did not return an identity token. Check the web OAuth client '
                  'configuration and try again.',
        );
      }
      return token;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) return null;
      if (error.code == GoogleSignInExceptionCode.clientConfigurationError ||
          error.code == GoogleSignInExceptionCode.providerConfigurationError) {
        throw const GoogleAuthenticationException(
          kReleaseMode
              ? 'Google sign-in is not available yet. Please use email and password.'
              : 'Google sign-in configuration needs attention. Check the OAuth '
                  'client, Android package name and signing certificate.',
        );
      }
      throw const GoogleAuthenticationException(
        'Google sign-in could not finish. Please try again.',
      );
    } on TimeoutException {
      throw const GoogleAuthenticationException(
        'Google sign-in took too long to initialize. Check your connection and try again.',
      );
    }
  }
}
