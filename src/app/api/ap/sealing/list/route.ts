// SEALING BUSINESS REVIEW - a whole list a page at a time: every customer, article, compound or approval of the period
// and the filters ("All" in a ranking, the All tabs; SARCLA 11.11.2026: "pagination at 30"):
// ?kind=customer|article|compound|approval&by=rev|gp&q=&offset=&limit=&family=&unresolved=1&from=&to=&bu=&channel=
// - every value bound as a parameter (src/lib/apHub/sealingStore.ts readSealingList).
import { NextRequest, NextResponse } from "next/server";
import { readSealingList, sealingFilterOf } from "@/lib/apHub/sealingStore";
import { listAskOf } from "@/lib/apHub/sealingRules";
import { apHubUser } from "../../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  const p = req.nextUrl.searchParams;
  const ask = listAskOf(p);
  if (!ask) return NextResponse.json({ ok: false, error: "Ask for customers, articles, compounds or approvals." }, { status: 400 });
  try {
    const f = await sealingFilterOf(p);
    return NextResponse.json({ ok: true, list: await readSealingList(f, ask) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The list could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
