import { DataSource } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AdmUser } from '@app/common/entities/adm-user.entity';
import { CustUser } from '@app/common/entities/cust-user.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';

const local = process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;
jest.setTimeout(120000);

// Only a temporary schema on loopback PostgreSQL is used. Google's verifier is
// mocked at its boundary; account transactions and constraints are real.
local('Google identity localhost PostgreSQL acceptance', () => {
  const schema = `qm_google_${Date.now()}`;
  const audience = 'local-google-test.apps.googleusercontent.com';
  const savedAudience = process.env.GOOGLE_WEB_CLIENT_ID;
  let db: DataSource;
  let auth: AuthService;
  let signAsync: jest.Mock;
  let verify: jest.SpyInstance;

  beforeAll(async () => {
    process.env.GOOGLE_WEB_CLIENT_ID = audience;
    verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async ({ idToken }: any) => ({
      getPayload: () => ({ aud: audience, sub: idToken, email: 'same-email@google-local.invalid', email_verified: true, name: 'Local Google User' }),
    }) as any);
    db = new DataSource({
      type: 'postgres', host: '127.0.0.1', port: 5432, username: 'postgres',
      password: process.env.QM_LOCAL_DB_PASSWORD || 'password123', database: 'QuickMechanic', schema,
      entities: [join(__dirname, '../../../../libs/common/src/entities/*.entity.ts')], synchronize: false,
    });
    await db.initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.synchronize();
    signAsync = jest.fn(async () => 'local-google-jwt');
    auth = new AuthService(db.getRepository(AdmUser), db.getRepository(ProviderUser),
      db.getRepository(CustUser), db.getRepository(MechanicProfile), { signAsync } as any);
  });

  beforeEach(async () => {
    // All truncation is scoped to the temporary schema created in this suite.
    await db.query(`TRUNCATE TABLE "${schema}"."CUST_USER", "${schema}"."PROVIDER_USER" CASCADE`);
    signAsync.mockClear();
  });

  afterAll(async () => {
    verify?.mockRestore();
    if (db?.isInitialized) {
      if (!/^qm_google_\d+$/.test(schema)) throw new Error('Unsafe local schema');
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.destroy();
    }
    if (savedAudience === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID;
    else process.env.GOOGLE_WEB_CLIENT_ID = savedAudience;
  });

  it('applies the saved migration twice in the temporary local schema', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(`SET search_path TO "${schema}", public`);
      // Remove only these newly introduced columns in the isolated test schema
      // to verify the SQL adds them to the original password-account shape.
      await runner.query('ALTER TABLE "CUST_USER" DROP COLUMN "googleSubject"');
      await runner.query('ALTER TABLE "PROVIDER_USER" DROP COLUMN "googleSubject"');
      const migration = readFileSync(join(__dirname, '../../../../migrations/20261008_google_identity.sql'), 'utf8');
      await runner.query(migration); await runner.query(migration);
      const rows = await runner.query('SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname IN ($2, $3)',
        [schema, 'UQ_CUST_USER_googleSubject', 'UQ_PROVIDER_USER_googleSubject']);
      expect(rows).toHaveLength(2);
    } finally { await runner.query('SET search_path TO public'); await runner.release(); }
  });

  it('allows the same Google subject/email in Customer and Provider while retaining distinct roles', async () => {
    const base = { idToken: 'shared-subject', intent: 'signup', phoneNumber: '9876500091' };
    await expect(auth.googleAuthentication({ ...base, accountType: 'CUSTOMER' })).resolves.toMatchObject({ role: 'CUSTOMER' });
    await expect(auth.googleAuthentication({ ...base, accountType: 'PROVIDER', providerType: 'Towing Fleet' })).resolves.toMatchObject({ role: 'FLEET_DRIVER' });
    const provider = await db.getRepository(ProviderUser).findOneByOrFail({ googleSubject: base.idToken });
    const profile = await db.getRepository(MechanicProfile).findOneByOrFail({ user: { id: provider.id } });
    expect(profile).toMatchObject({ kycStatus: 'PENDING', kycDocumentsVerified: false, isOnline: false });
    expect(await db.getRepository(CustUser).count()).toBe(1);
    expect(await db.getRepository(ProviderUser).count()).toBe(1);
  });

  it('atomic linking lets only one of two distinct Google subjects bind the same password account', async () => {
    const customer = await db.getRepository(CustUser).save({ email: 'same-email@google-local.invalid', phoneNumber: '9876500092',
      name: 'Existing Customer', passwordHash: await bcrypt.hash('local-password', 4) });
    const request = { accountType: 'CUSTOMER', intent: 'login', linkPassword: 'local-password' };
    const attempts = await Promise.allSettled([
      auth.googleAuthentication({ ...request, idToken: 'subject-one' }),
      auth.googleAuthentication({ ...request, idToken: 'subject-two' }),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failed = attempts.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ status: 409, response: { code: 'ACCOUNT_LINK_CONFLICT' } });
    const stored = await db.getRepository(CustUser).findOneByOrFail({ id: customer.id });
    expect(['subject-one', 'subject-two']).toContain(stored.googleSubject);
    expect(stored.passwordHash).toBe(customer.passwordHash);
    expect(signAsync).toHaveBeenCalledTimes(1);
  });

  it('duplicate Provider signup race creates one user and one pending profile', async () => {
    const request = { idToken: 'same-provider-subject', accountType: 'PROVIDER', intent: 'signup', phoneNumber: '9876500093', providerType: 'Mechanic' };
    const attempts = await Promise.allSettled([auth.googleAuthentication(request), auth.googleAuthentication(request)]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failed = attempts.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ status: 409, response: { code: 'GOOGLE_SIGN_UP_CONFLICT' } });
    expect(await db.getRepository(ProviderUser).count()).toBe(1);
    expect(await db.getRepository(MechanicProfile).count()).toBe(1);
    expect(signAsync).toHaveBeenCalledTimes(1);
  });

  it('nullable subjects allow multiple unlinked accounts but linked subjects remain unique', async () => {
    const users = db.getRepository(CustUser);
    const attributes = { name: 'Unlinked', passwordHash: 'unused-hash' };
    await users.save({ ...attributes, email: 'one@local.invalid', phoneNumber: '9876500094' });
    await users.save({ ...attributes, email: 'two@local.invalid', phoneNumber: '9876500095' });
    await users.save({ ...attributes, email: 'three@local.invalid', phoneNumber: '9876500096', googleSubject: 'unique-subject' });
    await expect(users.save({ ...attributes, email: 'four@local.invalid', phoneNumber: '9876500097', googleSubject: 'unique-subject' })).rejects.toMatchObject({ driverError: { code: '23505' } });
    expect(await users.count()).toBe(3);
  });

  it('rolls back the Provider user if PostgreSQL refuses the pending KYC profile', async () => {
    await db.query(`ALTER TABLE "${schema}"."mechanic_profiles" ADD CONSTRAINT qm_google_reject_profile CHECK ("isOnline" = true)`);
    try {
      await expect(auth.googleAuthentication({ idToken: 'rollback-subject', accountType: 'PROVIDER', intent: 'signup',
        phoneNumber: '9876500098', providerType: 'Mechanic' })).rejects.toMatchObject({ driverError: { code: '23514' } });
      expect(await db.getRepository(ProviderUser).count()).toBe(0);
      expect(await db.getRepository(MechanicProfile).count()).toBe(0);
      expect(signAsync).not.toHaveBeenCalled();
    } finally {
      await db.query(`ALTER TABLE "${schema}"."mechanic_profiles" DROP CONSTRAINT qm_google_reject_profile`);
    }
  });
});
