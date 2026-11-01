// THE ACTION PLAN IN HUBSPOT (SARCLA 01.11.2026: "create new properties in HubSpot to populate the action plan's main
// categories and sub and so forth"). Three ticket properties beside the agency's, in the group marketing_roadmap:
// mkt_plan_category, mkt_plan_subcategory and mkt_plan_action. The hub creates them the first time, keeps their choices
// on the plan's rows (a row that leaves the plan stays as a hidden choice, so a ticket carrying it keeps its name), and
// puts on every ticket of a sub-action its action's place - again when the action moves. One run is a few reads, and
// writes only what differs. Rules: actionPlanRules.ts (planOptions, planValuesOf). Proof in the log: `[action-plan] HubSpot`.
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { planItems } from "./actionPlan";
import { PLAN_PROPS, planOptions, planValuesOf, sameOptions, type HsOption, type PlanPropName } from "./actionPlanRules";
import { planTicketLinks } from "./kpiActions";

const GROUP = "marketing_roadmap";
const DESCRIPTION: Record<PlanPropName, string> = {
  mkt_plan_category: "The action plan's main category the ticket serves. Kept by APSOhub from /action-plan - change the plan there, not the choices here.",
  mkt_plan_subcategory: "The action plan's sub-category the ticket serves. Kept by APSOhub from /action-plan - change the plan there, not the choices here.",
  mkt_plan_action: "The action of the action plan the ticket moves forward. Kept by APSOhub from /action-plan - change the plan there, not the choices here.",
};

type Items = Awaited<ReturnType<typeof planItems>>;
export type PlanSyncResult = { created: string[]; changed: string[]; tickets: number };

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

let chain: Promise<unknown> = Promise.resolve();
/** One run at a time in this process; the next one waits for the last. */
export function syncPlanToHubspot(reason: string): Promise<PlanSyncResult> {
  const run = chain.then(async () => {
    const items = await planItems();
    const out: PlanSyncResult = { created: [], changed: [], tickets: 0 };
    for (const p of PLAN_PROPS) {
      const r = await property(p, items);
      if (r) out[r].push(p.name);
    }
    out.tickets = await tickets(items);
    if (out.created.length || out.changed.length || out.tickets) {
      console.log(`[action-plan] HubSpot (${reason}): created ${out.created.join(", ") || "-"}; choices changed ${out.changed.join(", ") || "-"}; ${out.tickets} ticket(s) given their place`);
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
