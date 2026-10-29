// ENQUIRY CATEGORY AT THE END OF A TICKET - the engine (rules in rules.ts). Replaces the HubSpot workflow "SARCLA |
// CLASSIFIER END OF TICKET - ENQUIRY CATEGORY" (4088710379), SARCLA 25.10.2026 - automatic, no page of its own ("run the
// re-detection ... without creating a tab, since then we can automate it to do it each time").
//
// Every 5 minutes, one copy of the hub at a time (advisory lock 4107245): the Back Office tickets that reached Resolved
// with their category empty or "Others" are read (the whole conversation) and decided - no customer request (session
// the sentiment flag) gets the hidden topic of what it is (topics.ts), every other one is read by the AI (88's aiClassify,
// unchanged, this engine's own daily budget). Once a day the closed tickets still on "Others"/empty that carry a flag
// get their topic too - the whole history the first time, then a flag that came after the close. The category is
// written only while the workflow is switched off (never both writing), only onto "Others" or empty, a hidden topic only
// once it is an option of the property, every change kept with what was there before (kv ticketClose:log:<time>). Each
// run that finds something says so in the log ("[ticket-close] ..."). TICKET_CLOSE=off stops it.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { getAnthropic } from "@/lib/ai/claude";
import { aiClassify } from "@/lib/boDistribution/aiClassify";
import { BO, GQS_PIPELINE, RESOLVED, WORKFLOW_ID, before, conversation, flagTopic, fromAi, fromGuess, isOpen, patchFor, type Decision, type Mail } from "./rules";
import { aiGuess } from "./guess";
import { FLAG_TOPICS, HIDDEN_TOPICS, TOPIC } from "./topics";
import { isTsr, mergedNote, oOf, refsOf } from "./gqs";

const LOCK = 4_107_245;
const EVERY_MS = 5 * 60_000;
const KEEP_DAYS = 21;
/**
 * AI answers a day: a busy day has ~60 Back Office tickets closing on Others/empty, and the customer sweep reads the
 * history 25 a run (Haiku, ~1,000 tokens an answer - about USD 0.10 for a full day's 1,000).
 */
const AI_PER_DAY = 1000;
/**
 * Of those, kept for the tickets closing during the day - the history passes stop before (28.10.2026: they had spent
 * the 1,000 by 02:00 UTC, and every ticket closing after that stayed Others)
 */
const LIVE_RESERVE = 250;
/** customer e-mails of the history read per run, until all are done */
const SWEEP_PER_RUN = 25;
const KV = { rows: "ticketClose:rows", last: "ticketClose:last", sweep: "ticketClose:flagSweep", customers: "ticketClose:customerSweep", internal: "ticketClose:internalSweep", spam: "ticketClose:spamSweep", guessed: "ticketClose:guessed", tsr: "ticketClose:tsrSweep", merges: "ticketClose:gqsMerges" };
const TICKET_PROPS = ["subject", "content", "enquiry_category", "createdate", "source_type", "order_number", "sentiment_not_valid_reason", "sentiment_customer_tone", `hs_v2_date_entered_${RESOLVED}`];

export type Written = { at: string; error?: string; skipped?: string };
export type Row = { id: string; subject: string; created: string; closed: string | null; now: string; d: Decision; written?: Written };
export type RunInfo = { at: string; seconds: number; found: number; decided: number; written: number; live: boolean; error?: string };

type Obj = { id: string; properties: Record<string, string | null> };
const day = () => new Date().toISOString().slice(0, 10);

let wfCache: { at: number; on: boolean | null } | null = null;
/** The old workflow switched on? null = could not be read (then nothing is written). */
async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}

let optCache: { at: number; values: Set<string> | null } | null = null;
/** The values enquiry_category accepts (the hidden topics are added by hand in HubSpot). null = could not be read. */
async function options(): Promise<Set<string> | null> {
  if (optCache && Date.now() - optCache.at < 10 * 60_000) return optCache.values;
  let values: Set<string> | null = null;
  try {
    values = new Set(((await hubspotRetry<{ options?: { value: string }[] }>({ path: "/crm/v3/properties/tickets/enquiry_category" })).options ?? []).map((o) => o.value));
  } catch { values = null; }
  optCache = { at: Date.now(), values };
  return values;
}

