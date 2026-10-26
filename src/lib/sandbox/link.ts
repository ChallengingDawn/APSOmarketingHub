// THE HUB'S SIDE DOOR INTO THE SANDBOX - the hub cannot be reached from Railway, so it comes to the sandbox: every
// minute it collects what was asked (GET) and delivers the coded answers (POST). The sandbox holds only the SHA-256 of
// the hub's key (SANDBOX_LINK_KEY_SHA256) - nothing here could open anything on the hub.

import { createHash, timingSafeEqual } from "node:crypto";
import { getPool } from "../db/client";
import { ensureSandboxTables } from "./store";

/** The hub's key, checked against the hash the sandbox keeps. No hash configured = nobody gets in. */
export function hubKeyOk(authorization: string | null, expectedSha256Hex: string | undefined): boolean {
  if (!expectedSha256Hex || !/^[0-9a-f]{64}$/i.test(expectedSha256Hex)) return false;
  const m = /^Bearer\s+(\S+)$/.exec(authorization ?? "");
  if (!m) return false;
  const got = createHash("sha256").update(m[1]).digest();
  return timingSafeEqual(got, Buffer.from(expectedSha256Hex, "hex"));
}

export type Review = { id: number; by: string; title: string; summary: string; base: string | null; preview_url: string | null;
  files: { path: string; added?: number; removed?: number }[]; patch: string };

export type Asked = {
  misses: { key: string; kind: string; request: unknown }[];
  asks: { id: number; by: string; spec: unknown; reason: string }[];
  /** Sent to review from the CLI, not mailed yet. */
  reviews?: Review[];
  /** When the CLI's Railway token was last replaced (null = never), so the hub knows when to replace it. */
  railwayTokenAt?: string | null;
};

/** What the hub should answer this round: the asked reads and the asked CLI requests, oldest first, bounded. */
export async function asked(limit = 200): Promise<Asked> {
  await ensureSandboxTables();
  const p = getPool();
  const m = await p.query(`SELECT key, kind, request FROM sandbox_misses WHERE state = 'asked' ORDER BY asked_at, key LIMIT $1`, [limit]);
  const a = await p.query(`SELECT id, by_user AS by, spec, reason FROM sandbox_asks WHERE state = 'asked' ORDER BY id LIMIT 20`);
  const r = await p.query(`SELECT id, by_user AS by, title, summary, base, preview_url, files, patch FROM sandbox_reviews
    WHERE state = 'new' ORDER BY id LIMIT 5`);
  const t = await p.query<{ at: string }>(`SELECT at FROM sandbox_cli WHERE k = 'railway_token'`);
  return {
    misses: m.rows,
    asks: a.rows.map((x) => ({ ...x, id: Number(x.id) })),
    reviews: r.rows.map((x) => ({ ...x, id: Number(x.id) })),
    railwayTokenAt: t.rows[0]?.at ? new Date(t.rows[0].at).toISOString() : null,
  };
}

export type Delivery = {
  answers?: { key: string; kind: string; request: unknown; response: unknown }[];
  refused?: { key: string; note: string }[];
  /** An ask's outcome; an answered one names the replay row its data went to. */
  asks?: { id: number; state: "answered" | "refused"; note?: string; key?: string }[];
  /** Reviews the hub has mailed. */
  reviewsSent?: number[];
  /** The Railway token the CLI is handed from now on (the sandbox environment's only). */
  railwayToken?: string;
};

// The second lock, on this side: the hub codes and leak-checks every answer, and a delivery that still carries an
// e-mail address other than the coded ones (c<id>@example.invalid) is refused whole - nothing of it is stored.
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;

export function realAddressIn(d: Delivery): string | null {
  for (const m of JSON.stringify(d.answers ?? []).matchAll(EMAIL)) {
    if (!/@example\.invalid$/i.test(m[0])) return m[0].replace(/^[^@]+/, "…");
  }
  return null;
}

/** The hub's coded answers: replay rows in, their misses closed (or refused with the hub's reason). */
export async function deliver(d: Delivery): Promise<{ answers: number; refused: number; asks: number }> {
  const leak = realAddressIn(d);
  if (leak) throw Object.assign(new Error(`delivery refused: it carries a real address (${leak})`), { status: 422 });
  await ensureSandboxTables();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const a of d.answers ?? []) {
      await client.query(
        `INSERT INTO sandbox_replay (key, kind, request, response) VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE SET response = EXCLUDED.response, request = EXCLUDED.request, brought_at = now()`,
        [a.key, a.kind, JSON.stringify(a.request), JSON.stringify(a.response)]);
      await client.query(`UPDATE sandbox_misses SET state = 'answered', note = NULL WHERE key = $1`, [a.key]);
    }
    for (const r of d.refused ?? []) {
      await client.query(`UPDATE sandbox_misses SET state = 'refused', note = $2 WHERE key = $1`, [r.key, r.note]);
    }
    for (const a of d.asks ?? []) {
      await client.query(`UPDATE sandbox_asks SET state = $2, note = $3, answer_key = $4, answered_at = now() WHERE id = $1`,
        [a.id, a.state, a.note ?? null, a.key ?? null]);
    }
    for (const id of d.reviewsSent ?? []) {
      await client.query(`UPDATE sandbox_reviews SET state = 'sent', sent_at = now() WHERE id = $1`, [id]);
    }
    if (d.railwayToken) {
      await client.query(`INSERT INTO sandbox_cli (k, v, at) VALUES ('railway_token', $1, now())
        ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, at = now()`, [d.railwayToken]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return { answers: d.answers?.length ?? 0, refused: d.refused?.length ?? 0, asks: d.asks?.length ?? 0 };
}
