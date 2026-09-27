import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProviderUser } from './provider-user.entity';
import { ServiceRequest } from './service-request.entity';

export enum WalletStatus {
  ESCROW = 'ESCROW',
  AVAILABLE = 'AVAILABLE',
  WITHDRAWN = 'WITHDRAWN',
  CANCELLED = 'CANCELLED'
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProviderUser, { onDelete: 'CASCADE' })
  mechanic: ProviderUser;

  @ManyToOne(() => ServiceRequest, { nullable: true, onDelete: 'SET NULL' })
  serviceRequest: ServiceRequest;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ESCROW,
  })
  status: WalletStatus;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
