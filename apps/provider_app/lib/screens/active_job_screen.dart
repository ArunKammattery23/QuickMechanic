import 'wallet_history_screen.dart';
import '../widgets/ride_map.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../services/socket_service.dart';
import '../services/call_service.dart';
import '../services/api_service.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ActiveJobScreen extends StatefulWidget {
  final String mechanicId;
  final String jobId;
  final String serviceType;
  final double customerLat;
  final double customerLng;
  final String customerId;
  final String customerPhone;

  const ActiveJobScreen({
    Key? key,
    required this.mechanicId,
    required this.jobId,
    required this.serviceType,
    required this.customerLat,
    required this.customerLng,
    required this.customerId,
    this.customerPhone = 'Unknown',
  }) : super(key: key);

  @override
  _ActiveJobScreenState createState() => _ActiveJobScreenState();
}

class _ActiveJobScreenState extends State<ActiveJobScreen> {
  final SocketService _socketService = SocketService();
  StreamSubscription<Position>? _positionStream;
  LatLng? _mechanicLocation;
  late LatLng _customerLocation;

  double _bearing = 0.0;
  bool _hasArrived = false;
  String? _gpsError;
  double? _accuracy;
  DateTime? _lastLocationAt;

  @override
  void initState() {
    super.initState();
    _customerLocation = LatLng(widget.customerLat, widget.customerLng);
    _startLocationUpdates();
  }

