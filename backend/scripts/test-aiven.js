// One-off connectivity + PostGIS enablement check for the Aiven managed Postgres
// instance. Reads credentials from .env.production so the script can be reused
// after passwords rotate without edits.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '..', '.env.production');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const caPath = path.isAbsolute(process.env.DB_CA_PATH)
  ? process.env.DB_CA_PATH
  : path.resolve(__dirname, '..', process.env.DB_CA_PATH);

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') },
  });
  try {
    await client.connect();
    console.log('OK: connected to Aiven over TLS with pinned CA');
    console.log('server:', (await client.query('SELECT version()')).rows[0].version.split(',')[0]);
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
      console.log('OK: PostGIS ->', (await client.query('SELECT postgis_version()')).rows[0].postgis_version);
    } catch (e) {
      console.error('POSTGIS FAILED:', e.message);
    }
  } catch (e) {
    console.error('CONNECTION FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
