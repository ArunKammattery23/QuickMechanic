const { Client } = require('pg');

async function main() {
  const client = new Client({host:'127.0.0.1',port:5433,user:'postgres',password:process.env.DB_PASSWORD,database:'postgres'});
  await client.connect();
  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO "PROVIDER_USER"(id,name,email,"passwordHash",role,"phoneNumber","resetToken","resetTokenExpiry","createdAt","updatedAt") SELECT id,'Legacy Mechanic',email,"passwordHash",'MECHANIC',"phoneNumber",NULL,NULL,"createdAt","updatedAt" FROM users WHERE role::text='MECHANIC' ON CONFLICT(id) DO NOTHING`);
    await client.query(`INSERT INTO "CUST_USER"(id,name,email,"passwordHash",role,"phoneNumber","resetToken","resetTokenExpiry","createdAt","updatedAt") SELECT id,'Legacy Customer',email,"passwordHash",'CUSTOMER',"phoneNumber",NULL,NULL,"createdAt","updatedAt" FROM users WHERE role::text='CUSTOMER' ON CONFLICT(id) DO NOTHING`);
    await client.query(`INSERT INTO "ADM_USER"(id,name,email,"passwordHash",role,"phoneNumber","resetToken","resetTokenExpiry","createdAt","updatedAt") SELECT id,'Legacy Administrator',email,"passwordHash",'SUPER_ADMIN',"phoneNumber",NULL,NULL,"createdAt","updatedAt" FROM users WHERE role::text='SUPER_ADMIN' ON CONFLICT(id) DO NOTHING`);
    await client.query(`UPDATE mechanic_profiles mp SET "userId"=repair.user_id FROM _qm_profile_user_repair repair WHERE mp.id=repair.profile_id`);
    const orphan = await client.query(`SELECT COUNT(*)::int AS count FROM mechanic_profiles mp LEFT JOIN "PROVIDER_USER" pu ON pu.id=mp."userId" WHERE mp."userId" IS NOT NULL AND pu.id IS NULL`);
    if (orphan.rows[0].count !== 0) throw new Error('Mechanic profile repair verification failed');
    const counts = await client.query(`SELECT (SELECT COUNT(*)::int FROM "PROVIDER_USER") AS providers,(SELECT COUNT(*)::int FROM "CUST_USER") AS customers,(SELECT COUNT(*)::int FROM "ADM_USER") AS admins`);
    await client.query(`DROP TABLE _qm_profile_user_repair`);
    await client.query('COMMIT');
    console.log(JSON.stringify({...counts.rows[0],orphanProfiles:0}));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
main().catch((error)=>{console.error(error.message);process.exitCode=1});
