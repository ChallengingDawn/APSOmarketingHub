// SEALING BUSINESS REVIEW - a whole list a page at a time: every customer, article, compound or approval of the period
// and the filters ("All" in a ranking, the All tabs; SARCLA 11.11.2026: "pagination at 30"):
// ?kind=customer|article|compound|approval&by=rev|gp&q=&offset=&limit=&family=&unresolved=1&from=&to=&bu=&channel=
// - every value bound as a parameter (src/lib/apHub/sealingStore.ts readSealingList); each page kept for the same
// question on the same delivery (sealingCache), each request's time logged.
import { NextRequest, NextResponse } from "next/server";
import { readSealingList, sealingAsk } from "@/lib/apHub/sealingStore";
import { listAskOf } from "@/lib/apHub/sealingRules";
import { sealingCached } from "@/lib/apHub/sealingCache";
import { apHubUser } from "../../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  const p = req.nextUrl.searchParams;
  const ask = listAskOf(p);
  if (!ask) return NextResponse.json({ ok: false, error: "Ask for customers, articles, compounds or approvals." }, { status: 400 });
  try {
    const { f, stamp } = await sealingAsk(p);
    const { value, hit } = await sealingCached("list", stamp, { f, ask }, () => readSealingList(f, ask));
    console.log(`[sealing] list ${ask.kind} ${Date.now() - t0} ms, cache ${hit ? "hit" : "miss"}`);
    return NextResponse.json({ ok: true, list: value });
  } catch (e) {
    console.log(`[sealing] list failed after ${Date.now() - t0} ms: ${(e as Error).message}`);
    return NextResponse.json({ ok: false, error: `The list could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
