// APSO TRANSLATOR - the engine (UC & HubSpot Apps > APSO Translator; the words in text.ts, DeepL in deepl.ts). Replaces the
// Railway translator (project APSOTranslator: hubspot-translator-v2 + dashboard apsotranslator.com + Postgres), SARCLA
// 08.11.2026: "check why it's not working anymore ... nothing as comment and nothing on the side panel - then migrate to
// the hub ... kill Railway and bring all to the hub".
//
// Why Railway stopped (found 08.11.2026): its 60-second poll only looked again at conversations HubSpot's webhook had
// flagged, and the webhook was refused from 11.10.2026 (a key it was given, set on neither side) - so nothing was flagged
// and nothing translated. The hub needs no webhook: every minute it asks HubSpot for every conversation with a message
// since its last look (threads sorted by latestMessageTimestamp), plus the conversations it saw move in the last
// 30 minutes - a note does not always move a conversation, and "!" notes must still be seen.
//
// For each conversation, the messages since the hub was switched on (never older than a day, each once - kv done):
// - a customer's message (chat or e-mail) not in English -> one comment "🌐 Auto-translation (IT → EN)" for the agent;
//   several that came together -> one comment;
// - an agent's note "!help" -> the help; "!FR" -> the customer's last message in French, as a comment;
//   "!<text>" -> the text in the customer's language, SENT to the customer as that agent (Replies switch; never to one of
//   our own addresses or a HubSpot inbox - NEVER mail a HubSpot inbox, 05.11.2026).
// Preview translates and lists what it would post, posting nothing; Live posts. One copy of the hub at a time
// (advisory lock 4107271). TRANSLATOR=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { deeplConfigured, translate, usage } from "./deepl";
import { COMMENT, base, cleanForTranslation, customerOf, isInternal, messageText, parseCommand, sameText, stripHtml, targetOf, toRichText, type RawMessage } from "./text";

const LOCK = 4_107_271;
const EVERY_MS = 60_000;
const LIMIT_MS = 5 * 60_000;
/** a conversation that moved stays watched this long (the Railway translator's 30 minutes) */
const WATCH_MS = 30 * 60_000;
/** never a message older than this, whatever the switch says */
const MAX_AGE_MS = 24 * 3600_000;
const OVERLAP_MS = 2 * 60_000;
const DONE_KEEP_MS = 3 * 86400_000;
const LANG_KEEP_MS = 60 * 86400_000;
const ROWS_KEPT = 1500;
const DAYS_KEPT = 400;
/** the most conversations read in one run, and the most DeepL calls */
const THREADS_PER_RUN = 300;
const CALLS_PER_RUN = 120;
/** shorter than this, DeepL cannot tell the language - the conversation's known one is given */
const SHORT = 25;

const KV = {
  settings: "translator:settings", cursor: "translator:cursor", watch: "translator:watch", done: "translator:done", langs: "translator:langs",
  rows: "translator:rows", days: "translator:days", last: "translator:last", tickets: "translator:tickets",
  /** the day each conversation was last counted in (a conversation counts once a day) */
  convDay: "translator:conv-day",
};

export type Mode = "off" | "preview" | "live";
export type Settings = {
  mode: Mode;
  /** messages from this moment on (the moment it was switched on) */
  since: string;
  /** the inboxes it reads; null = every inbox */
  inboxes: string[] | null;
  /** "!<text>" sends the translation to the customer */
  replies: boolean;
  by?: string; at?: string;
};
export type Kind = "incoming" | "lang" | "reply" | "help";
export type Outcome = "posted" | "sent" | "would" | "skipped" | "failed";
export type Row = {
  at: string; msgAt: string; thread: string; ticket: string | null; inbox: string | null; channel: "chat" | "email" | "other";
  kind: Kind; from: string | null; to: string | null; original: string; translated: string | null; chars: number;
  outcome: Outcome; why?: string; agent?: string | null;
};
export type Day = {
  n: number; chars: number; replies: number; langs: Record<string, number>;
  // counted since 09.11.2026 (the Overview's tabs - SARCLA: "bring more graphs as KPI and much more by tabs"): what each
  // translation was, where it came from, who asked for it, the hour the customer wrote; a day before has none of them
  kinds?: Partial<Record<Kind, number>>; inboxes?: Record<string, number>; channels?: Partial<Record<Row["channel"], number>>;
  agents?: Record<string, number>; replyLangs?: Record<string, number>; hours?: number[];
  /** conversations with a translation that day */
  convs?: number;
  /** customer messages already in English (nothing to translate), failures */
  english?: number; failed?: number;
};
export type RunInfo = { at: string; seconds: number; threads: number; translated: number; replies: number; live: boolean; error?: string };

