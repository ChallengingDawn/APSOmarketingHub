"use client";
// ENGAGEMENTS, laid out as Visit and Reach (SARCLA 19.10: "let's tackle Engage next", then "call it
// Engagements"): the title with its figures top right, the KPIs in tabs - engagement (by channel; by
// country as a graph), articles viewed (by profit centre, bought or not), tools (a small graph each, the
// search bar among them), did not buy (where we lost them; the price, the minimum quantity, the shelf) -
// and the Filters window (the months; the countries and channels for GA4's engagement). Every card can be
// brought to In a nutshell as it is here (EngagePromoted). Every GA4 figure counts visitors who accepted
// statistics cookies; the search bar's log, the configurators and the live shop tracker count everyone.

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
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import CallSplitIcon from "@mui/icons-material/CallSplit";

import { CardTitle, FAINT, GlassCard, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { KPIS } from "@/lib/marketingKpis/catalogue";
import { countryName } from "@/lib/marketingKpis/countries";
import { CHANNEL_INFO } from "@/lib/marketingKpis/visitCube";
import { LOST, PROFIT_CENTRES, engageSeries, engageTable, madeToOrderIn, minSec, pcLabel, productTable, searchTool, toolTotals, viewsByPc, type EngageData, type EngageFilters, type EngageRow, type ToolCount } from "@/lib/marketingKpis/engageCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import { KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, nameOf, periodOf, stageKpis, stageTint, upToOf, useMarketingKpis, useSlow, type KpiView, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { FigureCards, Pager, PeriodPicker, Table, change, monthsLabel, n0, ratio, usePaged, withChange } from "./ExplorerKit";
import { TileActions, type TileInfo } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";
import { kpiSummary } from "./tiles/summary";

type Tab = "engagement" | "articles" | "tools" | "prices";
const TABS: { id: Tab; label: string; kpis: string[] }[] = [
  { id: "engagement", label: "Engagement", kpis: ["E02", "E01", "E03"] },
  { id: "articles", label: "Articles viewed", kpis: ["E04"] },
  // the site search is one of the tools now (SARCLA 19.10: "take out completely and merge as a tool")
  { id: "tools", label: "Tools", kpis: ["E06"] },
  // why they did not buy - where we lost them, the price, the minimum quantity, the shelf (SARCLA 19.10)
  { id: "prices", label: "Did not buy", kpis: ["E07"] },
];
/** the KPIs that have a card on this page */
export const ENGAGE_CARDS = new Set(TABS.flatMap((t) => t.kpis));
const FOCUS2 = ["CH", "DE", "IT", "FR", "AT", "NL", "LI", "PL"];
const PAGE = 10;
const names = (xs: string[], f: (x: string) => string) => {
  const n = xs.map(f);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] ?? "";
};
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const pts = (a: number | null, b: number | null) => (a == null || b == null ? null : { text: `${a - b >= 0 ? "↑" : "↓"} ${Math.abs((a - b) * 100).toFixed(1)} pts`, color: a - b > 0.0005 ? GREEN : a - b < -0.0005 ? RED : MUTED });
const head = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", pb: 0.75, borderBottom: `1px solid ${HAIRLINE}` } as const;
const legend = (items: { c: string; color: string }[]) => (
  <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
    {items.map((x) => <Box key={x.c} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: MUTED }}><Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: x.color }} />{x.c}</Box>)}
  </Box>
);
/** A tool's card in the nutshell and on the page: one key per tool (SARCLA 19.10: "each small graph separate, to bring to the nutshell"). */
const toolTile = (t: ToolCount): TileInfo => ({ key: `engage:tools:tool-${t.key}`, page: "engage", tab: "tools", title: t.name, kind: "card" });

/** The Engage page's read (GA4, the search bar's log, the configurators, the live shop tracker). */
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
            Engagements
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

      {/* did not buy opens with where we lost them - the price, the minimum and the shelf come after it */}
      {d && tab === "prices" && d.prices?.lost && <LostCard p={d.prices} actions={tileFor("lost", "Where we lost them")} />}

      {kpis.length > 0 && <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(380px, 1fr))" } }}>{kpis}</Box>}

      {!d && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!eng.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.88rem", color: eng.error ? RED : MUTED }}>{eng.error ? `Could not read: ${eng.error}` : `Reading GA4, the search bar's log, the tools and the shop tracker${eng.progress ? ` - ${eng.progress}` : ""}…`}</Typography>
        </Box></GlassCard>
      )}

      {d && tab === "engagement" && <EngagementCard d={d} year={year} months={months} w={w} by="channel" filters={filters} chosen={channels} onPick={toggleChannel} actions={tileFor("channels", "Engagement by channel")} />}
      {d && tab === "engagement" && <EngagementCard d={d} year={year} months={months} w={w} by="country" filters={filters} chosen={countries} onPick={toggleCountry} actions={tileFor("countries", "Engagement by country")} />}

      {d && tab === "articles" && <ArticleCards d={d} year={year} months={months} w={w} tileFor={tileFor} />}

      {d && tab === "tools" && <ToolGrid d={d} year={year} months={months} where="tab" />}

      {d && tab === "prices" && d.prices && <MoqCard p={d.prices} actions={tileFor("moq", "Did not buy - the minimum quantity")} />}
      {d && tab === "prices" && d.prices && <ShelfCard p={d.prices} actions={tileFor("shelf", "Did not buy - availability")} />}

      <NotConnected list={missing} />
      <LiveNote state={state} typed={false} sources="GA4 (engagement, article views, tools), the search bar's own log, the configurators' own counts and the live shop tracker (did not buy)" />

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
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>Against the same months of {year - 1} · whole months only. The tools count from the day each started; did not buy starts on 30 Sep.</Typography>
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

