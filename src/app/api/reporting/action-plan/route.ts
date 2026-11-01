// The action plan (SARCLA 31.10.2026), behind Advanced reporting's grant like the KPI tiles' toolbar:
//   GET                                          every row, every sub-action, whether you may change them
//   PATCH {id, ...fields}                        a row's fields (dates, % complete, state, who, words, Digital Growth)
//   POST  {action:"add", parentId, kind, title}  a new topic, group or action
//   POST  {action:"move", id, target, where}     drag and drop: "into" a topic or group, or "before" a row
//   DELETE ?id=                                  a row and what is under it; its own sub-actions go too
import { NextRequest, NextResponse } from "next/server";
import { addItem, deleteItems, itemById, moveItem, planItems, subtree, updateItem } from "@/lib/reporting/actionPlan";
import { PLAN_STATES, type PlanFields, type PlanKind, type PlanSub } from "@/lib/reporting/actionPlanRules";
import { dropPlanItem, planTasks } from "@/lib/reporting/kpiActions";
import { fail, who } from "../kpi-actions/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_FIELDS = ["title", "detail", "priority", "responsible", "referent", "status", "result", "mainTopic", "perimeter", "expected", "codeFreeze", "complexity", "release", "dueNote"] as const;

export async function GET() {
  const w = await who();
  if (w instanceof NextResponse) return w;
  try {
    const [items, tasks] = await Promise.all([planItems(), planTasks()]);
    const ids = new Set(items.map((i) => i.id));
    const subs: PlanSub[] = tasks.filter((t) => t.planItem != null && ids.has(t.planItem)).map((t) => ({
      id: t.id, item: t.planItem as number, title: t.title, ownerName: t.ownerName, due: t.due, status: t.status,
      kpiHref: t.tile.startsWith("plan:") ? "" : t.href, kpiTile: t.tile.startsWith("plan:") ? "" : t.tile, tickets: t.tickets,
    }));
    return NextResponse.json({ ok: true, canWrite: w.canWrite, items, subs });
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
  if (b.state !== undefined) {
    if (b.state !== null && !(PLAN_STATES as readonly unknown[]).includes(b.state)) return fail(`state is one of ${PLAN_STATES.join(", ")}`, 400);
    p.state = b.state as PlanFields["state"];
  }
  if (b.dg !== undefined) p.dg = !!b.dg;
  if (p.start && p.due && p.start > p.due) return fail("the start comes after the due date", 400);
  try {
    const item = await updateItem(id, p, w.name);
    if (!item) return fail("no such row", 404);
    return NextResponse.json({ ok: true, item });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { action?: string; parentId?: number; kind?: string; title?: string; id?: number; target?: number; where?: string };
  try {
    if (b.action === "add") {
      if (!Number.isInteger(b.parentId) || !b.title?.trim()) return fail("a new row needs where it goes and its name", 400);
      if (!["topic", "group", "action"].includes(b.kind ?? "")) return fail("kind is topic, group or action", 400);
      const item = await addItem({ parentId: b.parentId as number, kind: b.kind as PlanKind, title: b.title, by: w.name });
      return NextResponse.json({ ok: true, item });
    }
    if (b.action === "move") {
      if (!Number.isInteger(b.id) || !Number.isInteger(b.target)) return fail("a move needs the row and where it goes", 400);
      if (b.where !== "into" && b.where !== "before") return fail("where is into or before", 400);
      const ok = await moveItem(b.id as number, b.target as number, b.where, w.name);
      return ok ? NextResponse.json({ ok: true }) : fail("it cannot go there", 400);
    }
    return fail("action is add or move", 400);
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
    console.log(`[action-plan] ${w.name} removed row ${id} (${ids.length} with what was under it)`);
    return NextResponse.json({ ok: true, removed: ids.length });
  } catch (e) { return fail(e); }
}
