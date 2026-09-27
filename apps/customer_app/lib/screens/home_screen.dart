import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'wallet_history_screen.dart';
import 'package:flutter/material.dart';
import 'dart:ui';
import '../services/api_service.dart';
import 'package:flutter/services.dart';
import 'map_screen.dart';
import 'mechanic_list_screen.dart';
import 'profile_screen.dart';

import 'package:geolocator/geolocator.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _selectedCategory;
  bool _isRequesting = false;

  List<Map<String, dynamic>> _services = [];
  String? _servicesError;

  Future<void> _confirmExit() async {
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF001220),
        title: const Text('Exit app', style: TextStyle(color: Colors.white)),
        content: const Text('Do you want to close the app?',
            style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Exit'),
          ),
        ],
      ),
    );
    if (shouldExit == true && mounted) SystemNavigator.pop();
  }
  @override
  void initState() {
    super.initState();
    _loadServices();
    WidgetsBinding.instance.addPostFrameCallback((_) => _restoreJob());
  }

  Future<void> _restoreJob() async {
    try {
      final r = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/dispatch/customer-active-job'),
          headers: {
            'Authorization': 'Bearer ${ApiService.token}'
          }).timeout(const Duration(seconds: 15));
      if (!mounted) return;
      if (r.statusCode != 200) throw Exception('Could not restore your job');
      final job = jsonDecode(r.body)['job'];
      if (job == null) return;
      final coordinates = job['breakdownLocation']?['coordinates'];
      await Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) =>
                  job['status'] == 'REQUESTED' || coordinates == null
                      ? JobHistoryDetailScreen(
                          token: ApiService.token!,
                          jobId: job['id'],
                          provider: false)
                      : MapScreen(
                          mechanicId: job['mechanicId'],
                          jobId: job['id'],
                          customerLat: (coordinates[1] as num).toDouble(),
                          customerLng: (coordinates[0] as num).toDouble(),
                          mechanicPhone: job['mechanicPhone'] ?? 'Unknown')));
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                const Text('Unable to restore your active job. Please retry.'),
            action: SnackBarAction(label: 'Retry', onPressed: _restoreJob)));
    }
  }

  Future<void> _loadServices() async {
    try {
      final response = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/services'))
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) throw Exception('Services unavailable');
      if (!mounted) return;
      setState(() {
        _services = (jsonDecode(response.body) as List)
            .map((s) => <String, dynamic>{
                  'id': s['name'],
                  'name': s['name'],
                  'icon': Icons.build,
                  'color': Colors.blueAccent
                })
            .toList();
        _servicesError = null;
      });
    } catch (_) {
      if (mounted)
        setState(() =>
            _servicesError = 'Unable to load services. Tap refresh to retry.');
    }
  }

  Future<Position?> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content:
              Text('Location services are disabled. Please enable them.')));
      return null;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permissions are denied.')));
        return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Location permissions are permanently denied, we cannot request permissions.')));
      return null;
    }

    try {
      return await Geolocator.getCurrentPosition(
        timeLimit: const Duration(seconds: 10),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed to get location. Make sure GPS is enabled.')));
      return null;
    }
  }

  Future<void> _requestMechanic() async {
    if (_selectedCategory == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a service first.')),
      );
      return;
    }

    setState(() {
      _isRequesting = true;
    });

    final Position? position = await _determinePosition();
    if (position == null) {
      setState(() {
        _isRequesting = false;
      });
      return; // Failed to get location
    }

    final double lat = position.latitude;
    final double lng = position.longitude;

    try {
      final result =
          await ApiService.getNearbyMechanics(_selectedCategory!, lat, lng);

      setState(() {
        _isRequesting = false;
      });

      if (result['success'] &&
          result['data'] != null &&
          result['data']['success'] == true) {
        final List<dynamic> mechanics = result['data']['data'] ?? [];
        // Navigate to mechanic list screen
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => MechanicListScreen(
              mechanics: mechanics,
              categoryId: _selectedCategory!,
              lat: lat,
              lng: lng,
            ),
          ),
        );
      } else {
        String errorMessage = 'Failed to find mechanics.';
        if (result['message'] != null) {
          errorMessage = result['message'];
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMessage)),
        );
      }
    } catch (e) {
      setState(() {
        _isRequesting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('An error occurred: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) async {
        if (didPop) return;
        await _confirmExit();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF001220),
        appBar: AppBar(
          leading: IconButton(
            tooltip: 'Back',
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: _confirmExit,
          ),
          title: const Text('Need Help?',
              style:
                  TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
          backgroundColor: Colors.transparent,
          elevation: 0,
          centerTitle: false,
          actions: [
            IconButton(
                tooltip: 'Resume active job',
                icon: const Icon(Icons.restore),
                onPressed: _restoreJob),
            IconButton(
                tooltip: 'Wallet & job history',
                icon: const Icon(Icons.history),
                onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => WalletHistoryScreen(
                            token: ApiService.token ?? '', provider: false)))),
            IconButton(
              icon: const Icon(Icons.person, color: Colors.blueAccent),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (context) => const ProfileScreen()),
                );
              },
            )
          ],
        ),
        body: Stack(
          children: [
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'What seems to be the problem?',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (_servicesError != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Row(children: [
                        Expanded(child: Text(_servicesError!,
                            style: const TextStyle(color: Colors.white70))),
                        TextButton.icon(
                          onPressed: _loadServices,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ]),
                    ),
                  Expanded(
                    child: GridView.builder(
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 1.1,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                      ),
                      itemCount: _services.length,
                      itemBuilder: (context, index) {
                        final service = _services[index];
                        final isSelected = _selectedCategory == service['id'];

                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _selectedCategory = service['id'];
                            });
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? service['color'].withOpacity(0.2)
                                  : Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSelected
                                    ? service['color']
                                    : Colors.white.withOpacity(0.1),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  service['icon'],
                                  size: 48,
                                  color: isSelected
                                      ? service['color']
                                      : Colors.white70,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  service['name'],
                                  style: TextStyle(
                                    color: isSelected
                                        ? Colors.white
                                        : Colors.white70,
                                    fontWeight: isSelected
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    height: 60,
                    margin: const EdgeInsets.only(bottom: 20),
                    child: ElevatedButton(
                      onPressed: _isRequesting ? null : _requestMechanic,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _selectedCategory != null
                            ? Colors.blueAccent
                            : Colors.grey[800],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        elevation: _selectedCategory != null ? 8 : 0,
                      ),
                      child: _isRequesting
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                      color: Colors.white, strokeWidth: 2),
                                ),
                                SizedBox(width: 16),
                                Text('FINDING MECHANIC...',
                                    style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.5)),
                              ],
                            )
                          : const Text(
                              'REQUEST ASSISTANCE',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.5),
                            ),
                    ),
                  ),
                ],
              ),
            ),
            if (_isRequesting)
              Positioned.fill(
                child: ClipRRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
                    child: Container(
                      color: Colors.black.withOpacity(0.4),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
