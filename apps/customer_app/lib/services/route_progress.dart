import 'dart:math' as math;
import 'package:latlong2/latlong.dart';

class RouteProgress {
  final LatLng point;
  final int segment;
  final double offRouteMeters;
  final double remainingMeters;
  final double totalMeters;
  const RouteProgress(this.point, this.segment, this.offRouteMeters,
      this.remainingMeters, this.totalMeters);

  static RouteProgress? locate(List<LatLng> route, LatLng position) {
    if (route.length < 2) return null;
    const distance = Distance();
    final scale = math.cos(position.latitude * math.pi / 180);
    var nearest = double.infinity, index = 0, fraction = 0.0, total = 0.0;
    var projected = route.first;
    final lengths = <double>[];
    for (var i = 0; i < route.length - 1; i++) {
      final a = route[i], b = route[i + 1];
      final dx = (b.longitude - a.longitude) * scale,
          dy = b.latitude - a.latitude;
      final denom = dx * dx + dy * dy;
      final t = denom == 0
          ? 0.0
          : (((position.longitude - a.longitude) * scale * dx +
                      (position.latitude - a.latitude) * dy) /
                  denom)
              .clamp(0.0, 1.0);
      final point = LatLng(
          a.latitude + dy * t, a.longitude + (b.longitude - a.longitude) * t);
      final gap = distance(position, point);
      if (gap < nearest) {
        nearest = gap;
        index = i;
        fraction = t;
        projected = point;
      }
      final length = distance(a, b);
      lengths.add(length);
      total += length;
    }
    final remaining = lengths[index] * (1 - fraction) +
        lengths.skip(index + 1).fold(0.0, (a, b) => a + b);
    return RouteProgress(projected, index, nearest, remaining, total);
  }
}
