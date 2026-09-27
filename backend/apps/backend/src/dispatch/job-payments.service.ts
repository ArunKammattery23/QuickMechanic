import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository, MoreThanOrEqual } from 'typeorm';
import { randomUUID } from 'crypto';
import { WalletAccount, PaymentLedger, WithdrawalAllocation, JobEvent } from '@app/common/entities/payment-ledger.entity';
import { ServiceRequest, JobStatus } from '@app/common/entities/service-request.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { WalletTransaction, WalletStatus } from '@app/common/entities/wallet-transaction.entity';
import { LocationGateway } from '../location/location.gateway';
import { minorUnits, money, withdrawalWeek } from './money';
import { razorpayLink } from './razorpay';
import { currentPolicy, ensurePaymentEnvironment, paymentMode } from './pricing';

type Actor = {sub: string; role: string};
export class JobPaymentsService {
  constructor(private jobs: Repository<ServiceRequest>, private gateway: LocationGateway) {}
  async pricing() {
    await this.jobs.manager.transaction(ensurePaymentEnvironment);
    return {...await currentPolicy(this.jobs.manager), paymentMode: paymentMode(), commissionModel: 'DEDUCT_FROM_QUOTE'};
  }
  async event(m: EntityManager, job: ServiceRequest, type: string, actorId: string, details: Record<string, unknown> = {}) {
    await m.getRepository(JobEvent).save({job: {id: job.id}, type, actorId, details});
  }
  private async lockedJob(m: EntityManager, id: string, actor: Actor) {
    await ensurePaymentEnvironment(m);
    await m.getRepository(ServiceRequest).createQueryBuilder('job').where('job.id = :id', {id}).setLock('pessimistic_write').getOne();
    const job = await m.getRepository(ServiceRequest).findOne({where: {id}, relations: {customer: true, mechanic: true}});
    if (!job) throw new NotFoundException('Job not found');
    const owns = actor.role === 'CUSTOMER' ? job.customer.id === actor.sub : ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role) && job.mechanic?.id === actor.sub;
    if (!owns) throw new ForbiddenException('Not your job');
    return job;
  }
  private async accounts(m: EntityManager, keys: string[]) {
    const repo = m.getRepository(WalletAccount);
    const result = new Map<string, WalletAccount>();
    for (const key of [...new Set(keys)].sort()) {
      await repo.createQueryBuilder().insert().values({key, balanceMinor: '0'}).orIgnore().execute();
      const account = await repo.createQueryBuilder('a').where('a.key = :key', {key}).setLock('pessimistic_write').getOneOrFail();
      result.set(key, account);
    }
    return result;
  }
  private async transfer(m: EntityManager, reference: string, fromKey: string, toKey: string, amount: bigint, kind: string, jobId: string | null, description: string) {
    if (amount < 0n || fromKey === toKey) throw new BadRequestException('Invalid transfer');
    const accounts = await this.accounts(m, [fromKey, toKey]);
    const from = accounts.get(fromKey)!; const to = accounts.get(toKey)!;
    if (!fromKey.startsWith('external:') && BigInt(from.balanceMinor) < amount) throw new BadRequestException('Insufficient wallet funds');
    from.balanceMinor = (BigInt(from.balanceMinor) - amount).toString();
    to.balanceMinor = (BigInt(to.balanceMinor) + amount).toString();
    await m.getRepository(WalletAccount).save([from, to]);
    return m.getRepository(PaymentLedger).save({reference, fromAccount: from, toAccount: to, amountMinor: amount.toString(), kind,
      job: jobId ? {id: jobId} : null, description});
  }
  private async providerAccount(m: EntityManager, providerId: string) {
    // This provider-scoped lock is also used for withdrawals and releases.
    await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [providerId]);
    const key = 'provider:' + providerId;
    const existing = await m.getRepository(WalletAccount).findOneBy({key});
    if (!existing) {
      const profile = await m.getRepository(MechanicProfile).findOneBy({user: {id: providerId}});
      if (!profile) throw new NotFoundException('Provider wallet not found');
      const opening = minorUnits(profile.walletBalance);
      await this.transfer(m, 'opening:' + providerId, 'external:legacy:' + providerId, key, opening, 'OPENING_BALANCE', null, 'Legacy available balance imported; original job allocation unavailable');
    }
    return (await this.accounts(m, [key])).get(key)!;
  }
  private async escrow(m: EntityManager, job: ServiceRequest) {
    const key = 'escrow:' + job.id;
    if (!await m.getRepository(WalletAccount).existsBy({key})) {
      const legacy = await m.getRepository(WalletTransaction).findOneBy({serviceRequest: {id: job.id}, status: WalletStatus.ESCROW});
      if (!legacy) throw new BadRequestException('Held payment not found');
      await this.transfer(m, 'legacy-hold:' + job.id, 'external:legacy:' + job.id, key, minorUnits(legacy.amount), 'LEGACY_HOLD', job.id, 'Imported existing held payment');
    }
    return key;
  }
  private notify(job: ServiceRequest, event: string, details: Record<string, unknown> = {}) {
    for (const room of ['customer_' + job.customer.id, 'tracking_' + job.mechanic?.id]) {
      this.gateway.server.to(room).emit(event, {jobId: job.id, ...details});
    }
  }
  async pay(id: string, customerId: string, testFunding = false, simulationResult?: string) {
    const result = await this.jobs.manager.transaction(async m => {
      const job = await this.lockedJob(m, id, {sub: customerId, role: 'CUSTOMER'});
      if (job.status !== JobStatus.AWAITING_PAYMENT) return {success: false, message: 'Job is not awaiting acceptance/payment.'};
      const simulation = paymentMode() === 'simulation';
      if (simulation && !simulationResult) return {success: true, simulationRequired: true, message: 'TEST PAYMENT — no real money will be charged.'};
      if (simulation && simulationResult !== 'success') return {success: false, message: 'Test payment cancelled or failed. Job remains unpaid.'};
      if (job.paymentMode !== paymentMode()) throw new BadRequestException('Job payment environment does not match this server');
      const amount = minorUnits(job.totalAmount);
      if (testFunding && process.env.NODE_ENV !== 'test') throw new BadRequestException('Test funding is disabled outside automated tests');
      const customerWallet = (await this.accounts(m, ['customer:' + customerId])).get('customer:' + customerId)!;
      const walletFunds = BigInt(customerWallet.balanceMinor);
      if (!testFunding && !simulation && walletFunds < amount) {
        if (!job.customerAcceptedAt) {
          job.customerAcceptedAt = new Date();
          await m.getRepository(ServiceRequest).save(job);
          await this.event(m, job, 'CUSTOMER_ACCEPTED', customerId, {amount: money(amount), currency: 'INR'});
        }
        return {success: true, checkoutRequired: true, message: 'Complete Razorpay checkout, then refresh this job.', job};
      }
      const walletUsed = walletFunds < amount ? walletFunds : amount;
      if (walletUsed > 0n) await this.transfer(m, 'wallet-hold:' + id, customerWallet.key, 'escrow:' + id, walletUsed, 'WALLET_PAYMENT', id, 'Customer wallet payment held pending completion approval');
      if (walletUsed < amount || amount === 0n) await this.transfer(m, 'hold:' + id, (simulation ? 'external:simulation:' : testFunding ? 'external:test:' : 'external:zero:') + id, 'escrow:' + id, amount - walletUsed, 'PAYMENT_HELD', id, simulation ? 'SIMULATED payment — no real money' : testFunding ? 'Automated test payment' : 'No-charge job confirmed');
      await m.getRepository(WalletTransaction).save({mechanic: {id: job.mechanic.id}, serviceRequest: {id}, amount: Number(job.totalAmount), status: WalletStatus.ESCROW, description: 'Payment held in company escrow'});
      job.customerAcceptedAt = new Date(); job.confirmedAt = new Date();
      job.status = JobStatus.PAYMENT_SECURED;
      await m.getRepository(ServiceRequest).save(job);
      await this.event(m, job, 'JOB_CONFIRMED', customerId, {amount: money(amount), currency: 'INR', paymentMode: simulation ? 'simulation' : testFunding ? 'TEST' : 'WALLET'});
      return {success: true, message: simulation ? 'TEST job confirmed. Simulated funds held until completion approval; no real charge.' : 'Job confirmed. Funds held until you confirm completion.', job};
    });
    if ('checkoutRequired' in result && result.checkoutRequired) {
      const checkout = await razorpayLink(id, minorUnits(result.job!.totalAmount));
      await this.jobs.update(id, {razorpayLinkId: checkout.id, checkoutUrl: checkout.url});
      return {success: true, checkoutUrl: checkout.url, message: result.message};
    }
    if (result.success && 'job' in result) this.notify(result.job!, 'payment_secured');
    return {success: result.success, message: result.message, simulationRequired: 'simulationRequired' in result && result.simulationRequired};
  }
  async requestCompletion(id: string, providerId: string) {
    const result = await this.jobs.manager.transaction(async m => {
      const job = await this.lockedJob(m, id, {sub: providerId, role: 'MECHANIC'});
      if (![JobStatus.PAYMENT_SECURED, JobStatus.EN_ROUTE].includes(job.status)) return {success: false, message: 'Job is not ready for completion.'};
      job.status = JobStatus.AWAITING_CUSTOMER_CONFIRMATION; job.completionRequestedAt = new Date();
      await m.getRepository(ServiceRequest).save(job);
      await this.event(m, job, 'COMPLETION_REQUESTED', providerId);
      return {success: true, message: 'Waiting for customer approval. Funds remain held.', job};
    });
    if (result.success && 'job' in result) this.notify(result.job!, 'completion_requested');
    return {success: result.success, message: result.message};
  }
  async startJourney(id: string, providerId: string) {
    return this.jobs.manager.transaction(async m => {
      const job = await this.lockedJob(m, id, {sub: providerId, role: 'MECHANIC'});
      if (job.status !== JobStatus.PAYMENT_SECURED) return {success: false, message: 'Job is not ready to start.'};
      await m.getRepository(ServiceRequest).update(id, {status: JobStatus.EN_ROUTE});
      await this.event(m, job, 'JOURNEY_STARTED', providerId);
      return {success: true, message: 'Journey started.'};
    });
  }
  async gatewayCaptured(payload: any) {
    if (paymentMode() === 'simulation') throw new BadRequestException('Real gateway callbacks are disabled in simulation mode');
    if (payload?.event !== 'payment_link.paid') return {received: true};
    const link = payload.payload?.payment_link?.entity;
    const payment = payload.payload?.payment?.entity;
    if (typeof link?.reference_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(link.reference_id)) throw new BadRequestException('Invalid payment reference');
    if (!link || !payment || payment.status !== 'captured' || link.status !== 'paid' || link.currency !== 'INR' || payment.currency !== 'INR' || !Number.isSafeInteger(payment.amount) || payment.amount < 0 || typeof payment.id !== 'string') throw new BadRequestException('Invalid captured payment');
    const result = await this.jobs.manager.transaction(async m => {
      const found = await m.getRepository(ServiceRequest).findOne({where: {id: link.reference_id}, relations: {customer: true}});
      if (!found) throw new NotFoundException('Payment job not found');
      const job = await this.lockedJob(m, found.id, {sub: found.customer.id, role: 'CUSTOMER'});
      if (await m.getRepository(PaymentLedger).existsBy({reference: 'razorpay:' + payment.id})) return {received: true};
      const amount = minorUnits(job.totalAmount);
      if (!job.customerAcceptedAt || BigInt(payment.amount) !== amount || link.amount !== payment.amount || link.amount_paid !== payment.amount || (job.razorpayLinkId && job.razorpayLinkId !== link.id)) throw new BadRequestException('Payment does not match the accepted job');
      const canHold = job.status === JobStatus.AWAITING_PAYMENT;
      await this.transfer(m, 'razorpay:' + payment.id, 'external:razorpay:' + payment.id, canHold ? 'escrow:' + job.id : 'customer:' + job.customer.id, amount,
        canHold ? 'PAYMENT_HELD' : 'LATE_PAYMENT_REFUND', job.id, canHold ? 'Verified Razorpay capture held pending customer completion approval' : 'Captured after job cancellation/payment; credited to customer wallet');
      if (canHold) {
        job.status = JobStatus.PAYMENT_SECURED; job.confirmedAt = new Date(); job.razorpayLinkId = link.id;
        await m.getRepository(ServiceRequest).save(job);
        await m.getRepository(WalletTransaction).save({mechanic: {id: job.mechanic.id}, serviceRequest: {id: job.id}, amount: Number(job.totalAmount), status: WalletStatus.ESCROW, description: 'Razorpay payment held in company escrow'});
      }
      await this.event(m, job, canHold ? 'JOB_CONFIRMED' : 'LATE_PAYMENT_REFUNDED', 'RAZORPAY', {paymentId: payment.id, amount: money(amount), currency: 'INR'});
      return {received: true, job, canHold};
    });
    if ('job' in result && result.canHold) this.notify(result.job!, 'payment_secured');
    return {received: true};
  }
  async confirmCompletion(id: string, customerId: string) {
    const result = await this.jobs.manager.transaction(async m => {
      const job = await this.lockedJob(m, id, {sub: customerId, role: 'CUSTOMER'});
      if (job.status !== JobStatus.AWAITING_CUSTOMER_CONFIRMATION) return {success: false, message: 'Job is not awaiting your completion approval.'};
      const account = await this.providerAccount(m, job.mechanic.id);
      const escrow = await this.escrow(m, job);
      const net = job.providerNetMinor == null ? minorUnits(job.totalAmount) : BigInt(job.providerNetMinor);
      const commission = BigInt(job.commissionMinor || '0');
      const fee = BigInt(job.platformFeeMinor || '0');
      if (net + commission + fee !== minorUnits(job.totalAmount)) throw new BadRequestException('Job settlement does not balance');
      await this.transfer(m, 'release:' + id, escrow, account.key, net, 'PROVIDER_CREDIT', id, 'Customer confirmed completion; provider net earnings released');
      if (commission > 0n) await this.transfer(m, 'commission:' + id, escrow, 'company:commission', commission, 'COMPANY_COMMISSION', id, 'Commission at the quotation policy rate');
      if (fee > 0n) await this.transfer(m, 'platform-fee:' + id, escrow, 'company:platform-fee', fee, 'PLATFORM_FEE', id, 'Platform fee at quotation');
      job.status = JobStatus.COMPLETED; job.completedAt = new Date();
      await m.getRepository(ServiceRequest).save(job);
      const updated = await m.getRepository(WalletAccount).findOneByOrFail({key: account.key});
      await m.getRepository(MechanicProfile).increment({user: {id: job.mechanic.id}}, 'completedJobsCount', 1);
      await m.getRepository(MechanicProfile).update({user: {id: job.mechanic.id}}, {walletBalance: Number(money(updated.balanceMinor))});
      await m.getRepository(WalletTransaction).update({serviceRequest: {id}, status: WalletStatus.ESCROW}, {status: WalletStatus.AVAILABLE, amount: Number(money(net))});
      await this.event(m, job, 'CUSTOMER_CONFIRMED_COMPLETION', customerId, {amount: String(job.totalAmount), currency: 'INR'});
      return {success: true, message: 'Completion confirmed. Funds released to provider.', job};
    });
    if (result.success && 'job' in result) this.notify(result.job!, 'job_completed');
    return {success: result.success, message: result.message};
  }
  async cancel(id: string, actor: Actor, reason: string) {
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new BadRequestException('Cancellation reason is required (up to 500 characters)');
    const result = await this.jobs.manager.transaction(async m => {
      const job = await this.lockedJob(m, id, actor);
      if ([JobStatus.COMPLETED, JobStatus.CANCELLED].includes(job.status)) return {success: false, message: 'Job is already completed or cancelled.'};
      let refunded = '0.00';
      if ([JobStatus.PAYMENT_SECURED, JobStatus.EN_ROUTE, JobStatus.AWAITING_CUSTOMER_CONFIRMATION].includes(job.status)) {
        const escrow = await this.escrow(m, job);
        await this.transfer(m, 'refund:' + id, escrow, 'customer:' + job.customer.id, minorUnits(job.totalAmount), 'CUSTOMER_REFUND', id, 'Full cancellation refund to customer wallet');
        refunded = String(job.totalAmount);
        await m.getRepository(WalletTransaction).update({serviceRequest: {id}, status: WalletStatus.ESCROW}, {status: WalletStatus.CANCELLED});
      }
      job.status = JobStatus.CANCELLED; job.cancelledBy = actor.sub; job.cancellationReason = reason.trim();
      await m.getRepository(ServiceRequest).save(job);
      await this.event(m, job, 'CANCELLED', actor.sub, {reason: reason.trim(), refund: refunded, currency: 'INR'});
      return {success: true, message: `Job cancelled. INR ${refunded} refunded to customer wallet.`, job};
    });
    if (result.success && 'job' in result) this.notify(result.job!, 'job_cancelled', {message: result.message});
    return {success: result.success, message: result.message};
  }
  async withdraw(providerId: string, requestId: string) {
    if (!/^[\w-]{8,100}$/.test(requestId)) throw new BadRequestException('A stable withdrawal request ID is required');
    return this.jobs.manager.transaction(async m => {
      await ensurePaymentEnvironment(m);
      const account = await this.providerAccount(m, providerId);
      const ledger = m.getRepository(PaymentLedger);
      const previous = await ledger.findOneBy({reference: `withdraw:${providerId}:${requestId}`});
      if (previous) return {success: true, message: 'Withdrawal already recorded.', transactionId: previous.id};
      const count = await ledger.countBy({fromAccount: {id: account.id}, kind: 'WITHDRAWAL_REQUESTED', createdAt: MoreThanOrEqual(withdrawalWeek())});
      const legacyCount = await m.getRepository(WalletTransaction).count({where: {mechanic: {id: providerId}, status: WalletStatus.WITHDRAWN, createdAt: MoreThanOrEqual(withdrawalWeek())}});
      if (count + legacyCount >= 5) return {success: false, message: 'Weekly limit reached: five withdrawals per Monday–Sunday week (India time).'};
      const amount = BigInt(account.balanceMinor);
      if (amount <= 0n) return {success: false, message: 'No available balance to withdraw.'};
      const transfer = await this.transfer(m, `withdraw:${providerId}:${requestId}`, account.key, 'payout:' + providerId, amount, 'WITHDRAWAL_REQUESTED', null, 'Withdrawal reserved for payout; bank transfer not yet processed');
      const credits = await ledger.createQueryBuilder('credit').leftJoinAndSelect('credit.job', 'job')
        .where('credit."toAccountId" = :accountId', {accountId: account.id})
        .andWhere(qb => 'credit."amountMinor" > COALESCE(' + qb.subQuery().select('SUM(a."amountMinor")').from(WithdrawalAllocation, 'a').where('a."providerId" = :providerId AND a."jobId" IS NOT DISTINCT FROM credit."jobId"').getQuery() + ', 0)', {providerId})
        .orderBy('credit.createdAt', 'ASC').addOrderBy('credit.id', 'ASC').getMany();
      const allocations = await m.getRepository(WithdrawalAllocation).createQueryBuilder('a').select('a."jobId"', 'jobId').addSelect('SUM(a."amountMinor")', 'amount').where('a."providerId" = :providerId', {providerId}).groupBy('a."jobId"').getRawMany();
      const used = new Map<string, bigint>(allocations.map(a => [a.jobId ?? 'legacy', BigInt(a.amount)]));
      let remaining = amount;
      for (const credit of credits) {
        const key = credit.job?.id ?? 'legacy';
        const consumed = used.get(key) ?? 0n;
        const original = BigInt(credit.amountMinor);
        const available = original > consumed ? original - consumed : 0n;
        used.set(key, consumed > original ? consumed - original : 0n);
        const take = available > remaining ? remaining : available;
        if (take > 0n) await m.getRepository(WithdrawalAllocation).save({providerId, withdrawal: {id: transfer.id}, job: credit.job ? {id: credit.job.id} : null, amountMinor: take.toString()});
        remaining -= take;
        if (remaining === 0n) break;
      }
      if (remaining !== 0n) throw new BadRequestException('Wallet allocation mismatch');
      await m.getRepository(MechanicProfile).update({user: {id: providerId}}, {walletBalance: 0, lastWithdrawalDate: new Date()});
      return {success: true, message: paymentMode() !== 'live' ? `TEST withdrawal: INR ${money(amount)} reserved. No bank transfer or real money.` : `INR ${money(amount)} reserved for withdrawal. Bank payout is pending.`, transactionId: transfer.id};
    });
  }
  async history(actor: Actor, before?: string) {
    await this.jobs.manager.transaction(ensurePaymentEnvironment);
    const provider = ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role);
    const key = (provider ? 'provider:' : 'customer:') + actor.sub;
    if (provider) await this.jobs.manager.transaction(m => this.providerAccount(m, actor.sub));
    const account = await this.jobs.manager.getRepository(WalletAccount).findOneBy({key});
    const query = this.jobs.createQueryBuilder('job').where(provider ? 'job."mechanicId" = :id' : 'job."customerId" = :id', {id: actor.sub}).orderBy('job.createdAt', 'DESC').addOrderBy('job.id', 'DESC').take(21);
    if (before) {
      const cursor = await this.jobs.findOneBy({id: before});
      if (!cursor) throw new BadRequestException('Invalid history cursor');
      query.andWhere('(job."createdAt", job.id) < (:created, :cursorId)', {created: cursor.createdAt, cursorId: cursor.id});
    }
    const rows = await query.getMany();
    const count = account ? await this.jobs.manager.getRepository(PaymentLedger).countBy({fromAccount: {id: account.id}, kind: 'WITHDRAWAL_REQUESTED', createdAt: MoreThanOrEqual(withdrawalWeek())}) : 0;
    const legacyCount = provider ? await this.jobs.manager.getRepository(WalletTransaction).countBy({mechanic: {id: actor.sub}, status: WalletStatus.WITHDRAWN, createdAt: MoreThanOrEqual(withdrawalWeek())}) : 0;
    return {paymentMode: paymentMode(), balance: money(account?.balanceMinor ?? '0'), currency: 'INR', withdrawalsRemaining: Math.max(0, 5 - count - legacyCount), jobs: rows.slice(0,20).map(job => this.publicJob(job, provider)), nextCursor: rows.length > 20 ? rows[19].id : null};
  }
  async transactions(actor: Actor, before?: string) {
    await this.jobs.manager.transaction(ensurePaymentEnvironment);
    const provider = ['MECHANIC', 'FLEET_DRIVER'].includes(actor.role);
    const key = (provider ? 'provider:' : 'customer:') + actor.sub;
    const q = this.jobs.manager.getRepository(PaymentLedger).createQueryBuilder('entry')
      .leftJoinAndSelect('entry.fromAccount', 'source').leftJoinAndSelect('entry.toAccount', 'destination').leftJoinAndSelect('entry.job', 'job')
      .where(provider ? '(source.key = :key OR destination.key = :key OR job."mechanicId" = :actorId)' : '(source.key = :key OR destination.key = :key OR job."customerId" = :actorId)', {key, actorId: actor.sub})
      .orderBy('entry.createdAt', 'DESC').addOrderBy('entry.id', 'DESC').take(21);
    if (!provider) q.andWhere('entry.kind NOT IN (:...internalKinds)', {internalKinds: ['PROVIDER_CREDIT', 'COMPANY_COMMISSION', 'PLATFORM_FEE']});
    if (before) {
      const cursor = await this.jobs.manager.getRepository(PaymentLedger).findOneBy({id: before});
      if (!cursor) throw new BadRequestException('Invalid transaction cursor');
      q.andWhere('(entry."createdAt", entry.id) < (:created, :cursorId)', {created: cursor.createdAt, cursorId: cursor.id});
    }
    const rows = await q.getMany();
    const transactions = await Promise.all(rows.slice(0,20).map(async row => ({id: row.id, jobId: row.job?.id ?? null, kind: row.kind, description: row.description, amount: money(row.amountMinor), currency: row.currency, direction: row.toAccount.key === key ? 'CREDIT' : row.fromAccount.key === key ? 'DEBIT' : 'JOB_PAYMENT', createdAt: row.createdAt,
      allocations: row.kind === 'WITHDRAWAL_REQUESTED' ? (await this.jobs.manager.getRepository(WithdrawalAllocation).find({where: {withdrawal: {id: row.id}}, relations: {job: true}})).map(a => ({jobId: a.job?.id ?? null, amount: money(a.amountMinor)})) : []})));
    return {transactions, nextCursor: rows.length > 20 ? rows[19].id : null};
  }
  async detail(id: string, actor: Actor) {
    return this.jobs.manager.transaction(async m => {
      const job = await this.lockedJob(m, id, actor);
      const events = await m.getRepository(JobEvent).find({where: {job: {id}}, order: {createdAt: 'ASC', id: 'ASC'}});
      const entries = await m.getRepository(PaymentLedger).find({where: {job: {id}}, order: {createdAt: 'ASC', id: 'ASC'}});
      // Never expose joined user records (password/reset fields) in history.
      const provider = actor.role !== 'CUSTOMER';
      return {job: this.publicJob(job, provider), events: events.map(({job: _, ...e}) => provider ? e : {id: e.id, type: e.type, createdAt: e.createdAt, details: {}}), payments: entries.filter(e => provider || !['PROVIDER_CREDIT', 'COMPANY_COMMISSION', 'PLATFORM_FEE'].includes(e.kind)).map(e => ({id: e.id, kind: e.kind, amount: money(e.amountMinor), currency: e.currency, createdAt: e.createdAt}))};
    });
  }
  private publicJob(job: ServiceRequest, provider: boolean) {
    const {customer, mechanic, completionOtp, commissionBps, commissionMinor, providerNetMinor, pricingRevision, travelingCharge, serviceCharge, ...safe} = job;
    const customerView = {...safe, quotationAmount: money(minorUnits(job.totalAmount) - BigInt(job.platformFeeMinor || '0')), platformFee: money(job.platformFeeMinor || '0')};
    return provider ? {...customerView, commissionBps, commission: money(commissionMinor || '0'), providerNet: money(providerNetMinor ?? minorUnits(job.totalAmount)), travelingCharge, serviceCharge, pricingRevision} : customerView;
  }
}
