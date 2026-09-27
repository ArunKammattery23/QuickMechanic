import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import '../lib/widgets/ride_map.dart';
import '../lib/services/route_progress.dart';

class BlankTiles extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      MemoryImage(base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='));
}

void main() {
  test(
      'progress follows road segments instead of straight-line destination distance',
      () {
    final route = [
      const LatLng(12, 77),
      const LatLng(12, 77.01),
      const LatLng(12.01, 77.01)
    ];
    final progress = RouteProgress.locate(route, const LatLng(12, 77.005))!;
    expect(progress.offRouteMeters, lessThan(1));
    expect(progress.segment, 0);
    expect(progress.remainingMeters, greaterThan(1500));
    expect(progress.remainingMeters / progress.totalMeters, closeTo(.75, .02));
    expect(
        RouteProgress.locate(route, const LatLng(12.02, 77.02))!.offRouteMeters,
        greaterThan(500));
  });
  test('handles zero-length segments and arrival without invalid numbers', () {
    final point = const LatLng(12, 77);
    final progress = RouteProgress.locate([point, point], point)!;
    expect(progress.totalMeters, 0);
    expect(progress.remainingMeters, 0);
  });

  Future<void> pumpMap(WidgetTester tester, http.Client client,
      {LatLng vehicle = const LatLng(12, 77)}) async {
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: RideMap(
      destination: const LatLng(12.01, 77.01),
      vehicle: vehicle,
      navigation: true,
      updatedAt: DateTime.now(),
      routeClient: client,
      tileProvider: BlankTiles(),
    ))));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  Map<String, Object> road() => {
        'coordinates': [
          [77, 12],
          [77.01, 12],
          [77.01, 12.01]
        ],
        'distanceMeters': 2200,
        'durationSeconds': 420,
        'steps': [
          {
            'type': 'depart',
            'location': [77, 12]
          },
          {
            'type': 'turn',
            'modifier': 'left',
            'name': 'Main Road',
            'location': [77.01, 12]
          }
        ]
      };

  testWidgets(
      'renders road geometry, estimate, upcoming turn and map attribution',
      (tester) async {
    await pumpMap(tester, MockClient((request) async {
      final data = jsonDecode(request.body);
      expect(data['mechanicLat'], 12);
      expect(data['customerLng'], 77.01);
      return http.Response(jsonEncode(road()), 200);
    }));
    expect(find.text('7 min'), findsOneWidget);
    expect(find.text('2.2 km'), findsOneWidget);
    expect(find.text('Head left onto Main Road'), findsOneWidget);
    expect(find.text('© OpenStreetMap contributors'), findsOneWidget);
    expect(
        tester
            .widget<PolylineLayer>(find.byType(PolylineLayer))
            .polylines
            .first
            .points
            .length,
        3);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('route failure has retry and never draws a fake straight line',
      (tester) async {
    var attempts = 0;
    await pumpMap(tester, MockClient((_) async {
      attempts++;
      return http.Response(
          attempts == 1 ? '{}' : jsonEncode(road()), attempts == 1 ? 502 : 200);
    }));
    expect(find.byType(PolylineLayer), findsNothing);
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('7 min'), findsOneWidget);
    expect(attempts, 2);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
      'reroutes after leaving the road and does not poll while stationary',
      (tester) async {
    var requests = 0;
    var now = DateTime(2026, 9, 12);
    final client = MockClient((_) async {
      requests++;
      return http.Response(jsonEncode(road()), 200);
    });
    Widget map(LatLng position) => MaterialApp(
        home: Scaffold(
            body: RideMap(
                destination: const LatLng(12.01, 77.01),
                vehicle: position,
                updatedAt: now,
                clock: () => now,
                routeClient: client,
                tileProvider: BlankTiles())));
    await tester.pumpWidget(map(const LatLng(12, 77)));
    await tester.pump();
    expect(requests, 1);
    now = now.add(const Duration(seconds: 50));
    await tester.pumpWidget(map(const LatLng(12, 77)));
    await tester.pump(const Duration(seconds: 10));
    expect(requests, 1);
    await tester.pumpWidget(map(const LatLng(12.005, 77)));
    await tester.pump();
    expect(requests, 2);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
