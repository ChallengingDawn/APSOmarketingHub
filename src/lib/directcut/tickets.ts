// RAISING THE BACK OFFICE TICKET FOR A PROMISE THE SHELF CANNOT KEEP.
//
// SARCLA, 17.10.2026: "if we cant keep it we need to create the ticket on back office as a fallback v1 but
// this time via the apsohub."
//
// V1 WAS A SEPARATE RAILWAY SERVICE and it is why this is here rather than there. It polled HubSpot for new
// orders, re-asked the stock API, and raised an URGENT Back Office ticket when a position could not be
// served. It was stopped on 14.10 after 68 tickets in two months, the last on 23.09: it waited for HubSpot
// to carry the web orders across and ~75% never arrived, so it was structurally blind to three quarters of
// its own job. The judgement moved into the c2s-middleware, which allocates the plate area itself and so
// cannot disagree with itself. What did NOT move was the writing: the middleware is the thing that KNOWS,
// the hub is the thing that writes to HubSpot. The hub already raises the erosion tickets and the
// price-check tickets with its own token and its own dedupe, so this is the third of the same shape rather
// than a second place talking to the tickets API. C2S_GUARD stays "dry" on the middleware for good.
//
// WHAT QUALIFIES. Not "the order was short when it was booked" — the middleware's own guard says that at
// order time, and a line booked openly as production is an honest backorder nobody needs a ticket about.
// This is the other case, the one that has no honest moment: a promise the ledger ACCEPTED (heldQty) off a
// shelf that can no longer cover it. On 13.10 the widget took 500 pieces of 0232001119 against a shelf the
// File Agent had not written to since 24.09; 334 of them fit the real shelf and 166 cannot be cut. Nobody
// finds that out unless somebody is told.
//
// NO STATE FILE, for the same reason as the price checks: this container is replaced on every deployment.
// Whether a ticket already exists is asked of the ticket itself — `c2s_problem_order` carries the order
// number and is searched before anything is created, so a rerun is harmless and two instances racing
// cannot both win. That is V1's own property, deliberately: a ticket V1 raised for an order still counts
// as that order's ticket, and the Back Office automation that rewrites the subject minutes later is
// enrolled on the property, never on the name.

import { IntegrationError, hubspotToken, ticketsToken } from "../integrations/status";
import { adminKey, gateway } from "./gateway";

/** Back Office, stage New — the pipeline V1 wrote to (c2s-middleware/order-guard.js). */
const PIPELINE = process.env.C2S_TICKET_PIPELINE_ID || "1726786777";
const STAGE = process.env.C2S_TICKET_STAGE_ID || "2338266325";

export type BrokenLine = {
  cutArticle: string;
  basisArticle: string;
  basisName?: string;
  size: string;
  qty: number;
  served: number;
  short: number;
  promisedAt?: string | null;
  shelfM2?: number;
  wantM2?: number;
};
export type BrokenOrder = {
  orderNo: string | null;
  erpNo: string | null;
  /** the e-mail the line was reserved under — how the customer is found */
  customer?: string | null;
  articles: string[];
  lines: BrokenLine[];
  pieces: number;
  promisedAt: string | null;
};
export type Broken = {
  at: string;
  articles: number;
  pieces: number;
  orders: BrokenOrder[];
  promisesChecked: number;
  articlesChecked: number;
};

export type TicketOutcome = {
  orderNo: string | null;
  erpNo: string | null;
  pieces: number;
  articles: string[];
  /** created | exists | no-order | error */
  outcome: string;
  ticketId?: string;
  error?: string;
  /** who it was put on: the company and contact the subject is built from */
  linkedTo?: { company: string | null; contact: string | null; customer: string | null };
};
export type RunReport = {
  dry: boolean;
  at: string;
  checked: number;
  broken: number;
  created: number;
  existing: number;
  skipped: number;
  failed: number;
  outcomes: TicketOutcome[];
};

/** What the middleware says cannot be cut. Read-only. */
export async function fetchBroken(): Promise<Broken> {
  if (!adminKey()) throw new IntegrationError("C2S_ADMIN_KEY is not set on the hub, so the shelf cannot be read.");
  return gateway<Broken>("/admin/promises", 40_000);
}

