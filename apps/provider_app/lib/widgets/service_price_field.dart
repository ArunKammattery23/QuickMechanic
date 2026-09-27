import 'package:flutter/material.dart';

class ServicePriceField extends StatelessWidget {
  final TextEditingController controller;
  final int commissionBps, platformFeeMinor;
  const ServicePriceField(
      {super.key,
      required this.controller,
      required this.commissionBps,
      required this.platformFeeMinor});
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<
          TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final valid = RegExp(r'^\d{1,8}(\.\d{1,2})?$').hasMatch(value.text);
        final parts = value.text.split('.');
        final amount = valid
            ? int.parse(parts[0]) * 100 +
                int.parse(parts.length == 1 ? '0' : parts[1].padRight(2, '0'))
            : 0;
        final commission = (amount * commissionBps + 5000) ~/ 10000;
        String money(int n) => '₹${(n / 100).toStringAsFixed(2)}';
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(
              controller: controller,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                  labelText: 'Quotation amount (₹)',
                  labelStyle: const TextStyle(color: Colors.white70),
                  errorText: value.text.isNotEmpty && !valid
                      ? 'Enter a valid amount (up to 2 decimals)'
                      : null)),
          const SizedBox(height: 8),
          Text('Commission: ${(commissionBps / 100).toStringAsFixed(2)}%',
              style: const TextStyle(color: Colors.white70)),
          if (valid) ...[
            Text('${money(amount)} − ${money(commission)} commission',
                style: const TextStyle(color: Colors.white70)),
            Text('You receive: ${money(amount - commission)}',
                style: const TextStyle(
                    color: Colors.greenAccent, fontWeight: FontWeight.bold)),
            Text(
                'Customer pays: ${money(amount + platformFeeMinor)} (includes ${money(platformFeeMinor)} platform fee)',
                style: const TextStyle(color: Colors.white70)),
          ],
        ]);
      });
}
