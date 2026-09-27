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
  };
}

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
