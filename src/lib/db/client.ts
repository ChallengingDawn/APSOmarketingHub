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
    max: 5,
    idleTimeoutMillis: 30000,
  });
  return _pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  const result = await getPool().query(text, params as never[]);
  return { rows: result.rows as T[] };
}
