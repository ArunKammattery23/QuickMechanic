import '../services/route_progress.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/api_config.dart';
import '../services/socket_service.dart';
import '../services/tile_client.dart';

/// Road routing and camera behavior shared by the customer and provider maps.
class RideMap extends StatefulWidget {
  final LatLng destination;
  final LatLng? vehicle;
  final double bearing;
  final DateTime? updatedAt;
  final double? accuracy;
  final bool navigation;
  final void Function(String distance, String eta)? onEstimate;
  final http.Client? routeClient;
  final TileProvider? tileProvider;
  final DateTime Function()? clock;
  const RideMap(
      {super.key,
      required this.destination,
      this.vehicle,
      this.bearing = 0,
      this.updatedAt,
      this.accuracy,
      this.navigation = false,
      this.onEstimate,
      this.routeClient,
      this.tileProvider,
      this.clock});
  @override
  State<RideMap> createState() => _RideMapState();
}

class _RideMapState extends State<RideMap> with SingleTickerProviderStateMixin {
  final _map = MapController();
  final _distance = const Distance();
  late final AnimationController _motion;
  LatLng? _from, _to;
  double _fromBearing = 0, _toBearing = 0;
  bool _follow = true, _ready = false, _loading = false;
  String? _error;
  List<LatLng> _route = [];
  List<dynamic> _steps = [];
  double? _meters, _seconds;
  DateTime? _lastFetch;
  LatLng? _routeOrigin;
  Timer? _timer;
  late final http.Client _http;
  late final TileProvider _tiles;
  DateTime get _now => widget.clock?.call() ?? DateTime.now();

