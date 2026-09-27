import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum BadgeCriteriaType {
  COMPLETED_JOBS = 'COMPLETED_JOBS',
  FIVE_STAR_REVIEWS = 'FIVE_STAR_REVIEWS',
  YEARS_ACTIVE = 'YEARS_ACTIVE',
  VERIFIED_KYC = 'VERIFIED_KYC',
}

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  icon: string; // e.g., 'BronzeWrench', 'PlatinumStar'

  @Column({
    type: 'enum',
    enum: BadgeCriteriaType,
  })
  criteriaType: BadgeCriteriaType;

  @Column({ type: 'int' })
  criteriaValue: number;

  @CreateDateColumn()
  createdAt: Date;
}
