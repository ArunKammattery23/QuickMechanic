import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'admin_api.dart';
import 'support_tab.dart';
import 'kyc_tab.dart';
import 'finance_tab.dart';
import 'admin_ui.dart';
import 'dashboard_tab.dart';
import 'profile_screen.dart';
import 'settings_screen.dart';

void main() => runApp(const QuickMechanicAdmin());

class QuickMechanicAdmin extends StatelessWidget {
  const QuickMechanicAdmin({super.key});
  @override Widget build(BuildContext context) => MaterialApp(
    title: 'QuickMechanic Admin', debugShowCheckedModeBanner: false,
    theme: ThemeData(
      brightness: Brightness.dark, useMaterial3: true,
      scaffoldBackgroundColor: AdminColors.background,
      colorScheme: ColorScheme.fromSeed(seedColor: AdminColors.cyan, brightness: Brightness.dark, surface: AdminColors.surface),
      appBarTheme: const AppBarTheme(backgroundColor: AdminColors.background, foregroundColor: Colors.white, elevation: 0, centerTitle: false),
      navigationBarTheme: NavigationBarThemeData(backgroundColor: AdminColors.surface,
        indicatorColor: AdminColors.cyan.withOpacity(.18),
        labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        backgroundColor: AdminColors.mint, foregroundColor: AdminColors.background,
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        minimumSize: const Size.fromHeight(52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)))),
      inputDecorationTheme: InputDecorationTheme(
        labelStyle: const TextStyle(color: AdminColors.muted),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(15))),
    ),
    home: const AdminGate(),
  );
}

class AdminGate extends StatefulWidget {
  const AdminGate({super.key});
  @override State<AdminGate> createState() => _AdminGateState();
}
class _AdminGateState extends State<AdminGate> {
  final _email = TextEditingController(), _password = TextEditingController();
  AdminApi? _api;
  String? _role, _error;
  bool _busy = false;
  int _tab = 0;
  bool _restoring = true;
  @override void dispose() { _email.dispose(); _password.dispose(); super.dispose(); }

  static const _tokenKey = 'admin_jwt', _roleKey = 'admin_role', _userKey = 'admin_last_user';
  static const _adminRoles = ['SUPER_ADMIN', 'MANAGER', 'CEO'];

  @override void initState() { super.initState(); _restore(); }

