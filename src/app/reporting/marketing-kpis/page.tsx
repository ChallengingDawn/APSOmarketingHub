"use client";
// MARKETING KPIS - THE MACRO VIEW OF THE CUSTOMER JOURNEY (SARCLA 12.10:
// "big placeholders with real graphs, then we drill down"; "we need to have
// them all"; "first the macro and then drilled down to each one of them";
// "don't open a modal, send to the sub-app"). Every stage is a panel with a
// real chart for each KPI it measures and the ones it does not yet, named;
// its title opens the stage's own page.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import UpcomingIcon from "@mui/icons-material/Upcoming";

import PageHeader from "@/app/PageHeader";
import { BarList } from "@/app/charts/BarList";
import { FAINT, GlassCard, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { ADDITIONAL_TRACKING, JOURNEY, KPIS, PLANNED, STAGES, type KpiStage } from "@/lib/marketingKpis/catalogue";
import { MEASURES, fmtValue } from "@/lib/marketingKpis/measures";
import type { LiveKpis } from "@/lib/marketingKpis/live";
import {
  Compare, LiveNote, MiniBars, buildViews, journeyAdditionsIn, journeyExtrasIn, measuredIn, nameOf, notConnectedIn, periodOf, stageHref,
  useMarketingKpis, type KpiView,
} from "./data";

const TONES = [TINT.purple, TINT.blue, TINT.blue, TINT.green, TINT.amber, TINT.amber, TINT.pink, TINT.green, TINT.purple, TINT.slate];

/** One KPI on the macro page: its year so far, the comparison, and the months as a chart. */
function KpiTileChart({ v }: { v: KpiView }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "rgba(255,255,255,.78)", border: "1px solid rgba(255,255,255,.9)", display: "grid", gap: 0.75, alignContent: "start" }}>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{nameOf(v.id)}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "1.45rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{periodOf(v)}</Typography>
      </Box>
      <Compare v={v} size="0.74rem" />
      {v.measure.agg.kind === "ytd" ? (
        // a count for the year so far: this year against last year whole, as two bars
        <Box sx={{ display: "grid", gap: 0.5, mt: 0.5 }}>
          {([["This year so far", v.ytd, "#2d6fa8"], [v.pyNote ?? "Last year", v.pyYtd, "#c9cfd8"]] as const).map(([label, x, color]) => {
            const max = Math.max(v.ytd ?? 0, v.pyYtd ?? 0) || 1;
            return (
              <Box key={label}>
                <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>{label}</Typography>
                <Box sx={{ height: 12, borderRadius: "3px", bgcolor: color, width: `${((x ?? 0) / max) * 100}%`, minWidth: 2 }} />
              </Box>
            );
          })}
        </Box>
      ) : (
        <MiniBars v={v} />
      )}
    </Box>
  );
}

/** The graph a stage carries beyond its KPIs. */
function StageGraph({ slug, live }: { slug: string; live?: LiveKpis }) {
  if (!live) return null;
  const b = live.breakdowns;
  if (slug === "customers") {
    const prio = b.prio.filter((p) => (p.all ?? 0) > 0);
    if (!prio.length) return null;
    return (
      <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "rgba(255,255,255,.78)", height: "100%" }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, mb: 1 }}>Companies that bought in {live.year}, by sales priority</Typography>
        <BarList rows={prio.map((p) => ({ label: p.band, value: p.active, secondary: `of ${Math.round(p.all ?? 0).toLocaleString("en")}` }))} labelWidth={110} />
      </Box>
    );
  }
  if (slug === "visit" && b.channels.length) {
    const total = b.channels.reduce((s, c) => s + c.sessions, 0) || 1;
    return (
      <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "rgba(255,255,255,.78)", height: "100%" }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, mb: 1 }}>Traffic origin - GA4 sessions by channel, {live.year} so far</Typography>
        <BarList rows={b.channels.slice(0, 7).map((c) => ({ label: c.label, value: c.sessions, secondary: `${((c.sessions / total) * 100).toFixed(1)}%` }))} labelWidth={130} />
      </Box>
    );
  }
  return null;
}

