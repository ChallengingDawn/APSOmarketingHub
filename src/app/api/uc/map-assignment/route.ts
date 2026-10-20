// MAP ASSIGNMENT (SARCLA 19.10.2026) - who owns each company, per country by the Performis SAE or postcode zones; the
// hub compares (shadow) and, only for a country switched live, writes company owner + region_responsibility and the
// contacts (src/lib/mapAssign/engine.ts). The contract with the page: src/lib/mapAssign/api.ts.
//
// GET                         MapData (everyone who may open Use cases)
// GET ?layers=CC              LayerData: the country's companies per postcode (companies, customers / new customers
//                             this year, revenue this year, sales priority, top 3) and GDP per region
// GET ?performis=1            PerformisData: companies and contacts per country and SAE, who the rules give each SAE
// GET ?changes=1&country=&from=&to=&q=&offset=   ChangesPage: one move's companies, 50 a page ("from" empty = nobody)
// GET ?companies=1&erp=id,id | &q=text (&country=CC)   CompanyRow[]: the key accounts' customers, or a search to add one
// Admins:
// PUT {rules}                 the whole rules, validated; every stored company decided again at once
// PUT {patch}                 part of them (sae / defaultOwner / countries: {CC: rule | null}) merged into the saved
//                             ones - one country per request keeps the body under the hub's 8 KB request limit
// PUT {live}                  country -> on/off, merged into the saved switches
// PUT {settings}              {breaker, contactBreaker, linkBreaker}: the most a live run writes
// PUT {redirection: {ruleId, decision}}   an Owner redirection rule against the map answered: "map" switches the rule
//                             off (and publishes), "rule" keeps it over the map, null forgets the answer
// POST {action: "run"}        a run now, in the background (unless one is going)
// POST {action: "link", contactId, companyId}   link a contact from the "No company" list (its owner too when the
//                             company's country is live)

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { changesPage, companyRows, isRunning, kick, layerData, linkContact, mapData, performisData, saveLive, saveRules, saveSettings } from "@/lib/mapAssign/engine";
import { answerConflict } from "@/lib/mapAssign/redirections";
import { validateLive, validateRules, type RulesPatch } from "@/lib/mapAssign/plan";
import type { MapPost, MapPut } from "@/lib/mapAssign/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function who(userId: number): Promise<string> {
  const r = await query<{ full_name: string | null; username: string | null }>(`SELECT full_name, username FROM apsomh_users WHERE id = $1`, [userId]).catch(() => ({ rows: [] }));
  const u = r.rows[0];
  return u?.full_name?.trim() || u?.username || `user ${userId}`;
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const layers = sp.get("layers");
    if (layers !== null) {
      const cc = layers.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return NextResponse.json({ ok: false, error: "layers must be an ISO 3166 two-letter country code" }, { status: 400 });
      return NextResponse.json({ configured: true, ok: true, data: await layerData(cc) });
    }
    if (sp.get("performis") !== null) return NextResponse.json({ configured: true, ok: true, data: await performisData() });
    if (sp.get("companies") !== null) {
      const country = (sp.get("country") ?? "").trim().toUpperCase();
      if (country && !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ ok: false, error: "country must be an ISO 3166 two-letter code" }, { status: 400 });
      const erp = (sp.get("erp") ?? "").split(/[,\s]+/).filter(Boolean);
      if (erp.some((x) => !/^[\w.-]{1,40}$/.test(x))) return NextResponse.json({ ok: false, error: "erp must be ERP customer ids" }, { status: 400 });
      return NextResponse.json({ configured: true, ok: true, data: await companyRows({ erp, q: sp.get("q"), country: country || null }) });
    }
    if (sp.get("changes") !== null) {
      const country = (sp.get("country") ?? "").trim().toUpperCase();
      if (country && !/^([A-Z]{2}|\?\?)$/.test(country)) return NextResponse.json({ ok: false, error: "country must be an ISO 3166 two-letter code" }, { status: 400 });
      const id = (k: string) => { const v = sp.get(k); return v === null ? null : v.trim(); };
      const from = id("from"), to = id("to");
      if ((from && !/^\d+$/.test(from)) || (to && !/^\d+$/.test(to))) return NextResponse.json({ ok: false, error: "from and to must be HubSpot owner ids" }, { status: 400 });
      return NextResponse.json({ configured: true, ok: true, data: await changesPage({ country: country || null, from, to, q: sp.get("q"), offset: Number(sp.get("offset") ?? 0) }) });
    }
    return NextResponse.json({ configured: true, ok: true, data: await mapData(access.role === "admin") });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as (MapPut & { patch?: RulesPatch; settings?: Record<string, unknown> }) | null;
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "No body" }, { status: 400 });
  // everything is checked before anything is stored
  const problems: string[] = [];
  if (b.rules !== undefined) { const v = validateRules(b.rules); if (!v.ok) problems.push(...v.errors); }
  if (b.patch !== undefined && (typeof b.patch !== "object" || b.patch === null)) problems.push("patch is not an object");
  if (b.live !== undefined) { const v = validateLive(b.live); if (!v.ok) problems.push(...v.errors); }
  if (b.redirection !== undefined) {
    const x = b.redirection as { ruleId?: unknown; decision?: unknown } | null;
    if (!x || typeof x.ruleId !== "string" || !x.ruleId.trim() || !(x.decision === "map" || x.decision === "rule" || x.decision === null)) problems.push("redirection must be {ruleId, decision: \"map\" | \"rule\" | null}");
  }
  if (problems.length) return NextResponse.json({ ok: false, error: problems[0], errors: problems }, { status: 400 });
  try {
    const by = await who(access.userId);
    let redecided: number | undefined;
    if (b.rules !== undefined || b.patch !== undefined) {
      const r = await saveRules({ rules: b.rules, patch: b.patch }, by);
      if (!r.ok) return NextResponse.json({ ok: false, error: r.errors[0], errors: r.errors }, { status: 400 });
      redecided = r.value.redecided;
    }
    if (b.live !== undefined) await saveLive(b.live, by);
    if (b.settings !== undefined) await saveSettings(b.settings, by);
    let note: string | undefined;
    if (b.redirection !== undefined) {
      const a = await answerConflict(b.redirection.ruleId.trim(), b.redirection.decision, by, access.userId);
      if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
      note = a.note; redecided = a.redecided;
    }
    return NextResponse.json({ ok: true, data: await mapData(true), ...(redecided !== undefined ? { redecided } : {}), ...(note ? { note } : {}) });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Partial<MapPost> & { contactId?: unknown; companyId?: unknown };
  try {
    if (b.action === "run") {
      if (await isRunning()) return NextResponse.json({ ok: true, data: { started: false, why: "a run is going already" } });
      const started = kick(await who(access.userId));
      return NextResponse.json({ ok: true, data: started ? { started: true } : { started: false, why: "a run is going already" } });
    }
    if (b.action === "link") {
      const contactId = String(b.contactId ?? "").trim(), companyId = String(b.companyId ?? "").trim();
      if (!/^\d+$/.test(contactId) || !/^\d+$/.test(companyId)) return NextResponse.json({ ok: false, error: "contactId and companyId must be HubSpot ids" }, { status: 400 });
      return NextResponse.json({ ok: true, data: await linkContact(contactId, companyId, await who(access.userId), { auto: false }) });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}
