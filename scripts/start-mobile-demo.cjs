// Local-only simulation: copies accounts/configuration and unpaid requests,
// never wallet balances, captured payments or ledger entries.
const fs = require('fs');
const path = require('path');
const {execFileSync, spawn} = require('child_process');
const {Client} = require('../backend/node_modules/pg');
const dotenv = require('../backend/node_modules/dotenv');
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const config = dotenv.parse(fs.readFileSync(path.join(backend, '.env.development')));
const database = 'QuickMechanicDemo';
const options = {host:'127.0.0.1', port:5432, user:config.DB_USER || 'postgres', password:config.DB_PASSWORD};
const env = {...process.env, ...config, NODE_ENV:'development', PAYMENT_MODE:'simulation',
  DB_HOST:'127.0.0.1', DB_PORT:'5432', DB_NAME:database, DB_USER:options.user,
  DB_PASSWORD:options.password, REDIS_HOST:'127.0.0.1', REDIS_PORT:'6380', PORT:'3002', TS_NODE_PROJECT:'tsconfig.json'};

async function main() {
  if (!['127.0.0.1','localhost'].includes(config.DB_HOST || 'localhost')) throw Error('Source must be the local development database');
  const admin = new Client({...options, database:'postgres'});
  await admin.connect();
  const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount;
  if (!exists) await admin.query('CREATE DATABASE "QuickMechanicDemo"');
  await admin.end();
  const probe = new Client({...options, database});
  await probe.connect();
  const initialized = (await probe.query("SELECT to_regclass('public.payment_environment') AS table_name")).rows[0]?.table_name;
  await probe.end();
  if (!initialized) execFileSync(process.execPath, ['-r','ts-node/register','-r','tsconfig-paths/register','scripts/prepare-payment-demo.ts'], {cwd:backend,env,stdio:'inherit'});
  const source = new Client({...options,database:config.DB_NAME || 'QuickMechanic'});
  const target = new Client({...options,database});
  await source.connect(); await target.connect();
  try {
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await target.query('BEGIN');
    const mode = (await target.query('SELECT mode FROM payment_environment WHERE id=1')).rows[0]?.mode;
    if (mode !== 'simulation') throw Error('Target database is not a simulation database');
    // Seed once. Subsequent starts preserve test jobs, payments and changed settings.
    await target.query('CREATE TABLE IF NOT EXISTS local_demo_seed (id integer PRIMARY KEY, seeded_at timestamptz NOT NULL DEFAULT now())');
    const seeded = (await target.query('SELECT id FROM local_demo_seed WHERE id=1')).rowCount;
    if (!seeded) {
      for (const table of ['CUST_USER','PROVIDER_USER','service_types','vehicle_categories','mechanic_profiles','mechanic_services','mechanic_vehicles','mechanic_pricing','pricing_policies']) {
        const rows = (await source.query(`SELECT row_to_json(t) AS data FROM "${table}" t`)).rows;
        for (const {data} of rows) {
          if (table.endsWith('_USER')) {data.resetToken=null; data.resetTokenExpiry=null;}
          if (table === 'mechanic_profiles') Object.assign(data,{walletBalance:0,lastWithdrawalDate:null,isOnline:false,lastSeenAt:null});
          await target.query(`INSERT INTO "${table}" SELECT (json_populate_record(NULL::"${table}", $1)).* ON CONFLICT DO NOTHING`, [JSON.stringify(data)]);
        }
      }
      await target.query('SELECT setval(pg_get_serial_sequence(\'pricing_policies\',\'revision\'), COALESCE((SELECT max(revision) FROM pricing_policies),1), EXISTS(SELECT 1 FROM pricing_policies))');
      const jobs = (await source.query(`SELECT row_to_json(j) AS data FROM (
        SELECT DISTINCT ON (s."mechanicId") s.* FROM service_requests s
        WHERE s.status IN ('REQUESTED','ACCEPTED','AWAITING_PAYMENT')
        AND s."razorpayLinkId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM payment_ledger l WHERE l."jobId"=s.id)
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions w WHERE w."serviceRequestId"=s.id)
        ORDER BY s."mechanicId", s."createdAt" DESC) j`)).rows;
      for (const {data} of jobs) {
        Object.assign(data,{paymentMode:'simulation',customerAcceptedAt:null,confirmedAt:null,checkoutUrl:null});
        if(data.status==='ACCEPTED') data.providerAcceptedAt=new Date().toISOString();
        await target.query('INSERT INTO service_requests SELECT (json_populate_record(NULL::service_requests,$1)).* ON CONFLICT DO NOTHING',[JSON.stringify(data)]);
        await target.query('INSERT INTO job_events ("jobId",type,"actorId",details) VALUES ($1,$2,$3,$4)',
          [data.id,'SIMULATION_COPY','SYSTEM',JSON.stringify({sourceJobId:data.id,sourceDatabase:config.DB_NAME || 'QuickMechanic',notice:'Unpaid job copied for local testing; no real funds transferred'})]);
      }
      await target.query('INSERT INTO local_demo_seed (id) VALUES (1)');
      console.log(`Seeded ${jobs.length} unpaid test jobs. Original jobs and all original balances were preserved.`);
    }
    await target.query('COMMIT'); await source.query('COMMIT');
  } catch(error) {
    await target.query('ROLLBACK'); await source.query('ROLLBACK'); throw error;
  } finally {await source.end(); await target.end();}
  // Require the normal build first. Port 3002 keeps the original local API available.
  const check = await fetch('http://127.0.0.1:3002/services', {signal:AbortSignal.timeout(1000)}).catch(()=>null);
  if(check) throw Error('Port 3002 is already running. Demo data is ready; stop its process before restarting.');
  const out=fs.openSync(path.join(backend,'mobile-demo.log'),'a');
  const err=fs.openSync(path.join(backend,'mobile-demo.error.log'),'a');
  const child=spawn(process.execPath,['dist/apps/backend/main.js'],{cwd:backend,env,detached:true,windowsHide:true,stdio:['ignore',out,err]});
  child.unref(); fs.closeSync(out); fs.closeSync(err);
  console.log(`Simulation API PID ${child.pid}; port 3002. Start redis_demo before running this script.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
