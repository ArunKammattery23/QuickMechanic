// One-off: build the QuickMechanic schema on Aiven by running TypeORM with
// `synchronize: true` against .env.production. Safe for an empty database; run
// once, then rely on reviewed migrations for later changes.
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';

import { AdmUser } from '../libs/common/src/entities/adm-user.entity';
import { Badge } from '../libs/common/src/entities/badge.entity';
import { CustUser } from '../libs/common/src/entities/cust-user.entity';
import { Invoice } from '../libs/common/src/entities/invoice.entity';
import { MechanicPricing } from '../libs/common/src/entities/mechanic-pricing.entity';
import { MechanicProfile } from '../libs/common/src/entities/mechanic-profile.entity';
import { WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent } from '../libs/common/src/entities/payment-ledger.entity';
import { PricingPolicy, PaymentEnvironment } from '../libs/common/src/entities/pricing-policy.entity';
import { ProviderKycSubmission } from '../libs/common/src/entities/provider-kyc-submission.entity';
import { ProviderUser } from '../libs/common/src/entities/provider-user.entity';
import { ReputationLog } from '../libs/common/src/entities/reputation-log.entity';
import { ReputationRule } from '../libs/common/src/entities/reputation-rule.entity';
import { ServiceRequest } from '../libs/common/src/entities/service-request.entity';
import { ServiceType } from '../libs/common/src/entities/service-type.entity';
import { SupportTicket, SupportMessage } from '../libs/common/src/entities/support-ticket.entity';
import { VehicleCategory } from '../libs/common/src/entities/vehicle-category.entity';
import { WalletTransaction } from '../libs/common/src/entities/wallet-transaction.entity';

loadEnv({ path: path.resolve(__dirname, '..', '.env.production') });

const caPath = path.isAbsolute(process.env.DB_CA_PATH!)
  ? process.env.DB_CA_PATH!
  : path.resolve(__dirname, '..', process.env.DB_CA_PATH!);

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') },
    entities: [
      PricingPolicy, PaymentEnvironment, WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent,
      ProviderKycSubmission, SupportTicket, SupportMessage, AdmUser, ProviderUser, CustUser,
      MechanicProfile, ServiceRequest, Invoice, ServiceType, VehicleCategory, MechanicPricing,
      WalletTransaction, Badge, ReputationRule, ReputationLog,
    ],
    synchronize: true,
    logging: ['error', 'schema'],
  });

  await ds.initialize();
  console.log('OK: Aiven schema synchronized. Set DB_SSL=true in production and rely on migrations from here on.');
  await ds.destroy();
}

main().catch((e) => {
  console.error('SYNC FAILED:', e);
  process.exit(1);
});
