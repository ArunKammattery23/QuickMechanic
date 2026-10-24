// Creates (or refreshes) the three shared tester accounts and applies the
// username migration first. Idempotent: re-running resets their passwords.
//
// Usage (from backend/):
//   npx ts-node -T scripts/create-test-accounts.ts .env.development   # local Docker
//   npx ts-node -T scripts/create-test-accounts.ts .env.production    # Aiven
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';

const BACKEND_DIR = path.resolve(__dirname, '..');
const envFile = process.argv[2] || '.env.development';
const env = require('dotenv').parse(fs.readFileSync(path.join(BACKEND_DIR, envFile))) as Record<string, string>;

function client() {
  let ssl: any = false;
  if (env.DB_SSL === 'true') {
    const ca = env.DB_CA_CERT
      || fs.readFileSync(path.isAbsolute(env.DB_CA_PATH) ? env.DB_CA_PATH : path.join(BACKEND_DIR, env.DB_CA_PATH), 'utf8');
    ssl = { rejectUnauthorized: true, ca };
  }
  return new Client({
    host: env.DB_HOST, port: Number(env.DB_PORT) || 5432, user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME, ssl,
  });
}

// Shared tester accounts. Phone numbers are reserved test numbers.
const accounts = {
  customer: { username: 'Customer', password: 'Customer2026', name: 'Test Customer', email: 'customer.test@quickmechanic.in', phone: '+919000090001' },
  provider: { username: 'Provider', password: 'Provider2026', name: 'Test Mechanic', email: 'provider.test@quickmechanic.in', phone: '+919000090002' },
  admin:    { username: 'Admin',    password: 'Admin2026',    name: 'Test Admin',    email: 'admin.test@quickmechanic.in',    phone: '+919000090003' },
};
const DEFAULT_PRICE = 300; // INR quotation per service+vehicle for the test mechanic

async function upsertUser(c: Client, table: string, a: typeof accounts.customer, role: string) {
  const hash = await bcrypt.hash(a.password, 10);
  // Match on username, email or phone so a re-run updates instead of colliding.
  const found = await c.query(
    `SELECT id FROM "${table}" WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) OR "phoneNumber" = $3`,
    [a.username, a.email, a.phone]);
  if (found.rows.length > 1) throw new Error(`${table}: several rows match ${a.username}; clean them up first`);
  if (found.rows[0]) {
    await c.query(
      `UPDATE "${table}" SET username = $1, email = $2, "phoneNumber" = $3, name = $4, "passwordHash" = $5, role = $6 WHERE id = $7`,
      [a.username, a.email, a.phone, a.name, hash, role, found.rows[0].id]);
    return found.rows[0].id as string;
  }
  const inserted = await c.query(
    `INSERT INTO "${table}" (username, email, "phoneNumber", name, "passwordHash", role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [a.username, a.email, a.phone, a.name, hash, role]);
  return inserted.rows[0].id as string;
}

async function run() {
  const c = client();
  await c.connect();
  console.log(`-> ${env.DB_HOST}/${env.DB_NAME} (${envFile})`);

  await c.query(fs.readFileSync(path.join(BACKEND_DIR, 'migrations', '20261025_login_username.sql'), 'utf8'));
  console.log('OK username column + unique indexes');

  await upsertUser(c, 'CUST_USER', accounts.customer, 'CUSTOMER');
  console.log('OK customer  -> Customer / Customer2026');

  const providerId = await upsertUser(c, 'PROVIDER_USER', accounts.provider, 'MECHANIC');
  // Approved, verified mechanic so the tester can go online and receive jobs.
  let profile = await c.query(`SELECT id FROM mechanic_profiles WHERE "userId" = $1`, [providerId]);
  if (!profile.rows[0]) {
    profile = await c.query(
      `INSERT INTO mechanic_profiles ("userId", "kycStatus", "kycDocumentsVerified", "isOnline") VALUES ($1, 'APPROVED', true, false) RETURNING id`,
      [providerId]);
  } else {
    await c.query(`UPDATE mechanic_profiles SET "kycStatus" = 'APPROVED', "kycDocumentsVerified" = true WHERE id = $1`, [profile.rows[0].id]);
  }
  const profileId = profile.rows[0].id as string;
  // Offer every active service on every active non-premium vehicle, with a price.
  const services = (await c.query(`SELECT id FROM service_types WHERE "isActive" = true`)).rows;
  const vehicles = (await c.query(`SELECT id FROM vehicle_categories WHERE "isActive" = true AND "isPremiumTier" = false`)).rows;
  for (const s of services) {
    await c.query(`INSERT INTO mechanic_services (mechanic_profile_id, service_type_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [profileId, s.id]);
  }
  for (const v of vehicles) {
    await c.query(`INSERT INTO mechanic_vehicles (mechanic_profile_id, vehicle_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [profileId, v.id]);
  }
  for (const s of services) for (const v of vehicles) {
    await c.query(
      `INSERT INTO mechanic_pricing (mechanic_profile_id, service_type_id, vehicle_category_id, price)
       VALUES ($1, $2, $3, $4) ON CONFLICT (mechanic_profile_id, service_type_id, vehicle_category_id) DO NOTHING`,
      [profileId, s.id, v.id, DEFAULT_PRICE]);
  }
  console.log(`OK provider  -> Provider / Provider2026 (KYC approved, ${services.length} services x ${vehicles.length} vehicles)`);

  await upsertUser(c, 'ADM_USER', accounts.admin, 'SUPER_ADMIN');
  console.log('OK admin     -> Admin / Admin2026 (SUPER_ADMIN)');

  await c.end();
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
