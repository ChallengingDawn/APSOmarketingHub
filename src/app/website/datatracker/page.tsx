"use client";

// DATATRACKER — the desktop E-Shop Data Tracker's customer table, live.
//
// The desktop tracker has to be exported by hand; these figures reach HubSpot
// every night, so this is the same question answered without the export. Logins
// and views are counted by the shop on an essential-cookie basis, which is why
// they cover every customer and GA4's numbers do not.

import { useCallback, useEffect, useState } from "react";
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
import TextField from "@mui/material/TextField";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import PageHeader from "@/app/PageHeader";
import { GUTTER, HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import { StatTile } from "@/app/charts/StatTile";
import { compact, decimal, full } from "@/app/charts/format";
import { ESHOP_YEARS, type EshopActivity, type EshopYear } from "@/lib/integrations/eshopActivity";

import type { ArticleActivity } from "@/lib/integrations/articleActivity";

type Options = { countries: string[]; mandants: string[]; apsoCustomers: string[]; representatives: string[]; priorities: string[] };

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
const RANGES = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "Last 7 days", days: 6 },
  { id: "30d", label: "Last 30 days", days: 29 },
  { id: "90d", label: "This quarter", days: 89 },
  { id: "365d", label: "Last 12 months", days: 364 },
] as const;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const SORTS = [
  { id: "views", label: "Most views" },
  { id: "logins", label: "Most logins" },
  { id: "revenue", label: "Most revenue" },
] as const;

