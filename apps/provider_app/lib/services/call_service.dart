import 'ice_candidate_buffer.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;
import 'package:vibration/vibration.dart';
import '../config/api_config.dart';
import 'socket_service.dart';

enum CallPhase { idle, ringing, connecting, connected, failed }

class CallService extends ChangeNotifier {
  static final CallService _instance = CallService._internal();
  factory CallService() => _instance;
  CallService._internal();
  final SocketService _socketService = SocketService();
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  RTCVideoRenderer? renderer;
  final _pendingIce = IceCandidateBuffer<RTCIceCandidate>();
  final List<Map<String, dynamic>> _localIce = [];
  bool _remoteReady = false;
  bool _offerSent = false;
  dynamic _boundSocket;
  String? _targetId;
  String? _callId;
  dynamic _offer;
  Timer? _timeout;
  Timer? _disconnectTimeout;
  CallPhase phase = CallPhase.idle;
  String peerName = '';
  String message = '';
  bool muted = false;
  bool relayConfigured = false;

  Future<void> init(String role) async {
    final socket = _socketService.socket;
    if (socket == null || identical(socket, _boundSocket)) return;
    _boundSocket = socket;
    socket.on('incoming_call', (data) async {
      if (phase != CallPhase.idle && phase != CallPhase.failed) {
        socket.emit('end_call',
            {'targetId': data['callerId'], 'callId': data['callId']});
        return;
      }
      _targetId = data['callerId'];
      _callId = data['callId'];
      _offer = data['offer'];
      peerName = data['callerName'] ?? 'Caller';
      _setPhase(CallPhase.ringing, 'Incoming call');
      _armTimeout();
      try {
        if (await Vibration.hasVibrator() && _callId == data['callId'])
          Vibration.vibrate(duration: 1000);
      } catch (_) {}
    });
    socket.on('call_answered', (data) async {
      if (!_matches(data)) return;
      final id = _callId;
      try {
        await _peerConnection?.setRemoteDescription(RTCSessionDescription(
            data['answer']['sdp'], data['answer']['type']));
        _remoteReady = true;
        await _flushIce();
      } catch (_) {
        if (_callId == id)
          await _fail('Could not connect the call. Please retry.');
      }
    });
    socket.on('new_ice_candidate', (data) async {
      if (!_matches(data)) return;
      final id = _callId;
      final c = data['candidate'];
      if (c == null || c['candidate'] == null) return;
      _pendingIce.add(
          RTCIceCandidate(c['candidate'], c['sdpMid'], c['sdpMLineIndex']));
      try {
        await _flushIce();
      } catch (_) {
        if (_callId == id)
          await _fail('Could not connect the call. Please retry.');
      }
    });
    socket.on('call_ended', (data) {
      if (_matches(data)) endCall(notifyPeer: false);
    });
    socket.on('disconnect', (_) {
      if (_callId != null) _fail('Connection lost. Reconnect and try again.');
    });
  }

  bool _matches(dynamic data) =>
      _callId != null &&
      data['callId'] == _callId &&
      data['callerId'] == _targetId;
  void _setPhase(CallPhase value, String text) {
    phase = value;
    message = text;
    notifyListeners();
  }

  void _armTimeout() {
    _timeout?.cancel();
    _timeout = Timer(const Duration(seconds: 45),
        () => _fail('No answer or connection timed out.'));
  }

  Future<void> startCall(String targetId, String myName) async {
    if (phase != CallPhase.idle && phase != CallPhase.failed) return;
    await init('');
    if (phase != CallPhase.idle && phase != CallPhase.failed) return;
    if (_socketService.socket?.connected != true) {
      _setPhase(CallPhase.failed, 'You are offline. Reconnect and try again.');
      return;
    }
    _targetId = targetId;
    _callId =
        '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 30)}';
    final id = _callId;
    peerName = myName == 'Customer' ? 'Mechanic' : 'Customer';
    _setPhase(CallPhase.connecting, 'Calling $peerName…');
    _armTimeout();
    try {
      await _createPeer(id!);
      if (_callId != id) return;
      final offer = await _peerConnection!.createOffer();
      await _peerConnection!.setLocalDescription(offer);
      await _signal('call_offer', {
        'offer': {'sdp': offer.sdp, 'type': offer.type},
        'callerName': myName
      });
      if (_callId != id) return;
      _offerSent = true;
      _flushLocalIce();
    } catch (e) {
      if (_callId == id)
        await _fail(
            'Call failed. Check microphone permission and your connection. $e');
    }
  }

  Future<void> acceptCall() async {
    if (phase != CallPhase.ringing) return;
    final id = _callId;
    _setPhase(CallPhase.connecting, 'Connecting…');
    try {
      try {
        await Vibration.cancel();
      } catch (_) {}
      await _createPeer(id!);
      if (_callId != id) return;
      await _peerConnection!.setRemoteDescription(
          RTCSessionDescription(_offer['sdp'], _offer['type']));
      _remoteReady = true;
      await _flushIce();
      final answer = await _peerConnection!.createAnswer();
      await _peerConnection!.setLocalDescription(answer);
      await _signal('call_answer', {
        'answer': {'sdp': answer.sdp, 'type': answer.type}
      });
      if (_callId != id) return;
      _offerSent = true;
      _flushLocalIce();
    } catch (e) {
      if (_callId == id)
        await _fail(
            'Call failed. Check microphone permission and your connection. $e');
    }
  }

