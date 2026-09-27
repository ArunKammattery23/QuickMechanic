import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/main.dart';
import '../lib/screens/login_screen.dart';

void main() {
  testWidgets('App starts at login with no active call overlay', (tester) async {
    await tester.pumpWidget(const QuickMechanicApp());
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('SERVICE PROVIDER APP'), findsOneWidget);
    expect(find.text('End call'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
