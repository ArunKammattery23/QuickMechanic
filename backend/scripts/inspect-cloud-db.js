const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const result = { tables: tables.rows.map((row) => row.tablename) };
  const columns = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('users', 'mechanic_profiles')
    ORDER BY table_name, ordinal_position
  `);
  result.legacyColumns = columns.rows;
  if (result.tables.includes('users')) {
    const roles = await client.query(`SELECT role::text, COUNT(*)::int AS count FROM users GROUP BY role::text ORDER BY role::text`);
    result.legacyUserRoles = roles.rows;
  }
  if (result.tables.includes('mechanic_profiles') && result.tables.includes('PROVIDER_USER')) {
    const orphan = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM mechanic_profiles mp
      LEFT JOIN "PROVIDER_USER" pu ON pu.id = mp."userId"
      WHERE pu.id IS NULL
    `);
    result.orphanMechanicProfiles = orphan.rows[0].count;
  } else if (result.tables.includes('mechanic_profiles')) {
    result.orphanMechanicProfiles = 'all (PROVIDER_USER table is absent)';
  }
  for (const table of ['PROVIDER_USER', 'CUST_USER', 'ADM_USER', 'mechanic_profiles']) {
    if (result.tables.includes(table)) {
      const count = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      result[`${table}Count`] = count.rows[0].count;
    }
  }
  console.log(JSON.stringify(result, null, 2));
  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
