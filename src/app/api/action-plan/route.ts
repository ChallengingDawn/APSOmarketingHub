// The action plan (SARCLA 31.10.2026), where Mission Control was - admins (./guard.ts):
//   GET                                          every row (the actions' tickets read first), every sub-action, the people to assign, the ticket's choices,
//                                                whether you may change
//   GET   ?log=<id>                              an action's tracking: every change, who and when
//   PATCH {id, ...fields, owners?: [owner ids]}  a row's fields, in the "From Scroll to Sale" ticket's terms (stage, priority,
//                                                planned / go-live date, channels, countries, agency, KPIs, notes...)
//   POST  {action:"add", parentId, kind, title}  a new topic, group or action
//   POST  {action:"move", id, target, where}     drag and drop: "into" a topic or group, or "before" a row
//   POST  {action:"sub", id, target}             an action dropped on another action: it becomes its sub-action
//   POST  {action:"unsub", taskId, target}       a sub-action dropped on a category: an action of its own there
//   POST  {action:"movesub", taskId, target}     a sub-action dropped on another action: it moves under it
//   POST  {action:"copysub", taskId, target}     a sub-action duplicated onto another action, its ticket the same (Ctrl-drag, or Duplicate)
//   POST  {action:"ordersub", taskId, target, where}  a sub-action dropped "before" or "after" another: its place among them
//   DELETE ?id=                                  a row and what is under it; its own sub-actions go too
// Every change to the tree reaches HubSpot's three plan properties a few seconds later (actionPlanHubspot.ts).
import { NextRequest, NextResponse } from "next/server";
import { actionToSub, addItem, copySub, datesFromSubs, deleteItems, foldImportedOnce, foldNotes, itemById, lankarToClaudio, mainsFollowSubs, moveSub, orderSub, salesLeadersOnce, subToAction, matchOwnersOnce, moveItem, planItems, planLog, subtree, updateItem } from "@/lib/reporting/actionPlan";
import { savedHierarchy } from "@/lib/hierarchy/store";
import { freshFromTickets, planInHubspot, queuePlanSync } from "@/lib/reporting/actionPlanHubspot";
import { PRIORITIES, S2S_CHOICES, STAGES, subOrder, type Opt, type PlanFields, type PlanKind, type PlanOwner, type PlanSub } from "@/lib/reporting/actionPlanRules";
import { actionTickets, dropPlanItem, planTasks } from "@/lib/reporting/kpiActions";
import { s2sForm } from "@/lib/reporting/scrollToSale";
import { fail } from "../reporting/kpi-actions/guard";
import { planWho as who } from "./guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_FIELDS = ["title", "detail", "responsible", "referent", "dueNote", "roadmapYear", "statusNote"] as const;
const LIST_FIELDS = ["channel", "country", "agency"] as const;
/** The ticket's property behind each choice list. */
const PROP = { channel: "mkt_channel", country: "mkt_implementation_country", agency: "mkt_agency", roadmapYear: "mkt_roadmap_year" } as const;

/** The people an action can be given to: HubSpot's users, as the KPI tasks pick them (read at most once an hour). */
async function people(): Promise<PlanOwner[]> {
  return (await s2sForm()).owners.map((o) => ({ id: o.id, name: o.name }));
}

