// CHAT FILING - what each chat was about, filed AFTER it ended from the whole conversation, in HubSpot's own terms
// (SARCLA 18.10.2026: "this detection doesn't work really well today, we should have a different tab to keep this
// updated always" - then: "this should be filled into the property; these definitions should be the property's ones;
// backfill the previous ones to have a clear picture"; "Others" stays Others; preview first, then a switch).
//
// While it talks, the orchestrator files a chat itself, and turns "Others" into "Product Information": 82% of the
// 2,384 chat tickets since go-live said Product Information on 18.10.2026. Here, every 20 minutes:
//   1. FILE - the real chats not filed yet (since go-live, with a ticket, quiet for 30 minutes) and the search bar's
//      AI conversations: each whole chat is read (HubSpot via transcript.ts; the smart-bar gateway), e-mail addresses
//      and phone numbers are stripped, and a small Claude model picks the ticket property Enquiry Category, its
//      sub-categories (the options HubSpot defines, re-read every run) and writes a one-line summary.
//   2. HUBSPOT - each filed HubSpot chat's ticket is read; the category and sub-categories go onto it, the summary into
//      the category's "add more details" box when that box is empty. A category a PERSON set in HubSpot (the property's
//      own history says so) is never overwritten - the chat is "kept". With the switch off (the default) nothing is
//      written: the run only works out what WOULD change, which the Topics tab shows. An admin switches writing on.
// Stored in apsomh_chat_filing. A person's correction in the hub (by = their name) is kept and also written to
// HubSpot. CHAT_TOPICS=off stops the job; the tab's "File now" runs it once.

import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { getAnthropic } from "@/lib/ai/claude";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { gateway as searchBarGateway, adminToken as searchBarKey, type AiConversations } from "@/lib/searchbar/gateway";
import { orchestrator, orchestratorKey } from "./orchestrator";
import { chatTranscript } from "./transcript";
import { CATEGORIES, LIVE_FROM, type CategoryDef, type Conversation, type Conversations, type HsState, type TopicsRun } from "./shape";