async function ticketsRequest<T>(path: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<T> {
  const token = ticketsToken() ?? hubspotToken();
  if (!token) throw new IntegrationError("No HubSpot token is set, so no ticket can be created.");
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new IntegrationError(`HubSpot tickets: ${res.status} ${text.slice(0, 300)}`, res.status);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Which of these orders already have a ticket. Dedup without a state file. */
async function alreadyRaised(orders: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < orders.length; i += 100) {
    // through the ticket token, so a missing scope fails HERE, before anything is created
    const res = await ticketsRequest<{ results?: { properties?: Record<string, string | null> }[] }>(
      "/crm/v3/objects/tickets/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "c2s_problem_order", operator: "IN", values: orders.slice(i, i + 100) }] }],
        properties: ["c2s_problem_order"],
        limit: 100,
      });
    for (const r of res.results ?? []) {
      const k = r.properties?.c2s_problem_order;
      if (k) found.add(String(k));
    }
  }
  return found;
}

/* WHO THE TICKET IS FOR, from the e-mail the cut was reserved under.
 *
 * THIS IS NOT COSMETIC, and the first ticket proved it. Raised without associations, the Back Office
 * rename automation turned its subject into "BO |   |  " — it builds the subject from the ticket's
 * associated COMPANY, and every one of V1's 68 tickets carried one company and two contacts ("C2S PROBLEM
 * PLEASE REACT FAST | 10000154675 | BMK Bearbeitungstechnologien GmbH"). Worse than the blank subject: a
 * ticket with no company is not on the customer's record, which is where the Back Office works it.
 *
 * The contact's own primary company is used rather than looking the order up: the contact is who reserved
 * the cut, and associatedcompanyid is the company HubSpot already believes they belong to, so this cannot
 * invent a different one. Nothing is ever created — a customer we cannot find leaves the ticket unlinked
 * and says so in the report, which is visible and fixable, unlike a company conjured out of an e-mail
 * domain (see feedback_orders_missing_companies: never auto-create). */
async function findCustomer(email: string): Promise<{ contact: string | null; company: string | null }> {
  const res = await ticketsRequest<{ results?: { id?: string; properties?: Record<string, string | null> }[] }>(
    "/crm/v3/objects/contacts/search", "POST", {
      limit: 1,
      properties: ["email", "associatedcompanyid"],
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
    });
  const hit = (res.results ?? [])[0];
  if (!hit?.id) return { contact: null, company: null };
  const company = hit.properties?.associatedcompanyid;
  return { contact: String(hit.id), company: company ? String(company) : null };
}

/** Put the ticket on the customer's record. A failure here never undoes the ticket. */
async function link(ticketId: string, who: { contact: string | null; company: string | null }): Promise<void> {
  if (who.company) {
    await ticketsRequest(`/crm/v4/objects/tickets/${ticketId}/associations/default/companies/${who.company}`, "PUT")
      .catch((e) => console.warn(`[c2s-tickets] ${ticketId}: company ${who.company} not linked — ${(e as Error)?.message ?? e}`));
  }
  if (who.contact) {
    await ticketsRequest(`/crm/v4/objects/tickets/${ticketId}/associations/default/contacts/${who.contact}`, "PUT")
      .catch((e) => console.warn(`[c2s-tickets] ${ticketId}: contact ${who.contact} not linked — ${(e as Error)?.message ?? e}`));
  }
}

/* The sentence a human reads. One fact per line, a blank line between positions — the layout SARCLA asked
   for on 24.08 after calling the first one "a blob" — and then WHY an order from last week is only
   surfacing now, or the Back Office reads it as us having sat on it. */
export function describe(o: BrokenOrder): string {
  const positions = o.lines.map((l, i) => [
    `Position ${i + 1}: ${l.qty} × ${l.size} mm from ${l.basisArticle}${l.basisName ? ` (${l.basisName})` : ""}`,
    `  can be cut from stock now: ${l.served}`,
    `  cannot be served: ${l.short}`,
  ].join("\n")).join("\n\n");

  const when = o.promisedAt ? o.promisedAt.replace("T", " ") : "earlier";
  const shelf = o.lines[0];
  const why = [
    "",
    "Why this is only coming up now:",
    `stock accepted these pieces on ${when}, from the shelf as it stood then.`,
    shelf?.shelfM2 !== undefined && shelf?.wantM2 !== undefined
      ? `${shelf.basisArticle} now holds ${shelf.shelfM2.toFixed(2)} m² in total and these positions need ${shelf.wantM2.toFixed(2)} m².`
      : "The shelf has since moved.",
    "The figures above are the best case and ignore cutting waste.",
    "",
    "Source: C2S promise re-check (APSOHub)",
  ].join("\n");

  return `${positions}\n${why}`;
}

