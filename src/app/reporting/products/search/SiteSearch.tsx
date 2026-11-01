"use client";
// PRODUCTS REPORTS > SEARCH (SARCLA 01.11.2026 on Products Reports: "we should really create subtabs" - his pick "Search"):
// what customers type into the shop's search bar - month by month, by language and store, the terms - and the searches that
// found nothing: the products we miss, and how often. Built like Articles CY/LY (rebuilt the same day like the ESO Figures):
// the figures top right, a tab per breakdown, the Filters window with what the page is filtered by under the tabs and Clear
// all, on every graph its own "Filter by …", the lists sortable and searchable, 25 a page. No Actions, no BUC View, no
// targets (SARCLA: "no actions are needed here because no BUC view").
//
// Counted honestly (memory reference_ga4_shop_item_events): the bar searches as one types, so the figures are its own
// settled searches - a keystroke the next text extends within 20 seconds is not one - and the last searches are read one by
// one for the words still being typed a little longer (the Found nothing tab). The report answers a window that ends now, with
// no months and no terms per store - the page says so where a store is chosen. No Companies button: the bar's log keeps no
// customer, no session and no company. A text that may be a password or an e-mail is counted, never shown.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";

import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Notice, TINT, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { CardFilterFor, ChartBox, FullTable, H1, Leaderboard, TWO, setQuery, type BoardRow, type CardFilter, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { SEARCH_KINDS, type SearchKind } from "@/lib/marketingKpis/engageCube";
import { PERIODS, periodOf, sampleIn, storeLabel, storesIn, typedIn, type GapRow, type PeriodId, type SearchData, type SearchMonth, type TermRow } from "@/lib/products/siteSearch";
import { Choices, Facet, FigureCards, MONTHS, dayWords, int, pct, plural, type Fig } from "../views/kit";

/* ── words ─────────────────────────────────────────────────────────────── */

const KIND_SHORT: Record<SearchKind, string> = { number: "A number", code: "A type or code", words: "Words", long: "A long question or pasted text" };
const storeName = (locale: string) => `${storeLabel(locale)} (${locale})`;
const storesWords = (xs: string[], most = 3) => (xs.length ? `${xs.slice(0, most).join(", ")}${xs.length > most ? ` +${xs.length - most}` : ""}` : "—");
const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
/** "Aug", "Jul (from 5)", "Nov (1 – 1)" - a month the window holds only in part says which days. */
function monthLabel(m: SearchMonth) {
  const name = MONTHS[Number(m.month.slice(5, 7)) - 1];
  const end = new Date(Date.UTC(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0)).getUTCDate();
  const a = Number(m.first.slice(8, 10)), b = Number(m.last.slice(8, 10));
  return a === 1 && b === end ? name : a === b ? `${name} (${a})` : a === 1 ? `${name} (1 – ${b})` : b === end ? `${name} (from ${a})` : `${name} (${a} – ${b})`;
}

type View = "months" | "stores" | "terms" | "nothing";
const VIEWS: { id: View; label: string }[] = [
  { id: "months", label: "Month by month" },
  { id: "stores", label: "Language & store" },
  { id: "terms", label: "Top terms" },
  { id: "nothing", label: "Found nothing" },
];
const viewOf = (x: string | null): View => (VIEWS.some((v) => v.id === x) ? (x as View) : "months");
type Focus = "period" | "store";

/* ── what every graph is drawn with ────────────────────────────────────── */

type Ctx = {
  d: SearchData; stores: string[];
  /** "since the bar went live" / "the last 30 days", and its days in words */
  per: string; days: string;
  onStore: (locale: string) => void;
  onFilter: (f: Focus) => void;
};
function Wrap({ c, on, children }: { c: Ctx; on: Focus; children: React.ReactNode }) {
  const filter: CardFilter = { open: () => c.onFilter(on), label: on === "period" ? "Filter by period" : "Filter by store", on: on === "store" ? c.stores.length > 0 : c.d.period !== "all" };
  return <CardFilterFor filter={filter}>{children}</CardFilterFor>;
}
/** "German · Switzerland (de-CH) and French · Switzerland (fr-CH) only" - under a graph the store choice narrows by membership */
const onlyStores = (c: Ctx) => (c.stores.length ? `${names(c.stores.map(storeName))} only` : "");

/* ── month by month ────────────────────────────────────────────────────── */

type MRow = SearchMonth & { label: string; nothing: number };
function Months({ c }: { c: Ctx }) {
  const rows: MRow[] = (c.d.window?.byMonth ?? []).map((m) => ({ ...m, label: monthLabel(m), nothing: m.searches - m.ok }));
  const total: MRow = rows.reduce((t, r) => ({ ...t, days: t.days + r.days, searches: t.searches + r.searches, ok: t.ok + r.ok, nothing: t.nothing + r.nothing }),
    { month: "", first: "", last: "", label: "Whole period", days: 0, searches: 0, ok: 0, nothing: 0 });
  const cols: Col<MRow>[] = [
    { key: "days", head: "Days counted", tip: "The days of the month the period holds", cell: (r) => int(r.days), sort: (r) => r.days },
    { key: "searches", head: "Searches", tip: "Settled searches - a text the next one extends within 20 s is a keystroke, not a search", cell: (r) => int(r.searches), sort: (r) => r.searches },
    { key: "day", head: "Searches a day", cell: (r) => (r.days ? int(r.searches / r.days) : "—"), sort: (r) => (r.days ? r.searches / r.days : 0) },
    { key: "ok", head: "Found something", cell: (r) => int(r.ok), sort: (r) => r.ok },
    { key: "nothing", head: "Found nothing", cell: (r) => int(r.nothing), sort: (r) => r.nothing },
    { key: "share", head: "Found-nothing share", tip: "Found nothing ÷ searches - by the bar's own rule, before the words still being typed are taken out", cell: (r) => pct(r.searches ? r.nothing / r.searches : null), sort: (r) => (r.searches ? r.nothing / r.searches : 0) },
  ];
  const every = c.stores.length ? " · every store - the bar's report keeps no months per store" : "";
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <DimChart title={`Searches month by month, ${c.per}`} rows={rows} cur={(r) => r.searches} prev={() => 0} curLabel="Searches" prevLabel="" single fixedOrder
          fmt={int} labelWidth={104} pageSize={12} onFilter={() => c.onFilter("period")} filterLabel="Filter by period" />
        <DimChart title={`Found nothing month by month, ${c.per}`} rows={rows} cur={(r) => r.nothing} prev={() => 0} curLabel="Found nothing" prevLabel="" single fixedOrder
          fmt={int} labelWidth={104} pageSize={12} curNote={(r) => (r.searches ? { text: `${pct(r.nothing / r.searches)} of the searches`, color: MUTED } : null)}
          onFilter={() => c.onFilter("period")} filterLabel="Filter by period" />
      </Box>
      <Wrap c={c} on="period">
        <ChartBox title={`All the figures month by month, ${c.per}`} hint={`${c.days} · a month the period holds in part says which days${every} - no year earlier: the bar went live on 5 Jul 2026`}>
          <FullTable key="months" first="Month" cols={cols} natural rows={rows} total={total} />
        </ChartBox>
      </Wrap>
    </>
  );
}

