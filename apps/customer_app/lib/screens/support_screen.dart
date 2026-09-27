import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key, required this.token});
  final String token;
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _question = TextEditingController();
  List<dynamic> _tickets = [];
  String? _answer, _answerSource, _error;
  bool _busy = false, _loadingTickets = true;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _question.dispose();
    super.dispose();
  }

  Future<dynamic> _request(String path,
      {String method = 'GET',
      Object? body,
      Duration timeout = const Duration(seconds: 20)}) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    final headers = {
      'Authorization': 'Bearer ${widget.token}',
      'Content-Type': 'application/json'
    };
    final future = method == 'POST'
        ? http.post(uri, headers: headers, body: jsonEncode(body))
        : http.get(uri, headers: headers);
    final response = await future.timeout(timeout);
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      throw Exception('Support is temporarily unavailable. Please retry.');
    }
    if (response.statusCode >= 400)
      throw Exception(data is Map
          ? (data['message'] is List
              ? (data['message'] as List).join(', ')
              : data['message'])
          : 'Request failed');
    return data;
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loadingTickets = true);
    try {
      final data = await _request('/support/tickets');
      if (mounted)
        setState(() {
          _tickets = data as List;
          _error = null;
        });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loadingTickets = false);
    }
  }

  String? _localGuideAnswer(String question) {
    final q = question
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9+ ]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    bool has(List<String> terms) => terms.any((term) => q.contains(term));

    if (has([
      'dummy payment',
      'test payment',
      'razorpay',
      'cashfree',
      'payment method',
      'payment gateway'
    ])) {
      return 'The app may use a demo payment flow during testing. A demo success confirms the test job flow only; it does not mean a real bank or wallet transfer occurred. Check Wallet and history for recorded transactions, and raise a Payment ticket if anything looks incorrect.';
    }
    if (has(['refund', 'money back', 'cancel', 'cancellation'])) {
      return 'If a job is cancelled before you confirm completion, the held payment is returned to your customer wallet. If the balance does not update, open a Payment ticket and include the Job ID.';
    }
    if (has([
      'wallet',
      'withdraw',
      'withdrawal',
      'payout',
      'earnings',
      'payment',
      'pay'
    ])) {
      return 'You can review payments in Settings → Wallet and history. Provider earnings are released after you confirm the job is complete. Providers can request up to five withdrawals per Monday–Sunday week. For a missing transaction, open a Payment ticket with the Job ID.';
    }
    if (has(
        ['complete', 'completion', 'finished', 'finished job', 'job done'])) {
      return 'When the provider marks the job complete, confirm completion in the app after checking the work. That confirmation finalizes the job and releases the provider payment from escrow according to the configured commission.';
    }
    if (has(
        ['kyc', 'identity', 'verify', 'verification', 'id card', 'document'])) {
      return 'Providers can submit the front and back of a government ID, their address and a secondary phone in Profile → Identity verification. The documents stay saved while admin review is pending; upload them again only if the review is rejected.';
    }
    if (has(['route', 'map', 'location', 'gps', 'distance', 'directions'])) {
      return 'Allow precise location access and keep internet and GPS enabled. Reopen the active job to refresh the route. If the route or distance still looks wrong, create a Job ticket and include the Job ID.';
    }
    if (has([
      'call',
      'calling',
      'phone call',
      'audio',
      'cannot hear',
      'microphone'
    ])) {
      return 'Allow phone and microphone permissions when prompted, and make sure both phones have internet access. If the in-app call still fails, create an App ticket with the Job ID.';
    }
    if (has(
        ['login', 'sign in', 'signin', 'password', '401', 'account', 'otp'])) {
      return 'Check that you are using the correct customer or provider app and the email or phone registered to that account. If sign-in returns an error, check your connection and try again; if it continues, create an Account ticket. Never share your password or OTP in a ticket.';
    }
    if (has([
      'service config',
      'service configuration',
      'services not visible',
      'pricing',
      'price',
      'go online',
      'online',
      'provider profile'
    ])) {
      return 'Providers must add at least one service and set its price in Service configuration before going online. If services or commission settings fail to load, check the connection and refresh; then create an App ticket if the problem continues.';
    }
    if (has([
      'no provider',
      'provider not found',
      'nobody accepted',
      'request failed',
      'request not sent',
      'send request'
    ])) {
      return 'Check that location permission is enabled and your pickup point is correct, then retry the request. If a previous request is still active, open Active job and check its status before sending another. If no provider is found, try again shortly or create a Job ticket.';
    }
    if (has([
      'platform fee',
      'travel fee',
      'travel charge',
      'distance charge',
      'per km',
      'quotation amount',
      'commission'
    ])) {
      return 'The customer sees the final quotation and any platform fee before confirming payment. Travel cost is calculated from the route distance using the current admin pricing rules. Provider commission is shown to the provider while setting service prices, not as a separate customer charge.';
    }
    if (has(['rating', 'review', 'badge', 'performance'])) {
      return 'After a completed job, customers can rate and review the provider. Provider badges reflect verified profile details and service performance; they update as eligible reviews and completed jobs are recorded.';
    }
    if (has([
      'profile',
      'mobile number',
      'phone number',
      'change number',
      'edit details'
    ])) {
      return 'Open Profile or Settings to review your account details. Providers must keep a valid mobile number and complete KYC before accepting jobs. If you cannot update a detail, create an Account ticket.';
    }
    if (has([
      'available service',
      'available services',
      'what services',
      'service type',
      'services list',
      'services do you offer'
    ])) {
      return 'Choose the service that matches your vehicle issue from the customer home screen, confirm your pickup location and send the request. Nearby online providers who offer that service can then respond.';
    }
    if (has(['job', 'request', 'booking', 'mechanic', 'provider', 'accept'])) {
      return 'After a request is sent, the provider reviews and accepts it, then you review the quotation and payment before confirming. Check the active job screen for its latest status. If it is stuck or missing, create a Job ticket and include the Job ID.';
    }
    if (has(['ticket', 'support', 'help', 'agent', 'human'])) {
      return 'Use “Raise a support ticket” on this page, choose the closest issue type, and describe what happened. Add the Job ID when relevant. You can open a ticket below later to see its status and replies.';
    }
    return null;
  }

  Future<void> _ask() async {
    final text = _question.text.trim();
    if (text.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _answer = null;
      _answerSource = null;
    });
    final localAnswer = _localGuideAnswer(text);
    if (localAnswer != null) {
      if (mounted) {
        setState(() {
          _answer = localAnswer;
          _answerSource = 'QUICK GUIDE';
          _busy = false;
        });
      }
      return;
    }
    try {
      final result = await _request('/support/bot',
          method: 'POST',
          body: {'question': text},
          timeout: const Duration(seconds: 7));
      final answer = result is Map ? result['answer']?.toString() : null;
      if (mounted) {
        setState(() {
          _answer = answer?.trim().isNotEmpty == true
              ? answer
              : 'I could not find a reliable answer. Please raise a support ticket and our team will help.';
          _answerSource = 'SUPPORT GUIDE';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _answer =
              'I could not find a reliable answer right now. Please raise a support ticket and our team will help.';
          _answerSource = 'QUICK GUIDE';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _newTicket() async {
    final ticket = await showModalBottomSheet<dynamic>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _TicketComposer(
          onSubmit: (body) =>
              _request('/support/tickets', method: 'POST', body: body)),
    );
    if (!mounted || ticket == null) return;
    await _load();
    if (mounted)
      Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => SupportTicketScreen(
                  token: widget.token, id: ticket['id']))).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Help & support'), actions: [
          IconButton(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh')
        ]),
        body: RefreshIndicator(
            onRefresh: _load,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                  child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('How can we help?',
                                style: TextStyle(
                                    fontSize: 21, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            const Text(
                                'Ask about jobs, payments, KYC, maps or calls. Our guide cannot access your account.'),
                            const SizedBox(height: 12),
                            TextField(
                                controller: _question,
                                maxLength: 500,
                                decoration: const InputDecoration(
                                    labelText: 'Ask a question',
                                    border: OutlineInputBorder()),
                                onSubmitted: (_) => _ask()),
                            Align(
                                alignment: Alignment.centerRight,
                                child: FilledButton.icon(
                                    onPressed: _busy ? null : _ask,
                                    icon: const Icon(Icons.smart_toy_outlined),
                                    label: Text(
                                        _busy ? 'Checking…' : 'Ask guide'))),
                            if (_answer != null)
                              Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Card.filled(
                                      child: Padding(
                                          padding: const EdgeInsets.all(14),
                                          child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(_answerSource ?? 'Guide answer',
                                                    style: const TextStyle(
                                                        color:
                                                            Color(0xFF246B57),
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        letterSpacing: .8,
                                                        fontSize: 11)),
                                                const SizedBox(height: 6),
                                                Text(_answer!)
                                              ])))),
                          ]))),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                  onPressed: _busy ? null : _newTicket,
                  icon: const Icon(Icons.add_comment_outlined),
                  label: const Text('Raise a support ticket')),
              if (_error != null)
                Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(_error!,
                        style: const TextStyle(color: Colors.red))),
              const SizedBox(height: 16),
              const Text('Your tickets',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
              if (_loadingTickets)
                const Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator())),
              if (!_loadingTickets && _tickets.isEmpty && _error == null)
                const Padding(
                    padding: EdgeInsets.all(20),
                    child: Text(
                        'No tickets yet. Create one if you need our team.')),
              for (final item in _tickets)
                Card(
                    child: ListTile(
                  title: Text(item['subject'] ?? ''),
                  subtitle: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                '${item['category']} · Ticket #${item['id'].toString().substring(0, 8)}'),
                            const SizedBox(height: 6),
                            _TicketStatus(item['status']?.toString() ?? 'OPEN'),
                          ])),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => SupportTicketScreen(
                              token: widget.token,
                              id: item['id']))).then((_) => _load()),
                )),
            ])),
      );
}

