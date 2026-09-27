import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import '../config/api_config.dart';

class KycVerificationScreen extends StatefulWidget {
  final String token;
  const KycVerificationScreen({super.key, required this.token});
  @override
  State<KycVerificationScreen> createState() => _KycVerificationScreenState();
}

class _KycVerificationScreenState extends State<KycVerificationScreen> {
  final _form = GlobalKey<FormState>();
  final _address = TextEditingController();
  final _secondary = TextEditingController();
  final _picker = ImagePicker();
  String _idType = 'AADHAAR';
  Uint8List? _front, _back;
  String? _frontMime, _backMime, _error;
  Map<String, dynamic>? _summary;
  bool _busy = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _address.dispose();
    _secondary.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted)
      setState(() {
        _loading = true;
        _error = null;
      });
    try {
      final response = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/users/me/kyc'), headers: {
        'Authorization': 'Bearer ${widget.token}'
      }).timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) {
        throw Exception('Unable to load KYC status (${response.statusCode})');
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _summary = data;
        _idType = data['idType'] as String? ?? _idType;
      });
      _address.text = data['address'] as String? ?? '';
      _secondary.text = data['secondaryPhone'] as String? ?? '';
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pick(bool front) async {
    final source = await showModalBottomSheet<ImageSource>(
        context: context,
        builder: (sheet) => SafeArea(
                child: Wrap(children: [
              ListTile(
                  leading: const Icon(Icons.camera_alt_outlined),
                  title: const Text('Take photo'),
                  onTap: () => Navigator.pop(sheet, ImageSource.camera)),
              ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: const Text('Choose from gallery'),
                  onTap: () => Navigator.pop(sheet, ImageSource.gallery)),
            ])));
    if (source == null) return;
    try {
      final photo = await _picker.pickImage(
          source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 75);
      if (photo == null) return;
      final bytes = await photo.readAsBytes();
      if (bytes.length < 1024 || bytes.length > 2 * 1024 * 1024) {
        throw Exception(
            'Each image must be between 1 KB and 2 MB. Retake at a lower resolution.');
      }
      final mime = bytes.length > 3 &&
              bytes[0] == 0xff &&
              bytes[1] == 0xd8 &&
              bytes[2] == 0xff
          ? 'image/jpeg'
          : bytes.length > 8 &&
                  bytes[0] == 137 &&
                  bytes[1] == 80 &&
                  bytes[2] == 78
              ? 'image/png'
              : null;
      if (mime == null) throw Exception('Please select a JPEG or PNG photo');
      if (!mounted) return;
      setState(() {
        if (front) {
          _front = bytes;
          _frontMime = mime;
        } else {
          _back = bytes;
          _backMime = mime;
        }
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    if (_front == null || _back == null) {
      setState(() => _error = 'Add both front and back ID card photos.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final request = http.MultipartRequest(
          'POST', Uri.parse('${ApiConfig.baseUrl}/users/me/kyc'));
      request.headers['Authorization'] = 'Bearer ${widget.token}';
      request.fields.addAll({
        'idType': _idType,
        'address': _address.text.trim(),
        'secondaryPhone': _secondary.text.trim()
      });
      request.files.add(http.MultipartFile.fromBytes('front', _front!,
          filename: 'front.${_frontMime == 'image/png' ? 'png' : 'jpg'}',
          contentType: MediaType.parse(_frontMime!)));
      request.files.add(http.MultipartFile.fromBytes('back', _back!,
          filename: 'back.${_backMime == 'image/png' ? 'png' : 'jpg'}',
          contentType: MediaType.parse(_backMime!)));
      final response = await http.Response.fromStream(
          await request.send().timeout(const Duration(seconds: 30)));
      final body = jsonDecode(response.body);
      if (response.statusCode != 201 && response.statusCode != 200) {
        throw Exception(body['message'] ?? 'KYC submission failed');
      }
      if (!mounted) return;
      setState(() {
        _front = null;
        _back = null;
      });
      await _load();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('KYC submitted for admin review')));
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _photo(bool front) {
    final bytes = front ? _front : _back;
    return InkWell(
        onTap: _busy ? null : () => _pick(front),
        child: Container(
          height: 142,
          width: double.infinity,
          decoration: BoxDecoration(
              border: Border.all(
                  color: bytes == null
                      ? const Color(0xFFD6E1EA)
                      : const Color(0xFF21A179),
                  width: bytes == null ? 1.2 : 1.8),
              borderRadius: BorderRadius.circular(18),
              color: bytes == null
                  ? const Color(0xFFF7FAFC)
                  : const Color(0xFFEAF8F2)),
          child: bytes == null
              ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(
                      front ? Icons.badge_outlined : Icons.credit_card_outlined,
                      size: 28,
                      color: const Color(0xFF527087)),
                  const SizedBox(height: 9),
                  Text(front ? 'Front side' : 'Back side',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  const Text('Tap to add photo',
                      style: TextStyle(fontSize: 11, color: Color(0xFF718096))),
                ])
              : ClipRRect(
                  borderRadius: BorderRadius.circular(15),
                  child: Image.memory(bytes, fit: BoxFit.cover)),
        ));
  }

  Widget _sectionCard({required Widget child}) => Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE8EDF3)),
          boxShadow: const [
            BoxShadow(
                color: Color(0x080B1B35), blurRadius: 18, offset: Offset(0, 6))
          ],
        ),
        child: child,
      );

  Widget _sectionTitle(String step, String title, String subtitle) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: const Color(0xFFEAF2FF),
                borderRadius: BorderRadius.circular(12)),
            child: Text(step,
                style: const TextStyle(
                    color: Color(0xFF315FA8), fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(subtitle,
                  style: const TextStyle(
                      color: Color(0xFF718096), fontSize: 12, height: 1.4)),
            ]),
          ),
        ],
      );

  Widget _detailRow(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.only(top: 14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 19, color: const Color(0xFF55718A)),
          const SizedBox(width: 10),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label.toUpperCase(),
                  style: const TextStyle(
                      color: Color(0xFF8190A1),
                      fontSize: 10,
                      letterSpacing: .8,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(value.isEmpty ? 'Not provided' : value,
                  style: const TextStyle(
                      color: Color(0xFF243247),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      height: 1.35)),
            ]),
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final approved = _summary?['status'] == 'APPROVED';
    final rejected = _summary?['status'] == 'REJECTED';
    final submitted = _summary?['submitted'] == true;
    final canSubmit = _summary != null && (!submitted || rejected);
    final statusColor = approved
        ? const Color(0xFF14804A)
        : rejected
            ? const Color(0xFFB42318)
            : submitted
                ? const Color(0xFFB56A0A)
                : const Color(0xFF315FA8);
    final statusTitle = approved
        ? 'Identity verified'
        : rejected
            ? 'Update your documents'
            : submitted
                ? 'Under review'
                : 'Verify your identity';
    final statusCopy = approved
        ? 'Your identity has been approved. You are cleared to accept jobs.'
        : rejected
            ? (_summary?['reviewNote']?.toString().trim().isNotEmpty == true
                ? _summary!['reviewNote'].toString()
                : 'Review your information and submit clear photos again.')
            : submitted
                ? 'Your documents are safely submitted. You do not need to upload them again while our team reviews your application.'
                : 'Complete these steps so customers can book you with confidence. Approval is required before taking jobs.';
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF4F7FB),
        title: const Text('Identity verification',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
              tooltip: 'Refresh KYC status',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [statusColor, statusColor.withOpacity(.82)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                      color: statusColor.withOpacity(.2),
                      blurRadius: 20,
                      offset: const Offset(0, 8))
                ],
              ),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                            color: Colors.white.withOpacity(.18),
                            borderRadius: BorderRadius.circular(16)),
                        child: Icon(
                            approved
                                ? Icons.verified_rounded
                                : rejected
                                    ? Icons.fact_check_outlined
                                    : submitted
                                        ? Icons.hourglass_top_rounded
                                        : Icons.shield_outlined,
                            color: Colors.white,
                            size: 27),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 11, vertical: 7),
                        decoration: BoxDecoration(
                            color: Colors.white.withOpacity(.18),
                            borderRadius: BorderRadius.circular(20)),
                        child: const Text('PROVIDER KYC',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                letterSpacing: 1,
                                fontWeight: FontWeight.w900)),
                      ),
                    ]),
                    const SizedBox(height: 20),
                    Text(statusTitle,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 23,
                            fontWeight: FontWeight.w900)),
                    const SizedBox(height: 7),
                    Text(statusCopy,
                        style: TextStyle(
                            color: Colors.white.withOpacity(.92),
                            fontSize: 14,
                            height: 1.45)),
                    if (submitted && !rejected) ...[
                      const SizedBox(height: 18),
                      Row(children: [
                        _statusStep('1', 'Submitted', true),
                        Expanded(
                            child: Container(
                                height: 2,
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 8),
                                color: Colors.white.withOpacity(.55))),
                        _statusStep(
                            '2', approved ? 'Approved' : 'Review', approved),
                      ]),
                    ],
                  ]),
            ),
            if (_loading) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(minHeight: 3),
            ],
            if (_error != null)
              _sectionCard(
                child: Row(children: [
                  const Icon(Icons.error_outline_rounded,
                      color: Color(0xFFB42318)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(_error!,
                          style: const TextStyle(color: Color(0xFFB42318)))),
                  TextButton(onPressed: _load, child: const Text('Retry')),
                ]),
              ),
            if (submitted) ...[
              _sectionCard(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Your submitted details',
                          style: TextStyle(
                              fontSize: 17, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      const Text('Your documents are stored securely.',
                          style: TextStyle(
                              color: Color(0xFF718096), fontSize: 12)),
                      _detailRow(
                          Icons.badge_outlined,
                          'Identity document',
                          (_summary?['idType'] ?? '')
                              .toString()
                              .replaceAll('_', ' ')),
                      _detailRow(Icons.home_work_outlined, 'Address',
                          (_summary?['address'] ?? '').toString()),
                      _detailRow(Icons.phone_outlined, 'Secondary number',
                          (_summary?['secondaryPhone'] ?? '').toString()),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 11),
                        decoration: BoxDecoration(
                            color: const Color(0xFFEAF8F2),
                            borderRadius: BorderRadius.circular(14)),
                        child: const Row(children: [
                          Icon(Icons.check_circle_rounded,
                              color: Color(0xFF14804A), size: 19),
                          SizedBox(width: 8),
                          Expanded(
                              child: Text('Front and back photos received',
                                  style: TextStyle(
                                      color: Color(0xFF176B45),
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12))),
                        ]),
                      ),
                    ]),
              ),
            ],
            if (canSubmit) ...[
              _sectionCard(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('1', 'Identity details',
                          'Use your own valid government ID.'),
                      const SizedBox(height: 18),
                      DropdownButtonFormField<String>(
                          value: _idType,
                          decoration: const InputDecoration(
                              labelText: 'ID card type',
                              border: OutlineInputBorder()),
                          items: const [
                            DropdownMenuItem(
                                value: 'AADHAAR', child: Text('Aadhaar card')),
                            DropdownMenuItem(
                                value: 'DRIVING_LICENCE',
                                child: Text('Driving licence')),
                            DropdownMenuItem(
                                value: 'VOTER_ID', child: Text('Voter ID')),
                            DropdownMenuItem(
                                value: 'PASSPORT', child: Text('Passport')),
                            DropdownMenuItem(
                                value: 'OTHER',
                                child: Text('Other government ID')),
                          ],
                          onChanged: (value) {
                            if (value != null) setState(() => _idType = value);
                          }),
                      const SizedBox(height: 16),
                      TextFormField(
                          controller: _address,
                          maxLines: 3,
                          maxLength: 500,
                          decoration: const InputDecoration(
                              labelText: 'Full address',
                              border: OutlineInputBorder()),
                          validator: (value) => (value?.trim().length ?? 0) < 15
                              ? 'Enter your full address'
                              : null),
                      const SizedBox(height: 4),
                      TextFormField(
                          controller: _secondary,
                          keyboardType: TextInputType.phone,
                          maxLength: 16,
                          decoration: const InputDecoration(
                              labelText: 'Secondary mobile number',
                              border: OutlineInputBorder()),
                          validator: (value) => RegExp(r'^\+?[1-9]\d{9,14}$')
                                  .hasMatch(value?.trim() ?? '')
                              ? null
                              : 'Enter a valid 10 to 15 digit number'),
                    ]),
              ),
              _sectionCard(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('2', 'Add ID photos',
                          'Make sure all text is clear and both sides are visible.'),
                      const SizedBox(height: 16),
                      Row(children: [
                        Expanded(child: _photo(true)),
                        const SizedBox(width: 12),
                        Expanded(child: _photo(false)),
                      ]),
                      const SizedBox(height: 12),
                      const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.lock_outline_rounded,
                                size: 16, color: Color(0xFF718096)),
                            SizedBox(width: 7),
                            Expanded(
                                child: Text(
                                    'Your ID photos are only used for identity review.',
                                    style: TextStyle(
                                        color: Color(0xFF718096),
                                        fontSize: 11,
                                        height: 1.4))),
                          ]),
                    ]),
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 54,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _submit,
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF173F68),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16))),
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.shield_outlined),
                  label: Text(
                      _busy
                          ? 'Submitting securely…'
                          : rejected
                              ? 'Resubmit for review'
                              : 'Submit for verification',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusStep(String number, String label, bool complete) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 25,
            height: 25,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: complete ? Colors.white : Colors.white.withOpacity(.2),
                shape: BoxShape.circle),
            child: complete
                ? const Icon(Icons.check_rounded,
                    size: 16, color: Color(0xFF14804A))
                : Text(number,
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 7),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700)),
        ],
      );
}