// ---------------- HubSpot, reading the conversations ----------------
async function search(filterGroups: Record<string, unknown>[][]): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 50; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: filterGroups.map((f) => ({ filters: [...f, { propertyName: "hs_object_id", operator: "GT", value: cursor }] })),
      properties: TICKET_PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 100) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}
async function assoc(to: string, ids: string[]): Promise<Map<string, string[]>> {
  const m = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const j = await hubspotRetry<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>({
      path: `/crm/v4/associations/tickets/${to}/batch/read`, method: "POST", body: { inputs: ids.slice(i, i + 500).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) m.set(String(r.from.id), (r.to ?? []).map((x) => String(x.toObjectId)));
  }
  return m;
}
async function batch(obj: string, ids: string[], props: string[]): Promise<Map<string, Record<string, string | null>>> {
  const m = new Map<string, Record<string, string | null>>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: `/crm/v3/objects/${obj}/batch/read`, method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: props } });
    for (const o of j.results ?? []) m.set(String(o.id), o.properties);
  }
  return m;
}
async function chatOf(id: string): Promise<string[]> {
  try {
    const a = await hubspotRetry<{ results?: { id: string }[] }>({ path: `/crm/v3/objects/tickets/${id}/associations/conversations` });
    const out: string[] = [];
    for (const c of (a.results ?? []).slice(0, 2)) {
      const m = await hubspotRetry<{ results?: { direction?: string; text?: string; richText?: string }[] }>({ path: `/conversations/v3/conversations/threads/${c.id}/messages?limit=100` });
      for (const x of m.results ?? []) if (x.direction === "INCOMING" && (x.text || x.richText)) out.push(String(x.richText || x.text).replace(/<[^>]+>/g, " ").slice(0, 500));
    }
    return out;
  } catch { return []; }
}
/** Each ticket's whole conversation, read in bulk. */
async function conversations(tickets: Obj[]): Promise<Map<string, string>> {
  const ids = tickets.map((t) => t.id);
  const [mailsOf, notesOf] = [await assoc("emails", ids), await assoc("notes", ids)];
  const mails = await batch("emails", [...new Set([...mailsOf.values()].flat())], ["hs_email_text", "hs_email_html", "hs_email_direction", "hs_timestamp"]);
  const notes = await batch("notes", [...new Set([...notesOf.values()].map((x) => x.slice(0, 3)).flat())], ["hs_note_body"]);
  const out = new Map<string, string>();
  for (const t of tickets) {
    const m: Mail[] = (mailsOf.get(t.id) ?? []).map((e) => mails.get(e)).filter((x): x is Record<string, string | null> => !!x)
      .map((e) => ({ text: e.hs_email_text, html: e.hs_email_html, direction: e.hs_email_direction, at: e.hs_timestamp }));
    const chat = t.properties.source_type === "CHAT" ? await chatOf(t.id) : [];
    out.set(t.id, conversation({ content: t.properties.content, mails: m, chat, notes: (notesOf.get(t.id) ?? []).map((x) => notes.get(x)?.hs_note_body ?? null) }));
  }
  return out;
}

