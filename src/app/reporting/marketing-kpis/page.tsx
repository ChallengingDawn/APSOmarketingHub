"use client";
// MARKETING KPIS - THE MACRO VIEW OF THE CUSTOMER JOURNEY (SARCLA 12.10:
// "big placeholders with real graphs, then we drill down"; "we need to have
// them all"; "first the macro and then drilled down to each one of them";
// "don't open a modal, send to the sub-app"). 13.10: drawn as the UC apps are -
// a glass card per stage with its glyph badge, each KPI a tile with its badge,
// its figure and its months; the full width; the stage's title is the way in.
// 18.10: every tile carries the toolbar (tasks, Scroll to Sale tickets, demote); a demoted tile
// leaves the nutshell for its tab only, a promoted card shows in "Promoted" at the top (tiles/*).
// 19.10: hold the mouse on a tile and drag it to its place in the panel - one order for everyone (tiles/SortableGrid).

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import UpcomingIcon from "@mui/icons-material/Upcoming";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ADDITIONAL_TRACKING, KPIS, PLANNED, STAGES, type KpiStage } from "@/lib/marketingKpis/catalogue";
import { fmtValue } from "@/lib/marketingKpis/measures";
import {
  Compare, LiveNote, MiniBars, StageGlyph, buildViews, isMeasured, nameOf, periodOf, stageKpis,
  stageHref, stageTint, upToOf, useMarketingKpis, type KpiView, type MkState,
} from "./data";
import { CustomersPromoted, CustomersSummary } from "./Customers";
import { ReachPromoted } from "./Reach";
import { LEAD_NUTSHELL_TILES, LeadPromoted } from "./Lead";
import { SearchCustomersCard } from "./SearchCustomers";
import { TileActions } from "./tiles/TileActions";
import { LinkCard, rendererOf } from "./tiles/registry";
import { kpiSummary } from "./tiles/summary";
import { WithActions } from "./tiles/WithActions";
import { stageName } from "@/lib/marketingKpis/stageNames";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "./tiles/store";
import type { TileFormat } from "@/lib/reporting/kpiActions";
import { SortableGrid, type SortItem } from "./tiles/SortableGrid";
import { VISIT_NAMES, useVisitData } from "./VisitCompact";
import { fullCardFor, tileChartFor } from "./FullCards";
import type { VisitData } from "@/lib/marketingKpis/visitCube";

/**
 * One grid for a panel's tiles and cards, twelve columns: a tile takes two on a wide screen (six to a
 * row), a half-width card six, a whole-width card all of them - packed "dense", so a half-width card
 * moves up beside the tiles when their row has room (SARCLA 19.10: "half width should also fit the
 * first row if there is space").
 */
const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row dense" } as const;
const TILE_SPAN = { gridColumn: { xs: "span 12", sm: "span 6", md: "span 4", lg: "span 3", xl: "span 2" } };
const HALF_SPAN = { gridColumn: { xs: "span 12", md: "span 6" } };
const FULL_SPAN = { gridColumn: "1 / -1" };

/** One KPI as the UC apps draw a headline: badge, name, the figure, the comparison - and its months. */
function KpiTileChart({ v, slug, tint, upTo, actions, chart, title }: {
  v: KpiView; slug: string; tint: Tint; upTo: string; actions?: React.ReactNode;
  /** the graph its card on the page draws, small (SARCLA 19.10: "the same graph in both levels") - else its months */
  chart?: React.ReactNode;
  /** the page's own name for the KPI, when it has one */
  title?: string;
}) {
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1.1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Badge icon={<StageGlyph slug={slug} />} tint={tint} size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25, flex: 1, minWidth: 0, pt: 0.75 }}>{title ?? nameOf(v.id)}</Typography>
        {actions}
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{periodOf(v)}</Typography>
      </Box>
      <Compare v={v} size="0.78rem" />
      <Box sx={{ mt: "auto", pt: 0.5 }}>
        {chart ? chart : v.measure.agg.kind === "ytd" ? (
          // a count for the year so far: this year against last year whole, as two bars
          <Box sx={{ display: "grid", gap: 0.6 }}>
            {([["This year so far", v.ytd, TINT[tint].fg], [v.pyNote ?? "Last year", v.pyYtd, "#d3d8e0"]] as const).map(([label, x, color]) => {
              const max = Math.max(v.ytd ?? 0, v.pyYtd ?? 0) || 1;
              return (
                <Box key={label}>
                  <Typography sx={{ fontSize: "0.68rem", color: FAINT, mb: 0.25 }}>{label}</Typography>
                  <Box sx={{ height: 12, borderRadius: 99, bgcolor: color, width: `${((x ?? 0) / max) * 100}%`, minWidth: 4 }} />
                </Box>
              );
            })}
          </Box>
        ) : (
          <MiniBars v={v} />
        )}
      </Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: FAINT, borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75 }}>{upTo}</Typography>
    </Box>
  );
}

