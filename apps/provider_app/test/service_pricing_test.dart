import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/widgets/service_price_field.dart';
import '../lib/widgets/service_selector.dart';

void main() {
  testWidgets(
      'provider can select multiple services and deselect independently',
      (tester) async {
    final selected = <String>[];
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: StatefulBuilder(
                builder: (context, setState) => ServiceSelector(
                      services: const [
                        {'id': 'tyre', 'name': 'Tyre repair'},
                        {'id': 'battery', 'name': 'Battery service'}
                      ],
                      selected: selected,
                      onChanged: (id, value) => setState(() {
                        if (value)
                          selected.add(id);
                        else
                          selected.remove(id);
                      }),
                    )))));
    await tester.tap(find.text('Tyre repair'));
    await tester.pump();
    await tester.tap(find.text('Battery service'));
    await tester.pump();
    expect(selected, ['tyre', 'battery']);
    expect(find.textContaining('2 services selected'), findsOneWidget);
    await tester.tap(find.text('Tyre repair'));
    await tester.pump();
    expect(selected, ['battery']);
  });
  testWidgets(
      'typing quotation shows commission deducted and separate customer fee',
      (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: ServicePriceField(
                controller: controller,
                commissionBps: 1500,
                platformFeeMinor: 200))));
    await tester.enterText(find.byType(TextField), '1000');
    await tester.pump();
    expect(find.text('₹1000.00 − ₹150.00 commission'), findsOneWidget);
    expect(find.text('You receive: ₹850.00'), findsOneWidget);
    expect(find.text('Customer pays: ₹1002.00 (includes ₹2.00 platform fee)'),
        findsOneWidget);
    await tester.enterText(find.byType(TextField), '2000');
    await tester.pump();
    expect(find.text('You receive: ₹1700.00'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
}
