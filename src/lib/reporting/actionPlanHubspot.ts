// THE ACTION PLAN IN HUBSPOT (SARCLA 01.11.2026: "create new properties in HubSpot to populate the action plan's main
// categories and sub and so forth"). Three ticket properties beside the agency's, in the group marketing_roadmap:
// mkt_plan_category, mkt_plan_subcategory and mkt_plan_action. The hub creates them the first time, keeps their choices
// on the plan's rows (a row that leaves the plan stays as a hidden choice, so a ticket carrying it keeps its name), and
// puts on every ticket of a sub-action its action's place - again when the action moves. One run is a few reads, and
// writes only what differs. Rules: actionPlanRules.ts (planOptions, planValuesOf). Proof in the log: `[action-plan] HubSpot`.
// Each action and its one ticket - each sub-action and its one - are kept in step both ways (SARCLA 02.11.2026: "the properties communicate with each
// other: a change in the hub changes the ticket, the status comes back from the ticket as well"): the side changed since
// they last agreed wins, the first time a merge (actionPlanRules.ticketSync, syncWay). Read again when the plan is opened.
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { markTicketSync, planItems, startMains, ticketSyncTimes, updateItem } from "./actionPlan";
import { PLAN_PROPS, SUB_TICKET_SYNC, TICKET_SYNC, planOptions, planValuesOf, sameOptions, subTicketSync, syncWay, ticketSync, type HsOption, type PlanFields, type PlanPropName } from "./actionPlanRules";
import { actionTickets, markTaskSync, planTasks, planTicketLinks, taskSyncTimes, taskTickets, updateTask } from "./kpiActions";
import { S2S_PIPELINE } from "./scrollToSaleRules";
import { s2sForm } from "./scrollToSale";

const GROUP = "marketing_roadmap";
const DESCRIPTION: Record<PlanPropName, string> = {
  mkt_plan_category: "The action plan's main category the ticket serves. Kept by APSOhub from /action-plan - change the plan there, not the choices here.",
  mkt_plan_subcategory: "The action plan's sub-category the ticket serves. Kept by APSOhub from /action-plan - change the plan there, not the choices here.",
  mkt_plan_action: "The action of the action plan the ticket moves forward. Kept by APSOhub from /action-plan - change the plan there, not the choices here.",
};

type Items = Awaited<ReturnType<typeof planItems>>;
export type PlanSyncResult = { created: string[]; changed: string[]; tickets: number; pushed: number; pulled: number };

async function property(p: (typeof PLAN_PROPS)[number], items: Items): Promise<"created" | "changed" | null> {
  let now: { options?: HsOption[] } | null = null;
  try {
    now = await hubspotFetchJson<{ options?: HsOption[] }>({ path: `/crm/v3/properties/tickets/${p.name}` });
  } catch (e) {
    if (!(e instanceof IntegrationError && e.status === 404)) throw e;
  }
  const want = planOptions(items, p.kind, now?.options ?? []);
  if (!now) {
    await hubspotFetchJson({
      path: "/crm/v3/properties/tickets", method: "POST",
      body: { name: p.name, label: p.label, groupName: GROUP, type: "enumeration", fieldType: "select", description: DESCRIPTION[p.name], formField: true, options: want },
    });
    return "created";
  }
  if (sameOptions(now.options ?? [], want)) return null;
  await hubspotFetchJson({ path: `/crm/v3/properties/tickets/${p.name}`, method: "PATCH", body: { options: want } });
  return "changed";
}