/** A nutshell KPI tile's key - the same as on its page, so a move there is a move here. */
const kpiKey = (slug: string, id: string) => `${slug}::${id}`;

function KpiActions({ v, slug, card = false }: { v: KpiView; slug: string; card?: boolean }) {
  return (
    <TileActions where="nutshell" start="nutshell" {...(card ? {} : { edge: 2.25 })}
      tile={{ key: kpiKey(slug, v.id), page: slug, kpiId: v.id, title: nameOf(v.id), summary: kpiSummary(v, periodOf(v)), kind: "kpi", href: stageHref(slug) }} />
  );
}

/** The cards the nutshell draws on its own, from the start - not "promoted" (the traffic origin card is gone,
 *  SARCLA 19.10: "take out completely" - its key stays here so an old placement row draws nothing). */
const OWN = new Set(["customers::summary", "visit::traffic-origin", "visit:customers:unlinked", "reach:customers:search-customers"]); // the last two Visit ones are gone (SARCLA 19.10) - kept so an old placement row draws nothing

/**
 * What was promoted from a page into its own panel (SARCLA 18.10: "they should go into their
 * placeholder"): a KPI joins the panel's tiles, a chart or a table takes a whole row of it - drawn
 * as it is on its page (Reach and Who are our customers draw theirs; another page's shows the way to it).
 */
/** A row of the panel: half its width, or the whole of it. */
const row = (key: string, node: React.ReactNode, format: TileFormat): SortItem => ({ key, node, sx: format === "half" ? HALF_SPAN : FULL_SPAN });

function promotedOf(slug: string, ids: string[], views: Record<string, KpiView>, state: MkState, acts: ActionsState | null) {
  const year = new Date().getFullYear();
  const own = new Set([...ids.map((id) => kpiKey(slug, id)), ...OWN, ...(slug === "lead" ? LEAD_NUTSHELL_TILES.map((t) => t.key) : [])]);
  const list = (acts?.placements ?? []).filter((p) => p.placement === "nutshell" && p.spec.page === slug && !own.has(p.spec.key));
  const tiles: SortItem[] = [];
  const rows: SortItem[] = [];
  for (const { spec } of list) {
    const tile = { key: spec.key, page: spec.page, tab: spec.tab, kpiId: spec.kpiId, title: spec.title, filters: spec.filters, from: spec.from, to: spec.to, href: spec.href, kind: spec.kind };
    // a Lead Generation small graph joins the panel's tiles (SARCLA 19.10: "small graphs that we can bring to the nutshell")
    // how big someone chose it: a small tile, half or the whole width (SARCLA 19.10)
    const fmt = formatOf(acts, spec);
    if (spec.page === "lead" && /^lead:[a-z]+:tile:/.test(spec.key)) {
      if (fmt === "half") rows.push(row(spec.key, <LeadPromoted spec={spec} actions={<TileActions where="nutshell" start="tab" edge={2.25} tile={tile} />} />, fmt));
      else tiles.push({ key: spec.key, node: <LeadPromoted spec={spec} actions={<TileActions where="nutshell" start="tab" edge={2.25} tile={tile} />} /> });
      continue;
    }
    // a Lead Generation card is the same graph as on its page (SARCLA 19.10: "not all the promoted come here")
    if (spec.page === "lead") { rows.push(row(spec.key, <LeadPromoted spec={spec} actions={<TileActions where="nutshell" start="tab" tile={tile} />} />, fmt)); continue; }
    const v = spec.kind === "kpi" && spec.kpiId ? views[spec.kpiId] : undefined;
    // a KPI at half or the whole width is its page's card
    const full = v && fmt !== "tile" && spec.kpiId ? fullCardFor(spec.page, spec.kpiId, <TileActions where="nutshell" start="tab" tile={tile} />) : null;
    if (full) { rows.push(row(spec.key, full, fmt)); continue; }
    if (v) { tiles.push({ key: spec.key, node: <KpiTileChart v={v} slug={slug} tint={stageTint(slug)} upTo={upToOf(v, state, year)} actions={<TileActions where="nutshell" start="tab" edge={2.25} tile={tile} />} /> }); continue; }
    const draw = rendererOf(spec.page);
    rows.push(row(spec.key,
      spec.page === "reach" ? <ReachPromoted spec={spec} actions={<TileActions where="nutshell" start="tab" tile={tile} />} />
        : spec.page === "customers" ? <CustomersPromoted spec={spec} actions={<TileActions where="nutshell" start="tab" edge={2} tile={tile} />} />
          : draw ? draw(spec) : <LinkCard spec={spec} actions={<TileActions where="nutshell" start="tab" edge={2.25} tile={tile} />} />,
      fmt));
  }
  return { tiles, rows };
}

