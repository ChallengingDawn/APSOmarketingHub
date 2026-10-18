// CHAT TOPICS - what each real chat was about, filed after the chat from the whole conversation (SARCLA 18.10.2026:
// "this detection doesn't work really well today, we should have a different tab to keep this updated always").
//
// The orchestrator files a chat while it is still talking (category_code). Since go-live about 30% of real chats
// ended with no category and many in "Others"; the 9,300 test chats of the test phase added "Not classified" on top.
// Here the filing happens AFTER the chat, from everything that was said:
//   every 20 minutes the hub takes the real chats it has not filed yet - since go-live (LIVE_FROM), with a ticket,
//   quiet for 30 minutes - reads each whole chat from HubSpot (transcript.ts), strips e-mail addresses and phone
//   numbers, and asks a small Claude model for ONE topic from the fixed list below plus a one-line summary.
// Stored in apsomh_chat_topics. A person's correction (by = their name) is kept and never overwritten; a chat the AI
// filed is filed again if it went on after that. CHAT_TOPICS=off stops the job; the tab's "File now" runs it once.

import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { getAnthropic } from "@/lib/ai/claude";
import { orchestrator, orchestratorKey } from "./orchestrator";
import { chatTranscript } from "./transcript";
import { LIVE_FROM, TOPICS, type Conversation, type Conversations, type TopicKey, type TopicsRun } from "./shape";

const TABLE = "apsomh_chat_topics";
const TOPICS_LOCK = 4_107_230;              // DoC 4107201 … partner stock 4107221 taken; this one is the chat topics'
const TICK_MS = 20 * 60_000;
const PER_RUN = 120;                         // ~2,700 real chats since go-live: the backlog clears in about 8 hours
const QUIET_MS = 30 * 60_000;               // a chat still going is not filed yet
const MODEL = process.env.CHAT_TOPICS_MODEL || "claude-haiku-5-5";
export const KV_RUN = "chat:topics:last-run";

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      session_hash text PRIMARY KEY,
      ticket_id text,
      started_at timestamptz,
      last_at timestamptz,
      language text,
      handed boolean NOT NULL DEFAULT false,
      team text,
      agent_wrote boolean,
      topic text NOT NULL,
      summary text NOT NULL DEFAULT '',
      service_category text,
      by text NOT NULL DEFAULT 'ai',
      model text,
      filed_at timestamptz NOT NULL DEFAULT now()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS ${TABLE}_started ON ${TABLE} (started_at)`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/** Every real chat since go-live, newest first, from the orchestrator's per-chat list. */
async function realChats(): Promise<Conversation[]> {
  const out: Conversation[] = [];
  for (let offset = 0; offset < 20_000; offset += 200) {
    const r = await orchestrator<Conversations>(`/dashboard/chats?limit=200&offset=${offset}`);
    const page = r.conversations ?? [];
    out.push(...page);
    if (page.length < 200 || page.some((c) => (c.started_at ?? "") < LIVE_FROM)) break;
  }
  return out.filter((c) => c.hubspot_ticket_id && (c.started_at ?? "") >= LIVE_FROM);
}

// e-mail addresses and phone numbers stay out of what the model sees; article and order numbers stay in
const redact = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
  .replace(/(?:\+|\b00)\d{2}[\d\s/().-]{7,}\d/g, "[phone]")
  .replace(/\b0\d{2}[ /]\d{3} ?\d{2} ?\d{2}\b/g, "[phone]");

const SYSTEM = `You file customer chats of APSOparts, an industrial web shop (seals, O-rings, hoses, plastics, drive and
vibration parts) run by Angst+Pfister, under exactly ONE topic - the customer's main reason for writing - and write a
one-sentence English summary (max 20 words) of what the customer wanted and how it ended. The chat is in any language.
Topics:
${TOPICS.map((t) => `- ${t.key}: ${t.label} (${t.hint})`).join("\n")}
Answer as JSON {"topic": "<key>", "summary": "<sentence>"}. If the customer never asked anything, use "other".`;

export async function classifyChat(c: Conversation, client: NonNullable<ReturnType<typeof getAnthropic>>):
  Promise<{ topic: TopicKey; summary: string; agentWrote: boolean | null } | null> {
  const t = await chatTranscript(c.hubspot_ticket_id!);
  if (!t) return null;
  const lines = t.items.filter((m) => m.who !== "system")
    .map((m) => `${m.who === "customer" ? "Customer" : m.who === "ai" ? "APSOassistant" : "Agent"}: ${redact(m.text)}`);
  if (!lines.some((l) => l.startsWith("Customer:"))) return { topic: "other", summary: "The customer wrote nothing.", agentWrote: t.agentMessages > 0 };
  let chat = lines.join("\n");
  if (chat.length > 9000) chat = `${chat.slice(0, 6000)}\n[…]\n${chat.slice(-2500)}`;
  const keys = TOPICS.map((x) => x.key);
  const ask = async () => {
    const msg = await client.messages.create({
      model: MODEL, max_tokens: 300, system: SYSTEM,
      messages: [{ role: "user", content: chat }],
      output_config: { format: { type: "json_schema", schema: {
        type: "object", additionalProperties: false, required: ["topic", "summary"],
        properties: { topic: { type: "string", enum: keys }, summary: { type: "string" } },
      } } },
    } as Parameters<typeof client.messages.create>[0]) as { content: { type: string; text?: string }[] };
    return msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  };
  // one answer in a few hundred came back without its JSON (18.10.2026 trial): ask once more before giving up -
  // a chat that still fails is not stored, so the next run tries it again
  let j: { topic?: string; summary?: string } | null = null;
  let last = "";
  for (let attempt = 0; attempt < 2 && !j; attempt++) {
    last = await ask();
    const a = last.indexOf("{"), b = last.lastIndexOf("}");
    try { if (a >= 0 && b > a) j = JSON.parse(last.slice(a, b + 1)); } catch { j = null; }
  }
  if (!j) throw new Error(`the model's answer had no topic: "${last.slice(0, 80)}"`);
  const topic = (keys as readonly string[]).includes(j.topic ?? "") ? (j.topic as TopicKey) : "other";
  return { topic, summary: String(j.summary ?? "").slice(0, 240), agentWrote: t.agentMessages > 0 };
}

