import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:quickmechanic_admin/admin_api.dart';

void main() {
  test('login reports local connectivity separately from wrong credentials', () async {
    await http.runWithClient(() async {
      await expectLater(AdminApi.login('admin@mechanic', 'test-password'),
        throwsA(isA<AdminApiException>().having((e) => e.statusCode, 'status', 0)
          .having((e) => e.message, 'message', contains('Cannot reach'))));
    }, () => MockClient((_) async => throw http.ClientException('Connection refused')));
  });
}
