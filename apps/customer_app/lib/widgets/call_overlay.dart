import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../services/call_service.dart';

class CallOverlay extends StatelessWidget {
  final Widget child;
  const CallOverlay({super.key, required this.child});
  @override
  Widget build(BuildContext context) {
    final call = CallService();
    return AnimatedBuilder(
        animation: call,
        builder: (context, _) => Stack(children: [
              child,
              if (call.phase != CallPhase.idle) ...[
                const Positioned.fill(
                    child: ModalBarrier(
                        dismissible: false, color: Colors.black54)),
                Align(
                    alignment: Alignment.bottomCenter,
                    child: SafeArea(
                        child: Material(
                      color: const Color(0xFF001220),
                      borderRadius: BorderRadius.circular(20),
                      child: Padding(
                          padding: const EdgeInsets.all(24),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            Text(call.peerName,
                                style: const TextStyle(
                                    color: Colors.white, fontSize: 22)),
                            const SizedBox(height: 12),
                            Text(call.message,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Colors.white70)),
                            if (call.renderer != null)
                              SizedBox(
                                  width: 1,
                                  height: 1,
                                  child: RTCVideoView(call.renderer!)),
                            const SizedBox(height: 20),
                            Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceEvenly,
                                children: [
                                  if (call.phase == CallPhase.ringing)
                                    FilledButton(
                                        onPressed: call.acceptCall,
                                        child: const Text('Answer')),
                                  if (call.phase == CallPhase.connected)
                                    Semantics(
                                      button: true,
                                      label: call.speakerEnabled
                                          ? 'Turn speaker off'
                                          : 'Turn speaker on',
                                      child: IconButton(
                                        onPressed: call.audioRouteChanging
                                            ? null
                                            : call.toggleSpeaker,
                                        icon: Icon(
                                          call.speakerEnabled
                                              ? Icons.volume_up
                                              : Icons.phone_in_talk,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  if (call.phase == CallPhase.connected)
                                    Semantics(
                                        label: call.muted ? 'Unmute' : 'Mute',
                                        button: true,
                                        child: IconButton(
                                            onPressed: call.toggleMute,
                                            icon: Icon(
                                                call.muted
                                                    ? Icons.mic_off
                                                    : Icons.mic,
                                                color: Colors.white))),
                                  FilledButton(
                                    style: FilledButton.styleFrom(
                                        backgroundColor: Colors.red),
                                    onPressed: () => call.endCall(),
                                    child: Text(call.phase == CallPhase.failed
                                        ? 'Dismiss'
                                        : call.phase == CallPhase.ringing
                                            ? 'Decline'
                                            : 'End call'),
                                  ),
                                ]),
                          ])),
                    ))),
              ],
            ]));
  }
}
