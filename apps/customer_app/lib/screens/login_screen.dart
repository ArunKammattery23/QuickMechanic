import 'package:flutter/material.dart';
import 'dart:ui';
import 'dart:math' as math;
import 'signup_screen.dart';
import 'home_screen.dart';
import '../services/api_service.dart';

// ─── Animated Gradient Background with Floating Particles ───────────────────

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
      duration: const Duration(seconds: 12),
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
                Color(0xFF000C18),
                Color(0xFF001830),
                Color(0xFF002E5C),
                Color(0xFF00447A),
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

// ─── Floating Particles Overlay ─────────────────────────────────────────────

class FloatingParticles extends StatefulWidget {
  const FloatingParticles({Key? key}) : super(key: key);

  @override
  State<FloatingParticles> createState() => _FloatingParticlesState();
}

class _FloatingParticlesState extends State<FloatingParticles>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_Particle> _particles = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();
    for (int i = 0; i < 30; i++) {
      _particles.add(_Particle(
        x: _random.nextDouble(),
        y: _random.nextDouble(),
        size: _random.nextDouble() * 3 + 1,
        speed: _random.nextDouble() * 0.3 + 0.1,
        opacity: _random.nextDouble() * 0.3 + 0.05,
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
          painter: _ParticlePainter(_particles, _controller.value),
          size: Size.infinite,
        );
      },
    );
  }
}

class _Particle {
  double x, y, size, speed, opacity;
  _Particle({
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.opacity,
  });
}

class _ParticlePainter extends CustomPainter {
  final List<_Particle> particles;
  final double tick;