/**
 * An Engagements card promoted to In a nutshell (SARCLA 19.10: "displayed so we can check on the main page",
 * "each small graph separate to bring to the nutshell") - drawn again from its spec, as on the page: its
 * months (the year so far when none), its countries and channels.
 */
export function EngagePromoted({ spec }: { spec: TileSpec }) {
  const [state] = useMarketingKpis();
  const eng = useEngageData();
  const live = state?.live?.value;
  const d = eng.value;
  const actions = <TileActions where="nutshell" start="tab" tile={{ key: spec.key, page: spec.page, tab: spec.tab, kpiId: spec.kpiId, title: spec.title, filters: spec.filters, from: spec.from, to: spec.to, href: spec.href, kind: spec.kind }} />;
  if (!live || !d) return <GlassCard><Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>{!eng.error && <CircularProgress size={16} />}<Typography sx={{ flex: 1, fontSize: "0.86rem", color: eng.error ? RED : MUTED }}>{eng.error ? `${spec.title} could not be read: ${eng.error}` : `${spec.title}…`}</Typography>{actions}</Box></GlassCard>;
  const year = live.year, done = live.monthsDone ?? 0;
  const f = Number(spec.from), t = Number(spec.to);
  const win: MonthWindow = f >= 1 && t >= f && t <= Math.max(1, done) ? { start: f - 1, end: t - 1 } : { start: 0, end: Math.max(0, done - 1) };
  const months = Array.from({ length: Math.max(0, Math.min(win.end, done - 1) - win.start + 1) }, (_, k) => win.start + k);
  const w = monthsLabel(win);
  const filters: EngageFilters = { country: spec.filters?.country ?? [], channel: spec.filters?.channel ?? [] };
  const card = spec.key.split(":")[2] ?? "";
  const tools = [...d.tools.slice(0, 3), ...(searchTool(d) ? [searchTool(d)!] : []), ...d.tools.slice(3)];
  switch (card) {
    case "channels": return <EngagementCard d={d} year={year} months={months} w={w} by="channel" filters={filters} chosen={[]} actions={actions} />;
    case "countries": return <EngagementCard d={d} year={year} months={months} w={w} by="country" filters={filters} chosen={[]} actions={actions} />;
    case "profit-centres": return <PcCard d={d} year={year} months={months} w={w} pcs={[]} actions={actions} />;
    case "top-articles": return <ProductsCard d={d} year={year} months={months} w={w} pcs={[]} actions={actions} />;
    case "lost": return d.prices?.lost ? <LostCard p={d.prices} actions={actions} /> : null;
    case "moq": return d.prices ? <MoqCard p={d.prices} actions={actions} /> : null;
    case "shelf": return d.prices ? <ShelfCard p={d.prices} actions={actions} /> : null;
    case "tool-graphs": return <ToolGrid d={d} year={year} months={months} where="nutshell" actions={actions} />;
  }
  const tool = card.startsWith("tool-") ? tools.find((x) => x.key === card.slice(5)) : undefined;
  if (tool) {
    return (
      <Box sx={{ position: "relative", minWidth: 0, height: "100%", "& > :first-of-type": { height: "100%" } }}>
        <GlassCard><ToolCard t={tool} d={d} year={year} months={months} plain /></GlassCard>
        <Box sx={{ position: "absolute", top: { xs: 16, md: 22 }, right: 0, zIndex: 1 }}><TileActions where="nutshell" start="tab" edge={0} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, href: spec.href, kind: spec.kind }} /></Box>
      </Box>
    );
  }
  // a card the page no longer has: say so, and leave the way to take it off
  return <GlassCard><Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><Typography sx={{ flex: 1, fontSize: "0.86rem", color: MUTED }}>{spec.title} is no longer on the Engagements page - Actions takes it off here.</Typography>{actions}</Box></GlassCard>;
}

/** The price checks day by day - with a ticket raised, and without. */
function PriceDays({ d }: { d: EngageData }) {
  if (!d.prices?.byDay.length) return <Typography sx={{ fontSize: "0.8rem", color: d.errors.prices ? RED : MUTED }}>{d.errors.prices ? `The price checks could not be read: ${d.errors.prices}` : "No price check yet."}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Did not buy - the price: each day since {dayLabel(d.prices.since)}, the customers who priced 3+ articles and did not order - a ticket raised, or not yet</Typography>
      <ChartFrame table={{ columns: ["Day", "Price checks", "With a ticket"], rows: d.prices.byDay.map(([day, q, t]) => [dayLabel(day), q, t]), numeric: [1, 2] }}>
        <StackedColumns height={200} format={(x) => n0(x)} parts={[{ key: "ticket", label: "A ticket raised" }, { key: "open", label: "No ticket yet" }]}
          data={d.prices.byDay.map(([day, q, t]) => ({ x: dayLabel(day), ticket: t, open: q - t }))} />
      </ChartFrame>
    </Box>
  );
}

/**
 * Engagement by where the visit came from - a table - or by country, as a graph (SARCLA 19.10: "a diagram
 * for engagement by country"): each country's sessions, engaged and bounced, its engagement rate and time.
 * A page at a time; a row picks a filter on the page.
 */
