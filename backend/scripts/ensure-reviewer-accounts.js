const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..', '..');
const credentials = JSON.parse(fs.readFileSync(path.join(root, 'play-store-assets', 'reviewer-credentials.local.json'), 'utf8'));
const api = credentials.api.replace(/\/$/, '');

async function request(route, body) {
  const response = await fetch(api + route, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let data = {};
  try { data = await response.json(); } catch {}
  return {status: response.status, data};
}

function validLogin(result, role) {
  const token = result.data.accessToken || result.data.access_token;
  return result.status < 300 && typeof token === 'string' && token.split('.').length === 3 && result.data.role === role;
}

async function ensurePublicAccount(kind, registerRoute, expectedRole) {
  const account = credentials[kind];
  let login = await request('/auth/login', {email:account.email,password:account.password});
  if (!validLogin(login, expectedRole)) {
    const registration = await request(registerRoute, account);
    if (![200, 201, 409].includes(registration.status)) throw new Error(`${kind} registration failed (${registration.status})`);
    login = await request('/auth/login', {email:account.email,password:account.password});
  }
  if (!validLogin(login, expectedRole)) throw new Error(`${kind} reviewer login failed`);
  return expectedRole;
}

async function ensureAdmin() {
  const account = credentials.admin;
  const client = new Client({host:'127.0.0.1',port:5433,user:'postgres',password:process.env.DB_PASSWORD,database:'postgres'});
  await client.connect();
  try {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await client.query(`
      INSERT INTO "ADM_USER"(id,name,email,"passwordHash",role,"phoneNumber","resetToken","resetTokenExpiry","createdAt","updatedAt")
      VALUES(gen_random_uuid(),$1,$2,$3,'SUPER_ADMIN',$4,NULL,NULL,NOW(),NOW())
      ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,"passwordHash"=EXCLUDED."passwordHash",role='SUPER_ADMIN',"phoneNumber"=EXCLUDED."phoneNumber","updatedAt"=NOW()
    `, [account.name || 'Google Play Reviewer', account.email, passwordHash, account.phoneNumber || null]);
  } finally { await client.end(); }
  const login = await request('/auth/admin-login', {email:account.email,password:account.password});
  if (!validLogin(login, 'SUPER_ADMIN')) throw new Error('admin reviewer login failed');
  return 'SUPER_ADMIN';
}

async function ensureProviderReviewState() {
  const account = credentials.provider;
  const phone = account.phoneNumber || account.phone || '+919811112233';
  const client = new Client({host:'127.0.0.1',port:5433,user:'postgres',password:process.env.DB_PASSWORD,database:'postgres'});
  await client.connect();
  try {
    await client.query(`UPDATE "PROVIDER_USER" SET "phoneNumber"=$1,"updatedAt"=NOW() WHERE email=$2`, [phone, account.email]);
    await client.query(`
      UPDATE mechanic_profiles
      SET "kycStatus"='APPROVED', "kycDocumentsVerified"=true
      WHERE "userId"=(SELECT id FROM "PROVIDER_USER" WHERE email=$1)
    `, [account.email]);
  } finally { await client.end(); }
}

(async()=>{
  const customer = await ensurePublicAccount('customer','/auth/register/customer','CUSTOMER');
  const provider = await ensurePublicAccount('provider','/auth/register/mechanic','MECHANIC');
  await ensureProviderReviewState();
  const admin = await ensureAdmin();
  console.log(JSON.stringify({customer,provider,admin,allTokensSigned:true}));
})().catch((error)=>{console.error(error.message);process.exitCode=1});
