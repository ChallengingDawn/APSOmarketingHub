"use client";
// ARTICLES CY/LY - every article's revenue this year to date against the same days of last year. Moved from the APSOAssistant
// micro apps (05.10.2026); the report is built in the hub (src/lib/integrations/articleReport.ts), once a day after the
// night's orders are in, or by an admin with Rebuild.
//
// Rebuilt like the ESO Figures (SARCLA 01.11.2026, his pick: "Articles rebuilt like Figures"): the title, and the figures
// top right; a tab per breakdown - Profit centre, Product hierarchy (Products & Pricing's main group, sub group and product),
// Articles - each tab one card that follows it; the Filters window, what the page is filtered by under the tabs, Clear all;
// on every graph its own "Filter by …" and the companies that bought those articles. No Actions and no BUC View here
// (SARCLA: "no actions are needed here because no BUC view").
//
// The year to date only: the report adds the year up as it goes and keeps no months, so there is no other period to pick -
// the Filters window says so. The figures and breakdowns are worked out on the server (src/lib/articles/explore.ts): 45,000
// articles are too many to send.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import FiberNewOutlinedIcon from "@mui/icons-material/FiberNewOutlined";
import BedtimeOutlinedIcon from "@mui/icons-material/BedtimeOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, Notice, RED, TINT, TRACK, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { Pager, Table, change, withChange, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { CardFilterFor, ChartBox, FullTable, H1, Leaderboard, TWO, setQuery, type BoardRow, type CardFilter, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { pcLabel } from "@/app/reporting/eso-benchmark/shared";
import { CompaniesFor, type CompanySource } from "@/app/reporting/CompanyList";
import { ADIMS, NONE, NO_PC, type ADim, type AFilters, type ArtFigures, type ArticleLine, type BDim, type Bucket, type CompanyLine, type Explore } from "@/lib/articles/explore";
import type { BuildStatus } from "@/lib/integrations/articleReport";

/* ── the read ──────────────────────────────────────────────────────────── */

type Meta = {
  generated: string; cy: number; ly: number; today: string; ordersRead: number; articles: number;
  documentsBasis: { totalCy: number; totalLyYtd: number; totalLy: number }; catalogueFilled: number;
  /** the build read every article's main group, sub group and product */
  hierarchy: boolean;
  /** the buyers are kept beside the report: every graph can list its companies */
  buyers: boolean;
};
/** `filters`: those the figures are of - the address may already be ahead of them while the next answer comes. */
type Summary = { status: BuildStatus; report: Meta | null; explore: Explore | null; filters?: AFilters };

/** The filters as the address and the reads carry them: "&pc=DT&group=…" - one level left out when `skip` names it. */
const filterQs = (f: AFilters, skip?: ADim) => ADIMS.flatMap((d) => (d === skip ? [] : (f[d] ?? []).map((v) => `&${d}=${encodeURIComponent(v)}`))).join("");

/* ── words and numbers, in full (as the ESO Figures) ───────────────────── */

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const signedEur = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const signedInt = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const plural = (n: number, one: string, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "1 Nov" - the report's day */
const dm = (m: Meta) => `${Number(m.today.slice(8, 10))} ${MONTHS[Number(m.today.slice(5, 7)) - 1]}`;
/** "1 Jan – 1 Nov 2026" - a year earlier with back = 1 */
const ytdWords = (m: Meta, back = 0) => `1 Jan – ${dm(m)} ${m.cy - back}`;

/* ── the levels ────────────────────────────────────────────────────────── */

const DIM: Record<ADim, { name: string; lower: string; tint: Tint; icon: React.ReactNode; none: string }> = {
  pc: { name: "Profit centre", lower: "profit centre", tint: "purple", icon: <CategoryOutlinedIcon />, none: "No profit centre" },
  group: { name: "Main group", lower: "main group", tint: "amber", icon: <AccountTreeOutlinedIcon />, none: "No main group" },
  sub: { name: "Sub group", lower: "sub group", tint: "amber", icon: <AccountTreeOutlinedIcon />, none: "No sub group" },
  product: { name: "Product", lower: "product", tint: "green", icon: <Inventory2OutlinedIcon />, none: "No product" },
  article: { name: "Article", lower: "article", tint: "slate", icon: <ListAltIcon />, none: "" },
};
const isNone = (key: string) => key === NONE || key === NO_PC || !key;
const pcName = (key: string) => (isNone(key) ? DIM.pc.none : pcLabel(key.toLowerCase()));
/** A value as the page shows it: a profit centre by its name, a product and an article by their name, then their number
 *  (the name reads first in a narrow card; the number keeps two of the same name apart). */
function labelOf(d: ADim, key: string, name?: string | null): string {
  if (d === "pc") return pcName(key);
  if (isNone(key)) return DIM[d].none;
  if (d === "product" || d === "article") return name ? `${name} · ${key}` : key;
  return key;
}

type View = "pc" | "hierarchy" | "articles";
const VIEWS: { id: View; label: string; dims: ADim[] }[] = [
  { id: "pc", label: "Profit centre", dims: ["pc"] },
  { id: "hierarchy", label: "Product hierarchy", dims: ["group", "sub", "product"] },
  { id: "articles", label: "Articles", dims: ["article"] },
];
const viewOf = (x: string | null): View => (x === "hierarchy" || x === "articles" ? x : "pc");
/** The breakdown a tab's Filters button opens on. */
const FOCUS: Record<View, ADim> = { pc: "pc", hierarchy: "group", articles: "article" };

/* ── what every graph is drawn with ────────────────────────────────────── */

type Ctx = {
  meta: Meta; x: Explore; filters: AFilters;
  /** a bar or a row: show only it (again: let it go) */
  onPick: (d: ADim, key: string) => void;
  /** the Filters window, open on a level */
  onFilter: (d: ADim) => void;
  /** the companies that bought a graph's articles - its own (the movers), or the page's filters and a search; null without the buyers */
  companies: (o?: { ids?: string[]; q?: string }) => CompanySource | null;
};

const companyKeys = ["name", "cy", "lyYtd", "change", "articles", "un", "country"] as const;
/** The companies behind a graph (CompanyList.tsx): those that bought its articles, each with its revenue on them - read a page
 *  at a time from the buyers the build keeps beside the report, so the list adds up to the graph. */
function companiesFor(meta: Meta, filters: AFilters) {
  return (o: { ids?: string[]; q?: string } = {}): CompanySource | null => {
    if (!meta.buyers) return null;
    const body = o.ids ? { ids: o.ids } : { filters, q: o.q ?? "" };
    return {
      key: JSON.stringify({ ...body, at: meta.generated }),
      head: [`Revenue ${meta.cy} to date`, `Same days ${meta.ly}`, "Change in €", "Articles bought", "Customer number", "Country"],
      left: [5, 6], sorts: companyKeys.map((_, i) => i),
      note: `Each company's revenue on ${o.ids ? "these articles" : "the articles shown"}, ${ytdWords(meta)} - the change against ${ytdWords(meta, 1)} under it; the articles of them it bought this year - the largest first`,
      load: async (page, cq, sort) => {
        const r = await fetch("/api/uc/articles/companies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, page, cq, sort: sort ? { key: companyKeys[sort.col], desc: sort.desc } : null }),
        });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; total?: number; rows?: CompanyLine[] };
        if (!r.ok || j.ok === false) throw new Error(j.error ?? `HTTP ${r.status}`);
        return {
          total: j.total ?? 0,
          rows: (j.rows ?? []).map((x) => ({
            id: x.id || null, name: x.name,
            cells: [withChange(eur(x.cy), change(x.cy, x.lyYtd)), eur(x.lyYtd), <span key="d" style={{ color: tone(x.cy - x.lyYtd) }}>{signedEur(x.cy - x.lyYtd)}</span>, int(x.articles), x.un, x.country || "—"],
            values: [x.cy, x.lyYtd, x.cy - x.lyYtd, x.articles, x.un, x.country || null],
          })),
        };
      },
    };
  };
}

