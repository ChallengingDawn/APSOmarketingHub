// Retain & grow: the retention workbook's tabs, live (src/lib/marketingKpis/retention.ts reads, retentionCube.ts
// counts). The page gets the figures, never the 25,000 companies behind them. Advanced reporting's grant to read.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { retentionData } from "@/lib/marketingKpis/retention";
import { retentionView, type RetentionRaw, type RetentionView } from "@/lib/marketingKpis/retentionCube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The view of the last read, worked out once per read. */
let made: { raw: RetentionRaw; view: RetentionView } | null = null;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const st = await retentionData();
    let view: RetentionView | undefined;
    if (st.value) {
      if (made?.raw !== st.value) made = { raw: st.value, view: retentionView(st.value) };
      view = made.view;
    }
    return NextResponse.json({ ok: true, retention: { computing: st.computing, progress: st.progress, error: st.error, computedAt: st.computedAt, value: view } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
