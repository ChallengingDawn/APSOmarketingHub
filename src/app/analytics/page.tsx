"use client";

// Live GA4 only. Every figure on this page comes from
// /api/integrations/ga4 for the selected window; when GA4 is not connected the
// page says so and points at the control room instead of showing anything.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import NotConnectedCard, { UpstreamErrorCard } from "./NotConnectedCard";
import SessionsTrend from "./SessionsTrend";
import {
  fetchIntegration,
  formatCount,
  formatRatioAsPercent,
  type Ga4Breakdown,
  type Ga4Overview,
  type HubspotPayload,
  type IntegrationResult,
} from "./integrationApi";

const NAVY = "#274e64";
const INK = "#1a1d21";
const MUTED = "#5b6470";
const HAIRLINE = "#e3e6ea";
const SURFACE = "#f5f6f8";

const LABEL_SX = {
  fontSize: "11.5px",
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase" as const,
  color: MUTED,
};

const WINDOWS = [28, 90] as const;
type WindowDays = (typeof WINDOWS)[number];

const HUBSPOT_RECENT_DAYS = 30;

function SectionCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
        bgcolor: "#fff",
        p: { xs: 2.5, md: 3 },
        height: "100%",
      }}
    >
      <Typography sx={{ ...LABEL_SX, mb: caption ? 0.75 : 2 }}>{title}</Typography>
      {caption && (
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 2 }}>{caption}</Typography>
      )}
      {children}
    </Box>
  );
}

function KpiCard({
  label,
  value,
  window,
  note,
}: {
  label: string;
  value: string;
  window: string;
  note?: string;
}) {
  const reported = value !== "—";
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
        bgcolor: "#fff",
        p: 2.5,
        height: "100%",
      }}
    >
      <Typography sx={{ ...LABEL_SX, mb: 1.25 }}>{label}</Typography>
      <Typography
        sx={{
          fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
          fontSize: "1.9rem",
          fontWeight: 500,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          color: reported ? INK : MUTED,
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.75 }}>
        {reported ? window : "Not reported by GA4 for this window"}
      </Typography>
      {reported && note && (
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.25 }}>{note}</Typography>
      )}
    </Box>
  );
}

