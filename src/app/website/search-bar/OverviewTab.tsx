"use client";

// Search bar > Overview: the last 24 hours, the chosen period, searches per day, by shop language, what
// answered, and whether the data the bar reads is fresh (the shop's pages and their article lists).

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import GpsNotFixedOutlinedIcon from "@mui/icons-material/GpsNotFixedOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, KpiTile, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import type { Health, Metrics, Report, GatewaySetting } from "@/lib/searchbar/gateway";
import { Bars, pct, tierLabel, when } from "./shared";

export type OverviewData = { metrics: Metrics; report: Report; health: Health | null; setting: GatewaySetting };

/** Warnings worth a look on every visit: the gateway down, a stale shop registry, a failed page reading. */
export function Problems({ d }: { d: OverviewData }) {
  const pub = d.health?.published;
  const moves = pub?.page_moves;
  return (
    <>
      {!d.health && <Notice tone="bad">The search bar's gateway did not answer its health check - customers may see no search bar.</Notice>}
      {pub?.stale && <Notice tone="warn">The list of shop pages is {Math.round(pub.age_hours)} hours old (refreshed every 6 h){pub.last_sync_error ? `: ${pub.last_sync_error}` : "."}</Notice>}
      {moves?.last_round && typeof moves.last_round.error === "string" && <Notice tone="warn">The last night's reading of the shop pages failed: {String(moves.last_round.error)}</Notice>}
    </>
  );
}

export default function OverviewTab({ d, label }: { d: OverviewData; label: string }) {
  const m = d.metrics, r = d.report;
  const days = useMemo(() => r.by_day.slice().sort((a, b) => a.day.localeCompare(b.day)), [r.by_day]);
  const max = Math.max(1, ...days.map((x) => x.searches));
  const tiers = Object.entries(m.by_tier ?? {}).map(([k, n]) => ({ label: tierLabel(k), n })).sort((a, b) => b.n - a.n);
  const pub = d.health?.published;
  const moves = pub?.page_moves;

  return (
    <>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: -1 }}>Last 24 hours</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SearchOutlinedIcon />} tint="blue" label="Searches" value={full(m.total)} note="every language, typing counted per search" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Answered by the bar" value={pct(m.direct_count, m.total)} note={`${full(m.direct_count)} searches showed products`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SmartToyOutlinedIcon />} tint="purple" label="Went to the AI assistant" value={pct(m.assistant_count, m.total)} note={`${full(m.assistant_count)} searches`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<GpsNotFixedOutlinedIcon />} tint="amber" label="Not placed" value={full(m.gap_count)} note="neither the bar nor the assistant found it" /></Grid>
      </Grid>

      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: -1 }}>{label}</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SearchOutlinedIcon />} tint="blue" label="Searches" value={full(r.settled_searches)} note={`finished searches (${full(r.logged_events)} events logged)`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Found something" value={`${r.success_pct}%`} note={`${full(r.zero_result_searches)} searches without a result`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SmartToyOutlinedIcon />} tint="purple" label="AI conversations" value={full(r.ai_conversations)} note={`${full(r.ai_turns)} questions · ${full(r.ai_fallback_searches)} searches handed over`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CategoryOutlinedIcon />} tint="slate" label="Different searches" value={full(r.keywords_all_count)} note="distinct texts typed" /></Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title="Searches per day" note={`${label} · green part: found something · point at a bar for the figures`} />
        {days.length === 0 ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No searches in this period.</Typography> : (
          <>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height: 150 }}>
              {days.map((x) => (
                <Tooltip key={x.day} arrow title={`${x.day.split("-").reverse().join(".")}: ${full(x.searches)} searches, ${full(x.ok)} found something (${pct(x.ok, x.searches)})`}>
                  <Box sx={{ flex: "1 1 0", minWidth: 0, height: `${Math.max(2, (x.searches / max) * 100)}%`, display: "flex", flexDirection: "column", justifyContent: "flex-end", borderRadius: "4px 4px 0 0", overflow: "hidden", bgcolor: "rgba(36,89,209,.25)" }}>
                    <Box sx={{ height: `${x.searches ? (x.ok / x.searches) * 100 : 0}%`, bgcolor: GREEN }} />
                  </Box>
                </Tooltip>
              ))}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
              <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{days[0]?.day.split("-").reverse().join(".")}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{days[days.length - 1]?.day.split("-").reverse().join(".")}</Typography>
            </Box>
          </>
        )}
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<TranslateOutlinedIcon />} tint="purple" title="By shop language" note={`${label} · searches, and how many found something`} />
            <Bars rows={r.by_locale.map((l) => ({ label: l.locale, n: l.searches, note: `${l.success_pct}% found something` }))} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title="What answered" note="Last 24 hours · the kind of result the bar showed" />
            <Bars rows={tiers} colour={ACCENT} />
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="green" title="The data the bar reads" note="Which product pages and articles the shop lists - the bar shows only what a page lists" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <Chip tint={d.health ? "green" : "pink"}>{d.health ? "Gateway answering" : "Gateway not answering"}</Chip>
          {pub && <Chip tint={pub.stale ? "amber" : "green"}>{full(pub.count)} product pages · read {when(pub.synced_at)}</Chip>}
          {pub && <Chip tint={pub.names ? "green" : "amber"}>{pub.names ? "Product names in every language" : "Product names missing"}</Chip>}
          {moves && <Chip tint="blue">{full(moves.articles_listed)} articles listed on the pages</Chip>}
          {moves && <Chip tint="slate">{full(moves.merged_pages)} pages the shop merged</Chip>}
          {moves && <Chip tint="slate">Pages read {moves.window}</Chip>}
          {moves?.running && <Chip tint="amber">Reading the pages now</Chip>}
        </Box>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1.25 }}>Gateway: {d.setting.url.replace(/^https:\/\//, "")}</Typography>
      </GlassCard>
    </>
  );
}
