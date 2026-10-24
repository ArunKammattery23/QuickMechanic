import 'package:flutter/material.dart';

import '../services/google_auth_service.dart';

Future<ProviderGoogleSession?> authenticateProviderWithGoogle({
  required BuildContext context,
  required ProviderGoogleAuthService service,
  required String intent,
  String? phoneNumber,
  String? providerType,
}) async {
  final idToken = await service.identity.authenticate();
  if (idToken == null || !context.mounted) return null;
  try {
    return await service.exchange(
        idToken: idToken,
        intent: intent,
        phoneNumber: phoneNumber,
        providerType: providerType);
  } on ProviderGoogleAuthException catch (error) {
    if (!error.needsAccountLink || !context.mounted) rethrow;
    final password = await showDialog<String>(
      context: context,
      builder: (_) => const _LinkAccountDialog(),
    );
    if (password == null || !context.mounted) return null;
    return service.exchange(
        idToken: idToken,
        intent: intent,
        phoneNumber: phoneNumber,
        providerType: providerType,
        linkPassword: password);
  }
}

bool isValidProviderMobile(String phone) =>
    RegExp(r'^\+?[1-9]\d{9,14}$').hasMatch(phone.trim());

Future<String?> collectProviderGoogleMobile(
        BuildContext context, String initialValue) =>
    showDialog<String>(
      context: context,
      builder: (_) => _GoogleMobileDialog(initialValue: initialValue),
    );

class _LinkAccountDialog extends StatefulWidget {
  const _LinkAccountDialog();
  @override
  State<_LinkAccountDialog> createState() => _LinkAccountDialogState();
}

class _LinkAccountDialogState extends State<_LinkAccountDialog> {
  final _password = TextEditingController();
  final _form = GlobalKey<FormState>();
  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_form.currentState!.validate()) {
      Navigator.pop(context, _password.text);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Link your existing Provider account'),
        content: Form(
          key: _form,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text(
                'An account with this email already exists. Enter its QuickMechanic password to securely connect Google sign-in.'),
            const SizedBox(height: 16),
            TextFormField(
              key: const Key('google-link-password'),
              controller: _password,
              obscureText: true,
              enableSuggestions: false,
              autocorrect: false,
              autofillHints: const [AutofillHints.password],
              decoration:
                  const InputDecoration(labelText: 'QuickMechanic password'),
              validator: (value) => value == null || value.isEmpty
                  ? 'Enter your existing account password.'
                  : null,
              onFieldSubmitted: (_) => _confirm(),
            ),
          ]),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(onPressed: _confirm, child: const Text('Link account')),
        ],
      );
}

class _GoogleMobileDialog extends StatefulWidget {
  const _GoogleMobileDialog({required this.initialValue});
  final String initialValue;
  @override
  State<_GoogleMobileDialog> createState() => _GoogleMobileDialogState();
}

class _GoogleMobileDialogState extends State<_GoogleMobileDialog> {
  late final _phone = TextEditingController(text: widget.initialValue);
  final _form = GlobalKey<FormState>();
  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_form.currentState!.validate()) {
      Navigator.pop(context, _phone.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Add your mobile number'),
        content: Form(
          key: _form,
          child: TextFormField(
            key: const Key('google-signup-phone'),
            controller: _phone,
            keyboardType: TextInputType.phone,
            autofillHints: const [AutofillHints.telephoneNumber],
            maxLength: 16,
            decoration: const InputDecoration(labelText: 'Mobile number'),
            validator: (value) => isValidProviderMobile(value ?? '')
                ? null
                : 'Enter a valid 10 to 15 digit mobile number.',
            onFieldSubmitted: (_) => _confirm(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(onPressed: _confirm, child: const Text('Continue')),
        ],
      );
}
