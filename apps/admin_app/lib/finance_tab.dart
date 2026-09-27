import 'package:flutter/material.dart';
import 'admin_api.dart';
import 'admin_ui.dart';

class FinanceTab extends StatefulWidget {
  const FinanceTab({super.key, required this.api});
  final AdminApi api;
  @override State<FinanceTab> createState() => _FinanceTabState();
}
class _FinanceTabState extends State<FinanceTab> {
  final _commission = TextEditingController(), _fee = TextEditingController(), _minimum = TextEditingController(), _included = TextEditingController(), _perKm = TextEditingController();
  Map<String,dynamic>? _policy, _collections;
  List<dynamic> _providers = [];
  String? _cursor, _error;
  bool _busy = false;
  @override void initState() { super.initState(); _load(); }
  @override void dispose() { for (final c in [_commission,_fee,_minimum,_included,_perKm]) { c.dispose(); } super.dispose(); }
  String _money(dynamic value) => '₹${(num.tryParse(value.toString()) ?? 0).toStringAsFixed(2)}';
  Future<void> _load({String? after}) async {
    setState(() { _busy = true; _error = null; });
    try {
      final result = await widget.api.request('/admin/finance/collections${after == null ? '' : '?after=$after'}') as Map<String,dynamic>;
      if (after == null) {
        final settings = await widget.api.request('/admin/finance/settings') as Map<String,dynamic>;
        final policy = settings['policy'] as Map<String,dynamic>;
        _commission.text = ((num.tryParse(policy['commissionBps'].toString()) ?? 0) / 100).toString();
        _fee.text = ((num.tryParse(policy['platformFeeMinor'].toString()) ?? 0) / 100).toStringAsFixed(2);
        _minimum.text = ((num.tryParse(policy['travelMinimumMinor'].toString()) ?? 5000) / 100).toStringAsFixed(2);
        _included.text = ((num.tryParse(policy['travelIncludedMeters'].toString()) ?? 2500) / 1000).toString();
        _perKm.text = ((num.tryParse(policy['travelPerKmMinor'].toString()) ?? 800) / 100).toStringAsFixed(2);
        if (mounted) setState(() { _policy = policy; _providers = result['providers'] as List? ?? []; });
      } else if (mounted) { setState(() => _providers.addAll(result['providers'] as List? ?? [])); }
      if (mounted) setState(() { _collections = result; _cursor = result['nextCursor']?.toString(); });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _save() async {
    if (_busy || _policy == null) return;
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: const Text('Update future prices?'), content: const Text('Changes affect future quotations. Existing job amounts stay unchanged.'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save'))]));
    if (confirmed != true || !mounted) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.api.request('/admin/finance/settings', method: 'POST', body: {
        'commissionPercent': _commission.text.trim(), 'platformFee': _fee.text.trim(),
        'travelMinimum': _minimum.text.trim(), 'travelIncludedKm': _included.text.trim(), 'travelPerKm': _perKm.text.trim(),
        'expectedRevision': _policy!['revision'],
      });
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pricing saved for future quotations')));
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Widget _number(String label, TextEditingController controller) => Padding(padding: const EdgeInsets.only(bottom: 12), child: TextField(controller: controller, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: adminInput(label)));
  @override Widget build(BuildContext context) {
    final totals = (_collections?['totals'] as List?) ?? [];
    return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
      const AdminHero(icon: Icons.account_balance_wallet_outlined, eyebrow: 'Revenue operations', title: 'Collections & pricing', subtitle: 'Review provider earnings and set future quotation rates.'),
      const SizedBox(height: 13),
      AdminPill('PAYMENT MODE  ${_collections?['paymentMode'] ?? 'LOADING'}', color: AdminColors.amber),
      if (_busy) const LinearProgressIndicator(),
      if (_error != null) Padding(padding: const EdgeInsets.all(12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
      const SizedBox(height: 14),
      for (final item in totals) Padding(padding: const EdgeInsets.only(bottom: 9), child: AdminPanel(child: Row(children: [Container(padding: const EdgeInsets.all(9), decoration: BoxDecoration(color: AdminColors.cyan.withOpacity(.1), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.trending_up_rounded, color: AdminColors.cyan)), const SizedBox(width: 12), Expanded(child: Text(item['kind']?.toString().replaceAll('_', ' ') ?? '', style: const TextStyle(color: AdminColors.muted, fontSize: 12))), Text(_money(item['amount']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))]))),
      AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Future quotation settings', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        const Text('Existing job prices remain unchanged.', style: TextStyle(color: AdminColors.muted, fontSize: 12)),
        const SizedBox(height: 10), _number('Provider commission %', _commission), _number('Customer platform fee ₹ (0 or 2–5)', _fee),
        _number('Minimum travel amount ₹', _minimum), _number('Distance included km', _included), _number('Additional travel ₹ per km', _perKm),
        FilledButton(onPressed: _busy || _policy == null ? null : _save, child: const Text('Save pricing')),
      ])),
      const SizedBox(height: 20), const Text('Provider collections', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
      if (_providers.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No provider collections available.')),
      for (final p in _providers) Padding(padding: const EdgeInsets.only(bottom: 10), child: AdminPanel(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProviderCollectionsScreen(api: widget.api, provider: Map<String,dynamic>.from(p)))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(p['name']?.toString() ?? 'Provider', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))), const Icon(Icons.chevron_right_rounded, color: AdminColors.muted)]), const SizedBox(height: 8), Text('COMPLETED  ${_money(p['completedCollections'])}', style: const TextStyle(color: AdminColors.muted, fontSize: 12)), const SizedBox(height: 5), Text('AVAILABLE  ${_money(p['available'])}', style: const TextStyle(color: AdminColors.mint, fontSize: 12, fontWeight: FontWeight.w800))]))),
      if (_cursor != null) OutlinedButton(onPressed: _busy ? null : () => _load(after: _cursor), child: const Text('Load more providers')),
    ]));
  }
}

