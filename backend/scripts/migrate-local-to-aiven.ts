// Copies rows from the local Docker PostgreSQL into the Aiven managed instance.
// Idempotent: each table is upserted by its natural key, so re-runs just refresh
// existing rows. Covers lookup/common tables plus admin/customer/provider users
// and mechanic profiles with their join tables and PostGIS points.
//
// Usage (from backend/): npx ts-node -T scripts/migrate-local-to-aiven.ts
//   --tables=service_types,vehicle_categories,badges,reputation_rules,pricing_policies,ADM_USER
// Omit --tables to migrate the full default set.
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const BACKEND_DIR = path.resolve(__dirname, '..');

function readEnv(file: string) {
  const envPath = path.join(BACKEND_DIR, file);
  if (!fs.existsSync(envPath)) throw new Error(`Missing env file: ${envPath}`);
  const parsed = require('dotenv').parse(fs.readFileSync(envPath));
  return parsed as Record<string, string>;
}

const localEnv = readEnv('.env.development');
const prodEnv = readEnv('.env.production');

function clientFor(env: Record<string, string>, withSsl: boolean) {
  const config: any = {
    host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME,
  };
  if (withSsl && env.DB_SSL === 'true') {
    const caPath = path.isAbsolute(env.DB_CA_PATH)
      ? env.DB_CA_PATH : path.join(BACKEND_DIR, env.DB_CA_PATH);
    config.ssl = { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
  }
  return new Client(config);
}

// Each entry describes a table to copy: how to SELECT and how to upsert.
// `select` picks the exportable columns in a stable order.
// `conflict` names the unique columns that make an upsert idempotent.
// `transform` optionally reshapes a row before insert (used for the PostGIS point).
// Tables are described by their logical name and a `conflict` key.
// Columns are discovered dynamically from information_schema so a mismatch
// between the source schema and the target schema (e.g. a column added later)
// no longer breaks the copy — we only copy columns that exist on both sides.
type Table = {
  name: string;                                // Logical table name (unquoted)
  conflict: string[];                          // Natural key for the upsert
  geometryColumns?: string[];                  // Columns needing ST_AsEWKT/ST_GeomFromEWKT handling
};

const tables: Table[] = [
  { name: 'service_types',       conflict: ['name'] },
  { name: 'vehicle_categories',  conflict: ['id'] },                  // no composite unique index exists
  { name: 'badges',              conflict: ['name'] },
  { name: 'reputation_rules',    conflict: ['action'] },
  { name: 'pricing_policies',    conflict: ['revision'] },
  { name: 'payment_environment', conflict: ['id'] },
  { name: 'ADM_USER',            conflict: ['email'] },
  { name: 'CUST_USER',           conflict: ['email'] },
  { name: 'PROVIDER_USER',       conflict: ['email'] },
  { name: 'mechanic_profiles',   conflict: ['id'], geometryColumns: ['currentLocation'] },
  { name: 'mechanic_services',   conflict: ['mechanic_profile_id', 'service_type_id'] },
  { name: 'mechanic_vehicles',   conflict: ['mechanic_profile_id', 'vehicle_category_id'] },
];

async function columnsOf(c: Client, table: string): Promise<string[]> {
  const r = await c.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return r.rows.map(x => x.column_name);
}

function quoteCol(c: string) { return `"${c}"`; }
function quoteTable(t: string) { return `"${t}"`; }

async function copyTable(src: Client, dst: Client, t: Table, requested: Set<string>) {
  if (requested.size && !requested.has(t.name)) return;

  const srcCols = new Set(await columnsOf(src, t.name));
  const dstCols = new Set(await columnsOf(dst, t.name));
  if (!srcCols.size) { console.log(`• ${t.name}: not found in source, skipped`); return; }
  if (!dstCols.size) { console.log(`• ${t.name}: not found in target, skipped`); return; }
  const shared = [...srcCols].filter(c => dstCols.has(c));
  if (!shared.length) { console.log(`• ${t.name}: no shared columns, skipped`); return; }

  // Build SELECT: wrap geometry columns in ST_AsEWKT so they come out as text.
  const geomSet = new Set(t.geometryColumns || []);
  const selectCols = shared.map(c =>
    geomSet.has(c) ? `ST_AsEWKT(${quoteCol(c)}) AS ${quoteCol(c)}` : quoteCol(c),
  ).join(', ');

  const rows = (await src.query(`SELECT ${selectCols} FROM ${quoteTable(t.name)}`)).rows;
  if (!rows.length) { console.log(`• ${t.name}: source empty, nothing to copy`); return; }

  const insertCols = shared.map(quoteCol).join(', ');
  const placeholders = shared.map((c, i) =>
    geomSet.has(c) ? `ST_GeomFromEWKT($${i + 1})` : `$${i + 1}`,
  ).join(', ');
  const updateSet = shared
    .filter(c => !t.conflict.includes(c))
    .map(c => `${quoteCol(c)} = EXCLUDED.${quoteCol(c)}`)
    .join(', ');
  const onConflict = t.conflict.length
    ? `ON CONFLICT (${t.conflict.map(quoteCol).join(', ')}) ${updateSet ? `DO UPDATE SET ${updateSet}` : 'DO NOTHING'}`
    : '';

  let copied = 0;
  for (const row of rows) {
    const values = shared.map(c => row[c]);
    await dst.query(
      `INSERT INTO ${quoteTable(t.name)} (${insertCols}) VALUES (${placeholders}) ${onConflict}`,
      values,
    );
    copied++;
  }
  console.log(`✓ ${t.name}: ${copied}/${rows.length} row${copied === 1 ? '' : 's'} copied`);
}

async function run() {
  const requested = new Set<string>();
  const flag = process.argv.find(a => a.startsWith('--tables='));
  if (flag) flag.slice('--tables='.length).split(',').forEach(s => requested.add(s.trim()));

  const src = clientFor(localEnv, false);
  const dst = clientFor(prodEnv, true);
  await src.connect();
  await dst.connect();
  console.log('→ source:', localEnv.DB_HOST, '/', localEnv.DB_NAME);
  console.log('→ target:', prodEnv.DB_HOST, '/', prodEnv.DB_NAME);

  // Session timeouts so a hung copy fails fast instead of blocking the pool.
  await dst.query("SET statement_timeout = '60s'");
  await src.query("SET statement_timeout = '60s'");

  for (const t of tables) {
    try { await copyTable(src, dst, t, requested); }
    catch (e: any) { console.error(`✗ ${t.name}: ${e.message}`); }
  }

  await src.end(); await dst.end();
  console.log('\n✅ Migration finished. Re-run anytime; existing rows are upserted.');
}

run().catch(e => { console.error('MIGRATE FAILED:', e); process.exit(1); });
