// Connectivity probe for the AWS dev Aurora cluster.
// Run with:  node scripts/test-aws-db.mjs
// Reads DATABASE_URL from .env.aws-dev (or the environment if already set).
// Tries the configured db name first, then the usual candidates, and lists
// every database the `app` user can see so the right name can be pinned.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let url = process.env.DATABASE_URL;
if (!url) {
  const env = readFileSync(join(root, '.env.aws-dev'), 'utf8');
  url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
}
if (!url) {
  console.error('No DATABASE_URL found (.env.aws-dev or environment).');
  process.exit(1);
}

const candidates = [...new Set([new URL(url).pathname.slice(1), 'postgres', 'app', 'apsomarketinghub'])];

for (const db of candidates) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  const client = new pg.Client({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const version = (await client.query('SELECT version()')).rows[0].version;
    const dbs = (await client.query('SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY 1')).rows;
    const tables = (
      await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")
    ).rows;
    console.log(`CONNECTED to db "${db}"`);
    console.log(`  server:   ${version.split(' on ')[0]}`);
    console.log(`  databases: ${dbs.map((r) => r.datname).join(', ')}`);
    console.log(`  public tables in "${db}": ${tables.length ? tables.map((r) => r.tablename).join(', ') : '(none)'}`);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.log(`db "${db}": ${err.message}`);
    await client.end().catch(() => {});
  }
}
console.error('\nNo database accepted the connection. If every attempt timed out,');
console.error('you are not inside the VPC (needs corporate VPN / SSM tunnel).');
process.exit(2);
