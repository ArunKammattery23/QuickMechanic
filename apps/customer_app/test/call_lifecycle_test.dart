import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:socket_io_client/src/manager.dart';
import '../lib/services/call_service.dart';
import '../lib/services/socket_service.dart';

class ControlledSocket extends io.Socket {
  ControlledSocket()
      : super(Manager(uri: 'http://localhost:1', options: {'autoConnect': false}), '/',
            {'auth': {'token': 'local-test'}}) {
    connected = true;
  }
  final sent = <Map<String, dynamic>>[];
  Map<String, dynamic> reply = {'success': true};
  @override
  void emitWithAck(String event, dynamic data, {Function? ack, bool binary = false}) {
    sent.add({'event': event, 'data': data});
    ack?.call(reply);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final call = CallService();
  final native = <MethodCall>[];
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late ControlledSocket socket;
  Completer<void>? offerReady;
  Completer<void>? offerEntered;
  bool stopFails = false;
  const track = {'id': 'mic', 'label': 'Microphone', 'kind': 'audio', 'enabled': true};
  const channels = ['FlutterWebRTC.Method', 'FlutterWebRTC/peerConnectionEventpc',
    'FlutterWebRTC/Texture1', 'FlutterWebRTC.Event'];

  Future<void> start() => http.runWithClient(
    () => call.startCall('provider', 'Customer'),
    () => MockClient((request) async => http.Response('{"iceServers":[],"relayConfigured":false}', 200)),
  );

  setUp(() async {
    native.clear(); offerReady = null; offerEntered = null; stopFails = false;
    WebRTC.initialized = false;
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    for (final channel in channels) {
      messenger.setMockMethodCallHandler(MethodChannel(channel), (method) async => null);
    }
    messenger.setMockMethodCallHandler(const MethodChannel('FlutterWebRTC.Method'), (method) async {
      native.add(method);
      switch (method.method) {
        case 'createPeerConnection': return {'peerConnectionId': 'pc'};
        case 'createVideoRenderer': return {'textureId': 1};
        case 'getUserMedia': return {'streamId': 'stream', 'audioTracks': [track], 'videoTracks': []};
        case 'addTrack': return {'senderId': 'sender', 'track': track, 'ownsTrack': false,
          'rtpParameters': {'encodings': [], 'headerExtensions': [], 'codecs': [],
            'rtcp': {'cname': 'test', 'reducedSize': true}}};
        case 'createOffer':
          offerEntered?.complete();
          if (offerReady != null) await offerReady!.future;
          return {'sdp': 'test-offer', 'type': 'offer'};
        case 'trackDispose':
          if (stopFails) throw PlatformException(code: 'stop-failed');
      }
      return null;
    });
    socket = ControlledSocket();
    SocketService().socket = socket;
    await call.endCall(notifyPeer: false);
    await call.init('CUSTOMER');
    native.clear();
  });
  tearDown(() async {
    await call.endCall(notifyPeer: false);
    socket.connected = false; socket.dispose();
    SocketService().socket = null;
    for (final channel in channels) {
      messenger.setMockMethodCallHandler(MethodChannel(channel), null);
    }
    WebRTC.initialized = false;
    debugDefaultTargetPlatformOverride = null;
  });

  test('busy acknowledgement shows the exact message and releases audio resources', () async {
    socket.reply = {'success': false, 'code': 'TARGET_BUSY', 'message': 'Provider is busy—try again'};
    await start();
    expect(call.phase, CallPhase.failed);
    expect(call.message, 'Provider is busy—try again');
    expect(call.renderer, isNull);
    expect(native.map((m) => m.method), containsAll([
      'trackDispose', 'streamDispose', 'peerConnectionClose', 'peerConnectionDispose',
      'videoRendererDispose', 'clearAndroidCommunicationDevice']));
    socket.reply = {'success': true};
    await start();
    expect(call.phase, CallPhase.connecting);
    expect(socket.sent.where((m) => m['event'] == 'call_offer').length, 2);
  });

  test('hangup during offer creation cannot emit an offer for an ended call', () async {
    offerReady = Completer<void>(); offerEntered = Completer<void>();
    final pending = start();
    await offerEntered!.future;
    await call.endCall();
    offerReady!.complete();
    await pending;
    expect(call.phase, CallPhase.idle);
    expect(socket.sent.where((m) => m['event'] == 'call_offer'), isEmpty);
    expect(native.where((m) => m.method == 'peerConnectionDispose').length, 1);
  });

  test('another incoming call is rejected without replacing the current call', () async {
    await start();
    final current = socket.sent.firstWhere((m) => m['event'] == 'call_offer')['data']['callId'];
    socket.emitEvent(['incoming_call', {'callId': 'other-call', 'callerId': 'other-user'}]);
    expect(call.phase, CallPhase.connecting);
    expect(socket.sent.last, {'event': 'end_call', 'data': {
      'callId': 'other-call', 'targetId': 'other-user', 'reason': 'busy'}});
    await call.endCall();
    expect(socket.sent.last['data']['callId'], current);
  });

  test('repeated hangup disposes the peer only once and resets controls', () async {
    await start();
    call.phase = CallPhase.connected;
    await call.toggleSpeaker();
    call.toggleMute();
    expect(call.speakerEnabled, true);
    expect(call.muted, true);
    await Future.wait([call.endCall(), call.endCall()]);
    expect(call.phase, CallPhase.idle);
    expect(call.speakerEnabled, false);
    expect(call.muted, false);
    expect(native.where((m) => m.method == 'peerConnectionDispose').length, 1);
  });

  test('a failing microphone stop still closes the peer, renderer and routing', () async {
    await start(); stopFails = true;
    await call.endCall();
    expect(native.map((m) => m.method), containsAll([
      'peerConnectionClose', 'peerConnectionDispose', 'videoRendererDispose',
      'clearAndroidCommunicationDevice']));
    expect(call.phase, CallPhase.idle);
  });
}
