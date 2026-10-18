"use client";
// VISIT & TRAFFIC ORIGIN, laid out as Who are our customers and Reach (SARCLA 18.10: "let's tackle
// it by building what's missing ... put also the page like the others"): the title with its figures
// top right, the KPIs split into tabs - visitors, traffic origin, countries, stores, landing pages,
// known customers - and the Filters window: the months, the countries, the channels. Every figure
// is GA4's (visitors who accepted statistics cookies) except the logged-in companies (Datatracker).
// The choice lives in the address; each card carries 9f's tile tools.

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
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import FiberNewOutlinedIcon from "@mui/icons-material/FiberNewOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";

import { CardTitle, FAINT, GlassCard, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { KPIS } from "@/lib/marketingKpis/catalogue";
import { countryName } from "@/lib/marketingKpis/countries";
import { CHANNEL_INFO, cubeTable, landingTable, storeName, storeTable, visitSeries, type VisitData, type VisitFilters } from "@/lib/marketingKpis/visitCube";
import { KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, nameOf, periodOf, stageKpis, stageTint, upToOf, useSlow, type KpiView, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { FigureCards, PeriodPicker, Table, change, monthsLabel, n0, ratio, withChange } from "./ExplorerKit";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";
import { kpiSummary } from "./tiles/summary";

type Tab = "visitors" | "origin" | "countries" | "stores" | "landing" | "customers";
const TABS: { id: Tab; label: string; kpis: string[] }[] = [
  { id: "visitors", label: "Visitors", kpis: ["V01", "V02"] },
  { id: "origin", label: "Traffic origin", kpis: ["V03"] },
  { id: "countries", label: "Countries", kpis: ["V04"] },
  { id: "stores", label: "Shop stores", kpis: ["V05"] },
  { id: "landing", label: "Landing pages", kpis: ["V08"] },
  { id: "customers", label: "Known customers", kpis: ["V06", "V07"] },
];
/** the focus markets in GA4's two-letter codes */
const FOCUS2 = ["CH", "DE", "IT", "FR", "AT", "NL", "LI", "PL"];
const names = (xs: string[], f: (x: string) => string) => {
  const n = xs.map(f);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] ?? "";
};

export function VisitExplorer({ state }: { state: MkState | null }) {
  const params = useSearchParams();
  const vis = useSlow<VisitData>("/api/reporting/marketing-kpis/visit", "visit");
  const live = state?.live?.value;
  const year = live?.year ?? new Date().getFullYear();
  const done = live?.monthsDone ?? 0;
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "visitors"));
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
  const filters: VisitFilters = { country: countries, channel: channels };
  const filtered = countries.length > 0 || channels.length > 0;

  // the view lives in the address: a choice can be sent on (and saved as a view)
  useEffect(() => {
    if (!live) return;
    const q = new URLSearchParams();
    if (tab !== "visitors") q.set("tab", tab);
    if (!isDefault) { q.set("from", String(win.start + 1)); q.set("to", String(win.end + 1)); }
    for (const c of countries) q.append("country", c);
    for (const c of channels) q.append("channel", c);
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [tab, win.start, win.end, isDefault, countries, channels, live]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (x: string) => set((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]));
  const toggleCountry = toggle(setCountries), toggleChannel = toggle(setChannels);
  const clearAll = () => { setCountries([]); setChannels([]); setChosenWin(null); };

  // the country and channel choice narrows the GA4 figures, from the month x country x channel cube
  const shownLive = useMemo(() => {
    if (!live || !vis.value || !filtered) return live;
    return { ...live, series: { ...live.series, ...visitSeries(vis.value, live.year, filters) } };
  }, [live, vis.value, countries, channels]); // eslint-disable-line react-hooks/exhaustive-deps
  const views = useMemo(() => (state?.inputs ? buildViews(state.inputs, shownLive, year, win) : null), [state?.inputs, shownLive, year, win.start, win.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => Array.from({ length: Math.max(0, Math.min(win.end, done - 1) - win.start + 1) }, (_, k) => win.start + k), [win.start, win.end, done]);

  if (!views || !state || !live) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!state?.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading…"}</Typography>
      </Box></GlassCard>
    );
  }

  const { missing } = stageKpis("2", live);
  const who = [countries.length ? names(countries, countryName) : "", channels.length ? names(channels, (x) => x) : ""].filter(Boolean).join(" · ");
  const card = (id: string) => {
    let v: KpiView | undefined = views[id];
    if (!v) return null;
    // say on the card what the country and channel choice does to it
    if (filtered && ["V01", "V02", "V03", "V04"].includes(id)) v = { ...v, measure: { ...v.measure, note: `Only ${who} - from GA4's month, country and channel table` } };
    if (filtered && ["V05", "V06", "V07", "V08"].includes(id)) v = { ...v, measure: { ...v.measure, note: `${v.measure.note ? `${v.measure.note} · ` : ""}For every country and channel - the filter applies to the tables` } };
    const k = KPIS.find((x) => x.id === id) ?? { ...KPIS[0], id, name: "", question: "", definition: "", audience: "", audienceAsk: "" };
    return (
      <KpiCard key={id} v={v} kpi={k} icon={<StageGlyph slug="visit" />} tint={stageTint("visit")} upTo={upToOf(v, state, year)}
        actions={<TileActions where="tab" start="nutshell" tile={{ key: `visit::${id}`, page: "visit", kpiId: id, title: nameOf(id), summary: kpiSummary(v, periodOf(v)), kind: "kpi" }} />} />
    );
  };
  const kpis = TABS.find((t) => t.id === tab)!.kpis.map(card).filter(Boolean);
  const tileFor = (cardId: string, title: string) => (
    <TileActions where="tab" start="tab" tile={{ key: `visit:${tab}:${cardId}`, page: "visit", tab, title, kind: "card", ...(filtered ? { filters: { country: countries, channel: channels } } : {}), ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }) }} />
  );
  const w = monthsLabel(months.length ? { start: months[0], end: months[months.length - 1] } : win);
  const upToDay = (() => { const e = Math.min(win.end, done - 1); return e >= 0 ? `${new Date(Date.UTC(year, e + 1, 0)).getUTCDate()} ${MONTHS[e]} ${year}` : "—"; })();
  const chosenCount = countries.length + channels.length + (isDefault ? 0 : 1);
  const d = vis.value;

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {/* the title and what is shown on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Visit &amp; traffic origin
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b> against the same months of {year - 1} · figures up to {upToDay}{vis.computing ? " · reading GA4 again" : ""}
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
            { id: "V01", label: "Users", icon: <PeopleAltOutlinedIcon />, tint: "blue", v: views.V01 },
            { id: "V03", label: "Sessions", icon: <TouchAppOutlinedIcon />, tint: "purple", v: views.V03 },
            { id: "V02", label: "New users' share", icon: <FiberNewOutlinedIcon />, tint: "green", v: views.V02 },
            { id: "V04", label: "Users outside Switzerland", icon: <PublicOutlinedIcon />, tint: "amber", v: views.V04 },
            { id: "V06", label: "Companies logged in", icon: <LoginOutlinedIcon />, tint: "pink", v: views.V06 },
          ]} />
        </Box>
      </Box>

      {/* the tabs, saved views and the Filters button - as on Who are our customers */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="visit" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <SavedViews page="visit" />
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="visit-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {kpis.length > 0 && <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>{kpis}</Box>}

      {!d && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!vis.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.88rem", color: vis.error ? RED : MUTED }}>{vis.error ? `GA4 could not be read: ${vis.error}` : `Reading GA4${vis.progress ? ` - ${vis.progress}` : ""}…`}</Typography>
        </Box></GlassCard>
      )}

      {d && tab === "origin" && (() => {
        const rows = cubeTable(d, year, months, "channel", filters);
        const total = rows.reduce((a, r) => a + r.sessions, 0);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<AltRouteIcon />} tint="blue" title="Traffic origin - where the visits come from"
              note={`GA4 channels, ${w} ${year} against ${w} ${year - 1}${countries.length ? ` · ${names(countries, countryName)} only` : ""} · click a channel to filter by it`} right={tileFor("channels", "Traffic origin by channel")} />
            <Table firstWidth="minmax(380px, 3fr)"
              head={["Channel - what it is", "Sessions", "Share", `Sessions ${year - 1}`, "Users", "New users"]}
              rows={rows.map((r) => ({
                key: r.key, on: channels.includes(r.key), onPick: () => toggleChannel(r.key),
                cells: [
                  <Box key="c" sx={{ display: "grid", gap: 0.15, minWidth: 0 }}>
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 700 }}>{channels.includes(r.key) && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}{r.label}</Box>
                    <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 400, color: MUTED, whiteSpace: "normal" }}>{CHANNEL_INFO[r.key] ?? "GA4's own channel group"}</Box>
                  </Box>,
                  withChange(n0(r.sessions), change(r.sessions, r.pySessions)), ratio(r.sessions, total), n0(r.pySessions), n0(r.users), n0(r.newUsers),
                ],
              }))} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
              GA4&apos;s default channel groups, the channel of each visit (session). Users are counted per month and channel, so a visitor who came through two channels counts in both.
              GA4 only sees visitors who accepted statistics cookies: every figure is a floor, the same for both years.
            </Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "countries" && (() => {
        const rows = cubeTable(d, year, months, "country", filters);
        const pick = new Set(countries);
        const shown = rows.filter((r) => FOCUS2.includes(r.key) || pick.has(r.key) || rows.indexOf(r) < 15);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<PublicOutlinedIcon />} tint="green" title="Visitors by country"
              note={`GA4, ${w} ${year} against ${w} ${year - 1}${channels.length ? ` · ${names(channels, (x) => x)} only` : ""} · click a country to filter by it`} right={tileFor("countries", "Visitors by country")} />
            <Table head={["Country", "Users", "Sessions", `Sessions ${year - 1}`, "New users"]}
              rows={shown.map((r) => ({
                key: r.key, on: pick.has(r.key), onPick: () => toggleCountry(r.key),
                cells: [
                  <Box key="n" component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    {pick.has(r.key) && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}{r.label}
                    {FOCUS2.includes(r.key) && <Box component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#2459d1", bgcolor: "#eef3fd", px: 0.7, py: 0.1, borderRadius: "6px" }}>focus market</Box>}
                  </Box>,
                  n0(r.users), withChange(n0(r.sessions), change(r.sessions, r.pySessions)), n0(r.pySessions), n0(r.newUsers),
                ],
              }))} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>The focus markets are always listed; the others are the largest by sessions. Users are counted per month and country.</Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "stores" && (() => {
        const rows = storeTable(d, filters);
        const total = rows.reduce((a, r) => a + r.sessions, 0);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<StorefrontOutlinedIcon />} tint="purple" title="Visitors by shop store"
              note={`The store a visit landed on, ${MONTHS[0]}–${MONTHS[Math.max(0, d.landing.months - 1)]} ${year} against the same months of ${year - 1}${channels.length ? ` · ${names(channels, (x) => x)} only` : ""}`} right={tileFor("stores", "Visitors by shop store")} />
            <Table head={["Store", "Sessions", "Share", `Sessions ${year - 1}`, "Users"]}
              rows={rows.map((r) => ({ key: r.code, cells: [<Box key="s" component="span">{r.label}{storeName(r.code) && <Box component="span" sx={{ ml: 0.75, fontSize: "0.72rem", color: FAINT }}>/{r.code}</Box>}</Box>, withChange(n0(r.sessions), change(r.sessions, r.pySessions)), ratio(r.sessions, total), n0(r.pySessions), n0(r.users)] }))} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
              The store is the first part of the landing page&apos;s address (/de-CH, /it-IT, /en-INT …). &quot;No landing page recorded&quot; are visits GA4 saw without a first page view. The year so far in whole months - the period filter does not apply here.
            </Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "landing" && (() => {
        const rows = landingTable(d, filters, 25);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<WebOutlinedIcon />} tint="blue" title="The pages visits start on"
              note={`The 25 most visited landing pages, ${MONTHS[0]}–${MONTHS[Math.max(0, d.landing.months - 1)]} ${year}${channels.length ? ` · ${names(channels, (x) => x)} only` : " · every channel"}`} right={tileFor("landing", "Top landing pages")} />
            <Table firstWidth="minmax(320px, 3fr)" head={["Landing page", "Sessions", "Users", "Main channel"]} widths={["minmax(110px, 1fr)", "minmax(110px, 1fr)", "minmax(170px, 1.3fr)"]}
              rows={rows.map((r) => {
                const main = Object.entries(r.channels).sort((a, b) => b[1] - a[1])[0];
                return {
                  key: r.page,
                  cells: [
                    <Box key="p" sx={{ minWidth: 0, display: "grid" }}>
                      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.page}>{r.page === "(not set)" ? "No landing page recorded" : r.page}</Box>
                      {r.store && <Box component="span" sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 400 }}>{storeName(r.store)}</Box>}
                    </Box>,
                    n0(r.sessions), n0(r.users), main ? `${main[0]} (${ratio(main[1], r.sessions)})` : "—",
                  ],
                };
              })} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Choose channels in the Filters window to see the pages each channel brings people to. The year so far in whole months.</Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "customers" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<LoginOutlinedIcon />} tint="pink" title="Known customers in the shop, by sales priority"
            note={`Companies that logged in to the shop (Datatracker) - this year so far and the whole of ${year - 1}`} right={tileFor("prio", "Logged-in companies by priority")} />
          <Table head={["Sales priority", "Companies", "Logged in this year", "Share of the band", `Logged in ${year - 1}`]}
            rows={d.prio.map((p) => ({ key: p.band, cells: [p.band, n0(p.all), n0(p.cy), ratio(p.cy, p.all), n0(p.py)] }))} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>From the companies&apos; Datatracker login counts in HubSpot; read with the GA4 figures, every 6 hours. Countries and channels do not apply here.</Typography>
        </GlassCard>
      )}

      <NotConnected list={missing} />
      <LiveNote state={state} typed={false} sources="GA4 (users, sessions, channels, countries, landing pages) and HubSpot (Datatracker logins)" />

      <FilterPanel id="visit-filters" open={panel} onClose={() => setPanel(false)}
        subtitle={chosenCount ? `${chosenCount} chosen - click again to let one go` : "The months, the countries and the channels"}
        onClearAll={chosenCount ? clearAll : undefined}
        chips={chosenCount ? <>
          {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.blue.bg, color: INK }} />}
          {countries.map((c) => <Chip key={c} size="small" label={<span><b>Country:</b> {countryName(c)}</span>} onDelete={() => toggleCountry(c)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.green.bg, color: INK }} />)}
          {channels.map((c) => <Chip key={c} size="small" label={<span><b>Channel:</b> {c}</span>} onDelete={() => toggleChannel(c)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.amber.bg, color: INK }} />)}
        </> : null}>
        <FilterSection id="visit-filter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!shut.period} onFlip={() => setShut((x) => ({ ...x, period: !x.period }))} summary={`${monthsLabel(win)} ${year}`} chosen={!isDefault}>
          <PeriodPicker done={done} win={win} onChange={(x) => setChosenWin(x)} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>Against the same months of {year - 1} · whole months only. Stores, landing pages and known customers keep the year so far.</Typography>
        </FilterSection>
        <FilterSection id="visit-filter-country" index={1} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!shut.country} onFlip={() => setShut((x) => ({ ...x, country: !x.country }))}
          summary={!countries.length ? "All" : countries.length === 1 ? countryName(countries[0]) : `${countries.length} chosen`} chosen={countries.length > 0}>
          {d ? <Picker rows={cubeTable(d, year, months, "country", { channel: channels }).slice(0, 40).map((r) => ({ key: r.key, label: r.label, n: r.sessions, focus: FOCUS2.includes(r.key) }))} chosen={countries} onPick={toggleCountry} /> : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Reading GA4…</Typography>}
        </FilterSection>
        <FilterSection id="visit-filter-channel" index={2} title="Channel" icon={<AltRouteIcon />} tint="amber" open={!shut.channel} onFlip={() => setShut((x) => ({ ...x, channel: !x.channel }))}
          summary={!channels.length ? "All" : channels.length === 1 ? channels[0] : `${channels.length} chosen`} chosen={channels.length > 0}>
          {d ? <Picker rows={cubeTable(d, year, months, "channel", { country: countries }).map((r) => ({ key: r.key, label: r.label, n: r.sessions, hint: CHANNEL_INFO[r.key] }))} chosen={channels} onPick={toggleChannel} /> : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Reading GA4…</Typography>}
        </FilterSection>
      </FilterPanel>
    </Box>
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
