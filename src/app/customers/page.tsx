"use client";

// CUSTOMERS — the CRM side of the traffic. HubSpot's own web tracking knows
// which companies were on apsoparts.com and when; GA4 knows the sessions by
// channel and landing page. Every company and contact links straight to its
// HubSpot record, and a row opens into the people behind it and the pages
// they actually looked at.

import { useMemo, useState, Fragment } from "react";
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
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { metricOf, useHeld } from "@/app/analytics/AnalyticsData";
import type { Ga4TableReport } from "@/app/analytics/integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { compact, full, percent } from "@/app/charts/format";
import type { ActiveCompanies, CompanyDetail, ContactsCreated, SegmentCounts } from "@/lib/integrations/hubspotJourney";
import { HUBSPOT_SOURCE_TO_GA4_CHANNEL } from "@/lib/integrations/hubspotJourney";

type Journey = { companies: ActiveCompanies; contacts: ContactsCreated; segments: SegmentCounts };

/** Portal 26492587 on the EU cluster; 0-2 = companies, 0-1 = contacts. */
const HS_PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-2/${id}`;
const hsContactUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-1/${id}`;

/** "2-Prio 2 - Pot btw 2500 & 24999€" → "Prio 2". */
function shortPriority(v: string | null): string {
  if (!v) return "—";
  const m = /Prio\s*\d/.exec(v);
  return m ? m[0] : v;
}

function lastSeen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function prettySource(code: string): string {
  return code.toLowerCase().replace(/_/g, " ");
}

const SEGMENT_TONES: Record<string, { bg: string; fg: string }> = {
  APSOcore: { bg: "#e5f3ea", fg: "#155d33" },
  APSOgrowth: { bg: "#e3edf7", fg: "#1b4a80" },
  APSOmicro: { bg: "#eef0f3", fg: "#3c4043" },
  "Growth Engine Customer": { bg: "#e5f3ea", fg: "#155d33" },
  APSOprospect: { bg: "#fff4e0", fg: "#9a5d00" },
  APSOlost: { bg: "#fdf3f2", fg: "#9e1b18" },
};

function CompanyDetailPanel({ id }: { id: string }) {
  const detail = useHeld<CompanyDetail>(`/api/integrations/hubspot?report=companyDetail&id=${id}`, [id]);
  const r = detail.result;
  if (r === null) return <LoadingPanel label="Reading the people and their visits…" />;
  if (r.state === "not-configured") return <Typography sx={{ fontSize: "0.84rem", color: MUTED, p: 2 }}>HubSpot is not connected.</Typography>;
  if (r.state === "error") return <UpstreamPanel source="HubSpot" error={r.error} status={r.status} onRetry={() => undefined} />;
  const d = r.data;
  return (
    <Grid container spacing={2.5} sx={{ p: 2, pt: 1 }}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED, mb: 1 }}>
          People at this company ({d.contacts.length})
        </Typography>
        {d.contacts.length === 0 && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No contacts are associated in HubSpot.</Typography>}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {d.contacts.map((c) => (
            <Box key={c.id} sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
              <Link href={hsContactUrl(c.id)} target="_blank" rel="noreferrer" sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#274e64", textDecorationColor: "rgba(39,78,100,0.35)" }}>
                {c.name}
                <OpenInNewIcon sx={{ fontSize: 12, ml: 0.4, verticalAlign: "middle" }} />
              </Link>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                {[c.jobTitle, c.email].filter(Boolean).join(" · ")}
              </Typography>
              {c.lastSeen && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>· on site {ago(c.lastSeen)}</Typography>}
            </Box>
          ))}
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED, mb: 1 }}>
          Pages these people looked at
        </Typography>
        {d.visits === null ? (
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            HubSpot refused the page-visit events: {d.visitsError}. The app token needs the web-analytics scope — it was
            added to the private app, so a token refreshed from the app picks it up.
          </Typography>
        ) : d.visits.length === 0 ? (
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No page-visit events on the associated contacts.</Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 0.4 }}>
            {d.visits.map((v, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "baseline", borderBottom: `1px solid ${HAIRLINE}`, pb: 0.4 }}>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, minWidth: 76, fontVariantNumeric: "tabular-nums" }}>{ago(v.at)}</Typography>
                <Typography sx={{ fontSize: "0.82rem", color: INK, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{v.url}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED, ml: "auto", whiteSpace: "nowrap" }}>{v.contact}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Grid>
    </Grid>
  );
}