type Thread = { id: string; inboxId?: string | number; status?: string; spam?: boolean; archived?: boolean; latestMessageTimestamp?: string; originalChannelId?: string | number; originalChannelAccountId?: string | number };

// ---------------- settings ----------------
export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Settings>(KV.settings);
  if (s) return s;
  // first start: Preview from now (the hub's rule for a migrated app - SARCLA looks before it posts)
  const first: Settings = { mode: "preview", since: new Date().toISOString(), inboxes: null, replies: true, by: "first start", at: new Date().toISOString() };
  await kvSet(KV.settings, first);
  return first;
}
export async function saveSettings(b: Partial<Pick<Settings, "mode" | "inboxes" | "replies">>, by: string): Promise<Settings> {
  const cur = await getSettings();
  const mode: Mode = b.mode === "off" || b.mode === "preview" || b.mode === "live" ? b.mode : cur.mode;
  const next: Settings = {
    mode,
    // switched on from off: from now on - never the messages of the time it was off
    since: cur.mode === "off" && mode !== "off" ? new Date().toISOString() : cur.since,
    inboxes: b.inboxes === undefined ? cur.inboxes : b.inboxes === null ? null : b.inboxes.map(String).filter(Boolean),
    replies: typeof b.replies === "boolean" ? b.replies : cur.replies,
    by, at: new Date().toISOString(),
  };
  await kvSet(KV.settings, next);
  return next;
}

// ---------------- HubSpot ----------------
/** Every conversation with a message after `after`, oldest first (HubSpot pages forward). */
async function changedThreads(after: string): Promise<Thread[]> {
  const out: Thread[] = [];
  let next: string | undefined;
  for (let page = 0; page < 10 && out.length < THREADS_PER_RUN; page++) {
    const q = `sort=latestMessageTimestamp&latestMessageTimestampAfter=${encodeURIComponent(after)}&limit=100${next ? `&after=${encodeURIComponent(next)}` : ""}`;
    const j = await hubspotRetry<{ results?: Thread[]; paging?: { next?: { after?: string } } }>({ path: `/conversations/v3/conversations/threads?${q}` });
    out.push(...(j.results ?? []).map((t) => ({ ...t, id: String(t.id) })));
    next = j.paging?.next?.after;
    if (!next) break;
  }
  return out;
}
async function threadOf(id: string): Promise<Thread | null> {
  return hubspotRetry<Thread>({ path: `/conversations/v3/conversations/threads/${id}` }).then((t) => ({ ...t, id: String(t.id) })).catch(() => null);
}
async function messagesOf(id: string): Promise<RawMessage[]> {
  const j = await hubspotRetry<{ results?: RawMessage[] }>({ path: `/conversations/v3/conversations/threads/${id}/messages?limit=40` });
  return (j.results ?? []).map((m) => ({ ...m, id: String(m.id) }));
}
/** A long or cut e-mail: HubSpot's full text of it. */
async function fullText(thread: string, m: RawMessage): Promise<string> {
  const t = messageText(m);
  const cut = m.truncationStatus && m.truncationStatus !== "NOT_TRUNCATED";
  if (t.length > 10 && !cut) return t;
  const o = await hubspotRetry<{ text?: string; richText?: string }>({ path: `/conversations/v3/conversations/threads/${thread}/messages/${m.id}/original-content` }).catch(() => null);
  return o ? messageText(o) || t : t;
}
/** The ticket a conversation belongs to (kept, it never changes). */
async function ticketOf(thread: string, cache: Record<string, string | null>): Promise<string | null> {
  if (thread in cache) return cache[thread];
  const j = await hubspotRetry<{ threadAssociations?: { associatedTicketId?: string | number } }>({ path: `/conversations/v3/conversations/threads/${thread}?association=TICKET` }).catch(() => null);
  const id = j?.threadAssociations?.associatedTicketId;
  cache[thread] = id != null ? String(id) : null;
  return cache[thread];
}
/** A comment only agents see. Never retried: a retry after a lost answer would post it twice. */
async function postComment(thread: string, text: string): Promise<void> {
  const rich = toRichText(text);
  await hubspotFetchJson({ path: `/conversations/v3/conversations/threads/${thread}/messages`, method: "POST", body: { type: "COMMENT", text: rich, richText: rich } });
}
/** A message to the customer, as the agent. Never retried (an e-mail twice is worse than once missing). */
async function sendReply(thread: string, text: string, p: { sender: string; channelId: string | null; channelAccountId: string | null; email: string | null; actorId: string | null }): Promise<void> {
  const rich = toRichText(text);
  const body: Record<string, unknown> = { type: "MESSAGE", text: rich, richText: rich, senderActorId: p.sender };
  if (p.channelId) body.channelId = p.channelId;
  if (p.channelAccountId) body.channelAccountId = p.channelAccountId;
  if (p.email) body.recipients = [{ recipientField: "TO", deliveryIdentifiers: [{ type: "HS_EMAIL_ADDRESS", value: p.email }] }];
  else if (p.actorId) body.recipients = [{ actorId: p.actorId }];
  await hubspotFetchJson({ path: `/conversations/v3/conversations/threads/${thread}/messages`, method: "POST", body });
}