class _TicketStatus extends StatelessWidget {
  const _TicketStatus(this.status);
  final String status;
  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'RESOLVED' => Colors.green,
      'CLOSED' => Colors.blueGrey,
      'WAITING_FOR_USER' => Colors.orange,
      'IN_PROGRESS' => Colors.blue,
      _ => Colors.deepPurple,
    };
    return Align(
        alignment: Alignment.centerLeft,
        child: Chip(
          avatar: Icon(Icons.circle, size: 11, color: color),
          label: Text(status.replaceAll('_', ' '),
              style: TextStyle(color: color, fontWeight: FontWeight.w700)),
          backgroundColor: color.withOpacity(.12),
          side: BorderSide.none,
          visualDensity: VisualDensity.compact,
        ));
  }
}

class _TicketComposer extends StatefulWidget {
  const _TicketComposer({required this.onSubmit});
  final Future<dynamic> Function(Map<String, String>) onSubmit;
  @override
  State<_TicketComposer> createState() => _TicketComposerState();
}

class _TicketComposerState extends State<_TicketComposer> {
  final _subject = TextEditingController(),
      _message = TextEditingController(),
      _jobId = TextEditingController();
  String _category = 'OTHER';
  String? _error;
  bool _submitting = false;
  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    _jobId.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (_subject.text.trim().isEmpty || _message.text.trim().isEmpty) {
      setState(() => _error = 'Add a subject and describe the issue.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final ticket = await widget.onSubmit({
        'subject': _subject.text.trim(),
        'message': _message.text.trim(),
        'category': _category,
        if (_jobId.text.trim().isNotEmpty) 'jobId': _jobId.text.trim(),
      });
      if (mounted) Navigator.pop(context, ticket);
    } catch (error) {
      if (mounted)
        setState(() => _error = '$error'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 24),
        child: SingleChildScrollView(
            child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Text('Create support ticket',
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              const Text(
                  'Our team will review your issue. You can follow its status here.'),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                  value: _category,
                  decoration: const InputDecoration(labelText: 'Issue type'),
                  items: const [
                    'JOB',
                    'PAYMENT',
                    'KYC',
                    'ACCOUNT',
                    'APP',
                    'OTHER'
                  ]
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                  onChanged: _submitting
                      ? null
                      : (v) => setState(() => _category = v ?? 'OTHER')),
              TextField(
                  controller: _subject,
                  maxLength: 120,
                  decoration: const InputDecoration(labelText: 'Subject')),
              TextField(
                  controller: _jobId,
                  decoration:
                      const InputDecoration(labelText: 'Job ID (optional)')),
              TextField(
                  controller: _message,
                  maxLength: 4000,
                  minLines: 3,
                  maxLines: 6,
                  decoration:
                      const InputDecoration(labelText: 'Describe the issue')),
              if (_error != null)
                Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!,
                        style: const TextStyle(color: Colors.red))),
              SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child:
                          Text(_submitting ? 'Submitting…' : 'Submit ticket'))),
            ])),
      );
}

