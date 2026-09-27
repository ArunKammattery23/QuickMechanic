import { WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent } from '../entities/payment-ledger.entity';
import { ProviderKycSubmission } from '../entities/provider-kyc-submission.entity';
import { SupportTicket, SupportMessage } from '../entities/support-ticket.entity';
import { Module } from '@nestjs/common';
import { PricingPolicy, PaymentEnvironment } from '../entities/pricing-policy.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AdmUser } from '../entities/adm-user.entity';
import { ProviderUser } from '../entities/provider-user.entity';
import { CustUser } from '../entities/cust-user.entity';
import { MechanicProfile } from '../entities/mechanic-profile.entity';
import { ServiceRequest } from '../entities/service-request.entity';
import { Invoice } from '../entities/invoice.entity';
import { ServiceType } from '../entities/service-type.entity';
import { VehicleCategory } from '../entities/vehicle-category.entity';
import { MechanicPricing } from '../entities/mechanic-pricing.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Badge } from '../entities/badge.entity';
import { ReputationRule } from '../entities/reputation-rule.entity';
import { ReputationLog } from '../entities/reputation-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USER') || 'postgres',
        password: configService.get<string>('DB_PASSWORD') || 'password123',
        database: configService.get<string>('DB_NAME') || 'QuickMechanic',
        entities: [PricingPolicy, PaymentEnvironment, WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent, ProviderKycSubmission, SupportTicket, SupportMessage, AdmUser, ProviderUser, CustUser, MechanicProfile, ServiceRequest, Invoice, ServiceType, VehicleCategory, MechanicPricing, WalletTransaction, Badge, ReputationRule, ReputationLog],
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Production uses reviewed SQL migrations.
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
