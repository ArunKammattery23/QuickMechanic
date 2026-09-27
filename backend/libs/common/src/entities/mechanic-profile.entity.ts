import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, Index, ManyToMany, JoinTable } from 'typeorm';
import { ProviderUser } from './provider-user.entity';
import { ServiceType } from './service-type.entity';
import { VehicleCategory } from './vehicle-category.entity';
import { Badge } from './badge.entity';

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('mechanic_profiles')
export class MechanicProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ProviderUser)
  @JoinColumn()
  user: ProviderUser;

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  kycStatus: KycStatus;

  @Column({default: false})
  kycDocumentsVerified: boolean;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @ManyToMany(() => ServiceType, { cascade: true, eager: true })
  @JoinTable({
    name: 'mechanic_services', // Join table name
    joinColumn: { name: 'mechanic_profile_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'service_type_id', referencedColumnName: 'id' },
  })
  providedServices: ServiceType[];

  @ManyToMany(() => VehicleCategory, { cascade: true, eager: true })
  @JoinTable({
    name: 'mechanic_vehicles', // Join table name
    joinColumn: { name: 'mechanic_profile_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'vehicle_category_id', referencedColumnName: 'id' },
  })
  supportedVehicles: VehicleCategory[];

  @Column({ type: 'int', default: 100 })
  reputationPoints: number;

  @Column({ type: 'int', default: 0 })
  completedJobsCount: number;

  @Column({ default: false })
  hasPremiumSubscription: boolean; // True if the mechanic has paid for premium access

  @Column({ type: 'int', default: 0 })
  fiveStarReviewsCount: number;

  @ManyToMany(() => Badge)
  @JoinTable()
  earnedBadges: Badge[];

  // PostGIS requires 'geometry' type for geospatial data. 
  // We'll use spatial constraints for querying later.
  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  walletBalance: number;

  @Column({ nullable: true })
  lastWithdrawalDate: Date;

  // Virtual properties for distance calculation
  distanceText?: string;
  distanceValue?: number;
}
