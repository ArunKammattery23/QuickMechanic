import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('reputation_rules')
export class ReputationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  action: string; // e.g., 'ABANDON_JOB', 'LATE_ARRIVAL'

  @Column({ type: 'varchar', length: 50, nullable: true })
  badgeTier: string; // e.g., 'Bronze', 'Silver', 'Gold'. Nullable if applies to all.

  @Column({ type: 'int' })
  pointDeduction: number; // e.g., -50 (Negative value means deduction)

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
