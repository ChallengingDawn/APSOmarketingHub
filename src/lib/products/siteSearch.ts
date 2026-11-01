// PRODUCTS REPORTS > SEARCH (SARCLA 01.11.2026 on Products Reports: "we should really create subtabs" - his pick "Search"):
// what customers type into the shop's search bar, the searches that found nothing - the products we miss - and how often, by
// language and store, month by month, the terms. Pure: the search bar's own answers go in (its gateway: the report, the gaps,
// the last searches one by one - src/lib/products/siteSearchRead.ts asks for them), the page's figures come out.
//
// What each number is:
//   - a SEARCH is the bar's own "settled" search (APSOAssistant smart-bar/gateway routes/smart-bar-report.js): the bar
//     searches as one types and logs every pause, so a text the next one in the same store extends within 20 seconds is a
//     keystroke, not a search; one character is not a search; our nightly test phrases are not customers. Counted from the
//     day the bar went live on the shop (5 Jul 2026) - there is no year earlier to compare with.
//   - FOUND NOTHING is the bar's own rule: no result shown (views that draw a table count as found, a special article's quick
//     order card too), or the bar passed the text to its AI. Still too high (memory reference_ga4_shop_item_events): a word
//     typed slowly, or corrected, finds nothing a moment before the whole word does - so the last searches are read one by
//     one (typingSample) and those followed within a minute by a longer or shorter text are counted apart.
//   - the report answers a window that ends NOW - the last 7, 30, 90 days, or everything since the bar went live - with its
//     days, its stores and its terms for that window; it has no months per store and no terms per store (a term carries the
//     stores it was typed in, its count is every store's). The page says so where it matters.
//   - the log carries no customer, no session, no company: nothing here can name a company.
//   - the log can hold a password or an e-mail typed into the bar by mistake: such a text is counted, never shown (isPrivate).
//   - WE HAVE IT (SARCLA 01.11.2026 on "The terms that found nothing most" - pom, ptfe, peek, dichtung, stopfen: "you should
//     exclude the one we have and should find"): a text that found something at least once since the bar went live is a
//     product we have, so a search of it that found nothing is not a product we miss - the Found nothing tab lists only the
//     texts that never found anything, and counts the others apart (haveOf, neverOf; the gateway's full list of texts).

import { searchKind, type SearchKind } from "../marketingKpis/engageCube";
import { countryName } from "../marketingKpis/countries";

export const PERIODS = [
  { id: "7", days: 7, label: "Last 7 days" },
  { id: "30", days: 30, label: "Last 30 days" },
  { id: "90", days: 90, label: "Last 90 days" },
  { id: "all", days: null, label: "Since the bar went live" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];
export const periodOf = (x: string | null | undefined): PeriodId => (PERIODS.some((p) => p.id === x) ? (x as PeriodId) : "all");

/* ── the store ─────────────────────────────────────────────────────────── */

const LANG: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", es: "Spanish", pt: "Portuguese" };
/** "de-CH" -> "German · Switzerland", "en-INT" -> "English · International" - the code as it is when it is something else. */
export function storeLabel(locale: string): string {
  const m = /^([a-z]{2})[-_]([A-Za-z]{2,3})$/.exec((locale ?? "").trim());
  if (!m) return locale || "No store";
  const lang = LANG[m[1]] ?? m[1];
  const c = m[2].toUpperCase();
  return `${lang} · ${c === "INT" ? "International" : countryName(c)}`;
}

/* ── what is never shown ───────────────────────────────────────────────── */

// "passw", not "pass": a Passfeder (parallel key) or a Passscheibe (shim) is a product
const SECRET_WORDS = /passw|kennw|mot de passe|wachtw|has[łl]o|contrase/i;
/**
 * A text that may be a password or an e-mail typed into the bar by mistake: an "@", a word for password, or one token of
 * eight or more with lower and upper case letters, a digit and a sign (a product code has no lower case and a sign at once
 * is rare - "Xy7#kLm2" is not "NBR70-1234"). Counted with the rest, never written on the page.
 */
export function isPrivate(text: string): boolean {
  const s = (text ?? "").trim();
  if (!s) return false;
  if (s.includes("@") || SECRET_WORDS.test(s)) return true;
  return !/\s/.test(s) && s.length >= 8 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9.\-/,]/.test(s);
}
/** A text as the page writes it: one line, cut short (a pasted e-mail signature can land in the bar). */
export const shown = (text: string, max = 90) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/* ── the gateway's settled rule, read on the last searches one by one ─── */

/** A line of the bar's log (gateway GET /api/smart-bar/logs). */
export type LogLine = { text: string; norm: string; locale: string; tier: string; hits: number | null; at: string };

