import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Live Cloud Run URL
  static const String baseUrl = 'https://quickmechanic-api-180157507652.us-central1.run.app';

  static Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {'success': false, 'message': 'Login failed. Status: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> registerCustomer(String name, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register/customer'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'email': email, 'password': password}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {'success': false, 'message': 'Registration failed. Status: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }

  static Future<Map<String, dynamic>> registerProvider(String name, String email, String password, String type) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register/mechanic'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'email': email, 'password': password, 'type': type}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {'success': false, 'message': 'Registration failed. Status: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network Error: $e'};
    }
  }
}