/* ── language and store ────────────────────────────────────────────────── */

type SRow = { label: string; locale: string; searches: number; ok: number; nothing: number };
function Stores({ c }: { c: Ctx }) {
  const all = c.d.window?.byStore ?? [];
  const sum = all.reduce((t, r) => t + r.searches, 0);
  const back = new Map<string, string>();
  const rows: SRow[] = all.map((r) => { const label = storeName(r.locale); back.set(label, r.locale); return { label, locale: r.locale, searches: r.searches, ok: r.ok, nothing: r.searches - r.ok }; });
  const chosen = c.stores.map(storeName);
  const pick = (l: string) => c.onStore(back.get(l) ?? l);
  const cols: Col<SRow>[] = [
    { key: "searches", head: "Searches", cell: (r) => int(r.searches), sort: (r) => r.searches },
    { key: "share", head: "Share of all searches", cell: (r) => pct(sum ? r.searches / sum : null), sort: (r) => r.searches },
    { key: "ok", head: "Found something", cell: (r) => int(r.ok), sort: (r) => r.ok },
    { key: "nothing", head: "Found nothing", cell: (r) => int(r.nothing), sort: (r) => r.nothing },
    { key: "rate", head: "Found-nothing share", tip: "Found nothing ÷ the store's searches - by the bar's own rule", cell: (r) => pct(r.searches ? r.nothing / r.searches : null), sort: (r) => (r.searches ? r.nothing / r.searches : 0) },
  ];
  const t = storesIn(all, []);
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <DimChart title={`Searches by store, ${c.per}`} rows={rows} cur={(r) => r.searches} prev={() => 0} curLabel="Searches" prevLabel="" single labelWidth={230}
          fmt={int} selected={chosen} onPick={pick} onFilter={() => c.onFilter("store")} filterLabel="Filter by store" />
        <DimChart title={`Found nothing by store, ${c.per}`} rows={rows} cur={(r) => r.nothing} prev={() => 0} curLabel="Found nothing" prevLabel="" single labelWidth={230}
          fmt={int} curNote={(r) => (r.searches ? { text: `${pct(r.nothing / r.searches)} of its searches`, color: MUTED } : null)}
          selected={chosen} onPick={pick} onFilter={() => c.onFilter("store")} filterLabel="Filter by store" />
      </Box>
      <Wrap c={c} on="store">
        <ChartBox title={`All the figures by store, ${c.per}`} hint={`${c.days} · the store is the shop's language and country the search was typed in - a click on a row shows only it`}>
          <FullTable key="stores" first="Store" cols={cols} initial="searches" rows={rows} total={{ label: "Total", locale: "", searches: t.searches, ok: t.ok, nothing: t.searches - t.ok }}
            selected={chosen} onPick={pick} tint="green" find="a store" />
        </ChartBox>
      </Wrap>
    </>
  );
}

