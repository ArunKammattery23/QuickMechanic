import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

// Append-only revisions: a later change must never reprice an accepted quotation.
@Entity('pricing_policies')
export class PricingPolicy {
  @PrimaryGeneratedColumn() revision: number;
  @Column({type: 'integer'}) commissionBps: number;
  @Column({type: 'bigint'}) platformFeeMinor: string;
  @Column({type: 'bigint', default: '5000'}) travelMinimumMinor: string;
  @Column({type: 'integer', default: 2500}) travelIncludedMeters: number;
  @Column({type: 'bigint', default: '800'}) travelPerKmMinor: string;
  @Column() changedBy: string;
  @CreateDateColumn({type: 'timestamptz'}) createdAt: Date;
}

// Each database holds one financial environment. Simulated funds cannot become live funds.
@Entity('payment_environment')
export class PaymentEnvironment {
  @PrimaryColumn({type: 'integer'}) id: number;
  @Column() mode: string;
}
