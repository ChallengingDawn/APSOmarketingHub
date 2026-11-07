// Website > A/B testing > ONE PAGE TEST: its settings, its change list (what runs), the version and the idea it came
// from, the results of the current round read from the shop's gateway and worked out (src/lib/convert/stats.ts: rate
// and interval per variant, uplift, P(best), the verdict, the day by day line, the segments), the live split under the
// bandit, and who did what. ?fresh=1 reads a stopped test's results again. Actions go to ../route.ts (POST).
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { baseRateOf, gatewayState, gatewayTests, history, ideaOf, listTests, resultsOf, shippedAs, testById } from "@/lib/convert/tests";
import { fail, failOf, idOf, ok } from "@/lib/convert/api";
import type { Change } from "@/lib/convert/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = "/website/ab-testing/pages";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const id = idOf((await params).id);
  if (!id) return fail("Which test?", 400);
  try {
    const t = await testById(id);
    if (!t) return fail("No such test.", 404);
    const [changes, idea, log, live, shipped, version, copies] = await Promise.all([
      query<{ changes: Change[] }>(`SELECT changes FROM apsomh_convert_tests WHERE id = $1`, [id]).then((r) => r.rows[0]?.changes ?? []),
      ideaOf(t),
      history(id),
      t.status === "running" || t.status === "paused" ? gatewayTests() : Promise.resolve({ tests: null, error: null }),
      t.kind === "test" ? shippedAs(id) : Promise.resolve(null),
      t.versionId
        ? query<{ rev: number; status: string; summary: string; approved_by: string | null; approved_at: Date | null; path: string; env: string }>(
          `SELECT rev, status, summary, approved_by, approved_at, path, env FROM apsomh_convert_versions WHERE id = $1`, [t.versionId]).then((r) => r.rows[0] ?? null)
        : Promise.resolve(null),
      t.versionId ? listTests(t.kind).then((l) => l.filter((x) => x.versionId === t.versionId && x.id !== t.id).map((x) => ({ id: x.id, env: x.env, status: x.status, name: x.name }))) : Promise.resolve([]),
    ]);
    const results = await resultsOf(t, { fresh: req.nextUrl.searchParams.get("fresh") === "1", baseRate: await baseRateOf(t).catch(() => null) });
    const g = live.tests?.find((c) => String(c.id) === t.id) ?? null;
    return ok({
      test: { ...t, results: undefined, changes },
      idea,
      version: version ? { rev: version.rev, status: version.status, summary: version.summary, approvedBy: version.approved_by, approvedAt: version.approved_at ? new Date(version.approved_at).toISOString() : null, path: version.path, env: version.env } : null,
      results: results.results,
      resultsAt: results.at,
      resultsLive: results.live,
      resultsError: results.error,
      analysis: results.analysis,
      liveWeights: g?.weights ?? null,
      drift: live.tests && (t.status === "running" || t.status === "paused") ? (!g ? "missing" : g.v !== t.v || g.status !== t.status ? "behind" : null) : null,
      gateway: { ...gatewayState(), error: live.error },
      history: log,
      shippedAs: shipped ? { id: shipped.id, status: shipped.status } : null,
      copies,
      canEdit: access.levelAt(PAGE) === "write",
    });
  } catch (e) {
    return failOf(e);
  }
}
