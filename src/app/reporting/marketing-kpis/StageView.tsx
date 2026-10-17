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
import AdsClickIcon from "@mui/icons-material/AdsClick";

import PageHeader from "@/app/PageHeader";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { KPIS, stageBySlug } from "@/lib/marketingKpis/catalogue";
import type { LiveKpis } from "@/lib/marketingKpis/live";
import { countryName } from "@/lib/marketingKpis/countries";
import { ByAssistant } from "@/app/aeo/OverviewBody";
import { KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, upToOf, stageKpis, stageTint, type MkState } from "./data";
import { CustomersExplorer } from "./Customers";
import { SearchCustomersCard } from "./SearchCustomers";

const n0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en"));
const pct = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? "—" : `${((a / b) * 100).toFixed(1)}%`);

const change = (cur: number | null | undefined, prev: number | null | undefined) => {
  if (cur == null || !prev) return null;
  const r = cur / prev - 1;
  return { text: `${r > 0 ? "↑" : r < 0 ? "↓" : "±"} ${Math.abs(r * 100).toFixed(1)}%`, color: r > 0.005 ? GREEN : r < -0.005 ? RED : MUTED };
};
const months = (xs: number[]) => (xs.length ? (xs.length === 1 ? MONTHS[xs[0]] : `${MONTHS[xs[0]]}–${MONTHS[xs[xs.length - 1]]}`) : "");

/** GA4's names for the Google Ads networks, in plain words. */
const NETWORK: Record<string, string> = {
  "Google search": "Google Search", "Search partners": "Search partners", "Cross-network": "Performance Max (all networks)",
  "Google owned channels": "YouTube, Gmail and Discover", "Display Network": "Display", "YouTube Search": "YouTube", "YouTube Videos": "YouTube",
};