/* ── the terms ─────────────────────────────────────────────────────────── */

type TRow = TermRow & { label: string };
/** a board's rows by their label, once each - two texts cut to the same words would share a key */
const unique = (rows: BoardRow[]) => { const seen = new Set<string>(); return rows.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true))); };
const termRows = (rows: TermRow[]): TRow[] => rows.map((r) => ({ ...r, label: r.term }));
function TermBoard({ c, title, rows, sub, cur, summary }: { c: Ctx; title: string; rows: TermRow[]; sub: (r: TermRow) => string; cur: (r: TermRow) => number; summary?: React.ReactNode }) {
  const board: BoardRow[] = unique(rows.filter((r) => cur(r) > 0).map((r) => ({ label: r.term, cur: cur(r), prev: 0, sub: sub(r) })));
  return (
    <Leaderboard key={title} title={title} rows={board} curLabel="Searches" prevLabel="" noChange first={12} fmt={int} summary={summary}
      onFilter={() => c.onFilter("store")} filterLabel="Filter by store" selected={[]} />
  );
}
function Terms({ c }: { c: Ctx }) {
  const rows = typedIn(c.d.terms, c.stores);
  const words = rows.filter((r) => r.kind === "words" || r.kind === "long"), codes = rows.filter((r) => r.kind === "number" || r.kind === "code");
  const sub = (r: TermRow) => `${pct(r.searches ? r.found / r.searches : null)} found something · ${storesWords(r.stores)}`;
  const only = onlyStores(c);
  const cols: Col<TRow>[] = [
    { key: "searches", head: "Searches", tip: "Every store's searches of the term", cell: (r) => int(r.searches), sort: (r) => r.searches },
    { key: "found", head: "Found something", cell: (r) => `${int(r.found)} · ${pct(r.searches ? r.found / r.searches : null)}`, sort: (r) => (r.searches ? r.found / r.searches : 0) },
    { key: "nothing", head: "Found nothing", cell: (r) => int(r.nothing), sort: (r) => r.nothing },
    { key: "results", head: "Results on average", tip: "The results shown when it found something", cell: (r) => (r.found ? int(r.results) : "—"), sort: (r) => r.results },
    { key: "ai", head: "Passed to the AI", tip: "The searches the bar could not place and handed to its AI", cell: (r) => int(r.ai), sort: (r) => r.ai },
    { key: "kind", head: "Kind", cell: (r) => KIND_SHORT[r.kind] },
    { key: "stores", head: "Typed in", cell: (r) => storesWords(r.stores, 4) },
  ];
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <TermBoard c={c} title={`Words searched most, ${c.per}`} rows={words} cur={(r) => r.searches} sub={sub} />
        <TermBoard c={c} title={`Numbers and codes searched most, ${c.per}`} rows={codes} cur={(r) => r.searches} sub={sub} />
      </Box>
      <Wrap c={c} on="store">
        <ChartBox title={`The terms searched most, ${c.per}`}
          hint={`The bar's ${int(c.d.terms.length)} most searched terms of the ${int(c.d.window?.terms ?? 0)} different texts in ${c.days}${only ? ` · typed in ${only} - their counts are every store's: the report counts a term across stores` : ""}${c.d.termsHidden ? ` · ${plural(c.d.termsHidden, "text")} not shown - it may be a password or an e-mail typed by mistake` : ""}`}>
          {rows.length ? <FullTable key="terms" first="Term" cols={cols} initial="searches" rows={termRows(rows)} tint="blue" find="a term" />
            : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No term of the top list was typed in these stores.</Typography>}
        </ChartBox>
      </Wrap>
    </>
  );
}

