// SEALING BUSINESS REVIEW's figures (src/lib/apHub/sealingStore.ts): ?from=YYYY-MM&to=YYYY-MM&bu=APCH&channel=OEM.
// Without a period: the year so far, up to the last month the morning workbook carries.
import { NextRequest, NextResponse } from "next/server";
import { readSealing, ensureSealingTable } from "@/lib/apHub/sealingStore";
import { query } from "@/lib/db/client";
import { apHubUser } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: NextRequest) {
  const gate = await apHubUser();
  if ("error" in gate) return gate.error;
  try {
    await ensureSealingTable();
    const p = req.nextUrl.searchParams;
    let to = p.get("to") ?? "";
    if (!MONTH.test(to)) {
      const last = (await query<{ last_month: string | null }>(`SELECT last_month FROM apsomh_ap_sealing_meta WHERE id = 1`)).rows[0]?.last_month;
      to = last && MONTH.test(last) ? last : new Date().toISOString().slice(0, 7);
    }
    let from = p.get("from") ?? "";
    if (!MONTH.test(from) || from > to) from = `${to.slice(0, 4)}-01`;
    const bu = (p.get("bu") ?? "").trim().slice(0, 20) || undefined;
    const channel = (p.get("channel") ?? "").trim().slice(0, 60) || undefined;
    return NextResponse.json({ ok: true, ...(await readSealing({ from, to, bu, channel })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `The figures could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
