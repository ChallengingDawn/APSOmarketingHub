"use client";

// SMEC TARGETS — the agency KPIs against their 2026 goals, pinned to the
// year-to-date (targets are annual; the hub-wide window does not apply and
// the header says so). Every live figure is GA4 filtered to the Paid Search
// channel — the sheet's baselines are SEA figures — or a HubSpot count.
// Each live KPI gets a pace bar; the rest state plainly where their number
// lives instead of estimating.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useState } from "react";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote } from "../Shell";
import { metricOf, useHeld } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { ShareBar } from "@/app/charts/ShareBar";
import { PaceBar } from "@/app/charts/PaceBar";
import { compact, dayLabel, full, percent } from "@/app/charts/format";
import { SMEC_TARGETS, SMEC_YEAR, type SmecMeasure } from "./targets";
import { useTrackingHealth } from "../tracking/useTrackingHealth";
import { AttributionNotice } from "../tracking/AttributionNotice";

type NewBuyers = { year: number; firstOrderTotal: number | null; firstOrderPaidSearch: number | null };

type GclidStatus = {
  gclidContacts: number | null;
  consentContacts: number | null;
  consentGranted: number | null;
  consentDenied: number | null;
  liveCaptures: number | null;
  backfill: number | null;
};

function ytdRange(): { from: string; to: string; elapsed: number; monthsGone: number } {
  const now = new Date();
  const from = `${SMEC_YEAR}-01-01`;
  const to = now.toISOString().slice(0, 10);
  const start = Date.UTC(SMEC_YEAR, 0, 1);
  const end = Date.UTC(SMEC_YEAR + 1, 0, 1);
  // Whole UTC days, so the server render and the client hydration derive identical styles (the pace marker).
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsed = Math.min(1, Math.max(0, (today - start) / (end - start)));
  return { from, to, elapsed, monthsGone: elapsed * 12 };
}

/** Ahead/behind the straight-line pace toward an annual goal. */
function paceLabel(actual: number | null, goal: number, elapsed: number): { text: string; tone: "ahead" | "behind" | "flat" } {
  if (actual === null || elapsed <= 0) return { text: "no pace yet", tone: "flat" };
  const expected = goal * elapsed;
  if (expected <= 0) return { text: "no pace yet", tone: "flat" };
  const ratio = actual / expected;
  if (ratio >= 1) return { text: `${percent(ratio - 1)} ahead of pace`, tone: "ahead" };
  return { text: `${percent(1 - ratio)} behind pace`, tone: "behind" };
}

const TONE_STYLE: Record<"ahead" | "behind" | "flat", { bg: string; fg: string }> = {
  ahead: { bg: "#e5f3ea", fg: "#155d33" },
  behind: { bg: "#fdf3f2", fg: "#9e1b18" },
  flat: { bg: "#eef0f3", fg: "#3c4043" },
};

function monthLabel(yyyymm: string): string {
  const m = Number(yyyymm.slice(4, 6));
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? yyyymm;
}

