// Retain & grow: the erosion at stake (src/lib/marketingKpis/retain.ts), and what was done about it - the erosion
// tickets per customer and article (SARCLA 20.10.2026: "look at the erosion Excel" - its Resp. action, Action and
// Result columns). Advanced reporting's grant to read.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { retainData } from "@/lib/marketingKpis/retain";
import { fetchErosionTickets } from "@/lib/integrations/erosion";
import { isClosed, isWon, outcomeLabel } from "@/lib/erosion/model";
import type { RetainAction } from "@/lib/marketingKpis/retainCube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The erosion tickets, as the page needs them; none (and the reason) when HubSpot does not answer. */
async function actions(): Promise<{ actions: RetainAction[]; actionsError: string | null }> {
  try {
    const t = await fetchErosionTickets();
    return {
      actions: t.tickets.filter((x) => x.un).map((x) => ({
        id: x.id, un: x.un!, articles: (x.article ?? "").split(/[,;]\s*/).map((a) => a.trim()).filter(Boolean),
        created: x.created, closed: x.closed, result: isClosed(x) ? outcomeLabel(x) : x.stage, won: isWon(x), open: !isClosed(x), owner: x.owner,
      })),
      actionsError: null,
    };
  } catch (e) {
    return { actions: [], actionsError: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [retain, a] = await Promise.all([retainData(), actions()]);
    return NextResponse.json({ ok: true, retain, ...a });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
