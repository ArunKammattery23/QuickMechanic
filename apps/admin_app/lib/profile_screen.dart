import 'package:flutter/material.dart';
import 'admin_api.dart';
import 'admin_ui.dart';

class AdminProfileScreen extends StatefulWidget {
  const AdminProfileScreen({super.key, required this.api});
  final AdminApi api;
  @override State<AdminProfileScreen> createState() => _AdminProfileScreenState();
}
class _AdminProfileScreenState extends State<AdminProfileScreen> {
  final _name = TextEditingController(), _phone = TextEditingController();
  Map<String,dynamic>? _profile;
  String? _error;
  bool _busy = false;
  @override void initState() { super.initState(); _load(); }
  @override void dispose() { _name.dispose(); _phone.dispose(); super.dispose(); }
  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final result = await widget.api.request('/auth/admin/me') as Map<String,dynamic>;
      if (mounted) setState(() { _profile = result; _name.text = result['name']?.toString() ?? ''; _phone.text = result['phoneNumber']?.toString() ?? ''; });
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _save() async {
    if (_busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      final result = await widget.api.request('/auth/admin/me', method: 'PATCH', body: {'name': _name.text.trim(), 'phoneNumber': _phone.text.trim()}) as Map<String,dynamic>;
      if (mounted) { setState(() => _profile = result); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated'))); }
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Admin profile'), actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))]), body: ListView(padding: const EdgeInsets.all(16), children: [
    const AdminHero(icon: Icons.person_outline_rounded, eyebrow: 'Your account', title: 'Profile', subtitle: 'Keep your admin contact details current.'),
    const SizedBox(height: 16),
    if (_busy) const LinearProgressIndicator(),
    if (_error != null) Padding(padding: const EdgeInsets.all(10), child: Text(_error!, style: const TextStyle(color: Color(0xFFFF8C86)))),
    if (_profile != null) AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [CircleAvatar(radius: 27, backgroundColor: AdminColors.cyan.withOpacity(.15), child: const Icon(Icons.admin_panel_settings_outlined, color: AdminColors.cyan)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(_profile!['email']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w800)), const SizedBox(height: 5), AdminPill(_profile!['role']?.toString() ?? 'ADMIN', color: AdminColors.mint)]))]),
      const SizedBox(height: 21),
      TextField(controller: _name, maxLength: 80, decoration: adminInput('Display name', icon: Icons.badge_outlined)),
      const SizedBox(height: 11),
      TextField(controller: _phone, keyboardType: TextInputType.phone, maxLength: 16, decoration: adminInput('Mobile number (optional)', icon: Icons.phone_outlined)),
      const SizedBox(height: 12),
      FilledButton.icon(onPressed: _busy ? null : _save, icon: const Icon(Icons.save_outlined), label: const Text('Save profile')),
    ])),
  ]));
}
