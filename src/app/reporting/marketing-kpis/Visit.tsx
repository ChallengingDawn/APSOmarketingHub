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
import LinkOffIcon from "@mui/icons-material/LinkOff";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { KPIS } from "@/lib/marketingKpis/catalogue";
import { countryName } from "@/lib/marketingKpis/countries";
import { CHANNEL_GROUPS, CHANNEL_INFO, NO_PAGE, NO_PAGE_INFO, cubeTable, groupsByMonth, knownByCountry, landingTable, noPageVisits, storeChannels, storeName, storeTable, usersAbroad, visitSeries, type VisitData, type VisitFilters } from "@/lib/marketingKpis/visitCube";
import { KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, nameOf, periodOf, stageKpis, stageTint, upToOf, useSlow, type KpiView, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { FigureCards, PeriodPicker, Table, change, monthsLabel, n0, ratio, withChange } from "./ExplorerKit";
import { TileActions } from "./tiles/TileActions";
import { VISIT_NAMES } from "./VisitCompact";
import { SavedViews } from "./tiles/SavedViews";
import { kpiSummary } from "./tiles/summary";

type Tab = "visitors" | "origin" | "countries" | "stores" | "landing" | "customers";
const TABS: { id: Tab; label: string; kpis: string[] }[] = [
  { id: "visitors", label: "Visitors", kpis: ["V01", "V02"] },
  { id: "origin", label: "Traffic origin", kpis: ["V03"] },
  { id: "countries", label: "Countries", kpis: ["V04"] },
  { id: "stores", label: "Shop stores", kpis: ["V05"] },
  { id: "landing", label: "Landing pages", kpis: ["V08"] },
  { id: "customers", label: "Known customers", kpis: ["V06S"] },
];
/** the focus markets in GA4's two-letter codes */
const FOCUS2 = ["CH", "DE", "IT", "FR", "AT", "NL", "LI", "PL"];
/** this page's own names for a KPI - its nutshell tile too (VisitCompact.tsx) */
const PAGE_NAMES = VISIT_NAMES;
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
  const card = (id: string, chart?: React.ReactNode) => {
    let v: KpiView | undefined = views[id];
    if (!v) return null;
    // say on the card what the country and channel choice does to it
    if (filtered && ["V01", "V02", "V03", "V04"].includes(id)) v = { ...v, measure: { ...v.measure, note: `Only ${who} - from GA4's ${channels.length ? "month, country and channel table" : "users per month and country"}` } };
    if (id === "V06S" && countries.length) v = { ...v, measure: { ...v.measure, note: `Only ${names(countries, countryName)} - GA4's login event${channels.length ? "; it has no channel, so the channel choice does not apply" : ""}` } };
    if (id === "V06S" && !countries.length && channels.length) v = { ...v, measure: { ...v.measure, note: `${v.measure.note} · GA4's login event has no channel: every channel` } };
    // "Users per country" on this page (SARCLA 18.10: "call it just users per country"); the figure stays the users outside Switzerland
    if (id === "V04") v = { ...v, measure: { ...v.measure, definition: "Visitors - people on the shop, not companies (GA4's users, who accepted statistics cookies). The figure: every country but Switzerland, month by month added up; the chart: each country, Switzerland included" } };
    if (id === "V07" && vis.value?.prio.length) {
      const band = (b: string) => vis.value!.prio.find((p) => p.band === b);
      const say = (b: string) => { const p = band(b); return p ? `${b}: ${n0(p.cy)} of ${n0(p.all)} companies (${ratio(p.cy, p.all)})` : ""; };
      v = { ...v, measure: { ...v.measure, note: `${say("Prio 1")} · ${say("Prio 2")} - logged in to the shop this year (Datatracker)` } };
    }
    if (filtered && ["V05", "V06", "V07", "V08"].includes(id)) v = { ...v, measure: { ...v.measure, note: `${v.measure.note ? `${v.measure.note} · ` : ""}For every country and channel - the filter applies to the tables` } };
    const k = KPIS.find((x) => x.id === id) ?? { ...KPIS[0], id, name: "", question: "", definition: "", audience: "", audienceAsk: "" };
    return (
      <KpiCard key={id} v={v} kpi={k} icon={<StageGlyph slug="visit" />} tint={stageTint("visit")} upTo={upToOf(v, state, year)} title={PAGE_NAMES[id]}
        actions={<TileActions where="tab" start="nutshell" tile={{ key: `visit::${id}`, page: "visit", kpiId: id, title: PAGE_NAMES[id] ?? nameOf(id), summary: kpiSummary(v, periodOf(v)), kind: "kpi" }} />}>
        {chart}
      </KpiCard>
    );
  };
  const d = vis.value;
  const w = monthsLabel(months.length ? { start: months[0], end: months[months.length - 1] } : win);
  // each tab's own chart in its KPI card, once GA4 is read (SARCLA 18.10: by country, the stores' and pages' channels)
  const charts: Record<string, React.ReactNode> = {
    ...(views.V01 && views.V02N ? { V01: <NewReturning users={views.V01} fresh={views.V02N} months={months} year={year} /> } : {}),
    ...(views.V01 && views.V02N ? { V02: <NewReturningBars users={views.V01} fresh={views.V02N} year={year} w={w} /> } : {}),
  };
  if (d) Object.assign(charts, {
    V03: <MixChart title={`Visits each month by where they came from, ${w} ${year}`} order={CHANNEL_GROUPS} otherLabel="Other (links, e-mail, unknown)"
      rows={groupsByMonth(d, year, months, filters).map((g) => ({ key: String(g.month), label: `${MONTHS[g.month]} ${year}`, total: g.total, py: g.pyTotal, channels: g.groups }))} />,
    V04: <AbroadChart d={d} year={year} months={months} filters={filters} chosen={countries} w={w} />,
    V05: <MixChart title={`The stores' visits by the channel that brought them, ${MONTHS[0]}–${MONTHS[Math.max(0, d.landing.months - 1)]} ${year}`}
      rows={storeChannels(d, filters).slice(0, 16).map((r) => ({ key: r.code, label: r.label, sub: `/${r.code}`, total: r.total, py: r.pyTotal, channels: r.channels }))} />,
    V08: <MixChart title={`The top landing pages by the channel that brought them, ${MONTHS[0]}–${MONTHS[Math.max(0, d.landing.months - 1)]} ${year}`}
      rows={landingTable(d, filters, 12).map((r) => ({ key: r.page, label: r.page, sub: r.store ? storeName(r.store) ?? undefined : undefined, total: r.sessions, py: null, channels: r.channels }))} />,
  });
  const kpis = TABS.find((t) => t.id === tab)!.kpis.map((id) => card(id, charts[id])).filter(Boolean);
  const tileFor = (cardId: string, title: string) => (
    <TileActions where="tab" start="tab" tile={{ key: `visit:${tab}:${cardId}`, page: "visit", tab, title, kind: "card", ...(filtered ? { filters: { country: countries, channel: channels } } : {}), ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }) }} />
  );
  const upToDay = (() => { const e = Math.min(win.end, done - 1); return e >= 0 ? `${new Date(Date.UTC(year, e + 1, 0)).getUTCDate()} ${MONTHS[e]} ${year}` : "—"; })();
  const chosenCount = countries.length + channels.length + (isDefault ? 0 : 1);
  const noPage = d ? noPageVisits(d) : null;

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

      {kpis.length > 0 && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>
          {kpis}
          {d && tab === "customers" && (() => {
            const rows = knownByCountry(d, year, months);
            const pick = new Set(countries);
            const shown = rows.filter((r) => FOCUS2.includes(r.code) || pick.has(r.code) || rows.indexOf(r) < 10);
            return (
              <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
                <CardTitle icon={<VerifiedUserOutlinedIcon />} tint="green" title="Visitors who log in, by country"
                  note={`GA4, ${w} ${year} against ${w} ${year - 1} · click a country to filter by it`} right={tileFor("known-countries", "Visitors who log in, by country")} />
                <Table firstWidth="minmax(110px, 1.4fr)" widths={["minmax(70px, 1fr)", "minmax(70px, 1fr)", "minmax(56px, 0.8fr)", "minmax(56px, 0.8fr)"]} minWidth={400}
                  head={["Country", "Visitors", "Logged in", "Share", `${year - 1}`]}
                  rows={shown.map((r) => ({
                    key: r.code, on: pick.has(r.code), onPick: () => toggleCountry(r.code),
                    cells: [
                      <Box key="n" component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>{pick.has(r.code) && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}{r.label}</Box>,
                      n0(r.users), n0(r.known), ratio(r.known, r.users), ratio(r.pyKnown, r.pyUsers),
                    ],
                  }))} />
                <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Visitors per month and country, added up; logged in = GA4&apos;s login event in the month. The focus markets are always listed.</Typography>
              </GlassCard>
            );
          })()}
        </Box>
      )}

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
        const total = rows.filter((r) => storeName(r.code)).reduce((a, r) => a + r.sessions, 0);
        return (
          <GlassCard sx={{ display: "grid", gap: 1.25 }}>
            <CardTitle icon={<StorefrontOutlinedIcon />} tint="purple" title="Visitors by shop store"
              note={`The store a visit landed on, ${MONTHS[0]}–${MONTHS[Math.max(0, d.landing.months - 1)]} ${year} against the same months of ${year - 1}${channels.length ? ` · ${names(channels, (x) => x)} only` : ""}`} right={tileFor("stores", "Visitors by shop store")} />
            <Table head={["Store", "Sessions", "Share", `Sessions ${year - 1}`, "Users"]}
              rows={rows.map((r) => {
                const store = !!storeName(r.code);
                return {
                  key: r.code, strong: false,
                  cells: [
                    <Box key="s" sx={{ display: "grid", gap: 0.15, minWidth: 0 }}>
                      <Box component="span">{r.label}{store && <Box component="span" sx={{ ml: 0.75, fontSize: "0.72rem", color: FAINT }}>/{r.code}</Box>}</Box>
                      {r.code === "(not set)" && <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 400, color: MUTED, whiteSpace: "normal" }}>{NO_PAGE_INFO}</Box>}
                    </Box>,
                    withChange(n0(r.sessions), change(r.sessions, r.pySessions)), store ? ratio(r.sessions, total) : "—", n0(r.pySessions), n0(r.users),
                  ],
                };
              })} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
              The store is the first part of the landing page&apos;s address (/de-CH, /it-IT, /en-INT …); the share is of the visits that landed on a store. The year so far in whole months - the period filter does not apply here.
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
                      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.page}>{r.page}</Box>
                      {r.store && <Box component="span" sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 400 }}>{storeName(r.store)}</Box>}
                    </Box>,
                    n0(r.sessions), n0(r.users), main ? `${main[0]} (${ratio(main[1], r.sessions)})` : "—",
                  ],
                };
              })} />
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
              Choose channels in the Filters window to see the pages each channel brings people to. The year so far in whole months.
              {noPage && noPage.cy > 0 ? ` Not in the list: ${n0(noPage.cy)} visits without a page - ${NO_PAGE_INFO.charAt(0).toLowerCase()}${NO_PAGE_INFO.slice(1)}` : ""}
            </Typography>
          </GlassCard>
        );
      })()}

      {d && tab === "customers" && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>
          {card("V06", views.V06G ? <LoginsByMonth v={views.V06G} year={year} /> : undefined)}
          {card("V07", <PrioLoginsByDay live={d.liveLogins} error={d.errors?.liveLogins} />)}
        </Box>
      )}

      {d && tab === "customers" && <UnlinkedCard u={d.unlinked} error={d.errors?.unlinked} right={<TileActions where="tab" start="nutshell" tile={{ key: "visit:customers:unlinked", page: "visit", tab: "customers", title: "Shop accounts without a company", kind: "card" }} />} />}

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

