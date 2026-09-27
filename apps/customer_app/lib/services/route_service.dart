import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../config/api_config.dart';
import 'socket_service.dart';

class RouteService {
  static Future<List<LatLng>> getRoute(LatLng start, LatLng end) async {
    final auth = SocketService().socket?.auth;
    final token = auth is Map ? auth['token'] : null;
    final response = await http.post(Uri.parse('${ApiConfig.baseUrl}/api/get-breakdown-route'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'mechanicLat': start.latitude, 'mechanicLng': start.longitude,
        'customerLat': end.latitude, 'customerLng': end.longitude})).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200 && response.statusCode != 201) throw StateError('Road route unavailable');
    final data = jsonDecode(response.body);
    return (data['coordinates'] as List).map((p) => LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble())).toList();
  }
}