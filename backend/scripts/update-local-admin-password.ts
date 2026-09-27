import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { AdmUser } from '../libs/common/src/entities/adm-user.entity';

async function main() {
  if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_NAME !== 'QuickMechanicDemo' || process.env.PAYMENT_MODE !== 'simulation') {
    throw new Error('Only the local simulation database may be updated by this script');
  }
  const email = process.env.QM_DEMO_ADMIN_EMAIL?.trim();
  const password = process.env.QM_DEMO_ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) throw new Error('Admin email and password of at least 8 characters are required');
  const db = new DataSource({type:'postgres',host:'127.0.0.1',port:5432,username:'postgres',password:process.env.DB_PASSWORD||'password123',database:'QuickMechanicDemo',entities:[AdmUser],synchronize:false});
  await db.initialize();
  try {
    const repo = db.getRepository(AdmUser);
    const admin = await repo.findOneBy({email});
    if (!admin) throw new Error('Local demo admin account not found');
    admin.passwordHash = await hash(password, 12);
    await repo.save(admin);
    process.stdout.write('Local demo admin password updated.\n');
  } finally { await db.destroy(); }
}
main().catch(error=>{process.stderr.write(String(error.message)+'\n');process.exitCode=1;});
