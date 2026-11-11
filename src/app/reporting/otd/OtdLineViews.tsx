"use client";

// OTD Reports - two views read from the lines kept one by one (lib/reporting/otdLines.ts, /api/reporting/otd/customers?view=):
// every supplier's on time and lead times (SARCLA 11.11.2026: "on the supplier lead time you need to put them all, and as a
// table as well, before"), and GLC's kinds with the companies that received them ("we should have the companies and a
// different icon on the graph"). Both follow the page's period, month axis and filters, like the Customers page.

import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { MUTED } from "@/app/uc/report/ui";
import { ChartBox, FullTable, TWO, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { int, pct } from "@/app/reporting/products/views/kit";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { SERIES } from "@/app/charts/palette";
import { PagedBars, PosCell, RateCell } from "./OtdPaged";
import { GLC_KINDS } from "@/lib/reporting/otdRules";
import type { ArticleRow, GlcCustomerRow, GlcKindRow, SupplierRow } from "@/lib/reporting/otdLines";
import { params, useRead, type CustomerQuery } from "./OtdCustomers";

const days1 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)} days`);
const onTime = (n: number, late: number) => (n ? (n - late) / n : null);
const avg = (sum: number, n: number) => (n ? sum / n : null);
const NONE = (what: string) => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;
const supName = (s: string) => (s ? s.replace(/\s*\(Konsi\)/i, "").split(",")[0].trim() : "GLC");
const cut = (s: string, w = 260) => <Box component="span" sx={{ display: "inline-block", maxWidth: w, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom" }}>{s || "—"}</Box>;
const LATER = "Comes with the next ERP delivery's run - it keeps every line one by one.";

/* ── every supplier: the table first, then the graph ───────────────────────────────── */

/** `fallback`: the cube's graph, while no run has kept the lines yet */
export function SupplierLeads({ q, fallback }: { q: CustomerQuery; fallback: React.ReactNode }) {
  const got = useRead<{ at: string | null; suppliers?: SupplierRow[] }>(`/api/reporting/otd/customers?${params(q)}&view=suppliers`);
  if (!got) return <LoadingPanel label="Reading every supplier's lines…" />;
  if (got.error) return <UpstreamPanel source="OTD Reports" error={got.error} status={null} onRetry={() => window.location.reload()} />;
  if (!got.data?.at) {
    return <ChartBox title="Real lead time of the suppliers with the most lines" hint={`every supplier, in figures: ${LATER.toLowerCase()}`}>{fallback}</ChartBox>;
  }
  const list = got.data.suppliers ?? [];
  if (!list.length) return NONE("No line in these months with these filters.");
  type R = { label: string; n: number; late: number; rate: number | null; avgLate: number | null; over10: number; p: number | null; o: number | null; t: number | null; r: number | null };
  const rows: R[] = list.map((x) => ({
    label: supName(x.sup), n: x.n, late: x.late, rate: onTime(x.n, x.late), avgLate: avg(x.days, x.late), over10: x.over10,
    p: avg(x.promised, x.n), o: avg(x.proc, x.n), t: avg(x.transport, x.n), r: avg(x.real, x.n),
  }));
  const cols: Col<R>[] = [
    { key: "n", head: "Lines", cell: (x) => int(x.n), sort: (x) => x.n },
    { key: "late", head: "Late", cell: (x) => int(x.late), sort: (x) => x.late },
    { key: "rate", head: "On time", cell: (x) => pct(x.rate), sort: (x) => x.rate ?? 0 },
    { key: "p", head: "Promised", tip: "order to the first confirmed date", cell: (x) => days1(x.p), sort: (x) => x.p ?? 0 },
    { key: "o", head: "Processing", tip: "order to the shipment", cell: (x) => days1(x.o), sort: (x) => x.o ?? 0 },
    { key: "t", head: "Transport", tip: "shipment to the customer", cell: (x) => days1(x.t), sort: (x) => x.t ?? 0 },
    { key: "r", head: "Real", tip: "order to the customer", cell: (x) => days1(x.r), sort: (x) => x.r ?? 0 },
    { key: "gap", head: "Real minus promised", cell: (x) => (x.r == null || x.p == null ? "—" : days1(x.r - x.p)), sort: (x) => (x.r ?? 0) - (x.p ?? 0) },
    { key: "avg", head: "Average late", cell: (x) => days1(x.avgLate), sort: (x) => x.avgLate ?? 0 },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
      <ChartBox title={`Every supplier's lead time, ${int(rows.length)} suppliers`} hint="working days, on average · GLC = no supplier in the ERP: cut to size and made in house · the most lines first, a header sorts">
        <FullTable first="Supplier" find="a supplier" initial="n" rows={rows} cols={cols} />
      </ChartBox>
      <ChartBox title="Real lead time of every supplier" hint="working days from the order to the customer, on average · the most lines first, 15 a page">
        <PagedBars rows={rows.map((x) => ({ label: x.label, value: x.r, secondary: `${int(x.n)} lines · promised ${days1(x.p)}` }))} size={15} format={days1} />
      </ChartBox>
    </Box>
  );
}

