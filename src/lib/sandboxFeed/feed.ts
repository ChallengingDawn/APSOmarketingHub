// ONE SANDBOX - read what waits in it, BRING it (run each read here - run.ts - code it - code.ts - deliver it), and the
// minute round's errands (mails, the CLI's Railway token). Data leaves only through bring(), which the hub's Sandbox app
// calls when a person presses Bring data or Bring requested data there (SARCLA 26.10.2026: the hub is the front end for
// pulling data - behind its login, its TOTP and its log). The minute round never runs a read.
// The timer, the lock and the ERP-chain check are feeder.ts; this part is tested end to end (tests/sandbox-loop.test.ts).

import { hubspotKey, sqlKey } from "../sandbox/canon";
import type { Asked, Delivery, Review } from "../sandbox/link";
import type { HsRequest, SqlRequest } from "../sandbox/store";
import { codeHubspotAnswer, codeRows, kindOfPath, type CodeCtx } from "./code";
import { targetOf } from "../sandbox/proxy";
import { moneyFactor } from "./policy";
import { hubspotRefusal, propertyTypes, runHubspotRead, runSqlRead, sqlRefusal } from "./run";

/** A bring stops taking new reads after this; the rest keep waiting for the next press. */
const ROUND_BUDGET_MS = 45_000;
const DELIVER_EVERY = 40;

type Answer = NonNullable<Delivery["answers"]>[number];
type Outcome = { answer: Answer } | { refused: string };

/** One read: refused, or run and coded. `key` is the sandbox's own key for it (a miss) or worked out here (an ask). */
export async function answerOne(kind: string, request: unknown, base: CodeCtx, key?: string): Promise<Outcome> {
  if (kind === "hs") {
    const req = request as HsRequest;
    if (!req || typeof req.url !== "string" || typeof req.method !== "string") return { refused: "not a HubSpot request" };
    const no = hubspotRefusal(req);
    if (no) return { refused: no };
    const { objectType } = kindOfPath(req.url);
    const types = objectType ? await propertyTypes(objectType) : undefined;
    const { status, body } = await runHubspotRead(req);
    const coded = codeHubspotAnswer(req.url, status, body, { ...base, propType: types ? (p) => types.get(p) : undefined });
    if ("refused" in coded) return coded;
    return { answer: { key: key ?? hubspotKey(req.method, req.url, req.body), kind, request: req, response: coded.response } };
  }
  if (kind === "sql") {
    const req = request as SqlRequest;
    if (!req || typeof req.text !== "string") return { refused: "not a database read" };
    const no = sqlRefusal(req);
    if (no) return { refused: no };
    const { rows, cut } = await runSqlRead({ text: req.text, params: Array.isArray(req.params) ? req.params : [] });
    const coded = codeRows(rows, base);
    if ("refused" in coded) return coded;
    if (cut) console.warn(`[sandbox-feed] a read was cut to its first ${rows.length} rows`);
    return { answer: { key: key ?? sqlKey(req.text, req.params), kind, request: req, response: coded.response } };
  }
  return { refused: "unknown kind of read" };
}

