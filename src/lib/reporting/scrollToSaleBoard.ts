// "FROM SCROLL TO SALE" BESIDE THE ACTION PLAN (SARCLA 02.11.2026: "the idea of the new Scroll to Sale is to keep it on the
// action plan but to see 1-1 the pipeline, filtered per owner and so forth"; "no matter if the ticket is created here or
// in HubSpot, the ticket should link to an action or sub-action depending on its meaning - created in HubSpot, the AI
// analyses it and puts it in the right place, the properties mirroring; this only applies to Digital Growth"). The
// pipeline's tickets as HubSpot has them, each with its place in the plan; for the ones not in it a proposal - the
// ticket's own plan property when someone set it in HubSpot, else the AI's pick among the Digital Growth actions (a
// sub-action of one) and their categories (a new action in one) - that an admin ticks and applies ("proposal first, I
// tick"). Placed, a ticket and its sub-action or action are kept in step (actionPlanHubspot.ts). Measured 02.11.2026:
// 119 tickets, 51 open, 68 closed, 2 in the plan.
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { addItem, markTicketSync, planItems, startMains, updateItem } from "./actionPlan";
import { queuePlanSync } from "./actionPlanHubspot";
import { IDEA, PRIORITIES, dgTargets, stageOf, type PlanItem, type PlanOwner } from "./actionPlanRules";
import { actionTickets, addTask, linkTickets, markTaskSync, planTasks, taskTickets } from "./kpiActions";
import { S2S_PIPELINE } from "./scrollToSaleRules";
import { s2sForm, ticketUrl } from "./scrollToSale";

const PROPS = ["subject", "content", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "hs_ticket_priority", "createdate", "mkt_roadmap_id",
  "mkt_planned_date", "mkt_golive_date", "mkt_business_goal", "mkt_channel", "mkt_implementation_country", "mkt_agency", "mkt_roadmap_year",
  "mkt_kpis", "mkt_next_steps", "mkt_status_note", "mkt_plan_action"];
type Raw = { id: string; properties?: Record<string, string | null> };

/** Where a ticket sits in the plan: on an action, or under one as its sub-action. */
export type Place = { kind: "action"; itemId: number; title: string } | { kind: "sub"; itemId: number; taskId: number; title: string; action: string };
export type BoardTicket = {
  id: string; subject: string; stage: string; open: boolean; owner: string; ownerName: string; priority: string; created: string;
  roadmapId: string; planned: string; golive: string; goal: string; channel: string; url: string;
  place: Place | null;
  /** the plan's action someone set on the ticket in HubSpot, when it is not placed yet */
  hint: number | null;
};
export type Board = { stages: { id: string; label: string; open: boolean }[]; tickets: BoardTicket[]; at: string };

let cache: { at: number; raw: Raw[] } | null = null;
/** Every ticket of the pipeline, 100 a page, newest first - held a minute (a place applied reads it again). */
async function pipeline(fresh = false): Promise<Raw[]> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.raw;
  const out: Raw[] = [];
  for (let after: string | undefined, n = 0; n < 30; n++) {
    const j = await hubspotFetchJson<{ results?: Raw[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/tickets/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: S2S_PIPELINE }] }], properties: PROPS, limit: 100,
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], ...(after ? { after } : {}) },
    });
    out.push(...(j.results ?? []));
    after = j.paging?.next?.after;
    if (!after) break;
  }
  cache = { at: Date.now(), raw: out };
  return out;
}

