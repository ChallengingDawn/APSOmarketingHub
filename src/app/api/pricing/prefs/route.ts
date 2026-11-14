// PRICING: EACH PERSON'S SAVED FILTERS AND SETTINGS.
//
// The PricingHub dashboard saved a person's filters per page, their repricing factors, columns and sort to their
// account, so they follow them to any machine and stay until they press "Clear all". The same here, kept in apsomh_kv
// under "pricing-prefs:<user id>" as one object { "<key>": <value> } (src/lib/pricing/prefs.ts reads and writes it).
//
// The first time a person opens Pricing, what they had saved on the dashboard comes across by itself: the PricingHub
// backend answers by the e-mail they sign in with (its GET /api/hub/legacy-prefs - the dashboard's table is in the
// backend's database). If the backend does not answer, it is asked again a few minutes later, never more often.

import { NextResponse, type NextRequest } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { ensureSchema, type UserRow } from "@/lib/db/init";
import { backend } from "@/lib/doc/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9:_\-.]{1,120}$/i;
const kvKey = (userId: number) => `pricing-prefs:${userId}`;
type Prefs = Record<string, unknown>;

/** When the backend last failed to answer for a person - not asked again for five minutes. */
const failedAt = new Map<number, number>();

async function legacyPrefs(u: UserRow): Promise<Prefs | null> {
  const email = (u.email ?? u.username).trim().toLowerCase();
  const { url, key } = backend();
  if (!key || !email.includes("@")) return {};
  const last = failedAt.get(u.id);
  if (last && Date.now() - last < 5 * 60_000) return null;
  try {
    const r = await fetch(`${url}/api/hub/legacy-prefs?email=${encodeURIComponent(email)}`, {
      headers: { "x-internal-key": key }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { prefs?: Prefs };
    failedAt.delete(u.id);
    return j.prefs && typeof j.prefs === "object" ? j.prefs : {};
  } catch {
    failedAt.set(u.id, Date.now());
    return null;
  }
}

/** The person's saved settings - brought over from the dashboard the first time. */
async function load(u: UserRow): Promise<Prefs> {
  await ensureSchema();
  const k = kvKey(u.id);
  const r = await query<{ v: Prefs }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [k]);
  const now = r.rows[0]?.v ?? null;
  if (now && "_from_dashboard" in now) return now;
  const legacy = await legacyPrefs(u);
  if (legacy === null) return now ?? {};
  // what was saved here already (a save while the backend was away) wins over the dashboard's
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (k) DO UPDATE SET v = $2::jsonb || apsomh_kv.v, updated_at = NOW()`,
    [k, JSON.stringify({ ...legacy, _from_dashboard: new Date().toISOString() })],
  );
  const again = await query<{ v: Prefs }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [k]);
  return again.rows[0]?.v ?? {};
}

async function who(): Promise<UserRow | Response> {
  const access = await myAccess();
  if (!access) return NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
  if (!access.canOpen("pricing")) return NextResponse.json({ ok: false, error: "Pricing is not part of your access." }, { status: 403 });
  const u = await getOptionalUser();
  return u ?? NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const u = await who();
  if (u instanceof Response) return u;
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!KEY_RE.test(key)) return NextResponse.json({ ok: false, error: "bad key" }, { status: 400 });
  const prefs = await load(u);
  return NextResponse.json({ key, value: prefs[key] ?? null });
}

export async function PUT(req: NextRequest) {
  const u = await who();
  if (u instanceof Response) return u;
  let body: { key?: string; value?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const key = String(body.key || "");
  if (!KEY_RE.test(key) || key.startsWith("_")) return NextResponse.json({ ok: false, error: "bad key" }, { status: 400 });
  const json = JSON.stringify(body.value ?? null);
  if (json.length > 20000) return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  // the dashboard's settings come across before the first save, or the save would stand in for them
  await load(u);
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, jsonb_build_object($2::text, $3::jsonb), NOW())
     ON CONFLICT (k) DO UPDATE SET v = apsomh_kv.v || EXCLUDED.v, updated_at = NOW()`,
    [kvKey(u.id), key, json],
  );
  return NextResponse.json({ ok: true });
}
