// CHAT: what the orchestrator on Railway says about the shop chat - its numbers, the conversations, the
// hand-overs to TSA and Back Office - read for the hub's page (Website's grant), and its test bench. Same three
// answers as every integration route: not configured, upstream failed (with the reason), or the data.
//   GET ?part=overview&days=30 | conversations&limit=&offset=&escalated=1&language=&category= | conversation&hash=
//       overview and conversations take &env=acc: the acceptance shop's chats, counted apart from the shop's (29.10.2026)
//       (counted per CHAT - /dashboard/chat-stats, /dashboard/chats; on an orchestrator without them, per message, marked)
//       | transcript&ticket= (the whole chat from HubSpot, hand-over included)
//       | setup (answers without the key: the address, /health, whether the key is set)
//       | topics&days= | topic-chats&topic=&days=&offset= (filed by the hub after each chat: src/lib/chat/topics.ts)
//       | steering&days=&channel=hs|bar (the topic tabs: each Enquiry Category's route and figures, src/lib/chat/steering.ts)
//       | topic-chats&topic=&days=&channel=hs|bar&handed=1 (one topic's chats, HubSpot's or the search bar's)
//       | ab (the A/B test of the e-mail before the chat: setting + figures, from the shop chat's gateway - abtest.ts)
//       | sb-conversations&archived=0|1 (the search bar's AI conversations, each with its filing)
//       | hs-changes&state=would-write|written|kept|same|error&offset= (the HubSpot side of the filing)
//   POST { action: "topic-set", key, category, sub1? } (anyone with Website: a person's Enquiry Category, never filed over, written to HubSpot)
//        | { action: "topics-run" } | { action: "filing-write", on } (admins: write the filing into the tickets, or only preview)
//        | { action: "steering-save", steering } (admins: the topics' routes; the previous ones kept in kv chat:steering:log:*)
//        | { action: "ab-save", ab: { on, countries, split, restart? } } (admins: the A/B test on the shop chat's gateway)
//        | { action: "web-mode-save", mode: off|acc|preview|live } (admins: who sees the chat window on the shop)
//        { action: "test", message, language, country, conversationId? }   anyone with Website - a test writes
//          nothing (the orchestrator's /dashboard/test-dry, 18.10.2026); an orchestrator without that fix
//          answers 404 and the page says so, rather than the old /dashboard/test that made real tickets
//        { action: "orchestrator", url }   admins: which orchestrator the hub reads

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import {
  orchestrator, orchestratorHealth, orchestratorKey, orchestratorSetting, perChat, setOrchestrator,
  LIVE_FROM, type ConversationDetail, type Conversations, type Stats, type TestAnswer,
} from "@/lib/chat/orchestrator";
import { chatTranscript } from "@/lib/chat/transcript";
import { fileNow, hubspotChanges, setCategory, setWriteSwitch, topicChats, topicSummary, topicsFor } from "@/lib/chat/topics";
import type { HsState } from "@/lib/chat/shape";
import { saveSteering, steeringData } from "@/lib/chat/steering";
import { abData, saveAb } from "@/lib/chat/abtest";
import { setWebMode, webMode } from "@/lib/chat/webmode";
import { satisfactionData } from "@/lib/satisfaction/figures";
import { CHAT_TOUCHPOINTS } from "@/lib/satisfaction/rules";
import { adminKey as directupKey } from "@/lib/directup/gateway";
import { adminToken as searchBarKey, gateway as searchBarGateway, type AiConversations } from "@/lib/searchbar/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const ok = (data: unknown) => NextResponse.json({ configured: true, ok: true, data });
const fail = (err: unknown) => NextResponse.json({
  configured: true, ok: false, error: String((err as Error)?.message ?? err), status: (err as { status?: number })?.status ?? null,
});
const int = (v: string | null, def: number, min: number, max: number) => Math.min(max, Math.max(min, parseInt(v || String(def), 10) || def));
const LANGS = ["en", "de", "fr", "it", "nl", "pl"];
const COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "NL", "PL", "INT"];

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const part = q.get("part") || "overview";
  const isAdmin = access.role === "admin";
  try {
    if (part === "sb-conversations") {
      // the search bar's AI conversations with their filing (summary, Enquiry Category), so its tab reads like the others
      if (!searchBarKey()) return NextResponse.json({ configured: false, missing: ["SMART_BAR_ADMIN_TOKEN"] });
      const d = await searchBarGateway<AiConversations>(`/api/smart-bar/ai-conversations?limit=${int(q.get("limit"), 100, 1, 200)}&archived=${q.get("archived") === "1" ? 1 : 0}`);
      const filed = await topicsFor((d.conversations ?? []).map((c) => c.query_id)).catch(() => new Map());
      return ok({ ...d, isAdmin, conversations: (d.conversations ?? []).map((c) => {
        const f = filed.get(c.query_id);
        return f ? { ...c, topic: f.category, topic_sub1: f.sub1, summary: f.summary, by: f.by, filing_key: f.key } : c;
      }) });
    }
    if (part === "hs-changes") {
      const state = (q.get("state") || "would-write") as HsState;
      if (!["would-write", "written", "kept", "same", "error", "pending"].includes(state)) return NextResponse.json({ ok: false, error: "Which state?" }, { status: 400 });
      return ok(await hubspotChanges(state, int(q.get("offset"), 0, 0, 100_000), int(q.get("limit"), 20, 1, 100)));
    }
    if (part === "topics" || part === "topic-chats") {
      // filed by the hub itself (apsomh_chat_topics): counted from go-live at the earliest
      const days = int(q.get("days"), 30, 1, 400);
      const from = new Date(Math.max(Date.now() - days * 86_400_000, Date.parse(`${LIVE_FROM}T00:00:00Z`))).toISOString();
      if (part === "topics") return ok({ ...(await topicSummary(from)), from, isAdmin });
      const topic = q.get("topic") || "";
      return ok(await topicChats(topic, from, int(q.get("offset"), 0, 0, 100_000), int(q.get("limit"), 20, 1, 100),
        { source: q.get("channel") === "bar" ? "searchbar" : "chat", handedOnly: q.get("handed") === "1" }));
    }
    if (part === "satisfaction") {
      // the chat's own satisfaction: the live chat's and the shop chat's survey answers (src/lib/satisfaction)
      const days = int(q.get("days"), 30, 1, 800);
      return ok(await satisfactionData(new Date(Date.now() - days * 86_400_000).toISOString(), CHAT_TOUCHPOINTS));
    }
    if (part === "web-mode") {
      // who sees the chat window on the shop (webmode.ts) - the gateway's switch and counters
      if (!directupKey()) return NextResponse.json({ configured: false, missing: ["DIRECTUP_ADMIN_KEY"] });
      return ok({ ...(await webMode()), isAdmin });
    }
    if (part === "ab") {
      // the A/B test of the e-mail before the chat: its setting and figures, from the shop chat's gateway (abtest.ts)
      if (!directupKey()) return NextResponse.json({ configured: false, missing: ["DIRECTUP_ADMIN_KEY"] });
      return ok({ ...(await abData()), isAdmin });
    }
    if (part === "steering") {
      // the topic tabs: each Enquiry Category's route when a person is needed, and its figures (steering.ts)
      const days = int(q.get("days"), 30, 1, 400);
      const from = new Date(Math.max(Date.now() - days * 86_400_000, Date.parse(`${LIVE_FROM}T00:00:00Z`))).toISOString();
      return ok({ ...(await steeringData(from, q.get("channel") === "bar" ? "bar" : "hs")), isAdmin });
    }
    if (part === "setup") {
      const [setting, health] = await Promise.all([orchestratorSetting(), orchestratorHealth()]);
      return ok({ setting, health, keySet: !!orchestratorKey(), isAdmin });
    }
    if (!orchestratorKey()) return NextResponse.json({ configured: false, missing: ["CHAT_ORCHESTRATOR_KEY"] });
    // the shop's chats, or the acceptance shop's (SARCLA 29.10.2026: "split the results via a toggle acc / production") -
    // the orchestrator counts them apart; an orchestrator without the split ignores env and answers the shop's
    const env = q.get("env") === "acc" ? "acc" : "production";
    const envQ = env === "acc" ? "&env=acc" : "";
    if (part === "overview") {
      // never back past go-live: the test phase (23.03-12.04.2026, ~9,300 scripted chats) would swamp everything
      const live = Math.max(1, Math.ceil((Date.now() - Date.parse(`${LIVE_FROM}T00:00:00Z`)) / 86_400_000));
      const asked = int(q.get("days"), 30, 1, 365);
      const days = Math.min(asked, live);
      const [stats, recent, health] = await Promise.all([
        perChat<Stats>(`/dashboard/chat-stats?days=${days}${envQ}`, `/dashboard/stats?days=${days}${envQ}`),
        perChat<Conversations>(`/dashboard/chats?limit=8${envQ}`, `/dashboard/conversations?limit=8${envQ}`),
        orchestratorHealth(),
      ]);
      // the hub's own filing of the same period (Topics), when it has filed any - else the page shows the chat's own guess
      const topics = env === "acc" ? null : await topicSummary(new Date(Date.now() - days * 86_400_000).toISOString()).then((t) => ({ rows: t.rows.map((r) => ({ topic: r.category, chats: r.chats })), filed: t.filed })).catch(() => null);
      return ok({ stats, recent: recent.conversations, health, liveFrom: LIVE_FROM, cappedAtLive: asked > live, topics, env });
    }
    if (part === "conversations") {
      // since go-live: the orchestrator leaves the test phase out of the list and its count (one without since ignores it)
      const p = new URLSearchParams({ limit: String(int(q.get("limit"), 25, 1, 200)), offset: String(int(q.get("offset"), 0, 0, 1_000_000)), since: LIVE_FROM });
      if (q.get("escalated") === "1") p.set("escalated", "true");
      const lang = (q.get("language") || "").toLowerCase();
      if (LANGS.includes(lang)) p.set("language", lang);
      const cat = (q.get("category") || "").slice(0, 100);
      if (cat) p.set("category", cat);
      if (env === "acc") p.set("env", "acc");
      const list = await perChat<Conversations>(`/dashboard/chats?${p}`, `/dashboard/conversations?${p}`);
      // the hub's filed topic and one-line summary on each chat, for the inbox list (none yet = the chat's own guess)
      const filed = await topicsFor(list.conversations.map((c) => c.session_hash)).catch(() => new Map());
      return ok({ ...list, conversations: list.conversations.map((c) => {
        const f = filed.get(c.session_hash);
        return f ? { ...c, topic: f.category, topic_sub1: f.sub1, summary: f.summary, agent_wrote: f.agent_wrote, by: f.by, filing_key: f.key } : c;
      }) });
    }
    if (part === "transcript") {
      // the whole chat from HubSpot (the hub's own app): messages, agents, the hand-over
      const ticket = q.get("ticket") || "";
      if (!/^\d{5,20}$/.test(ticket)) return NextResponse.json({ ok: false, error: "Which ticket?" }, { status: 400 });
      return ok({ transcript: await chatTranscript(ticket) });
    }
    if (part === "conversation") {
      const hash = q.get("hash") || "";
      if (!/^[a-f0-9]{16,128}$/i.test(hash)) return NextResponse.json({ ok: false, error: "Which conversation?" }, { status: 400 });
      return ok(await orchestrator<ConversationDetail>(`/dashboard/conversation/${hash}`));
    }
    return NextResponse.json({ ok: false, error: `Unknown part "${part}"` }, { status: 400 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ ok: false, error: "No access" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const me = await requireUser();
  const who = me.full_name || me.username;
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  try {
    if (body.action === "test") {
      if (!orchestratorKey()) return NextResponse.json({ ok: false, error: "CHAT_ORCHESTRATOR_KEY is not set on the hub." }, { status: 503 });
      const message = str(body.message, 2000);
      if (!message) return NextResponse.json({ ok: false, error: "Type a message to test." }, { status: 400 });
      const language = LANGS.includes(str(body.language, 2)) ? str(body.language, 2) : "en";
      const country = COUNTRIES.includes(str(body.country, 3)) ? str(body.country, 3) : "CH";
      const conversationId = /^dashboard-test-\d+$/.test(str(body.conversationId, 40)) ? str(body.conversationId, 40) : undefined;
      try {
        const answer = await orchestrator<TestAnswer>("/dashboard/test-dry", {
          method: "POST", body: { message, language, country, conversationId }, timeoutMs: 80_000,
        });
        console.log(`[chat] test message by ${who} (${language}-${country}, ${answer._ms ?? "?"} ms)`);
        return NextResponse.json({ ok: true, data: answer });
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          return NextResponse.json({ ok: false, error: "The orchestrator does not have its test mode yet (APSOAssistant branch feat/chat-dry-run is not deployed) - the old test made real tickets, so the hub will not use it." }, { status: 409 });
        }
        throw err;
      }
    }
    if (body.action === "topic-set") {
      // a person's Enquiry Category for one chat: kept, the AI never files over it, and it goes to the ticket too
      const key = str(body.key, 160), category = str(body.category, 60), sub1 = str(body.sub1, 200) || null;
      if (!/^(hs|sb):[\w-]{6,140}$/.test(key) || !category) return NextResponse.json({ ok: false, error: "Which chat, which category?" }, { status: 400 });
      await setCategory(key, category, sub1, who);
      console.log(`[chat-topics] ${key.slice(0, 14)} filed under ${category}${sub1 ? ` / ${sub1}` : ""} by ${who}`);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "filing-write") {
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      if (typeof body.on !== "boolean") return NextResponse.json({ ok: false, error: "On or off?" }, { status: 400 });
      const s2 = await setWriteSwitch(body.on, who);
      console.log(`[chat-topics] writing the filing into HubSpot switched ${body.on ? "ON" : "off"} by ${who}`);
      return NextResponse.json({ ok: true, data: s2 });
    }
    if (body.action === "topics-run") {
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      const run = await fileNow();
      console.log(`[chat-topics] run by ${who}: ${run.filed} filed${run.error ? ` (${run.error})` : ""}`);
      return NextResponse.json({ ok: run.ok, data: run, error: run.ok ? undefined : run.error ?? undefined });
    }
    if (body.action === "web-mode-save") {
      // admins: off / acceptance only / preview / live - SARCLA's go-live switch
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      const s = await setWebMode(body.mode, who);
      console.log(`[chat-web] the chat on the shop: ${s.mode} - by ${who}`);
      return NextResponse.json({ ok: true, data: s });
    }
    if (body.action === "ab-save") {
      // admins: the A/B test's switch, countries and split on the shop chat's gateway
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      const s = await saveAb(body.ab, who);
      console.log(`[chat-ab] ${s.on ? "ON" : "off"} · ${s.countries.join(",") || "no country"} · ${s.split}% e-mail first · version ${s.v} - by ${who}`);
      return NextResponse.json({ ok: true, data: s });
    }
    if (body.action === "steering-save") {
      // admins: the topics' routes - checked against HubSpot's options, the old ones kept in the hub's log
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      const { steering: s, pushed } = await saveSteering(body.steering, who);
      console.log(`[chat-steering] routes saved by ${who} (version ${s.version})${pushed ? " - sent to the chat's brain" : " - the brain was not reached"}`);
      return NextResponse.json({ ok: true, data: { ...s, pushed } });
    }
    if (body.action === "orchestrator") {
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      const setting = await setOrchestrator(str(body.url, 200), who);
      console.log(`[chat] orchestrator address set to ${setting.url} by ${who}`);
      return NextResponse.json({ ok: true, data: setting });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}
