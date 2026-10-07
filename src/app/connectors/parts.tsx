"use client";

// Shared by the Connectors & Integration pages: the status fetch, the frame
// every page sits in, and the chips that say where a step runs and how it went.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import TablePagination from "@mui/material/TablePagination";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { HAIRLINE, MUTED, TINT, type Tint } from "@/app/uc/report/ui";
import type { Snapshot } from "@/lib/connectors/snapshot";
import type { Phase } from "@/lib/connectors/compass";

export type { Snapshot };

/** "06.10 08:31" from epoch seconds or an ISO string, in local time. */
export function when(t: number | string | null | undefined): string {
  if (t === null || t === undefined || t === "") return "never";
  const d = typeof t === "number" ? new Date(t * 1000) : new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "3 h ago" - for a tile that should say at a glance whether things are fresh. */
export function ago(t: number | null | undefined, now = Date.now()): string {
  if (!t) return "never";
  const s = Math.max(0, now / 1000 - t);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export const PHASE: Record<Phase, { label: string; tint: Tint }> = {
  railway: { label: "On the connector", tint: "slate" },
  porting: { label: "Being ported", tint: "amber" },
  preview: { label: "Preview in the hub", tint: "purple" },
  hub: { label: "In the hub", tint: "green" },
};

export function Chip({ tint, children }: { tint: Tint; children: React.ReactNode }) {
  const t = TINT[tint];
  return (
    <Box component="span" sx={{ display: "inline-block", px: 1, py: 0.2, borderRadius: "8px", bgcolor: t.bg, color: t.fg, fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}

export const TONE: Record<"good" | "warn" | "bad" | "unknown", Tint> = { good: "green", warn: "amber", bad: "pink", unknown: "slate" };

/** The page frame: header with a refresh, then the three states every hub page has. */
export function ConnectorsPage({ title, subtitle, children }: {
  title: string; subtitle: string; children: (s: Snapshot) => React.ReactNode;
}) {
  const [tick, setTick] = useState(0);
  const url = `/api/connectors${tick ? `?refresh=1&n=${tick}` : ""}`;
  const held = useHeld<Snapshot>(url, [url]);
  const r = held.result;
  const header = (
    <PageHeader title={title} subtitle={subtitle} rightSlot={
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
        <Tooltip title="Ask the connector again">
          <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
        </Tooltip>
      </Box>
    } />
  );
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Asking the Compass connector…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="Compass connector" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Compass connector" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else body = children(r.data);
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {header}
      {body}
    </Box>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>{children}</Typography>;
}

/** A page of rows, and the pager under the table - one size everywhere in this app. */
export function usePaged<T>(rows: T[], perPage = 10): { page: number; setPage: (p: number) => void; slice: T[]; pager: React.ReactNode } {
  const [page, setPage] = useState(0);
  const last = Math.max(0, Math.ceil(rows.length / perPage) - 1);
  const p = Math.min(page, last);
  const slice = rows.slice(p * perPage, p * perPage + perPage);
  const pager = rows.length > perPage ? (
    <TablePagination component="div" count={rows.length} page={p} onPageChange={(_, n) => setPage(n)}
      rowsPerPage={perPage} rowsPerPageOptions={[perPage]} labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
      sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
  ) : null;
  return { page: p, setPage, slice, pager };
}

/** Filter chips: one choice at a time, with a count each. */
export function Choice<K extends string>({ value, onChange, options }: {
  value: K; onChange: (k: K) => void; options: { key: K; label: string; count?: number }[];
}) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {options.map((o) => (
        <Box key={o.key} component="button" type="button" onClick={() => onChange(o.key)} sx={{
          all: "unset", cursor: "pointer", px: 1.25, py: 0.5, borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600,
          border: `1px solid ${value === o.key ? "#2459d1" : HAIRLINE}`, color: value === o.key ? "#2459d1" : MUTED,
          bgcolor: value === o.key ? "rgba(36,89,209,.08)" : "rgba(255,255,255,.7)",
          "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
        }}>
          {o.label}{o.count !== undefined ? ` · ${o.count}` : ""}
        </Box>
      ))}
    </Box>
  );
}
