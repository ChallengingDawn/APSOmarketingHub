"use client";
// PRODUCTS REPORTS - AVAILABILITY, PRICE CHECKS, MINIMUM ORDER (SARCLA 01.11.2026: "articles CY/LY is ok ... but we should
// have much more, for example availability check on the shop where we didn't have stock and stuff like that - we should
// really create subtabs"; asked which: "all by sub app"). One page each, drawn here alike:
//
//   /reporting/products/availability    the shelf could not serve the quantity asked for - nothing on it, or less
//   /reporting/products/price-checks    an article priced on the product page and left without an order
//   /reporting/products/minimum-order   a quantity under the article's minimum order quantity
//
// Drawn as Articles CY/LY and the ESO Figures (the figures top right; a tab per breakdown - article, profit centre, product
// hierarchy, country, company - each one card that follows it; the Filters window with the period, what the page is
// filtered by under the tabs, Clear all; on every graph its own "Filter by …" and the companies behind it; the lists
// sortable, searchable, 25 a page). No Actions and no BUC View (SARCLA: "no actions are needed here because no BUC view").
//
// The read is the Datatracker's one scan, kept by the hub (src/lib/productSignals/read.ts); the counting is in
// src/lib/productSignals/model.ts - a few thousand small rows, worked out here in the browser as the ESO Shop behaviour does.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputBase from "@mui/material/InputBase";
import LinearProgress from "@mui/material/LinearProgress";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ProductionQuantityLimitsOutlinedIcon from "@mui/icons-material/ProductionQuantityLimitsOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import LowPriorityOutlinedIcon from "@mui/icons-material/LowPriorityOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, Notice, RED, TINT, TRACK, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { Pager, Table, usePaged, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { CardFilterFor, ChartBox, FullTable, H1, Leaderboard, TWO, setQuery, type BoardRow, type CardFilter, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, PeriodPicker, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { pcLabel } from "@/app/reporting/eso-benchmark/shared";
import { CompaniesFor, type CompanyItem, type CompanySource } from "@/app/reporting/CompanyList";
import type { SlowState } from "@/lib/integrations/slowReport";
import {
  AR, CO, FDIMS, LK, articleExtremes, companiesOf, dayWords, groupBy, looksOf, periodById, periodsOf, prevWin, rangeWords, statsOf,
  type FDim, type KindData, type SFilters, type SLook, type SPeriod, type SStats, type SignalKind, type Win,
} from "@/lib/productSignals/model";

/* ── words and numbers, in full ────────────────────────────────────────── */

const int = (n: number) => Math.round(n).toLocaleString("en");
const signedInt = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
// more looks at an empty shelf is not good news: on these pages a rise reads red
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? RED : GREEN);
const plural = (n: number, one: string, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;
/** A quantity in its sales unit, decimals kept where the article is sold by the metre or the kilo. */
const qtyWords = (n: number | null, unit: string) => (n == null ? "—" : `${n.toLocaleString("en", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`);
const dayNum = (iso: string) => (iso ? Date.parse(`${iso}T00:00:00Z`) : 0);

/* ── the three pages ───────────────────────────────────────────────────── */

type KindWords = {
  title: string; path: string;
  /** what a look is on this page, the line under the title */
  line: string;
  /** the count of looks: the first figure, the first column */
  measure: string; lower: string; one: string;
  icon: React.ReactNode; tint: Tint;
};
const KIND: Record<SignalKind, KindWords> = {
  availability: {
    title: "Availability", path: "/reporting/products/availability",
    line: "Articles customers wanted that the shelf could not serve - nothing on it, or less than they asked for",
    measure: "Times asked", lower: "times asked", one: "time asked", icon: <ProductionQuantityLimitsOutlinedIcon />, tint: "amber",
  },
  price: {
    title: "Price checks", path: "/reporting/products/price-checks",
    line: "Articles customers priced on the product page - a quantity typed - and left without an order",
    measure: "Prices checked", lower: "prices checked", one: "price checked", icon: <SellOutlinedIcon />, tint: "purple",
  },
  moq: {
    title: "Minimum order", path: "/reporting/products/minimum-order",
    line: "Customers who asked for fewer than we sell - a quantity under the article's minimum order quantity",
    measure: "Asked below the minimum", lower: "times asked below the minimum", one: "time asked below the minimum", icon: <LowPriorityOutlinedIcon />, tint: "blue",
  },
};

/* ── the read ──────────────────────────────────────────────────────────── */

function useSignals(kind: SignalKind): { d: KindData | null; computing: boolean; progress?: string; error?: string; retry: () => void } {
  const [st, setSt] = useState<{ state?: SlowState<KindData>; error?: string } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch(`/api/reporting/product-signals?kind=${kind}`).then((r) => r.json())
      .then((j: { state?: SlowState<KindData>; error?: string }) => {
        if (!alive) return;
        // the same read again (the window back in view, the ten-minute look) keeps what is drawn
        setSt((was) => (was?.state?.value && j.state?.value && was.state.value.generatedAt === j.state.value.generatedAt && !!was.state.computing === !!j.state.computing ? was : j));
        timer = j.state?.computing ? setTimeout(() => { timer = undefined; load(); }, 5000) : undefined;
      })
      .catch((e) => { if (alive) setSt((s) => ({ ...(s ?? {}), error: String((e as Error)?.message ?? e) })); });
    load();
    const stop = everyWhileSeen(() => { if (!timer) load(); });
    return () => { alive = false; stop(); if (timer) clearTimeout(timer); };
  }, [kind, tick]);
  return { d: st?.state?.value ?? null, computing: !!st?.state?.computing || st === null, progress: st?.state?.progress, error: st?.error ?? st?.state?.error, retry: () => setTick((n) => n + 1) };
}

/* ── the breakdowns ────────────────────────────────────────────────────── */

const DIM: Record<FDim, { name: string; lower: string; tint: Tint; icon: React.ReactNode; none: string }> = {
  article: { name: "Article", lower: "article", tint: "slate", icon: <ListAltIcon />, none: "No article" },
  pc: { name: "Profit centre", lower: "profit centre", tint: "purple", icon: <CategoryOutlinedIcon />, none: "No profit centre" },
  group: { name: "Main group", lower: "main group", tint: "amber", icon: <AccountTreeOutlinedIcon />, none: "No main group" },
  sub: { name: "Sub group", lower: "sub group", tint: "amber", icon: <AccountTreeOutlinedIcon />, none: "No sub group" },
  product: { name: "Product", lower: "product", tint: "green", icon: <Inventory2OutlinedIcon />, none: "No product" },
  country: { name: "Country", lower: "country", tint: "blue", icon: <PublicOutlinedIcon />, none: "No country" },
  company: { name: "Company", lower: "company", tint: "blue", icon: <ApartmentOutlinedIcon />, none: "No company" },
};

