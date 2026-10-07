// The review queue's automatic check (GET, read-only, held 10 minutes) and its
// link (POST, writes company_unique_number - only for someone who may change
// things in Connectors & Integration).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { compassSnapshot } from "@/lib/integrations/compassConnector";
import { checkAll, linkAll, type CheckRow } from "@/lib/connectors/reviewCheck";
import { describeIntegrationError, hubspotToken } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60_000;
let cache: { at: number; key: string; p: Promise<CheckRow[]> } | null = null;

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
    const key = uns.join(",");
    const fresh = req.nextUrl.searchParams.get("refresh") === "1";
    if (!cache || fresh || cache.key !== key || Date.now() - cache.at > TTL_MS) {
      const p = checkAll(uns);
      cache = { at: Date.now(), key, p };
      p.catch(() => { if (cache?.p === p) cache = null; });
    }
    return NextResponse.json({ configured: true, ok: true, data: { at: new Date(cache.at).toISOString(), rows: await cache.p } });
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
    cache = null;
    console.log(`[connectors] review link by ${access.userId}: linked ${r.linked.length}, skipped ${r.skipped.length}`);
    return NextResponse.json({ ok: true, data: r });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
