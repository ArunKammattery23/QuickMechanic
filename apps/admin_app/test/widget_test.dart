import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quickmechanic_admin/main.dart';

void main() {
  testWidgets('admin app starts with dedicated sign-in and no preset credentials', (tester) async {
    await tester.pumpWidget(const QuickMechanicAdmin());
    expect(find.text('QuickMechanic'), findsOneWidget);
    expect(find.text('ADMIN CONSOLE'), findsOneWidget);
    expect(find.text('Sign in securely'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text('Authorized administrators only'), findsOneWidget);
  });
}
