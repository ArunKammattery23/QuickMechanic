import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/screens/wallet_history_screen.dart';

void main() {
  testWidgets(
      'wallet shows server balance, withdrawal count and linked job history',
      (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(
          home: WalletHistoryScreen(token: 'test-token', provider: true)));
      await tester.pumpAndSettle();
      expect(find.text('Available: INR 125.50'), findsOneWidget);
      expect(find.text('3 of 5 withdrawals remaining this week (India time)'),
          findsOneWidget);
      expect(find.textContaining('job-123'), findsOneWidget);
    },
        () => MockClient((request) async => http.Response(
            jsonEncode(request.url.path.endsWith('/history')
                ? {
                    'balance': '125.50',
                    'withdrawalsRemaining': 3,
                    'jobs': [
                      {
                        'id': 'job-123',
                        'serviceType': 'Tyre repair',
                        'totalAmount': '125.50',
                        'status': 'COMPLETED',
                        'createdAt': '2026-09-12'
                      }
                    ],
                    'nextCursor': null
                  }
                : {'transactions': [], 'nextCursor': null}),
            200)));
  });
  testWidgets('only customer sees approval that releases held funds',
      (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(
          home: JobHistoryDetailScreen(
              token: 'test-token', jobId: 'job-123', provider: false)));
      await tester.pumpAndSettle();
      expect(
          find.text('Confirm completed work & release funds'), findsOneWidget);
      expect(
          find.text('Work finished — request customer approval'), findsNothing);
      await tester.tap(find.text('Confirm completed work & release funds'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Confirm only when the service is complete'),
          findsOneWidget);
    },
        () => MockClient((request) async => http.Response(
            jsonEncode({
              'job': {
                'status': 'AWAITING_CUSTOMER_CONFIRMATION',
                'serviceType': 'Repair',
                'totalAmount': '125.50',
                'travelingCharge': '25.50',
                'serviceCharge': '100.00'
              },
              'events': [],
              'payments': []
            }),
            200)));
  });
  testWidgets('provider cancellation closes the reason dialog safely',
      (tester) async {
    String? submittedReason;
    var cancelled = false;
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(
          home: JobHistoryDetailScreen(
              token: 'test-token', jobId: 'job-123', provider: true)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel job & refund held payment'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Provider emergency');
      await tester.tap(find.text('Confirm'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(submittedReason, 'Provider emergency');
      expect(cancelled, isTrue);
    },
        () => MockClient((request) async {
              if (request.method == 'POST' &&
                  request.url.path.endsWith('/cancel')) {
                submittedReason = jsonDecode(request.body)['reason'] as String;
                cancelled = true;
                return http.Response(
                    jsonEncode({'message': 'Job cancelled'}), 200);
              }
              return http.Response(
                  jsonEncode({
                    'job': {
                      'status': cancelled ? 'CANCELLED' : 'PAYMENT_SECURED',
                      'serviceType': 'Repair',
                      'totalAmount': '125.50',
                      'travelingCharge': '25.50',
                      'serviceCharge': '100.00'
                    },
                    'events': [],
                    'payments': []
                  }),
                  200);
            }));
  });
}