type View = "article" | "pc" | "hierarchy" | "country" | "company";
const VIEWS: { id: View; label: string; dims: FDim[] }[] = [
  { id: "article", label: "Article", dims: ["article"] },
  { id: "pc", label: "Profit centre", dims: ["pc"] },
  { id: "hierarchy", label: "Product hierarchy", dims: ["group", "sub", "product"] },
  { id: "country", label: "Country", dims: ["country"] },
  { id: "company", label: "Company", dims: ["company"] },
];
const viewOf = (x: string | null): View => (VIEWS.some((v) => v.id === x) ? (x as View) : "article");
/** The breakdown a tab's Filters button opens on. */
const FOCUS: Record<View, FDim> = { article: "article", pc: "pc", hierarchy: "group", country: "country", company: "company" };

/** Names for the values the looks carry: an article's and a product's, a company's - by their number. */
type Names = { article: Map<string, string>; product: Map<string, string>; company: Map<string, string>; unit: Map<string, string>; minimum: Map<string, number | null>; stock: Map<string, number | null>; pc: Map<string, string> };
function namesOf(d: KindData): Names {
  const n: Names = { article: new Map(), product: new Map(), company: new Map(), unit: new Map(), minimum: new Map(), stock: new Map(), pc: new Map() };
  for (const a of d.articles) {
    n.article.set(a[AR.number], a[AR.description]);
    n.pc.set(a[AR.number], a[AR.pc]);
    if (a[AR.product] && a[AR.productName]) n.product.set(a[AR.product], a[AR.productName]);
    n.unit.set(a[AR.number], a[AR.unit]);
    n.minimum.set(a[AR.number], a[AR.minimum]);
    n.stock.set(a[AR.number], a[AR.stock]);
  }
  // two companies of one name (HubSpot has them) keep their customer number beside it: a table knows a row by its name
  const many = new Map<string, number>();
  for (const c of d.companies) many.set(c[CO.name], (many.get(c[CO.name]) ?? 0) + 1);
  for (const c of d.companies) n.company.set(c[CO.id], (many.get(c[CO.name]) ?? 0) > 1 ? `${c[CO.name]} · ${c[CO.un] || c[CO.id]}` : c[CO.name]);
  return n;
}
/** A value as the page shows it: a profit centre by its name; an article and a product by their name, then their number. */
function labelOf(names: Names, dim: FDim, key: string): string {
  if (!key) return DIM[dim].none;
  if (dim === "pc") return pcLabel(key.toLowerCase());
  if (dim === "article" || dim === "product") { const n = names[dim].get(key); return n ? `${n} · ${key}` : key; }
  if (dim === "company") return names.company.get(key) ?? key;
  return key;
}

/* ── what every graph is drawn with ────────────────────────────────────── */

type Ctx = {
  kind: SignalKind; w: KindWords; d: KindData; names: Names;
  per: SPeriod; prev: Win | null; filters: SFilters;
  onPick: (dim: FDim, key: string) => void;
  onFilter: (dim: FDim) => void;
};
const periodLine = (c: Ctx) => rangeWords(c.per.win.from, c.per.win.to);
const prevLine = (c: Ctx) => (c.prev ? rangeWords(c.prev.from, c.prev.to) : "");

/** The companies behind a set of looks (CompanyList.tsx): the most looks first, every one on the list. */
function companiesFor(c: Ctx, looks: SLook[], what: string): CompanySource {
  const lines = companiesOf(c.d, looks);
  const extra = c.kind === "availability" ? "Nothing on the shelf" : c.kind === "price" ? "On a ticket" : "Asked, on average, of the minimum";
  return {
    key: `${c.kind}|${c.d.generatedAt}|${c.per.id}|${JSON.stringify(c.filters)}|${what}|${looks.length}`,
    head: [c.w.measure, "Articles", "Last asked", extra, "Ordered later", "Customer number", "Country"], left: [6, 7],
    note: `${periodLine(c)} · ${what} - the most ${c.w.lower} first; ordered later: the same article, a later day, in the shop`,
    rows: () => lines.map((x): CompanyItem => {
      const co = c.d.companies[x.co], s = x.stats;
      const ex = c.kind === "availability" ? s.empty : c.kind === "price" ? s.ticket : s.shareN ? s.shareSum / s.shareN : null;
      return {
        id: co[CO.id] || null, name: co[CO.name],
        cells: [int(s.looks), int(s.articles), s.last ? dayWords(s.last) : "—", c.kind === "moq" ? pct(ex) : int(ex ?? 0), int(s.later), co[CO.un] || "—", co[CO.country] || "—"],
        values: [s.looks, s.articles, s.last || null, ex, s.later, co[CO.un] || null, co[CO.country] || null],
      };
    }),
  };
}

/** A graph's filter and its companies, around it: the page's filters opened on a breakdown; the companies of `looks`. */
function Wrap({ c, dim, looks, what, children }: { c: Ctx; dim: FDim; looks: SLook[]; what: string; children: React.ReactNode }) {
  const filter: CardFilter = { open: () => c.onFilter(dim), label: `Filter by ${DIM[dim].lower}`, on: !!c.filters[dim]?.length };
  return <CompaniesFor source={companiesFor(c, looks, what)}><CardFilterFor filter={filter}>{children}</CardFilterFor></CompaniesFor>;
}

/** The chosen values of a breakdown, as its graphs label them. */
const chosenLabels = (c: Ctx, dim: FDim) => (c.filters[dim] ?? []).map((k) => labelOf(c.names, dim, k));

/** A breakdown's figures this period and the one before - its own filter left out, so every value shows and the chosen are marked. */
function useSplit(c: Ctx, dim: FDim) {
  return useMemo(() => {
    const now = looksOf(c.d, c.per.win, c.filters, dim);
    const before = c.prev ? looksOf(c.d, c.prev, c.filters, dim) : [];
    const cur = groupBy(c.d, now, dim), prev = groupBy(c.d, before, dim);
    const rows = [...cur.entries()].map(([key, ls]) => ({ key, label: labelOf(c.names, dim, key), looks: ls, s: statsOf(c.d, ls), p: statsOf(c.d, prev.get(key) ?? []) }));
    return { rows, total: statsOf(c.d, now), totalPrev: statsOf(c.d, before), now };
  }, [c, dim]);
}

