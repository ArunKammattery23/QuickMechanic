import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { CustUser } from './cust-user.entity';
import { ProviderUser } from './provider-user.entity';

export enum JobStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAYMENT_SECURED = 'PAYMENT_SECURED',
  EN_ROUTE = 'EN_ROUTE',
  AWAITING_CUSTOMER_CONFIRMATION = 'AWAITING_CUSTOMER_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('service_requests')
@Index('idx_provider_status', ['mechanic', 'status'])
@Index('idx_provider_job_history', ['mechanic', 'createdAt', 'id'])
@Index('idx_customer_job_history', ['customer', 'createdAt', 'id'])
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CustUser)
  customer: CustUser;

  @ManyToOne(() => ProviderUser, { nullable: true })
  mechanic: ProviderUser;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.REQUESTED,
  })
  status: JobStatus;

  @Column()
  serviceType: string;

  @Column({type: 'uuid', nullable: true}) vehicleCategoryId: string | null;
  @Column({type: 'timestamptz', nullable: true}) autoQuotePreparedAt: Date | null;
  @Column({type: 'integer', nullable: true}) routeDistanceMeters: number | null;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  breakdownLocation: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  distanceInKm: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  travelingCharge: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  serviceCharge: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({type: 'integer', nullable: true}) pricingRevision: number | null;
  @Column({type: 'integer', default: 0}) commissionBps: number;
  @Column({type: 'bigint', default: '0'}) commissionMinor: string;
  @Column({type: 'bigint', default: '0'}) platformFeeMinor: string;
  @Column({type: 'bigint', nullable: true}) providerNetMinor: string | null;
  @Column({default: 'live'}) paymentMode: string;

  @Column({ nullable: true, length: 4 })
  completionOtp: string;

  @Column({ type: 'smallint', nullable: true })
  customerRating: number | null;

  @Column({type: 'timestamptz', nullable: true}) providerAcceptedAt: Date | null;
  @Column({type: 'timestamptz', nullable: true}) customerAcceptedAt: Date | null;
  @Column({type: 'timestamptz', nullable: true}) confirmedAt: Date | null;
  @Column({type: 'timestamptz', nullable: true}) completionRequestedAt: Date | null;
  @Column({type: 'timestamptz', nullable: true}) completedAt: Date | null;
  @Column({type: 'varchar', nullable: true}) cancellationReason: string | null;
  @Column({type: 'varchar', nullable: true}) cancelledBy: string | null;
  @Column({type: 'varchar', nullable: true}) razorpayLinkId: string | null;
  @Column({type: 'varchar', nullable: true}) checkoutUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
