import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/widgets/quote_editor.dart';

void main() {
  testWidgets('provider reviews server-calculated charges and sends without overriding prices', (tester) async {
    Map<String,dynamic>? submitted;
    var sent=false;
    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: QuoteEditor(token:'test',jobId:'job',distance:1,onSent:()=>sent=true))));
      await tester.pumpAndSettle();
      expect(find.text('Commission (15.00%): −₹150.00'), findsOneWidget);
      expect(find.text('Saved service amount: ₹950.00'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Customer total: ₹1002.00'), findsOneWidget);
      expect(find.text('You receive: ₹850.00'), findsOneWidget);
      await tester.ensureVisible(find.text('Send quotation'));
      await tester.tap(find.text('Send quotation'));
      await tester.pumpAndSettle();
      expect(sent,isTrue);
      expect(submitted,isEmpty);
    },()=>MockClient((request) async {
      if(request.url.path.endsWith('/prepare-quote'))return http.Response(jsonEncode({
        'pricingRevision':7,'commissionBps':1500,'platformFee':'2','paymentMode':'simulation',
        'serviceType':'Repair','serviceCharge':950,'travelingCharge':50,'routeDistanceMeters':2000,
        'quotationAmount':'1000','totalAmount':1002,'commission':'150','providerNet':'850',
      }),201);
      expect(request.url.path.endsWith('/send-quote'),isTrue);
      submitted=jsonDecode(request.body);
      return http.Response('{"success":true}',201);
    }));
  });
  testWidgets('route failure disables sending and can be retried', (tester) async {
    var attempts=0;
    await http.runWithClient(() async {
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: QuoteEditor(token:'test',jobId:'job',onSent:(){}))));
      await tester.pumpAndSettle();
      expect(find.textContaining('Route unavailable'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,isNull);
      await tester.tap(find.text('Retry'));await tester.pumpAndSettle();
      expect(attempts,2);
    },()=>MockClient((request) async {attempts++;return http.Response('{"message":"Route unavailable"}',503);}));
  });
}
