import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/api_config.dart';

bool get supportsProviderBackground =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
Future<bool> startProviderBackground() async {
  if (!supportsProviderBackground) return true;
  final allowed = await FlutterLocalNotificationsPlugin()
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.requestNotificationsPermission();
  if (allowed == false) return false;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool('provider_online', true);
  final service = FlutterBackgroundService();
  return await service.isRunning() || await service.startService();
}

Future<void> stopProviderBackground() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool('provider_online', false);
  if (supportsProviderBackground)
    FlutterBackgroundService().invoke('stopService');
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  final token = prefs.getString('jwt_token');
  if (token == null || prefs.getBool('provider_online') != true) {
    await service.stopSelf();
    return;
  }
  String mechanicId;
  try {
    mechanicId = jsonDecode(utf8.decode(
            base64Url.decode(base64Url.normalize(token.split('.')[1]))))['sub']
        as String;
  } catch (_) {
    await service.stopSelf();
    return;
  }
  final notifications = FlutterLocalNotificationsPlugin();
  await notifications.initialize(const InitializationSettings(
      android: AndroidInitializationSettings('ic_bg_service_small')));
  final socket = IO.io(ApiConfig.baseUrl, <String, dynamic>{
    'transports': ['websocket'],
    'autoConnect': false,
    'forceNew': true,
    'auth': {'token': token},
    'reconnectionDelay': 2000,
    'reconnectionDelayMax': 15000,
  });
  bool stopped = false;
  bool locating = false;
  Timer? timer;
  Future<void> stop() async {
    if (stopped) return;
    stopped = true;
    timer?.cancel();
    socket.dispose();
    await service.stopSelf();
  }

  service.on('stopService').listen((_) => stop());
  Future<void> tick() async {
    if (locating || stopped) return;
    locating = true;
    try {
      await prefs.reload();
      if (prefs.getBool('provider_online') != true ||
          prefs.getString('jwt_token') != token) {
        await stop();
        return;
      }
      if (!socket.connected) return;
      final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 10));
      if (stopped || !socket.connected) return;
      socket.emit('update_location', {
        'mechanicId': mechanicId,
        'lat': position.latitude,
        'lng': position.longitude,
        'bearing': position.heading,
        'accuracy': position.accuracy,
        'timestamp': position.timestamp.toUtc().toIso8601String()
      });
      if (service is AndroidServiceInstance)
        await service.setForegroundNotificationInfo(
            title: 'QuickMechanic · Online',
            content: 'Location active · listening for requests');
    } catch (_) {
      if (service is AndroidServiceInstance && !stopped)
        await service.setForegroundNotificationInfo(
            title: 'Location unavailable',
            content: 'Open QuickMechanic to check permissions');
    } finally {
      locating = false;
    }
  }

  socket.onConnect((_) => tick());
  socket.onConnectError((error) {
    if (error.toString().contains('Invalid or expired token')) stop();
  });
  socket.on('new_job_request', (_) {
    if (!stopped)
      notifications.show(
          888,
          'New service request',
          'Open QuickMechanic to view your request.',
          const NotificationDetails(
              android: AndroidNotificationDetails(
                  'quickmechanic_jobs', 'New jobs',
                  importance: Importance.high,
                  priority: Priority.high,
                  icon: 'ic_bg_service_small')));
  });
  timer = Timer.periodic(const Duration(seconds: 15), (_) => tick());
  socket.connect();
}

Future<void> initializeBackgroundService() async {
  if (!supportsProviderBackground) return;
  final notifications = FlutterLocalNotificationsPlugin();
  await notifications.initialize(const InitializationSettings(
      android: AndroidInitializationSettings('ic_bg_service_small')));
  final android = notifications.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  await android?.createNotificationChannel(const AndroidNotificationChannel(
      'quickmechanic_foreground', 'Online provider',
      importance: Importance.low));
  await android?.createNotificationChannel(const AndroidNotificationChannel(
      'quickmechanic_jobs', 'New jobs',
      importance: Importance.high));
  await FlutterBackgroundService().configure(
      androidConfiguration: AndroidConfiguration(
          onStart: onStart,
          autoStart: false,
          autoStartOnBoot: false,
          isForegroundMode: true,
          notificationChannelId: 'quickmechanic_foreground',
          foregroundServiceNotificationId: 887,
          foregroundServiceTypes: [AndroidForegroundType.location],
          initialNotificationTitle: 'QuickMechanic · Online',
          initialNotificationContent: 'Starting location and job updates'),
      iosConfiguration: IosConfiguration(autoStart: false));
}
