import 'package:flutter/material.dart';
import 'dart:ui';
import 'dart:math' as math;
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'signup_screen.dart';
import 'dashboard_screen.dart';
import 'forgot_password_screen.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';
import '../services/google_auth_service.dart';
import '../widgets/google_auth_dialogs.dart';

// ─── Animated Dark Gradient Background (Deep charcoal-orange theme) ─────────

class AnimatedBackground extends StatefulWidget {
  final Widget child;
  const AnimatedBackground({Key? key, required this.child}) : super(key: key);

  @override
  _AnimatedBackgroundState createState() => _AnimatedBackgroundState();
}

class _AnimatedBackgroundState extends State<AnimatedBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Alignment> _topAlignmentAnimation;
  late Animation<Alignment> _bottomAlignmentAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    );
    _topAlignmentAnimation = TweenSequence<Alignment>([
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.topLeft, end: Alignment.topRight),
          weight: 1),
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.topRight, end: Alignment.bottomRight),
          weight: 1),
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.bottomRight, end: Alignment.bottomLeft),
          weight: 1),
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.bottomLeft, end: Alignment.topLeft),
          weight: 1),
    ]).animate(_controller);
    _bottomAlignmentAnimation = TweenSequence<Alignment>([
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.bottomRight, end: Alignment.bottomLeft),
          weight: 1),
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.bottomLeft, end: Alignment.topLeft),
          weight: 1),
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.topLeft, end: Alignment.topRight),
          weight: 1),
      TweenSequenceItem(
          tween: Tween<Alignment>(
              begin: Alignment.topRight, end: Alignment.bottomRight),
          weight: 1),
    ]).animate(_controller);

    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: const [
                Color(0xFF000C18), // Near black
                Color(0xFF001830), // Dark charcoal
                Color(0xFF002E5C), // Warm dark brown tint
                Color(0xFF00447A), // Deep midnight
              ],
              begin: _topAlignmentAnimation.value,
              end: _bottomAlignmentAnimation.value,
            ),
          ),
          child: widget.child,
        );
      },
    );
  }
}

// ─── Spark Particles (Welding/Workshop themed) ──────────────────────────────

class SparkParticles extends StatefulWidget {
  const SparkParticles({Key? key}) : super(key: key);

  @override
  State<SparkParticles> createState() => _SparkParticlesState();
}

class _SparkParticlesState extends State<SparkParticles>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_Spark> _sparks = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();
    // Create warm-toned sparks
    for (int i = 0; i < 25; i++) {
      _sparks.add(_Spark(
        x: _random.nextDouble(),
        y: _random.nextDouble(),
        size: _random.nextDouble() * 2.5 + 0.5,
        speed: _random.nextDouble() * 0.4 + 0.1,
        opacity: _random.nextDouble() * 0.4 + 0.05,
        isWarm: _random.nextBool(), // Mix of amber and white sparks
      ));
    }
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return CustomPaint(
          painter: _SparkPainter(_sparks, _controller.value),
          size: Size.infinite,
        );
      },
    );
  }
}

class _Spark {
  double x, y, size, speed, opacity;
  bool isWarm;
  _Spark({
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.opacity,
    required this.isWarm,
  });
}

class _SparkPainter extends CustomPainter {
  final List<_Spark> sparks;
  final double tick;

