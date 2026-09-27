import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../lib/services/call_service.dart';
import '../lib/services/socket_service.dart';
import '../lib/services/ice_candidate_buffer.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('buffers early ICE and preserves serial application order', () async {
    final queue = IceCandidateBuffer<int>();
    final applied = <int>[];
    queue.add(1);
    queue.add(2);
    expect(applied, isEmpty);
    final first = Completer<void>();
    Future<void> apply(int value) async {
      applied.add(value);
      if (value == 1) await first.future;
    }

    final drain = queue.drain(apply);
    queue.add(3);
    final concurrentDrain = queue.drain(apply);
    expect(applied, [1]);
    first.complete();
    await Future.wait([drain, concurrentDrain]);
    expect(applied, [1, 2, 3]);
  });
  test('ending a call discards queued ICE before the next call', () async {
    final queue = IceCandidateBuffer<int>();
    queue.add(1);
    queue.clear();
    queue.add(2);
    final applied = <int>[];
    await queue.drain((value) async => applied.add(value));
    expect(applied, [2]);
  });
  test(
      'incoming call can be declined before answering and ignores unrelated hangups',
      () async {
    final socket = io.io('http://localhost:1',
        <String, dynamic>{'autoConnect': false, 'forceNew': true});
    SocketService().socket = socket;
    final call = CallService();
    await call.init('CUSTOMER');
    socket.emitEvent([
      'incoming_call',
      {
        'callId': 'test-call',
        'callerId': 'mechanic',
        'callerName': 'Mechanic',
        'offer': {'sdp': 'test', 'type': 'offer'}
      }
    ]);
    expect(call.phase, CallPhase.ringing);
    socket.emitEvent([
      'call_ended',
      {'callId': 'other-call', 'callerId': 'mechanic'}
    ]);
    expect(call.phase, CallPhase.ringing);
    await call.endCall();
    expect(call.phase, CallPhase.idle);
    expect(socket.sendBuffer.last['data'], [
      'end_call',
      {'targetId': 'mechanic', 'callId': 'test-call'}
    ]);
    socket.dispose();
    SocketService().socket = null;
  });
}
