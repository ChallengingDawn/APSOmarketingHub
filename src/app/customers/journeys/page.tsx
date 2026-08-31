"use client";

// JOURNEYS — what actual customers did on the shop. The most recently active
// customer-segment companies, each with the pages their people opened — from
// the per-visit event stream when the portal has it, from each person's
// recorded footprint otherwise. No apology text: the rows ARE the data.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useState } from "react";
import { useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote, SubAppHead } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import type { CustomerJourneys } from "@/lib/integrations/hubspotJourney";

const HS_PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-2/${id}`;
const hsContactUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-1/${id}`;

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

type Track = { at: string | null; url: string; urlFull: string | null; person: string; personHref: string | null; meta: string | null };

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function TrackRow({ t }: { t: Track }) {
  const pathSx = {
    fontSize: "0.8rem",
    color: INK,
    fontFamily: MONO,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
  } as const;
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.25,
        alignItems: "baseline",
        py: 0.55,
        borderBottom: `1px solid ${HAIRLINE}`,
        "&:last-of-type": { borderBottom: "none" },
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, minWidth: 66, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        {t.at ? ago(t.at) : "—"}
      </Typography>
      <Tooltip title={t.urlFull ?? t.url} placement="top-start">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {t.urlFull ? (
            <Link
              href={`https://www.apsoparts.com${t.urlFull}`}
              target="_blank"
              rel="noreferrer"
              sx={{ ...pathSx, textDecoration: "none", "&:hover": { textDecoration: "underline", textDecorationColor: "rgba(39,78,100,0.45)" } }}
            >
              {t.url}
            </Link>
          ) : (
            <Typography sx={pathSx}>{t.url}</Typography>
          )}
          {t.meta && <Typography sx={{ fontSize: "0.68rem", color: MUTED }}>{t.meta}</Typography>}
        </Box>
      </Tooltip>
      {t.personHref ? (
        <Link
          href={t.personHref}
          target="_blank"
          rel="noreferrer"
          sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", flexShrink: 0, textDecorationColor: "rgba(91,100,112,0.4)" }}
        >
          {t.person}
        </Link>
      ) : (
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", flexShrink: 0 }}>{t.person}</Typography>
      )}
    </Box>
  );
}

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
        purpose={`The most recently active customer companies in ${label.toLowerCase()}, and the pages their people were on.`}
      />

      <Gate held={journeys} source="HubSpot" loadingLabel="Following the customers' tracks — this one takes a few seconds…" onRetry={retry}>
        {(data, stale) => (
          <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 2 }}>
              {full(data.customersActive)} customer-segment companies were active in the window — the {data.companies.length} most
              recent are followed here, through up to five people each. Every row is a real record; nothing is extrapolated.
            </Typography>

            <Grid container spacing={2}>
              {data.companies.map((c) => {
                const tone = c.segment ? SEGMENT_TONES[c.segment] ?? { bg: "#eef0f3", fg: "#3c4043" } : null;
                // The event stream when the portal has it; each person's
                // recorded footprint otherwise — one unified track list.
                const tracks: Track[] =
                  c.visits && c.visits.length > 0
                    ? c.visits.map((v) => ({ at: v.at, url: v.url, urlFull: v.urlFull, person: v.contact, personHref: null, meta: v.title }))
                    : c.footprints
                        .filter((f) => f.lastUrl)
                        .map((f) => ({
                          at: f.lastSeen,
                          url: f.lastUrl as string,
                          urlFull: f.lastUrlFull,
                          person: f.contact,
                          personHref: f.contactId ? hsContactUrl(f.contactId) : null,
                          meta: [
                            "last page seen",
                            f.pageViews !== null ? `${full(f.pageViews)} views all-time` : null,
                            f.visits !== null ? `${full(f.visits)} visits` : null,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        }));
                return (
                  <Grid key={c.id} size={{ xs: 12, md: 6, xl: 4 }}>
                    <Section sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, mb: 0.25 }}>
                        <Link
                          href={hsCompanyUrl(c.id)}
                          target="_blank"
                          rel="noreferrer"
                          sx={{
                            fontSize: "0.92rem",
                            fontWeight: 700,
                            color: "#274e64",
                            textDecorationColor: "rgba(39,78,100,0.3)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                          }}
                        >
                          {c.name ?? c.domain ?? c.id}
                          <OpenInNewIcon sx={{ fontSize: 12, ml: 0.4, verticalAlign: "middle" }} />
                        </Link>
                        {tone && c.segment && (
                          <Chip label={c.segment} size="small" sx={{ bgcolor: tone.bg, color: tone.fg, height: 19, fontSize: "0.66rem", flexShrink: 0 }} />
                        )}
                        {c.lastSeen && (
                          <Typography sx={{ fontSize: "0.72rem", color: MUTED, ml: "auto", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {ago(c.lastSeen)}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, mt: 0.75, pt: 0.25, flex: 1 }}>
                        {tracks.length === 0 ? (
                          <Typography sx={{ fontSize: "0.8rem", color: MUTED, pt: 0.75 }}>
                            No recorded pages for the {c.contactsChecked || "associated"} {c.contactsChecked === 1 ? "person" : "people"} checked.
                          </Typography>
                        ) : (
                          tracks.map((t, i) => <TrackRow key={i} t={t} />)
                        )}
                      </Box>
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
              Source: HubSpot — companies by hs_analytics_last_timestamp, their associated contacts, and each person&apos;s page
              record: the per-visit event stream where the portal provides it, otherwise the contact&apos;s last recorded page with
              its all-time view and visit counts. Window {win.from} → {win.to} ({days} days). Only the companies and people
              listed were checked.
            </SourceNote>
          </Box>
        )}
      </Gate>
    </Box>
  );
}
