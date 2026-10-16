// SEARCH BAR: what the smart-bar gateway on Railway says about the shop's search bar - searches, gaps,
// customer feedback, AI conversations, stock, brands, featured products, its setup - read for the hub's
// page (Website's grant). READ-ONLY for now (SARCLA 16.10.2026: "read-only first; the on/off switches at
// the end"). Same three answers as every integration route: not configured, upstream failed (with the
// reason), or the data.
//   GET ?part=overview&days=30 | report&days= | logs&limit=&locale=&tier= | gaps&window= | feedback
//       | ai&archived=0|1 | brands | features | stock&q=&state=&published=&limit=&offset=&sort=&dir=
//       | jobs | setup

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import {
  adminToken, gateway, gatewaySetting,
  type AiConversations, type Feature, type Feedback, type Gaps, type Health, type LogRow, type Metrics, type Migration,
  type OrderWatch, type Report, type Stock, type StockCalls, type SweepRun, type SweepStatus, type Brand,
} from "@/lib/searchbar/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ok = (data: unknown) => NextResponse.json({ configured: true, ok: true, data });
const fail = (err: unknown) => NextResponse.json({
  configured: true, ok: false, error: String((err as Error)?.message ?? err), status: (err as { status?: number })?.status ?? null,
});
const int = (v: string | null, def: number, min: number, max: number) => Math.min(max, Math.max(min, parseInt(v || String(def), 10) || def));
const pick = (v: string | null, allowed: string[], def: string) => (v && allowed.includes(v) ? v : def);

/** The gateway's /health answers without the key and is the quickest proof it is up. */
async function health(): Promise<Health | null> {
  const base = (await gatewaySetting()).url;
  try {
    const r = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return r.ok ? ((await r.json()) as Health) : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminToken()) return NextResponse.json({ configured: false, missing: ["SMART_BAR_ADMIN_TOKEN"] });
  const q = req.nextUrl.searchParams;
  const part = q.get("part") || "overview";
  try {
    if (part === "overview") {
      const days = int(q.get("days"), 30, 1, 365);
      const [metrics, report, h, setting] = await Promise.all([
        gateway<Metrics>("/api/smart-bar/metrics?window=24h"),
        gateway<Report>(`/api/smart-bar/report?days=${days}`),
        health(),
        gatewaySetting(),
      ]);
      return ok({ metrics, report, health: h, setting });
    }
    if (part === "report") return ok(await gateway<Report>(`/api/smart-bar/report?days=${int(q.get("days"), 30, 1, 365)}`));
    if (part === "logs") {
      const p = new URLSearchParams({ limit: String(int(q.get("limit"), 500, 1, 2000)) });
      const locale = q.get("locale"), tier = q.get("tier");
      if (locale && /^[a-z]{2}-[A-Z]{2,3}$/.test(locale)) p.set("locale", locale);
      if (tier && /^[a-z0-9_-]{1,40}$/i.test(tier)) p.set("tier", tier);
      const text = (q.get("q") || "").trim().slice(0, 80);
      if (text) p.set("q", text);
      return ok(await gateway<LogRow[]>(`/api/smart-bar/logs?${p}`));
    }
    if (part === "gaps") return ok(await gateway<Gaps>(`/api/smart-bar/gaps?window=${pick(q.get("window"), ["24h", "7d", "30d"], "7d")}`));
    if (part === "feedback") return ok(await gateway<Feedback>("/api/smart-bar/feedback?limit=500"));
    if (part === "ai") return ok(await gateway<AiConversations>(`/api/smart-bar/ai-conversations?limit=100&archived=${q.get("archived") === "1" ? 1 : 0}`));
    if (part === "brands") return ok(await gateway<{ total: number; brands: Brand[] }>("/api/smart-bar/brands"));
    if (part === "features") return ok(await gateway<{ features: Feature[] }>("/api/smart-bar/features"));
    if (part === "stock") {
      const p = new URLSearchParams({ limit: String(int(q.get("limit"), 50, 1, 200)), offset: String(int(q.get("offset"), 0, 0, 1_000_000)) });
      const s = (q.get("q") || "").trim().slice(0, 80);
      if (s) p.set("q", s);
      const state = pick(q.get("state"), ["", "in", "out", "nodata", "ext"], "");
      if (state) p.set("state", state);
      const pub = pick(q.get("published"), ["", "0", "1"], "");
      if (pub) p.set("published", pub);
      const sort = pick(q.get("sort"), ["", "sku", "description", "stock", "stock_sales", "synced"], "");
      if (sort) { p.set("sort", sort); p.set("dir", q.get("dir") === "asc" ? "asc" : "desc"); }
      return ok(await gateway<Stock>(`/api/smart-bar/stock?${p}`));
    }
    if (part === "jobs") {
      const [sweep, runs, orders, calls, h] = await Promise.all([
        gateway<SweepStatus>("/api/stock-sweep/status"),
        gateway<{ runs: SweepRun[]; total: number }>("/api/stock-sweep/runs?limit=14"),
        gateway<OrderWatch>("/api/order-stock/status"),
        gateway<StockCalls>("/api/stock-calls?limit=50"),
        health(),
      ]);
      return ok({ sweep, runs: runs.runs ?? [], orders, calls, health: h });
    }
    if (part === "setup") {
      const [migrations, config, h, setting] = await Promise.all([
        gateway<{ migrations: Migration[] }>("/api/smart-bar/admin/migrations"),
        gateway<{ killSwitch: boolean; sameTab: boolean }>("/api/smart-bar/config"),
        health(),
        gatewaySetting(),
      ]);
      return ok({ migrations: migrations.migrations ?? [], config, health: h, setting });
    }
    return NextResponse.json({ configured: true, ok: false, error: "Unknown part.", status: 400 });
  } catch (err) {
    return fail(err);
  }
}