/* ── GLC: each kind with its own icon, and the companies ───────────────────────────── */

const KIND_LOOK: { label: string; short: string }[] = [
  { label: "DirectCut: a whole leftover", short: "DirectCut leftover" },
  { label: "DirectCut: cut on the saw", short: "DirectCut cut on the saw" },
  { label: "Not a DirectCut order", short: "Not a DirectCut order" },
];

export function GlcCompanies({ q }: { q: CustomerQuery }) {
  const router = useRouter();
  const here = useSearchParams();
  const got = useRead<{ at: string | null; kinds?: GlcKindRow[]; customers?: GlcCustomerRow[] }>(`/api/reporting/otd/customers?${params(q)}&view=glc`);
  if (!got) return <LoadingPanel label="Reading GLC's lines…" />;
  if (got.error) return <UpstreamPanel source="OTD Reports" error={got.error} status={null} onRetry={() => window.location.reload()} />;
  if (!got.data?.at) return <ChartBox title="GLC: leftover, cut to size and the rest - and the companies" hint="DirectCut's orders by what it did">{NONE(LATER)}</ChartBox>;
  const kinds = got.data.kinds ?? [], list = got.data.customers ?? [];
  if (!list.length) return <ChartBox title="GLC: leftover, cut to size and the rest - and the companies" hint="DirectCut's orders by what it did">{NONE("No GLC line in these months with these filters.")}</ChartBox>;
  // how much of GLC DirectCut can tell at all: it knows only its own orders (the shop's cut articles, since autumn 2026)
  const glcAll = kinds.reduce((a, k) => a + k[0], 0), known = (kinds[0]?.[0] ?? 0) + (kinds[1]?.[0] ?? 0);
  // the kinds as real graphs (SARCLA 11.11.2026: "put this as a real graph, not these small replicas"): on time and late of
  // each kind side by side, and how many lines, companies and days to shipment each holds
  const shown = kinds.map((k, i) => ({ k, i })).filter(({ k }) => k[0] > 0);
  const stacks = shown.map(({ k, i }) => ({ x: KIND_LOOK[i].short, on: k[0] ? (k[0] - k[1]) / k[0] : null, late: k[0] ? k[1] / k[0] : null }));
  const volume = shown.map(({ k, i }) => ({
    label: KIND_LOOK[i].label, value: k[0],
    secondary: `${pct(glcAll ? k[0] / glcAll : null)} of GLC · ${int(k[1])} late · ${int(k[4])} compan${k[4] === 1 ? "y" : "ies"} · ${days1(avg(k[3], k[0]))} to shipment`,
  }));
  type R = GlcCustomerRow & { label: string; rate: number | null };
  const rows: R[] = list.map((x) => ({ ...x, label: x.c, rate: onTime(x.n, x.late) }));
  const kindCol = (i: number): Col<R> => ({
    key: `k${i}`, head: KIND_LOOK[i].label, tip: GLC_KINDS[i],
    cell: (r) => (r.kinds[i][0] ? `${int(r.kinds[i][0])}${r.kinds[i][1] ? ` · ${int(r.kinds[i][1])} late` : ""}` : "—"), sort: (r) => r.kinds[i][0],
  });
  const cols: Col<R>[] = [
    { key: "name", head: "Company", cell: (r) => cut(r.name) },
    { key: "owner", head: "Owner", cell: (r) => r.owner || "—" },
    { key: "company", head: "Mandant", cell: (r) => r.company },
    { key: "n", head: "GLC lines", cell: (r) => int(r.n), sort: (r) => r.n },
    kindCol(0), kindCol(1), kindCol(2),
    { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
    { key: "rate", head: "On time", cell: (r) => pct(r.rate), sort: (r) => r.rate ?? 0 },
    { key: "avg", head: "Average late", cell: (r) => days1(avg(r.days, r.late)), sort: (r) => avg(r.days, r.late) ?? 0 },
  ];
  const open = (c: string) => {
    const p = new URLSearchParams(here.toString());
    p.delete("tab"); p.set("c", c);
    router.push(`/reporting/otd/customers?${p.toString()}`);
  };
  return (
    <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
      <ChartBox title="GLC lines: what DirectCut did with them"
        hint={`GLC = the order lines whose article has no supplier: cut to size or made in house · DirectCut (the shop's cutting system, since autumn 2026) knows ${int(known)} of these ${int(glcAll)} GLC lines (${pct(glcAll ? known / glcAll : null)}): a whole leftover piece sent off the shelf, or a piece cut on the saw · "Not a DirectCut order" = every other GLC line - ordered before DirectCut, typed in by the Back Office or made in house - DirectCut cannot say what was done`}>
        <Box sx={TWO}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, mb: 0.5 }}>On time and late, kind by kind</Typography>
            <StackedColumns ordinal xFormat={(x) => x} data={stacks}
              parts={[{ key: "on", label: "On time", color: SERIES[2] }, { key: "late", label: "Late", color: "#c45a1c" }]}
              format={pct} tickFormat={(v) => (v == null ? "" : `${Math.round(v * 100)}%`)} height={280} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, mb: 0.5 }}>How many lines, kind by kind</Typography>
            <BarList rows={volume} format={(v) => (v == null ? "—" : int(v))} labelWidth={220} />
          </Box>
        </Box>
      </ChartBox>
      <ChartBox title={`The companies that received GLC lines, ${int(rows.length)}`} hint="each company's GLC lines per kind · a click opens the company on the Customers page: its figures, orders line by line and articles">
        <FullTable first="Customer" find="a customer or company" initial="n" rows={rows} cols={cols} onPick={open} />
      </ChartBox>
    </Box>
  );
}

