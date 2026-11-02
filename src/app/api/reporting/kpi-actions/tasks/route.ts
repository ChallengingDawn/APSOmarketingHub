// A tile's tasks - the actions taken to correct its KPI (SARCLA 18.10.2026): list (?tile=), add,
// change (status, owner, due, words, who it is shared with), remove. The owner and the people it is
// shared with get a mail from the hub ("share inside of the hub via mail notification"). A sub-action of the action
// plan is a small action too (01.11.2026): a stage of the pipeline (open / doing / done follow it), a priority, a planned date,
// and a status note (02.11.2026).
import { NextRequest, NextResponse } from "next/server";
import { TASK_STATUSES, addTask, deleteTask, taskById, tasksOf, updateTask, type KpiTask, type SharedPerson, type TaskStatus } from "@/lib/reporting/kpiActions";
import { itemById, startMains, startedBySub } from "@/lib/reporting/actionPlan";
import { queuePlanSync } from "@/lib/reporting/actionPlanHubspot";
import { s2sForm } from "@/lib/reporting/scrollToSale";
import { IDEA, PRIORITIES, STAGES } from "@/lib/reporting/actionPlanRules";
import { renderTaskMail } from "@/lib/reporting/kpiTaskMail";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { fail, whoForTile, type Who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tileOk = (t: unknown): t is string => typeof t === "string" && /^[a-z0-9-]+:[^\s]{0,80}$/i.test(t);
const isDay = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
/** A sub-action as a small action: a stage of the pipeline (or "" for none), HubSpot's priority (or ""), a planned date. */
function smallAction(b: { stage?: unknown; priority?: unknown; start?: unknown; statusNote?: unknown }): string | null {
  if (b.statusNote !== undefined && typeof b.statusNote !== "string") return "the status note is a text";
  if (b.stage !== undefined && b.stage !== null && b.stage !== "" && !STAGES.some((x) => x.id === b.stage)) return "stage is one of the pipeline's stages";
  if (b.priority !== undefined && b.priority !== "" && !PRIORITIES.some((x) => x.value === b.priority)) return "priority is LOW, MEDIUM, HIGH or URGENT";
  if (b.start !== undefined && b.start !== null && b.start !== "" && !isDay(b.start)) return "start is a date (YYYY-MM-DD)";
  return null;
}

/** HubSpot owners by id, as the task keeps them - only ids HubSpot knows. */
async function people(ids: unknown): Promise<SharedPerson[]> {
  const want = Array.isArray(ids) ? [...new Set(ids.map(String).filter((x) => /^\d+$/.test(x)))].slice(0, 30) : [];
  if (!want.length) return [];
  const form = await s2sForm();
  return want.flatMap((id) => {
    const o = form.owners.find((x) => x.id === id);
    return o ? [{ id: o.id, userId: o.userId, name: o.name, email: o.email }] : [];
  });
}

/** The owner (when not the asker) and the newly shared get a mail; a failed mail never fails the change. */
async function notify(t: KpiTask, w: Who, b: { kpi?: string; summary?: string }, newOwner: boolean, newlyShared: SharedPerson[]): Promise<number> {
  if (!mailConfigured()) return 0;
  const me = (w.email ?? "").toLowerCase();
  const form = await s2sForm().catch(() => null);
  const owner = newOwner && t.owner ? form?.owners.find((o) => o.id === t.owner) : undefined;
  const to: { p: { name: string; email: string }; role: "owner" | "shared" }[] = [];
  if (owner?.email && owner.email !== me) to.push({ p: owner, role: "owner" });
  for (const p of newlyShared) if (p.email && p.email !== me && !to.some((x) => x.p.email === p.email)) to.push({ p, role: "shared" });
  let sent = 0;
  for (const { p, role } of to) {
    try {
      const mail = renderTaskMail({ task: t, kpi: b.kpi || t.page, summary: b.summary, byName: w.name, toName: p.name.split(" ")[0] || p.name, role });
      await sendHubMail({ to: p.email, ...mail, fromName: `${w.name} via APSOhub`, replyTo: w.email ?? undefined });
      sent += 1;
    } catch (e) {
      console.warn(`[kpi-actions] task ${t.id}: mail to ${p.email} failed: ${(e as Error).message}`);
    }
  }
  return sent;
}

/** The action plan's action a task is linked to: an action that exists, null to unlink, undefined to leave it. */
async function planLink(v: unknown): Promise<number | null | undefined | false> {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) return false;
  const row = await itemById(id);
  return row?.kind === "action" ? id : false;
}

