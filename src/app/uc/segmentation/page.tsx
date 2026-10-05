"use client";

// SMART SEGMENTATION - every company's sales priority, kept alive.
//
// Moved from the APSOAssistant micro apps (05.10.2026). The engine is ported to
// the hub (src/lib/integrations/segmentation.ts) and takes over from the Compass
// connector at the switch (SEGMENTATION_ENGINE=live); until then this page shows
// the portfolio and runs previews, and the connector keeps writing.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import DonutSmallOutlinedIcon from "@mui/icons-material/DonutSmallOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ShareBar } from "@/app/charts/ShareBar";
import { BarList } from "@/app/charts/BarList";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { pctText } from "@/app/uc/oneshot/parts";
import { WindowPicker } from "@/app/window/ReportingWindow";
import { PotentialChanges } from "./PotentialChanges";

type Run = Record<string, unknown> | null;
type Status = {
  total: number; empty: number; prio_1?: number; prio_2?: number; prio_3?: number; prio_4?: number;
  no_prio_share_pct: number | null; web_new_enabled: boolean; web_candidates: number;
  last_run_new: Run; last_sweep: Run; last_potential: Run; last_web: Run; watcher_last: Run;
  running: { what: string; started: string; by: string } | null;
  engine: "hub" | "connector"; state_imported: string | null; own_app: string | null;
};
type Breakdown = {
  total: number; with_apso_customer: number; empty: number; by_value: Record<string, number>; other: number; lost_with_current_revenue: number;
};
type Data = { status: Status; breakdown: Breakdown; last: Record<string, Run> };

type TabId = "overview" | "changes" | "runs" | "properties";
const TAB_HASH: Record<TabId, string> = { overview: "#overview", changes: "#potential-changes", runs: "#runs", properties: "#properties" };

const PROPERTY_ROWS: [string, string, string][] = [
  ["sales_priority", "New-company watcher (about 3 min after creation) · the buttons · nightly sweep",
    "MAX(yearly potential, best revenue year) → P1 ≥ 25'000 € · P2 ≥ 2'500 € · P3 ≥ 500 €. The sweep never downgrades; when a rep changes a potential, the priority follows it up or down."],
  ["yearly_customer_potential", "Watcher seeds a starter value ONLY when empty · nightly recalculation of machine-written values",
    "300 € micro · 500–800 € by APIC product fit · revenue × multiplier when revenue exists. A person's value is never overwritten; values > 1 M € without matching revenue are ignored in the maths."],
  ["max_pot_or_turnover", "Wherever the priority is computed", "= MAX(yearly potential, best revenue year) - the basis behind the priority."],
  ["max_revenue_2015_2026", "Wherever the priority is computed", "Best Performis revenue year since 2015."],
  ["max_revenue_bucket", "Wherever the priority is computed", "Fine 0–8 revenue scale (0 = no turnover … 8 = ≥ 100 k€)."],
  ["apso_customer", "HubSpot creation workflow · lost-recovery here", "Read for the micro default; APSOlost that bought this year becomes APSOcore (≥ 500 €) or APSOprospect."],
  ["apic_ap / industry / hs_keywords", "Watcher and full runs, when empty", "From the industry mapping or DE/FR/IT/EN keywords in the name and description - only valid portal values, never overwritten."],
  ["description / employees / address / website", "Website enrichment, when empty", "Read from the company's own site (meta description, schema.org); country falls back to the domain (.ch → Switzerland). Each site at most once per 30 days."],
  ["revenue_2015 … revenue_<this year>", "Compass daily sync", "Input only - segmentation never writes revenue."],
];

const when = (r: Run) => (r && typeof r.at === "string" ? `${r.at.slice(8, 10)}.${r.at.slice(5, 7)} ${r.at.slice(11, 16)} UTC` : "never");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

