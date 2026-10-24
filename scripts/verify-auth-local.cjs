// Local-only verification. Creates clearly named QA users in the Docker demo DB.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Client } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcryptjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'play-store-assets/local-verification-2026-10-07');
const api = 'http://127.0.0.1:3003';
const suffix = Date.now();
const password = () => 'LocalQA-' + randomBytes(12).toString('base64url') + '9a';
const accounts = {
  customer: {name: 'Local QA Customer', email: `local-qa-c-${suffix}@example.com`, phoneNumber: `qa-c-${suffix}`, password: password()},
  provider: {name: 'Local QA Provider', email: `local-qa-p-${suffix}@example.com`, phoneNumber: '9199' + String(suffix).slice(-8), password: password()},
  admin: {name: 'Local QA Admin', email: `local-qa-a-${suffix}@example.com`, password: password()},
};
const results = [];
async function request(route, body) {
  const r = await fetch(api + route, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)});
  return {status: r.status, data: await r.json()};
}
function record(name, passed, detail) { results.push({name, passed, detail}); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${detail}`); }
async function login(kind) {
  const r = await request(kind === 'admin' ? '/auth/admin-login' : '/auth/login', accounts[kind]);
  const expected = {customer: 'CUSTOMER', provider: 'MECHANIC', admin: 'SUPER_ADMIN'}[kind];
  record(`${kind} login`, r.status === 201 && r.data.role === expected && r.data.accessToken?.split('.').length === 3, `HTTP ${r.status}, role ${r.data.role}`);
  const bad = await request(kind === 'admin' ? '/auth/admin-login' : '/auth/login', {...accounts[kind], password: 'Wrong-password-local'});
  record(`${kind} wrong password`, bad.status === 401, `HTTP ${bad.status}`);
}
(async () => {
  fs.mkdirSync(out, {recursive: true});
  for (const [kind, route] of [['customer', '/auth/register/customer'], ['provider', '/auth/register/mechanic']]) {
    const r = await request(route, accounts[kind]);
    record(`${kind} signup`, r.status === 201, `HTTP ${r.status}`);
    const duplicate = await request(route, accounts[kind]);
    record(`${kind} duplicate signup`, duplicate.status === 409, `HTTP ${duplicate.status}`);
  }
  const db = new Client({host: '127.0.0.1', port: 5432, database: 'QuickMechanicDemo', user: 'postgres', password: process.env.QM_LOCAL_DB_PASSWORD || 'password123'});
  await db.connect();
  try {
    await db.query('INSERT INTO "ADM_USER" (id,name,email,"passwordHash",role,"createdAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,\'SUPER_ADMIN\',NOW(),NOW())', [accounts.admin.name, accounts.admin.email, await bcrypt.hash(accounts.admin.password, 12)]);
  } finally { await db.end(); }
  for (const kind of ['customer', 'provider', 'admin']) await login(kind);
  const sharedEmail = `local-qa-shared-${suffix}@example.com`;
  await request('/auth/register/customer', {...accounts.customer, email: sharedEmail, phoneNumber: `qa-shared-${suffix}`});
  const provider = {...accounts.provider, email: sharedEmail, phoneNumber: '9188' + String(suffix).slice(-8)};
  const signup = await request('/auth/register/mechanic', provider);
  const signed = await request('/auth/login', provider);
  record('same email in Customer and Provider', signup.status !== 201 || (signed.status === 201 && signed.data.role === 'MECHANIC'), `Provider signup HTTP ${signup.status}, subsequent Provider login HTTP ${signed.status}, role ${signed.data.role || 'none'}`);
  fs.writeFileSync(path.join(out, 'local-qa-credentials.local.json'), JSON.stringify({api, database: 'QuickMechanicDemo', ...accounts}, null, 2));
  fs.writeFileSync(path.join(out, 'auth-results.json'), JSON.stringify(results, null, 2));
  process.exitCode = results.some(r => !r.passed) ? 1 : 0;
})().catch(e => {console.error(e.message); process.exitCode = 1;});
