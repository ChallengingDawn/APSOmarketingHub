"use client";
// MARKETING KPIS - THE MACRO VIEW OF THE CUSTOMER JOURNEY (SARCLA 12.10:
// "big placeholders with real graphs, then we drill down"; "we need to have
// them all"; "first the macro and then drilled down to each one of them";
// "don't open a modal, send to the sub-app"). 13.10: drawn as the UC apps are -
// a glass card per stage with its glyph badge, each KPI a tile with its badge,
// its figure and its months; the full width; the stage's title is the way in.
// 18.10: every tile carries the toolbar (tasks, Scroll to Sale tickets, demote); a demoted tile
// leaves the nutshell for its tab only, a promoted card shows in "Promoted" at the top (tiles/*).

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import UpcomingIcon from "@mui/icons-material/Upcoming";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";

import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { BarList } from "@/app/charts/BarList";
import { Badge, CardTitle, FAINT, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ADDITIONAL_TRACKING, JOURNEY, KPIS, PLANNED, STAGES, type KpiStage } from "@/lib/marketingKpis/catalogue";
import { fmtValue } from "@/lib/marketingKpis/measures";
import type { LiveKpis } from "@/lib/marketingKpis/live";
import {
  Compare, LiveNote, MiniBars, StageGlyph, buildViews, isMeasured, nameOf, periodOf, stageKpis,
  stageHref, stageTint, upToOf, useMarketingKpis, type KpiView, type MkState,
} from "./data";
import { CustomersSummary } from "./Customers";
import { SearchCustomersCard } from "./SearchCustomers";
import { TileActions } from "./tiles/TileActions";
import { LinkCard, rendererOf } from "./tiles/registry";
import { kpiSummary } from "./tiles/summary";
import { placementOf, useActions, type ActionsState } from "./tiles/store";

const TILES = "repeat(auto-fill, minmax(min(100%, 228px), 1fr))";

/** One KPI as the UC apps draw a headline: badge, name, the figure, the comparison - and its months. */
function KpiTileChart({ v, slug, tint, upTo, actions }: { v: KpiView; slug: string; tint: Tint; upTo: string; actions?: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1.1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Badge icon={<StageGlyph slug={slug} />} tint={tint} size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25, flex: 1, minWidth: 0 }}>{nameOf(v.id)}</Typography>
      </Box>
      {actions && <Box sx={{ display: "flex", justifyContent: "flex-end", mt: -0.5 }}>{actions}</Box>}
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{periodOf(v)}</Typography>
      </Box>
      <Compare v={v} size="0.78rem" />
      <Box sx={{ mt: "auto", pt: 0.5 }}>
        {v.measure.agg.kind === "ytd" ? (
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

/** Traffic origin, the graph the visit stage carries beside its KPIs. */
function TrafficOrigin({ live }: { live: LiveKpis }) {
  const ch = live.breakdowns.channels;
  const total = ch.reduce((s, c) => s + c.sessions, 0) || 1;
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, minWidth: 0 }}>
      <CardTitle icon={<AltRouteIcon />} tint="blue" title="Traffic origin" note={`GA4 sessions by channel, ${live.year} so far`} />
      <BarList rows={ch.slice(0, 7).map((c) => ({ label: c.label, value: c.sessions, secondary: `${((c.sessions / total) * 100).toFixed(1)}%` }))} labelWidth={130} />
    </Box>
  );
}

/** A nutshell KPI tile's key - the same as on its page, so a move there is a move here. */
const kpiKey = (slug: string, id: string) => `${slug}::${id}`;

function KpiActions({ v, slug }: { v: KpiView; slug: string }) {
  return (
    <TileActions where="nutshell" start="nutshell"
      tile={{ key: kpiKey(slug, v.id), page: slug, kpiId: v.id, title: nameOf(v.id), summary: kpiSummary(v, periodOf(v)), kind: "kpi", href: stageHref(slug) }} />
  );
}

