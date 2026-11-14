// A/B TESTING > the record kept up from its sources (model.ts): APSOconvert's page tests (the hub's own table), the shop
// chat's rounds and Webyn's tests as the shop saw them (both from the DirectUp gateway), and the pages Content's Page
// builder is building with an A/B test planned ("Under building pages", 14.11.2026). Every 30 minutes, and when a
// person presses Refresh; one copy of the hub at a time (advisory lock). A source that does not answer leaves its tests
// as they were - the record never loses a test because a gateway was away. EXPERIMENTS_SYNC=off stops the timer.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { adminKey, gateway } from "@/lib/directup/gateway";
import { abData } from "@/lib/chat/abtest";
import type { Verdict } from "@/lib/chat/abStats";
import { ideaOf, listTests, type Test } from "@/lib/convert/tests";
import { plannedTests } from "@/lib/content/abPlannedRead";
import { fromChatRound, fromPlanned, fromWebynPage, type WebynPageIn } from "./model";
import { hideMissing, upsertFromSource, type FromSource } from "./store";

const LOCK = 4_107_262;
const TICK_MS = 30 * 60_000;
export const KV_SYNC = "experiments:last-sync";
export type SourceRun = { ok: boolean; n: number; error: string | null };
export type SyncRun = { at: string; sources: Record<"apsoconvert" | "chat" | "webyn", SourceRun> & { pagebuilder?: SourceRun } };

const CHAT_VERDICT: Record<Verdict, string> = {
  "too-early": "Too early - under 50 visitors in a variant",
  "keep-later": "Asking for the e-mail costs chats - keep today's chat",
  "go-first": "Asking first keeps the chats and brings more e-mails",
  "go-mid": "The summary offer keeps the chats and brings more e-mails",
  "no-difference": "No clear difference",
};

