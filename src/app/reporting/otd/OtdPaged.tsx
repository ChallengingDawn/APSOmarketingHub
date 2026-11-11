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