function EngagementCard({ d, year, months, w, by, filters, chosen, onPick, actions }: {
  d: EngageData; year: number; months: number[]; w: string; by: "channel" | "country"; filters: EngageFilters; chosen: string[]; onPick?: (k: string) => void; actions?: React.ReactNode;
}) {
  const rows = engageTable(d, year, months, by, filters);
  const other = by === "channel" ? filters.country ?? [] : filters.channel ?? [];
  const only = other.length ? ` · ${names(other, by === "channel" ? countryName : (x) => x)} only` : "";
  const rate = (r: EngageRow) => (r.sessions ? r.engaged / r.sessions : null), pyRate = (r: EngageRow) => (r.pySessions ? r.pyEngaged / r.pySessions : null);
  const time = (r: EngageRow) => (r.users ? r.seconds / r.users : null), pyTime = (r: EngageRow) => (r.pyUsers ? r.pySeconds / r.pyUsers : null);
  const paged = usePaged(rows, PAGE);
  const max = Math.max(1, ...rows.map((r) => r.sessions));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={by === "channel" ? <AltRouteIcon /> : <PublicOutlinedIcon />} tint={by === "channel" ? "blue" : "green"}
        title={by === "channel" ? "Engagement by where the visit came from" : "Engagement by country"}
        note={`GA4, ${w} ${year} against ${w} ${year - 1}${only}${onPick ? " · click a row to filter by it" : ""}`} right={actions} />
      {by === "channel" ? (
        <Table firstWidth="minmax(320px, 2.6fr)" pageSize={PAGE}
          head={["Channel - what it is", "Sessions", "Engagement rate", "Bounce rate", "Engagement time per visitor"]}
          rows={rows.map((r) => ({
            key: r.key, on: chosen.includes(r.key), onPick: onPick ? () => onPick(r.key) : undefined,
            cells: [
              <Box key="c" sx={{ display: "grid", gap: 0.15, minWidth: 0 }}>
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 700 }}>{chosen.includes(r.key) && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}{r.label}</Box>
                <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 400, color: MUTED, whiteSpace: "normal" }}>{CHANNEL_INFO[r.key] ?? "GA4's own channel group"}</Box>
              </Box>,
              withChange(n0(r.sessions), change(r.sessions, r.pySessions)),
              withChange(ratio(r.engaged, r.sessions), pts(rate(r), pyRate(r))),
              ratio(r.sessions - r.engaged, r.sessions),
              withChange(minSec(time(r)), time(r) != null && pyTime(r) ? change(time(r)!, pyTime(r)!) : null),
            ],
          }))} />
      ) : (
        <>
          {legend([{ c: "Engaged sessions - 10 s or more, a second page or an order", color: SERIES[0] }, { c: "Bounced - left at once", color: DEEMPHASIS }])}
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 760, display: "grid", gridTemplateColumns: "minmax(150px, 1fr) minmax(180px, 2.4fr) 104px 112px 120px", columnGap: 1.25, alignItems: "center" }}>
              {["Country", "", "Sessions", "Engagement rate", "Time per visitor"].map((h, i) => <Typography key={i} sx={{ ...head, textAlign: i >= 2 ? "right" : "left" }}>{h}</Typography>)}
              {paged.shown.map((r) => {
                const on = chosen.includes(r.key), cell = { py: 0.8, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "transparent", minWidth: 0 };
                const t = time(r), pt = pyTime(r);
                return (
                  <Box key={r.key} role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined} aria-pressed={onPick ? on : undefined} onClick={onPick ? () => onPick(r.key) : undefined}
                    onKeyDown={onPick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.key); } } : undefined}
                    sx={{ display: "contents", cursor: onPick ? "pointer" : "default", "&:hover > *": onPick ? { bgcolor: on ? TINT.blue.bg : "#f7f9fc" } : {} }}>
                    <Box sx={{ ...cell, display: "flex", alignItems: "center", gap: 0.5 }}>
                      {on && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{r.label}</Typography>
                      {FOCUS2.includes(r.key) && <Box component="span" sx={{ fontSize: "0.64rem", fontWeight: 700, color: "#2459d1" }}>focus</Box>}
                    </Box>
                    <Box sx={{ ...cell, display: "flex", alignItems: "center", height: "100%" }}>
                      <Box role="img" aria-label={`${r.label}: ${n0(r.engaged)} engaged, ${n0(r.sessions - r.engaged)} bounced`} sx={{ display: "flex", height: 16, width: `${Math.max(1, (100 * r.sessions) / max)}%`, borderRadius: "4px", overflow: "hidden", gap: "2px" }}>
                        <Box title={`Engaged: ${n0(r.engaged)}`} sx={{ flex: `${r.engaged} 0 0`, bgcolor: SERIES[0] }} />
                        <Box title={`Bounced: ${n0(r.sessions - r.engaged)}`} sx={{ flex: `${r.sessions - r.engaged} 0 0`, bgcolor: DEEMPHASIS }} />
                      </Box>
                    </Box>
                    <Box sx={{ ...cell, textAlign: "right" }}>{withChange(n0(r.sessions), change(r.sessions, r.pySessions))}</Box>
                    <Box sx={{ ...cell, textAlign: "right" }}>{withChange(ratio(r.engaged, r.sessions), pts(rate(r), pyRate(r)))}</Box>
                    <Box sx={{ ...cell, textAlign: "right" }}>{withChange(minSec(t), t != null && pt ? change(t, pt) : null)}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Pager p={paged} />
        </>
      )}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        An engaged session lasts 10 seconds or more, sees two pages or ends in an order (GA4). Engagement time = the time the shop was in front, per visitor; visitors are counted per month and {by}.
      </Typography>
    </GlassCard>
  );
}

