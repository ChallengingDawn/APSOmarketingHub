"use client";

// SATISFACTION - what the customers' survey answers say (SARCLA 27.10.2026: "the happiness per country - based on
// locales - and languages and locale"). Used by Reporting > Satisfaction KPIs (every survey) and by APSOassistant Chat >
// Satisfaction (the chats' surveys, in the chat page's window). Data: src/lib/satisfaction.
// Rebuilt like the ESO Visits page (SARCLA 01.11.2026: "rebuild like Visits"): the figures on top - satisfied customers
// (CSAT, the happy share), NPS where the answers have it, answers, comments - each against the same days a year earlier;
// a tab per breakdown the answers carry - touchpoint, country, language, locale - each one card of graphs; the period and
// the Filters window, what the page is filtered by under the tabs, Clear all; on every graph its own "Filter by …" and
// its Companies - the answering contacts' companies; the customers' comments as a table, sortable, searchable, 25 a page.
// No Actions, no BUC View, no targets here (SARCLA: "no actions are needed here because no BUC view").

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputBase from "@mui/material/InputBase";
import useMediaQuery from "@mui/material/useMediaQuery";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import SentimentSatisfiedAltOutlinedIcon from "@mui/icons-material/SentimentSatisfiedAltOutlined";
import ThumbsUpDownOutlinedIcon from "@mui/icons-material/ThumbsUpDownOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import FormatQuoteOutlinedIcon from "@mui/icons-material/FormatQuoteOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { Chip as Tag } from "@/app/connectors/parts";
import { DELTA, SERIES } from "@/app/charts/palette";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { Pager, Table, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { CardFilterFor, ChartBox, FullTable, H1, Leaderboard, TWO, niceTop, type BoardRow, type CardFilter, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, PeriodPicker, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { CompaniesFor, PAGE, hsCompany, type CompanyItem, type CompanySource } from "@/app/reporting/CompanyList";
import { csat, nps, type Tally } from "@/lib/satisfaction/rules";
import {
  AN, DIMS, READING, READING_RANK, byMonth, companiesOf, csatAnswers, dayOf, daysBetween, isoOf, labelOf, lastYearOf, monthsOf, npsAnswers, presetsOf, rangeWords, rowsOf, statsBy,
  blankStats, type Answer, type Reading, type SDim, type SFilters, type SStats, type SWin, type SatisfactionData,
} from "@/lib/satisfaction/answers";

/* ── words and numbers ─────────────────────────────────────────────────── */

const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const sign = (x: number) => (x > 0 ? "+" : x < 0 ? "−" : "±");
/** a share's or a score's change in points: "+2.1 pts" */
const pts = (x: number) => `${sign(x)}${Math.abs(x).toFixed(1)} pts`;
/** a count's change: "+12.5%" */
const signedPct = (x: number) => `${sign(x)}${Math.abs(x * 100).toFixed(1)}%`;
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const npsWords = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 20261012 -> "12 Oct 2026" */
const dayWords = (n: number) => rangeWords(n, n);
/** the CSAT in points (a share times 100) - for its change */
const csatPts = (t: Tally) => { const c = csat(t); return c == null ? null : c * 100; };
/** happy green, neutral amber, unhappy red - the feeling's own colour, not a categorical slot (as before the rebuild) */
const SENT_COLOR = { happy: DELTA.good, neutral: SERIES[3], unhappy: DELTA.bad };
const SENT_PARTS = [{ key: "happy", label: "Happy", color: SENT_COLOR.happy }, { key: "neutral", label: "Neutral", color: SENT_COLOR.neutral }, { key: "unhappy", label: "Unhappy", color: SENT_COLOR.unhappy }] as const;
const READING_TAG: Record<Reading, { label: string; tint: Tint } | null> = {
  happy: { label: "Happy", tint: "green" }, neutral: { label: "Neutral", tint: "amber" }, unhappy: { label: "Unhappy", tint: "pink" },
  promoter: { label: "Promoter", tint: "green" }, passive: { label: "Passive", tint: "amber" }, detractor: { label: "Detractor", tint: "pink" }, "": null,
};

/* ── the breakdowns ────────────────────────────────────────────────────── */

const DIM: Record<SDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string; width: number }> = {
  touchpoint: { name: "Touchpoint", lower: "touchpoint", icon: <TouchAppOutlinedIcon />, tint: "purple", width: 170,
    note: "Where the customer was asked: after an order on the shop, at the end of a chat, after a Back Office ticket or a TSA call, in the NPS e-mail" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", width: 140,
    note: "The shop's store view the answer was given on (…/de-CH/…), else the answer's own country, else its contact's" },
  language: { name: "Language", lower: "language", icon: <TranslateOutlinedIcon />, tint: "green", width: 120,
    note: "The language of the survey the customer answered, else the store view's" },
  locale: { name: "Locale", lower: "locale", icon: <LanguageOutlinedIcon />, tint: "amber", width: 110,
    note: "The shop's store view the answer was given on - de-CH, fr-CH, it-IT … - else the survey's language and the country (– where one is not known)" },
};
type SView = SDim | "comments";
const isDim = (x: string | null | undefined): x is SDim => (DIMS as string[]).includes(x ?? "");

/* ── the period ────────────────────────────────────────────────────────── */

type SPer = { win: SWin; id: string; title: string };
function perOf(d: SatisfactionData, win: SWin): SPer {
  const p = presetsOf(d.today).find((x) => !x.disabled && x.win.a === win.a && x.win.b === win.b);
  return p ? { win, id: p.id, title: p.title } : { win, id: `d${win.a}-${win.b}`, title: rangeWords(win.a, win.b) };
}
const perWords = (p: SPer) => rangeWords(p.win.a, p.win.b);
const perCap = (p: SPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
/** the period with its days, once: "Year to date · 1 Jan – 1 Nov 2026", "3 Mar – 17 May 2026" */
const perFull = (p: SPer) => (perCap(p) === perWords(p) ? perCap(p) : `${perCap(p)} · ${perWords(p)}`);
/** ?from=2026-03-05&to=2026-05-17 - inside what the read holds; none: the year to date */
function winOfQuery(d: SatisfactionData, from: string | null, to: string | null): SWin | null {
  const ok = (x: string | null) => !!x && /^\d{4}-\d{2}-\d{2}$/.test(x);
  if (!ok(from) || !ok(to)) return null;
  const a = Math.max(d.first, dayOf(from!)), b = Math.min(d.today, dayOf(to!));
  return a <= b ? { a, b } : null;
}

/* ── a page's state: in the address on Satisfaction KPIs, kept here on the chat page (its tabs live in the #) ── */

function useQueryState(bound: boolean): [URLSearchParams, (mut: (q: URLSearchParams) => void) => void] {
  const [s, setS] = useState("");
  const [ready, setReady] = useState(!bound);
  useEffect(() => { if (bound) { setS(window.location.search.replace(/^\?/, "")); setReady(true); } }, [bound]);
  useEffect(() => {
    if (!bound || !ready) return;
    const url = `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", url);
  }, [bound, ready, s]);
  const params = useMemo(() => new URLSearchParams(s), [s]);
  const set = useCallback((mut: (q: URLSearchParams) => void) => setS((prev) => { const q = new URLSearchParams(prev); mut(q); return q.toString(); }), []);
  return [params, set];
}

/* ── what every graph is drawn with ────────────────────────────────────── */

type SCtx = {
  d: SatisfactionData; per: SPer;
  /** the same days a year earlier - null where the read does not reach back */
  prev: SWin | null;
  filters: SFilters; view: SView; dims: SDim[];
  onBar?: (dim: SDim, label: string) => void; onFilter?: (dim: SDim) => void;
};
const prevWords = (c: SCtx) => (c.prev ? rangeWords(c.prev.a, c.prev.b) : "");
/** a phone's legend: "2026", "2025–26" - the days would wrap onto the first bar */
const yearsOf = (w: SWin) => { const a = Math.floor(w.a / 10000), b = Math.floor(w.b / 10000); return a === b ? String(a) : `${a}–${String(b).slice(2)}`; };

const statCache = new WeakMap<SCtx, Map<string, Map<string, SStats>>>();
/** The figures of the period (or the same days a year earlier) by a breakdown, or all together - kept per drawing. A
 *  graph shows only what is filtered; the Filters window's lists (all) leave their own breakdown's filter out. */
function statsOf(c: SCtx, dim?: SDim, o: { all?: boolean; prev?: boolean } = {}): Map<string, SStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${dim ?? ""}${o.all ? "*" : ""}${o.prev ? "<" : ""}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const win = o.prev ? c.prev : c.per.win;
  const out = win ? statsBy(rowsOf(c.d, win, c.filters, o.all ? dim : undefined), dim ? (r) => labelOf(c.d, r, dim) : undefined) : new Map<string, SStats>();
  memo.set(k, out);
  return out;
}
const totalOf = (c: SCtx, prev = false) => statsOf(c, undefined, { prev }).get("") ?? blankStats();
const rowsCache = new WeakMap<SCtx, Answer[]>();
const shownRows = (c: SCtx) => { let r = rowsCache.get(c); if (!r) { r = rowsOf(c.d, c.per.win, c.filters); rowsCache.set(c, r); } return r; };

/** The CSAT's change against the same days a year earlier, in points - null without CSAT answers on either side. */
function csatChange(cur: Tally, before: Tally | undefined): number | null {
  const a = csatPts(cur), b = before ? csatPts(before) : null;
  return a == null || b == null ? null : a - b;
}

/* ── the companies behind a graph ──────────────────────────────────────── */

/** The companies of the graph's answers - the answering contact's company in HubSpot (an answer carries the contact, never
 *  a company) - the most answers first; the answers without one are said under the title, never given one. */
function companiesFor(c: SCtx, commentsOnly = false): CompanySource {
  const words = perWords(c.per);
  const rows = commentsOnly ? shownRows(c).filter((r) => r[AN.comment] >= 0) : shownRows(c);
  const { companies, noContact, noCompany, notLinked } = companiesOf(rows);
  const anyNps = companies.some((x) => npsAnswers(x.s.tally) > 0);
  const without = [
    noContact ? `${int(noContact)} without a contact` : "",
    noCompany ? `${int(noCompany)} whose contact has no company in HubSpot` : "",
    notLinked ? `${int(notLinked)} not linked yet - the hub reads each answer's company every 30 minutes` : "",
  ].filter(Boolean);
  const head = ["Answers", "Satisfied", "Happy", "Neutral", "Unhappy", ...(anyNps ? ["NPS"] : []), "Comments", "Last answer", "Touchpoints", "Country"];
  return {
    key: `sat|${c.d.generatedAt}|${c.per.win.a}-${c.per.win.b}|${JSON.stringify(c.filters)}|${commentsOnly ? "comments" : "answers"}`,
    head, left: [head.length - 1, head.length],
    note: `${words} · the companies of the customers who ${commentsOnly ? "wrote a comment" : "answered"} - the answering contact's company in HubSpot - the most answers first${without.length ? ` · not on the list: ${without.join(", ")}` : ""}`,
    rows: () => companies.map((x): CompanyItem => {
      const t = x.s.tally, sat = csat(t), score = nps(t);
      const country = [...x.countries].sort((a, b) => b[1] - a[1])[0]?.[0];
      // the touchpoint with the most answers, the others counted - all of them on hover
      const tps = [...x.touchpoints].sort((a, b) => b[1] - a[1]).map(([i]) => c.d.labels.touchpoint[i]);
      return {
        id: c.d.companyIds[x.ci] ?? null, name: c.d.companyNames[x.ci] ?? `Company ${x.ci + 1}`,
        cells: [int(t.answers), pct(sat), int(t.happy), int(t.neutral), int(t.unhappy), ...(anyNps ? [npsAnswers(t) ? npsWords(score) : "—"] : []), int(x.s.comments), dayWords(x.last),
          <span key="tp" title={tps.join(", ")}>{tps[0]}{tps.length > 1 && <span style={{ color: FAINT }}> +{tps.length - 1} more</span>}</span>,
          country == null ? "" : c.d.labels.country[country] ?? ""],
        values: [t.answers, sat, t.happy, t.neutral, t.unhappy, ...(anyNps ? [npsAnswers(t) ? score : null] : []), x.s.comments, x.last, tps[0] ?? null, null],
      };
    }),
  };
}
const coCache = new WeakMap<SCtx, Map<boolean, CompanySource>>();
function companiesOfCtx(c: SCtx, commentsOnly = false): CompanySource {
  let m = coCache.get(c);
  if (!m) { m = new Map(); coCache.set(c, m); }
  let s = m.get(commentsOnly);
  if (!s) { s = companiesFor(c, commentsOnly); m.set(commentsOnly, s); }
  return s;
}

/** A graph with its Companies and - where it has no breakdown of its own (the months, the splits, the tables) - the page's
 *  filters opened on the tab's breakdown (SARCLA 01.11.2026, on the ESO reports: "both should be company and filter"). */
function Drawn({ c, dim, comments = false, children }: { c: SCtx; dim: SDim; comments?: boolean; children: React.ReactNode }) {
  const filter: CardFilter | null = c.onFilter
    ? { open: () => c.onFilter!(dim), label: `Filter by ${DIM[dim].lower}`, on: Object.values(c.filters).some((x) => (x?.length ?? 0) > 0) }
    : null;
  return <CompaniesFor source={companiesOfCtx(c, comments)}><CardFilterFor filter={filter}>{children}</CardFilterFor></CompaniesFor>;
}

/* ── the graphs of a breakdown ─────────────────────────────────────────── */

/** Satisfied customers (CSAT) by a breakdown: the groups with the most CSAT answers first - ranked by the CSAT itself, a
 *  country with one happy answer would lead Switzerland's thousands - each one's change against the same days a year
 *  earlier beside it. */
function CsatChart({ c, dim }: { c: SCtx; dim: SDim }) {
  const phone = useMediaQuery("(max-width:599.95px)");
  const before = c.prev ? statsOf(c, dim, { prev: true }) : null;
  const rows = [...statsOf(c, dim)].filter(([, s]) => csatAnswers(s.tally) > 0)
    .map(([label, s]) => ({ label, s, sat: csat(s.tally) ?? 0, ch: csatChange(s.tally, before?.get(label)?.tally), had: !!before?.get(label) && csatAnswers(before.get(label)!.tally) > 0 }))
    .sort((a, b) => csatAnswers(b.s.tally) - csatAnswers(a.s.tally) || a.label.localeCompare(b.label));
  const note = (r: (typeof rows)[number]) => (!c.prev ? { text: `${int(csatAnswers(r.s.tally))} answers`, color: MUTED }
    : r.ch == null ? { text: r.had ? "—" : `new · ${int(csatAnswers(r.s.tally))} answers`, color: FAINT }
    : { text: pts(r.ch), color: tone(r.ch) });
  return (
    <DimChart single fixedOrder title={`Satisfied customers (CSAT) ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} cur={(r) => r.sat} prev={() => 0}
      curLabel={phone ? "Happy share" : c.prev ? "Happy share · change vs a year earlier" : "Happy share of the CSAT answers"} prevLabel="" fmt={(v) => pct(v)} curColor={SENT_COLOR.happy}
      curNote={phone ? undefined : note} labelWidth={phone ? Math.min(110, DIM[dim].width) : DIM[dim].width}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

/** The answers by a breakdown, this period's against the same days a year earlier. */
function AnswersChart({ c, dim }: { c: SCtx; dim: SDim }) {
  const phone = useMediaQuery("(max-width:599.95px)");
  const before = c.prev ? statsOf(c, dim, { prev: true }) : null;
  const rows = [...statsOf(c, dim)].map(([label, s]) => ({ label, n: s.tally.answers, was: before?.get(label)?.tally.answers ?? 0 }));
  return (
    <DimChart single={!c.prev} title={`Answers ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} cur={(r) => r.n} prev={(r) => r.was}
      curLabel={phone ? yearsOf(c.per.win) : perWords(c.per)} prevLabel={c.prev ? (phone ? yearsOf(c.prev) : prevWords(c)) : ""} fmt={int} labelWidth={phone ? Math.min(110, DIM[dim].width) : DIM[dim].width}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

function SentLegend({ t }: { t: Tally }) {
  const n = [t.happy, t.neutral, t.unhappy], all = csatAnswers(t);
  return (
    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap" }}>
      {SENT_PARTS.map((p, i) => (
        <Box key={p.key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: p.color }} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{p.label} <b style={{ color: INK }}>{int(n[i])}</b> {pct(all ? n[i] / all : null)}</Typography>
        </Box>
      ))}
    </Box>
  );
}
/** Happy, neutral and unhappy by a breakdown: each one's CSAT answers as one bar split by how the customer felt (as the
 *  Visits' types of visit by person). */
function SentimentSplit({ c, dim }: { c: SCtx; dim: SDim }) {
  const [all, setAll] = useState(false);
  const rows = [...statsOf(c, dim)].map(([label, s]) => ({ label, t: s.tally, n: csatAnswers(s.tally) })).filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const first = 12;
  const shown = all ? rows : rows.slice(0, first);
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      <SentLegend t={totalOf(c).tally} />
      {rows.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No CSAT answer under these filters.</Typography>}
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {shown.map((r) => (
          <Box key={r.label} {...(c.onBar ? { component: "button" as const, type: "button" as const, onClick: () => c.onBar!(dim, r.label) } : {})}
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(110px, 0.9fr) minmax(40px, 2fr) auto" }, gap: { xs: 0.4, sm: 1.25 }, alignItems: "center", border: 0, bgcolor: "transparent", font: "inherit", textAlign: "left", cursor: c.onBar ? "pointer" : "default", borderRadius: "8px", px: 0.5, py: 0.25, opacity: c.filters[dim]?.length && !c.filters[dim]!.includes(r.label) ? 0.5 : 1, "&:hover": c.onBar ? { bgcolor: "rgba(21,34,58,.04)" } : {} }}>
            <Typography noWrap title={r.label} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.label}</Typography>
            <Box sx={{ display: "flex", gap: "2px", height: 16, width: `${(r.n / max) * 100}%`, minWidth: 6 }}>
              {SENT_PARTS.map((p) => r.t[p.key] > 0 && (
                <Box key={p.key} title={`${r.label} - ${p.label}: ${int(r.t[p.key])} (${pct(r.t[p.key] / r.n)})`} sx={{ flex: `${r.t[p.key]} 0 0`, minWidth: 2, bgcolor: p.color, "&:first-of-type": { borderRadius: "3px 0 0 3px" }, "&:last-of-type": { borderRadius: "0 3px 3px 0" } }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: INK, textAlign: { sm: "right" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}><b>{int(r.n)}</b> <span style={{ color: FAINT }}>· {pct(csat(r.t))} satisfied</span></Typography>
          </Box>
        ))}
      </Box>
      {rows.length > first && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${first}` : `Show all ${rows.length}`}</Button>}
    </Box>
  );
}

/** NPS by a breakdown, where the answers have it: the score (promoters less detractors, −100 to +100), its change in points. */
function NpsBoard({ c, dim }: { c: SCtx; dim: SDim }) {
  const before = c.prev ? statsOf(c, dim, { prev: true }) : null;
  const rows: BoardRow[] = [...statsOf(c, dim)].filter(([, s]) => npsAnswers(s.tally) > 0).map(([label, s]) => {
    const t = s.tally, b = before?.get(label)?.tally;
    return { label, cur: (nps(t) ?? 0) / 100, prev: b && npsAnswers(b) ? (nps(b) ?? 0) / 100 : 0, sub: `${int(npsAnswers(t))} NPS answers · ${int(t.promoters)} promoters · ${int(t.detractors)} detractors` };
  });
  return (
    <Leaderboard title={`NPS ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} ratio noChange={!c.prev} fmt={(x) => npsWords(Math.round(x * 100))}
      curLabel={perWords(c.per)} prevLabel={c.prev ? prevWords(c) : ""}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

/** Month by month: each month's CSAT answers stacked - happy, neutral, unhappy -, the satisfied share under it and its
 *  change against the same month a year earlier (where both months had ten CSAT answers or more). */
function SentimentMonths({ c }: { c: SCtx }) {
  const ms = monthsOf(c.per.win.a, c.per.win.b);
  const by = byMonth(shownRows(c));
  const ly = c.prev ? byMonth(rowsOf(c.d, c.prev, c.filters)) : null;
  const years = new Set(ms.map((m) => Math.floor(m / 100))).size > 1;
  const nowM = Math.floor(c.d.today / 100);
  const data = ms.map((m) => {
    const t = by.get(String(m))?.tally ?? blankStats().tally, b = ly?.get(String(m - 100))?.tally;
    const v = csatAnswers(t);
    return { m, x: `${MONTHS[(m % 100) - 1]}${years ? ` ${String(Math.floor(m / 100) % 100)}` : ""}`, t, v, sat: csat(t), ch: b && csatAnswers(b) >= 10 && v >= 10 ? csatChange(t, b) : null, running: m === nowM && c.per.win.b === c.d.today };
  });
  const top = niceTop(Math.max(1, ...data.map((x) => x.v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <SentLegend t={totalOf(c).tally} />
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: 28 }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((x) => (
              <Box key={x.m} title={`${x.x}${x.running ? " (to date)" : ""}: ${SENT_PARTS.map((p) => `${p.label} ${int(x.t[p.key])}`).join(" · ")} · ${pct(x.sat)} satisfied`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(x.v / top) * 100}%`, display: "flex", flexDirection: "column-reverse", gap: "1px", opacity: x.running ? 0.6 : 1, borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                  {SENT_PARTS.map((p) => x.t[p.key] > 0 && <Box key={p.key} sx={{ flex: `${x.t[p.key]} 0 0`, bgcolor: p.color }} />)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex" }}>
          {data.map((x) => (
            <Box key={x.m} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
              {/* a phone: the month's initial only, its figures on a wider screen - they would run into each other */}
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3, whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>{x.x}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, lineHeight: 1.3, display: { xs: "block", sm: "none" } }}>{x.x.charAt(0)}</Typography>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, lineHeight: 1.3, display: { xs: "none", sm: "block" } }}>{x.v ? pct(x.sat) : "—"}</Typography>
              {ly && <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: x.ch == null ? FAINT : tone(x.ch), lineHeight: 1.3, whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>{x.ch == null ? "—" : pts(x.ch)}</Typography>}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** All the figures of a breakdown: answers, satisfied, the three feelings, NPS where there is one, comments - each
 *  against the same days a year earlier where the read reaches back. */
type FRow = { label: string; s: SStats; b: SStats | null };
function FiguresTable({ c, dim }: { c: SCtx; dim: SDim }) {
  const before = c.prev ? statsOf(c, dim, { prev: true }) : null;
  const rows: FRow[] = [...statsOf(c, dim)].map(([label, s]) => ({ label, s, b: before?.get(label) ?? null }));
  const t = totalOf(c), tb = c.prev ? totalOf(c, true) : null;
  const anyNps = npsAnswers(t.tally) > 0;
  const chN = (r: FRow) => (r.b && r.b.tally.answers ? (r.s.tally.answers - r.b.tally.answers) / r.b.tally.answers : null);
  const chS = (r: FRow) => csatChange(r.s.tally, r.b?.tally);
  const cols: Col<FRow>[] = [
    { key: "answers", head: "Answers", cell: (r) => int(r.s.tally.answers), sort: (r) => r.s.tally.answers },
    ...(c.prev ? [{ key: "answers-ch", head: "Answers vs a year earlier", tip: `Against the same days a year earlier, ${prevWords(c)}`,
      cell: (r: FRow) => { const x = chN(r); return <span style={{ color: tone(x), fontWeight: 700 }}>{x == null ? (r.s.tally.answers ? "new" : "—") : signedPct(x)}</span>; }, sort: (r: FRow) => chN(r) ?? -1e9 }] : []),
    { key: "csat", head: "Satisfied (CSAT)", tip: "The happy share of the CSAT answers", cell: (r) => <b>{pct(csat(r.s.tally))}</b>, sort: (r) => csat(r.s.tally) ?? -1 },
    ...(c.prev ? [{ key: "csat-ch", head: "Satisfied vs a year earlier", tip: `In points, against the same days a year earlier, ${prevWords(c)}`,
      cell: (r: FRow) => { const x = chS(r); return <span style={{ color: tone(x), fontWeight: 700 }}>{x == null ? "—" : pts(x)}</span>; }, sort: (r: FRow) => chS(r) ?? -1e9 }] : []),
    { key: "happy", head: "Happy", cell: (r) => int(r.s.tally.happy), sort: (r) => r.s.tally.happy },
    { key: "neutral", head: "Neutral", cell: (r) => int(r.s.tally.neutral), sort: (r) => r.s.tally.neutral },
    { key: "unhappy", head: "Unhappy", cell: (r) => int(r.s.tally.unhappy), sort: (r) => r.s.tally.unhappy },
    ...(anyNps ? [{ key: "nps", head: "NPS", tip: "Promoters less detractors, −100 to +100 - the NPS e-mail's answers", cell: (r: FRow) => (npsAnswers(r.s.tally) ? npsWords(nps(r.s.tally)) : "—"), sort: (r: FRow) => (npsAnswers(r.s.tally) ? nps(r.s.tally) ?? -101 : -101) }] : []),
    { key: "comments", head: "Comments", cell: (r) => int(r.s.comments), sort: (r) => r.s.comments },
  ];
  return <FullTable key={`${dim}-${c.per.id}`} first={DIM[dim].name} cols={cols} initial="answers" rows={rows} total={{ label: "Total", s: t, b: tb }}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={`a ${DIM[dim].lower}`} />;
}

/* ── the comments: a table, sortable, searchable, 25 a page ────────────── */

const COMMENT_HEAD = ["Date", "Answer", "What the customer wrote", "Touchpoint", "Locale", "Company"];
function CommentsTable({ c }: { c: SCtx }) {
  const all = useMemo(() => shownRows(c).filter((r) => r[AN.comment] >= 0), [c]);
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim().toLowerCase()), 200); return () => clearTimeout(t); }, [typed]);
  // the unhappy first, then the newest - as before the rebuild; a click on a column's name sorts by it
  const [sort, setSort] = useState<TableSort>({ col: 1, desc: false });
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [q, sort, all]);
  const coName = (r: Answer) => (r[AN.company] >= 0 ? c.d.companyNames[r[AN.company]] ?? "" : "");
  const found = useMemo(() => (!q ? all : all.filter((r) => [c.d.comments[r[AN.comment]], coName(r), labelOf(c.d, r, "touchpoint"), labelOf(c.d, r, "locale")].some((x) => x.toLowerCase().includes(q)))),
    [all, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    const newest = (a: Answer, b: Answer) => b[AN.day] - a[AN.day];
    const by: ((a: Answer, b: Answer) => number)[] = [
      (a, b) => dir * (a[AN.day] - b[AN.day]),
      (a, b) => dir * (READING_RANK[READING[a[AN.reading]]] - READING_RANK[READING[b[AN.reading]]]) || newest(a, b),
      () => 0,
      (a, b) => dir * labelOf(c.d, a, "touchpoint").localeCompare(labelOf(c.d, b, "touchpoint")) || newest(a, b),
      (a, b) => dir * labelOf(c.d, a, "locale").localeCompare(labelOf(c.d, b, "locale")) || newest(a, b),
      // no company last, whichever way
      (a, b) => { const x = coName(a), y = coName(b); return !x !== !y ? (x ? -1 : 1) : dir * x.localeCompare(y, "en", { sensitivity: "base" }) || newest(a, b); },
    ];
    return [...found].sort(by[sort.col] ?? by[0]);
  }, [found, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = sorted.slice(at * PAGE, at * PAGE + PAGE);
  const pager = { shown: [] as unknown[], page: at, pages, setPage, size: PAGE, total: sorted.length };
  // a date or a feeling from the newest / the unhappy; a word from A
  const onSort = (col: number) => setSort((s) => (s.col === col ? { col, desc: !s.desc } : { col, desc: col === 0 }));
  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: "1 1 220px", maxWidth: 360, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a word, a company…" inputProps={{ "aria-label": "Find a word or a company in the comments" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, flex: 1 }}>{q ? `${int(sorted.length)} of ${int(all.length)} comments` : `${int(all.length)} comments`}</Typography>
        <Pager p={pager} />
      </Box>
      {!shown.length ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{q ? "No comment with these words." : "No comment in this period under these filters."}</Typography> : (
        <Table head={COMMENT_HEAD} left={[1, 2, 3, 4, 5]} sortable={[0, 1, 3, 4, 5]} sort={sort} onSort={onSort} firstWidth="116px"
          widths={["104px", "minmax(260px, 3fr)", "minmax(130px, 1fr)", "84px", "minmax(150px, 1.2fr)"]} minWidth={900}
          rows={shown.map((r, i) => {
            const tag = READING_TAG[READING[r[AN.reading]]];
            const ci = r[AN.company];
            return {
              key: `${r[AN.comment]}-${i}`,
              cells: [
                dayWords(r[AN.day]),
                tag ? <Tag tint={tag.tint}>{tag.label}</Tag> : "—",
                <Typography key="t" sx={{ fontSize: "0.86rem", color: INK, whiteSpace: "pre-wrap", overflowWrap: "anywhere", minWidth: 0 }}>{c.d.comments[r[AN.comment]]}</Typography>,
                labelOf(c.d, r, "touchpoint"), labelOf(c.d, r, "locale"),
                ci >= 0 && c.d.companyIds[ci]
                  ? <Box component="a" href={hsCompany(c.d.companyIds[ci])} target="_blank" rel="noreferrer" title="Open in HubSpot"
                      sx={{ color: INK, textDecoration: "underline", textDecorationColor: "rgba(21,34,58,.35)", textUnderlineOffset: "3px", "&:hover": { color: TINT.blue.fg, textDecorationColor: "currentColor" } }}>{c.d.companyNames[ci]}</Box>
                  : <span style={{ color: FAINT }}>{ci === -1 ? "No contact" : ci === -2 ? "No company" : "Not linked yet"}</span>,
              ],
            };
          })} />
      )}
      {pages > 1 && <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Pager p={pager} /></Box>}
    </Box>
  );
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

function TabCard({ c }: { c: SCtx }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = perWords(c.per);
  if (c.view === "comments") return (
    <GlassCard sx={card}>
      <CardTitle icon={<FormatQuoteOutlinedIcon />} tint="purple" title={`What the customers wrote, ${c.per.title}`} note={`${words} · the unhappy first, then the newest - click a column's name to sort by it · e-mail addresses and phone numbers are hidden`} />
      <Box sx={{ mt: -1 }}>
        <Drawn c={c} dim={c.dims[0]} comments>
          <ChartBox title={`Comments ${c.per.title}`} hint={`${words} · every answer with a few words of the customer's own, under the page's filters`}><CommentsTable c={c} /></ChartBox>
        </Drawn>
      </Box>
    </GlassCard>
  );
  const dim = c.view, dd = DIM[dim];
  const anyNps = npsAnswers(totalOf(c).tally) > 0;
  // month by month on the first tab, for a period of two months or more - not for a few weeks across a month's end
  const months = dim === c.dims[0] && monthsOf(c.per.win.a, c.per.win.b).length >= 2 && daysBetween(c.per.win.a, c.per.win.b) >= 45;
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`Satisfaction by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        <Drawn c={c} dim={dim}><CsatChart c={c} dim={dim} /></Drawn>
        <Drawn c={c} dim={dim}><AnswersChart c={c} dim={dim} /></Drawn>
      </Box>
      <Drawn c={c} dim={dim}>
        <ChartBox title={`Happy, neutral and unhappy ${c.per.title}, by ${dd.lower}`} hint={`${words} · each ${dd.lower}'s CSAT answers by how the customer felt, the most answers first`}><SentimentSplit c={c} dim={dim} /></ChartBox>
      </Drawn>
      {anyNps && <Drawn c={c} dim={dim}><NpsBoard c={c} dim={dim} /></Drawn>}
      {months && (
        <Drawn c={c} dim={dim}>
          <ChartBox title={`Satisfied customers ${c.per.title}, month by month`}
            hint={`${words} · each month's CSAT answers - happy, neutral, unhappy - and the satisfied share under it${c.prev ? `; its change against the same month a year earlier where both had ten answers or more` : ""} · the running month to date, lighter`}>
            <SentimentMonths c={c} />
          </ChartBox>
        </Drawn>
      )}
      <Drawn c={c} dim={dim}>
        <ChartBox title={`All the figures ${c.per.title}, by ${dd.lower}`} hint={`${words} · each ${dd.lower}'s answers, satisfied share, happy, neutral and unhappy${anyNps ? ", NPS" : ""} and comments${c.prev ? ` - against the same days a year earlier, ${prevWords(c)}` : ""}`}>
          <FiguresTable c={c} dim={dim} />
        </ChartBox>
      </Drawn>
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures on top ────────────────────────────────────────────────── */

type Fig = { id: string; label: string; value: string; change: { text: string; color: string } | null; sub: string; icon: React.ReactNode; tint: Tint };
/** One unit a card: the share with its change in points and last year's share, a count with its change in % and last
 *  year's count - each against the same days a year earlier. */
function figuresOf(c: SCtx): Fig[] {
  const t = totalOf(c).tally, s = totalOf(c), b = c.prev ? totalOf(c, true) : null;
  const ly = "A year earlier";
  const none = c.prev ? "" : "no year earlier in the survey answers";
  const count = (n: number, was: number | undefined) => (was ? { text: signedPct((n - was) / was), color: tone((n - was) / was) } : null);
  const sat = csat(t), satB = b ? csat(b.tally) : null, ch = csatChange(t, b?.tally);
  const out: Fig[] = [
    { id: "csat", label: "Satisfied customers (CSAT)", value: pct(sat), change: ch == null ? null : { text: pts(ch), color: tone(ch) },
      sub: c.prev ? `${ly}: ${pct(satB)}` : none, icon: <SentimentSatisfiedAltOutlinedIcon />, tint: "green" },
  ];
  const n = npsAnswers(t), nb = b ? npsAnswers(b.tally) : 0;
  if (n || nb) {
    const score = nps(t), was = b && nb ? nps(b.tally) : null;
    out.push({ id: "nps", label: "NPS", value: n ? npsWords(score) : "—", change: score != null && was != null ? { text: pts(score - was), color: tone(score - was) } : null,
      sub: c.prev ? `${ly}: ${nb ? npsWords(was) : "no NPS answer"}` : none, icon: <ThumbsUpDownOutlinedIcon />, tint: "blue" });
  }
  out.push(
    { id: "answers", label: "Answers", value: int(t.answers), change: count(t.answers, b?.tally.answers), sub: c.prev ? `${ly}: ${int(b?.tally.answers ?? 0)}` : none, icon: <QuestionAnswerOutlinedIcon />, tint: "purple" },
    { id: "comments", label: "Comments", value: int(s.comments), change: count(s.comments, b?.comments), sub: c.prev ? `${ly}: ${int(b?.comments ?? 0)}` : none, icon: <FormatQuoteOutlinedIcon />, tint: "amber" },
  );
  return out;
}
function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(124px, 1fr))` }, minWidth: 0 }}>
      {items.map((f) => (
        <Box key={f.id} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={f.icon} tint={f.tint} size={22} />
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
            {f.change && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: f.change.color, fontVariantNumeric: "tabular-nums" }}>{f.change.text}</Typography>}
          </Box>
          {f.sub && <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>}
        </Box>
      ))}
    </Box>
  );
}

/* ── the Filters window: the period and the breakdowns ─────────────────── */

function SPeriod({ d, per, onPer }: { d: SatisfactionData; per: SPer; onPer: (w: SWin) => void }) {
  const all = presetsOf(d.today);
  const winOf = (id: string) => all.find((p) => p.id === id)?.win;
  return (
    <PeriodPicker quick={all.filter((p) => !p.quarter)} quarters={all.filter((p) => p.quarter).map((p) => ({ id: p.id, label: p.label, disabled: p.disabled, title: p.disabled ? "Not started yet" : undefined }))}
      isOn={(id) => { const w = winOf(id); return !!w && w.a === per.win.a && w.b === per.win.b; }} onChoice={(id) => { const w = winOf(id); if (w) onPer(w); }}
      unit="day" min={isoOf(d.first)} max={isoOf(d.today)} from={isoOf(per.win.a)} to={isoOf(per.win.b)} onRange={(x, y) => onPer({ a: dayOf(x), b: dayOf(y) })}
      note={<>The survey answers since {dayWords(d.first)}. Every figure is set against the same days a year earlier, where the answers reach back that far.</>} />
  );
}
function SFacet({ c, dim, onPick }: { c: SCtx; dim: SDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const rows = [...statsOf(c, dim, { all: true })].map(([label, s]) => ({ label, n: s.tally.answers })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const sel = c.filters[dim] ?? [];
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8;
  const shown = all || q ? found : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.includes(r.label))];
  const max = Math.max(1, ...rows.map((r) => r.n));
  const t = TINT[DIM[dim].tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].lower}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].lower} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      {rows.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: FAINT, px: 1 }}>No answer in this period.</Typography>}
      {shown.map((r) => {
        const on = sel.includes(r.label);
        return (
          <Box key={r.label} component="button" type="button" onClick={() => onPick(r.label)} aria-pressed={on}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 70px 52px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{r.label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(r.n / max) * 100}%`, bgcolor: t.fg, opacity: 0.6 }} /></Box>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(r.n)}</Typography>
          </Box>
        );
      })}
      {!q && found.length > LIMIT && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${LIMIT}` : `Show all ${found.length}`}</Button>}
    </Box>
  );
}
function SFilterWindow({ c, per, fixedPeriod, open, onClose, focus, onPer, toggle, clearAll }: {
  c: SCtx; per: SPer; fixedPeriod: boolean; open: boolean; onClose: () => void; focus: { dim: SDim; n: number } | null; onPer: (w: SWin) => void; toggle: (d: SDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<SDim | "period", boolean>>>({});
  const isOpen = (k: SDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === c.dims[0] || !!c.filters[k as SDim]?.length);
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`sfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = c.dims.flatMap((d) => (c.filters[d] ?? []).map((v) => [d, v] as const));
  return (
    <FilterPanel id="satisfaction-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          {!fixedPeriod && (
            <FilterSection id="sfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
              <SPeriod d={c.d} per={per} onPer={onPer} />
            </FilterSection>
          )}
          {c.dims.map((dim, i) => (
            <FilterSection key={dim} id={`sfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
              summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
              <SFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
            </FilterSection>
          ))}
        </>
      )}
    </FilterPanel>
  );
}

/* ── the view ──────────────────────────────────────────────────────────── */

/**
 * The answers' figures, tabs, graphs and comments. `title` given (Satisfaction KPIs): the page's own title beside the
 * figures, its period picked in Filters and kept in the address. None (the chat page): the figures alone, the period the
 * chat page's window (`label`), the choices kept on the page.
 */
export function SatisfactionView({ d, label, showTouchpoints = true, title }: { d: SatisfactionData; label?: string; showTouchpoints?: boolean; title?: string }) {
  const [params, setQuery] = useQueryState(!!title);
  const dims = useMemo(() => (showTouchpoints ? DIMS : DIMS.filter((k) => k !== "touchpoint")), [showTouchpoints]);
  const views: { id: SView; label: string }[] = [...dims.map((k) => ({ id: k as SView, label: DIM[k].name })), { id: "comments", label: "Comments" }];
  const v0 = params.get("view");
  const view: SView = views.some((x) => x.id === v0) ? (v0 as SView) : views[0].id;
  const setView = (x: SView) => setQuery((q) => { if (x === views[0].id) q.delete("view"); else q.set("view", x); });
  const filters: SFilters = useMemo(() => Object.fromEntries(dims.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params, dims]);
  const toggle = (k: SDim, l: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]; q.delete(k); for (const x of next) q.append(k, x); });
  const ytd = presetsOf(d.today)[0].win;
  const setPer = (w: SWin) => setQuery((q) => { if (w.a === ytd.a && w.b === ytd.b) { q.delete("from"); q.delete("to"); } else { q.set("from", isoOf(w.a)); q.set("to", isoOf(w.b)); } });
  const clearAll = () => setQuery((q) => { for (const k of DIMS) q.delete(k); q.delete("from"); q.delete("to"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: SDim; n: number } | null>(null);
  const openOn = (k: SDim) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  // the chat page's window, or the period picked here (the year to date unless one is)
  const fromP = params.get("from"), toP = params.get("to");
  const per: SPer = useMemo(() => (d.asked
    ? { win: { a: d.asked, b: d.today }, id: "asked", title: label ? label.charAt(0).toLowerCase() + label.slice(1) : rangeWords(d.asked, d.today) }
    : perOf(d, winOfQuery(d, fromP, toP) ?? ytd)), [d, label, fromP, toP]); // eslint-disable-line react-hooks/exhaustive-deps
  // the work a click asks for, kept; the tabs and filters answer at once and the graphs follow (as the Visits)
  const want = useMemo(() => ({ view, per, filters }), [view, per, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<SCtx>(() => ({
    d, per: drawn.per, prev: lastYearOf(d, drawn.per.win), filters: drawn.filters, view: drawn.view, dims,
    onBar: (k, l) => { toggle(k, l); openOn(k); }, onFilter: openOn,
  }), [d, drawn, dims]); // eslint-disable-line react-hooks/exhaustive-deps
  const figs = useMemo(() => figuresOf(c), [c]);
  const commentsN = useMemo(() => shownRows(c).filter((r) => r[AN.comment] >= 0).length, [c]);

  const fixedPeriod = !!d.asked;
  const periodOn = !fixedPeriod && per.id !== "ytd";
  const chosen = dims.flatMap((k) => (filters[k] ?? []).map((x) => [k, x] as const));
  const run = d.run;
  const subtitle = (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
      {d.touchpoints ? <>The chats&apos; survey answers</> : <>Every HubSpot survey answer</>} · {per.title === perWords(per) ? <b style={{ color: INK }}>{per.title}</b> : <>{perCap(per)} <b style={{ color: INK }}>{perWords(per)}</b></>}
      {c.prev ? <> · against the same days a year earlier</> : null} · read from HubSpot every 30 minutes
      {run && !run.ok ? <span style={{ color: RED }}> - the last read failed: {run.error ?? ""}</span> : run && !run.done ? " - still catching up with older answers" : ""}
    </Typography>
  );
  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {title ? (
        <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
          <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
            <Typography component="h1" sx={H1}>{title}</Typography>
            {subtitle}
          </Box>
          <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards items={figs} /></Box>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
          {subtitle}
          <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards items={figs} /></Box>
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="satisfaction" tab={view} onSelect={setView}
            tabs={views.map((x) => ({ id: x.id, label: x.label, count: x.id === "comments" ? int(commentsN) : filters[x.id as SDim]?.length ? String(filters[x.id as SDim]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => { if (panel) setPanel(false); else openOn(isDim(view) ? view : dims[0]); }} variant={panel || chosen.length || periodOn ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="satisfaction-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || periodOn ? undefined : "#fff" }}>
          Filters{chosen.length + (periodOn ? 1 : 0) ? ` · ${chosen.length + (periodOn ? 1 : 0)}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs (as every ESO report since 31.10.2026) */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={[
        ...(periodOn ? [{ key: "period", name: "Period", value: perFull(per), tint: "blue" as Tint, onRemove: () => setPer(ytd) }] : []),
        ...chosen.map(([k, x]): ActiveItem => ({ key: `${k}:${x}`, name: DIM[k].name, value: x, tint: DIM[k].tint, onRemove: () => toggle(k, x) })),
      ]} />
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} />
      </Box>
      <SFilterWindow c={c} per={per} fixedPeriod={fixedPeriod} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}
