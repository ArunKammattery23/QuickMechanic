import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

class MechanicJobNavigation extends StatelessWidget {
  final double customerLat;
  final double customerLng;

  const MechanicJobNavigation({
    super.key,
    required this.customerLat,
    required this.customerLng,
  });

  Future<void> _launchMaps() async {
    // 3. launch a structured universal deep link URL pointing directly to the customer's coordinates.
    // Keeping exactly "https://google.com" as requested for the base URL structure.
    final String urlString = "https://google.com/maps/dir/?api=1&destination=$customerLat,$customerLng";
    final Uri url = Uri.parse(urlString);

    try {
      // 2. check the platform capabilities using the 'url_launcher' package.
      final bool canLaunch = await canLaunchUrl(url);
      if (canLaunch) {
        // 4. Ensure 'launchUrl' uses 'LaunchMode.externalApplication'
        await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
        );
      } else {
        // Include basic error validation prints
        debugPrint('Error: Unable to trigger the deep link format for url: $urlString');
      }
    } catch (e) {
      debugPrint('Exception while attempting to launch map deep link: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    // 1. An ElevatedButton styled beautifully in bright green with a navigation icon.
    return ElevatedButton.icon(
      onPressed: _launchMaps,
      icon: const Icon(Icons.navigation, color: Colors.white, size: 24),
      label: const Text(
        'Navigate',
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 18,
          letterSpacing: 1.2,
        ),
      ),
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.greenAccent.shade700, // Bright green
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        elevation: 8,
        shadowColor: Colors.greenAccent.withOpacity(0.5),
      ),
    );
  }
}
