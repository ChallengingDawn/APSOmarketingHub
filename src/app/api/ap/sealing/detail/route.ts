// SEALING BUSINESS REVIEW - one customer's articles, one article's or one compound's customers (the pilot's drawer,
// "Click an entry to inspect its available detail"): ?kind=customer|article|compound&key=...&from=&to=&bu=&channel=
// - the period and the filters as the page's own figures read them (../route.ts); each detail kept for the same question
// on the same delivery (sealingCache), each request's time logged.
import { NextRequest, NextResponse } from "next/server";
import { readSealingDetail, sealingAsk } from "@/lib/apHub/sealingStore";
import { isDetailKind } from "@/lib/apHub/sealingRules";
import { sealingCached } from "@/lib/apHub/sealingCache";
import { apHubUser } from "../../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  const p = req.nextUrl.searchParams;
  const kind = p.get("kind");
  if (!isDetailKind(kind)) return NextResponse.json({ ok: false, error: "Ask for a customer, an article or a compound." }, { status: 400 });
  // the key as the table holds it - a customer number, an article number, a compound's name (the widest column, 200)
  const key = (p.get("key") ?? "").trim().slice(0, 200);
  try {
    const { f, stamp } = await sealingAsk(p);
    const { value, hit } = await sealingCached("detail", stamp, { f, kind, key }, () => readSealingDetail(f, kind, key));
    console.log(`[sealing] detail ${kind} ${Date.now() - t0} ms, cache ${hit ? "hit" : "miss"}`);
    return NextResponse.json({ ok: true, detail: value });
  } catch (e) {
    console.log(`[sealing] detail failed after ${Date.now() - t0} ms: ${(e as Error).message}`);
    return NextResponse.json({ ok: false, error: `The detail could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
