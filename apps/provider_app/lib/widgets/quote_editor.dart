import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class QuoteEditor extends StatefulWidget {
  final String token, jobId;
  final double distance;
  final VoidCallback onSent;
  const QuoteEditor(
      {super.key,
      required this.token,
      required this.jobId,
      this.distance = 0,
      required this.onSent});
  @override
  State<QuoteEditor> createState() => _QuoteEditorState();
}

class _QuoteEditorState extends State<QuoteEditor> {
  Map<String, dynamic>? quote;
  String? error;
  bool busy = false;
  Map<String, String> get headers => {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json'
      };
  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final r = await http
          .post(
              Uri.parse(
                  '${ApiConfig.baseUrl}/dispatch/job/${widget.jobId}/prepare-quote'),
              headers: headers,
              body: '{}')
          .timeout(const Duration(seconds: 20));
      final data = jsonDecode(r.body);
      if (r.statusCode >= 400)
        throw Exception(data['message'] ?? 'Unable to calculate charges');
      if (mounted) setState(() => quote = data);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _send() async {
    if (busy || quote == null) return;
    setState(() => busy = true);
    try {
      final r = await http
          .post(
              Uri.parse(
                  '${ApiConfig.baseUrl}/dispatch/job/${widget.jobId}/send-quote'),
              headers: headers,
              body: '{}')
          .timeout(const Duration(seconds: 20));
      final data = jsonDecode(r.body);
      if (r.statusCode >= 400 || data['success'] != true)
        throw Exception(data['message'] ?? 'Unable to send quotation');
      if (mounted) widget.onSent();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String money(dynamic v) =>
      '₹${(double.tryParse('$v') ?? 0).toStringAsFixed(2)}';
  @override
  Widget build(BuildContext context) => AlertDialog(
          title: const Text('Review job amounts'),
          content: SingleChildScrollView(
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                if (busy) const LinearProgressIndicator(),
                if (error != null)
                  Text(error!, style: const TextStyle(color: Colors.red)),
                if (quote != null) ...[
                  if (quote!['paymentMode'] != 'live')
                    const Text('TEST MODE — no real money',
                        style: TextStyle(color: Colors.orange)),
                  Text('${quote!['serviceType']}',
                      style: Theme.of(context).textTheme.titleMedium),
                  Text(
                      'Saved service amount: ${money(quote!['serviceCharge'])}'),
                  Text(
                      'Road distance: ${(((quote!['routeDistanceMeters'] as num?) ?? 0) / 1000).toStringAsFixed(3)} km'),
                  Text(
                      'Calculated travel: ${money(quote!['travelingCharge'])}'),
                  const Divider(),
                  Text('Quotation: ${money(quote!['quotationAmount'])}'),
                  Text(
                      'Commission (${(((quote!['commissionBps'] as num?) ?? 0) / 100).toStringAsFixed(2)}%): −${money(quote!['commission'])}'),
                  Text('You receive: ${money(quote!['providerNet'])}',
                      style: Theme.of(context).textTheme.titleMedium),
                  Text(
                      'Customer platform fee: ${money(quote!['platformFee'])}'),
                  Text('Customer total: ${money(quote!['totalAmount'])}'),
                  const SizedBox(height: 10),
                  const Text(
                      'Saved service price and admin travel tariff are applied automatically.'),
                ]
              ])),
          actions: [
            TextButton(
                onPressed: busy ? null : () => Navigator.pop(context),
                child: const Text('Later')),
            if (error != null)
              TextButton(
                  onPressed: busy ? null : _prepare,
                  child: const Text('Retry')),
            FilledButton(
                onPressed: busy || quote == null ? null : _send,
                child: const Text('Send quotation'))
          ]);
}
