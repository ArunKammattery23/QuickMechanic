// Live check of the Customer and Mechanic app features that verify-live.mjs
// (the single happy-path job) does not reach: sign-up, cancellations and
// refunds, failed payments, rating rules, service configuration, job
// restore, voice-call signalling and cross-app restrictions.
//
// Usage: node scripts/verify-apps-live.mjs [base-url] [path-to-socket.io-client]
import { createRequire } from 'module';
import { randomUUID } from 'crypto';

const BASE = (process.argv[2] || 'https://quickmechanic-api.onrender.com').replace(/\/$/, '');
const SIO = process.argv[3];
const MECH_AT = { lat: 9.9312, lng: 76.2673 }, CUST_AT = { lat: 9.9500, lng: 76.2900 };
const results = [];
async function step(name, fn) {
  try { const note = await fn(); results.push(true); console.log(`PASS  ${name}${note ? '  - ' + note : ''}`); }
  catch (e) { results.push(false); console.log(`FAIL  ${name}  - ${e.message}`); }
}
async function call(method, path, token, body, { expect, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  if (expect !== undefined) { if (res.status !== expect) throw new Error(`${method} ${path} -> HTTP ${res.status} (${String(data?.message ?? '').slice(0, 90)}), expected ${expect}`); return data; }
  if (res.status >= 400) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${String(data?.message ?? data).slice(0, 160)}`);
  if (data && data.success === false) throw new Error(`${method} ${path} -> ${data.message}`);
  return data;
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const sub = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub;
const status = async (jobId, token) => (await call('GET', `/dispatch/job/${jobId}`, token)).status ?? (await call('GET', `/dispatch/job/${jobId}`, token)).job?.status;

let C, P, customerId, providerId, service, vehicle;
await step('Test logins (Customer, Mechanic)', async () => {
  C = (await call('POST', '/auth/login', null, { identifier: 'Customer', password: 'Customer2026', accountType: 'CUSTOMER' })).accessToken;
  P = (await call('POST', '/auth/login', null, { identifier: 'Provider', password: 'Provider2026', accountType: 'PROVIDER' })).accessToken;
  customerId = sub(C); providerId = sub(P);
  service = (await call('GET', '/services')).find(s => s.isActive);
  vehicle = (await call('GET', '/vehicle-categories')).find(v => v.isActive && !v.isPremiumTier);
});

// ================= CUSTOMER ACCOUNT =================
const tag = randomUUID().slice(0, 6), digits = String(Date.now()).slice(-8);
const newCust = { name: 'Signup Test ' + tag, email: `cust.${tag}@test.quickmechanic.in`, password: 'Signup2026!', phoneNumber: '+9197' + digits };
await step('[Customer] New account sign-up', async () => { await call('POST', '/auth/register/customer', null, newCust); return newCust.email; });
await step('[Customer] New account signs in by email and by mobile', async () => {
  await call('POST', '/auth/login', null, { identifier: newCust.email, password: newCust.password, accountType: 'CUSTOMER' });
  await call('POST', '/auth/login', null, { identifier: newCust.phoneNumber.slice(-10), password: newCust.password, accountType: 'CUSTOMER' });
});
await step('[Customer] Duplicate sign-up refused', async () => { await call('POST', '/auth/register/customer', null, newCust, { expect: 409 }); });
await step('[Customer] Customer login refused in Mechanic app', async () => {
  await call('POST', '/auth/login', null, { identifier: newCust.email, password: newCust.password, accountType: 'PROVIDER' }, { expect: 401 });
});
await step('[Customer] Google endpoint verifies tokens', async () => {
  const r = await call('POST', '/auth/google', null, { idToken: 'not-a-real-token', accountType: 'CUSTOMER', intent: 'signup' }, { expect: 401 });
  ok(r.code === 'GOOGLE_TOKEN_INVALID', 'got ' + r.code); return 'configured; fake token refused';
});
await step('[Customer] Profile has a phone number', async () => { const me = await call('GET', '/users/me', C); ok(me.phoneNumber, 'no phone'); });

// ================= MECHANIC ACCOUNT =================
let newMechToken;
await step('[Mechanic] New mechanic sign-up', async () => {
  const m = { name: 'Mech Signup ' + tag, email: `mech.${tag}@test.quickmechanic.in`, password: 'Signup2026!', phoneNumber: '+9196' + digits, type: 'Mechanic' };
  await call('POST', '/auth/register/mechanic', null, m);
  newMechToken = (await call('POST', '/auth/login', null, { identifier: m.email, password: m.password, accountType: 'PROVIDER' })).accessToken;
});
await step('[Mechanic] Cannot go online before KYC approval', async () => {
  await call('PATCH', `/users/mechanics/${sub(newMechToken)}/status`, newMechToken, { isOnline: true, ...MECH_AT }, { expect: 403 });
});
await step('[Mechanic] Save service configuration', async () => {
  const services = (await call('GET', '/services')).filter(s => s.isActive);
  const vehicles = (await call('GET', '/vehicle-categories')).filter(v => v.isActive && !v.isPremiumTier);
  await call('PATCH', `/users/mechanics/${providerId}/config`, P, {
    services: services.map(s => s.id), vehicles: vehicles.map(v => v.id),
    pricing: services.flatMap(s => vehicles.map(v => ({ serviceId: s.id, vehicleId: v.id, price: 300 }))),
  });
  const cfg = await call('GET', `/users/mechanics/${providerId}/config`, P);
  ok(cfg.services?.length === services.length, `saved ${cfg.services?.length} of ${services.length} services`);
  return `${services.length} services x ${vehicles.length} vehicles at Rs 300`;
});
await step('[Mechanic] Pricing, daily stats, request list', async () => {
  await call('GET', '/dispatch/pricing', P); await call('GET', `/users/mechanics/${providerId}/stats/daily`, P);
  await call('GET', `/users/mechanics/${providerId}/requests`, P);
});

// ================= JOB HELPERS =================
async function clearJobs() {
  const pj = (await call('GET', '/dispatch/active-job', P)).job;
  if (pj) await call('POST', `/dispatch/job/${pj.id}/cancel`, P, { reason: 'test cleanup' }).catch(() => {});
  const cj = (await call('GET', '/dispatch/customer-active-job', C)).job;
  if (cj) await call('POST', `/dispatch/job/${cj.id}/cancel`, C, { reason: 'test cleanup' }).catch(() => {});
}
async function newPaidJob({ start = false } = {}) {
  await call('PATCH', `/users/mechanics/${providerId}/status`, P, { isOnline: true, ...MECH_AT });
  const { jobId } = await call('POST', '/dispatch/request', C, { serviceType: service.name, ...CUST_AT, mechanicId: providerId, vehicleCategoryId: vehicle.id });
  await call('POST', `/dispatch/job/${jobId}/accept`, P);
  await call('POST', `/dispatch/job/${jobId}/prepare-quote`, P);
  await call('POST', `/dispatch/job/${jobId}/send-quote`, P);
  await call('POST', `/dispatch/job/${jobId}/confirm-payment`, C, { simulationResult: 'success' });
  if (start) await call('POST', `/dispatch/job/${jobId}/start`, P);
  return jobId;
}
await step('Clear leftover jobs', clearJobs);

// ================= FLOW 1: failed payment, then customer cancels =================
let job1;
await step('[Both] Request reaches mechanic request list', async () => {
  await call('PATCH', `/users/mechanics/${providerId}/status`, P, { isOnline: true, ...MECH_AT });
  const near = await call('POST', '/dispatch/nearby', C, { serviceType: service.name, ...CUST_AT, vehicleCategoryId: vehicle.id });
  ok(near.data.some(m => m.user.id === providerId), 'test mechanic not found nearby');
  job1 = (await call('POST', '/dispatch/request', C, { serviceType: service.name, ...CUST_AT, mechanicId: providerId, vehicleCategoryId: vehicle.id })).jobId;
  const reqs = await call('GET', `/users/mechanics/${providerId}/requests`, P);
  ok(JSON.stringify(reqs).includes(job1), 'job not in mechanic request list');
});
await step('[Customer] Reopening the app restores the active job', async () => { const j = (await call('GET', '/dispatch/customer-active-job', C)).job; ok(j?.id === job1, 'active job not restored'); });
await step('[Mechanic] Accept, then reopening the app restores it', async () => {
  await call('POST', `/dispatch/job/${job1}/accept`, P);
  ok((await call('GET', '/dispatch/active-job', P)).job?.id === job1, 'mechanic active job not restored');
});
await step('[Mechanic] Auto quote sent', async () => { await call('POST', `/dispatch/job/${job1}/prepare-quote`, P); await call('POST', `/dispatch/job/${job1}/send-quote`, P); });
await step('[Customer] Failed payment keeps job unpaid', async () => {
  await call('POST', `/dispatch/job/${job1}/confirm-payment`, C, { simulationResult: 'failed' }).then(() => { throw new Error('failed payment was accepted'); }, e => { if (!/failed|cancelled/i.test(e.message)) throw e; });
  const s = await status(job1, C); ok(s === 'AWAITING_PAYMENT', 'status ' + s); return 'still AWAITING_PAYMENT';
});
await step('[Customer] Pays, then cancels -> refunded', async () => {
  await call('POST', `/dispatch/job/${job1}/confirm-payment`, C, { simulationResult: 'success' });
  await call('POST', `/dispatch/job/${job1}/cancel`, C, { reason: 'Changed my mind (test)' });
  ok((await status(job1, C)) === 'CANCELLED', 'not cancelled');
  const tx = JSON.stringify(await call('GET', '/dispatch/transactions', C));
  ok(tx.includes(job1), 'no customer transaction for the job'); return 'refund recorded in customer wallet history';
});

// ================= FLOW 2: mechanic cancels en route =================
let job2;
await step('[Mechanic] Cancels a paid job on the way -> customer refunded', async () => {
  job2 = await newPaidJob({ start: true });
  await call('POST', `/dispatch/job/${job2}/cancel`, P, { reason: 'Vehicle breakdown (test)' });
  ok((await status(job2, C)) === 'CANCELLED', 'not cancelled');
  ok(JSON.stringify(await call('GET', '/dispatch/transactions', C)).includes(job2), 'no refund entry');
});

// ================= FLOW 3: full job with voice call =================
let job3;
await step('[Both] Paid job, mechanic on the way', async () => { job3 = await newPaidJob({ start: true }); });
await step('[Both] Voice call: offer, answer, ICE, hang up', async () => {
  ok(SIO, 'socket.io-client path not given - skipped');
  const { io } = createRequire(import.meta.url)(SIO);
  const opts = { transports: ['websocket'], reconnection: false, timeout: 20000 };
  const cs = io(BASE, { ...opts, auth: { token: C } }), ps = io(BASE, { ...opts, auth: { token: P } });
  const wait = (s, ev, ms = 15000) => new Promise((res, rej) => { s.once(ev, res); setTimeout(() => rej(new Error(`no ${ev} within ${ms / 1000}s`)), ms); });
  try {
    await Promise.all([cs, ps].map(s => new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', e => rej(new Error('connect: ' + e.message))); })));
    await new Promise(r => setTimeout(r, 800));
    const callId = 'test_' + randomUUID().slice(0, 8);
    const incoming = wait(ps, 'incoming_call');
    cs.emit('call_offer', { callId, targetId: providerId, callerName: 'Test Customer', offer: { type: 'offer', sdp: 'v=0 test-offer' } });
    const inc = await incoming; ok(inc.offer?.sdp === 'v=0 test-offer', 'offer not relayed');
    const answered = wait(cs, 'call_answered');
    ps.emit('call_answer', { callId, targetId: customerId, answer: { type: 'answer', sdp: 'v=0 test-answer' } });
    ok((await answered).answer?.sdp === 'v=0 test-answer', 'answer not relayed');
    const ice = wait(ps, 'new_ice_candidate');
    cs.emit('ice_candidate', { callId, targetId: providerId, candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } });
    await ice;
    const ended = wait(ps, 'call_ended');
    cs.emit('end_call', { callId, targetId: providerId });
    await ended;
    return 'mechanic rang, answered, exchanged ICE, hung up';
  } finally { cs.close(); ps.close(); }
});
await step('[Both] Complete, confirm, rate', async () => {
  await call('POST', `/dispatch/job/${job3}/complete`, P, {});
  await call('POST', `/dispatch/job/${job3}/confirm-completion`, C);
  await call('POST', `/dispatch/job/${job3}/rate`, C, { rating: 4 });
});
await step('[Customer] Rating twice refused', async () => {
  await call('POST', `/dispatch/job/${job3}/rate`, C, { rating: 5 }).then(() => { throw new Error('second rating accepted'); }, e => { if (!/already/i.test(e.message)) throw e; });
});
await step('[Customer] Out-of-range rating refused', async () => { await call('POST', `/dispatch/job/${job3}/rate`, C, { rating: 9 }, { expect: 400 }); });
await step('[Both] History and wallet', async () => {
  for (const t of [C, P]) { await call('GET', '/dispatch/history', t); await call('GET', '/dispatch/transactions', t); }
});
await step('[Mechanic] Withdrawal', async () => { const w = await call('POST', '/dispatch/mechanic/withdraw', P, {}, { headers: { 'Idempotency-Key': randomUUID() } }); return w.message; });

// ================= SUPPORT & CALL SETUP =================
await step('[Both] Support tickets with conversation', async () => {
  for (const [who, t] of [['customer', C], ['mechanic', P]]) {
    const tk = await call('POST', '/support/tickets', t, { subject: `${who} app check`, message: 'Automated app verification.', category: 'APP' });
    const id = tk.id ?? tk.ticket?.id;
    await call('POST', `/support/tickets/${id}/messages`, t, { message: 'Follow-up from the app.' });
    ok(JSON.stringify(await call('GET', `/support/tickets/${id}`, t)).includes('Follow-up'), `${who} reply missing`);
    ok(JSON.stringify(await call('GET', '/support/tickets', t)).includes(id), `${who} list missing ticket`);
  }
});
await step('[Both] Call servers (ICE) for both apps', async () => { await call('GET', '/calls/ice-servers', C); await call('GET', '/calls/ice-servers', P); });

// ================= CROSS-APP RESTRICTIONS =================
await step('[Customer] Blocked from mechanic actions', async () => {
  await call('GET', '/dispatch/pricing', C, undefined, { expect: 403 });
  await call('PATCH', `/users/mechanics/${providerId}/status`, C, { isOnline: false }, { expect: 403 });
  await call('GET', '/dispatch/active-job', C, undefined, { expect: 403 });
});
await step('[Mechanic] Blocked from customer actions', async () => {
  await call('POST', '/dispatch/nearby', P, { serviceType: service.name, ...CUST_AT }, { expect: 403 });
  await call('POST', '/dispatch/request', P, { serviceType: service.name, ...CUST_AT, mechanicId: providerId }, { expect: 403 });
  await call('GET', '/dispatch/customer-active-job', P, undefined, { expect: 403 });
});
await step('[Mechanic] Cannot change another mechanic', async () => {
  await call('PATCH', `/users/mechanics/${sub(newMechToken)}/config`, P, { services: [] }, { expect: 403 });
});
await step('Mechanic goes offline', async () => { await call('PATCH', `/users/mechanics/${providerId}/status`, P, { isOnline: false }); });

const passed = results.filter(Boolean).length;
console.log(`\n--- ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
