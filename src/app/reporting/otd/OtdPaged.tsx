"use client";

// OTD Reports: a list of bars a page at a time - every supplier, never a top N cut off (SARCLA 11.11.2026: "paginate
// supplier whenever they appear"). Its own file: OtdReports, OtdCustomers and OtdLineViews all draw it.

import Box from "@mui/material/Box";
import { PageBar, usePages } from "@/app/reporting/eso-benchmark/Figures";
import { BarList, type BarRow } from "@/app/charts/BarList";

/** the bars a page at a time, one scale across the pages */
export function PagedBars({ rows, size = 10, format, labelWidth = 200, max, emptyMessage }: {
  rows: BarRow[]; size?: number; format: (v: number | null) => string; labelWidth?: number; max?: number; emptyMessage?: string;
}) {
  const { page, pages, setPage, slice } = usePages(rows, size);
  const full = max ?? Math.max(0, ...rows.map((r) => (typeof r.value === "number" ? r.value : 0)));
  return (
    <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
      <BarList rows={slice} format={format} labelWidth={labelWidth} max={full} emptyMessage={emptyMessage} />
      <PageBar page={page} pages={pages} setPage={setPage} from={page * size + 1} to={page * size + slice.length} of={rows.length} />
    </Box>
  );
}

/* ── the master tables' pieces (SARCLA 11.11.2026: "a massive table like in Back-Office reports, with the position colour,
 *    sortable, search") - the position by the most late lines, its colour by the share on time ── */

/** the share on time's band: 95 % and more green, 80 to 95 amber, under 80 red */
export const BAND = (rate: number | null) =>
  rate == null ? { fg: "#5f6b7a", bg: "rgba(21,34,58,.06)" } : rate >= 0.95 ? { fg: "#1e7e34", bg: "rgba(30,126,52,.12)" } : rate >= 0.8 ? { fg: "#9a5b00", bg: "rgba(176,96,0,.13)" } : { fg: "#b3261e", bg: "rgba(179,38,30,.12)" };
/** the row's place, in its band's colour */
export function PosCell({ n, rate }: { n: number; rate: number | null }) {
  const b = BAND(rate);
  return (
    <Box component="span" title={rate == null ? undefined : `${Math.round(rate * 1000) / 10}% on time`} sx={{ display: "inline-flex", minWidth: 34, height: 22, px: 0.75, alignItems: "center", justifyContent: "center",
      borderRadius: "4px", bgcolor: b.bg, color: b.fg, fontWeight: 800, fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" }}>{n}</Box>
  );
}
/** the share on time, in its band's colour */
export function RateCell({ rate }: { rate: number | null }) {
  const b = BAND(rate);
  return <Box component="span" sx={{ color: b.fg, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{rate == null ? "—" : `${(rate * 100).toFixed(1)}%`}</Box>;
}
