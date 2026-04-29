import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set on the marketing hub service.');
  }
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
