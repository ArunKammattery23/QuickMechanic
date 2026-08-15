import 'package:flutter/material.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const QuickMechanicApp());
}

class QuickMechanicApp extends StatelessWidget {
  const QuickMechanicApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'QuickMechanic',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: LoginScreen(),
    );
  }
}
