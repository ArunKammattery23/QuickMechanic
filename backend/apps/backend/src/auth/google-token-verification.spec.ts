import { createSign, generateKeyPairSync, KeyObject } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';

describe('Google token cryptographic verification boundary', () => {
  const audience = 'verification-test.apps.googleusercontent.com';
  const savedAudience = process.env.GOOGLE_WEB_CLIENT_ID;
  let privateKey: KeyObject;
  let attackerKey: KeyObject;
  let publicKey: string;
  let service: AuthService;
  let signAsync: jest.Mock;

  function token(changes: Record<string, unknown> = {}, signingKey = privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'local-test-cert' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://accounts.google.com', aud: audience, sub: 'verified-subject',
      email: 'verified@example.com', email_verified: true, name: 'Verified Name',
      iat: now - 10, exp: now + 3600, ...changes,
    })).toString('base64url');
    const message = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256').update(message).sign(signingKey).toString('base64url');
    return `${message}.${signature}`;
  }

  beforeAll(() => {
    const trusted = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = trusted.privateKey;
    publicKey = trusted.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    attackerKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  });

  beforeEach(() => {
    process.env.GOOGLE_WEB_CLIENT_ID = audience;
    // Substitute only the certificate fetch to keep these tests entirely local.
    // verifyIdToken itself performs the real signature/issuer/expiry/audience checks.
    jest.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
      certs: { 'local-test-cert': publicKey }, format: 'PEM',
    } as any);
    const customers = { findOneBy: jest.fn(async () => ({
      id: 'customer-1', email: 'verified@example.com', role: 'CUSTOMER', googleSubject: 'verified-subject',
    })) };
    signAsync = jest.fn(async () => 'verified-app-jwt');
    service = new AuthService({} as any, {} as any, customers as any, {} as any, { signAsync } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (savedAudience === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID;
    else process.env.GOOGLE_WEB_CLIENT_ID = savedAudience;
  });

  it('accepts a correctly signed token for the configured audience', async () => {
    await expect(service.googleAuthentication({ idToken: token(), accountType: 'CUSTOMER', intent: 'login' }))
      .resolves.toEqual({ accessToken: 'verified-app-jwt', role: 'CUSTOMER' });
  });

  it.each([
    { aud: 'malicious-client.apps.googleusercontent.com' },
    { iss: 'https://attacker.invalid' },
    { iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 },
  ])('rejects cryptographically signed tokens with invalid audience/issuer/expiry: %p', async (changes) => {
    await expect(service.googleAuthentication({ idToken: token(changes), accountType: 'CUSTOMER', intent: 'login' }))
      .rejects.toMatchObject({ status: 401, response: { code: 'GOOGLE_TOKEN_INVALID' } });
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rejects a token signed with an attacker key despite otherwise valid identity claims', async () => {
    await expect(service.googleAuthentication({ idToken: token({}, attackerKey), accountType: 'CUSTOMER', intent: 'login' }))
      .rejects.toMatchObject({ status: 401, response: { code: 'GOOGLE_TOKEN_INVALID' } });
    expect(signAsync).not.toHaveBeenCalled();
  });
});
