// THE SENTIMENT SWEEP - the hub's half of "SARCLA | BO SENTIMENT AND TONE" (flow 4333972706).
//
// SARCLA, 24.10.2026: a tab on Back Office distribution to replace that workflow, "we need also
// to improve it a lot because today results are not that great", able to report, and able to
// "disqualify some that are not real ticket".
//
// What the workflow does: three minutes after a ticket enters one of four Back-Office stages it
// counts keyword hits in four languages and writes sentiment_customer_tone and
// sentiment_resolution. What it produced, measured on 31,577 live tickets: 64% of tone "neutral"
// and 22% "negative" - the latter mostly because one "urgent" scored six against a threshold of
// two. See legacy.ts for the defects, detect.ts for the scoring that replaces them,
// realTicket.ts for the gate and ai.ts for the model.
//
// SHADOW BY DEFAULT. The sweep computes and stores, writes nothing to HubSpot, and sets its
// answer beside the workflow's own so the two can be compared on the same ticket before anyone
// switches over. The cut-over is then the one the GQS and Back-Office routing used: turn the hub
// on, turn the workflow off, and if anything looks wrong turn the workflow back on.

import { kvGet, kvSet } from "../db/init";
import { getAnthropic } from "../ai/claude";
import { hubspotFetchJson } from "../integrations/hubspot";
import { AI_PER_DAY, AI_PER_RUN, aiSentiment, type AiAnswer } from "./ai";
import { detect, needsModel, type Bucket, type Mail } from "./detect";
import { legacyScore } from "./legacy";
import { gate, type DisqualifyReason } from "./realTicket";

type Props = Record<string, string | null>;
type Obj = { id: string; properties?: Props };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };

const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) =>
  hubspotFetchJson<T>({ path, method, body });

/** The Back-Office pipeline and the four stages the workflow enrols on, unchanged. */
export const BO_PIPELINE = "1726786777";
export const WORKFLOW_STAGES = ["2338266328", "2338266327", "2338266326", "2728031473"];
export const WORKFLOW_ID = "4333972706";
/** The two properties the workflow writes. Only these three values are allowed in them. */
export const TONE_PROP = "sentiment_customer_tone";
export const RESOL_PROP = "sentiment_resolution";
export const WRITABLE: Bucket[] = ["positive", "neutral", "negative"];

const MAX_PER_RUN = 40;
const DAYS_KEPT = 21;
const MAIL_PROPS = ["hs_email_text", "hs_email_html", "hs_email_direction", "hs_timestamp", "hs_email_from_email"];
const TICKET_PROPS = ["subject", "content", "close_note", "closed_lost_reason", "hs_pipeline_stage", "createdate", "hs_lastmodifieddate", TONE_PROP, RESOL_PROP];

export type Mode = "off" | "shadow" | "live";
export type Settings = {
  mode: Mode;
  /** Ask the model where the words run out. Off = the keyword layer alone, and more "unknown". */
  aiOn: boolean;
  /** Count a template the customer replied to as a real ticket (realTicket.ts explains the choice). */
  templateRepliesCount: boolean;
  by: string | null;
  at: string | null;
};
const DEFAULTS: Settings = { mode: "shadow", aiOn: true, templateRepliesCount: false, by: null, at: null };

export type Answer = { tone: Bucket; resolution: Bucket; source: "keywords" | "model" | "none" };

export type Row = {
  ticketId: string;
  subject: string;
  stage: string;
  at: string;
  /** Was a customer talking at all, and if not, why. */
  real: boolean;
  reasons: DisqualifyReason[];
  /** The cheap scorer: what it said and how sure it was. */
  keywords: { tone: Bucket; toneConfidence: number; resolution: Bucket; urgency: number; lang: string; hits: string[] };
  /** The model, when it was asked. */
  ai?: AiAnswer | null;
  /** What the hub stands behind. */
  answer: Answer;
  /** What the workflow itself wrote on this ticket, for the comparison. */
  workflow: { tone: string | null; resolution: string | null };
  /** The workflow's algorithm, re-run here on the same mails - so a difference can be explained. */
  replay: { tone: Bucket; resolution: Bucket };
  /** live only: what was written, or why it was not. */
  written?: { tone?: string; resolution?: string } | null;
  skipped?: string;
  error?: string;
};

export type RunInfo = {
  at: string;
  seconds: number;
  looked: number;
  excluded: number;
  scored: number;
  asked: number;
  aiToday: number;
  wrote: number;
  mode: Mode;
  /** live was asked for but is standing down - the workflow still owns the properties. */
  heldBy?: string;
  error?: string;
};

