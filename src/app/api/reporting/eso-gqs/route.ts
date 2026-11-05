// THE GQS TAB OF THE INCOMING TICKETS PAGE (SARCLA 05.11.2026: "another tab on ESO and Sales leader on customer tickets ...
// to show the results of GQS to the sales leader, and to be able to report it also on my reports"): every GQS task the
// Back-Office report keeps (boReport.ts gqsTasksNow - read again when an hour old), the fields the tab draws only
// (esoGqs.ts), and the people on them - the requesters, their line managers, the Back Office - with their names and their
// team (the rosters, else their HubSpot team, as the tickets read). Advanced reporting's own grant, like the tickets page.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { gqsTasksNow } from "@/lib/reporting/boReport";
import { slimTask, type EsoGqs } from "@/lib/reporting/esoGqs";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const { kept, counting } = await gqsTasksNow();
    if (!kept) return NextResponse.json({ ok: true, value: null, counting });
    const names = await ownerNames().catch(() => new Map<string, string>());
    const hsTeam = new Map<string, string>();
    try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
    const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
    const ids = new Set(kept.tasks.flatMap((t) => [t.rq, t.lm, t.o]).filter((x): x is string => !!x));
    const value: EsoGqs = {
      at: kept.at, tasks: kept.tasks.map(slimTask),
      people: Object.fromEntries([...ids].map((id) => [id, { name: names.get(id) ?? `Owner ${id}`, team: teamFor(id) }])),
    };
    return NextResponse.json({ ok: true, value, counting });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