function StagePanel({ s, views, state, acts, visit }: { s: KpiStage; views: Record<string, KpiView>; state: MkState; acts: ActionsState | null; visit: VisitData | null }) {
  const live = state.live?.value;
  const year = new Date().getFullYear();
  const tint = stageTint(s.slug);
  // Lead Generation: the catalogue's three lead KPIs are gone (SARCLA 19.10: "they don't exist any more") -
  // the panel starts with the page's own month-by-month tiles instead
  const lead = s.slug === "lead";
  const catalogue = stageKpis(s.id, live);
  const ids = lead ? [] : catalogue.ids, missing = lead ? [] : catalogue.missing;
  // a tile someone demoted lives on its tab only
  const tiles = ids.map((id) => views[id]).filter(Boolean).filter((v) => placementOf(acts, kpiKey(s.slug, v.id), "nutshell") === "nutshell");
  const all = KPIS.filter((k) => k.stage === s.id).length;
  const measured = KPIS.filter((k) => k.stage === s.id && isMeasured(k.id)).length;
  const customers = s.slug === "customers";
  const promoted = promotedOf(s.slug, ids, views, state, acts);
  // a KPI someone chose to show as its page's full card leaves the tiles for the rows (SARCLA 19.10:
  // "the same dashboard that we push into the nutshell, even the small one, then we decide which format")
  const fullRows: SortItem[] = [];
  const small = tiles.filter((v) => {
    const fmt = formatOf(acts, { key: kpiKey(s.slug, v.id), kind: "kpi", kpiId: v.id });
    if (fmt === "tile") return true;
    const node = fullCardFor(s.slug, v.id, <KpiActions v={v} slug={s.slug} card />);
    if (!node) return true;
    fullRows.push(row(kpiKey(s.slug, v.id), node, fmt));
    return false;
  });
  // the Lead month tiles the panel starts with, at half width when someone chose it
  const leadTiles = lead ? LEAD_NUTSHELL_TILES.filter((t) => placementOf(acts, t.key, "nutshell") === "nutshell").map((t) => {
    const tile = { key: t.key, page: "lead", tab: "months", title: t.title, kind: "card" as const, href: stageHref("lead") };
    return { key: t.key, fmt: formatOf(acts, tile), node: <LeadPromoted spec={tile} actions={<TileActions where="nutshell" start="nutshell" edge={2.25} tile={tile} />} /> };
  }) : [];
  for (const t of leadTiles) if (t.fmt === "half") fullRows.push(row(t.key, t.node, "half"));
  const rows = [...fullRows, ...promoted.rows];
  // the panel's tiles, then its full-width cards, each in the order someone dragged them
  const items: SortItem[] = [
    // Visit's tiles draw their page's graphs, small (VisitCompact.tsx)
    ...small.map((v) => ({ key: kpiKey(s.slug, v.id), node: <KpiTileChart v={v} slug={s.slug} tint={tint} upTo={upToOf(v, state, year)} actions={<KpiActions v={v} slug={s.slug} />}
      chart={tileChartFor(s.slug, v.id, views, visit, live, year) ?? undefined} title={s.slug === "visit" ? VISIT_NAMES[v.id] : undefined} /> })),
    ...leadTiles.filter((t) => t.fmt !== "half").map((t) => ({ key: t.key, node: t.node })),
    ...promoted.tiles,
    // SEO and SEA in customers: new, reactivated, active (SARCLA 17.10)
    ...(s.slug === "reach" && placementOf(acts, "reach:customers:search-customers", "nutshell") === "nutshell" ? [{
      key: "reach:customers:search-customers", sx: FULL_SPAN,
      node: <WithActions where="nutshell" start="nutshell" tile={{ key: "reach:customers:search-customers", page: "reach", tab: "customers", title: "Customers from search", kind: "card", href: stageHref("reach") }}><SearchCustomersCard /></WithActions>,
    }] : []),
  ];
  // the tiles, then the half- and whole-width cards, in one grid; one order for all of them (the cards'
  // order was kept apart before - it still counts, after the tiles', until someone moves one)
  const grid: SortItem[] = [...items.map((it) => (it.sx ? it : { ...it, sx: TILE_SPAN })), ...rows];
  const order = [...new Set([...(acts?.orders?.[`nutshell:${s.slug}`] ?? []), ...(acts?.orders?.[`nutshell:${s.slug}-rows`] ?? [])])];
  const canMove = !!acts?.canWrite;
  const save = (scope: string) => (keys: string[]) => {
    void send("/api/reporting/kpi-actions/order", "POST", { scope, keys }).catch(() => {}).finally(() => { void refreshActions(); });
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      {/* the stage, as a UC card title: badge, name (the way in), one line */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<StageGlyph slug={s.slug} size={22} />} tint={tint} size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={stageHref(s.slug)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT[tint].fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>{stageName(s.slug, s.name)}</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT[tint].fg, transition: "transform .15s ease" }} />
          </Box>
          {/* no stage number (SARCLA 17.10: "take out stage, there are no stages") - only what the section carries */}
          {/* no "+ GEO" (SARCLA 18.10: "take out these tags") */}
          {s.note && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{s.note}</Typography>}
        </Box>
        {/* how far the stage is measured - gone once it is complete (SARCLA 17.10: "8 of 8 measured: it is complete, the indication should go") */}
        {!lead && measured < all && (
          <Box sx={{ minWidth: 170 }}>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
              <Box sx={{ width: `${all ? (measured / all) * 100 : 0}%`, height: "100%", bgcolor: TINT[tint].fg, borderRadius: 99 }} />
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.5, textAlign: "right" }}>{measured} of {all} KPIs measured</Typography>
          </Box>
        )}
      </Box>

      {customers ? (
        placementOf(acts, "customers::summary", "nutshell") === "nutshell"
          ? <WithActions where="nutshell" start="nutshell" tile={{ key: "customers::summary", page: "customers", title: "Our customers", kind: "card", href: stageHref("customers") }}><CustomersSummary /></WithActions>
          : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Moved to its page.</Typography>
      ) : grid.length > 0 ? (
        <SortableGrid items={grid} order={order} canMove={canMove} onMove={save(`nutshell:${s.slug}`)} sx={GRID} />
      ) : (
        <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing here is measured yet.</Typography>
      )}

      {missing.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", mr: 0.5 }}>Not connected yet</Typography>
          {missing.map((k) => (
            <Box key={`${k.id}-${k.name}`} component={Link} href={stageHref(s.slug)} sx={{ fontSize: "0.76rem", color: MUTED, textDecoration: "none", px: 1.1, py: 0.35, borderRadius: "999px", border: "1px dashed rgba(21,34,58,.2)", bgcolor: "rgba(255,255,255,.6)", "&:hover": { color: INK, borderColor: "rgba(21,34,58,.4)" } }}>
              {k.name}
            </Box>
          ))}
        </Box>
      )}
    </GlassCard>
  );
}

