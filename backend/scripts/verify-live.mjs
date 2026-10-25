// End-to-end check of a deployed API using the shared tester accounts.
// Drives one full job (request -> accept -> auto quote -> simulated payment ->
// journey -> completion -> rating -> payout) plus support, admin, routing and
// realtime location. Payments must be in simulation mode.
//
// Usage: node scripts/verify-live.mjs [base-url] [path-to-socket.io-client]
import { createRequire } from 'module';
import { randomUUID } from 'crypto';

const BASE = (process.argv[2] || 'https://quickmechanic-api.onrender.com').replace(/\/$/, '');
const SIO = process.argv[3];
const KOCHI = { lat: 9.9312, lng: 76.2673 };            // provider position
const CUSTOMER_AT = { lat: 9.9500, lng: 76.2900 };       // ~3 km away

const results = [];
async function step(name, fn) {
  try { const note = await fn(); results.push([true, name, note ?? '']); console.log(`PASS  ${name}${note ? '  - ' + note : ''}`); }
  catch (e) { results.push([false, name, e.message]); console.log(`FAIL  ${name}  - ${e.message}`); }
}
async function call(method, path, token, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  if (res.status >= 400) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${typeof data === 'string' ? data.slice(0, 160) : (data.message ?? JSON.stringify(data)).toString().slice(0, 160)}`);
  if (data && data.success === false) throw new Error(`${method} ${path} -> ${data.message}`);
  return data;
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const sub = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub;

let C, P, A, providerId, service, vehicle, jobId;

await step('API reachable (GET /services)', async () => {
  const s = await call('GET', '/services'); ok(Array.isArray(s) && s.length, 'no services');
  service = s.find(x => x.isActive) ?? s[0]; return `${s.length} services`;
});
await step('Vehicle categories', async () => {
  const v = await call('GET', '/vehicle-categories'); ok(Array.isArray(v) && v.length, 'no vehicles');
  vehicle = v.find(x => x.isActive && !x.isPremiumTier); return `${v.length} categories`;
});
await step('Customer login (username)', async () => { C = (await call('POST', '/auth/login', null, { identifier: 'Customer', password: 'Customer2026', accountType: 'CUSTOMER' })).accessToken; });
await step('Provider login (mobile number)', async () => { P = (await call('POST', '/auth/login', null, { identifier: '9000090002', password: 'Provider2026', accountType: 'PROVIDER' })).accessToken; providerId = sub(P); });
await step('Admin login (username)', async () => { A = (await call('POST', '/auth/admin-login', null, { identifier: 'Admin', password: 'Admin2026' })).accessToken; });

await step('Customer profile (GET /users/me)', async () => { const me = await call('GET', '/users/me', C); return me.phoneNumber ? 'has phone' : 'NO PHONE'; });
await step('Provider profile + KYC', async () => { await call('GET', '/users/me', P); const k = await call('GET', '/users/me/kyc', P); return JSON.stringify(k).includes('APPROVED') ? 'KYC approved' : 'KYC: ' + JSON.stringify(k).slice(0, 60); });
await step('Provider pricing (wizard)', async () => { const p = await call('GET', '/dispatch/pricing', P); ok(p.paymentMode === 'simulation', 'payment mode is ' + p.paymentMode); return `commission ${p.commissionBps / 100}%, ${p.paymentMode}`; });
await step('Provider saved config', async () => { const c = await call('GET', `/users/mechanics/${providerId}/config`, P); return `${c.services?.length ?? 0} services`; });
await step('Provider daily stats', async () => { await call('GET', `/users/mechanics/${providerId}/stats/daily`, P); });
await step('Call ICE servers (voice calls)', async () => { await call('GET', '/calls/ice-servers', P); });

// Clear leftovers from an earlier interrupted run so the flow starts clean.
await step('Clear leftover active jobs', async () => {
  const pj = (await call('GET', '/dispatch/active-job', P)).job;
  if (pj) await call('POST', `/dispatch/job/${pj.id}/cancel`, P, { reason: 'verify-live cleanup' });
  const cj = (await call('GET', '/dispatch/customer-active-job', C)).job;
  if (cj) await call('POST', `/dispatch/job/${cj.id}/cancel`, C, { reason: 'verify-live cleanup' }).catch(() => {});
  return pj || cj ? 'cancelled leftovers' : 'none';
});

await step('Provider goes online', async () => { await call('PATCH', `/users/mechanics/${providerId}/status`, P, { isOnline: true, ...KOCHI }); });
await step('Customer finds nearby mechanic', async () => {
  const r = await call('POST', '/dispatch/nearby', C, { serviceType: service.name, ...CUSTOMER_AT, vehicleCategoryId: vehicle.id });
  const me = r.data.find(m => m.user.id === providerId); ok(me, `test mechanic not in ${r.data.length} results`);
  return `${r.data.length} found, test mechanic at ${me.distanceText}`;
});
await step('Customer requests the mechanic', async () => {
  const r = await call('POST', '/dispatch/request', C, { serviceType: service.name, ...CUSTOMER_AT, mechanicId: providerId, vehicleCategoryId: vehicle.id });
  jobId = r.jobId; ok(jobId, 'no jobId'); return service.name + ' / ' + vehicle.name;
});
await step('Provider accepts', async () => { await call('POST', `/dispatch/job/${jobId}/accept`, P); });
await step('Auto quote (road distance via OSRM)', async () => { const q = await call('POST', `/dispatch/job/${jobId}/prepare-quote`, P); return JSON.stringify(q).slice(0, 90); });
await step('Provider sends quote', async () => { await call('POST', `/dispatch/job/${jobId}/send-quote`, P); });
await step('Customer pays (simulated)', async () => {
  const first = await call('POST', `/dispatch/job/${jobId}/confirm-payment`, C, {});
  ok(first.simulationRequired, 'expected simulation prompt');
  await call('POST', `/dispatch/job/${jobId}/confirm-payment`, C, { simulationResult: 'success' });
});
await step('Provider starts journey', async () => { await call('POST', `/dispatch/job/${jobId}/start`, P); });

await step('Realtime location over Socket.IO', async () => {
  ok(SIO, 'socket.io-client path not given - skipped');
  const { io } = createRequire(import.meta.url)(SIO);
  const opts = { transports: ['websocket'], reconnection: false, timeout: 20000 };
  const cs = io(BASE, { ...opts, auth: { token: C } }), ps = io(BASE, { ...opts, auth: { token: P } });
  try {
    await Promise.all([cs, ps].map(s => new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', e => rej(new Error('connect: ' + e.message))); })));
    // Subscribing first replays the cached last position, so wait for the
    // exact point emitted below to prove a live broadcast reached the customer.
    const near = (a, b) => Math.abs(Number(a) - b) < 1e-6;
    const got = new Promise((res, rej) => {
      cs.on('mechanic_location_changed', loc => { if (near(loc.lat ?? loc.latitude, 9.94) && near(loc.lng ?? loc.longitude, 76.28)) res(loc); });
      setTimeout(() => rej(new Error('live location update not received within 15s')), 15000);
    });
    cs.emit('subscribe_to_mechanic', { mechanicId: providerId });
    await new Promise(r => setTimeout(r, 1000));
    ps.emit('update_location', { mechanicId: providerId, lat: 9.9400, lng: 76.2800, timestamp: new Date().toISOString() });
    const loc = await got; return `customer saw ${loc.lat ?? loc.latitude}, ${loc.lng ?? loc.longitude}`;
  } finally { cs.close(); ps.close(); }
});

await step('Breakdown route (OSRM)', async () => {
  const r = await call('POST', '/api/get-breakdown-route', C, { mechanicLat: KOCHI.lat, mechanicLng: KOCHI.lng, customerLat: CUSTOMER_AT.lat, customerLng: CUSTOMER_AT.lng });
  return JSON.stringify(r).slice(0, 70);
});
await step('Provider marks job complete', async () => { await call('POST', `/dispatch/job/${jobId}/complete`, P, {}); });
await step('Customer confirms completion', async () => { await call('POST', `/dispatch/job/${jobId}/confirm-completion`, C); });
await step('Customer rates 5 stars', async () => { await call('POST', `/dispatch/job/${jobId}/rate`, C, { rating: 5 }); });
await step('Job detail shows COMPLETED', async () => { const d = await call('GET', `/dispatch/job/${jobId}`, C); ok(JSON.stringify(d).includes('COMPLETED'), 'status not COMPLETED'); });
await step('Customer + provider history', async () => { await call('GET', '/dispatch/history', C); await call('GET', '/dispatch/history', P); });
await step('Provider wallet transactions', async () => { const t = await call('GET', '/dispatch/transactions', P); return JSON.stringify(t).slice(0, 80); });
await step('Provider withdrawal', async () => {
  try { const w = await call('POST', '/dispatch/mechanic/withdraw', P, {}, { 'Idempotency-Key': randomUUID() }); return w.message ?? 'ok'; }
  catch (e) { if (/24 hours|once per day|already/i.test(e.message)) return 'daily limit already used today (expected rule)'; throw e; }
});

let ticketId;
await step('Support bot answers', async () => { await call('POST', '/support/bot', C, { question: 'How do I pay?' }); });
await step('Customer opens support ticket', async () => {
  const t = await call('POST', '/support/tickets', C, { subject: 'verify-live test', message: 'Automated end-to-end check. Safe to close.', category: 'OTHER' });
  ticketId = t.id ?? t.ticket?.id; await call('GET', '/support/tickets', C);
});
await step('Admin sees + closes ticket', async () => {
  const list = await call('GET', '/support/admin/tickets', A);
  if (ticketId) await call('PATCH', `/support/admin/tickets/${ticketId}/status`, A, { status: 'CLOSED' }).catch(e => { if (!/status/i.test(e.message)) throw e; });
  return `${(list.items ?? list.data ?? list).length ?? '?'} tickets visible`;
});
await step('Admin profile', async () => { await call('GET', '/auth/admin/me', A); });
await step('Admin KYC queue', async () => { await call('GET', '/users/mechanics/pending', A); });
await step('Admin finance (settings, jobs, collections)', async () => {
  await call('GET', '/admin/finance/settings', A);
  const col = await call('GET', '/admin/finance/collections', A);
  // The finance job list is per provider, as the admin app requests it.
  const providers = col.providers ?? col.items ?? col.data ?? [];
  const p = providers.find(x => x.id === providerId || x.user?.id === providerId) ?? providers[0];
  ok(p, 'no providers in collections');
  await call('GET', `/admin/finance/jobs?providerId=${p.id}`, A);
  return `${providers.length} providers in collections`;
});
await step('Provider goes offline', async () => { await call('PATCH', `/users/mechanics/${providerId}/status`, P, { isOnline: false }); });

const failed = results.filter(r => !r[0]);
console.log(`\n--- ${results.length - failed.length}/${results.length} passed${jobId ? `, test job ${jobId}` : ''}`);
process.exit(failed.length ? 1 : 0);
