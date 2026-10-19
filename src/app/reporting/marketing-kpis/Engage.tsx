"use client";
// ENGAGE, laid out as Visit and Reach (SARCLA 19.10: "let's tackle Engage next"): the title with its
// figures top right, the KPIs in tabs - engagement, articles viewed, site search, tools, price checks -
// and the Filters window (the months; the countries and channels for GA4's engagement). Every GA4
// figure counts visitors who accepted statistics cookies; the search bar's log and the live shop
// tracker count everyone.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchIcon from "@mui/icons-material/Search";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

import { CardTitle, FAINT, GlassCard, GREEN, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { KPIS } from "@/lib/marketingKpis/catalogue";
import { countryName } from "@/lib/marketingKpis/countries";
import { CHANNEL_INFO } from "@/lib/marketingKpis/visitCube";
import { engageSeries, engageTable, minSec, siteSearchGa4, toolTotals, type EngageData, type EngageFilters } from "@/lib/marketingKpis/engageCube";
import { KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, nameOf, periodOf, stageKpis, stageTint, upToOf, useSlow, type KpiView, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { FigureCards, PeriodPicker, Table, change, monthsLabel, n0, ratio, withChange } from "./ExplorerKit";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";
import { kpiSummary } from "./tiles/summary";

type Tab = "engagement" | "articles" | "search" | "tools" | "prices";
const TABS: { id: Tab; label: string; kpis: string[] }[] = [
  { id: "engagement", label: "Engagement", kpis: ["E02", "E01", "E03"] },
  { id: "articles", label: "Articles viewed", kpis: ["E04"] },
  { id: "search", label: "Site search", kpis: ["E05", "E05Z"] },
  { id: "tools", label: "Tools", kpis: ["E06"] },
  { id: "prices", label: "Price checks", kpis: ["E07"] },
];
/** the KPIs that have a card on this page */
export const ENGAGE_CARDS = new Set(TABS.flatMap((t) => t.kpis));
const FOCUS2 = ["CH", "DE", "IT", "FR", "AT", "NL", "LI", "PL"];
const names = (xs: string[], f: (x: string) => string) => {
  const n = xs.map(f);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] ?? "";
};
const pts = (a: number | null, b: number | null) => (a == null || b == null ? null : { text: `${a - b >= 0 ? "↑" : "↓"} ${Math.abs((a - b) * 100).toFixed(1)} pts`, color: a - b > 0.0005 ? GREEN : a - b < -0.0005 ? RED : MUTED });

/** The Engage page's read (GA4, the search bar's log, the price checks). */
export const useEngageData = () => useSlow<EngageData>("/api/reporting/marketing-kpis/engage", "engage");

export function EngageExplorer({ state }: { state: MkState | null }) {
  const params = useSearchParams();
  const eng = useEngageData();
  const live = state?.live?.value;
  const year = live?.year ?? new Date().getFullYear();
  const done = live?.monthsDone ?? 0;
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "engagement"));
  const [countries, setCountries] = useState<string[]>(() => params.getAll("country").map((c) => c.toUpperCase()));
  const [channels, setChannels] = useState<string[]>(() => params.getAll("channel"));
  const [chosenWin, setChosenWin] = useState<MonthWindow | null>(() => {
    const f = Number(params.get("from")), t = Number(params.get("to"));
    return f >= 1 && t >= f && t <= 12 ? { start: f - 1, end: t - 1 } : null;
  });
  const win: MonthWindow = chosenWin && chosenWin.end < Math.max(1, done) ? chosenWin : { start: 0, end: Math.max(0, done - 1) };
  const isDefault = win.start === 0 && win.end === Math.max(0, done - 1);
  const [panel, setPanel] = useState(false);
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const filters: EngageFilters = { country: countries, channel: channels };
  const filtered = countries.length > 0 || channels.length > 0;

  // the view lives in the address: a choice can be sent on (and saved as a view)
  useEffect(() => {
    if (!live) return;
    const q = new URLSearchParams();
    if (tab !== "engagement") q.set("tab", tab);
    if (!isDefault) { q.set("from", String(win.start + 1)); q.set("to", String(win.end + 1)); }
    for (const c of countries) q.append("country", c);
    for (const c of channels) q.append("channel", c);
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [tab, win.start, win.end, isDefault, countries, channels, live]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (x: string) => set((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]));
  const toggleCountry = toggle(setCountries), toggleChannel = toggle(setChannels);
  const clearAll = () => { setCountries([]); setChannels([]); setChosenWin(null); };

  // the country and channel choice narrows GA4's engagement, from the month x country x channel cube
  const shownLive = useMemo(() => {
    if (!live || !eng.value || !filtered) return live;
    return { ...live, series: { ...live.series, ...engageSeries(eng.value, live.year, filters) } };
  }, [live, eng.value, countries, channels]); // eslint-disable-line react-hooks/exhaustive-deps
  const views = useMemo(() => (state?.inputs ? buildViews(state.inputs, shownLive, year, win) : null), [state?.inputs, shownLive, year, win.start, win.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => Array.from({ length: Math.max(0, Math.min(win.end, done - 1) - win.start + 1) }, (_, k) => win.start + k), [win.start, win.end, done]);

  const d = eng.value;
  if (!views || !state || !live) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!state?.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading…"}</Typography>
      </Box></GlassCard>
    );
  }

  const { missing } = stageKpis("3", live);
  const who = [countries.length ? names(countries, countryName) : "", channels.length ? names(channels, (x) => x) : ""].filter(Boolean).join(" · ");
  const w = monthsLabel(months.length ? { start: months[0], end: months[months.length - 1] } : win);
  const card = (id: string, chart?: React.ReactNode) => {
    let v: KpiView | undefined = views[id];
    if (!v) return null;
    if (filtered && ["E01", "E02", "E03"].includes(id)) v = { ...v, measure: { ...v.measure, note: `Only ${who} - from GA4's month, country and channel table` } };
    if (filtered && !["E01", "E02", "E03"].includes(id)) v = { ...v, measure: { ...v.measure, note: `${v.measure.note ? `${v.measure.note} · ` : ""}For every country and channel` } };
    // the search bar's log has a start: say it, so a short year does not read as a fall
    if ((id === "E05" || id === "E05Z") && d?.search?.since) v = { ...v, measure: { ...v.measure, note: `${v.measure.note ? `${v.measure.note} · ` : ""}The search bar's log starts on ${Number(d.search.since.slice(8, 10))} ${MONTHS[Number(d.search.since.slice(5, 7)) - 1]} ${d.search.since.slice(0, 4)} - no year before to compare` } };
    const k = KPIS.find((x) => x.id === id) ?? { ...KPIS[0], id, name: "", question: "", definition: "", audience: "", audienceAsk: "" };
    return (
      <KpiCard key={id} v={v} kpi={k} icon={<StageGlyph slug="engage" />} tint={stageTint("engage")} upTo={upToOf(v, state, year)}
        actions={<TileActions where="tab" start="nutshell" tile={{ key: `engage::${id}`, page: "engage", kpiId: id, title: nameOf(id), summary: kpiSummary(v, periodOf(v)), kind: "kpi" }} />}>
        {chart}
      </KpiCard>
    );
  };
  const charts: Record<string, React.ReactNode> = d ? { E07: <PriceDays d={d} /> } : {};
  const kpis = TABS.find((t) => t.id === tab)!.kpis.map((id) => card(id, charts[id])).filter(Boolean);
  const tileFor = (cardId: string, title: string) => (
    <TileActions where="tab" start="tab" tile={{ key: `engage:${tab}:${cardId}`, page: "engage", tab, title, kind: "card", ...(filtered ? { filters: { country: countries, channel: channels } } : {}), ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }) }} />
  );
  const upToDay = (() => { const e = Math.min(win.end, done - 1); return e >= 0 ? `${new Date(Date.UTC(year, e + 1, 0)).getUTCDate()} ${MONTHS[e]} ${year}` : "—"; })();
  const chosenCount = countries.length + channels.length + (isDefault ? 0 : 1);

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Engage
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b> against the same months of {year - 1} · figures up to {upToDay}{eng.computing ? " · reading again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK }} />}
              {countries.map((c) => <Chip key={c} size="small" label={<span><b>Country:</b> {countryName(c)}</span>} onDelete={() => toggleCountry(c)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg, color: INK }} />)}
              {channels.map((c) => <Chip key={c} size="small" label={<span><b>Channel:</b> {c}</span>} onDelete={() => toggleChannel(c)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg, color: INK }} />)}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <FigureCards items={[
            { id: "E02", label: "Engagement rate", icon: <BoltOutlinedIcon />, tint: "green", v: views.E02 },
            { id: "E01", label: "Bounce rate", icon: <LogoutOutlinedIcon />, tint: "pink", v: views.E01 },
            { id: "E03", label: "Engagement time", icon: <TimerOutlinedIcon />, tint: "blue", v: views.E03 },
            { id: "E04", label: "Article views", icon: <Inventory2OutlinedIcon />, tint: "purple", v: views.E04 },
            { id: "E05", label: "Site searches", icon: <SearchIcon />, tint: "amber", v: views.E05 },
          ]} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="engage" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <SavedViews page="engage" />
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="engage-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {kpis.length > 0 && <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(380px, 1fr))" } }}>{kpis}</Box>}

      {!d && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!eng.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.88rem", color: eng.error ? RED : MUTED }}>{eng.error ? `Could not read: ${eng.error}` : `Reading GA4, the search bar's log and the price checks${eng.progress ? ` - ${eng.progress}` : ""}…`}</Typography>
        </Box></GlassCard>
      )}

      {d && tab === "engagement" && (["channel", "country"] as const).map((by) => {
        const rows = engageTable(d, year, months, by, filters);
        const shown = by === "country" ? rows.filter((r) => FOCUS2.includes(r.key) || countries.includes(r.key) || rows.indexOf(r) < 12) : rows;
        const chosen = by === "channel" ? channels : countries;
        return (
          <GlassCard key={by} sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={by === "channel" ? <AltRouteIcon /> : <PublicOutlinedIcon />} tint={by === "channel" ? "blue" : "green"}
              title={by === "channel" ? "Engagement by where the visit came from" : "Engagement by country"}
              note={`GA4, ${w} ${year} against ${w} ${year - 1}${by === "channel" && countries.length ? ` · ${names(countries, countryName)} only` : ""}${by === "country" && channels.length ? ` · ${names(channels, (x) => x)} only` : ""} · click a row to filter by it`}
              right={tileFor(by === "channel" ? "channels" : "countries", by === "channel" ? "Engagement by channel" : "Engagement by country")} />
            <Table firstWidth={by === "channel" ? "minmax(320px, 2.6fr)" : "minmax(200px, 1.6fr)"}
              head={[by === "channel" ? "Channel - what it is" : "Country", "Sessions", "Engagement rate", "Bounce rate", "Engagement time per visitor"]}
              rows={shown.map((r) => {
                const rate = r.sessions ? r.engaged / r.sessions : null, pyRate = r.pySessions ? r.pyEngaged / r.pySessions : null;
                const t = r.users ? r.seconds / r.users : null, pyT = r.pyUsers ? r.pySeconds / r.pyUsers : null;
                return {
                  key: r.key, on: chosen.includes(r.key), onPick: () => (by === "channel" ? toggleChannel(r.key) : toggleCountry(r.key)),
                  cells: [
                    <Box key="c" sx={{ display: "grid", gap: 0.15, minWidth: 0 }}>
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 700 }}>{chosen.includes(r.key) && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}{r.label}</Box>
                      {by === "channel" && <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 400, color: MUTED, whiteSpace: "normal" }}>{CHANNEL_INFO[r.key] ?? "GA4's own channel group"}</Box>}
                    </Box>,
                    withChange(n0(r.sessions), change(r.sessions, r.pySessions)),
                    withChange(ratio(r.engaged, r.sessions), pts(rate, pyRate)),
                    ratio(r.sessions - r.engaged, r.sessions),
                    withChange(minSec(t), t != null && pyT ? change(t, pyT) : null),
                  ],
                };
              })} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
              An engaged session lasts 10 seconds or more, sees two pages or ends in an order (GA4). Engagement time = the time the shop was in front, per visitor; visitors are counted per month and {by}.
            </Typography>
          </GlassCard>
        );
      })}

      {d && tab === "articles" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="The most viewed articles"
            note={`GA4's article views, ${MONTHS[0]}–${MONTHS[Math.max(0, d.monthsDone - 1)]} ${year} · every country and channel`} right={tileFor("top-articles", "The most viewed articles")} />
          <Table firstWidth="minmax(320px, 3fr)" head={["Article", "Product number", "Views", "Share"]} widths={["minmax(120px, 1fr)", "minmax(100px, 0.8fr)", "minmax(80px, 0.6fr)"]}
            rows={d.topItems.slice(0, 25).map((r) => ({ key: `${r.id}-${r.name}`, cells: [r.name, r.id || "—", n0(r.views), ratio(r.views, d.topItems.reduce((a, x) => a + x.views, 0))] }))} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The share is of the 50 most viewed. Every article view in GA4 (view_item) - the Datatracker counts the views of logged-in customers per company.</Typography>
        </GlassCard>
      )}

      {d && tab === "search" && <SearchCards d={d} year={year} months={months} w={w} right={tileFor("search-terms", "What people search for")} />}

      {d && tab === "tools" && (() => {
        const rows = toolTotals(d, year, months);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<BuildOutlinedIcon />} tint="blue" title="Each tool" note={`GA4 events, ${w} ${year} against ${w} ${year - 1}`} right={tileFor("tools", "Each tool")} />
            <Table firstWidth="minmax(320px, 3fr)" head={["Tool - what it counts", "Times", `Times ${year - 1}`, "Visitors"]}
              rows={rows.map((r) => ({
                key: r.event,
                cells: [
                  <Box key="t" sx={{ display: "grid", gap: 0.15 }}><Box component="span" sx={{ fontWeight: 700 }}>{r.label}</Box><Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 400, color: MUTED, whiteSpace: "normal" }}>{r.what}</Box></Box>,
                  withChange(n0(r.count), change(r.count, r.pyCount)), n0(r.pyCount), n0(r.users),
                ],
              }))} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>DirectCut and C2S send no events to GA4 yet - they will join this table once they do.</Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "prices" && d.prices && (
        <GlassCard sx={{ display: "grid", gap: 1 }}>
          <CardTitle icon={<SellOutlinedIcon />} tint="amber" title="Who priced and did not order"
            note={`${n0(d.prices.companies)} companies since ${d.prices.since} · ${Object.entries(d.prices.byTeam).map(([t, n]) => `${t} ${n0(n)}`).join(" · ")}`} right={tileFor("price-teams", "Price checks by team")} />
          <Box><Button component="a" href="/datatracker?tab=price-checks" size="small" variant="outlined" sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Each company and article - Datatracker › Price checks</Button></Box>
        </GlassCard>
      )}

      <NotConnected list={missing} />
      <LiveNote state={state} typed={false} sources="GA4 (engagement, article views, tools, site search), the search bar's own log and the live shop tracker (price checks)" />

      <FilterPanel id="engage-filters" open={panel} onClose={() => setPanel(false)}
        subtitle={chosenCount ? `${chosenCount} chosen - click again to let one go` : "The months; the countries and channels narrow GA4's engagement"}
        onClearAll={chosenCount ? clearAll : undefined}
        chips={chosenCount ? <>
          {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.blue.bg, color: INK }} />}
          {countries.map((c) => <Chip key={c} size="small" label={<span><b>Country:</b> {countryName(c)}</span>} onDelete={() => toggleCountry(c)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.green.bg, color: INK }} />)}
          {channels.map((c) => <Chip key={c} size="small" label={<span><b>Channel:</b> {c}</span>} onDelete={() => toggleChannel(c)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.amber.bg, color: INK }} />)}
        </> : null}>
        <FilterSection id="engage-filter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!shut.period} onFlip={() => setShut((x) => ({ ...x, period: !x.period }))} summary={`${monthsLabel(win)} ${year}`} chosen={!isDefault}>
          <PeriodPicker done={done} win={win} onChange={(x) => setChosenWin(x)} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>Against the same months of {year - 1} · whole months only. The most viewed articles keep the year so far; the price checks start on 30 Sep.</Typography>
        </FilterSection>
        <FilterSection id="engage-filter-country" index={1} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!shut.country} onFlip={() => setShut((x) => ({ ...x, country: !x.country }))}
          summary={!countries.length ? "All" : countries.length === 1 ? countryName(countries[0]) : `${countries.length} chosen`} chosen={countries.length > 0}>
          {d ? <Picker rows={engageTable(d, year, months, "country", { channel: channels }).slice(0, 40).map((r) => ({ key: r.key, label: r.label, n: r.sessions, focus: FOCUS2.includes(r.key) }))} chosen={countries} onPick={toggleCountry} /> : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Reading GA4…</Typography>}
        </FilterSection>
        <FilterSection id="engage-filter-channel" index={2} title="Channel" icon={<AltRouteIcon />} tint="amber" open={!shut.channel} onFlip={() => setShut((x) => ({ ...x, channel: !x.channel }))}
          summary={!channels.length ? "All" : channels.length === 1 ? channels[0] : `${channels.length} chosen`} chosen={channels.length > 0}>
          {d ? <Picker rows={engageTable(d, year, months, "channel", { country: countries }).map((r) => ({ key: r.key, label: r.label, n: r.sessions, hint: CHANNEL_INFO[r.key] }))} chosen={channels} onPick={toggleChannel} /> : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Reading GA4…</Typography>}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}

