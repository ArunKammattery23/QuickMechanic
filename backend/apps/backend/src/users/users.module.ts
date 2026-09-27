import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdmUser } from '@app/common/entities/adm-user.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { CustUser } from '@app/common/entities/cust-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { MechanicPricing } from '@app/common/entities/mechanic-pricing.entity';
import { ServiceRequest } from '@app/common/entities/service-request.entity';
import { Invoice } from '@app/common/entities/invoice.entity';
import { VehicleCategory } from '@app/common/entities/vehicle-category.entity';
import { ProviderKycSubmission } from '@app/common/entities/provider-kyc-submission.entity';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AdmUser,
      ProviderUser,
      CustUser,
      MechanicProfile,
      MechanicPricing,
      ServiceRequest,
      Invoice,
      VehicleCategory,
      ProviderKycSubmission,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
