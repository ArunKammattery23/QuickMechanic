import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/services/api_service.dart';

void main() {
  test('rejected credentials explain how to recover without showing HTTP codes', () async {
    final result = await http.runWithClient(
      () => ApiService.login('customer@example.com', 'incorrect'),
      () => MockClient((_) async => http.Response('{"message":"Invalid credentials"}', 401)),
    );
    expect(result['success'], false);
    expect(result['message'], contains('Forgot Password'));
    expect(result['message'], isNot(contains('401')));
  });
}