/** Every ticket of a sub-action carries its action's place; only the ones that differ are written. */
async function tickets(items: Items): Promise<number> {
  const want = new Map<string, Record<PlanPropName, string>>();
  for (const l of await planTicketLinks()) {
    const v = planValuesOf(l.item, items);
    if (v) want.set(l.ticketId, v);
  }
  const ids = [...want.keys()];
  const names = PLAN_PROPS.map((p) => p.name);
  let n = 0;
  for (let k = 0; k < ids.length; k += 100) {
    const part = ids.slice(k, k + 100);
    const j = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: { inputs: part.map((id) => ({ id })), properties: names },
    });
    const inputs = (j.results ?? []).flatMap((t) => {
      const v = want.get(String(t.id))!;
      const diff = Object.fromEntries(names.filter((x) => (t.properties?.[x] ?? "") !== v[x]).map((x) => [x, v[x]]));
      return Object.keys(diff).length ? [{ id: String(t.id), properties: diff }] : [];
    });
    if (inputs.length) await hubspotFetchJson({ path: "/crm/v3/objects/tickets/batch/update", method: "POST", body: { inputs } });
    n += inputs.length;
  }
  return n;
}

type Ticket = Record<string, string | null>;
/** The tickets as HubSpot has them now, 100 a read. */
async function readTickets(ids: string[], props: string[]): Promise<Map<string, Ticket>> {
  const out = new Map<string, Ticket>();
  for (let k = 0; k < ids.length; k += 100) {
    const j = await hubspotFetchJson<{ results?: { id: string; properties?: Ticket }[] }>({
      path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: { inputs: ids.slice(k, k + 100).map((id) => ({ id })), properties: props },
    });
    for (const t of j.results ?? []) out.set(String(t.id), t.properties ?? {});
  }
  return out;
}

/**
 * Each action and each sub-action brought in step with its ticket; the tickets written in batches, the plan one by one.
 * A main action - one with sub-actions - takes no ticket: its sub-actions carry theirs (SARCLA 02.11.2026: "this type of
 * action should not have a ticket, because they are main"); an old one on it is left alone.
 */
async function inStep(items: Items): Promise<{ pushed: number; pulled: number }> {
  const [links, subLinks, subs] = await Promise.all([actionTickets(), taskTickets(), planTasks()]);
  if (!links.length && !subLinks.length) return { pushed: 0, pulled: 0 };
  const byId = new Map(items.map((i) => [i.id, i]));
  const main = new Set(subs.map((x) => x.planItem).filter((x): x is number => x != null));
  const taskById = new Map(subs.map((x) => [x.id, x]));
  const [synced, subSynced] = await Promise.all([ticketSyncTimes(), taskSyncTimes()]);
  const names = new Map(((await s2sForm().catch(() => null))?.owners ?? []).map((o) => [o.id, o.name]));
  const props = [...new Set([...TICKET_SYNC.map((f) => f.prop), ...SUB_TICKET_SYNC.map((f) => f.prop), "hs_pipeline", "hs_lastmodifieddate"])];
  const found = await readTickets([...new Set([...links, ...subLinks].map((l) => l.ticketId))], props);
  // a ticket moved out of the pipeline, or deleted, is left alone
  const ours = (id: string) => { const t = found.get(id); return t && t.hs_pipeline === S2S_PIPELINE ? t : null; };
  const at = (t: Ticket) => (t.hs_lastmodifieddate ? new Date(t.hs_lastmodifieddate).toISOString() : "");
  const writes = new Map<string, Record<string, string>>();
  let pushed = 0, pulled = 0;
  const agreed: number[] = [], subAgreed: number[] = [];
  for (const l of links) {
    const a = byId.get(l.item), t = ours(l.ticketId);
    if (!a || a.kind !== "action" || main.has(a.id) || !t) continue;
    const way = syncWay(a.updatedAt, at(t), synced.get(a.id) ?? null);
    if (!way) continue;
    const d = ticketSync(a, t, way);
    agreed.push(a.id);
    if (!d.fields.length) continue;
    if (Object.keys(d.push).length) { writes.set(l.ticketId, d.push); pushed++; }
    const { ownerId, ...rest } = d.pull;
    const patch: Partial<PlanFields> = { ...rest };
    if (ownerId) patch.owners = [{ id: ownerId, name: names.get(ownerId) ?? ownerId }, ...a.owners.filter((o) => o.id !== ownerId)];
    if (Object.keys(patch).length) { await updateItem(a.id, patch, `Its ticket in HubSpot (${l.ticketId})`); pulled++; }
  }
  for (const l of subLinks) {
    const k = taskById.get(l.task), t = ours(l.ticketId);
    // one ticket on both an action and its sub-action: the action's went first
    if (!k || !t || writes.has(l.ticketId)) continue;
    const way = syncWay(k.updatedAt, at(t), subSynced.get(k.id) ?? null);
    if (!way) continue;
    const d = subTicketSync(k, t, way);
    subAgreed.push(k.id);
    if (!d.fields.length) continue;
    if (Object.keys(d.push).length) { writes.set(l.ticketId, d.push); pushed++; }
    if (Object.keys(d.pull).length) {
      const p = d.pull;
      await updateTask(k.id, { ...p, ...(p.owner ? { ownerName: names.get(p.owner) ?? p.owner } : {}) });
      pulled++;
    }
  }
  const inputs = [...writes.entries()].map(([id, properties]) => ({ id, properties }));
  for (let k = 0; k < inputs.length; k += 100) {
    await hubspotFetchJson({ path: "/crm/v3/objects/tickets/batch/update", method: "POST", body: { inputs: inputs.slice(k, k + 100) } });
  }
  await Promise.all([markTicketSync(agreed), markTaskSync(subAgreed)]);
  if (pulled) await startMains(await planTasks(), "Its sub-actions are under way");
  return { pushed, pulled };
}

