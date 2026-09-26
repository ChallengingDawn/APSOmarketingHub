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
import { useEffect, useState } from "react";
import { Gate, HAIRLINE, INK, MUTED, Section, SourceNote } from "../Shell";
import { metricOf, useHeld } from "../AnalyticsData";
import type { Ga4TableReport } from "../integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { ShareBar } from "@/app/charts/ShareBar";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { PaceBar } from "@/app/charts/PaceBar";
import { compact, dayLabel, full, percent } from "@/app/charts/format";
import { SMEC_TARGETS, SMEC_YEAR, type SmecMeasure } from "./targets";

type NewBuyers = { year: number; firstOrderTotal: number | null; firstOrderPaidSearch: number | null };

type CustomerTypeMonth = { month: string; orders: number; new: number; active: number; reactivated: number; unknown: number };
type CustomerTypes = {
  months: CustomerTypeMonth[];
  totals: Omit<CustomerTypeMonth, "month">;
  from: string;
  to: string;
  webOrders: number;
  generatedAt: string;
  computing: boolean;
  error?: string;
  progress?: string;
};

type CustomerYear = {
  activeCompanies?: number;
  reactivatedCompanies?: number;
  newCompanies?: number;
  continuingCompanies?: number;
  ordersInYear?: number;
  computing?: boolean;
  progress?: string;
  error?: string;
};

