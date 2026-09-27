import { DataSource } from 'typeorm';
import { join } from 'path';
import { readFileSync } from 'fs';
import { AdmUser, AdmUserRole } from '@app/common/entities/adm-user.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { CustUser } from '@app/common/entities/cust-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { ServiceRequest, JobStatus } from '@app/common/entities/service-request.entity';
import { WalletTransaction } from '@app/common/entities/wallet-transaction.entity';
import { PaymentLedger, WalletAccount } from '@app/common/entities/payment-ledger.entity';
import { PricingPolicy } from '@app/common/entities/pricing-policy.entity';
import { DispatchService } from './dispatch.service';
import { FinanceController } from './finance.controller';
import { calculateQuote, ensurePaymentEnvironment } from './pricing';

describe('Quotation calculation',()=>{
  it('deducts commission from quotation and charges the customer platform fee separately',()=>{
    expect(calculateQuote('1000',1500,'200')).toEqual({providerNetMinor:'85000',commissionMinor:'15000',platformFeeMinor:'200',commissionBps:1500,quotationAmount:'1000.00',totalAmount:1002});
    expect(calculateQuote('0.10',1500,'500').commissionMinor).toBe('2');
    expect(()=>calculateQuote('100',1500,'100')).toThrow('Platform fee');
    expect(()=>calculateQuote('100',1500,'501')).toThrow('Platform fee');
  });
});