export default function MarketingKpisMacro() {
  const [state] = useMarketingKpis();
  const { state: acts } = useActions("nutshell");
  // the Visit page's read, so the Visit tiles draw the page's graphs (read once, shared with the page)
  const visit = useVisitData();
  const year = new Date().getFullYear();
  const views = state?.inputs ? buildViews(state.inputs, state.live?.value, year) : null;
  return (
    // no title and no "N of N measured" line: the panels straight away (SARCLA 18.10: "take out this on the nutshell, put directly the placeholders")
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {!views && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!state?.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading the Digital Growth KPIs…"}</Typography>
        </Box></GlassCard>
      )}
      {views && state && (
        <>
          {STAGES.map((s) => <StagePanel key={s.id} s={s} views={views} state={state} acts={acts} visit={visit.value} />)}
          {([["Additional tracking for the team - planned", ADDITIONAL_TRACKING], ["Also planned", PLANNED]] as const).filter(([, list]) => list.length).map(([title, list]) => (
            <GlassCard key={title}>
              <CardTitle icon={<UpcomingIcon />} tint="slate" title={title} />
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {list.map((t) => <Box key={t} sx={{ fontSize: "0.84rem", color: INK, px: 1.5, py: 0.75, borderRadius: "12px", bgcolor: "rgba(255,255,255,.8)", border: "1px dashed rgba(21,34,58,.18)" }}>{t}</Box>)}
              </Box>
            </GlassCard>
          ))}
          <LiveNote state={state} />
        </>
      )}
    </Box>
  );
}
