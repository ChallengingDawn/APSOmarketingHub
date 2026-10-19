// TICKET ASSOCIATIONS - the pure decisions (no database, no HubSpot) so they can be tested.
//
// The HubSpot workflow this replaces ran on two triggers: a ticket was created, or a ticket
// moved stage (re-enrolment). The hub sees tickets as "changed since my last look", so it
// keeps, per ticket, the stage it last processed it in: a ticket it has never processed is
// "created", one whose stage differs is "moved stage", and a change that is neither (an
// edit, or the hub's own write coming back) is left alone - as the workflow left it.

export type Seen = { stage: string | null; ok: boolean };

/** Why a ticket is processed now, or null when it is not. */
export function reason(stage: string | null, seen: Seen | undefined): "new" | "stage" | "retry" | null {
  if (!seen) return "new";
  if (!seen.ok) return "retry";
  return (seen.stage ?? "") !== (stage ?? "") ? "stage" : null;
}

/**
 * Where the next look starts. Tickets come oldest change first; when a run reads them all,
 * the next starts at the newest change it saw, and when it stops at its cap, at the last one
 * it read - so nothing is skipped and the window always moves on. The overlap (a few minutes,
 * for HubSpot's search index) is taken off when the window is used, not here.
 */
export function nextSince(prev: number, lastChanges: number[]): number {
  const seen = lastChanges.filter((n) => Number.isFinite(n) && n > 0);
  return seen.length ? Math.max(prev, ...seen) : prev;
}

/** The first look after a start, or after a long stop: the last half hour, never more. */
export function firstSince(stored: number | null, now: number, maxBackMs = 30 * 60_000): number {
  return stored && now - stored <= 24 * 3_600_000 ? stored : now - maxBackMs;
}

/* ── order alerts (SARCLA, 17.10.2026) ──────────────────────────────────── */

/**
 * A shared mailbox, not a person: an order alert mailed there comes back into HubSpot as a new
 * ticket - 18.10.2026 00:40, the alert for "EROSION | 0653321032", owned by "TSA Team"
 * <helpline@apsoparts.com>, became TSA ticket 439348599022 with no owner. Such tickets are linked,
 * never mailed.
 */
const SHARED_MAILBOX = /^(helpline|support|sales|info|order|orders|service|office|admin|team|backoffice|avor|einkauf|verkauf|kontakt|contact|hello|noreply|no-reply|eso|tsa)@/i;
export const sharedMailbox = (email: string | null | undefined): boolean => !!email && SHARED_MAILBOX.test(email.trim());

/**
 * When the order alerts look again: every `everyMs` - or on the next tick while a backlog waits (the
 * last check read its full `maxRead`: the chain's morning load, or a look back). After a full check the
 * next one also starts at the mark itself, without the overlap: more than `maxRead` orders changed inside
 * the overlap would otherwise be read again and again, and the mark never move.
 */
export function alertsPlan(last: { at: string; read: number } | null, now: number, everyMs: number, maxRead: number, overlapMs: number): { due: boolean; overlapMs: number } {
  const backlog = !!last && last.read >= maxRead;
  return { due: !last || backlog || now - Date.parse(last.at) >= everyMs, overlapMs: backlog ? 0 : overlapMs };
}

