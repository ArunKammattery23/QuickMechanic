import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway';
import { AuthModule } from '../auth/auth.module';
import { LocationController } from './location.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequest } from '@app/common/entities/service-request.entity';
import { JobAccessService } from './job-access.service';
import { CallConfigController } from './call-config.controller';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ServiceRequest])],
  controllers: [LocationController, CallConfigController],
  providers: [LocationGateway, JobAccessService],
  exports: [LocationGateway, JobAccessService],
})
export class LocationModule {}
