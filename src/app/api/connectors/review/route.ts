// The review queue's automatic check (GET, read-only) and its link (POST, writes
// company_unique_number - only for someone who may change things in Connectors &
// Integration). The check runs in the background and is kept (reviewCheck.ts): GET
// answers at once with the last result, and starts a new check when it is older than
// 10 minutes, the queue changed, or the page asks ("Check again").

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { compassSnapshot } from "@/lib/integrations/compassConnector";
import { checkRunning, heldCheck, linkAll, refreshCheck } from "@/lib/connectors/reviewCheck";
import { describeIntegrationError, hubspotToken } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 10 * 60_000;

async function waiting(): Promise<string[]> {
  const s = await compassSnapshot();
  return (s.review?.items ?? []).filter((i) => i.status !== "resolved" && i.un).map((i) => i.un as string);
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("connectors")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!hubspotToken()) return NextResponse.json({ configured: false, missing: ["HUBSPOT_TOKEN"] });
  try {
    const uns = await waiting();
    let h = await heldCheck();
    const changed = !h || h.uns.join(",") !== uns.join(",");
    const old = !h?.at || Date.now() - Date.parse(h.at) > STALE_MS;
    if (!checkRunning(h) && (req.nextUrl.searchParams.get("refresh") === "1" || changed || old)) {
      refreshCheck(uns);
      h = await heldCheck();
    }
    return NextResponse.json({ configured: true, ok: true, data: {
      at: h?.at || null, rows: h?.rows ?? [], checking: checkRunning(h), error: h?.error ?? null,
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canWrite("connectors")) return NextResponse.json({ error: "Only someone who may edit Connectors & Integration can link" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { uns?: string[] };
  const allowed = new Set(await waiting());
  const uns = (body.uns ?? []).filter((u) => allowed.has(u)).slice(0, 200);
  if (!uns.length) return NextResponse.json({ ok: false, error: "Nothing to link" }, { status: 400 });
  try {
    const r = await linkAll(uns);
    refreshCheck(await waiting());
    console.log(`[connectors] review link by ${access.userId}: linked ${r.linked.length}, skipped ${r.skipped.length}`);
    return NextResponse.json({ ok: true, data: r });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
