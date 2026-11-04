// GQS APPROVALS - Back Office distribution > GQS > Approvals (src/lib/gqsApprovals). Replaces the HubSpot workflow
// "SARCLA | GQS Ticket Created by Sales", SARCLA 04.11.2026.
// GET: the mode, the rule, the last look, the requests the hub looked at, the year's requests and how they were decided,
//      and which line managers the signed-in person decides for.
// PUT (admins) {mode} or {limits}: off / shadow (works it out, writes nothing) / live (writes once the workflow is off);
//      the rule's limits.
// POST {action: "decide", ticketId, approve}: Approve / Refuse a waiting request - its line manager or an admin.
// POST (admins) {action: "run"} = look now, {action: "history"} = read the year again.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { approverIdsOf, decideRequest, pageState, readHistory, runOnce, saveSettings, type Mode } from "@/lib/gqsApprovals/engine";
import type { Limits } from "@/lib/gqsApprovals/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function me(userId: number): Promise<{ name: string; email: string | null }> {
  const r = await query<{ full_name: string | null; username: string | null; email: string | null }>(`SELECT full_name, username, email FROM apsomh_users WHERE id = $1`, [userId]).catch(() => ({ rows: [] }));
  const u = r.rows[0];
  return { name: u?.full_name?.trim() || u?.username || `user ${userId}`, email: u?.email ?? null };
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [s, who] = await Promise.all([pageState(), me(access.userId)]);
    const decidesFor = access.role === "admin" ? "any" : await approverIdsOf(who.email).catch(() => [] as string[]);
    return NextResponse.json({ configured: true, ok: true, data: { ...s, admin: access.role === "admin", decidesFor } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

const LIMIT_KEYS: (keyof Limits)[] = ["bigFrom", "smallUpTo", "smallMargin", "midFrom", "midTo", "midMargin", "liquidation"];

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; limits?: Partial<Limits> };
  if (b.mode !== undefined && !["off", "shadow", "live"].includes(b.mode)) return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  let limits: Partial<Limits> | undefined;
  if (b.limits !== undefined) {
    limits = {};
    for (const k of LIMIT_KEYS) {
      const v = (b.limits as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (k === "liquidation") { if (typeof v !== "boolean") return NextResponse.json({ ok: false, error: "liquidation is yes or no" }, { status: 400 }); limits.liquidation = v; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || ((k === "smallMargin" || k === "midMargin") && n > 1)) return NextResponse.json({ ok: false, error: `${k}: not a valid number` }, { status: 400 });
      (limits as Record<string, number>)[k] = n;
    }
  }
  const who = await me(access.userId);
  return NextResponse.json({ ok: true, data: await saveSettings({ mode: b.mode, limits }, who.name) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; ticketId?: string; approve?: boolean };
  try {
    if (b.action === "decide") {
      if (!/^\d+$/.test(String(b.ticketId ?? "")) || typeof b.approve !== "boolean") return NextResponse.json({ ok: false, error: "ticketId and approve" }, { status: 400 });
      const who = await me(access.userId);
      const mayFor = access.role === "admin" ? "any" : await approverIdsOf(who.email);
      if (mayFor !== "any" && !mayFor.length) return NextResponse.json({ ok: false, error: "Only a line manager or an admin decides" }, { status: 403 });
      const r = await decideRequest(String(b.ticketId), b.approve, who.name, mayFor);
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.why });
    }
    if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
    if (b.action === "run") {
      const info = await runOnce();
      return NextResponse.json(info ? { ok: true, data: info } : { ok: false, error: "Not run - switched off, or a look is running" });
    }
    if (b.action === "history") return NextResponse.json({ ok: true, data: { at: (await readHistory()).at } });
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