/** A plain table, figures in full (SARCLA: no abbreviations). */
function Table({ head, rows, firstWidth = "minmax(200px, 1.6fr)" }: { head: string[]; rows: { key: string; cells: React.ReactNode[]; strong?: boolean }[]; firstWidth?: string }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      {/* the cells stretch to their row, so a row's line runs straight across */}
      <Box sx={{ display: "grid", gridTemplateColumns: `${firstWidth} repeat(${head.length - 1}, minmax(110px, 1fr))`, minWidth: 220 + (head.length - 1) * 115, alignItems: "stretch" }}>
        {head.map((h, i) => <Typography key={h} sx={{ display: "flex", alignItems: "flex-end", justifyContent: i ? "flex-end" : "flex-start", fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i ? "right" : "left", pb: 0.75, px: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>{h}</Typography>)}
        {rows.map((r) => (
          <Box key={r.key} sx={{ display: "contents", "& > *": { py: 0.8, px: 0.75, borderBottom: `1px solid ${HAIRLINE}`, fontVariantNumeric: "tabular-nums", bgcolor: r.strong ? "#f4f7fc" : "transparent" } }}>
            {r.cells.map((c, i) => <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: i ? "flex-end" : "flex-start", fontSize: "0.86rem", color: INK, fontWeight: r.strong ? 800 : i ? 500 : 600, textAlign: i ? "right" : "left" }}>{c}</Box>)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Search visibility by country (R09): every country written out, the focus markets marked, the change on the same months a year earlier. */
function SearchCountries({ live }: { live: LiveKpis }) {
  const b = live.breakdowns;
  const same = b.searchSame ?? [];
  const cmp = months(same);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<TravelExploreIcon />} tint="blue" title="Search visibility by country" note={`Google Search Console, ${live.year} so far${cmp ? ` · the change on ${cmp}, against the same months of ${live.year - 1}` : ""}`} />
      <Table
        head={["Country", "Clicks", "Impressions", "Click rate", cmp ? `Clicks vs ${live.year - 1}` : "Clicks vs last year"]}
        rows={b.searchCountries.map((c) => {
          const ch = change(c.sameClicks, c.pyClicks);
          return {
            key: c.label,
            cells: [
              <Box key="n" component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                {countryName(c.label)}
                {c.focus && <Box component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#2459d1", bgcolor: "#eef3fd", px: 0.7, py: 0.1, borderRadius: "6px" }}>focus market</Box>}
              </Box>,
              n0(c.clicks), n0(c.impressions), pct(c.clicks, c.impressions),
              ch ? <Box key="c" component="span" sx={{ color: ch.color, fontWeight: 700 }}>{ch.text}</Box> : <Box key="c" component="span" sx={{ color: FAINT }}>—</Box>,
            ],
          };
        })}
      />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        The focus markets are always listed; the others are the largest by clicks. Google keeps 16 months of Search Console, so last year is compared on the months it still has; the hub keeps every whole month from now on.
      </Typography>
    </GlassCard>
  );
}

/** Google Ads by network - where the impressions come from (SARCLA 18.10: "is this data about impressions right?"). */
function SeaNetworks({ live }: { live: LiveKpis }) {
  const rows = live.breakdowns.seaNetworks ?? [];
  const upTo = live.breakdowns.seaUpTo ?? live.monthsDone;
  if (!rows.length || !upTo) return null;
  const win = `${MONTHS[0]}–${MONTHS[upTo - 1]}`;
  const t = rows.reduce((s, r) => ({ impr: s.impr + r.impr, pyImpr: s.pyImpr + r.pyImpr, clicks: s.clicks + r.clicks, pyClicks: s.pyClicks + r.pyClicks, cost: s.cost + r.cost, pyCost: s.pyCost + r.pyCost }), { impr: 0, pyImpr: 0, clicks: 0, pyClicks: 0, cost: 0, pyCost: 0 });
  const line = (key: string, name: string, r: typeof t, strong = false) => {
    const ci = change(r.impr, r.pyImpr), cc = change(r.clicks, r.pyClicks);
    // the change under this year's figure, never squeezed beside it
    const withChange = (k: string, v: number, c: ReturnType<typeof change>) => (
      <Box key={k} sx={{ display: "grid", justifyItems: "end" }}>
        <span>{n0(v)}</span>
        {c && <Box component="span" sx={{ color: c.color, fontWeight: 700, fontSize: "0.74rem" }}>{c.text}</Box>}
      </Box>
    );
    return { key, strong, cells: [name, n0(r.pyImpr), withChange("i", r.impr, ci), n0(r.pyClicks), withChange("c", r.clicks, cc), `CHF ${n0(r.pyCost)}`, `CHF ${n0(r.cost)}`] };
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<AdsClickIcon />} tint="amber" title="Google Ads by network" note={`${win} ${live.year} against ${win} ${live.year - 1} - where the impressions and clicks come from`} />
      <Table
        head={["Network", `Impressions ${live.year - 1}`, `Impressions ${live.year}`, `Clicks ${live.year - 1}`, `Clicks ${live.year}`, `Cost ${live.year - 1}`, `Cost ${live.year}`]}
        rows={[...rows.map((r) => line(r.label, NETWORK[r.label] ?? r.label, r)), line("total", "All networks", t, true)]}
      />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        From the Google Ads accounts linked to GA4. Performance Max shows ads across Search, Display, YouTube and Gmail, so it gathers many impressions for few clicks:
        a change in how much of the budget runs through it moves the impressions far more than the clicks or the cost.
      </Typography>
    </GlassCard>
  );
}

/** What each stage shows beyond its KPI cards. */
function Breakdowns({ slug, live, state }: { slug: string; live?: LiveKpis; state?: MkState | null }) {
  if (!live) return null;
  const b = live.breakdowns;
  if (slug === "visit" && (b.channels.length || b.countries.length)) {
    const sessions = b.channels.reduce((s, c) => s + c.sessions, 0);
    return (
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <GlassCard>
          <CardTitle icon={<AltRouteIcon />} tint="blue" title="Traffic origin" note={`GA4 sessions by channel, ${live.year} so far`} />
          <BarList format={(v) => (v == null ? "—" : n0(v))} rows={b.channels.map((c) => ({ label: c.label, value: c.sessions, secondary: `${pct(c.sessions, sessions)} · ${n0(c.newUsers)} new users` }))} />
        </GlassCard>
        <GlassCard>
          <CardTitle icon={<PublicIcon />} tint="blue" title="Visitors by country" note={`GA4 sessions, ${live.year} so far - top 10`} />
          <BarList format={(v) => (v == null ? "—" : n0(v))} rows={b.countries.map((c) => ({ label: c.label, value: c.sessions }))} />
        </GlassCard>
      </Box>
    );
  }
  if (slug === "reach") {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
      <SearchCustomersCard />
      {b.searchCountries.length > 0 && <SearchCountries live={live} />}
      <SeaNetworks live={live} />
      {/* each AI assistant, from the AEO answers (SARCLA 18.10: "on advanced report we keep this") */}
      {state?.aeoAssistants && <ByAssistant w={state.aeoAssistants} />}
      </Box>
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
  // the stage's catalogue KPIs that are measured, plus the journey's extras (SEA cost, the email rates);
  // a live one whose source is not open yet is listed below with what it waits for
  const { ids, missing } = stageKpis(s.id, state?.live?.value);
  const measured = ids.flatMap((id) => {
    const k = KPIS.find((x) => x.id === id && x.stage === s.id);
    if (k) return [{ k, v: views?.[id] }];
    if (!views?.[id]) return [];
    // not the template's audience: KPIS[0] is tagged "Sales leader, Rose"
    const blank = { ...KPIS[0], audience: "", audienceAsk: "" };
    if (id === "X01") return [{ k: { ...blank, id: "X01", name: "SEA cost", question: "What do the ads cost?", definition: "Google Ads + Microsoft Ads spend." }, v: views.X01 }];
    return [{ k: { ...blank, id, name: "", question: "", definition: "" }, v: views[id] }];
  });
  const customers = s.slug === "customers";
  // the customers page is its own: its title with its figures beside it, the filters, the tabs
  if (customers) return <CustomersExplorer />;
  const count = measured.length;
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
      {views && state && (
        <>
          {measured.length > 0 && (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>
              {measured.map(({ k, v }) => v && <KpiCard key={k.id} v={v} kpi={k} icon={<StageGlyph slug={s.slug} />} tint={stageTint(s.slug)} upTo={upToOf(v, state, year)} />)}
            </Box>
          )}
          <Breakdowns slug={s.slug} live={state.live?.value} state={state} />
          {!measured.length && <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>Nothing here is measured yet - below is what each KPI needs.</Typography>}
          <NotConnected list={missing} />
          <LiveNote state={state} />
        </>
      )}
    </Box>
  );
}

// no stage number (SARCLA 17.10: "there are no stages"), and no count once all are measured
export const stageLine = (_id: string, measured: number, missing: number, year: number) =>
  missing ? `${measured} of ${measured + missing} KPIs measured · ${year}` : `${measured} KPIs · ${year}`;
