// SEALING BUSINESS REVIEW's figures (src/lib/apHub/sealingStore.ts): ?from=YYYY-MM&to=YYYY-MM&bu=APCH&bu=APDE&channel=...
// bu and channel (the selling organisation) may repeat - all of them when none. The months are kept within those the
// figures hold; without a period: the year so far, up to the last month the morning delivery carries.
import { NextRequest, NextResponse } from "next/server";
import { readSealing, ensureSealingTable } from "@/lib/apHub/sealingStore";
import { sealingPeriod } from "@/lib/apHub/sealingRules";
import { query } from "@/lib/db/client";
import { apHubUser } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The values of a repeated parameter, trimmed, each cut to the column's width. */
const many = (p: URLSearchParams, key: string, width: number) =>
  [...new Set(p.getAll(key).map((x) => x.trim().slice(0, width)).filter(Boolean))].slice(0, 40);

export async function GET(req: NextRequest) {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  try {
    await ensureSealingTable();
    const p = req.nextUrl.searchParams;
    const held = (await query<{ first_month: string | null; last_month: string | null }>(
      `SELECT first_month, last_month FROM apsomh_ap_sealing_meta WHERE id = 1`,
    )).rows[0];
    const { from, to } = sealingPeriod(
      { from: p.get("from"), to: p.get("to") },
      { first: held?.first_month ?? null, last: held?.last_month ?? null },
      new Date().toISOString().slice(0, 7),
    );
    const bus = many(p, "bu", 20);
    const channels = many(p, "channel", 60);
    return NextResponse.json({ ok: true, ...(await readSealing({ from, to, bus, channels })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The figures could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
