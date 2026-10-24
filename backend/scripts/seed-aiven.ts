// Fresh-data seeder for the Aiven QuickMechanic database.
// Idempotent: safe to re-run; existing rows are skipped by their natural keys.
// Usage: (from backend/) npx ts-node -T scripts/seed-aiven.ts
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';

import { AdmUser, AdmUserRole } from '../libs/common/src/entities/adm-user.entity';
import { Badge, BadgeCriteriaType } from '../libs/common/src/entities/badge.entity';
import { CustUser } from '../libs/common/src/entities/cust-user.entity';
import { MechanicProfile, KycStatus } from '../libs/common/src/entities/mechanic-profile.entity';
import { ProviderUser, ProviderUserRole } from '../libs/common/src/entities/provider-user.entity';
import { PricingPolicy, PaymentEnvironment } from '../libs/common/src/entities/pricing-policy.entity';
import { ReputationRule } from '../libs/common/src/entities/reputation-rule.entity';
import { ServiceType } from '../libs/common/src/entities/service-type.entity';
import { VehicleCategory } from '../libs/common/src/entities/vehicle-category.entity';
import { WalletAccount } from '../libs/common/src/entities/payment-ledger.entity';

loadEnv({ path: path.resolve(__dirname, '..', '.env.production') });

const caPath = path.isAbsolute(process.env.DB_CA_PATH!)
  ? process.env.DB_CA_PATH!
  : path.resolve(__dirname, '..', process.env.DB_CA_PATH!);

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Welcome@123'; // Change immediately in production.

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') },
    entities: [
      AdmUser, Badge, CustUser, MechanicProfile, ProviderUser, PricingPolicy,
      PaymentEnvironment, ReputationRule, ServiceType, VehicleCategory, WalletAccount,
    ],
    synchronize: false,
    logging: ['error'],
  });

  await ds.initialize();

  // -------- 1. Payment environment (must match PAYMENT_MODE in env) --------
  await ds.getRepository(PaymentEnvironment).upsert(
    { id: 1, mode: process.env.PAYMENT_MODE || 'simulation' },
    ['id'],
  );
  console.log(`✓ payment_environment -> ${process.env.PAYMENT_MODE || 'simulation'}`);

  // -------- 2. Default pricing policy (revision 1) --------
  const policyRepo = ds.getRepository(PricingPolicy);
  if (!(await policyRepo.count())) {
    await policyRepo.save({
      commissionBps: 1500,          // 15% platform commission
      platformFeeMinor: '200',       // ₹2 flat platform fee
      travelMinimumMinor: '5000',    // ₹50 minimum travel
      travelIncludedMeters: 2500,    // first 2.5 km included
      travelPerKmMinor: '800',       // ₹8/km after
      changedBy: 'seed-script',
    });
    console.log('✓ pricing_policies -> revision 1 created');
  } else {
    console.log('• pricing_policies -> already present');
  }

  // -------- 3. Service types --------
  const serviceDefs = [
    { name: 'Flat Tyre', description: 'Puncture repair or tyre swap at the breakdown spot' },
    { name: 'Battery Jump Start', description: 'Dead battery jump-start on site' },
    { name: 'Towing', description: 'Tow truck for immobile vehicles' },
    { name: 'Fuel Delivery', description: 'Emergency petrol/diesel top-up' },
    { name: 'Engine Breakdown', description: 'On-site engine diagnostics and repair' },
    { name: 'Lockout', description: 'Keys locked inside the vehicle' },
    { name: 'Minor Mechanical', description: 'Belts, hoses, and small on-the-spot fixes' },
  ];
  const stRepo = ds.getRepository(ServiceType);
  for (const s of serviceDefs) {
    if (!(await stRepo.findOne({ where: { name: s.name } }))) {
      await stRepo.save(s);
    }
  }
  const serviceTypes = await stRepo.find();
  console.log(`✓ service_types -> ${serviceTypes.length} rows`);

  // -------- 4. Vehicle categories --------
  const vehicleDefs = [
    { group: '2 Wheeler', name: 'Scooter', description: 'Up to 150cc scooters', isPremiumTier: false },
    { group: '2 Wheeler', name: 'Motorcycle', description: '150cc and above motorcycles', isPremiumTier: false },
    { group: '2 Wheeler', name: 'Premium Bike', description: 'Superbikes and premium motorcycles', isPremiumTier: true },
    { group: '4 Wheeler', name: 'Hatchback', description: 'Standard hatchbacks', isPremiumTier: false },
    { group: '4 Wheeler', name: 'Sedan', description: 'Standard sedans', isPremiumTier: false },
    { group: '4 Wheeler', name: 'SUV', description: 'SUVs and crossovers', isPremiumTier: false },
    { group: '4 Wheeler', name: 'Luxury / Premium', description: 'Premium and luxury cars', isPremiumTier: true },
    { group: 'Heavy', name: 'Light Commercial', description: 'Pickups and light trucks', isPremiumTier: false },
    { group: 'Heavy', name: 'Heavy Truck', description: 'Trucks above 3.5T', isPremiumTier: true },
  ];
  const vcRepo = ds.getRepository(VehicleCategory);
  for (const v of vehicleDefs) {
    if (!(await vcRepo.findOne({ where: { group: v.group, name: v.name } }))) {
      await vcRepo.save(v);
    }
  }
  const vehicleCategories = await vcRepo.find();
  console.log(`✓ vehicle_categories -> ${vehicleCategories.length} rows`);

  // -------- 5. Badges --------
  const badgeDefs = [
    { name: 'Bronze Wrench', description: 'Completed 10 jobs', icon: 'BronzeWrench', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 10 },
    { name: 'Silver Wrench', description: 'Completed 50 jobs', icon: 'SilverWrench', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 50 },
    { name: 'Gold Wrench', description: 'Completed 200 jobs', icon: 'GoldWrench', criteriaType: BadgeCriteriaType.COMPLETED_JOBS, criteriaValue: 200 },
    { name: 'Five-Star Pro', description: '25 five-star reviews', icon: 'FiveStarPro', criteriaType: BadgeCriteriaType.FIVE_STAR_REVIEWS, criteriaValue: 25 },
    { name: 'Verified', description: 'KYC verified mechanic', icon: 'Verified', criteriaType: BadgeCriteriaType.VERIFIED_KYC, criteriaValue: 1 },
  ];
  const bRepo = ds.getRepository(Badge);
  for (const b of badgeDefs) {
    if (!(await bRepo.findOne({ where: { name: b.name } }))) {
      await bRepo.save(b);
    }
  }
  console.log(`✓ badges -> ${(await bRepo.count())} rows`);

  // -------- 6. Reputation rules --------
  const ruleDefs = [
    { action: 'ABANDON_JOB', badgeTier: null, pointDeduction: -50, description: 'Mechanic abandoned an accepted job' },
    { action: 'LATE_ARRIVAL', badgeTier: null, pointDeduction: -10, description: 'Arrived more than 15 min late' },
    { action: 'QUOTE_TIMEOUT', badgeTier: null, pointDeduction: -20, description: 'Did not send a quote within SLA' },
    { action: 'CUSTOMER_COMPLAINT', badgeTier: null, pointDeduction: -30, description: 'Complaint upheld after review' },
    { action: 'KYC_REJECTED', badgeTier: null, pointDeduction: -100, description: 'KYC rejected for falsified data' },
  ];
  const rrRepo = ds.getRepository(ReputationRule);
  for (const r of ruleDefs) {
    if (!(await rrRepo.findOne({ where: { action: r.action } }))) {
      await rrRepo.save(r as any);
    }
  }
  console.log(`✓ reputation_rules -> ${(await rrRepo.count())} rows`);

  // -------- 7. Admin users --------
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  const admins = [
    { name: 'Super Admin', email: 'admin@quickmechanic.in', phoneNumber: '+911111111111', role: AdmUserRole.SUPER_ADMIN },
    { name: 'Ops Manager', email: 'ops@quickmechanic.in', phoneNumber: '+911111111112', role: AdmUserRole.MANAGER },
  ];
  const admRepo = ds.getRepository(AdmUser);
  for (const a of admins) {
    if (!(await admRepo.findOne({ where: { email: a.email } }))) {
      await admRepo.save({ ...a, passwordHash: hash });
    }
  }
  console.log(`✓ ADM_USER -> ${(await admRepo.count())} rows (password: ${DEFAULT_PASSWORD})`);

  // -------- 8. Customer users --------
  const custRepo = ds.getRepository(CustUser);
  const customers = [
    { name: 'Rahul Nair', email: 'rahul.customer@example.com', phoneNumber: '+919000000001' },
    { name: 'Anjali Menon', email: 'anjali.customer@example.com', phoneNumber: '+919000000002' },
    { name: 'Vikram Pillai', email: 'vikram.customer@example.com', phoneNumber: '+919000000003' },
  ];
  for (const c of customers) {
    if (!(await custRepo.findOne({ where: { email: c.email } }))) {
      await custRepo.save({ ...c, passwordHash: hash });
    }
  }
  console.log(`✓ CUST_USER -> ${(await custRepo.count())} rows`);

  // -------- 9. Provider users + mechanic profiles (approved, in Kerala) --------
  const provRepo = ds.getRepository(ProviderUser);
  const mpRepo = ds.getRepository(MechanicProfile);
  const walletRepo = ds.getRepository(WalletAccount);

  // Kochi area coordinates (lng, lat) chosen so distance queries demo nicely.
  const providers = [
    { name: 'Rajesh Kumar', email: 'rajesh.mech@example.com', phoneNumber: '+919500000001', role: ProviderUserRole.MECHANIC, lng: 76.2673, lat: 9.9312 },
    { name: 'Prakash M',     email: 'prakash.mech@example.com', phoneNumber: '+919500000002', role: ProviderUserRole.MECHANIC, lng: 76.3100, lat: 9.9500 },
    { name: 'Suresh Varghese',email: 'suresh.mech@example.com', phoneNumber: '+919500000003', role: ProviderUserRole.MECHANIC, lng: 76.2800, lat: 9.9700 },
    { name: 'Fleet Driver 1', email: 'fleet1@example.com',       phoneNumber: '+919500000010', role: ProviderUserRole.FLEET_DRIVER, lng: 76.2500, lat: 9.9400 },
  ];

  for (const p of providers) {
    let user = await provRepo.findOne({ where: { email: p.email } });
    if (!user) {
      user = await provRepo.save({
        name: p.name, email: p.email, phoneNumber: p.phoneNumber, role: p.role, passwordHash: hash,
      });
    }

    let profile = await mpRepo.findOne({ where: { user: { id: user.id } }, relations: { user: true } });
    if (!profile) {
      profile = mpRepo.create({
        user,
        kycStatus: KycStatus.APPROVED,
        kycDocumentsVerified: true,
        isOnline: true,
        lastSeenAt: new Date(),
        reputationPoints: 100,
        completedJobsCount: 0,
        fiveStarReviewsCount: 0,
        hasPremiumSubscription: false,
        walletBalance: 0,
        currentLocation: `SRID=4326;POINT(${p.lng} ${p.lat})`,
        providedServices: serviceTypes.slice(0, 5),      // first 5 services
        supportedVehicles: vehicleCategories.slice(0, 6), // all non-heavy categories
      });
      await mpRepo.save(profile);
    }

    // Open a wallet account for the mechanic if missing.
    if (!(await walletRepo.findOne({ where: { ownerType: 'MECHANIC', ownerId: user.id } as any }))) {
      await walletRepo.save({ ownerType: 'MECHANIC', ownerId: user.id, availableMinor: '0', escrowMinor: '0' } as any);
    }
  }
  console.log(`✓ PROVIDER_USER + mechanic_profiles -> ${(await mpRepo.count())} mechanics (all APPROVED, online)`);

  // -------- Platform wallet for commission --------
  if (!(await walletRepo.findOne({ where: { ownerType: 'PLATFORM', ownerId: 'PLATFORM' } as any }))) {
    await walletRepo.save({ ownerType: 'PLATFORM', ownerId: 'PLATFORM', availableMinor: '0', escrowMinor: '0' } as any);
  }
  console.log(`✓ wallet_accounts -> ${(await walletRepo.count())} rows`);

  await ds.destroy();
  console.log('\n🎉 Seed complete. Default password for every seeded account: ' + DEFAULT_PASSWORD);
  console.log('   Change these before any real use.');
}

run().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
