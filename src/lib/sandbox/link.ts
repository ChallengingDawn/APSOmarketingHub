// THE HUB'S SIDE DOOR INTO THE SANDBOX - the hub cannot be reached from Railway, so it comes to the sandbox: every
// minute it collects what was asked (GET) and delivers the coded answers (POST). The sandbox holds only the SHA-256 of
// the hub's key (SANDBOX_LINK_KEY_SHA256) - nothing here could open anything on the hub.

import { createHash, timingSafeEqual } from "node:crypto";
import { getPool } from "../db/client";
import { ensureSandboxTables, sandboxState, type SandboxState } from "./store";
import { parsePeople } from "./peopleList";

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
  /** The pages' reads waiting to be brought, oldest first. */
  misses: { key: string; kind: string; request: unknown; first_at?: string; hits?: number }[];
  /** The CLI's asks waiting to be brought. */
  asks: { id: number; by: string; spec: unknown; reason: string; at?: string }[];
  /** Sent to review from the CLI, not mailed yet. */
  reviews?: Review[];
  /** Who works in this sandbox (SANDBOX_PEOPLE) - the hub shows it only to them, and to admins. */
  people?: { email: string; role: string; name: string }[];
  /** Its counts, for the hub's Sandbox app. */
  state?: SandboxState;
};

/** Everything the hub's Sandbox app and its minute round need: what waits, what to mail, who works here. */
export async function asked(limit = 200): Promise<Asked> {
  await ensureSandboxTables();
  const p = getPool();
  const m = await p.query(`SELECT key, kind, request, first_at, hits FROM sandbox_misses WHERE state = 'new' ORDER BY first_at, key LIMIT $1`, [limit]);
  const a = await p.query(`SELECT id, by_user AS by, spec, reason, at FROM sandbox_asks WHERE state = 'new' ORDER BY id LIMIT 20`);
  const r = await p.query(`SELECT id, by_user AS by, title, summary, base, preview_url, files, patch FROM sandbox_reviews
    WHERE state = 'new' ORDER BY id LIMIT 5`);
  return {
    misses: m.rows,
    asks: a.rows.map((x) => ({ ...x, id: Number(x.id) })),
    reviews: r.rows.map((x) => ({ ...x, id: Number(x.id) })),
    people: parsePeople(process.env.SANDBOX_PEOPLE).people,
    state: await sandboxState(),
  };
}

export type Delivery = {
  answers?: { key: string; kind: string; request: unknown; response: unknown }[];
  refused?: { key: string; note: string }[];
  /** An ask's outcome; an answered one names the replay row its data went to. */
  asks?: { id: number; state: "answered" | "refused"; note?: string; key?: string }[];
  /** Reviews the hub has mailed. */
  reviewsSent?: number[];
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
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return { answers: d.answers?.length ?? 0, refused: d.refused?.length ?? 0, asks: d.asks?.length ?? 0 };
}
