import { creativeSchema } from "./creative-schema";
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
    // An account created without a password, waiting for its person to set one.
    // It is the ONLY state in which the sign-up page will set a password, so it
    // cannot be used to take over an account that is already in use.
    await query(
      `ALTER TABLE apsomh_users ADD COLUMN IF NOT EXISTS awaiting_setup BOOLEAN NOT NULL DEFAULT FALSE`
    );
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
    for (const statement of creativeSchema) await query(statement);
    // Added after the table shipped — ADD COLUMN IF NOT EXISTS keeps this
    // bootstrap re-runnable on every boot, including on existing databases.
    await query(
      `ALTER TABLE apsomh_content ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_apsomh_content_channel_status ON apsomh_content(channel, status)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_apsomh_content_scheduled_for ON apsomh_content(scheduled_for)`
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
    // WHO MAY OPEN WHICH APP.
    //
    // One row per person per app. The ROLE caps how far a grant can go — a
    // viewer's grant never resolves above read, whatever this says — so a
    // promotion or a demotion needs no rewriting of grants.
    //
    // No row means no access. That is deliberate: a new account can see
    // nothing until somebody grants it, so an account created by mistake is
    // harmless by construction.
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_user_app_access (
        user_id INTEGER NOT NULL REFERENCES apsomh_users(id) ON DELETE CASCADE,
        app_key VARCHAR(48) NOT NULL,
        level VARCHAR(8) NOT NULL DEFAULT 'read',
        granted_by VARCHAR(255),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, app_key)
      );
    `);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_apsomh_access_user ON apsomh_user_app_access(user_id)`
    );

    // NOBODY LOSES ACCESS ON THE DAY THE GUARDS SWITCH ON.
    //
    // No row means no access, so turning enforcement on against an empty table
    // would lock every non-admin out of all five apps at once. SARCLA's rule was
    // that everyone keeps what they can reach today and is tightened afterwards,
    // one person at a time, in daylight.
    //
    // So existing accounts are granted every app at their role's own ceiling —
    // a viewer gets read, an editor write, and admins need no row at all. Runs
    // ONCE, behind a flag, so a grant revoked tomorrow is not handed back on the
    // next boot.
    const seeded = await query<{ k: string }>(
      `SELECT k FROM apsomh_kv WHERE k = 'access:seeded' LIMIT 1`,
    );
    if (seeded.rows.length === 0) {
      await query(`
        INSERT INTO apsomh_user_app_access (user_id, app_key, level, granted_by)
        SELECT u.id, a.app_key,
               CASE WHEN u.role = 'viewer' THEN 'read' ELSE 'write' END,
               'migration'
          FROM apsomh_users u
          CROSS JOIN (VALUES ('datatracker'), ('website'), ('marketing'), ('journey'), ('uc'))
                  AS a(app_key)
         WHERE u.role <> 'admin'
        ON CONFLICT (user_id, app_key) DO NOTHING
      `);
      await query(
        `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ('access:seeded', $1, NOW())
         ON CONFLICT (k) DO NOTHING`,
        [JSON.stringify({ at: new Date().toISOString(), note: "existing accounts kept what they had" })],
      );
      // eslint-disable-next-line no-console
      console.log('[db] app access seeded for existing accounts (once)');
    }
    // eslint-disable-next-line no-console
    console.log('[db] apsomh schema ready (users, kv, content, audit, app access)');
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
  if (!r.rows.length) return undefined;
  const v = r.rows[0].v;
  // Self-heal double-encoded rows (jsonb holding a JSON string scalar).
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return v as T;
    }
  }
  return v ?? undefined;
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
  awaiting_setup: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
};
