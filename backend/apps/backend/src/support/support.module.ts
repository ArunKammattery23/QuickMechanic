import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket, SupportMessage } from '@app/common/entities/support-ticket.entity';
import { ServiceRequest } from '@app/common/entities/service-request.entity';
import { AdmUser } from '@app/common/entities/adm-user.entity';
import { AuthModule } from '../auth/auth.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([SupportTicket, SupportMessage, ServiceRequest, AdmUser])],
  controllers: [SupportController], providers: [SupportService],
})
export class SupportModule {}
