// DUPLICATES - the hub's own rules, by type (SARCLA 02.11.2026: "improve a lot the duplicated app ... with also tabs to
// steer the different types"). Measured on the 754 tickets the DUPS workflow flagged from July to October 2026:
//   - 432 (57%) had only CLOSED duplicates - a new request on an order whose earlier ticket was done; merged: 10;
//   - 238 had an open one in the same pipeline - about 60 of them with the same subject (the same request twice), the
//     rest another request on the same order (an AVOR mail beside a customer's question);
//   - 55 had theirs open only in another pipeline (ESO, TSA).
// 40 of the 754 were merged. So the hub tells kinds apart, each with its own tab and switch:
//   - twice:   the same request twice - the same subject from the same sender, or on the same order, while the earlier
//              ticket is still open in the same pipeline, within a few days: "Possible duplicate", a person merges it;
//   - order:   another open ticket on the same order in the same pipeline - another request: "Same order", the owner of
//              the oldest takes this one too (one person per order), nothing to merge;
//   - erosion: two erosion win-backs with the same erosion key (customer, article, year): "Possible duplicate", owners kept.
// Closed tickets on the same order are history, and an open one in another pipeline is shown - neither is ever a flag.
// Pure: no HubSpot, no database (engine.ts reads, live.ts writes).

import { extractKeys, fmtKeys, isErosion, keysMatch, type Key } from "./rules";

export type DupType = "twice" | "order" | "erosion";
export const DUP_TYPES: DupType[] = ["twice", "order", "erosion"];

export type Cand = {
  id: string; subject: string; orderNumber: string | null; owner: string | null; createdate: string | null;
  closed: boolean; closedAt: string | null; erosionKey: string | null; pipeline: string | null;
  /** found among the tickets of the same sender (the ticket's first contact) */
  sameSender?: boolean;
};
/** The ticket checked, with its sender: the first contact, its e-mail domain and name. */
export type Me = Cand & { sender: { id: string; domain: string | null; name: string | null } | null };

export type TypeSettings = {
  twice: { on: boolean; withinHours: number; handOver: boolean; internalDomains: string[] };
  order: { on: boolean; handOver: boolean; ownerMaxAgeDays: number };
  erosion: { on: boolean };
  /** subjects never compared, whatever the type (contained, any case) - on top of the workflow's own */
  neverMatchTexts: string[];
};
/** The senders that are systems or colleagues, never a customer writing twice: the shop, the ERP, Anyseals, A+P itself
 *  (October 2026: 90 of the 126 same-subject pairs came from these four). */
export const SYSTEM_DOMAINS = ["apsoparts.com", "angst-pfister.com", "anyseals.eu", "oracle.com"];
export const DEFAULT_TYPES: TypeSettings = {
  twice: { on: true, withinHours: 72, handOver: true, internalDomains: SYSTEM_DOMAINS },
  order: { on: true, handOver: true, ownerMaxAgeDays: 30 },
  erosion: { on: true },
  // the ERP's stale-export warning, and the notices a mail server or an absence sends - never a request (October 2026:
  // "Delivery Status Notification (Failure)" and "Acknowledgement Notification" came twice from the same sender)
  neverMatchTexts: ["ERP Order Export Stale Warning", "Delivery Status Notification", "Undeliverable", "Unzustellbar", "Mail delivery failed", "Acknowledgement Notification", "Automatic reply", "Automatische Antwort", "Out of Office", "Abwesenheitsnotiz", "Réponse automatique"],
};

export type Verdict = {
  type: DupType | null;
  /** possible: a person decides - merge or not; related: another open ticket on the same order */
  status: "possible" | "related" | null;
  /** the other tickets, the oldest first - the one to merge into, or to work with */
  of: string[];
  /** one sentence, as written on the ticket */
  why: string;
  ownerChange: { ownerId: string; fromTicket: string } | null;
  /** closed tickets on the same order - history, never a flag */
  history: string[];
  /** open tickets on the same order in another pipeline - shown, never a flag */
  elsewhere: string[];
  /** why nothing was compared */
  skip?: string;
};

const NEVER = [/^\s*CERTIFICATES?\s*\|/i, /certificate due|create the certificate|days for delivery/i, /^\s*C2S PROBLEM/i, /^\s*⚠/];
export const neverCompared = (s: string, texts: string[]) => NEVER.some((r) => r.test(s)) || texts.some((t) => t.trim() && s.toLowerCase().includes(t.trim().toLowerCase()));

/** The words a person wrote: the longest part of the subject between the "|" the routing adds ("BO | Email | ..."),
 *  without Re:/AW:/FW:, accents, case or punctuation. */
