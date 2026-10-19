"use client";
// ENGAGEMENTS, laid out as Visit and Reach (SARCLA 19.10: "let's tackle Engage next", then "call it
// Engagements"): the title with its figures top right, the KPIs in tabs - engagement, articles viewed (by
// profit centre, bought or not), site search (found or not, and what found nothing), tools (a small graph
// per configurator), did not buy (the price, the minimum quantity, the shelf) - and the Filters window
// (the months; the countries and channels for GA4's engagement). Every GA4 figure counts visitors who
// accepted statistics cookies; the search bar's log, the configurators and the live shop tracker count everyone.

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

import { CardTitle, FAINT, GlassCard, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { KPIS } from "@/lib/marketingKpis/catalogue";
import { countryName } from "@/lib/marketingKpis/countries";
import { CHANNEL_INFO } from "@/lib/marketingKpis/visitCube";
import { PROFIT_CENTRES, SEARCH_KINDS, engageSeries, engageTable, madeToOrderIn, minSec, pcLabel, productTable, siteSearchGa4, toolTotals, viewsByPc, type EngageData, type EngageFilters, type SearchKind, type ToolCount } from "@/lib/marketingKpis/engageCube";
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
  // why they did not buy - the price, the minimum quantity, the shelf (SARCLA 19.10)
  { id: "prices", label: "Did not buy", kpis: ["E07"] },
];
/** the KPIs that have a card on this page */
export const ENGAGE_CARDS = new Set(TABS.flatMap((t) => t.kpis));
const FOCUS2 = ["CH", "DE", "IT", "FR", "AT", "NL", "LI", "PL"];
const names = (xs: string[], f: (x: string) => string) => {
  const n = xs.map(f);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] ?? "";
};
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
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
  const charts: Record<string, React.ReactNode> = d ? { E05: <FoundOrNot d={d} year={year} />, E05Z: <NothingWhy d={d} />, E07: <PriceDays d={d} /> } : {};
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

      {d && tab === "articles" && <ArticleCards d={d} year={year} months={months} w={w} tileFor={tileFor} />}

      {d && tab === "search" && <SearchCards d={d} year={year} months={months} w={w} right={tileFor("search-terms", "What people search for")} />}

      {d && tab === "tools" && <ToolCards d={d} year={year} months={months} right={tileFor("tool-graphs", "Each configurator")} />}

      {d && tab === "tools" && (() => {
        const rows = toolTotals(d, year, months);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<BuildOutlinedIcon />} tint="blue" title="What GA4 sees of the tools" note={`GA4 events, ${w} ${year} against ${w} ${year - 1}`} right={tileFor("tools", "Each tool")} />
            <Table firstWidth="minmax(320px, 3fr)" head={["Tool - what it counts", "Times", `Times ${year - 1}`, "Visitors"]}
              rows={rows.map((r) => ({
                key: r.event,
                cells: [
                  <Box key="t" sx={{ display: "grid", gap: 0.15 }}><Box component="span" sx={{ fontWeight: 700 }}>{r.label}</Box><Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 400, color: MUTED, whiteSpace: "normal" }}>{r.what}</Box></Box>,
                  withChange(n0(r.count), change(r.count, r.pyCount)), n0(r.pyCount), n0(r.users),
                ],
              }))} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Visitors who accepted cookies only. DirectCut, DirectUP and the new tools send GA4 nothing - their own counts are above.</Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "prices" && d.prices && <MoqCard p={d.prices} right={tileFor("moq", "Did not buy - the minimum quantity")} />}
      {d && tab === "prices" && d.prices && <ShelfCard p={d.prices} right={tileFor("shelf", "Did not buy - availability")} />}

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
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Did not buy - the price: each day since {label(d.prices.since)}, the customers who priced 3+ articles and did not order - a ticket raised, or not yet</Typography>
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

