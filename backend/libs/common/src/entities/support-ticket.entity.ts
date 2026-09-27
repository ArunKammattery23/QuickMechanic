import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('support_tickets')
@Index(['requesterRole', 'requesterId', 'createdAt'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) requesterId: string;
  @Column({ type: 'varchar', length: 20 }) requesterRole: string;
  @Column({ type: 'varchar', length: 120 }) subject: string;
  @Column({ type: 'varchar', length: 32 }) category: string;
  @Column({ type: 'varchar', length: 20, default: 'OPEN' }) status: string;
  @Column({ type: 'uuid', nullable: true }) jobId: string | null;
  @Column({ type: 'uuid', nullable: true }) assignedAdminId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('support_messages')
@Index(['ticketId', 'createdAt'])
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) ticketId: string;
  @Column({ type: 'uuid' }) senderId: string;
  @Column({ type: 'varchar', length: 20 }) senderRole: string;
  @Column({ type: 'varchar', length: 4000 }) body: string;
  @CreateDateColumn() createdAt: Date;
}
