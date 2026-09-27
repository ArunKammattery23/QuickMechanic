import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PricingPolicy, PaymentEnvironment } from '@app/common/entities/pricing-policy.entity';
import { PaymentLedger } from '@app/common/entities/payment-ledger.entity';
import { WalletTransaction } from '@app/common/entities/wallet-transaction.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { minorUnits, money } from './money';

export function paymentMode(): string {
  const mode = process.env.PAYMENT_MODE || 'live';
  if (!['simulation', 'razorpay_test', 'live'].includes(mode)) throw new BadRequestException('Invalid PAYMENT_MODE');
  return mode;
}

export async function ensurePaymentEnvironment(m: EntityManager) {
  const mode = paymentMode();
  // Serialize first initialization only; normal payment traffic does not share a global lock.
  const repo = m.getRepository(PaymentEnvironment);
  let saved = await repo.findOneBy({id: 1});
  if (!saved) {
    await m.query('SELECT pg_advisory_xact_lock(73100921)');
    saved = await repo.findOneBy({id: 1});
    if (!saved) {
      if (mode !== 'live' && (await m.getRepository(PaymentLedger).count() || await m.getRepository(WalletTransaction).count() || await m.getRepository(MechanicProfile).createQueryBuilder('p').where('p."walletBalance" > 0').getCount())) {
        throw new BadRequestException('Use a separate empty payment database for test mode. Existing funds cannot be converted.');
      }
      saved = await repo.save({id: 1, mode});
    }
  }
  if (saved.mode !== mode) throw new BadRequestException('Payment environment mismatch. Use a separate database when switching between simulated, gateway-test and live money.');
  return mode;
}

export function calculateQuote(base: unknown, commissionBps: number, platformFeeMinor: string) {
  const baseMinor = minorUnits(base);
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) throw new BadRequestException('Commission must be between 0 and 100 percent');
  const platform = BigInt(platformFeeMinor);
  if (platform !== 0n && (platform < 200n || platform > 500n)) throw new BadRequestException('Platform fee must be disabled or between INR 2 and 5');
  const commission = (baseMinor * BigInt(commissionBps) + 5000n) / 10000n;
  const total = baseMinor + platform;
  if (total > 9999999999n) throw new BadRequestException('Quotation exceeds supported amount');
  return {providerNetMinor: (baseMinor - commission).toString(), commissionMinor: commission.toString(), platformFeeMinor: platform.toString(), commissionBps, quotationAmount: money(baseMinor), totalAmount: Number(money(total))};
}

export async function currentPolicy(m: EntityManager) {
  return await m.getRepository(PricingPolicy).findOne({where: {}, order: {revision: 'DESC'}}) ?? {revision: 0, commissionBps: 0, platformFeeMinor: '200', travelMinimumMinor: '5000', travelIncludedMeters: 2500, travelPerKmMinor: '800'};
}

export function travelCharge(distanceMeters: number, policy: {travelMinimumMinor: string; travelIncludedMeters: number; travelPerKmMinor: string}) {
  if (!Number.isSafeInteger(distanceMeters) || distanceMeters < 0 || distanceMeters > 1000000) throw new BadRequestException('Invalid road distance');
  const extra = BigInt(Math.max(0, distanceMeters - policy.travelIncludedMeters));
  return BigInt(policy.travelMinimumMinor) + (extra * BigInt(policy.travelPerKmMinor) + 500n) / 1000n;
}
