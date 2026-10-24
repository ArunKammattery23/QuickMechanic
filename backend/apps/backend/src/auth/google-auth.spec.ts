import * as bcrypt from 'bcryptjs';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { QueryFailedError } from 'typeorm';
import { AuthService } from './auth.service';
import { ProviderUser } from '@app/common/entities/provider-user.entity';

function duplicate() {
  return new QueryFailedError('INSERT', [], { code: '23505' } as any);
}

function repository(users: any[] = []) {
  const repo = {
    users,
    findOneBy: jest.fn(async (where: any) => {
      const user = users.find(row => Object.entries(where).every(([key, value]) => row[key] === value));
      return user ? { ...user } : null;
    }),
    find: jest.fn(async ({ where, take }: any) => users.filter(row =>
      row.email.toLowerCase() === where.email.objectLiteralParameters.googleEmail).slice(0, take).map(row => ({ ...row }))),
    create: jest.fn((values: any) => ({ id: `new-${users.length + 1}`, ...values })),
    save: jest.fn(async (user: any) => {
      if (users.some(row => row.email === user.email || row.phoneNumber === user.phoneNumber ||
          (user.googleSubject && row.googleSubject === user.googleSubject))) throw duplicate();
      users.push({ ...user });
      return user;
    }),
    update: jest.fn(async (criteria: any, changes: any) => {
      const row = users.find(user => user.id === criteria.id &&
        user.email === criteria.email && user.googleSubject == null && user.passwordHash === criteria.passwordHash);
      if (!row) return { affected: 0 };
      if (users.some(user => user.id !== row.id && user.googleSubject === changes.googleSubject)) throw duplicate();
      Object.assign(row, changes);
      return { affected: 1 };
    }),
    manager: {} as any,
  };
  return repo;
}

