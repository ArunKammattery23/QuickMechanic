import { randomBytes } from 'crypto';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AdmUser, AdmUserRole } from '../libs/common/src/entities/adm-user.entity';

const api = process.env.QM_REVIEW_API_URL?.replace(/\/$/, '');
const output = resolve(__dirname, '../../play-store-assets/reviewer-credentials.local.json');
const suffix = Date.now().toString(36);
const password = () => `Qm!${randomBytes(12).toString('base64url')}8a`;

async function register(path: string, body: Record<string, string>) {
  if (!api) throw new Error('Set QM_REVIEW_API_URL to the API used by the release build.');
  const response = await fetch(`${api}${path}`, {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${data.message || response.status}`);
  return data;
}

async function createAdmin(email: string, reviewPassword: string) {
  const host = process.env.QM_REVIEW_DB_HOST;
  if (!host) return false;
  const db = new DataSource({
    type: 'postgres', host, port: Number(process.env.QM_REVIEW_DB_PORT || 5432),
    username: process.env.QM_REVIEW_DB_USER, password: process.env.QM_REVIEW_DB_PASSWORD,
    database: process.env.QM_REVIEW_DB_NAME, entities: [AdmUser], synchronize: false,
    ssl: process.env.QM_REVIEW_DB_SSL === 'true' ? {rejectUnauthorized: false} : false,
  });
  await db.initialize();
  try {
    const repo = db.getRepository(AdmUser);
    const existing = await repo.findOneBy({email});
    const passwordHash = await bcrypt.hash(reviewPassword, 12);
    if (existing) await repo.update(existing.id, {name: 'Google Play Reviewer', passwordHash, role: AdmUserRole.MANAGER});
    else await repo.save(repo.create({name: 'Google Play Reviewer', email, passwordHash, role: AdmUserRole.MANAGER}));
  } finally { await db.destroy(); }
  return true;
}

async function main() {
  const customer = {email: `play-review-customer-${suffix}@example.com`, password: password(), phoneNumber: `review-c-${suffix}`, name: 'Google Play Reviewer'};
  const provider = {email: `play-review-provider-${suffix}@example.com`, password: password(), phoneNumber: `9198${Date.now().toString().slice(-8)}`, name: 'Google Play Reviewer'};
  const admin = {email: `play-review-admin-${suffix}@example.com`, password: password()};
  await register('/auth/register/customer', customer);
  await register('/auth/register/mechanic', provider);
  const adminCreated = await createAdmin(admin.email, admin.password);
  await writeFile(output, JSON.stringify({createdAt: new Date().toISOString(), api, customer, provider, admin: adminCreated ? admin : null}, null, 2), {encoding: 'utf8', mode: 0o600});
  console.log(`Created live Customer and Provider reviewer users. Admin created: ${adminCreated}. Credentials saved to ${output}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
