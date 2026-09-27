import '../widgets/service_price_field.dart';
import '../widgets/service_selector.dart';
import '../services/service_config_loader.dart';
import '../widgets/quote_editor.dart';
import 'wallet_history_screen.dart';
import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import '../services/socket_service.dart';
import '../config/api_config.dart';
import 'dart:ui';
import 'profile_screen.dart';
import 'active_job_screen.dart';
import 'login_screen.dart';
import 'package:flutter/services.dart';
import '../services/background_service.dart';
import '../services/api_service.dart';
import '../services/call_service.dart';
import 'package:vibration/vibration.dart';

enum JobState { idle, accepted, enRoute }

class DashboardScreen extends StatefulWidget {
  final String token;

  const DashboardScreen({Key? key, required this.token}) : super(key: key);

  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with WidgetsBindingObserver {
  final SocketService _socketService = SocketService();
  bool isOnline = false;
  bool _incomingVisible = false;
  final Set<String> _seenRequests = {};
  late String mechanicId;

  List<dynamic> _availableServices = [];
  List<dynamic> _availableVehicles = [];

  List<String> _selectedServices = [];
  List<String> _selectedVehicles = [];

  final Map<String, TextEditingController> _pricingControllers = {};

  bool _isLoadingData = true;
  String? _configError;
  int _commissionBps = 0, _platformFeeMinor = 0;

  // Daily Stats Data
  int _requestsReceived = 0;
  int _requestsAccepted = 0;
  double _dailyEarnings = 0.0;
  double _walletBalance = 0.0;

  // Premium Milestone Tracking
  int _totalCompletedJobs = 0;
  bool _hasPremiumSubscription = false;
  List<Map<String, dynamic>> _earnedBadges = [];
  bool _changingStatus = false;

  // Environment State

  // Active Job State
  JobState _currentJobState = JobState.idle;
  String? _activeJobId;
  Timer? _activeJobTimer;

  Future<bool> _restoreActiveJob() async {
    final response = await http
        .get(Uri.parse('${ApiConfig.baseUrl}/dispatch/active-job'), headers: {
      'Authorization': 'Bearer ${widget.token}'
    }).timeout(const Duration(seconds: 15));
    if (response.statusCode != 200)
      throw Exception('Unable to check active jobs');
    final job = jsonDecode(response.body)['job'];
    if (!mounted) return false;
    setState(() {
      _activeJobId = job?['id'];
      _currentJobState = job == null ? JobState.idle : JobState.accepted;
    });
    return job != null;
  }

  Future<void> _openActiveJob() async {
    if (_activeJobId == null) return;
    await Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => JobHistoryDetailScreen(
                token: widget.token, jobId: _activeJobId!, provider: true)));
    if (mounted) await _recoverRequests();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    try {
      final parts = widget.token.split('.');
      if (parts.length == 3) {
        final payload = json.decode(
            utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
        mechanicId = payload['sub'];
      }
    } catch (e) {
      mechanicId = 'unknown';
    }

    _socketService.connect(widget.token);

    CallService().init('MECHANIC');

    // Listen for real incoming jobs
    _socketService.socket?.on('new_job_request', (data) {
      if (mounted) {
        _showRealIncomingJob(data);
      }
    });

    _fetchConfigData();
    _fetchDailyStats();
    _recoverRequests();
    _activeJobTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      try {
        await _restoreActiveJob();
      } catch (_) {/* Retry after reconnect. */}
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _fetchDailyStats();
      _recoverRequests();
    }
  }

  Future<void> _recoverRequests() async {
    try {
      if (await _restoreActiveJob()) return;
      final response = await http.get(
          Uri.parse(
              '${ApiConfig.baseUrl}/users/mechanics/$mechanicId/requests'),
          headers: {'Authorization': 'Bearer ${widget.token}'});
      if (!mounted || response.statusCode != 200 || _incomingVisible) return;
      for (final request in jsonDecode(response.body) as List) {
        if (!_seenRequests.contains(request['jobId'])) {
          _showRealIncomingJob(request);
          break;
        }
      }
    } catch (_) {/* Reconnect/resume retries persisted requests. */}
  }

  Future<void> _fetchConfigData() async {
    if (!mounted) return;
    setState(() {
      _isLoadingData = true;
      _configError = null;
    });
    try {
      final data =
          await loadServiceConfig(ApiConfig.baseUrl, mechanicId, widget.token);
      final pricingResponse = await http
          .get(Uri.parse(ApiConfig.baseUrl + '/dispatch/pricing'), headers: {
        'Authorization': 'Bearer ' + widget.token
      }).timeout(const Duration(seconds: 15));
      if (pricingResponse.statusCode == 401) {
        await ApiService.clearToken();
        if (!mounted) return;
        _socketService.socket?.disconnect();
        Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => LoginScreen()), (_) => false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Your session expired. Please sign in again.')));
        return;
      }
      if (pricingResponse.statusCode != 200)
        throw Exception(
            'Unable to load current commission (HTTP ${pricingResponse.statusCode}). Please retry.');
      final policy = jsonDecode(pricingResponse.body);
      if (!mounted) return;
      setState(() {
        _commissionBps = (policy['commissionBps'] as num).toInt();
        _platformFeeMinor = int.parse(policy['platformFeeMinor'].toString());
        _availableServices = data.services;
        _availableVehicles = data.vehicles;
        _selectedServices = List<String>.from(data.saved['services'] ?? []);
        _selectedVehicles = List<String>.from(data.saved['vehicles'] ?? []);
        for (final controller in _pricingControllers.values) {
          controller.dispose();
        }
        _pricingControllers.clear();
        _initializePricingControllers();
        for (final price in data.saved['pricing'] ?? []) {
          final key = price['serviceId'].toString() +
              '_' +
              price['vehicleId'].toString();
          _pricingControllers
              .putIfAbsent(key, () => TextEditingController())
              .text = price['price'].toString();
        }
      });
    } catch (e) {
      if (mounted)
        setState(
            () => _configError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoadingData = false);
    }
  }

  Future<void> _fetchDailyStats() async {
    try {
      final response = await http.get(
        Uri.parse(
            '${ApiConfig.baseUrl}/users/mechanics/$mechanicId/stats/daily'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (!mounted) return;
        setState(() {
          isOnline = data['isOnline'] == true;
          _earnedBadges = (data['earnedBadges'] as List? ?? [])
              .map((b) => <String, dynamic>{
                    'name': b['name'],
                    'icon': Icons.workspace_premium,
                    'color': Colors.amber
                  })
              .toList();
          _requestsReceived = data['requestsReceived'] ?? 0;
          _requestsAccepted = data['requestsAccepted'] ?? 0;
          _totalCompletedJobs = data['totalCompletedJobs'] ?? 0;
          _hasPremiumSubscription = data['hasPremiumSubscription'] ?? false;

          final dynamic earningsRaw = data['earnings'];
          _dailyEarnings = earningsRaw is int
              ? earningsRaw.toDouble()
              : (earningsRaw as double? ?? 0.0);

          final dynamic walletRaw = data['walletBalance'];
          _walletBalance = walletRaw is int
              ? walletRaw.toDouble()
              : (walletRaw as double? ?? 0.0);
        });
      }
    } catch (e) {
      print('Failed to fetch daily stats: $e');
    }
  }

  @override
  void dispose() {
    _activeJobTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    for (var c in _pricingControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<Position?> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Location services are disabled. Please enable them to go online.')));
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

    return await Geolocator.getCurrentPosition();
  }

  void _toggleOnlineStatus() async {
    if (_changingStatus) return;
    if (!isOnline && (_selectedServices.isEmpty || _selectedVehicles.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Please configure your services and pricing before going online.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      _showWizardBottomSheet();
      return;
    }

    _changingStatus = true;
    final newStatus = !isOnline;
    double? lat;
    double? lng;

    if (newStatus) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Acquiring GPS location...')));
      final position =
          await _determinePosition().catchError((Object _) => null);
      if (position == null) {
        _changingStatus = false;
        return; // Can't go online without location
      }
      lat = position.latitude;
      lng = position.longitude;
    }

    try {
      _changingStatus = true;
      if (newStatus && !await startProviderBackground()) {
        throw Exception('Enable notifications to stay online');
      }
      final response = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/users/mechanics/$mechanicId/status'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'isOnline': newStatus,
          'lat': lat,
          'lng': lng,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (!newStatus) await stopProviderBackground();
        if (!mounted) return;
        setState(() {
          isOnline = newStatus;
        });

        if (isOnline) {
          _socketService.updateLocation(mechanicId, lat!, lng!);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('You are now Online. Broadcasting location.')),
          );
        } else {
          await stopProviderBackground();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('You are Offline.')),
          );
        }
      } else {
        final body = jsonDecode(response.body);
        final message = body is Map ? body['message'] : null;
        throw Exception(
            message is String ? message : 'Failed to update status on server');
      }
    } catch (e) {
      if (newStatus) await stopProviderBackground();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('$e'.replaceFirst('Exception: ', '')),
          backgroundColor: Colors.redAccent,
        ));
    } finally {
      _changingStatus = false;
    }
  }

  // ============== INCOMING JOB (REAL) ==============

  void _showRealIncomingJob(dynamic data) async {
    if (_activeJobId != null) return;
    final String jobId = data['jobId'];
    if (_incomingVisible || _seenRequests.contains(jobId) || !mounted) return;
    _incomingVisible = true;
    _seenRequests.add(jobId);
    if (_seenRequests.length > 200) _seenRequests.remove(_seenRequests.first);
    final String serviceType = data['serviceType'] ?? 'Unknown Service';
    final double lat = data['customerLat']?.toDouble() ?? 0.0;
    final double lng = data['customerLng']?.toDouble() ?? 0.0;
    final String customerId = data['customerId'] ?? '';
    final String customerPhone = data['customerPhone'] ?? 'Unknown';

    // Vibrate repeatedly to act like a ringtone
    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(
          pattern: [500, 1000, 500, 1000, 500, 1000, 500, 1000], repeat: 1);
    }

    await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (BuildContext context) {
          String distanceStr = 'Calculating distance...';
          bool distanceCalculated = false;

          return StatefulBuilder(
            builder: (context, setStateModal) {
              if (!distanceCalculated) {
                distanceCalculated = true;
                _determinePosition().then((pos) {
                  if (pos != null) {
                    final dist = Geolocator.distanceBetween(
                        pos.latitude, pos.longitude, lat, lng);
                    if (mounted) {
                      setStateModal(() {
                        distanceStr =
                            '${(dist / 1000).toStringAsFixed(1)} km away';
                      });
                    }
                  } else {
                    if (mounted) {
                      setStateModal(() {
                        distanceStr = 'Distance unknown';
                      });
                    }
                  }
                });
              }

              return Dialog(
                backgroundColor: Colors.transparent,
                insetPadding: const EdgeInsets.all(20),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF001220),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                        color: Colors.lightBlueAccent.withOpacity(0.5),
                        width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.lightBlueAccent.withOpacity(0.2),
                        blurRadius: 20,
                        spreadRadius: 5,
                      )
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '🚨 NEW REQUEST',
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text(
                        serviceType.replaceAll('_', ' ').toUpperCase(),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.black26,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.location_on,
                                    color: Colors.lightBlueAccent),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    distanceStr,
                                    style: const TextStyle(
                                        color: Colors.white, fontSize: 14),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: TextButton(
                              onPressed: () {
                                Vibration.cancel();
                                Navigator.pop(context);
                              },
                              style: TextButton.styleFrom(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: const BorderSide(color: Colors.white24),
                                ),
                              ),
                              child: const Text('DECLINE',
                                  style: TextStyle(color: Colors.white70)),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton(
                              onPressed: () async {
                                Vibration.cancel();
                                Navigator.pop(
                                    context); // close incoming job dialog

                                ScaffoldMessenger.of(this.context).showSnackBar(
                                    const SnackBar(
                                        content: Text('Accepting job...')));

                                final result = await ApiService.acceptJob(
                                    widget.token, jobId);
                                if (!mounted) return;
                                if (result['success']) {
                                  setState(() {
                                    _activeJobId = jobId;
                                    _currentJobState = JobState.accepted;
                                  });
                                  _showQuoteDialog(
                                    jobId: jobId,
                                    serviceType: serviceType,
                                    lat: lat,
                                    lng: lng,
                                    customerId: customerId,
                                    customerPhone: customerPhone,
                                    distance: 0,
                                    travelingCharge: 0,
                                    serviceCharge: 0,
                                    totalAmount: 0,
                                  );
                                } else {
                                  await _restoreActiveJob();
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(this.context)
                                      .showSnackBar(SnackBar(
                                    content: Text(result['message'] ??
                                        'Failed to accept job'),
                                    backgroundColor: Colors.redAccent,
                                  ));
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.greenAccent,
                                foregroundColor: Colors.black,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: const Text('ACCEPT JOB',
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16)),
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
              );
            },
          );
        });
    _incomingVisible = false;
  }

  void _showQuoteDialog({
    required String jobId,
    required String serviceType,
    required double lat,
    required double lng,
    required String customerId,
    required String customerPhone,
    required double distance,
    required double travelingCharge,
    required double serviceCharge,
    required double totalAmount,
  }) {
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => QuoteEditor(
              token: widget.token,
              jobId: jobId,
              distance: distance,
              onSent: () {
                Navigator.pop(dialogContext);
                _waitForPayment(
                    jobId, serviceType, lat, lng, customerId, customerPhone);
              },
            ));
  }

  void _waitForPayment(String jobId, String serviceType, double lat, double lng,
      String customerId, String customerPhone) {
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return Dialog(
            backgroundColor: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF001220),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                    color: Colors.blueAccent.withOpacity(0.5), width: 2),
              ),
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Colors.blueAccent),
                  SizedBox(height: 24),
                  Text('Waiting for Customer to secure payment...',
                      style: TextStyle(color: Colors.white, fontSize: 16),
                      textAlign: TextAlign.center),
                  SizedBox(height: 8),
                  Text('Do not close this window.',
                      style: TextStyle(color: Colors.white54, fontSize: 12),
                      textAlign: TextAlign.center),
                ],
              ),
            ),
          );
        });

    // Listen for payment secured
    _socketService.socket?.once('payment_secured', (data) {
      if (data['jobId'] == jobId) {
        Navigator.pop(context); // close waiting dialog

        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Payment secured in Escrow. You can start traveling.'),
          backgroundColor: Colors.green,
        ));

        setState(() {
          _currentJobState = JobState.accepted;
        });

        // Start broadcasting GPS to customer
        _socketService.startLocationBroadcast(mechanicId);

        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ActiveJobScreen(
              mechanicId: mechanicId,
              jobId: jobId,
              serviceType: serviceType,
              customerLat: lat,
              customerLng: lng,
              customerId: customerId,
              customerPhone: customerPhone,
            ),
          ),
        );
      }
    });
  }

  // =====================================================

  Future<void> _saveConfig(StateSetter setModalState) async {
    List<Map<String, dynamic>> pricingArray = [];

    for (String sId in _selectedServices) {
      for (String vId in _selectedVehicles) {
        String key = '${sId}_$vId';
        final entered = _pricingControllers[key]?.text.trim() ?? '';
        if (!RegExp(r'^\d{1,8}(\.\d{1,2})?$').hasMatch(entered)) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text(
                  'Enter a valid amount for every selected service and vehicle.')));
          return;
        }
        double price = 0.0;
        if (_pricingControllers.containsKey(key) &&
            _pricingControllers[key]!.text.isNotEmpty) {
          price = double.tryParse(_pricingControllers[key]!.text) ?? 0.0;
        }
        pricingArray.add({
          'serviceId': sId,
          'vehicleId': vId,
          'price': price,
        });
      }
    }

    try {
      final response = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/users/mechanics/$mechanicId/config'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'services': _selectedServices,
          'vehicles': _selectedVehicles,
          'pricing': pricingArray,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Configuration and Pricing updated successfully!'),
              backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      } else {
        throw Exception('Failed to update');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Failed to save settings. Is the backend running?'),
            backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _showWizardBottomSheet() async {
    if (_isLoadingData) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Loading settings... please wait.')),
      );
      return;
    }

    await _fetchConfigData();
    if (!mounted) return;
    if (_configError != null) {
      final retry = await showDialog<bool>(
          context: context,
          builder: (dialog) => AlertDialog(
                  title: const Text('Unable to load services'),
                  content: Text(_configError!),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(dialog, false),
                        child: const Text('Close')),
                    FilledButton(
                        onPressed: () => Navigator.pop(dialog, true),
                        child: const Text('Retry'))
                  ]));
      if (retry == true && mounted) await _showWizardBottomSheet();
      return;
    }

    int currentStep = 0;

    final Map<String, List<dynamic>> groupedVehicles = {};
    for (var v in _availableVehicles) {
      final group = v['group'] as String? ?? 'Other';
      if (!groupedVehicles.containsKey(group)) {
        groupedVehicles[group] = [];
      }
      groupedVehicles[group]!.add(v);
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.9,
              decoration: const BoxDecoration(
                color: Color(0xFF001220),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(30),
                  topRight: Radius.circular(30),
                ),
              ),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 50,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        currentStep == 0
                            ? 'Step 1: Services'
                            : currentStep == 1
                                ? 'Step 2: Vehicles'
                                : 'Step 3: Pricing',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (currentStep > 0)
                        IconButton(
                          icon:
                              const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () {
                            setModalState(() {
                              currentStep--;
                            });
                          },
                        )
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    currentStep == 0
                        ? 'Select one or more services you provide'
                        : currentStep == 1
                            ? 'What types of vehicles are you equipped to service?'
                            : 'Enter the final quotation amount for each service and vehicle. Your earnings are the amount minus commission. The customer pays the platform fee separately.',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Expanded(
                    child: currentStep == 0
                        ? _buildServicesList(setModalState)
                        : currentStep == 1
                            ? _buildVehiclesList(groupedVehicles, setModalState)
                            : _buildPricingMatrix(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        if (currentStep == 0) {
                          if (_selectedServices.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content:
                                        Text('Select at least one service.')));
                            return;
                          }
                          setModalState(() {
                            currentStep = 1;
                          });
                        } else if (currentStep == 1) {
                          if (_selectedVehicles.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text(
                                        'Select at least one vehicle category.')));
                            return;
                          }
                          _initializePricingControllers();
                          setModalState(() {
                            currentStep = 2;
                          });
                        } else {
                          _saveConfig(setModalState);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blueAccent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Text(
                        currentStep < 2 ? 'NEXT STEP' : 'SAVE CONFIGURATION',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildServicesList(StateSetter setModalState) => ServiceSelector(
        services: _availableServices,
        selected: _selectedServices,
        onChanged: (id, selected) => setModalState(() {
          if (selected && !_selectedServices.contains(id)) {
            _selectedServices.add(id);
          }
          if (!selected) {
            _selectedServices.remove(id);
          }
        }),
      );

  Widget _buildVehiclesList(
      Map<String, List<dynamic>> groupedVehicles, StateSetter setModalState) {
    return ListView.builder(
      itemCount: groupedVehicles.keys.length,
      itemBuilder: (context, index) {
        final group = groupedVehicles.keys.elementAt(index);
        final vehicles = groupedVehicles[group]!;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16.0),
              child: Text(
                group,
                style: const TextStyle(
                  color: Colors.lightBlueAccent,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ...vehicles.map((v) {
              final vId = v['id'];
              final vName = v['name'];
              final bool isPremiumTier = v['isPremiumTier'] ?? false;
              final isSelected = _selectedVehicles.contains(vId);

              return CheckboxListTile(
                title: Row(
                  children: [
                    Expanded(
                      child: Text(
                        vName,
                        style: TextStyle(
                            color: isPremiumTier
                                ? Colors.amberAccent
                                : Colors.white),
                      ),
                    ),
                    if (isPremiumTier)
                      const Icon(Icons.star, color: Colors.amber, size: 16),
                  ],
                ),
                activeColor: isPremiumTier ? Colors.amber : Colors.greenAccent,
                checkColor: isPremiumTier ? Colors.black : Colors.white,
                side: BorderSide(
                    color: isPremiumTier
                        ? Colors.amber.withOpacity(0.5)
                        : Colors.white.withOpacity(0.5)),
                value: isSelected,
                onChanged: (bool? value) {
                  if (isPremiumTier && !_hasPremiumSubscription) {
                    // Paywall Lock!
                    _showPaywallDialog();
                    return;
                  }

                  setModalState(() {
                    if (value == true) {
                      _selectedVehicles.add(vId);
                    } else {
                      _selectedVehicles.remove(vId);
                    }
                  });
                },
              );
            }).toList(),
            const Divider(color: Colors.white24),
          ],
        );
      },
    );
  }

  void _initializePricingControllers() {
    for (var sId in _selectedServices) {
      for (var vId in _selectedVehicles) {
        String key = '${sId}_$vId';
        if (!_pricingControllers.containsKey(key)) {
          _pricingControllers[key] = TextEditingController();
        }
      }
    }
  }

  Widget _buildPricingMatrix() {
    final selectedServiceObjects = _availableServices
        .where((s) => _selectedServices.contains(s['id']))
        .toList();
    final selectedVehicleObjects = _availableVehicles
        .where((v) => _selectedVehicles.contains(v['id']))
        .toList();

    return ListView.builder(
      itemCount: selectedServiceObjects.length,
      itemBuilder: (context, sIndex) {
        final service = selectedServiceObjects[sIndex];
        return Card(
          color: Colors.white.withOpacity(0.05),
          margin: const EdgeInsets.only(bottom: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service['name'],
                  style: const TextStyle(
                    color: Colors.lightBlueAccent,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                ...selectedVehicleObjects.map((vehicle) {
                  String key = '${service['id']}_${vehicle['id']}';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          flex: 2,
                          child: Text(
                            vehicle['name'],
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 14),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: ServicePriceField(
                              controller: _pricingControllers[key]!,
                              commissionBps: _commissionBps,
                              platformFeeMinor: _platformFeeMinor),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDailyStatsPanel() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20.0, sigmaY: 20.0),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withOpacity(0.1),
                Colors.white.withOpacity(0.03),
              ],
            ),
            borderRadius: BorderRadius.circular(28),
            border:
                Border.all(color: Colors.white.withOpacity(0.15), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 20,
                spreadRadius: -5,
              )
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Today's Dashboard",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh,
                        color: Colors.lightBlueAccent, size: 20),
                    onPressed: _fetchDailyStats,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  )
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildStatItem("Received", _requestsReceived.toString(),
                      Icons.move_to_inbox_rounded, Colors.orangeAccent),
                  _buildStatItem("Accepted", _requestsAccepted.toString(),
                      Icons.check_circle_outline, Colors.lightBlueAccent),
                  _buildStatItem(
                      "Earnings",
                      "₹${_dailyEarnings.toStringAsFixed(2)}",
                      Icons.currency_rupee,
                      Colors.greenAccent),
                ],
              ),
              if (_totalCompletedJobs >= 100)
                Container(
                  margin: const EdgeInsets.only(top: 16),
                  padding:
                      const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.star, color: Colors.amber, size: 16),
                      SizedBox(width: 4),
                      Text('PREMIUM MECHANIC',
                          style: TextStyle(
                              color: Colors.amber,
                              fontSize: 12,
                              fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              const SizedBox(height: 24),
              const Text("Elite Badges Earned",
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _earnedBadges.map((badge) {
                    return Container(
                      margin: const EdgeInsets.only(right: 12),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: badge['color'].withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: badge['color'].withOpacity(0.5)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(badge['icon'], color: badge['color'], size: 18),
                          const SizedBox(width: 8),
                          Text(
                            badge['name'],
                            style: TextStyle(
                                color: badge['color'],
                                fontWeight: FontWeight.w900,
                                fontSize: 14),
                          )
                        ],
                      ),
                    );
                  }).toList(),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(
      String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(height: 12),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.7),
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  // ===================== MAP EN ROUTE UI =====================
  Widget _buildActiveJobUI() => Card(
      child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            const Text('Manage your confirmed job',
                style: TextStyle(fontSize: 20)),
            FilledButton(
                onPressed: _openActiveJob,
                child: const Text('Open active job')),
            const Text(
                'Completion and payments are updated only after customer approval.'),
            FilledButton(
                onPressed: () async {
                  await Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => WalletHistoryScreen(
                              token: widget.token, provider: true)));
                  if (mounted) {
                    await _recoverRequests();
                    _fetchDailyStats();
                  }
                },
                child: const Text('Settings · Wallet & job history')),
          ])));

  @override
  Widget build(BuildContext context) {
    return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) async {
          if (!didPop) SystemNavigator.pop();
        },
        child: Scaffold(
            body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFF0A192F),
                Color(0xFF001220),
              ],
            ),
          ),
          child: SafeArea(
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Ambient glow in center
                Center(
                  child: Container(
                    width: 300,
                    height: 300,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.blueAccent.withOpacity(0.05),
                          blurRadius: 150,
                          spreadRadius: 50,
                        )
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24.0, vertical: 20.0),
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                        // Custom Header with Notification Bell
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: const Text(
                                'Dashboard',
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            Row(
                              children: [
                                Stack(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.notifications_none,
                                          color: Colors.white, size: 28),
                                      onPressed: () {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                              content:
                                                  Text('No new notifications')),
                                        );
                                      },
                                    ),
                                    // Removed hardcoded notification badge
                                  ],
                                ),
                                IconButton(
                                  icon: const Icon(Icons.person,
                                      color: Colors.blueAccent, size: 28),
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                          builder: (context) =>
                                              const ProfileScreen()),
                                    );
                                  },
                                ),
                                IconButton(
                                  icon: const Icon(Icons.logout,
                                      color: Colors.white70, size: 28),
                                  onPressed: () async {
                                    if (isOnline) {
                                      await http.patch(
                                          Uri.parse(
                                              '${ApiConfig.baseUrl}/users/mechanics/$mechanicId/status'),
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization':
                                                'Bearer ${widget.token}'
                                          },
                                          body:
                                              jsonEncode({'isOnline': false}));
                                    }
                                    await stopProviderBackground();
                                    await ApiService.clearToken();
                                    _socketService.disconnect();
                                    Navigator.pushAndRemoveUntil(
                                      context,
                                      MaterialPageRoute(
                                          builder: (context) => LoginScreen()),
                                      (route) => false,
                                    );
                                  },
                                )
                              ],
                            )
                          ],
                        ),
                        const SizedBox(height: 20),

                        if (_currentJobState != JobState.idle)
                          _buildActiveJobUI()
                        else ...[
                          ListTile(
                              leading: const Icon(Icons.settings,
                                  color: Colors.white),
                              title: const Text('Settings',
                                  style: TextStyle(color: Colors.white)),
                              subtitle: const Text(
                                  'Wallet, job history & payment transactions',
                                  style: TextStyle(color: Colors.white70)),
                              onTap: () => showModalBottomSheet(
                                  context: context,
                                  builder: (sheet) => SafeArea(
                                          child: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                            ListTile(
                                                leading: const Icon(Icons
                                                    .account_balance_wallet),
                                                title: const Text(
                                                    'Wallet & job/payment history'),
                                                onTap: () {
                                                  Navigator.pop(sheet);
                                                  Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                          builder: (_) =>
                                                              WalletHistoryScreen(
                                                                  token: widget
                                                                      .token,
                                                                  provider:
                                                                      true)));
                                                }),
                                            ListTile(
                                                leading:
                                                    const Icon(Icons.build),
                                                title: const Text(
                                                    'Service configuration'),
                                                onTap: () {
                                                  Navigator.pop(sheet);
                                                  _showWizardBottomSheet();
                                                }),
                                          ])))),
                          _buildDailyStatsPanel(),

                          const SizedBox(height: 40),

                          // The toggle button was moved to a fixed floating position at the bottom of the screen
                          const SizedBox(height: 40),

                          if (!isOnline)
                            Padding(
                              padding: const EdgeInsets.only(top: 40),
                              child: TextButton.icon(
                                onPressed: _showWizardBottomSheet,
                                icon: const Icon(Icons.settings,
                                    color: Colors.lightBlueAccent),
                                label: const Text(
                                  'Configuration Wizard',
                                  style: TextStyle(
                                      color: Colors.lightBlueAccent,
                                      fontSize: 16),
                                ),
                              ),
                            ),

                          const SizedBox(
                              height:
                                  120), // Bottom padding for floating button
                        ]
                      ],
                    ),
                  ),
                ),

                // Fixed Bottom Floating "GO ONLINE" Button
                if (_currentJobState == JobState.idle)
                  Positioned(
                    bottom: 40,
                    left: 24,
                    right: 24,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isOnline
                              ? 'Scanning for breakdown requests...'
                              : 'You are currently offline',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.7),
                            fontSize: 14,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                        GestureDetector(
                          onTap: _toggleOnlineStatus,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            width: double.infinity,
                            height: 64,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(32),
                              gradient: LinearGradient(
                                colors: isOnline
                                    ? [
                                        Colors.greenAccent.shade400,
                                        Colors.green.shade700
                                      ]
                                    : [
                                        Colors.blueAccent.shade400,
                                        Colors.blue.shade700
                                      ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: isOnline
                                      ? Colors.greenAccent.withOpacity(0.3)
                                      : Colors.blueAccent.withOpacity(0.3),
                                  blurRadius: 20,
                                  spreadRadius: 2,
                                  offset: const Offset(0, 8),
                                )
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 300),
                                  child: Icon(
                                    isOnline
                                        ? Icons.radar
                                        : Icons.power_settings_new,
                                    key: ValueKey<bool>(isOnline),
                                    size: 28,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  isOnline ? 'GO OFFLINE' : 'GO ONLINE',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        )));
  }

  // ================= PAYWALL DIALOG =================
  void _showPaywallDialog() {
    showDialog(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Subscription unavailable'),
                content: const Text(
                    'Subscription checkout has not been configured. Your existing service settings are unchanged.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c),
                      child: const Text('OK'))
                ]));
  }
}
