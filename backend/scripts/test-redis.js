// Smoke-test the managed Redis URL: connect, PING, SET/GET, pub/sub round-trip.
// Mirrors what the Socket.IO adapter and location cache do in production.
const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

const env = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '..', '.env.production')));
const url = env.REDIS_URL;
if (!url) { console.error('REDIS_URL not set in .env.production'); process.exit(2); }

// Layerbase routes connections by TLS SNI, so node-redis needs the servername
// set explicitly even though it is already present in the URL hostname.
const host = new URL(url).hostname;
const useTls = url.startsWith('rediss://');
const clientOpts = { url, socket: useTls ? { tls: true, servername: host, rejectUnauthorized: true } : {} };

(async () => {
  const pub = createClient(clientOpts);
  const sub = pub.duplicate();
  pub.on('error', (e) => console.error('pub error:', e.message));
  sub.on('error', (e) => console.error('sub error:', e.message));

  try {
    await Promise.all([pub.connect(), sub.connect()]);
    console.log('OK: connected over TLS to', new URL(url).host);

    const pong = await pub.ping();
    console.log('OK: PING ->', pong);

    await pub.set('qm:test', 'hello', { EX: 60 });
    console.log('OK: SET/GET ->', await pub.get('qm:test'));

    // Pub/sub is what the Socket.IO adapter depends on across replicas.
    const got = new Promise((resolve) => sub.subscribe('qm:channel', (msg) => resolve(msg)));
    await new Promise(r => setTimeout(r, 150));
    await pub.publish('qm:channel', 'ping-from-script');
    console.log('OK: pub/sub ->', await got);
  } catch (e) {
    console.error('REDIS TEST FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await pub.quit().catch(() => {});
    await sub.quit().catch(() => {});
  }
})();
