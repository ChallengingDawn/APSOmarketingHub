"use client";
// REACH, laid out as Who are our customers (SARCLA 18.10: "adapt the reach page to match
// who are our customers with the filter, the padding and tabs to split the KPIs"): the
// title with its figures top right, the KPIs split into tabs - search, ads, countries, AI
// answers, email, customers from search - and the Filters window: the months, and the
// countries for the Search Console figures. The choice lives in the address.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ByAssistant, CitedSitesCard } from "@/app/aeo/OverviewBody";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { KPIS } from "@/lib/marketingKpis/catalogue";
import { fmtValue } from "@/lib/marketingKpis/measures";
import type { LiveKpis } from "@/lib/marketingKpis/live";
import { FOCUS_A3, countryName } from "@/lib/marketingKpis/countries";
import { countryTable, seriesForCountries, type CountryRow } from "@/lib/marketingKpis/countryMonths";
import { roasRows } from "@/lib/marketingKpis/roas";
import { Compare, KpiCard, LiveNote, MONTHS, NotConnected, StageGlyph, buildViews, nameOf, periodOf, stageKpis, stageTint, upToOf, type KpiView, type MkState, type MonthWindow } from "./data";
import { SearchCustomersCard } from "./SearchCustomers";
import { FilterPanel, FilterSection } from "./FilterPanel";
// the tile toolbar and saved views (9f, SARCLA 18.10: "they should be on the main one then visible on the nutshell")
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";
import { kpiSummary } from "./tiles/summary";

type Tab = "search" | "ads" | "countries" | "ai" | "email" | "linkedin" | "customers";
const TABS: { id: Tab; label: string; kpis: string[] }[] = [
  { id: "search", label: "Search (SEO)", kpis: ["R04", "R05", "R06", "R07", "R08"] },
  { id: "ads", label: "Ads (SEA)", kpis: ["R01", "R02", "R03"] },
  // R09 has a card of its own there: the countries side by side (SARCLA 18.10: "this graph is not correct")
  { id: "countries", label: "Countries", kpis: [] },
  // SARCLA 18.10: "AI answer tab - change the name to (GEO)"
  { id: "ai", label: "AI answers (GEO)", kpis: ["R10"] },
  { id: "email", label: "Email", kpis: ["R11", "R11O", "R11C"] },
  // being built until LinkedIn opens the page statistics (SARCLA 18.10: "create a tab for LinkedIn and put under building")
  { id: "linkedin", label: "LinkedIn", kpis: [] },
  { id: "customers", label: "Customers from search", kpis: [] },
];
/** Microsoft Ads on the Ads tab: GA4's visits, orders and revenue (live), and the typed impressions, clicks and cost */
const MICROSOFT_LIVE = ["MSV", "MSO", "MSR"];
const MICROSOFT_TYPED = ["R01M", "R02M", "X01M"];
/** the KPIs a country choice narrows: Search Console's impressions, clicks and click rate, and the clicks by country */
const BY_COUNTRY = ["R04", "R05", "R06", "R09"];

const n0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en"));
const ratio = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? "—" : `${((a / b) * 100).toFixed(1)}%`);
const change = (cur: number | null | undefined, prev: number | null | undefined) => {
  if (cur == null || !prev) return null;
  const r = cur / prev - 1;
  return { text: `${r > 0 ? "↑" : r < 0 ? "↓" : "±"} ${Math.abs(r * 100).toFixed(1)}%`, color: r > 0.005 ? GREEN : r < -0.005 ? RED : MUTED };
};
const monthsLabel = (w: MonthWindow) => (w.end < w.start ? "no months yet" : w.start === w.end ? MONTHS[w.start] : `${MONTHS[w.start]}–${MONTHS[w.end]}`);
const names = (codes: string[]) => {
  const n = codes.map(countryName);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] ?? "";
};

