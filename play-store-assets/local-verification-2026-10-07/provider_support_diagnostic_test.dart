import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider_app/screens/support_screen.dart';

void main() {
  testWidgets('shows saved ticket status and guide answer', (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: SupportScreen(token: 'test-token')));
      await tester.pumpAndSettle();
      expect(find.text('WAITING FOR USER'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Ask a question'), 'How do I check my job?');
      await tester.tap(find.text('Ask guide'));
      await tester.pumpAndSettle();
      expect(find.text('QUICK GUIDE'), findsOneWidget);
      expect(find.textContaining('Check the active job screen for its latest status.'), findsOneWidget);
    }, () => MockClient((request) async {
      if (request.url.path == '/support/bot') {
        return http.Response(jsonEncode({'answer': 'Check the active job.'}), 201);
      }
      return http.Response(jsonEncode([{
        'id': '12345678-1234-4234-8234-123456789abc', 'subject': 'Payment question',
        'category': 'PAYMENT', 'status': 'WAITING_FOR_USER',
      }]), 200);
    }));
  });

  testWidgets('failed ticket submission keeps the draft open', (tester) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: SupportScreen(token: 'test-token')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Raise a support ticket'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Subject'), 'Missing payment');
      await tester.enterText(find.widgetWithText(TextField, 'Describe the issue'), 'The wallet did not update');
      await tester.ensureVisible(find.text('Submit ticket'));
      await tester.tap(find.text('Submit ticket'));
      await tester.pumpAndSettle();
      expect(find.text('Missing payment'), findsOneWidget);
      expect(find.textContaining('Please retry'), findsOneWidget);
      expect(find.text('Submit ticket'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }, () => MockClient((request) async => request.method == 'POST'
      ? http.Response(jsonEncode({'message': 'Please retry'}), 500)
      : http.Response('[]', 200)));
  });

  testWidgets('successful ticket submission opens its status and conversation', (tester) async {
    const id = '12345678-1234-4234-8234-123456789abc';
    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: SupportScreen(token: 'test-token')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Raise a support ticket'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Subject'), 'Route problem');
      await tester.enterText(find.widgetWithText(TextField, 'Describe the issue'), 'The route does not update');
      await tester.ensureVisible(find.text('Submit ticket'));
      await tester.tap(find.text('Submit ticket'));
      await tester.pumpAndSettle();
      expect(find.text('Support conversation'), findsOneWidget);
      expect(find.text('Route problem'), findsOneWidget);
      expect(find.text('OPEN'), findsOneWidget);
      expect(find.text('The route does not update'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }, () => MockClient((request) async {
      if (request.method == 'POST') return http.Response(jsonEncode({'id': id}), 201);
      if (request.url.path.endsWith('/tickets/$id')) return http.Response(jsonEncode({
        'ticket': {'id': id, 'subject': 'Route problem', 'category': 'JOB', 'status': 'OPEN'},
        'messages': [{'senderRole': 'CUSTOMER', 'body': 'The route does not update'}],
      }), 200);
      return http.Response('[]', 200);
    }));
  });
}