const SYNTHETIC = /can i ask you a question|is it ok if i upload an image/i;
const SPECIAL_ARTICLE = /^[38]\d{9}$/;
const ALWAYS_SHOWS_PRODUCTS = new Set(["figure", "oring-catalog"]);
const q = (l: LogLine) => (l.norm || l.text || "").toLowerCase().trim();

/**
 * Found something, as the gateway's report decides it (successFn and answered() there): a result shown; a view that draws a
 * table and never reports its count (a tier with 50 rows or more and none with a count, or a "-dim" view); a special
 * article's quick order card; the O-ring catalogue. The AI taking over is never found.
 */
export function foundRule(lines: LogLine[]): (l: LogLine) => boolean {
  const stats = new Map<string, { n: number; ok: number }>();
  for (const l of lines) { const t = stats.get(l.tier) ?? { n: 0, ok: 0 }; t.n++; if ((l.hits ?? 0) > 0) t.ok++; stats.set(l.tier, t); }
  const uncounted = new Set<string>();
  for (const [tier, t] of stats) if (tier !== "assistant" && t.ok === 0 && (t.n >= 50 || /-dim$/.test(tier || ""))) uncounted.add(tier);
  return (l) => (l.hits ?? 0) > 0 || uncounted.has(l.tier) || ALWAYS_SHOWS_PRODUCTS.has(l.tier) || (l.tier === "sku" && SPECIAL_ARTICLE.test(q(l).replace(/\D/g, "")));
}

/** The settled searches among the log's lines - the gateway's rule: per store in time order, a text the next one (within 20 s and eight lines) extends is a keystroke. */
export function settledOf(lines: LogLine[]): LogLine[] {
  const rows = [...lines].sort((a, b) => a.locale.localeCompare(b.locale) || a.at.localeCompare(b.at));
  const out: LogLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], a = q(r);
    if (SYNTHETIC.test(a) || a.length < 2) continue;
    let keystroke = false;
    for (let j = i + 1; j < rows.length && j <= i + 8; j++) {
      const n = rows[j];
      if (n.locale !== r.locale || Date.parse(n.at) - Date.parse(r.at) > 20_000) break;
      const b = q(n);
      if (b.length > a.length && b.startsWith(a)) { keystroke = true; break; }
    }
    if (!keystroke) out.push(r);
  }
  return out;
}

export type StoreSample = { settled: number; nothing: number; typing: number; have: number; kinds: Record<SearchKind, number> };
export type TypingSample = {
  /** the first and the last search read */
  from: string; to: string;
  /** the lines read, every keystroke */
  logged: number;
  /** per store: the settled searches, those that found nothing, of them still being typed or a text we have, and what the others were */
  byStore: Record<string, StoreSample>;
  /** the texts that really found nothing most often, per kind - never a private one */
  examples: Record<SearchKind, { text: string; n: number; stores: string[] }[]>;
  /** really found nothing, and not shown: it may be a password or an e-mail */
  hidden: number;
};
const kinds0 = (): Record<SearchKind, number> => ({ number: 0, code: 0, words: 0, long: 0 });

/**
 * The last searches one by one (SARCLA 19.10: "is 27% too high?"): of the settled searches that found nothing, those still
 * being typed - the same store, within a minute, a longer or a shorter text that starts the same (the bar's 20-second rule
 * misses a slow typist and a word corrected backwards) - are counted apart, and so are the texts we have (`have`: it found
 * something at other times); the others are what really found nothing, by kind.
 */
