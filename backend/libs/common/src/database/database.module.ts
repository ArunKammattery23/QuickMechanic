import { WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent } from '../entities/payment-ledger.entity';
import { ProviderKycSubmission } from '../entities/provider-kyc-submission.entity';
import { SupportTicket, SupportMessage } from '../entities/support-ticket.entity';
import { Module } from '@nestjs/common';
import { PricingPolicy, PaymentEnvironment } from '../entities/pricing-policy.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
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

export function normalizePem(raw: string): string {
  const blocks = raw.replace(/\\n/g, '\n')
    .match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g) ?? [];
  return blocks.map(block => {
    const body = block.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
    return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`;
  }).join('');
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // SSL/TLS for managed providers (Aiven, Supabase, Neon). Prefer verifying
        // against a pinned CA certificate when one is provided. Hosts like Render
        // and Cloud Run cannot ship files from a gitignored path, so the cert
        // may be passed as DB_CA_CERT (full PEM) instead of DB_CA_PATH.
        let ssl: boolean | { rejectUnauthorized: boolean; ca?: string } = false;
        if (configService.get<string>('DB_SSL') === 'true') {
          const caInline = configService.get<string>('DB_CA_CERT');
          const caPath = configService.get<string>('DB_CA_PATH');
          if (caInline && caInline.includes('BEGIN CERTIFICATE')) {
            // Hosting dashboards often turn the PEM's line breaks into spaces,
            // literal "\n" or nothing at all, which makes TLS reject the chain.
            // Rebuild a canonical PEM (64-char base64 lines) from the body.
            ssl = { rejectUnauthorized: true, ca: normalizePem(caInline) };
          } else if (caPath) {
            const resolved = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
            try {
              ssl = { rejectUnauthorized: true, ca: fs.readFileSync(resolved, 'utf8') };
            } catch {
              // Fall back to loose verification only if the CA file cannot be read.
              ssl = { rejectUnauthorized: false };
            }
          } else {
            ssl = { rejectUnauthorized: false };
          }
        }
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: Number(configService.get<string>('DB_PORT')) || 5432,
          username: configService.get<string>('DB_USER') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'password123',
          database: configService.get<string>('DB_NAME') || 'QuickMechanic',
          ssl,
          entities: [PricingPolicy, PaymentEnvironment, WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent, ProviderKycSubmission, SupportTicket, SupportMessage, AdmUser, ProviderUser, CustUser, MechanicProfile, ServiceRequest, Invoice, ServiceType, VehicleCategory, MechanicPricing, WalletTransaction, Badge, ReputationRule, ReputationLog],
          synchronize: configService.get<string>('NODE_ENV') !== 'production', // Production uses reviewed SQL migrations.
          autoLoadEntities: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