export default function CustomersPage() {
  const { window: win, days, label } = useReportingWindow();
  const q = windowQuery(win);
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const [showBridge, setShowBridge] = useState(false);
  const [openCompany, setOpenCompany] = useState<string | null>(null);

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
    <Box>
      <Gate held={journey} source="HubSpot" loadingLabel="Reading who was on the site…" onRetry={retry}>
        {(data, stale) => {
          const c = data.companies;
          const k = data.contacts;
          const seg = data.segments;
          const prio1 = seg.priorities.find((p) => p.value.startsWith("1-"));

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
                  <StatTile
                    label="APSO customers among them"
                    value={compact(seg.customersActive)}
                    note={c.total && seg.customersActive !== null ? `${percent(seg.customersActive / c.total, 0)} of companies seen · core, growth, micro` : "APSOcore, APSOgrowth, APSOmicro"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Priority 1 companies on the site" value={compact(prio1?.count ?? null)} note={prio1 ? prio1.label : "sales_priority from HubSpot"} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Contacts created" value={compact(k.total)} note={`In the window · ${k.aggregated} analysed below`} />
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Companies on the site, by APSO segment"
                      caption="HubSpot totals for the window, one count per segment"
                      stale={stale}
                      empty={seg.apsoSegments.length === 0 ? "The apso_customer property returned no options." : null}
                      table={{ columns: ["Segment", "Companies"], numeric: [1], rows: seg.apsoSegments.map((s) => [s.label, full(s.count)]) }}
                    >
                      <BarList rows={seg.apsoSegments.map((s) => ({ label: s.label, value: s.count }))} labelWidth={190} />
                    </ChartFrame>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Companies on the site, by sales priority"
                      caption="HubSpot totals for the window, one count per priority"
                      stale={stale}
                      empty={seg.priorities.length === 0 ? "The sales_priority property returned no options." : null}
                      table={{ columns: ["Priority", "Companies"], numeric: [1], rows: seg.priorities.map((s) => [s.label, full(s.count)]) }}
                    >
                      <BarList rows={seg.priorities.map((s) => ({ label: s.label, value: s.count }))} labelWidth={230} maxLabel={34} />
                    </ChartFrame>
                  </Section>
                </Grid>
              </Grid>

              <Section sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Companies on apsoparts.com, most recent first</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
                  {c.total !== null ? `HubSpot counts ${full(c.total)} companies with a session in the window; the ${c.rows.length} most recent are listed. ` : `The ${c.rows.length} most recent. `}
                  A row opens into the people behind it and the pages they looked at; names link to HubSpot.
                </Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small" sx={{ minWidth: 860 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 36 }} />
                        <TableCell>Company</TableCell>
                        <TableCell>Last on site</TableCell>
                        <TableCell align="right">Page views</TableCell>
                        <TableCell align="right">Visits</TableCell>
                        <TableCell>Original source</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Segment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {c.rows.map((r) => {
                        const openRow = openCompany === r.id;
                        // Old CRM rows sometimes carry a literal "true"/"false"
                        // here from before the property became an enumeration.
                        const segment = r.apsoCustomer && r.apsoCustomer !== "false" && r.apsoCustomer !== "true" ? r.apsoCustomer : null;
                        const tone = segment ? SEGMENT_TONES[segment] ?? { bg: "#eef0f3", fg: "#3c4043" } : null;
                        return (
                          <Fragment key={r.id}>
                            <TableRow hover sx={{ "& td": { borderBottom: openRow ? "none" : undefined } }}>
                              <TableCell sx={{ pr: 0 }}>
                                <IconButton size="small" onClick={() => setOpenCompany(openRow ? null : r.id)} aria-label={openRow ? "Collapse" : "Expand"}>
                                  <ExpandMoreIcon sx={{ fontSize: 18, transform: openRow ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                                </IconButton>
                              </TableCell>
                              <TableCell>
                                <Link href={hsCompanyUrl(r.id)} target="_blank" rel="noreferrer" sx={{ textDecoration: "none", "&:hover .company-name": { textDecoration: "underline" } }}>
                                  <Typography className="company-name" sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#274e64", display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                                    {r.name ?? r.domain ?? r.id}
                                    <OpenInNewIcon sx={{ fontSize: 12, color: MUTED }} />
                                  </Typography>
                                </Link>
                                {r.domain && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.domain}</Typography>}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>{lastSeen(r.lastSeen)}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{full(r.pageViews)}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{full(r.visits)}</TableCell>
                              <TableCell>{r.source ? prettySource(r.source) : "—"}</TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>{shortPriority(r.salesPriority)}</TableCell>
                              <TableCell>
                                {tone && segment ? (
                                  <Chip label={segment} size="small" sx={{ bgcolor: tone.bg, color: tone.fg, height: 20, fontSize: "0.68rem" }} />
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                            {openRow && (
                              <TableRow>
                                <TableCell colSpan={8} sx={{ p: 0, bgcolor: "#fafbfc" }}>
                                  <Collapse in appear>
                                    <CompanyDetailPanel id={r.id} />
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                      {c.rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} sx={{ color: MUTED }}>No known company had a session on the site in this window.</TableCell>
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
                      caption={`Of the ${k.aggregated} contacts analysed · labels from the portal's own stages`}
                      stale={stale}
                      empty={k.byLifecycle.length === 0 ? "No contacts in the window." : null}
                      table={{ columns: ["Stage", "Contacts"], numeric: [1], rows: k.byLifecycle.map((s) => [s.stage, full(s.count)]) }}
                    >
                      <BarList rows={k.byLifecycle.map((s) => ({ label: s.stage, value: s.count }))} labelWidth={190} />
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
        Sources: HubSpot CRM search on hs_analytics_last_timestamp (companies) and createdate (contacts) with HubSpot&apos;s own attribution fields, segment and
        priority counts one per property option, page visits from HubSpot&apos;s web-analytics events on the associated contacts; GA4 Data API by
        sessionDefaultChannelGroup and landingPagePlusQueryString. Window {win.from} → {win.to} ({days} days). Nothing here is estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}