const local = process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;
local('Local simulation and admin pricing',()=>{
  let db:DataSource, service:DispatchService, finance:FinanceController;
  let provider:ProviderUser, customer:CustUser, admin:AdmUser;
  const schema='qm_pricing_test_'+Date.now();
  const originalMode=process.env.PAYMENT_MODE;
  const point={type:'Point',coordinates:[77,12]} as any;
  beforeAll(async()=>{
    process.env.PAYMENT_MODE='simulation';
    db=new DataSource({type:'postgres',host:'127.0.0.1',port:5432,username:'postgres',password:process.env.QM_LOCAL_DB_PASSWORD||'password123',database:'QuickMechanic',schema,synchronize:false,entities:[join(__dirname,'../../../../libs/common/src/entities/*.entity.ts')]});
    await db.initialize();await db.query(`CREATE SCHEMA "${schema}"`);await db.synchronize();
    const runner=db.createQueryRunner();await runner.connect();
    try {await runner.query(`SET search_path TO "${schema}", public`);for(const file of ['job-ledger-migration.sql','pricing-policy-migration.sql'])await runner.query(readFileSync(join(__dirname,'../../../../../scripts',file),'utf8'));}
    finally{await runner.query('SET search_path TO public');await runner.release();}
    provider=await db.getRepository(ProviderUser).save({name:'Pricing provider',email:'pricing@test.invalid',phoneNumber:'9876500002',passwordHash:'not-a-login'});
    customer=await db.getRepository(CustUser).save({name:'Pricing customer',email:'customer@test.invalid',phoneNumber:'pricing-customer',passwordHash:'not-a-login'});
    admin=await db.getRepository(AdmUser).save({name:'Pricing admin',email:'admin@test.invalid',passwordHash:'not-a-login',role:AdmUserRole.SUPER_ADMIN});
    await db.getRepository(MechanicProfile).save({user:provider,walletBalance:0,kycStatus:'APPROVED' as any,kycDocumentsVerified:true});
    service=new DispatchService(db.getRepository(MechanicProfile),db.getRepository(ServiceRequest),db.getRepository(WalletTransaction),{server:{to:()=>({emit:()=>{}})}} as any);
    finance=new FinanceController(db);
  },30000);
  afterAll(async()=>{if(originalMode===undefined)delete process.env.PAYMENT_MODE;else process.env.PAYMENT_MODE=originalMode;if(db?.isInitialized){await db.query(`DROP SCHEMA "${schema}" CASCADE`);await db.destroy();}});
  it('authorizes real admins, rejects forged role claims and validates fee bounds',async()=>{
    await expect(finance.settings({user:{sub:provider.id,role:'SUPER_ADMIN'}})).rejects.toThrow('Finance access');
    await expect(finance.update({user:{sub:admin.id}},{commissionPercent:'15',platformFee:'6',expectedRevision:0})).rejects.toThrow('2–5');
    expect((await finance.settings({user:{sub:admin.id}})).policy.platformFeeMinor).toBe('200');
  });
  it('freezes the shown rate, splits completion exactly once, and keeps commission out of customer history',async()=>{
    const policy=await finance.update({user:{sub:admin.id}},{commissionPercent:'15',platformFee:'2',expectedRevision:0});
    const job=await db.getRepository(ServiceRequest).save({customer,mechanic:provider,status:JobStatus.ACCEPTED,serviceType:'REPAIR',breakdownLocation:point});
    expect((await service.sendQuote(job.id,provider.id,1,0,1000,1000,policy.revision)).success).toBe(true);
    const saved=await db.getRepository(ServiceRequest).findOneByOrFail({id:job.id});
    expect(Number(saved.totalAmount)).toBe(1002);
    await finance.update({user:{sub:admin.id}},{commissionPercent:'20',platformFee:'5',expectedRevision:policy.revision});
    await expect(finance.update({user:{sub:admin.id}},{commissionPercent:'30',platformFee:'3',expectedRevision:policy.revision})).rejects.toThrow('Another administrator');
    const preview=await service.payments.pay(job.id,customer.id);
    expect(preview.simulationRequired).toBe(true);
    expect((await service.payments.pay(job.id,customer.id,false,'failed')).success).toBe(false);
    expect(await db.getRepository(PaymentLedger).count()).toBe(0);
    const paid=await Promise.all(Array.from({length:10},()=>service.payments.pay(job.id,customer.id,false,'success')));
    expect(paid.filter(p=>p.success)).toHaveLength(1);
    await service.payments.requestCompletion(job.id,provider.id);
    const approvals=await Promise.all(Array.from({length:10},()=>service.payments.confirmCompletion(job.id,customer.id)));
    expect(approvals.filter(p=>p.success)).toHaveLength(1);
    for(const [key,amount] of [['provider:'+provider.id,'85000'],['company:commission','15000'],['company:platform-fee','200'],['escrow:'+job.id,'0']])expect((await db.getRepository(WalletAccount).findOneByOrFail({key})).balanceMinor).toBe(amount);
    const detail=await service.payments.detail(job.id,{sub:customer.id,role:'CUSTOMER'});
    expect(detail.job).not.toHaveProperty('commissionBps');
    expect(JSON.stringify(detail)).not.toContain('COMPANY_COMMISSION');
    expect((await service.payments.transactions({sub:customer.id,role:'CUSTOMER'})).transactions.some(t=>t.kind==='PROVIDER_CREDIT')).toBe(false);
    const collections=await finance.collections({user:{sub:admin.id}});
    expect(collections.providers[0].commission).toBe('150.00');
    expect(collections.providers[0].available).toBe('850.00');
    const withdrawal=await service.payments.withdraw(provider.id,'simulation-withdraw-1');
    expect(withdrawal.message).toContain('No bank transfer');
  });
  it('rejects stale provider pricing and refunds the full customer total without company revenue',async()=>{
    const policy=(await finance.settings({user:{sub:admin.id}})).policy;
    const job=await db.getRepository(ServiceRequest).save({customer,mechanic:provider,status:JobStatus.ACCEPTED,serviceType:'CANCEL',breakdownLocation:point});
    await expect(service.sendQuote(job.id,provider.id,1,0,100,100,0)).rejects.toThrow('Pricing changed');
    await service.sendQuote(job.id,provider.id,1,0,100,100,policy.revision);
    await service.payments.pay(job.id,customer.id,false,'success');
    await service.payments.cancel(job.id,{sub:provider.id,role:'MECHANIC'},'Traffic emergency');
    expect((await db.getRepository(WalletAccount).findOneByOrFail({key:'customer:'+customer.id})).balanceMinor).toBe('10500');
    expect(await db.getRepository(PaymentLedger).countBy({job:{id:job.id},kind:'COMPANY_COMMISSION'})).toBe(0);
  });
  it('prevents simulated balances being used in live mode and preserves immutable policy history',async()=>{
    process.env.PAYMENT_MODE='live';
    try{await expect(db.transaction(ensurePaymentEnvironment)).rejects.toThrow('environment mismatch');}finally{process.env.PAYMENT_MODE='simulation';}
    const p=await db.getRepository(PricingPolicy).findOneByOrFail({revision:1});
    await expect(db.getRepository(PricingPolicy).update(p.revision,{commissionBps:999})).rejects.toThrow();
  });
});
