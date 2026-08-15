import { Module } from '@nestjs/common';
import { LocationServiceController } from './location-service.controller';
import { LocationServiceService } from './location-service.service';

@Module({
  imports: [],
  controllers: [LocationServiceController],
  providers: [LocationServiceService],
})
export class LocationServiceModule {}