/** A graph with its companies, and - where it has no breakdown of its own to filter (a table) - the page's Filters on a level. */
function Wrap({ c, dim, ids, children }: { c: Ctx; dim: ADim; ids?: string[]; children: React.ReactNode }) {
  const filter: CardFilter = { open: () => c.onFilter(dim), label: `Filter by ${DIM[dim].lower}`, on: !!c.filters[dim]?.length };
  return <CompaniesFor source={c.companies(ids ? { ids } : {})}><CardFilterFor filter={filter}>{children}</CardFilterFor></CompaniesFor>;
}

/** The chosen values of a level, as its graphs label them. */
const chosenLabels = (c: Ctx, d: ADim) => (c.filters[d] ?? []).map((k) => labelOf(d, k, d === "product" ? c.x.names.product[k] : d === "article" ? c.x.names.article[k] : null));

/** A level's revenue year to date, ranked - the values Products & Pricing has no name for left out of the ranking (in the table). */
function RevBoard({ c, dim }: { c: Ctx; dim: BDim }) {
  const all = c.x.by[dim];
  // a share of everything under the filters - the products come as the largest only, so not of those sent
  const sum = dim === "product" ? c.x.all.product.revCy : all.reduce((s, b) => s + Math.max(0, b.cy), 0);
  const back = new Map<string, string>();
  const rows: BoardRow[] = [];
  let none: Bucket | null = null;
  for (const b of all) {
    if (isNone(b.key)) { none = b; continue; }
    if (!b.cy && !b.lyYtd) continue;
    const label = labelOf(dim, b.key, b.name);
    back.set(label, b.key);
    rows.push({ label, cur: b.cy, prev: b.lyYtd, sub: `${plural(b.articlesCy, "article")} sold · ${sum > 0 && b.cy > 0 ? pct(b.cy / sum) : "—"} of the revenue` });
  }
  // the products come as the largest only (explore.ts PRODUCTS_SENT) - every one is in the table under the board
  const some = dim === "product" && c.x.products > all.length ? `The ${all.length} largest of ${int(c.x.products)} products - every one in the table below` : "";
  const noneWords = none && (none.cy || none.lyYtd) ? `${DIM[dim].none}: ${eur(none.cy)} - in the table` : "";
  return (
    <Leaderboard key={`rev-${dim}`} title={`Revenue year to date, by ${DIM[dim].lower}`} rows={rows} curLabel={String(c.meta.cy)} prevLabel={`${c.meta.ly}, same days`} first={12}
      summary={some || noneWords ? <span style={{ fontWeight: 500, color: MUTED }}>{[some, noneWords].filter(Boolean).join(" · ")}</span> : undefined}
      selected={chosenLabels(c, dim)} onPick={(l) => c.onPick(dim, back.get(l) ?? l)} onFilter={() => c.onFilter(dim)} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

/** A level's articles sold year to date - each against the articles sold on last year's same days. */
function CountBoard({ c, dim }: { c: Ctx; dim: BDim }) {
  const back = new Map<string, string>();
  const rows: BoardRow[] = c.x.by[dim].flatMap((b) => {
    if (isNone(b.key) || (!b.articlesCy && !b.articlesLyYtd)) return [];
    const label = labelOf(dim, b.key, b.name);
    back.set(label, b.key);
    return [{ label, cur: b.articlesCy, prev: b.articlesLyYtd, sub: `${int(b.fresh)} new · ${int(b.quiet)} gone quiet` }];
  });
  return (
    <Leaderboard key={`count-${dim}`} title={`Articles sold year to date, by ${DIM[dim].lower}`} rows={rows} curLabel={String(c.meta.cy)} prevLabel={`${c.meta.ly}, same days`} first={12}
      fmt={int} diff={signedInt} selected={chosenLabels(c, dim)} onPick={(l) => c.onPick(dim, back.get(l) ?? l)} onFilter={() => c.onFilter(dim)} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

/** A figure with its change under it, right-aligned - as the Figures' tables. */
const withChangeCell = (text: string, a: number, b: number) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {text}
    <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: b ? tone(changeOf(a, b)) : a > 0 ? GREEN : FAINT }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</Box>
  </Box>
);
const changeCell = (a: number, b: number) => <span style={{ color: tone(changeOf(a, b)), fontWeight: 700 }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</span>;
const diffCell = (a: number, b: number) => <span style={{ color: tone(a - b) }}>{signedEur(a - b)}</span>;

type BRow = Bucket & { label: string };
/** All the figures of a level: each value's revenue against last year's same days, its share, its articles, its companies.
 *  The profit centres and main groups all come with the figures; the products are paged on the server (ProductTable). */
function BucketTable({ c, dim }: { c: Ctx; dim: "pc" | "group" | "sub" }) {
  const back = new Map<string, string>();
  const rows: BRow[] = c.x.by[dim].map((b) => { const label = labelOf(dim, b.key, b.name); back.set(label, b.key); return { ...b, label }; });
  const t: ArtFigures = c.x.all[dim];
  const total: BRow = { key: "", label: "Total", cy: t.revCy, lyYtd: t.revLyYtd, ly: t.revLy, articlesCy: t.articlesCy, articlesLyYtd: t.articlesLyYtd, fresh: t.fresh, quiet: t.quiet, companiesCy: t.companiesCy, companiesLyYtd: t.companiesLyYtd };
  const sumRev = rows.reduce((s, r) => s + Math.max(0, r.cy), 0);
  const { cy, ly } = c.meta;
  const cols: Col<BRow>[] = [
    { key: "rev", head: "Revenue year to date", tip: `${ytdWords(c.meta)} - every order counted once`, cell: (r) => eur(r.cy), sort: (r) => r.cy },
    { key: "revPy", head: `Same days ${ly}`, tip: ytdWords(c.meta, 1), cell: (r) => eur(r.lyYtd), sort: (r) => r.lyYtd },
    { key: "diff", head: "Change in €", cell: (r) => diffCell(r.cy, r.lyYtd), sort: (r) => r.cy - r.lyYtd },
    { key: "change", head: "Change in %", cell: (r) => changeCell(r.cy, r.lyYtd), sort: (r) => changeOf(r.cy, r.lyYtd) ?? -Infinity },
    { key: "share", head: "Share of revenue", tip: "This row's part of the revenue in the table", cell: (r) => (r.cy > 0 && sumRev > 0 ? pct(r.cy / sumRev) : "—"), sort: (r) => r.cy },
    { key: "arts", head: "Articles sold", tip: `Articles with an order line this year to date - under it the change against the same days of ${ly}`, cell: (r) => withChangeCell(int(r.articlesCy), r.articlesCy, r.articlesLyYtd), sort: (r) => r.articlesCy },
    { key: "fresh", head: "New articles", tip: `Sold this year, not at all in ${ly}`, cell: (r) => int(r.fresh), sort: (r) => r.fresh },
    { key: "quiet", head: "Gone quiet", tip: `Sold by ${dm(c.meta)} ${ly}, nothing yet in ${cy}`, cell: (r) => int(r.quiet), sort: (r) => r.quiet },
    ...(c.meta.buyers ? [{ key: "cust", head: "Companies year to date", tip: `The companies that bought - under it the change against the same days of ${ly}`,
      cell: (r: BRow) => withChangeCell(int(r.companiesCy ?? 0), r.companiesCy ?? 0, r.companiesLyYtd ?? 0), sort: (r: BRow) => r.companiesCy ?? 0 }] : []),
    { key: "ly", head: `All of ${ly}`, tip: `The whole of ${ly} - beside, never the base of the change`, cell: (r) => eur(r.ly), sort: (r) => r.ly },
  ];
  return <FullTable key={`table-${dim}`} first={DIM[dim].name} cols={cols} initial="rev" rows={rows} total={total} selected={chosenLabels(c, dim)} tint={DIM[dim].tint}
    onPick={(l) => c.onPick(dim, back.get(l) ?? l)} find={`a ${DIM[dim].lower}`} />;
}

/** Growing or falling most, the change in € - accounting lines left out; a click shows only that article. */
function MoverBoard({ c, which }: { c: Ctx; which: "top" | "flop" }) {
  const list: ArticleLine[] = which === "top" ? c.x.movers.top : c.x.movers.flop;
  const back = new Map<string, string>();
  const rows: BoardRow[] = list.map((r) => {
    const label = labelOf("article", r.article, r.description);
    back.set(label, r.article);
    return { label, cur: which === "top" ? r.delta : -r.delta, prev: 0, sub: `${pcName(r.pc)} · ${eur(r.revenueCy)} against ${eur(r.revenueLyYtd)} · ${r.deltaPct == null ? "new" : signedPct(r.deltaPct / 100)}` };
  });
  return (
    <Wrap c={c} dim="article" ids={list.map((r) => r.article)}>
      <Leaderboard key={`movers-${which}`} title={which === "top" ? "Growing most, year to date" : "Falling most, year to date"} rows={rows} noChange first={10}
        fmt={which === "top" ? signedEur : (n) => signedEur(-n)} curLabel={`Change against ${ytdWords(c.meta, 1)}`} prevLabel=""
        selected={chosenLabels(c, "article")} onPick={(l) => c.onPick("article", back.get(l) ?? l)} onFilter={() => c.onFilter("article")} filterLabel="Filter by article" />
    </Wrap>
  );
}

/* ── the article and product lists: 25 a page, searched and sorted on the server ── */

/** A column of a list read a page at a time: its name, what it sorts by on the server, text (left, A first) or a figure. */
type PCol<R> = { head: string; sort: string | null; text?: boolean; width?: string; cell: (r: R) => React.ReactNode };
type Paged<R> = { total: number; page: number; size: number; rows: R[] };

/** A list too long to send - every article, every product: a search, the headings sort, 25 a page, a row clicked shows only it. */
function PagedTable<R>({ c, level, dim, title, hint, find, cols, idOf, minWidth, totalRow, companiesQ }: {
  c: Ctx; level: "article" | "product"; dim: ADim; title: string;
  hint: (total: number | null, q: string) => string; find: string; cols: PCol<R>[]; idOf: (r: R) => string; minWidth: number;
  /** the Total row under each page - none while a search narrows the list */
  totalRow?: React.ReactNode[];
  /** the list's companies follow its search (the articles); the products' are those of the page's filters */
  companiesQ?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  const [page, setPage] = useState(0);
  const [st, setSt] = useState<{ busy: boolean; data?: Paged<R>; error?: string }>({ busy: true });
  const qs = filterQs(c.filters);
  useEffect(() => { const t = setTimeout(() => { setQ(typed.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(0); }, [qs, sort]);
  const by = sort ? cols[sort.col]?.sort : null;
  useEffect(() => {
    const ctrl = new AbortController();
    setSt((x) => ({ ...x, busy: true, error: undefined }));
    const sq = by ? `&sort=${by}&desc=${sort!.desc ? 1 : 0}` : "";
    fetch(`/api/uc/articles/rows?${level === "product" ? "level=product&" : ""}page=${page}${sq}${q ? `&q=${encodeURIComponent(q)}` : ""}${qs}&at=${encodeURIComponent(c.meta.generated)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Paged<R>; error?: string }) => setSt(j?.ok && j.data ? { busy: false, data: j.data } : { busy: false, error: j?.error ?? "no answer" }))
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setSt({ busy: false, error: String((e as Error)?.message ?? e) }); });
    return () => ctrl.abort();
  }, [level, page, q, qs, by, sort?.desc, c.meta.generated]); // eslint-disable-line react-hooks/exhaustive-deps
  // a figure first from the largest, a word from A
  const onSort = (i: number) => setSort((x) => (x?.col === i ? { col: i, desc: !x.desc } : { col: i, desc: !cols[i].text }));
  const d = st.data;
  const chosen = new Set(c.filters[dim] ?? []);
  const pager = { shown: [] as unknown[], page: d?.page ?? 0, pages: d ? Math.max(1, Math.ceil(d.total / d.size)) : 1, setPage, size: d?.size ?? 25, total: d?.total ?? 0 };
  const filter: CardFilter = { open: () => c.onFilter(dim), label: `Filter by ${DIM[dim].lower}`, on: chosen.size > 0 };
  const rows: { key: string; cells: React.ReactNode[]; strong?: boolean; on?: boolean; onPick?: () => void }[] =
    (d?.rows ?? []).map((r) => { const id = idOf(r); return { key: id, on: chosen.has(id), onPick: () => c.onPick(dim, id), cells: cols.map((x) => x.cell(r)) }; });
  if (totalRow && !q && rows.length) rows.push({ key: " total", cells: totalRow, strong: true });
  return (
    <CardFilterFor filter={filter}>
      <ChartBox title={title} companies={c.companies(companiesQ ? { q } : {})} hint={hint(d ? d.total : null, q)}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: "1 1 220px", maxWidth: 360, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
            <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
            <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={find} inputProps={{ "aria-label": find }} sx={{ fontSize: "0.86rem", flex: 1 }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          {st.busy && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <Pager p={pager} />
        </Box>
        {st.error ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The {level}s could not be read: {st.error}</Typography>
          : d && !d.rows.length ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{q ? `No ${level} matches that search under these filters.` : `No ${level} under these filters.`}</Typography>
          : (
            <Box sx={{ opacity: st.busy ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}>
              <Table head={cols.map((x) => x.head)} left={cols.flatMap((x, i) => (x.text && i ? [i] : []))} sortable={cols.flatMap((x, i) => (x.sort ? [i] : []))} sort={sort} onSort={onSort}
                firstWidth="minmax(240px, 2fr)" widths={cols.slice(1).map((x) => x.width ?? "minmax(112px, 1fr)")} minWidth={minWidth} rows={rows} />
              {d && d.total > d.size && <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}><Pager p={pager} /></Box>}
            </Box>
          )}
      </ChartBox>
    </CardFilterFor>
  );
}

/** A cell that may run long: one line, the rest on hover. */
const textCell = (v: string, faint = false) => <Typography noWrap title={v} sx={{ fontSize: "0.82rem", color: faint ? FAINT : INK }}>{v}</Typography>;

/** Every article under the filters. */
function ArticleList({ c }: { c: Ctx }) {
  const { ly } = c.meta;
  const cols: PCol<ArticleLine>[] = [
    { head: "Article", sort: "article", text: true, cell: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap title={r.description} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.description || "—"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{r.article}{r.pseudo ? " · accounting line" : ""}</Typography>
      </Box>
    ) },
    { head: "Profit centre", sort: "pc", text: true, width: "150px", cell: (r) => textCell(pcName(r.pc)) },
    ...(c.meta.hierarchy ? [{ head: "Product", sort: "product", text: true, width: "minmax(170px, 1.2fr)", cell: (r: ArticleLine) => textCell(r.productName || r.product || "—", !r.product) }] : []),
    { head: "Revenue year to date", sort: "revenueCy", cell: (r) => withChange(eur(r.revenueCy), change(r.revenueCy, r.revenueLyYtd)) },
    { head: `Same days ${ly}`, sort: "revenueLyYtd", cell: (r) => eur(r.revenueLyYtd) },
    { head: "Change in €", sort: "delta", cell: (r) => diffCell(r.revenueCy, r.revenueLyYtd) },
    { head: `All of ${ly}`, sort: "revenueLy", cell: (r) => eur(r.revenueLy) },
    { head: "Companies year to date", sort: "customersCy", cell: (r) => int(r.customersCy) },
    { head: "Quantity year to date", sort: "qtyCy", cell: (r) => int(r.qtyCy) },
    { head: "Countries", sort: null, text: true, width: "minmax(150px, 1fr)", cell: (r) => textCell(r.countries.replace(/\|/g, ", ") || "—", !r.countries) },
  ];
  return (
    <PagedTable<ArticleLine> c={c} level="article" dim="article" title="Every article, year to date" find="Find an article - its number or words of it" cols={cols} idOf={(r) => r.article}
      minWidth={c.meta.hierarchy ? 1500 : 1320} companiesQ
      hint={(n, q) => `${ytdWords(c.meta)} against ${ytdWords(c.meta, 1)} · ${n == null ? "the articles" : plural(n, "article")} under the filters${q ? ` matching "${q}"` : ""} - the largest first; a click on a heading sorts by it, a click on a row shows only that article`} />
  );
}

/** Every product under the filters, with its place in Products & Pricing - its own filter left out, the chosen ones marked. */
function ProductTable({ c }: { c: Ctx }) {
  const { cy, ly } = c.meta;
  const t = c.x.all.product;
  const share = (v: number) => (v > 0 && t.revCy > 0 ? pct(v / t.revCy) : "—");
  const cols: PCol<Bucket>[] = [
    { head: "Product", sort: "name", text: true, cell: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap title={r.name || undefined} sx={{ fontSize: "0.84rem", fontWeight: 600, color: isNone(r.key) ? FAINT : INK }}>{isNone(r.key) ? DIM.product.none : r.name || "—"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{isNone(r.key) ? "Articles Products & Pricing does not know" : r.key}</Typography>
      </Box>
    ) },
    { head: "Profit centre", sort: "pc", text: true, width: "150px", cell: (r) => (isNone(r.key) ? "" : textCell(pcName(r.pc ?? ""))) },
    { head: "Main group", sort: "group", text: true, width: "minmax(150px, 1fr)", cell: (r) => (isNone(r.key) ? "" : textCell(isNone(r.group ?? "") ? "—" : r.group ?? "", isNone(r.group ?? ""))) },
    { head: "Sub group", sort: "sub", text: true, width: "minmax(150px, 1fr)", cell: (r) => (isNone(r.key) ? "" : textCell(isNone(r.sub ?? "") ? "—" : r.sub ?? "", isNone(r.sub ?? ""))) },
    { head: "Revenue year to date", sort: "cy", cell: (r) => withChange(eur(r.cy), change(r.cy, r.lyYtd)) },
    { head: `Same days ${ly}`, sort: "lyYtd", cell: (r) => eur(r.lyYtd) },
    { head: "Change in €", sort: "delta", cell: (r) => diffCell(r.cy, r.lyYtd) },
    { head: "Share of revenue", sort: "cy", cell: (r) => share(r.cy) },
    { head: "Articles sold", sort: "articlesCy", cell: (r) => withChangeCell(int(r.articlesCy), r.articlesCy, r.articlesLyYtd) },
    { head: "New articles", sort: "fresh", cell: (r) => int(r.fresh) },
    { head: "Gone quiet", sort: "quiet", cell: (r) => int(r.quiet) },
    ...(c.meta.buyers ? [{ head: "Companies year to date", sort: "companiesCy", cell: (r: Bucket) => withChangeCell(int(r.companiesCy ?? 0), r.companiesCy ?? 0, r.companiesLyYtd ?? 0) }] : []),
    { head: `All of ${ly}`, sort: "ly", cell: (r) => eur(r.ly) },
  ];
  const totalRow: React.ReactNode[] = [
    "Total", "", "", "", withChange(eur(t.revCy), change(t.revCy, t.revLyYtd)), eur(t.revLyYtd), diffCell(t.revCy, t.revLyYtd), share(t.revCy),
    withChangeCell(int(t.articlesCy), t.articlesCy, t.articlesLyYtd), int(t.fresh), int(t.quiet),
    ...(c.meta.buyers ? [withChangeCell(int(t.companiesCy ?? 0), t.companiesCy ?? 0, t.companiesLyYtd ?? 0)] : []), eur(t.revLy),
  ];
  return (
    <PagedTable<Bucket> c={c} level="product" dim="product" title="All the figures, year to date, by product" find="Find a product - its number, name or group" cols={cols} idOf={(r) => r.key}
      minWidth={c.meta.buyers ? 1900 : 1780} totalRow={totalRow}
      hint={(n, q) => `${ytdWords(c.meta)} against ${ytdWords(c.meta, 1)} · ${n == null ? "the products" : plural(n, "product")}${q ? ` matching "${q}"` : ""} with the profit centre, main group and sub group Products & Pricing gives them - each one's revenue, articles sold, new and gone quiet${c.meta.buyers ? ", the companies that bought" : ""}, all of ${ly}; new: not sold at all in ${ly}, gone quiet: nothing yet in ${cy}`} />
  );
}

/* ── the tabs: one card that follows each ──────────────────────────────── */

const CARD = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
function TabCard({ c, view }: { c: Ctx; view: View }) {
  const m = c.meta;
  const against = `${ytdWords(m)} against ${ytdWords(m, 1)}`;
  if (view === "pc") return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="Articles by profit centre, year to date"
        note={`${against} · each profit centre's revenue and the articles it sold - a click shows only it`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        <Wrap c={c} dim="pc"><RevBoard c={c} dim="pc" /></Wrap>
        <Wrap c={c} dim="pc"><CountBoard c={c} dim="pc" /></Wrap>
      </Box>
      <Wrap c={c} dim="pc">
        <ChartBox title="All the figures, year to date, by profit centre" hint={`${against} · each profit centre's revenue with its change and share, its articles sold, new and gone quiet${m.buyers ? ", the companies that bought" : ""}, and all of ${m.ly}`}>
          <BucketTable c={c} dim="pc" />
        </ChartBox>
      </Wrap>
    </GlassCard>
  );
  if (view === "hierarchy") return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<AccountTreeOutlinedIcon />} tint="amber" title="Articles by product hierarchy, year to date"
        note={`${against} · Products & Pricing's main group, sub group and product - a click on one shows only it, and the levels under it follow`} />
      {!m.hierarchy ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.5 }}>
          This report was built before it read the product hierarchy. The next build reads every article&apos;s main group, sub group and product from Products &amp; Pricing - it starts by itself, or press Rebuild now.
        </Typography>
      ) : (
        <>
          <Box sx={{ ...TWO, mt: -1 }}>
            <Wrap c={c} dim="group"><RevBoard c={c} dim="group" /></Wrap>
            <Wrap c={c} dim="group"><CountBoard c={c} dim="group" /></Wrap>
          </Box>
          <Wrap c={c} dim="group">
            <ChartBox title="All the figures, year to date, by main group" hint={`${against} · each main group's revenue with its change and share, its articles sold, new and gone quiet${m.buyers ? ", the companies that bought" : ""}, and all of ${m.ly}`}>
              <BucketTable c={c} dim="group" />
            </ChartBox>
          </Wrap>
          <Box sx={TWO}>
            <Wrap c={c} dim="sub"><RevBoard c={c} dim="sub" /></Wrap>
            <Wrap c={c} dim="product"><RevBoard c={c} dim="product" /></Wrap>
          </Box>
          <ProductTable c={c} />
        </>
      )}
    </GlassCard>
  );
  return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<ListAltIcon />} tint="slate" title="Articles, year to date"
        note={`${against} · the articles growing and falling most, then every one - a click on one shows only it`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        <MoverBoard c={c} which="top" />
        <MoverBoard c={c} which="flop" />
      </Box>
      <ArticleList c={c} />
    </GlassCard>
  );
}

/* ── the figures top right (drawn as the ESO Figures' cards) ───────────── */

type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint };
function figuresOf(m: Meta, f: ArtFigures): Fig[] {
  const was = ytdWords(m, 1);
  return [
    { label: "Revenue year to date", value: eur(f.revCy), ch: changeOf(f.revCy, f.revLyYtd), sub: `${was}: ${eur(f.revLyYtd)}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { label: "Articles sold year to date", value: int(f.articlesCy), ch: changeOf(f.articlesCy, f.articlesLyYtd), sub: `With an order line · ${was}: ${int(f.articlesLyYtd)}`, icon: <Inventory2OutlinedIcon />, tint: "purple" },
    ...(f.companiesCy != null ? [{ label: "Companies that bought", value: int(f.companiesCy), ch: changeOf(f.companiesCy, f.companiesLyYtd ?? 0), sub: `Year to date · ${was}: ${int(f.companiesLyYtd ?? 0)}`, icon: <GroupsOutlinedIcon />, tint: "blue" as Tint }] : []),
    { label: "New articles", value: int(f.fresh), sub: `${eur(f.freshRev)} this year on articles not sold at all in ${m.ly}`, icon: <FiberNewOutlinedIcon />, tint: "green" },
    { label: "Gone quiet", value: int(f.quiet), sub: `${eur(f.quietRev)} by ${dm(m)} ${m.ly}, nothing yet this year`, icon: <BedtimeOutlinedIcon />, tint: "amber" },
  ];
}
function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(124px, 172px))", xl: `repeat(${items.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.value}</Typography>
            {it.ch !== undefined && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(it.ch ?? null) }}>{signedPct(it.ch ?? null)}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the Filters window ────────────────────────────────────────────────── */

/** A level's values to pick - the largest revenue first, a search past eight; each with its revenue year to date. */
function Facet({ c, now, dim, onPick }: { c: Ctx; now: AFilters; dim: "pc" | "group" | "sub"; onPick: (key: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const rows = c.x.by[dim].map((b) => ({ key: b.key, label: labelOf(dim, b.key, b.name), v: b.cy }));
  const sel = new Set(now[dim] ?? []);
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8, MOST = 100;
  const shown = (all || q ? found.slice(0, MOST) : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.has(r.key))]);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  const t = TINT[DIM[dim].tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].lower}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].lower} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      {shown.map((r) => {
        const on = sel.has(r.key);
        return (
          <Box key={r.key} component="button" type="button" onClick={() => onPick(r.key)} aria-pressed={on} title={`${r.label} - ${eur(r.v)} year to date`}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 56px 84px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{r.label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(Math.max(0, r.v) / max) * 100}%`, bgcolor: t.fg, opacity: 0.6 }} /></Box>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(r.v)}</Typography>
          </Box>
        );
      })}
      {(all || q) && found.length > MOST && <Typography sx={{ fontSize: "0.74rem", color: FAINT, px: 1 }}>The first {MOST} of {int(found.length)} - type more of the name to find the others.</Typography>}
      {!q && found.length > LIMIT && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${LIMIT}` : `Show all ${int(found.length)}`}</Button>}
    </Box>
  );
}

/** The products or articles to pick - too many to list: the chosen ones, then the eight largest under the other filters, or
 *  those a search finds (a number or words). */
function ServerFacet({ c, now, level, onPick }: { c: Ctx; now: AFilters; level: "product" | "article"; onPick: (key: string) => void }) {
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<{ key: string; label: string; v: number }[] | null>(null);
  const qs = filterQs(now, level);
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/uc/articles/rows?size=8${level === "product" ? "&level=product" : ""}${typed.trim() ? `&q=${encodeURIComponent(typed.trim())}` : ""}${qs}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j: { data?: { rows?: (ArticleLine | Bucket)[] } }) => setFound((j?.data?.rows ?? []).map((r) => ("article" in r
          ? { key: r.article, label: labelOf("article", r.article, r.description), v: r.revenueCy }
          : { key: r.key, label: labelOf("product", r.key, r.name), v: r.cy }))))
        .catch(() => {});
    }, typed ? 300 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [typed, qs, level]);
  const sel = now[level] ?? [];
  const t = TINT[DIM[level].tint];
  const named = level === "product" ? c.x.names.product : c.x.names.article;
  const row = (key: string, label: string, v: number | null, on: boolean) => (
    <Box key={key} component="button" type="button" onClick={() => onPick(key)} aria-pressed={on} title={label}
      sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 84px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
      {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
      <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v == null ? "" : eur(v)}</Typography>
    </Box>
  );
  const what = level === "product" ? "a product - its number, name or group" : "an article - its number or words of it";
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
        <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
        <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Find ${what}`} inputProps={{ "aria-label": `Find ${level === "product" ? "a product" : "an article"} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
      </Box>
      {sel.map((k) => row(k, labelOf(level, k, named[k]), null, true))}
      {(found ?? []).filter((r) => !sel.includes(r.key)).map((r) => row(r.key, r.label, r.v, false))}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, px: 1 }}>{typed.trim() ? "The eight largest that match, under the other filters" : "The eight largest under the other filters - type to find any other"}</Typography>
    </Box>
  );
}

