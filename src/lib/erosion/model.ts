// EROSION ON ARTICLE LEVEL - the shapes and the arithmetic.
//
// A customer bought an article last year and has not this year; when the
// anniversary of the last purchase lapses, the detector on the Compass connector
// raises a ticket - one per company per month, every lapsed article summed. This
// app shows those tickets with their live ESO/TSA status, and the detector's
// forecast of the ones still to come.
//
// No server imports here, so the page, the API routes and the tests all read the
// same rules. Relative imports only: the test build has no "@/" alias.

import { ESO_OWNERS, PIPE_STAGE, TSA_OWNERS } from "../datatracker/rosters";

export type Team = "ESO" | "TSA";

export type ErosionTicket = {
  id: string;
  subject: string;
  /** Local (Zurich) day the ticket was created, YYYY-MM-DD. */
  created: string;
  /** Local day it was closed, or null while it is open. */
  closed: string | null;
  stage: string;
  stageClosed: boolean;
  pipeline: string;
  resolution: string | null;
  resolutionDetail: string | null;
  /** The rep's latest note, for closed tickets that carry no resolution field. */
  closingNote: string | null;
  team: Team | null;
  owner: string;
  priority: string | null;
  /** EUR of last year's invoiced revenue on the lapsed articles. */
  amount: number;
  article: string | null;
  articleDescription: string | null;
  company: string | null;
  un: string | null;
  lastOrder: string | null;
};

export type ErosionTickets = {
  generatedAt: string;
  tickets: ErosionTicket[];
  /** Set when closing notes could not be read at all - one field goes blank, not the app. */
  notesError: string | null;
};

/** One company's forecast ticket: every article lapsing for it that month. */
export type ForecastItem = {
  due: string;
  articles: string[];
  un: string;
  company: string;
  amount: number;
  team: Team | null;
  owner: string;
};

export type DetectorSummary = {
  watermark: string | null;
  lastRun: string | null;
  /** Article keys the detector has ticketed since its watermark - ARTICLES, not tickets. */
  articlesTicketed: number | null;
  createdToday: number | null;
  mergedToday: number | null;
  skippedOpenOrderToday: number | null;
  skippedOwnerToday: number | null;
};

export type ErosionForecast = {
  generated: string | null;
  /** Days from the forecast's run to the end of the year. */
  horizonDays: number;
  items: ForecastItem[];
  summary: DetectorSummary | null;
};

/** Ticket properties read from HubSpot - the erosion group plus the portal's real resolution fields. */
export const TICKET_PROPERTIES = [
  "subject", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "createdate", "closed_date",
  "hs_ticket_priority", "hs_resolution",
  // The portal does not use hs_resolution: closing an ESO/TSA ticket asks for this
  // dropdown and its free-text detail. The other three are older variants.
  "ticket_resolution_eso", "more_information_about_the_ticket_resolution_eso",
  "resolution___win_back_action", "stopped_buying_reason", "back_office_ticket_outcome",
  "erosion_amount_2025", "erosion_article", "erosion_article_description",
  "erosion_company", "erosion_customer_number", "erosion_last_order_date",
] as const;

/** First non-empty wins, in the order the connector has always used. */
const RESOLUTION_FIELDS = [
  "hs_resolution", "ticket_resolution_eso", "resolution___win_back_action",
  "back_office_ticket_outcome", "stopped_buying_reason",
] as const;

/* ── text ─────────────────────────────────────────────────────────────── */

// cp1252 puts printable characters in 0x80-0x9F where latin-1 has controls.
// 'Ø' loaded double-encoded arrives as 'Ã˜' - and '˜' is cp1252 0x98.
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Some names were loaded double-encoded (UTF-8 bytes read as cp1252), so
 * 'Präzisions' arrives as 'PrÃ¤zisions'. Repair it when the round trip is
 * clean; otherwise leave the string exactly as it came.
 */
export function fixText(s: string): string {
  if (!s || (!s.includes("Ã") && !s.includes("Â"))) return s;
  const bytes: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp <= 0xff) bytes.push(cp);
    else if (CP1252[cp] !== undefined) bytes.push(CP1252[cp]);
    else return s;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}

/** Text out of a note body: tags gone, whitespace collapsed, repaired, cut to 280. */
export function noteText(html: string): string {
  return fixText(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 280);
}

/* ── days ─────────────────────────────────────────────────────────────── */

const ZURICH_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * HubSpot stamps createdate and closed_date in UTC. Cut at character 10 a ticket
 * raised at 00:30 in Zurich would land on the day before, so the day is taken
 * in Zurich. A bare date (no time) is already a day and passes through.
 */
export function zurichDay(stamp: string | null | undefined): string | null {
  if (!stamp) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return stamp;
  const t = Date.parse(stamp);
  return Number.isFinite(t) ? ZURICH_DAY.format(new Date(t)) : null;
}

/** The LOCAL day of a Date - never toISOString(), which is the UTC day. */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from one YYYY-MM-DD to another (noon to noon, so DST cannot shave one off). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/* ── tickets ──────────────────────────────────────────────────────────── */

