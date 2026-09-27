import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'map_screen.dart';
import 'dart:ui';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../services/call_service.dart';

class MechanicListScreen extends StatefulWidget {
  final List<dynamic> mechanics;
  final String categoryId;
  final double lat;
  final double lng;

  const MechanicListScreen({
    super.key,
    required this.mechanics,
    required this.categoryId,
    required this.lat,
    required this.lng,
  });

  @override
  State<MechanicListScreen> createState() => _MechanicListScreenState();
}

class _MechanicListScreenState extends State<MechanicListScreen> {
  late List<dynamic> _mechanics;
  bool _isRequesting = false;
  bool _isWaitingForAcceptance = false;
  String? _requestingMechanicId;
  SocketService? _socketService;
  String? _pendingJobId;
  String? _pendingMechanicId;
  Timer? _requestTimer;
  bool _checkingJob = false, _cancelling = false;

  Future<void> _checkRequest() async {
    final id = _pendingJobId;
    if (id == null || _checkingJob || _cancelling) return;
    _checkingJob = true;
    try {
      final r = await http.get(Uri.parse('${ApiConfig.baseUrl}/dispatch/job/$id'),
          headers: {'Authorization': 'Bearer ${ApiService.token}'}).timeout(const Duration(seconds: 10));
      if (!mounted || _pendingJobId != id || _cancelling || r.statusCode != 200) return;
      final body = jsonDecode(r.body);
      final job = body['job'] ?? body;
      if (job['status'] == 'REQUESTED') return;
      _requestTimer?.cancel();
      _pendingJobId = null;
      if (['CANCELLED', 'COMPLETED'].contains(job['status'])) {
        setState(() => _isWaitingForAcceptance = false);
        return;
      }
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => MapScreen(
          mechanicId: _pendingMechanicId!, jobId: id, customerLat: widget.lat,
          customerLng: widget.lng, mechanicPhone: job['mechanic']?['phoneNumber'] ?? 'Unknown')));
    } finally { _checkingJob = false; }
  }

  Future<void> _cancelRequest() async {
    final id = _pendingJobId;
    if (id == null || _cancelling) return;
    setState(() => _cancelling = true);
    try {
      final r = await http.post(Uri.parse('${ApiConfig.baseUrl}/dispatch/job/$id/cancel'),
          headers: {'Authorization': 'Bearer ${ApiService.token}', 'Content-Type': 'application/json'},
          body: jsonEncode({'reason': 'Customer cancelled while waiting'})).timeout(const Duration(seconds: 15));
      if (r.statusCode < 200 || r.statusCode >= 300) throw Exception('Cancellation failed. Please retry.');
      if (!mounted) return;
      _requestTimer?.cancel();
      _pendingJobId = null;
      setState(() => _isWaitingForAcceptance = false);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to cancel. Your request is still active; please retry.')));
    } finally { if (mounted) setState(() => _cancelling = false); }
  }

  @override
  void initState() {
    super.initState();
    _mechanics = List.from(widget.mechanics);
    if (ApiService.token != null) {
      _socketService = SocketService();
      _socketService!.connect(ApiService.token!);

      CallService().init('CUSTOMER');
    }
  }

  @override
  void dispose() {
    _requestTimer?.cancel();
    super.dispose();
  }

  Future<void> _refreshMechanics() async {
    final result = await ApiService.getNearbyMechanics(
        widget.categoryId, widget.lat, widget.lng);
    if (result['success'] &&
        result['data'] != null &&
        result['data']['data'] != null) {
      setState(() {
        _mechanics = result['data']['data'];
      });
    }
  }

  Future<void> _requestMechanic(String mechanicId) async {
    setState(() {
      _isRequesting = true;
      _requestingMechanicId = mechanicId;
    });

    final result = await ApiService.requestMechanic(
        widget.categoryId, widget.lat, widget.lng, mechanicId);
    if (!mounted) return;
    setState(() {
      _isRequesting = false;
      _requestingMechanicId = null;
    });

    if (result['success'] &&
        result['data'] != null &&
        result['data']['success'] == true) {
      // Show waiting for acceptance overlay
      setState(() {
        _isWaitingForAcceptance = true;
      });

      _pendingJobId = result['data']['jobId'];
      _pendingMechanicId = mechanicId;
      _requestTimer?.cancel();
      _requestTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
        try { await _checkRequest(); } catch (_) { /* Retry after reconnect. */ }
      });
      try { await _checkRequest(); } catch (_) {}
      if (_socketService != null && _pendingJobId != null) {
        _socketService!.listenForJobAcceptance((data) {
          if (mounted && data['jobId'] == _pendingJobId) {
            _checkRequest().catchError((_) {});
          }
        });
      }
    } else {
      String errorMessage = 'Failed to request mechanic.';
      if (result['data'] != null && result['data']['message'] != null) {
        errorMessage = result['data']['message'];
      } else if (result['message'] != null) {
        errorMessage = result['message'];
      }

      // If the mechanic is offline or unavailable, remove them from the list
      if (result['data']?['success'] == false) {
        setState(() {
          _mechanics.removeWhere((m) => m['user']?['id'] == mechanicId);
        });
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(errorMessage, style: const TextStyle(color: Colors.white)),
            backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF001220),
      appBar: AppBar(
        title: const Text('Available Mechanics',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          _mechanics.isEmpty
              ? RefreshIndicator(
                  onRefresh: _refreshMechanics,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 100),
                      Center(
                        child: Text(
                          'No mechanics available nearby.\nPull to refresh.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white70, fontSize: 18),
                        ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _refreshMechanics,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16.0),
                    itemCount: _mechanics.length,
                    itemBuilder: (context, index) {
                      final mechanic = _mechanics[index];
                      final user = mechanic['user'] ?? {};
                      final isThisRequesting =
                          _isRequesting && _requestingMechanicId == user['id'];

                      return Card(
                        color: Colors.white.withOpacity(0.05),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        margin: const EdgeInsets.only(bottom: 16),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 30,
                                backgroundColor:
                                    Colors.blueAccent.withOpacity(0.2),
                                child: const Icon(Icons.build,
                                    color: Colors.blueAccent, size: 30),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      user['name'] ?? 'Unknown Mechanic',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.star,
                                            color: Colors.amber, size: 16),
                                        const SizedBox(width: 4),
                                        Text(
                                          mechanic['rating'] == null
                                              ? 'No reviews yet'
                                              : (mechanic['rating'] as num)
                                                  .toStringAsFixed(1),
                                          style: const TextStyle(
                                              color: Colors.amber,
                                              fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(width: 12),
                                        const Icon(Icons.verified,
                                            color: Colors.blueAccent, size: 16),
                                        const SizedBox(width: 4),
                                        const Text(
                                          'Top Pro',
                                          style: TextStyle(
                                              color: Colors.blueAccent,
                                              fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        const Icon(Icons.location_on,
                                            color: Colors.redAccent, size: 16),
                                        const SizedBox(width: 4),
                                        Text(
                                          mechanic['distanceText'] ??
                                              'Unknown distance',
                                          style: const TextStyle(
                                              color: Colors.white70),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              ElevatedButton(
                                onPressed: _isRequesting
                                    ? null
                                    : () => _requestMechanic(user['id']),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.blueAccent,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12)),
                                ),
                                child: isThisRequesting
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2),
                                      )
                                    : const Text('Request'),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
          if (_isRequesting || _isWaitingForAcceptance)
            Positioned.fill(
              child: ClipRRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
                  child: Container(
                    color: Colors.black.withOpacity(0.4),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const CircularProgressIndicator(
                              color: Colors.blueAccent),
                          const SizedBox(height: 20),
                          Text(
                            _isWaitingForAcceptance
                                ? 'Waiting for mechanic to accept...'
                                : 'Sending request...',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold),
                          ),
                          if (_isWaitingForAcceptance) ...[
                            const SizedBox(height: 30),
                            ElevatedButton(
                              onPressed: _cancelling ? null : _cancelRequest,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.redAccent,
                              ),
                              child: const Text('Cancel Request',
                                  style: TextStyle(color: Colors.white)),
                            )
                          ]
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
