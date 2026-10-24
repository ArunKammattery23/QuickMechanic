import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class AdminApi {
  AdminApi({required this.token});
  final String token;
  static const String _apiOverride = String.fromEnvironment('API_BASE_URL');
  static String get baseUrl => _apiOverride.isNotEmpty
      ? _apiOverride
      : kReleaseMode
          ? 'https://quickmechanic-api-x6f6mkpywq-uc.a.run.app'
          : 'http://127.0.0.1:3000';

  static Future<Map<String, dynamic>> login(String email, String password) async {
    late http.Response response;
    try {
      response = await http.post(Uri.parse('$baseUrl/auth/admin-login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email.trim(), 'password': password}),
      ).timeout(const Duration(seconds: 20));
    } on SocketException { throw _connectionError(); }
      on http.ClientException { throw _connectionError(); }
      on TimeoutException { throw _connectionError(); }
    final data = _parse(response);
    if (data is! Map<String, dynamic>) throw const FormatException('Invalid sign-in response');
    return data;
  }

  Future<dynamic> request(String path, {String method = 'GET', Object? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
    late http.Response response;
    try {
      switch (method) {
        case 'POST': response = await http.post(uri, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 20)); break;
        case 'PATCH': response = await http.patch(uri, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 20)); break;
        default: response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 20));
      }
    } on SocketException { throw _connectionError(); }
      on http.ClientException { throw _connectionError(); }
      on TimeoutException { throw _connectionError(); }
    return _parse(response);
  }

  Future<Uint8List> image(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'),
      headers: {'Authorization': 'Bearer $token'}).timeout(const Duration(seconds: 20));
    if (response.statusCode >= 400) {
      _parse(response);
      throw Exception('Unable to load ID image');
    }
    return response.bodyBytes;
  }

  static dynamic _parse(http.Response response) {
    dynamic data;
    try { data = jsonDecode(response.body); } catch (_) { data = null; }
    if (response.statusCode >= 400) {
      final raw = data is Map ? data['message'] : null;
      final message = raw is List ? raw.join(', ') : raw?.toString();
      throw AdminApiException(response.statusCode, message ?? 'Request failed');
    }
    return data;
  }

  static AdminApiException _connectionError() => AdminApiException(0,
    'Cannot reach the QuickMechanic API. Check that the local server is running and reconnect the phone with scripts/connect-android-local.ps1 -LocalApiPort 3003, then retry.');
}

class AdminApiException implements Exception {
  AdminApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;
  @override String toString() => message;
}