// ---------------- the decisions ----------------
const isCustomer = (m: RawMessage) => m.type === "MESSAGE" && /^(INCOMING|FORWARD|FORWARDED)$/.test(m.direction ?? "");
const at = (m: RawMessage) => Date.parse(m.createdAt ?? "") || 0;
const channelOf = (m: RawMessage | undefined, t: Thread): Row["channel"] => {
  const ch = String(m?.channelId ?? t.originalChannelId ?? "");
  return ch === "1002" ? "email" : ch === "1000" || ch === "3799457" ? "chat" : ch ? "other" : "other";
};
const clip = (s: string, n = 1200) => (s.length > n ? `${s.slice(0, n)}…` : s);
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

type Ctx = {
  live: boolean; s: Settings; calls: number;
  done: Record<string, number>; langs: Record<string, { lang: string; at: number }>; tickets: Record<string, string | null>;
  rows: Row[]; days: Record<string, Day>; convDay: Record<string, string>; translated: number; replies: number;
};

async function deepl(ctx: Ctx, text: string, target: string, source?: string | null) {
  if (ctx.calls >= CALLS_PER_RUN) throw new Error("the run's DeepL calls are used up - the rest waits for the next minute");
  ctx.calls++;
  return translate(text, target, source);
}
type Meta = { kind: Kind; thread: string; inbox: string | null; channel: Row["channel"]; agent?: string | null; msgAt?: string | null };
const dayOf = (ctx: Ctx) => (ctx.days[today()] ??= { n: 0, chars: 0, replies: 0, langs: {} });
const add = <K extends string>(m: Partial<Record<K, number>>, k: K) => { m[k] = (m[k] ?? 0) + 1; };
const hourOf = (iso: string | null | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "numeric", hourCycle: "h23" }).format(t)) % 24 : null;
};
/** One translation made (or, in Preview, that would be posted): the day's figures, and what it was, where from, who asked. */
function count(ctx: Ctx, lang: string | null, chars: number, reply: boolean, meta: Meta) {
  const d = dayOf(ctx);
  d.n++; d.chars += chars;
  if (reply) d.replies++;
  if (lang) d.langs[base(lang)] = (d.langs[base(lang)] ?? 0) + 1;
  if (reply && lang) add((d.replyLangs ??= {}), base(lang));
  add((d.kinds ??= {}), meta.kind);
  add((d.channels ??= {}), meta.channel);
  if (meta.inbox) add((d.inboxes ??= {}), meta.inbox);
  if (meta.agent) add((d.agents ??= {}), meta.agent);
  const h = hourOf(meta.msgAt);
  if (h !== null) { d.hours ??= Array(24).fill(0); d.hours[h]++; }
  // a conversation counts once a day
  if (ctx.convDay[meta.thread] !== today()) { ctx.convDay[meta.thread] = today(); d.convs = (d.convs ?? 0) + 1; }
}
/** A customer message already in English, or a translation that failed: counted, nothing made. */
function tally(ctx: Ctx, what: "english" | "failed") {
  const d = dayOf(ctx);
  d[what] = (d[what] ?? 0) + 1;
}
/**
 * The language the customer writes in: the conversation's known one, else read from the customer's longest message -
 * "Angst + Pfister" or an article code says nothing (a chat of 05.11.2026 read as German) - all of theirs together
 * when each is short, else the chat bot's answer, which is written in the customer's language. Kept once it is sure.
 */
