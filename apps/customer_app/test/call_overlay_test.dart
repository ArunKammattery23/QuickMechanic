import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/services/call_service.dart';
import '../lib/widgets/call_overlay.dart';

void main() {
  testWidgets('connected call controls render without a Navigator overlay',
      (tester) async {
    final call = CallService();
    call.phase = CallPhase.connected;
    call.peerName = 'Provider';
    call.message = 'Connected';
    try {
      await tester.pumpWidget(MaterialApp(
        builder: (context, child) => CallOverlay(child: child!),
        home: const Scaffold(body: Text('Job')),
      ));
      expect(find.text('Connected'), findsOneWidget);
      expect(find.byIcon(Icons.mic), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      call.phase = CallPhase.idle;
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });
}
