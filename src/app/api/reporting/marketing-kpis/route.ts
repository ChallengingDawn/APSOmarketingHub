// Marketing KPIs: the monthly inputs, the live read, and saving inputs.
// Advanced reporting's grant to read; its write grant (or admin) to type.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { readInputs, saveMonths, saveTarget } from "@/lib/marketingKpis/inputs";
import { marketingKpisLive } from "@/lib/marketingKpis/live";
import { aeoData } from "@/lib/aeo/read";
import { r10Series } from "@/lib/aeo/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [inputs, live, aeo] = await Promise.all([readInputs(), marketingKpisLive(), aeoData().catch(() => null)]);
    // R10 "AI search visibility (GEO)" from the AEO answers the hub keeps, as current as that read (SARCLA 17.10)
    if (live.value && aeo?.value?.runs.length) {
      live.value = { ...live.value, series: { ...live.value.series, ...r10Series(aeo.value.runs, live.value.year) } };
    }
    return NextResponse.json({ ok: true, inputs, live, canEdit: access.canWrite("reporting") });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canWrite("reporting")) return NextResponse.json({ error: "Typing the monthly inputs needs edit rights on Advanced reporting." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { kpi?: unknown; values?: unknown; target?: unknown };
  const me = await requireUser();
  const by = me.full_name || me.username;
  try {
    if (typeof body.kpi === "string" && body.values && typeof body.values === "object") {
      return NextResponse.json({ ok: true, inputs: await saveMonths(body.kpi, body.values as Record<string, number | null>, by) });
    }
    const t = body.target as { kpi?: unknown; year?: unknown; value?: unknown } | undefined;
    if (t && typeof t.kpi === "string" && typeof t.year === "string") {
      const v = t.value === null ? null : typeof t.value === "number" ? t.value : NaN;
      return NextResponse.json({ ok: true, inputs: await saveTarget(t.kpi, t.year, v, by) });
    }
    return NextResponse.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 400 });
  }
}
