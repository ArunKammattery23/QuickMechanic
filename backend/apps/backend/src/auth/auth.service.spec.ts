import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

function repository(users: any[] = []) {
  return {
    findOne: jest.fn(async ({ where }: any) =>
      users.find(user => Object.entries(where).every(([key, value]) => user[key] === value)) || null,
    ),
    findOneBy: jest.fn(async (where: any) =>
      users.find(user => Object.entries(where).every(([key, value]) => user[key] === value)) || null,
    ),
    save: jest.fn(async (user: any) => user),
    update: jest.fn(async (criteria: any, values: any) => {
      const user = users.find(u => typeof criteria === 'string' ? u.id === criteria :
        u.id === criteria.id && u.resetToken === criteria.resetToken);
      if (!user) return {affected: 0};
      Object.assign(user, values); return {affected: 1};
    }),
    create: jest.fn((user: any) => user),
    // Emulates the username / email / mobile sign-in lookup in AuthService.
    createQueryBuilder: jest.fn(() => {
      let match: (user: any) => boolean = () => false;
      const qb: any = {
        where: (sql: string, { v }: { v: string }) => {
          const last10 = (p: string) => String(p ?? '').replace(/\D/g, '').slice(-10);
          match = sql.includes('email') ? u => String(u.email ?? '').toLowerCase() === v
            : sql.includes('phoneNumber') ? u => last10(u.phoneNumber) === v
            : u => String(u.username ?? '').toLowerCase() === v;
          return qb;
        },
        take: () => qb,
        getMany: async () => users.filter(match),
      };
      return qb;
    }),
  };
}

describe('AuthService sign-in identifiers', () => {
  async function serviceWith(customer: any, provider: any) {
    const jwt = { signAsync: jest.fn(async () => 'signed-jwt') } as unknown as JwtService;
    return new AuthService(repository([]) as any, repository([provider]) as any, repository([customer]) as any, repository() as any, jwt);
  }

  it('accepts a username, email or mobile number, scoped to the app', async () => {
    const hash = await bcrypt.hash('Customer2026', 10);
    const customer = { id: 'c1', username: 'Customer', email: 'c@example.com', phoneNumber: '+919000090001', role: 'CUSTOMER', passwordHash: hash };
    // Same phone on a provider account must not leak into the customer app.
    const provider = { id: 'p1', username: 'Provider', email: 'p@example.com', phoneNumber: '+919000090001', role: 'MECHANIC', passwordHash: hash };
    const service = await serviceWith(customer, provider);

    for (const identifier of ['customer', 'C@EXAMPLE.COM', '9000090001', '+91 90000 90001']) {
      await expect(service.login({ identifier, password: 'Customer2026', accountType: 'CUSTOMER' }))
        .resolves.toEqual({ accessToken: 'signed-jwt', role: 'CUSTOMER' });
    }
    await expect(service.login({ identifier: '9000090001', password: 'Customer2026', accountType: 'PROVIDER' }))
      .resolves.toEqual({ accessToken: 'signed-jwt', role: 'MECHANIC' });
    await expect(service.login({ identifier: 'Customer', password: 'wrong', accountType: 'CUSTOMER' }))
      .rejects.toThrow('Invalid credentials');
    // Older app builds still send `email`.
    await expect(service.login({ email: 'c@example.com', password: 'Customer2026' }))
      .resolves.toEqual({ accessToken: 'signed-jwt', role: 'CUSTOMER' });
  });
});

describe('AuthService administrator authentication', () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPassword = process.env.SMTP_PASSWORD;

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
    if (originalSmtpUser === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = originalSmtpUser;
    if (originalSmtpPassword === undefined) delete process.env.SMTP_PASSWORD; else process.env.SMTP_PASSWORD = originalSmtpPassword;
    jest.restoreAllMocks();
  });

  it('issues a one-use reset token and accepts the new administrator password', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    const admin = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash('old-password', 10),
      resetToken: null,
      resetTokenExpiry: null,
    };
    const adminRepository = repository([admin]);
    const service = new AuthService(
      adminRepository as any,
      repository() as any,
      repository() as any,
      repository() as any,
      { signAsync: jest.fn(async () => 'signed-jwt') } as unknown as JwtService,
    );
    const warning = jest.spyOn(console, 'warn').mockImplementation();

    await service.forgotPassword(' ADMIN@example.com ');
    const token = String(warning.mock.calls[0][0]).split(': ').pop()!;

    expect(admin.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(admin.resetToken).not.toBe(token);
    await expect(service.resetPassword({ token, newPassword: 'new-password' }))
      .resolves.toEqual({ message: 'Password reset successful' });
    expect(admin.resetToken).toBeNull();
    expect(await bcrypt.compare('new-password', admin.passwordHash)).toBe(true);
    await expect(service.adminLogin({ email: admin.email, password: 'new-password' }))
      .resolves.toEqual({ accessToken: 'signed-jwt', role: 'SUPER_ADMIN' });
    await expect(service.resetPassword({ token, newPassword: 'another-password' }))
      .rejects.toThrow('Invalid or expired reset token');
  });

  it('returns the same response for an unknown email', async () => {
    const service = new AuthService(
      repository() as any,
      repository() as any,
      repository() as any,
      repository() as any,
      { signAsync: jest.fn() } as unknown as JwtService,
    );

    await expect(service.forgotPassword('missing@example.com')).resolves.toEqual({
      message: 'If an account exists for that email, a reset token has been sent.',
    });
  });
});
