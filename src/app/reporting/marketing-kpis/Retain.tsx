"use client";
// RETAIN & GROW - EROSION AT STAKE (SARCLA 19.10.2026: "Retain and grow we should base on the erosion analysis
// Excel I did - can you build it with the main KPIs?"; he chose: erosion at stake, per customer and article, the
// best year 2021-2025 of EUR 2,500 or more against the last 12 months and the open orders). His Excel's
// SummaryView, live: by owner, customer, article, profit centre and country. Laid out as Lead Generation and
// the Hand-over: the title with its figures top right, tabs, the Filters window; every card is drawn from the
// read and the filters alone (CARDS), so a promoted one is the same graph in the nutshell (RetainPromoted).
// The rules are in retainCube.ts.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import WorkspacesOutlinedIcon from "@mui/icons-material/WorkspacesOutlined";

import { Badge, CardTitle, FAINT, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import {
  FLOOR, KINDS, STATES, eroding, keyCountry, keyCustomer, keyLast, keyOwner, keyPc, totalsBy, totalsOf,
  type LineView, type RFilters, type RetainData, type Totals,
} from "@/lib/marketingKpis/retainCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import { useSlow, type MkState } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { Table, n0 } from "./ExplorerKit";
import { HALF_ROWS, Pick } from "./Lead";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

type Tab = "owners" | "customers" | "articles" | "pcs" | "countries" | "since";
const TABS: { id: Tab; label: string }[] = [
  { id: "owners", label: "Owners" },
  { id: "customers", label: "Customers" },
  { id: "articles", label: "Articles" },
  { id: "pcs", label: "Profit centres" },
  { id: "countries", label: "Countries" },
  { id: "since", label: "Since when" },
];
const eur = (n: number | null | undefined) => (n == null ? "—" : `€${Math.round(n).toLocaleString("en")}`);
const ownerName = (d: RetainData, o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");
const customerName = (d: RetainData, u: string) => d.companies[u]?.n || `Customer ${u}`;
const yearsLabel = (d: RetainData) => `${d.years[0]}–${d.years[d.years.length - 1]}`;

/** The figures top right. */
function Figures({ t, lines }: { t: Totals; lines: number }) {
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; sub: string }[] = [
    { label: "At stake", icon: <TrendingDownOutlinedIcon />, tint: "amber", v: eur(t.gap), sub: `${eur(t.best)} in their best year, ${eur(t.now)} now` },
    { label: "Customers", icon: <StorefrontOutlinedIcon />, tint: "blue", v: n0(t.customers), sub: "buying an article below its best year" },
    { label: "Article lines", icon: <CategoryOutlinedIcon />, tint: "purple", v: n0(t.lines), sub: `of ${n0(lines)} with a best year of €${FLOOR.toLocaleString("en")} or more` },
    { label: "Stopped buying", icon: <BlockOutlinedIcon />, tint: "pink", v: eur(t.stoppedGap), sub: `${n0(t.stoppedLines)} lines: nothing in 12 months, no open order` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(130px, 180px))" } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{it.v}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the cards ─────────────────────────────────────────────────────────── */

type Ctx = {
  d: RetainData; f: RFilters; actions?: React.ReactNode;
  /** drawn at half width in the nutshell: the compact form (Lead's HALF_ROWS) */
  half?: boolean;
  onOwner?: (o: string) => void; onCountry?: (k: string) => void; onPc?: (p: string) => void;
};

const SUMMARY_HEAD = ["Customers", "Lines", "Best year", "Now", "At stake", "Of it stopped"];
const summaryCells = (t: Totals) => [n0(t.customers), n0(t.lines), eur(t.best), eur(t.now), eur(t.gap), eur(t.stoppedGap)];

/** At stake by a key, as bars - the most first; a click filters by it on the page. */
function BarsCard({ d, f, actions, half, title, note, icon, tint, by, labelOf, onPick, top, order }: Ctx & {
  title: string; note: string; icon: React.ReactNode; tint: Tint; by: (v: LineView) => string; labelOf: (k: string) => string; onPick?: (k: string) => void; top?: number;
  /** an order of its own (the years in time order) instead of the most at stake first */
  order?: (a: string, b: string) => number;
}) {
  const list = totalsBy(eroding(d, f), by).slice(0, top ?? 1000);
  if (order) list.sort((a, b) => order(a[0], b[0]));
  const rows = list.map(([k, t]) => ({ label: labelOf(k), value: t.gap, secondary: `${n0(t.customers)} customers` }));
  const max = rows[0]?.value;
  const pick = onPick ? (label: string) => { const hit = list.find(([k]) => labelOf(k) === label); if (hit) onPick(hit[0]); } : undefined;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={icon} tint={tint} title={title} note={note} right={actions} />
      <ChartFrame table={{ columns: ["", ...SUMMARY_HEAD], rows: list.map(([k, t]) => [labelOf(k), t.customers, t.lines, eur(t.best), eur(t.now), eur(t.gap), eur(t.stoppedGap)]), numeric: [1, 2] }}>
        {half
          ? <PagedBars rows={rows} max={max} />
          : <BarList rows={rows} format={eur} labelWidth={240} maxLabel={40} max={max} onSelect={pick} emptyMessage="Nothing at stake for this choice." />}
      </ChartFrame>
    </GlassCard>
  );
}

function PagedBars({ rows, max }: { rows: { label: string; value: number; secondary: string }[]; max?: number }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / HALF_ROWS)), at = Math.min(page, pages - 1);
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <BarList rows={rows.slice(at * HALF_ROWS, at * HALF_ROWS + HALF_ROWS)} format={eur} labelWidth={180} maxLabel={30} max={max} emptyMessage="Nothing at stake for this choice." />
      {pages > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{at * HALF_ROWS + 1}–{Math.min(rows.length, (at + 1) * HALF_ROWS)} of {rows.length}</Typography>
          <Button size="small" disabled={at === 0} onClick={() => setPage(at - 1)} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Previous</Button>
          <Button size="small" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Next</Button>
        </Box>
      )}
    </Box>
  );
}

