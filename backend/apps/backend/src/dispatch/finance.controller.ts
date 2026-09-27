import { Body, Controller, Get, Post, Query, Req, UseGuards, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdmUser } from '@app/common/entities/adm-user.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { ServiceRequest } from '@app/common/entities/service-request.entity';
import { PricingPolicy } from '@app/common/entities/pricing-policy.entity';
import { PaymentLedger, WalletAccount } from '@app/common/entities/payment-ledger.entity';
import { currentPolicy, ensurePaymentEnvironment, paymentMode } from './pricing';
import { minorUnits, money } from './money';

@UseGuards(JwtAuthGuard)
@Controller('admin/finance')
export class FinanceController {
  constructor(private db: DataSource) {}
  private async authorize(req: any) {
    const user = await this.db.getRepository(AdmUser).findOneBy({id: req.user.sub});
    if (!user || !['SUPER_ADMIN', 'CEO'].includes(user.role)) throw new ForbiddenException('Finance access requires a current super administrator or CEO account');
    await this.db.transaction(ensurePaymentEnvironment);
    return user;
  }
  @Get('settings')
  async settings(@Req() req: any) {
    await this.authorize(req);
    const policy = await currentPolicy(this.db.manager);
    const history = await this.db.getRepository(PricingPolicy).find({order: {revision: 'DESC'}, take: 20});
    return {policy, history, paymentMode: paymentMode()};
  }
  @Post('settings')
  async update(@Req() req: any, @Body() body: {commissionPercent: string; platformFee: string; expectedRevision: number; travelMinimum?: string; travelIncludedKm?: string; travelPerKm?: string}) {
    const admin = await this.authorize(req);
    const bps = Number(minorUnits(body.commissionPercent));
    const fee = minorUnits(body.platformFee);
    if (bps > 10000 || (fee !== 0n && (fee < 200n || fee > 500n)) || !Number.isInteger(body.expectedRevision)) throw new BadRequestException('Enter commission 0–100%, platform fee INR 2–5 (or 0 to disable), and the current revision');
    return this.db.transaction(async m => {
      await m.query('SELECT pg_advisory_xact_lock(73100922)');
      const previous = await currentPolicy(m);
      if (previous.revision !== body.expectedRevision) throw new ConflictException('Another administrator changed pricing. Refresh and review before saving.');
      const minimum=body.travelMinimum===undefined?BigInt(previous.travelMinimumMinor):minorUnits(body.travelMinimum);
      const perKm=body.travelPerKm===undefined?BigInt(previous.travelPerKmMinor):minorUnits(body.travelPerKm);
      const included=body.travelIncludedKm===undefined?previous.travelIncludedMeters:Number(minorUnits(body.travelIncludedKm))*10;
      if(minimum>100000000n||perKm>10000000n||!Number.isSafeInteger(included)||included<0||included>1000000)throw new BadRequestException('Invalid travel rates');
      return m.getRepository(PricingPolicy).save({commissionBps: bps, platformFeeMinor: fee.toString(), travelMinimumMinor:minimum.toString(),travelIncludedMeters:included,travelPerKmMinor:perKm.toString(),changedBy: admin.id});
    });
  }
  @Get('collections')
  async collections(@Req() req: any, @Query('after') after?: string) {
    await this.authorize(req);
    if (after && !/^[0-9a-f-]{36}$/i.test(after)) throw new BadRequestException('Invalid cursor');
    const providers = this.db.getRepository(ProviderUser).createQueryBuilder('p').select(['p.id', 'p.name', 'p.email']).orderBy('p.id', 'ASC').take(51);
    if (after) providers.where('p.id > :after', {after});
    const page = await providers.getMany();
    const rows = await Promise.all(page.slice(0,50).map(async p => {
      const sums = await this.db.getRepository(ServiceRequest).createQueryBuilder('j')
        .select('COUNT(*)', 'jobs')
        .addSelect(`COALESCE(SUM(CASE WHEN j.status IN ('PAYMENT_SECURED','EN_ROUTE','AWAITING_CUSTOMER_CONFIRMATION') THEN j."totalAmount" ELSE 0 END),0)`, 'held')
        .addSelect(`COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j."totalAmount" ELSE 0 END),0)`, 'completedCollections')
        .addSelect(`COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j."commissionMinor" ELSE 0 END),0)`, 'commissionMinor')
        .addSelect(`COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j."platformFeeMinor" ELSE 0 END),0)`, 'feeMinor')
        .where('j."mechanicId" = :id', {id: p.id}).getRawOne();
      const accounts = await this.db.getRepository(WalletAccount).createQueryBuilder('a').where('a.key IN (:...keys)', {keys: ['provider:' + p.id, 'payout:' + p.id]}).getMany();
      return {...p, jobs: Number(sums.jobs), held: sums.held, completedCollections: sums.completedCollections, commission: money(sums.commissionMinor), platformFees: money(sums.feeMinor), available: money(accounts.find(a=>a.key==='provider:'+p.id)?.balanceMinor || '0'), payoutPending: money(accounts.find(a=>a.key==='payout:'+p.id)?.balanceMinor || '0')};
    }));
    const totals = await this.db.getRepository(PaymentLedger).createQueryBuilder('e').select('e.kind', 'kind').addSelect('SUM(e."amountMinor")', 'amountMinor').groupBy('e.kind').getRawMany();
    return {paymentMode: paymentMode(), providers: rows, totals: totals.map(r=>({kind:r.kind, amount:money(r.amountMinor)})), nextCursor: page.length > 50 ? page[49].id : null};
  }
  @Get('jobs')
  async jobs(@Req() req: any, @Query('providerId') providerId: string, @Query('before') before?: string) {
    await this.authorize(req);
    if (!/^[0-9a-f-]{36}$/i.test(providerId)) throw new BadRequestException('Invalid provider');
    const q = this.db.getRepository(ServiceRequest).createQueryBuilder('j').where('j."mechanicId" = :providerId', {providerId}).orderBy('j.createdAt', 'DESC').addOrderBy('j.id', 'DESC').take(51);
    if (before) {
      const cursor = await this.db.getRepository(ServiceRequest).findOneBy({id: before, mechanic: {id: providerId}});
      if (!cursor) throw new BadRequestException('Invalid cursor');
      q.andWhere('(j."createdAt", j.id) < (:createdAt, :before)', {createdAt: cursor.createdAt, before});
    }
    const jobs = await q.getMany();
    return {jobs: jobs.slice(0,50).map(j=>({id:j.id, status:j.status, createdAt:j.createdAt, totalAmount:j.totalAmount, commission:money(j.commissionMinor), commissionPercent:j.commissionBps/100, platformFee:money(j.platformFeeMinor), providerNet:money(j.providerNetMinor ?? minorUnits(j.totalAmount)), pricingRevision:j.pricingRevision, paymentMode:j.paymentMode})), nextCursor:jobs.length>50?jobs[49].id:null};
  }
}
