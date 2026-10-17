// SEARCH BAR: what the smart-bar gateway on Railway says about the shop's search bar - searches, gaps,
// AI conversations, stock, brands, featured products, its setup - read for the hub's page (Website's
// grant). Same three answers as every integration route: not configured, upstream failed (with the
// reason), or the data. The Feedback tab left the page (SARCLA 17.10.2026).
//   GET ?part=overview&days=30 | report&days= | logs&limit=&locale=&tier= | gaps&window=
//       | ai&archived=0|1 | brands | features | stock&q=&state=&published=&limit=&offset=&sort=&dir=
//       | jobs | setup
// The switches and the brand list (SARCLA 17.10.2026: "maintenance button doesn't really work", "on brands
// allow to add brands") - admins only, as DirectUP's settings, each change logged with who made it:
//   POST { action: "kill-switch" | "same-tab", on } | { action: "buttons", ai?, feedback? }
//        | { action: "brand-add", brand, material, vendor?, notes? } | { action: "brand-remove", brand }

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import {
  adminToken, gateway, gatewaySetting,
  type AiConversations, type Brands, type Feature, type Gaps, type Health, type LogRow, type Metrics, type Migration,
  type OrderWatch, type Report, type Stock, type StockCalls, type SweepRun, type SweepStatus, type Switches,
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

/** The switches as the gateway's DATABASE holds them (its admin reads re-read it; the public /config
 *  answers from one running copy's memory). */
async function switchesNow(): Promise<Switches> {
  const [kill, same, cfg] = await Promise.all([
    gateway<{ on: boolean; updated_at: string | null }>("/api/smart-bar/admin/kill-switch"),
    gateway<{ on: boolean }>("/api/smart-bar/admin/same-tab"),
    gateway<{ buttons?: { ai?: boolean; feedback?: boolean } }>("/api/smart-bar/widget-config"),
  ]);
  return {
    killSwitch: kill.on === true, killSwitchAt: kill.updated_at ?? null, sameTab: same.on === true,
    buttons: { ai: cfg.buttons?.ai !== false, feedback: cfg.buttons?.feedback !== false },
  };
}

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
    if (part === "ai") return ok(await gateway<AiConversations>(`/api/smart-bar/ai-conversations?limit=100&archived=${q.get("archived") === "1" ? 1 : 0}`));
    if (part === "brands") return ok({ ...(await gateway<Brands>("/api/smart-bar/brands")), isAdmin: access.role === "admin" });
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
      const [migrations, switches, h, setting] = await Promise.all([
        gateway<{ migrations: Migration[] }>("/api/smart-bar/admin/migrations"),
        switchesNow(),
        health(),
        gatewaySetting(),
      ]);
      return ok({ migrations: migrations.migrations ?? [], switches, health: h, setting, isAdmin: access.role === "admin" });
    }
    return NextResponse.json({ configured: true, ok: false, error: "Unknown part.", status: 400 });
  } catch (err) {
    return fail(err);
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
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  try {
    if (body.action === "kill-switch" || body.action === "same-tab") {
      if (typeof body.on !== "boolean") return NextResponse.json({ ok: false, error: "On or off?" }, { status: 400 });
      await gateway(`/api/smart-bar/admin/${body.action}`, { method: "POST", body: { on: body.on } });
      const what = body.action === "kill-switch" ? (body.on ? "bar switched OFF on the shop" : "bar switched back ON on the shop") : `same-tab links ${body.on ? "on" : "off"}`;
      console.log(`[search-bar] ${what} by ${who}`);
      return NextResponse.json({ ok: true, data: await switchesNow() });
    }
    if (body.action === "buttons") {
      const buttons: Record<string, boolean> = {};
      if (typeof body.ai === "boolean") buttons.ai = body.ai;
      if (typeof body.feedback === "boolean") buttons.feedback = body.feedback;
      if (!Object.keys(buttons).length) return NextResponse.json({ ok: false, error: "Which button?" }, { status: 400 });
      await gateway("/api/smart-bar/widget-config", { method: "PUT", body: { buttons } });
      console.log(`[search-bar] bar buttons ${JSON.stringify(buttons)} by ${who}`);
      return NextResponse.json({ ok: true, data: await switchesNow() });
    }
    if (body.action === "brand-add") {
      const row = { brand: str(body.brand, 60), material: str(body.material, 20), vendor: str(body.vendor, 60), notes: str(body.notes, 200), by: who };
      if (!row.brand || !row.material) return NextResponse.json({ ok: false, error: "A brand name and its material, please." }, { status: 400 });
      const data = await gateway<{ brand: unknown }>("/api/smart-bar/brands", { method: "POST", body: row });
      console.log(`[search-bar] brand "${row.brand}" -> ${row.material} added by ${who}`);
      return NextResponse.json({ ok: true, data });
    }
    if (body.action === "brand-remove") {
      const brand = str(body.brand, 60);
      if (!brand) return NextResponse.json({ ok: false, error: "Which brand?" }, { status: 400 });
      const data = await gateway(`/api/smart-bar/brands/${encodeURIComponent(brand)}`, { method: "DELETE", body: { by: who } });
      console.log(`[search-bar] brand "${brand}" removed by ${who}`);
      return NextResponse.json({ ok: true, data });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: status === 400 || status === 404 || status === 409 ? status : 502 });
  }
}