/**
 * The visitors each month, new and returning, stacked (SARCLA 18.10: "I don't understand these
 * graphs ... we should have a bar for new / returning"); last year's users are in the table.
 */
function NewReturning({ users, fresh, months, year }: { users: KpiView; fresh: KpiView; months: number[]; year: number }) {
  const rows = months.map((i) => {
    const u = users.series.months[i], n = fresh.series.months[i];
    return { i, u, n, back: u != null && n != null ? Math.max(0, u - n) : null, py: users.series.py[i] };
  });
  if (!rows.some((r) => r.u != null)) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Visitors each month - new and returning</Typography>
      <ChartFrame table={{ columns: ["Month", "New users", "Returning users", "Users", `Users ${year - 1}`], rows: rows.map((r) => [`${MONTHS[r.i]} ${year}`, r.n ?? "", r.back ?? "", r.u ?? "", r.py ?? ""]), numeric: [1, 2, 3, 4] }}>
        <StackedColumns height={210} format={(x) => n0(x)} parts={[{ key: "fresh", label: "New users" }, { key: "back", label: "Returning users" }]}
          data={rows.map((r) => ({ x: MONTHS[r.i], fresh: r.n, back: r.back }))} />
      </ChartFrame>
    </Box>
  );
}

/** New against returning visitors as one bar each - this year and the same months a year earlier. */
function NewReturningBars({ users, fresh, year, w }: { users: KpiView; fresh: KpiView; year: number; w: string }) {
  const rows = ([[`${w} ${year}`, fresh.ytd, users.ytd], [`${w} ${year - 1}`, fresh.pyYtd, users.pyYtd]] as const).filter(([, , u]) => u);
  if (!rows.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {rows.map(([label, n, u]) => {
        const sNew = (n ?? 0) / (u ?? 1), sBack = 1 - sNew;
        return (
          <Box key={label} sx={{ display: "grid", gap: 0.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{label}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{n0(u)} users</Typography>
            </Box>
            <Box role="img" aria-label={`${label}: new ${(sNew * 100).toFixed(1)}%, returning ${(sBack * 100).toFixed(1)}%`} sx={{ display: "flex", height: 26, borderRadius: "8px", overflow: "hidden", gap: "2px" }}>
              <Box sx={{ flex: `${sNew} 0 0`, bgcolor: SERIES[0], color: "#fff", fontSize: "0.76rem", fontWeight: 700, display: "flex", alignItems: "center", px: 1, whiteSpace: "nowrap" }}>{sNew > 0.15 ? `New ${(sNew * 100).toFixed(1)}%` : ""}</Box>
              <Box sx={{ flex: `${sBack} 0 0`, bgcolor: SERIES[1], color: "#fff", fontSize: "0.76rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "flex-end", px: 1, whiteSpace: "nowrap" }}>{sBack > 0.15 ? `Returning ${(sBack * 100).toFixed(1)}%` : ""}</Box>
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>{n0(n)} new · {n0((u ?? 0) - (n ?? 0))} returning</Typography>
          </Box>
        );
      })}
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>New = the visitor&apos;s first visit falls in the month (GA4); returning = had come before. Users added up month by month.</Typography>
    </Box>
  );
}

/** The visitors who logged in, month by month, this year against last - GA4's login event. */
function LoginsByMonth({ v, year }: { v: KpiView; year: number }) {
  if (!v.series.months.some((x) => x != null)) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Visitors who logged in, each month</Typography>
      <ChartFrame table={{ columns: ["Month", String(year), String(year - 1)], rows: MONTHS.map((m, i) => [m, v.series.months[i] ?? "", v.series.py[i] ?? ""]), numeric: [1, 2] }}>
        <GroupedColumns height={190} format={(x) => n0(x)} data={MONTHS.map((m, i) => ({ x: m, current: v.series.months[i], prior: v.series.py[i], partial: v.partial === i }))} currentLabel={String(year)} priorLabel={String(year - 1)} />
      </ChartFrame>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>GA4&apos;s login event (visitors who accepted statistics cookies) - the companies above are the Datatracker&apos;s, counted per year.</Typography>
    </Box>
  );
}

/** Prio 1 and 2 companies that logged in, day by day - the live shop tracker (since 30 Sep 2026). */
function PrioLoginsByDay({ live, error }: { live: VisitData["liveLogins"]; error?: string }) {
  if (!live?.days.length) return <Typography sx={{ fontSize: "0.8rem", color: error ? RED : MUTED }}>{error ? `The live shop tracker could not be read: ${error}` : "The live shop tracker has no logins yet."}</Typography>;
  const label = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Prio 1 and 2 companies that logged in, each day since {label(live.days[0][0])}</Typography>
      <ChartFrame table={{ columns: ["Day", "Prio 1 companies", "Their logins", "Prio 2 companies", "Their logins"], rows: live.days.map(([d, a, b, c, e]) => [label(d), a, b, c, e]), numeric: [1, 2, 3, 4] }}>
        <StackedColumns height={190} format={(x) => n0(x)} parts={[{ key: "p1", label: "Prio 1" }, { key: "p2", label: "Prio 2" }]}
          data={live.days.map(([d, a, , c]) => ({ x: label(d), p1: a, p2: c }))} />
      </ChartFrame>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>The live shop tracker on each company (every login, cookie consent or not) - it started on 30 Sep 2026 and grows from here; weekends are quiet.</Typography>
    </Box>
  );
}

/** Users outside Switzerland by country, against a year earlier (SARCLA 18.10: "should be viewed by country"). */
function AbroadChart({ d, year, months, filters, chosen, w }: { d: VisitData; year: number; months: number[]; filters: VisitFilters; chosen: string[]; w: string }) {
  // every country, Switzerland included (SARCLA 18.10: "users per country")
  const rows = usersAbroad(d, year, months, filters, true);
  const shown = (chosen.length ? rows.filter((r) => chosen.includes(r.code)) : rows).slice(0, 9);
  if (!shown.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No visitors in the choice.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Visitors by country, {w} {year} against {w} {year - 1}</Typography>
      <ChartFrame table={{ columns: ["Country", String(year), String(year - 1)], rows: rows.slice(0, 25).map((r) => [r.label, r.users, r.pyUsers]), numeric: [1, 2] }}>
        <GroupedColumns height={240} format={(x) => n0(x)} data={shown.map((r) => ({ x: r.label, current: r.users, prior: r.pyUsers || null }))} currentLabel={String(year)} priorLabel={String(year - 1)} />
      </ChartFrame>
    </Box>
  );
}

type MixRow = { key: string; label: string; sub?: string; total: number; py: number | null; channels: Record<string, number> };
/**
 * Visits per store or page, split by the channel that brought them (SARCLA 18.10: "compare what
 * brings more visitors to it"): the four biggest channels in colour, the rest grey; the bar is the
 * visits - or, switched to shares, every bar is a whole, to compare the mix.
 */
function MixChart({ title, rows, order, otherLabel = "Other channels" }: { title: string; rows: MixRow[]; order?: readonly string[]; otherLabel?: string }) {
  const [shares, setShares] = useState(false);
  const all: Record<string, number> = {};
  for (const r of rows) for (const [c, n] of Object.entries(r.channels)) all[c] = (all[c] ?? 0) + n;
  const top = order ? order.slice(0, SERIES.length) : Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, SERIES.length).map(([c]) => c);
  const parts = (r: MixRow) => {
    const other = Object.entries(r.channels).filter(([c]) => !top.includes(c)).reduce((a, [, n]) => a + n, 0);
    return [...top.map((c, i) => ({ c, n: r.channels[c] ?? 0, color: SERIES[i] })), { c: otherLabel, n: other, color: DEEMPHASIS }].filter((p) => p.n > 0);
  };
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No visits in the choice.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ flex: 1, minWidth: 220, fontSize: "0.86rem", fontWeight: 700, color: INK }}>{title}</Typography>
        <Box sx={{ display: "inline-flex", p: 0.5, gap: 0.5, borderRadius: "12px", bgcolor: "rgba(21,34,58,.05)" }}>
          {([false, true] as const).map((m) => (
            <Box key={String(m)} component="button" type="button" onClick={() => setShares(m)} aria-pressed={shares === m}
              sx={{ border: 0, font: "inherit", cursor: "pointer", px: 1.25, py: 0.6, borderRadius: "9px", fontSize: "0.8rem", fontWeight: 700,
                bgcolor: shares === m ? "#fff" : "transparent", color: shares === m ? INK : MUTED, boxShadow: shares === m ? "0 1px 3px rgba(21,34,58,.12)" : "none" }}>
              {m ? "Channel shares" : "Visits"}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        {[...top.map((c, i) => ({ c, color: SERIES[i] })), { c: otherLabel, color: DEEMPHASIS }].map((x) => (
          <Box key={x.c} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: MUTED }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: x.color }} />{x.c}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 0.6 }}>
        {rows.map((r) => {
          const ps = parts(r);
          const main = ps.filter((p) => p.c !== otherLabel).sort((a, b) => b.n - a.n)[0];
          const c = r.py != null ? change(r.total, r.py) : null;
          return (
            <Box key={r.key} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(180px, 260px) minmax(0, 1fr) 92px 64px minmax(150px, 190px)" }, gap: { xs: 0.4, md: 1.25 }, alignItems: "center", py: 0.4, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography title={r.label} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Typography>
                {r.sub && <Typography sx={{ fontSize: "0.7rem", color: FAINT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</Typography>}
              </Box>
              <Box role="img" aria-label={`${r.label}: ${ps.map((p) => `${p.c} ${n0(p.n)}`).join(", ")}`} sx={{ height: 16, display: "flex", width: shares ? "100%" : `${Math.max(1, (100 * r.total) / max)}%`, borderRadius: "4px", overflow: "hidden", gap: "2px", bgcolor: "#fff" }}>
                {ps.map((p) => <Box key={p.c} title={`${p.c}: ${n0(p.n)} visits (${ratio(p.n, r.total)})`} sx={{ flex: `${p.n} 0 0`, bgcolor: p.color, minWidth: 2 }} />)}
              </Box>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textAlign: { md: "right" }, fontVariantNumeric: "tabular-nums" }}>{n0(r.total)}</Typography>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: c?.color ?? FAINT, textAlign: { md: "right" } }}>{c?.text ?? ""}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{main ? <>Most from <b style={{ color: INK }}>{main.c}</b> ({ratio(main.n, r.total)})</> : "—"}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * The shop accounts with no company in HubSpot: their logins and orders count for no company. The
 * counts here; the list and the Link are in Ticket/order/article associations > Contacts without a
 * company (SARCLA 19.10: "build it inside the existing app, a separate contact tab").
 */
function UnlinkedCard({ u, error, right }: { u: VisitData["unlinked"]; error?: string; right?: React.ReactNode }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<LinkOffIcon />} tint="amber" title="Shop accounts without a company"
        note="People with a shop login whose HubSpot contact has no company: their logins and orders count for no company, so no report sees them as a known customer" right={right} />
      {!u ? (
        <Typography sx={{ fontSize: "0.84rem", color: error ? RED : MUTED }}>{error ? `HubSpot could not be read: ${error}` : "Not read yet."}</Typography>
      ) : (
        <>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
            {[
              { n: u.total, label: "Shop accounts without a company", sub: `${n0(u.createdThisYear)} opened this year · ${n0(u.seenThisYear)} on the site this year` },
              { n: u.matched, label: "A company to link", sub: `${n0(u.withOrders ?? 0)} by their orders, the rest by their e-mail domain` },
              { n: u.business, label: "Business address, no company yet", sub: "Find or create the company" },
              { n: u.free, label: "Free e-mail address", sub: "gmail, bluewin … - check the company they typed" },
            ].map((x) => (
              <Box key={x.label} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", px: 1.5, py: 1.1, bgcolor: "#fff" }}>
                <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{n0(x.n)}</Typography>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK }}>{x.label}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{x.sub}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Button component="a" href="/uc/ticket-associations#shop-accounts" variant="contained" disableElevation sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>
              Fix them in Ticket/order/article associations
            </Button>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Each one with the company its orders are booked on and those on its e-mail domain - pick and Link. A+P&apos;s own people ({n0(u.internal)} accounts) left out.</Typography>
          </Box>
        </>
      )}
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