/** The articles viewed tab: the profit centres, then their products (a profit centre picked narrows them). */
function ArticleCards({ d, year, months, w, tileFor }: { d: EngageData; year: number; months: number[]; w: string; tileFor: (id: string, title: string) => React.ReactNode }) {
  const [pcs, setPcs] = useState<string[]>([]);
  if (d.errors.products) return <GlassCard><Typography sx={{ fontSize: "0.86rem", color: RED }}>The products could not be read: {d.errors.products}</Typography></GlassCard>;
  return (
    <>
      <PcCard d={d} year={year} months={months} w={w} pcs={pcs} onPick={(k) => setPcs((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))} actions={tileFor("profit-centres", "Article views by profit centre")} />
      <ProductsCard d={d} year={year} months={months} w={w} pcs={pcs} onClear={() => setPcs([])} actions={tileFor("top-articles", "The most viewed products")} />
    </>
  );
}

/**
 * Article views by profit centre - and whether they were bought (SARCLA 19.10: "the breakdown by profit
 * center and if it was purchased or not"). Every page GA4's view_item fires on: a category list (its top
 * category is the profit centre), a product page (the 8-digit product - Products & Pricing gives its profit
 * centre), the search results. An ARTICLE bought (10 digits) is tied to its product the same way.
 */
