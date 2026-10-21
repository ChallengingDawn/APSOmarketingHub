"use client";
// A breakdown's chart, its bars the filter - two figures side by side per row (this period against the year
// before on Who are our customers; now against the best year on Retain & grow), the largest first, a page
// at a time. Moved out of Customers.tsx (20.10.2026) so every tab draws the same chart (SARCLA: "learn from
// the other tabs").

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INK, MUTED, TINT, glass } from "@/app/uc/report/ui";

/** The first figure's colour, and the second's (the year before, the best year) - as on every tab. */
export const THIS = "#2d6fa8", BEFORE = "#b9c0c9";

/** A row the chart can draw: its label (also what a click picks); revenue, when it has it, breaks ties. */
export type ChartRow = { label: string; rev?: number };

export function DimChart<T extends ChartRow>({ title, rows: given, cur, prev, curLabel, prevLabel, fmt, selected, onPick, onFilter, filterLabel, pageSize = 10, fixedOrder = false, actions, curColor = THIS, prevColor = BEFORE, single = false }: {
  title: string; rows: T[]; cur: (r: T) => number; prev: (r: T) => number; curLabel: string; prevLabel: string;
  fmt: (n: number) => string; selected?: string[];
  /** a click on a bar picks its row - left out where the bars cannot filter (ESO's breakdowns: the read holds the reps only) */
  onPick?: (label: string) => void; onFilter?: () => void; filterLabel?: string; pageSize?: number;
  /** the tile toolbar: tasks (with their Scroll to Sale tickets), promote */
  actions?: React.ReactNode;
  /** priority and potential keep their own order; every other chart ranks by what it shows */
  fixedOrder?: boolean;
  /** the two bars' colours - this period and the year before unless given */
  curColor?: string; prevColor?: string;
  /** one figure only - no second bar */
  single?: boolean;
}) {
  // a chart ranks by its own figure - companies by companies, revenue by revenue (SARCLA 16.10:
  // "this should follow revenue or customer count on top depending on the value")
  const rows = useMemo(() => (fixedOrder ? given : [...given].sort((a, b) => cur(b) - cur(a) || (b.rev ?? 0) - (a.rev ?? 0) || a.label.localeCompare(b.label))), [given, fixedOrder, cur]);
  // every value, a page at a time - the largest first (SARCLA 14.10: "only 10 is cool, but show all in pages")
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  const data = slice.map((r) => ({ label: r.label, cur: Math.max(0, cur(r)), prev: Math.max(0, prev(r)) }));
  const pick = (d: unknown) => { const l = (d as { payload?: { label?: string } })?.payload?.label; if (l) onPick?.(l); };
  const hint = [onPick ? "Click bars to show only them" : "", pages > 1 ? `${page * pageSize + 1}–${Math.min(rows.length, (page + 1) * pageSize)} of ${rows.length}, largest first` : ""].filter(Boolean).join(" · ");
  const tall = Math.min(rows.length, pageSize);
  const nav = { width: 30, height: 30, border: "1px solid rgba(21,34,58,.12)", borderRadius: "9px" };
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>{hint}</Typography>}
        </Box>
        {pages > 1 && (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton size="small" aria-label="The previous ones" disabled={page === 0} onClick={() => setPage((x) => Math.max(0, x - 1))} sx={nav}><ChevronLeftIcon sx={{ fontSize: 18 }} /></IconButton>
            <IconButton size="small" aria-label="The next ones" disabled={page >= pages - 1} onClick={() => setPage((x) => Math.min(pages - 1, x + 1))} sx={nav}><ChevronRightIcon sx={{ fontSize: 18 }} /></IconButton>
          </Box>
        )}
        {onFilter && (
          <IconButton size="small" aria-label={filterLabel ?? "Filter"} title={filterLabel} onClick={onFilter} sx={{ ...nav, color: selected?.length ? TINT.blue.fg : MUTED, bgcolor: selected?.length ? TINT.blue.bg : "transparent" }}>
            <FilterAltOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
        {actions}
      </Box>
      <ResponsiveContainer width="100%" height={Math.max(140, tall * 44 + 56)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 120, bottom: 4, left: 4 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke="#e6e8ec" />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={170} tickLine={false} axisLine={false} interval={0}
            tick={{ fontSize: 12.5, fill: INK }} />
          <Tooltip cursor={{ fill: "rgba(21,34,58,.04)" }} formatter={(v: unknown, n: unknown) => [fmt(Number(v)), String(n)]}
            contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }} />
          <Legend verticalAlign="top" align="left" height={26} iconType="circle" itemSorter="dataKey" wrapperStyle={{ fontSize: "0.78rem" }} />
          <Bar dataKey="cur" name={curLabel} fill={curColor} radius={[0, 4, 4, 0]} cursor={onPick ? "pointer" : undefined} onClick={pick} isAnimationActive={false} maxBarSize={16}>
            {data.map((d) => <Cell key={d.label} fill={curColor} fillOpacity={selected?.length && !selected.includes(d.label) ? 0.3 : 1} />)}
            <LabelList dataKey="cur" position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 12, fill: INK, fontWeight: 700 }} />
          </Bar>
          {!single && (
          <Bar dataKey="prev" name={prevLabel} fill={prevColor} radius={[0, 4, 4, 0]} cursor={onPick ? "pointer" : undefined} onClick={pick} isAnimationActive={false} maxBarSize={16}>
            {data.map((d) => <Cell key={d.label} fill={prevColor} fillOpacity={selected?.length && !selected.includes(d.label) ? 0.3 : 1} />)}
            <LabelList dataKey="prev" position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 11.5, fill: MUTED }} />
          </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
