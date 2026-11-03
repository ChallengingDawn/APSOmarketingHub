// "From Scroll to Sale" beside the action plan (SARCLA 02.11.2026), admins only as the plan (../guard.ts):
//   GET  ?fresh=1                                   the pipeline 1-1, each ticket with its place in the plan
//   POST {action:"propose", ids?: [ticket ids]}     a place for each ticket not in the plan: its HubSpot plan property, else the AI's (shown
//                                                   the team's own placements), else the closest learned one; each with the places learned
//                                                   from where the team put the others, to pick from first (scrollToSaleRules.learnPlaces)
//   POST {action:"place", picks: [{ticketId, as:"sub"|"action", target}]}   the ticked ones placed (scrollToSaleBoard.place)
// Nothing is placed without a pick ("proposal first, I tick").
import { NextRequest, NextResponse } from "next/server";
import { board, place, propose, targetList } from "@/lib/reporting/scrollToSaleBoard";
import { fail } from "../../reporting/kpi-actions/guard";
import { planWho as who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  try { return NextResponse.json({ ok: true, ...(await board(req.nextUrl.searchParams.get("fresh") === "1")) }); } catch (e) { return fail(e, 502); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { action?: string; ids?: unknown; picks?: unknown };
  try {
    if (b.action === "propose") {
      const ids = Array.isArray(b.ids) ? b.ids.map(String).filter((x) => /^\d+$/.test(x)).slice(0, 300) : [];
      const [proposals, targets] = await Promise.all([propose(ids), targetList()]);
      return NextResponse.json({ ok: true, proposals, targets });
    }
    if (b.action === "place") {
      if (!Array.isArray(b.picks) || !b.picks.length) return fail("nothing ticked to place", 400);
      const picks = (b.picks as { ticketId?: unknown; as?: unknown; target?: unknown }[])
        .filter((x) => /^\d+$/.test(String(x.ticketId)) && (x.as === "sub" || x.as === "action") && Number.isInteger(x.target))
        .map((x) => ({ ticketId: String(x.ticketId), as: x.as as "sub" | "action", target: x.target as number })).slice(0, 300);
      if (!picks.length) return fail("each pick is a ticket, sub or action, and where it goes", 400);
      return NextResponse.json({ ok: true, ...(await place(picks, w.name)) });
    }
    return fail("action is propose or place", 400);
  } catch (e) { return fail(e, 502); }
}