  void _startLocationUpdates() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled)
        throw StateError('Turn on location services to navigate.');

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied)
          throw StateError('Location permission is required.');
      }

      if (permission == LocationPermission.deniedForever)
        throw StateError('Enable location permission in Settings.');
      // Get initial position
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      setState(() {
        _accuracy = pos.accuracy;
        _lastLocationAt = pos.timestamp;
        _mechanicLocation = LatLng(pos.latitude, pos.longitude);
      });

      _socketService.updateLocation(
          widget.mechanicId, pos.latitude, pos.longitude,
          bearing: pos.heading,
          accuracy: pos.accuracy,
          observedAt: pos.timestamp);
      // Continuously stream location
      _positionStream = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          distanceFilter: 2, // Every 2 meters
        ),
      ).listen((Position position) {
        if (mounted) {
          if (_mechanicLocation != null) {
            // Calculate heading/bearing
            _bearing = Geolocator.bearingBetween(
              _mechanicLocation!.latitude,
              _mechanicLocation!.longitude,
              position.latitude,
              position.longitude,
            );
          }

          setState(() {
            _mechanicLocation = LatLng(position.latitude, position.longitude);
            _accuracy = position.accuracy;
            _lastLocationAt = position.timestamp;
            _gpsError = null;
          });

          // Broadcast to backend so customer can track live!
          _socketService.updateLocation(
            widget.mechanicId,
            position.latitude,
            position.longitude,
            bearing: _bearing,
            accuracy: position.accuracy,
            observedAt: position.timestamp,
          );
        }
      }, onError: (_) {
        if (mounted)
          setState(
              () => _gpsError = 'GPS signal lost. Check location settings.');
      });
    } catch (e) {
      if (mounted) setState(() => _gpsError = '$e');
    }
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
            _hasArrived ? 'Repair in Progress' : 'Navigating to Customer',
            style: const TextStyle(
                fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: const Color(0xFF001220),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _mechanicLocation == null
          ? Container(
              color: const Color(0xFF001220),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.blueAccent),
                    SizedBox(height: 16),
                    Text(_gpsError ?? 'Acquiring GPS Signal...',
                        style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
            )
          : Stack(
              children: [
                RideMap(
                    destination: _customerLocation,
                    vehicle: _mechanicLocation,
                    bearing: _bearing,
                    updatedAt: _lastLocationAt,
                    accuracy: _accuracy,
                    navigation: true),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: const BoxDecoration(
                      color: Color(0xFF001220),
                      borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(30),
                          topRight: Radius.circular(30)),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black26,
                            blurRadius: 10,
                            offset: Offset(0, -5))
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'EN ROUTE TO CUSTOMER',
                          style: TextStyle(
                              color: Colors.greenAccent,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    'Service: ${widget.serviceType.replaceAll('_', ' ').toUpperCase()}',
                                    style:
                                        const TextStyle(color: Colors.white70)),
                                const SizedBox(height: 4),
                                const Text('Job Tracking is ACTIVE',
                                    style: TextStyle(color: Colors.white)),
                              ],
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.phone,
                                      color: Colors.green, size: 36),
                                  onPressed: () {
                                    showModalBottomSheet(
                                      context: context,
                                      backgroundColor: const Color(0xFF001220),
                                      builder: (context) => Container(
                                        padding: const EdgeInsets.all(24),
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Text('Contact Customer',
                                                style: TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 20,
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            const SizedBox(height: 24),
                                            ListTile(
                                              leading: const Icon(
                                                  Icons.record_voice_over,
                                                  color: Colors.blueAccent),
                                              title: const Text(
                                                  'In-App Voice Call',
                                                  style: TextStyle(
                                                      color: Colors.white)),
                                              subtitle: const Text(
                                                  'Free (Requires Internet)',
                                                  style: TextStyle(
                                                      color: Colors.white54)),
                                              onTap: () {
                                                Navigator.pop(context);
                                                CallService().startCall(
                                                    widget.customerId,
                                                    'Mechanic');
                                              },
                                            ),
                                            const Divider(
                                                color: Colors.white24),
                                            ListTile(
                                              leading: const Icon(Icons.phone,
                                                  color: Colors.green),
                                              title: const Text('Cellular Call',
                                                  style: TextStyle(
                                                      color: Colors.white)),
                                              subtitle: const Text(
                                                  'Standard carrier rates apply',
                                                  style: TextStyle(
                                                      color: Colors.white54)),
                                              onTap: () async {
                                                Navigator.pop(context);
                                                if (widget.customerPhone !=
                                                    'Unknown') {
                                                  final url = Uri.parse(
                                                      'tel:${widget.customerPhone}');
                                                  if (await canLaunchUrl(url)) {
                                                    await launchUrl(url);
                                                  }
                                                } else {
                                                  ScaffoldMessenger.of(context)
                                                      .showSnackBar(const SnackBar(
                                                          content: Text(
                                                              'Phone number not available')));
                                                }
                                              },
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                const SizedBox(width: 8),
                                _hasArrived
                                    ? ElevatedButton(
                                        onPressed: _showOtpDialog,
                                        style: ElevatedButton.styleFrom(
                                            backgroundColor: Colors.green),
                                        child: const Text('COMPLETE JOB',
                                            style: TextStyle(
                                                color: Colors.black,
                                                fontWeight: FontWeight.bold)),
                                      )
                                    : ElevatedButton(
                                        onPressed: () {
                                          setState(() {
                                            _hasArrived = true;
                                          });
                                          _positionStream?.cancel();
                                          ScaffoldMessenger.of(context)
                                              .showSnackBar(const SnackBar(
                                                  content: Text(
                                                      'You have arrived! Start repair.')));
                                        },
                                        style: ElevatedButton.styleFrom(
                                            backgroundColor: Colors.redAccent),
                                        child: const Text('ARRIVED',
                                            style:
                                                TextStyle(color: Colors.white)),
                                      ),
                              ],
                            )
                          ],
                        ),
                        const SizedBox(height: 16),
                        if (!_hasArrived)
                          SizedBox(
                            width: double.infinity,
                            height: 40,
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.cancel,
                                  color: Colors.redAccent),
                              label: const Text('CANCEL JOB',
                                  style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold)),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.redAccent,
                                side: const BorderSide(
                                    color: Colors.redAccent, width: 2),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: () async {
                                final confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (context) => AlertDialog(
                                          backgroundColor:
                                              const Color(0xFF001220),
                                          title: const Text('Cancel Job?',
                                              style: TextStyle(
                                                  color: Colors.white)),
                                          content: const Text(
                                              'Are you sure you want to cancel this job? The customer will be refunded.',
                                              style: TextStyle(
                                                  color: Colors.white70)),
                                          actions: [
                                            TextButton(
                                                onPressed: () => Navigator.pop(
                                                    context, false),
                                                child: const Text('NO',
                                                    style: TextStyle(
                                                        color:
                                                            Colors.white54))),
                                            ElevatedButton(
                                                style: ElevatedButton.styleFrom(
                                                    backgroundColor:
                                                        Colors.red),
                                                onPressed: () => Navigator.pop(
                                                    context, true),
                                                child: const Text('YES, CANCEL',
                                                    style: TextStyle(
                                                        color: Colors.white))),
                                          ],
                                        ));

                                if (confirm == true) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                          content: Text('Cancelling job...')));
                                  final prefs =
                                      await SharedPreferences.getInstance();
                                  final token =
                                      prefs.getString('jwt_token') ?? '';
                                  final result = await ApiService.cancelJob(
                                      token, widget.jobId);

                                  if (result['success']) {
                                    _positionStream?.cancel();
                                    Navigator.pop(context); // close screen
                                    ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                            content: Text(
                                                'Job cancelled successfully.'),
                                            backgroundColor: Colors.orange));
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                            content: Text(result['message']),
                                            backgroundColor: Colors.red));
                                  }
                                }
                              },
                            ),
                          ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: OutlinedButton.icon(
                            icon:
                                const Icon(Icons.map, color: Colors.blueAccent),
                            label: const Text('Navigate in Google Maps',
                                style: TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.bold)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.blueAccent,
                              side: const BorderSide(
                                  color: Colors.blueAccent, width: 2),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () async {
                              final url = Uri.parse(
                                'https://www.google.com/maps/dir/?api=1&destination=${widget.customerLat},${widget.customerLng}&travelmode=driving',
                              );
                              if (await canLaunchUrl(url)) {
                                await launchUrl(url,
                                    mode: LaunchMode.externalApplication);
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  void _showOtpDialog() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    await Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => JobHistoryDetailScreen(
                token: prefs.getString('jwt_token') ?? '',
                jobId: widget.jobId,
                provider: true)));
  }
}
