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

    // WHERE SOMEBODY IS SIGNED IN.
    //
    // The session cookie is a signed token and proves itself without asking
    // anything — which is why changing a password used to leave every other
    // browser signed in, and why nobody could see where they were signed in at
    // all. One row per session makes both answerable: the token now carries a
    // `sid`, and a revoked row stops it being accepted.
    //
    // Tokens issued before this table existed carry no sid. They are honoured
    // until they expire rather than signing everybody out on the deploy.
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_sessions (
        sid VARCHAR(64) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES apsomh_users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_agent TEXT,
        ip VARCHAR(64),
        revoked_at TIMESTAMPTZ
      );
    `);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_apsomh_sessions_user ON apsomh_sessions(user_id)`
    );

    // DID THE WORK ACTUALLY WORK.
    //
    // The SEO queue says what to do and estimates what it is worth. Nothing
    // ever checked afterwards, so nobody could tell which advice was good —
    // and advice nobody can grade is advice people stop following.
    //
    // One row per action somebody starts, holding the page's numbers AT THAT
    // MOMENT. The comparison later is against these, not against whatever the
    // dashboard happens to show, because the window moves and a baseline read
    // afterwards is not a baseline.
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_seo_actions (
        id SERIAL PRIMARY KEY,
        item_id TEXT NOT NULL,
        source VARCHAR(32) NOT NULL,
        subject TEXT NOT NULL,
        action TEXT NOT NULL,
        euros_estimated NUMERIC,
        baseline_clicks INTEGER,
        baseline_impressions INTEGER,
        baseline_position NUMERIC,
        window_days INTEGER NOT NULL,
        started_by VARCHAR(255) NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- Filled by whoever opens the page after the waiting period; the
        -- measurement is a read of Search Console, never a human's opinion.
        measured_at TIMESTAMPTZ,
        after_clicks INTEGER,
        after_impressions INTEGER,
        after_position NUMERIC,
        dropped_at TIMESTAMPTZ,
        dropped_reason TEXT
      );
    `);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_apsomh_seo_actions_started ON apsomh_seo_actions(started_at DESC)`
    );

    // NOBODY LOSES LIVE WHEN IT CHANGES APPS.
    //
    // Live, Tracking health, Cookie consent and Web order sync moved out of
    // Website into Advanced reporting. Everyone who had Website would have lost
    // them on the deploy, so their Website grant is copied across once \u2014 behind
    // a flag, so an admin who then takes Advanced reporting away keeps it away.
    //
    // The flag is read and written with RAW QUERIES, not kvGet/kvSet. Those
    // begin with `await ensureSchema()` — which, called from inside
    // ensureSchema, hands back the promise this very function is still inside.
    // It waits on itself and never resolves, so every request that touches the
    // database hangs for ever while the health check, which does not, keeps
    // reporting the task healthy. That is what took the hub down on 05.10; the
    // seed below has always used raw queries for exactly this reason.
    const split = await query<{ k: string }>(
      `SELECT k FROM apsomh_kv WHERE k = 'access:reporting-split' LIMIT 1`,
    );
    if (split.rows.length === 0) {
      await query(`
        INSERT INTO apsomh_user_app_access (user_id, app_key, level, granted_by)
        SELECT user_id, 'reporting', level, 'the Website split'
          FROM apsomh_user_app_access
         WHERE app_key = 'website'
        ON CONFLICT (user_id, app_key) DO NOTHING
      `);
      await query(
        `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ('access:reporting-split', $1, NOW())
         ON CONFLICT (k) DO NOTHING`,
        [JSON.stringify({ at: new Date().toISOString() })],
      );
    }

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
