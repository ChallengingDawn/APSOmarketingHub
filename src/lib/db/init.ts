import { query } from './client';

let initPromise: Promise<void> | null = null;

/** Idempotent — safe to call repeatedly, runs once per process. */
export function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        full_name VARCHAR(128) NOT NULL,
        password_hash TEXT NOT NULL,
        totp_secret TEXT,
        totp_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login TIMESTAMPTZ
      );
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_users_email ON apsomh_users(email)`);
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_kv (
        k TEXT PRIMARY KEY,
        v JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(32) NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        image_url TEXT,
        filters JSONB,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_apsomh_content_channel_status ON apsomh_content(channel, status)`
    );
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_audit (
        id SERIAL PRIMARY KEY,
        actor VARCHAR(255),
        action VARCHAR(64) NOT NULL,
        detail JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // eslint-disable-next-line no-console
    console.log('[db] apsomh schema ready (users, kv, content, audit)');
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

/**
 * Read a JSON value from the apsomh_kv store.
 * Returns `undefined` when the key does not exist (a stored JSON null comes
 * back as `null`, which is a distinct, present value).
 */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  await ensureSchema();
  const r = await query<{ v: T }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [key]);
  return r.rows.length ? r.rows[0].v : undefined;
}

/** Upsert a JSON value into the apsomh_kv store. */
export async function kvSet(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [key, JSON.stringify(value ?? null)]
  );
}

export type UserRow = {
  id: number;
  username: string;
  email: string | null;
  full_name: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enrolled: boolean;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
};
