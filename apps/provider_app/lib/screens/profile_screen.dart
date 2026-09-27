import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../services/api_service.dart';
import 'wallet_history_screen.dart';
import 'kyc_verification_screen.dart';
import 'support_screen.dart';

const _navy = Color(0xFF07192D);
const _teal = Color(0xFF1BC5AD);
const _muted = Color(0xFF667B8D);

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  bool? _kycSubmitted;
  String? _token, _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await ApiService.getToken();
      if (token == null || token.isEmpty) {
        throw Exception('Please sign in again');
      }
      final response = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/users/me'), headers: {
        'Authorization': 'Bearer $token'
      }).timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) {
        throw Exception('Unable to load your profile (${response.statusCode})');
      }
      bool? submitted;
      try {
        final kycResponse = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/users/me/kyc'),
          headers: {'Authorization': 'Bearer $token'},
        ).timeout(const Duration(seconds: 15));
        if (kycResponse.statusCode == 200) {
          submitted = (jsonDecode(kycResponse.body) as Map<String, dynamic>)['submitted'] == true;
        }
      } catch (_) {
        // Keep the account page available when KYC status is temporarily unavailable.
      }
      if (mounted) {
        setState(() {
          _token = token;
          _profile = jsonDecode(response.body) as Map<String, dynamic>;
          _kycSubmitted = submitted;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _value(String key) {
    final value = _profile?[key]?.toString().trim() ?? '';
    return value.isEmpty ? 'Not provided' : value;
  }

  void _openHistory() {
    if (_token == null) return;
    Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => WalletHistoryScreen(token: _token!, provider: true)));
  }

  Future<void> _openKyc() async {
    if (_token == null) return;
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => KycVerificationScreen(token: _token!)));
    if (mounted) await _load();
  }

  Future<void> _editMobile() async {
    var mobile = _profile?['phoneNumber']?.toString() ?? '';
    final value = await showDialog<String>(
        context: context,
        builder: (dialog) => AlertDialog(
              title: const Text('Mobile number'),
              content: TextFormField(
                  initialValue: mobile,
                  keyboardType: TextInputType.phone,
                  maxLength: 16,
                  onChanged: (text) => mobile = text,
                  decoration: const InputDecoration(
                      labelText: 'Mobile number', hintText: '10 to 15 digits')),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialog),
                    child: const Text('Cancel')),
                FilledButton(
                    onPressed: () => Navigator.pop(dialog, mobile.trim()),
                    child: const Text('Save')),
              ],
            ));
    if (value == null || !mounted) return;
    if (!RegExp(r'^\+?[1-9]\d{9,14}$').hasMatch(value)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Enter a valid 10 to 15 digit mobile number')));
      return;
    }
    try {
      final response = await http
          .patch(Uri.parse('${ApiConfig.baseUrl}/users/me/mobile'),
              headers: {
                'Authorization': 'Bearer $_token',
                'Content-Type': 'application/json'
              },
              body: jsonEncode({'phoneNumber': value}))
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) {
        final body = jsonDecode(response.body);
        throw Exception(body['message'] ?? 'Unable to save mobile number');
      }
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Mobile number saved')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final badges = (_profile?['earnedBadges'] as List?) ?? const [];
    final kyc = _profile?['kycStatus']?.toString() ?? 'NOT_SUBMITTED';
    final verified = kyc.toUpperCase() == 'APPROVED';
    return Scaffold(
      backgroundColor: const Color(0xFFF3F7FA),
      appBar: AppBar(
          backgroundColor: _navy,
          foregroundColor: Colors.white,
          title: const Text('My profile',
              style: TextStyle(fontWeight: FontWeight.w800)),
          actions: [
            IconButton(
                onPressed: _loading ? null : _load,
                tooltip: 'Refresh profile',
                icon: const Icon(Icons.refresh_rounded))
          ]),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 36),
            children: [
              if (_loading) const LinearProgressIndicator(),
              if (_error != null)
                _card(Row(children: [
                  const Icon(Icons.error_outline, color: Colors.redAccent),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_error!)),
                  TextButton(onPressed: _load, child: const Text('Retry')),
                ])),
              if (_profile == null && !_loading)
                const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('Profile unavailable. Pull down to retry.')),
              if (_profile != null) ...[
                Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [_navy, Color(0xFF16425B)]),
                        borderRadius: BorderRadius.circular(26)),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            CircleAvatar(
                                radius: 29,
                                backgroundColor: const Color(0xFF225D68),
                                child: Text(
                                    _value('name')
                                        .substring(0, 1)
                                        .toUpperCase(),
                                    style: const TextStyle(
                                        fontSize: 26,
                                        fontWeight: FontWeight.w900,
                                        color: Colors.white))),
                            const SizedBox(width: 14),
                            Expanded(
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                  Text(_value('name'),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 21,
                                          fontWeight: FontWeight.w900)),
                                  const SizedBox(height: 3),
                                  const Text('SERVICE PROVIDER',
                                      style: TextStyle(
                                          color: Color(0xFF8BE8D8),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 1.2)),
                                ])),
                          ]),
                          const SizedBox(height: 18),
                          Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 9),
                              decoration: BoxDecoration(
                                  color: verified
                                      ? const Color(0xFF155B50)
                                      : const Color(0xFF4D4634),
                                  borderRadius: BorderRadius.circular(12)),
                              child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                        verified
                                            ? Icons.verified_rounded
                                            : Icons.info_outline_rounded,
                                        color: verified
                                            ? const Color(0xFF78EDD7)
                                            : const Color(0xFFFFD582),
                                        size: 18),
                                    const SizedBox(width: 7),
                                    Text(
                                        verified
                                            ? 'Identity verified'
                                            : 'Verification: ${kyc.replaceAll('_', ' ').toLowerCase()}',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w700)),
                                  ])),
                        ])),
                const SizedBox(height: 20),
                if (!verified ||
                    !RegExp(r'^\+?[1-9]\d{9,14}$')
                        .hasMatch(_value('phoneNumber'))) ...[
                  _card(const Row(children: [
                    Icon(Icons.lock_person_outlined, color: Color(0xFFC1762A)),
                    SizedBox(width: 12),
                    Expanded(
                        child: Text(
                            'Jobs stay locked until your mobile number is filled in and an admin approves your ID photos and address. Open Identity verification below to submit.',
                            style: TextStyle(color: _navy))),
                  ])),
                  const SizedBox(height: 20),
                ],
                _section('Identity verification'),
                _card(InkWell(
                    onTap: _openKyc,
                    child: Row(children: [
                      _icon(Icons.badge_outlined),
                      const SizedBox(width: 13),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(
                                verified
                                    ? 'KYC approved'
                                    : kyc.toUpperCase() == 'PENDING' && _kycSubmitted == true
                                        ? 'KYC awaiting review'
                                        : kyc.toUpperCase() == 'REJECTED'
                                            ? 'KYC rejected — resubmit'
                                            : 'Submit ID photos & address',
                                style: const TextStyle(
                                    color: _navy,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            const Text(
                                'Front and back ID photos, address, secondary number',
                                style: TextStyle(color: _muted, fontSize: 12)),
                          ])),
                      const Icon(Icons.chevron_right_rounded, color: _muted),
                    ]))),
                const SizedBox(height: 20),
                _section('Your account'),
                _card(Column(children: [
                  Row(children: [
                    Expanded(
                        child: _detail(Icons.phone_outlined, 'Mobile',
                            _value('phoneNumber'))),
                    TextButton(
                        onPressed: _editMobile, child: const Text('Edit')),
                  ]),
                  const Divider(height: 22),
                  _detail(Icons.email_outlined, 'Email', _value('email')),
                ])),
                const SizedBox(height: 20),
                _section('Earnings & records'),
                _card(InkWell(
                    onTap: _token == null ? null : () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => SupportScreen(token: _token!))),
                    child: const Row(children: [
                      Icon(Icons.support_agent_outlined, color: _teal),
                      SizedBox(width: 13),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Help & support', style: TextStyle(color: _navy, fontSize: 16, fontWeight: FontWeight.w800)),
                        SizedBox(height: 4),
                        Text('Ask the guide, raise a ticket and message support', style: TextStyle(color: _muted, fontSize: 12)),
                      ])),
                      Icon(Icons.chevron_right_rounded, color: _muted),
                    ]))),
                const SizedBox(height: 12),
                _card(InkWell(
                    onTap: _openHistory,
                    child: Row(children: [
                      _icon(Icons.account_balance_wallet_rounded),
                      const SizedBox(width: 13),
                      const Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text('Wallet & transaction history',
                                style: TextStyle(
                                    color: _navy,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                            SizedBox(height: 4),
                            Text('Balance, job payments, refunds & withdrawals',
                                style: TextStyle(color: _muted, fontSize: 12)),
                          ])),
                      const Icon(Icons.chevron_right_rounded, color: _muted),
                    ]))),
                const SizedBox(height: 20),
                _section('Performance badges'),
                if (badges.isEmpty)
                  _card(const Row(children: [
                    Icon(Icons.workspace_premium_outlined, color: _teal),
                    SizedBox(width: 12),
                    Expanded(
                        child: Text(
                            'Complete jobs and earn great reviews to unlock badges.',
                            style: TextStyle(color: _muted))),
                  ]))
                else
                  ...badges.map((badge) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _card(Row(children: [
                          _icon(Icons.workspace_premium_rounded),
                          const SizedBox(width: 12),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text('${badge['name'] ?? 'Badge'}',
                                    style: const TextStyle(
                                        color: _navy,
                                        fontWeight: FontWeight.w800)),
                                if (badge['description'] != null)
                                  Text('${badge['description']}',
                                      style: const TextStyle(color: _muted)),
                              ])),
                        ])),
                      )),
              ],
            ],
          )),
    );
  }

  Widget _section(String title) => Padding(
      padding: const EdgeInsets.fromLTRB(2, 0, 0, 10),
      child: Text(title,
          style: const TextStyle(
              color: _navy, fontSize: 17, fontWeight: FontWeight.w900)));

  Widget _card(Widget child) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [
            BoxShadow(
                color: Color(0x1007192D), blurRadius: 18, offset: Offset(0, 6))
          ]),
      child: child);

  Widget _icon(IconData icon) => Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
          color: const Color(0xFFE4F7F3),
          borderRadius: BorderRadius.circular(13)),
      child: Icon(icon, color: const Color(0xFF0B9580)));

  Widget _detail(IconData icon, String label, String value) => Row(children: [
        Icon(icon, color: const Color(0xFF0B9580)),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: _muted, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(
                  color: _navy, fontSize: 15, fontWeight: FontWeight.w700)),
        ])),
      ]);
}
