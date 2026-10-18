// "FROM SCROLL TO SALE" IN HUBSPOT - the pipeline's form (its properties' choices, its stages, the
// owners and their teams), a new ticket, and the existing ones to link (SARCLA 18.10.2026). The rules
// that fill the form are in scrollToSaleRules.ts.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { S2S_FIELDS, S2S_PIPELINE, ticketProperties, type S2sField } from "./scrollToSaleRules";

type Opt = { value: string; label: string };
type Page<T> = { results?: T[]; paging?: { next?: { after?: string } } };
type Ticket = { id: string; properties?: Record<string, string | null> };

const PORTAL = "26492587";
export const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;
const HOUR = 3_600_000;

let formCache: { at: number; value: Promise<S2sForm> } | null = null;
/** id = the owner id (hubspot_owner_id), userId = the user id (hs_shared_user_ids). */
export type S2sOwner = { id: string; userId: string; name: string; email: string; teams: { id: string; name: string; primary: boolean }[] };
export type S2sForm = { fields: S2sField[]; stages: (Opt & { open: boolean })[]; owners: S2sOwner[]; teams: Opt[]; takenRoadmapIds: string[] };

async function owners(): Promise<S2sOwner[]> {
  const out: S2sOwner[] = [];
  let after: string | undefined;
  do {
    const j = await hubspotFetchJson<Page<{ id: string; userId?: number | string; firstName?: string; lastName?: string; email?: string; teams?: { id: string; name: string; primary?: boolean }[] }>>({
      path: `/crm/v3/owners?limit=100&archived=false${after ? `&after=${after}` : ""}`,
    });
    for (const o of j.results ?? []) {
      out.push({
        id: String(o.id), userId: o.userId == null ? "" : String(o.userId), email: (o.email ?? "").toLowerCase(),
        name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id),
        teams: (o.teams ?? []).map((t) => ({ id: String(t.id), name: t.name, primary: !!t.primary })),
      });
    }
    after = j.paging?.next?.after;
  } while (after);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every roadmap id the pipeline's tickets carry, for the next free one. */
async function roadmapIds(): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const j = await hubspotFetchJson<Page<Ticket>>({
      path: "/crm/v3/objects/tickets/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: S2S_PIPELINE }, { propertyName: "mkt_roadmap_id", operator: "HAS_PROPERTY" }] }], properties: ["mkt_roadmap_id"], limit: 100, ...(after ? { after } : {}) },
    });
    for (const t of j.results ?? []) if (t.properties?.mkt_roadmap_id) ids.push(t.properties.mkt_roadmap_id);
    after = j.paging?.next?.after;
    if (!after) break;
  }
  return ids;
}

