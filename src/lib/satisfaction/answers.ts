// SATISFACTION - the answers as the page reads them (SARCLA 01.11.2026: "rebuild like Visits" - the Satisfaction KPIs
// page drawn as the ESO Visits page: the figures on top, a tab per breakdown, a period and the Filters window, each graph
// its own filter and its companies, the customers' comments as a table). Pure - the tests load it as it is.
//
// The server reads the hub's copy of the survey answers (sync.ts) and places each one by rules.ts - touchpoint, country,
// language, locale, its reading - once; the page gets one small row per answer and does the rest: any period, any
// filter, the same days a year earlier, the companies behind a graph. ~4,700 answers a year.
//
// The company of an answer is its contact's: HubSpot keeps the answering contact on the answer (hs_contact_id), never a
// company; the job reads the contact's primary company (associatedcompanyid) and its name. An answer without a contact,
// or whose contact has no company, has none - it is counted, never given one.

import { COUNTRY_LABEL, LANGUAGE_LABEL, TOUCHPOINT_LABEL, add, countryIso, emptyTally, languageOf, localeOf, readingOf, storeViewOf, touchpointOf,
  type NpsGroup, type Sentiment, type Tally, type Touchpoint } from "./rules";

/** The hub's copy starts on 1 January 2024 (sync.ts) - nothing a year earlier than 2024. */
export const FIRST_DAY = 20240101;

export type SyncRun = { at: string; ok: boolean; read: number; contacts: number; companies?: number; cursor: string | null; done: boolean; error?: string };

/** The breakdowns an answer carries. */
export type SDim = "touchpoint" | "country" | "language" | "locale";
export const DIMS: SDim[] = ["touchpoint", "country", "language", "locale"];
export const NOT_KNOWN = "Not known";

/** An answer: [day yyyymmdd (Zurich), touchpoint, country, language, locale, reading, company, comment] - the breakdowns
 *  as places in `labels`, the reading as READING's, the company a place in companyIds (or NO_CONTACT / NO_COMPANY /
 *  NOT_LINKED), the comment a place in `comments` (-1 none). */
export type Answer = [number, number, number, number, number, number, number, number];
export const AN = { day: 0, touchpoint: 1, country: 2, language: 3, locale: 4, reading: 5, company: 6, comment: 7 } as const;
/** 0 = no reading (an empty answer); CSAT 1-3, NPS 4-6 - never mixed */
export const READING = ["", "happy", "neutral", "unhappy", "promoter", "passive", "detractor"] as const;
export type Reading = (typeof READING)[number];
/** no contact on the answer */
export const NO_CONTACT = -1;
/** the contact has no company in HubSpot */
export const NO_COMPANY = -2;
/** the contact's company not read yet - the job reads it within the hour */
export const NOT_LINKED = -3;

export type SatisfactionData = {
  generatedAt: string;
  /** today, the first day the read holds (yyyymmdd) */
  today: number; first: number;
  /** a page that sets the period itself (the chat page's window): its first day; null - the page picks its period */
  asked: number | null;
  touchpoints: Touchpoint[] | null;
  labels: Record<SDim, string[]>;
  answers: Answer[];
  comments: string[];
  companyIds: string[]; companyNames: string[];
  run: SyncRun | null;
};

/** No e-mail address or phone number of a customer on the page, also inside a comment. */
export const scrub = (s: string) => s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]").replace(/\+?\d[\d\s/().-]{7,}\d/g, "[phone]");

/** A row of the hub's copy, its day already in Zurich's time. */
export type FeedbackRow = {
  id: string; day: number; survey_name: string | null; form_guid: string | null; value: string | number | null; sentiment: string | null;
  response_group: string | null; country: string | null; contact_id: string | null; contact_country: string | null; submission_url: string | null;
  comment: string | null; company_id: string | null; company_name: string | null;
};