// The tile decides whose rule applies: an action of the plan answers to the plan's (guard.ts whoForTile).
export async function GET(req: NextRequest) {
  const tile = req.nextUrl.searchParams.get("tile");
  const w = await whoForTile(tile);
  if (w instanceof NextResponse) return w;
  if (!tileOk(tile)) return fail("tile is missing", 400);
  try { return NextResponse.json({ ok: true, tasks: await tasksOf(tile) }); } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { tile?: string; page?: string; title?: string; note?: string; owner?: string; ownerName?: string; due?: string; shared?: string[]; href?: string; kpi?: string; summary?: string; planItem?: number | null; stage?: string | null; priority?: string; start?: string | null; statusNote?: string };
  const w = await whoForTile(b.tile, true);
  if (w instanceof NextResponse) return w;
  if (!tileOk(b.tile) || !b.page || !b.title?.trim()) return fail("a task needs its tile, its page and what to do", 400);
  if (b.due && !/^\d{4}-\d{2}-\d{2}$/.test(b.due)) return fail("due is a date (YYYY-MM-DD)", 400);
  const bad = smallAction(b);
  if (bad) return fail(bad, 400);
  try {
    // a KPI tile's task can be a sub-action of the action plan too (SARCLA 31.10.2026)
    const plan = await planLink(b.planItem);
    if (plan === false) return fail("that action is not in the action plan", 400);
    const shared = await people(b.shared).catch(() => [] as SharedPerson[]);
    const t = await addTask({
      tile: b.tile, page: b.page, title: b.title.trim(), note: b.note, owner: b.owner || w.email || "", ownerName: b.ownerName || w.name, due: b.due || null,
      shared, href: typeof b.href === "string" && (b.href.startsWith("/reporting/") || b.href.startsWith("/action-plan")) ? b.href : "", planItem: plan ?? null,
      stage: b.stage || null, priority: b.priority ?? "", start: b.start || null, statusNote: b.statusNote ?? "", by: w.name,
    });
    // a sub-action made in an action puts the action under way (SARCLA 02.11.2026), its ticket following
    if (t.planItem != null) {
      const a = await itemById(t.planItem);
      if (a && (!a.stage || a.stage === IDEA)) { await startedBySub(a.id, w.name); queuePlanSync("its action under way"); }
    }
    const mailed = await notify(t, w, b, true, shared);
    return NextResponse.json({ ok: true, task: t, mailed });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { id?: number; title?: string; note?: string; owner?: string; ownerName?: string; due?: string | null; status?: string; shared?: string[]; kpi?: string; summary?: string; planItem?: number | null; stage?: string | null; priority?: string; start?: string | null; statusNote?: string };
  if (!Number.isInteger(b.id)) return fail("id is missing", 400);
  const bad = smallAction(b);
  if (bad) return fail(bad, 400);
  if (b.title !== undefined && !b.title.trim()) return fail("a task needs what to do", 400);
  if (b.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(b.status)) return fail("status is open, doing or done", 400);
  if (b.due && !/^\d{4}-\d{2}-\d{2}$/.test(b.due)) return fail("due is a date (YYYY-MM-DD)", 400);
  try {
    const before = await taskById(b.id as number);
    const w = await whoForTile(before?.tile, true);
    if (w instanceof NextResponse) return w;
    if (!before) return fail("no such task", 404);
    const plan = await planLink(b.planItem);
    if (plan === false) return fail("that action is not in the action plan", 400);
    // a sub-action made on the plan belongs to its action for good; a KPI tile's task can be linked or unlinked
    if (plan !== undefined && before.tile.startsWith("plan:")) return fail("this sub-action was made on its action", 400);
    const shared = b.shared === undefined ? undefined : await people(b.shared);
    const t = await updateTask(b.id as number, {
      title: b.title?.trim(), note: b.note, owner: b.owner, ownerName: b.ownerName, due: b.due, status: b.status as TaskStatus | undefined, shared, planItem: plan,
      stage: b.stage === undefined ? undefined : b.stage || null, priority: b.priority, start: b.start === undefined ? undefined : b.start || null,
      statusNote: b.statusNote,
    });
    if (!t) return fail("no such task", 404);
    // tied to another action: its tickets take that action's place in HubSpot
    if (plan !== undefined && plan !== before.planItem) queuePlanSync("sub-action moved");
    // a sub-action of the plan: its ticket takes the change (SARCLA 02.11.2026)
    else if (t.planItem != null) queuePlanSync("sub-action changed");
    if (t.planItem != null && b.stage !== undefined) await startMains([t], w.name);
    const added = (shared ?? []).filter((p) => !before.shared.some((x) => x.id === p.id));
    const mailed = await notify(t, w, b, b.owner !== undefined && b.owner !== before.owner, added);
    return NextResponse.json({ ok: true, task: t, mailed });
  } catch (e) { return fail(e); }
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("id is missing", 400);
  try {
    const task = await taskById(id);
    const w = await whoForTile(task?.tile, true);
    if (w instanceof NextResponse) return w;
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
