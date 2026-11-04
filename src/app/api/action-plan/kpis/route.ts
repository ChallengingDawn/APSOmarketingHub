// The action plan's KPIs (SARCLA 04.11.2026: "promoted here with a defined target; then a toggle Target complete | Still
// running | Late") - admins, as the plan (../guard.ts):
//   GET                                        every KPI on the plan, and the targets they are measured against
//   POST  {action:"promote", key, page, team, title, href, targetKey, unit, summary, view}
//                                              a tile from its Actions window - its target must be saved
//   POST  {action:"demote", key}               off the plan
//   PATCH {key, status}                        Target complete | Still running | Late
//   PATCH {key, summary, view}                 its words as its tile drew them just now, in the view it was promoted in
import { NextRequest, NextResponse } from "next/server";
import { demoteKpi, planKpis, promoteKpi, refreshKpiSummary, setKpiStatus } from "@/lib/reporting/planKpis";
import { isPlanKpiStatus, isPlanKpiTeam } from "@/lib/reporting/planKpiTeams";
import { fail } from "../../reporting/kpi-actions/guard";
import { planWho as who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = /^[a-z0-9-]+:[^\s]{1,150}$/i;
const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

export async function GET() {
  const w = await who();
  if (w instanceof NextResponse) return w;
  try { return NextResponse.json({ ok: true, ...(await planKpis()) }); } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = str(b.key, 200);
  if (!KEY.test(key)) return fail("the tile is missing", 400);
  try {
    if (b.action === "demote") { await demoteKpi(key); return NextResponse.json({ ok: true }); }
    if (b.action !== "promote") return fail("action is promote or demote", 400);
    if (!isPlanKpiTeam(b.team)) return fail("team is one of the plan's KPI teams", 400);
    const targetKey = str(b.targetKey, 200);
    if (!KEY.test(targetKey)) return fail("the target's key is missing", 400);
    const unit = b.unit === "eur" || b.unit === "pct" ? b.unit : "n";
    const href = str(b.href, 600);
    await promoteKpi({
      key, page: str(b.page, 80) || key.split(":")[0], team: b.team, title: str(b.title, 200) || key,
      href: href.startsWith("/") ? href : "", targetKey, unit, summary: str(b.summary, 400), view: str(b.view, 2000),
    }, w.name);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e, /target first/.test(String((e as Error)?.message)) ? 400 : 500); }
}

export async function PATCH(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = str(b.key, 200);
  if (!KEY.test(key)) return fail("the tile is missing", 400);
  try {
    if (b.status !== undefined) {
      if (!isPlanKpiStatus(b.status)) return fail("status is complete, running or late", 400);
      return (await setKpiStatus(key, b.status)) ? NextResponse.json({ ok: true }) : fail("that KPI is not on the plan", 404);
    }
    const summary = str(b.summary, 400);
    if (!summary) return fail("status or summary", 400);
    return NextResponse.json({ ok: true, changed: await refreshKpiSummary(key, summary, str(b.view, 2000)) });
  } catch (e) { return fail(e); }
}
