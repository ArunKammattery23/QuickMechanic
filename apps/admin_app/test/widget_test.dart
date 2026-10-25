import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:quickmechanic_admin/main.dart';

void main() {
  testWidgets('admin app starts with dedicated sign-in and no preset credentials', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const QuickMechanicAdmin());
    // The saved-session check runs first, then the sign-in form appears.
    await tester.pumpAndSettle();
    expect(find.text('QuickMechanic'), findsOneWidget);
    expect(find.text('ADMIN CONSOLE'), findsOneWidget);
    expect(find.text('Sign in securely'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text('Authorized administrators only'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Admin'), findsNothing);
  });

  testWidgets('remembers the last username but never the password', (tester) async {
    SharedPreferences.setMockInitialValues({'admin_last_user': 'Admin'});
    await tester.pumpWidget(const QuickMechanicAdmin());
    await tester.pumpAndSettle();
    final fields = tester.widgetList<TextField>(find.byType(TextField)).toList();
    expect(fields[0].controller!.text, 'Admin');
    expect(fields[1].controller!.text, isEmpty);
  });

  testWidgets('an expired saved session falls back to sign-in', (tester) async {
    // Header and payload of a token whose exp is in 2001.
    const expired = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEwMDAwMDAwMDB9.sig';
    SharedPreferences.setMockInitialValues({'admin_jwt': expired, 'admin_role': 'SUPER_ADMIN'});
    await tester.pumpWidget(const QuickMechanicAdmin());
    await tester.pumpAndSettle();
    expect(find.text('Sign in securely'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('admin_jwt'), isNull);
  });
}