/** A plain table, figures in full (SARCLA: no abbreviations); a row can be picked. */
function Table({ head, rows, firstWidth = "minmax(200px, 1.6fr)" }: {
  head: string[]; rows: { key: string; cells: React.ReactNode[]; strong?: boolean; on?: boolean; onPick?: () => void }[]; firstWidth?: string;
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      {/* the cells stretch to their row, so a row's line runs straight across */}
      <Box sx={{ display: "grid", gridTemplateColumns: `${firstWidth} repeat(${head.length - 1}, minmax(110px, 1fr))`, minWidth: 220 + (head.length - 1) * 115, alignItems: "stretch" }}>
        {head.map((h, i) => <Typography key={h} sx={{ display: "flex", alignItems: "flex-end", justifyContent: i ? "flex-end" : "flex-start", fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i ? "right" : "left", pb: 0.75, px: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>{h}</Typography>)}
        {rows.map((r) => (
          <Box key={r.key} role={r.onPick ? "button" : undefined} tabIndex={r.onPick ? 0 : undefined} aria-pressed={r.onPick ? !!r.on : undefined}
            onClick={r.onPick} onKeyDown={r.onPick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.onPick!(); } } : undefined}
            sx={{ display: "contents", cursor: r.onPick ? "pointer" : "default", "& > *": { py: 0.8, px: 0.75, borderBottom: `1px solid ${HAIRLINE}`, fontVariantNumeric: "tabular-nums", bgcolor: r.on ? TINT.blue.bg : r.strong ? "#f4f7fc" : "transparent" }, "&:hover > *": r.onPick ? { bgcolor: r.on ? TINT.blue.bg : "#f7f9fc" } : {} }}>
            {r.cells.map((c, i) => <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: i ? "flex-end" : "flex-start", fontSize: "0.86rem", color: INK, fontWeight: r.strong ? 800 : i ? 500 : 600, textAlign: i ? "right" : "left" }}>{c}</Box>)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Search visibility by country (R09): every country written out, the focus markets marked, the change on the same months a year earlier; a row picks the country. */
function SearchCountries({ live, win, chosen, onPick, actions }: { live: LiveKpis; win: MonthWindow; chosen: string[]; onPick: (code: string) => void; actions?: React.ReactNode }) {
  const b = live.breakdowns;
  const cm = b.searchCountryMonths;
  // by the months chosen when the read has them by month; else the year so far, as read
  const t = cm ? countryTable(cm, live.year, live.monthsDone, 999, win) : { rows: b.searchCountries as CountryRow[], same: b.searchSame ?? [] };
  const pick = new Set(chosen);
  const top = t.rows.filter((r) => !r.focus && !pick.has(r.label)).slice(0, 10);
  const rows = t.rows.filter((r) => r.focus || pick.has(r.label) || top.includes(r));
  const cmp = t.same.length ? (t.same.length === 1 ? MONTHS[t.same[0]] : `${MONTHS[t.same[0]]}–${MONTHS[t.same[t.same.length - 1]]}`) : "";
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<TravelExploreIcon />} tint="blue" title="Search visibility by country" right={actions}
        note={`Google Search Console, ${cm ? monthsLabel(win) : "the year so far"} ${live.year}${cmp ? ` · the change on ${cmp}, against the same months of ${live.year - 1}` : ""} · click a country to filter by it`} />
      <Table
        head={["Country", "Clicks", "Impressions", "Click rate", `Clicks vs ${live.year - 1}`]}
        rows={rows.map((c) => {
          const ch = change(c.sameClicks, c.pyClicks);
          return {
            key: c.label, on: pick.has(c.label), onPick: () => onPick(c.label),
            cells: [
              <Box key="n" component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                {pick.has(c.label) && <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} />}
                {countryName(c.label)}
                {c.focus && <Box component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#2459d1", bgcolor: "#eef3fd", px: 0.7, py: 0.1, borderRadius: "6px" }}>focus market</Box>}
              </Box>,
              n0(c.clicks), n0(c.impressions), ratio(c.clicks, c.impressions),
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

/**
 * R09, search visibility by country: the countries side by side, this year against last
 * on the months both years have - not one monthly total under a "by country" title
 * (SARCLA 18.10: "this graph is not correct"). Clicks or impressions.
 */
function CountryVisibility({ live, v, win, chosen, actions }: { live: LiveKpis; v: KpiView; win: MonthWindow; chosen: string[]; actions?: React.ReactNode }) {
  const [by, setBy] = useState<"clicks" | "impressions">("clicks");
  const cm = live.breakdowns.searchCountryMonths!;
  const key = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;
  // the months both years have, within the chosen ones (Google keeps 16 months)
  const same: number[] = [];
  for (let i = win.start; i <= Math.min(win.end, live.monthsDone - 1); i++) if (cm[key(live.year, i)] && cm[key(live.year - 1, i)]) same.push(i);
  const chosenMonths = Array.from({ length: Math.max(0, Math.min(win.end, live.monthsDone - 1) - win.start + 1) }, (_, k) => win.start + k);
  const months = same.length ? same : chosenMonths;
  const sum = (y: number, c: string) => months.reduce((a, i) => { const r = cm[key(y, i)]?.[c]; return [a[0] + (r?.[0] ?? 0), a[1] + (r?.[1] ?? 0)]; }, [0, 0]);
  const pick = new Set(chosen);
  const codes = [...new Set([...FOCUS_A3, ...chosen])];
  const k = by === "clicks" ? 0 : 1;
  const rows = codes.map((c) => ({ c, cur: sum(live.year, c)[k], prev: same.length ? sum(live.year - 1, c)[k] : null }))
    .sort((a, b) => b.cur - a.cur);
  const w = months.length ? (months.length === 1 ? MONTHS[months[0]] : `${MONTHS[months[0]]}–${MONTHS[months[months.length - 1]]}`) : "";
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Badge icon={<StageGlyph slug="reach" />} tint={stageTint("reach")} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 600 }}>R09 · live in the hub</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{nameOf("R09")}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Which markets see us?</Typography>
        </Box>
        {actions && <Box sx={{ flex: "0 0 auto" }}>{actions}</Box>}
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{periodOf(v)} · clicks from the {chosen.length ? "chosen countries" : "focus markets"}</Typography>
        </Box>
      </Box>
      <Compare v={v} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ flex: 1, minWidth: 220, fontSize: "0.86rem", fontWeight: 700, color: INK }}>
          {by === "clicks" ? "Clicks" : "Impressions"} by country, {w} {live.year}{same.length ? ` against ${w} ${live.year - 1}` : ""}
          {same.length > 0 && same.length < chosenMonths.length && <Box component="span" sx={{ fontWeight: 500, color: FAINT }}> - the months both years have</Box>}
        </Typography>
        <Box sx={{ display: "inline-flex", p: 0.5, gap: 0.5, borderRadius: "12px", bgcolor: "rgba(21,34,58,.05)" }}>
          {(["clicks", "impressions"] as const).map((m) => (
            <Box key={m} component="button" type="button" onClick={() => setBy(m)} aria-pressed={by === m}
              sx={{ border: 0, font: "inherit", cursor: "pointer", px: 1.25, py: 0.6, borderRadius: "9px", fontSize: "0.8rem", fontWeight: 700,
                bgcolor: by === m ? "#fff" : "transparent", color: by === m ? INK : MUTED, boxShadow: by === m ? "0 1px 3px rgba(21,34,58,.12)" : "none" }}>
              {m === "clicks" ? "Clicks" : "Impressions"}
            </Box>
          ))}
        </Box>
      </Box>
      <ChartFrame table={{ columns: ["Country", String(live.year), String(live.year - 1)], rows: rows.map((r) => [countryName(r.c), r.cur, r.prev ?? ""]), numeric: [1, 2] }}>
        <GroupedColumns height={240} format={(x) => n0(x)}
          data={rows.map((r) => ({ x: countryName(r.c), current: r.cur, prior: r.prev }))}
          currentLabel={String(live.year)} priorLabel={String(live.year - 1)} />
      </ChartFrame>
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        Google Search Console. The focus markets{pick.size ? " and the countries chosen" : ""}; every country is in the table below.
        {!same.length ? " Google keeps 16 months, so these months have no last year to compare with." : ""}
      </Typography>
    </GlassCard>
  );
}

/**
 * A KPI the hub is still building - what it will show, what it waits for, what happens
 * meanwhile (SARCLA 18.10: the email statistics are not in the app's scope; LinkedIn "under building").
 */
function BeingBuilt({ id, icon, waits, meanwhile, title, shows, from }: { id: string; icon: React.ReactNode; waits: string; meanwhile: string; title?: string; shows?: string; from?: string }) {
  const k = KPIS.find((x) => x.id === id);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, border: `1px dashed ${TINT.amber.fg}` }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Badge icon={icon} tint="amber" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 600 }}>{id} · being built</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{title ?? k?.name ?? id}</Typography>
          {!title && k?.question && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{k.question}</Typography>}
        </Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.74rem", fontWeight: 700, color: TINT.amber.fg, bgcolor: TINT.amber.bg, px: 1, py: 0.4, borderRadius: "999px" }}>
          <ConstructionOutlinedIcon sx={{ fontSize: 16 }} /> Being built
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "160px minmax(0, 1fr)" }, fontSize: "0.86rem" }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>It will show</Typography>
        <Typography sx={{ fontSize: "0.86rem", color: INK }}>{shows ?? `${k?.definition ?? ""} By ${k?.breakdowns?.toLowerCase().replace(/ · /g, ", ") || "month"}.`}</Typography>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>From</Typography>
        <Typography sx={{ fontSize: "0.86rem", color: INK }}>{from ?? k?.source ?? ""}</Typography>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>Waiting for</Typography>
        <Typography sx={{ fontSize: "0.86rem", color: INK }}>{waits}</Typography>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>Meanwhile</Typography>
        <Typography sx={{ fontSize: "0.86rem", color: INK }}>{meanwhile}</Typography>
      </Box>
    </GlassCard>
  );
}