/* ── found nothing ─────────────────────────────────────────────────────── */

/** The last searches read one by one: found nothing, still being typed, really found nothing. */
function Typing({ c }: { c: Ctx }) {
  const s = c.d.sample;
  if (!s) return (
    <ChartBox title="Still being typed?"><Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{c.d.errors.sample ? `The last searches could not be read: ${c.d.errors.sample}` : "No search read yet."}</Typography></ChartBox>
  );
  const x = sampleIn(s, c.stores);
  const real = x.nothing - x.typing;
  const line = (label: string, value: string, note: string, strong = false) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 1.25, alignItems: "baseline", py: 0.7, borderBottom: `1px solid ${HAIRLINE}` }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: strong ? 700 : 600, color: INK }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35 }}>{note}</Typography>
      </Box>
      <Typography sx={{ fontSize: strong ? "1.05rem" : "0.92rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</Typography>
    </Box>
  );
  return (
    <Wrap c={c} on="store">
      <ChartBox title="Still being typed? The last searches, one by one" hint={`${dayWords(s.from.slice(0, 10))} ${s.from.slice(11, 16)} – ${dayWords(s.to.slice(0, 10))} ${s.to.slice(11, 16)} UTC · ${int(s.logged)} keystrokes logged${c.stores.length ? ` · ${onlyStores(c)}` : ""}`}>
        <Box sx={{ display: "grid" }}>
          {line("Searches", int(x.settled), "Settled by the bar's own rule - the rule of the figures on top")}
          {line("Found nothing", `${int(x.nothing)} · ${pct(x.settled ? x.nothing / x.settled : null)}`, "By the bar's own rule - the rule of the Found nothing on top")}
          {line("Of them, still being typed", int(x.typing), "The same store, within a minute, a longer or a shorter text that starts the same - \"haltegri\" before \"haltegriff\"")}
          {line("Really found nothing", `${int(real)} · ${pct(x.settled ? real / x.settled : null)}`, "A number we do not know, a word not learned, a code, pasted text - below by kind", true)}
        </Box>
      </ChartBox>
    </Wrap>
  );
}

