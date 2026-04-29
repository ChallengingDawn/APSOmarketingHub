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
    // eslint-disable-next-line no-console
    console.log('[db] apsomh_users schema ready');
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
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
