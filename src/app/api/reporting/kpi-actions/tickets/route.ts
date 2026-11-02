// A tile's "From Scroll to Sale" tickets (SARCLA 18.10.2026):
//   GET ?tile=&ctx=<json>   the linked tickets as HubSpot has them, the form and its prefill
//   GET ?read=<id>          one ticket's fields, to fill a new sub-action or action from it (SARCLA 02.11.2026: "here it
//                           doesn't inherit the fields from the ticket")
//   GET ?search=<words>&state=open|closed|all   the pipeline's tickets to link (newest first when empty) - open ones,
//                           or the closed ones too to trace back (SARCLA 01.11.2026)
//   POST {action:"create", tile, taskId?, values}   a new ticket, linked to the tile (and its task)
//   POST {action:"link", tile, taskId?, ids}        1..n existing open tickets linked
// A ticket belongs to the task it is made for (SARCLA 18.10: "inside of the task").
//   POST {action:"unlink", tile, id}
// On an action of the plan the form also carries the plan's place (three properties the hub keeps in HubSpot,
// actionPlanHubspot.ts) and starts from the action's own fields; a ticket made or linked there gets its place.
import { NextRequest, NextResponse } from "next/server";
import { actionTickets, forgetTaskSync, linkTickets, planIdOf, taskById, taskTickets, tasksOf, ticketsOf, unlinkTicket } from "@/lib/reporting/kpiActions";
import { forgetTicketSync, itemById, planItems } from "@/lib/reporting/actionPlan";
import { flushPlanSync, planInHubspot, queuePlanSync } from "@/lib/reporting/actionPlanHubspot";
import { PLAN_PROPS, planOptions, ticketFromAction } from "@/lib/reporting/actionPlanRules";
import { createTicket, ownerOf, readTickets, s2sForm, searchTickets, ticketFields, ticketUrl, type TicketState } from "@/lib/reporting/scrollToSale";
import { PLAN_FIELDS, missingRequired, prefill, type TileContext } from "@/lib/reporting/scrollToSaleRules";
import { describeIntegrationError } from "@/lib/integrations/status";
import { fail, who, whoForTile } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tileOk = (t: unknown): t is string => typeof t === "string" && /^[a-z0-9-]+:[^\s]{0,80}$/i.test(t);
const hsFail = (e: unknown) => NextResponse.json({ ok: false, ...describeIntegrationError(e) }, { status: 502 });

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // the open tickets to link: Advanced reporting's rule (an admin, the only one on the plan, passes it too)
  const w = sp.has("search") || sp.has("read") ? await who() : await whoForTile(sp.get("tile"));
  if (w instanceof NextResponse) return w;
  try {
    if (sp.has("read")) {
      const id = sp.get("read") ?? "";
      if (!/^\d+$/.test(id)) return fail("read is a ticket id", 400);
      const fields = await ticketFields(id);
      return fields ? NextResponse.json({ ok: true, fields }) : fail("no such ticket in the pipeline", 404);
    }
    if (sp.has("search")) {
      const state = (["open", "closed", "all"].includes(sp.get("state") ?? "") ? sp.get("state") : "open") as TicketState;
      return NextResponse.json({ ok: true, tickets: await searchTickets(sp.get("search") ?? "", state) });
    }
    const tile = sp.get("tile");
    if (!tileOk(tile)) return fail("tile is missing", 400);
    let ctx: TileContext | null = null;
    try { ctx = JSON.parse(sp.get("ctx") ?? "null"); } catch { ctx = null; }
    const [links, form] = await Promise.all([ticketsOf(tile), s2sForm()]);
    const linked = await readTickets(links.map((l) => l.ticketId));
    const me = ownerOf(form, w.email);
    const options = Object.fromEntries(form.fields.filter((f) => f.options).map((f) => [f.name, f.options!]));
    let values = ctx ? prefill({ ...ctx, page: ctx.page || tile.split(":")[0] }, { options, ownerId: me?.id, year: new Date().getFullYear(), takenRoadmapIds: form.takenRoadmapIds }) : {};
    // the plan's place: on the plan's actions only, once HubSpot has the properties - their choices straight from the plan
    let fields = form.fields.filter((f) => !PLAN_FIELDS.includes(f.name));
    const planId = planIdOf(tile);
    if (planId != null) {
      const items = await planItems();
      const action = items.find((i) => i.id === planId);
      const ready = await planInHubspot().then(() => true, (e) => { console.error("[action-plan] HubSpot properties not ready:", (e as Error).message); return false; });
      if (ready) {
        fields = form.fields.map((f) => {
          const p = PLAN_PROPS.find((x) => x.name === f.name);
          return p ? { ...f, options: planOptions(items, p.kind).map((o) => ({ value: o.value, label: o.label })) } : f;
        });
      }
      if (action) {
        const mine = ticketFromAction(action, items, options);
        if (!ready) for (const k of PLAN_FIELDS) delete mine[k];
        // the way back to the action in the hub, as the KPI tiles' tickets have it
        if (mine.content && ctx?.href) mine.content = `${mine.content}\n\nOpen it: ${ctx.href}`;
        values = { ...values, ...mine };
      }
    }
    return NextResponse.json({
      ok: true, canWrite: w.canWrite,
      linked: linked.map((t) => { const l = links.find((x) => x.ticketId === t.id); return { ...t, createdHere: l?.created ?? false, taskId: l?.taskId ?? null }; }),
      form: { fields, stages: form.stages.map((s) => ({ value: s.value, label: s.label })), owners: form.owners.map((o) => ({ value: o.id, label: o.name })), teams: form.teams },
      prefill: values, me: me ? { id: me.id, name: me.name } : null,
    });
  } catch (e) {
    return hsFail(e);
  }
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { action?: string; tile?: string; taskId?: number; values?: Record<string, string>; ids?: string[]; id?: string };
  const w = await whoForTile(b.tile, true);
  if (w instanceof NextResponse) return w;
  if (!tileOk(b.tile)) return fail("tile is missing", 400);
  const taskId = Number.isInteger(b.taskId) ? (b.taskId as number) : null;
  try {
    // an action of the plan takes a Scroll to Sale ticket only when Digital Growth leads it - the sales
    // actions have no pipeline (SARCLA 31.10.2026)
    const planId = planIdOf(b.tile);
    if (planId != null && (b.action === "create" || b.action === "link") && !(await itemById(planId))?.dg) {
      return fail("only an action led by Digital Growth takes a Scroll to Sale ticket", 400);
    }
    // one ticket per action, on the action itself, and one per sub-action (SARCLA 02.11.2026); a main action - one with
    // sub-actions - takes none: its sub-actions carry theirs ("this type of action should not have a ticket, because
    // they are main")
    if (planId != null && (b.action === "create" || b.action === "link")) {
      if (b.action === "link" && (b.ids ?? []).length > 1) return fail(taskId == null ? "an action takes one ticket" : "a sub-action takes one ticket", 400);
      if (taskId == null) {
        if ((await tasksOf(b.tile as string)).length) return fail("a main action takes no ticket - its sub-actions carry theirs", 400);
        if ((await actionTickets()).some((x) => x.item === planId)) return fail("this action has its ticket - unlink it first to give it another", 400);
      } else if ((await taskTickets()).some((x) => x.task === taskId)) return fail("this sub-action has its ticket - unlink it first to give it another", 400);
    }
    if (b.action === "create") {
      const missing = missingRequired(b.values ?? {});
      if (missing.length) return fail(`still to fill in: ${missing.join(", ")}`, 400);
      // the task's shared people share the ticket too (HubSpot notifies them) - by their user ids
      const task = taskId ? await taskById(taskId) : null;
      const sharedUsers = (task?.shared ?? []).map((p) => p.userId).filter(Boolean);
      // the plan's place only on the plan's actions; a choice made a moment ago reaches HubSpot first
      const values = { ...(b.values ?? {}) };
      if (planId == null) for (const k of PLAN_FIELDS) delete values[k];
      else if (PLAN_FIELDS.some((k) => values[k])) await flushPlanSync();
      const id = await createTicket(values, sharedUsers.length ? { hs_shared_user_ids: sharedUsers.join(";") } : {});
      await linkTickets(b.tile, [id], w.name, true, taskId);
      if (planId != null && taskId == null) await forgetTicketSync(planId);
      if (taskId != null) await forgetTaskSync(taskId);
      queuePlanSync("ticket made");
      // SARCLA 02.11.2026: "when I linked the ticket it didn't load the information - I need to close and come back"
      if (planId != null) await flushPlanSync().catch(() => undefined);
      console.log(`[kpi-actions] ticket ${id} created from tile ${b.tile} by ${w.name}`);
      return NextResponse.json({ ok: true, id, url: ticketUrl(id) });
    }
    if (b.action === "link") {
      const ids = (b.ids ?? []).map(String).filter((x) => /^\d+$/.test(x)).slice(0, 50);
      if (!ids.length) return fail("no ticket to link", 400);
      // only tickets of the pipeline: what HubSpot returns for the ids
      const found = await readTickets(ids);
      await linkTickets(b.tile, found.map((t) => t.id), w.name, false, taskId);
      if (planId != null && taskId == null) await forgetTicketSync(planId);
      if (taskId != null) await forgetTaskSync(taskId);
      queuePlanSync("tickets linked");
      if (planId != null) await flushPlanSync().catch(() => undefined);
      return NextResponse.json({ ok: true, linked: found.length });
    }
    if (b.action === "unlink" && b.id) {
      await unlinkTicket(b.tile, String(b.id));
      if (planId != null) await forgetTicketSync(planId);
      return NextResponse.json({ ok: true });
    }
    return fail("action is create, link or unlink", 400);
  } catch (e) {
    return hsFail(e);
  }
}
