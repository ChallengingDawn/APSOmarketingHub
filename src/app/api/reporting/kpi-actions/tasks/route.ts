// A tile's tasks - the actions taken to correct its KPI (SARCLA 18.10.2026): list (?tile=), add,
// change (status, owner, due, words, who it is shared with), remove. The owner and the people it is
// shared with get a mail from the hub ("share inside of the hub via mail notification").
import { NextRequest, NextResponse } from "next/server";
import { TASK_STATUSES, addTask, deleteTask, taskById, tasksOf, updateTask, type KpiTask, type SharedPerson, type TaskStatus } from "@/lib/reporting/kpiActions";
import { s2sForm } from "@/lib/reporting/scrollToSale";
import { renderTaskMail } from "@/lib/reporting/kpiTaskMail";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { fail, who, type Who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tileOk = (t: unknown): t is string => typeof t === "string" && /^[a-z0-9-]+:[^\s]{0,80}$/i.test(t);

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

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  const tile = req.nextUrl.searchParams.get("tile");
  if (!tileOk(tile)) return fail("tile is missing", 400);
  try { return NextResponse.json({ ok: true, tasks: await tasksOf(tile) }); } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { tile?: string; page?: string; title?: string; note?: string; owner?: string; ownerName?: string; due?: string; shared?: string[]; href?: string; kpi?: string; summary?: string };
  if (!tileOk(b.tile) || !b.page || !b.title?.trim()) return fail("a task needs its tile, its page and what to do", 400);
  if (b.due && !/^\d{4}-\d{2}-\d{2}$/.test(b.due)) return fail("due is a date (YYYY-MM-DD)", 400);
  try {
    const shared = await people(b.shared).catch(() => [] as SharedPerson[]);
    const t = await addTask({
      tile: b.tile, page: b.page, title: b.title.trim(), note: b.note, owner: b.owner || w.email || "", ownerName: b.ownerName || w.name, due: b.due || null,
      shared, href: typeof b.href === "string" && b.href.startsWith("/reporting/") ? b.href : "", by: w.name,
    });
    const mailed = await notify(t, w, b, true, shared);
    return NextResponse.json({ ok: true, task: t, mailed });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { id?: number; title?: string; note?: string; owner?: string; ownerName?: string; due?: string | null; status?: string; shared?: string[]; kpi?: string; summary?: string };
  if (!Number.isInteger(b.id)) return fail("id is missing", 400);
  if (b.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(b.status)) return fail("status is open, doing or done", 400);
  if (b.due && !/^\d{4}-\d{2}-\d{2}$/.test(b.due)) return fail("due is a date (YYYY-MM-DD)", 400);
  try {
    const before = await taskById(b.id as number);
    if (!before) return fail("no such task", 404);
    const shared = b.shared === undefined ? undefined : await people(b.shared);
    const t = await updateTask(b.id as number, { title: b.title, note: b.note, owner: b.owner, ownerName: b.ownerName, due: b.due, status: b.status as TaskStatus | undefined, shared });
    if (!t) return fail("no such task", 404);
    const added = (shared ?? []).filter((p) => !before.shared.some((x) => x.id === p.id));
    const mailed = await notify(t, w, b, b.owner !== undefined && b.owner !== before.owner, added);
    return NextResponse.json({ ok: true, task: t, mailed });
  } catch (e) { return fail(e); }
}

export async function DELETE(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("id is missing", 400);
  try { await deleteTask(id); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
