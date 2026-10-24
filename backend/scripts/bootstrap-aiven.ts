// Bootstraps the empty lookup tables on Aiven and creates a super-admin.
// Idempotent — safe to re-run; each row upserts on its natural key.
//
// Usage (from backend/):
//   npx ts-node -T scripts/bootstrap-aiven.ts <adminEmail> <adminPassword> [adminName]
// Example:
//   npx ts-node -T scripts/bootstrap-aiven.ts admin@quickmechanic.in "Str0ng!Pass" "Super Admin"
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';

const BACKEND_DIR = path.resolve(__dirname, '..');

function readEnv(file: string) {
  return require('dotenv').parse(fs.readFileSync(path.join(BACKEND_DIR, file))) as Record<string, string>;
}

const env = readEnv('.env.production');

function clientFor() {
  const caPath = path.isAbsolute(env.DB_CA_PATH)
    ? env.DB_CA_PATH : path.join(BACKEND_DIR, env.DB_CA_PATH);
  return new Client({
    host: env.DB_HOST, port: Number(env.DB_PORT),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') },
  });
}

// ---------------- Default lookup data ----------------
const badges = [
  { name: 'Bronze Wrench', description: 'Completed 10 jobs',           icon: 'BronzeWrench', criteriaType: 'COMPLETED_JOBS',    criteriaValue: 10 },
  { name: 'Silver Wrench', description: 'Completed 50 jobs',           icon: 'SilverWrench', criteriaType: 'COMPLETED_JOBS',    criteriaValue: 50 },
  { name: 'Gold Wrench',   description: 'Completed 200 jobs',          icon: 'GoldWrench',   criteriaType: 'COMPLETED_JOBS',    criteriaValue: 200 },
  { name: 'Five-Star Pro', description: 'Earned 25 five-star reviews', icon: 'FiveStarPro',  criteriaType: 'FIVE_STAR_REVIEWS', criteriaValue: 25 },
  { name: 'Verified',      description: 'KYC-verified mechanic',       icon: 'Verified',     criteriaType: 'VERIFIED_KYC',      criteriaValue: 1 },
];

const reputationRules = [
  { action: 'ABANDON_JOB',       pointDeduction: -50,  description: 'Mechanic abandoned an accepted job' },
  { action: 'LATE_ARRIVAL',      pointDeduction: -10,  description: 'Arrived more than 15 min after ETA' },
  { action: 'QUOTE_TIMEOUT',     pointDeduction: -20,  description: 'Did not submit a quote within SLA' },
  { action: 'CUSTOMER_COMPLAINT',pointDeduction: -30,  description: 'Complaint upheld after review' },
  { action: 'KYC_REJECTED',      pointDeduction: -100, description: 'KYC rejected for falsified data' },
];

// Default pricing policy (minor units = paise):
// 15% commission, ₹2 platform fee, ₹50 travel minimum, 2.5 km included, ₹8/km after.
const pricingPolicy = {
  commissionBps: 1500,
  platformFeeMinor: '200',
  travelMinimumMinor: '5000',
  travelIncludedMeters: 2500,
  travelPerKmMinor: '800',
  changedBy: 'bootstrap-script',
};

async function run() {
  const [,, email, password, nameArg] = process.argv;
  if (!email || !password) {
    console.error('usage: ts-node scripts/bootstrap-aiven.ts <email> <password> [name]');
    process.exit(2);
  }
  const name = nameArg || 'Super Admin';

  const c = clientFor();
  await c.connect();
  console.log('→ connected to', env.DB_HOST);

  // ---------------- Admin user ----------------
  const passwordHash = await bcrypt.hash(password, 10);
  const adminRes = await c.query(
    `INSERT INTO "ADM_USER" (name, email, "passwordHash", role)
     VALUES ($1, $2, $3, 'SUPER_ADMIN')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, "passwordHash" = EXCLUDED."passwordHash", role = 'SUPER_ADMIN'
     RETURNING id, email, role`,
    [name, email, passwordHash],
  );
  console.log(`✓ ADM_USER -> ${adminRes.rows[0].email} (${adminRes.rows[0].role})`);

  // ---------------- Badges (no unique index on name; use insert-if-missing) ----------------
  let badgesInserted = 0;
  for (const b of badges) {
    const r = await c.query(
      // Explicit casts on $1 so Postgres doesn't deduce conflicting types
      // (varchar in the WHERE check vs text in the SELECT literal).
      `INSERT INTO "badges" (name, description, icon, "criteriaType", "criteriaValue")
       SELECT $1::varchar, $2::varchar, $3::varchar, $4::"badges_criteriatype_enum", $5::int
       WHERE NOT EXISTS (SELECT 1 FROM "badges" WHERE name = $1::varchar)`,
      [b.name, b.description, b.icon, b.criteriaType, b.criteriaValue],
    );
    badgesInserted += r.rowCount || 0;
  }
  console.log(`✓ badges -> ${badgesInserted} new, ${badges.length - badgesInserted} already present`);

  // ---------------- Reputation rules (same pattern) ----------------
  let rulesInserted = 0;
  for (const r of reputationRules) {
    const res = await c.query(
      `INSERT INTO "reputation_rules" (action, "pointDeduction", description)
       SELECT $1::varchar, $2::int, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM "reputation_rules" WHERE action = $1::varchar)`,
      [r.action, r.pointDeduction, r.description],
    );
    rulesInserted += res.rowCount || 0;
  }
  console.log(`✓ reputation_rules -> ${rulesInserted} new, ${reputationRules.length - rulesInserted} already present`);

  // ---------------- Pricing policy (only if none) ----------------
  const policyCount = Number((await c.query(`SELECT COUNT(*)::int AS n FROM "pricing_policies"`)).rows[0].n);
  if (!policyCount) {
    await c.query(
      `INSERT INTO "pricing_policies"
         ("commissionBps", "platformFeeMinor", "travelMinimumMinor", "travelIncludedMeters", "travelPerKmMinor", "changedBy")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        pricingPolicy.commissionBps, pricingPolicy.platformFeeMinor,
        pricingPolicy.travelMinimumMinor, pricingPolicy.travelIncludedMeters,
        pricingPolicy.travelPerKmMinor, pricingPolicy.changedBy,
      ],
    );
    console.log('✓ pricing_policies -> revision 1 created');
  } else {
    console.log(`• pricing_policies -> ${policyCount} already present, left untouched`);
  }

  // ---------------- Platform wallet (needed before any payment flow) ----------------
  const wallet = await c.query(
    `SELECT 1 FROM "wallet_accounts" WHERE "ownerType" = 'PLATFORM' LIMIT 1`,
  ).catch(() => ({ rows: [] as any[] }));
  if (!wallet.rows.length) {
    try {
      await c.query(
        `INSERT INTO "wallet_accounts" ("ownerType", "ownerId", "availableMinor", "escrowMinor")
         VALUES ('PLATFORM', 'PLATFORM', '0', '0')`,
      );
      console.log('✓ wallet_accounts -> PLATFORM wallet created');
    } catch (e: any) {
      console.log('• wallet_accounts -> schema differs, skipped:', e.message);
    }
  } else {
    console.log('• wallet_accounts -> PLATFORM wallet already present');
  }

  await c.end();
  console.log(`\n🎉 Bootstrap complete. Log in to the Admin app with:\n   email: ${email}\n   password: (the one you passed)`);
}

run().catch(e => { console.error('BOOTSTRAP FAILED:', e); process.exit(1); });
