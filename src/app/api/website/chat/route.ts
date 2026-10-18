// CHAT: what the orchestrator on Railway says about the shop chat - its numbers, the conversations, the
// hand-overs to TSA and Back Office - read for the hub's page (Website's grant), and its test bench. Same three
// answers as every integration route: not configured, upstream failed (with the reason), or the data.
//   GET ?part=overview&days=30 | conversations&limit=&offset=&escalated=1&language=&category= | conversation&hash=
//       (counted per CHAT - /dashboard/chat-stats, /dashboard/chats; on an orchestrator without them, per message, marked)
//       | transcript&ticket= (the whole chat from HubSpot, hand-over included)
//       | setup (answers without the key: the address, /health, whether the key is set)
//       | topics&days= | topic-chats&topic=&days=&offset= (filed by the hub after each chat: src/lib/chat/topics.ts)
//   POST { action: "topic-set", session_hash, topic } (anyone with Website: a person's topic, never filed over) | { action: "topics-run" } (admins)
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
import { fileNow, setTopic, topicChats, topicSummary, topicsFor } from "@/lib/chat/topics";
import { TOPICS, type TopicKey } from "@/lib/chat/shape";

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
    if (part === "topics" || part === "topic-chats") {
      // filed by the hub itself (apsomh_chat_topics): counted from go-live at the earliest
      const days = int(q.get("days"), 30, 1, 400);
      const from = new Date(Math.max(Date.now() - days * 86_400_000, Date.parse(`${LIVE_FROM}T00:00:00Z`))).toISOString();
      if (part === "topics") return ok({ ...(await topicSummary(from)), from, isAdmin });
      const topic = q.get("topic") || "";
      return ok(await topicChats(topic, from, int(q.get("offset"), 0, 0, 100_000), int(q.get("limit"), 20, 1, 100)));
    }
    if (part === "setup") {
      const [setting, health] = await Promise.all([orchestratorSetting(), orchestratorHealth()]);
      return ok({ setting, health, keySet: !!orchestratorKey(), isAdmin });
    }
    if (!orchestratorKey()) return NextResponse.json({ configured: false, missing: ["CHAT_ORCHESTRATOR_KEY"] });
    if (part === "overview") {
      // never back past go-live: the test phase (23.03-12.04.2026, ~9,300 scripted chats) would swamp everything
      const live = Math.max(1, Math.ceil((Date.now() - Date.parse(`${LIVE_FROM}T00:00:00Z`)) / 86_400_000));
      const asked = int(q.get("days"), 30, 1, 365);
      const days = Math.min(asked, live);
      const [stats, recent, health] = await Promise.all([
        perChat<Stats>(`/dashboard/chat-stats?days=${days}`, `/dashboard/stats?days=${days}`),
        perChat<Conversations>("/dashboard/chats?limit=8", "/dashboard/conversations?limit=8"),
        orchestratorHealth(),
      ]);
      // the hub's own filing of the same period (Topics), when it has filed any - else the page shows the chat's own guess
      const topics = await topicSummary(new Date(Date.now() - days * 86_400_000).toISOString()).then((t) => ({ rows: t.rows, filed: t.filed })).catch(() => null);
      return ok({ stats, recent: recent.conversations, health, liveFrom: LIVE_FROM, cappedAtLive: asked > live, topics });
    }
    if (part === "conversations") {
      // since go-live: the orchestrator leaves the test phase out of the list and its count (one without since ignores it)
      const p = new URLSearchParams({ limit: String(int(q.get("limit"), 25, 1, 200)), offset: String(int(q.get("offset"), 0, 0, 1_000_000)), since: LIVE_FROM });
      if (q.get("escalated") === "1") p.set("escalated", "true");
      const lang = (q.get("language") || "").toLowerCase();
      if (LANGS.includes(lang)) p.set("language", lang);
      const cat = (q.get("category") || "").slice(0, 100);
      if (cat) p.set("category", cat);
      const list = await perChat<Conversations>(`/dashboard/chats?${p}`, `/dashboard/conversations?${p}`);
      // the hub's filed topic and one-line summary on each chat, for the inbox list (none yet = the chat's own guess)
      const filed = await topicsFor(list.conversations.map((c) => c.session_hash)).catch(() => new Map());
      return ok({ ...list, conversations: list.conversations.map((c) => ({ ...c, ...(filed.get(c.session_hash) ?? {}) })) });
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
      // a person's topic for one chat: kept, and the AI never files over it
      const hash = str(body.session_hash, 128), topic = str(body.topic, 40);
      if (!/^[a-f0-9]{16,128}$/i.test(hash) || !TOPICS.some((t) => t.key === topic)) return NextResponse.json({ ok: false, error: "Which chat, which topic?" }, { status: 400 });
      await setTopic(hash, topic as TopicKey, who);
      console.log(`[chat-topics] ${hash.slice(0, 10)} filed under ${topic} by ${who}`);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "topics-run") {
      if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
      const run = await fileNow();
      console.log(`[chat-topics] run by ${who}: ${run.filed} filed${run.error ? ` (${run.error})` : ""}`);
      return NextResponse.json({ ok: run.ok, data: run, error: run.ok ? undefined : run.error ?? undefined });
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
