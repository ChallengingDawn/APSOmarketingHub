"use client";

/**
 * PERFORMANCE — the landing sub-app. What the site earns in Google right now.
 *
 * Hierarchy: clicks is the number that matters, the other three totals support
 * it, and the two tables are the detail underneath. Every figure is a value
 * Search Console returned or a sum of such values.
 */

import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";

import type { GscRow } from "./gscClient";
import { GSC_ROW_LIMIT } from "./gscClient";
import { totalsOf } from "./analysis";
import DataTable, { type Column } from "./DataTable";
import { useSeoData } from "./SeoData";
import { HeroStat, SubAppFrame } from "./Shell";
import {
  HAIRLINE,
  INK,
  MONO,
  MUTED,
  SectionLabel,
  SourceNote,
  fmtCtr,
  fmtInt,
  fmtPosition,
  shortPath,
} from "./ui";

const WILL_SHOW =
  "Once Search Console is connected this sub-app reports live clicks, impressions, CTR and average position for the property, plus the queries and pages carrying that traffic in the selected window.";

const NO_ROWS: GscRow[] = [];

function KeyCell({ text, mono }: { text: string; mono?: boolean }) {
  return (
    <Tooltip title={text} placement="top-start">
      <Typography
        sx={{
          fontSize: "0.85rem",
          fontWeight: 500,
          color: INK,
          fontFamily: mono ? MONO : undefined,
          maxWidth: { xs: 220, sm: 380, lg: 560, xl: 820 },
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

function TableCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden" }}>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 2 }}>
        <SectionLabel>{title}</SectionLabel>
        <Typography sx={{ mt: 0.4, fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>{subtitle}</Typography>
      </Box>
      <Box sx={{ borderTop: `1px solid ${HAIRLINE}` }}>{children}</Box>
    </Box>
  );
}

export default function SearchPerformance() {
  const { data, loading, windowDays } = useSeoData();

  const queries = data?.queries ?? NO_ROWS;
  const pages = data?.pages ?? NO_ROWS;
  const range = data?.range ?? null;

  // Totals come from the query dimension: every impression is attributed to
  // exactly one query, so summing queries does not double-count.
  const totals = useMemo(() => totalsOf(queries), [queries]);

  const rowKey = useCallback((r: GscRow) => r.key, []);
  const searchText = useCallback((r: GscRow) => r.key, []);

  const scopeNote = `Totals sum the top ${GSC_ROW_LIMIT} queries the API returns — the row limit is fixed in src/lib/integrations/gsc.ts — so they are the top of the tail, not site-wide totals.`;

  const metricColumns = (labelForKey: string, mono: boolean): Column<GscRow>[] => [
    {
      id: "key",
      label: labelForKey,
      sortValue: (r) => r.key.toLowerCase(),
      render: (r) => <KeyCell text={mono ? shortPath(r.key) : r.key} mono={mono} />,
    },
    { id: "clicks", label: "Clicks", numeric: true, width: 100, sortValue: (r) => r.clicks, render: (r) => fmtInt(r.clicks) },
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

  return (
    <SubAppFrame
      title="Performance"
      purpose="What the site earns in Google right now — the totals for the window, and the queries and pages carrying them."
      willShow={WILL_SHOW}
    >
      <HeroStat
        label={`Clicks · last ${windowDays} days`}
        value={loading ? "—" : fmtInt(totals.clicks)}
        note={
          <>
            {range ? `Window ${range.startDate} → ${range.endDate}. ` : `Window: last ${windowDays} days. `}
            {scopeNote}
          </>
        }
        supporting={[
          { label: "Impressions", value: loading ? "—" : fmtInt(totals.impressions), hint: scopeNote },
          {
            label: "Average CTR",
            value: loading ? "—" : fmtCtr(totals.ctr),
            hint: "Total clicks ÷ total impressions across the returned rows — not an average of per-row CTRs.",
          },
          {
            label: "Average position",
            value: loading ? "—" : fmtPosition(totals.position),
            hint: "Impression-weighted mean position across the returned rows. Lower is better.",
          },
          {
            label: "Queries returned",
            value: loading ? "—" : fmtInt(totals.rowCount),
            hint: `Rows Search Console returned for the query dimension, capped at ${GSC_ROW_LIMIT}.`,
          },
        ]}
      />

      {/* Side by side once there is genuinely room for two five-column tables;
          stacked below that, so neither ever compresses into unreadability. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          gap: { xs: 3, md: 4 },
          alignItems: "start",
        }}
      >
        <TableCard title="Top queries" subtitle={`Dimension query · last ${windowDays} days · sortable`}>
          <DataTable<GscRow>
            columns={metricColumns("Query", false)}
            rows={queries}
            rowKey={rowKey}
            searchText={searchText}
            searchPlaceholder="Search queries"
            initialSort={{ id: "clicks", dir: "desc" }}
            loading={loading}
            maxHeight={560}
            emptyTitle="Search Console returned no queries"
            emptyBody="The property is connected and the call succeeded, but no query rows came back for this window. A brand-new property, a property with no impressions yet, or a window shorter than Search Console's ~2-day reporting lag all produce this."
          />
        </TableCard>

        <TableCard title="Top pages" subtitle="Dimension page · paths shown, hover for the full URL">
          <DataTable<GscRow>
            columns={metricColumns("Page", true)}
            rows={pages}
            rowKey={rowKey}
            searchText={searchText}
            searchPlaceholder="Search pages"
            initialSort={{ id: "clicks", dir: "desc" }}
            loading={loading}
            maxHeight={560}
            emptyTitle="Search Console returned no pages"
            emptyBody="The call succeeded but no page rows came back for this window. Pages appear here once they receive impressions."
          />
        </TableCard>
      </Box>

      <SourceNote>
        Source: Google Search Console{" "}
        <Box component="code" sx={{ fontFamily: MONO }}>
          searchAnalytics.query
        </Box>
        . No value in this sub-app is estimated, modelled or sampled.
      </SourceNote>
    </SubAppFrame>
  );
}