// ---------------- deciding, writing ----------------
async function decideAll(tickets: Obj[], text: Map<string, string>, aiMax: number): Promise<{ rows: Row[]; ai: number }> {
  const client = getAnthropic();
  const rows: Row[] = [];
  let ai = 0;
  for (const t of tickets) {
    const p = t.properties, txt = text.get(t.id) ?? "";
    let d = before({ subject: p.subject, text: txt, notValid: p.sentiment_not_valid_reason });
    // a Task Status Report belongs to GQS: the pass below merges it into its task or files it as a GQS task update
    if (isTsr(p.subject)) d = { category: TOPIC.gqs, sub: null, order: null, why: "Task Status Report", stay: null, by: "tsr" };
    // one of us wrote it: what is it about (SARCLA 27.10.2026, "drill down on Internal e-mail")
    if (d?.category === TOPIC.internal && client && ai < aiMax) {
      ai++;
      const g = await aiGuess(client, p.subject, txt, "internal").catch(() => null);
      if (g) d = fromGuess(g, txt, p.subject);
    }
    if (!d) {
      if (!client || ai >= aiMax) d = fromAi(null, txt, p.subject);
      else {
        ai++;
        let ans = null;
        for (let i = 0; i < 2 && !ans; i++) { try { ans = await aiClassify(client, p.subject, txt); } catch { /* asked again once */ } }
        d = fromAi(ans, txt, p.subject);
        // nothing stays Others (SARCLA 27.10.2026: "Recognise should be 100%"): the closest topic, with how sure
        if (d.stay === "unclear" && ai < aiMax) {
          ai++;
          const g = await aiGuess(client, p.subject, txt).catch(() => null);
          if (g) d = fromGuess(g, txt, p.subject);
        }
      }
    }
    rows.push({ id: t.id, subject: (p.subject ?? "").slice(0, 140), created: p.createdate ?? "", closed: p[`hs_v2_date_entered_${RESOLVED}`] ?? null, now: p.enquiry_category ?? "", d: { ...d, why: d.why.slice(0, 120) } });
  }
  return { rows, ai };
}
/**
 * What may be written over: Others or empty - or one of the hub's own hidden topics when the sentiment flag now says
 * another topic (the sweep made "one of us wrote it" more precise). Nothing a person or a classifier set. A GQS task
 * update is never moved by a flag (28.10.2026: the daily pass had moved 176 of them back to Internal e-mail).
 */
const replaceable = (cur: string | null | undefined, d: Decision) =>
  isOpen(cur) || (!!cur && HIDDEN_TOPICS.includes(cur) && cur !== TOPIC.gqs && !!d.category && cur !== d.category
    && (FLAG_TOPICS.includes(d.category) || ((cur === TOPIC.internal || cur === TOPIC.spam) && d.by === "guess")))
  // a Task Status Report is a GQS task update whatever the keywords made of it (SARCLA 27.10.2026)
  || (d.by === "tsr" && !!d.category && cur !== d.category);

/**
 * Only onto what is replaceable (read again just before), a flag topic only once HubSpot has it as an option; 100 a
 * call, one by one if a call is refused; kept with what was there before.
 */
async function writeSafe(rows: Row[]): Promise<number> {
  let done = 0;
  const cur = await batch("tickets", rows.map((r) => r.id), ["enquiry_category", "order_number"]);
  const opts = await options();
  const now = new Date().toISOString();
  const log: { id: string; before: Record<string, string | null>; after: Record<string, string> }[] = [];
  const todo: { r: Row; before: Record<string, string | null>; after: Record<string, string> }[] = [];
  for (const r of rows) {
    const c = cur.get(r.id);
    if (!c) { r.written = { at: now, error: "ticket not found" }; continue; }
    if (!replaceable(c.enquiry_category, r.d)) { r.written = { at: now, skipped: `has "${c.enquiry_category}" meanwhile` }; continue; }
    if (r.d.category && (FLAG_TOPICS.includes(r.d.category) || HIDDEN_TOPICS.includes(r.d.category)) && !opts?.has(r.d.category)) { r.written = { at: now, skipped: `"${r.d.category}" is not an option in HubSpot yet` }; continue; }
    const after = patchFor(r.d, c);
    if (Object.keys(after).length) todo.push({ r, before: { enquiry_category: c.enquiry_category ?? null, order_number: c.order_number ?? null }, after });
  }
  const ok = (x: (typeof todo)[number]) => { log.push({ id: x.r.id, before: x.before, after: x.after }); x.r.written = { at: now }; done++; };
  for (let i = 0; i < todo.length; i += 100) {
    const chunk = todo.slice(i, i + 100);
    try {
      await hubspotRetry({ path: "/crm/v3/objects/tickets/batch/update", method: "POST", body: { inputs: chunk.map((x) => ({ id: x.r.id, properties: x.after })) } });
      chunk.forEach(ok);
    } catch {
      for (const x of chunk) {
        try {
          await hubspotRetry({ path: `/crm/v3/objects/tickets/${x.r.id}`, method: "PATCH", body: { properties: x.after } });
          ok(x);
        } catch (e) { x.r.written = { at: now, error: (e as Error).message.slice(0, 160) }; }
      }
    }
  }
  if (log.length) await kvSet(`ticketClose:log:${now}`, log);
  // the months these tickets were created in are counted again on Detection's next run
  const months = [...new Set(log.map((x) => rows.find((r) => r.id === x.id)?.created?.slice(0, 7)).filter((m): m is string => !!m))];
  if (months.length) await kvSet("boDetection:dirty", [...new Set([...((await kvGet<string[]>("boDetection:dirty")) ?? []), ...months])]);
  const guessed = rows.filter((r) => r.d.by === "guess" && r.written && !r.written.error && !r.written.skipped);
  if (guessed.length) {
    const g = (await kvGet<Record<string, { cat: string; sure: string }>>(KV.guessed)) ?? {};
    for (const r of guessed) g[r.id] = { cat: r.d.category!, sure: r.d.sure ?? "low" };
    await kvSet(KV.guessed, g);
  }
  return done;
}

