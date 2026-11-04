// CERTIFICATES - UC & HubSpot Apps > Certificates (src/lib/certificates). Replaces the HubSpot workflow "SARCLA |
// CERTIFICATES NEW PROCESS", SARCLA 04.11.2026.
// GET: the mode, the people, the last look, the open tickets with their step, what the hub did (or would do), the year.
// PUT (admins) {mode} or {people}: off / preview (lists, writes nothing) / live (writes while the workflow is off);
//      the Back Office rotation, the conformity experts, who gets a ticket after 15 days.
// POST (admins) {action: "run"} = look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, type Mode } from "@/lib/certificates/engine";
import type { People } from "@/lib/certificates/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function me(userId: number): Promise<string> {
  const r = await query<{ full_name: string | null; username: string | null }>(`SELECT full_name, username FROM apsomh_users WHERE id = $1`, [userId]).catch(() => ({ rows: [] }));
  const u = r.rows[0];
  return u?.full_name?.trim() || u?.username || `user ${userId}`;
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ configured: true, ok: true, data: { ...(await pageState()), admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= 12 && v.every((x) => typeof x === "string" && /^\d+$/.test(x));

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; people?: Partial<People> };
  if (b.mode !== undefined && !["off", "preview", "live"].includes(b.mode)) return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  let people: Partial<People> | undefined;
  if (b.people !== undefined) {
    people = {};
    if (b.people.backOffice !== undefined) { if (!isIds(b.people.backOffice)) return NextResponse.json({ ok: false, error: "Back Office rotation: at least one owner" }, { status: 400 }); people.backOffice = b.people.backOffice; }
    if (b.people.experts !== undefined) { if (!isIds(b.people.experts)) return NextResponse.json({ ok: false, error: "Conformity experts: at least one owner" }, { status: 400 }); people.experts = b.people.experts; }
    if (b.people.escalation !== undefined) { if (!/^\d+$/.test(String(b.people.escalation))) return NextResponse.json({ ok: false, error: "After 15 days: one owner" }, { status: 400 }); people.escalation = String(b.people.escalation); }
  }
  return NextResponse.json({ ok: true, data: await saveSettings({ mode: b.mode, people }, await me(access.userId)) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (b.action === "run") {
      const info = await runOnce();
      return NextResponse.json(info ? { ok: true, data: info } : { ok: false, error: "Not run - switched off, or a look is running" });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
