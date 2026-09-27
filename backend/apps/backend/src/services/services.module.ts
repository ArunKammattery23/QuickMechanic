import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceType } from '@app/common/entities/service-type.entity';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceType])],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