/** APSOconvert's page tests (not its personalisations: those are always on, not a test). */
function fromConvert(t: Test, hypothesis: string): FromSource {
  const status = t.status === "draft" ? "planned" : t.status === "running" ? "running" : t.status === "paused" ? "paused" : "ended";
  const v = t.results?.variants ?? [];
  const a = v.find((x) => x.key === "a"), b = v.find((x) => x.key === "b");
  const won = t.winner === "b" ? "the new version won" : t.winner === "a" ? "the page as it is won" : t.winner === "none" ? "no winner" : null;
  return {
    key: `convert-${t.id}`, source: "apsoconvert", category: "page", service: null, host: t.host, surface: t.pages[0] ?? "", name: t.name,
    metric: "Put something in the cart, per visitor of the page", status, startedAt: t.startedAt, endedAt: status === "ended" ? t.stoppedAt : null,
    arms: [
      { key: "a", name: "The page as it is", control: true, visitors: a?.visitors ?? 0, conversions: a?.carts ?? 0 },
      { key: "b", name: "The new version", control: false, visitors: b?.visitors ?? 0, conversions: b?.carts ?? 0 },
    ],
    secondary: null, verdict: won ? `APSOconvert: ${won}` : null, link: `/website/ab-testing/pages/${t.id}`,
    changes: [`${t.changeCount} change${t.changeCount === 1 ? "" : "s"}${t.versionId ? ` of version #${t.versionId}` : ""}`, ...(t.pages.length > 1 ? [`on ${t.pages.length} pages`] : [])],
    hypothesis,
    // APSOconvert's own decision becomes the record's, until a person says otherwise
    decision: t.status === "shipped" ? "ship" : t.winner === "a" ? "keep-control" : t.winner === "none" ? "inconclusive" : null,
    decidedBy: t.decidedBy, decidedAt: t.decidedAt,
  };
}

async function syncConvert(): Promise<SourceRun> {
  const tests = await listTests("test");
  const rows: FromSource[] = [];
  for (const t of tests) {
    const idea = await ideaOf(t).catch(() => null);
    rows.push(fromConvert(t, idea ? [idea.why, idea.expect].filter(Boolean).join(" - ") : ""));
  }
  await upsertFromSource(rows);
  await hideMissing("apsoconvert", rows.map((r) => r.key));
  return { ok: true, n: rows.length, error: null };
}

async function syncChat(): Promise<SourceRun> {
  if (!adminKey()) return { ok: false, n: 0, error: "DIRECTUP_ADMIN_KEY is not set" };
  const now = await abData();
  const rows: FromSource[] = [];
  for (const r of now.rounds) {
    const d = r.v === now.v ? now : await abData(r.v);
    const all = d.comparisons[0];
    const arms = (["later", "first", "mid"] as const).filter((x) => all.arms[x].arm.visitors > 0 || (r.v === now.setting.v && now.setting.shares[x] > 0))
      .map((x) => ({ variant: x, visitors: all.arms[x].arm.visitors, chats: all.arms[x].arm.chats, emails: all.arms[x].arm.emails }));
    if (!arms.length) continue;
    rows.push(fromChatRound({ v: r.v, current: r.v === now.setting.v, on: now.setting.on, firstAt: d.firstAt ?? r.first_at, lastAt: d.lastAt ?? r.last_at,
      arms, verdict: `Shop chat: ${CHAT_VERDICT[all.verdict]}` }));
  }
  await upsertFromSource(rows);
  return { ok: true, n: rows.length, error: null };
}

async function syncWebyn(): Promise<SourceRun> {
  if (!adminKey()) return { ok: false, n: 0, error: "DIRECTUP_ADMIN_KEY is not set" };
  let r: { watching?: boolean; pages: WebynPageIn[] };
  try {
    r = await gateway<{ watching?: boolean; pages: WebynPageIn[] }>("/convert/webyn", { timeoutMs: 20_000 });
  } catch (e) {
    const status = (e as { status?: number }).status;
    return { ok: false, n: 0, error: status === 404 ? "The shop's gateway does not watch Webyn yet" : (e as Error).message };
  }
  const rows = (r.pages ?? []).map((p) => fromWebynPage(p)).filter((x): x is NonNullable<typeof x> => !!x);
  await upsertFromSource(rows);
  return { ok: true, n: rows.length, error: r.watching === false ? "Watching Webyn is switched off on the gateway (CONVERT_WEBYN=off)" : null };
}

/** Content's page to-dos with their A/B test switched on - until APSOconvert runs a test for that piece, then that one. */
async function syncPageBuilder(): Promise<SourceRun> {
  const [planned, tests] = await Promise.all([plannedTests(), listTests("test")]);
  const started = new Set(tests.map((t) => t.piece).filter((x): x is string => !!x));
  const rows: FromSource[] = planned.filter((p) => !started.has(String(p.pieceId))).map((p) => fromPlanned(p));
  await upsertFromSource(rows);
  await hideMissing("pagebuilder", rows.map((r) => r.key));
  return { ok: true, n: rows.length, error: null };
}

const safe = async (f: () => Promise<SourceRun>): Promise<SourceRun> => {
  try { return await f(); } catch (e) { return { ok: false, n: 0, error: String((e as Error)?.message ?? e).slice(0, 300) }; }
};

/** Every source once; what each said is kept for the page (KV_SYNC). */
export async function syncAll(): Promise<SyncRun> {
  const [apsoconvert, chat, webyn, pagebuilder] = await Promise.all([safe(syncConvert), safe(syncChat), safe(syncWebyn), safe(syncPageBuilder)]);
  const run: SyncRun = { at: new Date().toISOString(), sources: { apsoconvert, chat, webyn, pagebuilder } };
  await kvSet(KV_SYNC, run).catch(() => {});
  return run;
}

/** The same, under the lock - the timer and the button never run it twice at once. Null: a run is going on. */
export async function syncLocked(): Promise<SyncRun | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try { return await syncAll(); } finally { await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {}); }
  } finally {
    client.release();
  }
}

export const lastSync = () => kvGet<SyncRun>(KV_SYNC).catch(() => undefined);

let started = false;
export function startExperimentsSync(): void {
  if (started || String(process.env.EXPERIMENTS_SYNC ?? "").toLowerCase() === "off") return;
  started = true;
  console.log("[experiments] on: the A/B testing record kept up from APSOconvert, the shop chat, Webyn and the Page builder every 30 min");
  const tick = () => void syncLocked().then((r) => {
    if (r) console.log(`[experiments] synced: ${Object.entries(r.sources).map(([k, s]) => `${k} ${s.ok ? s.n : `failed (${s.error})`}`).join(", ")}`);
  }).catch((e) => console.warn(`[experiments] sync failed: ${(e as Error).message}`));
  setInterval(tick, TICK_MS).unref?.();
  setTimeout(tick, 4 * 60_000).unref?.();
}