/** A breakdown ranked by the looks, or by the companies (articles, on the Company tab) - each against the days before. */
function CountBoard({ c, dim, by }: { c: Ctx; dim: FDim; by: "looks" | "companies" | "articles" }) {
  const sp = useSplit(c, dim);
  const back = new Map<string, string>();
  const rows: BoardRow[] = sp.rows.filter((r) => r.key).map((r) => {
    back.set(r.label, r.key);
    const sub = by === "looks"
      // a value's own unit left out: an article is one article, a company one company
      ? [dim === "company" ? "" : plural(r.s.companies, "company", "companies"), dim === "article" ? "" : plural(r.s.articles, "article"), c.kind === "availability" ? `${int(r.s.empty)} nothing on the shelf` : ""].filter(Boolean).join(" · ")
      : `${int(r.s.looks)} ${r.s.looks === 1 ? c.w.one : c.w.lower}`;
    return { label: r.label, cur: r.s[by], prev: r.p[by], sub };
  });
  const none = sp.rows.find((r) => !r.key);
  const what = by === "looks" ? c.w.measure : by === "companies" ? "Companies" : "Articles";
  return (
    <Leaderboard key={`${by}-${dim}`} title={`${what}, by ${DIM[dim].lower}`} rows={rows} curLabel={periodLine(c)} prevLabel={c.prev ? prevLine(c) : ""}
      first={12} fmt={int} diff={signedInt} noChange={!c.prev} lowerIsBetter
      summary={none ? <span style={{ fontWeight: 500, color: MUTED }}>{DIM[dim].none}: {int(none.s[by])} - in the table</span> : undefined}
      selected={chosenLabels(c, dim)} onPick={(l) => c.onPick(dim, back.get(l) ?? l)} onFilter={() => c.onFilter(dim)} filterLabel={`Filter by ${DIM[dim].lower}`}
      companies={companiesFor(c, sp.now, `the companies behind ${what.toLowerCase()} by ${DIM[dim].lower}`)} />
  );
}

/** A figure with its change under it, right-aligned - as Articles CY/LY's tables. */
const withChangeCell = (text: string, a: number, b: number | null) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {text}
    {b != null && <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: b ? tone(changeOf(a, b)) : a > 0 ? RED : FAINT }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</Box>}
  </Box>
);
const textCell = (v: string, faint = false) => <Typography noWrap title={v} sx={{ fontSize: "0.82rem", color: faint ? FAINT : INK, maxWidth: 220 }}>{v}</Typography>;

type BRow = { label: string; key: string; s: SStats; p: SStats };
/** The columns every breakdown's table has, and those of the page. */
function figureCols(c: Ctx, sumLooks: number, dim: FDim): Col<BRow>[] {
  const cols: Col<BRow>[] = [
    { key: "looks", head: c.w.measure, tip: c.prev ? `${periodLine(c)} - under it the change against ${prevLine(c)}` : periodLine(c), cell: (r) => withChangeCell(int(r.s.looks), r.s.looks, c.prev ? r.p.looks : null), sort: (r) => r.s.looks },
    { key: "share", head: "Share", tip: `This row's part of the ${c.w.lower} in the table`, cell: (r) => (sumLooks ? pct(r.s.looks / sumLooks) : "—"), sort: (r) => r.s.looks },
    // an article's row is one article, a company's one company - those columns would read 1 all the way down
    ...(dim === "article" ? [] : [{ key: "articles", head: "Articles", cell: (r: BRow) => int(r.s.articles), sort: (r: BRow) => r.s.articles }]),
    ...(dim === "company" ? [] : [{ key: "companies", head: "Companies", cell: (r: BRow) => int(r.s.companies), sort: (r: BRow) => r.s.companies }]),
  ];
  if (c.kind === "availability") cols.push(
    { key: "empty", head: "Nothing on the shelf", tip: "The stock was 0", cell: (r) => int(r.s.empty), sort: (r) => r.s.empty },
    { key: "less", head: "Less than asked", tip: "Some on the shelf, fewer than the quantity typed", cell: (r) => int(r.s.less), sort: (r) => r.s.less },
  );
  if (c.kind === "price") cols.push({ key: "ticket", head: "On a ticket", tip: "Priced on a day that got a price-check ticket (UC17: KT and DT, three articles a day)", cell: (r) => int(r.s.ticket), sort: (r) => r.s.ticket });
  if (c.kind === "moq") cols.push({ key: "share-min", head: "Asked, on average, of the minimum", tip: "The quantity typed as a part of the article's minimum order quantity, on average", cell: (r) => (r.s.shareN ? pct(r.s.shareSum / r.s.shareN) : "—"), sort: (r) => (r.s.shareN ? r.s.shareSum / r.s.shareN : -1) });
  cols.push(
    { key: "later", head: "Ordered later", tip: "The same company ordered the same article on a later day, in the shop", cell: (r) => int(r.s.later), sort: (r) => r.s.later },
    { key: "last", head: "Last asked", cell: (r) => (r.s.last ? dayWords(r.s.last) : "—"), sort: (r) => dayNum(r.s.last) },
  );
  return cols;
}

/** All the figures of a breakdown: a row each, the chosen marked; a click on a row shows only it. */
function BucketTable({ c, dim }: { c: Ctx; dim: FDim }) {
  const sp = useSplit(c, dim);
  const back = new Map<string, string>();
  const rows: BRow[] = sp.rows.map((r) => { back.set(r.label, r.key); return { label: r.label, key: r.key, s: r.s, p: r.p }; });
  const total: BRow = { label: "Total", key: "", s: sp.total, p: sp.totalPrev };
  return <FullTable key={`table-${dim}`} first={DIM[dim].name} cols={figureCols(c, sp.total.looks, dim)} initial="looks" rows={rows} total={total} selected={chosenLabels(c, dim)}
    tint={DIM[dim].tint} onPick={(l) => c.onPick(dim, back.get(l) ?? l)} find={dim === "company" ? "a company" : `a ${DIM[dim].lower}`} />;
}

/** Every article, as Articles CY/LY lists them: its description over its number and profit centre (a long name on one line
 *  pushed the figures out of the card), its quantities in its own sales unit - never added up across articles (pieces,
 *  metres and kilos do not add); a search, the headings sort, 25 a page, a row clicked shows only that article. */