/**
 * Every run, while the history is not done: 25 closed tickets still on Others/empty get the AI's closest topic - or
 * Spam or advertising - one answer each, within the day's AI budget; nothing to read is Empty e-mail. A ticket whose
 * sentiment flag gives a topic is the daily pass's. Oldest first (cursor kept in kv).
 */
async function customerSweep(aiLeft: number): Promise<number> {
  const st = (await kvGet<{ cursor: string; done?: boolean; written?: number }>(KV.customers)) ?? { cursor: "0" };
  const client = getAnthropic();
  if (st.done || !client || aiLeft <= 0) return 0;
  // the AI's answers include "Spam or advertising": wait until HubSpot has it, or those tickets would be skipped for good
  if (!(await options())?.has(TOPIC.spam)) return 0;
  // six filters a group at most (HubSpot answers "Error validating request" to a seventh, 27.10.2026)
  const base = [
    { propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: "hs_pipeline_stage", operator: "EQ", value: RESOLVED },
    { propertyName: "hs_object_id", operator: "GT", value: st.cursor },
  ];
  const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters: [...base, { propertyName: "enquiry_category", operator: "EQ", value: "Others" }] }, { filters: [...base, { propertyName: "enquiry_category", operator: "NOT_HAS_PROPERTY" }] }],
    properties: TICKET_PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: Math.min(SWEEP_PER_RUN, aiLeft),
  } });
  const found = (j.results ?? []).filter((t) => !flagTopic(t.properties.sentiment_not_valid_reason) && !isTsr(t.properties.subject));
  const last = j.results?.[j.results.length - 1];
  if (!last) { await kvSet(KV.customers, { ...st, done: true, at: new Date().toISOString() }); return 0; }
  const text = await conversations(found);
  const rows: Row[] = [];
  let used = 0;
  for (const t of found) {
    const p = t.properties, txt = text.get(t.id) ?? "";
    let d = before({ subject: p.subject, text: txt, notValid: null });
    if (!d) {
      used++;
      const g = await aiGuess(client, p.subject, txt).catch(() => null);
      if (g) d = fromGuess(g, txt, p.subject);
    }
    if (d?.category) rows.push({ id: t.id, subject: (p.subject ?? "").slice(0, 140), created: p.createdate ?? "", closed: p[`hs_v2_date_entered_${RESOLVED}`] ?? null, now: p.enquiry_category ?? "", d });
  }
  const written = rows.length ? await writeSafe(rows) : 0;
  await kvSet(KV.customers, { cursor: String(last.id), written: (st.written ?? 0) + written, at: new Date().toISOString() });
  const sure = (k: string) => rows.filter((r) => r.d.sure === k).length;
  console.log(`[ticket-close] Others of the history: ${found.length} read, ${written} get their closest topic (sure: high ${sure("high")}, medium ${sure("medium")}, low ${sure("low")}) - ${(st.written ?? 0) + written} so far`);
  return used;
}