export function coreSubject(s: string | null | undefined): string {
  const parts = String(s ?? "").split("|").map((x) => x.trim()).filter((x) => x && !/^(bo|email|e-mail|helpline)$/i.test(x));
  let core = [...parts].sort((a, b) => b.length - a.length)[0] ?? "";
  for (let i = 0; i < 4; i++) core = core.replace(/^\s*((re|aw|wg|fw|fwd|tr|r|rif|sv|vs|antw)\s*:\s*)+/i, "");
  return core.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const keysOf = (t: { subject: string; orderNumber: string | null }): Key[] =>
  [...new Map([...extractKeys(t.subject), ...extractKeys(t.orderNumber)].map((k) => [`${k.core}.${k.pos ?? ""}`, k])).values()];
const at = (iso: string | null | undefined) => { const n = Date.parse(iso ?? ""); return Number.isFinite(n) ? n : null; };
/** "40 min", "5 h", "3 days" */
export const ago = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); return m < 120 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`; };

/** What the hub makes of a ticket: the kind of duplicate (or none), the other tickets, the sentence, the owner. */
export function decide(me: Me, cands: Cand[], s: TypeSettings, archived: Set<string>, names: (id: string) => string = (x) => x): Verdict {
  const none = (skip?: string): Verdict => ({ type: null, status: null, of: [], why: "", ownerChange: null, history: [], elsewhere: [], ...(skip ? { skip } : {}) });
  if (neverCompared(me.subject, s.neverMatchTexts)) return none("never compared - certificates, C2S problems, warnings or an excluded text");
  const mine = at(me.createdate) ?? Date.now();
  // each ticket once, never itself, never one created after it (that one is checked itself and points back)
  const seen = new Set<string>([me.id]);
  const others = cands.filter((c) => !seen.has(c.id) && (seen.add(c.id), true)).filter((c) => (at(c.createdate) ?? Infinity) <= mine && !neverCompared(c.subject, s.neverMatchTexts));
  const oldestFirst = (a: Cand, b: Cand) => String(a.createdate).localeCompare(String(b.createdate));
  const openThen = (c: Cand) => !c.closed || (at(c.closedAt) ?? 0) > mine;
  const label = (c: Cand) => `ticket ${c.id} (${c.owner ? names(c.owner) : "no owner"})`;

  if (isErosion(me.subject)) {
    if (!s.erosion.on) return none("erosion - switched off");
    if (!me.erosionKey) return none("erosion ticket without an erosion key");
    const same = others.filter((c) => isErosion(c.subject) && c.erosionKey?.trim() === me.erosionKey!.trim()).sort(oldestFirst);
    if (!same.length) return none();
    return { ...none(), type: "erosion", status: "possible", of: same.map((c) => c.id), why: `Same erosion win-back (customer, article and year ${me.erosionKey}) as ${label(same[0])} - owners stay with the sales reps` };
  }

  const myKeys = keysOf(me);
  const core = coreSubject(me.subject);
  // a subject that is only the sender's name says nothing about the request
  const coreOk = core.length >= 6 && core !== (me.sender?.name ? coreSubject(me.sender.name) : "");
  const customer = !!me.sender && !(me.sender.domain && s.twice.internalDomains.some((d) => me.sender!.domain!.toLowerCase().endsWith(d.trim().toLowerCase())));
  if (!myKeys.length && !(coreOk && customer)) return none("no order number, and no subject from a customer to compare");

  const twice: Cand[] = [], order: Cand[] = [], history: Cand[] = [], elsewhere: Cand[] = [];
  for (const c of others) {
    if (isErosion(c.subject)) continue;
    const sameOrder = myKeys.length > 0 && keysMatch(myKeys, keysOf(c));
    const samePipe = c.pipeline === me.pipeline;
    const open = openThen(c);
    const hours = (mine - (at(c.createdate) ?? 0)) / 3600_000;
    if (s.twice.on && open && samePipe && coreOk && coreSubject(c.subject) === core && hours <= s.twice.withinHours && ((c.sameSender && customer) || sameOrder)) twice.push(c);
    else if (sameOrder && open && samePipe) order.push(c);
    else if (sameOrder && !open) history.push(c);
    else if (sameOrder && open) elsewhere.push(c);
  }
  [twice, order, history, elsewhere].forEach((x) => x.sort(oldestFirst));
  const base = { history: history.map((c) => c.id).reverse().slice(0, 10), elsewhere: elsewhere.map((c) => c.id).slice(0, 10) };

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
    const how = first.sameSender && customer ? "from the same sender" : `on order ${fmtKeys(myKeys)}`;
    return {
      ...none(), ...base, type: "twice", status: "possible", of: twice.map((c) => c.id),
      why: `Same subject ${how}, ${ago(mine - (at(first.createdate) ?? mine))} after ${label(first)}, still open`,
      ownerChange: s.twice.handOver ? handTo(twice, s.twice.withinHours / 24) : null,
    };
  }
  if (order.length && s.order.on) {
    const first = order[0];
    return {
      ...none(), ...base, type: "order", status: "related", of: order.map((c) => c.id),
      why: `Order ${fmtKeys(myKeys)} is also open in ${label(first)}${order.length > 1 ? ` and ${order.length - 1} more` : ""} - another request on the same order`,
      ownerChange: s.order.handOver ? handTo(order, s.order.ownerMaxAgeDays) : null,
    };
  }
  return { ...none(), ...base };
}
