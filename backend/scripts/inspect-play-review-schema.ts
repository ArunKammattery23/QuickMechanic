import { Client } from 'pg';

async function main() {
  const base = {
    host: process.env.QM_REVIEW_DB_HOST,
    port: Number(process.env.QM_REVIEW_DB_PORT || 5432),
    user: process.env.QM_REVIEW_DB_USER,
    password: process.env.QM_REVIEW_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  };
  const admin = new Client({ ...base, database: 'postgres' });
  await admin.connect();
  const databases = await admin.query(`SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname`);
  await admin.end();
  for (const row of databases.rows) {
    const db = new Client({ ...base, database: row.datname });
    try {
      await db.connect();
      const tables = await db.query(`SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2`);
      console.log(`${row.datname}: ${tables.rows.map((item: any) => `${item.table_schema}.${item.table_name}`).join(', ') || 'no reviewer tables'}`);
      if (row.datname === 'postgres') {
        const columns = await db.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name IN ('users', 'mechanic_profiles') ORDER BY table_name, ordinal_position`);
        console.log(columns.rows.map((item: any) => `${item.table_name}.${item.column_name}:${item.data_type}`).join(', '));
        const enums = await db.query(`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid ORDER BY t.typname, e.enumsortorder`);
        console.log(enums.rows.map((item: any) => `${item.typname}=${item.enumlabel}`).join(', '));
      }
    } catch (error) {
      console.log(`${row.datname}: unavailable`);
    } finally {
      await db.end().catch(() => undefined);
    }
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