const KV = {
  settings: "boSentiment:settings",
  last: "boSentiment:lastRun",
  cursor: "boSentiment:cursor",
  aiDay: (d: string) => `boSentiment:ai:${d}`,
  day: (d: string) => `boSentiment:rows:${d}`,
};

const today = () => new Date().toISOString().slice(0, 10);

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(KV.settings);
  return { ...DEFAULTS, ...(s ?? {}) };
}
export async function saveSettings(patch: Partial<Settings>, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = {
    mode: patch.mode && ["off", "shadow", "live"].includes(patch.mode) ? patch.mode : cur.mode,
    aiOn: typeof patch.aiOn === "boolean" ? patch.aiOn : cur.aiOn,
    templateRepliesCount: typeof patch.templateRepliesCount === "boolean" ? patch.templateRepliesCount : cur.templateRepliesCount,
    by, at: new Date().toISOString(),
  };
  await kvSet(KV.settings, next);
  return next;
}
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;
export const aiUsedToday = async () => (await kvGet<number>(KV.aiDay(today()))) ?? 0;

const rowsOfDay = async (d: string) => (await kvGet<Row[]>(KV.day(d))) ?? [];
export async function recentRows(days = 7): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < days; i++) {
    out.push(...(await rowsOfDay(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))));
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Is the HubSpot workflow still switched on?
 *
 * The same lock the Back-Office routing take-over used: while the workflow is on, live mode
 * writes NOTHING, because both would be writing the same two properties and the later write
 * would win at random. It also makes the rollback trivial - switch the workflow back on and the
 * hub stands down by itself, with no deploy. null means the question could not be asked, which
 * counts as "on": the safe answer.
 */
export async function workflowOn(): Promise<boolean | null> {
  try {
    const f = await hs<{ isEnabled?: boolean }>(`/automation/v4/flows/${WORKFLOW_ID}`);
    return f.isEnabled === true;
  } catch {
    return null;
  }
}

const chunk = <T>(a: T[], n: number): T[][] => {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
};

/** Every mail on these tickets, in two batched calls per hundred rather than two per ticket. */
async function mailsFor(ids: string[]): Promise<Map<string, Mail[]>> {
  const out = new Map<string, Mail[]>();
  for (const part of chunk(ids, 100)) {
    const assoc = await hs<{ results?: { from: { id: string }; to?: { toObjectId: string }[] }[] }>(
      "/crm/v4/associations/tickets/emails/batch/read", "POST", { inputs: part.map((id) => ({ id })) },
    );
    const idsByTicket = new Map<string, string[]>();
    const all = new Set<string>();
    for (const row of assoc.results ?? []) {
      // the newest twenty is as far back as the workflow ever looked
      const list = (row.to ?? []).map((x) => String(x.toObjectId)).slice(-20);
      idsByTicket.set(String(row.from.id), list);
      for (const i of list) all.add(i);
    }
    const props = new Map<string, Props>();
    for (const ps of chunk([...all], 100)) {
      const batch = await hs<{ results?: Obj[] }>("/crm/v3/objects/emails/batch/read", "POST", {
        properties: MAIL_PROPS, inputs: ps.map((id) => ({ id })),
      });
      for (const e of batch.results ?? []) props.set(e.id, e.properties ?? {});
    }
    for (const [tid, list] of idsByTicket) {
      out.set(tid, list.map((id) => {
        const p = props.get(id) ?? {};
        return {
          text: p.hs_email_text ?? "", html: p.hs_email_html ?? "",
          direction: p.hs_email_direction ?? "", from: p.hs_email_from_email ?? "",
          at: p.hs_timestamp ? new Date(p.hs_timestamp).getTime() : 0,
        };
      }));
    }
  }
  return out;
}

/** The tickets to look at: the workflow's own stages, oldest change first, from where we stopped. */
async function candidates(cursorMs: number): Promise<Obj[]> {
  const j = await hs<Page>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{
      filters: [
        { propertyName: "hs_pipeline", operator: "EQ", value: BO_PIPELINE },
        { propertyName: "hs_pipeline_stage", operator: "IN", values: WORKFLOW_STAGES },
        { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(cursorMs) },
      ],
    }],
    properties: TICKET_PROPS,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
    limit: MAX_PER_RUN,
  });
  return j.results ?? [];
}

