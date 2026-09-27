import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MechanicProfile } from './mechanic-profile.entity';

@Entity('reputation_logs')
export class ReputationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  mechanicId: string;

  @ManyToOne(() => MechanicProfile)
  @JoinColumn({ name: 'mechanicId' })
  mechanic: MechanicProfile;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'int' })
  pointsChanged: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
