import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ServiceTier {
  TWO_WHEELER = 'TWO_WHEELER',
  FOUR_WHEELER = 'FOUR_WHEELER',
  HEAVY_TRUCK = 'HEAVY_TRUCK',
}

@Entity('mechanic_profiles')
export class MechanicProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  kycStatus: KycStatus;

  @Column({
    type: 'enum',
    enum: ServiceTier,
    default: ServiceTier.FOUR_WHEELER,
  })
  serviceTier: ServiceTier;

  @Column({ default: false })
  isOnline: boolean;

  // PostGIS requires 'geometry' type for geospatial data. 
  // We'll use spatial constraints for querying later.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: string;
}
