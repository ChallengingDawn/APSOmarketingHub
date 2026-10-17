// GOOGLE ADS BUCKETS: what the Ads Gateway (Railway) says about the Google Ads buyer buckets and live shop
// activity, for the hub's page Website > Microservices > Google Ads buckets (SARCLA 17.10.2026: a separate
// microservice). Same three answers as every integration route: not configured, upstream failed, or the data.
//   GET  -> { status, health, setting, isAdmin }
//   POST { action: "switch", job, on } | { action: "build" } | { action: "flush" } | { action: "gateway", url }  (admins)

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { adminToken, adsGateway, adsGatewaySetting, setAdsGateway, type AdsHealth, type AdsStatus } from "@/lib/adsbuckets/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOBS = ["ads_buckets", "shop_activity"];

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ configured: false, missing: ["SMART_BAR_ADMIN_TOKEN"] });
  try {
    const setting = await adsGatewaySetting();
    const [status, health] = await Promise.all([
      adsGateway<AdsStatus>("/admin/status"),
      fetch(`${setting.url}/health`, { cache: "no-store", signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? (r.json() as Promise<AdsHealth>) : null)).catch(() => null),
    ]);
    return NextResponse.json({ configured: true, ok: true, data: { status, health, setting, isAdmin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: (err as { status?: number })?.status ?? null });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ ok: false, error: "SMART_BAR_ADMIN_TOKEN is not set on the hub." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const me = await requireUser();
  const who = me.full_name || me.username;
  try {
    if (body.action === "switch") {
      const job = typeof body.job === "string" ? body.job : "";
      if (!JOBS.includes(job)) return NextResponse.json({ ok: false, error: "Which job?" }, { status: 400 });
      if (typeof body.on !== "boolean") return NextResponse.json({ ok: false, error: "On or off?" }, { status: 400 });
      const data = await adsGateway(`/admin/switch/${job}`, { method: "POST", body: { on: body.on } });
      console.log(`[ads-buckets] ${job} switched ${body.on ? "on" : "off"} by ${who}`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "build" || body.action === "flush") {
      const data = await adsGateway(`/admin/${body.action}`, { method: "POST" });
      console.log(`[ads-buckets] ${body.action === "build" ? "list build" : "shop activity write"} started by ${who}`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "gateway") {
      if (typeof body.url !== "string") return NextResponse.json({ ok: false, error: "No address given." }, { status: 400 });
      const setting = await setAdsGateway(body.url, who);
      console.log(`[ads-buckets] gateway address set to ${setting.url} by ${who}`);
      return NextResponse.json({ ok: true, data: { setting } });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}
