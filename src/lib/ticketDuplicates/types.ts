// DUPLICATES - the hub's rules (SARCLA 02.11.2026: "improve a lot the duplicated app ... with also tabs to steer the
// different types"). Measured on the 754 tickets the DUPS workflow flagged from July to October 2026:
//   - 432 (57%) had only CLOSED duplicates - a new request on an order whose earlier ticket was done; merged: 10;
//   - 238 had an open one in the same pipeline - about 60 of them with the same subject (the same request twice), the
//     rest another request on the same order (an AVOR mail beside a customer's question);
//   - 55 had theirs open only in another pipeline (ESO, TSA).
// 40 of the 754 were merged. So the hub tells two kinds apart, each with its own tab and switch:
//   - twice: the same request twice - the same subject from the same sender, or on the same order, while the earlier
//            ticket is still open in the same pipeline, within a few days: "Possible duplicate", a person merges it.
//            100% SURE (SARCLA, same day: "if we are 100% ... merge the 100% directly and the rest await for the manual")
//            when the first e-mail's text is the same too (engine.ts reads it): merged into the older ticket by the hub;
//   - order: another open ticket on the same order in the same pipeline - another request: "Same order", the owner of
//            the oldest takes this one too (one person per order), nothing to merge.
// Never compared: certificates, C2S problems, warnings, erosion win-backs (the hub's erosion engine never makes the same
// one twice - SARCLA: "this is solved"), and the texts set on the page. Closed tickets on the same order are history,
// an open one in another pipeline is shown - neither is ever a flag. Pure: no HubSpot, no database.

import { extractKeys, fmtKeys, isErosion, keysMatch, type Key } from "./rules";

export type DupType = "twice" | "order";
export const DUP_TYPES: DupType[] = ["twice", "order"];

export type Cand = {
  id: string; subject: string; orderNumber: string | null; owner: string | null; createdate: string | null;
  closed: boolean; closedAt: string | null; erosionKey: string | null; pipeline: string | null;
  /** found among the tickets of the same sender (the ticket's first contact) */
  sameSender?: boolean;
};
/** The ticket checked, with its sender: the first contact, its e-mail domain and name. */
export type Me = Cand & { sender: { id: string; domain: string | null; name: string | null } | null };

export type TypeSettings = {
  twice: { on: boolean; withinHours: number; handOver: boolean; autoMerge: boolean; internalDomains: string[] };
  order: { on: boolean; handOver: boolean; ownerMaxAgeDays: number };
  /** subjects never compared, whatever the type (contained, any case) - on top of the built-in rules */
  neverMatchTexts: string[];
};
/** The senders that are systems or colleagues, never a customer writing twice: the shop, the ERP, Anyseals, A+P itself
 *  (October 2026: 90 of the 126 same-subject pairs came from these four). */
export const SYSTEM_DOMAINS = ["apsoparts.com", "angst-pfister.com", "anyseals.eu", "oracle.com"];
export const DEFAULT_TYPES: TypeSettings = {
  twice: { on: true, withinHours: 72, handOver: true, autoMerge: true, internalDomains: SYSTEM_DOMAINS },
  order: { on: true, handOver: true, ownerMaxAgeDays: 30 },
  // the ERP's stale-export warning, and the notices a mail server or an absence sends - never a request (October 2026:
  // "Delivery Status Notification (Failure)" and "Acknowledgement Notification" came twice from the same sender)
  neverMatchTexts: ["ERP Order Export Stale Warning", "Delivery Status Notification", "Undeliverable", "Unzustellbar", "Mail delivery failed", "Acknowledgement Notification", "Automatic reply", "Automatische Antwort", "Out of Office", "Abwesenheitsnotiz", "Réponse automatique"],
};

export type Verdict = {
  type: DupType | null;
  /** possible: a person decides - merge or not; related: another open ticket on the same order */
  status: "possible" | "related" | null;
  /** twice only: the first e-mail's text is the same too - the hub merges it (engine.ts sets it) */
  sure?: boolean;
  /** the other tickets, the oldest first - the one to merge into, or to work with */
  of: string[];
  /** minutes between the oldest of `of` and this ticket */
  gapMin?: number;
  /** one sentence, as written on the ticket */
  why: string;
  ownerChange: { ownerId: string; fromTicket: string } | null;
  /** closed tickets on the same order - history, never a flag */
  history: string[];
  /** open tickets on the same order in another pipeline - shown, never a flag */
  elsewhere: string[];
  /** never compared: the rule or the text that left it out */
  excludedBy?: string;
  /** the sender is a system or a colleague - the same subject from them alone is never "twice" */
  systemSender?: boolean;
  /** why nothing was compared */
  skip?: string;
};