/** By owner in figures - the Excel's SummaryView. */
function OwnerTableCard({ d, f, actions, half, onOwner }: Ctx) {
  const list = totalsBy(eroding(d, f), keyOwner(d));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="By owner - the figures" note={`The customer's owner in HubSpot today · best year ${yearsLabel(d)} against the last 12 months and the open orders${onOwner ? " · click a row to filter by it" : ""}`} right={actions} />
      <Table head={half ? ["Owner", "Customers", "At stake", "Of it stopped"] : ["Owner", ...SUMMARY_HEAD]} pageSize={half ? HALF_ROWS : 20}
        rows={list.map(([o, t]) => ({ key: o || "none", on: !!f.owner?.includes(o), onPick: onOwner ? () => onOwner(o) : undefined, cells: half ? [ownerName(d, o), n0(t.customers), eur(t.gap), eur(t.stoppedGap)] : [ownerName(d, o), ...summaryCells(t)] }))} />
    </GlassCard>
  );
}

function CustomerCard({ d, f, actions, half }: Ctx) {
  const list = totalsBy(eroding(d, f), keyCustomer());
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<StorefrontOutlinedIcon />} tint="blue" title="The customers with the most at stake" note={`Each customer's article lines below their best year ${yearsLabel(d)}, summed`} right={actions} />
      <Table head={half ? ["Customer", "Lines", "At stake"] : ["Customer", "Owner", "Country", "Lines", "Best year", "Now", "At stake", "Of it stopped"]} left={half ? [] : [1, 2]} pageSize={half ? HALF_ROWS : 15}
        widths={half ? undefined : ["minmax(120px, 1fr)", "minmax(90px, 0.8fr)", "70px", "110px", "110px", "110px", "110px"]}
        rows={list.map(([u, t]) => {
          const c = d.companies[u];
          return { key: u, cells: half ? [customerName(d, u), n0(t.lines), eur(t.gap)] : [customerName(d, u), ownerName(d, c?.o ?? ""), c?.k ?? "Unknown", n0(t.lines), eur(t.best), eur(t.now), eur(t.gap), eur(t.stoppedGap)] };
        })} />
    </GlassCard>
  );
}

function ArticleCard({ d, f, actions, half }: Ctx) {
  const list = eroding(d, f);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="The article lines with the most at stake" note={`A customer and an article: its best year ${yearsLabel(d)}, the last 12 months, the open orders - the lines of the erosion Excel`} right={actions} />
      <Table head={half ? ["Article", "Customer", "At stake"] : ["Article", "Customer", "Profit centre", "Best year", "Last 12 months", "Open orders", "At stake"]} left={half ? [1] : [1, 2]} pageSize={half ? HALF_ROWS : 15}
        widths={half ? undefined : ["minmax(140px, 1.2fr)", "90px", "130px", "120px", "110px", "110px"]}
        rows={list.map((v) => {
          const art = d.articles[v.a];
          const name = <span title={artText(art?.t)}><b>{v.a}</b>{art?.t ? <Box component="span" sx={{ color: MUTED }}> · {artText(art.t)}</Box> : null}</span>;
          return { key: `${v.u}|${v.a}`, cells: half ? [name, customerName(d, v.u), eur(v.gap)] : [name, customerName(d, v.u), art?.p || "—", `${eur(v.best)} (${v.bestYear})`, eur(v.l), eur(v.o), eur(v.gap)] };
        })} />
    </GlassCard>
  );
}