type ARow = { key: string; s: SStats; p: SStats; ext: ReturnType<typeof articleExtremes> };
type ACol = { head: string; text?: boolean; width?: string; cell: (r: ARow) => React.ReactNode; sort: (r: ARow) => string | number | null; total?: (s: SStats, p: SStats) => React.ReactNode };
function ArticleTable({ c }: { c: Ctx }) {
  const sp = useSplit(c, "article");
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim().toLowerCase()), 250); return () => clearTimeout(t); }, [typed]);
  const qty = (r: ARow, n: number | null | undefined) => qtyWords(n ?? null, c.names.unit.get(r.key) ?? "");
  const minShare = (r: ARow) => (r.s.shareN ? r.s.shareSum / r.s.shareN : null);
  const cols: ACol[] = [
    { head: "Article", text: true, cell: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap title={c.names.article.get(r.key) || r.key} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{c.names.article.get(r.key) || "—"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{r.key} · {labelOf(c.names, "pc", c.names.pc.get(r.key) ?? "")}</Typography>
      </Box>
    ), sort: (r) => c.names.article.get(r.key) || r.key },
    ...(c.kind === "availability" ? [
      { head: "In stock now", cell: (r: ARow) => qty(r, c.names.stock.get(r.key)), sort: (r: ARow) => c.names.stock.get(r.key) ?? null },
      { head: "Largest quantity asked", cell: (r: ARow) => qty(r, r.ext.maxQty), sort: (r: ARow) => r.ext.maxQty },
      { head: "Short by, at most", cell: (r: ARow) => qty(r, r.ext.maxShort), sort: (r: ARow) => r.ext.maxShort },
    ] : []),
    ...(c.kind === "price" ? [{ head: "Largest quantity asked", cell: (r: ARow) => qty(r, r.ext.maxQty), sort: (r: ARow) => r.ext.maxQty }] : []),
    ...(c.kind === "moq" ? [
      { head: "Minimum", cell: (r: ARow) => qty(r, c.names.minimum.get(r.key)), sort: (r: ARow) => c.names.minimum.get(r.key) ?? null },
      { head: "Smallest quantity asked", cell: (r: ARow) => qty(r, r.ext.minQty), sort: (r: ARow) => r.ext.minQty },
      { head: "Of the minimum, on average", cell: (r: ARow) => pct(minShare(r)), sort: minShare, total: (s: SStats) => pct(s.shareN ? s.shareSum / s.shareN : null) },
    ] : []),
    { head: c.w.measure, cell: (r) => withChangeCell(int(r.s.looks), r.s.looks, c.prev ? r.p.looks : null), sort: (r) => r.s.looks, total: (s, p) => withChangeCell(int(s.looks), s.looks, c.prev ? p.looks : null) },
    { head: "Companies", cell: (r) => int(r.s.companies), sort: (r) => r.s.companies, total: (s) => int(s.companies) },
    ...(c.kind === "availability" ? [
      { head: "Nothing on the shelf", cell: (r: ARow) => int(r.s.empty), sort: (r: ARow) => r.s.empty, total: (s: SStats) => int(s.empty) },
      { head: "Less than asked", cell: (r: ARow) => int(r.s.less), sort: (r: ARow) => r.s.less, total: (s: SStats) => int(s.less) },
    ] : []),
    ...(c.kind === "price" ? [{ head: "On a ticket", cell: (r: ARow) => int(r.s.ticket), sort: (r: ARow) => r.s.ticket, total: (s: SStats) => int(s.ticket) }] : []),
    { head: "Ordered later", cell: (r) => int(r.s.later), sort: (r) => r.s.later, total: (s) => int(s.later) },
    { head: "Last asked", width: "116px", cell: (r) => (r.s.last ? dayWords(r.s.last) : "—"), sort: (r) => r.s.last || null, total: (s) => (s.last ? dayWords(s.last) : "—") },
  ];
  const all = useMemo(() => sp.rows.map((r): ARow => ({ key: r.key, s: r.s, p: r.p, ext: articleExtremes(r.looks) })), [sp]);
  const found = useMemo(() => {
    const hit = q ? all.filter((r) => `${r.key} ${c.names.article.get(r.key) ?? ""}`.toLowerCase().includes(q)) : all;
    const base = [...hit].sort((a, b) => b.s.looks - a.s.looks || b.s.last.localeCompare(a.s.last) || a.key.localeCompare(b.key));
    const by = sort ? cols[sort.col] : null;
    if (!by) return base;
    const dir = sort!.desc ? -1 : 1;
    return base.map((r, i) => ({ r, i, v: by.sort(r) })).sort((a, b) => {
      if (a.v == null || b.v == null) return a.v == null ? (b.v == null ? a.i - b.i : 1) : -1;
      const x = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), "en", { sensitivity: "base", numeric: true });
      return dir * x || a.i - b.i;
    }).map((x) => x.r);
  }, [all, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(found, 25);
  useEffect(() => { paged.setPage(0); }, [q, sort, all]); // eslint-disable-line react-hooks/exhaustive-deps
  const onSort = (i: number) => setSort((x) => (x?.col === i ? { col: i, desc: !x.desc } : { col: i, desc: !cols[i].text }));
  const chosen = new Set(c.filters.article ?? []);
  const rows: { key: string; cells: React.ReactNode[]; strong?: boolean; on?: boolean; onPick?: () => void }[] =
    paged.shown.map((r) => ({ key: r.key, on: chosen.has(r.key), onPick: () => c.onPick("article", r.key), cells: cols.map((x) => x.cell(r)) }));
  // the Total under each page - none while a search narrows the list
  if (!q && rows.length) rows.push({ key: " total", strong: true, cells: cols.map((x, i) => (i === 0 ? "Total" : x.total ? x.total(sp.total, sp.totalPrev) : "")) });
  return (
    <Wrap c={c} dim="article" looks={sp.now} what="the companies behind the figures by article">
      <ChartBox title="All the figures, by article" hint={`${periodLine(c)}${c.prev ? ` against ${prevLine(c)}` : ""} · ${plural(found.length, "article")}${q ? ` matching "${typed.trim()}"` : ""} - ${tableHint(c)}; quantities in the article's sales unit - a click on a heading sorts by it, a click on a row shows only it`}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: "1 1 220px", maxWidth: 360, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
            <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
            <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find an article - its number or words of it" inputProps={{ "aria-label": "Find an article" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Pager p={paged} />
        </Box>
        {!found.length ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{q ? "No article matches that search under these filters." : "No article under these filters in this period."}</Typography> : (
          <>
            <Table head={cols.map((x) => x.head)} left={[]} sortable={cols.map((_, i) => i)} sort={sort} onSort={onSort}
              firstWidth="minmax(240px, 2.2fr)" widths={cols.slice(1).map((x) => x.width ?? "minmax(88px, 1fr)")} minWidth={240 + (cols.length - 1) * 92} rows={rows} />
            {paged.pages > 1 && <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}><Pager p={paged} /></Box>}
          </>
        )}
      </ChartBox>
    </Wrap>
  );
}