type Client = Parameters<typeof aiSentiment>[0];

/**
 * One ticket, scored now and stored nowhere - the tab's "why did this ticket get that answer" box.
 *
 * Returns the words that fired on each side as well as the verdicts, because "negative" on its own
 * is not something anybody can argue with, and arguing with it is the point of the box.
 */
export async function checkTicket(id: string, client: Client | null): Promise<{
  ticketId: string; subject: string; stage: string;
  real: boolean; reasons: DisqualifyReason[];
  keywords: ReturnType<typeof detect>;
  replay: { tone: Bucket; resolution: Bucket; tonePos: number; toneNeg: number; resolPos: number; resolNeg: number };
  workflow: { tone: string | null; resolution: string | null };
  ai: AiAnswer | null;
  wouldAsk: boolean;
}> {
  const t = await hs<Obj>(`/crm/v3/objects/tickets/${id}?properties=${TICKET_PROPS.join(",")}`);
  const p = t.properties ?? {};
  const mails = (await mailsFor([id])).get(id) ?? [];
  const settings = await getSettings();
  const g = gate({ subject: p.subject, mails }, { templateRepliesCount: settings.templateRepliesCount });
  const d = detect({ subject: p.subject, content: p.content, close_note: p.close_note, mails });
  const r = legacyScore({
    subject: p.subject, content: p.content, close_note: p.close_note, closed_lost_reason: p.closed_lost_reason,
    mails: mails.map((m) => ({ text: m.text, direction: m.direction })),
  });
  const wouldAsk = g.real && needsModel(d);
  let ai: AiAnswer | null = null;
  if (wouldAsk && client && settings.aiOn) ai = await aiSentiment(client, p.subject, mails).catch(() => null);
  return {
    ticketId: id, subject: p.subject ?? "", stage: p.hs_pipeline_stage ?? "",
    real: g.real, reasons: g.reasons, keywords: d,
    replay: { tone: r.tone, resolution: r.resolution, tonePos: r.tonePos, toneNeg: r.toneNeg, resolPos: r.resolPos, resolNeg: r.resolNeg },
    workflow: { tone: p[TONE_PROP] ?? null, resolution: p[RESOL_PROP] ?? null },
    ai, wouldAsk,
  };
}

/**
 * One pass.
 *
 * `client` null means the model is not available (no key, or switched off): the keyword answer
 * stands and the row says so, rather than the sweep failing.
 */
