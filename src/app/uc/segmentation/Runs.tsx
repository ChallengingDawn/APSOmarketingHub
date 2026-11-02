"use client";

// SMART SEGMENTATION - the runs, each on the main tab of its topic (SARCLA 02.11.2026: "runs should be split in different
// tabs per topic and bring also KPIs", then "integrated to the main tabs, not as a separate tab"): the new companies and
// the watcher (New companies), the nightly sweep, the potentials (Potential changes), the websites, the yearly
// reclassification - each with four counts from its last run, then its card to preview and run it.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import DomainAddOutlinedIcon from "@mui/icons-material/DomainAddOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, TINT } from "@/app/uc/report/ui";
import type { PcRun } from "./ProfitCentre";

export type Run = Record<string, unknown> | null;
export type YearlySummary = {
  at: string; dry: boolean; year: number; scanned: number; changes: number; written: number; rowCount: number;
  transitions: Record<string, number>; before: Record<string, number>; after: Record<string, number>;
};
export type Status = {
  total: number; empty: number; prio_1?: number; prio_2?: number; prio_3?: number; prio_4?: number;
  no_prio_share_pct: number | null; web_new_enabled: boolean; web_candidates: number;
  last_run_new: Run; last_sweep: Run; last_potential: Run; last_web: Run; watcher_last: Run;
  last_yearly: Run; yearly_done: number | null; year: number; yearly_summary: YearlySummary | null;
  running: { what: string; started: string; by: string } | null;
  engine: "hub" | "connector"; state_imported: string | null; own_app: string | null;
  last_profit_centre: PcRun; pc_window_years: number;
  pc_progress: { scanned: number; changes: number; of: number | null; done: boolean } | null;
};

const when = (r: Run) => (r && typeof r.at === "string" ? `${r.at.slice(8, 10)}.${r.at.slice(5, 7)} ${r.at.slice(11, 16)} UTC` : "never");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

/** What each run's counters mean, under its card. */
const LEGEND: Record<string, string> = {
  "Segment new companies": "The numbers: how many companies had no priority, and which priority each got.",
  "Full sweep": "Upgrade: the priority went up because potential or revenue grew · facts only: the priority stayed, its helper fields were refreshed · unlost: an APSOlost customer bought again and became Core or Prospect · fill empty: had no priority yet.",
  "Website enrichment": "Attempted: websites tried · site ok: the site answered and something was learned · then which fields it filled.",
  "Potential recalculation": "Manual kept: a person's value - never touched · kept higher: the engine's value is already above the formula, it is not lowered · unchanged: less than 10 % away · no revenue: nothing to calculate from · filled: was empty · machine recalc: the engine's value raised to the formula.",
  "Yearly reclassification": "Segment changed: a new APSO segment from the 14 rules · prio up / prio down: the priority set exactly to the rule · APIC corrected / set / cleared and industry filled / corrected: made to agree · facts only: nothing decided changed, helper fields refreshed · ERP left alone: ESO, DS, Growth Engine - never touched.",
};

function RunCard({ title, note, icon, last, extra, onPreview, onRun, busy, canRun, live }: {
  title: string; note: string; icon: React.ReactNode; last: Run; extra?: React.ReactNode;
  onPreview?: () => void; onRun?: () => void; busy: boolean; canRun: boolean; live: boolean;
}) {
  const stats = last && typeof last.stats === "object" && last.stats ? (last.stats as Record<string, number>) : null;
  return (
    <GlassCard sx={{ height: "100%" }}>
      <CardTitle icon={icon} title={title} note={note} />
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1 }}>
        Last: {when(last)}{last?.dry ? " (preview)" : ""}
        {last && "scanned" in last ? ` · ${full(num(last.scanned))} read` : ""}
        {last && "planned_changes" in last ? ` · ${full(num(last.planned_changes))} to change` : ""}
        {last && "changes" in last ? ` · ${full(num(last.changes))} to change` : ""}
        {last && "planned" in last ? ` · ${full(num(last.planned))} to change` : ""}
        {last && "written" in last ? ` · ${full(num(last.written))} written` : ""}
        {last && "error" in last ? ` · failed: ${String(last.error).slice(0, 120)}` : ""}
      </Typography>
      {stats && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
          {Object.entries(stats).filter(([, v]) => v).map(([k, v]) => (
            <Chip key={k} size="small" label={`${k.replace(/_/g, " ")} ${full(v)}`} sx={{ height: 22, fontSize: "0.72rem", bgcolor: TINT.slate.bg, color: TINT.slate.fg }} />
          ))}
        </Box>
      )}
      {LEGEND[title] && <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.5, mb: 1 }}>{LEGEND[title]}</Typography>}
      {extra}
      {canRun && (
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          {onPreview && (
            <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} disabled={busy} onClick={onPreview}>Preview</Button>
          )}
          {onRun && (
            <Tooltip title={live ? "" : "The connector still runs segmentation - only previews until the switch"}>
              <span>
                <Button size="small" variant="contained" disableElevation startIcon={<PlayArrowIcon />} disabled={busy || !live}
                  onClick={() => { if (confirm(`${title}: write to HubSpot now?`)) onRun(); }}>Run</Button>
              </span>
            </Tooltip>
          )}
        </Box>
      )}
    </GlassCard>
  );
}