async function readForm(): Promise<S2sForm> {
  const [defs, pipe, own, ids] = await Promise.all([
    Promise.all(S2S_FIELDS.filter((f) => f.kind === "select" || f.kind === "multi").map((f) =>
      hubspotFetchJson<{ options?: (Opt & { hidden?: boolean; displayOrder?: number })[] }>({ path: `/crm/v3/properties/tickets/${f.name}` })
        .then((d) => [f.name, (d.options ?? []).filter((o) => !o.hidden).map((o) => ({ value: o.value, label: o.label }))] as const)
        .catch(() => [f.name, [] as Opt[]] as const))),
    hubspotFetchJson<{ stages?: { id: string; label: string; displayOrder: number; metadata?: { isClosed?: string } }[] }>({ path: `/crm/v3/pipelines/tickets/${S2S_PIPELINE}` }),
    owners(),
    roadmapIds().catch(() => [] as string[]),
  ]);
  const opts = new Map<string, Opt[]>(defs);
  const teams = new Map<string, string>();
  for (const o of own) for (const t of o.teams) teams.set(t.id, t.name);
  return {
    fields: S2S_FIELDS.map((f) => ({ ...f, ...(opts.has(f.name) ? { options: opts.get(f.name) } : {}) })),
    // Live, Maintaining Internally and Killed are closed (HubSpot's own metadata)
    stages: (pipe.stages ?? []).sort((a, b) => a.displayOrder - b.displayOrder).map((s) => ({ value: s.id, label: s.label, open: s.metadata?.isClosed !== "true" })),
    owners: own,
    teams: [...teams.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    takenRoadmapIds: ids,
  };
}

/** The form, read again at most once an hour (owners and choices change rarely). */
export function s2sForm(fresh = false): Promise<S2sForm> {
  if (fresh || !formCache || Date.now() - formCache.at > HOUR) {
    const value = readForm();
    formCache = { at: Date.now(), value };
    value.catch(() => { formCache = null; });
  }
  return formCache.value;
}

/** The HubSpot owner a hub user is, by e-mail, with their primary team. */
export function ownerOf(form: S2sForm, email: string | null | undefined): S2sOwner | null {
  const e = (email ?? "").trim().toLowerCase();
  return e ? form.owners.find((o) => o.email === e) ?? null : null;
}

export async function createTicket(values: Record<string, string | null | undefined>, extra: Record<string, string> = {}): Promise<string> {
  const j = await hubspotFetchJson<{ id: string }>({ path: "/crm/v3/objects/tickets", method: "POST", body: { properties: ticketProperties(values, extra) } });
  formCache = null; // its roadmap id is taken now
  return String(j.id);
}

export type S2sTicket = { id: string; subject: string; stage: string; stageLabel: string; open: boolean; owner: string; ownerName: string; roadmapId: string; created: string; url: string };

const TICKET_PROPS = ["subject", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "mkt_roadmap_id", "createdate"];
async function shape(list: Ticket[]): Promise<S2sTicket[]> {
  const form = await s2sForm().catch(() => null);
  const stage = new Map((form?.stages ?? []).map((s) => [s.value, s]));
  const owner = new Map((form?.owners ?? []).map((o) => [o.id, o.name]));
  return list.filter((t) => t.properties?.hs_pipeline === S2S_PIPELINE).map((t) => {
    const p = t.properties ?? {};
    return {
      id: String(t.id), subject: p.subject ?? "", stage: p.hs_pipeline_stage ?? "", stageLabel: stage.get(p.hs_pipeline_stage ?? "")?.label ?? "",
      open: stage.get(p.hs_pipeline_stage ?? "")?.open ?? true,
      owner: p.hubspot_owner_id ?? "", ownerName: owner.get(p.hubspot_owner_id ?? "") ?? "", roadmapId: p.mkt_roadmap_id ?? "",
      created: p.createdate ?? "", url: ticketUrl(String(t.id)),
    };
  });
}

/** The linked tickets as HubSpot has them now (a deleted or moved one drops out). */
export async function readTickets(ids: string[]): Promise<S2sTicket[]> {
  if (!ids.length) return [];
  const j = await hubspotFetchJson<{ results?: Ticket[] }>({
    path: "/crm/v3/objects/tickets/batch/read", method: "POST",
    body: { inputs: ids.slice(0, 100).map((id) => ({ id })), properties: TICKET_PROPS },
  });
  return shape(j.results ?? []);
}

/**
 * The pipeline's OPEN tickets to link (SARCLA 18.10: "only show open tickets" - not Live, Maintaining
 * Internally or Killed): by words of the name or the roadmap id, newest first; empty asks for the newest.
 */
export async function searchTickets(q: string): Promise<S2sTicket[]> {
  const words = q.trim();
  const open = (await s2sForm()).stages.filter((s) => s.open).map((s) => s.value);
  const j = await hubspotFetchJson<{ results?: Ticket[] }>({
    path: "/crm/v3/objects/tickets/search", method: "POST",
    body: {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: S2S_PIPELINE }, ...(open.length ? [{ propertyName: "hs_pipeline_stage", operator: "IN", values: open }] : [])] }],
      ...(words ? { query: words.slice(0, 100) } : {}),
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      properties: TICKET_PROPS, limit: 25,
    },
  });
  return shape(j.results ?? []);
}
