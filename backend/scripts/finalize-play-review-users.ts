import { randomBytes, randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

async function main() {
  const file = resolve(__dirname, '../../play-store-assets/reviewer-credentials.local.json');
  const credentials = JSON.parse(await readFile(file, 'utf8'));
  if (!credentials?.provider?.email) throw new Error('Provider reviewer credentials are missing.');
  if (!credentials.admin) credentials.admin = {
    email: `play-review-admin-${Date.now().toString(36)}@example.com`,
    password: `Qm!${randomBytes(18).toString('base64url')}9a`,
  };
  const db = new Client({
    host: process.env.QM_REVIEW_DB_HOST,
    port: Number(process.env.QM_REVIEW_DB_PORT || 5432),
    user: process.env.QM_REVIEW_DB_USER,
    password: process.env.QM_REVIEW_DB_PASSWORD,
    database: process.env.QM_REVIEW_DB_NAME,
    ssl: {rejectUnauthorized: false},
  });
  await db.connect();
  try {
    const resolveTable = async (name: string, required = true) => {
      const result = await db.query(
        `SELECT table_schema, table_name FROM information_schema.tables
         WHERE lower(table_name) = lower($1)
         ORDER BY CASE WHEN table_schema = current_schema() THEN 0 ELSE 1 END
         LIMIT 1`,
        [name],
      );
      if (result.rowCount !== 1) {
        if (!required) return null;
        throw new Error(`Database table ${name} was not found.`);
      }
      const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
      return `${quote(result.rows[0].table_schema)}.${quote(result.rows[0].table_name)}`;
    };
    const providerTable = await resolveTable('PROVIDER_USER', false);
    const adminTable = await resolveTable('ADM_USER', false);
    const usersTable = providerTable ? null : await resolveTable('users');
    const profileTable = await resolveTable('mechanic_profiles');
    await db.query('BEGIN');
    if (usersTable) {
      const providerHash = await bcrypt.hash(credentials.provider.password, 12);
      const customerHash = await bcrypt.hash(credentials.customer.password, 12);
      await db.query(`INSERT INTO ${usersTable} (id, email, "passwordHash", role, "phoneNumber", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'MECHANIC', $4, now(), now())
        ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = 'MECHANIC', "updatedAt" = now()`,
        [randomUUID(), credentials.provider.email, providerHash, `play-provider-${Date.now()}`]);
      await db.query(`INSERT INTO ${usersTable} (id, email, "passwordHash", role, "phoneNumber", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'CUSTOMER', $4, now(), now())
        ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = 'CUSTOMER', "updatedAt" = now()`,
        [randomUUID(), credentials.customer.email, customerHash, `play-customer-${Date.now()}`]);
    }
    const provider = await db.query(`SELECT id FROM ${providerTable || usersTable} WHERE email = $1`, [credentials.provider.email]);
    if (provider.rowCount !== 1) throw new Error('Provider reviewer was not found.');
    if (usersTable) {
      await db.query(`INSERT INTO ${profileTable} (id, "kycStatus", "serviceTier", "isOnline", "userId")
        SELECT $1, 'APPROVED', 'TWO_WHEELER', false, $2
        WHERE NOT EXISTS (SELECT 1 FROM ${profileTable} WHERE "userId" = $2)`,
        [randomUUID(), provider.rows[0].id]);
    }
    if (usersTable) {
      await db.query(`UPDATE ${profileTable} SET "kycStatus" = $1 WHERE "userId" = $2`, ['APPROVED', provider.rows[0].id]);
    } else {
      await db.query(`UPDATE ${profileTable} SET "kycStatus" = $1, "kycDocumentsVerified" = true WHERE "userId" = $2`, ['APPROVED', provider.rows[0].id]);
    }
    const passwordHash = await bcrypt.hash(credentials.admin.password, 12);
    if (adminTable) {
      await db.query(`INSERT INTO ${adminTable} (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'MANAGER', now(), now())
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, "passwordHash" = EXCLUDED."passwordHash", role = 'MANAGER', "updatedAt" = now()`,
        [randomUUID(), 'Google Play Reviewer', credentials.admin.email, passwordHash]);
    } else {
      await db.query(`INSERT INTO ${usersTable} (id, email, "passwordHash", role, "phoneNumber", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, now(), now())
        ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = EXCLUDED.role, "updatedAt" = now()`,
        [randomUUID(), credentials.admin.email, passwordHash, 'SUPER_ADMIN', `play-admin-${Date.now()}`]);
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
  credentials.admin.created = true;
  await writeFile(file, JSON.stringify(credentials, null, 2), {encoding: 'utf8', mode: 0o600});
  console.log('Approved the Provider reviewer and created the Admin reviewer.');
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
