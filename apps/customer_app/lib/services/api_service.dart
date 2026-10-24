import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static String get baseUrl => ApiConfig.baseUrl;
  static String? token;

  static Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('customer_jwt');
    if (saved == null) return;
    try {
      final payload = jsonDecode(utf8
          .decode(base64Url.decode(base64Url.normalize(saved.split('.')[1]))));
      if (payload['role'] == 'CUSTOMER' &&
          (payload['exp'] as num) * 1000 >
              DateTime.now().millisecondsSinceEpoch) {
        token = saved;
        return;
      }
    } catch (_) {}
    await clearSession();
  }

  static Future<void> clearSession() async {
    token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('customer_jwt');
  }

  static Future<Map<String, dynamic>> login(
      String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email.trim(), 'password': password}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);

        if (data['role'] != 'CUSTOMER') {
          return {
            'success': false,
            'message':
                'Access Denied: Please use the QuickMechanic Provider App.'
          };
        }

        token = data['accessToken'] ?? data['access_token'];
        if (token == null) throw Exception('Missing login session');
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('customer_jwt', token!);
        return {'success': true, 'data': data};
      } else if (response.statusCode == 401) {
        return {
          'success': false,
          'message':
              'Email or password is incorrect. Please check your details or use Forgot Password.'
        };
      } else {
        return {
          'success': false,
          'message': 'Login failed. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> registerCustomer(
      String name, String phone, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register/customer'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': name,
          'phoneNumber': phone,
          'email': email,
          'password': password
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {
          'success': false,
          'message': 'Registration failed. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  /// The server verifies Google's identity token before issuing our session.
  /// Name and email deliberately come from the verified token, not the client.
  static Future<Map<String, dynamic>> googleAuthenticate({
    required String idToken,
    required String intent,
    String? phoneNumber,
    String? linkPassword,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/auth/google'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'idToken': idToken,
              'accountType': 'CUSTOMER',
              'intent': intent,
              if (phoneNumber != null) 'phoneNumber': phoneNumber.trim(),
              if (linkPassword != null) 'linkPassword': linkPassword,
            }),
          )
          .timeout(const Duration(seconds: 25));
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Invalid authentication response');
      }
      if (response.statusCode == 200 || response.statusCode == 201) {
        final session = decoded['accessToken'] ?? decoded['access_token'];
        if (decoded['role'] != 'CUSTOMER' ||
            session is! String ||
            session.isEmpty) {
          return {
            'success': false,
            'message':
                'Google sign-in did not return a Customer session. Please try again.',
          };
        }
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('customer_jwt', session);
        token = session;
        return {'success': true, 'data': decoded};
      }
      final serverMessage = kReleaseMode &&
              decoded['code'] == 'GOOGLE_SIGN_IN_NOT_CONFIGURED'
          ? 'Google sign-in is not available yet. Please use email and password.'
          : decoded['message'];
      return {
        'success': false,
        'code': decoded['code'],
        'message': serverMessage is String
            ? serverMessage
            : 'Google sign-in could not be completed. Please try again.',
      };
    } on TimeoutException {
      return {
        'success': false,
        'message':
            'Google sign-in timed out. Check your connection and try again.',
      };
    } on FormatException {
      return {
        'success': false,
        'message':
            'The server returned an invalid sign-in response. Please try again.',
      };
    } catch (_) {
      return {
        'success': false,
        'message':
            'Google sign-in could not connect. Check your connection and try again.',
      };
    }
  }

  static Future<Map<String, dynamic>> registerProvider(
      String name, String email, String password, String type) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register/mechanic'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(
            {'name': name, 'email': email, 'password': password, 'type': type}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {
          'success': false,
          'message': 'Registration failed. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> getNearbyMechanics(
      String categoryId, double lat, double lng) async {
    try {
      final headers = {
        'Content-Type': 'application/json',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.post(
        Uri.parse('$baseUrl/dispatch/nearby'),
        headers: headers,
        body: jsonEncode({
          'serviceType': categoryId,
          'lat': lat,
          'lng': lng,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {
          'success': false,
          'message': 'Failed to fetch mechanics. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> requestMechanic(
      String categoryId, double lat, double lng, String mechanicId) async {
    try {
      final headers = {
        'Content-Type': 'application/json',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.post(
        Uri.parse('$baseUrl/dispatch/request'),
        headers: headers,
        body: jsonEncode({
          'serviceType': categoryId,
          'lat': lat,
          'lng': lng,
          'mechanicId': mechanicId,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {
          'success': false,
          'message': 'Failed to request. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> payJob(String jobId,
      {String? simulationResult}) async {
    try {
      final headers = {
        'Content-Type': 'application/json',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http
          .post(
            Uri.parse('$baseUrl/dispatch/job/$jobId/confirm-payment'),
            headers: headers,
            body: jsonEncode({
              if (simulationResult != null) 'simulationResult': simulationResult
            }),
          )
          .timeout(const Duration(seconds: 20));

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response
            .body); // Server confirms payment or returns a verified checkout URL.
      } else {
        return {
          'success': false,
          'message': jsonDecode(response.body)['message'] ?? 'Payment failed'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> rateMechanic(
      String jobId, int rating) async {
    try {
      final headers = {
        'Content-Type': 'application/json',
      };
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http.post(
        Uri.parse('$baseUrl/dispatch/job/$jobId/rate'),
        headers: headers,
        body: jsonEncode({
          'rating': rating,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body);
      } else {
        return {
          'success': false,
          'message': 'Rating failed. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }
}
