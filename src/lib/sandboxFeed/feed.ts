// ONE SANDBOX, ONE ROUND - collect what it asked for, run each read here (run.ts), code it (code.ts), deliver it.
// The timer, the lock and the ERP-chain check are feeder.ts; this part is tested end to end (tests/sandbox-loop.test.ts).

import { hubspotKey, sqlKey } from "../sandbox/canon";
import type { Asked, Delivery, Review } from "../sandbox/link";
import type { PendingInvite } from "../sandbox/peopleList";
import type { HsRequest, SqlRequest } from "../sandbox/store";
import { codeHubspotAnswer, codeRows, kindOfPath, type CodeCtx } from "./code";
import { moneyFactor } from "./policy";
import { hubspotRefusal, propertyTypes, runHubspotRead, runSqlRead, sqlRefusal } from "./run";

/** A round stops taking new reads after this; the rest stay asked for the next round. */
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

/** One sandbox, one round. Returns the line for the log. */
export type FeedOptions = {
  /** Today's Railway token for the CLI; delivered to a sandbox that holds an older one. */
  railway?: { token: string; at: string };
  /** Mails a review to the reviewer (feeder.ts passes the hub's mailer). */
  sendReview?: (r: Review, sandboxHost: string) => Promise<void>;
  /** Mails a new person their one-time link to the sandbox. */
  sendInvite?: (i: PendingInvite, sandboxHost: string) => Promise<void>;
};

export async function feedOne(base: string, linkKey: string, opts: FeedOptions = {}): Promise<string> {
  const host = base.replace(/^https?:\/\//, "");
  const got = await fetch(`${base}/api/sandbox-link/feed`, { headers: { authorization: `Bearer ${linkKey}` }, signal: AbortSignal.timeout(20_000) });
  if (!got.ok) return `${host}: the feed answered ${got.status}`;
  const asked = (await got.json()) as Asked;
  const reviews = opts.sendReview ? asked.reviews ?? [] : [];
  const invites = opts.sendInvite ? asked.invites ?? [] : [];
  const newToken = opts.railway && (!asked.railwayTokenAt || asked.railwayTokenAt < opts.railway.at) ? opts.railway.token : undefined;
  if (!asked.misses.length && !asked.asks.length && !reviews.length && !invites.length && !newToken) return `${host}: nothing asked`;

  const ctx: CodeCtx = { salt: linkKey, factor: moneyFactor(linkKey) };
  const until = Date.now() + ROUND_BUDGET_MS;
  let pending: Delivery = { answers: [], refused: [], asks: [] };
  let answered = 0, refused = 0, left = 0;
  const reasons = new Map<string, number>();
  const flush = async () => {
    if (pending.answers!.length || pending.refused!.length || pending.asks!.length || pending.reviewsSent || pending.invitesSent || pending.railwayToken) {
      await post(base, linkKey, pending);
    }
    pending = { answers: [], refused: [], asks: [] };
  };
  const refuse = (why: string) => { refused++; reasons.set(why, (reasons.get(why) ?? 0) + 1); };

  for (const m of asked.misses) {
    if (Date.now() > until) { left++; continue; }
    const out = await answerOne(m.kind, m.request, ctx, m.key).catch((e: Error) => ({ refused: `the hub could not run it: ${e.message.slice(0, 120)}` }));
    if ("answer" in out) { pending.answers!.push(out.answer); answered++; }
    else { pending.refused!.push({ key: m.key, note: out.refused }); refuse(out.refused); }
    if (pending.answers!.length + pending.refused!.length >= DELIVER_EVERY) await flush();
  }
  for (const a of asked.asks) {
    if (Date.now() > until) { left++; continue; }
    const spec = (a.spec ?? {}) as { kind?: string; request?: unknown };
    const out = await answerOne(String(spec.kind ?? ""), spec.request, ctx).catch((e: Error) => ({ refused: `the hub could not run it: ${e.message.slice(0, 120)}` }));
    if ("answer" in out) { pending.answers!.push(out.answer); pending.asks!.push({ id: a.id, state: "answered", key: out.answer.key }); answered++; }
    else { pending.asks!.push({ id: a.id, state: "refused", note: out.refused }); refuse(out.refused); }
  }
  let mailed = 0;
  const sent: number[] = [];
  for (const r of reviews) {
    try { await opts.sendReview!(r, host); sent.push(r.id); mailed++; }
    catch (e) { console.warn(`[sandbox-feed] ${host}: review ${r.id} not mailed: ${(e as Error).message.slice(0, 200)}`); }
  }
  if (sent.length) pending.reviewsSent = sent;
  const invited: number[] = [];
  for (const i of invites) {
    try { await opts.sendInvite!(i, host); invited.push(i.userId); }
    catch (e) { console.warn(`[sandbox-feed] ${host}: the link for user ${i.userId} not mailed: ${(e as Error).message.slice(0, 200)}`); }
  }
  if (invited.length) pending.invitesSent = invited;
  if (newToken) pending.railwayToken = newToken;
  await flush();
  const why = [...reasons].map(([r, n]) => `${n}x ${r}`).join("; ");
  return `${host}: ${answered} answered, ${refused} refused${why ? ` (${why})` : ""}${left ? `, ${left} left for the next round` : ""}`
    + `${mailed ? `, ${mailed} review${mailed === 1 ? "" : "s"} mailed` : ""}${invited.length ? `, ${invited.length} sign-up link${invited.length === 1 ? "" : "s"} mailed` : ""}`
    + `${newToken ? ", Railway token replaced" : ""}`;
}