/** The built-in rules a ticket is never compared by - the page lists them beside the texts. */
export const BUILT_IN: { label: string; test: (s: string) => boolean }[] = [
  { label: "Certificates", test: (s) => /^\s*CERTIFICATES?\s*\|/i.test(s) || /certificate due|create the certificate|days for delivery/i.test(s) },
  { label: "C2S problems", test: (s) => /^\s*C2S PROBLEM/i.test(s) },
  { label: "Warnings (⚠)", test: (s) => /^\s*⚠/.test(s) },
  { label: "Erosion win-backs", test: (s) => isErosion(s) },
];
/** What leaves a subject out: a built-in rule's name, or the text it contains - null when it is compared. */
export function excludedBy(s: string, texts: string[]): string | null {
  const rule = BUILT_IN.find((r) => r.test(s));
  if (rule) return rule.label;
  const low = s.toLowerCase();
  return texts.find((t) => t.trim() && low.includes(t.trim().toLowerCase()))?.trim() ?? null;
}

/** Subjects the hub or a form makes, the same for every request of its kind: a chat ("Request from chat | | BO TOPIC"),
 *  a web form ("Customer Form | Delivery: Existing Order | <name>") - the same one twice is not the same request
 *  (measured on the year: same sender, same template, a day apart, other questions). */
const TEMPLATE = /^\s*(request from (the )?chat|📍?\s*chat request|customer form)\b/i;

/** The words a person wrote: the longest part of the subject between the "|" the routing adds ("BO | Email | ..."),
 *  without Re:/AW:/FW:, accents, case or punctuation. */
export function coreSubject(s: string | null | undefined): string {
  const parts = String(s ?? "").split("|").map((x) => x.trim()).filter((x) => x && !/^(bo|email|e-mail|helpline)$/i.test(x));
  let core = [...parts].sort((a, b) => b.length - a.length)[0] ?? "";
  for (let i = 0; i < 4; i++) core = core.replace(/^\s*((re|aw|wg|fw|fwd|tr|r|rif|sv|vs|antw)\s*:\s*)+/i, "");
  return core.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** An e-mail's words, for "the same text": the quoted earlier mail and the signature noise left out, accents and case. */
export function coreText(s: string | null | undefined): string {
  let t = String(s ?? "");
  // the quoted mail a reply carries ("On ... wrote:", "Von: ...", "-----Original Message-----")
  const cut = t.search(/\n\s*(-{2,}\s*original message|von:\s|from:\s|de\s*:\s|am .{5,80} schrieb|on .{5,80} wrote)/i);
  if (cut > 40) t = t.slice(0, cut);
  return t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 3000);
}
/** The same text: identical, or at least 90% of the words in common (a forwarded copy, a footer added by a server). */
export function sameText(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const A = new Set(a.split(" ").filter((w) => w.length > 2)), B = new Set(b.split(" ").filter((w) => w.length > 2));
  if (A.size < 5 || B.size < 5) return false;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both) >= 0.9;
}

const keysOf = (t: { subject: string; orderNumber: string | null }): Key[] =>
  [...new Map([...extractKeys(t.subject), ...extractKeys(t.orderNumber)].map((k) => [`${k.core}.${k.pos ?? ""}`, k])).values()];
