import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('vehicle_categories')
export class VehicleCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  group: string; // e.g., '2 Wheeler', '4 Wheeler'

  @Column()
  name: string; // e.g., 'Luxury / Premium', 'Standard Hatchback'

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isPremiumTier: boolean; // Indicates if this vehicle requires a mechanic subscription

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
