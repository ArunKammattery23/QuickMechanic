import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ServiceRequest } from './service-request.entity';

@Entity('wallet_accounts')
export class WalletAccount {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({unique: true}) key: string;
  @Column({default: 'INR'}) currency: string;
  @Column({type: 'bigint', default: '0'}) balanceMinor: string;
}

// Every immutable transfer has equal debit/credit sides; amounts are integer paise.
@Entity('payment_ledger')
@Index(['fromAccount', 'createdAt', 'id'])
@Index(['toAccount', 'createdAt', 'id'])
@Index(['job', 'createdAt', 'id'])
export class PaymentLedger {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({unique: true}) reference: string;
  @ManyToOne(() => WalletAccount, {nullable: false, onDelete: 'RESTRICT'}) fromAccount: WalletAccount;
  @ManyToOne(() => WalletAccount, {nullable: false, onDelete: 'RESTRICT'}) toAccount: WalletAccount;
  @ManyToOne(() => ServiceRequest, {nullable: true, onDelete: 'RESTRICT'}) job: ServiceRequest | null;
  @Column({type: 'bigint'}) amountMinor: string;
  @Column() kind: string;
  @Column({default: 'INR'}) currency: string;
  @Column() description: string;
  @CreateDateColumn({type: 'timestamptz'}) createdAt: Date;
}

// One withdrawal may contain earnings from several jobs; preserve the allocation.
@Entity('withdrawal_allocations')
@Index(['providerId', 'job'])
export class WithdrawalAllocation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') providerId: string;
  @ManyToOne(() => PaymentLedger, {nullable: false, onDelete: 'RESTRICT'}) withdrawal: PaymentLedger;
  @ManyToOne(() => ServiceRequest, {nullable: true, onDelete: 'RESTRICT'}) job: ServiceRequest | null;
  @Column({type: 'bigint'}) amountMinor: string;
}

@Entity('job_events')
@Index(['job', 'createdAt', 'id'])
export class JobEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ServiceRequest, {nullable: false, onDelete: 'RESTRICT'}) job: ServiceRequest;
  @Column() type: string;
  @Column() actorId: string;
  @Column({type: 'jsonb', default: {}}) details: Record<string, unknown>;
  @CreateDateColumn({type: 'timestamptz'}) createdAt: Date;
}