export function typingSample(lines: LogLine[], have?: (key: string) => boolean): TypingSample | null {
  const all = lines.filter((l) => l.at && !Number.isNaN(Date.parse(l.at)));
  if (!all.length) return null;
  const isOk = foundRule(all);
  const settled = settledOf(all);
  // every line, in time order per store - the next texts typed are looked for among all of them
  const byStoreLines = new Map<string, LogLine[]>();
  const place = new Map<LogLine, number>();
  for (const l of [...all].sort((a, b) => a.at.localeCompare(b.at))) { const xs = byStoreLines.get(l.locale) ?? []; place.set(l, xs.push(l) - 1); byStoreLines.set(l.locale, xs); }
  const byStore: Record<string, StoreSample> = {};
  const seen: Record<SearchKind, Map<string, { text: string; n: number; stores: Set<string> }>> = { number: new Map(), code: new Map(), words: new Map(), long: new Map() };
  let hidden = 0;
  for (const s of settled) {
    const st = (byStore[s.locale] ??= { settled: 0, nothing: 0, typing: 0, have: 0, kinds: kinds0() });
    st.settled++;
    if (isOk(s)) continue;
    st.nothing++;
    const t = Date.parse(s.at), a = q(s);
    const xs = byStoreLines.get(s.locale) ?? [];
    const k = place.get(s) ?? xs.length;
    let half = false;
    for (let j = k + 1; j < xs.length && j < k + 80; j++) {
      const m = xs[j];
      if (Date.parse(m.at) - t > 60_000) break;
      const b = q(m);
      if (b !== a && (b.startsWith(a) || a.startsWith(b))) { half = true; break; }
    }
    if (half) { st.typing++; continue; }
    if (have?.(termKey(s.norm || s.text))) { st.have++; continue; }
    const kind = searchKind(s.text || s.norm);
    st.kinds[kind]++;
    if (isPrivate(s.text) || isPrivate(s.norm)) { hidden++; continue; }
    const e = seen[kind].get(a);
    if (e) { e.n++; e.stores.add(s.locale); } else seen[kind].set(a, { text: shown(s.text || s.norm, 70), n: 1, stores: new Set([s.locale]) });
  }
  const top = (kind: SearchKind) => [...seen[kind].values()].sort((x, y) => y.n - x.n || x.text.localeCompare(y.text)).slice(0, 25).map((x) => ({ text: x.text, n: x.n, stores: [...x.stores].sort() }));
  const times = all.map((l) => l.at).sort();
  return { from: times[0], to: times[times.length - 1], logged: all.length, byStore, examples: { number: top("number"), code: top("code"), words: top("words"), long: top("long") }, hidden };
}

/** The sample over the stores chosen (none: every store). */
export function sampleIn(s: TypingSample, stores: string[]): StoreSample & { stores: number } {
  const keys = stores.length ? stores : Object.keys(s.byStore);
  const out = { settled: 0, nothing: 0, typing: 0, have: 0, kinds: kinds0(), stores: 0 };
  for (const k of keys) {
    const x = s.byStore[k];
    if (!x) continue;
    out.stores++; out.settled += x.settled; out.nothing += x.nothing; out.typing += x.typing; out.have += x.have ?? 0;
    for (const kind of Object.keys(out.kinds) as SearchKind[]) out.kinds[kind] += x.kinds[kind];
  }
  return out;
}

/* ── the report's answers, as the page reads them ──────────────────────── */

/** A term of the report's top list: its searches, those that found something and nothing, its stores and its kind. */
export type TermRow = { term: string; searches: number; found: number; nothing: number; results: number; ai: number; stores: string[]; kind: SearchKind };
/** A text the bar passed to its AI - it could not place it (the gateway's gaps). */
export type GapRow = { term: string; count: number; last: string; stores: string[]; kind: SearchKind; failed: boolean };

/** The report's top terms: the private ones out (counted), each with what it found. success_pct is whole per cent: the counts are rounded. */
export function termsOf(top: { query: string; searches: number; success_pct: number; ai_fallbacks?: number; avg_results?: number; locales?: string }[]): { rows: TermRow[]; hidden: number } {
  let hidden = 0;
  const rows: TermRow[] = [];
  for (const t of top ?? []) {
    if (isPrivate(t.query)) { hidden++; continue; }
    const found = Math.min(t.searches, Math.round((t.searches * (t.success_pct ?? 0)) / 100));
    rows.push({
      term: shown(t.query), searches: t.searches, found, nothing: t.searches - found, results: t.avg_results ?? 0, ai: t.ai_fallbacks ?? 0,
      stores: String(t.locales ?? "").split(/\s+/).filter(Boolean).sort(), kind: searchKind(t.query),
    });
  }
  return { rows, hidden };
}

/** The gateway's gaps: the raw text as typed (the last one), the private ones out (counted), and those we have (counted). */
export function gapsOf(gaps: { query_norm: string; count: number; last_seen: string; locales?: string[]; locale?: string; reason?: string; top_query_raw?: string }[], have?: (key: string) => boolean): { rows: GapRow[]; hidden: number; have: number } {
  let hidden = 0, had = 0;
  const rows: GapRow[] = [];
  for (const g of gaps ?? []) {
    const text = String(g.top_query_raw || g.query_norm || "");
    if (isPrivate(text) || isPrivate(g.query_norm)) { hidden++; continue; }
    if (have?.(termKey(g.query_norm || text))) { had++; continue; }
    rows.push({
      term: shown(text), count: g.count, last: String(g.last_seen ?? "").slice(0, 10),
      stores: (g.locales?.length ? g.locales : g.locale ? [g.locale] : []).filter(Boolean).sort(), kind: searchKind(text), failed: !!g.reason && g.reason !== "assistant_fallthrough",
    });
  }
  return { rows, hidden, have: had };
}

/* ── the texts we have ─────────────────────────────────────────────────── */