const LIST = "#cfdcec";
function PcCard({ d, year, months, w, pcs, onPick, actions }: { d: EngageData; year: number; months: number[]; w: string; pcs: string[]; onPick?: (k: string) => void; actions?: React.ReactNode }) {
  const rows = viewsByPc(d, year, months);
  const max = Math.max(1, ...rows.map((r) => r.views));
  const made = madeToOrderIn(d, year, months);
  const total = rows.reduce((a, r) => a + r.views, 0), productViews = rows.reduce((a, r) => a + r.productViews, 0);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="Article views by profit centre - bought or not"
        note={`GA4, ${w} ${year} against ${w} ${year - 1} · ${n0(total)} views, ${ratio(productViews, total)} of them on a product page${onPick ? " · click a profit centre to see its products below" : ""}`} right={actions} />
      {legend([{ c: "A category list", color: LIST }, { c: "A product page - the product was bought online in those months", color: SERIES[0] }, { c: "A product page - not bought", color: SERIES[1] }])}
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 960, display: "grid", gridTemplateColumns: "minmax(190px, 1.2fr) minmax(140px, 1.6fr) 88px 66px 128px minmax(160px, 1fr) 112px", columnGap: 1.25, alignItems: "center" }}>
          {["Profit centre", "", "Views", "", "Articles bought online", "Product pages - products, bought", "Product page views on a product bought"].map((h, i) => (
            <Typography key={i} sx={{ ...head, display: "flex", alignItems: "flex-end", justifyContent: i >= 2 ? "flex-end" : "flex-start", height: "100%", textAlign: i >= 2 ? "right" : "left" }}>{h}</Typography>
          ))}
          {rows.map((r) => {
            const pick = !!onPick && r.key !== "search";
            const on = pcs.includes(r.key), c = change(r.views, r.pyViews);
            const share = r.productViews ? r.viewsBought / r.productViews : null, pyShare = r.pyProductViews ? r.pyViewsBought / r.pyProductViews : null;
            const list = r.views - r.productViews, notBought = r.productViews - r.viewsBought;
            const cell = { py: 0.8, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "transparent", minWidth: 0 };
            return (
              <Box key={r.key} role={pick ? "button" : undefined} tabIndex={pick ? 0 : undefined} aria-pressed={pick ? on : undefined} onClick={pick ? () => onPick!(r.key) : undefined}
                onKeyDown={pick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick!(r.key); } } : undefined}
                sx={{ display: "contents", cursor: pick ? "pointer" : "default", "&:hover > *": pick ? { bgcolor: on ? TINT.blue.bg : "#f7f9fc" } : {} }}>
                <Box sx={{ ...cell, display: "flex", alignItems: "center", gap: 0.5 }}>
                  {on && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: PROFIT_CENTRES[r.key] ? INK : MUTED }}>{r.label}</Typography>
                </Box>
                <Box sx={{ ...cell, display: "flex", alignItems: "center", height: "100%" }}>
                  <Box role="img" aria-label={`${r.label}: ${n0(list)} on a category list, ${n0(r.viewsBought)} on a product page bought, ${n0(notBought)} on a product page not bought`}
                    sx={{ display: "flex", height: 16, width: `${Math.max(1, (100 * r.views) / max)}%`, borderRadius: "4px", overflow: "hidden", gap: "2px" }}>
                    {list > 0 && <Box title={`A category list: ${n0(list)} views`} sx={{ flex: `${list} 0 0`, bgcolor: LIST }} />}
                    {r.viewsBought > 0 && <Box title={`A product page, bought: ${n0(r.viewsBought)} views`} sx={{ flex: `${r.viewsBought} 0 0`, bgcolor: SERIES[0] }} />}
                    {notBought > 0 && <Box title={`A product page, not bought: ${n0(notBought)} views`} sx={{ flex: `${notBought} 0 0`, bgcolor: SERIES[1] }} />}
                  </Box>
                </Box>
                <Typography sx={{ ...cell, fontSize: "0.86rem", fontWeight: 600, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n0(r.views)}</Typography>
                <Typography sx={{ ...cell, fontSize: "0.76rem", fontWeight: 700, color: c?.color ?? FAINT, textAlign: "right" }}>{c?.text ?? ""}</Typography>
                <Box sx={{ ...cell, textAlign: "right" }}>{r.bought || r.pyBought ? withChange(n0(r.bought), change(r.bought, r.pyBought)) : "—"}</Box>
                <Typography sx={{ ...cell, fontSize: "0.84rem", color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.products ? <>{n0(r.productViews)} views - {n0(r.products)} products, <b>{n0(r.productsBought)}</b> bought</> : "—"}</Typography>
                <Box sx={{ ...cell, textAlign: "right" }}>{r.productViews ? withChange(ratio(r.viewsBought, r.productViews), pts(share, pyShare)) : "—"}</Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        A view = a page that shows articles (GA4 view_item, visitors who accepted cookies): a category list, a product page or the search results - the rows add up to the Article views. Articles bought online = the profit centre&apos;s articles in an online order (GA4 purchase), each once a month. A product page is bought when one of its articles was in an online order in the same months.
        {made > 0 && <> Made to order is apart: <b style={{ color: INK }}>{n0(made)}</b> articles made to order (8001…, cut pieces and special O-rings) were bought online - they belong to no product page, so a plate or rod mostly sold cut to size shows as not bought.</>}
      </Typography>
    </GlassCard>
  );
}

/** The products viewed most (their product pages): profit centre, views, bought online or not - a page at a time. */
function ProductsCard({ d, year, months, w, pcs, onClear, actions }: { d: EngageData; year: number; months: number[]; w: string; pcs: string[]; onClear?: () => void; actions?: React.ReactNode }) {
  const [sold, setSold] = useState<"all" | "bought" | "not">("all");
  const products = productTable(d, year, months, { pc: pcs.map((k) => (k === "other" ? null : k)), bought: sold === "all" ? undefined : sold === "bought" });
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="The most viewed products"
        note={`GA4, product pages only, ${w} ${year}${pcs.length ? ` · ${pcs.map((x) => (x === "other" ? "not in Products & Pricing" : pcLabel(x))).join(", ")} only` : " · every profit centre"} · ${n0(products.length)} products`} right={actions} />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        {([["all", "All"], ["bought", "Bought online"], ["not", "Not bought"]] as const).map(([k, l]) => (
          <Chip key={k} size="small" label={l} onClick={() => setSold(k)} variant={sold === k ? "filled" : "outlined"}
            sx={{ height: 28, fontSize: "0.78rem", fontWeight: 700, bgcolor: sold === k ? TINT.blue.bg : "#fff", color: INK }} />
        ))}
        {pcs.length > 0 && onClear && <Button size="small" onClick={onClear} sx={{ textTransform: "none", fontWeight: 600 }}>Every profit centre</Button>}
      </Box>
      <Table key={`${sold}-${pcs.join(",")}`} firstWidth="minmax(300px, 3fr)" head={["Product", "Profit centre", "Views", "Bought online"]} widths={["minmax(150px, 1fr)", "minmax(120px, 0.8fr)", "minmax(130px, 0.9fr)"]} pageSize={PAGE}
        rows={products.map((r) => ({
          key: r.id,
          cells: [
            <Box key="p" sx={{ display: "grid", gap: 0.1, minWidth: 0 }}>
              <Box component="span" title={r.name} sx={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.id}</Box>
              <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 400, color: MUTED }}>{r.id}</Box>
            </Box>,
            <Box key="c" component="span" sx={{ color: r.pc ? INK : MUTED, whiteSpace: "normal" }}>{pcLabel(r.pc)}</Box>,
            withChange(n0(r.views), change(r.views, r.pyViews)),
            r.bought ? <Box key="b" component="span">{n0(r.bought)} article{r.bought === 1 ? "" : "s"}</Box>
              : <Box key="b" component="span" sx={{ color: RED, fontWeight: 700 }}>Not bought</Box>,
          ],
        }))} />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Bought online counts each article of the product that was in an online order, once a month. Not bought: viewed, and none of its articles ordered online in those months - the first place to look for a price, a size or a stock that is missing.</Typography>
    </GlassCard>
  );
}

