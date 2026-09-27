import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Private identity material. Binary columns are excluded from ordinary reads.
@Entity('provider_kyc_submissions')
export class ProviderKycSubmission {
  @PrimaryColumn('uuid') providerId: string;
  @Column({length: 32}) idType: string;
  @Column({length: 500}) address: string;
  @Column({length: 16}) secondaryPhone: string;
  @Column({type: 'bytea', select: false}) frontImage: Buffer;
  @Column({type: 'bytea', select: false}) backImage: Buffer;
  @Column({length: 16}) frontMime: string;
  @Column({length: 16}) backMime: string;
  @CreateDateColumn({type: 'timestamptz'}) submittedAt: Date;
  @Column({type: 'timestamptz', nullable: true}) reviewedAt: Date | null;
  @Column({type: 'uuid', nullable: true}) reviewedById: string | null;
}
