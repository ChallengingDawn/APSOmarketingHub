"use client";
// THE SALES LEADER VIEW - the KPIs SARCLA tagged "Sales leader, Rose" in the
// workbook (12.10.2026), stage by stage: the measured ones with their figures,
// the rest named with what they wait for.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import PageHeader from "@/app/PageHeader";
import { GlassCard, INK, MUTED, RED } from "@/app/uc/report/ui";
import { KPIS, STAGES } from "@/lib/marketingKpis/catalogue";
import { MEASURES } from "@/lib/marketingKpis/measures";
import { KpiCard, LEADER, LiveNote, NotConnected, buildViews, stageHref, useMarketingKpis } from "../data";

export default function SalesLeaderView() {
  const [state] = useMarketingKpis();
  const year = new Date().getFullYear();
  const views = state?.inputs ? buildViews(state.inputs, state.live?.value, year) : null;
  const mine = KPIS.filter((k) => k.audience === LEADER);
  const isMeasured = (id: string) => !!MEASURES[id] && !MEASURES[id].notCatalogue;
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1400 }}>
      <PageHeader title="Sales leader view" subtitle={`The ${mine.length} KPIs tagged for ${LEADER || "the sales leader"} · ${mine.filter((k) => isMeasured(k.id)).length} measured · ${year}`} />
      {!views && (
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {!state?.error && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>{state?.error ? `Could not load: ${state.error}` : "Loading…"}</Typography>
        </Box></GlassCard>
      )}
      {views && state && STAGES.map((s) => {
        const list = mine.filter((k) => k.stage === s.id);
        if (!list.length) return null;
        const measured = list.filter((k) => isMeasured(k.id));
        const rest = list.filter((k) => !isMeasured(k.id));
        return (
          <Box key={s.id} sx={{ display: "grid", gap: 1.5 }}>
            <Typography component={Link} href={stageHref(s.slug)} sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
              {s.id} · {s.name}
            </Typography>
            {measured.length > 0 && (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>
                {measured.map((k) => views[k.id] && <KpiCard key={k.id} v={views[k.id]} kpi={k} />)}
              </Box>
            )}
            <NotConnected list={rest} />
          </Box>
        );
      })}
      {views && state && <LiveNote state={state} />}
    </Box>
  );
}
