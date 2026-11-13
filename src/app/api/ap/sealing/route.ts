// SEALING BUSINESS REVIEW's figures (src/lib/apHub/sealingStore.ts): ?from=YYYY-MM&to=YYYY-MM&bu=APCH&bu=APDE&channel=...
// bu and channel (the selling organisation) may repeat - all of them when none. The months are kept within those the
// figures hold; without a period: the year so far, up to the last month the morning delivery carries. Each answer is
// kept for the same question on the same delivery (sealingCache), and every request logs its time (CloudWatch).
import { NextRequest, NextResponse } from "next/server";
import { readSealing, sealingAsk } from "@/lib/apHub/sealingStore";
import { sealingCached } from "@/lib/apHub/sealingCache";
import { apHubUser } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  try {
    const { f, stamp } = await sealingAsk(req.nextUrl.searchParams);
    const { value, hit } = await sealingCached("overview", stamp, f, () => readSealing(f));
    console.log(`[sealing] overview ${Date.now() - t0} ms, cache ${hit ? "hit" : "miss"}`);
    return NextResponse.json({ ok: true, ...value });
  } catch (e) {
    console.log(`[sealing] overview failed after ${Date.now() - t0} ms: ${(e as Error).message}`);
    return NextResponse.json({ ok: false, error: `The figures could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