type GRow = GapRow & { label: string };
/** A text pasted into the bar can run to a whole e-mail: one line of 60 characters in the table, each label once. */
function cutLabels(rows: GapRow[]): GRow[] {
  const seen = new Map<string, number>();
  return rows.map((g) => {
    const cut = g.term.length > 60 ? `${g.term.slice(0, 58).trimEnd()}…` : g.term;
    const n = (seen.get(cut) ?? 0) + 1;
    seen.set(cut, n);
    return { ...g, label: n > 1 ? `${cut} (${n})` : cut };
  });
}
function Nothing({ c }: { c: Ctx }) {
  const terms = typedIn(c.d.terms, c.stores);
  const s = c.d.sample;
  const x = s ? sampleIn(s, c.stores) : null;
  const kinds = x ? (Object.keys(SEARCH_KINDS) as SearchKind[]).map((k) => ({ label: KIND_SHORT[k], n: x.kinds[k] })) : [];
  const examples = s ? typedIn((Object.keys(s.examples) as SearchKind[]).flatMap((k) => s.examples[k].map((e) => ({ ...e, kind: k }))), c.stores).sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)) : [];
  const gaps: GRow[] = cutLabels(typedIn(c.d.gaps?.rows ?? [], c.stores));
  const gapCols: Col<GRow>[] = [
    { key: "count", head: "Times", cell: (r) => int(r.count), sort: (r) => r.count },
    { key: "last", head: "Last searched", cell: (r) => (r.last ? dayWords(r.last) : "—"), sort: (r) => Date.parse(r.last) || 0 },
    { key: "kind", head: "Kind", cell: (r) => KIND_SHORT[r.kind] },
    { key: "how", head: "The AI", tip: "The bar handed it to its AI - and the AI answered, or failed too", cell: (r) => (r.failed ? "Failed too" : "Answered") },
    { key: "stores", head: "Typed in", cell: (r) => storesWords(r.stores, 4) },
  ];
  const gw = c.d.gaps?.window === "7d" ? "the last 7 days" : "the last 30 days";
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <TermBoard c={c} title={`The terms that found nothing most, ${c.per}`} rows={[...terms].sort((a, b) => b.nothing - a.nothing)} cur={(r) => r.nothing}
          sub={(r) => `of ${plural(r.searches, "search", "searches")} · ${storesWords(r.stores)}`}
          summary={<span style={{ fontWeight: 500, color: MUTED }}>Of the {int(c.d.terms.length)} terms searched most{c.stores.length ? " - every store's counts" : ""}</span>} />
        <Typing c={c} />
      </Box>
      <Box sx={TWO}>
        <DimChart title="What really found nothing, by kind - the last searches" rows={kinds} cur={(r) => r.n} prev={() => 0} curLabel="Searches" prevLabel="" single fixedOrder labelWidth={230}
          fmt={int} onFilter={() => c.onFilter("store")} filterLabel="Filter by store" />
        <Leaderboard key="examples" title="Really found nothing most often - the last searches" rows={unique(examples.map((e) => ({ label: e.text, cur: e.n, prev: 0, sub: `${KIND_SHORT[e.kind]} · ${storesWords(e.stores)}` })))}
          curLabel="Searches" prevLabel="" noChange first={12} fmt={int} onFilter={() => c.onFilter("store")} filterLabel="Filter by store"
          summary={s?.hidden ? <span style={{ fontWeight: 500, color: MUTED }}>{plural(s.hidden, "search", "searches")} not shown - the text may be a password or an e-mail typed by mistake</span> : undefined} />
      </Box>
      <Wrap c={c} on="store">
        <ChartBox title={`Passed to the AI - the bar could not place it, ${gw}`}
          hint={`Each text the bar handed to its AI, the times and the last day it was typed${c.stores.length ? ` · typed in ${onlyStores(c)} - every store's times` : ""} · the bar keeps this list for 7 or 30 days only${c.d.gaps?.hidden ? ` · ${plural(c.d.gaps.hidden, "text")} not shown - it may be a password or an e-mail` : ""}`}>
          {!c.d.gaps ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{c.d.errors.gaps ? `The list could not be read: ${c.d.errors.gaps}` : "Not read."}</Typography>
            : gaps.length ? <FullTable key="gaps" first="Text as typed" cols={gapCols} initial="count" rows={gaps} tint="amber" find="a text" />
              : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing passed to the AI in these stores.</Typography>}
        </ChartBox>
      </Wrap>
    </>
  );
}