const at = (iso: string | null | undefined) => { const n = Date.parse(iso ?? ""); return Number.isFinite(n) ? n : null; };
/** "40 min", "5 h", "3 days" */
export const ago = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); return m < 120 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`; };

/** What the hub makes of a ticket: the kind of duplicate (or none), the other tickets, the sentence, the owner. */
export function decide(me: Me, cands: Cand[], s: TypeSettings, archived: Set<string>, names: (id: string) => string = (x) => x): Verdict {
  const none = (extra: Partial<Verdict> = {}): Verdict => ({ type: null, status: null, of: [], why: "", ownerChange: null, history: [], elsewhere: [], ...extra });
  const out = excludedBy(me.subject, s.neverMatchTexts);
  if (out) return none({ excludedBy: out, skip: `never compared - ${out}` });
  const mine = at(me.createdate) ?? Date.now();
  // each ticket once, never itself, never one created after it (that one is checked itself and points back)
  const seen = new Set<string>([me.id]);
  const others = cands.filter((c) => !seen.has(c.id) && (seen.add(c.id), true)).filter((c) => (at(c.createdate) ?? Infinity) <= mine && !excludedBy(c.subject, s.neverMatchTexts));
  const oldestFirst = (a: Cand, b: Cand) => String(a.createdate).localeCompare(String(b.createdate));
  const openThen = (c: Cand) => !c.closed || (at(c.closedAt) ?? 0) > mine;
  const label = (c: Cand) => `ticket ${c.id} (${c.owner ? names(c.owner) : "no owner"})`;

  const myKeys = keysOf(me);
  const core = coreSubject(me.subject);
  // a subject that is only the sender's name, or a template (a chat, a web form), says nothing about the request
  const coreOk = core.length >= 6 && core !== (me.sender?.name ? coreSubject(me.sender.name) : "") && !TEMPLATE.test(me.subject);
  const system = !!me.sender?.domain && s.twice.internalDomains.some((d) => d.trim() && me.sender!.domain!.toLowerCase().endsWith(d.trim().toLowerCase()));
  const customer = !!me.sender && !system;
  // the same subject again from a system or a colleague - counted, never "twice" (the shop's "Request billing address
  // change" is a different customer each time)
  const sameAgain = (c: Cand) => coreOk && !!c.sameSender && coreSubject(c.subject) === core && openThen(c) && c.pipeline === me.pipeline && (mine - (at(c.createdate) ?? 0)) / 3600_000 <= s.twice.withinHours;
  if (!myKeys.length && !(coreOk && customer)) {
    return none({ ...(system && others.some(sameAgain) ? { systemSender: true } : {}), skip: system ? "a system sender, no order number" : "no order number, and no subject from a customer to compare" });
  }

  const twice: Cand[] = [], order: Cand[] = [], history: Cand[] = [], elsewhere: Cand[] = [];
  let systemTwice = false;
  for (const c of others) {
    if (isErosion(c.subject)) continue;
    const sameOrder = myKeys.length > 0 && keysMatch(myKeys, keysOf(c));
    const samePipe = c.pipeline === me.pipeline;
    const open = openThen(c);
    const hours = (mine - (at(c.createdate) ?? 0)) / 3600_000;
    const sameWords = coreOk && coreSubject(c.subject) === core && hours <= s.twice.withinHours;
    if (s.twice.on && open && samePipe && sameWords && ((c.sameSender && customer) || sameOrder)) twice.push(c);
    else {
      if (system && sameAgain(c)) systemTwice = true;
      if (sameOrder && open && samePipe) order.push(c);
      else if (sameOrder && !open) history.push(c);
      else if (sameOrder && open) elsewhere.push(c);
    }
  }
  [twice, order, history, elsewhere].forEach((x) => x.sort(oldestFirst));
  const base = { history: history.map((c) => c.id).reverse().slice(0, 10), elsewhere: elsewhere.map((c) => c.id).slice(0, 10), ...(systemTwice ? { systemSender: true } : {}) };

  // the owner of the oldest one, when it is recent enough, someone still here, and not already this ticket's
  const handTo = (list: Cand[], maxDays: number) => {
    for (const c of list) {
      if (!c.owner || mine - (at(c.createdate) ?? 0) > maxDays * 86400_000) continue;
      if (c.owner === me.owner) return null;
      if (archived.has(c.owner)) continue;
      return { ownerId: c.owner, fromTicket: c.id };
    }
    return null;
  };
  if (twice.length) {
    const first = twice[0];
    const gap = mine - (at(first.createdate) ?? mine);
    const how = first.sameSender && customer ? "from the same sender" : `on order ${fmtKeys(myKeys)}`;
    return {
      ...none(), ...base, type: "twice", status: "possible", sure: false, of: twice.map((c) => c.id), gapMin: Math.round(gap / 60_000),
      why: `Same subject ${how}, ${ago(gap)} after ${label(first)}, still open`,
      ownerChange: s.twice.handOver ? handTo(twice, s.twice.withinHours / 24) : null,
    };
  }
  if (order.length && s.order.on) {
    const first = order[0];
    return {
      ...none(), ...base, type: "order", status: "related", of: order.map((c) => c.id), gapMin: Math.round((mine - (at(first.createdate) ?? mine)) / 60_000),
      why: `Order ${fmtKeys(myKeys)} is also open in ${label(first)}${order.length > 1 ? ` and ${order.length - 1} more` : ""} - another request on the same order`,
      ownerChange: s.order.handOver ? handTo(order, s.order.ownerMaxAgeDays) : null,
    };
  }
  return none(base);
}

/** The 100% case: "twice", and the first e-mail of both says the same. The sentence says so. */
export function makeSure(v: Verdict, sender: string | null): Verdict {
  if (v.type !== "twice") return v;
  return { ...v, sure: true, why: `${v.why} - the same e-mail${sender ? ` from ${sender}` : ""}, word for word` };
}