/** The pipeline 1-1, each ticket with its place in the plan. */
export async function board(fresh = false): Promise<Board> {
  const [raw, form, items, subs, actionLinks, subLinks] = await Promise.all([pipeline(fresh), s2sForm(), planItems(), planTasks(), actionTickets(), taskTickets()]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const taskById = new Map(subs.map((x) => [x.id, x]));
  const stages = form.stages.map((s) => ({ id: s.value, label: s.label, open: s.open }));
  const open = new Map(stages.map((s) => [s.id, s.open]));
  const names = new Map(form.owners.map((o) => [o.id, o.name]));
  const places = new Map<string, Place>();
  for (const l of actionLinks) { const a = byId.get(l.item); if (a) places.set(l.ticketId, { kind: "action", itemId: a.id, title: a.title }); }
  for (const l of subLinks) {
    const k = taskById.get(l.task);
    if (k?.planItem != null && !places.has(l.ticketId)) places.set(l.ticketId, { kind: "sub", itemId: k.planItem, taskId: k.id, title: k.title, action: byId.get(k.planItem)?.title ?? "" });
  }
  const tickets = raw.filter((t) => t.properties?.hs_pipeline === S2S_PIPELINE).map((t): BoardTicket => {
    const p = t.properties ?? {};
    const hint = Number(p.mkt_plan_action);
    return {
      id: String(t.id), subject: p.subject ?? "", stage: p.hs_pipeline_stage ?? "", open: open.get(p.hs_pipeline_stage ?? "") ?? true,
      owner: p.hubspot_owner_id ?? "", ownerName: names.get(p.hubspot_owner_id ?? "") ?? "", priority: p.hs_ticket_priority ?? "", created: (p.createdate ?? "").slice(0, 10),
      roadmapId: p.mkt_roadmap_id ?? "", planned: (p.mkt_planned_date ?? "").slice(0, 10), golive: (p.mkt_golive_date ?? "").slice(0, 10),
      goal: p.mkt_business_goal ?? "", channel: p.mkt_channel ?? "", url: ticketUrl(String(t.id)),
      place: places.get(String(t.id)) ?? null, hint: Number.isInteger(hint) && byId.has(hint) ? hint : null,
    };
  });
  return { stages, tickets, at: new Date().toISOString() };
}

/* ── proposals ─────────────────────────────────────────────────────────── */

/** A ticket's place proposed: a sub-action of a Digital Growth action, a new action in a category, or left out. */
export type Proposal = { ticketId: string; as: "sub" | "action" | "none"; target: number | null; why: string; by: "hubspot" | "ai" | "none" };

const SYSTEM = `You place the marketing team's tickets on their action plan. APSOparts sells technical parts online (seals, O-rings, hoses, plastics); its Digital Growth team runs a HubSpot pipeline "From Scroll to Sale" for marketing and shop jobs. Each ticket goes where it moves the plan forward:
- "sub": a step of an existing Digital Growth action - the ticket's subject is a part of what that action is about. target = the action's id.
- "action": a job of its own that no action covers, in the category it belongs to. target = the category's id.
- "none": nothing on the plan fits. target = 0.
Only the ids listed. Prefer "sub" when an action clearly covers the ticket. why: one short sentence, in English.`;

/** Where a ticket may go, to pick from: the Digital Growth actions and their categories, each with where it is. */
export async function targetList(): Promise<{ actions: { id: number; title: string; path: string }[]; categories: { id: number; title: string; path: string }[] }> {
  const { actions, categories, path } = dgTargets(await planItems());
  const one = (i: PlanItem) => ({ id: i.id, title: i.title, path: path(i) });
  return { actions: actions.map(one), categories: categories.map(one) };
}

/** Proposals for the tickets not in the plan: the ticket's own plan property first, else the AI's - 40 tickets a question. */
export async function propose(ids: string[]): Promise<Proposal[]> {
  const [b, items] = await Promise.all([board(), planItems()]);
  const want = new Set(ids);
  const loose = b.tickets.filter((t) => !t.place && (!want.size || want.has(t.id)));
  const { actions, categories, path } = dgTargets(items);
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: Proposal[] = [];
  const ask: BoardTicket[] = [];
  for (const t of loose) {
    const h = t.hint != null ? byId.get(t.hint) : undefined;
    if (h?.kind === "action") out.push({ ticketId: t.id, as: "sub", target: h.id, why: "Its \"Action plan action\" property in HubSpot says so.", by: "hubspot" });
    else if (h && (h.kind === "group" || h.kind === "topic")) out.push({ ticketId: t.id, as: "action", target: h.id, why: "Its plan property in HubSpot names this category.", by: "hubspot" });
    else ask.push(t);
  }
  const client = getAnthropic();
  if (!client || !ask.length || (!actions.length && !categories.length)) {
    return [...out, ...ask.map((t) => ({ ticketId: t.id, as: "none" as const, target: null, why: client ? "No Digital Growth action or category in the plan to put it in." : "The AI is not set up on this hub.", by: "none" as const }))];
  }
  const actionIds = new Set(actions.map((a) => a.id)), catIds = new Set(categories.map((c) => c.id));
  const listing = [
    "Digital Growth actions (for \"sub\"):",
    ...actions.map((a) => `- ${a.id}: ${a.title.slice(0, 160)}${path(a) ? ` (in ${path(a)})` : ""}${a.detail && a.detail !== a.title ? ` - ${a.detail.replace(/\s+/g, " ").slice(0, 160)}` : ""}`),
    "Categories (for \"action\"):",
    ...categories.map((c) => `- ${c.id}: ${path(c) ? `${path(c)} > ` : ""}${c.title.slice(0, 160)}`),
  ].join("\n");
  // the batches asked side by side: 117 tickets one after another took longer than a page waits
  const parts: BoardTicket[][] = [];
  for (let k = 0; k < ask.length; k += 40) parts.push(ask.slice(k, k + 40));
  const answers = await Promise.all(parts.map(async (part) => {
    const schema = {
      type: "object", additionalProperties: false, required: ["placements"],
      properties: { placements: { type: "array", items: { type: "object", additionalProperties: false, required: ["ticket", "as", "target", "why"], properties: {
        ticket: { type: "string", enum: part.map((t) => t.id) }, as: { type: "string", enum: ["sub", "action", "none"] },
        target: { type: "integer", enum: [0, ...actionIds, ...catIds] }, why: { type: "string" },
      } } } },
    };
    const user = `${listing}\n\nThe tickets:\n${part.map((t) => `- ${t.id}: ${t.subject.slice(0, 200)}${t.goal ? ` [goal ${t.goal}]` : ""}${t.channel ? ` [channel ${t.channel}]` : ""}`).join("\n")}`;
    const r = await claudeText({ client, system: [{ type: "text", text: SYSTEM }], user, budget: { maxTokens: 8000, effort: "low" }, outputFormat: { type: "json_schema", schema } });
    let got: { ticket: string; as: string; target: number; why: string }[] = [];
    if (r.ok) { try { got = (JSON.parse(r.text) as { placements: typeof got }).placements ?? []; } catch { got = []; } }
    return { part, got, ok: r.ok };
  }));
  for (const { part, got, ok } of answers) {
    for (const t of part) {
      const g = got.find((x) => x.ticket === t.id);
      // kept only where the target fits the kind
      if (g?.as === "sub" && actionIds.has(g.target)) out.push({ ticketId: t.id, as: "sub", target: g.target, why: g.why.slice(0, 300), by: "ai" });
      else if (g?.as === "action" && catIds.has(g.target)) out.push({ ticketId: t.id, as: "action", target: g.target, why: g.why.slice(0, 300), by: "ai" });
      else out.push({ ticketId: t.id, as: "none", target: null, why: g?.why?.slice(0, 300) || (ok ? "Nothing on the plan fits." : "The AI did not answer - try again."), by: g ? "ai" : "none" });
    }
  }
  return out;
}

/* ── placing ───────────────────────────────────────────────────────────── */

const dated = (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}/.test(v ?? "") ? (v as string).slice(0, 10) : null);
const listOf = (v: string | null | undefined) => (v ?? "").split(";").map((x) => x.trim()).filter(Boolean);

