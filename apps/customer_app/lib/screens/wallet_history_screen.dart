import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

const _ink = Color(0xFF071C2D);
const _teal = Color(0xFF00BFA5);
String _readable(String value) => value
    .replaceAll('_', ' ')
    .toLowerCase()
    .split(' ')
    .map((word) =>
        word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}')
    .join(' ');
String _date(dynamic value) {
  final parsed = DateTime.tryParse('$value')?.toLocal();
  if (parsed == null) return 'Date unavailable';
  final day = parsed.day.toString().padLeft(2, '0');
  final month = parsed.month.toString().padLeft(2, '0');
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  return '$day/$month/${parsed.year}  $hour:$minute';
}

Color _statusColor(String status) {
  if (status == 'COMPLETED') return const Color(0xFF0F8D69);
  if (status == 'CANCELLED') return const Color(0xFFC34A5B);
  if (status == 'REQUESTED' || status == 'AWAITING_PAYMENT')
    return const Color(0xFFD2922A);
  return const Color(0xFF1675AF);
}

Widget _sectionTitle(String text, IconData icon) => Padding(
      padding: const EdgeInsets.fromLTRB(2, 26, 2, 12),
      child: Row(children: [
        Icon(icon, size: 20, color: _ink),
        const SizedBox(width: 9),
        Text(text,
            style: const TextStyle(
                color: _ink, fontSize: 18, fontWeight: FontWeight.w800))
      ]),
    );
Widget _amountRow(String label, String amount, {bool strong = false}) =>
    Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Expanded(
            child: Text(label,
                style: TextStyle(
                    color: strong ? _ink : const Color(0xFF657687),
                    fontWeight: strong ? FontWeight.w800 : FontWeight.w500))),
        Text('₹$amount',
            style: TextStyle(
                color: _ink,
                fontSize: strong ? 22 : 16,
                fontWeight: strong ? FontWeight.w900 : FontWeight.w700))
      ]),
    );
Widget _panel(Widget child) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [
            BoxShadow(
                color: Color(0x1007192D), blurRadius: 22, offset: Offset(0, 9))
          ]),
      child: child,
    );

class WalletHistoryScreen extends StatefulWidget {
  final String token;
  final bool provider;
  const WalletHistoryScreen(
      {super.key, required this.token, required this.provider});
  @override
  State<WalletHistoryScreen> createState() => _WalletHistoryScreenState();
}

