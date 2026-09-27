import 'dart:convert';
import 'package:http/http.dart' as http;

class ServiceConfigData {
  final List<dynamic> services, vehicles;
  final Map<String, dynamic> saved;
  ServiceConfigData(this.services, this.vehicles, this.saved);
}

Future<ServiceConfigData> loadServiceConfig(
    String baseUrl, String providerId, String token) async {
  Future<dynamic> get(String path, String label) async {
    final response = await http.get(Uri.parse('$baseUrl/$path'), headers: {
      'Authorization': 'Bearer $token'
    }).timeout(const Duration(seconds: 15));
    if (response.statusCode == 401)
      throw Exception('Session expired. Sign in again to load your services.');
    if (response.statusCode != 200)
      throw Exception(
          '$label could not load (HTTP ${response.statusCode}). Please retry.');
    return jsonDecode(response.body);
  }

  final results = await Future.wait([
    get('services', 'Service catalogue'),
    get('vehicle-categories', 'Vehicle catalogue'),
    get('users/mechanics/$providerId/config', 'Your saved configuration'),
  ]);
  if (results[0] is! List ||
      results[1] is! List ||
      results[2] is! Map<String, dynamic>)
    throw Exception('Invalid configuration response from the server.');
  if ((results[0] as List).isEmpty)
    throw Exception(
        'No active services are available. Ask the administrator to enable services.');
  if ((results[1] as List).isEmpty)
    throw Exception(
        'No active vehicle categories are available. Ask the administrator to enable them.');
  return ServiceConfigData(results[0], results[1], results[2]);
}