/** The key a text is matched on: the gateway's own (lower case, trimmed), one space between words. */
export const termKey = (text: string) => String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** A text of the gateway's full list (GET /api/smart-bar/report.csv?kind=all): every text searched in the window. */
export type FullTerm = { query: string; searches: number; success_pct: number; avg_results: number; locales: string };

/** The gateway's CSV read back - semicolons, every field quoted, a BOM and three lines before the columns. Null when it is not that list. */
export function fullTermsOf(csv: string): FullTerm[] | null {
  const rows = csvRows(String(csv ?? "").replace(/^\uFEFF/, ""));
  const h = rows.findIndex((r) => r[0] === "query" && r[1] === "searches");
  if (h < 0) return null;
  return rows.slice(h + 1).filter((r) => r.length >= 5 && r[0])
    .map((r) => ({ query: r[0], searches: Number(r[1]) || 0, success_pct: Number(r[2]) || 0, avg_results: Number(r[3]) || 0, locales: r[4] }));
}
function csvRows(s: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], f = "", quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch !== '"') f += ch;
      else if (s[i + 1] === '"') { f += '"'; i++; } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(f); out.push(row); row = []; f = "";
    } else f += ch;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out;
}

/** The texts that found something at least once - we have them. */
export function haveOf(terms: { query: string; success_pct: number }[]): Set<string> {
  return new Set(terms.filter((t) => (t.success_pct ?? 0) > 0).map((t) => termKey(t.query)));
}

/**
 * The texts of the window that never found anything - and never did since the bar went live (`have`) - searched most first:
 * the products we miss. `have` counts the window's texts that found nothing at times and something at others, left out.
 */
export function neverOf(terms: FullTerm[], have: Set<string>, max = 100): { rows: TermRow[]; hidden: number; have: number } {
  const never = terms.filter((t) => (t.success_pct ?? 0) === 0 && !have.has(termKey(t.query))).sort((a, b) => b.searches - a.searches);
  const had = terms.filter((t) => (t.success_pct ?? 0) < 100 && have.has(termKey(t.query))).length;
  const { rows, hidden } = termsOf(never);
  return { rows: rows.slice(0, max), hidden, have: had };
}

/** Month by month from the report's days: [month "YYYY-MM", first day, last day, searches, found something]. */
export type SearchMonth = { month: string; first: string; last: string; days: number; searches: number; ok: number };
export function monthsOfDays(days: { day: string; searches: number; ok: number }[]): SearchMonth[] {
  const out = new Map<string, SearchMonth>();
  for (const d of [...(days ?? [])].sort((a, b) => String(a.day).localeCompare(String(b.day)))) {
    const day = String(d.day).slice(0, 10), m = day.slice(0, 7);
    const x = out.get(m) ?? { month: m, first: day, last: day, days: 0, searches: 0, ok: 0 };
    x.last = day; x.days++; x.searches += d.searches ?? 0; x.ok += d.ok ?? 0;
    out.set(m, x);
  }
  return [...out.values()];
}

/** A store's figures in the window. */
export type StoreRow = { locale: string; searches: number; ok: number };
/** The stores chosen added up (none: every store). */
export function storesIn(rows: StoreRow[], stores: string[]): { searches: number; ok: number } {
  const keep = stores.length ? new Set(stores) : null;
  return rows.reduce((t, r) => (keep && !keep.has(r.locale) ? t : { searches: t.searches + r.searches, ok: t.ok + r.ok }), { searches: 0, ok: 0 });
}
/** The terms (or texts) typed in at least one of the stores chosen - their counts stay every store's. */
export const typedIn = <T extends { stores: string[] }>(rows: T[], stores: string[]) => (stores.length ? rows.filter((r) => r.stores.some((s) => stores.includes(s))) : rows);

/* ── the page's answer ─────────────────────────────────────────────────── */

export type SearchData = {
  period: PeriodId;
  /** the days the report counted back from now */
  days: number;
  generatedAt: string;
  /** the log's first day (the bar went live on 5 Jul 2026) */
  since: string | null;
  window: {
    /** every keystroke logged, and the settled searches */
    logged: number; settled: number; ok: number;
    /** different texts searched */
    terms: number;
    /** the searches the bar passed to its AI, and the chats with it */
    aiFallback: number; aiChats: number | null;
    byStore: StoreRow[];
    byMonth: SearchMonth[];
  } | null;
  terms: TermRow[]; termsHidden: number;
  /** the texts that never found anything (neverOf), from every text searched ("full") or only the report's top ones ("top") */
  never: { rows: TermRow[]; from: "full" | "top"; have: number; hidden: number };
  gaps: { window: "7d" | "30d"; rows: GapRow[]; hidden: number; have: number } | null;
  sample: TypingSample | null;
  errors: Record<string, string>;
};