/** One filing run: the chats not filed yet (or filed by the AI before they went on), up to PER_RUN. */
export async function fileTopics(opts: { max?: number } = {}): Promise<TopicsRun> {
  const at = new Date().toISOString();
  const client = getAnthropic();
  if (!client) return { at, ok: false, filed: 0, unreadable: 0, failed: 0, waiting: null, error: "ANTHROPIC_API_KEY is not set on the hub" };
  if (!orchestratorKey()) return { at, ok: false, filed: 0, unreadable: 0, failed: 0, waiting: null, error: "CHAT_ORCHESTRATOR_KEY is not set on the hub" };
  await ensure();
  const chats = await realChats();
  const known = new Map((await query<{ session_hash: string; last_at: string | null; by: string }>(
    `SELECT session_hash, last_at, by FROM ${TABLE}`)).rows.map((r) => [r.session_hash, r]));
  const quiet = Date.now() - QUIET_MS;
  const todo = chats.filter((c) => {
    if (Date.parse(c.last_at ?? c.started_at) > quiet) return false;
    const k = known.get(c.session_hash);
    if (!k) return true;
    return k.by === "ai" && !!c.last_at && (!k.last_at || Date.parse(c.last_at) > Date.parse(k.last_at) + 1000);
  });
  let filed = 0, unreadable = 0, failed = 0, firstError: string | null = null;
  for (const c of todo.slice(0, opts.max ?? PER_RUN)) {
    try {
      const r = await classifyChat(c, client);
      const row = r ?? { topic: "unreadable" as const, summary: "HubSpot no longer holds this chat.", agentWrote: null };
      await query(
        `INSERT INTO ${TABLE} (session_hash, ticket_id, started_at, last_at, language, handed, team, agent_wrote, topic, summary, service_category, by, model, filed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ai',$12,now())
         ON CONFLICT (session_hash) DO UPDATE SET ticket_id=$2, started_at=$3, last_at=$4, language=$5, handed=$6, team=$7,
           agent_wrote=$8, topic=$9, summary=$10, service_category=$11, model=$12, filed_at=now()
         WHERE ${TABLE}.by = 'ai'`,
        [c.session_hash, c.hubspot_ticket_id, c.started_at, c.last_at ?? c.started_at, c.language_code, !!c.escalated, c.routing_team,
          row.agentWrote, row.topic, row.summary, c.category_code, r ? MODEL : null]);
      if (r) filed++; else unreadable++;
    } catch (e) {
      failed++;
      firstError ??= String((e as Error)?.message ?? e).slice(0, 200);
    }
  }
  return { at, ok: failed === 0 || filed > 0, filed, unreadable, failed, waiting: Math.max(0, todo.length - filed - unreadable), error: firstError };
}

