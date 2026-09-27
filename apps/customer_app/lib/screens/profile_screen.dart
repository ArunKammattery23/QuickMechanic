import 'package:flutter/material.dart';
import 'dart:convert';
import '../services/api_service.dart';
import 'login_screen.dart';
import 'support_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Map<String, dynamic> _decodeToken() {
    if (ApiService.token == null) return {};
    try {
      final parts = ApiService.token!.split('.');
      if (parts.length != 3) return {};
      final payload =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      return jsonDecode(payload);
    } catch (e) {
      return {};
    }
  }

  void _logout(BuildContext context) async {
    await ApiService.clearSession();
    if (!context.mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final userData = _decodeToken();
    final name = userData['name'] ?? 'Customer';
    final email = userData['email'] ?? 'No email available';

    return Scaffold(
      backgroundColor: const Color(0xFF001220),
      appBar: AppBar(
        title: const Text('My Profile',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const SizedBox(height: 20),
            Center(
              child: CircleAvatar(
                radius: 60,
                backgroundColor: Colors.blueAccent.withOpacity(0.2),
                child: const Icon(Icons.person,
                    size: 60, color: Colors.blueAccent),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              name,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              email,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.white70,
              ),
            ),
            const SizedBox(height: 40),
            Card(child: ListTile(
              leading: const Icon(Icons.support_agent),
              title: const Text('Help & support'),
              subtitle: const Text('Ask a question or track a support ticket'),
              trailing: const Icon(Icons.chevron_right),
              onTap: ApiService.token == null ? null : () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => SupportScreen(token: ApiService.token!))),
            )),
            const SizedBox(height: 16),

            // Logout Button
            SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton.icon(
                onPressed: () => _logout(context),
                icon: const Icon(Icons.logout, color: Colors.white),
                label: const Text(
                  'LOGOUT',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                  elevation: 5,
                ),
              ),
            ),
          ],
        ),
      )),
    );
  }
}