/** One breakdown's card: the two boards, then all its figures. */
function Breakdown({ c, dim, second = "companies" }: { c: Ctx; dim: FDim; second?: "companies" | "articles" }) {
  const sp = useSplit(c, dim);
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <CountBoard c={c} dim={dim} by="looks" />
        <CountBoard c={c} dim={dim} by={second} />
      </Box>
      {dim === "article" ? <ArticleTable c={c} /> : (
        <Wrap c={c} dim={dim} looks={sp.now} what={`the companies behind the figures by ${DIM[dim].lower}`}>
          <ChartBox title={`All the figures, by ${DIM[dim].lower}`} hint={`${periodLine(c)}${c.prev ? ` against ${prevLine(c)}` : ""} · ${tableHint(c)} - a click on a heading sorts by it, a click on a row shows only it`}>
            <BucketTable c={c} dim={dim} />
          </ChartBox>
        </Wrap>
      )}
    </>
  );
}
const tableHint = (c: Ctx) => (c.kind === "availability" ? "each one's times asked, nothing on the shelf or less than asked, its articles and companies"
  : c.kind === "price" ? "each one's prices checked, those on a ticket, its articles and companies"
  : "each one's times asked below the minimum, how far below on average, its articles and companies");

/* ── every look, one company, one article, one day ─────────────────────── */

type LCol = { head: string; text?: boolean; width?: string; cell: (l: SLook) => React.ReactNode; sort: (l: SLook) => string | number | null };
function LookList({ c }: { c: Ctx }) {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim().toLowerCase()), 250); return () => clearTimeout(t); }, [typed]);
  const all = useMemo(() => looksOf(c.d, c.per.win, c.filters), [c]);
  const art = (l: SLook) => c.d.articles[l[LK.article]];
  const co = (l: SLook) => c.d.companies[l[LK.company]];
  const unit = (l: SLook) => art(l)[AR.unit];
  const cols: LCol[] = [
    { head: "Company", text: true, cell: (l) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap title={co(l)[CO.name]} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{co(l)[CO.name]}</Typography>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{[co(l)[CO.un], co(l)[CO.country]].filter(Boolean).join(" · ") || "—"}</Typography>
      </Box>
    ), sort: (l) => co(l)[CO.name] },
    { head: "Day", width: "110px", cell: (l) => dayWords(l[LK.day]), sort: (l) => l[LK.day] },
    { head: "Article", text: true, width: "minmax(220px, 2fr)", cell: (l) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap title={art(l)[AR.description]} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{art(l)[AR.description] || "—"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{art(l)[AR.number]} · {labelOf(c.names, "pc", art(l)[AR.pc])}</Typography>
      </Box>
    ), sort: (l) => art(l)[AR.description] || art(l)[AR.number] },
    { head: "Quantity asked", cell: (l) => (l[LK.qty] == null ? <span title="No quantity typed - only the shop's own 1" style={{ color: FAINT }}>none typed</span> : qtyWords(l[LK.qty], unit(l))), sort: (l) => l[LK.qty] },
    ...(c.kind === "availability" ? [
      { head: "In stock now", cell: (l: SLook) => qtyWords(art(l)[AR.stock], unit(l)), sort: (l: SLook) => art(l)[AR.stock] },
      { head: "Short by", cell: (l: SLook) => (l[LK.empty] && l[LK.short] == null ? "nothing on the shelf" : qtyWords(l[LK.short], unit(l))), sort: (l: SLook) => l[LK.short] ?? (l[LK.empty] ? 0 : null) },
    ] : []),
    ...(c.kind === "moq" ? [
      { head: "Minimum", cell: (l: SLook) => qtyWords(art(l)[AR.minimum], unit(l)), sort: (l: SLook) => art(l)[AR.minimum] },
      { head: "Of the minimum", cell: (l: SLook) => { const m = art(l)[AR.minimum], qy = l[LK.qty]; return m && qy != null ? pct(qy / m) : "—"; }, sort: (l: SLook) => { const m = art(l)[AR.minimum], qy = l[LK.qty]; return m && qy != null ? qy / m : null; } },
    ] : []),
    ...(c.kind === "price" ? [{ head: "On a ticket", cell: (l: SLook) => (l[LK.ticket] ? "Yes" : "—"), sort: (l: SLook) => l[LK.ticket] }] : []),
    { head: "Ordered later", cell: (l) => (l[LK.later] ? <span style={{ color: GREEN, fontWeight: 700 }}>Yes</span> : "—"), sort: (l) => l[LK.later] },
  ];
  const found = useMemo(() => {
    const hit = q ? all.filter((l) => `${co(l)[CO.name]} ${co(l)[CO.un]} ${art(l)[AR.number]} ${art(l)[AR.description]}`.toLowerCase().includes(q)) : all;
    const by = sort ? cols[sort.col] : null;
    const base = [...hit].sort((a, b) => b[LK.day].localeCompare(a[LK.day]) || co(a)[CO.name].localeCompare(co(b)[CO.name]));
    if (!by) return base;
    const dir = sort!.desc ? -1 : 1;
    return base.map((l, i) => ({ l, i, v: by.sort(l) })).sort((a, b) => {
      if (a.v == null || b.v == null) return a.v == null ? (b.v == null ? a.i - b.i : 1) : -1;
      const x = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), "en", { sensitivity: "base", numeric: true });
      return dir * x || a.i - b.i;
    }).map((x) => x.l);
  }, [all, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = usePaged(found, 25);
  useEffect(() => { paged.setPage(0); }, [q, sort, all]); // eslint-disable-line react-hooks/exhaustive-deps
  // the day and a figure first from the latest or largest, a name from A
  const onSort = (i: number) => setSort((s) => (s?.col === i ? { col: i, desc: !s.desc } : { col: i, desc: i === 1 || !cols[i].text }));
  const filter: CardFilter = { open: () => c.onFilter("company"), label: "Filter by company", on: !!c.filters.company?.length };
  return (
    <CardFilterFor filter={filter}>
      <ChartBox title={`Every ${c.w.one}, one company, one article, one day`} companies={companiesFor(c, found, `the companies on this list${q ? ` matching "${typed.trim()}"` : ""}`)}
        hint={`${periodLine(c)} · ${plural(found.length, c.w.one, c.w.lower)}${q ? ` matching "${typed.trim()}"` : ""} under the filters - the latest first; a click on a heading sorts by it`}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: "1 1 220px", maxWidth: 360, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
            <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
            <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a company or an article" inputProps={{ "aria-label": "Find a company or an article" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Pager p={paged} />
        </Box>
        {!found.length ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{q ? "Nothing matches that search under these filters." : "Nothing under these filters in this period."}</Typography> : (
          <>
            <Table head={cols.map((x) => x.head)} left={cols.flatMap((x, i) => (x.text && i ? [i] : []))} sortable={cols.map((_, i) => i)} sort={sort} onSort={onSort}
              firstWidth="minmax(200px, 1.6fr)" widths={cols.slice(1).map((x) => x.width ?? "minmax(112px, 1fr)")} minWidth={c.kind === "price" ? 1000 : 1120}
              rows={paged.shown.map((l, i) => ({ key: `${l[LK.company]}-${l[LK.article]}-${l[LK.day]}-${i}`, cells: cols.map((x) => x.cell(l)) }))} />
            {paged.pages > 1 && <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}><Pager p={paged} /></Box>}
          </>
        )}
      </ChartBox>
    </CardFilterFor>
  );
}

