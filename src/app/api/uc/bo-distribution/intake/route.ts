// THE WAY IN - Back Office distribution > Way in, every ticket that enters Back Office New, run by the hub
// (src/lib/boDistribution/intake.ts, intakeRun.ts, intakeSettings.ts; SARCLA 05-07.11.2026).
// GET: since when the hub writes it, the last pass, the figures (7 days), the latest tickets, what is steered here, and
//      the people to pick from.
// PUT (admins): {mail} / {to: [ownerId]} the "❗Back Office Ticket Created" mail and who gets it (never a queue user -
//      its address is an inbox); {teams: [{team, from: [address]}]} the sender -> team list; {creators: [userId]} the
//      Back Office's own people; {waitS, emailWaitS, maxAgeMin} the waits; {reset: "teams" | "creators" | "waits"} back
//      to the defaults.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { intakeState } from "@/lib/boDistribution/intakeRun";
import { DEFAULT_INTAKE, INTAKE_BOUNDS, getIntakeSettings, intakeProblem, saveIntakeSettings, type IntakePatch } from "@/lib/boDistribution/intakeSettings";
import { BO_CREATORS, TEAMS } from "@/lib/boDistribution/intake";
import { owners } from "@/lib/certificates/engine";
import { INBOX_OWNERS } from "@/lib/notify/teamRecipients";

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
    const [state, settings, list] = await Promise.all([intakeState(), getIntakeSettings(), owners().catch(() => [])]);
    // the Back Office's own people are HubSpot USERS (hs_created_by_user_id); the owners list carries both ids
    const names: Record<string, string> = {};
    for (const o of list) names[o.id] = o.name;
    for (const o of list) if (o.userId) names[`u${o.userId}`] = o.name;
    const choices = list.filter((o) => !o.archived && !INBOX_OWNERS.has(o.id)).map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name));
    // users by their user id, named "u<id>" in names (an owner id and a user id can be the same number)
    const users = list.filter((o) => o.userId && !o.archived).map((o) => ({ id: String(o.userId), name: o.name })).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({
      configured: true, ok: true,
      data: { ...state, settings, names, choices, users, admin: access.role === "admin", defaults: { teams: TEAMS, creators: BO_CREATORS, ...DEFAULT_INTAKE }, bounds: INTAKE_BOUNDS },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as IntakePatch;
  if (b.reset !== undefined && !["teams", "creators", "waits"].includes(b.reset)) return NextResponse.json({ ok: false, error: "reset: teams, creators or waits" }, { status: 400 });
  const why = intakeProblem(b);
  if (why) return NextResponse.json({ ok: false, error: why }, { status: 400 });
  const patch: IntakePatch = {};
  for (const k of ["mail", "to", "teams", "creators", "waitS", "emailWaitS", "maxAgeMin", "reset"] as const) if (b[k] !== undefined) (patch as Record<string, unknown>)[k] = b[k];
  return NextResponse.json({ ok: true, data: await saveIntakeSettings(patch, await me(access.userId)) });
}