/** The cards promoted from the pages - every KPI already in its panel stays there. */
function Promoted({ views, state, acts }: { views: Record<string, KpiView>; state: MkState; acts: ActionsState | null }) {
  const year = new Date().getFullYear();
  const inPanels = new Set(STAGES.flatMap((st) => stageKpis(st.id, state.live?.value).ids.map((id) => kpiKey(st.slug, id))));
  const list = (acts?.placements ?? []).filter((p) => p.placement === "nutshell" && !inPanels.has(p.spec.key));
  if (!list.length) return null;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5 }}>
      <CardTitle icon={<VerticalAlignTopIcon />} tint="blue" title="Promoted" note="Brought here from the pages - demote one to send it back to its tab" />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: TILES }}>
        {list.map(({ spec }) => {
          const tint = stageTint(spec.page);
          const actions = <TileActions where="nutshell" start="tab" tile={{ key: spec.key, page: spec.page, tab: spec.tab, kpiId: spec.kpiId, title: spec.title, filters: spec.filters, from: spec.from, to: spec.to, href: spec.href, kind: spec.kind }} />;
          const v = spec.kind === "kpi" && spec.kpiId ? views[spec.kpiId] : undefined;
          if (v) return <KpiTileChart key={spec.key} v={v} slug={spec.page} tint={tint} upTo={upToOf(v, state, year)} actions={actions} />;
          const draw = rendererOf(spec.page);
          return <Box key={spec.key} sx={{ minWidth: 0 }}>{draw ? draw(spec) : <LinkCard spec={spec} actions={actions} />}</Box>;
        })}
      </Box>
    </GlassCard>
  );
}

function StagePanel({ s, views, state, acts }: { s: KpiStage; views: Record<string, KpiView>; state: MkState; acts: ActionsState | null }) {
  const live = state.live?.value;
  const year = new Date().getFullYear();
  const tint = stageTint(s.slug);
  const { ids, missing } = stageKpis(s.id, live);
  // a tile someone demoted lives on its tab only
  const tiles = ids.map((id) => views[id]).filter(Boolean).filter((v) => placementOf(acts, kpiKey(s.slug, v.id), "nutshell") === "nutshell");
  const all = KPIS.filter((k) => k.stage === s.id).length;
  const measured = KPIS.filter((k) => k.stage === s.id && isMeasured(k.id)).length;
  const geo = JOURNEY.some((j) => j.note === "GEO" && KPIS.find((k) => k.id === j.id)?.stage === s.id);
  const customers = s.slug === "customers";
  const traffic = s.slug === "visit" && !!live?.breakdowns.channels.length;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      {/* the stage, as a UC card title: badge, name (the way in), one line */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<StageGlyph slug={s.slug} size={22} />} tint={tint} size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={stageHref(s.slug)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT[tint].fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>{s.name}</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT[tint].fg, transition: "transform .15s ease" }} />
          </Box>
          {/* no stage number (SARCLA 17.10: "take out stage, there are no stages") - only what the section carries */}
          {(geo || s.note) && (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
              {[geo ? "+ GEO" : "", s.note ?? ""].filter(Boolean).join(" · ")}
            </Typography>
          )}
        </Box>
        {/* how far the stage is measured - gone once it is complete (SARCLA 17.10: "8 of 8 measured: it is complete, the indication should go") */}
        {measured < all && (
          <Box sx={{ minWidth: 170 }}>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
              <Box sx={{ width: `${all ? (measured / all) * 100 : 0}%`, height: "100%", bgcolor: TINT[tint].fg, borderRadius: 99 }} />
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.5, textAlign: "right" }}>{measured} of {all} KPIs measured</Typography>
          </Box>
        )}
      </Box>

      {customers ? (
        <CustomersSummary />
      ) : (tiles.length > 0 || traffic) ? (
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: TILES }}>
          {tiles.map((v) => <KpiTileChart key={v.id} v={v} slug={s.slug} tint={tint} upTo={upToOf(v, state, year)} actions={<KpiActions v={v} slug={s.slug} />} />)}
          {traffic && <Box sx={{ gridColumn: { sm: "span 2" }, minWidth: 0 }}><TrafficOrigin live={live!} /></Box>}
          {/* SEO and SEA in customers: new, reactivated, active (SARCLA 17.10) */}
          {s.slug === "reach" && <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}><SearchCustomersCard /></Box>}
        </Box>
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
  const year = new Date().getFullYear();
  const views = state?.inputs ? buildViews(state.inputs, state.live?.value, year) : null;
  const measured = KPIS.filter((k) => isMeasured(k.id)).length;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Digital Growth KPIs" subtitle={`Every KPI · ${year} · ${measured} of ${KPIS.length} measured`} />
      {!views && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!state?.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading the Digital Growth KPIs…"}</Typography>
        </Box></GlassCard>
      )}
      {views && state && (
        <>
          <Promoted views={views} state={state} acts={acts} />
          {STAGES.map((s) => <StagePanel key={s.id} s={s} views={views} state={state} acts={acts} />)}
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