/* ── the tabs: one card that follows each ──────────────────────────────── */

function Footnote({ c }: { c: Ctx }) {
  const n = c.d.notes;
  const read = c.d.generatedAt.slice(0, 16).replace("T", " ");
  const what = c.kind === "availability"
    ? "Times asked: one company, one article, one day - a look at an article with nothing on the shelf, or a quantity typed above the stock. A bare 1 is the shop's own number (it asks for 1 when the details open), so it counts as a look but not as a quantity asked."
    : c.kind === "price"
    ? `Prices checked: one company, one article, one day - a quantity typed on the product page, the article not put in the cart and not ordered that day. A bare 1 is the shop's own number (it asks for 1 when the details open), not a price asked for${n.bareOne.price ? ` - ${int(n.bareOne.price)} such looks are not counted` : ""}. Every profit centre; the price-check tickets (UC17) take only KT and DT, three articles a day - "on a ticket" counts the articles of a day that got one.`
    : `Asked below the minimum: one company, one article, one day - a quantity typed under the minimum order quantity Products & Pricing gives (only where it says yes and gives a number above one). A bare 1 is the shop's own number, not a quantity asked for${n.bareOne.moq ? ` - ${int(n.bareOne.moq)} such looks are not counted` : ""}.`;
  return (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 }}>
      {what}
      {" "}From the smart bar on the shop, signed-in customers only, since {dayWords(c.d.from)} - its first whole day; nothing earlier exists, so there is no year earlier to compare with: a change is against the same number of days right before, where they are read.
      {c.kind === "availability" ? ` In stock: Products & Pricing's stock, in the sales unit, as it stood at the read - not on the day they asked; the hub keeps no history of the shelf, so an article restocked since is judged on today's stock.${n.unknownStock ? ` ${int(n.unknownStock)} looks at articles whose stock Products & Pricing does not give are left out - unknown is not empty.` : ""}` : ""}
      {" "}No euros: Products &amp; Pricing keeps list prices per ERP price unit (per 1, 100 or 1,000 pieces) without saying which, so price × quantity can be 100 or 1,000 times too high - the counts are honest, an amount would not be.
      {" "}Ordered later: the same company ordered the same article on a later day, through the shop (the smart bar&apos;s mark) - an order by mail or phone is not seen here.
      {" "}Profit centre, main group, sub group and product: Products &amp; Pricing&apos;s, read with the scan; country: the company&apos;s in HubSpot.
      {n.keptError ? ` The hub's own copy of the shop lines could not be read (${n.keptError}): these are the HubSpot property's lines alone, which keep a company's last 50 articles - a busy customer's earlier days are missing.` : n.kept ? ` With ${int(n.kept.merged)} lines from the hub's own copy of the shop activity - the HubSpot property keeps a company's last 50 articles only.` : ""}
      {n.quantityHistoryError ? ` The quantities' history could not be read (${n.quantityHistoryError}): a typed quantity a later 1 overwrote may read as no quantity.` : ""}
      {" "}Read {read} UTC from {int(n.scanned)} companies, again every two hours.
    </Typography>
  );
}

const CARD = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
function TabCard({ c, view }: { c: Ctx; view: View }) {
  const against = `${periodLine(c)}${c.prev ? ` against ${prevLine(c)}` : ""}`;
  const head = (icon: React.ReactNode, tint: Tint, by: string, note: string) => <CardTitle icon={icon} tint={tint} title={`${c.w.title}, by ${by}`} note={`${against} · ${note}`} />;
  if (view === "article") return (
    <GlassCard sx={CARD}>
      {head(<ListAltIcon />, "slate", "article", "the articles asked most, then every one, then every time - a click on one shows only it")}
      <Breakdown c={c} dim="article" />
      <LookList c={c} />
      <Footnote c={c} />
    </GlassCard>
  );
  if (view === "pc") return (
    <GlassCard sx={CARD}>
      {head(<CategoryOutlinedIcon />, "purple", "profit centre", "each profit centre's figures - a click shows only it")}
      <Breakdown c={c} dim="pc" />
      <Footnote c={c} />
    </GlassCard>
  );
  if (view === "hierarchy") return (
    <GlassCard sx={CARD}>
      {head(<AccountTreeOutlinedIcon />, "amber", "product hierarchy", "Products & Pricing's main group, sub group and product - a click on one shows only it, and the levels under it follow")}
      <Breakdown c={c} dim="group" />
      <Box sx={TWO}>
        <CountBoard c={c} dim="sub" by="looks" />
        <CountBoard c={c} dim="product" by="looks" />
      </Box>
      <ProductTable c={c} />
      <Footnote c={c} />
    </GlassCard>
  );
  if (view === "country") return (
    <GlassCard sx={CARD}>
      {head(<PublicOutlinedIcon />, "blue", "country", "the company's country in HubSpot - a click shows only it")}
      <Breakdown c={c} dim="country" />
      <Footnote c={c} />
    </GlassCard>
  );
  return (
    <GlassCard sx={CARD}>
      {head(<ApartmentOutlinedIcon />, "blue", "company", "the companies that asked most, then every one, then every time - a click on one shows only it")}
      <Breakdown c={c} dim="company" second="articles" />
      <LookList c={c} />
      <Footnote c={c} />
    </GlassCard>
  );
}

