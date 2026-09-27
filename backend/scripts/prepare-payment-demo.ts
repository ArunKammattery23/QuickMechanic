import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { readFileSync } from 'fs';
import { hash } from 'bcryptjs';
import { AdmUser, AdmUserRole } from '../libs/common/src/entities/adm-user.entity';
import { ensurePaymentEnvironment } from '../apps/backend/src/dispatch/pricing';

async function main() {
  if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_NAME !== 'QuickMechanicDemo' || process.env.PAYMENT_MODE !== 'simulation') throw new Error('Demo bootstrap requires the dedicated local simulation database');
  const db=new DataSource({type:'postgres',host:'127.0.0.1',port:5432,username:'postgres',password:process.env.DB_PASSWORD||'password123',database:'QuickMechanicDemo',entities:[join(__dirname,'../libs/common/src/entities/*.entity.ts')],synchronize:false});
  await db.initialize();
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await db.synchronize();
    for(const file of ['job-ledger-migration.sql','pricing-policy-migration.sql'])await db.query(readFileSync(join(__dirname,'../../scripts',file),'utf8'));
    await db.transaction(ensurePaymentEnvironment);
    if(process.env.QM_DEMO_ADMIN_EMAIL) {
      const repo=db.getRepository(AdmUser), email=process.env.QM_DEMO_ADMIN_EMAIL.trim();
      if(!await repo.existsBy({email})) {
        const password=process.env.QM_DEMO_ADMIN_PASSWORD||'';
        if(password.length<12)throw new Error('Choose an administrator password of at least 12 characters');
        await repo.save({name:'Demo administrator',email,passwordHash:await hash(password,12),role:AdmUserRole.SUPER_ADMIN});
      }
    }
    process.stdout.write('Local simulation database ready. No real payments enabled.\n');
  } finally{await db.destroy();}
}
main().catch(e=>{process.stderr.write(String(e.message)+'\n');process.exitCode=1;});