/** The yearly card's own part: is it due, the biggest moves of the last preview or run, the Excel files. */
function YearlyExtra({ st }: { st: Status }) {
  const ys = st.yearly_summary;
  const moves = ys ? Object.entries(ys.transitions).sort((a, b) => b[1] - a[1]) : [];
  return (
    <Box sx={{ display: "grid", gap: 1.25, mb: 0.5 }}>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip size="small" label={st.yearly_done === st.year ? `Done for ${st.year}` : `Not run for ${st.year} yet`}
          sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700, bgcolor: st.yearly_done === st.year ? TINT.green.bg : TINT.amber.bg, color: st.yearly_done === st.year ? TINT.green.fg : TINT.amber.fg }} />
        {ys && (
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
            {ys.dry ? "Last preview" : "Last run"} {when(ys as unknown as Run)}: {full(ys.rowCount)} companies with a new segment, priority, APIC or industry
          </Typography>
        )}
      </Box>
      {moves.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 0.75 }}>
          {moves.slice(0, 9).map(([t, n]) => (
            <Box key={t} sx={{ display: "flex", justifyContent: "space-between", gap: 1, px: 1.25, py: 0.6, borderRadius: "10px", bgcolor: "rgba(255,255,255,.7)", border: "1px solid rgba(21,34,58,.08)" }}>
              <Typography sx={{ fontSize: "0.8rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</Typography>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{full(n)}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {ys?.dry && (
          <Button size="small" variant="text" startIcon={<FileDownloadOutlinedIcon />} href="/api/uc/segmentation/yearly-export?which=preview">Excel of the preview</Button>
        )}
        {st.yearly_done !== null && (
          <Button size="small" variant="text" startIcon={<FileDownloadOutlinedIcon />} href="/api/uc/segmentation/yearly-export?which=applied">Excel of the last run - the before values</Button>
        )}
      </Box>
    </Box>
  );
}

export type Topic = "new" | "sweep" | "potential" | "web" | "yearly";
/** "12% - " before a note, nothing when there is nothing to take a share of */
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% - ` : "");
const statsOf = (r: Run) => (r && typeof r.stats === "object" && r.stats ? (r.stats as Record<string, number>) : {});
type Tile = { label: string; value: number | string; note: string; icon: React.ReactNode; tint: "blue" | "green" | "amber" | "purple" | "pink" | "slate" };

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <Grid container spacing={2}>
      {tiles.map((t) => (
        <Grid key={t.label} size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={t.icon} tint={t.tint} label={t.label} value={typeof t.value === "number" ? full(t.value) : t.value} note={t.note} />
        </Grid>
      ))}
    </Grid>
  );
}

export function RunTopic({ topic: sub, st, admin, live, running, act, toggleWeb }: {
  topic: Topic; st: Status; admin: boolean; live: boolean; running: boolean;
  act: (what: string, dry: boolean, extra?: string) => void; toggleWeb: (on: boolean) => void;
}) {
  const w = (st.watcher_last ?? {}) as Record<string, unknown>;
  const set = (m: unknown) => Object.values((m ?? {}) as Record<string, number>).reduce((a, n) => a + (Number(n) || 0), 0);
  const sw = statsOf(st.last_sweep), po = statsOf(st.last_potential), we = statsOf(st.last_web), ye = statsOf(st.last_yearly);
  const swRead = num(st.last_sweep?.scanned), poRead = num(st.last_potential?.scanned), yeRead = num(st.last_yearly?.scanned), tried = we.attempted ?? 0;
  const tiles: Record<Topic, Tile[]> = {
    new: [
      { label: "No priority yet", value: st.empty, note: st.empty ? `of ${full(st.total)} companies - the watcher or the next run fills them` : `every one of the ${full(st.total)} companies has a sales priority`, icon: <HelpOutlineIcon />, tint: st.empty ? "pink" : "green" },
      { label: "New companies, last pass", value: num(w.found), note: `the watcher's pass ${when(st.watcher_last)}: created in the last 48 hours without a priority or a potential`, icon: <DomainAddOutlinedIcon />, tint: "blue" },
      { label: "Priorities set, last pass", value: set(w.priorities_set), note: `${full(num(w.potential_seeded))} starter potentials seeded, ${full(num(w.written))} companies written`, icon: <TrendingUpIcon />, tint: "amber" },
      { label: "Safety net, last run", value: num(st.last_run_new?.written), note: st.last_run_new ? `written of ${full(num(st.last_run_new.scanned))} without a priority, ${when(st.last_run_new)}${st.last_run_new.dry ? " (preview)" : ""}` : "never run - the watcher does it within minutes", icon: <FactCheckOutlinedIcon />, tint: "slate" },
    ],
    sweep: [
      { label: "Companies read", value: swRead, note: st.last_sweep ? `the whole portfolio, ${when(st.last_sweep)}${st.last_sweep.dry ? " (preview)" : ""} · ${full(num(st.last_sweep.written))} written` : "not run yet", icon: <TuneOutlinedIcon />, tint: "blue" },
      { label: "Priority raised", value: sw.upgrade ?? 0, note: `${pct(sw.upgrade ?? 0, swRead)}the potential or the revenue grew; never lowered here`, icon: <TrendingUpIcon />, tint: "green" },
      { label: "Filled or recovered", value: (sw.fill_empty ?? 0) + (sw.unlost ?? 0), note: `${full(sw.fill_empty ?? 0)} had no priority yet, ${full(sw.unlost ?? 0)} APSOlost bought again`, icon: <FactCheckOutlinedIcon />, tint: "amber" },
      { label: "Facts refreshed", value: sw.facts_only ?? 0, note: `${pct(sw.facts_only ?? 0, swRead)}the priority stayed, its helper fields were brought up to date`, icon: <SwapVertIcon />, tint: "slate" },
    ],
    potential: [
      { label: "Potentials read", value: poRead, note: st.last_potential ? `${when(st.last_potential)}${st.last_potential.dry ? " (preview)" : ""} · ${full(num(st.last_potential.written))} written` : "not run yet", icon: <SavingsOutlinedIcon />, tint: "blue" },
      { label: "Raised to the formula", value: po.machine_recalc ?? 0, note: `${pct(po.machine_recalc ?? 0, poRead)}the engine's own value, raised; never lowered`, icon: <TrendingUpIcon />, tint: "green" },
      { label: "Filled", value: po.filled ?? 0, note: `were empty · ${full(po.no_revenue ?? 0)} have no revenue to calculate from`, icon: <FactCheckOutlinedIcon />, tint: "amber" },
      { label: "A person's value, kept", value: po.manual_kept ?? 0, note: `never touched · ${full(po.kept_higher ?? 0)} kept higher, ${full(po.unchanged ?? 0)} less than 10 % away`, icon: <PersonOutlineIcon />, tint: "purple" },
    ],
    web: [
      { label: "Websites to read", value: st.web_candidates, note: `a domain but no description · new companies ${st.web_new_enabled ? "read automatically" : "not read automatically"}`, icon: <LanguageOutlinedIcon />, tint: "blue" },
      { label: "Tried, last batch", value: tried, note: st.last_web ? `${when(st.last_web)}${st.last_web.dry ? " (preview)" : ""} · each site at most once in 30 days` : "not run yet", icon: <TuneOutlinedIcon />, tint: "slate" },
      { label: "The site answered", value: we.site_ok ?? 0, note: `${tried ? `${Math.round(((we.site_ok ?? 0) / tried) * 100)}% of those tried - ` : ""}something was learned`, icon: <FactCheckOutlinedIcon />, tint: "green" },
      { label: "Descriptions filled", value: we.description ?? 0, note: `and ${full(we.employees ?? 0)} sizes, ${full(we.address ?? 0)} addresses, ${full(we.apic_or_industry ?? 0)} APIC or industry`, icon: <ArticleOutlinedIcon />, tint: "purple" },
    ],
    yearly: [
      { label: `Reclassification ${st.year}`, value: st.yearly_done === st.year ? "Done" : "Not yet", note: st.yearly_done === st.year ? `run for ${st.year}` : "by hand in January, after a preview and its Excel", icon: <EventRepeatOutlinedIcon />, tint: st.yearly_done === st.year ? "green" : "amber" },
      { label: "Companies read", value: yeRead, note: st.last_yearly ? `${when(st.last_yearly)}${st.last_yearly.dry ? " (preview)" : ""} · ${full(num(st.last_yearly.written))} written` : "not run yet", icon: <TuneOutlinedIcon />, tint: "blue" },
      { label: "Segment changed", value: ye.segment_changed ?? 0, note: `${pct(ye.segment_changed ?? 0, yeRead)}a new APSO segment from the 14 rules; ESO, DS and Growth Engine never`, icon: <CategoryOutlinedIcon />, tint: "purple" },
      { label: "Priority moved", value: (ye.prio_up ?? 0) + (ye.prio_down ?? 0), note: `${full(ye.prio_up ?? 0)} up, ${full(ye.prio_down ?? 0)} down - set exactly to the rule`, icon: <SwapVertIcon />, tint: "amber" },
    ],
  };
  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      {running && <Notice tone="warn">{st.running!.what} running since {st.running!.started.slice(11, 16)} UTC (started by {st.running!.by}) - other runs wait for it.</Notice>}
      <Tiles tiles={tiles[sub]} />
      {sub === "new" && (
        <>
          <RunCard title="Segment new companies" icon={<PlayArrowIcon />} note="Gives a priority to every company that has none yet - a safety net: the watcher already does it within minutes"
            last={st.last_run_new} busy={running} canRun={admin} live={live}
            onPreview={() => act("run-new", true)} onRun={() => act("run-new", false)} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            Watcher: last pass {when(st.watcher_last)}{st.watcher_last ? ` · ${full(num(w.found))} new companies found · ${full(num(w.written))} written` : ""}.
            {" "}Engine: {live ? "the hub" : "the Compass connector"}{st.own_app ? ` · the hub writes as HubSpot app ${st.own_app}` : ""}.
          </Typography>
        </>
      )}
      {sub === "sweep" && (
        <RunCard title="Full sweep" icon={<TuneOutlinedIcon />} note="Every night, all 60,000 companies: keeps each priority up to date - raises it when it should, never lowers it"
          last={st.last_sweep} busy={running} canRun={admin} live={live}
          onPreview={() => act("sweep", true)} onRun={() => act("sweep", false)} />
      )}
      {sub === "potential" && (
        <RunCard title="Potential recalculation" icon={<ScheduleOutlinedIcon />} note="Recalculates the potentials the engine set itself (revenue × product fit) - never one a person entered, never lower"
          last={st.last_potential} busy={running} canRun={admin} live={live}
          onPreview={() => act("potential", true)} onRun={() => act("potential", false)} />
      )}
      {sub === "web" && (
        <RunCard title="Website enrichment" icon={<LanguageOutlinedIcon />} note="Reads a company's own website to fill an empty description, size and address"
          last={st.last_web} busy={running} canRun={admin} live={live} onRun={() => act("web", false, "&limit=300")}
          extra={(
            <FormControlLabel sx={{ mb: 0.5 }} control={<Switch size="small" checked={st.web_new_enabled} disabled={!admin || !live} onChange={(e) => toggleWeb(e.target.checked)} />}
              label={<Typography sx={{ fontSize: "0.82rem", color: INK }}>Read new companies' sites automatically</Typography>} />
          )} />
      )}
      {sub === "yearly" && (
        <RunCard title="Yearly reclassification" icon={<EventRepeatOutlinedIcon />}
          note="Once a year, in January: every company's APSO segment decided again from scratch, and every priority set exactly to the rule - up or down. Preview, check the Excel, then run"
          last={st.last_yearly} busy={running} canRun={admin} live={live}
          onPreview={() => act("yearly", true)} onRun={() => act("yearly", false)}
          extra={<YearlyExtra st={st} />} />
      )}
    </Box>
  );
}
