import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, QueryFailedError } from 'typeorm';
import { isEmail } from 'class-validator';
import { AdmUser, AdmUserRole } from '@app/common/entities/adm-user.entity';
import { ProviderUser, ProviderUserRole } from '@app/common/entities/provider-user.entity';
import { CustUser, CustUserRole } from '@app/common/entities/cust-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

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

  async adminLogin(data: {email: string; password: string}) {
    if (typeof data.email !== 'string' || typeof data.password !== 'string') throw new UnauthorizedException('Invalid credentials');
    const user = await this.admUserRepository.findOneBy({email: data.email.trim()});
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
    if (typeof data?.email !== 'string' || typeof data?.password !== 'string' || !data.email.trim() || !data.password) throw new UnauthorizedException('Invalid credentials');
    // Single endpoint login check for simplicity first. 
    // Wait, the user wanted 3 separate endpoints. But for now, we will just support it here.
    let user: any = await this.custUserRepository.findOne({ where: { email: data.email } });
    if (!user) user = await this.providerUserRepository.findOne({ where: { email: data.email } });
    if (!user) user = await this.admUserRepository.findOne({ where: { email: data.email } });

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
