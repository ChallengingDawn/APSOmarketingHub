import { Pool } from 'pg';

let _pool: Pool | null = null;

/**
 * Resolve the Postgres connection string. Prefers DATABASE_URL; when absent
 * (prod injects the Aurora-managed secret's parts so password rotation works),
 * assembles it from PGHOST/PGUSER/PGPASSWORD with the password URL-encoded —
 * rotated passwords may contain '@', ':', '/' or '%' that would break a naive
 * string concat.
 */
function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  const { PGHOST, PGUSER, PGPASSWORD } = process.env;
  if (PGHOST && PGUSER && PGPASSWORD) {
    const database = process.env.PGDATABASE || 'app';
    const port = process.env.PGPORT || '5432';
    return (
      `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}` +
      `@${PGHOST}:${port}/${database}?sslmode=no-verify`
    );
  }
  throw new Error(
    'DATABASE_URL is not set on the marketing hub service (and no PGHOST/PGUSER/PGPASSWORD to assemble it from).'
  );
}

export function getPool(): Pool {
  if (_pool) return _pool;
  const url = resolveConnectionString();
  _pool = new Pool({
    connectionString: url,
    ssl:
      url.includes('railway.app') || url.includes('railway.internal') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined,
    // 15.10.2026: with 5 connections and no wait limit one copy of the hub jammed for good. Every
    // scheduler that runs under an advisory lock keeps one connection for the lock and asks for a
    // second for its queries; five of them at once waited on each other for ever (the shop-order
    // sync, the chain's sweep lane, price checks and every page on that copy stopped). Room for
    // twelve (Aurora Serverless takes ~200; two copies, four during a rollout), and a wait that
    // ends: after 30 s the query fails, its holder lets go of its lock, and the rest moves on.
    // 26.10.2026: thirty. ~30 schedulers start together at boot, so at every quarter hour (and :00) a dozen locked
    // ones fire in the same second, each holding one connection and asking for a second: 12 ran out and 8-18 jobs a
    // burst gave up ("timeout exceeded when trying to connect", 30-39 an hour). The database was raised to 2 ACU the
    // same day (max_connections ~ memory/9.5 MB, ~400); two copies x 30, four during a rollout, peak 29 in use.
    max: 30,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30000,
  });
  return _pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  const result = await getPool().query(text, params as never[]);
  return { rows: result.rows as T[] };
}