type RegistrationCohort = {
  registrations?: number;
  converted?: number;
  rate?: number | null;
  computing?: boolean;
  progress?: string;
  error?: string;
};

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

  // Customer types, the signal the Ads tag now sends. Half a year, because reading
  // further back costs minutes of HubSpot calls for a shape that barely moves.
  const [typesTick, setTypesTick] = useState(0);
  const typesTo = to;
  const typesFrom = new Date(Date.parse(`${to}T00:00:00Z`) - 91 * 86_400_000).toISOString().slice(0, 10);
  const types = useHeld<CustomerTypes>(
    `/api/integrations/hubspot?report=customerTypes&from=${typesFrom}&to=${typesTo}`,
    [typesFrom, typesTo, tick, typesTick],
  );
  const spend = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=adsSpend&${q}`, [q, tick]);
  const year = useHeld<CustomerYear>(`/api/integrations/hubspot?report=customerYear&year=${SMEC_YEAR}`, [tick, typesTick]);
  const cohort = useHeld<RegistrationCohort>(`/api/integrations/hubspot?report=registrationCohort&year=${SMEC_YEAR}`, [tick, typesTick]);

  const typesResult = types.result;
  const yearData = year.result?.state === "ok" ? year.result.data : null;
  const cohortData = cohort.result?.state === "ok" ? cohort.result.data : null;
  const typesComputing =
    (typesResult?.state === "ok" && typesResult.data.computing) ||
    Boolean(yearData?.computing) ||
    Boolean(cohortData?.computing);
  // The first caller starts a multi-minute count and is told so; look again shortly.
  useEffect(() => {
    if (!typesComputing) return;
    const t = setTimeout(() => setTypesTick((n) => n + 1), 30_000);
    return () => clearTimeout(t);
  }, [typesComputing, typesTick]);

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

  // Google Ads spend, straight from the Ads-to-GA4 link: what used to be "smec's number".
  const sp = spend.result;
  const spendRows = sp && sp.state === "ok" ? sp.data.rows : [];
  const spendGet = sp && sp.state === "ok" ? metricOf(sp.data, "advertiserAdCost") : null;
  const revGet = sp && sp.state === "ok" ? metricOf(sp.data, "totalRevenue") : null;
  // GA4 answers this dimension with a "(not set)" row that carries every session
  // with no Ads account — its revenue is the whole shop's. Only rows with spend count.
  const paidRows = spendGet ? spendRows.filter((r) => (spendGet(r) ?? 0) > 0) : [];
  const adCost = spendGet ? paidRows.reduce((sum, r) => sum + (spendGet(r) ?? 0), 0) : null;
  const adRevenue = revGet ? paidRows.reduce((sum, r) => sum + (revGet(r) ?? 0), 0) : null;
  const txGet = sp && sp.state === "ok" ? metricOf(sp.data, "transactions") : null;
  const adTransactions = txGet ? paidRows.reduce((sum, r) => sum + (txGet(r) ?? 0), 0) : null;
  const roas = adCost && adRevenue !== null && adCost > 0 ? adRevenue / adCost : null;
  const cpa = adCost && adTransactions ? adCost / adTransactions : null;
  const costPerNewCustomer = adCost && newBuyers ? adCost / newBuyers : null;
  const cvrCohort = cohortData?.rate ?? null;

  const actualFor = (m: SmecMeasure): number | null =>
    m === "signups" ? signups
      : m === "newbuyers" ? newBuyers
        : m === "revenue" ? revenue
          : m === "cvr" ? cvrCohort
            : m === "active" ? yearData?.activeCompanies ?? null
              : m === "reactivated" ? yearData?.reactivatedCompanies ?? null
                : m === "roas" ? roas
                  : m === "cpa" ? cpa
                    : m === "costPerNewCustomer" ? costPerNewCustomer
                      : null;
  /** The two CRM counts take minutes; a row backed by one says so instead of showing a dash. */
  const counting = (m: SmecMeasure): boolean =>
    (m === "active" || m === "reactivated") ? Boolean(yearData?.computing)
      : m === "cvr" ? Boolean(cohortData?.computing)
        : false;
  const money = (n: number) => n.toLocaleString("en-CH", { maximumFractionDigits: n < 100 ? 2 : 0 });
  const formatFor = (m: SmecMeasure) => (n: number) =>
    m === "revenue" ? compact(n)
      : m === "cvr" ? percent(n)
        : m === "roas" ? n.toFixed(1)
          : m === "cpa" || m === "costPerNewCustomer" ? money(n)
            : full(n);

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

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Section sx={{ height: "100%" }}>
            <Gate held={types} source="HubSpot" loadingLabel="Sorting orders by customer type…" onRetry={retry}>
              {(data, stale) => {
                const rows = data.months.map((m) => ({ x: m.month, active: m.active, reactivated: m.reactivated, new: m.new }));
                const t = data.totals;
                const share = (n: number) => (t.orders ? percent(n / t.orders) : "—");
                return (
                  <ChartFrame
                    title="Customer types per month"
                    caption={
                      data.computing
                        ? `Counting — ${data.progress ?? "starting"}. Three months of orders plus a year of history takes a few minutes; the answer is then kept for twelve hours.`
                        : `Every order sorted by the buying company's own history: ${share(t.active)} active, ${share(t.reactivated)} reactivated, ${share(t.new)} new. This is the value the Google Ads tag now sends with each purchase.`
                    }
                    stale={stale}
                    empty={
                      rows.length === 0
                        ? data.error
                          ? `HubSpot refused the count: ${data.error}`
                          : data.computing
                            ? `Still counting: ${data.progress ?? "starting"}.`
                            : "No orders in the window."
                        : null
                    }
                    table={{
                      columns: ["Month", "Orders", "Active", "Reactivated", "New", "No company"],
                      numeric: [1, 2, 3, 4, 5],
                      rows: data.months.map((m) => [monthLabel(m.month), full(m.orders), full(m.active), full(m.reactivated), full(m.new), full(m.unknown)]),
                    }}
                  >
                    <StackedColumns
                      data={rows}
                      parts={[
                        { key: "active", label: "Active (bought within 12 months)" },
                        { key: "reactivated", label: "Reactivated (13+ months)" },
                        { key: "new", label: "New company" },
                      ]}
                      height={220}
                      format={full}
                      xFormat={monthLabel}
                    />
                  </ChartFrame>
                );
              }}
            </Gate>
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Section sx={{ height: "100%" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.75 }}>What Google Ads is told</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.5 }}>
              The purchase tag carries the buyer&apos;s customer type. Anything we cannot answer is left out, and Google falls back to its own guess.
            </Typography>
            <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.82rem", verticalAlign: "top" } }}>
              <TableBody>
                {[
                  ["New customer yes/no", "Live on all five market tags, from the company's order history"],
                  ["New / active / reactivated as separate conversions", "Waiting for smec's six conversion labels (CH and DE)"],
                  ["Covered store views", "de-CH, de-DE, IT, NL, PL — fr-CH, it-CH, fr-FR, de-AT and international fire no Ads tag at all"],
                  ["History behind the type", "All orders count, web and offline — someone who last ordered by phone is an active customer, not a new one"],
                ].map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell sx={{ color: INK, fontWeight: 600, width: "42%" }}>{k}</TableCell>
                    <TableCell sx={{ color: MUTED }}>{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <SourceNote>HubSpot orders + GTM container GTM-TG6ZQ6G</SourceNote>
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
                  <TableCell sx={{ fontWeight: 600, color: MUTED, minWidth: 320 }}>Live here (year to date)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SMEC_TARGETS.filter((t) => t.area === area).map((t) => {
                  const actual = actualFor(t.measure);
                  const live = t.measure !== "none";
                  const ratio = t.measure === "roas" || t.measure === "cvr";
                  const pace = live && t.goalValue && !ratio ? paceLabel(actual, t.goalValue, elapsed) : null;
                  const against = live && t.goalValue && ratio && actual !== null
                    ? (actual >= t.goalValue
                        ? { text: `${percent(actual / t.goalValue - 1)} above goal`, tone: "ahead" as const }
                        : { text: `${percent(1 - actual / t.goalValue)} below goal`, tone: "behind" as const })
                    : null;
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
                                {actual === null ? (counting(t.measure) ? "counting…" : "—") : fmt(actual)}
                              </Typography>
                              {(pace ?? against) && (
                                <Chip
                                  label={(pace ?? against)!.text}
                                  size="small"
                                  sx={{ height: 19, fontSize: "0.66rem", bgcolor: TONE_STYLE[(pace ?? against)!.tone].bg, color: TONE_STYLE[(pace ?? against)!.tone].fg }}
                                />
                              )}
                              {t.note && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{t.note}</Typography>}
                            </Box>
                            {t.goalValue && !ratio ? <PaceBar actual={actual} goal={t.goalValue} elapsed={elapsed} format={fmt} /> : null}
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

    </Box>
  );
}
