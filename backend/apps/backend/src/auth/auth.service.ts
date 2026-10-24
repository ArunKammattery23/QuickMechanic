import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, QueryFailedError, IsNull, Raw } from 'typeorm';
import { isEmail } from 'class-validator';
import { AdmUser, AdmUserRole } from '@app/common/entities/adm-user.entity';
import { ProviderUser, ProviderUserRole } from '@app/common/entities/provider-user.entity';
import { CustUser, CustUserRole } from '@app/common/entities/cust-user.entity';
import { MechanicProfile, KycStatus } from '@app/common/entities/mechanic-profile.entity';
import { OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

export interface GoogleAuthenticationRequest {
  idToken: string;
  accountType: 'CUSTOMER' | 'PROVIDER';
  intent: 'login' | 'signup';
  phoneNumber?: string;
  providerType?: 'Mechanic' | 'Towing Fleet';
  linkPassword?: string;
}

interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(AdmUser) private admUserRepository: Repository<AdmUser>,
    @InjectRepository(ProviderUser) private providerUserRepository: Repository<ProviderUser>,
    @InjectRepository(CustUser) private custUserRepository: Repository<CustUser>,
    @InjectRepository(MechanicProfile) private mechanicRepository: Repository<MechanicProfile>,
    private jwtService: JwtService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD, 
      },
    });
  }

  async googleAuthentication(body: unknown) {
    const data = this.googleRequest(body);
    const identity = await this.verifyGoogleIdentity(data.idToken);
    // Customer and Provider identities deliberately live in separate tables.
    // Neither a client role claim nor an administrator email can grant admin access.
    const repository: Repository<CustUser | ProviderUser> = data.accountType === 'CUSTOMER'
      ? this.custUserRepository as Repository<CustUser | ProviderUser>
      : this.providerUserRepository as Repository<CustUser | ProviderUser>;
    const linked = await repository.findOneBy({ googleSubject: identity.subject });
    if (linked) return this.googleSession(linked, data.accountType);

    // Older password registrations did not normalize email case. Compare safely
    // without LIKE wildcards and refuse ambiguous historical duplicates.
    const matches = await repository.find({
      where: { email: Raw(alias => `LOWER(${alias}) = :googleEmail`, { googleEmail: identity.email }) },
      take: 2,
    });
    if (matches.length > 1) {
      throw new ConflictException({ code: 'ACCOUNT_EMAIL_AMBIGUOUS', message: 'More than one existing account uses this email. Contact support before linking Google.' });
    }
    if (matches[0]) {
      const existing = matches[0];
      if (existing.googleSubject) {
        throw this.googleLinkConflict();
      }
      if (!data.linkPassword) {
        throw new ConflictException({ code: 'ACCOUNT_LINK_REQUIRED', message: 'Enter the existing QuickMechanic password to link this Google account.' });
      }
      if (!await bcrypt.compare(data.linkPassword, existing.passwordHash)) {
        throw new UnauthorizedException({ code: 'ACCOUNT_LINK_PASSWORD_INVALID', message: 'The existing account password is incorrect.' });
      }
      try {
        // Password proof and an unlinked identity must still hold when the update
        // occurs. A concurrent link or password reset cannot be overwritten.
        const changed = await repository.update({
          id: existing.id, email: existing.email, googleSubject: IsNull(), passwordHash: existing.passwordHash,
        }, { googleSubject: identity.subject });
        if (!changed.affected) {
          const current = await repository.findOneBy({ id: existing.id });
          if (current?.googleSubject === identity.subject) {
            return this.googleSession(current, data.accountType);
          }
          throw this.googleLinkConflict();
        }
      } catch (error) {
        if (this.isUniqueViolation(error)) throw this.googleLinkConflict();
        throw error;
      }
      existing.googleSubject = identity.subject;
      return this.googleSession(existing, data.accountType);
    }
    if (data.intent === 'login') {
      throw new NotFoundException({ code: 'GOOGLE_ACCOUNT_NOT_REGISTERED', message: 'No account is registered for this Google identity. Create an account first.' });
    }

    const phoneNumber = data.phoneNumber?.trim() ?? '';
    if (!/^\+?[1-9]\d{9,14}$/.test(phoneNumber) || identity.name.length < 2 || identity.name.length > 200) {
      throw new BadRequestException('A valid 10 to 15 digit mobile number and a name from Google are required');
    }
    if (data.accountType === 'PROVIDER' && !['Mechanic', 'Towing Fleet'].includes(data.providerType ?? '')) {
      throw new BadRequestException('Choose Mechanic or Towing Fleet for a new provider account');
    }
    // Google-only signups have no guessable temporary or preset password.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12);
    const attributes = {
      email: identity.email, name: identity.name, googleSubject: identity.subject,
      phoneNumber, passwordHash,
    };
    const user = data.accountType === 'CUSTOMER'
      ? this.custUserRepository.create({ ...attributes, role: CustUserRole.CUSTOMER })
      : this.providerUserRepository.create({ ...attributes,
        role: data.providerType === 'Towing Fleet' ? ProviderUserRole.FLEET_DRIVER : ProviderUserRole.MECHANIC });
    try {
      if (data.accountType === 'PROVIDER') {
        await this.providerUserRepository.manager.transaction(async manager => {
          await manager.getRepository(ProviderUser).save(user as ProviderUser);
          const profiles = manager.getRepository(MechanicProfile);
          await profiles.save(profiles.create({
            user: user as ProviderUser, kycStatus: KycStatus.PENDING,
            kycDocumentsVerified: false, isOnline: false,
          }));
        });
      } else {
        await repository.save(user);
      }
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({ code: 'GOOGLE_SIGN_UP_CONFLICT', message: 'An account already uses this Google identity, email or mobile number. Sign in or contact support.' });
      }
      throw error;
    }
    return this.googleSession(user, data.accountType);
  }

  private googleRequest(body: unknown): GoogleAuthenticationRequest {
    if (!body || typeof body !== 'object') throw new BadRequestException('Invalid Google authentication request');
    const data = body as Partial<GoogleAuthenticationRequest>;
    if (typeof data.idToken !== 'string' || !data.idToken.trim() || data.idToken.length > 16384 ||
        !['CUSTOMER', 'PROVIDER'].includes(data.accountType ?? '') ||
        !['login', 'signup'].includes(data.intent ?? '') ||
        (data.phoneNumber !== undefined && typeof data.phoneNumber !== 'string') ||
        (data.providerType !== undefined && !['Mechanic', 'Towing Fleet'].includes(data.providerType)) ||
        (data.linkPassword !== undefined && (typeof data.linkPassword !== 'string' || data.linkPassword.length > 256))) {
      throw new BadRequestException('A Google ID token, Customer or Provider account type, and login or signup intent are required');
    }
    return data as GoogleAuthenticationRequest;
  }

  private async verifyGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
    const audience = process.env.GOOGLE_WEB_CLIENT_ID?.trim();
    if (!audience) {
      throw new ServiceUnavailableException({ code: 'GOOGLE_SIGN_IN_NOT_CONFIGURED', message: 'Google sign-in is not configured on this server.' });
    }
    try {
      // The official verifier checks Google's signature, issuer, expiry and audience.
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload || payload.aud !== audience || payload.email_verified !== true ||
          typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || payload.sub.trim() !== payload.sub ||
          typeof payload.email !== 'string' || !isEmail(payload.email)) {
        throw new Error('Invalid Google identity claims');
      }
      return {
        subject: payload.sub, email: payload.email.trim().toLowerCase(),
        name: typeof payload.name === 'string' ? payload.name.trim() : '',
      };
    } catch (_) {
      throw new UnauthorizedException({ code: 'GOOGLE_TOKEN_INVALID', message: 'Google sign-in could not be verified. Please sign in with Google again.' });
    }
  }

  private async googleSession(user: CustUser | ProviderUser, accountType: 'CUSTOMER' | 'PROVIDER') {
    const allowedRoles = accountType === 'CUSTOMER' ? [CustUserRole.CUSTOMER]
      : [ProviderUserRole.MECHANIC, ProviderUserRole.FLEET_DRIVER];
    if (!(allowedRoles as string[]).includes(user.role)) throw new ForbiddenException('This account cannot use Google sign-in for the selected app');
    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role }),
      role: user.role,
    };
  }

  private googleLinkConflict() {
    return new ConflictException({ code: 'ACCOUNT_LINK_CONFLICT', message: 'This account or Google identity has already been linked. Sign in again or contact support.' });
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505';
  }

  async registerCustomer(data: any) {
    this.validateRegistration(data);
    const existingUser = await this.custUserRepository.findOne({ where: { email: data.email } });
    if (existingUser) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.custUserRepository.create({
      name: data.name || 'Unknown User',
      email: data.email,
      passwordHash: hashedPassword,
      role: CustUserRole.CUSTOMER,
      phoneNumber: data.phoneNumber,
    });

    try { await this.custUserRepository.save(user); }
    catch (error) { this.registrationError(error); }
    return { id: user.id, email: user.email, role: user.role };
  }

  async registerMechanic(data: any) {
    this.validateRegistration(data);
    if (typeof data.phoneNumber !== 'string' || !/^\+?[1-9]\d{9,14}$/.test(data.phoneNumber.trim())) {
      throw new BadRequestException('A valid 10 to 15 digit mobile number is required for providers');
    }
    const existingUser = await this.providerUserRepository.findOne({ where: { email: data.email } });
    if (existingUser) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const role = data.type === 'Towing Fleet' ? ProviderUserRole.FLEET_DRIVER : ProviderUserRole.MECHANIC;

    const user = this.providerUserRepository.create({
      name: data.name || 'Unknown Mechanic',
      email: data.email,
      passwordHash: hashedPassword,
      role: role,
      phoneNumber: data.phoneNumber.trim(),
    });
    try {
      await this.providerUserRepository.manager.transaction(async manager => {
        await manager.getRepository(ProviderUser).save(user);
        const profiles = manager.getRepository(MechanicProfile);
        await profiles.save(profiles.create({user}));
      });
    } catch (error) { this.registrationError(error); }

    return { id: user.id, email: user.email, role: user.role };
  }

  private validateRegistration(data: any): void {
    if (!data || typeof data.email !== 'string' || !isEmail(data.email) ||
        typeof data.password !== 'string' || !data.password || data.password.length > 256 ||
        typeof data.phoneNumber !== 'string' || !data.phoneNumber.trim() || data.phoneNumber.length > 64 ||
        (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 200))) {
      throw new BadRequestException('A valid email, password and phone number are required');
    }
  }

  private registrationError(error: unknown): never {
    if (error instanceof QueryFailedError && (error.driverError as {code?: string}).code === '23505') {
      throw new ConflictException('Email or phone number already in use');
    }
    throw error;
  }

  // One sign-in field accepts a username, an email address or a mobile number.
  // Mobile numbers match on their last 10 digits so "+91 98765 43210" and
  // "9876543210" find the same account; ambiguous matches are refused.
  private async findByIdentifier<T extends { id: string }>(repository: Repository<T>, raw: unknown): Promise<T | null> {
    const identifier = typeof raw === 'string' ? raw.trim() : '';
    if (!identifier || identifier.length > 200) return null;
    const qb = repository.createQueryBuilder('u');
    if (identifier.includes('@')) {
      qb.where('LOWER(u.email) = :v', { v: identifier.toLowerCase() });
    } else if (/^\+?[\d\s-]{10,20}$/.test(identifier)) {
      const digits = identifier.replace(/\D/g, '');
      if (digits.length < 10) return null;
      qb.where(`RIGHT(regexp_replace(u."phoneNumber", '\\D', '', 'g'), 10) = :v`, { v: digits.slice(-10) });
    } else {
      qb.where('LOWER(u.username) = :v', { v: identifier.toLowerCase() });
    }
    const matches = await qb.take(2).getMany();
    return matches.length === 1 ? matches[0] : null;
  }

  async adminLogin(data: {email?: string; identifier?: string; password: string}) {
    if (typeof data?.password !== 'string') throw new UnauthorizedException('Invalid credentials');
    const user = await this.findByIdentifier(this.admUserRepository, data.identifier ?? data.email);
    if (!user || !await bcrypt.compare(data.password, user.passwordHash)) throw new UnauthorizedException('Invalid credentials');
    return {accessToken: await this.jwtService.signAsync({sub: user.id, email: user.email, role: user.role}), role: user.role};
  }

  private async currentAdmin(actor: {sub: string; role: string}) {
    if (!['SUPER_ADMIN', 'MANAGER', 'CEO'].includes(actor.role)) throw new ForbiddenException();
    const admin = await this.admUserRepository.findOneBy({id: actor.sub});
    if (!admin || admin.role !== actor.role) throw new ForbiddenException('Admin account is no longer active');
    return admin;
  }

  async adminMe(actor: {sub: string; role: string}) {
    const admin = await this.currentAdmin(actor);
    return {id: admin.id, name: admin.name, email: admin.email, role: admin.role, phoneNumber: admin.phoneNumber};
  }

  async updateAdminMe(actor: {sub: string; role: string}, body: any) {
    const admin = await this.currentAdmin(actor);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const phone = typeof body?.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
    if (name.length < 2 || name.length > 80 || (phone && !/^\+?[1-9]\d{9,14}$/.test(phone))) throw new BadRequestException('Enter a name of 2–80 characters and an optional valid mobile number');
    admin.name = name;
    admin.phoneNumber = phone || null;
    await this.admUserRepository.save(admin);
    return this.adminMe(actor);
  }

  async changeAdminPassword(actor: {sub: string; role: string}, body: any) {
    const admin = await this.currentAdmin(actor);
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || newPassword.length < 8 || newPassword.length > 256) throw new BadRequestException('Current password and a new password of at least 8 characters are required');
    if (!await bcrypt.compare(currentPassword, admin.passwordHash)) throw new UnauthorizedException('Current password is incorrect');
    if (currentPassword === newPassword) throw new BadRequestException('Choose a different new password');
    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.admUserRepository.save(admin);
    return {message: 'Password changed'};
  }

  async login(data: any) {
    const identifier = data?.identifier ?? data?.email;
    if (typeof identifier !== 'string' || typeof data?.password !== 'string' || !identifier.trim() || !data.password) throw new UnauthorizedException('Invalid credentials');
    // Apps send accountType so a person who is both a customer and a provider
    // (same phone number) reaches the account for the app they opened.
    const repositories: Repository<any>[] =
      data.accountType === 'CUSTOMER' ? [this.custUserRepository]
      : data.accountType === 'PROVIDER' ? [this.providerUserRepository]
      : [this.custUserRepository, this.providerUserRepository, this.admUserRepository];
    let user: any = null;
    for (const repository of repositories) {
      user = await this.findByIdentifier(repository, identifier);
      if (user) break;
    }

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      role: user.role,
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const response = { message: 'If an account exists for that email, a reset token has been sent.' };
    if (!normalizedEmail) return response;

    const account = await this.findAccountByEmail(normalizedEmail);
    if (!account) return response;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(resetToken);
    await account.repository.update(account.user.id, {
      resetToken: tokenHash, resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
    });

    const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
    if (!smtpConfigured && process.env.NODE_ENV !== 'production') {
      console.warn(`Password reset token for ${normalizedEmail}: ${resetToken}`);
      return response;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: normalizedEmail,
        subject: 'QuickMechanic password reset',
        text: `Your QuickMechanic password reset token is: ${resetToken}\n\nThis token expires in 15 minutes. If you did not request this reset, you can ignore this email.`,
      });
    } catch (error) {
      await account.repository.update({id: account.user.id, resetToken: tokenHash}, {
        resetToken: null, resetTokenExpiry: null,
      });
      console.error('Unable to send password reset email', error);
    }

    return response;
  }

  async resetPassword(data: { token?: string; newPassword?: string }) {
    const token = typeof data?.token === 'string' ? data.token.trim() : '';
    const newPassword = typeof data?.newPassword === 'string' ? data.newPassword : '';
    if (!token || newPassword.length < 8) {
      throw new UnauthorizedException('Invalid or expired reset token, or password is shorter than 8 characters');
    }

    const tokenHash = this.hashResetToken(token);
    const account = await this.findAccountByResetToken(tokenHash);
    if (!account || !account.user.resetTokenExpiry || account.user.resetTokenExpiry.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Compare-and-clear in one statement: concurrent retries cannot both consume
    // the token, and a newer reset request cannot be overwritten by an old one.
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const changed = await account.repository.update({
      id: account.user.id, resetToken: tokenHash, resetTokenExpiry: MoreThan(new Date()),
    }, {passwordHash, resetToken: null, resetTokenExpiry: null});
    if (!changed.affected) throw new UnauthorizedException('Invalid or expired reset token');
    return { message: 'Password reset successful' };
  }

  private hashResetToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async findAccountByEmail(email: string) {
    const repositories: Repository<any>[] = [
      this.custUserRepository,
      this.providerUserRepository,
      this.admUserRepository,
    ];
    for (const repository of repositories) {
      const user = await repository.findOne({ where: { email } });
      if (user) return { repository, user };
    }
    return null;
  }

  private async findAccountByResetToken(resetToken: string) {
    const repositories: Repository<any>[] = [
      this.custUserRepository,
      this.providerUserRepository,
      this.admUserRepository,
    ];
    for (const repository of repositories) {
      const user = await repository.findOne({ where: { resetToken } });
      if (user) return { repository, user };
    }
    return null;
  }
}
