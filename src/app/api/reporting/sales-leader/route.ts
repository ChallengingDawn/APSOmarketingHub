// SALES LEADER REPORTS: the teams - every sales leader's (Settings > Hierarchy: tagged Sales leader, and everyone under
// them) and the one of the person asking - and each of their people's targets (SARCLA 02.11.2026: "the table for overall
// and for its team on the targets first page"). The figures are the ESO reports' own reads, drawn by the pages. Read
// only: the targets are set in My Sales Reports, by the person or an admin.
//
// An admin previewing someone (View as, ?as=<hub user id>) is answered as that person.

import { NextRequest, NextResponse } from "next/server";
import { myAccess, type MyAccess } from "@/lib/auth/appAccess";
import { accessAt } from "@/lib/auth/tree";
import { hierarchyNow } from "@/lib/hierarchy/store";
import { leaderTeams, myTeam } from "@/lib/reporting/salesLeaderRules";
import { asking, readManyTargets } from "@/lib/reporting/mySalesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES = ["targets", "team"].map((p) => `/reporting/sales-leader/${p}`);
const opens = (a: MyAccess, href: string) => accessAt(href, a.levels).level !== "none";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PAGES.some((p) => opens(access, p))) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const who = await asking(access, req.nextUrl.searchParams.get("as"));
    const year = new Date().getUTCFullYear();
    const h = await hierarchyNow();
    const email = (who.email ?? "").trim().toLowerCase();
    const mine = email ? h.people.find((p) => p.active && p.email?.toLowerCase() === email) ?? h.people.find((p) => p.email?.toLowerCase() === email) : undefined;
    const me = mine ? { id: mine.id, name: mine.name } : null;
    const teams = leaderTeams(h.people, h.placed);
    const team = myTeam(me, h.people, h.placed);
    const ids = [...teams.flatMap((t) => t.people.map((p) => p.id)), ...(team?.people ?? []).map((p) => p.id)];
    return NextResponse.json({ ok: true, year, me, previewing: who.previewing, mine: team, teams, targets: await readManyTargets(year, ids) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
