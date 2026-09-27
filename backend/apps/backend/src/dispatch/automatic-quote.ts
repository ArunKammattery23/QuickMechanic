import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import axios from 'axios';
import { ServiceRequest, JobStatus } from '@app/common/entities/service-request.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { requireProviderEligibility } from '../users/provider-eligibility';
import { MechanicPricing } from '@app/common/entities/mechanic-pricing.entity';
import { JobPaymentsService } from './job-payments.service';
import { LocationGateway } from '../location/location.gateway';
import { calculateQuote, currentPolicy, ensurePaymentEnvironment, travelCharge } from './pricing';
import { minorUnits, money } from './money';

export async function savedServicePrice(m: EntityManager, providerId: string, service: string, vehicleId?: string | null) {
  const q = m.getRepository(MechanicPricing).createQueryBuilder('price')
    .innerJoinAndSelect('price.serviceType', 'service').innerJoinAndSelect('price.vehicleCategory', 'vehicle')
    .innerJoin('price.mechanicProfile', 'profile')
    .innerJoin('profile.providedServices', 'offered')
    .innerJoin('profile.supportedVehicles', 'supported')
    .where('profile."userId" = :providerId', {providerId})
    .andWhere('offered.id = service.id AND supported.id = vehicle.id')
    .andWhere('(service.name = :service OR CAST(service.id AS text) = :service)', {service})
    .andWhere('service."isActive" = true AND vehicle."isActive" = true');
  if (vehicleId) q.andWhere('CAST(vehicle.id AS text) = :vehicleId', {vehicleId});
  const prices = await q.take(2).getMany();
  if (!prices.length) throw new BadRequestException('No saved price for this service and vehicle. Update Service Config before accepting this job.');
  minorUnits(prices[0].price);
  return prices[0];
}

