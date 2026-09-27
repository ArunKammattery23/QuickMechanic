import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { MechanicProfile } from './mechanic-profile.entity';
import { ServiceType } from './service-type.entity';
import { VehicleCategory } from './vehicle-category.entity';

@Entity('mechanic_pricing')
@Unique(['mechanicProfile', 'serviceType', 'vehicleCategory']) // Ensures a mechanic has only 1 price per service+vehicle combo
export class MechanicPricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MechanicProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mechanic_profile_id' })
  mechanicProfile: MechanicProfile;

  @ManyToOne(() => ServiceType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_type_id' })
  serviceType: ServiceType;

  @ManyToOne(() => VehicleCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_category_id' })
  vehicleCategory: VehicleCategory;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // Saved customer service quotation, before commission deduction and travel.
}