/** An article number as Products & Pricing writes it: digits only, ten long (order lines may drop the leading zero). */
export const normArticle = (a: string): string => {
  const d = String(a ?? "").replace(/\D/g, "");
  return d.length && d.length <= 10 ? d.padStart(10, "0") : d;
};

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The articles an order shares with a ticket - when the order counts at all: an open ticket of
 * ESO or TSA, and an order placed on or after the day the ticket was opened (UTC days, as the
 * connector's offer match counted "converted"). Empty when it does not count.
 */
export function alertArticles(o: {
  orderArticles: string[]; orderDayMs: number; ticketCreatedMs: number; ticketArticles: Iterable<string>; open: boolean; pipeline: string | null;
  /** With `now`: an order placed more than this many days ago is old news, not an alert (default 14). */
  now?: number; maxAgeDays?: number;
}): string[] {
  if (!o.open || (o.pipeline !== "ESO" && o.pipeline !== "TSA")) return [];
  if (!Number.isFinite(o.orderDayMs) || !Number.isFinite(o.ticketCreatedMs)) return [];
  // an old order that changed today (a status, a delivery) is not news to the ticket's owner
  if (o.now !== undefined && o.orderDayMs < o.now - (o.maxAgeDays ?? 14) * 86_400_000) return [];
  if (dayOf(o.orderDayMs) < dayOf(o.ticketCreatedMs)) return [];
  const want = new Set([...o.ticketArticles].map(normArticle));
  return [...new Set(o.orderArticles.map(normArticle))].filter((a) => a.length === 10 && want.has(a)).sort();
}

/**
 * One purchase, one mail (SARCLA 19.10.2026: "we send the mail twice"). A purchase lives in HubSpot
 * as more than one order record - the shop's web record A26.667139.000 and the ERP's delivery
 * A26.667139.001 (.002 ...) - and each record was its own alert: the owner of TSA ticket 433687111892
 * got "please check your ticket" for both on 19.10. The mail is keyed on the A-number without its
 * delivery part; anything else (no A-number) on the order itself.
 */
export function purchaseOf(orderNumber: string | null | undefined, orderId: string): string {
  const n = String(orderNumber ?? "").trim();
  return /^[AG]\d{2}\.\d{6}\.\d{3}$/.test(n) ? n.slice(0, 10) : n || `order ${orderId}`;
}

/** The order pipeline's Cancelled stage (connectors/steps/orderRules.ts CANCELLED). */
const ORDER_CANCELLED = "5676846286";

/** A credit note (G...) or a cancelled order is not the customer ordering - never an alert, never a ticket closed. */
export const countsAsOrder = (orderNumber: string | null | undefined, orderStage: string | null | undefined): boolean =>
  !/^G/i.test(String(orderNumber ?? "").trim()) && orderStage !== ORDER_CANCELLED;

/**
 * Why an order alert's mail does not go out - null when it goes. Asked only once the order is linked
 * (a failed link is tried again first). `mailedNow`: the purchase this check already mailed the
 * ticket's owner about - a second order on the same ticket in the same check is not a second mail.
 */
export function mailBlock(o: { ownerId: string | null; ownerEmail: string | null; relay: boolean; mailedNow: string | null }): string | null {
  if (o.mailedNow) return `not mailed: the owner was mailed for this ticket a moment ago (${o.mailedNow})`;
  if (!o.ownerId) return "the ticket has no owner";
  if (!o.ownerEmail) return "the ticket's owner has no e-mail address";
  // a team inbox (helpline@, support@, sales@ ...) would turn the alert into a new ticket
  if (sharedMailbox(o.ownerEmail)) return `not mailed: the owner is the shared mailbox ${o.ownerEmail}`;
  if (!o.relay) return "the hub's mail relay is not set up";
  return null;
}

/** The value of "Ticket resolution ESO | TSA" (ticket_resolution_eso) the owners choose when the customer ordered. */
export const RESOLUTION_ORDERED = "Ordered";

/**
 * The stage an alerted ticket is closed in (SARCLA 19.10.2026: "we need to also close the ticket ...
 * when we send the mail"): its pipeline's one stage HubSpot marks CLOSED - by id, never by label. None,
 * or more than one, and the hub does not guess: the ticket stays open and the alert says why.
 */
export function closedStageOf(stages: { id: string; archived?: boolean; metadata?: { ticketState?: string } }[]): string | null {
  const closed = stages.filter((s) => !s.archived && s.metadata?.ticketState === "CLOSED");
  return closed.length === 1 ? closed[0].id : null;
}

/**
 * What closing writes: the closed stage, and the resolution "Ordered" - as the owners do by hand -
 * unless a person already chose one (theirs is kept).
 */
export function closeProps(closedStage: string, resolution: string | null | undefined): Record<string, string> {
  return { hs_pipeline_stage: closedStage, ...(String(resolution ?? "").trim() ? {} : { ticket_resolution_eso: RESOLUTION_ORDERED }) };
}

/** A HubSpot date or datetime property (ms or ISO) as epoch ms; NaN when it is neither. */
export function msOf(v: string | null | undefined): number {
  if (!v) return NaN;
  return /^\d+$/.test(v) ? Number(v) : Date.parse(v);
}
