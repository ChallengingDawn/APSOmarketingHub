// DUPLICATES - LIVE: what the hub writes in HubSpot (SARCLA 02.11.2026: "person clicks, hub merges").
//   - The verdict, on a ticket entering Back Office "New": dup_status, dup_type, dup_of_ticket, dup_why, dup_checked_at
//     (properties.ts) - only when something was found, never "No duplicates found" -, and the owner of the oldest open
//     ticket of the same request / order when the type hands it over. Only once the workflow "SARCLA | BACK OFFICE
//     FILTERING | DUPS HANDLING WITH CODE" (2864393419) is switched off, so the two never write at once; an owner a
//     person chose is never taken back.
//   - The decisions people take on the card (or in the left sidebar), dup_decision: "merge" - every ticket of the
//     group in the same pipeline merged into the oldest OPEN one (never into a closed ticket; tickets of other pipelines
//     never merged), "not_duplicate" - kept apart for good. Done within a minute, then the decision is emptied.
// Every write is logged (kv ticketDup:log, the last 500), owners and merges each with an hourly limit.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import type { Verdict } from "./types";

export const WORKFLOW_ID = "2864393419";
/** "SARCLA | BO MERGING |" - merges on the old merge_ticket_decision; the card never sets that one */
export const MERGING_WORKFLOW_ID = "2972093641";
const OWNER_PER_HOUR = 40, MERGE_PER_HOUR = 30;

