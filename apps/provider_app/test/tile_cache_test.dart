import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import '../lib/services/tile_client_io.dart';

void main() {
  test('reuses viewed tiles across client instances', () async {
    final directory = await Directory.systemTemp.createTemp('qm-tile-test-');
    var requests = 0;
    final source = MockClient((_) async { requests++; return http.Response.bytes([1, 2, 3], 200, headers: {'cache-control': 'max-age=604800'}); });
    final first = CachedTileClient(client: source, directory: directory);
    final url = Uri.parse('https://tiles.test.invalid/1/0/0.png');
    expect((await first.get(url)).bodyBytes, [1, 2, 3]);
    final second = CachedTileClient(client: source, directory: directory);
    expect((await second.get(url)).bodyBytes, [1, 2, 3]);
    expect(requests, 1);
    first.close(); second.close();
    await directory.delete(recursive: true);
  });
  test('honors no-store rather than caching forbidden responses', () async {
    final directory = await Directory.systemTemp.createTemp('qm-tile-test-');
    var requests = 0;
    final client = CachedTileClient(directory: directory, client: MockClient((_) async { requests++; return http.Response.bytes([1], 200, headers: {'cache-control': 'no-store'}); }));
    final url = Uri.parse('https://tiles.test.invalid/1/0/0.png');
    await client.get(url); await client.get(url);
    expect(requests, 2);
    client.close(); await directory.delete(recursive: true);
  });
}
