import 'package:flutter/material.dart';

abstract final class AdminColors {
  static const background = Color(0xFF061421);
  static const surface = Color(0xFF10283B);
  static const raised = Color(0xFF18364B);
  static const border = Color(0xFF2B5064);
  static const cyan = Color(0xFF67D9E8);
  static const mint = Color(0xFF74E6BF);
  static const amber = Color(0xFFFFCA75);
  static const muted = Color(0xFF9BB3C2);
}

class AdminPanel extends StatelessWidget {
  const AdminPanel({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap});
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  @override Widget build(BuildContext context) => Material(
    color: AdminColors.surface,
    borderRadius: BorderRadius.circular(22),
    child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(22), child: Container(
      padding: padding,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: AdminColors.border)),
      child: child,
    )),
  );
}

class AdminHero extends StatelessWidget {
  const AdminHero({super.key, required this.icon, required this.eyebrow, required this.title, required this.subtitle});
  final IconData icon;
  final String eyebrow, title, subtitle;
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(26),
      gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF1B586B), Color(0xFF102438)]),
      border: Border.all(color: AdminColors.border),
    ),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: Colors.white.withOpacity(.12), borderRadius: BorderRadius.circular(16)), child: Icon(icon, size: 27, color: AdminColors.mint)),
      const SizedBox(width: 15),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(eyebrow.toUpperCase(), style: const TextStyle(color: AdminColors.mint, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.4)),
        const SizedBox(height: 5),
        Text(title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Text(subtitle, style: const TextStyle(color: Color(0xFFB8CFD9), height: 1.35)),
      ])),
    ]),
  );
}

class AdminPill extends StatelessWidget {
  const AdminPill(this.text, {super.key, this.color = AdminColors.cyan});
  final String text;
  final Color color;
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: color.withOpacity(.12), border: Border.all(color: color.withOpacity(.5)), borderRadius: BorderRadius.circular(30)),
    child: Text(text.replaceAll('_', ' '), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)),
  );
}

Color ticketStatusColor(String status) => switch (status) {
  'OPEN' => AdminColors.amber,
  'IN_PROGRESS' => AdminColors.cyan,
  'WAITING_FOR_USER' => AdminColors.mint,
  'RESOLVED' => AdminColors.mint,
  _ => AdminColors.muted,
};

InputDecoration adminInput(String label, {IconData? icon, String? hint}) => InputDecoration(
  labelText: label, hintText: hint,
  prefixIcon: icon == null ? null : Icon(icon, color: AdminColors.cyan),
  filled: true, fillColor: AdminColors.raised,
  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
  border: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: const BorderSide(color: AdminColors.border)),
  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: const BorderSide(color: AdminColors.border)),
);
