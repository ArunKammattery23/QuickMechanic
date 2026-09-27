import 'widgets/call_overlay.dart';
import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'services/api_service.dart';
import 'services/background_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await initializeBackgroundService();
  
  final token = await ApiService.getToken();

  runApp(QuickMechanicApp(token: token));
}

class QuickMechanicApp extends StatelessWidget {
  final String? token;
  const QuickMechanicApp({super.key, this.token});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      builder: (context, child) => CallOverlay(child: child ?? const SizedBox.shrink()),
      title: 'QuickMechanic',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: token != null ? DashboardScreen(token: token!) : LoginScreen(),
    );
  }
}