/** The years in time order, the last 12 months after them. */
const sinceOrder = (a: string, b: string) => {
  const r = (k: string) => (k.startsWith("Last bought in ") ? Number(k.slice(15)) : k === "In the last 12 months" ? 9998 : 9999);
  return r(a) - r(b);
};
/** The ERP's article text without its trailing " -". */
const artText = (t: string | undefined) => (t ?? "").replace(/\s*-\s*$/, "");

/** Every card of the page by its key "<tab>:<card>" - the page draws them, and so does the nutshell. */
const CARDS: Record<string, { title: string; draw: (c: Ctx) => React.ReactNode }> = {
  "owners:gap": { title: "At stake by owner", draw: (c) => <BarsCard {...c} title="At stake by owner" note={`What each owner's customers bought less than in their best year ${yearsLabel(c.d)}, or stopped buying · the owner in HubSpot today${c.onOwner ? " · click one to filter by it" : ""}`} icon={<GroupsOutlinedIcon />} tint="purple" by={keyOwner(c.d)} labelOf={(o) => ownerName(c.d, o)} onPick={c.onOwner} /> },
  "owners:table": { title: "By owner - the figures", draw: (c) => <OwnerTableCard {...c} /> },
  "customers:table": { title: "The customers with the most at stake", draw: (c) => <CustomerCard {...c} /> },
  "articles:table": { title: "The article lines with the most at stake", draw: (c) => <ArticleCard {...c} /> },
  "pcs:gap": { title: "At stake by profit centre", draw: (c) => <BarsCard {...c} title="At stake by profit centre" note={`The article's profit centre${c.onPc ? " · click one to filter by it" : ""}`} icon={<WorkspacesOutlinedIcon />} tint="green" by={keyPc(c.d)} labelOf={(p) => p} onPick={c.onPc} /> },
  // since when: half of the first read's gap sat on lines last bought in 2021-2023 - lost long ago, not eroding now
  "since:gap": { title: "At stake by when it was last bought", draw: (c) => <BarsCard {...c} title="At stake by when it was last bought" note="A line bought in the last 12 months is eroding now; one last bought years ago was lost then · choose recurring or one-off in Filters" icon={<TrendingDownOutlinedIcon />} tint="amber" by={keyLast()} labelOf={(k) => k} order={sinceOrder} /> },
  "since:kind": { title: "Recurring or one-off", draw: (c) => <BarsCard {...c} title="Recurring or one-off" note="Recurring = bought in two of the five years or more; a one-off is a single year's order - a project, a made-to-order part" icon={<CategoryOutlinedIcon />} tint="purple" by={(v) => (v.recurring ? "Recurring" : "One-off")} labelOf={(k) => k} /> },
  "countries:gap": { title: "At stake by country", draw: (c) => <BarsCard {...c} title="At stake by country" note={`The customer's country - the 20 with the most at stake${c.onCountry ? " · click one to filter by it" : ""}`} icon={<PublicOutlinedIcon />} tint="green" by={keyCountry(c.d)} labelOf={(k) => k} onPick={c.onCountry} top={20} /> },
};

// The nutshell's cards share one read; asked again every 20 s while HubSpot is read again.
const shared: { v: RetainData | null; p: Promise<void> | null; again: boolean; subs: Set<() => void> } = { v: null, p: null, again: false, subs: new Set() };
function loadShared() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/retain").then((r) => r.json())
    .then((j) => { const v = j?.retain?.value as RetainData | undefined; if (v) shared.v = v; shared.again = !!j?.retain?.computing; }).catch(() => {})
    .finally(() => { shared.p = null; shared.subs.forEach((f) => f()); if (!shared.v || shared.again) setTimeout(() => { if (shared.subs.size) loadShared(); }, 20_000); });
}
function useSharedRetain(): RetainData | null {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); shared.subs.add(f); if (!shared.v) loadShared(); return () => { shared.subs.delete(f); }; }, []);
  return shared.v;
}

