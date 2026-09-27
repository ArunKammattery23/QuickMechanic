import 'package:flutter/material.dart';
import 'admin_api.dart';
import 'admin_ui.dart';

class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key, required this.api, required this.onSignOut});
  final AdminApi api;
  final VoidCallback onSignOut;
  @override State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}
class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  final _current = TextEditingController(), _next = TextEditingController(), _confirm = TextEditingController();
  String? _error;
  bool _busy = false;
  @override void dispose() { _current.dispose(); _next.dispose(); _confirm.dispose(); super.dispose(); }
  Future<void> _change() async {
    if (_busy) return;
    if (_next.text.length < 8 || _next.text != _confirm.text) { setState(() => _error = 'New password must be at least 8 characters and match confirmation.'); return; }
    setState(() { _busy = true; _error = null; });
    try {
      await widget.api.request('/auth/admin/me/password', method: 'PATCH', body: {'currentPassword': _current.text, 'newPassword': _next.text});
      _current.clear(); _next.clear(); _confirm.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed. Sign in again.')));
        Navigator.pop(context);
        widget.onSignOut();
      }
    } catch (error) { if (mounted) setState(() => _error = '$error'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Settings')), body: ListView(padding: const EdgeInsets.all(16), children: [
    const AdminHero(icon: Icons.tune_rounded, eyebrow: 'Account controls', title: 'Settings', subtitle: 'Manage your password and this device session.'),
    const SizedBox(height: 16),
    AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('Security', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
      const SizedBox(height: 5), const Text('Change your password regularly. You will sign in again afterward.', style: TextStyle(color: AdminColors.muted)),
      const SizedBox(height: 18),
      TextField(controller: _current, obscureText: true, decoration: adminInput('Current password', icon: Icons.lock_outline)),
      const SizedBox(height: 11),
      TextField(controller: _next, obscureText: true, decoration: adminInput('New password', icon: Icons.key_rounded)),
      const SizedBox(height: 11),
      TextField(controller: _confirm, obscureText: true, decoration: adminInput('Confirm new password', icon: Icons.key_rounded)),
      if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Color(0xFFFF8C86)))),
      const SizedBox(height: 18),
      FilledButton(onPressed: _busy ? null : _change, child: const Text('Change password')),
    ])),
    const SizedBox(height: 13),
    AdminPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Connection', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
      const SizedBox(height: 7),
      SelectableText(AdminApi.baseUrl, style: const TextStyle(color: AdminColors.cyan)),
      const SizedBox(height: 6),
      const Text('The Android test app needs the API reachable from this phone.', style: TextStyle(color: AdminColors.muted)),
    ])),
    const SizedBox(height: 13),
    OutlinedButton.icon(onPressed: () { Navigator.pop(context); widget.onSignOut(); }, icon: const Icon(Icons.logout_rounded), label: const Text('Sign out of this device')),
  ]));
}