function ArticleFilterWindow({ c, now, open, onClose, focus, toggle, clearAll }: {
  c: Ctx; now: AFilters; open: boolean; onClose: () => void; focus: { dim: ADim; n: number } | null; toggle: (d: ADim, key: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<ADim | "period", boolean>>>({});
  const isOpen = (k: ADim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "pc" || !!now[k]?.length);
  const flip = (k: ADim | "period") => setShut((s) => ({ ...s, [k]: isOpen(k) }));
  // drawn while open, and a moment after closing (its fold-away)
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`afilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const dims: ADim[] = c.meta.hierarchy ? ["pc", "group", "sub", "product", "article"] : ["pc", "article"];
  const chosen = ADIMS.flatMap((d) => (now[d] ?? []).map((k) => [d, k] as const));
  const summary = (d: ADim) => { const v = now[d] ?? []; return !v.length ? "All" : v.length === 1 ? labelOf(d, v[0], d === "product" ? c.x.names.product[v[0]] : d === "article" ? c.x.names.article[v[0]] : null) : `${v.length} chosen`; };
  return (
    <FilterPanel id="articles-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, k]) => (
        <Chip key={`${d}:${k}`} size="small" label={<span><b>{DIM[d].name}:</b> {labelOf(d, k, d === "product" ? c.x.names.product[k] : d === "article" ? c.x.names.article[k] : null)}</span>}
          onDelete={() => toggle(d, k)} sx={{ height: 26, maxWidth: "100%", fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />
      )) : null}>
      {live && (
        <>
          <FilterSection id="afilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary="Year to date">
            <Box sx={{ display: "grid", gap: 1 }}>
              <Box component="span" aria-pressed="true"
                sx={{ justifySelf: "start", display: "inline-flex", alignItems: "center", height: 30, px: 1.4, borderRadius: "9px", fontSize: "0.8rem", fontWeight: 650, bgcolor: TINT.blue.fg, color: "#fff", border: `1px solid ${TINT.blue.fg}` }}>
                Year to date · {ytdWords(c.meta)}
              </Box>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.5 }}>
                The only period of this report: each night it adds up every order from 1 January to the day against the same days of {c.meta.ly}, with all of {c.meta.ly} beside it. It keeps no months, so a quarter, a month or your own dates cannot be picked here.
              </Typography>
            </Box>
          </FilterSection>
          {dims.map((d, i) => (
            <FilterSection key={d} id={`afilter-${d}`} index={i + 1} title={DIM[d].name} icon={DIM[d].icon} tint={DIM[d].tint} open={isOpen(d)} onFlip={() => flip(d)}
              summary={summary(d)} chosen={!!now[d]?.length}>
              {d === "article" || d === "product" ? <ServerFacet c={c} now={now} level={d} onPick={(k) => toggle(d, k)} /> : <Facet c={c} now={now} dim={d} onPick={(k) => toggle(d, k)} />}
            </FilterSection>
          ))}
        </>
      )}
    </FilterPanel>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

export function ArticlesExplorer() {
  const params = useSearchParams();
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "pc") q.delete("view"); else q.set("view", v); });
  const filters: AFilters = useMemo(() => Object.fromEntries(ADIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = useCallback((d: ADim, key: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    q.delete(d);
    for (const x of next) q.append(d, x);
  }), []);
  const clearAll = useCallback(() => setQuery((q) => { for (const d of ADIMS) q.delete(d); }), []);
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: ADim; n: number } | null>(null);
  const openOn = useCallback((d: ADim) => { setFocus((f) => ({ dim: d, n: (f?.n ?? 0) + 1 })); setPanel(true); }, []);

  // the tabs of before were in the address's hash (#movers, #profit-centres, #articles) - a bookmark still lands
  useEffect(() => {
    const h = window.location.hash;
    const v: View | null = h === "#profit-centres" ? "pc" : h === "#articles" || h === "#movers" ? "articles" : null;
    if (!v) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setView(v);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tick, setTick] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [buildNote, setBuildNote] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me/access").then((r) => (r.ok ? r.json() : null)).then((j) => setRole(j?.role ?? null)).catch(() => {});
  }, []);

  const qs = filterQs(filters);
  const url = `/api/uc/articles?n=${tick}${qs}`;
  const held = useHeld<Summary>(url, [url]);
  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  const meta = data?.report ?? null;
  const st = data?.status;
  const running = st?.status === "running";

  // while a build runs, look again every few seconds
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [running, tick]);

  const rebuild = useCallback(async () => {
    setBuildNote(null);
    const j = await fetch("/api/uc/articles/build", { method: "POST" }).then((y) => y.json()).catch(() => null);
    setBuildNote(j?.ok ? j.data.note : j?.error ?? "The build could not be started.");
    setTick((n) => n + 1);
  }, []);

  // what was drawn last stays while the next answer comes (a filter clicked): the figures dim, nothing jumps - each answer
  // with the filters it is of
  const lastGood = useRef<Summary | null>(null);
  if (data?.report && data.explore) lastGood.current = data;
  const shown = lastGood.current;
  const c = useMemo<Ctx | null>(() => (shown?.report && shown.explore ? {
    meta: shown.report, x: shown.explore, filters: shown.filters ?? {}, onPick: toggle, onFilter: openOn, companies: companiesFor(shown.report, shown.filters ?? {}),
  } : null), [shown, toggle, openOn]);
  const figs = useMemo(() => (c ? figuresOf(c.meta, c.x.figures) : []), [c]);
  const stale = held.stale || r === null;

  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  const title = <Typography component="h1" sx={H1}>Articles CY/LY</Typography>;
  const progress = running && st ? (
    <GlassCard sx={{ py: 1.75 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, mb: 1 }}>
        Building the report - {st.step}{st.total ? ` (${int(st.done)} of ${int(st.total)})` : ""}
      </Typography>
      <LinearProgress variant={st.total ? "determinate" : "indeterminate"} value={st.total ? (100 * st.done) / st.total : undefined} sx={{ height: 8, borderRadius: 99, bgcolor: TRACK }} />
    </GlassCard>
  ) : null;
  const rebuildButton = role === "admin" ? (
    <Tooltip title="Rebuild from HubSpot now - it also rebuilds by itself every morning">
      <span>
        <Button variant="outlined" startIcon={<RefreshIcon />} disabled={running} onClick={rebuild}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2, height: 44, whiteSpace: "nowrap", bgcolor: "#fff" }}>
          {running ? "Building…" : meta ? "Rebuild" : "Build"}
        </Button>
      </span>
    </Tooltip>
  ) : (
    <Tooltip title="Read again">
      <IconButton onClick={() => setTick((n) => n + 1)} aria-label="Read again" sx={{ width: 44, height: 44, border: "1px solid rgba(21,34,58,.16)", borderRadius: "12px", bgcolor: "#fff" }}><RefreshIcon sx={{ fontSize: 20, color: MUTED }} /></IconButton>
    </Tooltip>
  );

  if (r === null && !c) return <Box sx={shell}>{title}<LoadingPanel label="Reading the article report…" /></Box>;
  if (r?.state === "not-configured") return <Box sx={shell}>{title}<NotConnectedPanel source="HubSpot" missing={r.missing} /></Box>;
  if (r?.state === "error" && !c) return <Box sx={shell}>{title}<UpstreamPanel source="Article report" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} /></Box>;
  if (!c) {
    return (
      <Box sx={shell}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>{title}<Box sx={{ flex: 1 }} />{rebuildButton}</Box>
        {progress}
        {st?.status === "error" && <Notice tone="bad">The last build failed: {st.error}</Notice>}
        {buildNote && <Notice tone="warn">{buildNote}</Notice>}
        {!running && (
          <GlassCard>
            <CardTitle icon={<ListAltIcon />} title="Not built yet"
              note={role === "admin" ? "Build it now, or it builds by itself after the next nightly order load." : "It builds by itself after the next nightly order load."} />
          </GlassCard>
        )}
      </Box>
    );
  }

  const m = c.meta;
  const chosen = ADIMS.flatMap((d) => (filters[d] ?? []).map((k) => [d, k] as const));
  const exportQs = qs;
  return (
    <Box sx={shell}>
      {/* the title and what is shown on the left; the figures top right - as the ESO Figures */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          {title}
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            Every article · year to date <b style={{ color: INK }}>{ytdWords(m)}</b> - against {ytdWords(m, 1)} · each order counted once{stale ? " · reading" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards items={figs} /></Box>
      </Box>
      {progress}
      {st?.status === "error" && <Notice tone="bad">The last build failed, so this is the one before it: {st.error}</Notice>}
      {buildNote && <Notice tone="warn">{buildNote}</Notice>}

      {/* the tabs, and at their right end the file, the rebuild and the Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="articles" tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => { const n = v.dims.reduce((s, d) => s + (filters[d]?.length ?? 0), 0); return { id: v.id, label: v.label, count: n ? String(n) : null }; })} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={(e) => setMenu(e.currentTarget)}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2, height: 44, whiteSpace: "nowrap", bgcolor: "#fff" }}>Export</Button>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          <MenuItem component="a" href={`/api/uc/articles/export?x=1${exportQs}`} onClick={() => setMenu(null)}>Excel - summary and every article</MenuItem>
          <MenuItem component="a" href={`/api/uc/articles/export?movers=1${exportQs}`} onClick={() => setMenu(null)}>Excel - top and flop 20</MenuItem>
          <MenuItem component="a" href={`/api/uc/articles/export?format=csv${exportQs}`} onClick={() => setMenu(null)}>CSV - every article</MenuItem>
        </Menu>
        {rebuildButton}
        <Button onClick={() => { if (panel) setPanel(false); else openOn(FOCUS[view]); }} variant={panel || chosen.length ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="articles-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length ? undefined : "#fff" }}>
          Filters{chosen.length ? ` · ${chosen.length}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs - as the ESO reports (SARCLA 31.10.2026) */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={chosen.map(([d, k]): ActiveItem => ({
        key: `${d}:${k}`, name: DIM[d].name, value: labelOf(d, k, d === "product" ? c.x.names.product[k] : d === "article" ? c.x.names.article[k] : null), tint: DIM[d].tint, onRemove: () => toggle(d, k),
      }))} />

      <Box id={`articles-panel-${view}`} role="tabpanel" sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCard c={c} view={view} />
      </Box>

      <ArticleFilterWindow c={c} now={filters} open={panel} onClose={() => setPanel(false)} focus={focus} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}
