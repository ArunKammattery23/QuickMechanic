const fs = require('fs');
const path = require('path');
const {Client} = require('../backend/node_modules/pg');
const dotenv = require('../backend/node_modules/dotenv');
const settings = dotenv.parse(fs.readFileSync(path.join(__dirname, '../backend/.env.development')));
async function main() {
  const host = settings.DB_HOST || 'localhost';
  if (!['localhost', '127.0.0.1'].includes(host)) throw Error('This diagnostic is restricted to the local database');
  const db = new Client({host, port:Number(settings.DB_PORT || 5432), user:settings.DB_USER || 'postgres', password:settings.DB_PASSWORD, database:settings.DB_NAME || 'QuickMechanic'});
  await db.connect();
  try {
    console.log(JSON.stringify({database:settings.DB_NAME, paymentMode:settings.PAYMENT_MODE || 'live'}));
    for (const [label, sql] of [
      ['recentJobs', 'SELECT id,status,"mechanicId","serviceType","providerAcceptedAt","autoQuotePreparedAt","cancellationReason","updatedAt" FROM service_requests ORDER BY "createdAt" DESC LIMIT 12'],
      ['events', 'SELECT "type","details","createdAt","jobId" FROM job_events ORDER BY "createdAt" DESC LIMIT 15'],
      ['adminAccounts', 'SELECT id,email,role FROM "ADM_USER"'],
      ['pricingCount', 'SELECT count(*) FROM mechanic_pricing']
    ]) {console.log(label, JSON.stringify((await db.query(sql)).rows));}
  } finally {await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
