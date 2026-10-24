import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ProviderUserRole {
  MECHANIC = 'MECHANIC',
  FLEET_DRIVER = 'FLEET_DRIVER',
}

@Entity('PROVIDER_USER')
export class ProviderUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Unknown' })
  name: string;

  @Column({ unique: true })
  email: string;

  @Index('UQ_PROVIDER_USER_googleSubject', { unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  googleSubject: string | null;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: ProviderUserRole,
    default: ProviderUserRole.MECHANIC,
  })
  role: ProviderUserRole;

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
