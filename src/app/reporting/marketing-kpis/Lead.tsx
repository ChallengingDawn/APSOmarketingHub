"use client";
// LEAD GENERATION (SARCLA 18.10.2026: "I really want to understand the lead path from acquisition
// to purchase"; a lead is a new contact on a new company; every breakdown its own tab). Laid out as
// Reach and Visit: the title with its figures top right, tabs - the path, sources, months,
// countries, teams - and the Filters window (the months, the sources, the countries). The choice
// lives in the address; each card carries the tile tools (Actions). The rules are in leadsCube.ts.

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
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { CHANNELS, channelLabel, pathBy, pathOf, ym, type LeadFilters, type LeadsData, type PathCounts } from "@/lib/marketingKpis/leadsCube";
import { MONTHS, useSlow, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { PeriodPicker, Table, change, monthsLabel, n0, ratio, withChange } from "./ExplorerKit";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

type Tab = "path" | "sources" | "months" | "countries" | "teams";
const TABS: { id: Tab; label: string }[] = [
  { id: "path", label: "Path" },
  { id: "sources", label: "Sources" },
  { id: "months", label: "Months" },
  { id: "countries", label: "Countries" },
  { id: "teams", label: "Teams" },
];
const FOCUS = ["Switzerland", "Germany", "Italy", "France", "Austria", "Netherlands", "Liechtenstein", "Poland"];
const eur = (n: number) => `€${Math.round(n).toLocaleString("en")}`;

/** The figures top right: the path's steps this year, against the same months a year earlier. */
function Figures({ cur, prev }: { cur: PathCounts; prev: PathCounts }) {
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: number; p: number; fmt?: (n: number) => string; sub?: string }[] = [
    { label: "New leads", icon: <PersonAddAltOutlinedIcon />, tint: "blue", v: cur.companies, p: prev.companies, sub: `${n0(cur.contacts)} new contacts` },
    { label: "To sales", icon: <SupportAgentOutlinedIcon />, tint: "amber", v: cur.toSales, p: prev.toSales, sub: ratio(cur.toSales, cur.companies) + " of the leads" },
    { label: "Qualified", icon: <VerifiedOutlinedIcon />, tint: "purple", v: cur.qualified, p: prev.qualified, sub: `${n0(cur.notQualified)} not, ${n0(cur.notYet)} not yet` },
    { label: "New customers", icon: <ShoppingCartOutlinedIcon />, tint: "green", v: cur.customers, p: prev.customers, sub: ratio(cur.customers, cur.companies) + " of the leads" },
    { label: "Their revenue", icon: <EuroOutlinedIcon />, tint: "green", v: cur.rev, p: prev.rev, fmt: eur, sub: `${n0(cur.orders)} orders` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(120px, 168px))" } }}>
      {items.map((it) => {
        const d = it.p ? (it.v / it.p - 1) * 100 : null;
        return (
          <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Badge icon={it.icon} tint={it.tint} size={22} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{(it.fmt ?? n0)(it.v)}</Typography>
              {d != null && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: Math.abs(d) < 0.05 ? FAINT : d > 0 ? GREEN : RED }}>{d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d).toFixed(1)}%</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}{it.p ? ` · a year earlier ${(it.fmt ?? n0)(it.p)}` : ""}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** The path as bars: each step against the leads it started from, this year and a year earlier. */
function PathCard({ cur, prev, w, year, actions }: { cur: PathCounts; prev: PathCounts; w: MonthWindow; year: number; actions: React.ReactNode }) {
  const steps: { label: string; note: string; v: number; p: number; tint: Tint }[] = [
    { label: "New leads", note: "new companies, with their first new contact", v: cur.companies, p: prev.companies, tint: "blue" },
    { label: "Handed to sales", note: "an ESO or TSA ticket after they came in", v: cur.toSales, p: prev.toSales, tint: "amber" },
    { label: "Qualified by the owner", note: `${n0(cur.notQualified)} not qualified, ${n0(cur.notYet)} not yet`, v: cur.qualified, p: prev.qualified, tint: "purple" },
    { label: "New customers", note: "their first order", v: cur.customers, p: prev.customers, tint: "green" },
    { label: "… of them on their own", note: "ordered before any ESO/TSA ticket", v: cur.onOwn, p: prev.onOwn, tint: "green" },
  ];
  const top = Math.max(cur.companies, prev.companies, 1);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5 }}>
      <CardTitle icon={<AltRouteIcon />} tint="blue" title="From acquisition to purchase" note={`${monthsLabel(w)} ${year} against ${monthsLabel(w)} ${year - 1} - new companies that came in, and what became of them`} right={actions} />
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {steps.map((s) => (
          <Box key={s.label} sx={{ display: "grid", gap: 0.5, gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr) 150px" }, alignItems: "center" }}>
            <Box>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{s.note}</Typography>
            </Box>
            <Box sx={{ display: "grid", gap: 0.4 }}>
              <Box sx={{ height: 16, borderRadius: 99, bgcolor: TINT[s.tint].fg, width: `${(s.v / top) * 100}%`, minWidth: 4 }} />
              <Box sx={{ height: 8, borderRadius: 99, bgcolor: "#d3d8e0", width: `${(s.p / top) * 100}%`, minWidth: 4 }} />
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{n0(s.v)} <Box component="span" sx={{ fontSize: "0.76rem", color: FAINT, fontWeight: 600 }}>{s.label === "New leads" ? "" : ratio(s.v, cur.companies)}</Box></Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>a year earlier {n0(s.p)} {(() => { const c = change(s.v, s.p); return c ? <Box component="span" sx={{ color: c.color, fontWeight: 700 }}>{c.text}</Box> : null; })()}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Orders and revenue of the new customers: {n0(cur.orders)} orders, {eur(cur.rev)} (a year earlier {n0(prev.orders)}, {eur(prev.rev)}). A lead is a company new in HubSpot with its first new contact; counted per company, so three new people at one company are one lead.
      </Typography>
    </GlassCard>
  );
}

const head = ["", "Leads", "To sales", "Qualified", "New customers", "Conversion", "On their own", "Revenue"];
function rowCells(label: React.ReactNode, e: { cur: PathCounts; prev: PathCounts }) {
  const c = e.cur;
  return [label, withChange(n0(c.companies), change(c.companies, e.prev.companies)), n0(c.toSales), n0(c.qualified), withChange(n0(c.customers), change(c.customers, e.prev.customers)), ratio(c.customers, c.companies), n0(c.onOwn), eur(c.rev)];
}

export function LeadExplorer({ state }: { state: MkState | null }) {
  const params = useSearchParams();
  const ld = useSlow<LeadsData>("/api/reporting/marketing-kpis/leads", "leads");
  const d = ld.value;
  const year = d?.year ?? new Date().getFullYear();
  const done = d?.monthsDone ?? state?.live?.value?.monthsDone ?? new Date().getMonth();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "path"));
  const [channels, setChannels] = useState<string[]>(() => params.getAll("source"));
  const [countries, setCountries] = useState<string[]>(() => params.getAll("country"));
  const [chosenWin, setChosenWin] = useState<MonthWindow | null>(() => {
    const f = Number(params.get("from")), t = Number(params.get("to"));
    return f >= 1 && t >= f && t <= 12 ? { start: f - 1, end: t - 1 } : null;
  });
  const win: MonthWindow = chosenWin && chosenWin.end < Math.max(1, done) ? chosenWin : { start: 0, end: Math.max(0, done - 1) };
  const isDefault = win.start === 0 && win.end === Math.max(0, done - 1);
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<{ period?: boolean; source?: boolean; country?: boolean }>({});

  // the view lives in the address: a choice can be sent on and saved as a view
  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== "path") q.set("tab", tab);
    if (!isDefault) { q.set("from", String(win.start + 1)); q.set("to", String(win.end + 1)); }
    for (const c of channels) q.append("source", c);
    for (const c of countries) q.append("country", c);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, win.start, win.end, isDefault, channels, countries]);

  const f: LeadFilters = { channel: channels, country: countries };
  const path = useMemo(() => (d ? pathOf(d, win, f) : null), [d, win.start, win.end, channels, countries]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const chosenCount = channels.length + countries.length + (isDefault ? 0 : 1);
  const filters = { ...(channels.length ? { source: channels } : {}), ...(countries.length ? { country: countries } : {}) };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" tile={{ key: `lead:${tab}:${key}`, page: "lead", tab, title, summary: path ? `${n0(path.cur.companies)} new leads, ${n0(path.cur.customers)} new customers, ${monthsLabel(win)} ${year}` : undefined, filters, ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }), kind: "card" }} />
  );

  const countryRows = useMemo(() => (d ? [...pathBy(d, win, f, (r) => r.k).entries()].sort((a, b) => (FOCUS.includes(b[0]) ? 1 : 0) - (FOCUS.includes(a[0]) ? 1 : 0) || b[1].cur.companies - a[1].cur.companies) : []), [d, win.start, win.end, channels, countries]); // eslint-disable-line react-hooks/exhaustive-deps
  const countryOptions = useMemo(() => (d ? [...new Set(d.rows.map((r) => r.k))].sort((a, b) => (FOCUS.includes(b) ? 1 : 0) - (FOCUS.includes(a) ? 1 : 0) || a.localeCompare(b)) : []), [d]);

  if (!d || !path) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!ld.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: ld.error ? RED : MUTED }}>{ld.error ? `Could not load: ${ld.error}` : `Reading the new contacts and their companies…${ld.progress ? ` ${ld.progress}` : ""} The first read takes a few minutes.`}</Typography>
      </Box></GlassCard>
    );
  }

  const bySource = pathBy(d, win, f, (r) => r.c);
  const byOwner = [...pathBy(d, win, f, (r) => r.o).entries()].sort((a, b) => b[1].cur.companies - a[1].cur.companies);
  const byMonth = pathBy(d, { start: 0, end: 11 }, f, (r) => r.m.slice(5, 7));
  const monthData = MONTHS.map((x, i) => {
    const e = byMonth.get(String(i + 1).padStart(2, "0"));
    const inCur = i <= done - 1;
    return { x, current: inCur ? e?.cur.companies ?? 0 : null, prior: e?.prev.companies ?? 0, partial: false };
  });

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Lead Generation
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b> against the same months of {year - 1} · new contacts on new companies, and their path to the first order{ld.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />}
              {channels.map((c) => <Chip key={c} size="small" label={<span><b>Source:</b> {channelLabel(c)}</span>} onDelete={() => setChannels(flip(channels, c))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              {countries.map((c) => <Chip key={c} size="small" label={<span><b>Country:</b> {c}</span>} onDelete={() => setCountries(flip(countries, c))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              <Button size="small" onClick={() => { setChannels([]); setCountries([]); setChosenWin(null); }} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures cur={path.cur} prev={path.prev} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <ReportTabs name="lead" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="lead" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="lead-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {tab === "path" && <PathCard cur={path.cur} prev={path.prev} w={win} year={year} actions={act("path", "From acquisition to purchase")} />}

      {tab === "sources" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<AltRouteIcon />} tint="amber" title="Where the leads came from" note={`${monthsLabel(win)} ${year} · the original source of each new company's first new contact · click a source to filter by it`} right={act("sources", "Where the leads came from")} />
          <Table head={["Source", ...head.slice(1)]} rows={CHANNELS.filter((c) => bySource.has(c.id)).map((c) => ({ key: c.id, on: channels.includes(c.id), onPick: () => setChannels(flip(channels, c.id)), cells: rowCells(c.label, bySource.get(c.id)!) }))} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>HubSpot&apos;s original source of the contact. &quot;Created by people&quot; are contacts entered by sales or service, &quot;Chat&quot; those from the website chat; SEA is split by search engine (Bing = Microsoft Ads). The change is against the same months of {year - 1}.</Typography>
        </GlassCard>
      )}

      {tab === "months" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<TimelineOutlinedIcon />} tint="blue" title="New leads by month" note={`Every month of ${year} against ${year - 1}${channels.length || countries.length ? " · the sources and countries chosen" : ""}`} right={act("months", "New leads by month")} />
          <ChartFrame table={{ columns: ["Month", String(year), String(year - 1)], rows: monthData.map((m) => [m.x, m.current ?? "", m.prior]), numeric: [1, 2] }}>
            <GroupedColumns height={220} format={(x) => n0(x)} data={monthData} currentLabel={String(year)} priorLabel={String(year - 1)} />
          </ChartFrame>
          <Table head={["Month", ...head.slice(1)]} rows={MONTHS.slice(0, Math.max(1, done)).map((m, i) => {
            const e = byMonth.get(String(i + 1).padStart(2, "0")) ?? { cur: pathOf({ ...d, rows: [] }, win, f).cur, prev: pathOf({ ...d, rows: [] }, win, f).prev };
            return { key: m, cells: rowCells(m, e) };
          })} />
        </GlassCard>
      )}

      {tab === "countries" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<PublicOutlinedIcon />} tint="green" title="New leads by country" note={`${monthsLabel(win)} ${year} · our focus markets first · click a country to filter by it`} right={act("countries", "New leads by country")} />
          <Table head={["Country", ...head.slice(1)]} rows={countryRows.map(([k, e]) => ({ key: k, on: countries.includes(k), onPick: () => setCountries(flip(countries, k)), cells: rowCells(k, e) }))} />
        </GlassCard>
      )}

      {tab === "teams" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="New leads by owner" note={`${monthsLabel(win)} ${year} · the company's owner in HubSpot today`} right={act("teams", "New leads by owner")} />
          <Table head={["Owner", ...head.slice(1)]} rows={byOwner.map(([o, e]) => ({ key: o || "none", cells: rowCells(o ? d.owners[o] ?? `Owner ${o}` : "No owner", e) }))} />
        </GlassCard>
      )}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - new contacts, their companies, the companies&apos; ESO and TSA tickets - {d.readAt ? `last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 6 hours.
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="lead-filters" open={panel} onClose={() => setPanel(false)} subtitle="The months, the sources, the countries" onClearAll={chosenCount ? () => { setChannels([]); setCountries([]); setChosenWin(null); } : undefined}>
        <FilterSection id="lead-f-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!!open.period} onFlip={() => setOpen((o) => ({ ...o, period: !o.period }))} summary={monthsLabel(win)} chosen={!isDefault}>
          <PeriodPicker done={done} win={win} onChange={(x) => setChosenWin(x)} />
        </FilterSection>
        <FilterSection id="lead-f-source" index={1} title="Source" icon={<AltRouteIcon />} tint="amber" open={!!open.source} onFlip={() => setOpen((o) => ({ ...o, source: !o.source }))} summary={channels.length ? `${channels.length} chosen` : "All"} chosen={channels.length > 0}>
          {CHANNELS.map((c) => <Pick key={c.id} on={channels.includes(c.id)} label={c.label} onClick={() => setChannels(flip(channels, c.id))} />)}
        </FilterSection>
        <FilterSection id="lead-f-country" index={2} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {countryOptions.map((c) => <Pick key={c} on={countries.includes(c)} label={c} note={FOCUS.includes(c) ? "focus market" : undefined} onClick={() => setCountries(flip(countries, c))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}

function Pick({ on, label, note, onClick }: { on: boolean; label: string; note?: string; onClick: () => void }) {
  return (
    <Box component="button" type="button" onClick={onClick} aria-pressed={on}
      sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", border: 0, bgcolor: on ? TINT.blue.bg : "transparent", font: "inherit", textAlign: "left", px: 1, py: 0.6, borderRadius: "10px", cursor: "pointer", "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.04)" } }}>
      <Box sx={{ width: 18, height: 18, borderRadius: "6px", border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.fg : "#fff", display: "grid", placeItems: "center" }}>{on && <CheckIcon sx={{ fontSize: 14, color: "#fff" }} />}</Box>
      <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1 }}>{label}</Typography>
      {note && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{note}</Typography>}
    </Box>
  );
}
