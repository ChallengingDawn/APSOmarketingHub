"use client";

// OTD Reports > Customers (SARCLA 10.11.2026: "a sub app is missing customer, which is list where you can find the detail of
// the OTD then by click customer KPI article order and so forth"): every customer's OTD in the period and filters of the
// page, and - a click on one (?c=) - that customer: its figures, month by month, its late categories, its orders line by
// line, its articles, suppliers, product groups and profit centres. Read from /api/reporting/otd/customers (the morning
// run's lines, lib/reporting/otdLines.ts).

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { MUTED, INK, HAIRLINE } from "@/app/uc/report/ui";
import { ChartBox, FullTable, TWO, setQuery, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { MonthTrend } from "@/app/reporting/eso-benchmark/TicketsCharts";
import { FigureCards, MONTHS, int, pct, type Fig } from "@/app/reporting/products/views/kit";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { SERIES } from "@/app/charts/palette";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { GLC, LATE_CATS, lateCat, type OtdFilter } from "@/lib/reporting/otdRules";
import type { CustomerRow, StoredLine } from "@/lib/reporting/otdLines";
import { PagedBars, PosCell, RateCell } from "./OtdPaged";

/** what the page's frame gives: the months, the month counted by, the filters */
export type CustomerQuery = { from: string; to: string; axis: "promised" | "delivered"; filter: OtdFilter; yms: string[] };

const LATE_COLORS = [SERIES[2], "#f7d9b5", "#f0b47a", "#e5873f", "#c45a1c", "#7d3410"];
const ymLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const dayLabel = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "—");
const days1 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)} days`);
const n0 = (v: number | null) => (v == null ? "—" : int(v));
const pct0 = (v: number | null) => (v == null ? "" : `${Math.round(v * 100)}%`);
const onTime = (n: number, late: number) => (n ? (n - late) / n : null);
const NONE = (what: string) => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;

export function params(q: CustomerQuery, c?: string) {
  const p = new URLSearchParams({ from: q.from, to: q.to, axis: q.axis });
  for (const s of q.filter.src ?? []) p.append("src", s);
  for (const s of q.filter.company ?? []) p.append("mandant", s);
  for (const s of q.filter.st ?? []) p.append("st", s);
  for (const s of q.filter.pc ?? []) p.append("pc", s);
  if (c) p.set("c", c);
  return p.toString();
}
export function useRead<T>(url: string) {
  const [got, setGot] = useState<{ url: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store" }).then(async (r) => {
      const j = (await r.json().catch(() => ({}))) as T & { error?: string };
      if (live) setGot(r.ok ? { url, data: j } : { url, error: j.error ?? `HTTP ${r.status}` });
    }).catch((e: unknown) => { if (live) setGot({ url, error: String((e as Error)?.message ?? e) }); });
    return () => { live = false; };
  }, [url]);
  return got?.url === url ? got : null;
}

/** the page's body: the list, or the customer the address names */
export function CustomerExplorer({ q }: { q: CustomerQuery }) {
  const c = useSearchParams().get("c");
  return c ? <CustomerDetail q={q} c={c} /> : <CustomerList q={q} />;
}

/* ── the list ──────────────────────────────────────────────────────────────────────── */

function CustomerList({ q }: { q: CustomerQuery }) {
  const got = useRead<{ at: string | null; customers: CustomerRow[] }>(`/api/reporting/otd/customers?${params(q)}`);
  if (!got) return <LoadingPanel label="Reading every customer's lines…" />;
  if (got.error) return <UpstreamPanel source="OTD Reports" error={got.error} status={null} onRetry={() => window.location.reload()} />;
  const rows = got.data?.customers ?? [];
  if (!got.data?.at) return NONE("The customers come with the next ERP delivery's run - it keeps every line one by one.");
  if (!rows.length) return NONE("No customer in these months with these filters.");
  // one master table (SARCLA 11.11.2026: "OTD per customer should be only a massive table like in Back-Office reports - with
  // the position colour, sortable, search"): the place by the most late lines, coloured by the share on time
  type R = CustomerRow & { label: string; rate: number | null; pos: number };
  const table: R[] = rows.map((x, i) => ({ ...x, label: x.c, rate: onTime(x.n, x.late), pos: i + 1 }));
  const all = rows.reduce((a, x) => [a[0] + x.n, a[1] + x.late], [0, 0]);
  const cols: Col<R>[] = [
    { key: "pos", head: "#", tip: "The place by the most late lines - green 95 % on time and more, amber 80 to 95 %, red under 80 %", cell: (r) => <PosCell n={r.pos} rate={r.rate} />, sort: (r) => -r.pos },
    { key: "name", head: "Company", cell: (r) => <Box component="span" sx={{ display: "inline-block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom", textAlign: "left" }}>{r.name || "—"}</Box> },
    { key: "owner", head: "Owner", cell: (r) => r.owner || "—" },
    { key: "company", head: "Mandant", cell: (r) => r.company },
    { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
    { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
    { key: "rate", head: "On time", cell: (r) => <RateCell rate={r.rate} />, sort: (r) => r.rate ?? 0 },
    { key: "avg", head: "Average late", cell: (r) => days1(r.late ? r.days / r.late : null), sort: (r) => (r.late ? r.days / r.late : 0) },
    { key: "days", head: "Late days", cell: (r) => int(r.days), sort: (r) => r.days },
    { key: "over10", head: "Over 10 days", cell: (r) => int(r.over10), sort: (r) => r.over10 },
    { key: "orders", head: "Orders late", cell: (r) => `${int(r.lateOrders)} of ${int(r.orders)}`, sort: (r) => r.lateOrders },
  ];
  return (
    <ChartBox title={`Every customer, ${int(rows.length)}`} hint={`all of them together ${pct(onTime(all[0], all[1]))} on time · the most late lines first, a header sorts · search a customer number, company or owner · a click opens the customer: its figures, orders line by line, articles and suppliers`}>
      <FullTable first="Customer" find="a customer, company or owner" findIn={(r) => `${r.c} ${r.name} ${r.owner}`} initial="late" rows={table} cols={cols}
        onPick={(label) => setQuery((p) => { p.set("c", label); })} />
    </ChartBox>
  );
}

/* ── one customer ──────────────────────────────────────────────────────────────────── */

type Detail = { c: string; name: string; owner: string; lines: StoredLine[]; info: Record<string, [string, string, string]> };

function CustomerDetail({ q, c }: { q: CustomerQuery; c: string }) {
  const got = useRead<{ at: string | null; customer?: Detail }>(`/api/reporting/otd/customers?${params(q, c)}`);
  const [order, setOrder] = useState<string | null>(null);
  const back = (
    <Button onClick={() => setQuery((p) => { p.delete("c"); })} startIcon={<ArrowBackIcon />} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px", justifySelf: "start" }}>
      Every customer
    </Button>
  );
  const d = got?.data?.customer;
  const view = useMemo(() => (d ? summarize(d, q) : null), [d, q]);
  if (!got) return <Box sx={{ display: "grid", gap: 1 }}>{back}<LoadingPanel label="Reading the customer's lines…" /></Box>;
  if (got.error) return <Box sx={{ display: "grid", gap: 1 }}>{back}<UpstreamPanel source="OTD Reports" error={got.error} status={null} onRetry={() => window.location.reload()} /></Box>;
  if (!d || !view || !d.lines.length) return <Box sx={{ display: "grid", gap: 1 }}>{back}{NONE(`No line of ${c} in these months with these filters.`)}</Box>;
  const v = view;
  const figs: Fig[] = [
    { label: "On time", value: pct(onTime(v.n, v.late)), sub: `${int(v.n)} lines`, icon: <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />, tint: "green" },
    { label: "Late lines", value: int(v.late), sub: `${int(v.over10)} more than 10 days`, icon: <WarningAmberOutlinedIcon sx={{ fontSize: 14 }} />, tint: "pink" },
    { label: "Days late, on average", value: days1(v.late ? v.days / v.late : null), lower: true, sub: "the late lines", icon: <EventRepeatOutlinedIcon sx={{ fontSize: 14 }} />, tint: "amber" },
    { label: "Orders late", value: `${int(v.lateOrders)} of ${int(v.orders.length)}`, sub: "one late line or more", icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />, tint: "blue" },
  ];
  const sel = order ? v.orders.find((o) => o.label === order) : null;
  return (
    <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
      {back}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto" }, alignItems: "start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{d.name || c}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5 }}>{c}{d.owner ? ` · owner ${d.owner}` : ""} · mandant {v.mandant} · {int(v.articles.length)} articles · {int(v.orders.length)} orders</Typography>
        </Box>
        <FigureCards items={figs} />
      </Box>
      <Box sx={TWO}>
        <ChartBox title="On time, month by month" hint={q.axis === "promised" ? "by the month of the first confirmed date" : "by the month the line reached the customer"}>
          <MonthTrend values={v.months.map((m) => onTime(m.n, m.late))} labels={q.yms.map(ymLabel)} label="On time" fmt={pct} tick={pct0} height={230} />
        </ChartBox>
        <ChartBox title="How late, month by month" hint="the lines per late category of the OTD analysis file">
          <StackedColumns ordinal data={v.months.map((m, i) => ({ x: ymLabel(q.yms[i]), ...Object.fromEntries(m.cat.map((n, j) => [`c${j}`, n])) }))}
            parts={LATE_CATS.map((label, j) => ({ key: `c${j}`, label, color: LATE_COLORS[j] }))} format={n0} height={230} />
        </ChartBox>
      </Box>
      <ChartBox title={`Orders, ${int(v.orders.length)}`} hint="each order's lines: when ordered, first confirmed, shipped and at the customer · a click shows its lines · the most late lines first">
        <FullTable first="Order" find="an order" initial="late" rows={v.orders} selected={order ? [order] : []} onPick={(l) => setOrder((x) => (x === l ? null : l))} cols={[
          { key: "ordered", head: "Ordered", cell: (r) => dayLabel(r.orderDay) },
          { key: "first", head: "First confirmed", cell: (r) => dayLabel(r.firstDay) },
          { key: "ship", head: "Shipped", cell: (r) => dayLabel(r.shipDay) },
          { key: "at", head: "At the customer", cell: (r) => dayLabel(r.atCustomer) },
          { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
          { key: "late", head: "Late lines", cell: (r) => int(r.late), sort: (r) => r.late },
          { key: "max", head: "Most days late", cell: (r) => (r.max > 0 ? int(r.max) : "—"), sort: (r) => r.max },
        ]} />
        {sel && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(21,34,58,.03)" }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 1 }}>{sel.label} - its lines</Typography>
            <FullTable first="Line · article number" natural rows={sel.lines.map((l) => ({ ...l, label: `${l.line} · ${l.a}` }))} cols={[
              { key: "text", head: "Article name", cell: (l) => <Box component="span" sx={{ display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom" }}>{d.info[l.a]?.[0] || "—"}</Box> },
              { key: "group", head: "Product group", cell: (l) => l.group || "—" },
              { key: "sup", head: "Supplier", cell: (l) => l.sup || GLC },
              { key: "first", head: "First confirmed", cell: (l) => dayLabel(l.firstDay) },
              { key: "conf", head: "Last confirmed", cell: (l) => dayLabel(l.confDay) },
              { key: "ship", head: "Shipped", cell: (l) => dayLabel(l.shipDay) },
              { key: "at", head: "At the customer", cell: (l) => dayLabel(l.atCustomer) },
              { key: "late", head: "Days late", cell: (l) => (l.late > 0 ? `+${l.late}` : String(l.late)), sort: (l) => l.late },
            ]} />
          </Box>
        )}
      </ChartBox>
      <ChartBox title={`Articles, ${int(v.articles.length)}`} hint="each article the customer received in these months · the most late lines first">
        <FullTable first="Article number" find="an article number or name" findIn={(r) => `${r.label} ${r.text}`} initial="late" rows={v.articles} cols={[
          { key: "text", head: "Name", cell: (r) => <Box component="span" sx={{ display: "inline-block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom" }}>{r.text || "—"}</Box> },
          { key: "group", head: "Product group", cell: (r) => r.group || "—" },
          { key: "sup", head: "Supplier", cell: (r) => r.sup || GLC },
          { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
          { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
          { key: "rate", head: "On time", cell: (r) => pct(onTime(r.n, r.late)), sort: (r) => onTime(r.n, r.late) ?? 0 },
          { key: "avg", head: "Average late", cell: (r) => days1(r.late ? r.days / r.late : null), sort: (r) => (r.late ? r.days / r.late : 0) },
        ]} />
      </ChartBox>
      <Box sx={TWO}>
        <ChartBox title="Late lines per supplier" hint="GLC = no supplier in the ERP: cut to size and made in house · every supplier with a late line, 10 a page">
          <PagedBars rows={v.suppliers} format={n0} emptyMessage="No late line." />
        </ChartBox>
        <ChartBox title="Late lines per product group" hint="the nightly article master's main group">
          <BarList rows={v.groups} format={n0} labelWidth={200} emptyMessage="No late line." />
        </ChartBox>
      </Box>
    </Box>
  );
}

type OrderRow = { label: string; orderDay: string; firstDay: string; shipDay: string; atCustomer: string; n: number; late: number; max: number; lines: StoredLine[] };
type ArticleRow = { label: string; text: string; group: string; sup: string; n: number; late: number; days: number };

/** one customer's lines -> its figures, months, orders, articles, suppliers and groups */
function summarize(d: Detail, q: CustomerQuery) {
  const at = new Map(q.yms.map((ym, i) => [ym, i]));
  const months = q.yms.map(() => ({ n: 0, late: 0, cat: Array(6).fill(0) as number[] }));
  let n = 0, late = 0, days = 0, over10 = 0;
  const orders = new Map<string, OrderRow>(), arts = new Map<string, ArticleRow>();
  const sup = new Map<string, [number, number]>(), grp = new Map<string, [number, number]>();
  const mandants = new Set<string>();
  for (const l of d.lines) {
    const isLate = l.late > 0;
    n++; if (isLate) { late++; days += l.late; if (l.late > 10) over10++; }
    mandants.add(l.company);
    const i = at.get((q.axis === "delivered" ? l.atCustomer : l.firstDay).slice(0, 7));
    if (i !== undefined) { months[i].n++; if (isLate) months[i].late++; months[i].cat[lateCat(l.late)]++; }
    const o = orders.get(l.order) ?? { label: l.order, orderDay: l.orderDay, firstDay: l.firstDay, shipDay: l.shipDay, atCustomer: l.atCustomer, n: 0, late: 0, max: 0, lines: [] };
    o.n++; if (isLate) o.late++; o.max = Math.max(o.max, l.late); o.lines.push(l);
    if (l.firstDay < o.firstDay) o.firstDay = l.firstDay;
    if (l.shipDay > o.shipDay) o.shipDay = l.shipDay;
    if (l.atCustomer > o.atCustomer) o.atCustomer = l.atCustomer;
    orders.set(l.order, o);
    const a = arts.get(l.a) ?? { label: l.a, text: d.info[l.a]?.[0] ?? "", group: l.group, sup: l.sup, n: 0, late: 0, days: 0 };
    a.n++; if (isLate) { a.late++; a.days += l.late; }
    arts.set(l.a, a);
    const s = sup.get(l.sup || GLC) ?? [0, 0]; s[0]++; if (isLate) s[1]++; sup.set(l.sup || GLC, s);
    const g = grp.get(l.group || "No product group") ?? [0, 0]; g[0]++; if (isLate) g[1]++; grp.set(l.group || "No product group", g);
  }
  for (const o of orders.values()) o.lines.sort((a, b) => Number(a.line) - Number(b.line));
  const bars = (m: Map<string, [number, number]>, n = 12) => [...m].filter(([, v]) => v[1] > 0).sort((a, b) => b[1][1] - a[1][1]).slice(0, n)
    .map(([label, v]) => ({ label, value: v[1], secondary: `of ${int(v[0])} lines · ${pct(onTime(v[0], v[1]))} on time` }));
  const orderList = [...orders.values()];
  return {
    n, late, days, over10, months, mandant: [...mandants].sort().join(" + "),
    orders: orderList, lateOrders: orderList.filter((o) => o.late > 0).length,
    articles: [...arts.values()], suppliers: bars(sup, Infinity), groups: bars(grp),
  };
}
