"use client";
// MARKETING KPIS - THE CUSTOMER JOURNEY IN A NUTSHELL (SARCLA 12.10: "start by
// main category and drill down to sub with more detail, but on the first you
// have it like in a nutshell"). Four headline figures, then the ten stages of
// the journey as cards - each with its lead KPIs and how much of it the hub
// measures - each opening its own page.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import UpcomingIcon from "@mui/icons-material/Upcoming";

import PageHeader from "@/app/PageHeader";
import { FAINT, GlassCard, INK, MUTED, RED, TINT, KpiTile } from "@/app/uc/report/ui";
import { ADDITIONAL_TRACKING, KPIS, STAGES } from "@/lib/marketingKpis/catalogue";
import { MEASURES, fmtValue } from "@/lib/marketingKpis/measures";
import { Compare, LiveNote, Spark, buildViews, nameOf, periodOf, stageHref, useMarketingKpis, type KpiView } from "./data";

/** The KPIs each stage leads with on this page. */
const LEAD: Record<string, string[]> = {
  "0": ["C01"], "1": ["R04", "R05", "R01"], "2": ["V01", "V06"], "3": ["E02", "E01"], "4": ["L01", "L04"],
  "5": ["L02", "H01"], "6": ["K02", "K03"], "7": ["P01", "P02", "P05"], "8": ["G01"], "9": ["F01", "P06"],
};
const TONES = [TINT.purple, TINT.blue, TINT.blue, TINT.green, TINT.amber, TINT.amber, TINT.pink, TINT.green, TINT.purple, TINT.slate];

function Line({ v, label }: { v: KpiView; label: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0.25, alignItems: "baseline" }}>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
      <Box sx={{ gridColumn: "1 / -1" }}><Compare v={v} size="0.72rem" /></Box>
    </Box>
  );
}

export default function MarketingKpisNutshell() {
  const [state] = useMarketingKpis();
  const year = new Date().getFullYear();
  const views = state?.inputs ? buildViews(state.inputs, state.live?.value, year) : null;
  const tile = (id: string) => views?.[id];
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1500 }}>
      <PageHeader title="Marketing KPIs" subtitle={`The customer journey in a nutshell · ${year}`} />
      {!views && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!state?.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading the marketing KPIs…"}</Typography>
        </Box></GlassCard>
      )}
      {views && state && (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
            {([["V01", <PeopleAltIcon key="i" />, "blue", "Users"], ["L01", <ContactMailIcon key="i" />, "amber", "Leads"], ["P01", <ShoppingBagIcon key="i" />, "green", "Online orders"], ["F01", <TrackChangesIcon key="i" />, "purple", "Paid revenue vs SMEC target"]] as const).map(([id, icon, tint, label]) => {
              const v = tile(id)!;
              const r = v.target != null && v.ytd != null ? v.ytd / v.target : null;
              return (
                <KpiTile key={id} icon={icon} tint={tint} label={`${label} · ${periodOf(v)}`} value={fmtValue(v.measure.fmt, v.ytd)}
                  delta={r != null ? undefined : v.pyYtd != null && v.ytd != null ? { ratio: (v.ytd - v.pyYtd) / v.pyYtd, versus: "last year, same months" } : undefined}
                  note={r != null ? `${(r * 100).toFixed(0)}% of the year's target ${fmtValue(v.measure.fmt, v.target)} · ${v.upTo ? `${Math.round((v.upTo / 12) * 100)}% of the year gone` : ""}` : id === "P01" && tile("P02")?.ytd != null ? `Conversion ${fmtValue("pct", tile("P02")!.ytd)} of users` : undefined} />
              );
            })}
          </Box>

          {/* The journey: ten stages, in order, each a door to its own page. */}
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>The customer journey</Typography>
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(5, 1fr)" } }}>
              {STAGES.map((s, i) => {
                const lead = (LEAD[s.id] ?? []).map((id) => views[id]).filter(Boolean) as KpiView[];
                const all = KPIS.filter((k) => k.stage === s.id);
                const measured = all.filter((k) => MEASURES[k.id] && !MEASURES[k.id].notCatalogue).length;
                const tone = TONES[i];
                return (
                  <Box key={s.id} component={Link} href={stageHref(s.slug)} sx={{
                    textDecoration: "none", display: "flex", flexDirection: "column", gap: 1, p: 1.75, borderRadius: "18px",
                    bgcolor: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.85)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 10px 26px rgba(31,45,78,.07)",
                    background: `linear-gradient(170deg, ${tone.bg}, rgba(255,255,255,.7) 55%)`,
                    transition: "transform .18s ease, box-shadow .18s ease", "&:hover": { transform: "translateY(-3px)", boxShadow: "0 18px 40px rgba(31,45,78,.12)" },
                  }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: tone.fg, color: "#fff", fontSize: "0.8rem", fontWeight: 800 }}>{s.id}</Box>
                      <Typography sx={{ flex: 1, fontSize: "0.92rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{s.name}</Typography>
                      <ChevronRightIcon sx={{ fontSize: 18, color: tone.fg }} />
                    </Box>
                    <Box sx={{ display: "grid", gap: 1, flex: 1 }}>
                      {lead.length ? lead.map((v) => <Line key={v.id} v={v} label={nameOf(v.id)} />)
                        : <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Nothing measured yet - open to see what it needs.</Typography>}
                    </Box>
                    {lead[0] && <Spark v={lead[0]} />}
                    <Box>
                      <Box sx={{ height: 4, borderRadius: 2, bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
                        <Box sx={{ width: `${all.length ? (measured / all.length) * 100 : 0}%`, height: "100%", bgcolor: tone.fg }} />
                      </Box>
                      <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.4 }}>{measured} of {all.length} KPIs measured</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {ADDITIONAL_TRACKING.length > 0 && (
            <GlassCard>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <UpcomingIcon sx={{ fontSize: 20, color: MUTED }} />
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>Additional tracking - planned</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {ADDITIONAL_TRACKING.map((t) => (
                  <Box key={t} sx={{ fontSize: "0.82rem", color: INK, px: 1.4, py: 0.7, borderRadius: "12px", bgcolor: "rgba(255,255,255,.8)", border: "1px dashed rgba(21,34,58,.18)" }}>{t}</Box>
                ))}
              </Box>
            </GlassCard>
          )}
          <LiveNote state={state} />
        </>
      )}
    </Box>
  );
}
