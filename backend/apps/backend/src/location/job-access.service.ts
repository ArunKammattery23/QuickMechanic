import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import {
  JobStatus,
  ServiceRequest,
} from '@app/common/entities/service-request.entity';
const ACTIVE_JOBS = [
  JobStatus.REQUESTED,
  JobStatus.ACCEPTED,
  JobStatus.AWAITING_PAYMENT,
  JobStatus.PAYMENT_SECURED,
  JobStatus.EN_ROUTE,
  JobStatus.AWAITING_CUSTOMER_CONFIRMATION,
];
@Injectable()
export class JobAccessService {
  constructor(
    @InjectRepository(ServiceRequest)
    private readonly jobs: Repository<ServiceRequest>,
  ) {}
  async canContact(
    user: { sub: string; role: string },
    targetId: string,
  ): Promise<boolean> {
    if (!targetId || targetId === user.sub) return false;
    const customer = user.role === 'CUSTOMER';
    if (!customer && !['MECHANIC', 'FLEET_DRIVER'].includes(user.role))
      return false;
    return this.jobs.existsBy({
      customer: { id: customer ? user.sub : targetId },
      mechanic: { id: customer ? targetId : user.sub },
      status: In(ACTIVE_JOBS),
    });
  }
  async trackingCustomers(mechanicId: string): Promise<string[]> {
    const jobs = await this.jobs.find({
      where: { mechanic: { id: mechanicId }, status: In(ACTIVE_JOBS) },
      relations: { customer: true },
    });
    return [...new Set(jobs.map((job) => job.customer.id))];
  }
  async updatePresence(mechanicId: string, lat: number, lng: number) {
    await this.jobs.manager.getRepository(MechanicProfile).update(
      {user: {id: mechanicId}, isOnline: true},
      {lastSeenAt: new Date(), currentLocation: {type: 'Point', coordinates: [lng, lat]} as any},
    );
  }
}
