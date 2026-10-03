"use client";

// DATATRACKER — the desktop E-Shop Data Tracker's customer table, live.
//
// The desktop tracker has to be exported by hand; these figures reach HubSpot
// every night, so this is the same question answered without the export. Logins
// and views are counted by the shop on an essential-cookie basis, which is why
// they cover every customer and GA4's numbers do not.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tabs from "@mui/material/Tabs";
import Link from "@mui/material/Link";
import Tab from "@mui/material/Tab";
import { GUTTER, HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { compact, decimal, full } from "@/app/charts/format";
import { ESHOP_YEARS, type ActivityLine, type EshopActivity, type EshopYear } from "@/lib/integrations/eshopActivity";
import { companyPasses, isoDay, periodWindow, shortPriority } from "@/lib/datatracker/rules";

import type { ArticleActivity } from "@/lib/integrations/articleActivity";

type OrdersPayload = {
  from: string; to: string;
  byCompany: Record<string, { orders: number; value: number }>;
  companies: Record<string, { name: string | null; customerNumber: string | null; mandant: string | null;
    country: string | null; apsoCustomer: string | null; salesPriority: string | null; representative: string | null }>;
  scanned: number; capped: boolean; unattributed: number; detailTruncated: number; offChannel: number;
  detailsComplete?: boolean;
  /** Echoed back so the follow-up call reuses this scan instead of repeating it. */
  scanId?: string;
};

type Options = { countries: string[]; mandants: string[]; apsoCustomers: string[]; priorities: string[]; representatives: { id: string; name: string }[] };

/** Six years of views in one cell. Bars, not a line: the values are counts. */
function YearBars({ history, year }: { history: { year: number; views: number | null }[]; year: number }) {
  const top = Math.max(1, ...history.map((h) => h.views ?? 0));
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.4, height: 22 }}>
      {history.map((h) => (
        <Tooltip key={h.year} title={`${h.year}: ${full(h.views)} views`} describeChild>
          <Box
            sx={{
              width: 7,
              height: `${Math.max(2, ((h.views ?? 0) / top) * 22)}px`,
              borderRadius: 0.4,
              bgcolor: h.year === year ? "#2d6fa8" : "#c7ccd4",
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

/** Ranges the live counters can answer. The year picker still drives history. */
// Labels only. How far back each reaches lives in RANGE_DAYS in the rules
// module, so the window cannot drift from the one that is tested.
const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "This quarter" },
  { id: "365d", label: "Last 12 months" },
] as const;

/** Portal 26492587 on the EU cluster; 0-2 = companies. Same as /customers. */
const HS_PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-2/${id}`;

// What the SERVER sorts by, which decides which rows arrive first when there
// are more than a page of them. Order value is not a HubSpot-sortable field, so
// it is not offered here - the column headers sort what has been loaded.
const SORTS = [
  { id: "views", label: "Most views" },
  { id: "logins", label: "Most logins" },
  { id: "revenue", label: "Most revenue" },
] as const;

type SortKey =
  | "mandant" | "customerNumber" | "name" | "country" | "representative" | "apsoCustomer" | "salesPriority"
  | "logins" | "views" | "orders" | "orderValue" | "viewsPerLogin" | "revenueYtd";

type OrderLine = { article: string; description: string | null; qty: number | null; revenue: number | null; orders: number; eshop?: boolean };
type OrderedPayload = { lines: OrderLine[]; articles: string[] };
type OrderedState = OrderedPayload | "loading" | "error" | undefined;

/**
 * What one customer did with an article: looked at it, put it in the cart,
 * bought it. Two sources, merged on the article number.
 *
 * The browser feed alone is not enough and cannot be made enough. The article
 * is the TEN-digit variant, chosen on the page - every product page shares one
 * URL across its 32 thicknesses - and the order is placed from the cart. So
 * Metrohm AG can place the largest order of the day against one login and zero
 * views. The order lines know the article, the quantity and the value, and
 * they also cover an order placed by phone.
 */
function RecentLines({ lines, ordered }: { lines: ActivityLine[]; ordered: OrderedState }) {
  const payload = ordered && ordered !== "loading" && ordered !== "error" ? ordered : null;
  const byArticle = new Map((payload?.lines ?? []).map((l) => [l.article, l]));
  const everBought = new Set(payload?.articles ?? []);

  type Row = { key: string; article: string | null; product: string | null; lookedAt: string | null; qtyTyped: number | null; cart: boolean; reported: boolean };
  const rows: Row[] = [];
  const seen = new Set<string>();
  // Once the quantity lookup has named the article, the bare product-page line
  // for the same product says strictly less about the same visit. Drop it
  // rather than show the customer twice.
  const namedProducts = new Set(lines.filter((v) => v.article && v.product).map((v) => v.product as string));
  for (const v of [...lines].reverse()) {
    if (!v.article && v.product && namedProducts.has(v.product)) continue;
    const key = v.article ?? `p:${v.product}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, article: v.article, product: v.product, lookedAt: v.t, qtyTyped: v.qty, cart: v.cart, reported: v.ordered });
  }
  // Ordered in this window but never seen being looked at - the Metrohm case.
  for (const l of payload?.lines ?? []) {
    if (seen.has(l.article)) continue;
    seen.add(l.article);
    rows.push({ key: l.article, article: l.article, product: null, lookedAt: null, qtyTyped: null, cart: false, reported: false });
  }
  rows.sort((a, b) => {
    const va = byArticle.get(a.article ?? "")?.revenue ?? 0;
    const vb = byArticle.get(b.article ?? "")?.revenue ?? 0;
    if (va !== vb) return vb - va;
    return (b.lookedAt ?? "").localeCompare(a.lookedAt ?? "");
  });

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
        {ordered === "loading"
          ? "Reading this customer's orders…"
          : "Nothing looked at and nothing ordered in this period."}
      </Typography>
    );
  }

  const z = { "&:nth-of-type(odd)": { bgcolor: "#f4f7fb" } };   // zebra, so a long list stays readable
  const c = { borderColor: HAIRLINE, fontSize: "0.78rem", py: 0.75 };
  const h = { ...c, fontWeight: 700, color: MUTED, fontSize: "0.67rem",
    textTransform: "uppercase" as const, letterSpacing: 0.4, whiteSpace: "nowrap" as const };

  return (
    <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ ...h, width: 120 }}>Looked at</TableCell>
          <TableCell sx={{ ...h, width: 110 }}>Article</TableCell>
          <TableCell sx={h}>Description</TableCell>
          <TableCell align="right" sx={{ ...h, width: 76 }}>Qty</TableCell>
          <TableCell align="center" sx={{ ...h, width: 70 }}>In cart</TableCell>
          <TableCell align="center" sx={{ ...h, width: 78 }}>Ordered</TableCell>
          <TableCell align="right" sx={{ ...h, width: 88 }}>Value</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => {
          const o = r.article ? byArticle.get(r.article) : undefined;
          const boughtNow = !!o || r.reported;
          const inCart = r.cart || !!o?.eshop;
          const boughtEver = !boughtNow && !!r.article && everBought.has(r.article);
          const qty = o?.qty ?? r.qtyTyped;
          return (
            <TableRow key={r.key} sx={z}>
              <TableCell sx={{ ...c, color: MUTED, whiteSpace: "nowrap" }}>
                {r.lookedAt ? r.lookedAt.replace("T", " ") : "—"}
              </TableCell>
              <TableCell sx={{ ...c, color: r.article ? INK : MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>
                {r.article ?? r.product}
              </TableCell>
              <TableCell sx={{ ...c, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o?.description ?? (r.article ? "—" : "product page, no size chosen")}
              </TableCell>
              <TableCell align="right" sx={{ ...c, color: qty == null ? MUTED : INK, fontWeight: qty == null ? 400 : 600 }}>
                {qty == null ? "—" : decimal(qty, 0)}
              </TableCell>
              <TableCell align="center" sx={{ ...c, color: inCart ? INK : MUTED, fontWeight: inCart ? 600 : 400 }}>
                {inCart ? "Yes" : "—"}
              </TableCell>
              <TableCell align="center" sx={{ ...c, color: boughtNow ? INK : MUTED, fontWeight: boughtNow ? 700 : 400, whiteSpace: "nowrap" }}>
                {boughtNow ? "Yes" : boughtEver ? "Before" : ordered === "loading" ? "…" : "—"}
              </TableCell>
              <TableCell align="right" sx={{ ...c, color: o?.revenue ? INK : MUTED, fontWeight: o?.revenue ? 600 : 400, whiteSpace: "nowrap" }}>
                {o?.revenue ? `€${compact(o.revenue)}` : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function EshopActivityPage() {
  const [data, setData] = useState<EshopActivity | null>(null);
  const [extraRows, setExtraRows] = useState<EshopActivity["rows"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [orderedBy, setOrderedBy] = useState<Record<string, Exclude<OrderedState, undefined>>>({});
  const [orders, setOrders] = useState<OrdersPayload | null>(null);
  const [minValue, setMinValue] = useState("");
  const [ordersError, setOrdersError] = useState<string | null>(null);
  // The money is the point of the screen, so it opens on it.
  const [sortKey, setSortKey] = useState<SortKey>("orderValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const askedOrders = useRef<Set<string>>(new Set());
  const [lastQuery, setLastQuery] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState("");
  const [mandant, setMandant] = useState("");
  const [apsoCustomer, setApsoCustomer] = useState("");
  const [representative, setRepresentative] = useState("");
  const [priority, setPriority] = useState("");
  const [period, setPeriod] = useState<string>("today");  // a RANGES id, "custom", or "y2026"
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 6 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("views");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"customers" | "articles">("customers");
  const [articles, setArticles] = useState<ArticleActivity | null>(null);
  const [articleSort, setArticleSort] = useState<"orders" | "companies" | "stock">("orders");
  const [articlesError, setArticlesError] = useState<string | null>(null);

  // One definition of the window, shared by the activity read and the orders
  // read, so the two halves of a row can never describe different days.
  // One definition of the window, shared by the activity read and the orders
  // read, and TESTED in tests/datatracker-rules.test.ts - a year reaching the
  // orders window only 30 days back is exactly the bug that hid in here.
  const { from: periodFrom, to: periodTo } = periodWindow(period, customFrom, customTo);

  const asYear = period.startsWith("y") ? (Number(period.slice(1)) as EshopYear) : null;
  const live = asYear === null;
  const year: EshopYear = asYear ?? 2026;

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ year: String(asYear ?? 2026), sort, limit: "200" });
    if (country) q.set("country", country);
    if (mandant) q.set("mandant", mandant);
    if (apsoCustomer) q.set("apsoCustomer", apsoCustomer);
    if (representative) q.set("representative", representative);
    if (priority) q.set("priority", priority);
    q.set("from", periodFrom);
    q.set("to", periodTo);
    q.set("mode", live ? "range" : "year");
    setData(null);
    setExtraRows([]);
    setPage(0);
    setCursor(null);
    setError(null);
    setLastQuery(q.toString());
    fetch(`/api/datatracker?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) { setData(j.data as EshopActivity); setCursor((j.data as EshopActivity).after ?? null); setOptions(j.options ?? null); }
        else setError(j?.error ?? j?.detail ?? "HubSpot did not answer.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [period, country, mandant, apsoCustomer, representative, priority, sort, customFrom, customTo, periodFrom, periodTo]);

  // Orders are the other half of the desktop tracker's table, and they are the
  // reason a customer who ordered without browsing still belongs on this list.
  useEffect(() => {
    if (tab !== "customers") return;
    const ctrl = new AbortController();
    setOrders(null);
    setOrdersError(null);
    const url = `/api/datatracker/orders?from=${periodFrom}&to=${periodTo}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) {
          setOrdersError([j?.step ? `${j.step}:` : "", j?.error ?? j?.detail ?? "HubSpot did not answer for orders.",
            j?.status ? `(HTTP ${j.status})` : ""].filter(Boolean).join(" "));
          return;
        }
        setOrders(j as OrdersPayload);
        // The totals are already complete; only the NAMES of the smaller
        // customers are still missing, so fetch them without blocking the table.
        if (j.detailsComplete === false) {
          const again = `${url}&detail=all${j.scanId ? `&scan=${encodeURIComponent(j.scanId)}` : ""}`;
          fetch(again, { signal: ctrl.signal })
            .then((r) => r.json())
            .then((full) => { if (full?.ok) setOrders(full as OrdersPayload); })
            .catch(() => {});
        }
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setOrdersError(String(e)); });
    return () => ctrl.abort();
  }, [tab, periodFrom, periodTo]);

  // The article scan reads every company carrying activity, so it cannot run
  // once per keystroke. The customers table filters the rows it already has;
  // this one waits for a pause in the typing.
  const [searchSlow, setSearchSlow] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchSlow(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (tab !== "articles") return;
    const ctrl = new AbortController();
    setArticles(null);
    setArticlesError(null);
    const q = new URLSearchParams({ sort: articleSort, limit: "200" });
    if (searchSlow.trim()) q.set("search", searchSlow.trim());
    fetch(`/api/datatracker/articles?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) setArticles(j.data);
        else setArticlesError(j?.error ?? j?.detail ?? "HubSpot did not answer for articles.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setArticlesError(String(e)); });
    return () => ctrl.abort();
  }, [tab, articleSort, searchSlow]);

  // Typing filters what is on screen rather than asking HubSpot again: the rows
  // are already here, and a search per keystroke would hit the search throttle.
  const loadedRows = [...(data?.rows ?? []), ...extraRows];

  // A customer who ordered in this window but was never seen browsing is still
  // a customer who was active in it - the desktop tracker lists them, and
  // leaving them out is what made the live screen look like it was missing
  // data. They come in with no views rather than with invented ones.
  const ordersBy = orders?.byCompany ?? {};
  const allRows = (() => {
    if (!orders) return loadedRows;
    const known = new Set(loadedRows.map((r) => r.id));
    // These rows came from the orders read, which HubSpot never filtered - see
    // companyPasses, which applies the same five conditions the search applies.
    const want = { mandant, country, apsoCustomer, priority, representative };
    const extra = Object.keys(ordersBy)
      .filter((id) => !known.has(id) && orders.companies[id] && companyPasses(orders.companies[id], want))
      .map((id) => {
        const c = orders.companies[id];
        return {
          id, mandant: c.mandant, customerNumber: c.customerNumber, name: c.name,
          logins: null, views: null, viewsPerLogin: null,
          rangeViews: null, rangeLogins: null, recent: [], revenueYtd: null,
          country: c.country, representative: c.representative,
          apsoCustomer: c.apsoCustomer, salesPriority: c.salesPriority,
          // Known only for companies the activity read returned; an order-only
          // row has not been read for them, so they are null rather than blank
          // strings pretending to be data.
          shortAddress: null, phone: null, usageClass: null,
          deliveryCondition: null, paymentCondition: null,
          history: [],
        };
      });
    return [...loadedRows, ...extra];
  })();
  // Picking "Today" must change WHO is listed, not just the numbers beside them.
  // HubSpot cannot filter inside the JSON, so the narrowing happens here.
  const inPeriod = live
    ? allRows.filter((r) => (r.rangeViews ?? 0) > 0 || (r.rangeLogins ?? 0) > 0 || (ordersBy[r.id]?.orders ?? 0) > 0)

    : allRows;
  const sortValue = (r: (typeof allRows)[number], key: SortKey): string | number => {
    switch (key) {
      case "orders": return ordersBy[r.id]?.orders ?? 0;
      case "orderValue": return ordersBy[r.id]?.value ?? 0;
      case "logins": return (live ? r.rangeLogins : r.logins) ?? 0;
      case "views": return (live ? r.rangeViews : r.views) ?? 0;
      case "viewsPerLogin": return r.viewsPerLogin ?? 0;
      case "revenueYtd": return r.revenueYtd ?? 0;
      default: return (r[key as keyof typeof r] as string | null) ?? "";
    }
  };
  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir(typeof sortValue(allRows[0] ?? ({} as never), key) === "number" ? "desc" : "asc"); }
    setPage(0);
  };

  const minV = Number(minValue.replace(",", ".")) || 0;
  const visible = inPeriod.filter((r) => {
    // Only bites when a figure was typed, so it never hides the customers who
    // browsed without ordering.
    if (minV > 0 && (ordersBy[r.id]?.value ?? 0) < minV) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [r.name, r.customerNumber, r.representative].some((v) => (v ?? "").toLowerCase().includes(needle));
  }).sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sortDir === "desc" ? -cmp : cmp;
  });

  const pageRows = visible.slice(page * perPage, page * perPage + perPage);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = new URLSearchParams(lastQuery);
      q.set("after", cursor);
      const j = await fetch(`/api/datatracker?${q}`).then((r) => r.json());
      if (j?.ok && j.data) {
        setExtraRows((prev) => [...prev, ...(j.data as EshopActivity).rows]);
        setCursor((j.data as EshopActivity).after ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, lastQuery]);

  // Opening a row asks what that customer actually buys. Once per company, and
  // only on open: this is one search each, not one per row on screen.
  useEffect(() => {
    const id = openRow;
    const ask = `${id}|${periodFrom}|${periodTo}`;
    if (!id || askedOrders.current.has(ask)) return;
    askedOrders.current.add(ask);
    let alive = true;
    setOrderedBy((o) => ({ ...o, [id]: "loading" }));
    fetch(`/api/datatracker/ordered?companyId=${encodeURIComponent(id)}&from=${periodFrom}&to=${periodTo}`)
      .then((r) => r.json())
      .then((j) => setOrderedBy((o) => ({ ...o,
        [id]: j?.ok ? { lines: (j.lines ?? []) as OrderLine[], articles: (j.articles ?? []) as string[] } : "error" })))
      .catch(() => { if (alive) setOrderedBy((o) => ({ ...o, [id]: "error" })); });
    return () => { alive = false; };
  }, [openRow, periodFrom, periodTo]);

  // "we need to paginate to show all possible": the server hands back 200 rows
  // at a time, so landing on the last loaded page pulls the next slice instead
  // of ending the customer list at whatever the first request happened to fit.
  useEffect(() => {
    if (!cursor || loadingMore) return;
    if ((page + 1) * perPage >= visible.length) void loadMore();
  }, [page, perPage, visible.length, cursor, loadingMore, loadMore]);

  const sum = useCallback((pick: (r: (typeof visible)[number]) => number | null) =>
    visible.reduce((acc, r) => acc + (pick(r) ?? 0), 0), [visible]);

  // One source at a time. Until the shop has posted its first event there are
  // no daily counters to range over, so the table shows the yearly total and
  // the header says so — rather than four lookalike columns, two of them empty.
  const periodLabel = !live
    ? String(year)
    : period === "custom" ? `${customFrom} → ${customTo}`
    : RANGES.find((r) => r.id === period)?.label ?? "";

  /**
   * Narrower gutters inside the cells, because the default 16px each side was
   * eating half of a short column: "M110" in a 60px cell had 28px to live in
   * and came out as "M1...", while the identical cell on the next row did not.
   * Columns that truncate at different points down the page read as ragged.
   */
  const cell = { borderColor: HAIRLINE, fontSize: "0.78rem", px: 1 };
  /**
   * Fifteen columns do not fit a laptop, and a horizontal scrollbar hides the
   * numbers people came for. The least-asked-for columns step out as the window
   * narrows instead; nothing is lost, the row still opens for the detail.
   */
  const COL = {
    country: { display: { xs: "none", xl: "table-cell" } },
    representative: { display: { xs: "none", lg: "table-cell" } },
    viewsPerLogin: { display: { xs: "none", xl: "table-cell" } },
    trend: { display: { xs: "none", lg: "table-cell" } },
  } as const;
  const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const };


  return (
    // The page sits outside the (site) route group, so it carries its own
    // gutter — nothing above it supplies one and the table ran flush to the rail.
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1, md: 1.25 }, pb: { xs: 2.5, md: 3.5 }, display: "grid", gap: 1.75 }}>
      <Typography component="h1" sx={{
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em",
        fontSize: { xs: "1.7rem", md: "2rem" }, lineHeight: 1.1,
      }}>Datatracker</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 0, "& .MuiTab-root": { textTransform: "none", minHeight: 0, py: 1, px: 0, mr: 3, minWidth: 0 } }}>
        <Tab value="customers" label="Customers" />
        <Tab value="articles" label="Articles" />
      </Tabs>

      {tab === "customers" && (
      <>
      <Section>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {/* One control. Pick a range and the live counters answer it; pick a
              year and the Datatracker's own yearly total does. Never both. */}
          <Select size="small" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 170 }}>
            {RANGES.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
            <MenuItem value="custom">Custom range…</MenuItem>
            <Divider />
            {ESHOP_YEARS.map((y) => <MenuItem key={y} value={`y${y}`}>Full year {y}</MenuItem>)}
          </Select>
          {period === "custom" && (
            <>
              <TextField size="small" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} sx={{ minWidth: 150 }} />
              <TextField size="small" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} sx={{ minWidth: 150 }} />
            </>
          )}
          <Select size="small" displayEmpty value={mandant} onChange={(e) => setMandant(e.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="">All mandants</MenuItem>
            {(options?.mandants ?? []).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={country} onChange={(e) => setCountry(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All countries</MenuItem>
            {(options?.countries ?? []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={apsoCustomer} onChange={(e) => setApsoCustomer(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">Any selection criterion</MenuItem>
            {(options?.apsoCustomers ?? []).map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={representative} onChange={(e) => setRepresentative(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">Any representative</MenuItem>
            {(options?.representatives ?? []).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </Select>
          <Select size="small" displayEmpty value={priority} onChange={(e) => setPriority(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="">Any priority</MenuItem>
            {(options?.priorities ?? []).map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
          <Select size="small" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} sx={{ minWidth: 150 }}>
            {SORTS.map((s) => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
          </Select>
          <TextField
            size="small"
            placeholder="Find a customer or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 230 }}
          />
          <TextField
            size="small"
            type="number"
            placeholder="Min. order value €"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            sx={{ minWidth: 170 }}
            inputProps={{ min: 0, step: 100, "aria-label": "Minimum order value in the period" }}
          />
          <Chip
            size="small"
            label={live
              ? `${full(inPeriod.length)} active · ${periodLabel}`
              : `${full(data?.total ?? null)} companies active in ${year}`}
            sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }}
          />
          {/* A bounded scan must say so. A silent cap reads as "this is the
              whole total" and that is how a wrong number gets published. */}
          {orders?.capped && (
            <Typography sx={{ fontSize: "0.74rem", color: "#9e1b18" }}>
              Orders cut at the {full(orders.scanned)} most recent in this window - pick a shorter period for an exact total.
            </Typography>
          )}
          {/* What the period actually means, which matters more than a row count:
              the live feed only has day-by-day figures from the day it started. */}
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
            Logins and views are counted day by day from 2 October 2026, when the shop started reporting them.
            For anything before that only yearly totals exist, so a date range inside an earlier year cannot be split
            out — pick a full year to see those. Orders and value are exact in any window.
          </Typography>
{/* Not an error and not a cap: these rows are on their way, so this reads
              as progress rather than loss. The tiles count shown rows, so they
              rise as the rest land - saying they were already complete would be
              the kind of small untruth that gets a number republished wrong. */}
          {(orders?.detailTruncated ?? 0) > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
              Largest {full(Object.keys(orders!.companies).length)} customers first - still naming{" "}
              {full(orders!.detailTruncated)} more who ordered in this window. The figures above grow as they arrive.
            </Typography>
          )}
{/* Only `order_channel = eshop` is counted. An ERP or phone order has no
              login and no view behind it, so counting it here produced rows that
              could not happen: orders, no logins, no views. */}
          {(orders?.offChannel ?? 0) > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
              Shop orders only - {full(orders!.offChannel)} of the {full(orders!.scanned)} orders in this window were
              placed outside the shop and are not counted here.
            </Typography>
          )}
          {ordersError && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>Orders: {ordersError}</Typography>}
          {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>{error}</Typography>}
        </Box>
      </Section>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(5, 1fr)" }, gap: 2 }}>
        <StatTile label={`Logins · ${periodLabel}`} value={full(sum((r) => (live ? r.rangeLogins : r.logins)))} note="Shown rows only" />
        <StatTile label={`Views · ${periodLabel}`} value={full(sum((r) => (live ? r.rangeViews : r.views)))} note="Shown rows only" />
        <StatTile label="Views per login" value={decimal(sum((r) => (live ? r.rangeViews : r.views)) / Math.max(1, sum((r) => (live ? r.rangeLogins : r.logins))), 1)} note="How deep a visit goes" />
        {/* Over the SHOWN rows, like the two tiles on the left. Reading the
            whole window here was what made a filtered table sit under an
            unfiltered total. */}
        <StatTile label={`Orders · ${periodLabel}`}
          value={ordersError ? "—" : orders == null ? "…" : full(sum((r) => ordersBy[r.id]?.orders ?? 0))}
          note={ordersError ? "Orders could not be read" : "Shown rows only"} />
        <StatTile label={`Order value · ${periodLabel}`}
          value={ordersError ? "—" : orders == null ? "…" : `€${compact(sum((r) => ordersBy[r.id]?.value ?? 0))}`}
          note={ordersError ? "Orders could not be read" : "Shown rows only"} />
      </Box>

      <Section sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ "& td, & th": cell, tableLayout: "fixed", width: "100%", minWidth: 0 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36 }} />
                {/* Widths sized to the longest value each column really holds -
                    "Switzerland", "110-8080123", "Not defined" - so a column
                    either fits or truncates every row, never some of them. */}
                {([["mandant", "Mandant", 64], ["customerNumber", "Customer no.", 104], ["name", "Customer", 0],
                   ["country", "Country", 92], ["representative", "Representative", 132],
                   ["apsoCustomer", "Selection criterion", 108], ["salesPriority", "Priority", 88]] as [SortKey, string, number][]).map(([k, h, w]) => (
                  <TableCell key={k} sx={{ fontWeight: 600, color: MUTED, ...(w ? { width: w } : {}),
                    whiteSpace: "normal", lineHeight: 1.2, verticalAlign: "bottom",
                    ...((COL as Record<string, object>)[k] ?? {}) }} sortDirection={sortKey === k ? sortDir : false}>
                    <TableSortLabel active={sortKey === k} direction={sortKey === k ? sortDir : "asc"} onClick={() => onSort(k)}>
                      {h}
                    </TableSortLabel>
                  </TableCell>
                ))}
                {([["logins", "Logins", 70], ["views", "Views", 70], ["orders", "Orders", 70],
                   ["orderValue", "Total value", 98], ["viewsPerLogin", "Views / login", 76],
                   ["revenueYtd", "Revenue YTD", 98]] as [SortKey, string, number][]).map(([k, h, w]) => (
                  <TableCell key={k} align="right" sx={{ fontWeight: 600, color: MUTED, width: w,
                    whiteSpace: "normal", lineHeight: 1.2, verticalAlign: "bottom",
                    ...((COL as Record<string, object>)[k] ?? {}) }} sortDirection={sortKey === k ? sortDir : false}>
                    <TableSortLabel active={sortKey === k} direction={sortKey === k ? sortDir : "asc"} onClick={() => onSort(k)}>
                      {h}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 600, color: MUTED, whiteSpace: "nowrap", width: 92, ...COL.trend }}>2021 → 2026</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((r) => [
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }}
                  onClick={() => setOpenRow(openRow === r.id ? null : r.id)}>
                  <TableCell sx={{ px: 0.5 }}>
                    <IconButton size="small" aria-label="Show what this customer looked at" sx={{ p: 0.25 }}>
                      <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED, transform: openRow === r.id ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ color: MUTED, ...clip }}>{r.mandant ?? "—"}</TableCell>
                  <TableCell title={r.customerNumber ?? ""} sx={{ color: MUTED, ...clip }}>{r.customerNumber ?? "—"}</TableCell>
                  {/* A column narrow enough to clip must still give up its value on hover. */}
                  <TableCell title={r.name ?? ""} sx={{ color: INK, fontWeight: 600, ...clip }}>
                    {/* stopPropagation: the row click opens the detail panel, and
                        a link inside it must not do both. */}
                    <Link href={hsCompanyUrl(r.id)} target="_blank" rel="noopener"
                      onClick={(e) => e.stopPropagation()} underline="hover"
                      sx={{ color: INK, fontWeight: 600 }}>
                      {r.name ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell title={r.country ?? ""} sx={{ color: MUTED, ...clip, ...COL.country }}>{r.country ?? "—"}</TableCell>
                  <TableCell title={r.representative ?? ""} sx={{ color: MUTED, ...clip, ...COL.representative }}>{r.representative ?? "—"}</TableCell>
                  <TableCell title={r.apsoCustomer ?? ""} sx={{ color: MUTED, ...clip }}>{r.apsoCustomer ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED, ...clip }}>
                    <Tooltip title={r.salesPriority ?? ""} describeChild><span>{shortPriority(r.salesPriority)}</span></Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{full(live ? r.rangeLogins : r.logins)}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(live ? r.rangeViews : r.views)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>
                    {orders == null ? "…" : full(ordersBy[r.id]?.orders ?? 0)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {orders == null ? "…" : (ordersBy[r.id]?.value ?? 0) === 0 ? "—" : `€${compact(ordersBy[r.id].value)}`}
                  </TableCell>
                  <TableCell align="right" sx={{ color: MUTED, ...COL.viewsPerLogin }}>{r.viewsPerLogin == null ? "—" : decimal(r.viewsPerLogin, 1)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{r.revenueYtd == null ? "—" : `€${compact(r.revenueYtd)}`}</TableCell>
                  <TableCell sx={COL.trend}><YearBars history={r.history} year={year} /></TableCell>
                </TableRow>,
                <TableRow key={`${r.id}-detail`}>
                  <TableCell colSpan={15} sx={{ p: 0, borderBottom: openRow === r.id ? undefined : "none" }}>
                    <Collapse in={openRow === r.id} unmountOnExit>
                      <Box sx={{ p: 2, bgcolor: "#eef3fa", borderLeft: "3px solid #1b4a80",
                        boxShadow: "inset 0 1px 0 rgba(27,74,128,0.14), inset 0 -1px 0 rgba(27,74,128,0.14)" }}>
                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, mb: 1 }}>
                          What {r.name ?? "this customer"} looked at and ordered
                          {"  "}
                          <Link href={hsCompanyUrl(r.id)} target="_blank" rel="noopener"
                            onClick={(e) => e.stopPropagation()} underline="hover"
                            sx={{ ml: 1, fontSize: "0.72rem", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                            Open in HubSpot ↗
                          </Link>
                        </Typography>
                        <>
                          {/* Never gate this on the VIEW feed. Metrohm AG placed the
                                largest order of 2 October against one login and zero
                                views, and gating here is what showed "nothing recorded"
                                on a customer who had just spent 4,907. */}
                            {/* The desktop tracker's remaining columns. They belong here
                            rather than in the table: they are read when you look at one
                            customer, not scanned down a list. */}
                        {(r.shortAddress || r.phone || r.usageClass || r.deliveryCondition || r.paymentCondition) ? (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px 22px", mb: 1.5, fontSize: "0.76rem" }}>
                            {([["Address", r.shortAddress], ["Phone", r.phone], ["Usage class", r.usageClass],
                               ["Delivery", r.deliveryCondition], ["Payment", r.paymentCondition]] as [string, string | null][])
                              .filter(([, v]) => !!v)
                              .map(([k, v]) => (
                                <Box key={k} component="span">
                                  <Box component="span" sx={{ color: MUTED }}>{k}: </Box>
                                  <Box component="span" sx={{ color: INK, fontWeight: 600 }}>{v}</Box>
                                </Box>
                              ))}
                          </Box>
                        ) : null}
                        <RecentLines lines={r.recent} ordered={orderedBy[r.id]} />
                        </>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>,
              ]).flat()}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
                    {data ? "No customer matches these filters." : "Reading the shop's activity…"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={visible.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={perPage}
          rowsPerPageOptions={[25, 50, 100]}
          onRowsPerPageChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
          labelRowsPerPage="Customers per page"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} of ${full(count)}${cursor ? "+" : ""}${loadingMore ? " - loading more" : ""}`}
          sx={{ borderTop: `1px solid ${HAIRLINE}` }}
        />
      </Section>

      </>
      )}

      {tab === "articles" && (
        <Section sx={{ p: 0, overflow: "hidden" }}>
          <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Select size="small" value={articleSort} onChange={(e) => setArticleSort(e.target.value as typeof articleSort)} sx={{ minWidth: 180 }}>
              <MenuItem value="orders">Most ordered</MenuItem>
              <MenuItem value="companies">Most customers</MenuItem>
              <MenuItem value="stock">Most stock</MenuItem>
            </Select>
            <TextField size="small" placeholder="Article number or description" value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 260 }} />
            {articles?.total != null && (
              <Chip size="small" label={`${full(articles.total)} articles match`} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
            )}
            {articlesError && <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18" }}>{articlesError}</Typography>}
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ "& td, & th": cell }}>
              <TableHead>
                <TableRow>
                  {["Article no.", "Description", "Main group", "Type"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600, color: MUTED }}>{h}</TableCell>
                  ))}
                  {["Looked at", "Customers", "In cart", "Max qty", "Last look", "Orders", "Ordered by", "Stock"].map((h) => (
                    <TableCell key={h} align="right" sx={{ fontWeight: 600, color: MUTED }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(articles?.rows ?? []).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{a.articleNumber ?? "—"}</TableCell>
                    <TableCell sx={{ color: INK }}>{a.description ?? "—"}</TableCell>
                    <TableCell sx={{ color: MUTED }}>{a.mainGroup ?? "—"}</TableCell>
                    <TableCell sx={{ color: MUTED }}>{a.articleType ?? "—"}</TableCell>
                    {/* What the shop reported, first: it is the live half of this screen. */}
                    <TableCell align="right" sx={{ color: a.views ? INK : MUTED, fontWeight: a.views ? 700 : 400 }}>
                      {a.views == null ? "—" : full(a.views)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: a.lookedBy ? INK : MUTED }}>
                      {a.lookedBy == null ? "—" : full(a.lookedBy)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: a.carts ? INK : MUTED, fontWeight: a.carts ? 600 : 400 }}>
                      {a.carts ? full(a.carts) : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ color: MUTED }}>{a.topQty == null ? "—" : decimal(a.topQty, 0)}</TableCell>
                    <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                      {a.lastLooked ? a.lastLooked.replace("T", " ") : "—"}
                    </TableCell>
                    {/* then the ERP counts, which are all-time */}
                    <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(a.orders)}</TableCell>
                    <TableCell align="right" sx={{ color: INK }}>{full(a.companies)}</TableCell>
                    <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                      {a.stock == null ? "—" : `${full(a.stock)}${a.stockUnit ? ` ${a.stockUnit}` : ""}`}
                    </TableCell>
                  </TableRow>
                ))}
                {articles && articles.rows.length === 0 && (
                  <TableRow><TableCell colSpan={12} sx={{ color: MUTED, py: 3, textAlign: "center" }}>No article matches.</TableCell></TableRow>
                )}
                {!articles && !articlesError && (
                  <TableRow><TableCell colSpan={12} sx={{ color: MUTED, py: 3, textAlign: "center" }}>Reading the articles…</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
              <strong>Looked at, Customers, In cart, Max qty and Last look come from the shop as it happens</strong> — off the
              price lookup the page makes when a customer picks a size and a quantity, so they cover every signed-in customer
              whatever they chose on the cookie banner. They start on 2 October, when that capture went live.
              {" "}<strong>Orders, Ordered by and Stock are ERP counts</strong> from Products &amp; Pricing, written every night and
              covering all time. A dash under the shop columns means nobody has priced that article since the capture started.
              {articles?.viewsError ? ` The shop figures could not be read: ${articles.viewsError}` : ""}
            </Typography>
          </Box>
        </Section>
      )}

    </Box>
  );
}