function StagePanel({ s, i, views, live }: { s: KpiStage; i: number; views: Record<string, KpiView>; live?: LiveKpis }) {
  const tone = TONES[i];
  const ids = [...measuredIn(s.id).map((k) => k.id), ...journeyExtrasIn(s.id), ...(s.id === "7" ? ["X01"] : [])];
  const tiles = ids.map((id) => views[id]).filter(Boolean);
  const missing = [...notConnectedIn(s.id), ...journeyAdditionsIn(s.id)];
  const all = KPIS.filter((k) => k.stage === s.id).length;
  const measured = KPIS.filter((k) => k.stage === s.id && MEASURES[k.id] && !MEASURES[k.id].notCatalogue).length;
  const geo = JOURNEY.some((j) => j.note === "GEO" && KPIS.find((k) => k.id === j.id)?.stage === s.id);
  const graph = live && (s.slug === "customers" || (s.slug === "visit" && live.breakdowns.channels.length > 0));
  const short = s.name.replace(/\s*\(.*\)\s*$/, "");
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.25 }, background: `linear-gradient(170deg, ${tone.bg}, rgba(255,255,255,.72) 40%)`, display: "grid", gap: 1.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        <Box sx={{ width: 32, height: 32, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: tone.fg, color: "#fff", fontSize: "0.95rem", fontWeight: 800 }}>{s.id}</Box>
        <Box component={Link} href={stageHref(s.slug)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, textDecoration: "none", color: INK, "&:hover .chev": { transform: "translateX(3px)" } }}>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{s.name}</Typography>
          <ChevronRightIcon className="chev" sx={{ color: tone.fg, transition: "transform .15s ease" }} />
        </Box>
        {geo && <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, px: 0.9, py: 0.2, borderRadius: "999px", bgcolor: "rgba(255,255,255,.85)", color: tone.fg }}>+ GEO</Box>}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ minWidth: 150 }}>
          <Box sx={{ height: 5, borderRadius: 3, bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
            <Box sx={{ width: `${all ? (measured / all) * 100 : 0}%`, height: "100%", bgcolor: tone.fg }} />
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.4, textAlign: "right" }}>{measured} of {all} KPIs measured</Typography>
        </Box>
        <Box component={Link} href={stageHref(s.slug)} sx={{ fontSize: "0.82rem", fontWeight: 700, color: tone.fg, textDecoration: "none", whiteSpace: "nowrap" }}>Open {short} →</Box>
      </Box>
      {s.note && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -0.75 }}>Note: {s.note}</Typography>}
      {(tiles.length > 0 || graph) && (
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
          {tiles.map((v) => <KpiTileChart key={v.id} v={v} />)}
          {graph && <Box sx={{ gridColumn: { sm: "span 2" } }}><StageGraph slug={s.slug} live={live} /></Box>}
        </Box>
      )}
      {!tiles.length && !graph && <Typography sx={{ fontSize: "0.85rem", color: FAINT }}>Nothing in this stage is measured yet.</Typography>}
      {missing.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", mr: 0.5 }}>Not connected yet</Typography>
          {missing.map((k) => (
            <Box key={`${k.id}-${k.name}`} component={Link} href={stageHref(s.slug)} sx={{ fontSize: "0.74rem", color: MUTED, textDecoration: "none", px: 1, py: 0.3, borderRadius: "999px", border: "1px dashed rgba(21,34,58,.2)", bgcolor: "rgba(255,255,255,.6)", "&:hover": { color: INK } }}>
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
  const year = new Date().getFullYear();
  const views = state?.inputs ? buildViews(state.inputs, state.live?.value, year) : null;
  const measured = KPIS.filter((k) => MEASURES[k.id] && !MEASURES[k.id].notCatalogue).length;
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2, maxWidth: 1500 }}>
      <PageHeader title="Marketing KPIs" subtitle={`The customer journey, stage by stage · ${year} · ${measured} of ${KPIS.length} KPIs measured`} />
      {!views && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!state?.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading the marketing KPIs…"}</Typography>
        </Box></GlassCard>
      )}
      {views && state && (
        <>
          {STAGES.map((s, i) => <StagePanel key={s.id} s={s} i={i} views={views} live={state.live?.value} />)}
          {([["Additional tracking for the team - planned", ADDITIONAL_TRACKING], ["Also planned", PLANNED]] as const).filter(([, list]) => list.length).map(([title, list]) => (
            <GlassCard key={title}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <UpcomingIcon sx={{ fontSize: 20, color: MUTED }} />
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{title}</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {list.map((t) => <Box key={t} sx={{ fontSize: "0.82rem", color: INK, px: 1.4, py: 0.7, borderRadius: "12px", bgcolor: "rgba(255,255,255,.8)", border: "1px dashed rgba(21,34,58,.18)" }}>{t}</Box>)}
              </Box>
            </GlassCard>
          ))}
          <LiveNote state={state} />
        </>
      )}
    </Box>
  );
}