class SupportTicketScreen extends StatefulWidget {
  const SupportTicketScreen({super.key, required this.token, required this.id});
  final String token, id;
  @override
  State<SupportTicketScreen> createState() => _SupportTicketScreenState();
}

class _SupportTicketScreenState extends State<SupportTicketScreen> {
  final _reply = TextEditingController();
  Timer? _refreshTimer;
  Map<String, dynamic>? _data;
  String? _error;
  bool _sending = false;
  final _messagesScroll = ScrollController();
  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _reply.dispose();
    _messagesScroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/support/tickets/${widget.id}'),
          headers: {
            'Authorization': 'Bearer ${widget.token}'
          }).timeout(const Duration(seconds: 20));
      final data = jsonDecode(r.body);
      if (r.statusCode != 200)
        throw Exception(data['message'] ?? 'Unable to load ticket');
      if (mounted)
        setState(() {
          _data = data;
          _error = null;
        });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _send() async {
    final message = _reply.text.trim();
    if (message.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final r = await http
          .post(
              Uri.parse(
                  '${ApiConfig.baseUrl}/support/tickets/${widget.id}/messages'),
              headers: {
                'Authorization': 'Bearer ${widget.token}',
                'Content-Type': 'application/json'
              },
              body: jsonEncode({'message': message}))
          .timeout(const Duration(seconds: 20));
      if (r.statusCode >= 400)
        throw Exception(jsonDecode(r.body)['message'] ?? 'Reply failed');
      _reply.clear();
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Color _statusColor(String status) => switch (status) {
        'RESOLVED' => const Color(0xFF14804A),
        'CLOSED' => const Color(0xFF64748B),
        'WAITING_FOR_USER' => const Color(0xFFB56A0A),
        'IN_PROGRESS' => const Color(0xFF2563EB),
        _ => const Color(0xFF6D4BC3),
      };

  @override
  Widget build(BuildContext context) {
    final ticket = _data?['ticket'];
    final messages = (_data?['messages'] as List?) ?? [];
    final closed = ticket?['status'] == 'CLOSED';
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Support conversation',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
              tooltip: 'Refresh',
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded))
        ],
      ),
      body: Column(children: [
        if (ticket != null)
          Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                      color: Color(0x100B1B35),
                      blurRadius: 16,
                      offset: Offset(0, 5))
                ]),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                      color: const Color(0xFFEAF2FF),
                      borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.headset_mic_rounded,
                      color: Color(0xFF3567B7))),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(ticket['subject']?.toString() ?? 'Support request',
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 5),
                    Text(
                        '${ticket['category'] ?? 'OTHER'}  ·  #${widget.id.substring(0, 8).toUpperCase()}',
                        style: const TextStyle(
                            color: Color(0xFF718096),
                            fontSize: 12,
                            fontWeight: FontWeight.w600)),
                    const SizedBox(height: 9),
                    Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                            color: _statusColor(
                                    ticket['status']?.toString() ?? 'OPEN')
                                .withOpacity(.1),
                            borderRadius: BorderRadius.circular(20)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                  color: _statusColor(
                                      ticket['status']?.toString() ?? 'OPEN'),
                                  shape: BoxShape.circle)),
                          const SizedBox(width: 7),
                          Text(
                              (ticket['status']?.toString() ?? 'OPEN')
                                  .replaceAll('_', ' '),
                              style: TextStyle(
                                  color: _statusColor(
                                      ticket['status']?.toString() ?? 'OPEN'),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800))
                        ])),
                  ])),
            ]),
          ),
        if (_error != null)
          Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Text(_error!,
                  style: const TextStyle(color: Color(0xFFB42318)))),
        Expanded(
            child: RefreshIndicator(
          onRefresh: _load,
          child: messages.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 120),
                  Center(
                      child: Text('Your support conversation will appear here.',
                          style: TextStyle(color: Color(0xFF718096))))
                ])
              : ListView.builder(
                  controller: _messagesScroll,
                  reverse: true,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[messages.length - 1 - index];
                    final role = message['senderRole']?.toString() ?? '';
                    final fromSupport =
                        ['SUPER_ADMIN', 'MANAGER', 'CEO'].contains(role);
                    final accent = fromSupport
                        ? const Color(0xFF246B57)
                        : const Color(0xFF4268B2);
                    final bubble =
                        fromSupport ? Colors.white : const Color(0xFFE8F0FF);
                    final created = message['createdAt']?.toString();
                    final time = created == null
                        ? ''
                        : created.replaceFirst('T', ' ').split('.').first;
                    return Align(
                      alignment: fromSupport
                          ? Alignment.centerLeft
                          : Alignment.centerRight,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * .82),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 15, vertical: 12),
                          decoration: BoxDecoration(
                              color: bubble,
                              borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(19),
                                  topRight: const Radius.circular(19),
                                  bottomLeft:
                                      Radius.circular(fromSupport ? 5 : 19),
                                  bottomRight:
                                      Radius.circular(fromSupport ? 19 : 5)),
                              boxShadow: const [
                                BoxShadow(
                                    color: Color(0x0D0B1B35),
                                    blurRadius: 10,
                                    offset: Offset(0, 3))
                              ]),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(
                                      fromSupport
                                          ? Icons.support_agent_rounded
                                          : Icons.person_rounded,
                                      size: 15,
                                      color: accent),
                                  const SizedBox(width: 5),
                                  Text(fromSupport ? 'SUPPORT TEAM' : 'YOU',
                                      style: TextStyle(
                                          color: accent,
                                          fontSize: 10,
                                          letterSpacing: 1,
                                          fontWeight: FontWeight.w900))
                                ]),
                                const SizedBox(height: 7),
                                Text(message['body']?.toString() ?? '',
                                    style: const TextStyle(
                                        fontSize: 15,
                                        height: 1.4,
                                        color: Color(0xFF243247))),
                                if (time.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(time,
                                      style: const TextStyle(
                                          fontSize: 10,
                                          color: Color(0xFF8290A2)))
                                ],
                              ]),
                        ),
                      ),
                    );
                  },
                ),
        )),
        if (closed)
          SafeArea(
              top: false,
              child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  color: Colors.white,
                  child: const Text(
                      'This ticket is closed. Contact support to reopen it.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: Color(0xFF718096),
                          fontWeight: FontWeight.w600))))
        else if (ticket != null)
          SafeArea(
              top: false,
              child: Container(
                padding: EdgeInsets.fromLTRB(12, 10, 12,
                    MediaQuery.of(context).viewInsets.bottom > 0 ? 8 : 10),
                decoration: const BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                          color: Color(0x100B1B35),
                          blurRadius: 16,
                          offset: Offset(0, -5))
                    ]),
                child:
                    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(
                      child: Container(
                          decoration: BoxDecoration(
                              color: const Color(0xFFF3F6FA),
                              borderRadius: BorderRadius.circular(20),
                              border:
                                  Border.all(color: const Color(0xFFE4EAF1))),
                          child: TextField(
                              controller: _reply,
                              maxLength: 4000,
                              minLines: 1,
                              maxLines: 4,
                              textCapitalization: TextCapitalization.sentences,
                              decoration: const InputDecoration(
                                  hintText: 'Write a message…',
                                  counterText: '',
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 13))))),
                  const SizedBox(width: 9),
                  SizedBox(
                      width: 48,
                      height: 48,
                      child: FilledButton(
                          onPressed: _sending ? null : _send,
                          style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF246B57),
                              foregroundColor: Colors.white,
                              padding: EdgeInsets.zero,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16))),
                          child: _sending
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.arrow_upward_rounded))),
                ]),
              )),
      ]),
    );
  }
}