/** The price checks day by day - with a ticket raised, and without. */
function PriceDays({ d }: { d: EngageData }) {
  if (!d.prices?.byDay.length) return <Typography sx={{ fontSize: "0.8rem", color: d.errors.prices ? RED : MUTED }}>{d.errors.prices ? `The price checks could not be read: ${d.errors.prices}` : "No price check yet."}</Typography>;
  const label = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Each day since {label(d.prices.since)} - a ticket raised, or not yet</Typography>
      <ChartFrame table={{ columns: ["Day", "Price checks", "With a ticket"], rows: d.prices.byDay.map(([day, q, t]) => [label(day), q, t]), numeric: [1, 2] }}>
        <StackedColumns height={200} format={(x) => n0(x)} parts={[{ key: "ticket", label: "A ticket raised" }, { key: "open", label: "No ticket yet" }]}
          data={d.prices.byDay.map(([day, q, t]) => ({ x: label(day), ticket: t, open: q - t }))} />
      </ChartFrame>
    </Box>
  );
}

/** What people search for in the search bar, and what GA4 sees of the site search. */
function SearchCards({ d, year, months, w, right }: { d: EngageData; year: number; months: number[]; w: string; right?: React.ReactNode }) {
  const g = siteSearchGa4(d, year, months);
  const s = d.search;
  return (
    <>
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<SearchIcon />} tint="amber" title="What people search for"
          note={s ? `The search bar's own log, the last ${s.days} days · ${n0(s.total)} searches, ${ratio(s.zero, s.total)} found nothing` : d.errors.search ? `The search bar's log could not be read: ${d.errors.search}` : "The search bar's log is not in"} right={right} />
        {s && (
          <Table firstWidth="minmax(220px, 2fr)" head={["Searched for", "Searches", "Found something"]} widths={["minmax(100px, 1fr)", "minmax(140px, 1fr)"]}
            rows={s.top.slice(0, 30).map((r) => ({
              key: r.query,
              cells: [r.query, n0(r.searches), <Box key="f" component="span" sx={{ color: r.found < r.searches * 0.5 ? RED : INK, fontWeight: r.found < r.searches * 0.5 ? 700 : 500 }}>{ratio(r.found, r.searches)}</Box>],
            }))} />
        )}
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
          In red: searches that mostly found nothing. GA4 (visitors who accepted cookies), {w} {year}: {n0(g.searches)} searches by {n0(g.searchers)} visitors, a result clicked {n0(g.clicks)} times ({ratio(g.clicks, g.searches)}); {year - 1}: {n0(g.pySearches)} searches.
        </Typography>
      </GlassCard>
      {s && s.gaps.length > 0 && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<SearchIcon />} tint="pink" title="Searches that found nothing" note="The search bar's own log, the last 30 days - the words and questions to teach the search bar" />
          <Table firstWidth="minmax(320px, 3fr)" head={["Searched for", "Times", "Language", "Last time"]} widths={["minmax(70px, 0.5fr)", "minmax(110px, 0.8fr)", "minmax(110px, 0.8fr)"]}
            rows={s.gaps.slice(0, 30).map((r) => ({ key: `${r.query}-${r.last}`, cells: [r.query, n0(r.count), r.locales.join(", ") || "—", `${Number(r.last.slice(8, 10))} ${MONTHS[Number(r.last.slice(5, 7)) - 1]}`] }))} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Long questions and pasted text land here too. The search bar's page in the hub (Website › Search bar) adds a word or a brand.</Typography>
        </GlassCard>
      )}
    </>
  );
}

/** A filter list: a check, the name (and what it is), a bar of its sessions, the count. */
function Picker({ rows, chosen, onPick }: { rows: { key: string; label: string; n: number; focus?: boolean; hint?: string }[]; chosen: string[]; onPick: (k: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {rows.map((r) => {
        const on = chosen.includes(r.key);
        return (
          <Box key={r.key} component="button" type="button" onClick={() => onPick(r.key)} aria-pressed={on} title={r.hint}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 80px 70px", alignItems: "center", gap: 1, border: 0, font: "inherit", textAlign: "left", cursor: "pointer", px: 1, py: 0.6, borderRadius: "10px", bgcolor: on ? TINT.blue.bg : "transparent", "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} /> : <span />}
            <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: on ? 700 : 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.label}{r.focus && <Box component="span" sx={{ ml: 0.75, fontSize: "0.64rem", fontWeight: 700, color: "#2459d1" }}>focus</Box>}
            </Typography>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: "#e6ebf2" }}><Box sx={{ height: 6, borderRadius: 99, bgcolor: "#2d6fa8", width: `${(100 * r.n) / max}%` }} /></Box>
            <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n0(r.n)}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
