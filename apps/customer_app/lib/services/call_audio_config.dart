import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

/// Voice-call audio setup, applied before peer creation or microphone capture.
class CallAudio {
  static bool get _isMobile =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  static Future<void> configure() async {
    if (!_isMobile) return;

    final isAndroid = defaultTargetPlatform == TargetPlatform.android;
    final androidConfig = AndroidAudioConfiguration.communication.toMap();
    // Initialize before any other WebRTC API so the audio device uses speech
    // attributes from the start. Leave hardware/software AEC selection native.
    await WebRTC.initialize(options: {
      'bypassVoiceProcessing': false,
      if (isAndroid) 'androidAudioConfiguration': androidConfig,
    });

    // Use the platform selected above consistently, including on host tests.
    // These are the same configuration contracts used by the plugin helpers.
    if (isAndroid) {
      await WebRTC.invokeMethod('setAndroidAudioConfiguration', {
        'configuration': androidConfig,
      });
    } else {
      final appleConfig = AppleAudioConfiguration(
        appleAudioCategory: AppleAudioCategory.playAndRecord,
        appleAudioCategoryOptions: {AppleAudioCategoryOption.allowBluetooth},
        appleAudioMode: AppleAudioMode.voiceChat,
      );
      await WebRTC.invokeMethod('setAppleAudioConfiguration', {
        'configuration': appleConfig.toMap(),
      });
    }

    // The Android plugin defaults to speakerphone. Disabling it keeps headset
    // preference and uses the earpiece when no headset is connected.
    await setSpeakerEnabled(false);
  }

  static Future<void> setSpeakerEnabled(bool enabled) async {
    if (_isMobile) await Helper.setSpeakerphoneOn(enabled);
  }

  /// Call only after the old microphone and peer connection have been closed.
  static Future<void> reset() async {
    if (!kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android &&
        WebRTC.initialized) {
      await Helper.clearAndroidCommunicationDevice();
    }
    // The iOS plugin deactivates its audio session when the last peer/track is
    // disposed; the next call reapplies voiceChat and clears speaker override.
  }
}
