import 'wallet_history_screen.dart';
import '../widgets/ride_map.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import 'dart:ui';
import '../services/socket_service.dart';
import '../services/call_service.dart';
import '../services/api_service.dart';

import 'package:url_launcher/url_launcher.dart';

class MapScreen extends StatefulWidget {
  final String mechanicId;
  final String jobId;
  final double customerLat;
  final double customerLng;
  final String mechanicPhone;

  const MapScreen({
    Key? key,
    required this.mechanicId,
    required this.jobId,
    required this.customerLat,
    required this.customerLng,
    this.mechanicPhone = 'Unknown',
  }) : super(key: key);

  @override
  _MapScreenState createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with WidgetsBindingObserver {
  final SocketService _socketService = SocketService();

  LatLng? mechanicLocation;
  late LatLng customerLocation;
  double _bearing = 0.0;
  double? _accuracy;

  String _etaText = "...";
  String _distanceText = "...";
  DateTime? _lastLocationAt;
  Timer? _statusTimer;
  bool _paymentSheetOpen = false, _syncing = false;
  String? _lastOfferedQuote;
  String _jobStatus = 'ACCEPTED';
  String get _stage =>
      const {
        'REQUESTED': 'Waiting for provider acceptance',
        'ACCEPTED': 'Provider accepted — waiting for quotation',
        'AWAITING_PAYMENT': 'Review quotation and pay',
        'PAYMENT_SECURED': 'Payment held — waiting for provider to start',
        'EN_ROUTE': 'Your mechanic is on the way',
        'AWAITING_CUSTOMER_CONFIRMATION':
            'Confirm completed work to release payment',
        'COMPLETED': 'Job completed',
        'CANCELLED': 'Job cancelled',
      }[_jobStatus] ??
      'Loading job status';

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _syncJob();
  }