/**
 * Article views by profit centre - and whether the products viewed were bought (SARCLA 19.10: "should
 * have also the breakdown by profit center and it was purchased or not"); then the products themselves.
 * Every page GA4's view_item fires on: a category list (its top category is the profit centre), a product
 * page (the 8-digit product - Products & Pricing gives its profit centre), the search results. An ARTICLE
 * bought (10 digits) is tied to its product the same way.
 */
const LIST = "#cfdcec";
function ArticleCards({ d, year, months, w, tileFor }: { d: EngageData; year: number; months: number[]; w: string; tileFor: (id: string, title: string) => React.ReactNode }) {
  const [pcs, setPcs] = useState<string[]>([]);
  const [sold, setSold] = useState<"all" | "bought" | "not">("all");
  const [more, setMore] = useState(25);
  const rows = viewsByPc(d, year, months);
  const max = Math.max(1, ...rows.map((r) => r.views));
  const products = productTable(d, year, months, { pc: pcs.map((k) => (k === "other" ? null : k)), bought: sold === "all" ? undefined : sold === "bought" });
  const flip = (k: string) => setPcs((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
  const made = madeToOrderIn(d, year, months);
  const total = rows.reduce((a, r) => a + r.views, 0), productViews = rows.reduce((a, r) => a + r.productViews, 0);
  if (d.errors.products) return <GlassCard><Typography sx={{ fontSize: "0.86rem", color: RED }}>The products could not be read: {d.errors.products}</Typography></GlassCard>;
  return (
    <>
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="Article views by profit centre - bought or not"
          note={`GA4, ${w} ${year} against ${w} ${year - 1} · ${n0(total)} views, ${ratio(productViews, total)} of them on a product page · click a profit centre to see its products below`} right={tileFor("profit-centres", "Article views by profit centre")} />
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {[{ c: "A category list", color: LIST }, { c: "A product page - the product was bought online in those months", color: SERIES[0] }, { c: "A product page - not bought", color: SERIES[1] }].map((x) => (
            <Box key={x.c} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: MUTED }}><Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: x.color }} />{x.c}</Box>
          ))}
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 960, display: "grid", gridTemplateColumns: "minmax(190px, 1.2fr) minmax(140px, 1.6fr) 88px 66px 128px minmax(160px, 1fr) 112px", columnGap: 1.25, alignItems: "center" }}>
            {["Profit centre", "", "Views", "", "Articles bought online", "Product pages - products, bought", "Product page views on a product bought"].map((h, i) => (
              <Typography key={i} sx={{ display: "flex", alignItems: "flex-end", justifyContent: i >= 2 ? "flex-end" : "flex-start", height: "100%", fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i >= 2 ? "right" : "left", pb: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>{h}</Typography>
            ))}
            {rows.map((r) => {
              const pick = r.key !== "search";
              const on = pcs.includes(r.key), c = change(r.views, r.pyViews);
              const share = r.productViews ? r.viewsBought / r.productViews : null, pyShare = r.pyProductViews ? r.pyViewsBought / r.pyProductViews : null;
              const list = r.views - r.productViews, notBought = r.productViews - r.viewsBought;
              const cell = { py: 0.8, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "transparent", minWidth: 0 };
              return (
                <Box key={r.key} role={pick ? "button" : undefined} tabIndex={pick ? 0 : undefined} aria-pressed={pick ? on : undefined} onClick={pick ? () => flip(r.key) : undefined}
                  onKeyDown={pick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(r.key); } } : undefined}
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
          A view = a page that shows articles (GA4 view_item, visitors who accepted cookies): a category list, a product page or the search results - the rows add up to the Article views above. Articles bought online = the profit centre&apos;s articles in an online order (GA4 purchase), each once a month, whether their product page was viewed or not. A product page is bought when at least one of its articles was in an online order in the same months. Products &amp; Pricing ties each article to its product and profit centre.
          {made > 0 && <> Made to order is apart: <b style={{ color: INK }}>{n0(made)}</b> articles made to order (8001…, cut pieces and special O-rings) were bought online in those months - they belong to no product page, so a plate or rod mostly sold cut to size shows as not bought.</>}
          {d.unmapped ? ` ${n0(d.unmapped)} other articles bought are not in Products & Pricing.` : ""}
        </Typography>
      </GlassCard>

      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="The most viewed products"
          note={`GA4, product pages only, ${w} ${year}${pcs.length ? ` · ${pcs.map((x) => (x === "other" ? "not in Products & Pricing" : pcLabel(x))).join(", ")} only` : " · every profit centre"} · ${n0(products.length)} products`} right={tileFor("top-articles", "The most viewed products")} />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          {([["all", "All"], ["bought", "Bought online"], ["not", "Not bought"]] as const).map(([k, l]) => (
            <Chip key={k} size="small" label={l} onClick={() => { setSold(k); setMore(25); }} variant={sold === k ? "filled" : "outlined"}
              sx={{ height: 28, fontSize: "0.78rem", fontWeight: 700, bgcolor: sold === k ? TINT.blue.bg : "#fff", color: INK }} />
          ))}
          {pcs.length > 0 && <Button size="small" onClick={() => setPcs([])} sx={{ textTransform: "none", fontWeight: 600 }}>Every profit centre</Button>}
        </Box>
        <Table firstWidth="minmax(300px, 3fr)" head={["Product", "Profit centre", "Views", "Bought online"]} widths={["minmax(150px, 1fr)", "minmax(120px, 0.8fr)", "minmax(130px, 0.9fr)"]}
          rows={products.slice(0, more).map((r) => ({
            key: r.id,
            cells: [
              <Box key="p" sx={{ display: "grid", gap: 0.1, minWidth: 0 }}>
                <Box component="span" title={r.name} sx={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.id}</Box>
                <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 400, color: MUTED }}>{r.id}</Box>
              </Box>,
              <Box key="c" component="span" sx={{ color: r.pc ? INK : MUTED, whiteSpace: "normal" }}>{pcLabel(r.pc)}</Box>,
              withChange(n0(r.views), change(r.views, r.pyViews)),
              r.bought ? <Box key="b" component="span">{n0(r.bought)} article{r.bought === 1 ? "" : "s"} <Box component="span" sx={{ color: MUTED, fontSize: "0.74rem" }}>(month by month)</Box></Box>
                : <Box key="b" component="span" sx={{ color: RED, fontWeight: 700 }}>Not bought</Box>,
            ],
          }))} />
        {products.length > more && <Box><Button size="small" variant="outlined" onClick={() => setMore((x) => x + 25)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>{products.length - more > 25 ? `25 more - ${n0(products.length - more)} left` : `The last ${n0(products.length - more)}`}</Button></Box>}
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Bought online counts each article of the product that was in an online order, once per month. Not bought: viewed, and none of its articles ordered online in those months - the first place to look for a price, a size or a stock that is missing.</Typography>
      </GlassCard>
    </>
  );
}

/** Each month's searches in the search bar - found something, or nothing (SARCLA 19.10: "I don't understand these graphs"). */
function FoundOrNot({ d, year }: { d: EngageData; year: number }) {
  const s = d.search;
  if (!s) return <Typography sx={{ fontSize: "0.8rem", color: d.errors.search ? RED : MUTED }}>{d.errors.search ? `The search bar's log could not be read: ${d.errors.search}` : "The search bar's log is not in."}</Typography>;
  const now = new Date().toISOString().slice(0, 7);
  const rows = Object.keys(s.byMonth).sort().map((m) => {
    const [n, ok] = s.byMonth[m];
    return { m, label: `${MONTHS[Number(m.slice(5, 7)) - 1]}${m.slice(0, 4) === String(year) ? "" : ` ${m.slice(0, 4)}`}`, found: ok, nothing: n - ok, share: n ? (n - ok) / n : null, running: m === now };
  });
  const pct = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <ChartFrame title="Each month's searches - found something, or nothing"
        table={{ columns: ["Month", "Searches", "Found something", "Found nothing", "Found nothing, share"], rows: rows.map((r) => [`${r.label}${r.running ? " (so far)" : ""}`, r.found + r.nothing, r.found, r.nothing, pct(r.share)]), numeric: [1, 2, 3] }}>
        <StackedColumns height={180} format={(x) => n0(x)} parts={[{ key: "found", label: "Found something" }, { key: "nothing", label: "Found nothing" }]}
          data={rows.map((r) => ({ x: r.label, found: r.found, nothing: r.nothing }))} />
      </ChartFrame>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
        Found nothing: {rows.map((r, i) => <span key={r.m}>{i ? " · " : ""}{r.label}{r.running ? " so far" : ""} <b style={{ color: INK }}>{pct(r.share)}</b></span>)}
      </Typography>
    </Box>
  );
}

