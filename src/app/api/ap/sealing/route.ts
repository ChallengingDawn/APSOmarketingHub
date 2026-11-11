// SEALING BUSINESS REVIEW's figures (src/lib/apHub/sealingStore.ts): ?from=YYYY-MM&to=YYYY-MM&bu=APCH&bu=APDE&channel=...
// bu and channel (the selling organisation) may repeat - all of them when none. The months are kept within those the
// figures hold; without a period: the year so far, up to the last month the morning delivery carries.
import { NextRequest, NextResponse } from "next/server";
import { readSealing, sealingFilterOf } from "@/lib/apHub/sealingStore";
import { apHubUser } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  try {
    const f = await sealingFilterOf(req.nextUrl.searchParams);
    return NextResponse.json({ ok: true, ...(await readSealing(f)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The figures could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
