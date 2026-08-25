"use client";

import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import type { GscRow } from "./gscClient";
import { GSC_ROW_LIMIT } from "./gscClient";
import { totalsOf } from "./analysis";
import DataTable, { type Column } from "./DataTable";
import {
  DISPLAY,
  Explainer,
  HairlineCard,
  INK,
  MONO,
  MUTED,
  NUMERIC,
  PROSE_MAX,
  SectionLabel,
  SourceNote,
  TableHeading,
  fmtCtr,
  fmtInt,
  fmtPosition,
  shortPath,
} from "./ui";

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <HairlineCard sx={{ height: "100%" }}>
      <Box sx={{ p: 2.25 }}>
        <Tooltip title={hint} placement="top">
          <Box component="span" sx={{ display: "inline-block", cursor: "help" }}>
            <SectionLabel>{label}</SectionLabel>
          </Box>
        </Tooltip>
        <Typography
          sx={{
            mt: 0.75,
            fontFamily: DISPLAY,
            fontSize: "1.9rem",
            fontWeight: 600,
            color: INK,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            ...NUMERIC,
          }}
        >
          {value}
        </Typography>
      </Box>
    </HairlineCard>
  );
}

function KeyCell({ text, mono }: { text: string; mono?: boolean }) {
  return (
    <Tooltip title={text} placement="top-start">
      <Typography
        sx={{
          fontSize: "0.85rem",
          fontWeight: 500,
          color: INK,
          fontFamily: mono ? MONO : undefined,
          maxWidth: { xs: 240, sm: 420, lg: 680, xl: 960 },
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

export default function SearchPerformance({
  queries,
  pages,
  loading,
  days,
  range,
}: {
  queries: GscRow[];
  pages: GscRow[];
  loading: boolean;
  days: number;
  range: { startDate: string; endDate: string } | null;
}) {
  // Totals come from the query dimension: every impression is attributed to
  // exactly one query, so summing queries does not double-count.
  const totals = useMemo(() => totalsOf(queries), [queries]);

  const rowKey = useCallback((r: GscRow) => r.key, []);
  const searchText = useCallback((r: GscRow) => r.key, []);

  const metricColumns = (labelForKey: string, mono: boolean): Column<GscRow>[] => [
    {
      id: "key",
      label: labelForKey,
      sortValue: (r) => r.key.toLowerCase(),
      render: (r) => <KeyCell text={mono ? shortPath(r.key) : r.key} mono={mono} />,
    },
    {
      id: "clicks",
      label: "Clicks",
      numeric: true,
      width: 100,
      sortValue: (r) => r.clicks,
      render: (r) => fmtInt(r.clicks),
    },
    {
      id: "impressions",
      label: "Impressions",
      numeric: true,
      width: 120,
      sortValue: (r) => r.impressions,
      render: (r) => fmtInt(r.impressions),
    },
    {
      id: "ctr",
      label: "CTR",
      numeric: true,
      width: 92,
      sortValue: (r) => r.ctr,
      hint: "Clicks ÷ impressions, as reported by Search Console.",
      render: (r) => fmtCtr(r.ctr),
    },
    {
      id: "position",
      label: "Position",
      numeric: true,
      width: 96,
      sortValue: (r) => r.position,
      hint: "Average position over the window. Lower is better.",
      render: (r) => fmtPosition(r.position),
    },
  ];

  const scopeNote = `Totals sum the top ${GSC_ROW_LIMIT} queries the API returns — the row limit is fixed in src/lib/integrations/gsc.ts — so they are the top of the tail, not site-wide totals.`;

  return (
    <Box>
      <Explainer title="Search performance">
        What the site actually earns in Google today. Read the four totals first, then scan the query table for demand
        you already rank for and the page table for which URLs carry that demand. Anything strong in impressions but
        weak in clicks is a title-and-meta job; anything strong in clicks is a page worth protecting.
      </Explainer>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Clicks" value={loading ? "—" : fmtInt(totals.clicks)} hint={scopeNote} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Impressions" value={loading ? "—" : fmtInt(totals.impressions)} hint={scopeNote} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Average CTR"
            value={loading ? "—" : fmtCtr(totals.ctr)}
            hint="Total clicks ÷ total impressions across the returned rows — not an average of per-row CTRs."
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Average position"
            value={loading ? "—" : fmtPosition(totals.position)}
            hint="Impression-weighted mean position across the returned rows. Lower is better."
          />
        </Grid>
      </Grid>

      <Typography sx={{ mb: 3, fontSize: "0.78rem", color: MUTED, lineHeight: 1.6, maxWidth: PROSE_MAX }}>
        {range ? `Window ${range.startDate} → ${range.endDate} (${days} days). ` : `Window: last ${days} days. `}
        {scopeNote}
      </Typography>

      {/* Side by side once there is genuinely room for two five-column tables;
          stacked below that, so neither ever compresses into unreadability. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <HairlineCard>
          <DataTable<GscRow>
            columns={metricColumns("Query", false)}
            rows={queries}
            rowKey={rowKey}
            searchText={searchText}
            searchPlaceholder="Search queries"
            initialSort={{ id: "clicks", dir: "desc" }}
            loading={loading}
            maxHeight={620}
            emptyTitle="Search Console returned no queries"
            emptyBody="The property is connected and the call succeeded, but no query rows came back for this window. A brand-new property, a property with no impressions yet, or a window shorter than Search Console's ~2-day reporting lag all produce this."
            toolbarLeft={
              <TableHeading
                label="Top queries"
                caption={
                  <>
                    Dimension{" "}
                    <Box component="code" sx={{ fontFamily: MONO }}>
                      query
                    </Box>{" "}
                    · last {days} days
                  </>
                }
              />
            }
          />
        </HairlineCard>

        <HairlineCard>
          <DataTable<GscRow>
            columns={metricColumns("Page", true)}
            rows={pages}
            rowKey={rowKey}
            searchText={searchText}
            searchPlaceholder="Search pages"
            initialSort={{ id: "clicks", dir: "desc" }}
            loading={loading}
            maxHeight={620}
            emptyTitle="Search Console returned no pages"
            emptyBody="The call succeeded but no page rows came back for this window. Pages appear here once they receive impressions."
            toolbarLeft={
              <TableHeading
                label="Top pages"
                caption={
                  <>
                    Dimension{" "}
                    <Box component="code" sx={{ fontFamily: MONO }}>
                      page
                    </Box>{" "}
                    · paths shown, hover for the full URL
                  </>
                }
              />
            }
          />
        </HairlineCard>
      </Box>

      <SourceNote>
        Source: Google Search Console{" "}
        <Box component="code" sx={{ fontFamily: MONO }}>
          searchAnalytics.query
        </Box>
        . No value on this page is estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}
