import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'admin_api.dart';
import 'admin_ui.dart';

class KycTab extends StatefulWidget {
  const KycTab({super.key, required this.api});
  final AdminApi api;
  @override State<KycTab> createState() => _KycTabState();
}
class _KycTabState extends State<KycTab> {
  List<dynamic> _providers = [];
  String? _error;
  bool _loading = true;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final result = await widget.api.request('/users/mechanics/pending');
      if (mounted) setState(() { _providers = result as List; _error = null; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _loading = false); }
  }
  @override Widget build(BuildContext context) => RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
    const AdminHero(icon: Icons.verified_user_outlined, eyebrow: 'Trust & safety', title: 'Identity reviews', subtitle: 'Verify the provider before they can accept jobs.'),
    const SizedBox(height: 18),
    AdminPanel(child: Row(children: [const Icon(Icons.hourglass_top_rounded, color: AdminColors.amber), const SizedBox(width: 12), Expanded(child: Text('${_providers.length} awaiting review', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)))])),
    const SizedBox(height: 14),
    if (_loading) const LinearProgressIndicator(),
    if (_error != null) Padding(padding: const EdgeInsets.all(12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
    if (!_loading && _providers.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No KYC submissions awaiting review.')),
    for (final p in _providers) Padding(padding: const EdgeInsets.only(bottom: 11), child: AdminPanel(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => KycReviewScreen(api: widget.api, provider: Map<String,dynamic>.from(p)))).then((_) => _load()), child: Row(children: [CircleAvatar(backgroundColor: AdminColors.cyan.withOpacity(.15), child: const Icon(Icons.person_outline, color: AdminColors.cyan)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(p['name']?.toString() ?? 'Provider', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), const SizedBox(height: 3), Text(p['email']?.toString() ?? '', overflow: TextOverflow.ellipsis, style: const TextStyle(color: AdminColors.muted, fontSize: 12)), const SizedBox(height: 8), AdminPill(p['idType']?.toString() ?? 'ID', color: AdminColors.amber)])), const Icon(Icons.chevron_right_rounded, color: AdminColors.muted)]))),
  ]));
}

class KycReviewScreen extends StatefulWidget {
  const KycReviewScreen({super.key, required this.api, required this.provider});
  final AdminApi api;
  final Map<String, dynamic> provider;
  @override State<KycReviewScreen> createState() => _KycReviewScreenState();
}
class _KycReviewScreenState extends State<KycReviewScreen> {
  Uint8List? _front, _back;
  String? _error;
  bool _busy = false;
  @override void initState() { super.initState(); _loadPhotos(); }
  Future<void> _loadPhotos() async {
    setState(() { _busy = true; _error = null; });
    try {
      final id = widget.provider['id'];
      final images = await Future.wait([widget.api.image('/users/mechanics/$id/kyc/document/front'), widget.api.image('/users/mechanics/$id/kyc/document/back')]);
      if (mounted) setState(() { _front = images[0]; _back = images[1]; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _review(String status) async {
    if (_busy || (status == 'APPROVED' && (_front == null || _back == null))) return;
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: Text('${status == 'APPROVED' ? 'Approve' : 'Reject'} KYC?'), content: const Text('Confirm the identity photos and address have been reviewed.'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirm'))]));
    if (confirmed != true || !mounted) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.api.request('/users/mechanics/${widget.provider['id']}/kyc', method: 'PATCH', body: {'status': status, 'submittedAt': widget.provider['submittedAt']});
      if (mounted) Navigator.pop(context, true);
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  @override Widget build(BuildContext context) {
    final p = widget.provider;
    return Scaffold(appBar: AppBar(title: const Text('Identity review')), body: ListView(padding: const EdgeInsets.all(16), children: [
      AdminHero(icon: Icons.badge_outlined, eyebrow: 'Provider application', title: p['name']?.toString() ?? 'Provider', subtitle: 'Compare both ID photos with the contact and address below.'),
      const SizedBox(height: 14),
      AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(p['email']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
        const Divider(height: 22),
        Text('PRIMARY MOBILE  ${p['phoneNumber']}', style: const TextStyle(color: AdminColors.muted)),
        const SizedBox(height: 8),
        Text('SECONDARY MOBILE  ${p['secondaryPhone']}', style: const TextStyle(color: AdminColors.muted)),
        const SizedBox(height: 8),
        Text('ID TYPE  ${p['idType']}', style: const TextStyle(color: AdminColors.muted)),
        const Divider(height: 22),
        Text(p['address']?.toString() ?? '', style: const TextStyle(height: 1.4)),
      ])),
      const SizedBox(height: 18),
      if (_busy) const LinearProgressIndicator(),
      if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
      for (final (label, bytes) in [('Front of ID', _front), ('Back of ID', _back)]) ...[
        Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
        const SizedBox(height: 8),
        Container(height: 250, width: double.infinity, decoration: BoxDecoration(color: AdminColors.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: AdminColors.border)), child: bytes == null ? const Center(child: Text('Photo unavailable')) : ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.memory(bytes, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Center(child: Text('Unable to display photo'))))),
        const SizedBox(height: 16),
      ],
      OutlinedButton(onPressed: _busy ? null : _loadPhotos, child: const Text('Reload photos')),
      const SizedBox(height: 12),
      Row(children: [Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _review('REJECTED'), child: const Text('Reject'))), const SizedBox(width: 12), Expanded(child: FilledButton(onPressed: _busy || _front == null || _back == null ? null : () => _review('APPROVED'), child: const Text('Approve')))]),
    ]));
  }
}
