"use client";

// WEBSITE · PAGES — an interactive index of what people view on apsoparts.com.
// GA4 supplies the page metrics for the reporting window; clicking a page asks
// HubSpot which known contacts were last seen on it, with links out to their
// records. HubSpot remembers one URL per contact (last-touch), so that list
// understates a page's audience — the caption says so instead of pretending.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useState } from "react";
import PageHeader from "@/app/PageHeader";
import { useReportingWindow, windowQuery, WindowPicker } from "@/app/window/ReportingWindow";
import { Gate, GUTTER, HAIRLINE, INK, MUTED, Section, SourceNote } from "@/app/analytics/Shell";
import { metricOf, sumOf, useHeld } from "@/app/analytics/AnalyticsData";
import type { Ga4TableReport } from "@/app/analytics/integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { compact, dayLabel, full, percent } from "@/app/charts/format";
import type { PageAudience } from "@/lib/integrations/hubspotJourney";

const HS_PORTAL = "26492587";
const hsContactUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-1/${id}`;

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function fmtDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export default function WebsitePagesPage() {
  const { window: win, days, label } = useReportingWindow();
  const q = windowQuery(win);
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const [selPath, setSelPath] = useState<string | null>(null);

  const pages = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=pages&${q}`, [q, tick]);
  const audience = useHeld<PageAudience>(
    selPath ? `/api/integrations/hubspot?report=pageAudience&path=${encodeURIComponent(selPath)}&limit=12` : null,
    [selPath],
  );
  const trend = useHeld<Ga4TableReport>(
    selPath ? `/api/integrations/ga4?report=pageTrend&path=${encodeURIComponent(selPath)}&${q}` : null,
    [selPath, q, tick],
  );
  const landing = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=landingPages&${q}`, [q, tick]);

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Pages"
        subtitle="What people view on apsoparts.com — and, per page, the customers HubSpot can name"
        rightSlot={<WindowPicker />}
      />

      <Gate held={pages} source="Google Analytics 4" loadingLabel="Reading the page index…" onRetry={retry}>
        {(report, stale) => {
          const views = metricOf(report, "screenPageViews");
          const sess = metricOf(report, "sessions");
          const eng = metricOf(report, "engagementRate");
          const dur = metricOf(report, "averageSessionDuration");
          const totalViews = sumOf(report, "screenPageViews");
          const top = report.rows[0] ?? null;
          // Session-weighted engagement across the listed pages.
          let wEng: number | null = null;
          {
            let num = 0;
            let den = 0;
            for (const r of report.rows) {
              const s = sess(r);
              const e = eng(r);
              if (s !== null && e !== null) {
                num += e * s;
                den += s;
              }
            }
            wEng = den > 0 ? num / den : null;
          }
          const selRow = selPath ? report.rows.find((r) => r.keys[0] === selPath) ?? null : null;

          return (
            <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Page views" value={compact(totalViews)} note={`Across the top ${report.rows.length} pages · ${label.toLowerCase()}`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Busiest page" value={top ? compact(views(top)) : "—"} note={top ? top.keys[0] : "No page rows"} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Engagement" value={percent(wEng)} note="Session-weighted across the listed pages" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Pages listed" value={full(report.rows.length)} note="Top pages by views — GA4's cut, not the whole site" />
                </Grid>
              </Grid>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Most viewed pages"
                      caption="Click a page to see its metrics and the customers HubSpot can name on it"
                      stale={stale}
                      empty={report.rows.length === 0 ? "GA4 returned no page rows for this window." : null}
                      table={{
                        columns: ["Page", "Views", "Sessions", "Engagement", "Avg session"],
                        numeric: [1, 2, 3, 4],
                        rows: report.rows.map((r) => [r.keys[0], full(views(r)), full(sess(r)), percent(eng(r)), fmtDuration(dur(r))]),
                      }}
                    >
                      <BarList
                        rows={report.rows.map((r) => ({
                          label: r.keys[0],
                          value: views(r),
                          secondary: percent(eng(r)),
                        }))}
                        labelWidth={300}
                        maxLabel={46}
                        onSelect={(labelSel) => setSelPath((cur) => (cur === labelSel ? null : labelSel))}
                        selectedLabel={selPath}
                      />
                    </ChartFrame>
                  </Section>
                </Grid>

                <Grid size={{ xs: 12, lg: 5 }}>
                  <Section sx={{ height: "100%" }}>
                    {!selPath ? (
                      <Box sx={{ py: 4, textAlign: "center" }}>
                        <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK, mb: 0.5 }}>Pick a page on the left</Typography>
                        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                          Its window metrics appear here, with the known customers HubSpot last saw on it.
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, mb: 1 }}>
                          <Typography
                            sx={{
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              color: INK,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              minWidth: 0,
                            }}
                          >
                            {selPath}
                          </Typography>
                          <Link
                            href={`https://www.apsoparts.com${selPath}`}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ fontSize: "0.74rem", color: "#274e64", whiteSpace: "nowrap", flexShrink: 0, ml: "auto" }}
                          >
                            Open page <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: "middle" }} />
                          </Link>
                        </Box>
                        {selRow ? (
                          (() => {
                            const lres = landing.result;
                            const landRow = lres?.state === "ok" ? lres.data.rows.find((r) => r.keys[0] === selPath) ?? null : null;
                            const landSess = landRow && lres?.state === "ok" ? metricOf(lres.data, "sessions")(landRow) : null;
                            const v = views(selRow);
                            const s = sess(selRow);
                            const vps = v !== null && s ? v / s : null;
                            return (
                              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                                <Grid size={{ xs: 6 }}>
                                  <StatTile label="Views" value={compact(v)} note={`${compact(s)} sessions`} />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <StatTile label="Engagement" value={percent(eng(selRow))} note={`${fmtDuration(dur(selRow))} avg session`} />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <StatTile
                                    label="Entered here"
                                    value={compact(landSess)}
                                    note={landSess === null ? "Not among the top landing pages this window" : "Sessions that started on this page"}
                                  />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <StatTile label="Views / session" value={vps === null ? "—" : vps.toFixed(1)} note="How deep sessions go on it" />
                                </Grid>
                              </Grid>
                            );
                          })()
                        ) : (
                          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
                            This page has no GA4 row in the current window.
                          </Typography>
                        )}

                        <Box sx={{ mb: 1.5 }}>
                          <Gate held={trend} source="Google Analytics 4" loadingLabel="Charting this page's days…" onRetry={retry}>
                            {(tr, tStale) => {
                              const v = metricOf(tr, "screenPageViews");
                              const pts = tr.rows.map((r) => ({ x: r.keys[0], value: v(r) }));
                              return (
                                <ChartFrame
                                  title="Views per day"
                                  caption={`This page only · ${pts.length} days`}
                                  stale={tStale}
                                  empty={pts.length < 2 ? "GA4 returned fewer than two days for this page." : null}
                                  table={{ columns: ["Day", "Views"], numeric: [1], rows: tr.rows.map((r) => [dayLabel(r.keys[0]), full(v(r))]) }}
                                >
                                  <TrendChart data={pts} seriesLabel="Views" height={140} xFormat={dayLabel} />
                                </ChartFrame>
                              );
                            }}
                          </Gate>
                        </Box>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK, mb: 0.25 }}>
                          Customers HubSpot can name on this page
                        </Typography>
                        <Gate held={audience} source="HubSpot" loadingLabel="Asking HubSpot who was here…" onRetry={retry}>
                          {(a, aStale) => (
                            <Box sx={{ opacity: aStale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
                              <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 1 }}>
                                {a.total !== null ? `${full(a.total)} contacts` : "Contacts"} whose last recorded page matches “{a.token}”.
                                HubSpot keeps one URL per person, so this understates the page&apos;s true audience.
                              </Typography>
                              {a.rows.length === 0 ? (
                                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                                  No known contact&apos;s last recorded page matches this one.
                                </Typography>
                              ) : (
                                <Box sx={{ display: "grid", gap: 0.4 }}>
                                  {a.rows.map((p) => (
                                    <Box key={p.id} sx={{ display: "flex", gap: 1, alignItems: "baseline", borderBottom: `1px solid ${HAIRLINE}`, pb: 0.4, minWidth: 0 }}>
                                      <Link
                                        href={hsContactUrl(p.id)}
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#274e64", textDecorationColor: "rgba(39,78,100,0.3)", whiteSpace: "nowrap" }}
                                      >
                                        {p.name}
                                        <OpenInNewIcon sx={{ fontSize: 11, ml: 0.3, verticalAlign: "middle" }} />
                                      </Link>
                                      {p.lifecycle && <Chip label={p.lifecycle} size="small" sx={{ height: 18, fontSize: "0.64rem", bgcolor: "#eef0f3", color: "#3c4043" }} />}
                                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, ml: "auto", whiteSpace: "nowrap" }}>
                                        {p.lastSeen ? ago(p.lastSeen) : ""}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          )}
                        </Gate>
                      </Box>
                    )}
                  </Section>
                </Grid>
              </Grid>

              <SourceNote>
                Sources: GA4 pagePath report for {win.from} → {win.to} ({days} days); HubSpot contact search on
                hs_analytics_last_url for the selected page. GA4 counts anonymous views, HubSpot names last-touch contacts —
                the two sit side by side and are never divided into each other.
              </SourceNote>
            </Box>
          );
        }}
      </Gate>
    </Box>
  );
}