/**
 * Is a quarter finding nothing too high? (SARCLA 19.10). The last searches one by one: those only half
 * typed, then what the others were - a number we do not know, a code, words, pasted text.
 */
function NothingWhy({ d }: { d: EngageData }) {
  const x = d.search?.sample;
  if (!x) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The search bar&apos;s last searches could not be read.</Typography>;
  const real = x.nothing - x.typing;
  const kinds: SearchKind[] = ["number", "code", "words", "long"];
  const parts: { k: SearchKind | "typing"; label: string; n: number; color: string }[] = [
    ...kinds.map((k, i) => ({ k, label: SEARCH_KINDS[k], n: x.kinds[k], color: SERIES[i] })),
    { k: "typing", label: "Still being typed - the next letters followed", n: x.typing, color: DEEMPHASIS },
  ];
  const when = (iso: string) => `${dayLabel(iso)} ${iso.slice(11, 16)}`;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>What found nothing - the last {n0(x.searches)} searches ({when(x.from)} to {when(x.to)} UTC)</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.5 }}>
        {n0(x.nothing)} found nothing ({ratio(x.nothing, x.searches)}). {n0(x.typing)} of them were still being typed: the bar searches while one types, so &ldquo;haltegri&rdquo; finds nothing a moment before &ldquo;haltegriff&rdquo; does. Leaving those out, <b>{ratio(real, x.searches - x.typing)}</b> really found nothing - mostly numbers we do not know and words the bar has not learned.
      </Typography>
      <Box role="img" aria-label={parts.map((p) => `${p.label} ${n0(p.n)}`).join(", ")} sx={{ display: "flex", height: 20, borderRadius: "6px", overflow: "hidden", gap: "2px" }}>
        {parts.filter((p) => p.n > 0).map((p) => <Box key={p.k} title={`${p.label}: ${n0(p.n)}`} sx={{ flex: `${p.n} 0 0`, bgcolor: p.color }} />)}
      </Box>
      <Box sx={{ display: "grid", gap: 0.6 }}>
        {parts.map((p) => {
          const ex = p.k === "typing" ? [] : x.examples[p.k];
          return (
            <Box key={p.k} sx={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr) 52px", gap: 1, alignItems: "start" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: p.color, mt: 0.6 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{p.label}</Typography>
                {ex.length > 0 && <Typography title={ex.map((e) => e.text).join(" · ")} sx={{ fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.slice(0, 4).map((e) => `“${e.text}”${e.n > 1 ? ` ×${e.n}` : ""}`).join(" · ")}</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n0(p.n)}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
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

/** Each configurator's own count, a small graph each (SARCLA 19.10: "a mini graph per micro service"). */
function ToolCards({ d, year, months, right }: { d: EngageData; year: number; months: number[]; right?: React.ReactNode }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<BuildOutlinedIcon />} tint="blue" title="Each configurator - its own count"
        note="What each tool counts itself, every visitor (no cookie needed) - from the day it started counting" right={right} />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fill, minmax(300px, 1fr))" } }}>
        {d.tools.map((t) => <ToolCard key={t.key} t={t} d={d} year={year} months={months} />)}
      </Box>
    </GlassCard>
  );
}

function ToolCard({ t, d, year, months }: { t: ToolCount; d: EngageData; year: number; months: number[] }) {
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
  const status = t.error ? { text: "Could not be read", color: RED, bg: "#fdecec" } : t.onShop || ga4 ? { text: "On the shop", color: GREEN, bg: TINT.green.bg } : { text: "Not on the shop yet", color: MUTED, bg: "rgba(21,34,58,.06)" };
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, display: "grid", gap: 0.75, alignContent: "start", bgcolor: "#fff", minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ flex: 1, fontSize: "0.92rem", fontWeight: 700, color: INK }}>{t.name}</Typography>
        <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: status.color, bgcolor: status.bg, px: 0.9, py: 0.2, borderRadius: 99, whiteSpace: "nowrap" }}>{status.text}</Box>
      </Box>
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
          {shown.length > 0 ? <MiniBars bars={shown.map((r) => ({ x: r.x, a: r.a, b: t.key === "directcut" || t.key === "directup" ? r.b : null }))} unit={t.unit} unit2={t.unit2} /> : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Nothing counted yet.</Typography>}
          <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap" }}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.7rem", color: MUTED }}><Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: "#cfdcec" }} />{t.unit}</Box>
            {(t.key === "directcut" || t.key === "directup") && t.unit2 && <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.7rem", color: MUTED }}><Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: SERIES[0] }} />{t.unit2}</Box>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{t.source}{shown.length < days.length ? ` · the last ${shown.length} days` : " · each day"}{!t.onShop ? " · only tests and direct links so far" : ""}</Typography>
        </>
      )}
    </Box>
  );
}