  _ParticlePainter(this.particles, this.tick);

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in particles) {
      final yPos = (p.y - tick * p.speed * 0.02) % 1.0;
      final xWobble = math.sin((yPos + tick) * math.pi * 2) * 0.01;
      final paint = Paint()
        ..color = const Color(0xFF4DA8FF).withOpacity(p.opacity)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, p.size * 1.5);
      canvas.drawCircle(
        Offset((p.x + xWobble) * size.width, yPos * size.height),
        p.size,
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

// ─── Shimmer Text for App Name ──────────────────────────────────────────────

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
        return ShaderMask(
          shaderCallback: (bounds) {
            final slide = _controller.value * 3 - 1;
            return LinearGradient(
              colors: const [
                Color(0xFFFFFFFF),
                Color(0xFF8DD8FF),
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

// ─── Animated Gradient Button ───────────────────────────────────────────────

class AnimatedGradientButton extends StatefulWidget {
  final VoidCallback onPressed;
  final bool isLoading;
  final String label;

  const AnimatedGradientButton({
    Key? key,
    required this.onPressed,
    required this.isLoading,
    required this.label,
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
      duration: const Duration(seconds: 2),
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
                  Color(0xFF3399FF),
                  Color(0xFF0077E6)
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF3399FF).withOpacity(0.4),
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
                      opacity: 0.3,
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

// ─── Login Screen ───────────────────────────────────────────────────────────

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;

  // Staggered entrance animation
  late AnimationController _entranceController;
  late List<Animation<double>> _fadeAnimations;
  late List<Animation<Offset>> _slideAnimations;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      duration: const Duration(milliseconds: 1800),
      vsync: this,
    );

    // Create staggered animations for 7 elements
    _fadeAnimations = [];
    _slideAnimations = [];
    for (int i = 0; i < 8; i++) {
      final start = (i * 0.1).clamp(0.0, 0.7);
      final end = (start + 0.4).clamp(0.0, 1.0);
      _fadeAnimations.add(
        Tween<double>(begin: 0.0, end: 1.0).animate(
          CurvedAnimation(
            parent: _entranceController,
            curve: Interval(start, end, curve: Curves.easeOut),
          ),
        ),
      );
      _slideAnimations.add(
        Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
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

  void _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please enter email and password'),
          backgroundColor: const Color(0xFF0066CC),
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

    final result = await ApiService.login(
      _emailController.text,
      _passwordController.text,
    );

    setState(() {
      _isLoading = false;
    });

    if (result['success']) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Login Successful!'),
          backgroundColor: const Color(0xFF00C853),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const HomeScreen()),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message']),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
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
            // Floating particles layer
            const Positioned.fill(child: FloatingParticles()),
            // Main content
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Logo Section ──
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
                      _staggeredItem(
                        1,
                        Text(
                          'Fast, Reliable Roadside Assistance',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withOpacity(0.5),
                            letterSpacing: 1.5,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _staggeredItem(
                        1,
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 9),
                          decoration: BoxDecoration(
                            color: const Color(0xFF4DA8FF).withOpacity(0.13),
                            borderRadius: BorderRadius.circular(30),
                            border: Border.all(
                                color:
                                    const Color(0xFF4DA8FF).withOpacity(0.45)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.person_pin_circle_rounded,
                                  color: Color(0xFF80CAFF), size: 18),
                              SizedBox(width: 8),
                              Text('CUSTOMER APP',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      letterSpacing: 1.8,
                                      fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 36),

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
                                color: Colors.white.withOpacity(0.06),
                                borderRadius: BorderRadius.circular(28),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.12),
                                  width: 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 30,
                                    offset: const Offset(0, 10),
                                  ),
                                ],
                              ),
                              child: Column(
                                children: [
                                  // Welcome text
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      'Customer sign in',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white.withOpacity(0.9),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      'Request help and track your mechanic',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.white.withOpacity(0.4),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 28),

                                  // Email Field
                                  _buildGlassTextField(
                                    controller: _emailController,
                                    hintText: 'Email or Phone',
                                    icon: Icons.alternate_email_rounded,
                                  ),
                                  const SizedBox(height: 16),

                                  // Password Field
                                  _buildGlassTextField(
                                    controller: _passwordController,
                                    hintText: 'Password',
                                    icon: Icons.lock_outline_rounded,
                                    obscureText: _obscurePassword,
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        _obscurePassword
                                            ? Icons.visibility_off_rounded
                                            : Icons.visibility_rounded,
                                        color: Colors.white.withOpacity(0.4),
                                        size: 20,
                                      ),
                                      onPressed: () {
                                        setState(() {
                                          _obscurePassword = !_obscurePassword;
                                        });
                                      },
                                    ),
                                  ),
                                  const SizedBox(height: 10),

                                  // Forgot Password
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: () {},
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
                                          fontWeight: FontWeight.w500,
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
                                      Colors.white.withOpacity(0.2),
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
                                    color: Colors.white.withOpacity(0.1),
                                  ),
                                ),
                                child: Text(
                                  'OR',
                                  style: TextStyle(
                                    fontSize: 11,
                                    letterSpacing: 2,
                                    color: Colors.white.withOpacity(0.35),
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
                                      Colors.white.withOpacity(0.2),
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
                          onTap: () {
                            print("Google Sign In clicked");
                          },
                          child: Container(
                            width: double.infinity,
                            height: 56,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              color: Colors.white.withOpacity(0.08),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.15),
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
                                  'Continue with Google',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white.withOpacity(0.85),
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
                              text: "Don't have an account?  ",
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                fontSize: 14,
                              ),
                              children: const [
                                TextSpan(
                                  text: "Sign up",
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
            color: Colors.black.withOpacity(0.1),
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
            color: Colors.white.withOpacity(0.3),
            fontSize: 14,
            fontWeight: FontWeight.w400,
          ),
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: 16, right: 12),
            child: Icon(icon,
                color: const Color(0xFF4DA8FF).withOpacity(0.6), size: 20),
          ),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 0, minHeight: 0),
          suffixIcon: suffixIcon,
          filled: true,
          fillColor: Colors.white.withOpacity(0.04),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide:
                BorderSide(color: Colors.white.withOpacity(0.1), width: 1),
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
