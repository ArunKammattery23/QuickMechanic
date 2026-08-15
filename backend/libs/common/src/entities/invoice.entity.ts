import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { ServiceRequest } from './service-request.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ServiceRequest)
  @JoinColumn()
  serviceRequest: ServiceRequest;

  @Column('decimal', { precision: 10, scale: 2 })
  baseFee: number;

  @Column('decimal', { precision: 10, scale: 2 })
  distanceCharge: number;

  @Column('decimal', { precision: 10, scale: 2 })
  platformCommission: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;
}