/** The ticket's choices as HubSpot has them now, else as they were read on 01.11.2026. */
async function choices(): Promise<Record<keyof typeof PROP, Opt[]>> {
  const form = await s2sForm().catch(() => null);
  const live = (k: keyof typeof PROP) => form?.fields.find((f) => f.name === PROP[k])?.options ?? [];
  const out = { ...S2S_CHOICES };
  for (const k of Object.keys(PROP) as (keyof typeof PROP)[]) if (live(k).length) out[k] = live(k);
  return out;
}

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  const logOf = Number(req.nextUrl.searchParams.get("log"));
  if (logOf) {
    if (!Number.isInteger(logOf) || logOf <= 0) return fail("log is a row id", 400);
    try { return NextResponse.json({ ok: true, log: await planLog(logOf) }); } catch (e) { return fail(e); }
  }
  try {
    let list: PlanOwner[] = [];
    let peopleError: string | null = null;
    try {
      list = await people();
      // the workbook's codes become people the first time HubSpot can be read, its "Sales leaders" the hierarchy's
      await matchOwnersOnce(list);
      const saved = await savedHierarchy().catch(() => ({} as Awaited<ReturnType<typeof savedHierarchy>>));
      await salesLeadersOnce(list.filter((p) => saved[p.id]?.tags?.includes("leader"))).catch((e) => console.error("[action-plan] sales leaders not read:", (e as Error).message));
      // and HubSpot gets the plan's three ticket properties (once per start of the hub; not waited for)
      void planInHubspot().catch(() => undefined);
    } catch (e) {
      peopleError = String((e as Error)?.message ?? e).slice(0, 200);
    }
    // what changed on the actions' tickets comes in first; a main action whose sub-actions are under way is too, and its
    // dates are theirs; the workbook's actions put right once
    await freshFromTickets();
    const ticketed = new Set((await actionTickets()).map((x) => x.item));
    await foldImportedOnce(ticketed).catch((e) => console.error("[action-plan] imported actions not put right:", (e as Error).message));
    // no KPIs or next steps on any form any more: the ones still on an action go into its description (03.11.2026)
    await foldNotes(ticketed).catch((e) => console.error("[action-plan] KPIs and next steps not moved:", (e as Error).message));
    await lankarToClaudio().catch((e) => console.error("[action-plan] LANKAR not replaced:", (e as Error).message));
    const before = await planTasks();
    await mainsFollowSubs().catch((e) => console.error("[action-plan] main actions not given their sub-actions' status:", (e as Error).message));
    await datesFromSubs(before).catch((e) => console.error("[action-plan] dates from sub-actions not set:", (e as Error).message));
    const [items, tasks] = await Promise.all([planItems(), planTasks()]);
    const ids = new Set(items.map((i) => i.id));
    // in their order: the open ones first, as dragged (actionPlanRules.subOrder)
    const subs: PlanSub[] = subOrder(tasks.filter((t) => t.planItem != null && ids.has(t.planItem)).map((t) => ({
      id: t.id, item: t.planItem as number, title: t.title, owner: t.owner, ownerName: t.ownerName, start: t.start, due: t.due, status: t.status, stage: t.stage, priority: t.priority,
      kpiHref: t.tile.startsWith("plan:") ? "" : t.href, kpiTile: t.tile.startsWith("plan:") ? "" : t.tile, tickets: t.tickets, sort: t.planSort,
    })));
    return NextResponse.json({ ok: true, canWrite: w.canWrite, items, subs, people: list, peopleError, choices: await choices() });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) return fail("id is missing", 400);
  const p: Partial<PlanFields> = {};
  for (const k of TEXT_FIELDS) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== "string") return fail(`${k} is text`, 400);
    p[k] = b[k] as string;
  }
  for (const k of ["start", "due"] as const) {
    if (b[k] === undefined) continue;
    if (b[k] !== null && b[k] !== "" && !(typeof b[k] === "string" && DATE.test(b[k] as string))) return fail(`${k} is a date (YYYY-MM-DD)`, 400);
    p[k] = (b[k] as string) || null;
  }
  if (b.percent !== undefined) {
    if (b.percent !== null && !(typeof b.percent === "number" && Number.isFinite(b.percent))) return fail("percent is a number 0-100", 400);
    p.percent = b.percent as number | null;
  }
  if (b.stage !== undefined) {
    if (b.stage !== null && !STAGES.some((s) => s.id === b.stage)) return fail(`stage is one of the pipeline's: ${STAGES.map((s) => s.label).join(", ")}`, 400);
    p.stage = b.stage as string | null;
  }
  if (b.priority !== undefined) {
    if (b.priority !== "" && !PRIORITIES.some((x) => x.value === b.priority)) return fail("priority is LOW, MEDIUM, HIGH or URGENT", 400);
    p.priority = b.priority as string;
  }
  for (const k of LIST_FIELDS) {
    if (b[k] === undefined) continue;
    if (!Array.isArray(b[k]) || !(b[k] as unknown[]).every((x) => typeof x === "string")) return fail(`${k} is a list of choices`, 400);
    p[k] = b[k] as string[];
  }
  if (b.dg !== undefined) p.dg = !!b.dg;
  if (b.tracked !== undefined) p.tracked = !!b.tracked;
  if (b.owners !== undefined) {
    if (!Array.isArray(b.owners)) return fail("owners is a list of HubSpot owner ids", 400);
    const want = [...new Set(b.owners.map(String).filter((x) => /^\d+$/.test(x)))];
    try {
      const known = new Map((await people()).map((o) => [o.id, o]));
      const owners = want.map((id) => known.get(id)).filter((o): o is PlanOwner => !!o);
      if (owners.length !== want.length) return fail("someone in that list is not a HubSpot user", 400);
      p.owners = owners;
    } catch (e) { return fail(`HubSpot's users could not be read: ${(e as Error).message}`, 502); }
  }
  if (p.start && p.due && p.start > p.due) return fail("the planned date comes after the go-live date", 400);
  try {
    const item = await updateItem(id, p, w.name);
    if (!item) return fail("no such row", 404);
    // a renamed row is renamed in HubSpot's choices too, and an action's ticket takes its changes (02.11.2026)
    if (p.title !== undefined || item.kind === "action") queuePlanSync(p.title !== undefined ? "row renamed" : "action changed");
    return NextResponse.json({ ok: true, item });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { action?: string; parentId?: number; kind?: string; title?: string; id?: number; target?: number; where?: string; taskId?: number };
  try {
    if (b.action === "add") {
      if (!Number.isInteger(b.parentId) || !b.title?.trim()) return fail("a new row needs where it goes and its name", 400);
      if (!["topic", "group", "action"].includes(b.kind ?? "")) return fail("kind is topic, group or action", 400);
      const item = await addItem({ parentId: b.parentId as number, kind: b.kind as PlanKind, title: b.title, by: w.name });
      queuePlanSync("row added");
      return NextResponse.json({ ok: true, item });
    }
    if (b.action === "move") {
      if (!Number.isInteger(b.id) || !Number.isInteger(b.target)) return fail("a move needs the row and where it goes", 400);
      if (b.where !== "into" && b.where !== "before") return fail("where is into or before", 400);
      const ok = await moveItem(b.id as number, b.target as number, b.where, w.name);
      if (ok) queuePlanSync("row moved");
      return ok ? NextResponse.json({ ok: true }) : fail("it cannot go there", 400);
    }
    if (b.action === "sub") {
      if (!Number.isInteger(b.id) || !Number.isInteger(b.target)) return fail("it needs the action and the one it goes under", 400);
      const task = await actionToSub(b.id as number, b.target as number, w.name);
      if (!task) return fail("only an action dropped on another action becomes its sub-action", 400);
      queuePlanSync("action made a sub-action");
      console.log(`[action-plan] ${w.name} made row ${b.id} a sub-action of ${b.target} (task ${task.id})`);
      return NextResponse.json({ ok: true, task });
    }
    if (b.action === "copysub") {
      if (!Number.isInteger(b.taskId) || !Number.isInteger(b.target)) return fail("it needs the sub-action and the action its copy goes under", 400);
      const made = await copySub(b.taskId as number, b.target as number, w.name);
      if (!made) return fail("a sub-action is duplicated onto another action", 400);
      queuePlanSync("sub-action duplicated");
      return NextResponse.json({ ok: true, task: made.task, tickets: made.tickets });
    }
    if (b.action === "unsub" || b.action === "movesub") {
      if (!Number.isInteger(b.taskId) || !Number.isInteger(b.target)) return fail("it needs the sub-action and where it goes", 400);
      if (b.action === "unsub") {
        const item = await subToAction(b.taskId as number, b.target as number, w.name);
        if (!item) return fail("only a sub-action made on the plan becomes an action, in a main category or a sub-category", 400);
        queuePlanSync("sub-action made an action");
        console.log(`[action-plan] ${w.name} made sub-action ${b.taskId} an action (row ${item.id}) in ${b.target}`);
        return NextResponse.json({ ok: true, item });
      }
      if (!(await moveSub(b.taskId as number, b.target as number, w.name))) return fail("a sub-action made on the plan moves under another action", 400);
      queuePlanSync("sub-action moved");
      return NextResponse.json({ ok: true });
    }
    if (b.action === "ordersub") {
      if (!Number.isInteger(b.taskId) || !Number.isInteger(b.target)) return fail("it needs the sub-action and the one it goes next to", 400);
      if (b.where !== "before" && b.where !== "after") return fail("where is before or after", 400);
      const done = await orderSub(b.taskId as number, b.target as number, b.where, w.name);
      if (!done) return fail("it cannot go there - the open sub-actions stay above the closed ones", 400);
      if (done === "moved") queuePlanSync("sub-action moved");
      return NextResponse.json({ ok: true, done });
    }
    return fail("action is add, move, sub, unsub, movesub, copysub or ordersub", 400);
  } catch (e) { return fail(e); }
}

export async function DELETE(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("id is missing", 400);
  try {
    const row = await itemById(id);
    if (!row) return fail("no such row", 404);
    if (row.kind === "goal") return fail("the goal stays", 400);
    const ids = await subtree(id);
    for (const x of ids) await dropPlanItem(x);
    await deleteItems(ids);
    queuePlanSync("row removed");
    console.log(`[action-plan] ${w.name} removed row ${id} (${ids.length} with what was under it)`);
    return NextResponse.json({ ok: true, removed: ids.length });
  } catch (e) { return fail(e); }
}
