// Local visual preview: public demo coordinates, no login or customer data.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'widgets/ride_map.dart';

void main() => runApp(
    const MaterialApp(debugShowCheckedModeBanner: false, home: MapPreview()));

class MapPreview extends StatefulWidget {
  const MapPreview({super.key});
  @override
  State<MapPreview> createState() => _MapPreviewState();
}

class _MapPreviewState extends State<MapPreview> {
  LatLng _vehicle = const LatLng(12.9751, 77.5944);
  final _destination = const LatLng(12.9784, 77.6408);
  List<LatLng> _points = [];
  late final http.Client _routes;
  @override
  void initState() {
    super.initState();
    _routes = MockClient((request) async {
      final body = jsonDecode(request.body);
      final url = Uri.parse(
          'https://router.project-osrm.org/route/v1/driving/${body['mechanicLng']},${body['mechanicLat']};${body['customerLng']},${body['customerLat']}?overview=full&geometries=geojson&steps=true');
      final response = await http.get(url).timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) return response;
      final route = jsonDecode(response.body)['routes'][0];
      _points = (route['geometry']['coordinates'] as List)
          .map(
              (p) => LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble()))
          .toList();
      return http.Response(
          jsonEncode({
            'coordinates': route['geometry']['coordinates'],
            'distanceMeters': route['distance'],
            'durationSeconds': route['duration'],
            'steps': (route['legs'] as List)
                .expand((leg) => leg['steps'] as List)
                .map((step) => {
                      'name': step['name'],
                      'type': step['maneuver']['type'],
                      'modifier': step['maneuver']['modifier'],
                      'location': step['maneuver']['location']
                    })
                .toList()
          }),
          200);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: const Text('QuickMechanic · map preview'),
            backgroundColor: const Color(0xFF102D29),
            foregroundColor: Colors.white),
        body: RideMap(
            destination: _destination,
            vehicle: _vehicle,
            updatedAt: DateTime.now(),
            accuracy: 12,
            navigation: true,
            routeClient: _routes),
        bottomNavigationBar: SafeArea(
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton(
                  onPressed: () {
                    if (_points.length > 15)
                      setState(() {
                        _vehicle = _points[15];
                        _points = _points.skip(15).toList();
                      });
                  },
                  child: const Text('Move demo mechanic · simulated GPS'),
                ))),
      );
}