/** The card the nutshell's Retain & grow panel starts with (demotable). */
export const RETAIN_NUTSHELL_CARDS = [{ key: "retain:owners:gap", title: "At stake by owner" }];

/** A Retain & grow card promoted to the nutshell - the same graph as on the page, with its filters. */
export function RetainPromoted({ spec, actions, half }: { spec: TileSpec; actions: React.ReactNode; half?: boolean }) {
  const d = useSharedRetain();
  const [, tab, card] = spec.key.split(":");
  const c = CARDS[`${tab}:${card}`];
  if (!d || !c) {
    return <GlassCard><CardTitle icon={<TrendingDownOutlinedIcon />} tint="amber" title={c?.title ?? spec.title} note={d ? "This card is no longer on its page." : "Reading the orders…"} right={actions} /></GlassCard>;
  }
  const ff = spec.filters ?? {};
  return <>{c.draw({ d, f: { owner: ff.owner, country: ff.country, pc: ff.pc, state: ff.state, kind: ff.kind }, actions, half })}</>;
}

export function RetainExplorer({ state }: { state: MkState | null }) {
  void state;
  const params = useSearchParams();
  const ld = useSlow<RetainData>("/api/reporting/marketing-kpis/retain", "retain");
  const d = ld.value;
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "owners"));
  const pick = (k: string) => params.getAll(k);
  const [owners, setOwners] = useState<string[]>(() => pick("owner"));
  const [countries, setCountries] = useState<string[]>(() => pick("country"));
  const [pcs, setPcs] = useState<string[]>(() => pick("pc"));
  const [states, setStates] = useState<string[]>(() => pick("state"));
  const [kinds, setKinds] = useState<string[]>(() => pick("kind"));
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== "owners") q.set("tab", tab);
    for (const [k, xs] of [["owner", owners], ["country", countries], ["pc", pcs], ["state", states], ["kind", kinds]] as const) for (const x of xs) q.append(k, x);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, owners, countries, pcs, states, kinds]);

  const f: RFilters = { owner: owners, country: countries, pc: pcs, state: states, kind: kinds };
  const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const t = useMemo(() => (d ? totalsOf(eroding(d, f)) : null), [d, owners, countries, pcs, states, kinds]); // eslint-disable-line react-hooks/exhaustive-deps
  // the choices in the Filters window: what has something at stake, the most first
  const options = useMemo(() => {
    if (!d) return null;
    const all = eroding(d, {});
    return { owners: totalsBy(all, keyOwner(d)).map(([k]) => k), countries: totalsBy(all, keyCountry(d)).map(([k]) => k), pcs: totalsBy(all, keyPc(d)).map(([k]) => k) };
  }, [d]);
  const chosenCount = owners.length + countries.length + pcs.length + states.length + kinds.length;
  const filters = Object.fromEntries(([["owner", owners], ["country", countries], ["pc", pcs], ["state", states], ["kind", kinds]] as const).filter(([, xs]) => xs.length)) as Record<string, string[]>;
  const clearAll = () => { setOwners([]); setCountries([]); setPcs([]); setStates([]); setKinds([]); };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start={RETAIN_NUTSHELL_CARDS.some((x) => x.key === `retain:${tab}:${key}`) ? "nutshell" : "tab"}
      tile={{ key: `retain:${tab}:${key}`, page: "retain", tab, title, summary: t ? `${eur(t.gap)} at stake, ${n0(t.customers)} customers` : undefined, filters, kind: "card" }} />
  );

  if (!d || !t || !options) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!ld.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: ld.error ? RED : MUTED }}>{ld.error ? `Could not load: ${ld.error}` : `Reading the orders since ${new Date().getFullYear() - 5}… a quarter of an hour the first time${ld.progress ? ` · ${ld.progress}` : ""}`}</Typography>
      </Box></GlassCard>
    );
  }
  const ctx: Ctx = { d, f, onOwner: (o) => setOwners(flip(owners, o)), onCountry: (k) => setCountries(flip(countries, k)), onPc: (p) => setPcs(flip(pcs, p)) };
  const card = (key: string) => {
    const c = CARDS[`${tab}:${key}`];
    return c ? <Box key={key} sx={{ minWidth: 0, display: "grid" }}>{c.draw({ ...ctx, actions: act(key, c.title) })}</Box> : null;
  };

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Retain &amp; grow
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>Erosion at stake</b> on {new Date(d.asOf).toLocaleDateString("en-GB")} · what each customer bought of an article in its best year {yearsLabel(d)}, against the last 12 months and the open orders - the lines of €{FLOOR.toLocaleString("en")} or more in their best year, as the erosion analysis of February 2025{ld.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {owners.map((x) => <Chip key={x} size="small" label={<span><b>Owner:</b> {ownerName(d, x)}</span>} onDelete={() => setOwners(flip(owners, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {countries.map((x) => <Chip key={x} size="small" label={<span><b>Country:</b> {x}</span>} onDelete={() => setCountries(flip(countries, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              {pcs.map((x) => <Chip key={x} size="small" label={<span><b>Profit centre:</b> {x}</span>} onDelete={() => setPcs(flip(pcs, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              {kinds.map((x) => <Chip key={x} size="small" label={KINDS.find((k) => k.id === x)?.label ?? x} onDelete={() => setKinds(flip(kinds, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {states.map((x) => <Chip key={x} size="small" label={STATES.find((s) => s.id === x)?.label ?? x} onDelete={() => setStates(flip(states, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />)}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures t={t} lines={d.lines.length} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <ReportTabs name="retain" tab={tab} onSelect={setTab} tabs={TABS.map((x) => ({ id: x.id, label: x.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="retain" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="retain-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {tab === "owners" && <>{card("gap")}{card("table")}</>}
      {tab === "customers" && card("table")}
      {tab === "articles" && card("table")}
      {tab === "pcs" && card("gap")}
      {tab === "countries" && card("gap")}
      {tab === "since" && <>{card("gap")}{card("kind")}</>}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - {n0(d.orders)} order documents since January {d.years[0]}{d.readAt ? `, last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 24 hours. Money is what was invoiced (the order as placed and its invoiced deliveries are never both counted); credit notes are left out; a line&apos;s year is its invoice&apos;s. Open orders: ordered and not invoiced yet, for orders of the last two years. {n0(d.noCustomer)} documents without a customer number (web orders the ERP has not numbered yet) are not in it.
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="retain-filters" open={panel} onClose={() => setPanel(false)} subtitle="The owner, the country, the profit centre, stopped or buying less, recurring or one-off" onClearAll={chosenCount ? clearAll : undefined}>
        <FilterSection id="rt-f-owner" index={0} title="Owner" icon={<GroupsOutlinedIcon />} tint="purple" open={!!open.owner} onFlip={() => setOpen((o) => ({ ...o, owner: !o.owner }))} summary={owners.length ? `${owners.length} chosen` : "All"} chosen={owners.length > 0}>
          {options.owners.map((o) => <Pick key={o || "none"} on={owners.includes(o)} label={ownerName(d, o)} onClick={() => setOwners(flip(owners, o))} />)}
        </FilterSection>
        <FilterSection id="rt-f-country" index={1} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {options.countries.map((k) => <Pick key={k} on={countries.includes(k)} label={k} onClick={() => setCountries(flip(countries, k))} />)}
        </FilterSection>
        <FilterSection id="rt-f-pc" index={2} title="Profit centre" icon={<WorkspacesOutlinedIcon />} tint="amber" open={!!open.pc} onFlip={() => setOpen((o) => ({ ...o, pc: !o.pc }))} summary={pcs.length ? pcs.join(", ") : "All"} chosen={pcs.length > 0}>
          {options.pcs.map((p) => <Pick key={p} on={pcs.includes(p)} label={p} onClick={() => setPcs(flip(pcs, p))} />)}
        </FilterSection>
        <FilterSection id="rt-f-state" index={3} title="Stopped or buying less" icon={<BlockOutlinedIcon />} tint="pink" open={!!open.state} onFlip={() => setOpen((o) => ({ ...o, state: !o.state }))} summary={states.length ? `${states.length} chosen` : "Both"} chosen={states.length > 0}>
          {STATES.map((s) => <Pick key={s.id} on={states.includes(s.id)} label={s.label} note={s.id === "stopped" ? "nothing in 12 months, no open order" : "still buying, below the best year"} onClick={() => setStates(flip(states, s.id))} />)}
        </FilterSection>
        <FilterSection id="rt-f-kind" index={4} title="Recurring or one-off" icon={<CategoryOutlinedIcon />} tint="purple" open={!!open.kind} onFlip={() => setOpen((o) => ({ ...o, kind: !o.kind }))} summary={kinds.length ? `${kinds.length} chosen` : "Both"} chosen={kinds.length > 0}>
          {KINDS.map((k) => <Pick key={k.id} on={kinds.includes(k.id)} label={k.label} note={k.note} onClick={() => setKinds(flip(kinds, k.id))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}
