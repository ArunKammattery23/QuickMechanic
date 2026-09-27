import 'package:flutter/material.dart';
import 'dart:ui';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'login_screen.dart';
import '../config/api_config.dart';

class SignupScreen extends StatefulWidget {
  @override
  _SignupScreenState createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  String _userType = 'Mechanic';
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _isPasswordVisible = false;

  Future<void> _signup() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (name.isEmpty || phone.isEmpty || email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill out all fields.')),
      );
      return;
    }
    if (!RegExp(r'^\+?[1-9]\d{9,14}$').hasMatch(phone)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Enter a valid 10 to 15 digit mobile number.')));
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/auth/register/mechanic'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': name,
          'phoneNumber': phone,
          'email': email,
          'password': password,
          'type': _userType,
        }),
      );

      setState(() {
        _isLoading = false;
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Account created. Complete KYC and wait for admin approval before taking jobs.'),
              backgroundColor: Colors.green),
        );
        Navigator.pop(context); // Go back to login screen
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Failed to create account. Email or Mobile Number already in use.'),
              backgroundColor: Colors.redAccent),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Network error. Is the backend running?'),
            backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Create Account',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      body: AnimatedBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(30),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                  child: Container(
                    padding: const EdgeInsets.all(32.0),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                          color: Colors.white.withOpacity(0.2), width: 1.5),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.person_add_alt_1,
                            size: 60, color: Colors.lightBlueAccent),
                        const SizedBox(height: 16),
                        const Text(
                          'Join QuickMechanic Provider',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 32),
                        DropdownButtonFormField<String>(
                          value: _userType,
                          dropdownColor: const Color(0xFF003B73),
                          style: const TextStyle(
                              color: Colors.white, fontSize: 16),
                          decoration: InputDecoration(
                            labelText: 'I am a...',
                            labelStyle:
                                TextStyle(color: Colors.white.withOpacity(0.7)),
                            prefixIcon: Icon(Icons.badge,
                                color: Colors.white.withOpacity(0.7)),
                            filled: true,
                            fillColor: Colors.white.withOpacity(0.05),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide(
                                  color: Colors.white.withOpacity(0.3)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                  color: Colors.lightBlueAccent),
                            ),
                          ),
                          items: ['Mechanic', 'Towing Fleet']
                              .map((label) => DropdownMenuItem(
                                    value: label,
                                    child: Text(label),
                                  ))
                              .toList(),
                          onChanged: (value) {
                            setState(() {
                              _userType = value!;
                            });
                          },
                        ),
                        const SizedBox(height: 20),
                        _buildGlassTextField(
                          controller: _nameController,
                          hintText: 'Full Name',
                          icon: Icons.person_outline,
                        ),
                        const SizedBox(height: 20),
                        _buildGlassTextField(
                          controller: _phoneController,
                          hintText: 'Mobile Number',
                          icon: Icons.phone_android,
                        ),
                        const SizedBox(height: 20),
                        _buildGlassTextField(
                          controller: _emailController,
                          hintText: 'Email Address',
                          icon: Icons.email_outlined,
                        ),
                        const SizedBox(height: 20),
                        _buildGlassTextField(
                          controller: _passwordController,
                          hintText: 'Password',
                          icon: Icons.lock_outline,
                          obscureText: !_isPasswordVisible,
                          suffixIcon: IconButton(
                            icon: Icon(
                              _isPasswordVisible
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                              color: Colors.white.withOpacity(0.7),
                            ),
                            onPressed: () {
                              setState(() {
                                _isPasswordVisible = !_isPasswordVisible;
                              });
                            },
                          ),
                        ),
                        const SizedBox(height: 32),
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: _signup,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blueAccent,
                              foregroundColor: Colors.white,
                              elevation: 8,
                              shadowColor: Colors.blueAccent.withOpacity(0.5),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 3))
                                : const Text(
                                    'SIGN UP',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            Expanded(
                                child: Divider(
                                    color: Colors.white.withOpacity(0.3),
                                    thickness: 1)),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              child: Text('OR',
                                  style: TextStyle(
                                      color: Colors.white.withOpacity(0.5))),
                            ),
                            Expanded(
                                child: Divider(
                                    color: Colors.white.withOpacity(0.3),
                                    thickness: 1)),
                          ],
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              print("Google Sign Up clicked as $_userType");
                            },
                            icon: const Icon(Icons.g_mobiledata,
                                size: 36, color: Colors.blue),
                            label: const Text(
                              'Sign up with Google',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: Colors.black87,
                              elevation: 4,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGlassTextField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
        prefixIcon: Icon(icon, color: Colors.white.withOpacity(0.7)),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.lightBlueAccent),
        ),
      ),
    );
  }
}