export type StageInfo = { label: string; pipeline: string; closed: boolean };

const PIPELINE_TEAM: Record<string, Team> = {
  [PIPE_STAGE.ESO.pipeline]: "ESO",
  [PIPE_STAGE.TSA.pipeline]: "TSA",
};

/** The roster decides; failing that, the pipeline the ticket sits in. */
export function teamFor(ownerId: string, pipelineId: string | null | undefined): Team | null {
  if (ESO_OWNERS[ownerId]) return "ESO";
  if (TSA_OWNERS[ownerId]) return "TSA";
  return PIPELINE_TEAM[pipelineId ?? ""] ?? null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function mapTicket(
  raw: { id: string; properties?: Record<string, unknown> },
  stages: Map<string, StageInfo>,
  ownerNames: Map<string, string>,
): ErosionTicket {
  const p = raw.properties ?? {};
  const stageId = text(p.hs_pipeline_stage) ?? "";
  const pipelineId = text(p.hs_pipeline);
  const sm = stages.get(stageId);
  const ownerId = text(p.hubspot_owner_id) ?? "";
  const amount = Number(text(p.erosion_amount_2025) ?? 0);
  const company = text(p.erosion_company);
  let resolution: string | null = null;
  for (const f of RESOLUTION_FIELDS) {
    resolution = text(p[f]);
    if (resolution) break;
  }
  return {
    id: raw.id,
    subject: fixText(text(p.subject) ?? ""),
    created: zurichDay(text(p.createdate)) ?? "",
    closed: zurichDay(text(p.closed_date)),
    stage: sm?.label ?? stageId,
    stageClosed: sm?.closed ?? false,
    pipeline: sm?.pipeline ?? pipelineId ?? "",
    resolution,
    resolutionDetail: text(p.more_information_about_the_ticket_resolution_eso),
    closingNote: null,
    team: teamFor(ownerId, pipelineId),
    owner: ESO_OWNERS[ownerId] ?? TSA_OWNERS[ownerId] ?? ownerNames.get(ownerId) ?? (ownerId || "(no owner)"),
    priority: text(p.hs_ticket_priority),
    amount: Number.isFinite(amount) ? amount : 0,
    article: text(p.erosion_article),
    articleDescription: text(p.erosion_article_description),
    company: company ? fixText(company) : null,
    un: text(p.erosion_customer_number),
    lastOrder: text(p.erosion_last_order_date),
  };
}

export function isClosed(t: ErosionTicket): boolean {
  return t.stageClosed || t.closed !== null;
}

/**
 * WON = closed as "Ordered", and nothing else (SARCLA, 04.10.2026). A one-shot
 * order - catalogue or C2S - is a single purchase, not the customer coming back,
 * and "Bought at AP" went to Angst+Pfister, not to us: all three count as lost.
 * Change it here and nowhere else.
 */
export const WON_RESOLUTIONS: ReadonlySet<string> = new Set(["Ordered"]);

export function isWon(t: ErosionTicket): boolean {
  return isClosed(t) && t.resolution !== null && WON_RESOLUTIONS.has(t.resolution);
}

/** The reason a closed ticket is counted under - its resolution, else what is missing. */
export function outcomeLabel(t: ErosionTicket): string {
  return t.resolution ?? (t.closingNote ? "Note only" : "No resolution");
}

/** What the closed ticket says happened. `missing` = closed with nothing recorded. */
export function resolutionText(t: ErosionTicket): { text: string; missing: boolean } {
  if (t.resolution) return { text: t.resolution + (t.resolutionDetail ? ` — ${t.resolutionDetail}` : ""), missing: false };
  if (t.closingNote) return { text: t.closingNote, missing: false };
  if (isClosed(t)) return { text: "Closed without a resolution", missing: true };
  return { text: "—", missing: false };
}

export type OutcomeRow = { label: string; count: number; eur: number; recorded: boolean; won: boolean };

/** Closed tickets counted per outcome, largest first, with the EUR behind each. */
export function resolutionTally(tickets: ErosionTicket[]): OutcomeRow[] {
  const n = new Map<string, OutcomeRow>();
  for (const t of tickets) {
    if (!isClosed(t)) continue;
    const label = outcomeLabel(t);
    let row = n.get(label);
    if (!row) n.set(label, (row = { label, count: 0, eur: 0, recorded: label !== "No resolution", won: WON_RESOLUTIONS.has(label) }));
    row.count += 1;
    row.eur += t.amount;
  }
  return [...n.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/* ── scoreboard ───────────────────────────────────────────────────────── */

export type ScoreRow = {
  n: number;
  open: number;
  closed: number;
  /** Closed with an APSOparts order - see WON_RESOLUTIONS. */
  won: number;
  eur: number;
  closedEur: number;
  wonEur: number;
  /** Days from creation to close, one entry per closed ticket that carries both dates. */
  closeDays: number[];
  /** Closed tickets per outcome label. */
  reasons: Record<string, number>;
};

export type OwnerRow = ScoreRow & { owner: string; team: Team | null };

const emptyRow = (): ScoreRow => ({ n: 0, open: 0, closed: 0, won: 0, eur: 0, closedEur: 0, wonEur: 0, closeDays: [], reasons: {} });

function add(r: ScoreRow, t: ErosionTicket): void {
  r.n += 1;
  r.eur += t.amount;
  if (isClosed(t)) {
    r.closed += 1;
    r.closedEur += t.amount;
    const why = outcomeLabel(t);
    r.reasons[why] = (r.reasons[why] ?? 0) + 1;
    if (isWon(t)) {
      r.won += 1;
      r.wonEur += t.amount;
    }
    if (t.closed && t.created) r.closeDays.push(Math.max(0, daysBetween(t.created, t.closed)));
  } else {
    r.open += 1;
  }
}

/** Won as a share of CLOSED tickets - an open ticket has not had its chance yet. */
export function winRate(r: ScoreRow): number | null {
  return r.closed ? r.won / r.closed : null;
}

/** The outcome given most often on this row's closed tickets; ties go alphabetically. */
export function topReason(r: ScoreRow): { label: string; count: number } | null {
  const best = Object.entries(r.reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? { label: best[0], count: best[1] } : null;
}

export function scoreboard(tickets: ErosionTicket[]): { teams: Record<Team, ScoreRow>; owners: OwnerRow[] } {
  const teams: Record<Team, ScoreRow> = { ESO: emptyRow(), TSA: emptyRow() };
  const owners = new Map<string, OwnerRow>();
  for (const t of tickets) {
    let o = owners.get(t.owner);
    if (!o) owners.set(t.owner, (o = { ...emptyRow(), owner: t.owner, team: t.team }));
    add(o, t);
    if (t.team) add(teams[t.team], t);
  }
  return { teams, owners: [...owners.values()] };
}

export function average(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/* ── calendar ─────────────────────────────────────────────────────────── */

export type DayCell = { created: ErosionTicket[]; forecast: ForecastItem[]; forecastEur: number };

/**
 * Tickets on the day they were created, forecast tickets on the day they fall
 * due. Two forecast entries for one company on one day are one ticket - the
 * detector raises one per company - so they are merged, never drawn twice.
 */
export function dayCells(tickets: ErosionTicket[], items: ForecastItem[]): Map<string, DayCell> {
  const cells = new Map<string, DayCell>();
  const cell = (k: string) => {
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { created: [], forecast: [], forecastEur: 0 }));
    return c;
  };
  for (const t of tickets) if (t.created) cell(t.created).created.push(t);
  for (const it of items) {
    const c = cell(it.due);
    const same = c.forecast.find((f) => f.un === it.un);
    if (same) {
      same.articles = [...same.articles, ...it.articles];
      same.amount += it.amount;
    } else {
      c.forecast.push({ ...it, articles: [...it.articles] });
    }
    c.forecastEur += it.amount;
  }
  return cells;
}

/** Forecast tickets: one per company per due day. */
export function forecastTicketCount(items: ForecastItem[]): number {
  return new Set(items.map((i) => `${i.due}|${i.un}`)).size;
}

/* ── the connector's forecast payload ─────────────────────────────────── */

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function teamOrNull(v: unknown): Team | null {
  return v === "ESO" || v === "TSA" ? v : null;
}

/**
 * The connector's `{outlook, summary}` into the shapes above. It is read
 * defensively: a malformed item is dropped rather than drawn wrong, and the
 * connector's own grouping (one item per company per month) is kept as it is.
 */
export function parseForecast(raw: unknown): ErosionForecast {
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const outlook = (typeof body.outlook === "object" && body.outlook !== null ? body.outlook : {}) as Record<string, unknown>;
  const s = typeof body.summary === "object" && body.summary !== null ? (body.summary as Record<string, unknown>) : null;
  const items: ForecastItem[] = [];
  for (const entry of Array.isArray(outlook.items) ? outlook.items : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const it = entry as Record<string, unknown>;
    const due = text(it.due);
    const un = text(it.un);
    if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !un) continue;
    const listed = Array.isArray(it.articles) ? it.articles.filter((a): a is string => typeof a === "string" && a.length > 0) : [];
    const single = text(it.article);
    items.push({
      due,
      articles: listed.length ? listed : single ? [single] : [],
      un,
      company: fixText(text(it.company) ?? un),
      amount: num(it.amount) ?? 0,
      team: teamOrNull(it.team),
      owner: text(it.owner) ?? "(no owner)",
    });
  }
  return {
    generated: text(outlook.generated),
    horizonDays: num(outlook.days) ?? 0,
    items,
    summary: s
      ? {
          watermark: text(s.watermark),
          lastRun: text(s.last_run),
          articlesTicketed: num(s.tickets_created_total),
          createdToday: num(s.created_today),
          mergedToday: num(s.merged_today),
          skippedOpenOrderToday: num(s.skipped_open_order_today),
          skippedOwnerToday: num(s.skipped_owner_today),
        }
      : null,
  };
}