/** A small graph of bars: [label, figure, the part of it that went further] - the part darker. */
function MiniBars({ bars, unit, unit2 }: { bars: { x: string; a: number | null; b?: number | null }[]; unit: string; unit2?: string | null }) {
  const max = Math.max(1, ...bars.map((r) => r.a ?? 0));
  return (
    <Box role="img" aria-label={`${unit} - ${bars.map((r) => `${r.x} ${n0(r.a)}`).join(", ")}`} sx={{ display: "flex", alignItems: "flex-end", gap: bars.length > 31 ? "1px" : "3px", height: 64, borderBottom: `1px solid ${HAIRLINE}` }}>
      {bars.map((r) => (
        <Box key={r.x} title={`${r.x}: ${n0(r.a)} ${unit.toLowerCase()}${unit2 && r.b != null ? `, ${n0(r.b)} ${unit2.toLowerCase()}` : ""}`}
          sx={{ flex: "1 1 0", minWidth: 0, height: `${Math.max(r.a ? 4 : 0, (100 * (r.a ?? 0)) / max)}%`, bgcolor: "#cfdcec", borderRadius: "2px 2px 0 0", display: "flex", alignItems: "flex-end" }}>
          {r.b != null && r.a ? <Box sx={{ width: "100%", height: `${(100 * Math.min(r.b, r.a)) / r.a}%`, bgcolor: SERIES[0], borderRadius: "2px 2px 0 0" }} /> : null}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Each tool's own count, a small graph each - the search bar among them (SARCLA 19.10: "a mini graph per
 * micro service", "site search merged as a tool, only the number") - each one its own card for the nutshell.
 */
function ToolGrid({ d, year, months, where, actions }: { d: EngageData; year: number; months: number[]; where: "tab" | "nutshell"; actions?: React.ReactNode }) {
  const search = searchTool(d);
  const tools = [...d.tools.slice(0, 3), ...(search ? [search] : []), ...d.tools.slice(3)];
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<BuildOutlinedIcon />} tint="blue" title="Each tool - its own count"
        note="What each tool counts itself, every visitor (no cookie needed) - from the day it started counting · each one can go to In a nutshell on its own" right={actions} />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fill, minmax(300px, 1fr))" } }}>
        {tools.map((t) => <ToolCard key={t.key} t={t} d={d} year={year} months={months} actions={where === "tab" ? <TileActions where="tab" start="tab" edge={0} tile={toolTile(t)} /> : undefined} />)}
      </Box>
    </GlassCard>
  );
}

function ToolCard({ t, d, year, months, actions, plain = false }: { t: ToolCount; d: EngageData; year: number; months: number[]; actions?: React.ReactNode; plain?: boolean }) {
  // the O-Ring Expert the shop has today is the old built-in one: GA4's "put in the cart" month by month
  const ga4 = t.key === "oring" ? MONTHS.map((m, i) => ({ x: m, a: d.events[`${year}-${String(i + 1).padStart(2, "0")}`]?.oring_expert_add_to_cart?.[0] ?? null })) : null;
  // every day from the first, the empty ones too, the last 62 at most
  const days: { x: string; a: number; b: number }[] = [];
  if (t.days.length) {
    const by = new Map(t.days.map(([day, a, b]) => [day, [a, b] as const]));
    const end = new Date().toISOString().slice(0, 10);
    for (let x = new Date(`${t.days[0][0]}T00:00:00Z`); x.toISOString().slice(0, 10) <= end; x.setUTCDate(x.getUTCDate() + 1)) {
      const k = x.toISOString().slice(0, 10), v = by.get(k);
      days.push({ x: dayLabel(k), a: v?.[0] ?? 0, b: v?.[1] ?? 0 });
    }
  }
  const shown = days.slice(-62);
  const sum = (k: "a" | "b") => t.days.reduce((s, r) => s + (k === "a" ? r[1] : r[2]), 0);
  const ga4Sum = ga4 ? months.reduce((s, i) => s + (ga4[i]?.a ?? 0), 0) : 0;
  const stacked = t.key === "directcut" || t.key === "directup" || t.key === "search";
  // what GA4 sees of the shop's own DirectUP upload form (SARCLA 19.10: the GA4 table was not understood - its figures go here)
  const form = t.key === "directup" ? toolTotals(d, year, months).filter((x) => x.event.startsWith("directup_")) : [];
  const sample = t.key === "search" ? d.search?.sample : null;
  const status = t.error ? { text: "Could not be read", color: RED, bg: "#fdecec" } : t.onShop || ga4 ? { text: "On the shop", color: GREEN, bg: TINT.green.bg } : { text: "Not on the shop yet", color: MUTED, bg: "rgba(21,34,58,.06)" };
  return (
    <Box sx={{ ...(plain ? {} : { border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, bgcolor: "#fff" }), position: "relative", display: "grid", gap: 0.75, alignContent: "start", minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, pr: actions ? 2.5 : 0 }}>
        <Typography sx={{ flex: 1, fontSize: plain ? "1rem" : "0.92rem", fontWeight: 700, color: INK }}>{t.name}</Typography>
        <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: status.color, bgcolor: status.bg, px: 0.9, py: 0.2, borderRadius: 99, whiteSpace: "nowrap" }}>{status.text}</Box>
      </Box>
      {/* the Actions tab on the card's right edge (as the nutshell pins a card's) - the header stays one line */}
      {actions && <Box sx={{ position: "absolute", top: 10, right: 0, zIndex: 1 }}>{actions}</Box>}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35, minHeight: "2.7em" }}>{t.what}</Typography>
      {ga4 ? (
        <>
          <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{n0(ga4Sum)} <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED }}>rings put in the cart, {monthsLabel({ start: months[0] ?? 0, end: months[months.length - 1] ?? 0 })}</Box></Typography>
          <MiniBars bars={ga4.slice(0, Math.max(1, new Date().getMonth() + 1))} unit="Put in the cart" />
          <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>GA4 (visitors who accepted cookies) - the O-Ring Expert the shop has today. Its new version counts itself: {n0(sum("a"))} opens since {t.since ? dayLabel(t.since) : "—"}, not framed by the shop yet.</Typography>
        </>
      ) : t.error ? (
        <Typography sx={{ fontSize: "0.78rem", color: RED }}>{t.error}</Typography>
      ) : (
        <>
          <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
            {n0(sum("a"))} <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED }}>{t.unit.toLowerCase()}{t.unit2 ? ` · ${n0(sum("b"))} ${t.unit2.toLowerCase()}` : ""}, since {t.since ? dayLabel(t.since) : "—"}</Box>
          </Typography>
          {shown.length > 0 ? <MiniBars bars={shown.map((r) => ({ x: r.x, a: r.a, b: stacked ? r.b : null }))} unit={t.unit} unit2={t.unit2} /> : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Nothing counted yet.</Typography>}
          {legend([{ c: t.unit, color: "#cfdcec" }, ...(stacked && t.unit2 ? [{ c: t.unit2, color: SERIES[0] }] : [])])}
          {sample && sum("a") > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: INK }}>
              <b>{ratio(sum("a") - sum("b"), sum("a"))}</b> found nothing - <b>{ratio(sample.nothing - sample.typing, sample.searches - sample.typing)}</b> leaving out the words still being typed (the bar searches as one types; the last {n0(sample.searches)} searches).
            </Typography>
          )}
          {form.some((x) => x.count) && (
            <Typography sx={{ fontSize: "0.74rem", color: INK }}>
              The shop&apos;s upload form (GA4, cookies accepted), {monthsLabel({ start: months[0] ?? 0, end: months[months.length - 1] ?? 0 })}: {form.map((x, i) => <span key={x.event}>{i ? " · " : ""}<b>{n0(x.count)}</b> {x.event === "directup_form_submit_manualupload" ? "files uploaded" : "requests sent"} {(() => { const c = change(x.count, x.pyCount); return c ? <Box component="span" sx={{ color: c.color, fontWeight: 700 }}>{c.text}</Box> : null; })()}</span>)}
            </Typography>
          )}
          <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{t.source}{shown.length < days.length ? ` · the last ${shown.length} days` : " · each day"}{!t.onShop ? " · only tests and direct links so far" : ""}</Typography>
        </>
      )}
    </Box>
  );
}

