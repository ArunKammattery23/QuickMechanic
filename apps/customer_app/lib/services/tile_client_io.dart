import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

http.BaseClient createTileClient() => CachedTileClient();

/// Stores only tiles actually viewed. No area downloads or prefetching.
class CachedTileClient extends http.BaseClient {
  final http.Client _client;
  final Directory _directory;
  CachedTileClient({http.Client? client, Directory? directory})
      : _client = client ?? http.Client(),
        _directory = directory ??
            Directory('${Directory.systemTemp.path}/quickmechanic-map-tiles');

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (request.method != 'GET') return _client.send(request);
    final key = base64Url.encode(utf8.encode(request.url.toString()));
    // Public tile URLs are short; avoid exceeding filesystem name limits for custom URLs.
    if (key.length > 200) return _client.send(request);
    final bytesFile = File('${_directory.path}/$key.tile');
    final metaFile = File('${_directory.path}/$key.json');
    Map<String, dynamic>? meta;
    try {
      if (await metaFile.exists() && await bytesFile.exists()) {
        meta =
            jsonDecode(await metaFile.readAsString()) as Map<String, dynamic>;
        if (DateTime.now().millisecondsSinceEpoch < (meta['expires'] as int)) {
          return http.StreamedResponse(
              Stream.value(await bytesFile.readAsBytes()), 200,
              headers: {'content-type': '${meta['type']}'}, request: request);
        }
        if (meta['etag'] != null)
          request.headers['If-None-Match'] = '${meta['etag']}';
        if (meta['modified'] != null)
          request.headers['If-Modified-Since'] = '${meta['modified']}';
      }
    } catch (_) {/* A damaged/evicted cache entry is fetched again. */}
    final response =
        await _client.send(request).timeout(const Duration(seconds: 10));
    final bytes = await response.stream.toBytes();
    if (response.statusCode != 200 && response.statusCode != 304) {
      return http.StreamedResponse(Stream.value(bytes), response.statusCode,
          headers: response.headers, request: request);
    }
    final result =
        response.statusCode == 304 ? await bytesFile.readAsBytes() : bytes;
    final cacheControl = response.headers['cache-control'] ?? '';
    if (!cacheControl.contains('no-store')) {
      final maxAge = int.tryParse(
          RegExp(r'max-age=(\d+)').firstMatch(cacheControl)?.group(1) ?? '');
      var expires =
          DateTime.now().add(Duration(seconds: maxAge ?? 7 * 24 * 3600));
      if (maxAge == null && response.headers['expires'] != null) {
        try {
          expires = HttpDate.parse(response.headers['expires']!);
        } catch (_) {}
      }
      if (cacheControl.contains('no-cache')) expires = DateTime.now();
      try {
        await _directory.create(recursive: true);
        await bytesFile.writeAsBytes(result, flush: true);
        await metaFile.writeAsString(jsonEncode({
          'expires': expires.millisecondsSinceEpoch,
          'type':
              response.headers['content-type'] ?? meta?['type'] ?? 'image/png',
          'etag': response.headers['etag'] ?? meta?['etag'],
          'modified': response.headers['last-modified'] ?? meta?['modified'],
        }));
      } catch (_) {/* A full cache must not prevent viewing a tile. */}
    }
    return http.StreamedResponse(Stream.value(result), 200,
        headers: {
          'content-type': response.headers['content-type'] ??
              '${meta?['type'] ?? 'image/png'}'
        },
        request: request);
  }

  @override
  void close() => _client.close();
}
