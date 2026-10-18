// A tile's tasks - the actions taken to correct its KPI (SARCLA 18.10.2026): list (?tile=), add,
// change (status, owner, due, words), remove.
import { NextRequest, NextResponse } from "next/server";
import { TASK_STATUSES, addTask, deleteTask, tasksOf, updateTask, type TaskStatus } from "@/lib/reporting/kpiActions";
import { fail, who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tileOk = (t: unknown): t is string => typeof t === "string" && /^[a-z0-9-]+:[^\s]{0,80}$/i.test(t);

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
  const b = (await req.json().catch(() => ({}))) as { tile?: string; page?: string; title?: string; note?: string; owner?: string; ownerName?: string; due?: string };
  if (!tileOk(b.tile) || !b.page || !b.title?.trim()) return fail("a task needs its tile, its page and what to do", 400);
  if (b.due && !/^\d{4}-\d{2}-\d{2}$/.test(b.due)) return fail("due is a date (YYYY-MM-DD)", 400);
  try {
    const t = await addTask({ tile: b.tile, page: b.page, title: b.title.trim(), note: b.note, owner: b.owner || w.email || "", ownerName: b.ownerName || w.name, due: b.due || null, by: w.name });
    return NextResponse.json({ ok: true, task: t });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { id?: number; title?: string; note?: string; owner?: string; ownerName?: string; due?: string | null; status?: string };
  if (!Number.isInteger(b.id)) return fail("id is missing", 400);
  if (b.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(b.status)) return fail("status is open, doing or done", 400);
  if (b.due && !/^\d{4}-\d{2}-\d{2}$/.test(b.due)) return fail("due is a date (YYYY-MM-DD)", 400);
  try {
    const t = await updateTask(b.id as number, { title: b.title, note: b.note, owner: b.owner, ownerName: b.ownerName, due: b.due, status: b.status as TaskStatus | undefined });
    return t ? NextResponse.json({ ok: true, task: t }) : fail("no such task", 404);
  } catch (e) { return fail(e); }
}

export async function DELETE(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("id is missing", 400);
  try { await deleteTask(id); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
