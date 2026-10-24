// MAP ASSIGNMENT (SARCLA 19.10.2026) - who owns each company, per country by the Performis SAE or postcode zones; the
// hub compares (shadow) and, only for a country switched live, writes company owner + region_responsibility and the
// contacts (src/lib/mapAssign/engine.ts). The contract with the page: src/lib/mapAssign/api.ts.
//
// GET                         MapData (everyone who may open Use cases)
// GET ?layers=CC              LayerData: the country's companies per postcode (companies, customers / new customers
//                             this year, revenue this year, sales priority, top 3) and GDP per region
//     &sandbox=1              the same with every company decided by the sandbox's rules (the KPIs compare the two)
// GET ?performis=1            PerformisData: companies and contacts per country and SAE, who the rules give each SAE
// GET ?changes=1&country=&from=&to=&q=&offset=   ChangesPage: one move's companies, 50 a page ("from" empty = nobody)
// GET ?companies=1&erp=id,id | &q=text (&country=CC)   CompanyRow[]: the key accounts' customers, or a search to add one
// GET ?topics=1(&country=CC|??)   TopicsData: the differences grouped by why, with the OK answers (src/lib/mapAssign/topics.ts)
// GET ?performisWrong=1(&country=&reason=&q=&offset=)   PerformisWrongData: Performis customers whose SAE does not name
//                             the person the rules give them - what to write in Performis (SARCLA 24.10.2026)
//     &format=xlsx            the Excel file: those, and every company whose HubSpot owner differs from the rules
// GET ?contacts=1             ContactsData: the new contacts of the last 30 days against the rules (kept hourly by the
//                             run) and how every contact matches its company (src/lib/mapAssign/contactsKpi.ts)
// PUT {sandbox: {patch} | {reset: "sae" | CC | true}}   the sandbox (SARCLA 24.10.2026: "so the sales leader can play
//                             around") - everyone who can open the page; it never decides or writes anything
// Admins:
// PUT {promote: {part}}       bring one part of the sandbox into the live rules: "sae" or a country
// PUT {rules}                 the whole rules, validated; every stored company decided again at once
// PUT {patch}                 part of them (sae / defaultOwner / countries: {CC: rule | null}) merged into the saved
//                             ones - one country per request keeps the body under the hub's 8 KB request limit
// PUT {live}                  country -> on/off, merged into the saved switches
// PUT {settings}              {breaker, contactBreaker, linkBreaker}: the most a live run writes
// PUT {topicOk: {topic, ok}}   an OK for one topic of the differences as it is now (ok false takes it back), in a request
//                             of its own; answers {ok, data: TopicsData} (topicOk.country: the country the data shows)
// PUT {redirection: {ruleId, decision}}   an Owner redirection rule against the map answered: "map" switches the rule
//                             off (and publishes), "rule" keeps it over the map, null forgets the answer
// POST {action: "run"}        a run now, in the background (unless one is going)
// POST {action: "link", contactId, companyId}   link a contact from the "No company" list (its owner too when the
//                             company's country is live)
// Contacts follow their company (SARCLA 24.10.2026, src/lib/mapAssign/contactFollow.ts; GET ?contacts=1 -> follow):
// PUT {contactFollow: {auto}} Automatic on / off, in a request of its own; answers {ok, data: {auto, by, at}}
// POST {action: "contacts-follow", scope: "all" | "latest"}   a pass now, in the background: the contacts that differ
//                             from their company / the sure ones of "The latest that do not follow the rules"

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { describeIntegrationError } from "@/lib/integrations/status";
import { changesPage, companyRows, getRules, getSandbox, isRunning, kick, layerData, linkContact, mapData, performisData, promoteSandbox, saveLive, saveRules, saveSandbox, saveSettings } from "@/lib/mapAssign/engine";
import { answerConflict } from "@/lib/mapAssign/redirections";
import { validateLive, validateRules, type RulesPatch } from "@/lib/mapAssign/plan";
import type { MapPost, MapPut } from "@/lib/mapAssign/api";
import { TOPIC_ORDER, isTopicId, type TopicId } from "@/lib/mapAssign/topics";
import { answerTopic, topicsData } from "@/lib/mapAssign/topicsDb";
import { contactsData } from "@/lib/mapAssign/contactsKpi";
import { performisWrong, performisWrongXlsx } from "@/lib/mapAssign/performisWrongDb";
import { WRONG_ORDER } from "@/lib/mapAssign/performisWrong";
import { isFollowRunning, kickFollow, saveFollow, stopRest } from "@/lib/mapAssign/contactFollow";

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
      // the sandbox's rules, or the live ones while there is no sandbox (it starts as their copy)
      const rules = sp.get("sandbox") ? ((await getSandbox())?.rules ?? (await getRules()).value) : undefined;
      return NextResponse.json({ configured: true, ok: true, data: await layerData(cc, rules ? { rules } : {}) });
    }
    if (sp.get("performis") !== null) return NextResponse.json({ configured: true, ok: true, data: await performisData() });
    if (sp.get("contacts") !== null) return NextResponse.json({ configured: true, ok: true, data: await contactsData() });
    if (sp.get("performisWrong") !== null) {
      if (sp.get("format") === "xlsx") {
        const file = await performisWrongXlsx();
        return new NextResponse(new Uint8Array(file), { headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="wrong-performis-owners-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store",
        } });
      }
      const country = (sp.get("country") ?? "").trim().toUpperCase();
      if (country && !/^([A-Z]{2}|\?\?)$/.test(country)) return NextResponse.json({ ok: false, error: "country must be an ISO 3166 two-letter code" }, { status: 400 });
      const reason = (sp.get("reason") ?? "").trim();
      if (reason && !(WRONG_ORDER as string[]).includes(reason)) return NextResponse.json({ ok: false, error: `reason must be one of ${WRONG_ORDER.join(", ")}` }, { status: 400 });
      return NextResponse.json({ configured: true, ok: true, data: await performisWrong({ country: country || null, reason: reason || null, q: sp.get("q"), offset: Number(sp.get("offset") ?? 0) }) });
    }
    if (sp.get("topics") !== null) {
      const country = (sp.get("country") ?? "").trim().toUpperCase();
      if (country && !/^([A-Z]{2}|\?\?)$/.test(country)) return NextResponse.json({ ok: false, error: "country must be an ISO 3166 two-letter code" }, { status: 400 });
      return NextResponse.json({ configured: true, ok: true, data: await topicsData(country || null) });
    }
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
  const b = (await req.json().catch(() => null)) as (MapPut & { patch?: RulesPatch; settings?: Record<string, unknown>; topicOk?: unknown }) | null;
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "No body" }, { status: 400 });
  // the sandbox: anyone who can open the page, in a request of its own - it changes nothing that decides or writes
  if (b.sandbox !== undefined) {
    if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
    const x = b.sandbox as { patch?: unknown; reset?: unknown } | null;
    if (Object.keys(b).some((k) => k !== "sandbox")) return NextResponse.json({ ok: false, error: "sandbox goes in a request of its own" }, { status: 400 });
    if (!x || typeof x !== "object" || (x.patch !== undefined && (typeof x.patch !== "object" || x.patch === null))
      || (x.reset !== undefined && x.reset !== true && !(typeof x.reset === "string" && /^([A-Za-z]{2}|sae)$/i.test(x.reset)))) {
      return NextResponse.json({ ok: false, error: "sandbox must be {patch} or {reset: \"sae\" | a country | true}" }, { status: 400 });
    }
    try {
      const r = await saveSandbox({ patch: x.patch as RulesPatch | undefined, reset: x.reset as string | boolean | undefined }, await who(access.userId));
      if (!r.ok) return NextResponse.json({ ok: false, error: r.errors[0], errors: r.errors }, { status: 400 });
      return NextResponse.json({ ok: true, data: await mapData(access.role === "admin") });
    } catch (err) {
      return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
    }
  }
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  // everything is checked before anything is stored
  const problems: string[] = [];
  if (b.rules !== undefined) { const v = validateRules(b.rules); if (!v.ok) problems.push(...v.errors); }
  if (b.patch !== undefined && (typeof b.patch !== "object" || b.patch === null)) problems.push("patch is not an object");
  if (b.live !== undefined) { const v = validateLive(b.live); if (!v.ok) problems.push(...v.errors); }
  if (b.redirection !== undefined) {
    const x = b.redirection as { ruleId?: unknown; decision?: unknown } | null;
    if (!x || typeof x.ruleId !== "string" || !x.ruleId.trim() || !(x.decision === "map" || x.decision === "rule" || x.decision === null)) problems.push("redirection must be {ruleId, decision: \"map\" | \"rule\" | null}");
  }
  let topicOk: { topic: TopicId; ok: boolean; country: string | null } | null = null;
  if (b.topicOk !== undefined) {
    const x = b.topicOk as { topic?: unknown; ok?: unknown; country?: unknown } | null;
    const country = x && typeof x === "object" && typeof x.country === "string" ? x.country.trim().toUpperCase() : "";
    if (!x || typeof x !== "object" || !isTopicId(x.topic) || typeof x.ok !== "boolean") problems.push(`topicOk must be {topic: ${TOPIC_ORDER.join(" | ")}, ok: true | false}`);
    else if (country && !/^([A-Z]{2}|\?\?)$/.test(country)) problems.push("topicOk.country must be an ISO 3166 two-letter code");
    else if (Object.keys(b).some((k) => k !== "topicOk")) problems.push("topicOk goes in a request of its own");
    else topicOk = { topic: x.topic, ok: x.ok, country: country || null };
  }
  let follow: boolean | null = null;
  let stopCarry = false;
  const cf = (b as { contactFollow?: unknown }).contactFollow;
  if (cf !== undefined) {
    const x = cf as { auto?: unknown; rest?: unknown } | null;
    if (!x || typeof x !== "object" || (typeof x.auto !== "boolean" && x.rest !== false)) problems.push("contactFollow must be {auto: true | false} or {rest: false}");
    else if (Object.keys(b).some((k) => k !== "contactFollow")) problems.push("contactFollow goes in a request of its own");
    else if (typeof x.auto === "boolean") follow = x.auto;
    else stopCarry = true;
  }
  if (problems.length) return NextResponse.json({ ok: false, error: problems[0], errors: problems }, { status: 400 });
  try {
    const by = await who(access.userId);
    if (topicOk) {
      await answerTopic(topicOk.topic, topicOk.ok, by);
      return NextResponse.json({ ok: true, data: await topicsData(topicOk.country) });
    }
    if (follow !== null) return NextResponse.json({ ok: true, data: await saveFollow(follow, by) });
    if (stopCarry) { await stopRest(); return NextResponse.json({ ok: true, data: { rest: null } }); }
    let redecided: number | undefined;
    if (b.rules !== undefined || b.patch !== undefined) {
      const r = await saveRules({ rules: b.rules, patch: b.patch }, by);
      if (!r.ok) return NextResponse.json({ ok: false, error: r.errors[0], errors: r.errors }, { status: 400 });
      redecided = r.value.redecided;
    }
    if (b.promote !== undefined) {
      const part = String((b.promote as { part?: unknown } | null)?.part ?? "").trim();
      if (!/^([A-Za-z]{2}|sae)$/i.test(part)) return NextResponse.json({ ok: false, error: "promote must be {part: \"sae\" | a country}" }, { status: 400 });
      const r = await promoteSandbox(part, by);
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
    if ((b as { action?: unknown }).action === "contacts-follow") {
      const scope = (b as { scope?: unknown }).scope;
      if (scope !== "all" && scope !== "latest") return NextResponse.json({ ok: false, error: "scope must be \"all\" or \"latest\"" }, { status: 400 });
      if (await isFollowRunning()) return NextResponse.json({ ok: true, data: { started: false, why: "a pass is going already" } });
      const started = kickFollow(scope, await who(access.userId));
      return NextResponse.json({ ok: true, data: started ? { started: true } : { started: false, why: "a pass is going already" } });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}
