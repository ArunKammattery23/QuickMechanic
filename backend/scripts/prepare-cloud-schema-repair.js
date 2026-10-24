const { Client } = require('pg');

async function main() {
  const client = new Client({host:'127.0.0.1',port:5433,user:'postgres',password:process.env.DB_PASSWORD,database:'postgres'});
  await client.connect();
  await client.query('BEGIN');
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _qm_profile_user_repair (profile_id uuid PRIMARY KEY, user_id uuid NOT NULL)`);
    await client.query(`INSERT INTO _qm_profile_user_repair(profile_id,user_id) SELECT id,"userId" FROM mechanic_profiles WHERE "userId" IS NOT NULL ON CONFLICT(profile_id) DO UPDATE SET user_id=EXCLUDED.user_id`);
    const saved = await client.query(`SELECT COUNT(*)::int AS count FROM _qm_profile_user_repair`);
    await client.query(`UPDATE mechanic_profiles SET "userId"=NULL WHERE "userId" IS NOT NULL`);
    await client.query('COMMIT');
    console.log(JSON.stringify({savedProfileLinks:saved.rows[0].count}));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
main().catch((error)=>{console.error(error.message);process.exitCode=1});
