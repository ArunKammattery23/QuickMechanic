import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { createServer, Server } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { WsJwtGuard } from './auth/guards/ws-jwt.guard';
import { HttpThrottlerGuard } from './auth/guards/http-throttler.guard';
import { DispatchService } from './dispatch/dispatch.service';
import { DispatchController } from './dispatch/dispatch.controller';
import { FinanceController } from './dispatch/finance.controller';
import { UsersService } from './users/users.service';
import { UsersController } from './users/users.controller';
import { LocationGateway } from './location/location.gateway';
import { JobAccessService } from './location/job-access.service';
import { CallGateway } from './dispatch/call.gateway';
import { RedisIoAdapter } from './redis.adapter';
import { AdmUser, AdmUserRole } from '@app/common/entities/adm-user.entity';
import { CustUser } from '@app/common/entities/cust-user.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { ProviderKycSubmission } from '@app/common/entities/provider-kyc-submission.entity';
import { SupportTicket, SupportMessage } from '@app/common/entities/support-ticket.entity';
import { SupportController } from './support/support.controller';
import { SupportService } from './support/support.service';
import { ServiceRequest, JobStatus } from '@app/common/entities/service-request.entity';
import { MechanicPricing } from '@app/common/entities/mechanic-pricing.entity';
import { ServiceType } from '@app/common/entities/service-type.entity';
import { VehicleCategory } from '@app/common/entities/vehicle-category.entity';
import { Invoice } from '@app/common/entities/invoice.entity';
import { WalletTransaction } from '@app/common/entities/wallet-transaction.entity';
import { PaymentLedger, WalletAccount } from '@app/common/entities/payment-ledger.entity';

const local = process.env.RUN_LOCAL_DB_TESTS === '1' ? describe : describe.skip;
const WebSocketClient = require('ws');
jest.setTimeout(120000);

