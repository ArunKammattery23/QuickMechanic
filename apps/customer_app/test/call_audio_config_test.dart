import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../lib/services/call_audio_config.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('FlutterWebRTC.Method');
  final calls = <MethodCall>[];
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  setUp(() {
    calls.clear();
    WebRTC.initialized = false;
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return null;
    });
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(channel, null);
    WebRTC.initialized = false;
    debugDefaultTargetPlatformOverride = null;
  });

  test('Android initializes speech audio before setting the earpiece route',
      () async {
    await CallAudio.configure();

    expect(calls.map((call) => call.method), [
      'initialize',
      'setAndroidAudioConfiguration',
      'enableSpeakerphone',
    ]);
    final options = calls.first.arguments['options'] as Map;
    expect(options['bypassVoiceProcessing'], false);
    expect(options, isNot(contains('androidUseHardwareAudioProcessing')));
    final configuration = options['androidAudioConfiguration'];
    expect(configuration, {
      'manageAudioFocus': true,
      'androidAudioMode': 'inCommunication',
      'androidAudioFocusMode': 'gain',
      'androidAudioStreamType': 'voiceCall',
      'androidAudioAttributesUsageType': 'voiceCommunication',
      'androidAudioAttributesContentType': 'speech',
    });
    expect(calls[1].arguments, {'configuration': configuration});
    expect(calls.last.arguments, {'enable': false});
  });

  test('iOS requests voiceChat and Bluetooth without a speaker default',
      () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    await CallAudio.configure();

    expect(calls.map((call) => call.method), [
      'initialize',
      'setAppleAudioConfiguration',
      'enableSpeakerphone',
    ]);
    expect(calls.first.arguments, {
      'options': {'bypassVoiceProcessing': false},
    });
    expect(calls[1].arguments, {
      'configuration': {
        'appleAudioCategory': 'playAndRecord',
        'appleAudioCategoryOptions': ['allowBluetooth'],
        'appleAudioMode': 'voiceChat',
      },
    });
    expect(calls.last.arguments, {'enable': false});
  });

  test('every call restores the route after the preceding speaker call',
      () async {
    await CallAudio.configure();
    await CallAudio.setSpeakerEnabled(true);
    calls.clear();
    await CallAudio.configure();

    expect(calls.map((call) => call.method), [
      'setAndroidAudioConfiguration',
      'enableSpeakerphone',
    ]);
    expect(calls.last.arguments, {'enable': false});
  });

  test('speaker changes pass the selected route to the plugin', () async {
    await CallAudio.configure();
    calls.clear();
    await CallAudio.setSpeakerEnabled(true);
    await CallAudio.setSpeakerEnabled(false);
    expect(calls.map((call) => call.method), [
      'enableSpeakerphone',
      'enableSpeakerphone',
    ]);
    expect(calls.map((call) => call.arguments), [
      {'enable': true},
      {'enable': false},
    ]);
  });

  test('setup awaits configuration before selecting the route', () async {
    final ready = Completer<void>();
    final entered = Completer<void>();
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (call.method == 'setAndroidAudioConfiguration') {
        entered.complete();
        await ready.future;
      }
      return null;
    });
    final setup = CallAudio.configure();
    await entered.future;
    expect(calls.any((call) => call.method == 'enableSpeakerphone'), false);
    ready.complete();
    await setup;
    expect(calls.last.method, 'enableSpeakerphone');
  });

  test('setup failure propagates instead of silently using loudspeaker',
      () async {
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (call.method == 'setAndroidAudioConfiguration') {
        throw PlatformException(code: 'audio-configuration-failed');
      }
      return null;
    });
    await expectLater(CallAudio.configure(), throwsA(isA<PlatformException>()));
    expect(calls.any((call) => call.method == 'enableSpeakerphone'), false);
  });

  test('Android reset clears routing without initializing an unused plugin',
      () async {
    await CallAudio.reset();
    expect(calls, isEmpty);
    await CallAudio.configure();
    calls.clear();
    await CallAudio.reset();
    expect(
        calls.map((call) => call.method), ['clearAndroidCommunicationDevice']);
  });

  test('iOS reset leaves session release to peer/track disposal', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    await CallAudio.configure();
    calls.clear();
    await CallAudio.reset();
    expect(calls, isEmpty);
  });

  test('desktop does not call unsupported mobile routing APIs', () async {
    for (final platform in [
      TargetPlatform.windows,
      TargetPlatform.linux,
      TargetPlatform.macOS,
    ]) {
      debugDefaultTargetPlatformOverride = platform;
      await CallAudio.configure();
      await CallAudio.setSpeakerEnabled(true);
      await CallAudio.reset();
    }
    expect(calls, isEmpty);
    expect(WebRTC.initialized, false);
  });
}
