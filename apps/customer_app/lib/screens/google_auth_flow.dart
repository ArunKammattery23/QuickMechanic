import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../services/google_auth_service.dart';

enum GoogleAuthIntent { login, signup }

/// Shared Customer flow: Google picker, optional phone and safe account linking.
class GoogleAuthFlow {
  static Future<Map<String, dynamic>> authenticate(
    BuildContext context, {
    required GoogleAuthIntent intent,
    GoogleTokenProvider tokenProvider = const NativeGoogleTokenProvider(),
    String initialPhoneNumber = '',
  }) async {
    const canceled = {'success': false, 'cancelled': true};
    try {
      final idToken = await tokenProvider.authenticate();
      if (!context.mounted || idToken == null) return canceled;
      String? phone;
      if (intent == GoogleAuthIntent.signup) {
        phone = initialPhoneNumber.trim();
        if (!RegExp(r'^\+?[1-9]\d{9,14}$').hasMatch(phone)) {
          phone = await showDialog<String>(
            context: context,
            builder: (_) => _GoogleTextDialog(
              phone: true,
              initialValue: initialPhoneNumber,
            ),
          );
          if (!context.mounted || phone == null) return canceled;
        }
      }
      var result = await ApiService.googleAuthenticate(
        idToken: idToken,
        intent: intent.name,
        phoneNumber: phone,
      );
      if (!context.mounted) return canceled;
      if (result['code'] == 'ACCOUNT_LINK_REQUIRED') {
        final password = await showDialog<String>(
          context: context,
          builder: (_) => const _GoogleTextDialog(phone: false),
        );
        if (!context.mounted || password == null) return canceled;
        // Reuse the same Google-verified token. Never link by email alone.
        result = await ApiService.googleAuthenticate(
          idToken: idToken,
          intent: intent.name,
          phoneNumber: phone,
          linkPassword: password,
        );
      }
      return result;
    } on GoogleAuthenticationException catch (error) {
      return {'success': false, 'message': error.message};
    } catch (_) {
      return {
        'success': false,
        'message':
            'Google sign-in could not finish. Check your connection and try again.',
      };
    }
  }
}

class _GoogleTextDialog extends StatefulWidget {
  const _GoogleTextDialog({required this.phone, this.initialValue = ''});
  final bool phone;
  final String initialValue;

  @override
  State<_GoogleTextDialog> createState() => _GoogleTextDialogState();
}

class _GoogleTextDialogState extends State<_GoogleTextDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      Navigator.pop(
          context, widget.phone ? _controller.text.trim() : _controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
          widget.phone ? 'Your mobile number' : 'Link your existing account'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.phone
                ? 'Enter a mobile number so your mechanic can contact you. '
                    'Google will provide your name and email.'
                : 'An account already uses this Google email. Enter its '
                    'QuickMechanic password to safely link Google sign-in.'),
            const SizedBox(height: 16),
            TextFormField(
              key: ValueKey(widget.phone
                  ? 'google-phone-input'
                  : 'google-link-password-input'),
              controller: _controller,
              autofocus: true,
              obscureText: !widget.phone,
              keyboardType: widget.phone
                  ? TextInputType.phone
                  : TextInputType.visiblePassword,
              decoration: InputDecoration(
                labelText: widget.phone ? 'Mobile number' : 'Existing password',
              ),
              validator: (value) {
                if (widget.phone) {
                  return RegExp(r'^\+?[1-9]\d{9,14}$')
                          .hasMatch(value?.trim() ?? '')
                      ? null
                      : 'Enter a valid 10 to 15 digit mobile number';
                }
                return value == null || value.isEmpty
                    ? 'Enter your existing password'
                    : null;
              },
              onFieldSubmitted: (_) => _submit(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          key: ValueKey(
              widget.phone ? 'google-phone-confirm' : 'google-link-confirm'),
          onPressed: _submit,
          child: Text(widget.phone ? 'Continue' : 'Link account'),
        ),
      ],
    );
  }
}
