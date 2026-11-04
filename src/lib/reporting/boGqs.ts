// BACK-OFFICE REPORTS > GQS, the whole pipeline (SARCLA 04.11.2026: "GQS is very very incomplete - this is a full pipeline,
// we should have the full scope"). Pure: no HubSpot, no database - the read is in boReport.ts (readGqs), the page draws from
// these. Every GQS task (Back Office - Special Tasks GQS, 1726786775) as one small record, from its properties and two of
// its histories - its stage and its STATUS OF GQS:
//   the request    created by Sales (or in New for Back-Office): its type, requester, line manager, customer, the order
//                  potential and the margin Sales typed in
//   the approval   kept in STATUS OF GQS since March 2026: Automatically Approved, or Review by Line manager and then
//                  Approved / Refused by Line Manager
//   the work       each stage it went through and the days in it, every visit added up - Created by Sales, New for
//                  Back-Office, Open the GQS Task (the Back Office), Waiting on GQS, Waiting on APSO, Waiting on Customer,
//                  Remind Back-Office - and the stages since removed from the pipeline
//   the outcome    Offer Sent to Sales (the first time, and how often) or Refused - by GQS, the Back Office or a line
//                  manager, with the reason typed in
//   the result     WON / LOST in STATUS OF GQS, as it stands now (a workflow sets it from the sales ticket)
// Measured 04.11.2026 on the 697 tasks since July 2025: 553 in Offer Sent to Sales, 91 refused, 53 open; 67 WON and 203
// LOST; an approval kept on every task since March 2026, on almost none before; 142 offers sent more than once.

import { decide, factsOf, type Limits, type Reason } from "../gqsApprovals/rules";

export const GQS_STAGE = {
  sales: "3153750219", new: "2338266314", open: "2338266316", gqs: "4704538856", apso: "6078992599", cust: "4793532647", remind: "2964068584",
  refused: "2510335189", offer: "2520497377",
} as const;
export type GStage = keyof typeof GQS_STAGE | "gone";
const BY_ID = new Map<string, GStage>(Object.entries(GQS_STAGE).map(([k, id]) => [id, k as GStage]));
/** the stages a task waits in, in the pipeline's order - and the ones since removed from it */
export const WORK: GStage[] = ["sales", "new", "open", "gqs", "apso", "cust", "remind", "gone"];
export const STAGE_LABEL: Record<GStage, string> = {
  sales: "Created by Sales", new: "New for Back-Office", open: "Open the GQS Task", gqs: "Waiting on GQS", apso: "Waiting on APSO", cust: "Waiting on Customer",
  remind: "Remind Back-Office", refused: "Refused", offer: "Offer Sent to Sales", gone: "Stages since removed",
};
/** who a stage waits on - said beside it */
export const STAGE_WHO: Record<GStage, string> = {
  sales: "the request and its approval", new: "waiting for the Back Office", open: "the Back Office prepares it", gqs: "GQS works on it", apso: "waiting on APSO",
  cust: "waiting on the customer", remind: "a reminder to the Back Office", refused: "", offer: "", gone: "stages no longer in the pipeline",
};
export const FIRST_MONTH = "2025-07";
export const STATUS = {
  auto: "Automatically Approved", review: "Review by Line manager", approved: "Approved by Line Manager", refused: "Refused by Line Manager",
} as const;

/**
 * One GQS task. Times in ms; ids are HubSpot owner ids; an empty value is left out (the page gets ~700 of them).
 *   s     its stage now ("gone": one since removed)
 *   ty    type of request; o its owner (the Back Office); rq the requester (Sales); lm the line manager; cu the customer
 *   pot   the order potential (EUR) and mar the margin (a fraction) Sales typed in; liq a liquidation article
 *   sent  first sent on to GQS (entered Waiting on GQS, or Waiting on APSO where it was put by mistake)
 *   of    first entered Offer Sent to Sales; ofN how often (only when more than once); rf when refused (the last time)
 *   at    when it entered the stage it is in now
 *   d     days in each stage, every visit added up (to a tenth; the stage it is in counts to now)
 *   ap    the approval: "a" Automatically Approved, "r" to the line manager; apAt when
 *   dec   the line manager's decision: "y" approved, "n" refused; decAt when
 *   res   WON ("w") / LOST ("l") as STATUS OF GQS says now; resAt when it was set
 *   by    who refused it ("gqs", "bo", "lm"), from STATUS OF GQS; why the reason typed in
 *   rule  why the approval rule sends it to the line manager, by the rule as it stands (big, small, mid, liquidation)
 */
export type GqsTask = {
  id: string; c: number; s: GStage;
  ty?: string; o?: string; rq?: string; lm?: string; cu?: string;
  pot?: number; mar?: number; liq?: 1;
  sent?: number; of?: number; ofN?: number; rf?: number; at?: number;
  d?: Partial<Record<GStage, number>>;
  ap?: "a" | "r"; apAt?: number; dec?: "y" | "n"; decAt?: number;
  res?: "w" | "l"; resAt?: number;
  by?: "gqs" | "bo" | "lm"; why?: string; rule?: Reason;
};
export type GqsKept = { at: string; tasks: GqsTask[]; limits: Limits };
export type H = { value?: string | null; timestamp?: string };

