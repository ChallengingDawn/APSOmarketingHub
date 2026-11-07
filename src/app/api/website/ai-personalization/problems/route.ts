// APSOconvert > Problems: pages with a lot of traffic and little buying (src/lib/convert/problems.ts), for the reporting
// window. One computation per window at a time, kept five minutes once the shop's record was in it (a read still running
// is not kept: the next ask should find it finished).
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { buildProblems, type ProblemsData } from "@/lib/convert/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TTL_MS = 5 * 60_000;
const cache: Map<string, { at: number; p: Promise<ProblemsData> }> =
  ((globalThis as { __convertProblems?: Map<string, { at: number; p: Promise<ProblemsData> }> }).__convertProblems ??= new Map());

function problems(from: string, to: string): Promise<ProblemsData> {
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const p = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      return await buildProblems(from, to, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  })().then(
    (d) => { if (d.shop.state !== "ready" || !d.ga4.ok) cache.delete(key); return d; },
    (e) => { cache.delete(key); throw e; },
  );
  cache.set(key, { at: Date.now(), p });
  if (cache.size > 50) for (const [k, v] of cache) if (Date.now() - v.at > TTL_MS) cache.delete(k);
  return p;
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first.", status: 400 });
  }
  try {
    return NextResponse.json({ configured: true, ok: true, data: await problems(from, to) });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) }, { status: 200 });
  }
}
