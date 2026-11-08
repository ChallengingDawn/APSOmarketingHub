// THE CONTENT BOARD (SARCLA 07.11.2026: "this should look like a collaborative project"): every project this person may
// open, with its stage (where its pieces are), its pieces in short and its people; and what waits for them - reviews
// asked of them, pieces they write, where they were tagged this week.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { boardFor, waitingFor } from "@/lib/content/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await requireUser();
  const [board, waiting] = await Promise.all([boardFor(me), waitingFor(me)]);
  const names = new Set<string>([me.username]);
  for (const p of board) for (const u of p.team) names.add(u);
  for (const w of waiting) if (w.by) names.add(w.by);
  const r = await query<{ username: string; full_name: string | null }>(
    `SELECT username, full_name FROM apsomh_users WHERE username = ANY($1::text[])`, [[...names]]);
  const people = Object.fromEntries(r.rows.map((u) => [u.username, u.full_name || u.username]));
  return NextResponse.json({ ok: true, me: me.username, board, waiting, people });
}