export class AutomaticQuoteService {
  private pending = new Map<string, Promise<any>>();
  constructor(private jobs: Repository<ServiceRequest>, private payments: JobPaymentsService, private gateway: LocationGateway) {}
  prepare(id: string, providerId: string) {
    const key=providerId+':'+id;
    if(this.pending.has(key))return this.pending.get(key)!;
    const request=this.prepareOnce(id,providerId).finally(()=>this.pending.delete(key));
    this.pending.set(key,request);return request;
  }
  private view(job: ServiceRequest) {
    return {jobId:job.id,serviceType:job.serviceType,vehicleCategoryId:job.vehicleCategoryId,
      distanceInKm:job.distanceInKm,routeDistanceMeters:job.routeDistanceMeters,travelingCharge:job.travelingCharge,
      serviceCharge:job.serviceCharge,quotationAmount:money(minorUnits(job.serviceCharge)+minorUnits(job.travelingCharge)),
      totalAmount:job.totalAmount,commissionBps:job.commissionBps,commission:money(job.commissionMinor),
      providerNet:money(job.providerNetMinor!),platformFee:money(job.platformFeeMinor),paymentMode:job.paymentMode,
      pricingRevision:job.pricingRevision,preparedAt:job.autoQuotePreparedAt};
  }
  private async prepareOnce(id: string, providerId: string) {
    await this.jobs.manager.transaction(ensurePaymentEnvironment);
    let job=await this.jobs.createQueryBuilder('job').where('job.id = :id AND job."mechanicId" = :providerId',{id,providerId}).getOne();
    if(!job)throw new NotFoundException('Job not found');
    if(job.autoQuotePreparedAt)return this.view(job);
    // The mobile accept and prepare calls can arrive back-to-back. Complete the
    // provider acceptance transition here when the first request is still being
    // committed, while keeping ownership and status checks server-side.
    if(job.status===JobStatus.REQUESTED){
      await this.jobs.manager.transaction(async m=>{
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [providerId]);
        const locked=await m.getRepository(ServiceRequest).createQueryBuilder('j').where('j.id = :id AND j."mechanicId" = :providerId',{id,providerId}).setLock('pessimistic_write').getOne();
        if(!locked)throw new NotFoundException('Job not found');
        if(locked.status===JobStatus.REQUESTED){
          const eligible = await m.getRepository(MechanicProfile).findOne({where:{user:{id:providerId}},relations:{user:true}});
          requireProviderEligibility(eligible, eligible?.user.phoneNumber);
          const busy = await m.getRepository(ServiceRequest).createQueryBuilder('active')
            .where('active."mechanicId" = :providerId', {providerId})
            .andWhere('active.status IN (:...states)', {states: [JobStatus.ACCEPTED, JobStatus.AWAITING_PAYMENT, JobStatus.PAYMENT_SECURED, JobStatus.EN_ROUTE, JobStatus.AWAITING_CUSTOMER_CONFIRMATION]})
            .getCount();
          if (busy) throw new BadRequestException('You already have an active job. Finish or cancel it first.');
          locked.status=JobStatus.ACCEPTED; locked.providerAcceptedAt=new Date();
          await m.getRepository(ServiceRequest).save(locked);
          await this.payments.event(m,locked,'PROVIDER_ACCEPTED',providerId,{source:'QUOTE_PREPARE_RACE_RECOVERY'});
        }
      });
      job=await this.jobs.createQueryBuilder('job').where('job.id = :id AND job."mechanicId" = :providerId',{id,providerId}).getOne();
    }
    if(!job)throw new NotFoundException('Job not found');
    if(job.status!==JobStatus.ACCEPTED)throw new BadRequestException('Job is no longer awaiting provider quotation');
    const profile=await this.jobs.manager.getRepository(MechanicProfile).createQueryBuilder('profile').where('profile."userId" = :providerId',{providerId}).getOne();
    if(!profile)throw new NotFoundException('Provider profile not found. Sign in again or complete provider setup.');
    const origin=(profile.currentLocation as any)?.coordinates;
    const destination=(job.breakdownLocation as any)?.coordinates;
    if(!profile.lastSeenAt || profile.lastSeenAt.getTime()<Date.now()-90000 || !validPoint(origin)||!validPoint(destination))throw new BadRequestException('Fresh provider GPS location is required. Keep location enabled and retry.');
    // Validate a saved price before requesting a route. Amounts never come from the client.
    await savedServicePrice(this.jobs.manager,providerId,job.serviceType,job.vehicleCategoryId);
    let distance:number;
    try {
      const base=(process.env.OSRM_BASE_URL||'https://router.project-osrm.org').replace(/\/$/,'');
      const result=await axios.get(`${base}/route/v1/driving/${origin.join(',')};${destination.join(',')}?overview=false&steps=false`,{timeout:8000});
      const raw=result.data?.routes?.[0]?.distance;
      if(result.data?.code!=='Ok'||typeof raw!=='number'||!Number.isFinite(raw)||raw<0)throw new Error('No road route');
      distance=Math.round(raw);
    }catch{throw new ServiceUnavailableException('Road distance is unavailable. Retry to calculate travel; no estimated charge has been substituted.');}
    return this.jobs.manager.transaction(async m=>{
      const locked=await m.getRepository(ServiceRequest).createQueryBuilder('j').where('j.id = :id AND j."mechanicId" = :providerId',{id,providerId}).setLock('pessimistic_write').getOneOrFail();
      if(locked.autoQuotePreparedAt)return this.view(locked);
      if(locked.status!==JobStatus.ACCEPTED)throw new BadRequestException('Job status changed. Refresh this job.');
      const price=await savedServicePrice(m,providerId,locked.serviceType,locked.vehicleCategoryId);
      const policy=await currentPolicy(m);
      const travel=travelCharge(distance,policy);
      const calculated=calculateQuote(money(minorUnits(price.price)+travel),policy.commissionBps,policy.platformFeeMinor);
      Object.assign(locked,{serviceCharge:Number(price.price),travelingCharge:Number(money(travel)),distanceInKm:Number((distance/1000).toFixed(2)),
        routeDistanceMeters:distance,vehicleCategoryId:price.vehicleCategory.id,autoQuotePreparedAt:new Date(),pricingRevision:policy.revision,
        commissionBps:calculated.commissionBps,commissionMinor:calculated.commissionMinor,platformFeeMinor:calculated.platformFeeMinor,
        providerNetMinor:calculated.providerNetMinor,totalAmount:calculated.totalAmount,paymentMode:await ensurePaymentEnvironment(m)});
      await m.getRepository(ServiceRequest).save(locked);
      await this.payments.event(m,locked,'AUTOMATIC_QUOTE_PREPARED',providerId,{routeDistanceMeters:distance,origin,destination,source:'OSRM',servicePriceId:price.id,travelMinimumMinor:policy.travelMinimumMinor,travelIncludedMeters:policy.travelIncludedMeters,travelPerKmMinor:policy.travelPerKmMinor});
      return this.view(locked);
    });
  }
  async send(id:string,providerId:string) {
    await this.prepare(id,providerId);
    const result=await this.jobs.manager.transaction(async m=>{
      const locked=await m.getRepository(ServiceRequest).createQueryBuilder('j').where('j.id = :id AND j."mechanicId" = :providerId',{id,providerId}).setLock('pessimistic_write').getOneOrFail();
      if(locked.status===JobStatus.AWAITING_PAYMENT)return {sent:false,job:locked};
      if(locked.status!==JobStatus.ACCEPTED)throw new BadRequestException('Job is no longer awaiting a quotation');
      locked.status=JobStatus.AWAITING_PAYMENT;await m.getRepository(ServiceRequest).save(locked);
      await this.payments.event(m,locked,'QUOTE_SENT',providerId,{totalAmount:locked.totalAmount,currency:'INR'});
      return {sent:true,job:locked};
    });
    if(result.sent){const job=await this.jobs.findOneOrFail({where:{id},relations:{customer:true}});this.gateway.server.to('customer_'+job.customer.id).emit('quote_received',{jobId:id,distanceInKm:job.distanceInKm,quotationAmount:money(minorUnits(job.serviceCharge)+minorUnits(job.travelingCharge)),platformFee:money(job.platformFeeMinor),totalAmount:job.totalAmount,paymentMode:job.paymentMode});}
    return {success:true,message:'Saved service price and calculated travel sent to customer.'};
  }
}

function validPoint(point:any):point is [number,number] {return Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;}
