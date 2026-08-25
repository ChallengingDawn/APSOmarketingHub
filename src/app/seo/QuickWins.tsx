"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import EditNote from "@mui/icons-material/EditNote";
import type { GscRow } from "./gscClient";
import {
  QW_MIN_IMPRESSIONS,
  QW_POSITION_MAX,
  QW_POSITION_MIN,
  quickWinsOf,
  type QuickWin,
} from "./analysis";
import DataTable, { type Column } from "./DataTable";
import {
  DISPLAY,
  Explainer,
  HAIRLINE,
  HairlineCard,
  INK,
  MUTED,
  NAVY,
  SURFACE,
  SectionLabel,
  fmtCtr,
  fmtInt,
  fmtPosition,
} from "./ui";

/** Matches the /create convention: `channel` is read by src/app/create/page.tsx. */
function createHref(query: string): string {
  return `/create?channel=blog&topic=${encodeURIComponent(query)}`;
}

export default function QuickWins({ queries, loading, days }: { queries: GscRow[]; loading: boolean; days: number }) {
  const rows = useMemo(() => quickWinsOf(queries), [queries]);
  const rowKey = useCallback((r: QuickWin) => r.key, []);
  const searchText = useCallback((r: QuickWin) => r.key, []);

  const columns: Column<QuickWin>[] = [
    {
      id: "key",
      label: "Query",
      sortValue: (r) => r.key.toLowerCase(),
      render: (r) => (
        <Tooltip title={r.key} placement="top-start">
          <Typography
            sx={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: INK,
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.key}
          </Typography>
        </Tooltip>
      ),
    },
    {
      id: "impressions",
      label: "Impressions",
      numeric: true,
      width: 118,
      sortValue: (r) => r.impressions,
      hint: "Score input 1 — how many people saw this query's results in the window.",
      render: (r) => fmtInt(r.impressions),
    },
    {
      id: "position",
      label: "Position",
      numeric: true,
      width: 96,
      sortValue: (r) => r.position,
      hint: "Score input 2 — average position. Lower is better.",
      render: (r) => fmtPosition(r.position),
    },
    {
      id: "proximity",
      label: "Proximity",
      numeric: true,
      width: 106,
      sortValue: (r) => r.proximity,
      hint: `(${QW_POSITION_MAX + 1} − position) ÷ ${QW_POSITION_MAX + 1 - QW_POSITION_MIN}. 1.00 at position ${QW_POSITION_MIN}, 0.09 at position ${QW_POSITION_MAX}.`,
      render: (r) => r.proximity.toFixed(2),
    },
    {
      id: "score",
      label: "Opportunity",
      numeric: true,
      width: 120,
      sortValue: (r) => r.score,
      hint: "impressions × proximity. Both inputs are in the row — nothing hidden.",
      render: (r) => (
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: NAVY, fontVariantNumeric: "tabular-nums" }}>
          {fmtInt(r.score)}
        </Typography>
      ),
    },
    {
      id: "clicks",
      label: "Clicks now",
      numeric: true,
      width: 104,
      sortValue: (r) => r.clicks,
      render: (r) => fmtInt(r.clicks),
    },
    {
      id: "ctr",
      label: "CTR",
      numeric: true,
      width: 90,
      sortValue: (r) => r.ctr,
      render: (r) => fmtCtr(r.ctr),
    },
    {
      id: "action",
      label: "Action",
      width: 156,
      render: (r) => (
        <Button
          component={Link}
          href={createHref(r.key)}
          size="small"
          variant="contained"
          disableElevation
          startIcon={<EditNote sx={{ fontSize: 17 }} />}
          sx={{
            bgcolor: NAVY,
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
            "&:hover": { bgcolor: "#1d3c4e" },
          }}
        >
          Create content
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Explainer title="Quick wins">
        Queries where you already rank on the edge of visibility — positions {QW_POSITION_MIN}–{QW_POSITION_MAX}, where a
        small ranking gain converts into real clicks. Work the list top-down: for each row, open the page that ranks,
        deepen it against the query&apos;s intent, then publish. These are cheaper than net-new topics because Google
        already trusts you for them.
      </Explainer>

      <HairlineCard sx={{ mb: 3 }}>
        <Box sx={{ p: 2.25, bgcolor: SURFACE, borderBottom: `1px solid ${HAIRLINE}` }}>
          <SectionLabel>How the opportunity score is computed</SectionLabel>
          <Typography
            sx={{
              mt: 1,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
              color: INK,
              lineHeight: 1.7,
            }}
          >
            proximity = ({QW_POSITION_MAX + 1} − position) ÷ {QW_POSITION_MAX + 1 - QW_POSITION_MIN}
            <br />
            opportunity = impressions × proximity
          </Typography>
          <Typography sx={{ mt: 1.25, fontSize: "0.82rem", color: MUTED, lineHeight: 1.65, maxWidth: 820 }}>
            Demand weighted by how close the query already is to the top: a query at position {QW_POSITION_MIN} scores
            its full impressions, one at position {QW_POSITION_MAX} scores about a tenth of them. Both inputs are
            columns in the table, so you can always see why a row ranks where it does. Filter: position between{" "}
            {QW_POSITION_MIN} and {QW_POSITION_MAX}, at least {QW_MIN_IMPRESSIONS} impressions in the window.
          </Typography>
        </Box>

        <DataTable<QuickWin>
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          searchText={searchText}
          searchPlaceholder="Search queries"
          initialSort={{ id: "score", dir: "desc" }}
          loading={loading}
          emptyTitle="No quick wins in this window"
          emptyBody={`None of the queries Search Console returned for the last ${days} days sit between position ${QW_POSITION_MIN} and ${QW_POSITION_MAX} with at least ${QW_MIN_IMPRESSIONS} impressions. Try the 90-day window, which pulls in queries with thinner daily volume.`}
          toolbarLeft={
            <Box>
              <SectionLabel>Ranked opportunities</SectionLabel>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>
                {loading ? "Loading…" : `${rows.length} qualifying quer${rows.length === 1 ? "y" : "ies"} · last ${days} days`}
              </Typography>
            </Box>
          }
        />
      </HairlineCard>

      <Typography sx={{ fontSize: "0.75rem", color: MUTED, fontFamily: DISPLAY }}>
        Source: Google Search Console. Rows are filtered and ranked, never generated.
      </Typography>
    </Box>
  );
}