export default function SmecTargetsPage() {
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);
  const { from, to, elapsed, monthsGone } = ytdRange();
  const q = `from=${from}&to=${to}`;
  const SEA = "&channel=Paid%20Search";

  const keyEvents = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=keyEventsByName&${q}${SEA}`, [q, tick]);
  const purchasers = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=purchaserTotals&${q}${SEA}`, [q, tick]);
  const monthly = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=signupsMonthly&${q}${SEA}&event=sign_up`, [q, tick]);
  const gclid = useHeld<GclidStatus>(`/api/integrations/hubspot?report=gclidStatus`, [tick]);
  const purchasersAll = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=purchaserTotals&${q}`, [q, tick]);
  const buyers = useHeld<NewBuyers>(`/api/integrations/hubspot?report=newBuyers&year=${SMEC_YEAR}`, [tick]);
  // Paid Search counters are only as good as GA4 channel attribution: show the same verdict as Tracking health.
  const tracking = useTrackingHealth(tick);

  // Live actuals, derived once and shared by tiles, bars and table rows.
  const ke = keyEvents.result;
  const keGet = ke && ke.state === "ok" ? metricOf(ke.data, "keyEvents") : null;
  const keRow = (name: string) => (ke && ke.state === "ok" && keGet ? ke.data.rows.find((r) => r.keys[0] === name) ?? null : null);
  const signups = keRow("sign_up") ? keGet!(keRow("sign_up")!) : null;
  const purchases = keRow("purchase") ? keGet!(keRow("purchase")!) : null;
  const pr = purchasers.result;
  const prRow = pr && pr.state === "ok" ? pr.data.rows[0] ?? null : null;
  // The sheet's method for new buying customers: Compass first orders this
  // year × GA4's Paid Search share of transactions.
  const pa = purchasersAll.result;
  const paRow = pa && pa.state === "ok" ? pa.data.rows[0] ?? null : null;
  const txSea = pr && pr.state === "ok" && prRow ? metricOf(pr.data, "transactions")(prRow) : null;
  const txAll = pa && pa.state === "ok" && paRow ? metricOf(pa.data, "transactions")(paRow) : null;
  const seaShare = txSea !== null && txAll ? txSea / txAll : null;
  const by = buyers.result;
  const firstOrders = by && by.state === "ok" ? by.data.firstOrderTotal : null;
  const newBuyers = firstOrders !== null && seaShare !== null ? Math.round(firstOrders * seaShare) : null;
  const revenue = pr && pr.state === "ok" && prRow ? metricOf(pr.data, "totalRevenue")(prRow) : null;
  const cvr = signups && purchases !== null ? purchases / signups : null;

  const actualFor = (m: SmecMeasure): number | null =>
    m === "signups" ? signups : m === "newbuyers" ? newBuyers : m === "revenue" ? revenue : m === "cvr" ? cvr : null;
  const formatFor = (m: SmecMeasure) => (n: number) => (m === "revenue" ? compact(n) : m === "cvr" ? percent(n) : full(n));

  const goalOf = (m: SmecMeasure) => SMEC_TARGETS.find((t) => t.measure === m)?.goalValue ?? null;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Chip
          label={`Year to date · 1 Jan – ${dayLabel(to)} · ${percent(elapsed, 0)} of ${SMEC_YEAR}`}
          size="small"
          sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }}
        />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Paid Search (SEA) figures against the full-year goals</Typography>
      </Box>

      <AttributionNotice health={tracking.derived?.health ?? null} />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={keyEvents} source="Google Analytics 4" loadingLabel="Counting sign-ups…" onRetry={retry}>
            {(_r, stale) => {
              const goal = goalOf("signups");
              const pace = goal ? paceLabel(signups, goal, elapsed) : null;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <StatTile label="Sign-ups YTD (SEA)" value={signups === null ? "—" : full(signups)} note={goal ? `Goal ${full(goal)} · ${pace?.text}` : "No goal"} />
                </Box>
              );
            }}
          </Gate>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={buyers} source="HubSpot" loadingLabel="Counting first orders…" onRetry={retry}>
            {(b, stale) => {
              const goal = goalOf("newbuyers");
              const pace = goal ? paceLabel(newBuyers, goal, elapsed) : null;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <StatTile
                    label="New buying customers YTD (SEA)"
                    value={newBuyers === null ? "—" : full(newBuyers)}
                    note={
                      newBuyers === null
                        ? `${full(b.firstOrderTotal)} first orders this year · waiting for GA4's Paid Search share`
                        : `Goal ${full(goal)} · ${pace?.text} · ${full(b.firstOrderTotal)} first orders × ${percent(seaShare)} SEA share`
                    }
                  />
                </Box>
              );
            }}
          </Gate>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={purchasers} source="Google Analytics 4" loadingLabel="Summing SEA revenue…" onRetry={retry}>
            {(_r, stale) => {
              const goal = goalOf("revenue");
              const pace = goal ? paceLabel(revenue, goal, elapsed) : null;
              const tx = pr && pr.state === "ok" && prRow ? metricOf(pr.data, "transactions")(prRow) : null;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                  <StatTile label="SEA revenue YTD" value={compact(revenue)} note={goal ? `Goal ${compact(goal)} · ${pace?.text} · ${compact(tx)} transactions` : "No goal"} />
                </Box>
              );
            }}
          </Gate>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Gate held={gclid} source="HubSpot" loadingLabel="Checking gclid capture…" onRetry={retry}>
            {(data, stale) => (
              <Box sx={{ opacity: stale ? 0.7 : 1 }}>
                <StatTile
                  label="Click ids captured with consent"
                  value={full(data.liveCaptures)}
                  note={`Live since 11 Sep · plus ${full(data.backfill)} rebuilt from past visits, without consent`}
                />
              </Box>
            )}
          </Gate>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Section sx={{ height: "100%" }}>
            <Gate held={monthly} source="Google Analytics 4" loadingLabel="Charting SEA sign-ups by month…" onRetry={retry}>
              {(rep, stale) => {
                const get = metricOf(rep, "keyEvents");
                const pts = rep.rows.map((r) => ({ x: r.keys[0], value: get(r) }));
                const goal = goalOf("signups");
                const needPerMonth = goal ? goal / 12 : null;
                return (
                  <ChartFrame
                    title="SEA sign-ups per month"
                    caption={needPerMonth ? `Paid Search sign_up key events · the goal needs ${full(Math.round(needPerMonth))} a month; ${monthsGone.toFixed(1)} months gone` : "Paid Search sign_up key events"}
                    stale={stale}
                    empty={pts.length < 2 ? "GA4 returned fewer than two months." : null}
                    table={{ columns: ["Month", "Sign-ups (SEA)"], numeric: [1], rows: rep.rows.map((r) => [monthLabel(r.keys[0]), full(get(r))]) }}
                  >
                    <TrendChart data={pts} seriesLabel="Sign-ups (SEA)" height={200} xFormat={monthLabel} />
                  </ChartFrame>
                );
              }}
            </Gate>
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Section sx={{ height: "100%" }}>
            <Gate held={gclid} source="HubSpot" loadingLabel="Reading consent split…" onRetry={retry}>
              {(data, stale) => {
                const segs = [
                  { label: "Ad storage granted", value: data.consentGranted },
                  { label: "Ad storage denied", value: data.consentDenied },
                ];
                const any = segs.some((s) => (s.value ?? 0) > 0);
                return (
                  <ChartFrame
                    title="Consent recorded on contacts"
                    caption="Consent Mode v2 flags written by the shop tag — the signal Google Ads needs before any upload. Full declines are never written (no consent to process)."
                    stale={stale}
                    empty={any ? null : "No consent flags recorded yet — they land when an identified visitor makes a choice."}
                    table={{ columns: ["Flag", "Contacts"], numeric: [1], rows: segs.map((s) => [s.label, full(s.value)]) }}
                  >
                    <ShareBar segments={segs.map((s) => ({ label: s.label, value: s.value ?? 0 }))} />
                  </ChartFrame>
                );
              }}
            </Gate>
          </Section>
        </Grid>
      </Grid>

      {(["Acquisition", "Retention & Reactivation", "Revenue"] as const).map((area) => (
        <Section key={area} sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1.25 }}>{area}</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.82rem", verticalAlign: "top" } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>KPI</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>Baseline 2025</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED }}>Goal 2026</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: MUTED, minWidth: 320 }}>Live here (YTD, Paid Search)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SMEC_TARGETS.filter((t) => t.area === area).map((t) => {
                  const actual = actualFor(t.measure);
                  const live = t.measure !== "none";
                  const pace = live && t.goalValue ? paceLabel(actual, t.goalValue, elapsed) : null;
                  const fmt = formatFor(t.measure);
                  return (
                    <TableRow key={t.kpi}>
                      <TableCell sx={{ fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{t.kpi}</TableCell>
                      <TableCell sx={{ color: INK, whiteSpace: "nowrap" }}>{t.baseline}</TableCell>
                      <TableCell sx={{ color: INK }}>{t.goal}</TableCell>
                      <TableCell>
                        {live ? (
                          <Box sx={{ display: "grid", gap: 0.75 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>
                                {actual === null ? "—" : fmt(actual)}
                              </Typography>
                              {pace && (
                                <Chip label={pace.text} size="small" sx={{ height: 19, fontSize: "0.66rem", bgcolor: TONE_STYLE[pace.tone].bg, color: TONE_STYLE[pace.tone].fg }} />
                              )}
                              {t.note && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{t.note}</Typography>}
                            </Box>
                            {t.goalValue ? <PaceBar actual={actual} goal={t.goalValue} elapsed={elapsed} format={fmt} /> : null}
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t.unavailable ?? "—"}</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Section>
      ))}

      <SourceNote>
        Targets transcribed from KPIs_SMEC_2026.xlsx (sheet “SMEC Targets”). Live figures: GA4 key events and purchase
        revenue filtered to the Paid Search channel for {from} → {to}; new buying customers = HubSpot companies with a Compass
        first order in {SMEC_YEAR} × GA4&apos;s Paid Search share of transactions (the sheet&apos;s method); HubSpot counts of
        contacts carrying a gclid: captured with consent = a gclid plus the consent flags the shop tag writes; rebuilt = a gclid without consent flags (the 11 Sep backfill from page URLs HubSpot had stored). Pace compares year-to-date actuals with the straight-line share of the
        annual goal ({percent(elapsed)} of the year); the bar’s marker sits at that share. Where a number lives in Google
        Ads or Compass, the row says so instead of estimating.
      </SourceNote>
    </Box>
  );
}
