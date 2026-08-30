"use client";

// JOURNEYS — what actual customers did on the shop. The most recently active
// customer-segment companies, each with the pages their people opened, read
// from HubSpot's web-analytics events. Slow by design: many small calls to a
// rate-limited API, run one after another.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useState } from "react";
import { useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote, SubAppHead } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import type { CustomerJourneys } from "@/lib/integrations/hubspotJourney";

const HS_PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-2/${id}`;

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const SEGMENT_TONES: Record<string, { bg: string; fg: string }> = {
  APSOcore: { bg: "#e5f3ea", fg: "#155d33" },
  APSOgrowth: { bg: "#e3edf7", fg: "#1b4a80" },
  APSOmicro: { bg: "#eef0f3", fg: "#3c4043" },
  "Growth Engine Customer": { bg: "#e5f3ea", fg: "#155d33" },
};

export default function JourneysPage() {
  const { window: win, days, label } = useReportingWindow();
  const q = windowQuery(win);
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);

  const journeys = useHeld<CustomerJourneys>(`/api/integrations/hubspot?report=customerJourneys&${q}`, [q, tick]);

  return (
    <Box>
      <SubAppHead
        title="Journeys"
        purpose={`The most recently active customer companies in ${label.toLowerCase()}, and the exact pages their people opened on apsoparts.com.`}
      />

      <Gate held={journeys} source="HubSpot" loadingLabel="Following the customers' tracks — this one takes a few seconds…" onRetry={retry}>
        {(data, stale) => (
          <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 2 }}>
              {full(data.customersActive)} customer-segment companies were active in the window; the {data.companies.length} most
              recent are followed here, through up to two people each.
            </Typography>

            <Grid container spacing={2.5}>
              {data.companies.map((c) => {
                const tone = c.segment ? SEGMENT_TONES[c.segment] ?? { bg: "#eef0f3", fg: "#3c4043" } : null;
                return (
                  <Grid key={c.id} size={{ xs: 12, lg: 6 }}>
                    <Section sx={{ height: "100%" }}>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                        <Link href={hsCompanyUrl(c.id)} target="_blank" rel="noreferrer" sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#274e64", textDecorationColor: "rgba(39,78,100,0.35)" }}>
                          {c.name ?? c.domain ?? c.id}
                          <OpenInNewIcon sx={{ fontSize: 13, ml: 0.4, verticalAlign: "middle" }} />
                        </Link>
                        {tone && c.segment && <Chip label={c.segment} size="small" sx={{ bgcolor: tone.bg, color: tone.fg, height: 20, fontSize: "0.68rem" }} />}
                        {c.lastSeen && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>on site {ago(c.lastSeen)}</Typography>}
                      </Box>
                      {c.visits === null ? (
                        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                          HubSpot refused the page-visit events: {c.visitsError}
                        </Typography>
                      ) : c.visits.length === 0 ? (
                        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
                          No page-visit events on the {c.contactsChecked || "associated"} contact{c.contactsChecked === 1 ? "" : "s"} checked.
                        </Typography>
                      ) : (
                        <Box sx={{ display: "grid", gap: 0.4, mt: 1 }}>
                          {c.visits.map((v, i) => (
                            <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "baseline", borderBottom: `1px solid ${HAIRLINE}`, pb: 0.4 }}>
                              <Typography sx={{ fontSize: "0.74rem", color: MUTED, minWidth: 74, fontVariantNumeric: "tabular-nums" }}>{ago(v.at)}</Typography>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: "0.82rem", color: INK, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere" }}>{v.url}</Typography>
                                {v.title && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{v.title}</Typography>}
                              </Box>
                              <Typography sx={{ fontSize: "0.74rem", color: MUTED, ml: "auto", whiteSpace: "nowrap" }}>{v.contact}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Section>
                  </Grid>
                );
              })}
              {data.companies.length === 0 && (
                <Grid size={{ xs: 12 }}>
                  <Section>
                    <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
                      No customer-segment company was active on the site in this window.
                    </Typography>
                  </Section>
                </Grid>
              )}
            </Grid>

            <SourceNote>
              Source: HubSpot — companies by hs_analytics_last_timestamp, their associated contacts, and each contact&apos;s
              e_visited_page events. Window {win.from} → {win.to} ({days} days). Only the companies and people listed were
              checked; nothing is extrapolated to the rest.
            </SourceNote>
          </Box>
        )}
      </Gate>
    </Box>
  );
}