/**
 * Where we lost them (SARCLA 19.10: "for did not buy also a diagram to see where we lost them"): every
 * article a logged-in customer looked at since the tracker started - one customer, one article, one day -
 * those that ended in an order, and the others by the first reason that applies (datatracker/rules.lostReason).
 */
const LOST_COLOUR: Record<string, string> = { won: GREEN, shelf: SERIES[1], moq: SERIES[3], cart: "#8e5bd0", price: SERIES[0], looked: DEEMPHASIS };
function LostCard({ p, actions }: { p: NonNullable<EngageData["prices"]>; actions?: React.ReactNode }) {
  const l = p.lost!;
  const all = l.total + l.ordered;
  const parts = [{ key: "won", label: "Ordered", what: "The article was ordered", n: l.ordered, companies: l.orderedCompanies }, ...LOST.map((x) => ({ ...x, n: l.looks[x.key], companies: l.companies[x.key] }))];
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<CallSplitIcon />} tint="pink" title="Where we lost them"
        note={`Logged-in customers since ${dayLabel(p.since)}: ${n0(all)} articles looked at (one customer, one article, one day) - ${n0(l.ordered)} ordered, ${n0(l.total)} not, and why`} right={actions} />
      <Box role="img" aria-label={parts.map((x) => `${x.label} ${n0(x.n)}`).join(", ")} sx={{ display: "flex", height: 26, borderRadius: "8px", overflow: "hidden", gap: "2px" }}>
        {parts.filter((x) => x.n > 0).map((x) => (
          <Box key={x.key} title={`${x.label}: ${n0(x.n)} (${ratio(x.n, all)})`} sx={{ flex: `${x.n} 0 0`, bgcolor: LOST_COLOUR[x.key], color: "#fff", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", px: 0.75, overflow: "hidden", whiteSpace: "nowrap" }}>
            {x.n / all > 0.09 ? `${x.label} ${ratio(x.n, all)}` : ""}
          </Box>
        ))}
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 640, display: "grid", gridTemplateColumns: "minmax(260px, 2.4fr) minmax(120px, 1fr) 90px 70px 100px", columnGap: 1.25, alignItems: "center" }}>
          {["", "", "Articles", "Share", "Companies"].map((h, i) => <Typography key={i} sx={{ ...head, textAlign: i >= 2 ? "right" : "left" }}>{h}</Typography>)}
          {parts.map((x) => {
            const cell = { py: 0.8, borderBottom: `1px solid ${HAIRLINE}`, minWidth: 0 };
            return (
              <Box key={x.key} sx={{ display: "contents" }}>
                <Box sx={{ ...cell, display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", gap: 1, alignItems: "start" }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: LOST_COLOUR[x.key], mt: 0.6 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{x.label}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{x.what}</Typography>
                  </Box>
                </Box>
                <Box sx={{ ...cell, display: "flex", alignItems: "center", height: "100%" }}>
                  <Box sx={{ height: 10, borderRadius: 99, bgcolor: LOST_COLOUR[x.key], width: `${Math.max(1, (100 * x.n) / Math.max(1, ...parts.map((y) => y.n)))}%` }} />
                </Box>
                <Typography sx={{ ...cell, fontSize: "0.86rem", fontWeight: 600, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n0(x.n)}</Typography>
                <Typography sx={{ ...cell, fontSize: "0.8rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ratio(x.n, all)}</Typography>
                <Typography sx={{ ...cell, fontSize: "0.84rem", color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n0(x.companies)}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The live shop tracker on each logged-in company (every look, cookies or not); a look not ordered counts once, under the first reason that applies, in this order. A company can be under several reasons. The price checks, the minimum quantities and the shelf come next, each with its days and its looks.</Typography>
    </GlassCard>
  );
}

/** Did not buy - the minimum order quantity: asked for fewer than we sell, each day, then each look. */
function MoqCard({ p, actions }: { p: NonNullable<EngageData["prices"]>; actions?: React.ReactNode }) {
  const m = p.moq;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="Did not buy - the minimum order quantity"
        note={`Logged-in customers who asked for fewer than the article's minimum and did not order it, since ${dayLabel(p.since)} · ${n0(m.total)} times`} right={actions} />
      {m.byDay.length ? (
        <ChartFrame title="Each day - the articles asked below their minimum" table={{ columns: ["Day", "Articles", "Companies"], rows: m.byDay.map(([day, n, c]) => [dayLabel(day), n, c]), numeric: [1, 2] }}>
          <StackedColumns height={170} format={(x) => n0(x)} parts={[{ key: "n", label: "Articles asked below the minimum" }]} data={m.byDay.map(([day, n]) => ({ x: dayLabel(day), n }))} />
        </ChartFrame>
      ) : <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>Nobody asked below a minimum yet.</Typography>}
      {m.rows.length > 0 && (
        <Table firstWidth="minmax(80px, 0.5fr)" head={["Day", "Company", "Article", "Asked", "Minimum"]} widths={["minmax(180px, 1.4fr)", "minmax(240px, 2fr)", "minmax(80px, 0.6fr)", "minmax(90px, 0.6fr)"]} minWidth={760} left={[1, 2]} pageSize={PAGE}
          rows={m.rows.map((r, i) => ({
            key: `${r.companyId}-${r.article}-${r.day}-${i}`,
            cells: [dayLabel(r.day),
              <Box key="c" component="a" href={HS_COMPANY(r.companyId)} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>{r.company}</Box>,
              <Box key="a" sx={{ display: "grid", gap: 0.1, minWidth: 0, width: "100%" }}><Box component="span" sx={{ fontWeight: 600 }}>{r.article}{r.pc ? ` · ${r.pc}` : ""}</Box><Box component="span" title={r.description ?? ""} sx={{ fontSize: "0.74rem", fontWeight: 400, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description ?? "—"}</Box></Box>,
              `${n0(r.qty)}${r.unit ? ` ${r.unit}` : ""}`, <Box key="m" component="span" sx={{ color: RED, fontWeight: 700 }}>{n0(r.minimum)}</Box>],
          }))} />
      )}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Only a look with a quantity counts: the shop asks the ERP for the price of the quantity typed - below the minimum the article cannot be ordered. The latest first; Datatracker › MOQ has every look.</Typography>
    </GlassCard>
  );
}

/** Did not buy - availability: nothing on the shelf, or not as much as they asked for, each day, then each look. */
function ShelfCard({ p, actions }: { p: NonNullable<EngageData["prices"]>; actions?: React.ReactNode }) {
  const s = p.shelf;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="pink" title="Did not buy - availability"
        note={`Logged-in customers who looked at an article we did not have (or not enough of) and did not order it, since ${dayLabel(p.since)} · ${n0(s.total)} times`} right={actions} />
      {s.byDay.length ? (
        <ChartFrame title="Each day - nothing on the shelf, or not enough" table={{ columns: ["Day", "Nothing on the shelf", "Not enough"], rows: s.byDay.map(([day, a, b]) => [dayLabel(day), a, b]), numeric: [1, 2] }}>
          <StackedColumns height={170} format={(x) => n0(x)} parts={[{ key: "none", label: "Nothing on the shelf" }, { key: "short", label: "Not as much as they asked for" }]} data={s.byDay.map(([day, a, b]) => ({ x: dayLabel(day), none: a, short: b }))} />
        </ChartFrame>
      ) : <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No look at an empty shelf yet.</Typography>}
      {s.rows.length > 0 && (
        <Table firstWidth="minmax(80px, 0.5fr)" head={["Day", "Company", "Article", "Asked", "In stock", "Short by"]} widths={["minmax(180px, 1.4fr)", "minmax(240px, 2fr)", "minmax(80px, 0.6fr)", "minmax(80px, 0.6fr)", "minmax(80px, 0.6fr)"]} minWidth={840} left={[1, 2]} pageSize={PAGE}
          rows={s.rows.map((r, i) => ({
            key: `${r.companyId}-${r.article}-${r.day}-${i}`,
            cells: [dayLabel(r.day),
              <Box key="c" component="a" href={HS_COMPANY(r.companyId)} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>{r.company}</Box>,
              <Box key="a" sx={{ display: "grid", gap: 0.1, minWidth: 0, width: "100%" }}><Box component="span" sx={{ fontWeight: 600 }}>{r.article}{r.pc ? ` · ${r.pc}` : ""}</Box><Box component="span" title={r.description ?? ""} sx={{ fontSize: "0.74rem", fontWeight: 400, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description ?? "—"}</Box></Box>,
              r.qty == null ? "—" : `${n0(r.qty)}${r.unit ? ` ${r.unit}` : ""}`, <Box key="s" component="span" sx={{ color: r.stock === 0 ? RED : INK, fontWeight: r.stock === 0 ? 700 : 500 }}>{n0(r.stock)}</Box>, r.short == null ? "—" : n0(r.short)],
          }))} />
      )}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The shelf as Products &amp; Pricing has it today. An article with no stock figure is left out - unknown is not empty. The latest first; Datatracker › Availability has every look.</Typography>
    </GlassCard>
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
