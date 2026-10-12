"use client";
// ONE STAGE OF THE CUSTOMER JOURNEY, on its own page (SARCLA 12.10). Every KPI
// of it from the catalogue: the measured ones with their year so far, last year
// or target and the months; the breakdowns the stage needs; and the ones not
// connected yet, each with what it is waiting for. The customers stage is a
// drill-down of every company (Customers.tsx).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import PublicIcon from "@mui/icons-material/Public";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ForwardToInboxIcon from "@mui/icons-material/ForwardToInbox";

import PageHeader from "@/app/PageHeader";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, FAINT, GlassCard, MUTED, RED } from "@/app/uc/report/ui";
import { KPIS, stageBySlug } from "@/lib/marketingKpis/catalogue";
import type { LiveKpis } from "@/lib/marketingKpis/live";
import { KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, journeyAdditionsIn, journeyExtrasIn, measuredIn, notConnectedIn, stageTint, type MkState } from "./data";
import { CustomersExplorer } from "./Customers";

const n0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en"));
const pct = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? "—" : `${((a / b) * 100).toFixed(1)}%`);

/** What each stage shows beyond its KPI cards. */
function Breakdowns({ slug, live }: { slug: string; live?: LiveKpis }) {
  if (!live) return null;
  const b = live.breakdowns;
  if (slug === "visit" && (b.channels.length || b.countries.length)) {
    const sessions = b.channels.reduce((s, c) => s + c.sessions, 0);
    return (
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <GlassCard>
          <CardTitle icon={<AltRouteIcon />} tint="blue" title="Traffic origin" note={`GA4 sessions by channel, ${live.year} so far`} />
          <BarList rows={b.channels.map((c) => ({ label: c.label, value: c.sessions, secondary: `${pct(c.sessions, sessions)} · ${n0(c.newUsers)} new users` }))} />
        </GlassCard>
        <GlassCard>
          <CardTitle icon={<PublicIcon />} tint="blue" title="Visitors by country" note={`GA4 sessions, ${live.year} so far - top 10`} />
          <BarList rows={b.countries.map((c) => ({ label: c.label, value: c.sessions }))} />
        </GlassCard>
      </Box>
    );
  }
  if (slug === "reach" && b.searchCountries.length) {
    return (
      <GlassCard>
        <CardTitle icon={<TravelExploreIcon />} tint="blue" title="Search visibility by country" note={`Search Console clicks, ${live.year} so far`} />
        <BarList rows={b.searchCountries.map((c) => ({ label: c.label, value: c.clicks, secondary: `${n0(c.impressions)} impressions` }))} />
      </GlassCard>
    );
  }
  if (slug === "handover") {
    const data = MONTHS.slice(0, live.monthsDone + 1).map((x, i) => ({ x, ESO: b.handover.eso.months[i] ?? 0, TSA: b.handover.tsa.months[i] ?? 0 }));
    return (
      <GlassCard>
        <CardTitle icon={<ForwardToInboxIcon />} tint="amber" title="Who receives the leads" note="Tickets created from forms and chat, ESO and TSA, this year by month" />
        <ChartFrame table={{ columns: ["Month", "ESO", "TSA"], rows: data.map((d) => [d.x, d.ESO, d.TSA]), numeric: [1, 2] }}>
          <StackedColumns data={data} parts={[{ key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" }]} height={220} />
        </ChartFrame>
      </GlassCard>
    );
  }
  return null;
}

export function StageView({ slug, state, header = true }: { slug: string; state: MkState | null; header?: boolean }) {
  const s = stageBySlug(slug);
  if (!s) return null;
  const year = new Date().getFullYear();
  const views = state?.inputs ? buildViews(state.inputs, state.live?.value, year) : null;
  // the stage's catalogue KPIs that are measured, plus the journey's extras (SEA cost)
  const measured = measuredIn(s.id).map((k) => ({ k, v: views?.[k.id] }));
  for (const id of journeyExtrasIn(s.id)) if (views?.[id]) measured.push({ k: { ...KPIS[0], id, name: "", question: "", definition: "" }, v: views[id] });
  if (s.id === "7" && views?.X01) measured.push({ k: { ...KPIS[0], id: "X01", name: "SEA cost", question: "What do the ads cost?", definition: "Google Ads + Microsoft Ads spend." }, v: views.X01 });
  const missing = [...notConnectedIn(s.id), ...journeyAdditionsIn(s.id)];
  const customers = s.slug === "customers";
  const count = customers ? measuredIn(s.id).length : measured.length;
  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      {header && <PageHeader title={s.name} subtitle={stageLine(s.id, count, missing.length, year)} />}
      {!views && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!state?.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading…"}</Typography>
        </Box></GlassCard>
      )}
      {s.note && (
        <GlassCard sx={{ py: 1.5 }}>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}><b style={{ color: "#15223a" }}>Note:</b> {s.note}</Typography>
        </GlassCard>
      )}
      {customers && <CustomersExplorer />}
      {views && state && !customers && (
        <>
          {measured.length > 0 && (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>
              {measured.map(({ k, v }) => v && <KpiCard key={k.id} v={v} kpi={k} icon={<StageGlyph slug={s.slug} />} tint={stageTint(s.slug)} />)}
            </Box>
          )}
          <Breakdowns slug={s.slug} live={state.live?.value} />
          {!measured.length && <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>Nothing in this stage is measured yet - below is what each KPI needs.</Typography>}
          <NotConnected list={missing} />
          <LiveNote state={state} />
        </>
      )}
      {customers && <NotConnected list={missing} />}
    </Box>
  );
}

export const stageLine = (id: string, measured: number, missing: number, year: number) =>
  `Stage ${id} of the customer journey · ${measured} of ${measured + missing} KPIs measured · ${year}`;