describe('Google authentication security and account lifecycle', () => {
  const audience = 'web-client.apps.googleusercontent.com';
  const originalAudience = process.env.GOOGLE_WEB_CLIENT_ID;
  let customers: ReturnType<typeof repository>;
  let providers: ReturnType<typeof repository>;
  let admins: ReturnType<typeof repository>;
  let profiles: ReturnType<typeof repository>;
  let signAsync: jest.Mock;
  let service: AuthService;
  let verify: jest.SpyInstance;
  let claims: TokenPayload;
  const login = { idToken: 'valid-id-token', accountType: 'CUSTOMER', intent: 'login' };
  const signup = { ...login, intent: 'signup', phoneNumber: '+919876543210' };

  beforeEach(() => {
    process.env.GOOGLE_WEB_CLIENT_ID = audience;
    claims = {
      aud: audience, sub: 'google-123', email: 'Test@Example.com', email_verified: true,
      name: 'Verified Google Name', iss: 'https://accounts.google.com', iat: 1, exp: 2,
    };
    verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async () =>
      ({ getPayload: () => claims }) as any);
    customers = repository(); providers = repository(); admins = repository(); profiles = repository();
    profiles.save.mockImplementation(async (profile: any) => { profiles.users.push(profile); return profile; });
    providers.manager.transaction = jest.fn(async (run: any) => {
      const count = providers.users.length;
      const profileCount = profiles.users.length;
      try {
        return await run({ getRepository: (entity: unknown) => entity === ProviderUser ? providers : profiles });
      } catch (error) {
        providers.users.splice(count); profiles.users.splice(profileCount); throw error;
      }
    });
    signAsync = jest.fn(async () => 'app-jwt');
    service = new AuthService(admins as any, providers as any, customers as any, profiles as any, { signAsync } as any);
  });

  afterEach(() => {
    if (originalAudience === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID;
    else process.env.GOOGLE_WEB_CLIENT_ID = originalAudience;
    jest.restoreAllMocks();
  });

  it('fails closed without a configured audience before invoking Google or querying accounts', async () => {
    delete process.env.GOOGLE_WEB_CLIENT_ID;
    await expect(service.googleAuthentication(login)).rejects.toMatchObject({ response: { code: 'GOOGLE_SIGN_IN_NOT_CONFIGURED' }, status: 503 });
    expect(verify).not.toHaveBeenCalled(); expect(customers.findOneBy).not.toHaveBeenCalled();
  });

  it.each(['bad signature', 'expired token', 'wrong issuer', 'wrong audience'])('rejects verifier failure: %s', async (reason) => {
    verify.mockRejectedValueOnce(new Error(reason));
    await expect(service.googleAuthentication(login)).rejects.toMatchObject({ response: { code: 'GOOGLE_TOKEN_INVALID' }, status: 401 });
    expect(verify).toHaveBeenCalledWith({ idToken: login.idToken, audience });
    expect(signAsync).not.toHaveBeenCalled(); expect(customers.findOneBy).not.toHaveBeenCalled();
  });

  it.each([
    { email_verified: false }, { sub: '' }, { sub: ' 123 ' }, { email: 'invalid-email' }, { aud: 'another-client' },
  ])('rejects invalid or unverified identity claims %p', async (changes) => {
    claims = { ...claims, ...changes };
    await expect(service.googleAuthentication(signup)).rejects.toMatchObject({ response: { code: 'GOOGLE_TOKEN_INVALID' }, status: 401 });
    expect(customers.save).not.toHaveBeenCalled(); expect(signAsync).not.toHaveBeenCalled();
  });

  it('does not create an account for login intent and returns a recognizable 404', async () => {
    await expect(service.googleAuthentication(login)).rejects.toMatchObject({ response: { code: 'GOOGLE_ACCOUNT_NOT_REGISTERED' }, status: 404 });
    expect(customers.save).not.toHaveBeenCalled();
  });

  it('uses the verified subject for returning accounts even after Google email changes', async () => {
    customers.users.push({ id: 'customer-1', email: 'original@example.com', role: 'CUSTOMER', googleSubject: claims.sub });
    await expect(service.googleAuthentication(login)).resolves.toEqual({ accessToken: 'app-jwt', role: 'CUSTOMER' });
    expect(signAsync).toHaveBeenCalledWith({ sub: 'customer-1', email: 'original@example.com', role: 'CUSTOMER' });
    expect(customers.find).not.toHaveBeenCalled();
  });

  it('keeps customer/provider roles separate when the same subject and email are used in both apps', async () => {
    customers.users.push({ id: 'customer-1', email: 'test@example.com', role: 'CUSTOMER', googleSubject: claims.sub });
    providers.users.push({ id: 'provider-1', email: 'test@example.com', role: 'FLEET_DRIVER', googleSubject: claims.sub });
    await expect(service.googleAuthentication(login)).resolves.toMatchObject({ role: 'CUSTOMER' });
    await expect(service.googleAuthentication({ ...login, accountType: 'PROVIDER', providerType: 'Mechanic', role: 'SUPER_ADMIN' })).resolves.toMatchObject({ role: 'FLEET_DRIVER' });
    expect(signAsync).toHaveBeenLastCalledWith({ sub: 'provider-1', email: 'test@example.com', role: 'FLEET_DRIVER' });
    expect(admins.findOneBy).not.toHaveBeenCalled();
  });

  it('never grants administrator access or accepts a client role', async () => {
    await expect(service.googleAuthentication({ ...signup, accountType: 'ADMIN' })).rejects.toMatchObject({ status: 400 });
    customers.users.push({ id: 'invalid-role', email: 'test@example.com', role: 'SUPER_ADMIN', googleSubject: claims.sub });
    await expect(service.googleAuthentication(login)).rejects.toMatchObject({ status: 403 });
    expect(signAsync).not.toHaveBeenCalled();
  });

  it.each(['login', 'signup'])('requires password proof for an existing unlinked email, including %s', async (intent) => {
    customers.users.push({ id: 'customer-1', email: 'TEST@example.com', role: 'CUSTOMER', googleSubject: null });
    await expect(service.googleAuthentication({ ...signup, intent })).rejects.toMatchObject({ response: { code: 'ACCOUNT_LINK_REQUIRED' }, status: 409 });
    expect(customers.update).not.toHaveBeenCalled(); expect(signAsync).not.toHaveBeenCalled();
  });

  it('refuses to link with the wrong existing password', async () => {
    customers.users.push({ id: 'customer-1', email: 'test@example.com', role: 'CUSTOMER', googleSubject: null, passwordHash: await bcrypt.hash('right-password', 4) });
    await expect(service.googleAuthentication({ ...login, linkPassword: 'wrong-password' })).rejects.toMatchObject({ response: { code: 'ACCOUNT_LINK_PASSWORD_INVALID' }, status: 401 });
    expect(customers.update).not.toHaveBeenCalled();
  });

  it('binds Google only after password proof, without overwriting the existing profile or password', async () => {
    const account = { id: 'customer-1', email: 'TEST@example.com', name: 'Existing Name', phoneNumber: '+919999999999', role: 'CUSTOMER', googleSubject: null, passwordHash: await bcrypt.hash('right-password', 4) };
    customers.users.push(account);
    await expect(service.googleAuthentication({ ...signup, linkPassword: 'right-password', email: 'attacker@example.com', name: 'Attacker', role: 'SUPER_ADMIN' })).resolves.toMatchObject({ role: 'CUSTOMER' });
    expect(account).toMatchObject({ googleSubject: claims.sub, name: 'Existing Name', phoneNumber: '+919999999999' });
    expect(await bcrypt.compare('right-password', account.passwordHash)).toBe(true);
    expect(customers.update.mock.calls[0][0]).toMatchObject({ id: account.id, passwordHash: account.passwordHash });
    expect(customers.update.mock.calls[0][0].googleSubject.type).toBe('isNull');
  });

  it('will not rebind an account already linked to another Google subject', async () => {
    customers.users.push({ id: 'customer-1', email: 'test@example.com', role: 'CUSTOMER', googleSubject: 'different-subject' });
    await expect(service.googleAuthentication({ ...login, linkPassword: 'any-password' })).rejects.toMatchObject({ response: { code: 'ACCOUNT_LINK_CONFLICT' }, status: 409 });
    expect(customers.update).not.toHaveBeenCalled();
  });

  it('refuses ambiguous older email case variants rather than choosing an account', async () => {
    customers.users.push({ id: 'one', email: 'test@example.com' }, { id: 'two', email: 'TEST@example.com' });
    await expect(service.googleAuthentication(signup)).rejects.toMatchObject({ response: { code: 'ACCOUNT_EMAIL_AMBIGUOUS' }, status: 409 });
    expect(customers.update).not.toHaveBeenCalled();
  });

  it('creates a customer using only verified Google name/email, a valid phone, and an unguessable hashed password', async () => {
    await expect(service.googleAuthentication({ ...signup, email: 'attacker@example.com', name: 'Attacker', role: 'SUPER_ADMIN' })).resolves.toMatchObject({ role: 'CUSTOMER' });
    expect(customers.users[0]).toMatchObject({ email: 'test@example.com', name: 'Verified Google Name', googleSubject: claims.sub, phoneNumber: signup.phoneNumber, role: 'CUSTOMER' });
    expect(customers.users[0].passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('password123', customers.users[0].passwordHash)).toBe(false);
  });

  it.each(['Mechanic', 'Towing Fleet'])('creates a %s Provider and an offline pending KYC profile atomically', async (providerType) => {
    await expect(service.googleAuthentication({ ...signup, accountType: 'PROVIDER', providerType })).resolves.toMatchObject({ role: providerType === 'Mechanic' ? 'MECHANIC' : 'FLEET_DRIVER' });
    expect(providers.manager.transaction).toHaveBeenCalledTimes(1);
    expect(profiles.users[0]).toMatchObject({ kycStatus: 'PENDING', kycDocumentsVerified: false, isOnline: false });
    expect(profiles.users[0].user.id).toBe(providers.users[0].id);
  });

  it.each(['', '123', '+0123456789', '1234567890123456', 'abcdefghij'])('rejects invalid signup phone %s without saving', async (phoneNumber) => {
    await expect(service.googleAuthentication({ ...signup, phoneNumber })).rejects.toMatchObject({ status: 400 });
    expect(customers.save).not.toHaveBeenCalled();
  });

  it('requires a verified Google display name and an explicit provider type for new signup', async () => {
    await expect(service.googleAuthentication({ ...signup, accountType: 'PROVIDER' })).rejects.toMatchObject({ status: 400 });
    claims = { ...claims, name: '' };
    await expect(service.googleAuthentication(signup)).rejects.toMatchObject({ status: 400 });
    expect(customers.save).not.toHaveBeenCalled(); expect(providers.save).not.toHaveBeenCalled();
  });

  it('returns a conflict on duplicate signup without issuing a session', async () => {
    customers.save.mockRejectedValueOnce(duplicate());
    await expect(service.googleAuthentication(signup)).rejects.toMatchObject({ response: { code: 'GOOGLE_SIGN_UP_CONFLICT' }, status: 409 });
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rolls back a new provider when its pending KYC profile cannot be saved', async () => {
    profiles.save.mockRejectedValueOnce(new Error('profile storage failure'));
    await expect(service.googleAuthentication({ ...signup, accountType: 'PROVIDER', providerType: 'Mechanic' })).rejects.toThrow('profile storage failure');
    expect(providers.users).toHaveLength(0); expect(signAsync).not.toHaveBeenCalled();
  });

  it('does not overwrite a concurrent link to a different Google identity', async () => {
    customers.users.push({ id: 'customer-1', email: 'test@example.com', role: 'CUSTOMER', googleSubject: null, passwordHash: await bcrypt.hash('right-password', 4) });
    verify.mockImplementation(async ({ idToken }: any) => ({ getPayload: () => ({ ...claims, sub: idToken }) }) as any);
    const attempts = await Promise.allSettled([
      service.googleAuthentication({ ...login, idToken: 'google-one', linkPassword: 'right-password' }),
      service.googleAuthentication({ ...login, idToken: 'google-two', linkPassword: 'right-password' }),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failed = attempts.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ response: { code: 'ACCOUNT_LINK_CONFLICT' }, status: 409 });
    expect(signAsync).toHaveBeenCalledTimes(1);
  });

  it('handles concurrent duplicate signup with one account and a conflict', async () => {
    const attempts = await Promise.allSettled([service.googleAuthentication(signup), service.googleAuthentication(signup)]);
    expect(customers.users).toHaveLength(1);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failed = attempts.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ response: { code: 'GOOGLE_SIGN_UP_CONFLICT' }, status: 409 });
    expect(signAsync).toHaveBeenCalledTimes(1);
  });
});