/** Did not buy - the minimum order quantity: asked for fewer than we sell, each day, then each look. */
function MoqCard({ p, right }: { p: NonNullable<EngageData["prices"]>; right?: React.ReactNode }) {
  const [more, setMore] = useState(15);
  const m = p.moq;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="purple" title="Did not buy - the minimum order quantity"
        note={`Logged-in customers who asked for fewer than the article's minimum and did not order it, since ${dayLabel(p.since)} · ${n0(m.total)} times`} right={right} />
      {m.byDay.length ? (
        <ChartFrame title="Each day - the articles asked below their minimum" table={{ columns: ["Day", "Articles", "Companies"], rows: m.byDay.map(([day, n, c]) => [dayLabel(day), n, c]), numeric: [1, 2] }}>
          <StackedColumns height={170} format={(x) => n0(x)} parts={[{ key: "n", label: "Articles asked below the minimum" }]} data={m.byDay.map(([day, n]) => ({ x: dayLabel(day), n }))} />
        </ChartFrame>
      ) : <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>Nobody asked below a minimum yet.</Typography>}
      {m.rows.length > 0 && (
        <Table firstWidth="minmax(80px, 0.5fr)" head={["Day", "Company", "Article", "Asked", "Minimum"]} widths={["minmax(180px, 1.4fr)", "minmax(240px, 2fr)", "minmax(80px, 0.6fr)", "minmax(90px, 0.6fr)"]} minWidth={760} left={[1, 2]}
          rows={m.rows.slice(0, more).map((r, i) => ({
            key: `${r.companyId}-${r.article}-${r.day}-${i}`,
            cells: [dayLabel(r.day),
              <Box key="c" component="a" href={HS_COMPANY(r.companyId)} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>{r.company}</Box>,
              <Box key="a" sx={{ display: "grid", gap: 0.1, minWidth: 0, textAlign: "left", width: "100%" }}><Box component="span" sx={{ fontWeight: 600 }}>{r.article}{r.pc ? ` · ${r.pc}` : ""}</Box><Box component="span" title={r.description ?? ""} sx={{ fontSize: "0.74rem", fontWeight: 400, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description ?? "—"}</Box></Box>,
              `${n0(r.qty)}${r.unit ? ` ${r.unit}` : ""}`, <Box key="m" component="span" sx={{ color: RED, fontWeight: 700 }}>{n0(r.minimum)}</Box>],
          }))} />
      )}
      {m.rows.length > more && <Box><Button size="small" variant="outlined" onClick={() => setMore((x) => x + 15)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>{m.rows.length - more > 15 ? `15 more - ${n0(m.rows.length - more)} left` : `The last ${n0(m.rows.length - more)}`}</Button></Box>}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Only a look with a quantity counts: the shop asks the ERP for the price of the quantity typed - below the minimum the article cannot be ordered. The latest first; Datatracker › MOQ has every look.</Typography>
    </GlassCard>
  );
}

/** Did not buy - availability: nothing on the shelf, or not as much as they asked for, each day, then each look. */
function ShelfCard({ p, right }: { p: NonNullable<EngageData["prices"]>; right?: React.ReactNode }) {
  const [more, setMore] = useState(15);
  const s = p.shelf;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<Inventory2OutlinedIcon />} tint="pink" title="Did not buy - availability"
        note={`Logged-in customers who looked at an article we did not have (or not enough of) and did not order it, since ${dayLabel(p.since)} · ${n0(s.total)} times`} right={right} />
      {s.byDay.length ? (
        <ChartFrame title="Each day - nothing on the shelf, or not enough" table={{ columns: ["Day", "Nothing on the shelf", "Not enough"], rows: s.byDay.map(([day, a, b]) => [dayLabel(day), a, b]), numeric: [1, 2] }}>
          <StackedColumns height={170} format={(x) => n0(x)} parts={[{ key: "none", label: "Nothing on the shelf" }, { key: "short", label: "Not as much as they asked for" }]} data={s.byDay.map(([day, a, b]) => ({ x: dayLabel(day), none: a, short: b }))} />
        </ChartFrame>
      ) : <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No look at an empty shelf yet.</Typography>}
      {s.rows.length > 0 && (
        <Table firstWidth="minmax(80px, 0.5fr)" head={["Day", "Company", "Article", "Asked", "In stock", "Short by"]} widths={["minmax(180px, 1.4fr)", "minmax(240px, 2fr)", "minmax(80px, 0.6fr)", "minmax(80px, 0.6fr)", "minmax(80px, 0.6fr)"]} minWidth={840} left={[1, 2]}
          rows={s.rows.slice(0, more).map((r, i) => ({
            key: `${r.companyId}-${r.article}-${r.day}-${i}`,
            cells: [dayLabel(r.day),
              <Box key="c" component="a" href={HS_COMPANY(r.companyId)} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>{r.company}</Box>,
              <Box key="a" sx={{ display: "grid", gap: 0.1, minWidth: 0, textAlign: "left", width: "100%" }}><Box component="span" sx={{ fontWeight: 600 }}>{r.article}{r.pc ? ` · ${r.pc}` : ""}</Box><Box component="span" title={r.description ?? ""} sx={{ fontSize: "0.74rem", fontWeight: 400, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description ?? "—"}</Box></Box>,
              r.qty == null ? "—" : `${n0(r.qty)}${r.unit ? ` ${r.unit}` : ""}`, <Box key="s" component="span" sx={{ color: r.stock === 0 ? RED : INK, fontWeight: r.stock === 0 ? 700 : 500 }}>{n0(r.stock)}</Box>, r.short == null ? "—" : n0(r.short)],
          }))} />
      )}
      {s.rows.length > more && <Box><Button size="small" variant="outlined" onClick={() => setMore((x) => x + 15)} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>{s.rows.length - more > 15 ? `15 more - ${n0(s.rows.length - more)} left` : `The last ${n0(s.rows.length - more)}`}</Button></Box>}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The shelf as Products &amp; Pricing has it today. An article with no stock figure is left out - unknown is not empty. The latest first; Datatracker › Availability has every look.</Typography>
    </GlassCard>
  );
}