const wfCache = new Map<string, { at: number; on: boolean | null }>();
async function flowOn(id: string): Promise<boolean | null> {
  const c = wfCache.get(id);
  if (c && Date.now() - c.at < 2 * 60_000) return c.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${id}` })).isEnabled; } catch { on = null; }
  wfCache.set(id, { at: Date.now(), on });
  return on;
}
/** true = the DUPS workflow still runs (the hub only compares), false = off, null = could not be read (the hub waits). */
export const workflowOn = () => flowOn(WORKFLOW_ID);
/** The old merge workflow - the page says whether it still runs. */
export const mergingWorkflowOn = () => flowOn(MERGING_WORKFLOW_ID);

// ---------------- the log ----------------
export type LogEntry = {
  at: string; ticketId: string; what: "flag" | "owner" | "merge" | "not_duplicate" | "nothing" | "error";
  text: string; by?: string | null; ids?: string[]; into?: string; from?: string | null; to?: string | null;
};
const LOG = "ticketDup:log";
export const readLog = async () => (await kvGet<LogEntry[]>(LOG)) ?? [];
async function log(e: LogEntry) {
  const cur = await readLog();
  await kvSet(LOG, [e, ...cur].slice(0, 500));
}
/** One more of `kind` this hour - false when the hour's limit is reached. */
async function allow(kind: "owner" | "merge"): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13);
  const k = `ticketDup:hour:${kind}`;
  const cur = (await kvGet<{ hour: string; n: number }>(k)) ?? { hour, n: 0 };
  const n = cur.hour === hour ? cur.n : 0;
  if (n >= (kind === "owner" ? OWNER_PER_HOUR : MERGE_PER_HOUR)) return false;
  await kvSet(k, { hour, n: n + 1 });
  return true;
}

type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string; updatedByUserId?: number }[];
type Raw = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, Hist> };
const patch = (id: string, props: Record<string, string>) => hubspotRetry({ path: `/crm/v3/objects/tickets/${id}`, method: "PATCH", body: { properties: props } });
const zurich = (d = new Date()) => d.toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** The verdict on the ticket: what it is, of which tickets, why - and the owner, when the type hands it over. */
export async function writeVerdict(id: string, v: Verdict): Promise<{ flagged: boolean; owner: boolean; note?: string }> {
  if (!v.status) return { flagged: false, owner: false };
  const t = await hubspotRetry<Raw>({ path: `/crm/v3/objects/tickets/${id}?properties=dup_status,dup_of_ticket,hubspot_owner_id&propertiesWithHistory=hubspot_owner_id` });
  // a person said these are not duplicates: never again for the same tickets
  const said = t.properties.dup_status === "not_duplicate" ? String(t.properties.dup_of_ticket ?? "").split(";").filter(Boolean) : [];
  if (said.length && v.of.every((x) => said.includes(x))) return { flagged: false, owner: false, note: "a person said: not a duplicate" };
  await patch(id, { dup_status: v.status, dup_type: v.type ?? "", dup_of_ticket: v.of.join(";"), dup_why: v.why.slice(0, 1000), dup_checked_at: new Date().toISOString() });
  await log({ at: new Date().toISOString(), ticketId: id, what: "flag", text: v.why, ids: v.of });
  if (!v.ownerChange) return { flagged: true, owner: false };
  // the owner: never one a person chose, never twice the same
  const last = (t.propertiesWithHistory?.hubspot_owner_id ?? [])[0];
  if (last?.sourceType === "CRM_UI") return { flagged: true, owner: false, note: "the owner was chosen by a person" };
  if (t.properties.hubspot_owner_id === v.ownerChange.ownerId) return { flagged: true, owner: false };
  if (!(await allow("owner"))) return { flagged: true, owner: false, note: `owner limit of ${OWNER_PER_HOUR} an hour reached` };
  await patch(id, { hubspot_owner_id: v.ownerChange.ownerId });
  await log({ at: new Date().toISOString(), ticketId: id, what: "owner", text: `Owner of ticket ${v.ownerChange.fromTicket}`, from: t.properties.hubspot_owner_id ?? null, to: v.ownerChange.ownerId });
  return { flagged: true, owner: true };
}

// ---------------- the decisions people take ----------------
const DEC_PROPS = ["subject", "hs_pipeline", "hs_is_closed", "createdate", "dup_of_ticket", "dup_decision", "dup_decided_by", "dup_status", "hubspot_owner_id"];
export type Pending = { id: string; subject: string; decision: string; by: string | null; at: string | null };

/** The decisions waiting for the hub (the page shows them while merging is off). */
export async function pendingDecisions(): Promise<Pending[]> {
  const r = await hubspotRetry<{ results?: Raw[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters: [{ propertyName: "dup_decision", operator: "HAS_PROPERTY" }] }], properties: [...DEC_PROPS, "hs_lastmodifieddate"], limit: 20,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
  } });
  return (r.results ?? []).map((x) => ({ id: String(x.id), subject: x.properties.subject ?? "", decision: x.properties.dup_decision ?? "", by: x.properties.dup_decided_by ?? null, at: x.properties.hs_lastmodifieddate ?? null }));
}

let usersCache: { at: number; byUser: Map<string, string> } | null = null;
/** The person behind a HubSpot user id (a decision set in the sidebar carries the user, not the owner). */
async function personOfUser(userId: number | undefined): Promise<string | null> {
  if (!userId) return null;
  if (!usersCache || Date.now() - usersCache.at > 60 * 60_000) {
    const byUser = new Map<string, string>();
    let after: string | undefined;
    for (let page = 0; page < 10; page++) {
      const r = await hubspotRetry<{ results?: { userId?: number; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}` });
      for (const o of r.results ?? []) if (o.userId) byUser.set(String(o.userId), [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `user ${o.userId}`);
      after = r.paging?.next?.after;
      if (!after) break;
    }
    usersCache = { at: Date.now(), byUser };
  }
  return usersCache.byUser.get(String(userId)) ?? `user ${userId}`;
}