/**
 * The ticked proposals applied: each ticket a sub-action of its action, or a new Digital Growth action in its category,
 * made from the ticket's own fields and linked to it - they agree from the start, then are kept in step. A ticket that
 * found a place meanwhile is passed over. What was placed.
 */
export async function place(picks: { ticketId: string; as: "sub" | "action"; target: number }[], by: string): Promise<{ placed: number; skipped: number }> {
  const [b, items, form] = await Promise.all([board(true), planItems(), s2sForm()]);
  const { actions, categories } = dgTargets(items);
  const actionIds = new Set(actions.map((a) => a.id)), catIds = new Set(categories.map((c) => c.id));
  const loose = new Set(b.tickets.filter((t) => !t.place).map((t) => t.id));
  const names = new Map(form.owners.map((o) => [o.id, o.name]));
  const ok = picks.filter((x) => loose.has(x.ticketId) && (x.as === "sub" ? actionIds.has(x.target) : catIds.has(x.target)));
  const raw = new Map((await pipeline()).map((t) => [String(t.id), t.properties ?? {}]));
  let placed = 0;
  for (const x of ok) {
    const p = raw.get(x.ticketId);
    if (!p) continue;
    const stage = stageOf(p.hs_pipeline_stage) ? (p.hs_pipeline_stage as string) : IDEA;
    const priority = PRIORITIES.some((q) => q.value === p.hs_ticket_priority) ? (p.hs_ticket_priority as string) : "";
    const owner: PlanOwner | null = p.hubspot_owner_id ? { id: p.hubspot_owner_id, name: names.get(p.hubspot_owner_id) ?? p.hubspot_owner_id } : null;
    const subject = (p.subject ?? "").trim() || `Ticket ${x.ticketId}`;
    if (x.as === "sub") {
      const task = await addTask({
        tile: `plan:${x.target}`, page: "plan", title: subject, note: (p.content ?? "").replace(/\s*Open it: \S+\s*$/, "").trim(),
        owner: owner?.id ?? "", ownerName: owner?.name ?? "", due: dated(p.mkt_golive_date), start: dated(p.mkt_planned_date), stage, priority,
        statusNote: p.mkt_status_note ?? "", href: `/action-plan?item=${x.target}`, by,
      });
      await linkTickets(`plan:${x.target}`, [x.ticketId], by, false, task.id);
      await markTaskSync([task.id]);
    } else {
      const a = await addItem({ parentId: x.target, kind: "action", title: subject, by });
      await updateItem(a.id, {
        detail: (p.content ?? "").trim() || subject, stage, priority, start: dated(p.mkt_planned_date), due: dated(p.mkt_golive_date), dg: true,
        owners: owner ? [owner] : [], channel: listOf(p.mkt_channel), country: listOf(p.mkt_implementation_country), agency: listOf(p.mkt_agency),
        roadmapYear: p.mkt_roadmap_year ?? "", kpis: p.mkt_kpis ?? "", nextSteps: p.mkt_next_steps ?? "", statusNote: p.mkt_status_note ?? "",
      }, by);
      await linkTickets(`plan:${a.id}`, [x.ticketId], by, false, null);
      await markTicketSync([a.id]);
    }
    placed++;
  }
  if (placed) {
    await startMains(await planTasks(), "Its sub-actions are under way");
    // their place in the plan written on the tickets
    queuePlanSync("tickets placed");
  }
  cache = null;
  console.log(`[action-plan] ${by} placed ${placed} Scroll to Sale ticket(s) in the plan (${picks.length - placed} passed over)`);
  return { placed, skipped: picks.length - placed };
}