function BreakdownTable({
  rows,
  keyHeader,
  emptyMessage,
}: {
  rows: Ga4Breakdown[];
  keyHeader: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, py: 2 }}>{emptyMessage}</Typography>
    );
  }

  const headCell = {
    ...LABEL_SX,
    fontSize: "10.5px",
    borderBottom: `1px solid ${HAIRLINE}`,
    py: 1,
  };
  const bodyCell = { fontSize: "0.82rem", color: INK, borderBottom: `1px solid ${HAIRLINE}`, py: 1.1 };

  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 380 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headCell}>{keyHeader}</TableCell>
            <TableCell align="right" sx={headCell}>
              Sessions
            </TableCell>
            <TableCell align="right" sx={headCell}>
              Engagement
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} sx={{ "&:last-child td": { borderBottom: "none" } }}>
              <TableCell
                sx={{
                  ...bodyCell,
                  maxWidth: 280,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={row.key}
              >
                {row.key}
              </TableCell>
              <TableCell align="right" sx={{ ...bodyCell, fontWeight: 600 }}>
                {formatCount(row.sessions)}
              </TableCell>
              <TableCell align="right" sx={{ ...bodyCell, color: MUTED }}>
                {formatRatioAsPercent(row.engagementRate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CommercialSignal({ payload }: { payload: HubspotPayload }) {
  const { account, summary } = payload;
  const items: { label: string; value: string; note: string }[] = [
    { label: "Contacts", value: formatCount(summary.contacts), note: "All-time in the CRM" },
    { label: "Companies", value: formatCount(summary.companies), note: "All-time in the CRM" },
    {
      label: "New contacts",
      value: formatCount(summary.newContacts),
      note: `Created in the last ${summary.days} days`,
    },
  ];

  return (
    <SectionCard
      title="Commercial signal · HubSpot"
      caption={
        account === null || account.portalId === null
          ? "Live from the connected HubSpot private app."
          : `Live from HubSpot portal ${account.portalId}${account.uiDomain ? ` (${account.uiDomain})` : ""}.`
      }
    >
      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid key={item.label} size={{ xs: 12, sm: 4 }}>
            <Box sx={{ bgcolor: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 2, p: 2 }}>
              <Typography sx={{ ...LABEL_SX, mb: 0.75 }}>{item.label}</Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
                  fontSize: "1.45rem",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: item.value === "—" ? MUTED : INK,
                }}
              >
                {item.value}
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.5 }}>
                {item.value === "—" ? "Not returned by HubSpot" : item.note}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<WindowDays>(28);
  const [reloadToken, setReloadToken] = useState(0);
  const [ga4, setGa4] = useState<IntegrationResult<Ga4Overview> | null>(null);
  const [hubspot, setHubspot] = useState<IntegrationResult<HubspotPayload> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setGa4(null);
    fetchIntegration<Ga4Overview>(`/api/integrations/ga4?days=${days}`, controller.signal)
      .then((result) => setGa4(result))
      .catch(() => {
        /* aborted by a newer request */
      });
    return () => controller.abort();
  }, [days, reloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    setHubspot(null);
    fetchIntegration<HubspotPayload>(
      `/api/integrations/hubspot?days=${HUBSPOT_RECENT_DAYS}`,
      controller.signal,
    )
      .then((result) => setHubspot(result))
      .catch(() => {
        /* aborted by a newer request */
      });
    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const windowLabel = `Last ${days} days, ending today`;

  const overview = ga4?.state === "ok" ? ga4.data : null;
  const totals = overview?.totals ?? null;

  const kpis = useMemo(() => {
    if (!totals) return [];
    return [
      { label: "Sessions", value: formatCount(totals.sessions) },
      { label: "Total users", value: formatCount(totals.totalUsers) },
      { label: "New users", value: formatCount(totals.newUsers) },
      { label: "Engagement rate", value: formatRatioAsPercent(totals.engagementRate) },
    ];
  }, [totals]);

  return (
    <Box sx={{ p: 1 }}>
      <PageHeader
        title="Analytics"
        subtitle="Live Google Analytics 4 for apsoparts.com — no sample data, only what the property returns"
        rightSlot={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {WINDOWS.map((w) => {
              const active = w === days;
              return (
                <Chip
                  key={w}
                  label={`${w} days`}
                  onClick={() => setDays(w)}
                  sx={{
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    borderRadius: 1.5,
                    bgcolor: active ? NAVY : "#fff",
                    color: active ? "#fff" : INK,
                    border: `1px solid ${active ? NAVY : HAIRLINE}`,
                    "&:hover": { bgcolor: active ? "#1d3d50" : SURFACE },
                  }}
                />
              );
            })}
            <Button
              onClick={reload}
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: NAVY,
                minWidth: 0,
              }}
            >
              Refresh
            </Button>
          </Box>
        }
      />

      {ga4 === null && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1.5, py: 10 }}>
          <CircularProgress size={18} sx={{ color: NAVY }} />
          <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
            Querying the GA4 Data API for the last {days} days…
          </Typography>
        </Box>
      )}

      {ga4?.state === "not-configured" && (
        <NotConnectedCard
          source="Google Analytics 4"
          missing={ga4.missing}
          optional={["GA4_PROPERTY_ID"]}
          detail={ga4.detail}
          unlocks="Once connected, this page shows sessions, users, new users and engagement rate for the selected window, a daily sessions trend, and the landing pages and channel groups behind those sessions."
        />
      )}

      {ga4?.state === "error" && (
        <UpstreamErrorCard
          source="Google Analytics 4"
          error={ga4.error}
          status={ga4.status}
          onRetry={reload}
        />
      )}

      {overview && (
        <>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1.5,
              mb: 3,
              px: 0.5,
            }}
          >
            <Typography sx={{ ...LABEL_SX }}>
              GA4 property {overview.propertyId}
            </Typography>
            <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: HAIRLINE }} />
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
              {overview.range?.startDate && overview.range?.endDate
                ? `Window ${overview.range.startDate} → ${overview.range.endDate} (${overview.days} days)`
                : `Window: last ${overview.days} days`}
            </Typography>
          </Box>

          {totals === null ? (
            <Box
              sx={{
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 2,
                bgcolor: "#fff",
                p: 3,
                mb: 3,
              }}
            >
              <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
                GA4 answered but returned no totals row for this window — the property has no data
                in the last {overview.days} days.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {kpis.map((kpi) => (
                <Grid key={kpi.label} size={{ xs: 6, md: 3 }}>
                  <KpiCard label={kpi.label} value={kpi.value} window={windowLabel} />
                </Grid>
              ))}
            </Grid>
          )}

          <Box sx={{ mb: 3 }}>
            <SectionCard
              title="Daily sessions"
              caption={`One point per day, ${windowLabel.toLowerCase()}. GA4 property ${overview.propertyId}.`}
            >
              <SessionsTrend daily={overview.daily} days={overview.days} />
            </SectionCard>
          </Box>

          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <SectionCard
                title="Top landing pages"
                caption={`Ranked by sessions, ${windowLabel.toLowerCase()}.`}
              >
                <BreakdownTable
                  rows={overview.landingPages}
                  keyHeader="Landing page"
                  emptyMessage={`GA4 returned no landing-page rows for the last ${overview.days} days.`}
                />
              </SectionCard>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <SectionCard
                title="Channel groups"
                caption={`Default channel grouping, ${windowLabel.toLowerCase()}.`}
              >
                <BreakdownTable
                  rows={overview.channels}
                  keyHeader="Channel"
                  emptyMessage={`GA4 returned no channel rows for the last ${overview.days} days.`}
                />
              </SectionCard>
            </Grid>
          </Grid>

          {/* HubSpot is additive: shown only when it actually answered. */}
          {hubspot?.state === "ok" && (
            <Box sx={{ mb: 3 }}>
              <CommercialSignal payload={hubspot.data} />
            </Box>
          )}

          {hubspot?.state === "error" && (
            <Box
              sx={{
                border: `1px solid ${HAIRLINE}`,
                borderLeft: "3px solid #ed1b2f",
                borderRadius: 2,
                bgcolor: "#fff",
                p: 2.5,
                mb: 3,
              }}
            >
              <Typography sx={{ ...LABEL_SX, mb: 0.75 }}>Commercial signal unavailable</Typography>
              <Typography sx={{ fontSize: "0.82rem", color: INK }}>
                HubSpot is configured but did not answer:{" "}
                <Box component="span" sx={{ fontFamily: "ui-monospace, monospace" }}>
                  {hubspot.error}
                </Box>
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.75 }}>
                <Box component={Link} href="/settings/integrations" sx={{ color: NAVY }}>
                  Test the HubSpot connection
                </Box>
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
