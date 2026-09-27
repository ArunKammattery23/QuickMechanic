import 'dart:async';
import 'package:flutter/material.dart';
import 'admin_api.dart';
import 'admin_ui.dart';

const ticketStatuses = ['OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED'];

class SupportTab extends StatefulWidget {
  const SupportTab({super.key, required this.api});
  final AdminApi api;
  @override State<SupportTab> createState() => _SupportTabState();
}
class _SupportTabState extends State<SupportTab> {
  List<dynamic> _tickets = [];
  String _filter = '';
  String? _error;
  bool _loading = true;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final suffix = _filter.isEmpty ? '' : '?status=$_filter';
      final list = await widget.api.request('/support/admin/tickets$suffix');
      if (mounted) setState(() { _tickets = list as List; _error = null; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _loading = false); }
  }
  @override Widget build(BuildContext context) => RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
    const AdminHero(icon: Icons.forum_outlined, eyebrow: 'Operations desk', title: 'Support inbox', subtitle: 'Follow every issue from first message to resolution.'),
    const SizedBox(height: 18),
    AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('${_tickets.length} tickets in view', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      DropdownButtonFormField<String>(value: _filter, decoration: adminInput('Ticket status', icon: Icons.filter_list_rounded), items: ['', ...ticketStatuses].map((s) => DropdownMenuItem(value: s, child: Text(s.isEmpty ? 'All statuses' : s.replaceAll('_', ' ')))).toList(), onChanged: (value) { setState(() { _filter = value ?? ''; _loading = true; }); _load(); }),
    ])),
    const SizedBox(height: 18),
    if (_loading) const LinearProgressIndicator(),
    if (_error != null) Padding(padding: const EdgeInsets.all(12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
    if (!_loading && _tickets.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No tickets in this view.')),
    for (final ticket in _tickets) Padding(padding: const EdgeInsets.only(bottom: 11), child: AdminPanel(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AdminTicketScreen(api: widget.api, id: ticket['id'].toString()))).then((_) => _load()), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Text(ticket['subject']?.toString() ?? 'Support ticket', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))), const Icon(Icons.chevron_right_rounded, color: AdminColors.muted)]),
      const SizedBox(height: 12),
      Wrap(spacing: 7, runSpacing: 7, children: [AdminPill(ticket['status']?.toString() ?? 'OPEN', color: ticketStatusColor(ticket['status']?.toString() ?? 'OPEN')), AdminPill(ticket['category']?.toString() ?? 'OTHER'), AdminPill(ticket['requesterRole']?.toString() ?? 'USER', color: AdminColors.muted)]),
      const SizedBox(height: 10),
      Text('Updated ${ticket['updatedAt']?.toString().replaceFirst('T', ' ').split('.').first ?? ''}', style: const TextStyle(fontSize: 12, color: AdminColors.muted)),
    ]))),
  ]));
}

class AdminTicketScreen extends StatefulWidget {
  const AdminTicketScreen({super.key, required this.api, required this.id});
  final AdminApi api;
  final String id;
  @override State<AdminTicketScreen> createState() => _AdminTicketScreenState();
}
class _AdminTicketScreenState extends State<AdminTicketScreen> {
  final _reply = TextEditingController();
  Timer? _timer;
  Map<String, dynamic>? _detail;
  String? _error;
  bool _busy = false;
  @override void initState() { super.initState(); _load(); _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load()); }
  @override void dispose() { _timer?.cancel(); _reply.dispose(); super.dispose(); }
  Future<void> _load() async {
    try {
      final result = await widget.api.request('/support/tickets/${widget.id}');
      if (mounted) setState(() { _detail = result as Map<String, dynamic>; _error = null; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
  }
  Future<void> _send() async {
    if (_reply.text.trim().isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      await widget.api.request('/support/tickets/${widget.id}/messages', method: 'POST', body: {'message': _reply.text.trim()});
      _reply.clear(); await _load();
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _status(String status) async {
    setState(() => _busy = true);
    try { await widget.api.request('/support/admin/tickets/${widget.id}/status', method: 'PATCH', body: {'status': status}); await _load(); }
    catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  @override Widget build(BuildContext context) {
    final ticket = _detail?['ticket'] as Map<String, dynamic>?;
    final messages = (_detail?['messages'] as List?) ?? [];
    return Scaffold(appBar: AppBar(title: const Text('Ticket conversation'), actions: [IconButton(tooltip: 'Refresh', onPressed: _load, icon: const Icon(Icons.refresh))]), body: Column(children: [
      if (ticket != null) Padding(padding: const EdgeInsets.fromLTRB(14, 8, 14, 0), child: AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(ticket['subject']?.toString() ?? '', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Wrap(spacing: 8, children: [AdminPill(ticket['category']?.toString() ?? 'OTHER'), AdminPill(ticket['requesterRole']?.toString() ?? 'USER', color: AdminColors.muted)]),
        const SizedBox(height: 9),
        SelectableText('Ticket: ${widget.id}', style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
        if (ticket['jobId'] != null) SelectableText('Job: ${ticket['jobId']}', style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(value: ticket['status']?.toString(), decoration: adminInput('Status', icon: Icons.flag_outlined), items: ticketStatuses.map((s) => DropdownMenuItem(value: s, child: Text(s.replaceAll('_', ' ')))).toList(), onChanged: _busy ? null : (value) { if (value != null) _status(value); }),
      ]))),
      if (_error != null) Padding(padding: const EdgeInsets.all(10), child: Text(_error!, style: const TextStyle(color: Colors.red))),
      Expanded(child: RefreshIndicator(onRefresh: _load, child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          for (final message in messages)
            Align(
              alignment: ['CUSTOMER', 'MECHANIC', 'FLEET_DRIVER'].contains(message['senderRole']) ? Alignment.centerLeft : Alignment.centerRight,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: ['CUSTOMER', 'MECHANIC', 'FLEET_DRIVER'].contains(message['senderRole']) ? AdminColors.surface : const Color(0xFF175648),
                      borderRadius: BorderRadius.circular(17),
                      border: Border.all(color: AdminColors.border),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(['CUSTOMER', 'MECHANIC', 'FLEET_DRIVER'].contains(message['senderRole']) ? 'USER' : 'SUPPORT TEAM', style: const TextStyle(color: AdminColors.mint, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1)),
                      const SizedBox(height: 6),
                      Text(message['body']?.toString() ?? ''),
                      const SizedBox(height: 6),
                      Text(message['createdAt']?.toString().replaceFirst('T', ' ').split('.').first ?? '', style: const TextStyle(color: AdminColors.muted, fontSize: 10)),
                    ]),
                  ),
                ),
              ),
            ),
        ],
      ))),
      if (ticket != null && ticket['status'] != 'CLOSED') SafeArea(child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [Expanded(child: TextField(controller: _reply, maxLength: 4000, maxLines: 3, minLines: 1, decoration: adminInput('Reply to user', icon: Icons.edit_outlined))), const SizedBox(width: 8), IconButton.filled(onPressed: _busy ? null : _send, icon: const Icon(Icons.send_rounded))]))),
    ]));
  }
}