let chain: Promise<unknown> = Promise.resolve();
let lastRun = 0;
/** One run at a time in this process; the next one waits for the last. */
export function syncPlanToHubspot(reason: string): Promise<PlanSyncResult> {
  const run = chain.then(async () => {
    const items = await planItems();
    lastRun = Date.now();
    const out: PlanSyncResult = { created: [], changed: [], tickets: 0, pushed: 0, pulled: 0 };
    // the actions and their tickets first - a place written afterwards is a change of the ticket the next run reads as
    // one - on their own: a failure there does not stop the plan's place
    try { Object.assign(out, await inStep(items)); } catch (e) { console.error(`[action-plan] HubSpot (${reason}): actions and tickets not brought in step:`, (e as Error).message); }
    for (const p of PLAN_PROPS) {
      const r = await property(p, items);
      if (r) out[r].push(p.name);
    }
    out.tickets = await tickets(items);
    if (out.created.length || out.changed.length || out.tickets || out.pushed || out.pulled) {
      console.log(`[action-plan] HubSpot (${reason}): created ${out.created.join(", ") || "-"}; choices changed ${out.changed.join(", ") || "-"}; ${out.tickets} ticket(s) given their place; ${out.pushed} ticket(s) given their action's changes, ${out.pulled} action(s) their ticket's`);
    }
    return out;
  });
  chain = run.catch((e) => console.error(`[action-plan] HubSpot (${reason}) failed:`, (e as Error).message));
  return run;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** After a change to the plan or to a sub-action's tickets: one run a few seconds later, however many changes came. */
export function queuePlanSync(reason: string): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncPlanToHubspot(reason).catch(() => undefined); }, 3000);
}

/** A waiting run, now - before a ticket is made with a choice that may not be in HubSpot yet. */
export async function flushPlanSync(): Promise<void> {
  if (!timer) return;
  clearTimeout(timer); timer = null;
  await syncPlanToHubspot("before a ticket");
}

let first: Promise<unknown> | null = null;
/** The first ticket form of this process: the properties exist and carry the plan (a failure asks again next time). */
export function planInHubspot(): Promise<unknown> {
  if (!first) first = syncPlanToHubspot("first use").catch((e) => { first = null; throw e; });
  return first;
}

/**
 * The plan opened: what changed on the tickets comes in first - at most once a minute, and the page waits for it a few
 * seconds at most (a slow HubSpot shows it at the next read).
 */
export async function freshFromTickets(waitMs = 4000): Promise<void> {
  if (Date.now() - lastRun < 60_000) return;
  const run = syncPlanToHubspot("plan opened").catch(() => undefined);
  await Promise.race([run, new Promise((r) => setTimeout(r, waitMs))]);
}
