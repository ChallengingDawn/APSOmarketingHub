"use client";
// PRODUCTS REPORTS > VIEWS AGAINST ORDERS (SARCLA 01.11.2026 on Products Reports: "articles CY/LY is ok ... but we should have
// much more ... we should really create subtabs" - his pick "Views against orders"): the product pages viewed against the
// articles bought online - by profit centre, by product hierarchy, by product, month by month - the most viewed and not bought,
// the view-to-order rate. Built like Articles CY/LY (rebuilt the same day like the ESO Figures): the figures top right, a tab per
// breakdown, the Filters window with what the page is filtered by under the tabs and Clear all, on every graph its own
// "Filter by …", the lists sortable and searchable, 25 a page. No Actions, no BUC View, no targets (SARCLA: "no actions are
// needed here because no BUC view").
//
// No Companies button: GA4 counts visitors, not companies - neither a view nor an online purchase in it names one (the
// footnote says so). Nothing at article level for the views: a product page carries the 8-digit product, the 10-digit article
// exists once a size is chosen. The figures are worked out on the server (src/lib/products/viewsOrders.ts) from the Engage
// read and Articles CY/LY's product hierarchy as they are kept.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import RemoveShoppingCartOutlinedIcon from "@mui/icons-material/RemoveShoppingCartOutlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";

