import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CustUserRole {
  CUSTOMER = 'CUSTOMER',
}

@Entity('CUST_USER')
export class CustUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Unknown' })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: CustUserRole,
    default: CustUserRole.CUSTOMER,
  })
  role: CustUserRole;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  resetToken: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiry: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