/** The GQS task of a Task Status Report: its exact O number, else a reference that finds exactly one GQS task. */
async function gqsTaskOf(subject: string): Promise<{ id: string; how: "O" | "ref"; key: string } | null> {
  const find = (prop: string, op: string, value: string) => hubspotRetry<{ total?: number; results?: { id: string }[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: GQS_PIPELINE }, { propertyName: prop, operator: op, value }] }], properties: ["subject"], limit: 5,
  } });
  const o = oOf(subject);
  if (o) {
    const j = await find("o_number", "EQ", o);
    if (j.results?.length) return { id: String(j.results[0].id), how: "O", key: o };
  }
  const ids = new Set<string>();
  let key = "";
  for (const r of refsOf(subject)) {
    const j = await find("subject", "CONTAINS_TOKEN", r);
    if ((j.total ?? 0) > 1) return null; // several GQS tasks share it: never guess which
    for (const g of j.results ?? []) { ids.add(String(g.id)); key = r; }
  }
  return ids.size === 1 ? { id: [...ids][0], how: "ref", key } : null;
}

/**
 * Every run: the Task Status Reports in Back Office (any stage, older than an hour so routing step #50 has had its go),
 * 25 at a time - merged into their GQS task when one is found for sure, else filed as GQS task update. The cursor
 * keeps going, so a new report is taken an hour after it arrived.
 */