/** Every product, with its place in Products & Pricing. */
function ProductTable({ c }: { c: Ctx }) {
  const sp = useSplit(c, "product");
  const place = useMemo(() => {
    const m = new Map<string, { group: string; sub: string; pc: string }>();
    for (const a of c.d.articles) if (a[AR.product] && !m.has(a[AR.product])) m.set(a[AR.product], { group: a[AR.group], sub: a[AR.sub], pc: a[AR.pc] });
    return m;
  }, [c.d]);
  const back = new Map<string, string>();
  const rows: BRow[] = sp.rows.map((r) => { back.set(r.label, r.key); return { label: r.label, key: r.key, s: r.s, p: r.p }; });
  const cols: Col<BRow>[] = [
    { key: "pc", head: "Profit centre", cell: (r) => (r.key ? textCell(labelOf(c.names, "pc", place.get(r.key)?.pc ?? "")) : "") },
    { key: "group", head: "Main group", cell: (r) => (r.key ? textCell(place.get(r.key)?.group || "—", !place.get(r.key)?.group) : "") },
    { key: "sub", head: "Sub group", cell: (r) => (r.key ? textCell(place.get(r.key)?.sub || "—", !place.get(r.key)?.sub) : "") },
    ...figureCols(c, sp.total.looks, "product"),
  ];
  return (
    <Wrap c={c} dim="product" looks={sp.now} what="the companies behind the figures by product">
      <ChartBox title="All the figures, by product" hint={`${periodLine(c)}${c.prev ? ` against ${prevLine(c)}` : ""} · each product with the profit centre, main group and sub group Products & Pricing gives it - a click on a heading sorts by it, a click on a row shows only it`}>
        <FullTable key="table-product" first="Product" cols={cols} initial="looks" rows={rows} total={{ label: "Total", key: "", s: sp.total, p: sp.totalPrev }}
          selected={chosenLabels(c, "product")} tint="green" onPick={(l) => c.onPick("product", back.get(l) ?? l)} find="a product - its number or name" />
      </ChartBox>
    </Wrap>
  );
}

/* ── the figures top right (drawn as Articles CY/LY's cards) ───────────── */

type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint };
function figuresOf(c: Ctx): Fig[] {
  const now = looksOf(c.d, c.per.win, c.filters);
  const s = statsOf(c.d, now);
  const p = c.prev ? statsOf(c.d, looksOf(c.d, c.prev, c.filters)) : null;
  const was = (n: number) => (p ? `${prevLine(c)}: ${int(n)}` : "Nothing read before to compare with");
  const first: Fig = { label: c.w.measure, value: int(s.looks), ch: p ? changeOf(s.looks, p.looks) : undefined, icon: c.w.icon, tint: c.w.tint,
    sub: c.kind === "availability" ? `${int(s.empty)} nothing on the shelf · ${int(s.less)} less than asked${p ? ` · ${was(p.looks)}` : ""}`
      : c.kind === "price" ? `${int(s.ticket)} on a price-check ticket${p ? ` · ${was(p.looks)}` : ""}`
      : `On average ${pct(s.shareN ? s.shareSum / s.shareN : null)} of the minimum${p ? ` · ${was(p.looks)}` : ""}` };
  return [
    first,
    { label: "Articles", value: int(s.articles), ch: p ? changeOf(s.articles, p.articles) : undefined, sub: was(p?.articles ?? 0), icon: <Inventory2OutlinedIcon />, tint: "slate" },
    { label: "Companies", value: int(s.companies), ch: p ? changeOf(s.companies, p.companies) : undefined, sub: was(p?.companies ?? 0), icon: <GroupsOutlinedIcon />, tint: "blue" },
    // no change: a look of the days before has had longer to be ordered
    { label: "Ordered later", value: int(s.later), sub: `${pct(s.looks ? s.later / s.looks : null)} of the ${c.w.lower} - the same article, a later day, in the shop`, icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green" },
  ];
}
function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
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

/** A breakdown's values to pick - the most looks first under the other filters, a search past eight. */
function Facet({ c, now, dim, onPick }: { c: Ctx; now: SFilters; dim: FDim; onPick: (key: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const rows = useMemo(() => [...groupBy(c.d, looksOf(c.d, c.per.win, now, dim), dim).entries()]
    .map(([key, ls]) => ({ key, label: labelOf(c.names, dim, key), v: ls.length })).sort((a, b) => b.v - a.v || a.label.localeCompare(b.label)), [c, now, dim]);
  const sel = new Set(now[dim] ?? []);
  // a value chosen that this period has no look of still shows, to be let go
  const missing = [...sel].filter((k) => !rows.some((r) => r.key === k)).map((key) => ({ key, label: labelOf(c.names, dim, key), v: 0 }));
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8, MOST = 100;
  const shown = [...missing, ...(all || q ? found.slice(0, MOST) : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.has(r.key))])];
  const max = Math.max(1, ...rows.map((r) => r.v));
  const t = TINT[DIM[dim].tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].lower}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].lower} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      {!rows.length && !missing.length && <Typography sx={{ fontSize: "0.78rem", color: FAINT, px: 1 }}>Nothing in this period under the other filters.</Typography>}
      {shown.map((r) => {
        const on = sel.has(r.key);
        return (
          <Box key={r.key || "none"} component="button" type="button" onClick={() => onPick(r.key)} aria-pressed={on} title={`${r.label} - ${int(r.v)} ${c.w.lower}`}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 56px 52px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: r.key ? INK : MUTED }}>{r.label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(r.v / max) * 100}%`, bgcolor: t.fg, opacity: 0.6 }} /></Box>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(r.v)}</Typography>
          </Box>
        );
      })}
      {(all || q) && found.length > MOST && <Typography sx={{ fontSize: "0.74rem", color: FAINT, px: 1 }}>The first {MOST} of {int(found.length)} - type more of the name to find the others.</Typography>}
      {!q && found.length > LIMIT && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${LIMIT}` : `Show all ${int(found.length)}`}</Button>}
    </Box>
  );
}