/** GA4's names for the Google Ads networks, in plain words. */
const NETWORK: Record<string, string> = {
  "Google search": "Google Search", "Search partners": "Search partners", "Cross-network": "Performance Max (all networks)",
  "Google owned channels": "YouTube, Gmail and Discover", "Display Network": "Display", "Google Display Network": "Display", "YouTube Search": "YouTube", "YouTube Videos": "YouTube",
};

/** Google Ads by network - where the impressions come from (SARCLA 18.10: "is this data about impressions right?"). */
function SeaNetworks({ live, win, actions }: { live: LiveKpis; win: MonthWindow; actions?: React.ReactNode }) {
  const b = live.breakdowns;
  return (
    <ByKind live={live} win={win} byMonth={b.seaNetworkMonths} total={b.seaNetworks} euros={b.seaCurrency === "EUR"} names={NETWORK}
      title="Google Ads by network" first="Network" icon={<AdsClickIcon />} tint="amber" actions={actions}
      note={<>From the Google Ads accounts linked to GA4{b.seaCurrency === "EUR" ? "; cost in euros, GA4's francs at each month's ECB rate" : ""}. Performance Max shows ads across Search, Display, YouTube and Gmail, so it gathers many impressions for few clicks:
        a change in how much of the budget runs through it moves the impressions far more than the clicks or the cost.</>} />
  );
}

/**
 * Return on ad spend by channel (SARCLA 18.10: "ROAS on SEA different channels + SEO"): GA4's revenue
 * over the ad cost, Google Ads by network and Microsoft Ads, the months chosen against the same months
 * a year earlier; SEO's revenue beside them, with no ad cost to divide by.
 */
