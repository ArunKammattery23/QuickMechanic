import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchService } from './dispatch.service';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { ServiceRequest } from '@app/common/entities/service-request.entity';
import { WalletTransaction } from '@app/common/entities/wallet-transaction.entity';
import { DispatchController } from './dispatch.controller';
import { LocationModule } from '../location/location.module';
import { CallGateway } from './call.gateway';
import { AuthModule } from '../auth/auth.module';
import { RazorpayController } from './razorpay.controller';
import { FinanceController } from './finance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MechanicProfile, ServiceRequest, WalletTransaction]),
    LocationModule,
    AuthModule
  ],
  controllers: [DispatchController, RazorpayController, FinanceController],
  providers: [DispatchService, CallGateway],
  exports: [DispatchService],
})
export class DispatchModule {}
