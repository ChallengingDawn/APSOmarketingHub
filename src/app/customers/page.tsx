"use client";

// CUSTOMERS — the CRM side of the traffic. HubSpot's own web tracking knows
// which companies were on apsoparts.com and when; GA4 knows the sessions by
// channel and landing page. Laid side by side, with the bridge between their
// vocabularies shown, they give one picture of what customers are doing.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import PageHeader from "@/app/PageHeader";
import { WindowPicker, useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
import { Gate, GUTTER, HAIRLINE, INK, MUTED, Section, SourceNote } from "@/app/analytics/Shell";
import { metricOf, useHeld } from "@/app/analytics/AnalyticsData";
import type { Ga4TableReport } from "@/app/analytics/integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { compact, full, percent } from "@/app/charts/format";
import { useState } from "react";
import type { ActiveCompanies, ContactsCreated } from "@/lib/integrations/hubspotJourney";
import { HUBSPOT_SOURCE_TO_GA4_CHANNEL } from "@/lib/integrations/hubspotJourney";

type Journey = { companies: ActiveCompanies; contacts: ContactsCreated };

function lastSeen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function prettySource(code: string): string {
  return code.toLowerCase().replace(/_/g, " ");
}

export default function CustomersPage() {
  const { window: win, days, label } = useReportingWindow();
  const q = windowQuery(win);
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const [showBridge, setShowBridge] = useState(false);

  const journey = useHeld<Journey>(`/api/integrations/hubspot?report=journey&${q}`, [q, tick]);
  const channels = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=acquisitionChannels&${q}`, [q, tick]);
  const landing = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=landingPages&${q}`, [q, tick]);

  const ga4Channels = useMemo(() => {
    if (channels.result?.state !== "ok") return null;
    const r = channels.result.data;
    const sessions = metricOf(r, "sessions");
    return new Map(r.rows.map((row) => [row.keys[0], sessions(row)]));
  }, [channels.result]);

  const ga4Landing = useMemo(() => {
    if (landing.result?.state !== "ok") return null;
    const r = landing.result.data;
    const sessions = metricOf(r, "sessions");
    const map = new Map<string, number | null>();
    for (const row of r.rows) {
      const key = row.keys[0].split("?")[0];
      map.set(key, (map.get(key) ?? 0) + (sessions(row) ?? 0));
    }
    return map;
  }, [landing.result]);

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Customers"
        subtitle="What the companies and contacts behind the traffic are doing — HubSpot's web tracking beside GA4, over the same window"
        rightSlot={<WindowPicker />}
      />

      <Gate held={journey} source="HubSpot" loadingLabel="Reading who was on the site…" onRetry={retry}>
        {(data, stale) => {
          const c = data.companies;
          const k = data.contacts;
          const topSource = k.bySource[0];
          const customers = c.rows.filter((r) => r.apsoCustomer && r.apsoCustomer !== "false").length;

          // Bridge: HubSpot original source → GA4 channel group, contacts per 1,000 sessions.
          const bridge = k.bySource.map((s) => {
            const channel = HUBSPOT_SOURCE_TO_GA4_CHANNEL[s.source] ?? null;
            const sessions = channel && ga4Channels ? ga4Channels.get(channel) ?? null : null;
            const rate = sessions ? (s.count / sessions) * 1000 : null;
            return { source: s.source, count: s.count, channel, sessions, rate };
          });

          const pages = k.byFirstUrl.map((u) => {
            const sessions = ga4Landing ? ga4Landing.get(u.url) ?? null : null;
            const rate = sessions ? (u.count / sessions) * 1000 : null;
            return { ...u, sessions, rate };
          });

          return (
            <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Companies seen on the site" value={compact(c.total)} note={`Known companies with a session in ${label.toLowerCase()}`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Of the most recent 50, customers" value={full(customers)} note="Flagged apso_customer in HubSpot" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Contacts created" value={compact(k.total)} note={`In the window · ${k.aggregated} analysed below`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Largest contact source" value={topSource ? prettySource(topSource.source) : "—"} note={topSource && k.aggregated ? `${percent(topSource.count / k.aggregated, 0)} of analysed contacts` : "No contacts"} />
                </Grid>
              </Grid>

              <Section sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Companies on apsoparts.com, most recent first</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
                  {c.total !== null ? `HubSpot counts ${full(c.total)} companies with a session in the window; the ${c.rows.length} most recent are listed.` : `The ${c.rows.length} most recent.`}
                </Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small" sx={{ minWidth: 820 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Company</TableCell>
                        <TableCell>Last on site</TableCell>
                        <TableCell align="right">Page views</TableCell>
                        <TableCell align="right">Visits</TableCell>
                        <TableCell>Original source</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Category</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {c.rows.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box>
                                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{r.name ?? r.domain ?? r.id}</Typography>
                                {r.domain && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.domain}</Typography>}
                              </Box>
                              {r.apsoCustomer && r.apsoCustomer !== "false" && <Chip label="Customer" size="small" sx={{ bgcolor: "#e5f3ea", color: "#155d33", height: 20 }} />}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{lastSeen(r.lastSeen)}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{full(r.pageViews)}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{full(r.visits)}</TableCell>
                          <TableCell>{r.source ? prettySource(r.source) : "—"}</TableCell>
                          <TableCell>{r.salesPriority ?? "—"}</TableCell>
                          <TableCell>{r.category ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {c.rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ color: MUTED }}>No known company had a session on the site in this window.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </Section>

              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <Section sx={{ height: "100%" }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Sessions in, contacts out — by channel</Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
                      GA4 sessions per channel beside the contacts HubSpot attributes to the matching original source. The rate is contacts per 1,000 sessions.
                    </Typography>
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>HubSpot source</TableCell>
                            <TableCell>GA4 channel</TableCell>
                            <TableCell align="right">Sessions (GA4)</TableCell>
                            <TableCell align="right">Contacts (HubSpot)</TableCell>
                            <TableCell align="right">Per 1,000 sessions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {bridge.map((b) => (
                            <TableRow key={b.source}>
                              <TableCell>{prettySource(b.source)}</TableCell>
                              <TableCell sx={{ color: b.channel ? INK : MUTED }}>{b.channel ?? "not a web channel"}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{b.channel ? (ga4Channels ? full(b.sessions) : "…") : "—"}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{full(b.count)}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{b.rate === null ? "—" : b.rate.toFixed(1)}</TableCell>
                            </TableRow>
                          ))}
                          {bridge.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} sx={{ color: MUTED }}>No contacts were created in this window.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Box>
                    <Typography onClick={() => setShowBridge((v) => !v)} sx={{ fontSize: "0.76rem", color: MUTED, mt: 1.25, cursor: "pointer", textDecoration: "underline" }}>
                      {showBridge ? "Hide" : "Show"} how HubSpot sources are matched to GA4 channels
                    </Typography>
                    <Collapse in={showBridge}>
                      <Box sx={{ mt: 1, display: "grid", gap: 0.25 }}>
                        {Object.entries(HUBSPOT_SOURCE_TO_GA4_CHANNEL).map(([s, ch]) => (
                          <Typography key={s} sx={{ fontSize: "0.74rem", color: MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                            {s} → {ch ?? "(no GA4 counterpart)"}
                          </Typography>
                        ))}
                        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>
                          A name bridge, not a measurement: each side attributes with its own tracking, so the rate is indicative, not a funnel.
                        </Typography>
                      </Box>
                    </Collapse>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Contacts by lifecycle stage"
                      caption={`Of the ${k.aggregated} contacts analysed`}
                      stale={stale}
                      empty={k.byLifecycle.length === 0 ? "No contacts in the window." : null}
                      table={{ columns: ["Stage", "Contacts"], numeric: [1], rows: k.byLifecycle.map((s) => [s.stage, full(s.count)]) }}
                    >
                      <BarList rows={k.byLifecycle.map((s) => ({ label: s.stage, value: s.count }))} labelWidth={150} />
                    </ChartFrame>
                  </Section>
                </Grid>
              </Grid>

              <Section>
                <ChartFrame
                  title="First pages that turned into contacts"
                  caption="The page a new contact was first seen on (HubSpot), with GA4 landing sessions for the same path where GA4 has it"
                  stale={stale}
                  empty={pages.length === 0 ? "No contact in the window carries a first-page URL — contacts created offline or imported do not." : null}
                  table={{
                    columns: ["First page", "Contacts", "Landing sessions (GA4)", "Per 1,000 sessions"],
                    numeric: [1, 2, 3],
                    rows: pages.map((p) => [p.url, full(p.count), p.sessions === null ? "—" : full(p.sessions), p.rate === null ? "—" : p.rate.toFixed(1)]),
                  }}
                >
                  <BarList
                    rows={pages.map((p) => ({ label: p.url, value: p.count, secondary: p.rate === null ? "" : `${p.rate.toFixed(1)} per 1,000 sessions` }))}
                    labelWidth={280}
                    maxLabel={50}
                  />
                </ChartFrame>
              </Section>
            </Box>
          );
        }}
      </Gate>

      <SourceNote>
        Sources: HubSpot CRM search on hs_analytics_last_timestamp (companies) and createdate (contacts) with HubSpot's own attribution fields; GA4 Data API by
        sessionDefaultChannelGroup and landingPagePlusQueryString. Window {win.from} → {win.to} ({days} days). Nothing here is estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}