function Roas({ live, win, actions }: { live: LiveKpis; win: MonthWindow; actions?: React.ReactNode }) {
  const data = live.breakdowns.roas;
  if (!data) return null;
  const upTo = live.monthsDone;
  const months = Array.from({ length: Math.max(0, Math.min(win.end, upTo - 1) - win.start + 1) }, (_, k) => win.start + k);
  if (!months.length) return null;
  const rows = roasRows(data, live.year, months);
  const w = monthsLabel({ start: months[0], end: months[months.length - 1] });
  const eur = (v: number | null) => (v == null ? "—" : `€${n0(v)}`);
  const x = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}×`);
  const roasCell = (r: (typeof rows)[number]) => {
    if (r.key === "seo") return <Box component="span" sx={{ color: FAINT }}>no ad cost</Box>;
    const c = r.roas != null && r.pyRoas ? r.roas / r.pyRoas - 1 : null;
    return (
      <Box sx={{ display: "grid", justifyItems: "end" }}>
        <span>{x(r.roas)}</span>
        {c != null && <Box component="span" sx={{ color: c > 0.005 ? GREEN : c < -0.005 ? RED : MUTED, fontWeight: 700, fontSize: "0.74rem" }}>{c > 0 ? "↑" : c < 0 ? "↓" : "±"} {Math.abs(c * 100).toFixed(1)}%</Box>}
      </Box>
    );
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<AdsClickIcon />} tint="green" title="Return on ad spend by channel, and SEO" right={actions} note={`${w} ${live.year} against ${w} ${live.year - 1} - revenue per euro of ad cost`} />
      <Table
        firstWidth="minmax(220px, 1.7fr)"
        head={["Channel", `Revenue ${live.year - 1}`, `Revenue ${live.year}`, `Cost ${live.year - 1}`, `Cost ${live.year}`, `ROAS ${live.year - 1}`, `ROAS ${live.year}`]}
        rows={rows.map((r) => ({
          key: r.key, strong: !r.indent,
          cells: [
            <Box key="n" component="span" sx={{ pl: r.indent ? 2 : 0, fontWeight: r.indent ? 500 : 700 }}>{r.label}</Box>,
            eur(r.pyRevenue), eur(r.revenue), eur(r.pyCost), eur(r.cost), r.key === "seo" ? "—" : x(r.pyRoas), roasCell(r),
          ],
        }))}
      />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        ROAS = revenue ÷ ad cost. Revenue is GA4&apos;s: the orders of the visits each channel brought (last click), only from visitors who accepted statistics cookies - a floor, below what
        Google Ads and Microsoft Advertising report with their own conversion tracking. Cost from Google Ads through GA4 and from the Microsoft Advertising script; all in euros at each
        month&apos;s ECB rate. SEO has no ad cost, so no ROAS - its revenue shows what organic search brings.
      </Typography>
    </GlassCard>
  );
}

/** Microsoft Ads by campaign type - Microsoft's side of Google's networks (SARCLA 18.10: "this table for Microsoft as well"). */
function MsKinds({ live, win, actions }: { live: LiveKpis; win: MonthWindow; actions?: React.ReactNode }) {
  const ms = live.breakdowns.msAds;
  if (!ms?.kinds || !Object.keys(ms.kinds).length) return null;
  return (
    <ByKind live={live} win={win} byMonth={ms.kinds} euros title="Microsoft Ads by campaign type" first="Campaign type" icon={<AdsClickIcon />} tint="blue" actions={actions}
      note={<>From the Microsoft Advertising script, every campaign of the account by its type; cost in euros, the account&apos;s francs at each month&apos;s ECB rate{ms.costPartial ? " - accounts in another currency left out of the cost" : ""}.
        Performance Max runs across Microsoft&apos;s search and audience network, so like Google&apos;s it gathers many impressions per click.</>} />
  );
}

/** A table by kind (network, campaign type): impressions, clicks and cost, the months chosen against the same months last year. */
function ByKind({ live, win, byMonth, total, euros, names = {}, title, first, icon, tint, note, actions }: {
  live: LiveKpis; win: MonthWindow; byMonth?: Record<string, Record<string, [number, number, number | null]>>;
  total?: { label: string; impr: number; clicks: number; cost: number; pyImpr: number; pyClicks: number; pyCost: number }[];
  euros: boolean; names?: Record<string, string>; title: string; first: string; icon: React.ReactNode; tint: Tint; note: React.ReactNode; actions?: React.ReactNode;
}) {
  const b = live.breakdowns;
  const upTo = b.seaUpTo ?? live.monthsDone;
  const end = Math.min(win.end, upTo - 1);
  const shown: MonthWindow = byMonth ? { start: win.start, end } : { start: 0, end: upTo - 1 };
  let rows: { label: string; impr: number; clicks: number; cost: number; pyImpr: number; pyClicks: number; pyCost: number; noCost?: boolean }[] = total ?? [];
  if (byMonth) {
    const acc: Record<string, { impr: number; clicks: number; cost: number; pyImpr: number; pyClicks: number; pyCost: number; noCost?: boolean }> = {};
    for (let i = shown.start; i <= shown.end; i++) {
      for (const [y, cy] of [[live.year, true], [live.year - 1, false]] as const) {
        for (const [net, [im, cl, co]] of Object.entries(byMonth[`${y}-${String(i + 1).padStart(2, "0")}`] ?? {})) {
          const a = (acc[net] ??= { impr: 0, clicks: 0, cost: 0, pyImpr: 0, pyClicks: 0, pyCost: 0 });
          if (co == null) a.noCost = true;
          if (cy) { a.impr += im; a.clicks += cl; a.cost += co ?? 0; } else { a.pyImpr += im; a.pyClicks += cl; a.pyCost += co ?? 0; }
        }
      }
    }
    rows = Object.entries(acc).map(([label, v]) => ({ label, ...v })).sort((a, c) => c.impr + c.pyImpr - (a.impr + a.pyImpr));
  }
  if (!rows.length || shown.end < shown.start) return null;
  const w = monthsLabel(shown);
  const noCost = rows.some((r) => r.noCost);
  const money = (v: number) => (noCost ? "—" : euros ? `€${n0(v)}` : `CHF ${n0(v)}`);
  const t = rows.reduce((s, r) => ({ impr: s.impr + r.impr, pyImpr: s.pyImpr + r.pyImpr, clicks: s.clicks + r.clicks, pyClicks: s.pyClicks + r.pyClicks, cost: s.cost + r.cost, pyCost: s.pyCost + r.pyCost }), { impr: 0, pyImpr: 0, clicks: 0, pyClicks: 0, cost: 0, pyCost: 0 });
  const line = (key: string, name: string, r: typeof t, strong = false) => {
    // the change under this year's figure, never squeezed beside it
    const withChange = (k: string, v: number, c: ReturnType<typeof change>) => (
      <Box key={k} sx={{ display: "grid", justifyItems: "end" }}>
        <span>{n0(v)}</span>
        {c && <Box component="span" sx={{ color: c.color, fontWeight: 700, fontSize: "0.74rem" }}>{c.text}</Box>}
      </Box>
    );
    return { key, strong, cells: [name, n0(r.pyImpr), withChange("i", r.impr, change(r.impr, r.pyImpr)), n0(r.pyClicks), withChange("c", r.clicks, change(r.clicks, r.pyClicks)), money(r.pyCost), money(r.cost)] };
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={icon} tint={tint} title={title} right={actions} note={`${w} ${live.year} against ${w} ${live.year - 1} - where the impressions and clicks come from`} />
      <Table
        head={[first, `Impressions ${live.year - 1}`, `Impressions ${live.year}`, `Clicks ${live.year - 1}`, `Clicks ${live.year}`, `Cost ${live.year - 1}`, `Cost ${live.year}`]}
        rows={[...rows.map((r) => line(r.label, names[r.label] ?? r.label, r)), line("total", first === "Network" ? "All networks" : "All campaign types", t, true)]}
      />
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{note}</Typography>
    </GlassCard>
  );
}

/** The figures top right beside the title, each in a small card - as on Who are our customers. */
function Figures({ views, countries }: { views: Record<string, KpiView>; countries: string[] }) {
  const items: { id: string; label: string; icon: React.ReactNode; tint: Tint }[] = [
    { id: "R05", label: "Search clicks", icon: <TouchAppOutlinedIcon />, tint: "blue" },
    { id: "R02", label: "Ad clicks", icon: <AdsClickIcon />, tint: "amber" },
    { id: "R09", label: countries.length ? "Clicks, chosen countries" : "Clicks, focus markets", icon: <FlagOutlinedIcon />, tint: "green" },
    { id: "R10", label: "AI answers naming APSO", icon: <SmartToyOutlinedIcon />, tint: "purple" },
    { id: "R11", label: "Emails delivered", icon: <MailOutlineIcon />, tint: "pink" },
  ];
  const shown = items.filter((it) => views[it.id] && views[it.id].ytd != null);
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${shown.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {shown.map((it) => {
        const v = views[it.id];
        const same = v.sameYtd != null && v.pyNote?.startsWith("same months");
        const cur = same ? v.sameYtd! : v.ytd;
        const pct = v.measure.fmt === "pct";
        const d = cur != null && v.pyYtd != null && v.pyYtd !== 0 ? (pct ? (cur - v.pyYtd) * 100 : (cur / v.pyYtd - 1) * 100) : null;
        const good = v.measure.goodWhenUp !== false;
        return (
          <Box key={it.id} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Badge icon={it.icon} tint={it.tint} size={22} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
              {d != null && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: Math.abs(d) < 0.05 ? FAINT : (d > 0) === good ? GREEN : RED }}>{d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d).toFixed(1)}{pct ? " pts" : "%"}</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>
              {v.pyYtd != null ? `a year earlier${same ? ` (${v.pyNote?.replace("same months ", "")})` : ""}: ${fmtValue(v.measure.fmt, v.pyYtd)}` : "no year earlier to compare"}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** The months: the year so far, the last three, a quarter - or any run of the months that are in. */
function PeriodPicker({ done, win, onChange }: { done: number; win: MonthWindow; onChange: (w: MonthWindow) => void }) {
  const last = Math.max(0, done - 1);
  const presets: { label: string; w: MonthWindow }[] = [
    { label: "This year so far", w: { start: 0, end: last } },
    ...(done >= 3 ? [{ label: "Last 3 months", w: { start: done - 3, end: last } }] : []),
    ...[0, 1, 2, 3].filter((q) => q * 3 < done).map((q) => ({ label: `Q${q + 1}`, w: { start: q * 3, end: Math.min(q * 3 + 2, last) } })),
  ];
  const same = (a: MonthWindow, b: MonthWindow) => a.start === b.start && a.end === b.end;
  const sel = { font: "inherit", fontSize: "0.84rem", padding: "6px 8px", borderRadius: "10px", border: `1px solid ${HAIRLINE}`, background: "#fff", color: INK } as const;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        {presets.map((p) => {
          const on = same(p.w, win);
          return (
            <Box key={p.label} component="button" type="button" onClick={() => onChange(p.w)} aria-pressed={on}
              sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, font: "inherit", fontSize: "0.8rem", fontWeight: 700, px: 1.25, py: 0.6, borderRadius: "10px", cursor: "pointer" }}>
              {p.label}
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography component="label" sx={{ fontSize: "0.8rem", color: MUTED }}>From
          <select aria-label="From month" value={win.start} onChange={(e) => { const s = Number(e.target.value); onChange({ start: s, end: Math.max(s, win.end) }); }} style={{ ...sel, marginLeft: 6 }}>
            {MONTHS.slice(0, Math.max(1, done)).map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </Typography>
        <Typography component="label" sx={{ fontSize: "0.8rem", color: MUTED }}>to
          <select aria-label="To month" value={win.end} onChange={(e) => { const e2 = Number(e.target.value); onChange({ start: Math.min(win.start, e2), end: e2 }); }} style={{ ...sel, marginLeft: 6 }}>
            {MONTHS.slice(0, Math.max(1, done)).map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </Typography>
      </Box>
    </Box>
  );
}

/** The countries Search Console sees, by clicks in the months chosen: the focus markets first; the rest on request. */
function CountryPicker({ live, win, chosen, onPick }: { live: LiveKpis; win: MonthWindow; chosen: string[]; onPick: (code: string) => void }) {
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const cm = live.breakdowns.searchCountryMonths;
  const rows = useMemo(() => (cm ? countryTable(cm, live.year, live.monthsDone, 999, win).rows : []), [cm, live.year, live.monthsDone, win]);
  if (!cm) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The countries come with the hub&apos;s next read of Search Console.</Typography>;
  const pick = new Set(chosen);
  const focus = rows.filter((r) => r.focus);
  const rest = rows.filter((r) => !r.focus && (!q || countryName(r.label).toLowerCase().includes(q.toLowerCase())));
  const list = [...focus, ...(all || q ? rest : rest.slice(0, 10))];
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {(all || rest.length > 10) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, height: 34, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, mb: 0.5 }}>
          <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a country…" inputProps={{ "aria-label": "Find a country" }} sx={{ fontSize: "0.84rem", flex: 1 }} />
        </Box>
      )}
      {list.map((r) => {
        const on = pick.has(r.label);
        return (
          <Box key={r.label} component="button" type="button" onClick={() => onPick(r.label)} aria-pressed={on}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 90px 64px", alignItems: "center", gap: 1, border: 0, font: "inherit", textAlign: "left", cursor: "pointer", px: 1, py: 0.6, borderRadius: "10px", bgcolor: on ? TINT.blue.bg : "transparent", "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: TINT.blue.fg }} /> : <span />}
            <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: on ? 700 : 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {countryName(r.label)}{r.focus && <Box component="span" sx={{ ml: 0.75, fontSize: "0.64rem", fontWeight: 700, color: "#2459d1" }}>focus</Box>}
            </Typography>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: "#e6ebf2" }}><Box sx={{ height: 6, borderRadius: 99, bgcolor: "#2d6fa8", width: `${(100 * r.clicks) / max}%` }} /></Box>
            <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n0(r.clicks)}</Typography>
          </Box>
        );
      })}
      {!q && rest.length > 10 && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ justifySelf: "start", textTransform: "none", fontWeight: 700 }}>
          {all ? "Show fewer" : `Show all ${rows.length} countries`}
        </Button>
      )}
    </Box>
  );
}

export function ReachExplorer({ state }: { state: MkState | null }) {
  const params = useSearchParams();
  const live = state?.live?.value;
  const year = live?.year ?? new Date().getFullYear();
  const done = live?.monthsDone ?? 0;
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "search"));
  const [countries, setCountries] = useState<string[]>(() => params.getAll("country").map((c) => c.toLowerCase()));
  const [chosenWin, setChosenWin] = useState<MonthWindow | null>(() => {
    const f = Number(params.get("from")), t = Number(params.get("to"));
    return f >= 1 && t >= f && t <= 12 ? { start: f - 1, end: t - 1 } : null;
  });
  // the year so far until a period is chosen - and it moves on with the months
  const win: MonthWindow = chosenWin && chosenWin.end < Math.max(1, done) ? chosenWin : { start: 0, end: Math.max(0, done - 1) };
  const isDefault = win.start === 0 && win.end === Math.max(0, done - 1);
  const [panel, setPanel] = useState(false);
  const [shut, setShut] = useState<{ period?: boolean; country?: boolean }>({});

  // the view lives in the address: a choice can be sent on
  useEffect(() => {
    if (!live) return;
    const q = new URLSearchParams();
    if (tab !== "search") q.set("tab", tab);
    if (!isDefault) { q.set("from", String(win.start + 1)); q.set("to", String(win.end + 1)); }
    for (const c of countries) q.append("country", c);
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [tab, win.start, win.end, isDefault, countries, live]);

  const toggleCountry = (c: string) => setCountries((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  // the countries chosen narrow the Search Console figures, read month by month by country
  const shownLive = useMemo(() => {
    const cm = live?.breakdowns.searchCountryMonths;
    if (!live || !countries.length || !cm) return live;
    return { ...live, series: { ...live.series, ...seriesForCountries(cm, countries, live.year) } };
  }, [live, countries]);
  const views = useMemo(() => {
    if (!state?.inputs) return null;
    const v = buildViews(state.inputs, shownLive, year, win);
    if (!countries.length || !live?.breakdowns.searchCountryMonths) return v;
    // say on each card what the country choice does to it
    const who = names(countries);
    for (const id of BY_COUNTRY) if (v[id]) v[id] = { ...v[id], measure: { ...v[id].measure, note: `Only ${who}`, ...(id === "R09" ? { definition: `Google search clicks from ${who}` } : {}) } };
    for (const id of ["R07", "R08"]) if (v[id]) v[id] = { ...v[id], measure: { ...v[id].measure, note: `${v[id].measure.note ? `${v[id].measure.note} · ` : ""}For all countries - not narrowed by country` } };
    return v;
  }, [state?.inputs, shownLive, year, win.start, win.end, countries, live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!views || !state || !live) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!state?.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading…"}</Typography>
      </Box></GlassCard>
    );
  }

  const { ids, missing } = stageKpis("1", live);
  const waiting = live.waiting ?? {};
  // the tile toolbar: a KPI keyed as in the nutshell ("reach::R05"), a card by its tab ("reach:ads:roas")
  const country = countries.length ? { country: countries } : undefined;
  const kpiActs = (id: string, v: KpiView) => (
    <TileActions where="tab" start={ids.includes(id) ? "nutshell" : "tab"}
      tile={{ key: `reach::${id}`, page: "reach", tab, kpiId: id, title: nameOf(id), summary: kpiSummary(v, periodOf(v)), filters: country, kind: "kpi" }} />
  );
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" tile={{ key: `reach:${tab}:${key}`, page: "reach", tab, title, summary: `${monthsLabel(win)} ${year}`, filters: country, kind: "card" }} />
  );
  const card = (id: string) => {
    const v = views[id];
    if (!v || (!ids.includes(id) && !MICROSOFT_LIVE.includes(id) && !MICROSOFT_TYPED.includes(id))) return null;
    const k = KPIS.find((x) => x.id === id) ?? { ...KPIS[0], id, name: "", question: "", definition: "", audience: "", audienceAsk: "" };
    return <KpiCard key={id} v={v} kpi={k} icon={<StageGlyph slug="reach" />} tint={stageTint("reach")} upTo={upToOf(v, state, year)} actions={kpiActs(id, v)} />;
  };
  const kpis = TABS.find((t) => t.id === tab)!.kpis.map(card).filter(Boolean);
  const upToDay = (() => { const e = Math.min(win.end, done - 1); return e >= 0 ? `${new Date(Date.UTC(year, e + 1, 0)).getUTCDate()} ${MONTHS[e]} ${year}` : "—"; })();
  const chosenCount = countries.length + (isDefault ? 0 : 1);

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {/* the title and what is shown on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Reach
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b> against the same months of {year - 1} · figures up to {upToDay}{state.live?.computing ? " · reading the sources again" : ""}
          </Typography>
          {(countries.length > 0 || !isDefault) && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.blue.fg } }} />}
              {countries.map((c) => (
                <Chip key={c} size="small" label={<span><b>Country:</b> {countryName(c)}</span>} onDelete={() => toggleCountry(c)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.green.fg } }} />
              ))}
              <Button size="small" onClick={() => { setCountries([]); setChosenWin(null); }} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <Figures views={views} countries={countries} />
        </Box>
      </Box>

      {/* the tabs, and at their right end the Filters button - as on Who are our customers */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="reach" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id === "countries" && countries.length ? String(countries.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="reach" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="reach-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {kpis.length > 0 && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>{kpis}</Box>
      )}
      {tab === "ads" && <Roas live={live} win={win} actions={act("roas", "Return on ad spend by channel, and SEO")} />}
      {tab === "ads" && <SeaNetworks live={live} win={win} actions={act("google-networks", "Google Ads by network")} />}
      {tab === "ads" && (() => {
        // Microsoft Ads: what GA4 sees of it, and the account's own impressions, clicks and cost from the script's sheet
        const fromSheet = waiting.R01M ? [] : MICROSOFT_TYPED.filter((id) => views[id]?.series.months.some((x) => x != null) || views[id]?.series.py.some((x) => x != null));
        const liveCards = MICROSOFT_LIVE.map(card).filter(Boolean);
        const ms = live.breakdowns.msAds;
        return (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 0.5 }}>
              <Badge icon={<AdsClickIcon />} tint="blue" size={30} />
              <Box>
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>Microsoft Ads</Typography>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                  Visits, orders and revenue as GA4 sees them; impressions, clicks and cost from the account itself, sent by a script in Microsoft Advertising every morning
                  {ms?.through ? ` - counted up to ${ms.through}` : ""}
                  {ms?.costPartial ? " - the cost leaves out accounts in another currency" : ""}
                </Typography>
              </Box>
            </Box>
            {liveCards.length > 0 && <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>{liveCards}</Box>}
            {/* a script that stopped writing must not pass for figures that are current (the shelf lesson, 14.10) */}
            {ms?.stale && fromSheet.length > 0 && (
              <GlassCard sx={{ py: 1.25, border: `1px solid ${RED}` }}>
                <Typography sx={{ fontSize: "0.86rem", color: RED, fontWeight: 600 }}>
                  The Microsoft Advertising script has not written since {ms.written ? ms.written.slice(0, 10) : "it was set up"} - these figures stop there. Check the script&apos;s runs in Microsoft Advertising (Tools → Scripts).
                </Typography>
              </GlassCard>
            )}
            {fromSheet.length > 0
              ? <>
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>{fromSheet.map(card)}</Box>
                <MsKinds live={live} win={win} actions={act("microsoft-kinds", "Microsoft Ads by campaign type")} />
              </>
              : (
                <BeingBuilt id="R01M" icon={<AdsClickIcon />} title="Microsoft Ads impressions, clicks and cost"
                  shows="Impressions, clicks and cost of every campaign in the Microsoft Advertising account, by month, this year against last."
                  from="Microsoft Advertising - a script in the account writes them to a Google Sheet every morning; the hub reads the sheet."
                  waits={waiting.R01M ? "The Google Sheet the Microsoft Advertising script writes to - being set up." : "The script's first run: it writes the months to the sheet every morning."}
                  meanwhile="Visits, orders and revenue from Microsoft Ads already come from GA4, above." />
              )}
          </>
        );
      })()}
      {tab === "countries" && views.R09 && (live.breakdowns.searchCountryMonths
        ? <CountryVisibility live={live} v={views.R09} win={win} chosen={countries} actions={kpiActs("R09", views.R09)} />
        : card("R09"))}
      {tab === "countries" && (live.breakdowns.searchCountries.length > 0 || live.breakdowns.searchCountryMonths) && <SearchCountries live={live} win={win} chosen={countries} onPick={toggleCountry} actions={act("search-countries", "Search visibility by country")} />}
      {/* where we stand against the sites the assistants rely on, then each assistant (SARCLA 18.10) */}
      {tab === "ai" && state.aeoCited && <CitedSitesCard data={state.aeoCited} />}
      {tab === "ai" && (state.aeoAssistants ? <ByAssistant w={state.aeoAssistants} /> : null)}
      {tab === "email" && waiting.R11 && (
        <BeingBuilt id="R11" icon={<MailOutlineIcon />}
          waits="HubSpot to let the hub's app read the marketing email statistics - the read-only permission is not offered to this app yet."
          meanwhile="HubSpot's own email reports; the hub fills this tab by itself once the permission is there." />
      )}
      {tab === "linkedin" && (
        <BeingBuilt id="R12" icon={<LinkedInIcon />}
          waits="LinkedIn's approval of its page statistics API (Community Management) for the company page, then one sign-in by a page admin."
          meanwhile="LinkedIn's own page export (Analytics → Export) can be uploaded here once a month - send one export to set it up." />
      )}
      {tab === "customers" && <SearchCustomersCard />}
      {tab !== "search" && tab !== "countries" && countries.length > 0 && (
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>The country choice narrows the Search Console figures (Search and Countries); ads, AI answers, email and customers are for every country.</Typography>
      )}

      {/* every Reach KPI has its tab now - email and LinkedIn as "being built"; anything else not connected is still listed */}
      <NotConnected list={missing.filter((k) => !["R11", "R11O", "R11C", "R12"].includes(k.id))} />
      <LiveNote state={state} typed={false} sources="Search Console, GA4 (Google Ads, Microsoft Ads visits), HubSpot's AEO and email, and the Microsoft Advertising script" />

      <FilterPanel id="reach-filters" open={panel} onClose={() => setPanel(false)}
        subtitle={chosenCount ? `${chosenCount} chosen - click again to let one go` : "The months, and the countries for Search Console"}
        onClearAll={chosenCount ? () => { setCountries([]); setChosenWin(null); } : undefined}
        chips={chosenCount ? <>
          {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.blue.bg, color: INK }} />}
          {countries.map((c) => <Chip key={c} size="small" label={<span><b>Country:</b> {countryName(c)}</span>} onDelete={() => toggleCountry(c)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT.green.bg, color: INK }} />)}
        </> : null}>
        <FilterSection id="reach-filter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!shut.period} onFlip={() => setShut((x) => ({ ...x, period: !x.period }))} summary={`${monthsLabel(win)} ${year}`} chosen={!isDefault}>
          <PeriodPicker done={done} win={win} onChange={(w) => setChosenWin(w)} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
            Against the same months of {year - 1} · whole months only. The AI answers are always the last 30 days.
          </Typography>
        </FilterSection>
        <FilterSection id="reach-filter-country" index={1} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!shut.country} onFlip={() => setShut((x) => ({ ...x, country: !x.country }))}
          summary={!countries.length ? "All" : countries.length === 1 ? countryName(countries[0]) : `${countries.length} chosen`} chosen={countries.length > 0}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 0.75, lineHeight: 1.45 }}>
            Narrows Search Console&apos;s impressions, clicks and click rate. Ads, AI answers and email are for every country.
          </Typography>
          <CountryPicker live={live} win={win} chosen={countries} onPick={toggleCountry} />
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}
