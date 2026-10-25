// End-to-end check of everything the Admin app calls, against a deployed API.
// Covers sign-in, session length, profile, password change (restored),
// dashboard, support workflow, a full KYC review with a freshly registered
// mechanic, finance (re-saving the current values) and role restrictions.
//
// Usage: node scripts/verify-admin-live.mjs [base-url]
import { randomUUID, randomBytes } from 'crypto';
import { deflateSync } from 'zlib';

const BASE = (process.argv[2] || 'https://quickmechanic-api.onrender.com').replace(/\/$/, '');
const ADMIN = { identifier: 'Admin', password: 'Admin2026' };
const results = [];
async function step(name, fn) {
  try { const note = await fn(); results.push(true); console.log(`PASS  ${name}${note ? '  - ' + note : ''}`); }
  catch (e) { results.push(false); console.log(`FAIL  ${name}  - ${e.message}`); }
}
async function call(method, path, token, body, { expect, raw } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (expect !== undefined) { if (res.status !== expect) throw new Error(`${method} ${path} -> HTTP ${res.status}, expected ${expect}`); return res; }
  if (raw) { if (res.status >= 400) throw new Error(`${method} ${path} -> HTTP ${res.status}`); return res; }
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  if (res.status >= 400) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${String(data?.message ?? data).slice(0, 160)}`);
  return data;
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const claims = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
const list = d => Array.isArray(d) ? d : (d.items ?? d.data ?? d.tickets ?? d.providers ?? []);

// Valid 64x64 noise PNG generated in memory for the KYC uploads; noise keeps
// it above the server's 1 KB minimum after compression.
function png() {
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4); len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const size = 64;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 0;
  const rows = Buffer.concat(Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), randomBytes(size)])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

let A, C, P;
// ---- Sign-in -------------------------------------------------------------
await step('Admin sign-in by username', async () => { A = (await call('POST', '/auth/admin-login', null, ADMIN)).accessToken; ok(A, 'no token'); });
await step('Admin sign-in by email and by mobile', async () => {
  await call('POST', '/auth/admin-login', null, { identifier: 'admin.test@quickmechanic.in', password: ADMIN.password });
  await call('POST', '/auth/admin-login', null, { identifier: '9000090003', password: ADMIN.password });
});
await step('Wrong admin password rejected', async () => { await call('POST', '/auth/admin-login', null, { identifier: 'Admin', password: 'wrong-password' }, { expect: 401 }); });
await step('Customer/mechanic logins cannot enter Admin', async () => {
  await call('POST', '/auth/admin-login', null, { identifier: 'Customer', password: 'Customer2026' }, { expect: 401 });
  await call('POST', '/auth/admin-login', null, { identifier: 'Provider', password: 'Provider2026' }, { expect: 401 });
});
await step('Session lasts 30 days', async () => { const c = claims(A); const days = Math.round((c.exp - c.iat) / 86400); ok(days === 30, `session lasts ${days} days`); return `${days} days, role ${c.role}`; });

// ---- Profile & password --------------------------------------------------
let me;
await step('Profile loads', async () => { me = await call('GET', '/auth/admin/me', A); return `${me.name} (${me.role})`; });
await step('Profile save', async () => { const r = await call('PATCH', '/auth/admin/me', A, { name: me.name, phoneNumber: me.phoneNumber ?? '' }); ok(r.name === me.name, 'name changed unexpectedly'); });
await step('Password change works, then restored', async () => {
  const temp = 'Tmp-' + randomUUID().slice(0, 8);
  await call('PATCH', '/auth/admin/me/password', A, { currentPassword: ADMIN.password, newPassword: temp });
  try {
    await call('POST', '/auth/admin-login', null, ADMIN, { expect: 401 });
    const T = (await call('POST', '/auth/admin-login', null, { identifier: 'Admin', password: temp })).accessToken;
    await call('PATCH', '/auth/admin/me/password', T, { currentPassword: temp, newPassword: ADMIN.password });
  } catch (e) {
    // Never leave the shared tester account on the temporary password.
    const T = (await call('POST', '/auth/admin-login', null, { identifier: 'Admin', password: temp })).accessToken;
    await call('PATCH', '/auth/admin/me/password', T, { currentPassword: temp, newPassword: ADMIN.password });
    throw e;
  }
  A = (await call('POST', '/auth/admin-login', null, ADMIN)).accessToken;
  return 'old password refused while changed; Admin2026 restored';
});

// ---- Dashboard -----------------------------------------------------------
await step('Dashboard data (tickets, KYC queue, collections)', async () => {
  const [t, k, c] = await Promise.all([call('GET', '/support/admin/tickets', A), call('GET', '/users/mechanics/pending', A), call('GET', '/admin/finance/collections', A)]);
  return `${list(t).length} tickets, ${list(k).length} pending KYC, ${list(c).length} providers`;
});

// ---- Support ---------------------------------------------------------------
let ticketId;
await step('Customer raises a ticket', async () => {
  C = (await call('POST', '/auth/login', null, { identifier: 'Customer', password: 'Customer2026', accountType: 'CUSTOMER' })).accessToken;
  const t = await call('POST', '/support/tickets', C, { subject: 'Admin app check', message: 'Automated admin verification ticket.', category: 'APP' });
  ticketId = t.id ?? t.ticket?.id; ok(ticketId, 'no ticket id');
});
await step('Ticket appears in OPEN filter', async () => { const l = list(await call('GET', '/support/admin/tickets?status=OPEN', A)); ok(l.some(t => t.id === ticketId), 'ticket not in OPEN list'); });
await step('Admin opens ticket and replies', async () => {
  await call('GET', `/support/tickets/${ticketId}`, A);
  await call('POST', `/support/tickets/${ticketId}/messages`, A, { message: 'Thanks, we are looking into it.' });
});
await step('Customer sees admin reply', async () => { const d = await call('GET', `/support/tickets/${ticketId}`, C); ok(JSON.stringify(d).includes('looking into it'), 'reply not visible to customer'); });
await step('Status: IN_PROGRESS -> RESOLVED', async () => {
  await call('PATCH', `/support/admin/tickets/${ticketId}/status`, A, { status: 'IN_PROGRESS' });
  await call('PATCH', `/support/admin/tickets/${ticketId}/status`, A, { status: 'RESOLVED' });
});

// ---- KYC review ------------------------------------------------------------
let newMech, newMechId;
await step('New mechanic registers', async () => {
  const tag = randomUUID().slice(0, 6), digits = String(Date.now()).slice(-8);
  newMech = { name: 'KYC Test ' + tag, email: `kyc.${tag}@test.quickmechanic.in`, password: 'KycTest2026', phoneNumber: '+9198' + digits, type: 'Mechanic' };
  await call('POST', '/auth/register/mechanic', null, newMech);
  P = (await call('POST', '/auth/login', null, { identifier: newMech.email, password: newMech.password, accountType: 'PROVIDER' })).accessToken;
  newMechId = claims(P).sub;
  return newMech.name;
});
await step('Mechanic uploads ID photos (front + back)', async () => {
  const f = new FormData();
  f.append('idType', 'DRIVING_LICENCE'); f.append('address', '12 Test Street, Kochi, Kerala 682001'); f.append('secondaryPhone', '+919876500000');
  f.append('front', new Blob([png()], { type: 'image/png' }), 'front.png');
  f.append('back', new Blob([png()], { type: 'image/png' }), 'back.png');
  await call('POST', '/users/me/kyc', P, f);
});
let pending;
await step('Mechanic appears in Admin KYC queue', async () => {
  pending = list(await call('GET', '/users/mechanics/pending', A)).find(p => p.id === newMechId || p.user?.id === newMechId);
  ok(pending, 'not in pending list');
});
await step('Admin views both ID photos', async () => {
  for (const side of ['front', 'back']) {
    const r = await call('GET', `/users/mechanics/${pending.id}/kyc/document/${side}`, A, undefined, { raw: true });
    ok((r.headers.get('content-type') || '').startsWith('image/'), `${side} is ${r.headers.get('content-type')}`);
  }
});
await step('Admin approves KYC', async () => { await call('PATCH', `/users/mechanics/${pending.id}/kyc`, A, { status: 'APPROVED', submittedAt: pending.submittedAt }); });
await step('Mechanic now shows APPROVED', async () => { const k = await call('GET', '/users/me/kyc', P); ok(JSON.stringify(k).includes('APPROVED'), JSON.stringify(k).slice(0, 80)); });
await step('Approved mechanic leaves the queue', async () => { ok(!list(await call('GET', '/users/mechanics/pending', A)).some(p => p.id === pending.id), 'still pending'); });

// ---- Finance ---------------------------------------------------------------
let settings;
await step('Finance settings load', async () => { settings = await call('GET', '/admin/finance/settings', A); return `rev ${settings.policy.revision}, ${settings.policy.commissionBps / 100}% commission, ${settings.paymentMode}`; });
await step('Finance settings save (same values)', async () => {
  const p = settings.policy, rupees = m => (Number(m) / 100).toFixed(2);
  const r = await call('POST', '/admin/finance/settings', A, {
    commissionPercent: (p.commissionBps / 100).toFixed(2), platformFee: rupees(p.platformFeeMinor), expectedRevision: p.revision,
    travelMinimum: rupees(p.travelMinimumMinor), travelIncludedKm: (p.travelIncludedMeters / 1000).toString(), travelPerKm: rupees(p.travelPerKmMinor),
  });
  return `saved as revision ${r.revision}`;
});
await step('Stale finance save is refused', async () => {
  const p = settings.policy;
  await call('POST', '/admin/finance/settings', A, { commissionPercent: '15.00', platformFee: '2.00', expectedRevision: p.revision }, { expect: 400 }).catch(async e => {
    if (/409/.test(e.message)) return; throw e;
  });
});
await step('Collections and per-mechanic jobs', async () => {
  const providers = list(await call('GET', '/admin/finance/collections', A)); ok(providers.length, 'no providers');
  await call('GET', `/admin/finance/jobs?providerId=${providers[0].id}`, A);
  return `${providers.length} providers`;
});

// ---- Role restrictions -----------------------------------------------------
await step('Mechanic cannot use admin endpoints', async () => {
  await call('GET', '/admin/finance/settings', P, undefined, { expect: 403 });
  await call('GET', '/users/mechanics/pending', P, undefined, { expect: 403 });
  await call('GET', '/support/admin/tickets', P, undefined, { expect: 403 });
});
await step('No token is refused', async () => { await call('GET', '/auth/admin/me', null, undefined, { expect: 401 }); });

const passed = results.filter(Boolean).length;
console.log(`\n--- ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