/* ── the tabs ──────────────────────────────────────────────────────────── */

function Footnote({ c }: { c: Ctx }) {
  return (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 }}>
      The search bar&apos;s own log - every search, cookies or not. A search: the bar searches as one types and logs every pause, so a text the next one in the same store extends within 20 seconds is a keystroke and not counted ({int(c.d.window?.logged ?? 0)} keystrokes logged, {int(c.d.window?.settled ?? 0)} searches); one character is not a search, our nightly test phrases are left out.
      {" "}Found nothing: no result shown, or the bar handed the text to its AI - a view that draws a table, a special article&apos;s quick order card and the O-ring catalogue count as found. Some of it is still typing a little slower than 20 seconds: the Found nothing tab reads the last searches one by one.
      {" "}The report counts back from now ({c.days.charAt(0).toLowerCase()}{c.days.slice(1)}); it keeps no months and no terms per store - a store chosen narrows the figures on top and the stores exactly, the terms by where they were typed, with every store&apos;s counts. No year earlier: the bar went live on the shop on 5 Jul 2026.
      {" "}The log keeps no customer, no session and no company - so there is no list of companies here. A text that may be a password or an e-mail typed by mistake is counted, never shown.
    </Typography>
  );
}

const CARD = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
const TAB_HEAD: Record<View, { icon: React.ReactNode; tint: Tint; title: string; note: string }> = {
  months: { icon: <DateRangeOutlinedIcon />, tint: "blue", title: "Searches month by month", note: "each month's searches and those that found nothing, then all the figures" },
  stores: { icon: <TranslateOutlinedIcon />, tint: "green", title: "Searches by language and store", note: "each store's searches and those that found nothing - a click shows only it" },
  terms: { icon: <FormatListNumberedIcon />, tint: "purple", title: "What customers search for", note: "the words, numbers and codes searched most, then every term of the top list" },
  nothing: { icon: <SearchOffOutlinedIcon />, tint: "pink", title: "The searches that found nothing - the products we miss", note: "the terms that found nothing most, how much of it was still being typed, what really found nothing, and the texts the bar handed to its AI" },
};
function TabCard({ c, view }: { c: Ctx; view: View }) {
  const h = TAB_HEAD[view];
  return (
    <GlassCard sx={CARD}>
      <CardTitle icon={h.icon} tint={h.tint} title={`${h.title}, ${c.per}`} note={`${c.days} · ${h.note}`} />
      {view === "months" ? <Months c={c} /> : view === "stores" ? <Stores c={c} /> : view === "terms" ? <Terms c={c} /> : <Nothing c={c} />}
      <Footnote c={c} />
    </GlassCard>
  );
}

/* ── the figures top right ─────────────────────────────────────────────── */

function figuresOf(c: Ctx): Fig[] {
  const w = c.d.window!;
  const t = storesIn(w.byStore, c.stores);
  const nothing = t.searches - t.ok;
  const where = c.stores.length ? `${plural(c.stores.length, "store")} of ${int(w.settled)} searches in every store` : `${int(w.logged)} keystrokes logged - the bar searches as one types`;
  return [
    { label: "Searches", value: int(t.searches), sub: where, icon: <SearchIcon />, tint: "blue" },
    { label: "Found something", value: int(t.ok), sub: `${pct(t.searches ? t.ok / t.searches : null)} of the searches`, icon: <TaskAltOutlinedIcon />, tint: "green" },
    { label: "Found nothing", value: int(nothing), sub: `${pct(t.searches ? nothing / t.searches : null)} of the searches - some still being typed, see Found nothing`, icon: <SearchOffOutlinedIcon />, tint: "pink" },
  ];
}