import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, type Tint } from "@/app/uc/report/ui";
import { StepFunnel } from "../Funnel";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { Pager, Table, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { CardFilterFor, ChartBox, FullTable, H1, Leaderboard, TWO, setQuery, type BoardRow, type CardFilter, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, PeriodPicker, quartersOf, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { pcLabel } from "@/app/reporting/eso-benchmark/shared";
import { NONE, NO_PC, VDIMS, rateOf, type PLine, type ProductPage, type Sold, type VDim, type VFilters, type VFig, type VMonth, type VRow, type VSummary, type VWin } from "@/lib/products/viewsOrders";
import { Choices, Facet, FigureCards, MONTHS, MONTHS_FULL, changeOf, int, pct, plural, points, rateCell, signedInt, signedPct, textCell, tone, withChangeCell, type Fig } from "./kit";

/* ── the read ──────────────────────────────────────────────────────────── */

type Answer = { state: { computing: boolean; progress: string | null; error: string | null }; summary: VSummary | null; filters?: VFilters; articlesBuilt?: string | null };

/** The filters as the address and the reads carry them: "&pc=DT&group=…&sold=not" - one level left out when `skip` names it. */
const filterQs = (f: VFilters, skip?: VDim) => [
  ...VDIMS.flatMap((d) => (d === skip ? [] : (f[d] ?? []).map((v) => `&${d}=${encodeURIComponent(v)}`))),
  f.sold ? `&sold=${f.sold}` : "",
].join("");
const ym = (year: number, m: number) => `${year}-${String(m + 1).padStart(2, "0")}`;

/* ── the levels ────────────────────────────────────────────────────────── */

const DIM: Record<VDim, { name: string; lower: string; tint: Tint; icon: React.ReactNode; none: string }> = {
  pc: { name: "Profit centre", lower: "profit centre", tint: "purple", icon: <CategoryOutlinedIcon />, none: "Not in Products & Pricing" },
  group: { name: "Main group", lower: "main group", tint: "amber", icon: <AccountTreeOutlinedIcon />, none: "No main group known" },
  sub: { name: "Sub group", lower: "sub group", tint: "amber", icon: <AccountTreeOutlinedIcon />, none: "No sub group known" },
  product: { name: "Product", lower: "product", tint: "green", icon: <Inventory2OutlinedIcon />, none: "" },
};
const SOLD: Record<Sold, string> = { bought: "Bought online", not: "Not bought online" };
const isNone = (key: string) => key === NONE || key === NO_PC || !key;
const pcName = (key: string) => (isNone(key) ? DIM.pc.none : pcLabel(key.toLowerCase()));
/** A value as the page shows it: a profit centre by its name, a product by its name, then its number. */
function labelOf(d: VDim, key: string, name?: string | null): string {
  if (d === "pc") return pcName(key);
  if (isNone(key)) return DIM[d].none;
  if (d === "product") return name ? `${name} · ${key}` : key;
  return key;
}

type View = "funnel" | "pc" | "hierarchy" | "products" | "months";
const VIEWS: { id: View; label: string; dims: VDim[] }[] = [
  { id: "funnel", label: "Funnel", dims: [] },
  { id: "pc", label: "Profit centre", dims: ["pc"] },
  { id: "hierarchy", label: "Product hierarchy", dims: ["group", "sub"] },
  { id: "products", label: "Products", dims: ["product"] },
  { id: "months", label: "Month by month", dims: [] },
];
const viewOf = (x: string | null): View => (VIEWS.some((v) => v.id === x) ? (x as View) : "funnel");
type Focus = VDim | "period" | "sold";
/** The section a tab's Filters button opens on. */
const FOCUS: Record<View, Focus> = { funnel: "period", pc: "pc", hierarchy: "group", products: "product", months: "period" };

/* ── what every graph is drawn with ────────────────────────────────────── */

type Ctx = {
  s: VSummary; filters: VFilters;
  /** "Jan – Oct 2026", and the same months a year earlier */
  per: string; perPy: string;
  /** a bar or a row: show only it (again: let it go) */
  onPick: (d: VDim, key: string) => void;
  /** the Filters window, open on a section */
  onFilter: (f: Focus) => void;
};
const perOf = (s: VSummary, back = 0) => {
  const y = s.year - back;
  return s.win.start === s.win.end ? `${MONTHS_FULL[s.win.start]} ${y}` : `${MONTHS[s.win.start]} – ${MONTHS[s.win.end]} ${y}`;
};
/** The chosen values of a level, as its graphs label them. */
const chosenLabels = (c: Ctx, d: VDim) => (c.filters[d] ?? []).map((k) => labelOf(d, k, d === "product" ? c.s.names[k] : null));
/** A graph of something the page filters on a level: the page's Filters, opened on it. */
function Wrap({ c, on, children }: { c: Ctx; on: Focus; children: React.ReactNode }) {
  const label = on === "period" ? "Filter by period" : on === "sold" ? "Filter by bought or not" : `Filter by ${DIM[on].lower}`;
  const chosen = on === "period" ? false : on === "sold" ? !!c.filters.sold : !!c.filters[on]?.length;
  const filter: CardFilter = { open: () => c.onFilter(on), label, on: chosen };
  return <CardFilterFor filter={filter}>{children}</CardFilterFor>;
}

/** A level's product page views, ranked - the values with no place left out of the ranking (in the table). */
function ViewsBoard({ c, dim }: { c: Ctx; dim: "pc" | "group" | "sub" }) {
  const back = new Map<string, string>();
  let none: VRow | null = null;
  const rows: BoardRow[] = c.s.by[dim].flatMap((r) => {
    if (isNone(r.key)) { none = r; return []; }
    if (!r.views && !r.viewsPy) return [];
    const label = labelOf(dim, r.key);
    back.set(label, r.key);
    return [{ label, cur: r.views, prev: r.viewsPy, sub: `${plural(r.products, "product")} viewed · ${pct(rateOf(r.bought, r.products))} of them bought online` }];
  });
  const n = none as VRow | null;
  return (
    <Leaderboard key={`views-${dim}`} title={`Product page views, ${c.per}, by ${DIM[dim].lower}`} rows={rows} curLabel={String(c.s.year)} prevLabel={`${c.s.year - 1}, same months`} first={12}
      fmt={int} diff={signedInt} summary={n && (n.views || n.viewsPy) ? <span style={{ fontWeight: 500, color: MUTED }}>{DIM[dim].none}: {int(n.views)} views - in the table</span> : undefined}
      selected={chosenLabels(c, dim)} onPick={(l) => c.onPick(dim, back.get(l) ?? l)} onFilter={() => c.onFilter(dim)} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

/** A level's products viewed and none of their articles bought online - fewer is better. */
function NotBoughtBoard({ c, dim }: { c: Ctx; dim: "pc" | "group" | "sub" }) {
  const back = new Map<string, string>();
  const rows: BoardRow[] = c.s.by[dim].flatMap((r) => {
    if (isNone(r.key) || (!r.notBought && !r.notBoughtPy)) return [];
    const label = labelOf(dim, r.key);
    back.set(label, r.key);
    return [{ label, cur: r.notBought, prev: r.notBoughtPy, sub: `of ${plural(r.products, "product")} viewed · ${int(r.views)} views` }];
  });
  return (
    <Leaderboard key={`not-${dim}`} title={`Viewed, not bought online, ${c.per}, by ${DIM[dim].lower}`} rows={rows} curLabel={String(c.s.year)} prevLabel={`${c.s.year - 1}, same months`} first={12}
      fmt={int} diff={signedInt} lowerIsBetter selected={chosenLabels(c, dim)} onPick={(l) => c.onPick(dim, back.get(l) ?? l)} onFilter={() => c.onFilter(dim)} filterLabel={`Filter by ${DIM[dim].lower}`} />
  );
}

type TRow = VFig & { label: string; lists?: number; listsPy?: number };
/** The columns of every "All the figures" table - a profit centre's category lists where they are counted. */
function figCols(c: Ctx, lists: boolean): Col<TRow>[] {
  const y1 = c.s.year - 1;
  return [
    { key: "views", head: "Product page views", tip: `${c.per} - under it the change against ${c.perPy}`, cell: (r) => withChangeCell(int(r.views), r.views, r.viewsPy), sort: (r) => r.views },
    { key: "viewsPy", head: `Same months ${y1}`, tip: c.perPy, cell: (r) => int(r.viewsPy), sort: (r) => r.viewsPy },
    ...(lists ? [{ key: "lists", head: "Category list views", tip: "GA4's view_item on a category list of the profit centre - every product listed; not a product page", cell: (r: TRow) => (r.lists == null ? "—" : withChangeCell(int(r.lists), r.lists, r.listsPy ?? 0)), sort: (r: TRow) => r.lists ?? 0 }] : []),
    { key: "products", head: "Products viewed", tip: "Products whose page was opened", cell: (r) => withChangeCell(int(r.products), r.products, r.productsPy), sort: (r) => r.products },
    { key: "bought", head: "Bought online", tip: "Of the products viewed, those with an article in an online order in the same months", cell: (r) => withChangeCell(int(r.bought), r.bought, r.boughtPy), sort: (r) => r.bought },
    { key: "not", head: "Not bought", tip: "Of the products viewed, those with no article in an online order in the same months", cell: (r) => withChangeCell(int(r.notBought), r.notBought, r.notBoughtPy, true), sort: (r) => r.notBought },
    { key: "rate", head: "View-to-order rate", tip: `Bought online ÷ products viewed - under it the change in points against ${c.perPy}`, cell: (r) => rateCell(rateOf(r.bought, r.products), rateOf(r.boughtPy, r.productsPy)), sort: (r) => rateOf(r.bought, r.products) ?? -1 },
    { key: "articles", head: "Articles bought online", tip: "The articles of these products in an online order, each article once a month", cell: (r) => withChangeCell(int(r.articles), r.articles, r.articlesPy), sort: (r) => r.articles },
  ];
}

/** All the figures of a level: each value's views, products viewed, bought or not, the rate, the articles. */
function LevelTable({ c, dim }: { c: Ctx; dim: "pc" | "group" | "sub" }) {
  const back = new Map<string, string>();
  const rows: TRow[] = c.s.by[dim].map((r) => { const label = labelOf(dim, r.key); back.set(label, r.key); return { ...r, label }; });
  const lists = dim === "pc" && c.s.by.pc.some((r) => r.lists != null);
  const sumL = (k: "lists" | "listsPy") => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  const total: TRow = { label: "Total", ...c.s.figures, ...(lists ? { lists: sumL("lists"), listsPy: sumL("listsPy") } : {}) };
  return (
    <ChartBox title={`All the figures, ${c.per}, by ${DIM[dim].lower}`}
      hint={`Against ${c.perPy} · each ${DIM[dim].lower}'s product page views, the products viewed, bought online or not, the view-to-order rate and the articles bought online - a click on a row shows only it`}>
      <FullTable key={`table-${dim}`} first={DIM[dim].name} cols={figCols(c, lists)} initial="views" rows={rows} total={total} selected={chosenLabels(c, dim)} tint={DIM[dim].tint}
        onPick={(l) => c.onPick(dim, back.get(l) ?? l)} find={`a ${DIM[dim].lower}`} />
    </ChartBox>
  );
}

/** The products viewed most and not bought online - or bought; a click shows only that product. */
function TopBoard({ c, which }: { c: Ctx; which: "notBought" | "bought" }) {
  const list: PLine[] = c.s.top[which];
  const back = new Map<string, string>();
  const rows: BoardRow[] = list.map((p) => {
    const label = labelOf("product", p.id, p.name);
    back.set(label, p.id);
    const where = [pcName(p.pc), isNone(p.group) ? "" : p.group].filter(Boolean).join(" · ");
    return { label, cur: p.views, prev: p.viewsPy, sub: which === "bought" ? `${plural(p.articles, "article")} bought online · ${where}` : where };
  });
  const off = (which === "bought" && c.filters.sold === "not") || (which === "notBought" && c.filters.sold === "bought");
  return (
    <Wrap c={c} on="sold">
      {off ? (
        <ChartBox title={which === "bought" ? `Most viewed and bought online, ${c.per}` : `Most viewed, not bought online, ${c.per}`}>
          <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Left out: the page shows the products {c.filters.sold === "bought" ? "bought online" : "not bought online"} only (Filters).</Typography>
        </ChartBox>
      ) : (
        <Leaderboard key={`top-${which}`} title={which === "bought" ? `Most viewed and bought online, ${c.per}` : `Most viewed, not bought online, ${c.per}`} rows={rows}
          curLabel={`Views ${c.s.year}`} prevLabel={`${c.s.year - 1}, same months`} first={12} fmt={int} diff={signedInt}
          summary={which === "notBought" ? <span style={{ fontWeight: 500, color: MUTED }}>Viewed, and none of its articles in an online order - the first place to look for a price, a size or a stock that is missing</span> : undefined}
          selected={chosenLabels(c, "product")} onPick={(l) => c.onPick("product", back.get(l) ?? l)} onFilter={() => c.onFilter("product")} filterLabel="Filter by product" />
      )}
    </Wrap>
  );
}

/* ── every product: 25 a page, searched and sorted on the server ───────── */

type PCol = { head: string; sort: string | null; text?: boolean; width?: string; cell: (r: PLine) => React.ReactNode };
function ProductList({ c }: { c: Ctx }) {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TableSort | null>(null);
  const [page, setPage] = useState(0);
  const [st, setSt] = useState<{ busy: boolean; data?: ProductPage; error?: string }>({ busy: true });
  const y1 = c.s.year - 1;
  const cols: PCol[] = [
    { head: "Product", sort: "name", text: true, cell: (r) => (
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap title={r.name} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.name || "—"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{r.id}</Typography>
      </Box>
    ) },
    { head: "Profit centre", sort: "pc", text: true, width: "150px", cell: (r) => textCell(pcName(r.pc), isNone(r.pc)) },
    { head: "Main group", sort: "group", text: true, width: "minmax(150px, 1fr)", cell: (r) => textCell(isNone(r.group) ? "—" : r.group, isNone(r.group)) },
    { head: "Sub group", sort: "sub", text: true, width: "minmax(150px, 1fr)", cell: (r) => textCell(isNone(r.sub) ? "—" : r.sub, isNone(r.sub)) },
    { head: "Product page views", sort: "views", cell: (r) => withChangeCell(int(r.views), r.views, r.viewsPy) },
    { head: `Same months ${y1}`, sort: "viewsPy", cell: (r) => int(r.viewsPy) },
    { head: "Articles bought online", sort: "articles", width: "minmax(130px, 1fr)", cell: (r) => (r.articles ? withChangeCell(int(r.articles), r.articles, r.articlesPy) : <Box component="span" sx={{ color: RED, fontWeight: 700 }}>Not bought</Box>) },
  ];
  const qs = filterQs(c.filters);
  const per = `&from=${ym(c.s.year, c.s.win.start)}&to=${ym(c.s.year, c.s.win.end)}`;
  useEffect(() => { const t = setTimeout(() => { setQ(typed.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(0); }, [qs, per, sort]);
  const by = sort ? cols[sort.col]?.sort : null;
  useEffect(() => {
    const ctrl = new AbortController();
    setSt((x) => ({ ...x, busy: true, error: undefined }));
    const sq = by ? `&sort=${by}&desc=${sort!.desc ? 1 : 0}` : "";
    fetch(`/api/reporting/products/views/rows?page=${page}${sq}${q ? `&q=${encodeURIComponent(q)}` : ""}${per}${qs}&at=${encodeURIComponent(c.s.generatedAt)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: ProductPage; error?: string }) => setSt(j?.ok && j.data ? { busy: false, data: j.data } : { busy: false, error: j?.error ?? "no answer" }))
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setSt({ busy: false, error: String((e as Error)?.message ?? e) }); });
    return () => ctrl.abort();
  }, [page, q, qs, per, by, sort?.desc, c.s.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // a figure first from the largest, a word from A
  const onSort = (i: number) => setSort((x) => (x?.col === i ? { col: i, desc: !x.desc } : { col: i, desc: !cols[i].text }));
  const d = st.data;
  const chosen = new Set(c.filters.product ?? []);
  const pager = { shown: [] as unknown[], page: d?.page ?? 0, pages: d ? Math.max(1, Math.ceil(d.total / d.size)) : 1, setPage, size: d?.size ?? 25, total: d?.total ?? 0 };
  const rows = (d?.rows ?? []).map((r) => ({ key: r.id, on: chosen.has(r.id), onPick: () => c.onPick("product", r.id), cells: cols.map((x) => x.cell(r)) }));
  const what = c.filters.sold ? ` ${SOLD[c.filters.sold].toLowerCase()}` : "";
  return (
    <Wrap c={c} on="product">
      <ChartBox title={`Every product viewed, ${c.per}`}
        hint={`Against ${c.perPy} · ${d ? plural(d.total, "product") : "the products"}${what} under the filters${q ? ` matching "${q}"` : ""} - the most viewed first; a click on a heading sorts by it, a click on a row shows only that product`}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: "1 1 220px", maxWidth: 360, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
            <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
            <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a product - its number, name or group" inputProps={{ "aria-label": "Find a product - its number, name or group" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
          </Box>
          <Box sx={{ flex: 1 }} />
          {st.busy && <CircularProgress size={14} sx={{ color: MUTED }} />}
          <Pager p={pager} />
        </Box>
        {st.error ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The products could not be read: {st.error}</Typography>
          : d && !d.rows.length ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{q ? "No product matches that search under these filters." : "No product viewed under these filters."}</Typography>
          : (
            <Box sx={{ opacity: st.busy ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}>
              <Table head={cols.map((x) => x.head)} left={cols.flatMap((x, i) => (x.text && i ? [i] : []))} sortable={cols.flatMap((x, i) => (x.sort ? [i] : []))} sort={sort} onSort={onSort}
                firstWidth="minmax(240px, 2fr)" widths={cols.slice(1).map((x) => x.width ?? "minmax(112px, 1fr)")} minWidth={1100} rows={rows} />
              {d && d.total > d.size && <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}><Pager p={pager} /></Box>}
            </Box>
          )}
      </ChartBox>
    </Wrap>
  );
}

/* ── month by month ────────────────────────────────────────────────────── */

type MRow = VMonth & { label: string };
function MonthCharts({ c }: { c: Ctx }) {
  const rows: MRow[] = c.s.months.map((m) => ({ ...m, label: MONTHS[m.month] }));
  const y = c.s.year;
  const rate = (r: MRow) => rateOf(r.bought, r.products) ?? 0, ratePy = (r: MRow) => rateOf(r.boughtPy, r.productsPy) ?? 0;
  const cols: Col<MRow>[] = figCols(c, false);
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <DimChart title={`Product page views, month by month, ${c.per}`} rows={rows} cur={(r) => r.views} prev={(r) => r.viewsPy} curLabel={String(y)} prevLabel={`${y - 1}, same month`}
          fmt={int} fixedOrder labelWidth={56} curNote={(r) => (r.viewsPy ? { text: signedPct(changeOf(r.views, r.viewsPy)), color: tone(changeOf(r.views, r.viewsPy)) } : null)}
          onFilter={() => c.onFilter("period")} filterLabel="Filter by period" pageSize={12} />
        {c.filters.sold ? (
          <Wrap c={c} on="sold">
            <ChartBox title={`View-to-order rate, month by month, ${c.per}`}>
              <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.5 }}>
                The rate needs the products bought and those not bought: with the products {SOLD[c.filters.sold].toLowerCase()} only, it is {c.filters.sold === "bought" ? "100%" : "0%"} by definition. Filters &gt; Bought online &gt; All draws it.
              </Typography>
            </ChartBox>
          </Wrap>
        ) : (
          <DimChart title={`View-to-order rate, month by month, ${c.per}`} rows={rows} cur={rate} prev={ratePy} curLabel={String(y)} prevLabel={`${y - 1}, same month`}
            fmt={(n) => pct(n)} fixedOrder labelWidth={56} curNote={(r) => (r.productsPy ? { text: points(rate(r), ratePy(r)), color: tone(rate(r) - ratePy(r)) } : null)}
            onFilter={() => c.onFilter("period")} filterLabel="Filter by period" pageSize={12} />
        )}
      </Box>
      <Wrap c={c} on="period">
        <ChartBox title={`All the figures, month by month, ${c.per}`} hint={`Each month against the same month of ${y - 1} · the products viewed that month, and of them those with an article in an online order that month`}>
          <FullTable key="table-months" first="Month" cols={cols} natural rows={rows} total={{ label: "Whole period", month: -1, ...c.s.figures }} />
        </ChartBox>
      </Wrap>
    </>
  );
}

/* ── the tabs: one card that follows each ──────────────────────────────── */

/** From the product viewed to the order (SARCLA 01.11.2026: "a funnel diagram in each of the sub topic"): the products whose
 *  page was opened, and those of them with an article bought online in the same months - the same months a year earlier
 *  beside it. One unit, products: the page views are written under the first step. */
function ViewsFunnel({ c }: { c: Ctx }) {
  const f = c.s.figures;
  if (c.filters.sold) return <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>The funnel shows both sides - clear &quot;Bought online&quot; in the Filters to see it.</Typography>;
  if (!f.products) return <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No product page viewed in these months under these filters.</Typography>;
  return (
    <StepFunnel unit={(n) => `${int(n)} ${n === 1 ? "product" : "products"} viewed`} tag="Views against orders" top="of the products viewed"
      steps={[
        { label: "Viewed", n: f.products, sub: `${int(f.views)} product page views` },
        { label: "Bought online", n: f.bought, sub: `${int(f.articles)} of their articles`, color: GREEN, before: f.productsPy ? { share: f.boughtPy / f.productsPy, words: `in ${c.perPy}` } : null },
      ]}
      stops={[{ n: f.notBought, label: "viewed, not bought online", mine: true }]} />
  );
}

const CARD = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
function TabCard({ c, view, built }: { c: Ctx; view: View; built: string | null }) {
  const against = `${c.per} against ${c.perPy}`;
  if (view === "funnel") return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<FilterAltOutlinedIcon />} tint="green" title={`From the product viewed to the order, ${c.per}`}
        note={`${against} · every product whose page was opened, and those of them with an article bought online in the same months`} />
      <ViewsFunnel c={c} />
    </GlassCard>
  );
  if (view === "pc") return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title={`Views against orders by profit centre, ${c.per}`}
        note={`${against} · each profit centre's product page views, and its products viewed but not bought online - a click shows only it`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        <ViewsBoard c={c} dim="pc" />
        <NotBoughtBoard c={c} dim="pc" />
      </Box>
      <Wrap c={c} on="pc"><LevelTable c={c} dim="pc" /></Wrap>
    </GlassCard>
  );
  if (view === "hierarchy") return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<AccountTreeOutlinedIcon />} tint="amber" title={`Views against orders by product hierarchy, ${c.per}`}
        note={`${against} · Products & Pricing's main group and sub group - a click on one shows only it, and the level under it follows`} />
      {!c.s.hierarchy ? (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.5 }}>
          The product hierarchy comes from Articles CY/LY&apos;s report, and it has not read the hierarchy yet. Its next build - after tonight&apos;s orders - reads every article&apos;s main group, sub group and product from Products &amp; Pricing.
        </Typography>
      ) : (
        <>
          <Box sx={{ ...TWO, mt: -1 }}>
            <ViewsBoard c={c} dim="group" />
            <NotBoughtBoard c={c} dim="group" />
          </Box>
          <Wrap c={c} on="group"><LevelTable c={c} dim="group" /></Wrap>
          <Box sx={TWO}>
            <ViewsBoard c={c} dim="sub" />
            <NotBoughtBoard c={c} dim="sub" />
          </Box>
          <Wrap c={c} on="sub"><LevelTable c={c} dim="sub" /></Wrap>
        </>
      )}
    </GlassCard>
  );
  if (view === "products") return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<ListAltIcon />} tint="green" title={`Views against orders by product, ${c.per}`}
        note={`${against} · the products viewed most, not bought online and bought, then every one - a click on one shows only it. The views stop at the product: GA4 does not see which article (size) was looked at`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        <TopBoard c={c} which="notBought" />
        <TopBoard c={c} which="bought" />
      </Box>
      <ProductList c={c} />
    </GlassCard>
  );
  return (
    <GlassCard sx={CARD}>
      <CardTitle icon={<DateRangeOutlinedIcon />} tint="blue" title={`Views against orders month by month, ${c.per}`}
        note={`${against} · each month's product page views and its view-to-order rate, then all the figures`} />
      <MonthCharts c={c} />
    </GlassCard>
  );
}

/* ── the figures top right ─────────────────────────────────────────────── */

function figuresOf(s: VSummary, perPy: string, sold?: Sold): Fig[] {
  const f = s.figures;
  const rate = rateOf(f.bought, f.products), ratePy = rateOf(f.boughtPy, f.productsPy);
  // one side chosen in Filters: the other card is empty by definition, and says so
  const left = (x: Sold) => `Left out - Filters show the products ${SOLD[x].toLowerCase()} only`;
  return [
    { label: "Product page views", value: int(f.views), ch: changeOf(f.views, f.viewsPy), sub: `${perPy}: ${int(f.viewsPy)}`, icon: <VisibilityOutlinedIcon />, tint: "purple" },
    { label: "Products viewed", value: int(f.products), ch: changeOf(f.products, f.productsPy), sub: `${perPy}: ${int(f.productsPy)}`, icon: <Inventory2OutlinedIcon />, tint: "blue" },
    sold === "not" ? { label: "Viewed and bought online", value: "—", sub: left("not"), icon: <ShoppingCartOutlinedIcon />, tint: "green" }
      : { label: "Viewed and bought online", value: int(f.bought), ch: changeOf(f.bought, f.boughtPy), sub: sold ? `${perPy}: ${int(f.boughtPy)}` : `${pct(rate)} of the products viewed - the view-to-order rate, ${points(rate, ratePy)}`, icon: <ShoppingCartOutlinedIcon />, tint: "green" },
    sold === "bought" ? { label: "Viewed, not bought online", value: "—", sub: left("bought"), icon: <RemoveShoppingCartOutlinedIcon />, tint: "pink" }
      : { label: "Viewed, not bought online", value: int(f.notBought), ch: changeOf(f.notBought, f.notBoughtPy), lower: true, sub: sold ? `${perPy}: ${int(f.notBoughtPy)}` : `${pct(rateOf(f.notBought, f.products))} of the products viewed · ${perPy}: ${int(f.notBoughtPy)}`, icon: <RemoveShoppingCartOutlinedIcon />, tint: "pink" },
    { label: "Articles bought online", value: int(f.articles), ch: changeOf(f.articles, f.articlesPy), sub: `Of these products, each once a month · ${perPy}: ${int(f.articlesPy)}`, icon: <ListAltIcon />, tint: "amber" },
  ];
}

/* ── the Filters window ────────────────────────────────────────────────── */

/** The products to pick - too many to list: the chosen ones, then the eight most viewed under the other filters, or those a search finds. */
function ProductFacet({ c, onPick }: { c: Ctx; onPick: (key: string) => void }) {
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<PLine[] | null>(null);
  const qs = filterQs(c.filters, "product");
  const per = `&from=${ym(c.s.year, c.s.win.start)}&to=${ym(c.s.year, c.s.win.end)}`;
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/reporting/products/views/rows?size=8${typed.trim() ? `&q=${encodeURIComponent(typed.trim())}` : ""}${per}${qs}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((j: { data?: ProductPage }) => setFound(j?.data?.rows ?? [])).catch(() => {});
    }, typed ? 300 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [typed, qs, per]);
  const sel = c.filters.product ?? [];
  const t = TINT[DIM.product.tint];
  const row = (key: string, label: string, v: number | null, on: boolean) => (
    <Box key={key} component="button" type="button" onClick={() => onPick(key)} aria-pressed={on} title={label}
      sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 76px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
      {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
      <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v == null ? "" : `${int(v)} views`}</Typography>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
        <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
        <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find a product - its number, name or group" inputProps={{ "aria-label": "Find a product to filter" }} sx={{ fontSize: "0.8rem", flex: 1 }} />
      </Box>
      {sel.map((k) => row(k, labelOf("product", k, c.s.names[k]), null, true))}
      {(found ?? []).filter((r) => !sel.includes(r.id)).map((r) => row(r.id, labelOf("product", r.id, r.name), r.views, false))}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, px: 1 }}>{typed.trim() ? "The eight most viewed that match, under the other filters" : "The eight most viewed under the other filters - type to find any other"}</Typography>
    </Box>
  );
}

