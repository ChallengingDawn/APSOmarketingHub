// THE EROSION DETECTOR'S WRITES - creating and merging the tickets and their
// associations, ported line for line from the connector's erosion_load.py PASS 2,
// so a ticket raised by the hub is the ticket the connector would have raised:
// same properties, same pipeline and "New" stage, same company, order, contact
// and Products & Pricing associations.
//
// Every call - reads, ticket writes, associations - goes out with the tickets token
// (TICKETS_TOKEN, the same "SARCLA - Erosion tickets" app the connector wrote with,
// and the token the parity check ran on). The buyer lookups swallow errors, so a
// token missing a read scope there would raise tickets with no buyer instead of failing.

import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";
import type { TicketDraft } from "../erosion/detector";

const PP_OBJ = "2-200042439";
/** ticket -> Products & Pricing has no default type: USER_DEFINED 152 = "Erosion article" (created 21.08.2026). */
const PP_ASSOC_TYPE = 152;
/** company -> contact "Main Purchaser" label. */
const MAIN_PURCHASER = 39;

export type WriteResult = {
  mkey: string;
  un: string;
  title: string;
  keys: string[];
  ticketId: string | null;
  action: "created" | "merged" | "failed";
  errors: string[];
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

async function assoc(path: string, body?: unknown): Promise<void> {
  await hubspotFetchJson({ path, method: "PUT", body, useTicketsToken: true });
}

/** The buyer: the contact on one of the previous-year orders, else the company's Main Purchaser, else any of its contacts. */
async function buyerContact(orderIds: string[], companyId: string): Promise<string | null> {
  for (const oid of orderIds.slice(0, 5)) {
    const r = await hubspotFetchJson<{ results?: { toObjectId: number | string }[] }>({
      path: `/crm/v4/objects/orders/${oid}/associations/contacts`, useTicketsToken: true,
    }).catch(() => ({ results: [] as { toObjectId: number | string }[] }));
    if (r.results?.length) return String(r.results[0].toObjectId);
  }
  const c = await hubspotFetchJson<{ results?: { toObjectId: number | string; associationTypes?: { typeId?: number }[] }[] }>({
    path: `/crm/v4/objects/companies/${companyId}/associations/contacts`, useTicketsToken: true,
  }).catch(() => ({ results: [] as { toObjectId: number | string; associationTypes?: { typeId?: number }[] }[] }));
  const all = c.results ?? [];
  const buyer = all.find((r) => (r.associationTypes ?? []).some((t) => t.typeId === MAIN_PURCHASER));
  const pick = buyer ?? all[0];
  return pick ? String(pick.toObjectId) : null;
}

/**
 * Create (or merge into this month's ticket) one draft, then associate. A failed
 * create or merge stops that ticket and is reported; a failed association is
 * reported but the ticket stands, as on the connector.
 */
export async function writeErosionTicket(d: TicketDraft & { mergeInto: string | null; ppIds: string[] }): Promise<WriteResult> {
  const res: WriteResult = { mkey: d.mkey, un: d.un, title: d.title, keys: d.keys, ticketId: null, action: "failed", errors: [] };
  try {
    if (d.mergeInto) {
      // the company already has a ticket this month: the new articles go ONTO it, with
      // subject, body, total, priority and article properties rebuilt from the whole set
      await hubspotFetchJson({ path: `/crm/v3/objects/tickets/${d.mergeInto}`, method: "PATCH", body: { properties: d.props }, useTicketsToken: true });
      res.ticketId = d.mergeInto;
      res.action = "merged";
    } else {
      const created = await hubspotFetchJson<{ id: string }>({ path: "/crm/v3/objects/tickets", method: "POST", body: { properties: d.props }, useTicketsToken: true });
      res.ticketId = created.id;
      res.action = "created";
    }
  } catch (e) {
    res.errors.push(`${d.mergeInto ? "merge" : "create"}: ${msg(e)}`);
    return res;
  }
  const tid = res.ticketId!;
  const step = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { res.errors.push(`${label}: ${msg(e)}`); }
  };
  await step("company", () => assoc(`/crm/v4/objects/tickets/${tid}/associations/default/companies/${d.cid}`));
  for (const oid of d.orderIds) await step(`order ${oid}`, () => assoc(`/crm/v4/objects/tickets/${tid}/associations/default/orders/${oid}`));
  await step("contact", async () => {
    const contact = await buyerContact(d.orderIds, d.cid);
    if (contact) await assoc(`/crm/v4/objects/tickets/${tid}/associations/default/contacts/${contact}`);
  });
  for (const pid of d.ppIds) {
    await step(`article ${pid}`, () => assoc(`/crm/v4/objects/tickets/${tid}/associations/${PP_OBJ}/${pid}`,
      [{ associationCategory: "USER_DEFINED", associationTypeId: PP_ASSOC_TYPE }]));
  }
  return res;
}

/** The `tags` dropdown must carry `erosion`: the ESO rename workflow excludes on it, or every subject is wiped. */
export async function erosionTagExists(): Promise<boolean> {
  const p = await hubspotFetchJson<{ options?: { value?: string }[] }>({ path: "/crm/v3/properties/tickets/tags", useTicketsToken: true });
  return (p.options ?? []).some((o) => o.value === "erosion");
}

export { IntegrationError };
