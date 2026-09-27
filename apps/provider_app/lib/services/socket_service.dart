import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../config/api_config.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? socket;
  final String serverUrl = ApiConfig.baseUrl;

  // GPS broadcasting state
  StreamSubscription<Position>? _locationSubscription;
  bool _isBroadcasting = false;
  String? _locationMechanicId;

  void connect(String token) {
    if (socket != null) {
      final oldToken = (socket!.auth as Map?)?['token'];
      if (oldToken != token) {
        socket!.disconnect();
        socket!.sendBuffer.clear();
        socket!.auth = {'token': token};
      }
      if (!socket!.connected) socket!.connect();
      return;
    }

    socket = IO.io(serverUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'forceNew': true,
      'auth': {'token': token},
    });

    socket!.connect();

    socket!.onConnect((_) async {
      if (kDebugMode) {
        print('Connected to Backend WebSocket');
      }
      final id = _locationMechanicId;
      if (id != null) {
        try {
          final position = await Geolocator.getCurrentPosition();
          if (_locationMechanicId == id)
            updateLocation(id, position.latitude, position.longitude,
                bearing: position.heading,
                accuracy: position.accuracy,
                observedAt: position.timestamp);
        } catch (_) {}
      }
    });
  }

  void updateLocation(String mechanicId, double lat, double lng,
      {double bearing = 0.0, double? accuracy, DateTime? observedAt}) {
    _locationMechanicId = mechanicId;
    // Never replay buffered old GPS readings as fresh locations after reconnecting.
    if (socket?.connected != true) return;
    socket?.emit('update_location', {
      'mechanicId': mechanicId,
      'lat': lat,
      'lng': lng,
      'bearing': bearing,
      'accuracy': accuracy,
      'timestamp': (observedAt ?? DateTime.now()).toUtc().toIso8601String(),
    });
  }

  /// Start broadcasting GPS location every ~5 seconds
  Future<void> startLocationBroadcast(String mechanicId) async {
    if (_isBroadcasting) return;

    // Ensure location permissions are granted
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (kDebugMode) {
          print('Location permission denied. Cannot broadcast.');
        }
        return;
      }
    }

    _isBroadcasting = true;
    if (kDebugMode) {
      print('📡 GPS Broadcasting STARTED for mechanic: $mechanicId');
    }

    // Use Geolocator's position stream for real-time updates
    final locationSettings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5, // Only fire when moved 5+ meters
      intervalDuration: const Duration(seconds: 5),
    );

    _locationSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen((Position position) {
      if (kDebugMode) {
        print(
            '📍 Broadcasting: ${position.latitude}, ${position.longitude} (heading: ${position.heading})');
      }
      updateLocation(
        mechanicId,
        position.latitude,
        position.longitude,
        bearing: position.heading,
        accuracy: position.accuracy,
        observedAt: position.timestamp,
      );
    }, onError: (error) {
      if (kDebugMode) {
        print('GPS Stream Error: $error');
      }
    });
  }

  /// Stop broadcasting GPS location
  void stopLocationBroadcast() {
    _locationSubscription?.cancel();
    _locationSubscription = null;
    _isBroadcasting = false;
    if (kDebugMode) {
      print('🛑 GPS Broadcasting STOPPED');
    }
  }

  bool get isBroadcasting => _isBroadcasting;

  void disconnect() {
    stopLocationBroadcast();
    _locationMechanicId = null;
    socket?.sendBuffer.clear();
    socket?.disconnect();
  }
}