const DAY = 86_400_000;
const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const clip = (s: string | null | undefined, n: number) => { const t = tidy(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const num = (v: string | null | undefined) => { const t = (v ?? "").trim().replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const sorted = (h: H[] | undefined) => (h ?? []).filter((x) => x.timestamp && Number.isFinite(Date.parse(x.timestamp))).map((x) => ({ v: tidy(x.value), t: Date.parse(x.timestamp!) })).sort((a, b) => a.t - b.t);
const isOpen = (s: GStage) => s !== "offer" && s !== "refused";

/** A task from its properties and its stage and STATUS OF GQS histories (HubSpot's, any order). */
export function taskOf(id: string, p: Record<string, string | null | undefined>, stageH: H[] | undefined, statusH: H[] | undefined, limits: Limits, now = Date.now()): GqsTask | null {
  const c = Date.parse(p.createdate ?? "");
  if (!Number.isFinite(c)) return null;
  const s = BY_ID.get(p.hs_pipeline_stage ?? "") ?? "gone";
  const t: GqsTask = { id, c, s };
  const ty = tidy(p.gqs_type_of_request), cu = clip(p.customer_number_customer_name, 70);
  if (ty) t.ty = ty;
  if (p.hubspot_owner_id) t.o = p.hubspot_owner_id;
  if (p.back_office_ticket_requester) t.rq = p.back_office_ticket_requester;
  if (p.price_tier_approver) t.lm = p.price_tier_approver;
  if (cu) t.cu = cu;
  const f = factsOf(p);
  const pot = num(p.order_potential_);
  if (pot !== null && pot >= 0) t.pot = Math.round(pot);
  if (f.margin !== null) t.mar = Math.round(f.margin * 1000) / 1000;
  if (f.liquidation) t.liq = 1;

  // the stages: every visit, one after the other - a value repeated is the same visit
  const visits: { k: GStage; t: number }[] = [];
  for (const x of sorted(stageH)) {
    const k = BY_ID.get(x.v) ?? "gone";
    if (!x.v || (visits.length && visits[visits.length - 1].k === k)) continue;
    visits.push({ k, t: x.t });
  }
  if (!visits.length) visits.push({ k: s, t: c });
  const d: Partial<Record<GStage, number>> = {};
  visits.forEach((v, i) => {
    if (!isOpen(v.k)) return;
    const end = i + 1 < visits.length ? visits[i + 1].t : now;
    d[v.k] = (d[v.k] ?? 0) + Math.max(0, end - v.t) / DAY;
  });
  for (const k of Object.keys(d) as GStage[]) { const x = Math.round(d[k]! * 10) / 10; if (x > 0) d[k] = x; else delete d[k]; }
  if (Object.keys(d).length) t.d = d;
  const sent = visits.find((v) => v.k === "gqs" || v.k === "apso");
  if (sent) t.sent = sent.t;
  const offers = visits.filter((v) => v.k === "offer");
  if (offers.length) { t.of = offers[0].t; if (offers.length > 1) t.ofN = offers.length; }
  if (s === "refused") { const r = visits.filter((v) => v.k === "refused").pop(); t.rf = r?.t ?? visits[visits.length - 1].t; }
  t.at = visits[visits.length - 1].t;

  // the approval, the line manager's decision, the result - STATUS OF GQS over time
  const st = sorted(statusH).filter((x) => x.v);
  const reviewed = st.find((x) => x.v === STATUS.review || x.v === STATUS.approved || x.v === STATUS.refused);
  const auto = st.find((x) => x.v === STATUS.auto);
  // sent to the line manager (a re-entry after an approval of its own goes to the line manager too): when it went there
  if (reviewed) { t.ap = "r"; t.apAt = reviewed.t; }
  else if (auto) { t.ap = "a"; t.apAt = auto.t; }
  // the line manager's decision as it stands (the last one), timed by the first one after the request reached them
  const decs = st.filter((x) => x.v === STATUS.approved || x.v === STATUS.refused);
  if (decs.length) {
    t.dec = decs[decs.length - 1].v === STATUS.approved ? "y" : "n";
    t.decAt = (decs.find((x) => x.t >= (t.apAt ?? 0)) ?? decs[decs.length - 1]).t;
  }
  const now_ = tidy(p.status_of_gqs).toUpperCase();
  if (now_ === "WON" || now_ === "LOST") {
    t.res = now_ === "WON" ? "w" : "l";
    const set = st.filter((x) => x.v.toUpperCase() === now_).pop();
    if (set) t.resAt = set.t;
  }
  if (s === "refused" || t.dec === "n") {
    const by = st.filter((x) => /^Refused by /i.test(x.v)).pop()?.v.toLowerCase() ?? "";
    if (by.includes("gqs")) t.by = "gqs"; else if (by.includes("back")) t.by = "bo"; else if (by.includes("line")) t.by = "lm";
    const why = clip(p.reason_of_decline_by_pm, 160);
    if (why.replace(/[^\p{L}\p{N}]/gu, "").length >= 3) t.why = why;
  }
  if (t.ap === "r") { const v = decide(f, limits); if (v.review) t.rule = v.reason; }
  return t;
}

/* ── the sums the page draws ───────────────────────────────────────────── */

export const median = (xs: number[]): number | null => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const daysTo = (from: number, to: number | undefined) => (to && to >= from ? (to - from) / DAY : null);

/**
 * A set of requests (by the day they came in) and where they stand now:
 *   auto / review / noAp    approved by themselves, sent to a line manager, no approval kept (before March 2026)
 *   lmYes / lmNo / lmWait   of those sent to a line manager: approved, refused, not decided yet
 *   offer / refused / open  in Offer Sent to Sales, Refused, still in the pipeline
 *   won / lost              of those with an offer sent, STATUS OF GQS now
 *   pot / potN / potWon     the order potential typed in, on how many, of the won ones
 *   reminded / custWait     went to Remind Back-Office, waited on the customer
 *   toOffer / decH          days to the first offer; hours to the line manager's decision
 */
export type GSum = {
  n: number; auto: number; review: number; noAp: number; lmYes: number; lmNo: number; lmWait: number;
  offer: number; refused: number; open: number; won: number; lost: number;
  pot: number; potN: number; potWon: number; potLost: number; reminded: number; custWait: number;
  toOffer: number[]; decH: number[]; customers: number; again: number;
};
export function sumOf(ts: GqsTask[]): GSum {
  const s: GSum = { n: 0, auto: 0, review: 0, noAp: 0, lmYes: 0, lmNo: 0, lmWait: 0, offer: 0, refused: 0, open: 0, won: 0, lost: 0, pot: 0, potN: 0, potWon: 0, potLost: 0, reminded: 0, custWait: 0, toOffer: [], decH: [], customers: 0, again: 0 };
  const cus = new Map<string, number>();
  for (const t of ts) {
    s.n++;
    if (t.ap === "a") s.auto++; else if (t.ap === "r") { s.review++; if (t.dec === "y") s.lmYes++; else if (t.dec === "n") s.lmNo++; else s.lmWait++; } else s.noAp++;
    if (t.s === "offer") s.offer++; else if (t.s === "refused") s.refused++; else s.open++;
    if (t.of && t.res === "w") s.won++;
    if (t.of && t.res === "l") s.lost++;
    if (t.pot != null) { s.pot += t.pot; s.potN++; if (t.of && t.res === "w") s.potWon += t.pot; if (t.of && t.res === "l") s.potLost += t.pot; }
    if (t.d?.remind) s.reminded++;
    if (t.d?.cust) s.custWait++;
    const o = daysTo(t.c, t.of);
    if (o != null) s.toOffer.push(o);
    if (t.ap === "r" && t.decAt && t.apAt && t.decAt >= t.apAt) s.decH.push((t.decAt - t.apAt) / 3_600_000);
    if (t.cu) cus.set(t.cu, (cus.get(t.cu) ?? 0) + 1);
  }
  s.customers = cus.size;
  s.again = [...cus.values()].filter((x) => x > 1).length;
  return s;
}
/** won of the offers whose result is known */
export const winRate = (won: number, lost: number) => (won + lost ? won / (won + lost) : null);

/**
 * The offers sent to Sales in some months (by the day first sent, whenever asked for - like for like with the months
 * before, as a month's own requests are young) and what came of them; how long they took and how long GQS had them.
 */
export type OSum = { n: number; won: number; lost: number; pot: number; potWon: number; potLost: number; days: number[]; atGqs: number[]; again: number };
export function offersOf(ts: GqsTask[]): OSum {
  const s: OSum = { n: 0, won: 0, lost: 0, pot: 0, potWon: 0, potLost: 0, days: [], atGqs: [], again: 0 };
  for (const t of ts) {
    if (!t.of) continue;
    s.n++;
    if (t.res === "w") { s.won++; s.potWon += t.pot ?? 0; }
    if (t.res === "l") { s.lost++; s.potLost += t.pot ?? 0; }
    s.pot += t.pot ?? 0;
    const d = daysTo(t.c, t.of);
    if (d != null) s.days.push(d);
    if (t.d?.gqs) s.atGqs.push(t.d.gqs);
    if (t.ofN) s.again++;
  }
  return s;
}
/** The tasks refused in some months, by who refused them. */
export function refusalsOf(ts: GqsTask[]): { n: number; gqs: number; bo: number; lm: number; none: number } {
  const s = { n: 0, gqs: 0, bo: 0, lm: 0, none: 0 };
  for (const t of ts) { if (t.s !== "refused") continue; s.n++; s[t.by ?? "none"]++; }
  return s;
}
/** Each stage: the tasks that went through it, and the days they spent in it (median, average). */
export function stageTimes(ts: GqsTask[]): { stage: GStage; n: number; median: number | null; mean: number | null; now: number }[] {
  return WORK.map((stage) => {
    const xs = ts.map((t) => t.d?.[stage] ?? 0).filter((x) => x > 0);
    return { stage, n: xs.length, median: median(xs), mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, now: ts.filter((t) => t.s === stage).length };
  }).filter((x) => x.n > 0 || x.now > 0);
}
