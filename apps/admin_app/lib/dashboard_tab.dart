import 'package:flutter/material.dart';
import 'admin_api.dart';
import 'admin_ui.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key, required this.api, required this.role, required this.onSupport, this.onKyc, this.onFinance});
  final AdminApi api;
  final String role;
  final VoidCallback onSupport;
  final VoidCallback? onKyc, onFinance;
  @override State<DashboardTab> createState() => _DashboardTabState();
}
class _DashboardTabState extends State<DashboardTab> {
  int? _open, _pending;
  Map<String,dynamic>? _finance;
  String? _error;
  bool _loading = true;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final tickets = await widget.api.request('/support/admin/tickets') as List;
      int? pending;
      Map<String,dynamic>? finance;
      if (widget.onKyc != null) pending = (await widget.api.request('/users/mechanics/pending') as List).length;
      if (widget.onFinance != null) finance = await widget.api.request('/admin/finance/collections') as Map<String,dynamic>;
      if (mounted) setState(() { _open = tickets.where((t) => !['RESOLVED','CLOSED'].contains(t['status'])).length; _pending = pending; _finance = finance; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _loading = false); }
  }
  Widget _metric(String title, String value, IconData icon, Color color, VoidCallback? onTap) => AdminPanel(onTap: onTap, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Icon(icon, color: color, size: 27), const SizedBox(height: 16),
    Text(value, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900)),
    const SizedBox(height: 4), Text(title, style: const TextStyle(color: AdminColors.muted, fontSize: 12, fontWeight: FontWeight.w700)),
  ]));
  @override Widget build(BuildContext context) {
    final providers = (_finance?['providers'] as List?) ?? [];
    final totals = (_finance?['totals'] as List?) ?? [];
    final providerCredit = totals.where((t) => t['kind'] == 'PROVIDER_CREDIT').fold<double>(0, (sum,t) => sum + (double.tryParse(t['amount'].toString()) ?? 0));
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
      AdminHero(icon: Icons.space_dashboard_rounded, eyebrow: 'Operations overview', title: 'Your dashboard', subtitle: 'Live activity across support, verification and collections.'),
      const SizedBox(height: 17),
      if (_loading) const LinearProgressIndicator(),
      if (_error != null) AdminPanel(child: Row(children: [const Icon(Icons.error_outline, color: AdminColors.amber), const SizedBox(width: 10), Expanded(child: Text(_error!)), TextButton(onPressed: _load, child: const Text('Retry'))])),
      GridView.count(crossAxisCount: 2, childAspectRatio: 1.12, crossAxisSpacing: 11, mainAxisSpacing: 11, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), children: [
        _metric('Active tickets', _open?.toString() ?? '—', Icons.forum_outlined, AdminColors.cyan, widget.onSupport),
        if (widget.onKyc != null) _metric('KYC reviews', _pending?.toString() ?? '—', Icons.verified_user_outlined, AdminColors.amber, widget.onKyc),
        if (widget.onFinance != null) _metric('Providers shown', providers.length.toString(), Icons.groups_outlined, AdminColors.mint, widget.onFinance),
        if (widget.onFinance != null) _metric('Provider credits', '₹${providerCredit.toStringAsFixed(0)}', Icons.currency_rupee_rounded, AdminColors.cyan, widget.onFinance),
      ]),
      const SizedBox(height: 18),
      const Text('Quick actions', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      AdminPanel(onTap: widget.onSupport, child: const Row(children: [Icon(Icons.support_agent_rounded, color: AdminColors.cyan), SizedBox(width: 12), Expanded(child: Text('Review support tickets', style: TextStyle(fontWeight: FontWeight.w700))), Icon(Icons.arrow_forward_ios_rounded, size: 15, color: AdminColors.muted)])),
      if (widget.onKyc != null) Padding(padding: const EdgeInsets.only(top: 10), child: AdminPanel(onTap: widget.onKyc, child: const Row(children: [Icon(Icons.badge_outlined, color: AdminColors.amber), SizedBox(width: 12), Expanded(child: Text('Review provider identities', style: TextStyle(fontWeight: FontWeight.w700))), Icon(Icons.arrow_forward_ios_rounded, size: 15, color: AdminColors.muted)]))),
      if (widget.onFinance != null) Padding(padding: const EdgeInsets.only(top: 10), child: AdminPanel(onTap: widget.onFinance, child: const Row(children: [Icon(Icons.tune_rounded, color: AdminColors.mint), SizedBox(width: 12), Expanded(child: Text('Manage pricing & collections', style: TextStyle(fontWeight: FontWeight.w700))), Icon(Icons.arrow_forward_ios_rounded, size: 15, color: AdminColors.muted)]))),
    ]));
  }
}