function ViewsFilterWindow({ c, open, onClose, focus, toggle, setSold, setWin, isYtd, clearAll }: {
  c: Ctx; open: boolean; onClose: () => void; focus: { on: Focus; n: number } | null;
  toggle: (d: VDim, key: string) => void; setSold: (s: Sold | null) => void; setWin: (w: VWin) => void; isYtd: boolean; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<Focus, boolean>>>({});
  const isOpen = (k: Focus) => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "pc" || k === "sold" || !!c.filters[k]?.length);
  const flip = (k: Focus) => setShut((s) => ({ ...s, [k]: isOpen(k) }));
  // drawn while open, and a moment after closing (its fold-away)
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.on]: false }));
    const t = setTimeout(() => document.getElementById(`vfilter-${focus.on}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const { s } = c;
  const last = Math.max(0, s.monthsDone - 1);
  const quarters = quartersOf(s.year, last, false);
  const quick = [
    { id: "ytd", label: `This year so far` },
    { id: "last", label: `Last month · ${MONTHS_FULL[last]}` },
    ...(last >= 2 ? [{ id: "last3", label: "Last 3 months" }] : []),
  ];
  const winOf = (id: string): VWin | null => {
    if (id === "ytd") return { start: 0, end: last };
    if (id === "last") return { start: last, end: last };
    if (id === "last3") return { start: Math.max(0, last - 2), end: last };
    const q = quarters.find((x) => x.id === id);
    return q && !q.disabled ? { start: q.from, end: q.to } : null;
  };
  const dims: VDim[] = s.hierarchy ? ["pc", "group", "sub", "product"] : ["pc", "product"];
  const chosen = VDIMS.flatMap((d) => (c.filters[d] ?? []).map((k) => [d, k] as const));
  const count = chosen.length + (c.filters.sold ? 1 : 0) + (isYtd ? 0 : 1);
  const summary = (d: VDim) => { const v = c.filters[d] ?? []; return !v.length ? "All" : v.length === 1 ? labelOf(d, v[0], d === "product" ? s.names[v[0]] : null) : `${v.length} chosen`; };
  const facetRows = (d: "pc" | "group" | "sub") => s.by[d].map((r) => ({ key: r.key, label: labelOf(d, r.key), v: r.views }));
  return (
    <FilterPanel id="views-filters" open={open} onClose={onClose}
      subtitle={count ? `${count} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={count ? clearAll : undefined}
      chips={count ? <>
        {!isYtd && <Chip size="small" label={<span><b>Period:</b> {c.per}</span>} onDelete={() => setWin({ start: 0, end: last })} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.blue.bg, color: INK }} />}
        {chosen.map(([d, k]) => (
          <Chip key={`${d}:${k}`} size="small" label={<span><b>{DIM[d].name}:</b> {labelOf(d, k, d === "product" ? s.names[k] : null)}</span>}
            onDelete={() => toggle(d, k)} sx={{ height: 26, maxWidth: "100%", fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />
        ))}
        {c.filters.sold && <Chip size="small" label={<span><b>Bought online:</b> {SOLD[c.filters.sold]}</span>} onDelete={() => setSold(null)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.pink.bg, color: INK }} />}
      </> : null}>
      {live && (
        <>
          <FilterSection id="vfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary={c.per} chosen={!isYtd}>
            <PeriodPicker quick={quick} quarters={quarters} unit="month" min={ym(s.year, 0)} max={ym(s.year, last)} from={ym(s.year, s.win.start)} to={ym(s.year, s.win.end)}
              isOn={(id) => { const w = winOf(id); return !!w && w.start === s.win.start && w.end === s.win.end; }}
              onChoice={(id) => { const w = winOf(id); if (w) setWin(w); }}
              onRange={(a, b) => setWin({ start: Number(a.slice(5, 7)) - 1, end: Number(b.slice(5, 7)) - 1 })}
              note={<>Against the same months of {s.year - 1}. The month running is left out until it is over; GA4&apos;s two years are read, so the months of {s.year} only.</>} />
          </FilterSection>
          {dims.map((d, i) => (
            <FilterSection key={d} id={`vfilter-${d}`} index={i + 1} title={DIM[d].name} icon={DIM[d].icon} tint={DIM[d].tint} open={isOpen(d)} onFlip={() => flip(d)} summary={summary(d)} chosen={!!c.filters[d]?.length}>
              {d === "product" ? <ProductFacet c={c} onPick={(k) => toggle(d, k)} />
                : <Facet rows={facetRows(d)} chosen={c.filters[d] ?? []} tint={DIM[d].tint} find={`a ${DIM[d].lower}`} unit="product page views" onPick={(k) => toggle(d, k)} />}
            </FilterSection>
          ))}
          <FilterSection id="vfilter-sold" index={dims.length + 1} title="Bought online" icon={<ShoppingCartOutlinedIcon />} tint="pink" open={isOpen("sold")} onFlip={() => flip("sold")} summary={c.filters.sold ? SOLD[c.filters.sold] : "All"} chosen={!!c.filters.sold}>
            <Choices<"all" | Sold> on={c.filters.sold ?? "all"} onPick={(x) => setSold(x === "all" ? null : x)}
              items={[{ id: "all", label: "All" }, { id: "bought", label: "Bought online" }, { id: "not", label: "Not bought online" }]} />
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
              The products viewed in the period with an article in an online order in the same months - or with none. A year earlier is counted on its own terms: the products viewed then, bought then or not.
            </Typography>
          </FilterSection>
        </>
      )}
    </FilterPanel>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

export function ViewsOrdersExplorer() {
  const params = useSearchParams();
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "funnel") q.delete("view"); else q.set("view", v); });
  const filters: VFilters = useMemo(() => {
    const f: VFilters = Object.fromEntries(VDIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : [])));
    const s = params.get("sold");
    if (s === "bought" || s === "not") f.sold = s;
    return f;
  }, [params]);
  const toggle = useCallback((d: VDim, key: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    q.delete(d);
    for (const x of next) q.append(d, x);
  }), []);
  const setSold = useCallback((s: Sold | null) => setQuery((q) => { if (s) q.set("sold", s); else q.delete("sold"); }), []);
  const from = params.get("from"), to = params.get("to");
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ on: Focus; n: number } | null>(null);
  const openOn = useCallback((on: Focus) => { setFocus((f) => ({ on, n: (f?.n ?? 0) + 1 })); setPanel(true); }, []);
  const [tick, setTick] = useState(0);

  const per = from && to ? `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "";
  const url = `/api/reporting/products/views?n=${tick}${per}${filterQs(filters)}`;
  const held = useHeld<Answer>(url, [url]);
  const r = held.result;
  const data = r?.state === "ok" ? r.data : null;
  // while GA4 is read (a first read takes a minute or two), look again every few seconds
  const computing = !!data?.state.computing;
  useEffect(() => {
    if (!computing) return;
    const t = setTimeout(() => setTick((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [computing, tick]);

  // what was drawn last stays while the next answer comes (a filter clicked): the figures dim, nothing jumps - each answer
  // with the filters it is of
  const lastGood = useRef<Answer | null>(null);
  if (data?.summary) lastGood.current = data;
  const shown = lastGood.current;
  const c = useMemo<Ctx | null>(() => (shown?.summary ? {
    s: shown.summary, filters: shown.filters ?? {}, per: perOf(shown.summary), perPy: perOf(shown.summary, 1), onPick: toggle, onFilter: openOn,
  } : null), [shown, toggle, openOn]);
  const stale = held.stale || r === null;

  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  const title = <Typography component="h1" sx={H1}>Views against orders</Typography>;
  if (r === null && !c) return <Box sx={shell}>{title}<LoadingPanel label="Reading the product pages viewed and the articles bought…" /></Box>;
  if (r?.state === "error" && !c) return <Box sx={shell}>{title}<UpstreamPanel source="Views against orders" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} /></Box>;
  if (!c) {
    const st = data?.state;
    return (
      <Box sx={shell}>
        {title}
        <GlassCard>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            {!st?.error && <CircularProgress size={18} />}
            <Typography sx={{ fontSize: "0.88rem", color: st?.error ? RED : MUTED }}>
              {st?.error ? `GA4 could not be read: ${st.error}` : `Reading GA4's product pages viewed and articles bought, and Products & Pricing${st?.progress ? ` - ${st.progress}` : ""}…`}
            </Typography>
          </Box>
        </GlassCard>
      </Box>
    );
  }

  const s = c.s;
  const last = Math.max(0, s.monthsDone - 1);
  const isYtd = s.win.start === 0 && s.win.end === last;
  const setWin = (w: VWin) => setQuery((q) => {
    if (w.start === 0 && w.end === last) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(s.year, w.start)); q.set("to", ym(s.year, w.end)); }
  });
  const clearAll = () => setQuery((q) => { for (const d of VDIMS) q.delete(d); q.delete("sold"); q.delete("from"); q.delete("to"); });
  const chosen = VDIMS.flatMap((d) => (c.filters[d] ?? []).map((k) => [d, k] as const));
  const count = chosen.length + (c.filters.sold ? 1 : 0) + (isYtd ? 0 : 1);
  return (
    <Box sx={shell}>
      {/* the title and what is shown on the left; the figures top right - as Articles CY/LY */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          {title}
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            The product pages viewed against the articles bought online · <b style={{ color: INK }}>{c.per}</b> - against {c.perPy} · GA4, visitors who accepted cookies{computing ? " · reading GA4 again" : ""}{stale ? " · reading" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards items={figuresOf(s, c.perPy, c.filters.sold)} /></Box>
      </Box>

      {/* the tabs, and at their right end the Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="views" tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => { const n = v.dims.reduce((t, d) => t + (filters[d]?.length ?? 0), 0); return { id: v.id, label: v.label, count: n ? String(n) : null }; })} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => { if (panel) setPanel(false); else openOn(FOCUS[view]); }} variant={panel || count ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="views-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || count ? undefined : "#fff" }}>
          Filters{count ? ` · ${count}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs - the period first */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={[
        ...(!isYtd ? [{ key: "period", name: "Period", value: c.per, tint: "blue" as Tint, onRemove: () => setWin({ start: 0, end: last }) }] : []),
        ...chosen.map(([d, k]): ActiveItem => ({ key: `${d}:${k}`, name: DIM[d].name, value: labelOf(d, k, d === "product" ? s.names[k] : null), tint: DIM[d].tint, onRemove: () => toggle(d, k) })),
        ...(c.filters.sold ? [{ key: "sold", name: "Bought online", value: SOLD[c.filters.sold], tint: "pink" as Tint, onRemove: () => setSold(null) }] : []),
      ]} />

      <Box id={`views-panel-${view}`} role="tabpanel" sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCard c={c} view={view} built={shown?.articlesBuilt ?? null} />
      </Box>

      <ViewsFilterWindow c={c} open={panel} onClose={() => setPanel(false)} focus={focus} toggle={toggle} setSold={setSold} setWin={setWin} isYtd={isYtd} clearAll={clearAll} />
    </Box>
  );
}