  Future<void> _createPeer(String id) async {
    final auth = _socketService.socket!.auth as Map;
    final response = await http
        .get(Uri.parse('${ApiConfig.baseUrl}/calls/ice-servers'), headers: {
      'Authorization': 'Bearer ${auth['token']}'
    }).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200)
      throw StateError('Could not load call settings');
    final config = jsonDecode(response.body);
    if (_callId != id) return;
    relayConfigured = config['relayConfigured'] == true;
    final pc = await createPeerConnection(
        {'iceServers': config['iceServers'], 'sdpSemantics': 'unified-plan'});
    if (_callId != id) {
      await pc.close();
      return;
    }
    _peerConnection = pc;
    pc.onIceCandidate = (c) {
      if (_callId != id || c.candidate == null || c.candidate!.isEmpty) return;
      _localIce.add({
        'candidate': c.candidate,
        'sdpMid': c.sdpMid,
        'sdpMLineIndex': c.sdpMLineIndex
      });
      _flushLocalIce();
    };
    final view = RTCVideoRenderer();
    await view.initialize();
    if (_callId != id) {
      await view.dispose();
      return;
    }
    renderer = view;
    pc.onTrack = (event) {
      if (_callId == id && event.streams.isNotEmpty) {
        view.srcObject = event.streams.first;
        notifyListeners();
      }
    };
    pc.onConnectionState = (state) {
      if (_callId != id) return;
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
        _timeout?.cancel();
        _disconnectTimeout?.cancel();
        _setPhase(CallPhase.connected, 'Connected');
      } else if (state ==
          RTCPeerConnectionState.RTCPeerConnectionStateDisconnected) {
        _disconnectTimeout?.cancel();
        _disconnectTimeout = Timer(const Duration(seconds: 10), () {
          if (_callId == id) _fail('Call connection lost. Please try again.');
        });
      } else if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
        _fail(relayConfigured
            ? 'Call connection failed. Please retry.'
            : 'This network needs a call relay. TURN is not configured on the server.');
      }
    };
    final stream = await navigator.mediaDevices
        .getUserMedia({'audio': true, 'video': false});
    if (_callId != id) {
      for (final track in stream.getTracks()) {
        await track.stop();
      }
      await stream.dispose();
      return;
    }
    _localStream = stream;
    for (final track in stream.getTracks()) {
      await pc.addTrack(track, stream);
    }
  }

  Future<void> _signal(String event, Map<String, dynamic> payload) async {
    final done = Completer<void>();
    _socketService.socket!.emitWithAck(
        event, {'targetId': _targetId, 'callId': _callId, ...payload},
        ack: (data) {
      if (done.isCompleted) return;
      if (data is Map && data['success'] == true) {
        done.complete();
      } else {
        done.completeError(StateError(
            data is Map ? '${data['message']}' : 'Signaling failed'));
      }
    });
    await done.future.timeout(const Duration(seconds: 10));
  }

  void _flushLocalIce() {
    if (!_offerSent) return;
    while (_localIce.isNotEmpty) {
      _socketService.socket?.emit('ice_candidate', {
        'targetId': _targetId,
        'callId': _callId,
        'candidate': _localIce.removeAt(0)
      });
    }
  }

  Future<void> _flushIce() async {
    final pc = _peerConnection;
    if (_remoteReady && pc != null) await _pendingIce.drain(pc.addCandidate);
  }

  void toggleMute() {
    muted = !muted;
    for (final track
        in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      track.enabled = !muted;
    }
    notifyListeners();
  }

  Future<void> _fail(String reason) async {
    await endCall();
    if (_callId == null) _setPhase(CallPhase.failed, reason);
  }

  Future<void> endCall({bool notifyPeer = true}) async {
    if (notifyPeer && _targetId != null)
      _socketService.socket
          ?.emit('end_call', {'targetId': _targetId, 'callId': _callId});
    _callId = null;
    _targetId = null;
    _timeout?.cancel();
    _disconnectTimeout?.cancel();
    _remoteReady = false;
    _offerSent = false;
    _pendingIce.clear();
    _localIce.clear();
    muted = false;
    final stream = _localStream;
    _localStream = null;
    final pc = _peerConnection;
    _peerConnection = null;
    final view = renderer;
    renderer = null;
    _setPhase(CallPhase.idle, '');
    try {
      await Vibration.cancel();
    } catch (_) {}
    for (final track in stream?.getTracks() ?? <MediaStreamTrack>[]) {
      await track.stop();
    }
    await stream?.dispose();
    await pc?.close();
    await view?.dispose();
  }
}