async function customerLanguage(ctx: Ctx, thread: string, msgs: RawMessage[]): Promise<string | null> {
  const known = ctx.langs[thread]?.lang;
  if (known) return known;
  const theirs = msgs.filter(isCustomer).map((m) => cleanForTranslation(messageText(m))).filter((t) => t.length >= 3);
  const longest = [...theirs].sort((a, b) => b.length - a.length)[0] ?? "";
  let sample = longest.length >= SHORT ? longest : theirs.join(" \n");
  if (sample.length < SHORT) {
    const bot = msgs.filter((m) => m.type === "MESSAGE" && m.direction === "OUTGOING" && /^(B|X)-/.test(m.senders?.[0]?.actorId ?? "")).map((m) => messageText(m)).find((t) => t.length >= SHORT);
    if (bot) sample = bot;
  }
  if (sample.trim().length < 3) return null;
  const r = await deepl(ctx, sample.slice(0, 300), "EN-US");
  if (sample.length >= SHORT) ctx.langs[thread] = { lang: r.detected, at: Date.now() };
  return r.detected || null;
}

async function onThread(ctx: Ctx, t: Thread): Promise<boolean> {
  const floor = Math.max(Date.parse(ctx.s.since), Date.now() - MAX_AGE_MS);
  const msgs = await messagesOf(t.id);
  const fresh = msgs.filter((m) => at(m) > floor && !ctx.done[m.id]).sort((a, b) => at(a) - at(b));
  if (!fresh.length) return false;
  const now = new Date().toISOString();
  const row = async (r: Omit<Row, "at" | "thread" | "ticket" | "inbox" | "channel">, m?: RawMessage) =>
    ctx.rows.unshift({ at: now, thread: t.id, ticket: await ticketOf(t.id, ctx.tickets), inbox: t.inboxId != null ? String(t.inboxId) : null, channel: channelOf(m, t), ...r });
  const comment = async (text: string) => { if (ctx.live) await postComment(t.id, text); };
  const inbox = t.inboxId != null ? String(t.inboxId) : null;
  const meta = (kind: Kind, m: RawMessage | undefined, agent?: string | null): Meta => ({ kind, thread: t.id, inbox, channel: channelOf(m, t), agent, msgAt: m?.createdAt ?? null });

  // 1. the customer's messages that came since: one comment in English
  const inc = fresh.filter(isCustomer);
  if (inc.length) {
    for (const m of inc) ctx.done[m.id] = Date.now();
    const texts: string[] = [];
    for (const m of inc) { const x = cleanForTranslation(await fullText(t.id, m)); if (x.length >= 3) texts.push(x); }
    const text = texts.join("\n\n");
    let known: string | null = ctx.langs[t.id]?.lang ?? null;
    const last = inc[inc.length - 1];
    if (text.length >= 3 && !(known && base(known) === "EN")) {
      try {
        // a short message says too little: the conversation's language is read first (its longer texts), then given
        if (text.length < SHORT && !known) known = await customerLanguage(ctx, t.id, msgs);
        const english = !!known && base(known) === "EN" && text.length < SHORT;
        const r = english ? null : await deepl(ctx, text, "EN-US", text.length < SHORT && known ? known : null);
        if (r && text.length >= SHORT) ctx.langs[t.id] = { lang: r.detected, at: Date.now() };
        if (!r || base(r.detected) === "EN" || sameText(r.text, text)) {
          tally(ctx, "english");
          await row({ msgAt: last.createdAt ?? now, kind: "incoming", from: r?.detected ?? known, to: "EN", original: clip(text), translated: null, chars: text.length, outcome: "skipped", why: "already in English" }, last);
        } else {
          await comment(COMMENT.incoming(r.detected, r.text));
          count(ctx, r.detected, text.length, false, meta("incoming", last));
          ctx.translated++;
          await row({ msgAt: last.createdAt ?? now, kind: "incoming", from: r.detected, to: "EN", original: clip(text), translated: clip(r.text), chars: text.length, outcome: ctx.live ? "posted" : "would" }, last);
        }
      } catch (e) {
        tally(ctx, "failed");
        await row({ msgAt: last.createdAt ?? now, kind: "incoming", from: null, to: "EN", original: clip(text), translated: null, chars: text.length, outcome: "failed", why: (e as Error).message.slice(0, 200) }, last);
      }
    }
  }

  // 2. the agents' "!" notes, oldest first
  for (const m of fresh.filter((x) => x.type === "COMMENT")) {
    ctx.done[m.id] = Date.now();
    const cmd = parseCommand(stripHtml(m.text || m.richText));
    if (!cmd) continue;
    const agent = m.senders?.[0]?.actorId ?? null;
    const base0 = { msgAt: m.createdAt ?? now, agent };
    try {
      if (cmd.kind === "help") {
        await comment(COMMENT.help);
        await row({ ...base0, kind: "help", from: null, to: null, original: "!help", translated: null, chars: 0, outcome: ctx.live ? "posted" : "would" });
      } else if (cmd.kind === "lang") {
        const lastCustomer = msgs.filter(isCustomer).sort((a, b) => at(b) - at(a))[0];
        const text = lastCustomer ? cleanForTranslation(await fullText(t.id, lastCustomer)) : "";
        if (!cmd.target) {
          await comment(COMMENT.unsupported(cmd.code));
          await row({ ...base0, kind: "lang", from: null, to: cmd.code, original: `!${cmd.code}`, translated: null, chars: 0, outcome: "skipped", why: "language not supported" });
        } else if (text.length < 3) {
          await comment(COMMENT.noCustomerMessage);
          await row({ ...base0, kind: "lang", from: null, to: cmd.code, original: `!${cmd.code}`, translated: null, chars: 0, outcome: "skipped", why: "no customer message" });
        } else {
          const r = await deepl(ctx, text, cmd.target);
          await comment(COMMENT.lang(r.detected, cmd.code, r.text));
          count(ctx, r.detected, text.length, false, meta("lang", m, agent));
          ctx.translated++;
          await row({ ...base0, kind: "lang", from: r.detected, to: base(cmd.target), original: clip(text), translated: clip(r.text), chars: text.length, outcome: ctx.live ? "posted" : "would" });
        }
      } else {
        const r0 = { ...base0, kind: "reply" as const, original: clip(cmd.text), chars: cmd.text.length };
        if (!ctx.s.replies) {
          await comment(COMMENT.notSent("replies with ! are switched off on the hub (APSO Translator > Settings)"));
          await row({ ...r0, from: null, to: null, translated: null, outcome: "skipped", why: "replies switched off" });
          continue;
        }
        const lang = await customerLanguage(ctx, t.id, msgs);
        if (!lang) {
          await comment(COMMENT.noLanguage);
          await row({ ...r0, from: null, to: null, translated: null, outcome: "skipped", why: "no customer message to read the language from" });
          continue;
        }
        const tr = await deepl(ctx, cmd.text, targetOf(lang));
        if (sameText(tr.text, cmd.text) || base(tr.detected) === base(lang)) {
          await comment(COMMENT.sameLanguage(lang));
          await row({ ...r0, from: tr.detected, to: base(lang), translated: null, outcome: "skipped", why: `already in ${base(lang)}` });
          continue;
        }
        const sender = agent?.startsWith("A-") ? agent : msgs.find((x) => x.direction === "OUTGOING" && x.senders?.[0]?.actorId?.startsWith("A-"))?.senders?.[0]?.actorId ?? null;
        const who = customerOf(msgs);
        const why = !sender ? "no agent to send it as - reply once by hand, then use !" : who.email && isInternal(who.email) ? `the customer's address ${who.email} is one of ours or a HubSpot inbox` : !who.email && !who.actorId ? "no customer to send it to" : null;
        if (why) {
          await comment(COMMENT.notSent(why));
          await row({ ...r0, from: tr.detected, to: base(lang), translated: clip(tr.text), outcome: "skipped", why });
          continue;
        }
        if (ctx.live) await sendReply(t.id, tr.text, { sender: sender!, channelId: who.channelId ?? (t.originalChannelId != null ? String(t.originalChannelId) : null), channelAccountId: who.channelAccountId ?? (t.originalChannelAccountId != null ? String(t.originalChannelAccountId) : null), email: who.email, actorId: who.actorId });
        count(ctx, lang, cmd.text.length, true, meta("reply", m, agent));
        ctx.replies++;
        await row({ ...r0, from: tr.detected, to: base(lang), translated: clip(tr.text), outcome: ctx.live ? "sent" : "would" });
      }
    } catch (e) {
      const why = (e as Error).message.slice(0, 200);
      tally(ctx, "failed");
      if (ctx.live) await postComment(t.id, cmd.kind === "reply" ? COMMENT.failed(why) : `❌ ${why}`).catch(() => {});
      await row({ ...base0, kind: cmd.kind, from: null, to: null, original: cmd.kind === "reply" ? clip(cmd.text) : "!", translated: null, chars: 0, outcome: "failed", why });
    }
  }
  for (const m of fresh) ctx.done[m.id] ??= Date.now();
  return true;
}