class _WalletHistoryScreenState extends State<WalletHistoryScreen> {
  Map<String, dynamic>? _wallet;
  final List<dynamic> _jobs = [], _transactions = [];
  String? _jobCursor, _transactionCursor, _error;
  String? _withdrawalKey;
  bool _busy = false;
  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json'
      };
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final r = await http
        .get(Uri.parse('${ApiConfig.baseUrl}/dispatch/$path'),
            headers: _headers)
        .timeout(const Duration(seconds: 15));
    if (r.statusCode != 200)
      throw Exception('Unable to load history (${r.statusCode})');
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  Future<void> _load(
      {bool moreJobs = false, bool moreTransactions = false}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (!moreTransactions) {
        final data = await _get(
            'history${moreJobs && _jobCursor != null ? '?before=$_jobCursor' : ''}');
        if (!mounted) return;
        _wallet = data;
        if (!moreJobs) _jobs.clear();
        _jobs.addAll(data['jobs']);
        _jobCursor = data['nextCursor'];
      }
      if (!moreJobs) {
        final data = await _get(
            'transactions${moreTransactions && _transactionCursor != null ? '?before=$_transactionCursor' : ''}');
        if (!mounted) return;
        if (!moreTransactions) _transactions.clear();
        _transactions.addAll(data['transactions']);
        _transactionCursor = data['nextCursor'];
      }
    } catch (e) {
      _error = '$e';
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _withdraw() async {
    final confirm = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Request withdrawal?'),
                content: Text(
                    'Reserve INR ${_wallet?['balance']} for payout? Bank processing is separate.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Back')),
                  FilledButton(
                      onPressed: () => Navigator.pop(c, true),
                      child: const Text('Request'))
                ]));
    if (confirm != true || !mounted || _busy) return;
    setState(() => _busy = true);
    _withdrawalKey ??= 'withdraw-${DateTime.now().microsecondsSinceEpoch}';
    try {
      final response = await http.post(
          Uri.parse('${ApiConfig.baseUrl}/dispatch/mechanic/withdraw'),
          headers: {
            ..._headers,
            'Idempotency-Key': _withdrawalKey!
          }).timeout(const Duration(seconds: 20));
      final data = jsonDecode(response.body);
      if (response.statusCode < 500) _withdrawalKey = null;
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('${data['message']}')));
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Response unavailable. Retry safely using the same request.')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    await _load();
  }

  Future<void> _job(String id) async {
    await Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => JobHistoryDetailScreen(
                token: widget.token, jobId: id, provider: widget.provider)));
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF3F7FA),
        appBar: AppBar(
            backgroundColor: _ink,
            foregroundColor: Colors.white,
            title: const Text('Wallet & history',
                style: TextStyle(fontWeight: FontWeight.w800)),
            actions: [
              IconButton(
                  onPressed: _busy ? null : () => _load(),
                  icon: const Icon(Icons.refresh))
            ],
            bottom: const TabBar(
                labelColor: Color(0xFF64E8CF),
                unselectedLabelColor: Colors.white70,
                indicatorColor: Color(0xFF64E8CF),
                tabs: [
                  Tab(icon: Icon(Icons.work_history_rounded), text: 'Jobs'),
                  Tab(
                      icon: Icon(Icons.receipt_long_rounded),
                      text: 'Transactions')
                ])),
        body: Column(children: [
          if (_wallet != null &&
              _wallet!['paymentMode'] != null &&
              _wallet!['paymentMode'] != 'live')
            const Padding(
                padding: EdgeInsets.all(12),
                child: Text('TEST WALLET — no real money or bank transfers',
                    style: TextStyle(
                        color: Colors.orange, fontWeight: FontWeight.bold))),
          if (_busy) const LinearProgressIndicator(),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red)),
          Container(
              margin: const EdgeInsets.fromLTRB(16, 18, 16, 10),
              decoration: BoxDecoration(
                  gradient:
                      const LinearGradient(colors: [_ink, Color(0xFF123F55)]),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x3307192D),
                        blurRadius: 18,
                        offset: Offset(0, 8))
                  ]),
              child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(children: [
                    const Row(children: [
                      Icon(Icons.account_balance_wallet_rounded,
                          color: Color(0xFF64E8CF)),
                      SizedBox(width: 9),
                      Text('AVAILABLE BALANCE',
                          style: TextStyle(
                              color: Colors.white70,
                              letterSpacing: 1.4,
                              fontWeight: FontWeight.w700))
                    ]),
                    const SizedBox(height: 11),
                    Text('Available: INR ${_wallet?['balance'] ?? '—'}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 27,
                            fontWeight: FontWeight.w900)),
                    if (widget.provider) ...[
                      const SizedBox(height: 9),
                      Text(
                          '${_wallet?['withdrawalsRemaining'] ?? '—'} of 5 withdrawals remaining this week (India time)',
                          style: const TextStyle(color: Colors.white70)),
                      const SizedBox(height: 13),
                      FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: _teal, foregroundColor: _ink),
                          onPressed: _busy ||
                                  (double.tryParse('${_wallet?['balance']}') ??
                                          0) <=
                                      0 ||
                                  _wallet?['withdrawalsRemaining'] == 0
                              ? null
                              : _withdraw,
                          child: const Text('Request withdrawal'))
                    ],
                  ]))),
          Expanded(
              child: TabBarView(children: [
            ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  _sectionTitle('Your jobs', Icons.work_outline_rounded),
                  if (_jobs.isEmpty && !_busy)
                    _panel(const Text(
                        'Your jobs will appear here after you request a service.')),
                  ..._jobs.map((j) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _panel(InkWell(
                          onTap: () => _job(j['id']),
                          child: Row(children: [
                            Container(
                                padding: const EdgeInsets.all(11),
                                decoration: BoxDecoration(
                                    color: const Color(0xFFE5F7F4),
                                    borderRadius: BorderRadius.circular(14)),
                                child: const Icon(Icons.build_circle_outlined,
                                    color: _teal)),
                            const SizedBox(width: 12),
                            Expanded(
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                  Text('${j['serviceType']}',
                                      style: const TextStyle(
                                          color: _ink,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 5),
                                  Text('Job ${j['id']}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Color(0xFF798B98),
                                          fontSize: 12)),
                                  Text(_date(j['createdAt']),
                                      style: const TextStyle(
                                          color: Color(0xFF798B98),
                                          fontSize: 12)),
                                ])),
                            Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('₹${j['totalAmount']}',
                                      style: const TextStyle(
                                          color: _ink,
                                          fontWeight: FontWeight.w900)),
                                  const SizedBox(height: 5),
                                  Text(_readable('${j['status']}'),
                                      style: TextStyle(
                                          color: _statusColor('${j['status']}'),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800)),
                                ]),
                            const Icon(Icons.chevron_right_rounded,
                                color: Color(0xFF8AA2AE)),
                          ]),
                        )),
                      )),
                  if (_jobCursor != null)
                    TextButton(
                        onPressed: _busy ? null : () => _load(moreJobs: true),
                        child: const Text('Load more jobs'))
                ]),
            ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  _sectionTitle('Money movement', Icons.swap_horiz_rounded),
                  if (_transactions.isEmpty && !_busy)
                    _panel(
                        const Text('Payments and refunds will appear here.')),
                  ..._transactions.map((t) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _panel(ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          leading: Icon(
                              t['direction'] == 'CREDIT'
                                  ? Icons.south_west_rounded
                                  : Icons.north_east_rounded,
                              color: t['direction'] == 'CREDIT'
                                  ? const Color(0xFF0F8D69)
                                  : const Color(0xFFC1762A)),
                          title: Text(
                              '${_readable('${t['kind']}')} · ₹${t['amount']}',
                              style: const TextStyle(
                                  color: _ink, fontWeight: FontWeight.w800)),
                          subtitle: Text(_date(t['createdAt'])),
                          children: [
                            ListTile(
                                title: SelectableText('Transaction ${t['id']}'),
                                subtitle: Text('${t['description']}')),
                            if (t['jobId'] != null)
                              ListTile(
                                  title: Text('Job ${t['jobId']}'),
                                  onTap: () => _job(t['jobId'])),
                            ...(t['allocations'] as List).map((a) => ListTile(
                                title: Text(a['jobId'] == null
                                    ? 'Legacy balance (no original job reference)'
                                    : 'Job ${a['jobId']}'),
                                trailing: Text('INR ${a['amount']}'),
                                onTap: a['jobId'] == null
                                    ? null
                                    : () => _job(a['jobId'])))
                          ])))),
                  if (_transactionCursor != null)
                    TextButton(
                        onPressed:
                            _busy ? null : () => _load(moreTransactions: true),
                        child: const Text('Load more transactions'))
                ]),
          ])),
        ]),
      ));
}

