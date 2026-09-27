import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/services/service_config_loader.dart';

void main() {
  test('loads catalogue and saved selections again after an initial failure',
      () async {
    var failed = true;
    await http.runWithClient(() async {
      await expectLater(loadServiceConfig('http://test', 'provider', 'token'),
          throwsException);
      failed = false;
      final data = await loadServiceConfig('http://test', 'provider', 'token');
      expect(data.services.first['name'], 'Tyre repair');
      expect(data.saved['services'], ['service-1']);
    },
        () => MockClient((r) async {
              if (failed) return http.Response('Unavailable', 503);
              return http.Response(
                  jsonEncode(r.url.path == '/services'
                      ? [
                          {'id': 'service-1', 'name': 'Tyre repair'}
                        ]
                      : r.url.path == '/vehicle-categories'
                          ? [
                              {
                                'id': 'vehicle-1',
                                'name': 'Car',
                                'group': '4 Wheeler'
                              }
                            ]
                          : {
                              'services': ['service-1'],
                              'vehicles': ['vehicle-1'],
                              'pricing': []
                            }),
                  200);
            }));
  });
  test('does not silently treat a failed saved configuration as no selections',
      () async {
    await http.runWithClient(() async {
      await expectLater(
          loadServiceConfig('http://test', 'provider', 'token'),
          throwsA(
              predicate((e) => e.toString().contains('saved configuration'))));
    },
        () => MockClient((r) async => r.url.path.endsWith('/config')
            ? http.Response('{}', 404)
            : http.Response('[{"id":"one"}]', 200)));
  });
}
