// Smart Segmentation: the portfolio's priorities, the APSO segments, and what the
// engine's runs did. Counts come from HubSpot searches, so they are held a minute.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { breakdown, lastResult, status, type Action } from "@/lib/integrations/segmentation";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { at: number; p: Promise<unknown> } | null = null;
let bdCache: { at: number; p: Promise<unknown> } | null = null;

export async function GET(req: Request) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fresh = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    if (!cache || fresh || Date.now() - cache.at > 60_000) {
      const p = status();
      cache = { at: Date.now(), p };
      p.catch(() => { if (cache?.p === p) cache = null; });
    }
    if (!bdCache || fresh || Date.now() - bdCache.at > 5 * 60_000) {
      const p = breakdown();
      bdCache = { at: Date.now(), p };
      p.catch(() => { if (bdCache?.p === p) bdCache = null; });
    }
    const acts: Action[] = ["run-new", "sweep", "potential", "web", "watch", "recheck", "yearly"];
    const [st, bd, ...last] = await Promise.all([cache.p, bdCache.p, ...acts.map((a) => lastResult(a))]);
    return NextResponse.json({
      configured: true, ok: true,
      data: { status: st, breakdown: bd, last: Object.fromEntries(acts.map((a, i) => [a, last[i] ?? null])) },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