// ---------------- the run ----------------
async function save(ctx: Ctx) {
  const now = Date.now();
  for (const [k, v] of Object.entries(ctx.done)) if (now - v > DONE_KEEP_MS) delete ctx.done[k];
  for (const [k, v] of Object.entries(ctx.langs)) if (now - v.at > LANG_KEEP_MS) delete ctx.langs[k];
  for (const [k, v] of Object.entries(ctx.convDay)) if (v !== today()) delete ctx.convDay[k];
  const days = Object.keys(ctx.days).sort().slice(-DAYS_KEPT);
  await Promise.all([
    kvSet(KV.done, ctx.done), kvSet(KV.langs, ctx.langs), kvSet(KV.tickets, ctx.tickets),
    kvSet(KV.rows, ctx.rows.slice(0, ROWS_KEPT)), kvSet(KV.days, Object.fromEntries(days.map((d) => [d, ctx.days[d]]))), kvSet(KV.convDay, ctx.convDay),
  ]);
}

async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const s = await getSettings();
  const live = s.mode === "live";
  if (!deeplConfigured()) throw new Error("no DeepL key on the hub yet (DEEPL_API_KEY) - nothing can be translated");
  const [cursor, watch, done, langs, tickets, rows, days, convDay] = await Promise.all([
    kvGet<string>(KV.cursor), kvGet<Record<string, number>>(KV.watch), kvGet<Record<string, number>>(KV.done), kvGet<Record<string, { lang: string; at: number }>>(KV.langs),
    kvGet<Record<string, string | null>>(KV.tickets), kvGet<Row[]>(KV.rows), kvGet<Record<string, Day>>(KV.days), kvGet<Record<string, string>>(KV.convDay),
  ]);
  const ctx: Ctx = { live, s, calls: 0, done: done ?? {}, langs: langs ?? {}, tickets: tickets ?? {}, rows: rows ?? [], days: days ?? {}, convDay: convDay ?? {}, translated: 0, replies: 0 };
  const from = Math.max(Date.parse(cursor ?? s.since) - OVERLAP_MS, Date.parse(s.since), Date.now() - MAX_AGE_MS);
  const changed = await changedThreads(new Date(from).toISOString());
  const w: Record<string, number> = {};
  for (const [id, seen] of Object.entries(watch ?? {})) if (Date.now() - seen < WATCH_MS) w[id] = seen;
  const byId = new Map<string, Thread>();
  for (const t of changed) { byId.set(t.id, t); w[t.id] = Date.now(); }
  // the watched ones that did not move: read again for the agents' notes
  for (const id of Object.keys(w)) if (!byId.has(id)) { const t = await threadOf(id); if (t) byId.set(id, t); }
  let read = 0, error: string | undefined;
  for (const t of byId.values()) {
    if (t.spam || t.archived) continue;
    if (s.inboxes && !s.inboxes.includes(String(t.inboxId ?? ""))) continue;
    read++;
    try {
      if (await onThread(ctx, t)) await save(ctx);
    } catch (e) {
      error = `${t.id}: ${(e as Error).message.slice(0, 200)}`;
      if (/DeepL calls are used up|quota|refused the key/.test(error)) break;
    }
  }
  const newest = changed.reduce((m, t) => Math.max(m, Date.parse(t.latestMessageTimestamp ?? "") || 0), Date.parse(cursor ?? s.since) || 0);
  await Promise.all([kvSet(KV.cursor, new Date(newest).toISOString()), kvSet(KV.watch, w)]);
  await save(ctx);
  const info: RunInfo = { at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), threads: read, translated: ctx.translated, replies: ctx.replies, live, ...(error ? { error } : {}) };
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, threads: 0, translated: 0, replies: 0, live: false, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        return info;
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false;
export function startTranslator() {
  if (started || process.env.TRANSLATOR === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => { if (r?.translated || r?.replies) console.log(`[translator] ${r.translated} translated, ${r.replies} repl${r.replies === 1 ? "y" : "ies"}${r.live ? "" : " (preview)"}`); })
      .catch((e) => console.warn(`[translator] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 45_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- what the page reads ----------------
let namesCache: { at: number; inboxes: Record<string, string> } | null = null;
async function inboxNames(): Promise<Record<string, string>> {
  if (namesCache && Date.now() - namesCache.at < 3600_000) return namesCache.inboxes;
  const j = await hubspotRetry<{ results?: { id: string | number; name?: string }[] }>({ path: "/conversations/v3/conversations/inboxes" }).catch(() => null);
  const inboxes = Object.fromEntries((j?.results ?? []).map((i) => [String(i.id), String(i.name ?? i.id).replace(/\s*:\s*$/, "").trim()]));
  if (j) namesCache = { at: Date.now(), inboxes };
  return inboxes;
}
const agentCache = new Map<string, string>();
async function agentNames(ids: string[]): Promise<Record<string, string>> {
  const want = [...new Set(ids)].filter((id) => id && !agentCache.has(id)).slice(0, 100);
  if (want.length) {
    const j = await hubspotRetry<{ results?: { id: string; name?: string; email?: string }[] }>({ path: "/conversations/v3/conversations/actors/batch/read", method: "POST", body: { inputs: want } }).catch(() => null);
    for (const a of j?.results ?? []) agentCache.set(String(a.id), a.name || a.email || String(a.id));
  }
  return Object.fromEntries(ids.filter((id) => agentCache.has(id)).map((id) => [id, agentCache.get(id)!]));
}

/** How long a customer waited for the comment: from their message to the translation, seconds - the median and the slowest tenth. */
export type Speed = { n: number; median: number | null; p90: number | null; since: string | null };
function speedOf(rows: Row[]): Speed {
  const from = Date.now() - 30 * 86400_000;
  const xs = rows
    .filter((r) => r.kind === "incoming" && (r.outcome === "posted" || r.outcome === "would") && Date.parse(r.msgAt) >= from)
    .map((r) => (Date.parse(r.at) - Date.parse(r.msgAt)) / 1000).filter((s) => Number.isFinite(s) && s >= 0).sort((a, b) => a - b);
  const q = (p: number) => (xs.length ? Math.round(xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]) : null);
  const oldest = rows.length ? rows[rows.length - 1].msgAt : null;
  return { n: xs.length, median: q(0.5), p90: q(0.9), since: oldest };
}

/**
 * What the pages read. The Overview and Settings: the figures by day (no message text); Conversations ("rows"): every
 * comment and reply it made, newest first, with the texts.
 */
export async function pageState(part: "overview" | "rows" = "overview") {
  const [settings, last, rows, days, inboxes, use] = await Promise.all([
    getSettings(), kvGet<RunInfo>(KV.last), kvGet<Row[]>(KV.rows), kvGet<Record<string, Day>>(KV.days), inboxNames(), deeplConfigured() ? usage() : Promise.resolve(null),
  ]);
  const all = rows ?? [], byDay = days ?? {};
  const list = part === "rows" ? all.slice(0, 500) : [];
  const agents = await agentNames([...list.map((r) => r.agent ?? ""), ...Object.values(byDay).flatMap((d) => Object.keys(d.agents ?? {}))].filter(Boolean));
  return {
    settings, last: last ?? null, rows: list, days: byDay, inboxes, agents, usage: use, configured: deeplConfigured(), everySeconds: EVERY_MS / 1000,
    speed: speedOf(all), kept: all.length,
  };
}