  @override
  void initState() {
    super.initState();
    _http = widget.routeClient ?? http.Client();
    _tiles = widget.tileProvider ??
        NetworkTileProvider(httpClient: createTileClient());
    _from = _to = widget.vehicle;
    _fromBearing = _toBearing = widget.bearing;
    _motion = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200));
    _fetchRoute();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!mounted) return;
      setState(() {});
      _maybeRefresh();
    });
  }

  @override
  void didUpdateWidget(covariant RideMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.destination != oldWidget.destination) {
      _route = [];
      _meters = null;
      _seconds = null;
      _lastFetch = null;
      _maybeRefresh();
    }
    if (widget.vehicle != null && widget.vehicle != oldWidget.vehicle) {
      _from = _displayPosition ?? widget.vehicle;
      _to = widget.vehicle;
      _fromBearing = _displayBearing;
      // Rotate across north using the shortest angular path.
      _toBearing =
          _fromBearing + ((widget.bearing - _fromBearing + 540) % 360 - 180);
      if (_from != null && _distance(_from!, _to!) > 500) _from = _to;
      _motion.forward(from: 0);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (_follow && _ready) _fit();
        widget.onEstimate?.call(_distanceLabel, _etaLabel);
      });
      _maybeRefresh();
    }
  }

  LatLng? get _displayPosition => _from == null || _to == null
      ? _to
      : LatLng(
          _from!.latitude + (_to!.latitude - _from!.latitude) * _motion.value,
          _from!.longitude +
              (_to!.longitude - _from!.longitude) * _motion.value);
  double get _displayBearing =>
      _fromBearing + (_toBearing - _fromBearing) * _motion.value;
  bool get _stale =>
      widget.updatedAt != null &&
      _now.difference(widget.updatedAt!).inSeconds > 30;

  double _offRouteDistance() {
    if (widget.vehicle == null || _route.length < 2) return double.infinity;
    return RouteProgress.locate(_route, widget.vehicle!)?.offRouteMeters ??
        double.infinity;
  }

  void _maybeRefresh() {
    if (_loading ||
        widget.vehicle == null ||
        _stale ||
        (widget.accuracy ?? 0) > 80) return;
    final elapsed =
        _lastFetch == null ? 1000 : _now.difference(_lastFetch!).inSeconds;
    final moved = _routeOrigin == null
        ? double.infinity
        : _distance(_routeOrigin!, widget.vehicle!);
    // Refresh no faster than every 15s; avoid polling the public router while stationary.
    if (elapsed >= 15 &&
        (_route.isEmpty ||
            (_offRouteDistance() > 80 && moved > 40) ||
            (elapsed >= 45 && moved > 30))) _fetchRoute();
  }

  Future<void> _fetchRoute() async {
    final origin = widget.vehicle;
    if (origin == null || _loading) return;
    _loading = true;
    _lastFetch = _now;
    final destination = widget.destination;
    if (mounted) setState(() {});
    try {
      final auth = SocketService().socket?.auth;
      final token = auth is Map ? auth['token'] : null;
      final response = await _http
          .post(Uri.parse('${ApiConfig.baseUrl}/api/get-breakdown-route'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token'
              },
              body: jsonEncode({
                'mechanicLat': origin.latitude,
                'mechanicLng': origin.longitude,
                'customerLat': destination.latitude,
                'customerLng': destination.longitude
              }))
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200 && response.statusCode != 201)
        throw StateError('Route unavailable');
      final data = jsonDecode(response.body);
      final points = (data['coordinates'] as List)
          .map(
              (p) => LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble()))
          .toList();
      if (points.length < 2) throw StateError('No road route found');
      if (!mounted || destination != widget.destination) return;
      setState(() {
        _route = points;
        _routeOrigin = origin;
        _meters = (data['distanceMeters'] as num).toDouble();
        _seconds = (data['durationSeconds'] as num).toDouble();
        _steps = data['steps'] ?? [];
        _error = null;
      });
      widget.onEstimate?.call(_distanceLabel, _etaLabel);
      if (_follow) _fit();
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not find a road route. Tap retry.';
          _route = [];
          _meters = null;
          _seconds = null;
        });
        widget.onEstimate?.call('Unavailable', 'Unavailable');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  RouteProgress? get _progress => widget.vehicle == null
      ? null
      : RouteProgress.locate(_route, widget.vehicle!);
  double get _remainingFraction {
    final p = _progress;
    return p == null || p.totalMeters == 0 || p.offRouteMeters > 80
        ? 1
        : (p.remainingMeters / p.totalMeters).clamp(0.0, 1.0);
  }

  String get _distanceLabel {
    if (_meters == null) return '—';
    final remaining = _meters! * _remainingFraction;
    return remaining < 1000
        ? remaining.round().toString() + ' m'
        : (remaining / 1000).toStringAsFixed(1) + ' km';
  }

  String get _etaLabel => _seconds == null
      ? '—'
      : '${math.max(1, (_seconds! * _remainingFraction / 60).ceil())} min';
  String get _instruction {
    if ((widget.accuracy ?? 0) > 80)
      return 'GPS accuracy low · waiting for a clearer fix';
    if (_route.isNotEmpty && _offRouteDistance() > 80)
      return 'Off route · updating directions';
    if (_route.isEmpty || widget.vehicle == null)
      return 'Finding the best road route';
    if (_distance(widget.vehicle!, widget.destination) < 35)
      return 'Destination nearby — check the pickup point';
    // First maneuver is departure; the next one describes the upcoming turn.
    if (_steps.length < 2) return 'Continue along the highlighted route';
    final progress = _progress;
    final futureSteps = _steps.skip(1).where((step) {
      final location = step['location'];
      if (location is! List || location.length != 2 || progress == null)
        return false;
      final stepPosition = LatLng(
          (location[1] as num).toDouble(), (location[0] as num).toDouble());
      final stepProgress = RouteProgress.locate(_route, stepPosition);
      return stepProgress != null &&
          stepProgress.remainingMeters < progress.remainingMeters - 15;
    });
    if (futureSteps.isEmpty) return 'Continue to the customer location';
    final step = futureSteps.first;
    final road = '${step['name'] ?? ''}';
    if (step['type'] == 'arrive') return 'Continue to the customer location';
    final direction = '${step['modifier'] ?? 'ahead'}'.replaceAll('_', ' ');
    return '${direction == 'straight' ? 'Continue straight' : 'Head $direction'}${road.isEmpty ? '' : ' onto $road'}';
  }

  void _fit() {
    if (!_ready) return;
    final progress = _progress;
    final points = [
      if (widget.vehicle != null) widget.vehicle!,
      if (progress != null) ..._route.skip(progress.segment + 1),
      widget.destination
    ];
    final size = _map.camera.nonRotatedSize;
    _map.fitCamera(CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(points),
        padding: EdgeInsets.fromLTRB(
            40, math.min(170, size.y * .3), 40, math.min(250, size.y * .35)),
        maxZoom: 17));
  }

  @override
  void dispose() {
    _timer?.cancel();
    _http.close();
    _motion.dispose();
    _map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final status = _error ??
        (widget.vehicle == null
            ? 'Waiting for mechanic location'
            : _stale
                ? 'Location delayed · last update ${DateTime.now().difference(widget.updatedAt!).inSeconds}s ago'
                : widget.navigation
                    ? _instruction
                    : 'Your mechanic is on the way');
    final progress = _progress;
    final remainingRoute = progress != null && progress.offRouteMeters <= 50
        ? [progress.point, ..._route.skip(progress.segment + 1)]
        : _route;
    return Stack(children: [
      AnimatedBuilder(
          animation: _motion,
          builder: (context, _) => FlutterMap(
                mapController: _map,
                options: MapOptions(
                    initialCenter: widget.vehicle ?? widget.destination,
                    initialZoom: 15,
                    onMapReady: () {
                      _ready = true;
                      _fit();
                    },
                    onPositionChanged: (_, gesture) {
                      if (gesture && _follow) setState(() => _follow = false);
                    }),
                children: [
                  TileLayer(
                      urlTemplate: const String.fromEnvironment('MAP_TILE_URL',
                          defaultValue:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                      tileProvider: _tiles,
                      userAgentPackageName: 'com.quickmechanic.app',
                      maxZoom: 19),
                  if (_route.isNotEmpty)
                    PolylineLayer(polylines: [
                      Polyline(
                          points: remainingRoute,
                          strokeWidth: 9,
                          color: Colors.white),
                      Polyline(
                          points: remainingRoute,
                          strokeWidth: 5,
                          color: const Color(0xFF007D69)),
                    ]),
                  if (_displayPosition != null && widget.accuracy != null)
                    CircleLayer(circles: [
                      CircleMarker(
                        point: _displayPosition!,
                        radius: widget.accuracy!.clamp(0, 150),
                        useRadiusInMeter: true,
                        color: const Color(0x19007D69),
                        borderColor: const Color(0x55007D69),
                        borderStrokeWidth: 1,
                      )
                    ]),
                  MarkerLayer(markers: [
                    Marker(
                        point: widget.destination,
                        width: 110,
                        height: 70,
                        alignment: Alignment.topCenter,
                        child: Column(children: [
                          Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                  color: const Color(0xFF102D29),
                                  borderRadius: BorderRadius.circular(8)),
                              child: Text(
                                  widget.navigation ? 'CUSTOMER' : 'YOU',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold))),
                          const Icon(Icons.location_on,
                              color: Color(0xFF102D29), size: 36),
                        ])),
                    if (_displayPosition != null)
                      Marker(
                          point: _displayPosition!,
                          width: 48,
                          height: 48,
                          child: Transform.rotate(
                              angle: _displayBearing * math.pi / 180,
                              child: Container(
                                decoration: BoxDecoration(
                                    color: _stale
                                        ? Colors.grey
                                        : const Color(0xFF007D69),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                        color: Colors.white, width: 3),
                                    boxShadow: const [
                                      BoxShadow(
                                          color: Colors.black26, blurRadius: 8)
                                    ]),
                                child: const Icon(Icons.navigation,
                                    color: Colors.white, size: 28),
                              ))),
                  ]),
                ],
              )),
      Positioned(
          top: 12,
          left: 16,
          right: 16,
          child: Material(
              elevation: 5,
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(children: [
                        Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                                color: _stale || _error != null
                                    ? Colors.orange
                                    : const Color(0xFF007D69),
                                shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Expanded(
                            child: Text(status,
                                maxLines: 2,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF102D29))))
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Text(_etaLabel,
                            style: const TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF007D69))),
                        const SizedBox(width: 16),
                        Text(_distanceLabel,
                            style: const TextStyle(
                                fontSize: 18, color: Color(0xFF102D29))),
                        const Spacer(),
                        if (_loading)
                          const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2)),
                        if (_error != null)
                          TextButton(
                              onPressed: _fetchRoute,
                              child: const Text('Retry'))
                      ]),
                      const SizedBox(height: 3),
                      const Text('Road estimate · live traffic not included',
                          style:
                              TextStyle(fontSize: 11, color: Colors.black54)),
                    ]),
              ))),
      Positioned(
          top: 170,
          right: 16,
          child: FloatingActionButton.small(
              heroTag: null,
              backgroundColor: Colors.white,
              tooltip: 'Recenter and follow',
              onPressed: () {
                setState(() => _follow = true);
                _fit();
              },
              child: Icon(_follow ? Icons.gps_fixed : Icons.gps_not_fixed,
                  color: const Color(0xFF007D69)))),
      Positioned(
          top: 170,
          left: 12,
          child: Material(
              color: Colors.white70,
              borderRadius: BorderRadius.circular(5),
              child: InkWell(
                onTap: () => launchUrl(
                    Uri.parse('https://www.openstreetmap.org/copyright')),
                child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Text('© OpenStreetMap contributors',
                        style: TextStyle(fontSize: 10, color: Colors.black87))),
              ))),
    ]);
  }
}