  Future<void> _syncJob() async {
    if (_syncing) return;
    _syncing = true;
    try {
      final r = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/dispatch/job/${widget.jobId}'),
          headers: {
            'Authorization': 'Bearer ${ApiService.token}'
          }).timeout(const Duration(seconds: 10));
      if (!mounted || r.statusCode != 200) return;
      final job = jsonDecode(r.body)['job'];
      setState(() => _jobStatus = job['status']);
      if (job['status'] == 'AWAITING_PAYMENT' &&
          !_paymentSheetOpen &&
          _lastOfferedQuote != widget.jobId) {
        _lastOfferedQuote = widget.jobId;
        _showPaymentSheet(job);
      }
    } catch (_) {
      /* The next refresh retries after a connection loss. */
    } finally {
      _syncing = false;
    }
  }

  Future<Map<String, dynamic>> _pay() async {
    var result = await ApiService.payJob(widget.jobId);
    if (!mounted) return {'success': false};
    if (result['simulationRequired'] == true) {
      final outcome = await showDialog<String>(
          context: context,
          builder: (c) => AlertDialog(
                  title: const Text('Dummy payment — no real money'),
                  content: const Text(
                      'Choose a test result. No bank, UPI or card will be charged.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c, 'cancelled'),
                        child: const Text('Cancel')),
                    TextButton(
                        onPressed: () => Navigator.pop(c, 'failed'),
                        child: const Text('Test failure')),
                    FilledButton(
                        onPressed: () => Navigator.pop(c, 'success'),
                        child: const Text('Test successful payment')),
                  ]));
      if (!mounted || outcome == null)
        return {
          'success': false,
          'message': 'Test payment cancelled. Your job is still unpaid.'
        };
      result = await ApiService.payJob(widget.jobId, simulationResult: outcome);
    }
    if (result['checkoutUrl'] != null) {
      try {
        final opened = await launchUrl(Uri.parse(result['checkoutUrl']),
            mode: LaunchMode.externalApplication);
        return {
          'success': false,
          'message': opened
              ? 'Complete checkout, then refresh your job.'
              : 'Unable to open checkout. Please retry.'
        };
      } catch (_) {
        return {
          'success': false,
          'message': 'Unable to open checkout. Please retry.'
        };
      }
    }
    return result;
  }

  void _subscribe(dynamic _) {
    _socketService.socket
        ?.emit('subscribe_to_mechanic', {'mechanicId': widget.mechanicId});
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    customerLocation = LatLng(widget.customerLat, widget.customerLng);
    _initSocket();
    CallService().init('CUSTOMER');
    _statusTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) setState(() {});
      _syncJob();
    });
    _syncJob();
  }

  void _initSocket() {
    // Ensure the shared SocketService is connected
    _socketService.connect(ApiService.token!);

    _socketService.socket?.on('connect', _subscribe);
    if (_socketService.socket?.connected == true) _subscribe(null);

    _socketService.socket?.on('mechanic_location_changed', (data) {
      if (mounted && data != null && data['mechanicId'] == widget.mechanicId) {
        final newLat = data['lat'] is String
            ? double.parse(data['lat'])
            : (data['lat'] as num).toDouble();
        final newLng = data['lng'] is String
            ? double.parse(data['lng'])
            : (data['lng'] as num).toDouble();
        final bearing =
            data['bearing'] != null ? (data['bearing'] as num).toDouble() : 0.0;

        setState(() {
          mechanicLocation = LatLng(newLat, newLng);
          _bearing = bearing;
          _accuracy = (data['accuracy'] as num?)?.toDouble();
          _lastLocationAt =
              DateTime.tryParse('${data['timestamp']}') ?? DateTime.now();
        });
      }
    });

    _socketService.socket?.on('quote_received', (data) {
      if (mounted && data['jobId'] == widget.jobId) {
        _showPaymentSheet(data);
      }
    });

    _socketService.socket?.on('completion_requested', (data) {
      if (mounted && data['jobId'] == widget.jobId)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Provider finished the work. Open job details to confirm completion and release funds.')));
    });
    _socketService.socket?.on('job_completed', (data) {
      if (mounted && data['jobId'] == widget.jobId) {
        _showRatingDialog();
      }
    });

    _socketService.socket?.on('job_cancelled', (data) {
      if (mounted && data['jobId'] == widget.jobId) {
        showDialog(
            context: context,
            barrierDismissible: false,
            builder: (dialogContext) => AlertDialog(
                  backgroundColor: const Color(0xFF001220),
                  title: const Text('Job Cancelled',
                      style: TextStyle(
                          color: Colors.redAccent,
                          fontWeight: FontWeight.bold)),
                  content: Text(
                      data['message'] ?? 'Mechanic Cancelled the work.',
                      style: const TextStyle(color: Colors.white)),
                  actions: [
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blueAccent),
                      onPressed: () => Navigator.of(dialogContext).pop(),
                      child: const Text('OK',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ));
      }
    });
  }

  void _showPaymentSheet(dynamic data) {
    if (_paymentSheetOpen || !mounted) return;
    _paymentSheetOpen = true;
    _lastOfferedQuote = widget.jobId;
    bool isPaying = false;
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) {
          return StatefulBuilder(builder: (context, setStateModal) {
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFF001220),
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(30),
                    topRight: Radius.circular(30)),
              ),
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Payment Secure Escrow',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  const Text(
                      'Review your charges before the mechanic starts traveling.',
                      style: TextStyle(color: Colors.white70),
                      textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  ListTile(
                    title: const Text('Distance',
                        style: TextStyle(color: Colors.white70)),
                    trailing: Text('${data['distanceInKm']} km',
                        style:
                            const TextStyle(color: Colors.white, fontSize: 16)),
                  ),
                  ListTile(
                    title: const Text('Quotation amount',
                        style: TextStyle(color: Colors.white70)),
                    trailing: Text('₹${data['quotationAmount']}',
                        style:
                            const TextStyle(color: Colors.white, fontSize: 16)),
                  ),
                  ListTile(
                    title: const Text('Platform fee',
                        style: TextStyle(color: Colors.white70)),
                    trailing: Text('₹${data['platformFee']}',
                        style:
                            const TextStyle(color: Colors.white, fontSize: 16)),
                  ),
                  if (data['paymentMode'] != null &&
                      data['paymentMode'] != 'live')
                    const Text('TEST PAYMENT — no real money',
                        style: TextStyle(color: Colors.orange)),
                  const Divider(color: Colors.white24),
                  ListTile(
                    title: const Text('Total Amount',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                    trailing: Text('₹${data['totalAmount']}',
                        style: const TextStyle(
                            color: Colors.greenAccent,
                            fontSize: 22,
                            fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 24),
                  isPaying
                      ? const CircularProgressIndicator()
                      : SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.greenAccent,
                                foregroundColor: Colors.black),
                            child: const Text('ACCEPT JOB & PAY',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 16)),
                            onPressed: () async {
                              setStateModal(() => isPaying = true);
                              final result = await _pay();
                              if (!mounted || !context.mounted) return;
                              if (result['success']) {
                                final messenger =
                                    ScaffoldMessenger.of(this.context);
                                Navigator.pop(context); // close sheet
                                messenger.showSnackBar(const SnackBar(
                                    content: Text(
                                        'Job confirmed. Payment held until you approve completion.'),
                                    backgroundColor: Colors.green));
                                _syncJob();
                              } else {
                                setStateModal(() => isPaying = false);
                                ScaffoldMessenger.of(this.context).showSnackBar(
                                    SnackBar(
                                        content: Text(result['message'] ??
                                            'Payment failed. Please retry.'),
                                        backgroundColor: Colors.red));
                              }
                            },
                          ),
                        )
                ],
              ),
            );
          });
        }).whenComplete(() {
      _paymentSheetOpen = false;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Cleanup listeners but don't disconnect the socket fully
    // as it might be needed by other parts of the app (like CallService)
    _statusTimer?.cancel();
    _socketService.socket?.off('connect', _subscribe);
    _socketService.socket?.off('mechanic_location_changed');
    _socketService.socket?.off('quote_received');
    _socketService.socket?.off('job_completed');
    _socketService.socket?.off('completion_requested');
    _socketService.socket?.off('job_cancelled');
    super.dispose();
  }

  void _showRatingDialog() {
    int _selectedRating = 5;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateModal) {
            return AlertDialog(
              backgroundColor: const Color(0xFF001220),
              title: const Text('Job Completed!',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Please rate the mechanic:',
                      style: TextStyle(color: Colors.white70)),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      return IconButton(
                        icon: Icon(
                          index < _selectedRating
                              ? Icons.star
                              : Icons.star_border,
                          color: Colors.amber,
                          size: 36,
                        ),
                        onPressed: () {
                          setStateModal(() {
                            _selectedRating = index + 1;
                          });
                        },
                      );
                    }),
                  ),
                ],
              ),
              actions: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blueAccent),
                  onPressed: () async {
                    // Send rating to backend
                    final result = await ApiService.rateMechanic(
                        widget.jobId, _selectedRating);
                    if (!mounted || !context.mounted) return;
                    if (result['success']) {
                      ScaffoldMessenger.of(this.context).showSnackBar(
                          const SnackBar(
                              content: Text('Rating submitted successfully!'),
                              backgroundColor: Colors.green));
                    } else {
                      ScaffoldMessenger.of(this.context).showSnackBar(
                          const SnackBar(
                              content: Text('Failed to submit rating.'),
                              backgroundColor: Colors.redAccent));
                    }
                    Navigator.of(context).pop();
                  },
                  child: const Text('Submit',
                      style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tracking Mechanic',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        backgroundColor: const Color(0xFF001220),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          // OpenStreetMap via flutter_map
          RideMap(
              statusLabel: _jobStatus == 'EN_ROUTE' ? null : _stage,
              destination: customerLocation,
              vehicle: mechanicLocation,
              bearing: _bearing,
              updatedAt: _lastLocationAt,
              accuracy: _accuracy,
              onEstimate: (distance, eta) {
                if (mounted)
                  setState(() {
                    _distanceText = distance;
                    _etaText = eta;
                  });
              }),

          // Bottom Control Panel
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
                  Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(2))),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      const CircleAvatar(
                        radius: 30,
                        backgroundColor: Colors.blueAccent,
                        child:
                            Icon(Icons.person, color: Colors.white, size: 30),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_stage,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('Distance: $_distanceText',
                                style: const TextStyle(color: Colors.white70)),
                            Text('ETA: $_etaText',
                                style: const TextStyle(
                                    color: Colors.greenAccent,
                                    fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Mechanic',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          const Text('Mechanic is En Route',
                              style: TextStyle(color: Colors.blueAccent)),
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
                                      const Text('Contact Mechanic',
                                          style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 20,
                                              fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 24),
                                      ListTile(
                                        leading: const Icon(
                                            Icons.record_voice_over,
                                            color: Colors.blueAccent),
                                        title: const Text('In-App Voice Call',
                                            style:
                                                TextStyle(color: Colors.white)),
                                        subtitle: const Text(
                                            'Free (Requires Internet)',
                                            style: TextStyle(
                                                color: Colors.white54)),
                                        onTap: () {
                                          Navigator.pop(context);
                                          CallService().startCall(
                                              widget.mechanicId, 'Customer');
                                        },
                                      ),
                                      const Divider(color: Colors.white24),
                                      ListTile(
                                        leading: const Icon(Icons.phone,
                                            color: Colors.green),
                                        title: const Text('Cellular Call',
                                            style:
                                                TextStyle(color: Colors.white)),
                                        subtitle: const Text(
                                            'Standard carrier rates apply',
                                            style: TextStyle(
                                                color: Colors.white54)),
                                        onTap: () async {
                                          Navigator.pop(context);
                                          if (widget.mechanicPhone !=
                                              'Unknown') {
                                            final url = Uri.parse(
                                                'tel:${widget.mechanicPhone}');
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
                        ],
                      )
                    ],
                  ),
                  FilledButton.icon(
                      icon: const Icon(Icons.receipt_long),
                      label:
                          const Text('Job details, cancellation & completion'),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => JobHistoryDetailScreen(
                                  token: ApiService.token ?? '',
                                  jobId: widget.jobId,
                                  provider: false)))),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.map, color: Colors.blueAccent),
                      label: const Text('Prefer Google Maps? Open App',
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
                        final destLat = widget.customerLat;
                        final destLng = widget.customerLng;
                        final url = mechanicLocation != null
                            ? Uri.parse(
                                'https://www.google.com/maps/dir/?api=1&origin=${mechanicLocation!.latitude},${mechanicLocation!.longitude}&destination=$destLat,$destLng&travelmode=driving')
                            : Uri.parse(
                                'https://www.google.com/maps/search/?api=1&query=$destLat,$destLng');
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
}
