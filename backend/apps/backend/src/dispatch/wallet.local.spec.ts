import { DataSource } from 'typeorm';
import { PaymentLedger, WalletAccount, WithdrawalAllocation, JobEvent } from '@app/common/entities/payment-ledger.entity';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HttpThrottlerGuard } from '../auth/guards/http-throttler.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DispatchController } from './dispatch.controller';
import { Agent, request } from 'http';
import { join } from 'path';
import { readFileSync } from 'fs';
import { DispatchService } from './dispatch.service';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { CustUser } from '@app/common/entities/cust-user.entity';
import {
  ServiceRequest,
  JobStatus,
} from '@app/common/entities/service-request.entity';
import {
  WalletTransaction,
  WalletStatus,
} from '@app/common/entities/wallet-transaction.entity';

// Opt-in: an isolated disposable schema in the local Docker database only.
const localTests =
  process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;
jest.setTimeout(60000);
localTests('Local PostgreSQL wallet concurrency', () => {
  const schema = `qm_test_${Date.now()}`;
  let db: DataSource;
  let service: DispatchService;
  let mechanic: ProviderUser;
  let customer: CustUser;
  beforeAll(async () => {
    db = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      username: 'postgres',
      password: process.env.QM_LOCAL_DB_PASSWORD || 'password123',
      database: 'QuickMechanic',
      schema,
      synchronize: false,
      entities: [
        join(__dirname, '../../../../libs/common/src/entities/*.entity.ts'),
      ],
    });
    await db.initialize();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.synchronize();
    const migration = db.createQueryRunner();
    await migration.connect();
    try {
      await migration.query(`SET search_path TO "${schema}", public`);
      await migration.query(readFileSync(join(__dirname, '../../../../../scripts/job-ledger-migration.sql'), 'utf8'));
      await migration.query(readFileSync(join(__dirname, '../../../../../scripts/pricing-policy-migration.sql'), 'utf8'));
    } finally { await migration.query('SET search_path TO public'); await migration.release(); }
    mechanic = await db
      .getRepository(ProviderUser)
      .save({
        name: 'Local test mechanic',
        email: 'mechanic@test.invalid',
        phoneNumber: '9876500001',
        passwordHash: 'not-a-login',
      });
    customer = await db
      .getRepository(CustUser)
      .save({
        name: 'Local test customer',
        email: 'customer@test.invalid',
        phoneNumber: 'test-customer',
        passwordHash: 'not-a-login',
      });
    await db
      .getRepository(MechanicProfile)
      .save({ user: mechanic, walletBalance: 100, kycStatus: 'APPROVED' as any, kycDocumentsVerified: true });
    service = new DispatchService(
      db.getRepository(MechanicProfile),
      db.getRepository(ServiceRequest),
      db.getRepository(WalletTransaction),
      { server: { to: () => ({ emit: () => {} }) } } as any,
    );
  }, 30000);
  afterAll(async () => {
    if (db?.isInitialized) {
      if (!/^qm_test_\d+$/.test(schema)) throw new Error('Invalid test schema');
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.destroy();
    }
  });
  it('allows only one concurrent withdrawal of the same balance', async () => {
    const results = await Promise.all([
      service.withdrawFunds(mechanic.id),
      service.withdrawFunds(mechanic.id),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(
      await db
        .getRepository(PaymentLedger)
        .countBy({ kind: 'WITHDRAWAL_REQUESTED' }),
    ).toBe(1);
  });
  it('creates one escrow and one wallet credit under duplicate requests', async () => {
    const job = await db
      .getRepository(ServiceRequest)
      .save({
        customer,
        mechanic,
        serviceType: 'TEST',
        status: JobStatus.AWAITING_PAYMENT,
        totalAmount: 50,
        breakdownLocation: { type: 'Point', coordinates: [77, 12] } as any,
      });
    const payments = await Promise.all([
      service.mockPay(job.id, customer.id),
      service.mockPay(job.id, customer.id),
    ]);
    expect(payments.filter((result) => result.success)).toHaveLength(1);
    const paid = await db
      .getRepository(ServiceRequest)
      .findOneByOrFail({ id: job.id });
    expect((await service.payments.startJourney(job.id, mechanic.id)).success).toBe(true);
    const completions = await Promise.all([
      service.completeJob(job.id, mechanic.id, paid.completionOtp),
      service.completeJob(job.id, mechanic.id, paid.completionOtp),
    ]);
    expect(completions.filter((result) => result.success)).toHaveLength(1);
    const awaiting = await db.getRepository(MechanicProfile).findOneByOrFail({user: {id: mechanic.id}});
    expect(Number(awaiting.walletBalance)).toBe(0);
    expect((await db.getRepository(ServiceRequest).findOneByOrFail({id: job.id})).status).toBe(JobStatus.AWAITING_CUSTOMER_CONFIRMATION);
    const approvals = await Promise.all(Array.from({length: 20}, () => service.payments.confirmCompletion(job.id, customer.id)));
    expect(approvals.filter(result => result.success)).toHaveLength(1);
    const profile = await db
      .getRepository(MechanicProfile)
      .findOneByOrFail({ user: { id: mechanic.id } });
    expect(Number(profile.walletBalance)).toBe(50);
    expect(
      await db
        .getRepository(WalletTransaction)
        .countBy({ serviceRequest: { id: job.id } }),
    ).toBe(1);
    const reviews = await Promise.all(Array.from({length: 20}, () => service.rateJob(job.id, 5, customer.id)));
    expect(reviews.filter(result => result.success)).toHaveLength(1);
    const reviewedProfile = await db.getRepository(MechanicProfile).findOneByOrFail({user: {id: mechanic.id}});
    expect(reviewedProfile.fiveStarReviewsCount).toBe(1);
    expect(reviewedProfile.reputationPoints).toBe(110);
  });

  it('refunds a customer wallet once when either participant cancels a funded job', async () => {
    for (const role of ['MECHANIC', 'CUSTOMER']) {
      const job = await db.getRepository(ServiceRequest).save({customer, mechanic, serviceType: 'REFUND', status: JobStatus.AWAITING_PAYMENT, totalAmount: 12.34, breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any});
      await service.mockPay(job.id, customer.id);
      await db.getRepository(ServiceRequest).update(job.id, {status: JobStatus.EN_ROUTE});
      const actor = role === 'CUSTOMER' ? customer.id : mechanic.id;
      const results = await Promise.all(Array.from({length: 10}, () => service.cancelJob(job.id, actor, role, 'Traffic emergency')));
      expect(results.filter(r => r.success)).toHaveLength(1);
      expect(await db.getRepository(PaymentLedger).countBy({job: {id: job.id}, kind: 'CUSTOMER_REFUND'})).toBe(1);
      expect((await db.getRepository(WalletAccount).findOneByOrFail({key: 'escrow:' + job.id})).balanceMinor).toBe('0');
    }
    expect((await db.getRepository(WalletAccount).findOneByOrFail({key: 'customer:' + customer.id})).balanceMinor).toBe('1234');
  });

  it('serializes cancellation versus customer completion without a double payment', async () => {
    const job = await db.getRepository(ServiceRequest).save({customer, mechanic, serviceType: 'RACE', status: JobStatus.AWAITING_PAYMENT, totalAmount: 10, breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any});
    await service.mockPay(job.id, customer.id);
    await service.completeJob(job.id, mechanic.id);
    await expect(service.payments.confirmCompletion(job.id, mechanic.id)).rejects.toThrow('Not your job');
    const results = await Promise.all([service.payments.confirmCompletion(job.id, customer.id), service.cancelJob(job.id, mechanic.id, 'MECHANIC', 'Emergency')]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    const entries = await db.getRepository(PaymentLedger).find({where: {job: {id: job.id}}});
    expect(entries.filter(e => ['CUSTOMER_REFUND', 'PROVIDER_CREDIT'].includes(e.kind))).toHaveLength(1);
    expect((await db.getRepository(WalletAccount).findOneByOrFail({key: 'escrow:' + job.id})).balanceMinor).toBe('0');
  });

  it('enforces five weekly withdrawals and retains per-job allocations and retry IDs', async () => {
    const provider = await db.getRepository(ProviderUser).save({name: 'Withdrawal test', email: 'withdraw@test.invalid', phoneNumber: 'withdraw-test', passwordHash: 'not-a-login'});
    await db.getRepository(MechanicProfile).save({user: provider, walletBalance: 0});
    for (let i = 0; i < 6; i++) {
      const job = await db.getRepository(ServiceRequest).save({customer, mechanic: provider, serviceType: 'WITHDRAW', status: JobStatus.AWAITING_PAYMENT, totalAmount: 1.25, breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any});
      await service.mockPay(job.id, customer.id); await service.completeJob(job.id, provider.id); await service.payments.confirmCompletion(job.id, customer.id);
      const result = await service.withdrawFunds(provider.id, 'request-' + i);
      expect(result.success).toBe(i < 5);
      if (i < 5) expect((await service.withdrawFunds(provider.id, 'request-' + i)).success).toBe(true);
    }
    expect(await db.getRepository(WithdrawalAllocation).countBy({providerId: provider.id})).toBe(5);
    expect((await service.payments.history({sub: provider.id, role: 'MECHANIC'})).balance).toBe('1.25');
    const history = await service.payments.transactions({sub: provider.id, role: 'MECHANIC'});
    expect(history.transactions.filter(t => t.kind === 'WITHDRAWAL_REQUESTED')).toHaveLength(5);
    expect(history.transactions.filter(t => t.kind === 'WITHDRAWAL_REQUESTED').every(t => t.allocations.length === 1 && t.allocations[0].jobId)).toBe(true);
  }, 30000);

  it('records captured Razorpay payments once and refunds late captures after cancellation', async () => {
    const job = await db.getRepository(ServiceRequest).save({customer, mechanic, serviceType: 'RAZORPAY', status: JobStatus.AWAITING_PAYMENT, customerAcceptedAt: new Date(), totalAmount: 23.45, breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any});
    const payload = {event: 'payment_link.paid', payload: {payment_link: {entity: {id: 'plink_test', reference_id: job.id, status: 'paid', currency: 'INR', amount: 2345, amount_paid: 2345}}, payment: {entity: {id: 'pay_test', status: 'captured', currency: 'INR', amount: 2345}}}};
    await Promise.all(Array.from({length: 10}, () => service.payments.gatewayCaptured(payload)));
    expect(await db.getRepository(PaymentLedger).countBy({reference: 'razorpay:pay_test'})).toBe(1);
    expect((await db.getRepository(ServiceRequest).findOneByOrFail({id: job.id})).status).toBe(JobStatus.PAYMENT_SECURED);
    await service.cancelJob(job.id, customer.id, 'CUSTOMER', 'Test completed');
    const late = await db.getRepository(ServiceRequest).save({customer, mechanic, serviceType: 'LATE', status: JobStatus.AWAITING_PAYMENT, customerAcceptedAt: new Date(), totalAmount: 23.45, breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any});
    await service.cancelJob(late.id, customer.id, 'CUSTOMER', 'No longer needed');
    const latePayload = JSON.parse(JSON.stringify(payload)); latePayload.payload.payment_link.entity.reference_id = late.id; latePayload.payload.payment.entity.id = 'pay_late';
    await service.payments.gatewayCaptured(latePayload);
    expect((await db.getRepository(ServiceRequest).findOneByOrFail({id: late.id})).status).toBe(JobStatus.CANCELLED);
    expect(await db.getRepository(PaymentLedger).countBy({job: {id: late.id}, kind: 'LATE_PAYMENT_REFUND'})).toBe(1);
  });

  it('handles a burst of 1000 competing accept operations with one active job', async () => {
    const profile = await db.getRepository(MechanicProfile).findOneByOrFail({user: {id: mechanic.id}});
    const gated = await db.getRepository(ServiceRequest).save({customer, mechanic, serviceType: 'KYC_GATE', status: JobStatus.REQUESTED,
      breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any});
    await db.getRepository(MechanicProfile).update(profile.id, {kycStatus: 'PENDING' as any});
    await expect(service.acceptJob(gated.id, mechanic.id)).rejects.toThrow('Complete KYC');
    await db.getRepository(MechanicProfile).update(profile.id, {kycStatus: 'APPROVED' as any});
    await db.getRepository(ProviderUser).update(mechanic.id, {phoneNumber: 'missing'});
    await expect(service.acceptJob(gated.id, mechanic.id)).rejects.toThrow('mobile number');
    await db.getRepository(ProviderUser).update(mechanic.id, {phoneNumber: '9876500001'});
    await db.getRepository(ServiceRequest).delete(gated.id);
    const jobs = await db.getRepository(ServiceRequest).save(Array.from({length: 10}, () => ({
      customer, mechanic, serviceType: 'LOAD_TEST', status: JobStatus.REQUESTED,
      breakdownLocation: {type: 'Point', coordinates: [77, 12]} as any,
    })));
    const started = Date.now();
    const results = await Promise.all(Array.from({length: 1000}, (_, i) => service.acceptJob(jobs[i % jobs.length].id, mechanic.id)));
    expect(results.filter(result => result.success)).toHaveLength(1);
    const recovered = await service.activeJob(mechanic.id);
    expect(recovered.job?.status).toBe(JobStatus.ACCEPTED);
    expect(jobs.map(job => job.id)).toContain(recovered.job?.id);
    expect(results.filter(result => !result.success).every(result => (result as any).activeJobId === recovered.job?.id)).toBe(true);
    expect(await db.getRepository(ServiceRequest).countBy({mechanic: {id: mechanic.id}, status: JobStatus.ACCEPTED})).toBe(1);
    process.stdout.write(`1000 competing database operations: ${Date.now() - started} ms\n`);
  }, 120000);

  it('serves a burst of 1000 authenticated discovery requests over 100 HTTP connections', async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({secret: 'local-load-test-only'}), ThrottlerModule.forRoot([{ttl: 60000, limit: 120}])],
      controllers: [DispatchController],
      providers: [{provide: DispatchService, useValue: service}, JwtAuthGuard, {provide: APP_GUARD, useClass: HttpThrottlerGuard}],
    }).compile();
    const app = module.createNestApplication({logger: false});
    await app.listen(0, '127.0.0.1');
    const agent = new Agent({keepAlive: true, maxSockets: 100});
    try {
      const base = await app.getUrl();
      const jwt = module.get(JwtService);
      const tokens = Array.from({length: 1000}, (_, i) => jwt.sign({sub: `synthetic-customer-${i}`, role: 'CUSTOMER'}));
      const started = Date.now();
      const outcomes = await Promise.allSettled(tokens.map(token => new Promise<number>((resolve, reject) => {
        const req = request(base + '/dispatch/nearby', {agent, method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token}}, response => {
          response.resume();
          response.on('end', () => resolve(response.statusCode!));
          response.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(60000, () => req.destroy(new Error('Load request timed out')));
        req.end(JSON.stringify({lat: 12, lng: 77}));
      })));
      const statuses = outcomes.filter((result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled').map(result => result.value);
      process.stdout.write(`HTTP responses: ${statuses.length}; rejected connections: ${outcomes.length - statuses.length}; statuses: ${[...new Set(statuses)]}\n`);
      expect(statuses).toHaveLength(1000);
      expect(statuses.every(status => status === 201)).toBe(true);
      process.stdout.write(`1000 local discovery HTTP requests over 100 connections: ${Date.now() - started} ms\n`);
    } finally { agent.destroy(); await app.close(); }
  }, 120000);
});
