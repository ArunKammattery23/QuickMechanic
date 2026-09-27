import 'package:http/browser_client.dart';
import 'package:http/http.dart' as http;

// Browser HTTP caching follows the tile server's Cache-Control headers.
http.BaseClient createTileClient() => BrowserClient();