/** A person's topic for one chat: kept, never filed over by the AI again. */
export async function setTopic(sessionHash: string, topic: TopicKey, by: string): Promise<void> {
  await ensure();
  // filed by the AI or not yet: either way this becomes the chat's topic, and the job leaves it alone (by <> 'ai')
  await query(`INSERT INTO ${TABLE} (session_hash, topic, by) VALUES ($1,$2,$3)
    ON CONFLICT (session_hash) DO UPDATE SET topic=$2, by=$3, filed_at=now()`, [sessionHash, topic, by]);
}

export type TopicRow = { topic: string; chats: number; handed: number; agentWrote: number; byPerson: number };
export type TopicChat = {
  session_hash: string; ticket_id: string | null; started_at: string | null; last_at: string | null; language: string | null;
  handed: boolean; team: string | null; agent_wrote: boolean | null; topic: string; summary: string; service_category: string | null; by: string;
};

/** The topics in a period (chats that started in it), and what the job has left. */
export async function topicSummary(fromIso: string): Promise<{ rows: TopicRow[]; filed: number; byPerson: number; run: TopicsRun | null }> {
  await ensure();
  const r = await query<{ topic: string; chats: string; handed: string; agent_wrote: string; by_person: string }>(
    `SELECT topic, COUNT(*) AS chats, SUM(handed::int) AS handed, SUM(COALESCE(agent_wrote,false)::int) AS agent_wrote,
            SUM((by <> 'ai')::int) AS by_person
       FROM ${TABLE} WHERE started_at >= $1 GROUP BY topic ORDER BY COUNT(*) DESC`, [fromIso]);
  const rows = r.rows.map((x) => ({ topic: x.topic, chats: Number(x.chats), handed: Number(x.handed), agentWrote: Number(x.agent_wrote), byPerson: Number(x.by_person) }));
  return { rows, filed: rows.reduce((a, x) => a + x.chats, 0), byPerson: rows.reduce((a, x) => a + x.byPerson, 0), run: (await kvGet<TopicsRun>(KV_RUN).catch(() => undefined)) ?? null };
}

export async function topicChats(topic: string, fromIso: string, offset: number, limit: number): Promise<{ chats: TopicChat[]; total: number }> {
  await ensure();
  const [rows, count] = await Promise.all([
    query<TopicChat>(`SELECT session_hash, ticket_id, started_at, last_at, language, handed, team, agent_wrote, topic, summary, service_category, by
                        FROM ${TABLE} WHERE topic = $1 AND started_at >= $2 ORDER BY last_at DESC NULLS LAST LIMIT $3 OFFSET $4`, [topic, fromIso, limit, offset]),
    query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE topic = $1 AND started_at >= $2`, [topic, fromIso]),
  ]);
  return { chats: rows.rows, total: Number(count.rows[0]?.n ?? 0) };
}

/* ── the job: every 20 minutes, one of the hub's two copies (an advisory lock) ──────────────────────── */

async function tick(): Promise<void> {
  let client;
  try { client = await getPool().connect(); } catch (e) { console.warn(`[chat-topics] tick skipped: ${(e as Error).message}`); return; }
  let run: TopicsRun | null = null;
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [TOPICS_LOCK]);
    if (!got.rows[0]?.ok) return;                      // the other copy is filing
    try {
      run = await fileTopics();
      if (run.filed || run.failed) console.log(`[chat-topics] ${run.filed} filed · ${run.unreadable} unreadable · ${run.failed} failed · ${run.waiting} waiting${run.error ? ` · ${run.error}` : ""}`);
    } catch (e) {
      run = { at: new Date().toISOString(), ok: false, filed: 0, unreadable: 0, failed: 0, waiting: null, error: String((e as Error)?.message ?? e).slice(0, 200) };
      console.warn(`[chat-topics] run failed: ${run.error}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [TOPICS_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
  if (run) await kvSet(KV_RUN, run).catch(() => {});
}

let started = false;
export function startChatTopics(): void {
  if (started || String(process.env.CHAT_TOPICS ?? "").toLowerCase() === "off") return;
  started = true;
  console.log(`[chat-topics] on: real chats filed by topic every 20 min (${MODEL})`);
  setInterval(() => void tick(), TICK_MS).unref?.();
  setTimeout(() => void tick(), 6 * 60_000).unref?.();   // after the boot rush
}

/** The tab's "File now": the same run, under the same lock. */
export async function fileNow(): Promise<TopicsRun> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [TOPICS_LOCK]);
    if (!got.rows[0]?.ok) return { at: new Date().toISOString(), ok: false, filed: 0, unreadable: 0, failed: 0, waiting: null, error: "A filing run is going on right now - try again in a few minutes." };
    try {
      const run = await fileTopics({ max: 20 });   // ~3 s a chat: inside the page's 90-second answer
      await kvSet(KV_RUN, run).catch(() => {});
      return run;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [TOPICS_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