/* ── the Filters window ────────────────────────────────────────────────── */

function SearchFilterWindow({ c, open, onClose, focus, setPeriod, clearAll }: {
  c: Ctx; open: boolean; onClose: () => void; focus: { on: Focus; n: number } | null; setPeriod: (p: PeriodId) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<Focus, boolean>>>({});
  const isOpen = (k: Focus) => (shut[k] !== undefined ? !shut[k] : true);
  const flip = (k: Focus) => setShut((s) => ({ ...s, [k]: isOpen(k) }));
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.on]: false }));
    const t = setTimeout(() => document.getElementById(`sfilter-${focus.on}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const isAll = c.d.period === "all";
  const count = c.stores.length + (isAll ? 0 : 1);
  const periodName = PERIODS.find((p) => p.id === c.d.period)!.label;
  return (
    <FilterPanel id="search-filters" open={open} onClose={onClose}
      subtitle={count ? `${count} chosen - click again to let one go` : "The period; the stores - several at once"}
      onClearAll={count ? clearAll : undefined}
      chips={count ? <>
        {!isAll && <Chip size="small" label={<span><b>Period:</b> {periodName}</span>} onDelete={() => setPeriod("all")} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.blue.bg, color: INK }} />}
        {c.stores.map((l) => <Chip key={l} size="small" label={<span><b>Store:</b> {storeName(l)}</span>} onDelete={() => c.onStore(l)} sx={{ height: 26, maxWidth: "100%", fontSize: "0.76rem", bgcolor: TINT.green.bg, color: INK }} />)}
      </> : null}>
      <FilterSection id="sfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary={periodName} chosen={!isAll}>
        <Choices<PeriodId> on={c.d.period} onPick={setPeriod} items={PERIODS.map((p) => ({ id: p.id, label: p.label }))} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
          The search bar&apos;s report counts back from now - so a period here always ends today, and a month or a quarter of your own cannot be picked. Month by month shows the months the period holds, a month held in part with its days. No year earlier: the bar went live on 5 Jul 2026.
        </Typography>
      </FilterSection>
      <FilterSection id="sfilter-store" index={1} title="Store" icon={<StorefrontOutlinedIcon />} tint="green" open={isOpen("store")} onFlip={() => flip("store")}
        summary={!c.stores.length ? "All" : c.stores.length === 1 ? storeName(c.stores[0]) : `${c.stores.length} chosen`} chosen={c.stores.length > 0}>
        <Facet rows={(c.d.window?.byStore ?? []).map((r) => ({ key: r.locale, label: storeName(r.locale), v: r.searches }))} chosen={c.stores} tint="green" find="a store" unit="searches" onPick={c.onStore} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
          Narrows the figures on top and the stores exactly; the terms and the texts to those typed in the stores chosen - with every store&apos;s counts, the report counts a term across stores. Month by month stays every store&apos;s.
        </Typography>
      </FilterSection>
    </FilterPanel>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

export function SiteSearchExplorer() {
  const params = useSearchParams();
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "months") q.delete("view"); else q.set("view", v); });
  const period = periodOf(params.get("period"));
  const setPeriod = useCallback((p: PeriodId) => setQuery((q) => { if (p === "all") q.delete("period"); else q.set("period", p); }), []);
  const stores = useMemo(() => params.getAll("store").filter((x) => /^[A-Za-z]{2}[-_][A-Za-z]{2,3}$/.test(x)).slice(0, 30), [params]);
  const onStore = useCallback((l: string) => setQuery((q) => {
    const cur = q.getAll("store"), next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
    q.delete("store");
    for (const x of next) q.append("store", x);
  }), []);
  const clearAll = useCallback(() => setQuery((q) => { q.delete("store"); q.delete("period"); }), []);
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ on: Focus; n: number } | null>(null);
  const openOn = useCallback((on: Focus) => { setFocus((f) => ({ on, n: (f?.n ?? 0) + 1 })); setPanel(true); }, []);
  const [tick, setTick] = useState(0);

  const url = `/api/reporting/products/search?period=${period}&n=${tick}`;
  const held = useHeld<SearchData>(url, [url]);
  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  // what was drawn last stays while the next period comes: the figures dim, nothing jumps
  const lastGood = useRef<SearchData | null>(null);
  if (data?.window) lastGood.current = data;
  const d = lastGood.current;
  const c = useMemo<Ctx | null>(() => {
    if (!d?.window) return null;
    const ms = d.window.byMonth;
    const first = ms[0]?.first, last = ms[ms.length - 1]?.last;
    const per = d.period === "all" ? "since the bar went live" : `the last ${d.days} days`;
    const days = first && last ? `${per === "since the bar went live" ? "Since the bar went live" : `The last ${d.days} days`}: ${dayWords(first)} – ${dayWords(last)}` : per;
    return { d, stores, per, days, onStore, onFilter: openOn };
  }, [d, stores, onStore, openOn]);
  const stale = held.stale || r === null || (!!d && d.period !== period);

  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  const title = <Typography component="h1" sx={H1}>Search</Typography>;
  if (r === null && !c) return <Box sx={shell}>{title}<LoadingPanel label="Reading the search bar's log…" /></Box>;
  if (r?.state === "error" && !c) return <Box sx={shell}>{title}<UpstreamPanel source="The search bar's report" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} /></Box>;
  if (!c) return <Box sx={shell}>{title}<UpstreamPanel source="The search bar's report" error={data?.errors.report ?? "No answer"} status={null} onRetry={() => setTick((n) => n + 1)} /></Box>;

  const isAll = c.d.period === "all";
  const count = stores.length + (isAll ? 0 : 1);
  const errs = Object.entries(c.d.errors).filter(([k]) => k !== "report");
  return (
    <Box sx={shell}>
      {/* the title and what is shown on the left; the figures top right - as Articles CY/LY */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          {title}
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            What customers type into the shop&apos;s search bar · <b style={{ color: INK }}>{c.days}</b> · the bar&apos;s own log, every visitor{stores.length ? ` · ${names(stores.map(storeName))}` : ""}{stale ? " · reading" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards items={figuresOf(c)} /></Box>
      </Box>
      {errs.length > 0 && <Notice tone="warn">Read in part: {errs.map(([k, v]) => `${k === "gaps" ? "the texts passed to the AI" : k === "sample" ? "the last searches" : k} - ${v}`).join(" · ")}</Notice>}

      {/* the tabs, and at their right end the Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="search" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id === "stores" && stores.length ? String(stores.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => { if (panel) setPanel(false); else openOn(view === "months" ? "period" : "store"); }} variant={panel || count ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="search-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || count ? undefined : "#fff" }}>
          Filters{count ? ` · ${count}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs - the period first */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={[
        ...(!isAll ? [{ key: "period", name: "Period", value: PERIODS.find((p) => p.id === c.d.period)!.label, tint: "blue" as Tint, onRemove: () => setPeriod("all") }] : []),
        ...stores.map((l): ActiveItem => ({ key: `store:${l}`, name: "Store", value: storeName(l), tint: "green", onRemove: () => onStore(l) })),
      ]} />

      <Box id={`search-panel-${view}`} role="tabpanel" sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCard c={c} view={view} />
      </Box>

      <SearchFilterWindow c={c} open={panel} onClose={() => setPanel(false)} focus={focus} setPeriod={setPeriod} clearAll={clearAll} />
    </Box>
  );
}