/** What each run's counters mean, under its card. */
const LEGEND: Record<string, string> = {
  "Segment new companies": "Assigned: the priority each unsegmented company got · enriched: industry / APIC filled from its name.",
  "Full sweep": "Fill empty: had no priority · upgrade: basis rose past a threshold, priority raised (never lowered) · facts only: priority unchanged, best revenue year / bucket / basis refreshed · unlost: APSOlost that bought this year → APSOcore or APSOprospect · enriched: industry / APIC filled.",
  "Website enrichment": "Attempted: sites tried · site ok: something learned · then which fields were filled - empty fields only.",
  "Potential recalculation": "Manual kept: a person's number, never touched · kept higher: our machine's value is above the formula - raise-only, so kept · unchanged: within 10% of the formula · no revenue: nothing to compute from (no 2024-2026 revenue) · filled: was empty · machine recalc: our machine's value raised to the formula · human restored: a person's number we had overwritten, put back.",
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

export default function SmartSegmentation() {
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "overview");
  const [tick, setTick] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me/access").then((r) => (r.ok ? r.json() : null)).then((j) => setRole(j?.role ?? null)).catch(() => {});
  }, []);
  const url = `/api/uc/segmentation${tick ? `?refresh=1&n=${tick}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const st = d?.status;
  const running = !!st?.running;

  // while a run is going, look again every 10 seconds
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [running, tick]);

  const act = useCallback(async (what: string, dry: boolean, extra = "") => {
    setNote(null);
    const j = await fetch(`/api/uc/segmentation/action?do=${what}&dry=${dry ? 1 : 0}${extra}`, { method: "POST" }).then((x) => x.json()).catch(() => null);
    setNote(j?.ok ? j.data.note : j?.error ?? "Could not start.");
    setTimeout(() => setTick((n) => n + 1), 1500);
  }, []);
  const toggleWeb = useCallback(async (on: boolean) => {
    const j = await fetch(`/api/uc/segmentation/web-toggle?enabled=${on ? 1 : 0}`, { method: "POST" }).then((x) => x.json()).catch(() => null);
    if (!j?.ok) setNote(j?.error ?? "Could not switch.");
    setTick((n) => n + 1);
  }, []);

  const header = (
    <PageHeader
      title="Smart Segmentation"
      subtitle="Every company's sales priority from its potential and its best revenue year - new companies within minutes, the whole portfolio every night"
      rightSlot={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
          {tab === "changes" && <WindowPicker />}
          <Tooltip title="Count again in HubSpot">
            <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
          </Tooltip>
        </Box>
      }
    />
  );
  const shell = (children: React.ReactNode) => (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>{header}{children}</Box>
  );
  if (r === null) return shell(<LoadingPanel label="Counting the portfolio in HubSpot…" />);
  if (r.state === "not-configured") return shell(<NotConnectedPanel source="HubSpot" missing={r.missing} />);
  if (r.state === "error") return shell(<UpstreamPanel source="HubSpot (segmentation)" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />);
  if (!d || !st) return shell(null);

  const bd = d.breakdown;
  const p = { p1: st.prio_1 ?? 0, p2: st.prio_2 ?? 0, p3: st.prio_3 ?? 0, p4: st.prio_4 ?? 0 };
  const prioritised = p.p1 + p.p2 + p.p3;
  const live = st.engine === "hub";
  const admin = role === "admin";

  return shell(
    <>
      {!live && (
        <Notice tone="warn">
          The Compass connector still runs the engine (watcher, nightly sweep). This page shows the portfolio live and runs previews; the hub takes over at the switch.
        </Notice>
      )}
      {bd.lost_with_current_revenue > 0 && (
        <Notice tone="bad">{full(bd.lost_with_current_revenue)} companies are marked APSOlost but bought this year - the next sweep recovers them.</Notice>
      )}
      {note && <Notice tone="warn">{note}</Notice>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<StarOutlineIcon />} tint="green" label="Prioritised" value={full(prioritised)}
            note={`${pctText(prioritised, st.total)} of ${full(st.total)} companies · P1 ${full(p.p1)} · P2 ${full(p.p2)} · P3 ${full(p.p3)}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<RemoveCircleOutlineIcon />} tint="amber" label="No priority" value={full(p.p4)}
            note={`basis under 500 € · ${st.no_prio_share_pct ?? "—"}% of the portfolio with the unsegmented`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<HelpOutlineIcon />} tint={st.empty ? "pink" : "green"} label="Unsegmented" value={full(st.empty)}
            note={st.empty ? "no sales_priority yet - the watcher or the next run fills them" : "every company has a priority"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<LanguageOutlinedIcon />} tint="purple" label="Websites to read" value={full(st.web_candidates)}
            note={`a domain but no description · new companies ${st.web_new_enabled ? "read automatically" : "not read automatically"}`} />
        </Grid>
      </Grid>

      <Box>
        <ReportTabs name="segmentation" tab={tab} onSelect={selectTab} tabs={[
          { id: "overview", label: "Portfolio", count: null },
          { id: "changes", label: "Potential changes", count: null },
          { id: "runs", label: "Runs", count: running ? "running" : null },
          { id: "properties", label: "What it writes", count: null },
        ]} />
      </Box>

      {tab === "overview" && (
        <Box id="segmentation-panel-overview" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
          <GlassCard>
            <CardTitle icon={<DonutSmallOutlinedIcon />} title="Sales priority" note="MAX(yearly potential, best revenue year since 2015) → P1 ≥ 25'000 € · P2 ≥ 2'500 € · P3 ≥ 500 €" />
            <ShareBar format={(v) => full(v)} segments={[
              { label: "P1", value: p.p1 }, { label: "P2", value: p.p2 }, { label: "P3", value: p.p3 },
              { label: "No priority", value: p.p4 }, { label: "Unsegmented", value: st.empty },
            ]} />
          </GlassCard>
          <GlassCard>
            <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="APSO segment" note={`${full(bd.with_apso_customer)} of ${full(bd.total)} companies carry one · the engine reads it and only writes the lost-recovery`} />
            <BarList rows={[...Object.entries(bd.by_value).map(([label, value]) => ({ label, value })), ...(bd.other > 0 ? [{ label: "Other values", value: bd.other }] : []), { label: "No segment", value: bd.empty }]}
              format={(v) => full(v)} labelWidth={220} />
          </GlassCard>
        </Box>
      )}

      {tab === "changes" && (
        <Box id="segmentation-panel-changes" role="tabpanel" sx={{ minWidth: 0 }}>
          <PotentialChanges />
        </Box>
      )}

      {tab === "runs" && (
        <Grid container spacing={2} id="segmentation-panel-runs" role="tabpanel">
          {running && (
            <Grid size={{ xs: 12 }}>
              <Notice tone="warn">{st.running!.what} running since {st.running!.started.slice(11, 16)} UTC (started by {st.running!.by}) - other runs wait for it.</Notice>
            </Grid>
          )}
          <Grid size={{ xs: 12, lg: 6 }}>
            <RunCard title="Segment new companies" icon={<PlayArrowIcon />} note="Only companies with an EMPTY sales priority get one"
              last={st.last_run_new} busy={running} canRun={admin} live={live}
              onPreview={() => act("run-new", true)} onRun={() => act("run-new", false)} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <RunCard title="Full sweep" icon={<TuneOutlinedIcon />} note="The whole portfolio, upgrade-only, facts refreshed - runs every night"
              last={st.last_sweep} busy={running} canRun={admin} live={live}
              onPreview={() => act("sweep", true)} onRun={() => act("sweep", false)} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <RunCard title="Website enrichment" icon={<LanguageOutlinedIcon />} note="Description, size and address from the company's own site - empty fields only"
              last={st.last_web} busy={running} canRun={admin} live={live} onRun={() => act("web", false, "&limit=300")}
              extra={(
                <FormControlLabel sx={{ mb: 0.5 }} control={<Switch size="small" checked={st.web_new_enabled} disabled={!admin || !live} onChange={(e) => toggleWeb(e.target.checked)} />}
                  label={<Typography sx={{ fontSize: "0.82rem", color: INK }}>Read new companies' sites automatically</Typography>} />
              )} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <RunCard title="Potential recalculation" icon={<ScheduleOutlinedIcon />} note="Machine-written or empty potentials only - raise-only, a person's number is never touched"
              last={st.last_potential} busy={running} canRun={admin} live={live}
              onPreview={() => act("potential", true)} onRun={() => act("potential", false)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
              Watcher: last pass {when(st.watcher_last)}{st.watcher_last ? ` · ${full(num(st.watcher_last.found))} new companies found · ${full(num(st.watcher_last.written))} written` : ""}.
              {" "}Engine: {live ? "the hub" : "the Compass connector"}{st.own_app ? ` · the hub writes as HubSpot app ${st.own_app}` : ""}.
            </Typography>
          </Grid>
        </Grid>
      )}

      {tab === "properties" && (
        <Box id="segmentation-panel-properties" role="tabpanel" sx={{ minWidth: 0 }}>
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<TuneOutlinedIcon />} title="What the engine writes, and when" note="The same CEO formula and guard rails everywhere; a value a rep entered is never overwritten" />
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headCell}>Property</TableCell>
                    <TableCell sx={headCell}>Written by</TableCell>
                    <TableCell sx={headCell}>Rule</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {PROPERTY_ROWS.map(([prop, who, rule]) => (
                    <TableRow key={prop} hover>
                      <TableCell sx={{ ...bodyCell, fontFamily: "monospace", fontSize: "0.78rem", whiteSpace: "nowrap", color: INK }}>{prop}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{who}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{rule}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>
        </Box>
      )}
    </>,
  );
}
