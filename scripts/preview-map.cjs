// Serve the separately built Flutter map preview on loopback only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../apps/customer_app/build/map-preview');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm', '.css': 'text/css', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400).end(); }
}).listen(8089, '127.0.0.1', () => console.log('Map preview: http://127.0.0.1:8089'));
