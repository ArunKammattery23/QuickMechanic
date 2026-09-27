import { performanceBadges } from './performance';
import { ProviderKycSubmission } from '@app/common/entities/provider-kyc-submission.entity';
import { requireProviderEligibility, validProviderMobile } from './provider-eligibility';
import { isUUID } from 'class-validator';
import { ServiceType } from '@app/common/entities/service-type.entity';
import { minorUnits } from '../dispatch/money';
import { Injectable, NotFoundException, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { CustUser } from '@app/common/entities/cust-user.entity';
import { KycStatus } from '@app/common/entities/mechanic-profile.entity';
import { PaymentLedger } from '@app/common/entities/payment-ledger.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, IsNull } from 'typeorm';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { MechanicPricing } from '@app/common/entities/mechanic-pricing.entity';
import { ServiceRequest, JobStatus } from '@app/common/entities/service-request.entity';
import { Invoice, PaymentStatus } from '@app/common/entities/invoice.entity';
import { VehicleCategory } from '@app/common/entities/vehicle-category.entity';
import { MoreThanOrEqual, In } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(ProviderUser)
    private usersRepository: Repository<ProviderUser>,
    @InjectRepository(MechanicProfile)
    private mechanicRepository: Repository<MechanicProfile>,
    @InjectRepository(MechanicPricing)
    private pricingRepository: Repository<MechanicPricing>,
    @InjectRepository(ServiceRequest)
    private serviceRequestRepository: Repository<ServiceRequest>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(VehicleCategory)
    private vehicleCategoryRepository: Repository<VehicleCategory>,
    @InjectRepository(ProviderKycSubmission)
    private kycRepository: Repository<ProviderKycSubmission>,
  ) {}
  
  async getPendingKycMechanics() {
    const submissions = await this.kycRepository.find({where: {reviewedAt: IsNull()}, order: {submittedAt: 'ASC'}, take: 100});
    if (!submissions.length) return [];
    const ids = submissions.map(s => s.providerId);
    const users = await this.usersRepository.findBy({id: In(ids)});
    const byId = new Map(users.map(user => [user.id, user]));
    return submissions.filter(s => byId.has(s.providerId)).map(s => ({
      id: s.providerId, name: byId.get(s.providerId)!.name,
      email: byId.get(s.providerId)!.email, phoneNumber: byId.get(s.providerId)!.phoneNumber,
      idType: s.idType, address: s.address, secondaryPhone: s.secondaryPhone,
      submittedAt: s.submittedAt, kycStatus: KycStatus.PENDING,
    }));
  }

  async updateKycStatus(mechanicId: string, status: string, adminId: string, expectedSubmittedAt?: string) {
    if (!Object.values(KycStatus).includes(status as KycStatus)) throw new BadRequestException('Invalid KYC status');
    return this.mechanicRepository.manager.transaction(async manager => {
      const profile = await manager.getRepository(MechanicProfile).createQueryBuilder('profile')
        .innerJoinAndSelect('profile.user', 'user').where('user.id = :mechanicId', {mechanicId})
        .setLock('pessimistic_write').getOne();
      if (!profile) throw new NotFoundException('Provider not found');
      const submission = await manager.getRepository(ProviderKycSubmission).findOneBy({providerId: mechanicId});
      if (!submission || !expectedSubmittedAt || submission.submittedAt.toISOString() !== expectedSubmittedAt) {
        throw new BadRequestException('KYC submission changed. Refresh and review the latest photos.');
      }
      if (status === KycStatus.APPROVED && (!submission || !validProviderMobile(profile.user.phoneNumber))) {
        throw new BadRequestException('A submitted ID card and valid mobile number are required before KYC approval');
      }
      profile.kycStatus = status as KycStatus;
      profile.kycDocumentsVerified = status === KycStatus.APPROVED;
      if (status !== KycStatus.APPROVED) {profile.isOnline = false; profile.lastSeenAt = null;}
      await manager.getRepository(MechanicProfile).save(profile);
      if (submission) await manager.getRepository(ProviderKycSubmission).update(mechanicId, {
        reviewedAt: status === KycStatus.PENDING ? null : new Date(),
        reviewedById: status === KycStatus.PENDING ? null : adminId,
      });
      return {success: true, message: 'KYC status updated'};
    });
  }

  private imageMime(file: any): string {
    const bytes: Buffer | undefined = file?.buffer;
    if (!bytes || bytes.length < 1024 || bytes.length > 2 * 1024 * 1024) throw new BadRequestException('Each ID image must be 1 KB to 2 MB');
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const mime = jpeg ? 'image/jpeg' : png ? 'image/png' : null;
    if (!mime || file.mimetype !== mime) throw new BadRequestException('Upload JPEG or PNG ID photos only');
    return mime;
  }

  async submitMyKyc(providerId: string, fields: any, files: {front?: any[]; back?: any[]}) {
    const allowed = ['AADHAAR', 'DRIVING_LICENCE', 'VOTER_ID', 'PASSPORT', 'OTHER'];
    const idType = fields?.idType;
    const address = typeof fields?.address === 'string' ? fields.address.trim() : '';
    const secondaryPhone = typeof fields?.secondaryPhone === 'string' ? fields.secondaryPhone.trim() : '';
    if (!allowed.includes(idType) || address.length < 15 || address.length > 500 || !validProviderMobile(secondaryPhone)) {
      throw new BadRequestException('Select an ID type, enter a full address and a valid secondary number');
    }
    const front = files?.front?.[0], back = files?.back?.[0];
    const frontMime = this.imageMime(front), backMime = this.imageMime(back);
    return this.mechanicRepository.manager.transaction(async manager => {
      const profile = await manager.getRepository(MechanicProfile).createQueryBuilder('profile')
        .innerJoinAndSelect('profile.user', 'user').where('user.id = :providerId', {providerId})
        .setLock('pessimistic_write').getOne();
      if (!profile) throw new NotFoundException('Provider not found');
      if (!validProviderMobile(profile.user.phoneNumber)) throw new BadRequestException('Add your primary mobile number before submitting KYC');
      if (secondaryPhone === profile.user.phoneNumber) throw new BadRequestException('Secondary number must differ from primary mobile');
      if (profile.kycStatus === KycStatus.APPROVED && profile.kycDocumentsVerified) throw new BadRequestException('Approved KYC cannot be replaced; contact support');
      await manager.getRepository(ProviderKycSubmission).save({providerId, idType, address, secondaryPhone,
        frontImage: front.buffer, backImage: back.buffer, frontMime, backMime,
        submittedAt: new Date(), reviewedAt: null, reviewedById: null});
      profile.kycStatus = KycStatus.PENDING;
      profile.kycDocumentsVerified = false;
      profile.isOnline = false;
      profile.lastSeenAt = null;
      await manager.getRepository(MechanicProfile).save(profile);
      return {success: true, message: 'KYC submitted for admin review'};
    });
  }

  async myKyc(providerId: string) {
    const submission = await this.kycRepository.findOneBy({providerId});
    const profile = await this.mechanicRepository.findOneBy({user: {id: providerId}});
    return {submitted: !!submission, status: profile?.kycStatus === KycStatus.APPROVED && !profile.kycDocumentsVerified ? KycStatus.PENDING : profile?.kycStatus ?? KycStatus.PENDING,
      idType: submission?.idType ?? null, address: submission?.address ?? null,
      secondaryPhone: submission?.secondaryPhone ?? null, submittedAt: submission?.submittedAt ?? null};
  }

  async kycImage(providerId: string, side: string) {
    if (!['front', 'back'].includes(side)) throw new BadRequestException('Invalid ID image side');
    const submission = await this.kycRepository.createQueryBuilder('kyc')
      .addSelect(side === 'front' ? 'kyc.frontImage' : 'kyc.backImage')
      .where('kyc.providerId = :providerId', {providerId}).getOne();
    if (!submission) throw new NotFoundException('KYC submission not found');
    return side === 'front' ? {bytes: submission.frontImage, mime: submission.frontMime} : {bytes: submission.backImage, mime: submission.backMime};
  }

  async updateMyMobile(providerId: string, mobile: unknown) {
    if (!validProviderMobile(mobile)) throw new BadRequestException('Enter a valid 10 to 15 digit mobile number');
    const value = mobile.trim();
    let result;
    try {
      result = await this.usersRepository.update({id: providerId}, {phoneNumber: value});
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as {code?: string}).code === '23505') {
        throw new ConflictException('Mobile number is already in use');
      }
      throw error;
    }
    if (!result.affected) throw new NotFoundException('Provider not found');
    return {success: true, phoneNumber: value};
  }

  async me(actor: {sub: string; role: string}) {
    const provider = ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role);
    const user = provider ? await this.usersRepository.findOneBy({id: actor.sub}) : await this.usersRepository.manager.getRepository(CustUser).findOneBy({id: actor.sub});
    if (!user) throw new NotFoundException('Account not found');
    const profile = provider ? await this.mechanicRepository.findOneBy({user: {id: actor.sub}}) : null;
    const stats = provider ? await this.getDailyStats(actor.sub) : null;
    return {id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, role: user.role,
      kycStatus: profile?.kycStatus === KycStatus.APPROVED && !profile.kycDocumentsVerified ? KycStatus.PENDING : profile?.kycStatus ?? KycStatus.PENDING,
      earnedBadges: stats?.earnedBadges ?? []};
  }

  async toggleOnlineStatus(mechanicId: string, isOnline: boolean, lat?: number, lng?: number) {
    const profile = await this.mechanicRepository.findOne({ where: { user: { id: mechanicId } }, relations: {user: true} });
    if (!profile) {
      throw new NotFoundException('Mechanic profile not found');
    }
    if (isOnline) requireProviderEligibility(profile, profile.user.phoneNumber);
    
    profile.isOnline = isOnline;
    profile.lastSeenAt = isOnline ? new Date() : null;
    
    if (isOnline && lat !== undefined && lng !== undefined) {
      profile.currentLocation = {
        type: 'Point',
        coordinates: [lng, lat],
      } as any;
    }
    
    await this.mechanicRepository.update(profile.id, {
      isOnline, lastSeenAt: profile.lastSeenAt,
      ...(isOnline ? {currentLocation: profile.currentLocation} : {}),
    });
    
    return { success: true, message: `Mechanic ${mechanicId} online status set to ${isOnline}` };
  }

  async updateServicesProvided(mechanicId: string, serviceIds: string[]) {
    return this.updateConfig(mechanicId, {services: serviceIds});
  }

  async updateConfig(mechanicId: string, data: { 
    services?: string[], 
    vehicles?: string[],
    pricing?: { serviceId: string, vehicleId: string, price: number }[]
  }) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BadRequestException('A configuration object is required');
    for (const ids of [data?.services, data?.vehicles]) {
      if (ids !== undefined && (!Array.isArray(ids) || ids.length > 200 || !ids.every(id => typeof id === 'string' && isUUID(id)) || new Set(ids).size !== ids.length)) {
        throw new BadRequestException('Unique valid service and vehicle IDs are required');
      }
    }
    if (data?.pricing !== undefined) {
      if (!Array.isArray(data.pricing) || data.pricing.length > 1000) throw new BadRequestException('Invalid pricing list');
      const keys = new Set<string>();
      for (const p of data.pricing) {
        if (!p || !isUUID(p.serviceId) || !isUUID(p.vehicleId)) throw new BadRequestException('Invalid pricing IDs');
        minorUnits(p.price);
        const key = p.serviceId + ':' + p.vehicleId;
        if (keys.has(key)) throw new BadRequestException('Duplicate service/vehicle price');
        keys.add(key);
      }
    }
    return this.mechanicRepository.manager.transaction(async m => {
      // One provider's configuration is replaced atomically, including prices.
      const profiles = m.getRepository(MechanicProfile);
      const profile = await profiles.createQueryBuilder('p').where('p."userId" = :mechanicId', {mechanicId}).setLock('pessimistic_write').getOne();
      if (!profile) throw new NotFoundException('Mechanic profile not found');
      if (data.services !== undefined) {
        const selected = await m.getRepository(ServiceType).findBy({id: In(data.services), isActive: true});
        if (selected.length !== data.services.length) throw new BadRequestException('Unknown or inactive service');
        profile.providedServices = selected;
      }
      if (data.vehicles !== undefined) {
        const selected = await m.getRepository(VehicleCategory).findBy({id: In(data.vehicles), isActive: true});
        if (selected.length !== data.vehicles.length) throw new BadRequestException('Unknown or inactive vehicle');
        if (selected.some(v => v.isPremiumTier) && !profile.hasPremiumSubscription) throw new HttpException('Premium Subscription Required to service Luxury/Premium vehicles.', HttpStatus.FORBIDDEN);
        profile.supportedVehicles = selected;
      }
      await profiles.save(profile);
      if (data.pricing !== undefined) {
        const selected = await profiles.findOneOrFail({where:{id:profile.id},relations:{providedServices:true,supportedVehicles:true}});
        for (const price of data.pricing) {
          if (!selected.providedServices.some(s => s.id === price.serviceId) || !selected.supportedVehicles.some(v => v.id === price.vehicleId)) throw new BadRequestException('Prices must refer to selected services and vehicles');
        }
        const prices = m.getRepository(MechanicPricing);
        await prices.delete({mechanicProfile:{id:profile.id}});
        if (data.pricing.length) await prices.save(data.pricing.map(p => prices.create({mechanicProfile:{id:profile.id},serviceType:{id:p.serviceId},vehicleCategory:{id:p.vehicleId},price:p.price})));
      }
      return {success:true};
    });
  }

  async getConfig(mechanicId: string) {
    const profile = await this.mechanicRepository.findOne({ 
      where: { user: { id: mechanicId } },
      relations: { providedServices: true, supportedVehicles: true }
    });

    if (!profile) {
      throw new NotFoundException('Mechanic profile not found');
    }

    const pricing = await this.pricingRepository.find({
      where: { mechanicProfile: { id: profile.id } },
      relations: { serviceType: true, vehicleCategory: true }
    });

    return {
      services: profile.providedServices.map(s => s.id),
      vehicles: profile.supportedVehicles.map(v => v.id),
      pricing: pricing.map(p => ({
        serviceId: p.serviceType.id,
        vehicleId: p.vehicleCategory.id,
        price: p.price
      }))
    };
  }

  async getDailyStats(mechanicId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Fetch the profile to get lifetime completed jobs count
    const profile = await this.mechanicRepository.findOne({ where: { user: { id: mechanicId } } });
    const totalCompletedJobs = profile?.completedJobsCount || 0;

    // 1. Requests Received (Assigned to this mechanic today)
    const requestsReceived = await this.serviceRequestRepository.count({
      where: {
        mechanic: { id: mechanicId },
        createdAt: MoreThanOrEqual(today),
      }
    });

    // 2. Requests Accepted/Completed (Status is not REQUESTED or CANCELLED)
    const requestsAccepted = await this.serviceRequestRepository
      .createQueryBuilder('sr')
      .where('sr.mechanicId = :mechanicId', { mechanicId })
      .andWhere('sr.createdAt >= :today', { today })
      .andWhere('sr.status NOT IN (:...excludedStatuses)', { excludedStatuses: [JobStatus.REQUESTED, JobStatus.CANCELLED] })
      .getCount();

    const earningsResult = await this.mechanicRepository.manager.getRepository(PaymentLedger).createQueryBuilder('entry')
      .leftJoin('entry.toAccount', 'account').select('COALESCE(SUM(entry."amountMinor"), 0)', 'total')
      .where('account.key = :key AND entry.kind = :kind AND entry."createdAt" >= :today', {key: 'provider:' + mechanicId, kind: 'PROVIDER_CREDIT', today}).getRawOne();
    const earnings = Number(earningsResult.total) / 100;

    const reviewStats = await this.serviceRequestRepository.createQueryBuilder('job')
      .select('COUNT(job."customerRating")', 'count').addSelect('COALESCE(AVG(job."customerRating"), 0)', 'average')
      .where('job."mechanicId" = :mechanicId AND job.status = :status', {mechanicId, status: JobStatus.COMPLETED}).getRawOne();

    return {
      earnedBadges: performanceBadges(totalCompletedJobs, Number(reviewStats.count), Number(reviewStats.average)),
      reviewCount: Number(reviewStats.count),
      averageRating: Number(reviewStats.average),
      isOnline: !!(profile?.isOnline && profile.lastSeenAt && profile.lastSeenAt.getTime() > Date.now() - 90000),
      requestsReceived,
      requestsAccepted,
      earnings,
      totalCompletedJobs,
      hasPremiumSubscription: profile?.hasPremiumSubscription || false,
      walletBalance: profile?.walletBalance ? Number(profile.walletBalance) : 0,
    };
  }
  async pendingRequests(mechanicId: string) {
    const jobs = await this.serviceRequestRepository.find({
      where: {mechanic: {id: mechanicId}, status: JobStatus.REQUESTED, createdAt: MoreThanOrEqual(new Date(Date.now() - 10 * 60000))},
      relations: {customer: true}, order: {createdAt: 'ASC'}, take: 20,
    });
    return jobs.map(job => ({jobId: job.id, serviceType: job.serviceType, customerId: job.customer.id,
      customerPhone: job.customer.phoneNumber, customerLng: (job.breakdownLocation as any).coordinates[0], customerLat: (job.breakdownLocation as any).coordinates[1]}));
  }
}