async function tsrSweep(): Promise<void> {
  const was = (await kvGet<{ cursor: string; merged?: number; filed?: number; again?: boolean }>(KV.tsr)) ?? { cursor: "0" };
  // once more from the start: the daily pass had moved 176 filed reports back to Internal e-mail (28.10.2026)
  const st = was.again ? was : { ...was, cursor: "0", again: true };
  if (!(await options())?.has(TOPIC.gqs)) return;
  const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: "subject", operator: "CONTAINS_TOKEN", value: "Task Status Report" },
      { propertyName: "createdate", operator: "LT", value: String(Date.now() - 3_600_000) }, { propertyName: "hs_object_id", operator: "GT", value: st.cursor },
    ] }],
    properties: TICKET_PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: SWEEP_PER_RUN,
  } });
  const all = j.results ?? [];
  if (!all.length) return;
  const merges = (await kvGet<{ at: string; bo: string; gqs: string; how: string; key: string; subject: string }[]>(KV.merges)) ?? [];
  const rows: Row[] = [];
  let merged = 0;
  for (const t of all.filter((x) => isTsr(x.properties.subject))) {
    const subject = t.properties.subject ?? "";
    const task = await gqsTaskOf(subject).catch(() => undefined);
    if (task === undefined) continue; // the search failed: not decided, not filed
    if (task) {
      try {
        const m = await hubspotRetry<{ id?: string | number }>({ path: "/crm/v3/objects/tickets/merge", method: "POST", body: { primaryObjectId: task.id, objectIdToMerge: t.id } });
        const into = String(m?.id ?? task.id);
        await hubspotRetry({ path: "/crm/v3/objects/notes", method: "POST", body: {
          properties: { hs_timestamp: new Date().toISOString(), hs_note_body: mergedNote(t.id, task.how, task.key, subject).split("\n").join("<br>") },
          associations: [{ to: { id: into }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
        } }).catch(() => null);
        merges.push({ at: new Date().toISOString(), bo: t.id, gqs: into, how: task.how, key: task.key, subject: subject.slice(0, 160) });
        merged++;
        continue;
      } catch (e) { console.warn(`[ticket-close] Task Status Report ${t.id} not merged into GQS ${task.id}: ${(e as Error).message.slice(0, 160)}`); }
    }
    if (t.properties.enquiry_category !== TOPIC.gqs) rows.push({ id: t.id, subject: subject.slice(0, 140), created: t.properties.createdate ?? "", closed: t.properties[`hs_v2_date_entered_${RESOLVED}`] ?? null, now: t.properties.enquiry_category ?? "", d: { category: TOPIC.gqs, sub: null, order: null, why: "Task Status Report, no GQS task found for sure", stay: null, by: "tsr" } });
  }
  if (merged) await kvSet(KV.merges, merges);
  const filed = rows.length ? await writeSafe(rows) : 0;
  await kvSet(KV.tsr, { cursor: String(all[all.length - 1].id), merged: (st.merged ?? 0) + merged, filed: (st.filed ?? 0) + filed, again: true, at: new Date().toISOString() });
  if (merged || filed) console.log(`[ticket-close] Task Status Reports: ${merged} merged into their GQS task, ${filed} filed as GQS task update - ${(st.merged ?? 0) + merged} merged, ${(st.filed ?? 0) + filed} filed so far`);
}

/**
 * Every run, while the history is not done: 25 closed tickets on one of the hub's own topics are read by the AI again,
 * and moved when it names another one.
 * - Internal e-mail (SARCLA 27.10.2026: "drill down on Internal e-mail" - "what they are about"): a request a colleague
 *   passes on gets its real topic, Finance's system mail Finance e-mail, other system reports Automatic e-mail; only
 *   internal admin stays.
 * - Spam or advertising (28.10.2026): filed while the list for mail from outside offered nothing else - Microsoft 365
 *   quarantine, an out-of-office, Finance's system mail and replies about an order were among them; read with the
 *   fuller list, only adverts and spam stay.
 */
const REREAD = {
  internal: { key: KV.internal, topic: TOPIC.internal, name: "Internal e-mail of the history", stay: "stay internal" },
  spam: { key: KV.spam, topic: TOPIC.spam, name: "Spam of the history", stay: "stay Spam" },
} as const;
async function rereadSweep(which: keyof typeof REREAD, aiLeft: number): Promise<number> {
  const { key, topic, name, stay } = REREAD[which];
  const st = (await kvGet<{ cursor: string; done?: boolean; moved?: number }>(key)) ?? { cursor: "0" };
  const client = getAnthropic();
  if (st.done || !client || aiLeft <= 0) return 0;
  const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: "hs_pipeline_stage", operator: "EQ", value: RESOLVED },
      { propertyName: "enquiry_category", operator: "EQ", value: topic }, { propertyName: "hs_object_id", operator: "GT", value: st.cursor },
    ] }],
    properties: TICKET_PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: Math.min(SWEEP_PER_RUN, aiLeft),
  } });
  const all = j.results ?? [];
  if (!all.length) { await kvSet(key, { ...st, done: true, at: new Date().toISOString() }); return 0; }
  const found = all.filter((t) => !isTsr(t.properties.subject)); // Task Status Reports are the GQS pass's
  const text = await conversations(found);
  const rows: Row[] = [];
  for (const t of found) {
    const p = t.properties, txt = text.get(t.id) ?? "";
    const from = which === "internal" || flagTopic(p.sentiment_not_valid_reason) === TOPIC.internal ? "internal" : "outside";
    const g = await aiGuess(client, p.subject, txt, from).catch(() => null);
    // out of Spam into a customer's topic only when the AI is more than guessing (dry run 29.10.2026: "Parkplatz für
    // Sonntag" -> Delivery, low)
    const weak = which === "spam" && g?.sure === "low" && !HIDDEN_TOPICS.includes(g.category) && !FLAG_TOPICS.includes(g.category);
    if (g && g.category !== topic && !weak) rows.push({ id: t.id, subject: (p.subject ?? "").slice(0, 140), created: p.createdate ?? "", closed: p[`hs_v2_date_entered_${RESOLVED}`] ?? null, now: p.enquiry_category ?? "", d: fromGuess(g, txt, p.subject) });
  }
  const moved = rows.length ? await writeSafe(rows) : 0;
  await kvSet(key, { cursor: String(all[all.length - 1].id), moved: (st.moved ?? 0) + moved, at: new Date().toISOString() });
  const by: Record<string, number> = {};
  for (const r of rows) if (r.written && !r.written.error && !r.written.skipped) by[r.d.category!] = (by[r.d.category!] ?? 0) + 1;
  console.log(`[ticket-close] ${name}: ${found.length} read, ${moved} moved to their topic${moved ? ` (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ")})` : ""}, ${found.length - moved} ${stay} - ${(st.moved ?? 0) + moved} moved so far`);
  return found.length;
}

/**
 * Once a day: the closed tickets still on Others / empty whose sentiment flag says what they are get that topic - the
 * whole history the first time, afterwards a flag the sweep set after the ticket had closed - and a hidden topic of the
 * hub's whose flag now says another one is moved. No AI.
 */
async function flagSweep(): Promise<void> {
  const last = await kvGet<{ day: string; waitingSaid?: string }>(KV.sweep);
  if (last?.day === day()) return;
  // nothing to do until the topics the flags give are options in HubSpot - said once a day, not searched every run
  const opts = await options();
  const missing = FLAG_TOPICS.filter((t) => !opts?.has(t));
  if (missing.length) {
    if (last?.waitingSaid !== day()) {
      console.log(`[ticket-close] waiting for the hidden Enquiry Category options in HubSpot: ${missing.join(", ")}`);
      await kvSet(KV.sweep, { ...last, day: last?.day ?? "", waitingSaid: day() });
    }
    return;
  }
  const base = [
    { propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: "hs_pipeline_stage", operator: "EQ", value: RESOLVED },
    { propertyName: "sentiment_not_valid_reason", operator: "HAS_PROPERTY" },
  ];
  const found = [
    ...(await search([[...base, { propertyName: "enquiry_category", operator: "EQ", value: "Others" }], [...base, { propertyName: "enquiry_category", operator: "NOT_HAS_PROPERTY" }]])),
    ...(await search([[...base, { propertyName: "enquiry_category", operator: "IN", values: [...HIDDEN_TOPICS] }]])),
  ];
  // what the AI decided (an internal e-mail read for what it is about) is not moved back by the flag
  const guessed = (await kvGet<Record<string, unknown>>(KV.guessed)) ?? {};
  const rows: Row[] = [];
  for (const t of found) {
    const p = t.properties, d = before({ subject: p.subject, text: "x", notValid: p.sentiment_not_valid_reason });
    if (p.enquiry_category && guessed[String(t.id)]) continue;
    if (isTsr(p.subject)) continue; // the GQS pass's, whatever its flag says
    if (d?.category && d.category !== p.enquiry_category) rows.push({ id: t.id, subject: (p.subject ?? "").slice(0, 140), created: p.createdate ?? "", closed: p[`hs_v2_date_entered_${RESOLVED}`] ?? null, now: p.enquiry_category ?? "", d });
  }
  const written = rows.length ? await writeSafe(rows) : 0;
  const by: Record<string, number> = {};
  for (const r of rows) if (r.written && !r.written.error && !r.written.skipped) by[r.d.category!] = (by[r.d.category!] ?? 0) + 1;
  const waiting = rows.filter((r) => r.written?.skipped?.includes("not an option")).length;
  if (rows.length) console.log(`[ticket-close] daily: ${rows.length} closed tickets with a sentiment flag get its topic - ${written} written${written ? ` (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ")})` : ""}${waiting ? `, ${waiting} wait for the hidden options in HubSpot` : ""}`);
  // a run that could not write its topics yet (options missing) tries again on the next run, not tomorrow
  if (!waiting) await kvSet(KV.sweep, { day: day(), at: new Date().toISOString(), found: found.length, written });
}

async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = (await workflowOn()) === false;
  const last = await kvGet<RunInfo>(KV.last);
  const kept = ((await kvGet<Row[]>(KV.rows)) ?? []).filter((r) => Date.now() - Date.parse(r.closed ?? r.created) < KEEP_DAYS * 86400_000);
  // a ticket the AI had no answer for (or no budget left) is looked at again, up to two days back
  const retry = kept.filter((r) => r.d.stay === "ai_failed" && r.closed).map((r) => Date.parse(r.closed!));
  const since = Math.min(last ? Date.parse(last.at) - 15 * 60_000 : Date.now() - 2 * 86400_000, ...retry.map((t) => Math.max(t, Date.now() - 2 * 86400_000)));
  const base = [{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: `hs_v2_date_entered_${RESOLVED}`, operator: "GTE", value: String(since) }];
  const found = await search([[...base, { propertyName: "enquiry_category", operator: "EQ", value: "Others" }], [...base, { propertyName: "enquiry_category", operator: "NOT_HAS_PROPERTY" }]]);
  const aiKey = `ticketClose:ai:${day()}`, used = (await kvGet<number>(aiKey)) ?? 0, aiLeft = Math.max(0, AI_PER_DAY - used);
  const seen = new Set(kept.filter((r) => r.d.stay !== "ai_failed").map((r) => r.id));
  const failed = new Set(kept.filter((r) => r.d.stay === "ai_failed").map((r) => r.id));
  // one that had no answer waits for the budget instead of being read again every run
  const todo = found.filter((t) => !seen.has(t.id) && (aiLeft > 0 || !failed.has(t.id)));
  let rows: Row[] = [], written = 0;
  if (todo.length) {
    const r = await decideAll(todo, await conversations(todo), aiLeft);
    if (r.ai) await kvSet(aiKey, used + r.ai);
    rows = r.rows;
    if (live) written = await writeSafe(rows.filter((x) => x.d.category));
    const cats = rows.filter((x) => x.d.category).map((x) => x.d.category).join(", ");
    console.log(`[ticket-close] ${todo.length} resolved on Others/empty: ${rows.filter((x) => x.d.category).length} get a category${cats ? ` (${cats})` : ""}, ${rows.filter((x) => !x.d.category).length} stay Others - ${live ? `${written} written` : "the workflow is still on: nothing written"}`);
  }
  // the two sweeps never cost the run its record: a failing one is logged and the run still keeps what it decided
  // (27.10.2026: a refused search ended every run before this, so the same tickets were asked again every 5 minutes)
  if (live) {
    try { await flagSweep(); } catch (e) { console.warn(`[ticket-close] daily pass: ${(e as Error).message}`); }
    try { await tsrSweep(); } catch (e) { console.warn(`[ticket-close] Task Status Reports: ${(e as Error).message}`); }
    const sweeps: [string, (aiLeft: number) => Promise<number>][] = [
      ["Others of the history", customerSweep],
      ["Spam of the history", (n) => rereadSweep("spam", n)],
      ["Internal e-mail of the history", (n) => rereadSweep("internal", n)],
    ];
    for (const [name, sweep] of sweeps) {
      try {
        const aiKey = `ticketClose:ai:${day()}`, usedNow = (await kvGet<number>(aiKey)) ?? 0;
        // a quiet pass is a spent budget, not a broken one - say so once a day (27.10.2026: a bug spent it by noon)
        if (usedNow >= AI_PER_DAY - LIVE_RESERVE) {
          const said = `ticketClose:budgetSaid:${day()}`;
          if (!(await kvGet<boolean>(said))) { console.log(`[ticket-close] the history passes have used their ${AI_PER_DAY - LIVE_RESERVE} AI answers of the day (${LIVE_RESERVE} are kept for the tickets closing) - they go on after midnight (UTC)`); await kvSet(said, true); }
          break;
        }
        const spent = await sweep(AI_PER_DAY - LIVE_RESERVE - usedNow);
        if (spent) await kvSet(aiKey, usedNow + spent);
      } catch (e) { console.warn(`[ticket-close] ${name}: ${(e as Error).message}`); }
    }
  }
  const byId = new Map(kept.map((x) => [x.id, x]));
  for (const x of rows) byId.set(x.id, x);
  await kvSet(KV.rows, [...byId.values()].sort((a, b) => String(b.closed).localeCompare(String(a.closed))).slice(0, 3000));
  const info: RunInfo = { at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), found: found.length, decided: rows.length, written, live };
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(): Promise<RunInfo | null> {
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, found: 0, decided: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
        console.warn(`[ticket-close] ${info.error}`);
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
export function startTicketClose() {
  if (started || process.env.TICKET_CLOSE === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, 4 * EVERY_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[ticket-close] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 240_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}
