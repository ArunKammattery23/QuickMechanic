import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/foundation.dart';
import '../config/api_config.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? socket;
  // Replace with live Cloud Run URL when not testing locally
  final String serverUrl = ApiConfig.baseUrl;

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

    socket!.onConnect((_) {
      if (kDebugMode) {
        print('Connected to Backend WebSocket');
      }
    });

    socket!.onDisconnect((_) {
      if (kDebugMode) {
        print('Disconnected from Backend WebSocket');
      }
    });
  }

  void subscribeToMechanic(
      String mechanicId, Function(dynamic) onLocationUpdate) {
    socket?.emit('subscribe_to_mechanic', {'mechanicId': mechanicId});
    socket?.on('mechanic_location_changed', onLocationUpdate);
  }

  void listenForJobAcceptance(Function(dynamic) onAccepted) {
    socket?.on('job_accepted', onAccepted);
  }

  void disconnect() {
    socket?.disconnect();
  }
}