class ProviderCollectionsScreen extends StatefulWidget {
  const ProviderCollectionsScreen({super.key, required this.api, required this.provider});
  final AdminApi api;
  final Map<String,dynamic> provider;
  @override State<ProviderCollectionsScreen> createState() => _ProviderCollectionsScreenState();
}
class _ProviderCollectionsScreenState extends State<ProviderCollectionsScreen> {
  List<dynamic> _jobs = [];
  String? _cursor, _error;
  bool _loading = true;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load({String? before}) async {
    try {
      final uri = '/admin/finance/jobs?providerId=${widget.provider['id']}${before == null ? '' : '&before=$before'}';
      final result = await widget.api.request(uri) as Map<String,dynamic>;
      if (mounted) setState(() { if (before == null) { _jobs = result['jobs'] as List? ?? []; } else { _jobs.addAll(result['jobs'] as List? ?? []); } _cursor = result['nextCursor']?.toString(); _error = null; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _loading = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Provider collections')), body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
    AdminHero(icon: Icons.person_outline, eyebrow: 'Provider finances', title: widget.provider['name']?.toString() ?? 'Provider', subtitle: 'Completed jobs and available earnings.'),
    const SizedBox(height: 14),
    AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('COMPLETED COLLECTIONS  ₹${widget.provider['completedCollections']}', style: const TextStyle(color: AdminColors.mint, fontWeight: FontWeight.w800)), const SizedBox(height: 7), Text('COMPANY COMMISSION  ₹${widget.provider['commission']}', style: const TextStyle(color: AdminColors.muted)), const SizedBox(height: 7), Text('PROVIDER AVAILABLE  ₹${widget.provider['available']}', style: const TextStyle(color: AdminColors.cyan))])),
    const SizedBox(height: 16),
    if (_loading) const LinearProgressIndicator(),
    if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
    if (!_loading && _jobs.isEmpty) const Text('No jobs found.'),
    for (final j in _jobs) Padding(padding: const EdgeInsets.only(bottom: 10), child: AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [AdminPill(j['status']?.toString() ?? 'JOB', color: j['status'] == 'COMPLETED' ? AdminColors.mint : AdminColors.amber), const SizedBox(height: 8), SelectableText('Job ${j['id']}', style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 8), Text('Customer total  ₹${j['totalAmount']}'), Text('Commission ${j['commissionPercent']}%  ·  Provider net ₹${j['providerNet']}', style: const TextStyle(color: AdminColors.muted))]))),
    if (_cursor != null) OutlinedButton(onPressed: () => _load(before: _cursor), child: const Text('Load more jobs')),
  ])));
}