export default function EshopActivityPage() {
  const [data, setData] = useState<EshopActivity | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<EshopYear>(2026);
  const [country, setCountry] = useState("");
  const [mandant, setMandant] = useState("");
  const [apsoCustomer, setApsoCustomer] = useState("");
  const [representative, setRepresentative] = useState("");
  const [priority, setPriority] = useState("");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"] | "custom">("30d");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 6 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("views");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"customers" | "articles">("customers");
  const [articles, setArticles] = useState<ArticleActivity | null>(null);
  const [articleSort, setArticleSort] = useState<"orders" | "companies" | "stock">("orders");
  const [articlesError, setArticlesError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ year: String(year), sort, limit: "200" });
    if (country) q.set("country", country);
    if (mandant) q.set("mandant", mandant);
    if (apsoCustomer) q.set("apsoCustomer", apsoCustomer);
    if (representative) q.set("representative", representative);
    if (priority) q.set("priority", priority);
    const preset = RANGES.find((r) => r.id === range);
    const to = range === "custom" ? customTo : isoDay(new Date());
    const from = range === "custom" ? customFrom : isoDay(new Date(Date.now() - (preset?.days ?? 29) * 86_400_000));
    q.set("from", from);
    q.set("to", to);
    setData(null);
    setError(null);
    fetch(`/api/datatracker?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) { setData(j.data as EshopActivity); setOptions(j.options ?? null); }
        else setError(j?.error ?? j?.detail ?? "HubSpot did not answer.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [year, country, mandant, apsoCustomer, representative, priority, sort, range, customFrom, customTo]);

  useEffect(() => {
    if (tab !== "articles") return;
    const ctrl = new AbortController();
    setArticles(null);
    setArticlesError(null);
    const q = new URLSearchParams({ sort: articleSort, limit: "200" });
    if (search.trim()) q.set("search", search.trim());
    fetch(`/api/datatracker/articles?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) setArticles(j.data);
        else setArticlesError(j?.error ?? j?.detail ?? "GA4 did not answer.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setArticlesError(String(e)); });
    return () => ctrl.abort();
  }, [tab, articleSort, search]);

  // Typing filters what is on screen rather than asking HubSpot again: the rows
  // are already here, and a search per keystroke would hit the search throttle.
  const visible = (data?.rows ?? []).filter((r) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [r.name, r.customerNumber, r.representative].some((v) => (v ?? "").toLowerCase().includes(needle));
  });

  const sum = useCallback((pick: (r: (typeof visible)[number]) => number | null) =>
    visible.reduce((acc, r) => acc + (pick(r) ?? 0), 0), [visible]);

  const cell = { borderColor: HAIRLINE, fontSize: "0.8rem" };

  return (
    // The page sits outside the (site) route group, so it carries its own
    // gutter — nothing above it supplies one and the table ran flush to the rail.
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2.5 }}>
      <PageHeader
        title="Datatracker"
        subtitle="Who logs in, how much they look at, and what they are worth — per customer, from the shop's own tracking"
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 0, "& .MuiTab-root": { textTransform: "none", minHeight: 0, py: 1 } }}>
        <Tab value="customers" label="Customers" />
        <Tab value="articles" label="Articles" />
      </Tabs>

      {tab === "customers" && (
      <>
      <Section>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <Select size="small" value={range} onChange={(e) => setRange(e.target.value as typeof range)} sx={{ minWidth: 160 }}>
            {RANGES.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
            <MenuItem value="custom">Custom range…</MenuItem>
          </Select>
          {range === "custom" && (
            <>
              <TextField size="small" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} sx={{ minWidth: 150 }} />
              <TextField size="small" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} sx={{ minWidth: 150 }} />
            </>
          )}
          <Select size="small" value={year} onChange={(e) => setYear(Number(e.target.value) as EshopYear)} sx={{ minWidth: 104 }}>
            {ESHOP_YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
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
            {(options?.representatives ?? []).map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
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
          {data?.total != null && (
            <Chip size="small" label={`${full(data.total)} companies active in ${year}`} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
          )}
          {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>{error}</Typography>}
        </Box>
      </Section>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2 }}>
        <StatTile label={`Logins ${year}`} value={full(sum((r) => r.logins))} note="Shown rows only" />
        <StatTile label={`Views ${year}`} value={full(sum((r) => r.views))} note="Shown rows only" />
        <StatTile label="Views per login" value={decimal(sum((r) => r.views) / Math.max(1, sum((r) => r.logins)), 1)} note="How deep a visit goes" />
      </Box>

      <Section sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ "& td, & th": cell }}>
            <TableHead>
              <TableRow>
                {["Mandant", "Customer no.", "Customer", "Country", "Representative", "Selection criterion", "Priority"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, color: MUTED }}>{h}</TableCell>
                ))}
                {["Logins (range)", "Views (range)", "Logins", "Views", "Views / login", "Revenue YTD"].map((h) => (
                  <TableCell key={h} align="right" sx={{ fontWeight: 600, color: MUTED }}>{h}</TableCell>
                ))}
                <TableCell sx={{ fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>2021 → 2026</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.mandant ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.customerNumber ?? "—"}</TableCell>
                  <TableCell sx={{ color: INK, fontWeight: 600 }}>{r.name ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.country ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.representative ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{r.apsoCustomer ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.salesPriority ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{r.rangeLogins == null ? "—" : full(r.rangeLogins)}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{r.rangeViews == null ? "—" : full(r.rangeViews)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{full(r.logins)}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(r.views)}</TableCell>
                  <TableCell align="right" sx={{ color: MUTED }}>{r.viewsPerLogin == null ? "—" : decimal(r.viewsPerLogin, 1)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{r.revenueYtd == null ? "—" : `€${compact(r.revenueYtd)}`}</TableCell>
                  <TableCell><YearBars history={r.history} year={year} /></TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
                    {data ? "No customer matches these filters." : "Reading the shop's activity…"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
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
                  {["Orders", "Customers", "Stock", "Views (GA4)"].map((h) => (
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
                    <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(a.orders)}</TableCell>
                    <TableCell align="right" sx={{ color: INK }}>{full(a.companies)}</TableCell>
                    <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                      {a.stock == null ? "—" : `${full(a.stock)}${a.stockUnit ? ` ${a.stockUnit}` : ""}`}
                    </TableCell>
                    <TableCell align="right" sx={{ color: MUTED }}>{a.views == null ? "—" : full(a.views)}</TableCell>
                  </TableRow>
                ))}
                {articles && articles.rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} sx={{ color: MUTED, py: 3, textAlign: "center" }}>No article matches.</TableCell></TableRow>
                )}
                {!articles && !articlesError && (
                  <TableRow><TableCell colSpan={8} sx={{ color: MUTED, py: 3, textAlign: "center" }}>Reading the articles…</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
              <strong>Orders, customers and stock are ERP counts</strong> from Products &amp; Pricing, written every night — they
              cover every order whatever anyone chose on the cookie banner, which is why they are the columns to rank by.
              {" "}<strong>Views are GA4&apos;s</strong>
              {articles?.viewsFrom ? `, ${articles.viewsFrom} to ${articles.viewsTo}` : ""}, so they count consented sessions only
              and are smaller than the truth. The shop&apos;s own view count — the one in the desktop tracker — is collected on an
              essential-cookie basis and is not loaded into Products &amp; Pricing by anything yet. A dash means GA4 had no row for
              that article in the period.
              {articles?.viewsError ? ` GA4 did not answer: ${articles.viewsError}` : ""}
            </Typography>
          </Box>
        </Section>
      )}

      <Section>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.75 }}>Where these numbers come from</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
          Logins and views are the shop&apos;s own counts, loaded onto the company record every night — the same figures the
          desktop E-Shop Data Tracker shows, without the export step. They are collected on an essential-cookie basis, so unlike
          anything from GA4 they cover <strong>every</strong> customer, whatever they chose on the banner. Revenue YTD is the ERP
          figure already on the company, not shop-only turnover.
          {" "}The tracker&apos;s own <strong>Orders</strong> and <strong>Total value</strong> columns count shop orders in the
          selected period; counting those here would mean one query per company, so they are not shown rather than approximated.
          {" "}Rows are the top 200 for the chosen ranking — the chip says how many companies matched in total.
          {" "}<strong>Two different clocks.</strong> The <em>(range)</em> columns are live: the smart bar posts a view or a login
          as it happens and the gateway writes it onto the company within seconds, so any range from today to twelve months is
          real. The plain Logins and Views columns are the Datatracker&apos;s yearly totals from Performis, loaded nightly, and the
          last column shows all six years — that is the history, from before the live feed existed.
          {data && !data.anyLive ? " No live counters have arrived yet, so the range columns are empty: that is expected until the smart bar has been published and a logged-in customer has opened an article." : ""}
        </Typography>
      </Section>
    </Box>
  );
}