  // Reopen straight into the console while the saved session is unexpired;
  // the username field is prefilled either way.
  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _email.text = prefs.getString(_userKey) ?? '';
      final token = prefs.getString(_tokenKey), role = prefs.getString(_roleKey);
      if (token != null && _adminRoles.contains(role) && _unexpired(token)) {
        _api = AdminApi(token: token); _role = role;
      } else if (token != null) {
        await prefs.remove(_tokenKey); await prefs.remove(_roleKey);
      }
    } catch (_) {}
    if (mounted) setState(() => _restoring = false);
  }

  static bool _unexpired(String token) {
    try {
      final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(token.split('.')[1]))));
      return (payload['exp'] as num) * 1000 > DateTime.now().millisecondsSinceEpoch;
    } catch (_) { return false; }
  }

  Future<void> _login() async {
    if (_busy || _email.text.trim().isEmpty || _password.text.isEmpty) return;
    setState(() { _busy = true; _error = null; });
    try {
      final result = await AdminApi.login(_email.text, _password.text);
      final role = result['role']?.toString();
      final token = result['accessToken']?.toString();
      if (!['SUPER_ADMIN','MANAGER','CEO'].contains(role) || token == null || token.isEmpty) {
        throw Exception('This account does not have admin app access');
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      await prefs.setString(_roleKey, role!);
      await prefs.setString(_userKey, _email.text.trim());
      // Lets the phone's password manager offer to save this login.
      TextInput.finishAutofillContext();
      if (mounted) setState(() { _api = AdminApi(token: token); _role = role; _password.clear(); _tab = 0; });
    } catch (error) { if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', '')); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  // Only an explicit sign-out (or password change) forgets the saved session.
  Future<void> _clearSession() async {
    setState(() { _api = null; _role = null; _tab = 0; });
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey); await prefs.remove(_roleKey);
  }

  Future<void> _confirmSignOut() async {
    final ok = await showDialog<bool>(context: context, builder: (dialog) => AlertDialog(
      title: const Text('Sign out?'),
      content: const Text('You will need your username and password to sign in again.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('Sign out')),
      ],
    ));
    if (ok == true && mounted) _clearSession();
  }

  @override Widget build(BuildContext context) {
    if (_restoring) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_api == null) {
      return Scaffold(
      body: Container(decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF10374A), AdminColors.background, Color(0xFF071624)])), child: SafeArea(child: Center(child: SingleChildScrollView(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: AdminColors.mint.withOpacity(.14), borderRadius: BorderRadius.circular(22), border: Border.all(color: AdminColors.mint.withOpacity(.35))), child: const Icon(Icons.admin_panel_settings_rounded, size: 43, color: AdminColors.mint)),
          const SizedBox(height: 20),
          const Text('QuickMechanic', style: TextStyle(color: Colors.white, fontSize: 29, fontWeight: FontWeight.w900, letterSpacing: -.5)),
          const Text('ADMIN CONSOLE', style: TextStyle(color: AdminColors.mint, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 3)),
          const SizedBox(height: 30),
          AdminPanel(child: AutofillGroup(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Welcome back', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800)),
            const SizedBox(height: 5),
            const Text('Sign in to manage support, providers and payments.', style: TextStyle(color: AdminColors.muted, height: 1.4)),
            const SizedBox(height: 24),
            TextField(controller: _email, keyboardType: TextInputType.text, autofillHints: const [AutofillHints.username], decoration: adminInput('Username, email or mobile', icon: Icons.person_outline)),
            const SizedBox(height: 14),
            TextField(controller: _password, obscureText: true, autofillHints: const [AutofillHints.password], onSubmitted: (_) => _login(), decoration: adminInput('Password', icon: Icons.lock_outline)),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Color(0xFFFF8C86)))),
            const SizedBox(height: 22),
            FilledButton.icon(onPressed: _busy ? null : _login, icon: const Icon(Icons.arrow_forward_rounded), label: Text(_busy ? 'Signing in…' : 'Sign in securely')),
          ]))),
          const SizedBox(height: 18),
          const Text('Authorized administrators only', style: TextStyle(color: AdminColors.muted, fontSize: 12)),
        ]))))))),
      );
    }
    final role = _role!;
    final kycIndex = role == 'SUPER_ADMIN' || role == 'MANAGER' ? 2 : null;
    final financeIndex = role == 'SUPER_ADMIN' || role == 'CEO' ? (kycIndex == null ? 2 : 3) : null;
    final items = <_AdminPage>[
      _AdminPage('Dashboard', Icons.space_dashboard_outlined, DashboardTab(
        api: _api!, role: role,
        onSupport: () => setState(() => _tab = 1),
        onKyc: kycIndex == null ? null : () => setState(() => _tab = kycIndex),
        onFinance: financeIndex == null ? null : () => setState(() => _tab = financeIndex),
      )),
      _AdminPage('Support', Icons.support_agent_outlined, SupportTab(api: _api!)),
      if (role == 'SUPER_ADMIN' || role == 'MANAGER') _AdminPage('Provider KYC', Icons.verified_user_outlined, KycTab(api: _api!)),
      if (role == 'SUPER_ADMIN' || role == 'CEO') _AdminPage('Finance', Icons.account_balance_wallet_outlined, FinanceTab(api: _api!)),
    ];
    if (_tab >= items.length) _tab = 0;
    return Scaffold(
      appBar: AppBar(title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('QUICKMECHANIC  /  ADMIN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.5, color: AdminColors.mint)), Text(items[_tab].title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800))]), actions: [
        IconButton(tooltip: 'Profile', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AdminProfileScreen(api: _api!))), icon: const Icon(Icons.account_circle_outlined)),
        IconButton(tooltip: 'Settings', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AdminSettingsScreen(api: _api!, onSignOut: _clearSession))), icon: const Icon(Icons.settings_outlined)),
        IconButton(tooltip: 'Sign out', onPressed: _confirmSignOut, icon: const Icon(Icons.logout_rounded)),
      ]),
      body: items[_tab].body,
      bottomNavigationBar: NavigationBar(selectedIndex: _tab, onDestinationSelected: (index) => setState(() => _tab = index), destinations: [for (final item in items) NavigationDestination(icon: Icon(item.icon), label: item.title)]),
    );
  }
}
class _AdminPage {
  const _AdminPage(this.title, this.icon, this.body);
  final String title;
  final IconData icon;
  final Widget body;
}