const readingCode = (r: { sentiment: Sentiment | null; nps: NpsGroup | null }) => (r.sentiment ? READING.indexOf(r.sentiment) : r.nps ? READING.indexOf(r.nps) : 0);

/** The answers placed, one row each - the touchpoints given only (the chat page: the chats' two). */
export function packAnswers(rows: FeedbackRow[], o: { today: number; first: number; asked: number | null; touchpoints: Touchpoint[] | null; generatedAt: string; run: SyncRun | null }): SatisfactionData {
  const labels: Record<SDim, string[]> = { touchpoint: [], country: [], language: [], locale: [] };
  const at: Record<SDim, Map<string, number>> = { touchpoint: new Map(), country: new Map(), language: new Map(), locale: new Map() };
  const place = (k: SDim, label: string) => { let i = at[k].get(label); if (i === undefined) { i = labels[k].push(label) - 1; at[k].set(label, i); } return i; };
  const companyIds: string[] = [], companyNames: string[] = [], coAt = new Map<string, number>();
  const comments: string[] = [];
  const answers: Answer[] = [];
  for (const x of rows) {
    if (x.day < o.first || x.day > o.today) continue;
    const tp = touchpointOf(x.survey_name, x.form_guid);
    if (o.touchpoints && !o.touchpoints.includes(tp)) continue;
    const r = readingOf({ surveyName: x.survey_name, sentiment: x.sentiment, value: x.value, group: x.response_group });
    const view = storeViewOf(x.submission_url);
    const lang = languageOf(x.survey_name) ?? view?.language ?? null;
    const country = view?.country ?? countryIso(x.country) ?? countryIso(x.contact_country);
    const locale = view ? `${view.language}-${view.country}` : localeOf(lang, country);
    let co: number;
    if (!x.contact_id) co = NO_CONTACT;
    else if (x.company_id === null) co = NOT_LINKED;
    else if (x.company_id === "") co = NO_COMPANY;
    else {
      const k = coAt.get(x.company_id);
      if (k !== undefined) co = k;
      else { co = companyIds.push(x.company_id) - 1; companyNames.push(x.company_name || `Company ${x.company_id}`); coAt.set(x.company_id, co); }
    }
    const text = x.comment ? scrub(x.comment).slice(0, 600) : "";
    answers.push([
      x.day, place("touchpoint", TOUCHPOINT_LABEL[tp]),
      place("country", country ? COUNTRY_LABEL[country] ?? country : NOT_KNOWN),
      place("language", lang ? LANGUAGE_LABEL[lang] ?? lang : NOT_KNOWN),
      place("locale", locale ?? NOT_KNOWN),
      readingCode(r), co, text ? comments.push(text) - 1 : -1,
    ]);
  }
  answers.sort((a, b) => a[AN.day] - b[AN.day]);
  return { generatedAt: o.generatedAt, today: o.today, first: o.first, asked: o.asked, touchpoints: o.touchpoints, labels, answers, comments, companyIds, companyNames, run: o.run };
}

/* ── days ───────────────────────────────────────────────────────────────── */

