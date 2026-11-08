// APSOconvert > PERFORMANCE: GET = every page test's figures added up (src/lib/convert/perf.ts) - launched, won,
// running; the add-to-cart rate with the versions against the pages as they are, by week. Read-only.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { listTests, resultsOf } from "@/lib/convert/tests";
import { inTurns } from "@/lib/convert/api";
import { performanceOf, type PerfTest } from "@/lib/convert/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const tests = await listTests("test");
    const daily = await inTurns(tests, 4, (t) => (t.status === "draft" ? Promise.resolve([]) : resultsOf(t).then((r) => r.results?.daily ?? []).catch(() => [])));
    const rows: PerfTest[] = tests.map((t, i) => ({ id: t.id, kind: t.kind, status: t.status, winner: t.winner, daily: daily[i] }));
    return NextResponse.json({ configured: true, ok: true, data: performanceOf(rows) });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}
