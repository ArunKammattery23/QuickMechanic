import { JobPaymentsService } from './job-payments.service';
import { AutomaticQuoteService, savedServicePrice } from './automatic-quote';
import { MechanicPricing } from '@app/common/entities/mechanic-pricing.entity';
import { calculateQuote, currentPolicy, ensurePaymentEnvironment } from './pricing';
import { money } from './money';
import { performanceBadges } from '../users/performance';
import { requireProviderEligibility } from '../users/provider-eligibility';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import {
  ServiceRequest,
  JobStatus,
} from '@app/common/entities/service-request.entity';
import {
  WalletTransaction,
  WalletStatus,
} from '@app/common/entities/wallet-transaction.entity';
import { LocationGateway } from '../location/location.gateway';
import { CustUser } from '@app/common/entities/cust-user.entity';

@Injectable()
export class DispatchService {
  readonly payments: JobPaymentsService;
  readonly autoQuotes: AutomaticQuoteService;
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectRepository(MechanicProfile)
    private readonly mechanicRepo: Repository<MechanicProfile>,
    @InjectRepository(ServiceRequest)
    private readonly serviceRequestRepo: Repository<ServiceRequest>,
    @InjectRepository(WalletTransaction)
    private readonly walletRepo: Repository<WalletTransaction>,
    private readonly locationGateway: LocationGateway,
  ) { this.payments = new JobPaymentsService(serviceRequestRepo, locationGateway); this.autoQuotes = new AutomaticQuoteService(serviceRequestRepo, this.payments, locationGateway); }

  // Implements the formula: Base Service Fee + (Total Distance (km) * Rate)
  calculateInvoice(
    baseFee: number,
    distanceInKm: number,
    ratePerKm: number,
    isSurge: boolean,
  ): number {
    let total = baseFee + distanceInKm * ratePerKm;

    if (isSurge) {
      total = total * 1.5; // 1.5x Surge Pricing
    }

    return total;
  }

  async findMechanicsWithDistance(
    lat: number,
    lng: number,
    radiusInKm: number = 20,
    serviceType?: string,
    vehicleCategoryId?: string,
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new BadRequestException('Valid coordinates required');
    const radiusInMeters = radiusInKm * 1000;

    const { entities, raw } = await this.mechanicRepo
      .createQueryBuilder('mechanic')
      .leftJoinAndSelect('mechanic.user', 'user')
      .addSelect(
        `ST_Distance(mechanic."currentLocation"::geography, ST_MakePoint(:lng, :lat)::geography)`,
        'distance',
      )
      .where('mechanic.isOnline = :isOnline', { isOnline: true })
      .andWhere('mechanic."kycStatus" = :approvedKyc', {approvedKyc: 'APPROVED'})
      .andWhere('"user"."phoneNumber" ~ :mobilePattern', {mobilePattern: '^\\+?[1-9][0-9]{9,14}$'})
      .andWhere('mechanic."lastSeenAt" > :fresh', {fresh: new Date(Date.now() - 90000)})
      .andWhere(q => serviceType ? 'EXISTS ' + q.subQuery().select('1').from(MechanicProfile, 'p').innerJoin('p.providedServices', 'provided').where('p.id = mechanic.id AND (provided.name = :serviceType OR CAST(provided.id AS text) = :serviceType)').getQuery() : '1=1', {serviceType})
      .andWhere(q => vehicleCategoryId ? 'EXISTS ' + q.subQuery().select('1').from(MechanicPricing, 'price').innerJoin('price.serviceType','ps').innerJoin('price.vehicleCategory','pv').innerJoin('price.mechanicProfile','pricedProfile').innerJoin('pricedProfile.supportedVehicles','supported').where('price.mechanic_profile_id = mechanic.id AND supported.id = pv.id AND CAST(pv.id AS text) = :vehicleCategoryId AND (ps.name = :serviceType OR CAST(ps.id AS text) = :serviceType) AND ps."isActive" = true AND pv."isActive" = true').getQuery() : '1=1', {vehicleCategoryId,serviceType})
      .andWhere(
        'ST_DWithin(mechanic."currentLocation"::geography, ST_MakePoint(:lng, :lat)::geography, :radius)',
        { lng, lat, radius: radiusInMeters },
      )
      .orderBy(
        'ST_Distance(mechanic."currentLocation"::geography, ST_MakePoint(:lng, :lat)::geography)',
        'ASC',
      )
      .addSelect(q => q.select('AVG(review."customerRating")').from(ServiceRequest, 'review').where('review."mechanicId" = "user".id AND review.status = :completed', {completed: JobStatus.COMPLETED}), 'rating')
      .addSelect(q => q.select('COUNT(review."customerRating")').from(ServiceRequest, 'review').where('review."mechanicId" = "user".id AND review.status = :completed', {completed: JobStatus.COMPLETED}), 'reviewCount')
      .limit(50)
      .getRawAndEntities();

    return entities.map((entity, index) => {
      const distanceInMeters = parseFloat(raw[index].distance);
      const distanceInKm = (distanceInMeters / 1000).toFixed(1);
      (entity as any).distanceText = `${distanceInKm} km`;
      (entity as any).distanceValue = distanceInMeters;
      const rating = raw[index].rating == null ? null : Number(raw[index].rating);
      return {id: entity.id, user: {id: entity.user.id, name: entity.user.name, phoneNumber: entity.user.phoneNumber},
        currentLocation: entity.currentLocation, distanceText: entity.distanceText, distanceValue: entity.distanceValue,
        rating, reviewCount: Number(raw[index].reviewCount), completedJobsCount: entity.completedJobsCount,
        earnedBadges: performanceBadges(entity.completedJobsCount, Number(raw[index].reviewCount), rating ?? 0)};
    });
  }

  async createServiceRequest(
    customerId: string,
    serviceType: string,
    lat: number,
    lng: number,
    mechanicId: string,
    vehicleCategoryId?: string,
  ) {
    const assignedMechanic = await this.mechanicRepo.findOne({
      where: { user: { id: mechanicId } },
      relations: { user: true },
    });

    if (!assignedMechanic || !assignedMechanic.isOnline || !assignedMechanic.lastSeenAt || assignedMechanic.lastSeenAt.getTime() < Date.now() - 90000) {
      return {
        success: false,
        message: 'Selected mechanic is no longer available.',
      };
    }
    requireProviderEligibility(assignedMechanic, assignedMechanic.user.phoneNumber);

    if (!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) throw new BadRequestException('Valid breakdown location required');
    const request = this.serviceRequestRepo.create({
      customer: { id: customerId },
      mechanic: { id: assignedMechanic.user.id }, // Assign closest
      serviceType,
      vehicleCategoryId: vehicleCategoryId ?? null,
      status: JobStatus.REQUESTED,
      breakdownLocation: {
        type: 'Point',
        coordinates: [lng, lat],
      } as any,
    });

    await this.serviceRequestRepo.manager.transaction(async manager => {
      await manager.getRepository(ServiceRequest).save(request);
      await this.payments.event(manager, request, 'REQUESTED', customerId, {serviceType});
    });

    // Fetch customer to get phone number
    const customer = await this.serviceRequestRepo.manager.findOne(CustUser, {
      where: { id: customerId },
    });

    // Emit live socket event to the mechanic
    this.locationGateway.server
      .to(`tracking_${assignedMechanic.user.id}`)
      .emit('new_job_request', {
        jobId: request.id,
        serviceType,
        customerLat: lat,
        customerLng: lng,
        customerId: customerId,
        customerPhone: customer?.phoneNumber ?? 'Unknown',
      });

    return {
      success: true,
      message: 'Breakdown request submitted successfully.',
      assignedMechanic: {id: assignedMechanic.id, user: {id: assignedMechanic.user.id, name: assignedMechanic.user.name}},
      jobId: request.id,
    };
  }

  async acceptJob(jobId: string, mechanicId: string) {
    const job = await this.serviceRequestRepo.manager.transaction(async manager => {
      // Serialize acceptance per provider across every API replica, without locking other providers.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [mechanicId]);
      const jobs = manager.getRepository(ServiceRequest);
      const candidate = await jobs.createQueryBuilder('job')
        .where('job.id = :jobId AND job."mechanicId" = :mechanicId', {jobId, mechanicId})
        .setLock('pessimistic_write').getOne();
      if (!candidate || candidate.status !== JobStatus.REQUESTED) return null;
      const profile = await manager.getRepository(MechanicProfile).findOne({where: {user: {id: mechanicId}}, relations: {user: true}});
      requireProviderEligibility(profile, profile?.user.phoneNumber);
      const busy = await jobs.createQueryBuilder('job')
        .where('job."mechanicId" = :mechanicId', {mechanicId})
        .andWhere('job.status IN (:...states)', {states: [JobStatus.ACCEPTED, JobStatus.AWAITING_PAYMENT, JobStatus.PAYMENT_SECURED, JobStatus.EN_ROUTE, JobStatus.AWAITING_CUSTOMER_CONFIRMATION]})
        .getCount();
      if (busy) return null;
      await jobs.update(candidate.id, {status: JobStatus.ACCEPTED, providerAcceptedAt: new Date()});
      await this.payments.event(manager, candidate, 'PROVIDER_ACCEPTED', mechanicId);
      return jobs.findOne({where: {id: candidate.id}, relations: {customer: true, mechanic: true}});
    });
    if (!job) {
      const active = await this.activeJob(mechanicId);
      return {success: false, activeJobId: active.job?.id,
        message: active.job ? 'You already have an active job. Open it to continue or cancel it before accepting another request.' : 'This request is no longer available.'};
    }

    // Emit live socket event to the customer
    this.locationGateway.server
      .to(`customer_${job.customer.id}`)
      .emit('job_accepted', {
        jobId: job.id,
        mechanicId: mechanicId,
        mechanicPhone: job.mechanic.phoneNumber ?? 'Unknown',
      });

    return { success: true, message: 'Job accepted successfully.' };
  }

  async activeJob(mechanicId: string) {
    const job = await this.serviceRequestRepo.createQueryBuilder('job')
      .select(['job.id', 'job.status', 'job.serviceType'])
      .where('job."mechanicId" = :mechanicId', {mechanicId})
      .andWhere('job.status IN (:...states)', {states: [JobStatus.ACCEPTED, JobStatus.AWAITING_PAYMENT, JobStatus.PAYMENT_SECURED, JobStatus.EN_ROUTE, JobStatus.AWAITING_CUSTOMER_CONFIRMATION]})
      .orderBy('job."createdAt"', 'ASC').getOne();
    return {job: job || null};
  }

  async customerActiveJob(customerId: string) {
    const job = await this.serviceRequestRepo.createQueryBuilder('job')
      .leftJoinAndSelect('job.mechanic', 'mechanic')
      .where('job."customerId" = :customerId', {customerId})
      .andWhere('job.status NOT IN (:...closed)', {closed: [JobStatus.COMPLETED, JobStatus.CANCELLED]})
      .orderBy('job."createdAt"', 'DESC').getOne();
    if (!job) return {job: null};
    return {job: {id: job.id, status: job.status, mechanicId: job.mechanic?.id,
      mechanicPhone: job.mechanic?.phoneNumber, breakdownLocation: job.breakdownLocation}};
  }

  // Only the timezone-aware acceptance timestamp defines the quotation deadline.
  @Cron(CronExpression.EVERY_MINUTE)
  async handleSlaTimeouts() {
    const threshold = new Date(Date.now() - 10 * 60000);
    await this.serviceRequestRepo.manager.transaction(async manager => {
      const jobs = await manager.getRepository(ServiceRequest).createQueryBuilder('job')
        .where('status = :status AND "providerAcceptedAt" < :threshold', {status: JobStatus.ACCEPTED, threshold})
        .take(100).setLock('pessimistic_write').setOnLocked('skip_locked').getMany();
      for (const job of jobs) {
        await manager.getRepository(ServiceRequest).update(job.id, {status: JobStatus.CANCELLED, cancelledBy: 'SYSTEM', cancellationReason: 'Provider did not submit a quote within 10 minutes'});
        await this.payments.event(manager, job, 'EXPIRED', 'SYSTEM', {reason: 'Quote timeout; no payment captured'});
      }
    });
  }

  async sendQuote(
    jobId: string,
    mechanicId: string,
    distance: number,
    travelingCharge: number,
    serviceCharge: number,
    totalAmount: number,
    pricingRevision?: number,
  ) {
    if (
      ![distance, travelingCharge, serviceCharge, totalAmount].every(
        (value) => Number.isFinite(value) && value >= 0,
      ) ||
      Math.abs(totalAmount - travelingCharge - serviceCharge) > 0.01
    ) {
      throw new BadRequestException(
        'Quote must contain non-negative amounts and a matching total',
      );
    }
    const job = await this.serviceRequestRepo.findOne({
      where: { id: jobId, mechanic: { id: mechanicId } },
      relations: { customer: true },
    });

    if (!job || job.status !== JobStatus.ACCEPTED) {
      return { success: false, message: 'Job not found or invalid status.' };
    }

    const changed = await this.serviceRequestRepo.manager.transaction(async manager => {
      const mode = await ensurePaymentEnvironment(manager);
      const policy = await currentPolicy(manager);
      if (pricingRevision !== undefined && policy.revision !== pricingRevision) throw new BadRequestException('Pricing changed. Refresh commission and review the total before sending.');
      const price = calculateQuote(totalAmount, policy.commissionBps, policy.platformFeeMinor);
      const changed = await manager.getRepository(ServiceRequest).update({id: jobId, status: JobStatus.ACCEPTED}, {
        distanceInKm: distance, travelingCharge, serviceCharge, totalAmount: price.totalAmount,
        commissionBps: price.commissionBps, commissionMinor: price.commissionMinor,
        platformFeeMinor: price.platformFeeMinor, providerNetMinor: price.providerNetMinor,
        pricingRevision: policy.revision, paymentMode: mode, status: JobStatus.AWAITING_PAYMENT,
      });
      if (changed.affected) await this.payments.event(manager, job, 'QUOTE_SENT', mechanicId, {totalAmount: price.totalAmount, currency: 'INR', paymentMode: mode});
      return {...changed, price, mode};
    });
    if (!changed.affected) return {success: false, message: 'Job status changed. Refresh and try again.'};

    // Notify customer
    this.locationGateway.server
      .to(`customer_${job.customer.id}`)
      .emit('quote_received', {
        jobId: job.id,
        distanceInKm: distance,
        quotationAmount: changed.price.quotationAmount,
        platformFee: money(changed.price.platformFeeMinor),
        totalAmount: changed.price.totalAmount,
        paymentMode: changed.mode,
      });

    return { success: true, message: 'Quote sent successfully.' };
  }

  async mockPay(jobId: string, customerId: string) { return this.payments.pay(jobId, customerId, true); }
  async completeJob(jobId: string, mechanicId: string, otp?: string) { return this.payments.requestCompletion(jobId, mechanicId); }
  async withdrawFunds(mechanicId: string, requestId: string = require('crypto').randomUUID()) { return this.payments.withdraw(mechanicId, requestId); }
  async cancelJob(jobId: string, actorId: string, role = 'MECHANIC', reason = 'Cancelled by provider') { return this.payments.cancel(jobId, {sub: actorId, role}, reason); }

  async rateJob(jobId: string, rating: number, customerId: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new BadRequestException('Rating must be between 1 and 5');
    return this.serviceRequestRepo.manager.transaction(async manager => {
      const jobs = manager.getRepository(ServiceRequest);
      await jobs.createQueryBuilder('job').where('job.id = :jobId', {jobId}).setLock('pessimistic_write').getOne();
      const job = await jobs.findOne({where: {id: jobId, customer: {id: customerId}}, relations: {mechanic: true}});
      if (!job) throw new NotFoundException('Job not found');
      if (job.status !== JobStatus.COMPLETED) throw new BadRequestException('Can only rate completed jobs');
      if (job.customerRating != null) return {success: false, message: 'This job has already been reviewed.'};
      const profiles = manager.getRepository(MechanicProfile);
      const profile = await profiles.createQueryBuilder('profile').where('profile."userId" = :id', {id: job.mechanic.id}).setLock('pessimistic_write').getOne();
      if (!profile) throw new NotFoundException('Mechanic profile not found');
      const pointsEarned = (rating - 3) * 5;
      profile.reputationPoints = Math.max(0, profile.reputationPoints + pointsEarned);
      if (rating === 5) profile.fiveStarReviewsCount += 1;
      await profiles.save(profile);
      await jobs.update(jobId, {customerRating: rating});
      await this.payments.event(manager, job, 'CUSTOMER_REVIEWED', customerId, {rating});
      return {success: true, message: 'Rating submitted successfully', pointsEarned};
    });
  }
}
