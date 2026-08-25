"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Autorenew from "@mui/icons-material/Autorenew";
import type { GscRow } from "./gscClient";
import { decayOf, isDecayed, type DecayRow } from "./analysis";
import DataTable, { type Column } from "./DataTable";
import { createHref, decayTopic } from "./queue";
import {
  Explainer,
  HairlineCard,
  INK,
  MONO,
  Methodology,
  NAVY,
  NUMERIC,
  RED,
  SourceNote,
  TableHeading,
  fmtInt,
  fmtPct,
  fmtPosition,
  fmtSigned,
  shortPath,
} from "./ui";

export default function Decay({
  pagesCurrent,
  pagesExtended,
  loading,
  days,
}: {
  pagesCurrent: GscRow[];
  pagesExtended: GscRow[];
  loading: boolean;
  days: number;
}) {
  const result = useMemo(() => decayOf(pagesCurrent, pagesExtended), [pagesCurrent, pagesExtended]);
  const rows = useMemo(() => result.rows.filter(isDecayed), [result.rows]);

  const rowKey = useCallback((r: DecayRow) => r.key, []);
  const searchText = useCallback((r: DecayRow) => r.key, []);

  const columns: Column<DecayRow>[] = [
    {
      id: "key",
      label: "Page",
      sortValue: (r) => r.key.toLowerCase(),
      render: (r) => (
        <Tooltip title={r.key} placement="top-start">
          <Typography
            sx={{
              fontSize: "0.83rem",
              fontWeight: 500,
              color: INK,
              fontFamily: MONO,
              maxWidth: { xs: 240, sm: 380, lg: 600, xl: 820 },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {shortPath(r.key)}
          </Typography>
        </Tooltip>
      ),
    },
    {
      id: "previousClicks",
      label: `Previous ${days}d`,
      numeric: true,
      width: 120,
      sortValue: (r) => r.previousClicks,
      hint: `Clicks in the ${days} days before the current window, derived by subtracting the current window from a ${days * 2}-day window.`,
      render: (r) => fmtInt(r.previousClicks),
    },
    {
      id: "currentClicks",
      label: `Current ${days}d`,
      numeric: true,
      width: 118,
      sortValue: (r) => r.currentClicks,
      hint: "Clicks in the current window, exactly as Search Console reported them.",
      render: (r) => fmtInt(r.currentClicks),
    },
    {
      id: "deltaClicks",
      label: "Δ clicks",
      numeric: true,
      width: 104,
      sortValue: (r) => r.deltaClicks,
      render: (r) => (
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: RED, ...NUMERIC }}>
          {fmtSigned(r.deltaClicks)}
        </Typography>
      ),
    },
    {
      id: "deltaPct",
      label: "Δ %",
      numeric: true,
      width: 92,
      sortValue: (r) => r.deltaPct,
      hint: "Δ clicks ÷ previous clicks. Blank when the previous period had no clicks to divide by.",
      render: (r) => fmtPct(r.deltaPct),
    },
    {
      id: "impressions",
      label: "Impr. prev → now",
      numeric: true,
      width: 158,
      sortValue: (r) => r.currentImpressions - r.previousImpressions,
      hint: "Impressions tell you whether the page lost rankings or lost clicks at unchanged rankings.",
      render: (r) => `${fmtInt(r.previousImpressions)} → ${fmtInt(r.currentImpressions)}`,
    },
    {
      id: "position",
      label: "Position",
      numeric: true,
      width: 96,
      sortValue: (r) => r.currentPosition,
      hint: "Current-window average position. Averages cannot be subtracted across windows, so no previous position is shown.",
      render: (r) => fmtPosition(r.currentPosition),
    },
    {
      id: "action",
      label: "Action",
      width: 168,
      render: (r) => (
        <Button
          component={Link}
          href={createHref(decayTopic(r.key))}
          size="small"
          variant="contained"
          disableElevation
          startIcon={<Autorenew sx={{ fontSize: 17 }} />}
          sx={{
            bgcolor: NAVY,
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
            "&:hover": { bgcolor: "#1d3c4e" },
          }}
        >
          Refresh this page
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Explainer title="Decay">
        Pages that used to earn clicks and now earn fewer. Decay is the cheapest traffic to recover: the page already
        exists, already ranks, and already has links. Start at the top — the biggest absolute loss is the biggest
        business loss. If impressions held but clicks fell, rewrite the title and meta description; if impressions fell
        too, the page lost ranking and needs its content brought back up to date.
      </Explainer>

      <HairlineCard>
        <Methodology
          label="How the previous period is obtained"
          formula={
            <>
              previous = rows(days&nbsp;=&nbsp;{days * 2}) − rows(days&nbsp;=&nbsp;{days})
            </>
          }
          caveat={
            !loading && result.notComparable.length > 0 ? (
              <>
                {result.notComparable.length} page{result.notComparable.length === 1 ? " was" : "s were"} excluded as not
                comparable across the two windows ({result.comparable} compared).
              </>
            ) : undefined
          }
        >
          The route accepts a single lookback ending today, so the cockpit calls it twice and subtracts. Clicks and
          impressions are daily sums, so the subtraction is exact. CTR and position are averages and are never
          subtracted — that is why no previous position is shown. Pages the wider window did not return, or where the
          remainder comes out negative, are excluded rather than zero-filled. The size of the click loss is what the
          Work queue normalises when it ranks decayed pages against the other analyses.
        </Methodology>

        <DataTable<DecayRow>
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          searchText={searchText}
          searchPlaceholder="Search pages"
          initialSort={{ id: "deltaClicks", dir: "asc" }}
          loading={loading}
          maxHeight={640}
          emptyTitle="No page lost clicks in this window"
          emptyBody={`Across the ${result.comparable} page${result.comparable === 1 ? "" : "s"} comparable between the two windows, none earned fewer clicks in the last ${days} days than in the ${days} days before. Either nothing is decaying, or the pages that are decaying have already fallen out of the row limit the API returns.`}
          toolbarLeft={
            <TableHeading
              label="Declining pages"
              caption={
                loading ? "Loading…" : `${rows.length} declining · ${result.comparable} comparable · worst first`
              }
            />
          }
        />
      </HairlineCard>

      <SourceNote>
        Source: Google Search Console, dimension{" "}
        <Box component="code" sx={{ fontFamily: MONO }}>
          page
        </Box>
        , two calls. Deltas are computed from returned totals only.
      </SourceNote>
    </Box>
  );
}
