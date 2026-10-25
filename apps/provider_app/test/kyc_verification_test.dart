import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/screens/kyc_verification_screen.dart';

void main() {
  testWidgets('KYC form requires both ID photos before submitting', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1080, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: KycVerificationScreen(token: 'test-token')));
      await tester.pumpAndSettle();
      expect(find.text('Front side'), findsOneWidget);
      expect(find.text('Back side'), findsOneWidget);
      expect(find.text('Tap to add photo'), findsNWidgets(2));
      await tester.enterText(find.widgetWithText(TextFormField, 'Full address'), '12 Test Street, Bengaluru, Karnataka');
      await tester.enterText(find.widgetWithText(TextFormField, 'Secondary mobile number'), '9876543210');
      await tester.ensureVisible(find.text('Submit for verification'));
      await tester.tap(find.text('Submit for verification'));
      await tester.pump();
      expect(find.text('Add both front and back ID card photos.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }, () => MockClient((request) async => http.Response(jsonEncode({'submitted': false, 'status': 'PENDING'}), 200)));
  });

  testWidgets('submitted KYC reopens as awaiting review without upload controls', (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: KycVerificationScreen(token: 'test-token')));
      await tester.pumpAndSettle();
      expect(find.text('Under review'), findsOneWidget);
      expect(find.text('Front and back photos received'), findsOneWidget);
      expect(find.text('Tap to add photo'), findsNothing);
      expect(find.text('Submit for verification'), findsNothing);
    }, () => MockClient((request) async => http.Response(jsonEncode({
      'submitted': true, 'status': 'PENDING', 'idType': 'AADHAAR',
      'address': '12 Test Street, Bengaluru, Karnataka',
      'secondaryPhone': '9876543210',
    }), 200)));
  });
}
