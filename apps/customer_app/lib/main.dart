import 'widgets/call_overlay.dart';
import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.restoreSession();
  runApp(const QuickMechanicApp());
}

class QuickMechanicApp extends StatelessWidget {
  const QuickMechanicApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      builder: (context, child) =>
          CallOverlay(child: child ?? const SizedBox.shrink()),
      title: 'QuickMechanic',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: ApiService.token == null ? LoginScreen() : const HomeScreen(),
    );
  }
}