export async function runOnce(client: Client | null, by = "schedule"): Promise<RunInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  const t0 = Date.now();
  const info: RunInfo = {
    at: new Date().toISOString(), seconds: 0, looked: 0, excluded: 0, scored: 0,
    asked: 0, aiToday: await aiUsedToday(), wrote: 0, mode: settings.mode,
  };
  try {
    // live only takes effect once the workflow is off; until then this is shadow whatever the
    // setting says, and the run info says so rather than pretending to be live
    const stillOn = settings.mode === "live" ? await workflowOn() : false;
    const writing = settings.mode === "live" && stillOn === false;
    if (settings.mode === "live" && !writing) info.heldBy = stillOn === null ? "could not read the workflow" : "the HubSpot workflow is still on";

    const cursor = (await kvGet<number>(KV.cursor)) ?? Date.now() - 60 * 60_000;
    const tickets = await candidates(cursor);
    info.looked = tickets.length;
    if (!tickets.length) {
      await kvSet(KV.last, { ...info, seconds: Math.round((Date.now() - t0) / 100) / 10 });
      return info;
    }
    const mails = await mailsFor(tickets.map((t) => t.id));
    const byDay = new Map<string, Row[]>();
    let newest = cursor;

    for (const t of tickets) {
      const p = t.properties ?? {};
      const modified = p.hs_lastmodifieddate ? new Date(p.hs_lastmodifieddate).getTime() : 0;
      if (modified > newest) newest = modified;
      const list = mails.get(t.id) ?? [];
      const g = gate({ subject: p.subject, mails: list }, { templateRepliesCount: settings.templateRepliesCount });
      const d = detect({ subject: p.subject, content: p.content, close_note: p.close_note, mails: list });
      const replay = legacyScore({
        subject: p.subject, content: p.content, close_note: p.close_note,
        closed_lost_reason: p.closed_lost_reason,
        mails: list.map((m) => ({ text: m.text, direction: m.direction })),
      });
      const row: Row = {
        ticketId: t.id,
        subject: (p.subject ?? "").slice(0, 120),
        stage: p.hs_pipeline_stage ?? "",
        at: new Date().toISOString(),
        real: g.real,
        reasons: g.reasons,
        keywords: {
          tone: d.tone, toneConfidence: Math.round(d.toneConfidence * 100) / 100,
          resolution: d.resolution, urgency: d.urgency, lang: d.lang,
          hits: d.customer.hits.slice(0, 6).map((h) => `${h.term}(${h.dim})`),
        },
        answer: { tone: "unknown", resolution: "unknown", source: "none" },
        workflow: { tone: p[TONE_PROP] ?? null, resolution: p[RESOL_PROP] ?? null },
        replay: { tone: replay.tone, resolution: replay.resolution },
      };

      if (!g.real) {
        info.excluded += 1;
      } else {
        info.scored += 1;
        row.answer = { tone: d.tone, resolution: d.resolution, source: "keywords" };
        const canAsk = settings.aiOn && client && needsModel(d)
          && info.asked < AI_PER_RUN && info.aiToday + info.asked < AI_PER_DAY;
        if (canAsk) {
          try {
            const a = await aiSentiment(client, p.subject, list);
            row.ai = a;
            info.asked += 1;
            if (a.machine) {
              // the model's second opinion on the gate: nobody is talking after all
              row.real = false;
              row.reasons = [...row.reasons, "model_says_machine"];
              row.answer = { tone: "unknown", resolution: "unknown", source: "none" };
              info.excluded += 1;
              info.scored -= 1;
            } else {
              row.answer = { tone: a.tone, resolution: a.resolution, source: "model" };
            }
          } catch (e) {
            row.error = (e as Error).message.slice(0, 160);
          }
        }
      }

      if (writing) {
        const props: Record<string, string> = {};
        if (row.real && WRITABLE.includes(row.answer.tone)) props[TONE_PROP] = row.answer.tone;
        if (row.real && WRITABLE.includes(row.answer.resolution)) props[RESOL_PROP] = row.answer.resolution;
        if (Object.keys(props).length) {
          try {
            await hs(`/crm/v3/objects/tickets/${t.id}`, "PATCH", { properties: props });
            row.written = props;
            info.wrote += 1;
          } catch (e) {
            row.error = (e as Error).message.slice(0, 160);
          }
        } else {
          // The property is an enumeration of positive/neutral/negative only, so "unknown" and
          // a disqualified ticket cannot be SAID in HubSpot - the old value is left alone rather
          // than a wrong one written over it. Adding an "unknown" option would let the hub say it.
          row.skipped = row.real ? "nothing certain to write" : "not a real ticket";
        }
      }

      const d0 = row.at.slice(0, 10);
      if (!byDay.has(d0)) byDay.set(d0, await rowsOfDay(d0));
      byDay.get(d0)!.push(row);
    }

    for (const [d0, rows] of byDay) await kvSet(KV.day(d0), rows.slice(-2000));
    await kvSet(KV.cursor, Math.max(cursor, newest) + 1);
    if (info.asked) await kvSet(KV.aiDay(today()), info.aiToday + info.asked);
    await kvSet(KV.day(new Date(Date.now() - DAYS_KEPT * 86400_000).toISOString().slice(0, 10)), null);
    info.seconds = Math.round((Date.now() - t0) / 100) / 10;
    await kvSet(KV.last, info);
    console.log(`[bo-sentiment] ${settings.mode} by ${by}: ${JSON.stringify({ looked: info.looked, excluded: info.excluded, scored: info.scored, asked: info.asked, wrote: info.wrote, seconds: info.seconds })}`);
    return info;
  } catch (e) {
    info.error = (e as Error).message.slice(0, 300);
    info.seconds = Math.round((Date.now() - t0) / 100) / 10;
    await kvSet(KV.last, info);
    console.warn(`[bo-sentiment] ${(e as Error).message}`);
    return info;
  }
}

/**
 * The scheduled pass, for the connectors registry.
 *
 * Builds its own model client and survives not having one: without a key the keyword layer still
 * answers and the rows say the model was not asked. Returns a plain object in every case, because
 * the registry prints what a step returns.
 */
export async function runScheduled(): Promise<Record<string, unknown>> {
  let client: Client | null = null;
  try {
    client = getAnthropic();
  } catch {
    client = null; // no ANTHROPIC_API_KEY on this task - keywords only
  }
  const info = await runOnce(client, "schedule");
  return info ?? { skipped: "switched off on the Sentiment tab" };
}