/** "2026-03-05" -> 20260305 */
export const dayOf = (iso: string) => Number(iso.slice(0, 10).replace(/-/g, ""));
/** 20260305 -> "2026-03-05" */
export const isoOf = (n: number) => `${Math.floor(n / 10000)}-${String(Math.floor(n / 100) % 100).padStart(2, "0")}-${String(n % 100).padStart(2, "0")}`;
const utc = (n: number) => Date.UTC(Math.floor(n / 10000), (Math.floor(n / 100) % 100) - 1, n % 100);
const ofUtc = (t: number) => { const d = new Date(t); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
export const addDays = (n: number, k: number) => ofUtc(utc(n) + k * 86_400_000);
/** The days from one day to another, both counted. */
export const daysBetween = (a: number, b: number) => Math.round((utc(b) - utc(a)) / 86_400_000) + 1;
/** The same day a year earlier - 29 February to the 28th. */
export const yearBack = (n: number) => (n % 10000 === 229 ? n - 10000 - 1 : n - 10000);
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** The months a range of days touches, as yyyymm. */
export function monthsOf(a: number, b: number): number[] {
  const out: number[] = [];
  let y = Math.floor(a / 10000), m = Math.floor(a / 100) % 100;
  while (y * 100 + m <= Math.floor(b / 100)) {
    out.push(y * 100 + m);
    if (m === 12) { y++; m = 1; } else m++;
  }
  return out;
}

/* ── the period ─────────────────────────────────────────────────────────── */

/** A range of days, both ends in. */
export type SWin = { a: number; b: number };
export type Preset = { id: string; label: string; title: string; win: SWin; quarter?: boolean; disabled?: boolean };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The ready-made periods: year and month to date, last month, the last 12 months, last year, this year's quarters (the
 *  running one to date, the ones to come greyed). */
export function presetsOf(today: number): Preset[] {
  const y = Math.floor(today / 10000), m = Math.floor(today / 100) % 100;
  const lm = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const out: Preset[] = [
    { id: "ytd", label: "Year to date", title: "year to date", win: { a: y * 10000 + 101, b: today } },
    { id: "mtd", label: "Month to date", title: "month to date", win: { a: y * 10000 + m * 100 + 1, b: today } },
    { id: "lm", label: `${MONTHS_FULL[lm.m - 1]} ${lm.y}`, title: `${MONTHS_FULL[lm.m - 1]} ${lm.y}`, win: { a: lm.y * 10000 + lm.m * 100 + 1, b: lm.y * 10000 + lm.m * 100 + daysInMonth(lm.y, lm.m - 1) } },
    { id: "l12", label: "Last 12 months", title: "the last 12 months", win: { a: addDays(yearBack(today), 1), b: today } },
    { id: "ly", label: String(y - 1), title: String(y - 1), win: { a: (y - 1) * 10000 + 101, b: (y - 1) * 10000 + 1231 } },
  ];
  for (let q = 0; q < 4; q++) {
    const from = y * 10000 + (q * 3 + 1) * 100 + 1, end = y * 10000 + (q * 3 + 3) * 100 + daysInMonth(y, q * 3 + 2);
    const running = today >= from && today < end, future = today < from;
    const label = `Q${q + 1} ${y}${running ? " to date" : ""}`;
    out.push({ id: `q${q + 1}`, label, title: label, win: { a: from, b: Math.min(end, today) }, quarter: true, disabled: future });
  }
  return out;
}
/** Days as words: "3 Mar – 17 May 2026", "3 – 17 Mar 2026", "5 Mar 2026" */
export function rangeWords(a: number, b: number) {
  const day = (n: number) => n % 100, mon = (n: number) => MONTHS[(Math.floor(n / 100) % 100) - 1], yr = (n: number) => Math.floor(n / 10000);
  if (a === b) return `${day(a)} ${mon(a)} ${yr(a)}`;
  if (Math.floor(a / 100) === Math.floor(b / 100)) return `${day(a)} – ${day(b)} ${mon(b)} ${yr(b)}`;
  return yr(a) === yr(b) ? `${day(a)} ${mon(a)} – ${day(b)} ${mon(b)} ${yr(b)}` : `${day(a)} ${mon(a)} ${yr(a)} – ${day(b)} ${mon(b)} ${yr(b)}`;
}
/** The same days a year earlier - when the read reaches back that far, else null (no comparison, never half a one). */
export function lastYearOf(d: { first: number }, w: SWin): SWin | null {
  const a = yearBack(w.a), b = yearBack(w.b);
  return a >= d.first ? { a, b } : null;
}

/* ── the figures ────────────────────────────────────────────────────────── */

export type SFilters = Partial<Record<SDim, string[]>>;
export const labelOf = (d: SatisfactionData, r: Answer, dim: SDim) => d.labels[dim][r[AN[dim]]] ?? NOT_KNOWN;

