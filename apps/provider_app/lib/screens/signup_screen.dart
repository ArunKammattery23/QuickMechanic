import 'package:flutter/material.dart';
import 'dart:ui';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'login_screen.dart';
import '../config/api_config.dart';
import 'dashboard_screen.dart';
import '../services/api_service.dart';
import '../services/google_auth_service.dart';
import '../widgets/google_auth_dialogs.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({
    super.key,
    this.googleAuthService,
    this.onGoogleAuthenticated,
  });

  final ProviderGoogleAuthService? googleAuthService;
  final ValueChanged<ProviderGoogleSession>? onGoogleAuthenticated;

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
  bool _isGoogleLoading = false;
  late final _googleAuth =
      widget.googleAuthService ?? ProviderGoogleAuthService();
  bool _isPasswordVisible = false;

  Future<void> _signup() async {
    if (_isLoading) return;
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
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signupWithGoogle() async {
    if (_isLoading) return;
    setState(() {
      _isLoading = true;
      _isGoogleLoading = true;
    });
    try {
      var phone = _phoneController.text.trim();
      if (!isValidProviderMobile(phone)) {
        final enteredPhone = await collectProviderGoogleMobile(context, phone);
        if (enteredPhone == null || !mounted) return;
        phone = enteredPhone;
        _phoneController.text = phone;
      }
      final session = await authenticateProviderWithGoogle(
        context: context,
        service: _googleAuth,
        intent: 'signup',
        phoneNumber: phone,
        providerType: _userType,
      );
      if (session == null || !mounted) return;
      await ApiService.saveToken(session.accessToken);
      if (!mounted) return;
      if (widget.onGoogleAuthenticated != null) {
        widget.onGoogleAuthenticated!(session);
      } else {
        Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(
                builder: (_) => DashboardScreen(token: session.accessToken)),
            (_) => false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Account created. Complete KYC before accepting service requests.'),
        ));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error is ProviderGoogleAuthException
            ? error.message
            : 'Google sign-up failed. Please try again.'),
        backgroundColor: Colors.redAccent,
      ));
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isGoogleLoading = false;
        });
      }
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
                            onPressed: _isLoading ? null : _signup,
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
                            key: const Key('provider-google-signup'),
                            onPressed: _isLoading ? null : _signupWithGoogle,
                            icon: const Icon(Icons.g_mobiledata,
                                size: 36, color: Colors.blue),
                            label: Text(
                              _isGoogleLoading
                                  ? 'Signing up with Google…'
                                  : 'Sign up with Google',
                              style: const TextStyle(
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
                        Text(
                          'For Google sign-up, choose your provider type and add your mobile number. Google supplies your name and email; no password is needed.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.7),
                              fontSize: 12),
                        ),
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