/**
 * One run. `dry` reports exactly what it would do and writes nothing — which is how this should be looked
 * at the first few times, because the thing it mails about cannot be unmailed.
 */
export async function runPromiseTickets({ dry = true }: { dry?: boolean } = {}): Promise<RunReport> {
  const broken = await fetchBroken();
  const at = new Date().toISOString();
  const outcomes: TicketOutcome[] = [];

  const withOrder = broken.orders.filter((o) => o.orderNo);
  for (const o of broken.orders) {
    if (!o.orderNo) {
      // nothing to key a ticket on, and nothing to tell the Back Office to look up
      outcomes.push({ orderNo: null, erpNo: o.erpNo, pieces: o.pieces, articles: o.articles, outcome: "no-order" });
    }
  }

  let existing = new Set<string>();
  if (withOrder.length) {
    try {
      existing = await alreadyRaised(withOrder.map((o) => String(o.orderNo)));
    } catch (err) {
      // a failed search must never become a duplicate ticket: stop, do not guess
      throw new IntegrationError(
        `The tickets could not be checked for duplicates, so none were created: ${(err as Error)?.message ?? err}`,
        (err as { status?: number })?.status,
      );
    }
  }

  for (const o of withOrder) {
    const key = String(o.orderNo);
    if (existing.has(key)) {
      outcomes.push({ orderNo: key, erpNo: o.erpNo, pieces: o.pieces, articles: o.articles, outcome: "exists" });
      continue;
    }
    // who it would go on — looked up on a rehearsal too, because "no company found" is exactly the
    // thing worth knowing BEFORE a ticket exists
    let who: { contact: string | null; company: string | null } = { contact: null, company: null };
    if (o.customer) {
      try { who = await findCustomer(o.customer); }
      catch (e) { console.warn(`[c2s-tickets] ${key}: could not look up ${o.customer} — ${(e as Error)?.message ?? e}`); }
    }
    const linkedTo = { ...who, customer: o.customer ?? null };

    if (dry) {
      outcomes.push({ orderNo: key, erpNo: o.erpNo, pieces: o.pieces, articles: o.articles, outcome: "created", linkedTo });
      continue;
    }
    try {
      const created = await ticketsRequest<{ id?: string }>("/crm/v3/objects/tickets", "POST", {
        properties: {
          // the Back Office rename automation rewrites this minutes later, so nothing may enrol on it
          subject: `C2S PROBLEM PLEASE REACT FAST | ${key}`,
          content: describe(o),
          hs_pipeline: PIPELINE,
          hs_pipeline_stage: STAGE,
          hs_ticket_priority: "HIGH",
          c2s_problem_order: key,
          source_type: "AUTOMATION",
        },
      });
      if (created.id) await link(created.id, who);
      outcomes.push({ orderNo: key, erpNo: o.erpNo, pieces: o.pieces, articles: o.articles, outcome: "created", ticketId: created.id, linkedTo });
      console.log(`[c2s-tickets] order ${key}: ticket ${created.id} raised (${o.pieces} piece(s) that cannot be cut)` +
        `${who.company ? `, on company ${who.company}` : ", NOT on a company — the subject will come out blank"}`);
    } catch (err) {
      outcomes.push({
        orderNo: key, erpNo: o.erpNo, pieces: o.pieces, articles: o.articles,
        outcome: "error", error: String((err as Error)?.message ?? err),
      });
    }
  }

  return {
    dry,
    at,
    checked: broken.promisesChecked,
    broken: broken.orders.length,
    created: outcomes.filter((o) => o.outcome === "created").length,
    existing: outcomes.filter((o) => o.outcome === "exists").length,
    skipped: outcomes.filter((o) => o.outcome === "no-order").length,
    failed: outcomes.filter((o) => o.outcome === "error").length,
    outcomes,
  };
}
