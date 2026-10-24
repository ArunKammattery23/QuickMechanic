import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AdmUserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  CEO = 'CEO',
  DEVELOPER = 'DEVELOPER'
}

@Entity('ADM_USER')
export class AdmUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Unknown' })
  name: string;

  @Column({ unique: true })
  email: string;

  // Optional short sign-in name (e.g. test accounts). Unique per table; NULLs allowed.
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  username: string | null;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: AdmUserRole,
    default: AdmUserRole.MANAGER,
  })
  role: AdmUserRole;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phoneNumber: string | null;

  @Column({ nullable: true })
  resetToken: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiry: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