/* ── every article, one master table (SARCLA 11.11.2026: "misses also a tab article level", "product number next to name") ── */

export function ArticleMaster({ q }: { q: CustomerQuery }) {
  const got = useRead<{ at: string | null; articles?: ArticleRow[] }>(`/api/reporting/otd/customers?${params(q)}&view=articles`);
  if (!got) return <LoadingPanel label="Reading every article's lines…" />;
  if (got.error) return <UpstreamPanel source="OTD Reports" error={got.error} status={null} onRetry={() => window.location.reload()} />;
  if (!got.data?.at) return <ChartBox title="Every article" hint="">{NONE(LATER)}</ChartBox>;
  const list = got.data.articles ?? [];
  if (!list.length) return <ChartBox title="Every article" hint="">{NONE("No line in these months with these filters.")}</ChartBox>;
  type R = ArticleRow & { label: string; rate: number | null; pos: number };
  const rows: R[] = list.map((x, i) => ({ ...x, label: x.a, rate: onTime(x.n, x.late), pos: i + 1 }));
  const all = list.reduce((a, x) => [a[0] + x.n, a[1] + x.late], [0, 0]);
  const cols: Col<R>[] = [
    { key: "pos", head: "#", tip: "The place by the most late lines - green 95 % on time and more, amber 80 to 95 %, red under 80 %", cell: (r) => <PosCell n={r.pos} rate={r.rate} />, sort: (r) => -r.pos },
    { key: "name", head: "Name", cell: (r) => cut(r.name, 300) },
    { key: "group", head: "Product group", cell: (r) => r.group || "—" },
    { key: "product", head: "Product", cell: (r) => cut(r.product, 180) },
    { key: "pc", head: "Profit centre", cell: (r) => r.pc || "—" },
    { key: "sup", head: "Supplier", cell: (r) => cut(supName(r.sup), 180) },
    { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
    { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
    { key: "rate", head: "On time", cell: (r) => <RateCell rate={r.rate} />, sort: (r) => r.rate ?? 0 },
    { key: "avg", head: "Average late", cell: (r) => days1(avg(r.days, r.late)), sort: (r) => avg(r.days, r.late) ?? 0 },
    { key: "over10", head: "Over 10 days", cell: (r) => int(r.over10), sort: (r) => r.over10 },
    { key: "cust", head: "Customers", cell: (r) => int(r.customers), sort: (r) => r.customers },
    { key: "orders", head: "Orders", cell: (r) => int(r.orders), sort: (r) => r.orders },
  ];
  return (
    <ChartBox title={`Every article, ${int(rows.length)}`} hint={`all of them together ${pct(onTime(all[0], all[1]))} on time · the article number, its name beside it · the most late lines first, a header sorts · search a number, name, group, product or supplier`}>
      <FullTable first="Article number" find="an article, name, group or supplier" findIn={(r) => `${r.a} ${r.name} ${r.group} ${r.product} ${r.sup}`} initial="late" rows={rows} cols={cols} />
    </ChartBox>
  );
}
