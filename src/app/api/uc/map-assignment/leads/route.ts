// The ESO line managers' teams (SARCLA 25.10.2026: a "line manager" column on Map assignment's SAE table, for the ESO
// Figures' team switch; 26.10: "a panel to change the teams' names, or to delete and add more teams"). Read by Map
// assignment (UC) and by the ESO Figures (Advanced reporting); changed by an admin, as the rules.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getLeads, getTeams, saveTeams, setLead } from "@/lib/mapAssign/leads";
import { isTeamId, leadsByName } from "@/lib/mapAssign/leadsRules";
import { ownerNames } from "@/lib/integrations/erosion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc") && !access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const teams = await getTeams();
    const leads = await getLeads(teams);
    // by name too: the reports know a person by the name the cube carries
    const byName = leadsByName(leads, await ownerNames().catch(() => new Map<string, string>()));
    return NextResponse.json({ ok: true, teams, leads, byName, admin: access.role === "admin" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

/** { ownerId, lead } puts a person in a team (lead null: in none); { teams } saves the teams as listed. */
export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { ownerId?: unknown; lead?: unknown; teams?: unknown };
  try {
    if (b.teams !== undefined) return NextResponse.json({ ok: true, ...(await saveTeams(b.teams)) });
    const ownerId = String(b.ownerId ?? "").trim();
    if (!/^\d+$/.test(ownerId)) return NextResponse.json({ ok: false, error: "the person is missing" }, { status: 400 });
    if (b.lead != null && b.lead !== "" && !isTeamId(b.lead)) return NextResponse.json({ ok: false, error: "that team does not exist" }, { status: 400 });
    const leads = await setLead(ownerId, isTeamId(b.lead) ? b.lead : null);
    return NextResponse.json({ ok: true, leads });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 400 });
  }
}