class JobHistoryDetailScreen extends StatefulWidget {
  final String token, jobId;
  final bool provider;
  const JobHistoryDetailScreen(
      {super.key,
      required this.token,
      required this.jobId,
      required this.provider});
  @override
  State<JobHistoryDetailScreen> createState() => _JobHistoryDetailScreenState();
}

class _JobHistoryDetailScreenState extends State<JobHistoryDetailScreen> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;
  Timer? _refreshTimer;
  bool _loading = false;
  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_busy && mounted) _load();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (_loading) return;
    _loading = true;
    try {
      final r = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/dispatch/job/${widget.jobId}'),
          headers: {
            'Authorization': 'Bearer ${widget.token}'
          }).timeout(const Duration(seconds: 15));
      if (r.statusCode != 200) throw Exception('Unable to load job');
      if (mounted)
        setState(() {
          _data = jsonDecode(r.body);
          _error = null;
        });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      _loading = false;
    }
  }

  Future<void> _act(String action) async {
    if (_busy) return;
    var reasonText = '';
    final approved = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: Text(action == 'cancel'
                    ? 'Cancel job and refund?'
                    : action == 'confirm-completion'
                        ? 'Confirm the work is complete?'
                        : action == 'confirm-payment'
                            ? 'Accept job and pay?'
                            : action == 'start'
                                ? 'Start journey?'
                                : 'Request customer approval?'),
                content: action == 'cancel'
                    ? TextField(
                        onChanged: (value) => reasonText = value,
                        maxLength: 500,
                        decoration: const InputDecoration(
                            labelText: 'Reason (traffic, emergency, etc.)'))
                    : Text(action == 'confirm-completion'
                        ? 'This releases the held amount to the provider. Confirm only when the service is complete.'
                        : action == 'confirm-payment'
                            ? 'Accept these charges and hold the payment until you confirm completion.'
                            : 'Funds stay held until the customer approves.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Back')),
                  FilledButton(
                      onPressed: () {
                        if (action != 'cancel' || reasonText.trim().isNotEmpty)
                          Navigator.pop(c, true);
                      },
                      child: const Text('Confirm'))
                ]));
    if (approved != true || !mounted) return;
    setState(() => _busy = true);
    try {
      var r = await http
          .post(
              Uri.parse(
                  '${ApiConfig.baseUrl}/dispatch/job/${widget.jobId}/$action'),
              headers: {
                'Authorization': 'Bearer ${widget.token}',
                'Content-Type': 'application/json'
              },
              body:
                  jsonEncode(action == 'cancel' ? {'reason': reasonText} : {}))
          .timeout(const Duration(seconds: 20));
      var result = jsonDecode(r.body);
      if (result['simulationRequired'] == true && mounted) {
        final outcome = await showDialog<String>(
            context: context,
            builder: (c) => AlertDialog(
                    title: const Text('Test payment — no real money'),
                    content: const Text(
                        'Choose a simulated payment result. No card, UPI or bank account is charged.'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(c, 'failed'),
                          child: const Text('Simulate failure')),
                      TextButton(
                          onPressed: () => Navigator.pop(c, 'cancelled'),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: () => Navigator.pop(c, 'success'),
                          child: const Text('Simulate success'))
                    ]));
        if (outcome == null || !mounted) return;
        r = await http
            .post(
                Uri.parse(
                    '${ApiConfig.baseUrl}/dispatch/job/${widget.jobId}/confirm-payment'),
                headers: {
                  'Authorization': 'Bearer ${widget.token}',
                  'Content-Type': 'application/json'
                },
                body: jsonEncode({'simulationResult': outcome}))
            .timeout(const Duration(seconds: 20));
        result = jsonDecode(r.body);
      }
      if (result['checkoutUrl'] != null)
        await launchUrl(Uri.parse(result['checkoutUrl']),
            mode: LaunchMode.externalApplication);
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('${result['message']}')));
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final job = _data?['job'];
    final status = job?['status'];
    return Scaffold(
        backgroundColor: const Color(0xFFF3F7FA),
        appBar: AppBar(
            backgroundColor: _ink,
            foregroundColor: Colors.white,
            title: const Text('Job details',
                style: TextStyle(fontWeight: FontWeight.w800)),
            actions: [
              IconButton(onPressed: _load, icon: const Icon(Icons.refresh))
            ]),
        body: ListView(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
            children: [
              if (_error != null)
                Text(_error!, style: const TextStyle(color: Colors.red)),
              if (job == null)
                const LinearProgressIndicator()
              else ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(23),
                  decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [_ink, Color(0xFF12485B)]),
                      borderRadius: BorderRadius.circular(24)),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('SERVICE JOB',
                            style: TextStyle(
                                color: Color(0xFF64E8CF),
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.6,
                                fontSize: 12)),
                        const SizedBox(height: 8),
                        Text('${job['serviceType']}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 25)),
                        const SizedBox(height: 16),
                        Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                                color:
                                    _statusColor('$status').withOpacity(0.20),
                                borderRadius: BorderRadius.circular(30)),
                            child: Text(_readable('$status'),
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800))),
                      ]),
                ),
                _sectionTitle('Price breakdown', Icons.receipt_long_rounded),
                _panel(Column(children: [
                  _amountRow('Service quote',
                      '${job['quotationAmount'] ?? job['totalAmount']}'),
                  _amountRow('Platform fee', '${job['platformFee'] ?? '0.00'}'),
                  const Divider(),
                  _amountRow('Customer total', '${job['totalAmount']}',
                      strong: true),
                ])),
                if (job['paymentMode'] != null && job['paymentMode'] != 'live')
                  const Text('TEST JOB — no real money',
                      style: TextStyle(color: Colors.orange)),
                if (job['confirmedAt'] != null)
                  Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text('Confirmed ${_date(job['confirmedAt'])}',
                          style: const TextStyle(color: Color(0xFF657687)))),
                if (job['cancellationReason'] != null)
                  Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _panel(Text(
                          'Cancellation reason: ${job['cancellationReason']}',
                          style: const TextStyle(color: Color(0xFFC34A5B))))),
                if (!widget.provider && status == 'AWAITING_PAYMENT')
                  FilledButton(
                      onPressed: _busy ? null : () => _act('confirm-payment'),
                      child: const Text('Accept job & pay')),
                if (!widget.provider &&
                    status == 'AWAITING_CUSTOMER_CONFIRMATION')
                  FilledButton(
                      onPressed:
                          _busy ? null : () => _act('confirm-completion'),
                      child:
                          const Text('Confirm completed work & release funds')),
                if (widget.provider && status == 'PAYMENT_SECURED')
                  FilledButton(
                      onPressed: _busy ? null : () => _act('start'),
                      child: const Text('Start journey')),
                if (widget.provider &&
                    ['PAYMENT_SECURED', 'EN_ROUTE'].contains(status))
                  FilledButton(
                      onPressed: _busy ? null : () => _act('complete'),
                      child: const Text(
                          'Work finished — request customer approval')),
                if (!['COMPLETED', 'CANCELLED'].contains(status))
                  TextButton(
                      onPressed: _busy ? null : () => _act('cancel'),
                      child: const Text('Cancel job & refund held payment')),
                _sectionTitle(
                    'Payment history', Icons.account_balance_wallet_outlined),
                if ((_data!['payments'] as List).isEmpty)
                  _panel(const Text('No payment was collected for this job.',
                      style: TextStyle(color: Color(0xFF657687))))
                else
                  ...(_data!['payments'] as List).map((p) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _panel(Row(children: [
                          const Icon(Icons.payments_outlined, color: _teal),
                          const SizedBox(width: 12),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(_readable('${p['kind']}'),
                                    style: const TextStyle(
                                        color: _ink,
                                        fontWeight: FontWeight.w800)),
                                Text(_date(p['createdAt']),
                                    style: const TextStyle(
                                        color: Color(0xFF657687))),
                              ])),
                          Text('₹${p['amount']}',
                              style: const TextStyle(
                                  color: _ink, fontWeight: FontWeight.w900)),
                        ])),
                      )),
                _sectionTitle('Job timeline', Icons.timeline_rounded),
                _panel(Column(children: [
                  ...(_data!['events'] as List).map((e) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 9),
                        child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                  width: 10,
                                  height: 10,
                                  margin: const EdgeInsets.only(top: 5),
                                  decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: _statusColor('${e['type']}'))),
                              const SizedBox(width: 13),
                              Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    Text(_readable('${e['type']}'),
                                        style: const TextStyle(
                                            color: _ink,
                                            fontWeight: FontWeight.w700)),
                                    const SizedBox(height: 3),
                                    Text(_date(e['createdAt']),
                                        style: const TextStyle(
                                            color: Color(0xFF657687),
                                            fontSize: 12)),
                                  ])),
                            ]),
                      )),
                ])),
                const SizedBox(height: 20),
                ExpansionTile(title: const Text('Job reference'), children: [
                  Padding(
                      padding: const EdgeInsets.all(12),
                      child: SelectableText(widget.jobId))
                ]),
              ],
            ]));
  }
}