  _SparkPainter(this.sparks, this.tick);

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in sparks) {
      // Sparks drift upward and wobble
      final yPos = (s.y - tick * s.speed * 0.015) % 1.0;
      final xWobble = math.sin((yPos + tick * 2) * math.pi * 3) * 0.008;
      final color = s.isWarm
          ? const Color(0xFF4DA8FF) // Amber/orange
          : const Color(0xFF8DD8FF); // Light gold
      final paint = Paint()
        ..color = color.withOpacity(s.opacity)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, s.size * 2);
      canvas.drawCircle(
        Offset((s.x + xWobble) * size.width, yPos * size.height),
        s.size,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// ─── Hero Logo with Animated Glow Ring ──────────────────────────────────────

class HeroLogo extends StatefulWidget {
  const HeroLogo({super.key});

  @override
  State<HeroLogo> createState() => _HeroLogoState();
}

class _HeroLogoState extends State<HeroLogo>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 2500),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final glowVal = Curves.easeInOut.transform(_controller.value);
        return SizedBox(
          width: 120,
          height: 120,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer pulsing glow ring
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFF4DA8FF)
                        .withOpacity(0.15 + glowVal * 0.2),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4DA8FF)
                          .withOpacity(0.08 + glowVal * 0.12),
                      blurRadius: 20 + glowVal * 15,
                      spreadRadius: 2 + glowVal * 5,
                    ),
                  ],
                ),
              ),
              // Inner circle background
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF0A3D6B).withOpacity(0.8),
                      const Color(0xFF001830).withOpacity(0.9),
                    ],
                  ),
                  border: Border.all(
                    color: const Color(0xFF4DA8FF).withOpacity(0.3),
                    width: 1.5,
                  ),
                ),
              ),
              // Wrench icon with subtle rotation
              Transform.rotate(
                angle: math.sin(_controller.value * math.pi) * 0.15,
                child: ShaderMask(
                  shaderCallback: (bounds) => const LinearGradient(
                    colors: [Color(0xFF4DA8FF), Color(0xFF8DD8FF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ).createShader(bounds),
                  child: const Icon(
                    Icons.build_rounded,
                    size: 42,
                    color: Colors.white,
                  ),
                ),
              ),
              // Small vehicle icons orbiting
              Positioned(
                left: 4,
                bottom: 8,
                child: Opacity(
                  opacity: 0.6 + glowVal * 0.3,
                  child: const Icon(Icons.directions_car_rounded,
                      size: 18, color: Color(0xFF8DD8FF)),
                ),
              ),
              Positioned(
                right: 4,
                bottom: 8,
                child: Opacity(
                  opacity: 0.6 + glowVal * 0.3,
                  child: const Icon(Icons.two_wheeler_rounded,
                      size: 18, color: Color(0xFF8DD8FF)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Shimmer Text ───────────────────────────────────────────────────────────

class ShimmerText extends StatefulWidget {
  final String text;
  final TextStyle style;
  const ShimmerText({Key? key, required this.text, required this.style})
      : super(key: key);

  @override
  State<ShimmerText> createState() => _ShimmerTextState();
}

class _ShimmerTextState extends State<ShimmerText>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final slide = _controller.value * 3 - 1;
        return ShaderMask(
          shaderCallback: (bounds) {
            return LinearGradient(
              colors: const [
                Color(0xFFFFFFFF),
                Color(0xFF4DA8FF),
                Color(0xFFFFFFFF),
              ],
              stops: [
                (slide - 0.3).clamp(0.0, 1.0),
                slide.clamp(0.0, 1.0),
                (slide + 0.3).clamp(0.0, 1.0),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ).createShader(bounds);
          },
          child: Text(widget.text, style: widget.style),
        );
      },
    );
  }
}

// ─── Animated Gradient Button (Amber themed) ────────────────────────────────

class AnimatedGradientButton extends StatefulWidget {
  final VoidCallback onPressed;
  final bool isLoading;
  final String label;
  final IconData? icon;

  const AnimatedGradientButton({
    Key? key,
    required this.onPressed,
    required this.isLoading,
    required this.label,
    this.icon,
  }) : super(key: key);

  @override
  State<AnimatedGradientButton> createState() => _AnimatedGradientButtonState();
}

class _AnimatedGradientButtonState extends State<AnimatedGradientButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      duration: const Duration(milliseconds: 2500),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        final shimmerPos = _shimmerController.value * 3 - 1;
        return GestureDetector(
          onTap: widget.isLoading ? null : widget.onPressed,
          child: Container(
            width: double.infinity,
            height: 58,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF0066CC),
                  Color(0xFF4DA8FF),
                  Color(0xFF0066CC),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF4DA8FF).withOpacity(0.35),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                  spreadRadius: -4,
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: Stack(
                children: [
                  // Shimmer sweep
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0.25,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: const [
                              Colors.transparent,
                              Colors.white,
                              Colors.transparent,
                            ],
                            stops: [
                              (shimmerPos - 0.2).clamp(0.0, 1.0),
                              shimmerPos.clamp(0.0, 1.0),
                              (shimmerPos + 0.2).clamp(0.0, 1.0),
                            ],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Center(
                    child: widget.isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (widget.icon != null) ...[
                                Icon(widget.icon,
                                    color: Colors.white, size: 20),
                                const SizedBox(width: 10),
                              ],
                              Text(
                                widget.label,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 2.0,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 10),
                              const Icon(
                                Icons.arrow_forward_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─── Pulsing Status Dot ─────────────────────────────────────────────────────

class PulsingDot extends StatefulWidget {
  final Color color;
  final double size;
  const PulsingDot(
      {Key? key, this.color = const Color(0xFF00E676), this.size = 8})
      : super(key: key);

  @override
  State<PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<PulsingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final pulse = Curves.easeInOut.transform(_controller.value);
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.color,
            boxShadow: [
              BoxShadow(
                color: widget.color.withOpacity(0.4 + pulse * 0.3),
                blurRadius: 4 + pulse * 6,
                spreadRadius: pulse * 2,
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Login Screen ───────────────────────────────────────────────────────────

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.googleAuthService,
    this.onGoogleAuthenticated,
  });

  final ProviderGoogleAuthService? googleAuthService;
  final ValueChanged<ProviderGoogleSession>? onGoogleAuthenticated;

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _isGoogleLoading = false;
  late final _googleAuth =
      widget.googleAuthService ?? ProviderGoogleAuthService();
  bool _isPasswordVisible = false;

  // Staggered entrance animation
  late AnimationController _entranceController;
  late List<Animation<double>> _fadeAnimations;
  late List<Animation<Offset>> _slideAnimations;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );

    _fadeAnimations = [];
    _slideAnimations = [];
    for (int i = 0; i < 9; i++) {
      final start = (i * 0.09).clamp(0.0, 0.65);
      final end = (start + 0.35).clamp(0.0, 1.0);
      _fadeAnimations.add(
        Tween<double>(begin: 0.0, end: 1.0).animate(
          CurvedAnimation(
            parent: _entranceController,
            curve: Interval(start, end, curve: Curves.easeOut),
          ),
        ),
      );
      _slideAnimations.add(
        Tween<Offset>(begin: const Offset(0, 0.25), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _entranceController,
            curve: Interval(start, end, curve: Curves.easeOutCubic),
          ),
        ),
      );
    }

    _entranceController.forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_isLoading) return;
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please enter both email and password.'),
          backgroundColor: const Color(0xFF4DA8FF),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final response = await http
          .post(
            Uri.parse('${ApiConfig.baseUrl}/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email,
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 10));

      setState(() {
        _isLoading = false;
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final token = data['accessToken'] ?? data['access_token'];
        final role = data['role'];

        if (role == 'CUSTOMER') {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                  'Access Denied: Please use the QuickMechanic Customer App.'),
              backgroundColor: Colors.redAccent,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          );
          return;
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Welcome back, Mechanic!'),
            backgroundColor: const Color(0xFF00C853),
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );

        await ApiService.saveToken(token);

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
              builder: (context) => DashboardScreen(token: token)),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Invalid email or password.'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Network error. Is the backend running?'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  Future<void> _loginWithGoogle() async {
    if (_isLoading) return;
    setState(() {
      _isLoading = true;
      _isGoogleLoading = true;
    });
    try {
      final session = await authenticateProviderWithGoogle(
          context: context, service: _googleAuth, intent: 'login');
      if (session == null || !mounted) return;
      await ApiService.saveToken(session.accessToken);
      if (!mounted) return;
      if (widget.onGoogleAuthenticated != null) {
        widget.onGoogleAuthenticated!(session);
      } else {
        Navigator.pushReplacement(
            context,
            MaterialPageRoute(
                builder: (_) => DashboardScreen(token: session.accessToken)));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error is ProviderGoogleAuthException
            ? error.message
            : 'Google sign-in failed. Please try again.'),
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

  Widget _staggeredItem(int index, Widget child) {
    return FadeTransition(
      opacity: _fadeAnimations[index],
      child: SlideTransition(
        position: _slideAnimations[index],
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      body: AnimatedBackground(
        child: Stack(
          children: [
            // Spark particles layer
            const Positioned.fill(child: SparkParticles()),
            // Subtle top-right decorative arc
            Positioned(
              top: -60,
              right: -60,
              child: Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFF4DA8FF).withOpacity(0.04),
                    width: 1,
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -80,
              left: -40,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFF4DA8FF).withOpacity(0.03),
                    width: 1,
                  ),
                ),
              ),
            ),
            // Main content
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Hero Logo ──
                      _staggeredItem(0, const HeroLogo()),
                      const SizedBox(height: 20),

                      // ── App Title ──
                      _staggeredItem(
                        1,
                        ShimmerText(
                          text: 'QuickMechanic',
                          style: const TextStyle(
                            fontSize: 34,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2.0,
                            color: Colors.white,
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),

                      // ── Mechanic Portal Badge ──
                      _staggeredItem(
                        1,
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: const Color(0xFF4DA8FF).withOpacity(0.25),
                              width: 1,
                            ),
                            color: const Color(0xFF4DA8FF).withOpacity(0.08),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const PulsingDot(
                                  color: Color(0xFF4DA8FF), size: 7),
                              const SizedBox(width: 8),
                              Text(
                                'SERVICE PROVIDER APP',
                                style: TextStyle(
                                  fontSize: 11,
                                  color:
                                      const Color(0xFF4DA8FF).withOpacity(0.9),
                                  letterSpacing: 2.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),

                      // ── Glass Card ──
                      _staggeredItem(
                        2,
                        ClipRRect(
                          borderRadius: BorderRadius.circular(28),
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 32),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.04),
                                borderRadius: BorderRadius.circular(28),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.08),
                                  width: 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.3),
                                    blurRadius: 30,
                                    offset: const Offset(0, 10),
                                  ),
                                ],
                              ),
                              child: Column(
                                children: [
                                  // Welcome text
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.engineering_rounded,
                                        color: const Color(0xFF4DA8FF)
                                            .withOpacity(0.7),
                                        size: 22,
                                      ),
                                      const SizedBox(width: 10),
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Provider sign in',
                                            style: TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.w600,
                                              color:
                                                  Colors.white.withOpacity(0.9),
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            'Manage jobs, earnings and availability',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.white
                                                  .withOpacity(0.35),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 28),

                                  // Email Field
                                  _buildGlassTextField(
                                    controller: _emailController,
                                    hintText: 'Email Address',
                                    icon: Icons.alternate_email_rounded,
                                  ),
                                  const SizedBox(height: 16),

                                  // Password Field
                                  _buildGlassTextField(
                                    controller: _passwordController,
                                    hintText: 'Password',
                                    icon: Icons.lock_outline_rounded,
                                    obscureText: !_isPasswordVisible,
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        _isPasswordVisible
                                            ? Icons.visibility_rounded
                                            : Icons.visibility_off_rounded,
                                        color: Colors.white.withOpacity(0.35),
                                        size: 20,
                                      ),
                                      onPressed: () {
                                        setState(() {
                                          _isPasswordVisible =
                                              !_isPasswordVisible;
                                        });
                                      },
                                    ),
                                  ),
                                  const SizedBox(height: 8),

                                  // Forgot Password
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: () {
                                        Navigator.push(
                                          context,
                                          PageRouteBuilder(
                                            pageBuilder: (context, animation,
                                                    secondaryAnimation) =>
                                                ForgotPasswordScreen(),
                                            transitionsBuilder: (context,
                                                animation,
                                                secondaryAnimation,
                                                child) {
                                              return FadeTransition(
                                                opacity: animation,
                                                child: child,
                                              );
                                            },
                                            transitionDuration: const Duration(
                                                milliseconds: 300),
                                          ),
                                        );
                                      },
                                      style: TextButton.styleFrom(
                                        padding: EdgeInsets.zero,
                                        minimumSize: const Size(0, 30),
                                        tapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                      ),
                                      child: Text(
                                        'Forgot Password?',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: const Color(0xFF4DA8FF)
                                              .withOpacity(0.8),
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 20),

                                  // Sign In Button
                                  AnimatedGradientButton(
                                    onPressed: _login,
                                    isLoading: _isLoading,
                                    label: 'SIGN IN',
                                    icon: Icons.login_rounded,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),

                      // ── OR Divider ──
                      _staggeredItem(
                        3,
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                height: 1,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.transparent,
                                      Colors.white.withOpacity(0.15),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 4),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.08),
                                  ),
                                ),
                                child: Text(
                                  'OR',
                                  style: TextStyle(
                                    fontSize: 11,
                                    letterSpacing: 2,
                                    color: Colors.white.withOpacity(0.3),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Container(
                                height: 1,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.white.withOpacity(0.15),
                                      Colors.transparent,
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),

                      // ── Google Button ──
                      _staggeredItem(
                        4,
                        GestureDetector(
                          key: const Key('provider-google-login'),
                          onTap: _isLoading ? null : _loginWithGoogle,
                          child: Container(
                            width: double.infinity,
                            height: 56,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              color: Colors.white.withOpacity(0.06),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.1),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Center(
                                    child: Text(
                                      'G',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF4285F4),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Text(
                                  _isGoogleLoading
                                      ? 'Signing in with Google…'
                                      : 'Continue with Google',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white.withOpacity(0.8),
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),

                      // ── Sign Up Link ──
                      _staggeredItem(
                        5,
                        TextButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              PageRouteBuilder(
                                pageBuilder:
                                    (context, animation, secondaryAnimation) =>
                                        SignupScreen(),
                                transitionsBuilder: (context, animation,
                                    secondaryAnimation, child) {
                                  return FadeTransition(
                                    opacity: animation,
                                    child: SlideTransition(
                                      position: Tween<Offset>(
                                        begin: const Offset(0, 0.1),
                                        end: Offset.zero,
                                      ).animate(CurvedAnimation(
                                        parent: animation,
                                        curve: Curves.easeOut,
                                      )),
                                      child: child,
                                    ),
                                  );
                                },
                                transitionDuration:
                                    const Duration(milliseconds: 400),
                              ),
                            );
                          },
                          child: RichText(
                            text: TextSpan(
                              text: "New mechanic?  ",
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.45),
                                fontSize: 14,
                              ),
                              children: const [
                                TextSpan(
                                  text: "Register here",
                                  style: TextStyle(
                                    color: Color(0xFF4DA8FF),
                                    fontWeight: FontWeight.w700,
                                    decoration: TextDecoration.underline,
                                    decorationColor: Color(0xFF4DA8FF),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            ),
          ],
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
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 15,
          fontWeight: FontWeight.w400,
        ),
        cursorColor: const Color(0xFF4DA8FF),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: TextStyle(
            color: Colors.white.withOpacity(0.25),
            fontSize: 14,
            fontWeight: FontWeight.w400,
          ),
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: 16, right: 12),
            child: Icon(icon,
                color: const Color(0xFF4DA8FF).withOpacity(0.5), size: 20),
          ),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 0, minHeight: 0),
          suffixIcon: suffixIcon,
          filled: true,
          fillColor: Colors.white.withOpacity(0.03),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide:
                BorderSide(color: Colors.white.withOpacity(0.08), width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF4DA8FF), width: 1.5),
          ),
        ),
      ),
    );
  }
}
