import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static String get baseUrl => ApiConfig.baseUrl;

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token');
    if (token == null) return null;
    try {
      final payload = jsonDecode(utf8.decode(
          base64Url.decode(base64Url.normalize(token.split('.')[1]))));
      final expires = payload['exp'];
      if (expires is num &&
          expires * 1000 > DateTime.now().millisecondsSinceEpoch) return token;
    } catch (_) {
      // Invalid stored sessions must also return to sign-in.
    }
    await clearToken();
    return null;
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.setBool('provider_online', false);
  }

  static Future<Map<String, dynamic>> login(
      String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
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
      String name, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register/customer'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'email': email, 'password': password}),
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

  static Future<Map<String, dynamic>> acceptJob(
      String token, String jobId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/dispatch/job/$jobId/accept'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return {...data, 'success': data['success'] == true};
      } else {
        return {
          'success': false,
          'message': 'Failed to accept job. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> sendQuote(
      String token,
      String jobId,
      double distance,
      double travelingCharge,
      double serviceCharge,
      double totalAmount) async {
    try {
      final response =
          await http.post(Uri.parse('$baseUrl/dispatch/job/$jobId/send-quote'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode({
                'distance': distance,
                'travelingCharge': travelingCharge,
                'serviceCharge': serviceCharge,
                'totalAmount': totalAmount,
              }));

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {
          'success': false,
          'message': 'Failed to send quote. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> completeJob(
      String token, String jobId, String otp) async {
    try {
      final response =
          await http.post(Uri.parse('$baseUrl/dispatch/job/$jobId/complete'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode({
                'otp': otp,
              }));

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body); // Return exactly what backend sends
      } else {
        return {
          'success': false,
          'message': 'Failed to complete job. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static String? _withdrawalKey;
  static Future<Map<String, dynamic>> withdrawFunds(String token) async {
    _withdrawalKey ??= 'withdraw-${DateTime.now().microsecondsSinceEpoch}';
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/dispatch/mechanic/withdraw'),
        headers: {
          'Idempotency-Key': _withdrawalKey!,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode < 500) _withdrawalKey = null;
      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body); // Return exactly what backend sends
      } else {
        return {
          'success': false,
          'message': 'Withdrawal failed. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> cancelJob(
      String token, String jobId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/dispatch/job/$jobId/cancel'),
        body: jsonEncode({'reason': 'Provider unable to complete the service'}),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body); // Return exactly what backend sends
      } else {
        return {
          'success': false,
          'message': 'Cancellation failed. Status: ${response.statusCode}'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }
}