/** One decision carried out. */
async function decideOne(id: string): Promise<LogEntry> {
  const t = await hubspotRetry<Raw>({ path: `/crm/v3/objects/tickets/${id}?properties=${DEC_PROPS.join(",")}&propertiesWithHistory=dup_decision` });
  const p = t.properties;
  const dec = p.dup_decision ?? "";
  const by = p.dup_decided_by || (await personOfUser((t.propertiesWithHistory?.dup_decision ?? [])[0]?.updatedByUserId)) || null;
  const now = new Date().toISOString();
  const others = String(p.dup_of_ticket ?? "").split(";").map((x) => x.trim()).filter((x) => /^\d+$/.test(x) && x !== id);
  if (dec === "not_duplicate") {
    await patch(id, { dup_status: "not_duplicate", dup_decision: "", dup_why: `Not a duplicate${others.length ? ` of ticket ${others.join(", ")}` : ""} - ${by ?? "a person"}, ${zurich()}` });
    return { at: now, ticketId: id, what: "not_duplicate", text: "Not a duplicate", by, ids: others };
  }
  if (dec !== "merge") {
    await patch(id, { dup_decision: "" });
    return { at: now, ticketId: id, what: "nothing", text: `Unknown decision "${dec}" - emptied`, by };
  }
  // the group: this ticket and the ones it names, as they are now - a merged-away id answers with the ticket it went into
  const group = new Map<string, Raw>([[String(t.id), t]]);
  const skipped: string[] = [];
  for (const o of others) {
    try {
      const x = await hubspotRetry<Raw>({ path: `/crm/v3/objects/tickets/${o}?properties=${DEC_PROPS.join(",")}` });
      if (x.properties.hs_pipeline !== p.hs_pipeline) { skipped.push(`${o} (another pipeline)`); continue; }
      group.set(String(x.id), x);
    } catch (e) {
      if (e instanceof IntegrationError && e.status === 404) { skipped.push(`${o} (deleted)`); continue; }
      throw e;
    }
  }
  if (group.size < 2) {
    await patch(String(t.id), { dup_decision: "", dup_why: `Nothing to merge${skipped.length ? `: ${skipped.join(", ")}` : " - no other ticket"} - ${by ?? "a person"}, ${zurich()}` });
    return { at: now, ticketId: id, what: "nothing", text: `Nothing to merge${skipped.length ? `: ${skipped.join(", ")}` : ""}`, by };
  }
  if (!(await allow("merge"))) throw new Error(`merge limit of ${MERGE_PER_HOUR} an hour reached - it waits for the next hour`);
  // into the oldest OPEN ticket - never into a closed one; all closed: into this one
  const list = [...group.values()].sort((a, b) => String(a.properties.createdate).localeCompare(String(b.properties.createdate)));
  const open = list.filter((x) => (x.properties.hs_is_closed ?? "").toLowerCase() !== "true");
  let primary = String((open[0] ?? t).id);
  const merged: string[] = [];
  for (const x of list) {
    const xid = String(x.id);
    if (xid === primary) continue;
    const r = await hubspotRetry<{ id?: string | number }>({ path: "/crm/v3/objects/tickets/merge", method: "POST", body: { primaryObjectId: primary, objectIdToMerge: xid } });
    merged.push(xid);
    if (r.id) primary = String(r.id);
  }
  await patch(primary, {
    dup_status: "merged", dup_decision: "", dup_of_ticket: merged.join(";"), ...(by ? { dup_decided_by: by } : {}),
    dup_why: `Merged ticket ${merged.join(", ")} into this one - ${by ?? "a person"}, ${zurich()}${skipped.length ? `; not merged: ${skipped.join(", ")}` : ""}`,
  });
  return { at: now, ticketId: id, what: "merge", text: `Merged ${merged.join(", ")} into ${primary}${skipped.length ? `; not merged: ${skipped.join(", ")}` : ""}`, by, ids: merged, into: primary };
}

/** Every waiting decision carried out (at most 10 a minute). */
export async function runDecisions(): Promise<{ done: number; errors: number }> {
  let done = 0, errors = 0;
  for (const d of (await pendingDecisions()).slice(0, 10)) {
    try { await log(await decideOne(d.id)); done++; }
    catch (e) {
      errors++;
      const msg = (e as Error).message.slice(0, 200);
      await log({ at: new Date().toISOString(), ticketId: d.id, what: "error", text: msg, by: d.by });
      if (/limit/.test(msg)) break;
      // never the same failure every minute: the decision is emptied, the reason stays on the ticket
      await patch(d.id, { dup_decision: "", dup_why: `Could not ${d.decision === "merge" ? "merge" : "save the decision"}: ${msg} - ${zurich()}` }).catch(() => {});
    }
  }
  return { done, errors };
}