const TABLE = "apsomh_chat_filing";
const TOPICS_LOCK = 4_107_230;              // DoC 4107201 … partner stock 4107221 taken; this one is the chat filing's
const TICK_MS = 20 * 60_000;
const PER_RUN = 120;                         // ~2,400 real chats since go-live: the backlog clears in about 7 hours
const HS_PER_RUN = 400;                      // tickets read (and, when on, written) per run, 100 a call
const QUIET_MS = 30 * 60_000;               // a chat still going is not filed yet
const MODEL = process.env.CHAT_TOPICS_MODEL || "claude-haiku-5-5";
export const KV_RUN = "chat:topics:last-run";
const KV_WRITE = "chat:filing:hubspot-write";
/** a change made by a person, in HubSpot's property history */
const PERSON_SOURCES = new Set(["CRM_UI", "MOBILE_IOS", "MOBILE_ANDROID", "IMPORT"]);

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      key text PRIMARY KEY,
      source text NOT NULL,
      ref text NOT NULL,
      ticket_id text,
      started_at timestamptz,
      last_at timestamptz,
      language text,
      handed boolean NOT NULL DEFAULT false,
      team text,
      agent_wrote boolean,
      category text NOT NULL,
      sub1 text,
      sub2 text,
      summary text NOT NULL DEFAULT '',
      service_category text,
      by text NOT NULL DEFAULT 'ai',
      model text,
      filed_at timestamptz NOT NULL DEFAULT now(),
      hs_state text,
      hs_before jsonb,
      hs_note text,
      hs_at timestamptz
    )`);
    await query(`CREATE INDEX IF NOT EXISTS ${TABLE}_started ON ${TABLE} (started_at)`);
    await query(`CREATE INDEX IF NOT EXISTS ${TABLE}_hs ON ${TABLE} (hs_state)`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/* ── the property's definitions, from HubSpot ─────────────────────────────────────────────────────── */

let defsCache: { at: number; defs: CategoryDef[] } | null = null;
/** CATEGORIES with each sub-category's options as HubSpot has them right now (fallback: the copy in shape.ts). */
export async function definitions(): Promise<CategoryDef[]> {
  if (defsCache && Date.now() - defsCache.at < 60 * 60_000) return defsCache.defs;
  const live = async (prop: string, fallback: string[]) => {
    try {
      const p = await hubspotFetchJson<{ options?: { value: string; hidden?: boolean }[] }>({ path: `/crm/v3/properties/tickets/${prop}` });
      const v = (p.options ?? []).filter((o) => !o.hidden).map((o) => o.value);
      return v.length ? v : fallback;
    } catch { return fallback; }
  };
  const top = await live("enquiry_category", CATEGORIES.map((c) => c.value));
  const defs: CategoryDef[] = [];
  for (const c of CATEGORIES) {
    if (!top.includes(c.value)) continue;                       // gone from HubSpot: not offered
    defs.push({
      ...c,
      sub1: c.sub1 ? { prop: c.sub1.prop, options: await live(c.sub1.prop, c.sub1.options) } : undefined,
      sub2: c.sub2 ? { prop: c.sub2.prop, options: await live(c.sub2.prop, c.sub2.options) } : undefined,
    });
  }
  defsCache = { at: Date.now(), defs };
  return defs;
}

/* ── 1. filing ──────────────────────────────────────────────────────────────────────────────────── */

/** Every real chat since go-live, newest first, from the orchestrator's per-chat list. */
async function realChats(): Promise<Conversation[]> {
  const out: Conversation[] = [];
  for (let offset = 0; offset < 20_000; offset += 200) {
    const r = await orchestrator<Conversations>(`/dashboard/chats?limit=200&offset=${offset}&since=${LIVE_FROM}`);
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

function systemPrompt(defs: CategoryDef[]): string {
  const lines = defs.filter((d) => d.aiChoice).map((d) => {
    const s1 = d.sub1 ? `\n    sub1 (one of, or ""): ${d.sub1.options.map((o) => JSON.stringify(o)).join(", ")}` : "";
    const s2 = d.sub2 ? `\n    sub2 (one of, or ""): ${d.sub2.options.map((o) => JSON.stringify(o)).join(", ")}` : "";
    return `- ${JSON.stringify(d.value)}: ${d.hint}${s1}${s2}`;
  }).join("\n");
  return `You file customer chats of APSOparts, an industrial web shop (seals, O-rings, hoses, plastics, drive and
vibration parts) run by Angst+Pfister, the way its HubSpot tickets are filed: the ticket property "Enquiry Category"
and, where it has them, its sub-categories - the customer's main reason for writing. Use only the values below, written
exactly. Then write a one-sentence English summary (max 20 words) of what the customer wanted and how it ended. The
chat can be in any language. Certificates and conformities go under "Product Information".
${lines}
Answer as JSON {"category": "...", "sub1": "...", "sub2": "...", "summary": "..."}.`;
}

type Filed = { category: string; sub1: string | null; sub2: string | null; summary: string };

async function ask(client: NonNullable<ReturnType<typeof getAnthropic>>, defs: CategoryDef[], chat: string): Promise<Filed> {
  const cats = defs.filter((d) => d.aiChoice).map((d) => d.value);
  const once = async (structured: boolean) => {
    const msg = await client.messages.create({
      // the cap covers the model's thinking too: at 300, 2 answers in 15 stopped mid-sentence (18.10.2026)
      model: MODEL, max_tokens: 2000, system: systemPrompt(defs),
      messages: [{ role: "user", content: chat }],
      ...(structured ? { output_config: { format: { type: "json_schema", schema: {
        type: "object", additionalProperties: false, required: ["category", "sub1", "sub2", "summary"],
        properties: { category: { type: "string", enum: cats }, sub1: { type: "string" }, sub2: { type: "string" }, summary: { type: "string" } },
      } } } } : {}),
    } as Parameters<typeof client.messages.create>[0]) as { stop_reason?: string; content: { type: string; text?: string }[]; usage?: { output_tokens?: number } };
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    return { text, why: `stop ${msg.stop_reason ?? "?"}, blocks ${msg.content.map((b) => b.type).join("+") || "none"}, ${msg.usage?.output_tokens ?? "?"} tokens out` };
  };
  // one answer in five came back EMPTY in production on 18.10 (never locally): try the structured answer twice, then
  // plain JSON; a chat that still fails is not stored, so the next run asks again - and the error says what came back
  let j: { category?: string; sub1?: string; sub2?: string; summary?: string } | null = null;
  let last = { text: "", why: "" };
  for (const structured of [true, true, false]) {
    last = await once(structured);
    const a = last.text.indexOf("{"), b = last.text.lastIndexOf("}");
    try { if (a >= 0 && b > a) j = JSON.parse(last.text.slice(a, b + 1)); } catch { j = null; }
    if (j) break;
  }
  if (!j) throw new Error(`no answer from the model (${last.why}): "${last.text.slice(0, 60)}"`);
  const def = defs.find((d) => d.value === j!.category && d.aiChoice) ?? defs.find((d) => d.value === "Others")!;
  const pick = (v: string | undefined, sub: CategoryDef["sub1"]) => (v && sub?.options.includes(v) ? v : null);
  return { category: def.value, sub1: pick(j.sub1, def.sub1), sub2: pick(j.sub2, def.sub2), summary: String(j.summary ?? "").slice(0, 240) };
}

/** One HubSpot chat: its whole conversation, filed. Null when HubSpot no longer holds it. */
export async function classifyChat(c: Conversation, client: NonNullable<ReturnType<typeof getAnthropic>>, defs: CategoryDef[]):
  Promise<(Filed & { agentWrote: boolean }) | null> {
  const t = await chatTranscript(c.hubspot_ticket_id!);
  if (!t) return null;
  const lines = t.items.filter((m) => m.who !== "system")
    .map((m) => `${m.who === "customer" ? "Customer" : m.who === "ai" ? "APSOassistant" : "Agent"}: ${redact(m.text)}`);
  if (!lines.some((l) => l.startsWith("Customer:"))) return { category: "Others", sub1: null, sub2: null, summary: "The customer wrote nothing.", agentWrote: t.agentMessages > 0 };
  let chat = lines.join("\n");
  if (chat.length > 9000) chat = `${chat.slice(0, 6000)}\n[…]\n${chat.slice(-2500)}`;
  return { ...(await ask(client, defs, chat)), agentWrote: t.agentMessages > 0 };
}

const UPSERT = `INSERT INTO ${TABLE} (key, source, ref, ticket_id, started_at, last_at, language, handed, team, agent_wrote, category, sub1, sub2,
    summary, service_category, by, model, filed_at, hs_state)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'ai',$16,now(),$17)
  ON CONFLICT (key) DO UPDATE SET ticket_id=$4, started_at=$5, last_at=$6, language=$7, handed=$8, team=$9, agent_wrote=$10,
    category=$11, sub1=$12, sub2=$13, summary=$14, service_category=$15, model=$16, filed_at=now(), hs_state=$17
  WHERE ${TABLE}.by = 'ai'`;

/** One filing run: the chats not filed yet (or filed by the AI before they went on), up to PER_RUN, then the bar's. */
export async function fileTopics(opts: { max?: number } = {}): Promise<TopicsRun> {
  const at = new Date().toISOString();
  const client = getAnthropic();
  const none = { at, filed: 0, unreadable: 0, failed: 0, waiting: null };
  if (!client) return { ...none, ok: false, error: "ANTHROPIC_API_KEY is not set on the hub" };
  if (!orchestratorKey()) return { ...none, ok: false, error: "CHAT_ORCHESTRATOR_KEY is not set on the hub" };
  await ensure();
  const defs = await definitions();
  const chats = await realChats();
  const known = new Map((await query<{ ref: string; last_at: string | null; by: string }>(
    `SELECT ref, last_at, by FROM ${TABLE} WHERE source = 'chat'`)).rows.map((r) => [r.ref, r]));
  const quiet = Date.now() - QUIET_MS;
  const todo = chats.filter((c) => {
    if (Date.parse(c.last_at ?? c.started_at) > quiet) return false;
    const k = known.get(c.session_hash);
    if (!k) return true;
    return k.by === "ai" && !!c.last_at && (!k.last_at || Date.parse(c.last_at) > Date.parse(k.last_at) + 1000);
  });
  const max = opts.max ?? PER_RUN;
  let filed = 0, unreadable = 0, failed = 0, firstError: string | null = null;
  for (const c of todo.slice(0, max)) {
    try {
      const r = await classifyChat(c, client, defs);
      const row = r ?? { category: "unreadable", sub1: null, sub2: null, summary: "HubSpot no longer holds this chat.", agentWrote: null };
      await query(UPSERT, [`hs:${c.session_hash}`, "chat", c.session_hash, c.hubspot_ticket_id, c.started_at, c.last_at ?? c.started_at, c.language_code,
        !!c.escalated, c.routing_team, row.agentWrote, row.category, row.sub1, row.sub2, row.summary, c.category_code, r ? MODEL : null, r ? "pending" : null]);
      if (r) filed++; else unreadable++;
    } catch (e) {
      failed++;
      firstError ??= String((e as Error)?.message ?? e).slice(0, 240);
    }
  }
  // the search bar's AI conversations, so its tab reads like the others (no ticket: nothing goes to HubSpot)
  if (filed + unreadable + failed < max && searchBarKey()) {
    try { filed += await fileSearchBar(client, defs, max - filed - unreadable - failed); } catch (e) { firstError ??= `search bar: ${String((e as Error).message).slice(0, 160)}`; }
  }
  return { at, ok: failed === 0 || filed > 0, filed, unreadable, failed, waiting: Math.max(0, todo.length - filed - unreadable), error: firstError };
}

export async function fileSearchBar(client: NonNullable<ReturnType<typeof getAnthropic>>, defs: CategoryDef[], room: number): Promise<number> {
  const d = await searchBarGateway<AiConversations>("/api/smart-bar/ai-conversations?limit=200&archived=0");
  const known = new Set((await query<{ ref: string }>(`SELECT ref FROM ${TABLE} WHERE source = 'searchbar'`)).rows.map((r) => r.ref));
  let n = 0;
  for (const c of (d.conversations ?? []).filter((x) => !known.has(x.query_id)).slice(0, room)) {
    const chat = c.turns.map((t) => `${t.role === "user" ? "Customer" : "APSOassistant"}: ${redact(t.text ?? "")}`).join("\n").slice(0, 9000);
    if (!chat.includes("Customer:")) continue;
    const r = await ask(client, defs, chat);
    const last = c.turns.at(-1)?.ts || c.ts;
    await query(UPSERT, [`sb:${c.query_id}`, "searchbar", c.query_id, null, c.ts, last, (c.locale || "").split("-")[0] || null,
      false, null, null, r.category, r.sub1, r.sub2, r.summary, null, MODEL, null]);
    n++;
  }
  return n;
}

/* ── 2. the HubSpot side ─────────────────────────────────────────────────────────────────────────── */

export type WriteSwitch = { on: boolean; by: string | null; at: string | null };
export async function writeSwitch(): Promise<WriteSwitch> {
  const s = await kvGet<WriteSwitch>(KV_WRITE).catch(() => undefined);
  return s ?? { on: false, by: null, at: null };
}
export async function setWriteSwitch(on: boolean, by: string): Promise<WriteSwitch> {
  const s = { on, by, at: new Date().toISOString() };
  await kvSet(KV_WRITE, s);
  return s;
}

type Ticket = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, { value: string; timestamp: string; sourceType: string; updatedByUserId?: number }[]> };

/** The ticket fields a filing touches: the category, every category's sub-categories and "add more details" box. */
function fieldList(defs: CategoryDef[]): string[] {
  return ["enquiry_category", ...defs.flatMap((d) => [d.sub1?.prop, d.sub2?.prop, d.text].filter((x): x is string => !!x))];
}

/**
 * Bring HubSpot in line with the filing: read the tickets of filed chats not done yet (pending, or a preview not
 * written), decide, and - when the switch is on - write. "kept": a person set the category in HubSpot (its history).
 * "same": HubSpot already says it. "would-write": what writing would change (the preview keeps the old values).
 */
export async function syncHubSpot(opts: { max?: number } = {}): Promise<NonNullable<TopicsRun["hubspot"]>> {
  await ensure();
  const sw = await writeSwitch();
  const defs = await definitions();
  const out = { written: 0, same: 0, kept: 0, wouldWrite: 0, errors: 0, mode: sw.on ? ("write" as const) : ("preview" as const) };
  const rows = (await query<{ key: string; ticket_id: string; category: string; sub1: string | null; sub2: string | null; summary: string; by: string }>(
    `SELECT key, ticket_id, category, sub1, sub2, summary, by FROM ${TABLE}
      WHERE source = 'chat' AND ticket_id IS NOT NULL AND category <> 'unreadable'
        AND (hs_state = 'pending' OR (hs_state = 'would-write' AND $1::boolean))
      ORDER BY last_at DESC NULLS LAST LIMIT $2`, [sw.on, opts.max ?? HS_PER_RUN])).rows;
  const fields = fieldList(defs);
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    let tickets: Ticket[] = [];
    try {
      const r = await hubspotFetchJson<{ results?: Ticket[] }>({
        path: "/crm/v3/objects/tickets/batch/read", method: "POST",
        body: { inputs: batch.map((x) => ({ id: x.ticket_id })), properties: fields, propertiesWithHistory: ["enquiry_category"] },
      });
      tickets = r.results ?? [];
    } catch (e) {
      out.errors += batch.length;
      await query(`UPDATE ${TABLE} SET hs_note = $2, hs_at = now() WHERE key = ANY($1)`, [batch.map((x) => x.key), `read failed: ${String((e as Error).message).slice(0, 150)}`]);
      continue;
    }
    const byId = new Map(tickets.map((t) => [String(t.id), t]));
    const updates: { id: string; properties: Record<string, string> }[] = [];
    const decided: { key: string; state: HsState; before: Record<string, string | null> | null; note: string | null }[] = [];
    for (const x of batch) {
      const t = byId.get(String(x.ticket_id));
      if (!t) { decided.push({ key: x.key, state: "error", before: null, note: "the ticket is gone from HubSpot" }); out.errors++; continue; }
      const p = t.properties;
      const hist = t.propertiesWithHistory?.enquiry_category ?? [];
      const latest = [...hist].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      const before = Object.fromEntries(fields.map((f) => [f, p[f] ?? null]).filter(([, v]) => v));
      // a person's choice in HubSpot wins over the AI's - but a person's correction in the hub is written anyway
      if (x.by === "ai" && latest && PERSON_SOURCES.has(latest.sourceType)) {
        decided.push({ key: x.key, state: "kept", before, note: `set by a person in HubSpot: ${p.enquiry_category ?? "-"}` }); out.kept++; continue;
      }
      const def = defs.find((d) => d.value === x.category);
      const props: Record<string, string> = {};
      if (p.enquiry_category !== x.category) props.enquiry_category = x.category;
      if (def?.sub1 && x.sub1 && p[def.sub1.prop] !== x.sub1) props[def.sub1.prop] = x.sub1;
      if (def?.sub2 && x.sub2 && p[def.sub2.prop] !== x.sub2) props[def.sub2.prop] = x.sub2;
      if (def?.text && x.summary && !p[def.text]) props[def.text] = x.summary;     // the details box only when empty
      if (!Object.keys(props).length) { decided.push({ key: x.key, state: "same", before, note: null }); out.same++; continue; }
      if (!sw.on) { decided.push({ key: x.key, state: "would-write", before, note: JSON.stringify(props) }); out.wouldWrite++; continue; }
      updates.push({ id: String(x.ticket_id), properties: props });
      decided.push({ key: x.key, state: "written", before, note: JSON.stringify(props) });
    }
    if (updates.length) {
      try {
        await hubspotFetchJson({ path: "/crm/v3/objects/tickets/batch/update", method: "POST", body: { inputs: updates } });
        out.written += updates.length;
      } catch (e) {
        const msg = `write failed: ${String((e as Error).message).slice(0, 150)}`;
        for (const d of decided) if (d.state === "written") { d.state = "error"; d.note = msg; }
        out.errors += updates.length;
      }
    }
    for (const d of decided) {
      await query(`UPDATE ${TABLE} SET hs_state = $2, hs_before = $3, hs_note = $4, hs_at = now() WHERE key = $1`,
        [d.key, d.state, d.before ? JSON.stringify(d.before) : null, d.note]);
    }
  }
  return out;
}

/** A person's category for one chat, from the hub: kept, never filed over by the AI, and written to HubSpot. */
export async function setCategory(key: string, category: string, sub1: string | null, by: string): Promise<void> {
  await ensure();
  const def = (await definitions()).find((d) => d.value === category);
  if (!def) throw new Error("Not an Enquiry Category value");
  const s1 = sub1 && def.sub1?.options.includes(sub1) ? sub1 : null;
  await query(`UPDATE ${TABLE} SET category = $2, sub1 = $3, sub2 = CASE WHEN category = $2 THEN sub2 ELSE NULL END, by = $4, filed_at = now(),
      hs_state = CASE WHEN source = 'chat' THEN 'pending' ELSE NULL END WHERE key = $1`, [key, category, s1, by]);
}

/* ── what the page reads ─────────────────────────────────────────────────────────────────────────── */

export type CategoryRow = { category: string; chats: number; handed: number; agentWrote: number; byPerson: number; subs: { sub1: string; chats: number }[] };
export type FilingChat = {
  key: string; source: string; ref: string; ticket_id: string | null; started_at: string | null; last_at: string | null; language: string | null;
  handed: boolean; team: string | null; agent_wrote: boolean | null; category: string; sub1: string | null; sub2: string | null; summary: string;
  service_category: string | null; by: string; hs_state: HsState | null; hs_before: Record<string, string | null> | null; hs_note: string | null;
};
export type HubSpotSide = { mode: "preview" | "write"; switch: WriteSwitch; counts: Record<string, number> };

/** The categories of the HubSpot chats that started in the period, with their sub-categories, and the HubSpot side. */
export async function topicSummary(fromIso: string): Promise<{ rows: CategoryRow[]; filed: number; byPerson: number; run: TopicsRun | null; hubspot: HubSpotSide }> {
  await ensure();
  const r = await query<{ category: string; sub1: string | null; chats: string; handed: string; agent_wrote: string; by_person: string }>(
    `SELECT category, sub1, COUNT(*) AS chats, SUM(handed::int) AS handed, SUM(COALESCE(agent_wrote,false)::int) AS agent_wrote,
            SUM((by <> 'ai')::int) AS by_person
       FROM ${TABLE} WHERE source = 'chat' AND started_at >= $1 GROUP BY category, sub1`, [fromIso]);
  const m = new Map<string, CategoryRow>();
  for (const x of r.rows) {
    const c = m.get(x.category) ?? { category: x.category, chats: 0, handed: 0, agentWrote: 0, byPerson: 0, subs: [] };
    c.chats += Number(x.chats); c.handed += Number(x.handed); c.agentWrote += Number(x.agent_wrote); c.byPerson += Number(x.by_person);
    c.subs.push({ sub1: x.sub1 ?? "", chats: Number(x.chats) });
    m.set(x.category, c);
  }
  const rows = [...m.values()].sort((a, b) => b.chats - a.chats).map((c) => ({ ...c, subs: c.subs.sort((a, b) => b.chats - a.chats) }));
  const counts = Object.fromEntries((await query<{ hs_state: string | null; n: string }>(
    `SELECT hs_state, COUNT(*) AS n FROM ${TABLE} WHERE source = 'chat' GROUP BY hs_state`)).rows.map((x) => [x.hs_state ?? "none", Number(x.n)]));
  const sw = await writeSwitch();
  return {
    rows, filed: rows.reduce((a, x) => a + x.chats, 0), byPerson: rows.reduce((a, x) => a + x.byPerson, 0),
    run: (await kvGet<TopicsRun>(KV_RUN).catch(() => undefined)) ?? null,
    hubspot: { mode: sw.on ? "write" : "preview", switch: sw, counts },
  };
}

const CHAT_COLS = `key, source, ref, ticket_id, started_at, last_at, language, handed, team, agent_wrote, category, sub1, sub2, summary,
  service_category, by, hs_state, hs_before, hs_note`;

export async function topicChats(category: string, fromIso: string, offset: number, limit: number): Promise<{ chats: FilingChat[]; total: number }> {
  await ensure();
  const [rows, count] = await Promise.all([
    query<FilingChat>(`SELECT ${CHAT_COLS} FROM ${TABLE} WHERE source = 'chat' AND category = $1 AND started_at >= $2
      ORDER BY last_at DESC NULLS LAST LIMIT $3 OFFSET $4`, [category, fromIso, limit, offset]),
    query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE source = 'chat' AND category = $1 AND started_at >= $2`, [category, fromIso]),
  ]);
  return { chats: rows.rows, total: Number(count.rows[0]?.n ?? 0) };
}

