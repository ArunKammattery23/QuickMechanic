import { Module } from '@nestjs/common';
import { DispatchServiceController } from './dispatch-service.controller';
import { DispatchServiceService } from './dispatch-service.service';

@Module({
  imports: [],
  controllers: [DispatchServiceController],
  providers: [DispatchServiceService],
})
export class DispatchServiceModule {}
