"use client";

// OTD Reports - two views read from the lines kept one by one (lib/reporting/otdLines.ts, /api/reporting/otd/customers?view=):
// every supplier's on time and lead times (SARCLA 11.11.2026: "on the supplier lead time you need to put them all, and as a
// table as well, before"), and GLC's kinds with the companies that received them ("we should have the companies and a
// different icon on the graph"). Both follow the page's period, month axis and filters, like the Customers page.

import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { MUTED, type Tint } from "@/app/uc/report/ui";
import { ChartBox, FullTable, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { FigureCards, int, pct, type Fig } from "@/app/reporting/products/views/kit";
import { PagedBars } from "./OtdPaged";
import { GLC_KINDS } from "@/lib/reporting/otdRules";
import type { GlcCustomerRow, GlcKindRow, SupplierRow } from "@/lib/reporting/otdLines";
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

const KIND_LOOK: { label: string; icon: React.ReactNode; tint: Tint }[] = [
  { label: "Leftover off the shelf", icon: <Inventory2OutlinedIcon sx={{ fontSize: 14 }} />, tint: "green" },
  { label: "Cut to size on the saw", icon: <ContentCutOutlinedIcon sx={{ fontSize: 14 }} />, tint: "purple" },
  { label: "Other in-house", icon: <PrecisionManufacturingOutlinedIcon sx={{ fontSize: 14 }} />, tint: "slate" },
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
  const figs: Fig[] = kinds.map((k, i) => ({
    label: KIND_LOOK[i].label, value: pct(onTime(k[0], k[1])), icon: KIND_LOOK[i].icon, tint: KIND_LOOK[i].tint,
    sub: `${int(k[0])} lines · ${int(k[1])} late · ${int(k[4])} compan${k[4] === 1 ? "y" : "ies"} · ${days1(avg(k[3], k[0]))} to shipment`,
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
      <ChartBox title="GLC: leftover, cut to size and the rest" hint="the share on time of each kind · DirectCut's orders (the shop, since autumn 2026) by what it did: a whole piece off the shelf or cut on the saw; the rest = the other lines without a supplier">
        <FigureCards items={figs} />
      </ChartBox>
      <ChartBox title={`The companies that received GLC lines, ${int(rows.length)}`} hint="each company's GLC lines per kind · a click opens the company on the Customers page: its figures, orders line by line and articles">
        <FullTable first="Customer" find="a customer or company" initial="n" rows={rows} cols={cols} onPick={open} />
      </ChartBox>
    </Box>
  );
}