async function post(base: string, linkKey: string, d: Delivery): Promise<void> {
  const res = await fetch(`${base}/api/sandbox-link/feed`, {
    method: "POST", headers: { authorization: `Bearer ${linkKey}`, "content-type": "application/json" },
    body: JSON.stringify(d), signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`the sandbox refused the delivery (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

/** A sandbox's name on the hub (/sandbox/run/<name>) - for the log, the mails and the Sandbox app. */
export const nameOf = (base: string) => targetOf(base)?.slug ?? base.replace(/^https?:\/\//, "");

/** What waits in a sandbox, who works there, its counts, and its errands. */
export async function readSandbox(base: string, linkKey: string): Promise<Asked> {
  const got = await fetch(`${base}/api/sandbox-link/feed`, { headers: { authorization: `Bearer ${linkKey}` }, signal: AbortSignal.timeout(20_000) });
  if (!got.ok) throw new Error(`${nameOf(base)} answered ${got.status}`);
  return (await got.json()) as Asked;
}

export type BringResult = { answered: number; refused: number; left: number; reasons: [string, number][]; line: string };

/**
 * Bring data ("reads": what the sandbox's pages could not answer) or Bring requested data ("asks": the CLI's asks):
 * each one refused, or run here read-only, coded, leak-checked - and delivered. `only` narrows it to some of them.
 */
export async function bring(base: string, linkKey: string, which: "reads" | "asks", only?: { keys?: string[]; ids?: number[] }): Promise<BringResult> {
  const asked = await readSandbox(base, linkKey);
  const ctx: CodeCtx = { salt: linkKey, factor: moneyFactor(linkKey) };
  const until = Date.now() + ROUND_BUDGET_MS;
  let pending: Delivery = { answers: [], refused: [], asks: [] };
  let answered = 0, refused = 0, left = 0;
  const reasons = new Map<string, number>();
  const flush = async () => {
    if (pending.answers!.length || pending.refused!.length || pending.asks!.length) await post(base, linkKey, pending);
    pending = { answers: [], refused: [], asks: [] };
  };
  const refuse = (why: string) => { refused++; reasons.set(why, (reasons.get(why) ?? 0) + 1); };
  const failed = (e: Error) => ({ refused: `the hub could not run it: ${e.message.slice(0, 120)}` });

  if (which === "reads") {
    for (const m of asked.misses.filter((x) => !only?.keys || only.keys.includes(x.key))) {
      if (Date.now() > until) { left++; continue; }
      const out = await answerOne(m.kind, m.request, ctx, m.key).catch(failed);
      if ("answer" in out) { pending.answers!.push(out.answer); answered++; }
      else { pending.refused!.push({ key: m.key, note: out.refused }); refuse(out.refused); }
      if (pending.answers!.length + pending.refused!.length >= DELIVER_EVERY) await flush();
    }
  } else {
    for (const a of asked.asks.filter((x) => !only?.ids || only.ids.includes(x.id))) {
      if (Date.now() > until) { left++; continue; }
      const spec = (a.spec ?? {}) as { kind?: string; request?: unknown };
      const out = await answerOne(String(spec.kind ?? ""), spec.request, ctx).catch(failed);
      if ("answer" in out) { pending.answers!.push(out.answer); pending.asks!.push({ id: a.id, state: "answered", key: out.answer.key }); answered++; }
      else { pending.asks!.push({ id: a.id, state: "refused", note: out.refused }); refuse(out.refused); }
    }
  }
  await flush();
  const why = [...reasons].map(([r, n]) => `${n}x ${r}`).join("; ");
  return {
    answered, refused, left, reasons: [...reasons],
    line: `${nameOf(base)}: ${answered} brought, ${refused} refused${why ? ` (${why})` : ""}${left ? `, ${left} still waiting` : ""}`,
  };
}

export type FeedOptions = {
  /** Today's Railway token for the CLI; delivered to a sandbox that holds an older one. */
  railway?: { token: string; at: string };
  /** Mails a review to the reviewer (feeder.ts passes the hub's mailer). */
  sendReview?: (r: Review, sandbox: string) => Promise<void>;
};

/** The minute round for one sandbox: its reviews mailed, today's Railway token handed over.
 *  It never runs a read - that is bring(). Returns the line for the log. */
export async function feedOne(base: string, linkKey: string, opts: FeedOptions = {}): Promise<string> {
  const name = nameOf(base);
  const asked = await readSandbox(base, linkKey).catch(() => null);
  if (!asked) return `${name}: did not answer`;
  const reviews = opts.sendReview ? asked.reviews ?? [] : [];
  const newToken = opts.railway && (!asked.railwayTokenAt || asked.railwayTokenAt < opts.railway.at) ? opts.railway.token : undefined;
  if (!reviews.length && !newToken) return `${name}: nothing to do`;

  const d: Delivery = {};
  const sent: number[] = [];
  for (const r of reviews) {
    try { await opts.sendReview!(r, name); sent.push(r.id); }
    catch (e) { console.warn(`[sandbox-feed] ${name}: review ${r.id} not mailed: ${(e as Error).message.slice(0, 200)}`); }
  }
  if (sent.length) d.reviewsSent = sent;
  if (newToken) d.railwayToken = newToken;
  if (d.reviewsSent || d.railwayToken) await post(base, linkKey, d);
  return `${name}: ${sent.length} review${sent.length === 1 ? "" : "s"} mailed${newToken ? ", Railway token replaced" : ""}`;
}

/** A CLI code confirmed on the hub: the sandbox learns who confirmed it, and the CLI collects its token there. */
export async function approveCli(base: string, linkKey: string, code: string, email: string): Promise<void> {
  const res = await fetch(`${base}/api/sandbox-link/cli-grant`, {
    method: "POST", headers: { authorization: `Bearer ${linkKey}`, "content-type": "application/json" },
    body: JSON.stringify({ code, email }), signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? `${nameOf(base)} answered ${res.status}`);
}

/** Delete all, pressed on the hub: the sandbox's own Delete all, through the link. */
export async function deleteAllIn(base: string, linkKey: string): Promise<{ tables: number }> {
  const res = await fetch(`${base}/api/sandbox-link/delete-all`, { method: "POST", headers: { authorization: `Bearer ${linkKey}` }, signal: AbortSignal.timeout(30_000) });
  const j = (await res.json().catch(() => ({}))) as { tables?: number; error?: string };
  if (!res.ok) throw new Error(j.error ?? `${nameOf(base)} answered ${res.status}`);
  return { tables: j.tables ?? 0 };
}
