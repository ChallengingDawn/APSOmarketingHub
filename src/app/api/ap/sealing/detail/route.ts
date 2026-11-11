// SEALING BUSINESS REVIEW - one customer's articles, one article's or one compound's customers (the pilot's drawer,
// "Click an entry to inspect its available detail"): ?kind=customer|article|compound&key=...&from=&to=&bu=&channel=
// - the period and the filters as the page's own figures read them (../route.ts).
import { NextRequest, NextResponse } from "next/server";
import { readSealingDetail, sealingFilterOf } from "@/lib/apHub/sealingStore";
import { isDetailKind } from "@/lib/apHub/sealingRules";
import { apHubUser } from "../../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  const p = req.nextUrl.searchParams;
  const kind = p.get("kind");
  if (!isDetailKind(kind)) return NextResponse.json({ ok: false, error: "Ask for a customer, an article or a compound." }, { status: 400 });
  // the key as the table holds it - a customer number, an article number, a compound's name (the widest column, 200)
  const key = (p.get("key") ?? "").trim().slice(0, 200);
  try {
    const f = await sealingFilterOf(p);
    return NextResponse.json({ ok: true, detail: await readSealingDetail(f, kind, key) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The detail could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