// Real HTTP, PostgreSQL/PostGIS, Redis and Socket.IO. Only the external road
// routing service and payment processor are simulated. No production URLs used.
local('Local workflow and concurrent-user acceptance', () => {
  const schema = `qm_workflow_${Date.now()}`;
  const savedEnv = { ...process.env };
  let db: DataSource, app: INestApplication, redis: Redis, router: Server;
  let base: string, jwt: JwtService, auth: AuthService;
  let admin: AdmUser, serviceType: ServiceType, vehicle: VehicleCategory;
  let customer: CustUser, provider: ProviderUser;
  const password = 'Local-test-password-123';
  const sockets: any[] = [];
  const timings: number[] = [];
  const token = (user: {id: string; role: string}) => jwt.sign({sub: user.id, role: user.role});
  async function http(path: string, method = 'GET', body?: unknown, bearer?: string) {
    const started = performance.now();
    const response = await fetch(base + path, {
      method, headers: {'Content-Type': 'application/json', ...(bearer ? {Authorization: `Bearer ${bearer}`} : {})},
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    timings.push(performance.now() - started);
    return {status: response.status, data};
  }
  async function jobFor(p: ProviderUser, c: CustUser, status = JobStatus.REQUESTED) {
    return db.getRepository(ServiceRequest).save({customer: c, mechanic: p, status,
      serviceType: serviceType.name, vehicleCategoryId: vehicle.id,
      breakdownLocation: {type: 'Point', coordinates: [77.01,12.01]} as any});
  }
  async function submitKyc(p: ProviderUser) {
    const bytes = Buffer.alloc(1100);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
    const form = new FormData();
    form.set('idType','DRIVING_LICENCE');
    form.set('address','12 Test Street, Bengaluru, Karnataka');
    form.set('secondaryPhone',`9877${p.id.replace(/-/g,'').slice(0,6).replace(/[a-f]/g,'1')}`);
    form.set('front',new Blob([bytes],{type:'image/png'}),'front.png');
    form.set('back',new Blob([bytes],{type:'image/png'}),'back.png');
    const response = await fetch(base+'/users/me/kyc',{method:'POST',headers:{Authorization:`Bearer ${token(p)}`},body:form});
    if(response.status!==201)throw new Error(`KYC submission ${response.status}: ${await response.text()}`);
    const summary = await http('/users/me/kyc','GET',undefined,token(p));
    expect(summary.data.submitted).toBe(true);
    return summary.data.submittedAt as string;
  }
  async function configure(p: ProviderUser) {
    const profile = await db.getRepository(MechanicProfile).findOneByOrFail({user: {id:p.id}});
    await db.getRepository(MechanicProfile).save({...profile, kycStatus: 'APPROVED' as any, kycDocumentsVerified: true, providedServices: [serviceType], supportedVehicles: [vehicle],
      isOnline: true, lastSeenAt: new Date(), currentLocation: {type:'Point',coordinates:[77,12]} as any});
    await db.getRepository(MechanicPricing).save({mechanicProfile: profile, serviceType, vehicleCategory: vehicle, price: 100});
  }
  beforeAll(async () => {
    process.env.PAYMENT_MODE = 'simulation';
    db = new DataSource({type:'postgres',host:'127.0.0.1',port:5432,username:'postgres',
      password:process.env.QM_LOCAL_DB_PASSWORD || 'password123',database:'QuickMechanic',schema,
      entities:[join(__dirname,'../../../libs/common/src/entities/*.entity.ts')],synchronize:false});
    await db.initialize(); await db.query(`CREATE SCHEMA "${schema}"`); await db.synchronize();
    const runner = db.createQueryRunner(); await runner.connect();
    try {
      await runner.query(`SET search_path TO "${schema}", public`);
      for (const file of ['job-ledger-migration.sql','pricing-policy-migration.sql','automatic-travel-migration.sql','support-tickets-migration.sql'])
        await runner.query(readFileSync(join(__dirname,'../../../../scripts',file),'utf8'));
    } finally {await runner.query('SET search_path TO public'); await runner.release();}
    redis = new Redis({host:'127.0.0.1',port:6379,maxRetriesPerRequest:1,keyPrefix:schema+':'});
    await redis.ping();
    router = createServer((_req,res) => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:'Ok',routes:[{distance:3000}]}));});
    await new Promise<void>(resolve => router.listen(0,'127.0.0.1',resolve));
    process.env.OSRM_BASE_URL = `http://127.0.0.1:${(router.address() as any).port}`;
    const entities = [AdmUser,CustUser,ProviderUser,MechanicProfile,ProviderKycSubmission,SupportTicket,SupportMessage,ServiceRequest,MechanicPricing,VehicleCategory,Invoice,WalletTransaction];
    const module = await Test.createTestingModule({
      imports:[JwtModule.register({secret:'workflow-local-only'}),ThrottlerModule.forRoot([{ttl:60000,limit:120}])],
      controllers:[AuthController,DispatchController,FinanceController,UsersController,SupportController],
      providers:[AuthService,DispatchService,UsersService,SupportService,LocationGateway,CallGateway,JobAccessService,JwtAuthGuard,WsJwtGuard,
        {provide:APP_GUARD,useClass:HttpThrottlerGuard},{provide:DataSource,useValue:db},
        {provide:RedisService,useValue:{getOrThrow:()=>redis}},
        ...entities.map(entity=>({provide:getRepositoryToken(entity),useValue:db.getRepository(entity)}))],
    }).compile();
    app=module.createNestApplication({logger:['error']});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true}));
    const adapter=new RedisIoAdapter(app); await adapter.connectToRedis('redis://127.0.0.1:6379'); app.useWebSocketAdapter(adapter);
    await app.listen(0,'127.0.0.1'); base=await app.getUrl(); jwt=module.get(JwtService); auth=module.get(AuthService);
    admin=await db.getRepository(AdmUser).save({email:'admin@workflow.invalid',name:'Test Admin',role:AdmUserRole.SUPER_ADMIN,passwordHash:await bcrypt.hash(password,10)});
    serviceType=await db.getRepository(ServiceType).save({name:'Workflow repair'});
    vehicle=await db.getRepository(VehicleCategory).save({name:'Test hatchback',group:'4 Wheeler'});
    const c=await auth.registerCustomer({email:'customer@workflow.invalid',password,phoneNumber:'workflow-c'});
    const p=await auth.registerMechanic({email:'provider@workflow.invalid',password,phoneNumber:'9876500003'});
    customer=await db.getRepository(CustUser).findOneByOrFail({id:c.id});provider=await db.getRepository(ProviderUser).findOneByOrFail({id:p.id});
    await configure(provider);
  });
  afterAll(async () => {
    sockets.forEach(socket=>socket.close());
    if(app) await app.close();
    if(redis) {const keys=await redis.keys(schema+':*'); if(keys.length) await redis.call('DEL',...keys); await redis.quit();}
    if(router) await new Promise<void>(resolve=>router.close(()=>resolve()));
    if(db?.isInitialized) {if(!/^qm_workflow_\d+$/.test(schema))throw new Error('Unsafe schema');await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.destroy();}
    for(const key of ['PAYMENT_MODE','OSRM_BASE_URL']) {if(savedEnv[key]===undefined)delete process.env[key];else process.env[key]=savedEnv[key];}
  });

  it('logs admins in, protects finance and rejects malformed credentials without 500s', async () => {
    const login=await http('/auth/admin-login','POST',{email:admin.email,password}); expect(login.status).toBe(201);
    expect((await http('/admin/finance/settings','GET',undefined,login.data.accessToken)).status).toBe(200);
    expect((await http('/admin/finance/settings','GET',undefined,token(customer))).status).toBe(403);
    for(const path of ['/auth/login','/auth/admin-login']) {
      const r=await http(path,'POST',{}); expect(r.status).toBe(401);
    }
  });

  it('lets the admin app review and resolve a customer support ticket', async () => {
    const created = await http('/support/tickets','POST',{subject:'Job payment help',category:'PAYMENT',message:'Please check my payment'},token(customer));
    expect(created.status).toBe(201);
    const id = created.data.id;
    expect((await http('/support/tickets','GET',undefined,token(provider))).data).toEqual([]);
    expect((await http(`/support/tickets/${id}`,'GET',undefined,token(provider))).status).toBe(404);
    expect((await http('/support/admin/tickets','GET',undefined,token(customer))).status).toBe(403);
    const login = await http('/auth/admin-login','POST',{email:admin.email,password});
    const adminToken = login.data.accessToken;
    const inbox = await http('/support/admin/tickets','GET',undefined,adminToken);
    expect(inbox.status).toBe(200);
    expect(inbox.data.some((ticket:any) => ticket.id === id)).toBe(true);
    expect((await http(`/support/tickets/${id}/messages`,'POST',{message:'We are checking this payment.'},adminToken)).status).toBe(201);
    expect((await http(`/support/admin/tickets/${id}/status`,'PATCH',{status:'RESOLVED'},adminToken)).status).toBe(200);
    const detail = await http(`/support/tickets/${id}`,'GET',undefined,token(customer));
    expect(detail.data.ticket.status).toBe('RESOLVED');
    expect(detail.data.messages).toHaveLength(2);
  });

  it('rejects unauthenticated and cross-provider configuration writes', async () => {
    const path=`/users/mechanics/${provider.id}/config`;
    expect((await http(path,'PATCH',{services:[]})).status).toBe(401);
    expect((await http(path,'PATCH',{services:[]},token(customer))).status).toBe(403);
  });

  it('blocks pending-KYC providers from online work and job acceptance', async () => {
    const registered = await auth.registerMechanic({email:'pending@workflow.invalid',password,phoneNumber:'9876508888'});
    const pending = await db.getRepository(ProviderUser).findOneByOrFail({id:registered.id});
    const pendingToken = token(pending);
    const job = await jobFor(pending, customer);
    expect((await http(`/users/mechanics/${pending.id}/status`,'PATCH',{isOnline:true,lat:12,lng:77},pendingToken)).status).toBe(403);
    expect((await http(`/dispatch/job/${job.id}/accept`,'POST',{},pendingToken)).status).toBe(403);
    expect((await http('/users/me/mobile','PATCH',{phoneNumber:'bad'},pendingToken)).status).toBe(400);
    expect((await http(`/users/mechanics/${pending.id}/kyc`,'PATCH',{status:'APPROVED',submittedAt:new Date().toISOString()},token(admin))).status).toBe(400);
    const invalid = new FormData();
    invalid.set('idType','AADHAAR');invalid.set('address','12 Test Street, Bengaluru, Karnataka');invalid.set('secondaryPhone','9877654321');
    invalid.set('front',new Blob([Buffer.alloc(1100)],{type:'image/jpeg'}),'front.jpg');
    invalid.set('back',new Blob([Buffer.alloc(1100)],{type:'image/jpeg'}),'back.jpg');
    expect((await fetch(base+'/users/me/kyc',{method:'POST',headers:{Authorization:`Bearer ${pendingToken}`},body:invalid})).status).toBe(400);
    const submittedAt = await submitKyc(pending);
    const imagePath = `/users/mechanics/${pending.id}/kyc/document/front`;
    expect((await http(imagePath,'GET',undefined,token(customer))).status).toBe(403);
    const adminImage = await fetch(base+imagePath,{headers:{Authorization:`Bearer ${token(admin)}`}});
    expect(adminImage.status).toBe(200);
    expect(adminImage.headers.get('content-type')).toContain('image/png');
    expect((await adminImage.arrayBuffer()).byteLength).toBe(1100);
    expect((await http(`/users/mechanics/${pending.id}/kyc`,'PATCH',{status:'APPROVED',submittedAt:'2020-01-01T00:00:00.000Z'},token(admin))).status).toBe(400);
    expect((await http(`/users/mechanics/${pending.id}/kyc`,'PATCH',{status:'APPROVED',submittedAt},token(admin))).status).toBe(200);
    expect((await http(`/users/mechanics/${pending.id}/status`,'PATCH',{isOnline:true,lat:12,lng:77},pendingToken)).status).toBe(200);
    expect((await http(`/dispatch/job/${job.id}/accept`,'POST',{},pendingToken)).data.success).toBe(true);
    await app.get(DispatchService).cancelJob(job.id,customer.id,'CUSTOMER','Eligibility test cleanup');
  });

  it('rejects incomplete signup and handles concurrent duplicate signup without server errors', async () => {
    for (const role of ['customer', 'mechanic']) {
      const path = `/auth/register/${role}`;
      expect((await http(path, 'POST', {})).status).toBe(400);
      const body = {email:`duplicate-${role}@workflow.invalid`, password, phoneNumber:role === 'mechanic' ? '9876509999' : `duplicate-${role}`};
      const results = await Promise.all(Array.from({length:5}, () => http(path, 'POST', body)));
      expect(results.filter(r => r.status === 201)).toHaveLength(1);
      expect(results.filter(r => r.status === 409)).toHaveLength(4);
      if (role === 'mechanic') {
        const user = await db.getRepository(ProviderUser).findOneByOrFail({email:body.email});
        expect(await db.getRepository(MechanicProfile).countBy({user:{id:user.id}})).toBe(1);
      }
    }
  });

  it('consumes a reset token exactly once under concurrent requests', async () => {
    const resetToken=randomBytes(32).toString('hex');
    await db.getRepository(AdmUser).update(admin.id,{resetToken:createHash('sha256').update(resetToken).digest('hex'),resetTokenExpiry:new Date(Date.now()+60000)});
    const results=await Promise.all(Array.from({length:8},()=>http('/auth/reset-password','POST',{token:resetToken,newPassword:password})));
    expect(results.filter(r=>r.status===201)).toHaveLength(1);
    expect(results.filter(r=>r.status===401)).toHaveLength(7);
  });

  it('serializes repeated configuration saves and clears removed prices', async () => {
    const config={services:[serviceType.id],vehicles:[vehicle.id],pricing:[{serviceId:serviceType.id,vehicleId:vehicle.id,price:100}]};
    const path=`/users/mechanics/${provider.id}/config`;
    const outcomes=await Promise.all(Array.from({length:10},()=>http(path,'PATCH',config,token(provider))));
    expect(outcomes.map(r=>r.status)).toEqual(Array(10).fill(200));
    expect((await http(path)).data.pricing).toHaveLength(1);
    expect((await http(path,'PATCH',{...config,pricing:[]},token(provider))).status).toBe(200);
    expect((await http(path)).data.pricing).toHaveLength(0);
    await http(path,'PATCH',config,token(provider));
  });

  it('cannot accept two jobs by preparing quotes concurrently', async () => {
    const jobs=await Promise.all([jobFor(provider,customer),jobFor(provider,customer)]);
    try {
      await Promise.all(jobs.map(job=>http(`/dispatch/job/${job.id}/prepare-quote`,'POST',{},token(provider))));
      expect(await db.getRepository(ServiceRequest).countBy({mechanic:{id:provider.id},status:JobStatus.ACCEPTED})).toBeLessThanOrEqual(1);
    } finally {for(const job of jobs)await app.get(DispatchService).cancelJob(job.id,customer.id,'CUSTOMER','Regression cleanup');}
  });

  it('runs 20 concurrent customer/provider workflows through real HTTP and balances the ledger', async () => {
    const started=performance.now(); timings.length=0;
    const results=await Promise.allSettled(Array.from({length:20},async(_,i)=>{
      const c=await http('/auth/register/customer','POST',{email:`c${i}@workflow.invalid`,password,phoneNumber:`wc${i}`});expect(c.status).toBe(201);
      const p=await http('/auth/register/mechanic','POST',{email:`p${i}@workflow.invalid`,password,phoneNumber:`9876501${i.toString().padStart(3,'0')}`});expect(p.status).toBe(201);
      const cu=await db.getRepository(CustUser).findOneByOrFail({id:c.data.data.id});
      const pr=await db.getRepository(ProviderUser).findOneByOrFail({id:p.data.data.id});
      const cl=await http('/auth/login','POST',{email:cu.email,password});const pl=await http('/auth/login','POST',{email:pr.email,password});
      expect(cl.status).toBe(201);expect(pl.status).toBe(201);
      const ct=cl.data.accessToken,pt=pl.data.accessToken;
      const submittedAt=await submitKyc(pr);
      expect((await http(`/users/mechanics/${pr.id}/kyc`,'PATCH',{status:'APPROVED',submittedAt},token(admin))).status).toBe(200);
      expect((await http(`/users/mechanics/${pr.id}/config`,'PATCH',{services:[serviceType.id],vehicles:[vehicle.id],pricing:[{serviceId:serviceType.id,vehicleId:vehicle.id,price:100}]},pt)).status).toBe(200);
      expect((await http(`/users/mechanics/${pr.id}/status`,'PATCH',{isOnline:true,lat:12,lng:77},pt)).status).toBe(200);
      const nearby=await http('/dispatch/nearby','POST',{lat:12,lng:77,serviceType:serviceType.name,vehicleCategoryId:vehicle.id},ct);
      expect(nearby.status).toBe(201);expect(nearby.data.data.some((item:any)=>item.user.id===pr.id)).toBe(true);
      const requested=await http('/dispatch/request','POST',{lat:12.01,lng:77.01,mechanicId:pr.id,serviceType:serviceType.name,vehicleCategoryId:vehicle.id},ct);
      expect(requested.data.success).toBe(true);const id=requested.data.jobId;
      const restoredRequest = await http('/dispatch/customer-active-job','GET',undefined,ct);
      expect(restoredRequest.data.job.id).toBe(id);
      expect(restoredRequest.data.job.status).toBe('REQUESTED');
      expect(JSON.stringify(restoredRequest.data)).not.toContain('passwordHash');
      expect((await http('/dispatch/customer-active-job','GET',undefined,pt)).status).toBe(403);
      for(const action of ['accept','prepare-quote','send-quote']) {const r=await http(`/dispatch/job/${id}/${action}`,'POST',{},pt);expect(r.status).toBe(201);}
      const failed=await http(`/dispatch/job/${id}/confirm-payment`,'POST',{simulationResult:'failed'},ct);expect(failed.data.success).toBe(false);
      expect((await http('/dispatch/customer-active-job','GET',undefined,ct)).data.job.status).toBe('AWAITING_PAYMENT');
      const paid=await http(`/dispatch/job/${id}/confirm-payment`,'POST',{simulationResult:'success'},ct);expect(paid.data.success).toBe(true);
      expect((await http('/dispatch/customer-active-job','GET',undefined,ct)).data.job.status).toBe('PAYMENT_SECURED');
      if(i%2===0){
        for(const action of ['start','complete'])expect((await http(`/dispatch/job/${id}/${action}`,'POST',{},pt)).data.success).toBe(true);
        expect((await http(`/dispatch/job/${id}/confirm-completion`,'POST',{},ct)).data.success).toBe(true);
        expect((await http(`/dispatch/job/${id}/rate`,'POST',{rating:5},ct)).data.success).toBe(true);
      }else expect((await http(`/dispatch/job/${id}/cancel`,'POST',{reason:'Test cancellation'},ct)).data.success).toBe(true);
      const detail=await http(`/dispatch/job/${id}`,'GET',undefined,ct);expect(detail.status).toBe(200);
      expect((await http('/dispatch/customer-active-job','GET',undefined,ct)).data.job).toBeNull();
      expect(JSON.stringify(detail.data)).not.toContain('passwordHash');
      expect((await http('/dispatch/history','GET',undefined,pt)).status).toBe(200);
      expect((await db.getRepository(WalletAccount).findOneByOrFail({key:'escrow:'+id})).balanceMinor).toBe('0');
    }));
    const errors=results.filter((r):r is PromiseRejectedResult=>r.status==='rejected');
    const sorted=timings.sort((a,b)=>a-b);
    process.stdout.write(`WORKFLOWS: 20 pairs, ${timings.length} HTTP requests, ${errors.length} failures, elapsed=${Math.round(performance.now()-started)}ms p95=${Math.round(sorted[Math.floor(sorted.length*.95)])}ms\n`);
    expect(errors.map(r=>String(r.reason))).toEqual([]);
    const accounts=await db.getRepository(WalletAccount).find();expect(accounts.reduce((total,a)=>total+BigInt(a.balanceMinor),0n)).toBe(0n);
    expect(await db.getRepository(PaymentLedger).countBy({kind:'PROVIDER_CREDIT'})).toBe(10);
  });

  it('keeps concurrent authenticated sockets connected through repeated GPS broadcasts and reconnects', async () => {
    const count=Number(process.env.QM_SOCKET_PAIRS || 100), soakSeconds=Number(process.env.QM_SOAK_SECONDS || 0), hash=await bcrypt.hash(password,4);
    if(!Number.isInteger(count)||count<1||count>500||!Number.isFinite(soakSeconds)||soakSeconds<0||soakSeconds>300)throw new Error('Invalid bounded local load settings');
    const pairs=await Promise.all(Array.from({length:count},async(_,i)=>{
      const c=await db.getRepository(CustUser).save({email:`sc${i}@workflow.invalid`,phoneNumber:`sc${i}`,passwordHash:hash});
      const p=await db.getRepository(ProviderUser).save({email:`sp${i}@workflow.invalid`,phoneNumber:`sp${i}`,passwordHash:hash});
      await db.getRepository(MechanicProfile).save({user:p,isOnline:true});await jobFor(p,c,JobStatus.EN_ROUTE);return {c,p};
    }));
    const clients: {pair: typeof pairs[number]; c: any; p: any}[] = [];
    // Ramp up in batches so the test measures sustained connected users, not
    // the Windows loopback SYN backlog during an instantaneous connection flood.
    for(let offset=0;offset<pairs.length;offset+=25) {
      const batch=await Promise.allSettled(pairs.slice(offset,offset+25).map(async pair=>({pair,c:await connect(token(pair.c)),p:await connect(token(pair.p))})));
      for(const result of batch) {if(result.status==='rejected')throw result.reason;clients.push(result.value);}
    }
    const rss=process.memoryUsage().rss;const start=performance.now();
    let round=0;
    do {await Promise.all(clients.map(async ({pair,c,p})=>{
      const received=event(c,'mechanic_location_changed');
      p.send('42'+JSON.stringify(['update_location',{mechanicId:pair.p.id,lat:12+round*.0001,lng:77}]));
      expect((await received).mechanicId).toBe(pair.p.id);
    })); round++;
      if(soakSeconds>0) {
        const reads=await Promise.all(clients.slice(0,20).map(({pair})=>http('/dispatch/nearby','POST',{lat:12,lng:77,serviceType:serviceType.name,vehicleCategoryId:vehicle.id},token(pair.c))));
        expect(reads.every(r=>r.status===201)).toBe(true);
        await new Promise(resolve=>setTimeout(resolve,3000));
      }
    }while(soakSeconds>0?performance.now()-start<soakSeconds*1000:round<5);
    const sample=clients[0];const incoming=event(sample.p,'incoming_call');
    sample.c.send('42'+JSON.stringify(['call_offer',{targetId:sample.pair.p.id,callId:'load-call',offer:{sdp:'test'}}]));
    expect((await incoming).callerId).toBe(sample.pair.c.id);
    sample.c.close();const reconnected=await connect(token(sample.pair.c));const received=event(reconnected,'mechanic_location_changed');
    reconnected.send('42'+JSON.stringify(['subscribe_to_mechanic',{mechanicId:sample.pair.p.id}]));await received;
    expect(clients.every(client=>client.p.readyState===1 && (client===sample || client.c.readyState===1))).toBe(true);
    expect(reconnected.readyState).toBe(1);
    process.stdout.write(`SOCKETS: ${count*2} authenticated connections; ${round*count} GPS updates delivered; reconnect + call signaling passed; elapsed=${Math.round(performance.now()-start)}ms rssDeltaMiB=${((process.memoryUsage().rss-rss)/1048576).toFixed(1)}\n`);
  }, 420000);
  function connect(bearer:string):Promise<any> {
    return new Promise((resolve,reject)=>{
      const ws=new WebSocketClient(base.replace('http:','ws:')+'/socket.io/?EIO=4&transport=websocket');sockets.push(ws);
      const timer=setTimeout(()=>{ws.close();reject(new Error('Socket connection timeout'));},15000);
      ws.on('error',(e:Error)=>{clearTimeout(timer);reject(e);});
      ws.on('message',(raw:Buffer)=>{const data=raw.toString();if(data.startsWith('0'))ws.send('40'+JSON.stringify({token:bearer}));
        else if(data==='2')ws.send('3');else if(data.startsWith('40')){clearTimeout(timer);resolve(ws);}
        else if(data.startsWith('44')){clearTimeout(timer);reject(new Error(data));}});
    });
  }
  function event(ws:any,name:string):Promise<any> {
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.off('message',handler);reject(new Error('Missing event: '+name));},15000);
      const handler=(raw:Buffer)=>{const data=raw.toString();if(!data.startsWith('42'))return;const payload=JSON.parse(data.slice(2));
        if(payload[0]===name){clearTimeout(timer);ws.off('message',handler);resolve(payload[1]);}};ws.on('message',handler);
    });
  }
});