/** What writing would change (or did): the chats in one HubSpot state, newest first. */
export async function hubspotChanges(state: HsState, offset: number, limit: number): Promise<{ chats: FilingChat[]; total: number }> {
  await ensure();
  const [rows, count] = await Promise.all([
    query<FilingChat>(`SELECT ${CHAT_COLS} FROM ${TABLE} WHERE source = 'chat' AND hs_state = $1 ORDER BY hs_at DESC NULLS LAST LIMIT $2 OFFSET $3`, [state, limit, offset]),
    query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE source = 'chat' AND hs_state = $1`, [state]),
  ]);
  return { chats: rows.rows, total: Number(count.rows[0]?.n ?? 0) };
}

/** The filing of these chats (the inbox lists show it), keyed by ref (session_hash or the bar's query_id). */
export async function topicsFor(refs: string[]): Promise<Map<string, { key: string; category: string; sub1: string | null; summary: string; agent_wrote: boolean | null; by: string }>> {
  const m = new Map<string, { key: string; category: string; sub1: string | null; summary: string; agent_wrote: boolean | null; by: string }>();
  if (!refs.length) return m;
  await ensure();
  const r = await query<{ key: string; ref: string; category: string; sub1: string | null; summary: string; agent_wrote: boolean | null; by: string }>(
    `SELECT key, ref, category, sub1, summary, agent_wrote, by FROM ${TABLE} WHERE ref = ANY($1)`, [refs]);
  for (const x of r.rows) m.set(x.ref, { key: x.key, category: x.category, sub1: x.sub1, summary: x.summary, agent_wrote: x.agent_wrote, by: x.by });
  return m;
}

/* ── the job: every 20 minutes, one of the hub's two copies (an advisory lock) ──────────────────────── */

async function run(max?: number): Promise<TopicsRun> {
  const filing = await fileTopics(max ? { max } : {});
  let hubspot: TopicsRun["hubspot"] = null;
  try { hubspot = await syncHubSpot(max ? { max: 100 } : {}); } catch (e) { filing.error ??= `HubSpot: ${String((e as Error).message).slice(0, 160)}`; }
  return { ...filing, hubspot };
}

async function tick(): Promise<void> {
  let client;
  try { client = await getPool().connect(); } catch (e) { console.warn(`[chat-topics] tick skipped: ${(e as Error).message}`); return; }
  let r: TopicsRun | null = null;
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [TOPICS_LOCK]);
    if (!got.rows[0]?.ok) return;                      // the other copy is filing
    try {
      r = await run();
      const h = r.hubspot;
      console.log(`[chat-topics] ${r.filed} filed · ${r.unreadable} unreadable · ${r.failed} failed · ${r.waiting} waiting`
        + (h ? ` · HubSpot (${h.mode}): ${h.written} written, ${h.wouldWrite} would change, ${h.same} already right, ${h.kept} kept, ${h.errors} errors` : "")
        + (r.error ? ` · ${r.error}` : ""));
    } catch (e) {
      r = { at: new Date().toISOString(), ok: false, filed: 0, unreadable: 0, failed: 0, waiting: null, error: String((e as Error)?.message ?? e).slice(0, 200) };
      console.warn(`[chat-topics] run failed: ${r.error}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [TOPICS_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
  if (r) await kvSet(KV_RUN, r).catch(() => {});
}

let started = false;
export function startChatTopics(): void {
  if (started || String(process.env.CHAT_TOPICS ?? "").toLowerCase() === "off") return;
  started = true;
  console.log(`[chat-topics] on: chats filed by Enquiry Category every 20 min (${MODEL}); HubSpot written only when switched on`);
  setInterval(() => void tick(), TICK_MS).unref?.();
  setTimeout(() => void tick(), 6 * 60_000).unref?.();   // after the boot rush
}

/** The tab's "File now": the same run (20 chats, 100 tickets), under the same lock. */
export async function fileNow(): Promise<TopicsRun> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [TOPICS_LOCK]);
    if (!got.rows[0]?.ok) return { at: new Date().toISOString(), ok: false, filed: 0, unreadable: 0, failed: 0, waiting: null, error: "A filing run is going on right now - try again in a few minutes." };
    try {
      const r = await run(20);                       // ~3 s a chat: inside the page's 90-second answer
      await kvSet(KV_RUN, r).catch(() => {});
      return r;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [TOPICS_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