/** The answers of a range of days under the filters - all but `skip`'s (a filter's own list keeps its other values). */
export function rowsOf(d: SatisfactionData, w: SWin, f: SFilters, skip?: SDim): Answer[] {
  const want = DIMS.filter((k) => k !== skip && f[k]?.length).map((k) => [AN[k], new Set(f[k]!.map((l) => d.labels[k].indexOf(l)))] as const);
  return d.answers.filter((r) => r[AN.day] >= w.a && r[AN.day] <= w.b && want.every(([i, s]) => s.has(r[i])));
}

export type SStats = { tally: Tally; comments: number };
export const blankStats = (): SStats => ({ tally: emptyTally(), comments: 0 });
/** A reading as rules.ts counts it. */
export function readingOfCode(code: number): { sentiment: Sentiment | null; nps: NpsGroup | null } {
  const r = READING[code] ?? "";
  if (r === "happy" || r === "neutral" || r === "unhappy") return { sentiment: r, nps: null };
  if (r === "promoter" || r === "passive" || r === "detractor") return { sentiment: null, nps: r };
  return { sentiment: null, nps: null };
}
/** The figures of answers by a key (a breakdown's label), or all together under "". */
export function statsBy(rows: Answer[], key?: (r: Answer) => string): Map<string, SStats> {
  const out = new Map<string, SStats>();
  for (const r of rows) {
    const k = key ? key(r) : "";
    const s = out.get(k) ?? blankStats();
    add(s.tally, readingOfCode(r[AN.reading]));
    if (r[AN.comment] >= 0) s.comments++;
    out.set(k, s);
  }
  return out;
}
/** Each month's figures, yyyymm. */
export const byMonth = (rows: Answer[]) => statsBy(rows, (r) => String(Math.floor(r[AN.day] / 100)));
export const csatAnswers = (t: Tally) => t.happy + t.neutral + t.unhappy;
export const npsAnswers = (t: Tally) => t.promoters + t.passives + t.detractors;

/** The companies behind answers: each one's figures, the most answers first; the answers without one, by why. */
export type CompanyFigures = { ci: number; s: SStats; last: number; touchpoints: Map<number, number>; countries: Map<number, number> };
export function companiesOf(rows: Answer[]): { companies: CompanyFigures[]; noContact: number; noCompany: number; notLinked: number } {
  const by = new Map<number, CompanyFigures>();
  let noContact = 0, noCompany = 0, notLinked = 0;
  for (const r of rows) {
    const ci = r[AN.company];
    if (ci === NO_CONTACT) { noContact++; continue; }
    if (ci === NO_COMPANY) { noCompany++; continue; }
    if (ci < 0) { notLinked++; continue; }
    const c = by.get(ci) ?? { ci, s: blankStats(), last: 0, touchpoints: new Map<number, number>(), countries: new Map<number, number>() };
    add(c.s.tally, readingOfCode(r[AN.reading]));
    if (r[AN.comment] >= 0) c.s.comments++;
    c.last = Math.max(c.last, r[AN.day]);
    c.touchpoints.set(r[AN.touchpoint], (c.touchpoints.get(r[AN.touchpoint]) ?? 0) + 1);
    c.countries.set(r[AN.country], (c.countries.get(r[AN.country]) ?? 0) + 1);
    by.set(ci, c);
  }
  const companies = [...by.values()].sort((a, b) => b.s.tally.answers - a.s.tally.answers || b.last - a.last || a.ci - b.ci);
  return { companies, noContact, noCompany, notLinked };
}

/** A comment's order: the unhappy first (an NPS detractor with them), then neutral, then happy, an empty reading last. */
export const READING_RANK: Record<Reading, number> = { unhappy: 0, detractor: 0, neutral: 1, passive: 1, happy: 2, promoter: 2, "": 3 };