const PANEL_DIMS: FDim[] = ["pc", "group", "sub", "product", "article", "country", "company"];
function SignalsFilterWindow({ c, now, open, onClose, focus, toggle, clearAll, onPeriod }: {
  c: Ctx; now: SFilters; open: boolean; onClose: () => void; focus: { dim: FDim; n: number } | null;
  toggle: (d: FDim, key: string) => void; clearAll: () => void; onPeriod: (id: string) => void;
}) {
  const [shut, setShut] = useState<Partial<Record<FDim | "period", boolean>>>({});
  const isOpen = (k: FDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || !!now[k as FDim]?.length);
  const flip = (k: FDim | "period") => setShut((s) => ({ ...s, [k]: isOpen(k) }));
  // drawn while open, and a moment after closing (its fold-away)
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`sfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = FDIMS.flatMap((d) => (now[d] ?? []).map((k) => [d, k] as const));
  const summary = (d: FDim) => { const v = now[d] ?? []; return !v.length ? "All" : v.length === 1 ? labelOf(c.names, d, v[0]) : `${v.length} chosen`; };
  const { quick, quarters } = periodsOf(c.d.from, c.d.through);
  return (
    <FilterPanel id="signals-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, k]) => (
        <Chip key={`${d}:${k}`} size="small" label={<span><b>{DIM[d].name}:</b> {labelOf(c.names, d, k)}</span>}
          onDelete={() => toggle(d, k)} sx={{ height: 26, maxWidth: "100%", fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />
      )) : null}>
      {live && (
        <>
          <FilterSection id="sfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary={c.per.label}>
            <PeriodPicker quick={quick} quarters={quarters} isOn={(id) => [...quick, ...quarters].some((p) => p.id === id && p.win.from === c.per.win.from && p.win.to === c.per.win.to)}
              onChoice={onPeriod} unit="day" min={c.d.from} max={c.d.through} from={c.per.win.from} to={c.per.win.to} onRange={(a, b) => onPeriod(`d${a}_${b}`)}
              note={`The shop's tracker counts from ${dayWords(c.d.from)}, its first whole day - nothing earlier exists. Each figure is compared with the same number of days right before, where they are read.`} />
          </FilterSection>
          {PANEL_DIMS.map((d, i) => (
            <FilterSection key={d} id={`sfilter-${d}`} index={i + 1} title={DIM[d].name} icon={DIM[d].icon} tint={DIM[d].tint} open={isOpen(d)} onFlip={() => flip(d)}
              summary={summary(d)} chosen={!!now[d]?.length}>
              <Facet c={c} now={now} dim={d} onPick={(k) => toggle(d, k)} />
            </FilterSection>
          ))}
        </>
      )}
    </FilterPanel>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

export function SignalsExplorer({ kind }: { kind: SignalKind }) {
  const w = KIND[kind];
  const params = useSearchParams();
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "article") q.delete("view"); else q.set("view", v); });
  const filters: SFilters = useMemo(() => Object.fromEntries(FDIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const periodId = params.get("period");
  const toggle = useCallback((d: FDim, key: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    q.delete(d);
    for (const x of next) q.append(d, x);
  }), []);
  const clearAll = useCallback(() => setQuery((q) => { for (const d of FDIMS) q.delete(d); q.delete("period"); }), []);
  const onPeriod = useCallback((id: string) => setQuery((q) => { if (id === "all") q.delete("period"); else q.set("period", id); }), []);
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: FDim; n: number } | null>(null);
  const openOn = useCallback((d: FDim) => { setFocus((f) => ({ dim: d, n: (f?.n ?? 0) + 1 })); setPanel(true); }, []);

  const { d, computing, progress, error, retry } = useSignals(kind);
  const c = useMemo<Ctx | null>(() => {
    if (!d) return null;
    const per = periodById(d.from, d.through, periodId);
    return { kind, w, d, names: namesOf(d), per, prev: prevWin(per.win, d.from), filters, onPick: toggle, onFilter: openOn };
  }, [d, kind, w, periodId, filters, toggle, openOn]);
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);

  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  const title = <Typography component="h1" sx={H1}>{w.title}</Typography>;
  const running = computing && !!d;
  const progressCard = computing ? (
    <GlassCard sx={{ py: 1.75 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, mb: 1 }}>{d ? "Reading the shop again" : "Reading the shop"} - {progress ?? "a minute or two"}</Typography>
      <LinearProgress sx={{ height: 8, borderRadius: 99, bgcolor: TRACK }} />
    </GlassCard>
  ) : null;

  if (!c) {
    if (error && !computing) return <Box sx={shell}>{title}<UpstreamPanel source="The shop's read" error={error} status={null} onRetry={retry} /></Box>;
    return <Box sx={shell}>{title}{progressCard ?? <LoadingPanel label="Reading what the shop saw…" />}</Box>;
  }

  const chosen = FDIMS.flatMap((x) => (filters[x] ?? []).map((k) => [x, k] as const));
  return (
    <Box sx={shell}>
      {/* the title and what is shown on the left; the figures top right - as Articles CY/LY */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          {title}
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            {w.line} · <b style={{ color: INK }}>{periodLine(c)}</b>{c.prev ? ` - against ${prevLine(c)}` : ""} · signed-in customers in the shop{running ? " · reading" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, minWidth: 0 }}><FigureCards items={figs} /></Box>
      </Box>
      {running && progressCard}
      {error && <Notice tone="warn">The last read did not finish, so this is the one before it: {error}</Notice>}

      {/* the tabs, and at their right end the Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name={`signals-${kind}`} tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => { const n = v.dims.reduce((s, x) => s + (filters[x]?.length ?? 0), 0); return { id: v.id, label: v.label, count: n ? String(n) : null }; })} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => { if (panel) setPanel(false); else openOn(FOCUS[view]); }} variant={panel || chosen.length ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="signals-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length ? undefined : "#fff" }}>
          Filters{chosen.length ? ` · ${chosen.length}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs - the period first (as the ESO reports, SARCLA 31.10.2026) */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={[
        { key: "period", name: "Period", value: c.per.id === "all" || c.per.id.startsWith("d") ? periodLine(c) : `${c.per.label} · ${periodLine(c)}`, tint: "blue" as Tint, ...(c.per.id !== "all" ? { onRemove: () => onPeriod("all") } : {}) },
        ...chosen.map(([x, k]): ActiveItem => ({ key: `${x}:${k}`, name: DIM[x].name, value: labelOf(c.names, x, k), tint: DIM[x].tint, onRemove: () => toggle(x, k) })),
      ]} />

      <Box id={`signals-panel-${view}`} role="tabpanel" sx={{ minWidth: 0 }}>
        <TabCard c={c} view={view} />
      </Box>

      <SignalsFilterWindow c={c} now={filters} open={panel} onClose={() => setPanel(false)} focus={focus} toggle={toggle} clearAll={clearAll} onPeriod={onPeriod} />
    </Box>
  );
}
