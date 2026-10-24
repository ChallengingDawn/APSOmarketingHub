"use client";

// TICKET VALUE - a HubSpot app (UC & HubSpot Apps > HubSpot apps). The hub gives every ESO and TSA ticket its sales
// potential, how sure it is (confidence) and the path the value came from, and writes them on the ticket (live since
// 21.10.2026; SARCLA: "take out all reference to the past workflow"). Overview, Tickets, How it works and Settings as
// UC tabs; figures from src/lib/ticketValue/model.ts, the rules in rules.ts (decideHub), the writing in live.ts.

import { Fragment, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiChip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, TRACK, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Row, RunInfo, Settings } from "@/lib/ticketValue/engine";
import type { Jobs, PipelineValue } from "@/lib/ticketValue/live";
import { sumFigures, type Measure, type Values } from "@/lib/ticketValue/model";
import type { Figures } from "@/lib/ticketValue/figures";
import type { SlowState } from "@/lib/integrations/slowReport";
import { PeriodPicker, monthsLabel } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import type { MonthWindow } from "@/app/reporting/marketing-kpis/data";
import { HUB_RULES, REENROL_STAGES } from "@/lib/ticketValue/rules";

type BetterInfo = { firstOrder: number | null; firstOrderMedian: number | null; firstOrderN: number; firstOrderAt: string | null; pricedArticles: number; firstOrderProgress: { done: number; of: number } | null };
type LiveInfo = { workflowOn: boolean | null; writing: boolean; jobs: Jobs | null };
type Data = { settings: Settings; last: RunInfo | null; everyMinutes: number; days: number; rows: Row[]; totalRows: number; measure: Measure; better?: BetterInfo; live?: LiveInfo; pipeline?: PipelineValue | null; figures?: SlowState<Figures>; admin: boolean };
/** The hub writes. */
const writing = (d: Data) => !!d.live?.writing;
type View = "overview" | "tickets" | "how" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", how: "#how-it-works", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
/** The filters of Overview and How it works: the months of this year, the pipeline (the Digital Growth pages' window). */
type Pipe = "both" | "ESO" | "TSA";
type Frame = { win: MonthWindow; pipe: Pipe; year: number };
const pipeLabel = (p: Pipe) => (p === "both" ? "ESO and TSA" : p);
const frameLabel = (f: Frame) => `${monthsLabel(f.win)} ${f.year}`;
const small = { fontSize: "0.8rem" } as const;

/** Where a value comes from, in words (sales_potential_source). */
const SOURCE: Record<string, string> = {
  direct_field: "on the ticket", child_gqs: "its GQS ticket", text_qty_price: "quantity × price in the text", product_lookup: "article × quantity",
  company_baseline: "the company's potential", unknown: "no signal (0)", unqualified: "not a sales ticket", manual_override: "typed by a person", "(none)": "no value",
};
const srcLabel = (s: string | null | undefined) => SOURCE[s ?? "(none)"] ?? s ?? "no value";
const amount = (v: string | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("de-CH", { maximumFractionDigits: 2 }) : v;
};
const valueText = (v: Values) => v.sales_potential_source || v.sales_potential_estimate ? `${amount(v.sales_potential_estimate)} · ${srcLabel(v.sales_potential_source)}` : "no value";
/** The amount, and where it comes from under it. */
function ValueCell({ v }: { v: Values }) {
  if (!v.sales_potential_source && !v.sales_potential_estimate) return <Box component="span" sx={{ color: FAINT }}>no value</Box>;
  return (
    <Box>
      <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{amount(v.sales_potential_estimate)}</Box>
      <Box sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{srcLabel(v.sales_potential_source)}</Box>
    </Box>
  );
}
/** The confidence of a value, as a chip. */
const CONF_TINT: Record<string, Tint> = { high: "green", medium: "blue", low: "amber", unqualified: "slate" };
function Conf({ c }: { c: string | null | undefined }) {
  if (!c || c === "-") return null;
  return <Chip tint={CONF_TINT[c] ?? "slate"}>{c}</Chip>;
}
const ruleOf = (k: string | undefined) => HUB_RULES.find((x) => x.rule === k);
/** The hub's value: the amount, its confidence, the path that gave it. */
function HubCell({ v, rule }: { v: Values; rule?: string }) {
  const r = ruleOf(rule);
  if (rule === "not-eso-tsa") return <Box component="span" sx={{ color: FAINT }}>not ESO/TSA</Box>;
  if (!v.sales_potential_source && !v.sales_potential_estimate) return <Box component="span" sx={{ color: FAINT }}>no value</Box>;
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{amount(v.sales_potential_estimate)}</Box>
        <Conf c={v.sales_potential_confidence} />
      </Box>
      <Box sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{r?.label ?? srcLabel(v.sales_potential_source)}</Box>
    </Box>
  );
}
/** What happened to a ticket. */
function StatusChip({ r }: { r: Row }) {
  if (r.verdict !== "live") return <Chip tint="slate">worked out, not written</Chip>;
  if (r.written?.error) return <Chip tint="pink">not written</Chip>;
  return r.written?.changed ? <Chip tint="green">written</Chip> : <Chip tint="slate">no change</Chip>;
}

function SmallTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow>{head.map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: typeof rows[0]?.[i] === "number" ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>{r.map((c, j) => <TableCell key={j} sx={{ ...bodyCell, fontSize: "0.84rem", textAlign: typeof c === "number" ? "right" : "left", fontVariantNumeric: "tabular-nums" }}>{typeof c === "number" ? full(c) : c}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** The one-time jobs of going live, as far as they have come. */
function JobsCard({ j }: { j: Jobs }) {
  const line = (title: string, done: boolean, text: string) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 1, alignItems: "baseline" }}>
      <Chip tint={done ? "green" : "amber"}>{done ? "done" : "running"}</Chip>
      <Typography sx={{ fontSize: "0.84rem", color: INK }}><b>{title}</b> - {text}</Typography>
    </Box>
  );
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="amber" title="Going live, once" note={`Started ${when(j.started)}; a little every 2 minutes; every change kept with what was there before`} />
      <Box sx={{ display: "grid", gap: 1 }}>
        {line("Open ESO and TSA tickets valued with the hub's rules", !!j.revalue.finished, `${full(j.revalue.done)} looked at, ${full(j.revalue.changed)} changed${j.revalue.errors ? `, ${full(j.revalue.errors)} could not be written` : ""}${j.revalue.finished ? ` - finished ${when(j.revalue.finished)}` : ""}`)}
        {line("Old values on Back Office, GQS and Special Prices tickets cleared", !!j.clear.finished, `${full(j.clear.cleared)} cleared${j.clear.keptTyped ? `, ${full(j.clear.keptTyped)} typed by a person kept` : ""}; ${full(j.clear.kpiFixed)} open-ticket rows in the KPI object counted without a value${j.clear.finished ? ` - finished ${when(j.clear.finished)}` : ""}`)}
      </Box>
    </GlassCard>
  );
}

// ---------------------------------------------------------------- Overview

const pathLabel = (k: string) => (k === "none" ? "No value yet" : ruleOf(k)?.label ?? k);
const confLabel = (k: string) => (k === "(none)" ? "no value yet" : k);
const CONF_ORDER = ["high", "medium", "low", "unqualified", "(none)"];
const PATH_ORDER = [...HUB_RULES.map((x) => x.rule as string), "none"];
const byOrder = (order: string[]) => (a: [string, unknown], b: [string, unknown]) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99);

/** The open pipeline as a funnel: all of it, then the part the hub is surer of - one hue, darker as it gets surer. */
function Funnel({ steps }: { steps: { label: string; n: number; value: number; shade: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 0);
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {steps.map((x, i) => (
        <Box key={x.label} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "210px minmax(0, 1fr) 150px" }, alignItems: "center", gap: { xs: 0.5, md: 1.5 } }}>
          <Box>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }}>{x.label}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{full(x.n)} open tickets</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Box sx={{
              width: `${Math.max(12, (x.value / max) * 100)}%`, height: 44, borderRadius: "10px", display: "grid", placeItems: "center",
              bgcolor: `rgba(36, 89, 209, ${x.shade})`, color: x.shade > 0.6 ? "#fff" : INK, fontWeight: 700, fontSize: "0.98rem", fontVariantNumeric: "tabular-nums", transition: "width .3s",
            }}>
              {full(Math.round(x.value))}
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: { xs: "left", md: "right" } }}>{`${i === 0 ? "100%" : pct(x.value, steps[0].value)} of the open value`}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function Overview({ d, f }: { d: Data; f: Frame }) {
  const label = pipeLabel(f.pipe);
  // the open pipeline today, by confidence
  const open = (d.pipeline?.pipes ?? []).filter((x) => f.pipe === "both" || x.pipeline === f.pipe).reduce((t, x) => {
    const c = (k: string) => x.byConf[k] ?? { n: 0, value: 0 };
    return { n: t.n + x.open, value: t.value + x.value, mhN: t.mhN + c("high").n + c("medium").n, mh: t.mh + c("high").value + c("medium").value, hN: t.hN + c("high").n, h: t.h + c("high").value };
  }, { n: 0, value: 0, mhN: 0, mh: 0, hN: 0, h: 0 });
  // the months chosen, from every ticket's own value
  const fig = d.figures?.value;
  const s = fig ? sumFigures(fig.buckets, f.win.start, f.win.end, f.pipe) : null;
  const conf = (k: string) => s?.byConf.get(k) ?? { n: 0, value: 0 };
  const paths = s ? [...s.byPath].sort(byOrder(PATH_ORDER)) : [];
  const confRows = s ? [...s.byConf].sort(byOrder(CONF_ORDER)) : [];
  return (
    <>
      {!writing(d) && <Info>Paused - the hub works each ticket&apos;s value out but writes nothing to HubSpot. Settings switches it back to Live.</Info>}
      <GlassCard>
        <CardTitle icon={<PaidOutlinedIcon />} tint="blue" title={`Open ${label} pipeline`} note={d.pipeline ? `Today, whatever the months chosen - every open ticket's value, and how much of it the hub is sure of · worked out ${when(d.pipeline.at)}, every 30 minutes` : "Worked out within minutes"} />
        {d.pipeline ? (
          <Funnel steps={[
            { label: "All open tickets", n: open.n, value: open.value, shade: 0.14 },
            { label: "Medium or high confidence", n: open.mhN, value: open.mh, shade: 0.42 },
            { label: "High confidence", n: open.hN, value: open.h, shade: 0.88 },
          ]} />
        ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Being worked out.</Typography>}
      </GlassCard>
      {d.live?.jobs && !(d.live.jobs.revalue.finished && d.live.jobs.clear.finished) && <JobsCard j={d.live.jobs} />}
      {!s ? (
        <GlassCard><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{d.figures?.error ? `The tickets of the months could not be read: ${d.figures.error}` : `Reading this year's ${label} tickets from HubSpot${d.figures?.progress ? ` - ${d.figures.progress}` : ""} (about a minute).`}</Typography></GlassCard>
      ) : (
        <>
          <Grid container spacing={2}>
            {[
              { label: "Tickets", value: full(s.total.n), note: `${label} tickets created ${frameLabel(f)}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
              { label: "Their value", value: full(Math.round(s.total.value)), note: "Their sales potential added up, as it is on them now", icon: <PaidOutlinedIcon />, tint: "purple" as const },
              { label: "High confidence", value: full(Math.round(conf("high").value)), note: `${full(conf("high").n)} tickets · ${pct(conf("high").value, s.total.value)} of the value`, icon: <AutoFixHighOutlinedIcon />, tint: "green" as const },
              { label: "Medium / low", value: `${full(Math.round(conf("medium").value))} / ${full(Math.round(conf("low").value))}`, note: `${full(conf("medium").n)} / ${full(conf("low").n)} tickets`, icon: <EditNoteOutlinedIcon />, tint: "amber" as const },
            ].map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
          </Grid>
          <GlassCard>
            <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Where each value comes from" note={`${label} tickets created ${frameLabel(f)} - the path that gave the value, how many tickets, how much, how sure`} />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Path", "The value is", "Confidence", "Tickets", "Value", "Per ticket"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i > 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {paths.map(([k, x]) => {
                    const r = ruleOf(k);
                    return (
                      <TableRow key={k}>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}>{pathLabel(k)}{r?.automated ? <Box component="span" sx={{ color: FAINT, fontWeight: 400 }}> · automated</Box> : null}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{k === "none" ? "Not valued yet - picked up within minutes" : r?.from ?? ""}</TableCell>
                        <TableCell sx={bodyCell}><Conf c={r?.confidence} /></TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.n)}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(Math.round(x.value))}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED }}>{x.n ? full(Math.round(x.value / x.n)) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            {!paths.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No ticket in these months.</Typography>}
          </GlassCard>
          <GlassCard>
            <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="green" title="By confidence" note={`How sure the hub is of the values - ${label} tickets created ${frameLabel(f)}`} />
            <SmallTable head={["Confidence", "Tickets", "Value", "Share"]} rows={confRows.map(([k, x]) => [confLabel(k), x.n, Math.round(x.value), pct(x.value, s.total.value)])} />
          </GlassCard>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Tickets

const esoTsa = (r: Row) => r.pipeline === "ESO" || r.pipeline === "TSA";
function TicketsTab({ d, days, onDays }: { d: Data; days: number; onDays: (n: number) => void }) {
  const [what, setWhat] = useState<"written" | "nochange" | "all">("written");
  const [pipes, setPipes] = useState<"esotsa" | "all">("esotsa");
  const [open, setOpen] = useState<string | null>(null);
  const inScope = d.rows.filter((r) => r.verdict !== "error" && (pipes === "all" || esoTsa(r)));
  const test = { written: (r: Row) => !!r.written?.changed, nochange: (r: Row) => !r.written?.changed, all: () => true };
  const rows = inScope.filter(test[what]);
  const { slice, pager } = usePaged(rows, 15);
  const l = d.last;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="What the hub did, ticket by ticket" note={l ? `Kept 21 days · last look ${when(l.at)}: ${full(l.found)} found, ${full(l.checked)} handled, ${full(l.written ?? 0)} written${l.error ? ` - ${l.error}` : ""}` : "Not run yet"} />
      <Box sx={{ mb: 1.5, display: "grid", gap: 1 }}>
        <Choice<"1" | "7" | "14" | "21"> value={String(days) as "1" | "7" | "14" | "21"} onChange={(k) => onDays(Number(k))} options={[
          { key: "1", label: "Today" }, { key: "7", label: "Last 7 days" }, { key: "14", label: "Last 14 days" }, { key: "21", label: "Last 21 days" },
        ]} />
        <Choice<"written" | "nochange" | "all"> value={what} onChange={setWhat} options={[
          { key: "written", label: "Written", count: inScope.filter(test.written).length }, { key: "nochange", label: "No change", count: inScope.filter(test.nochange).length }, { key: "all", label: "All", count: inScope.length },
        ]} />
        <Choice<"esotsa" | "all"> value={pipes} onChange={setPipes} options={[
          { key: "esotsa", label: "ESO and TSA", count: d.rows.filter(esoTsa).length }, { key: "all", label: "All pipelines", count: d.rows.length },
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Why", "Before", "The hub: value, confidence, path", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((r) => (
              <Fragment key={r.key}>
                <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.at)}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || r.ticketId}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{r.pipeline || "—"}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, ...small, color: MUTED, minWidth: 90 }}>{r.trigger === "created" ? "created" : r.stage}</TableCell>
                  <TableCell sx={{ ...bodyCell, ...small }}><ValueCell v={r.before} /></TableCell>
                  <TableCell sx={{ ...bodyCell, ...small }}>{r.hub?.better ? <HubCell v={r.hub.better.final} rule={r.hub.better.rule} /> : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><StatusChip r={r} /></TableCell>
                </TableRow>
                {open === r.key && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)", fontSize: "0.8rem" }}>
                      <b>The hub:</b> {r.hub?.better ? `${valueText(r.hub.better.final)} · confidence ${r.hub.better.final.sales_potential_confidence ?? "—"} · path: ${ruleOf(r.hub.better.rule)?.label ?? "—"} (${r.hub.better.action})` : "—"}
                      {r.written?.link ? ` · linked to company ${r.written.link}` : ""}{r.written ? ` · ${r.written.kpi} KPI rows` : ""}{r.written?.error ? ` · not written: ${r.written.error}` : ""}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>Nothing here.</Typography>}
    </GlassCard>
  );
}

// ---------------------------------------------------------------- How it works

function Step({ n, tint, title, text, count, of, last, aside }: { n: number; tint: Tint; title: string; text: React.ReactNode; count?: number; of?: number; last?: boolean; aside?: React.ReactNode }) {
  const t = TINT[tint];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", columnGap: 1.75 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: t.bg, color: t.fg, fontSize: "0.82rem", fontWeight: 700, flexShrink: 0 }}>{n}</Box>
        {!last && <Box sx={{ flex: 1, width: "2px", bgcolor: HAIRLINE, my: 0.5, minHeight: 18 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 2.25, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 650, color: INK }}>{title}</Typography>
        <Typography component="div" sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45, mt: 0.25 }}>{text}</Typography>
        {count !== undefined && of !== undefined && (
          <Box sx={{ height: 6, borderRadius: 99, bgcolor: TRACK, mt: 0.9, maxWidth: 520, overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${of ? Math.max(count ? 1.5 : 0, (count / of) * 100) : 0}%`, bgcolor: t.fg, opacity: 0.75, borderRadius: 99 }} />
          </Box>
        )}
        {aside && <Box sx={{ mt: 0.9 }}>{aside}</Box>}
      </Box>
      <Box sx={{ textAlign: "right", pt: 0.25 }}>
        {count !== undefined && <>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(count)}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, whiteSpace: "nowrap" }}>{of ? pct(count, of) : ""}</Typography>
        </>}
      </Box>
    </Box>
  );
}

function HowTab({ d, f }: { d: Data; f: Frame }) {
  const bi: BetterInfo = d.better ?? { firstOrder: null, firstOrderMedian: null, firstOrderN: 0, firstOrderAt: null, pricedArticles: 0, firstOrderProgress: null };
  const s = d.figures?.value ? sumFigures(d.figures.value.buckets, f.win.start, f.win.end, f.pipe) : null;
  const n = (k: string) => s?.byPath.get(k)?.n ?? 0;
  const tickets = `${pipeLabel(f.pipe)} tickets created ${frameLabel(f)}`;
  const auto = HUB_RULES.filter((x) => x.automated);
  const path = HUB_RULES.filter((x) => !x.automated && x.rule !== "not-eso-tsa");
  const requests = path.reduce((t, x) => t + n(x.rule), 0);
  const tint = (c: string): Tint => CONF_TINT[c] ?? "slate";
  return (
    <>
      <GlassCard>
        <CardTitle icon={<ScheduleIcon />} tint="blue" title="When the value is worked out" note="Every 2 minutes, for the tickets of these moments" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>A new ticket</b>, 4 minutes after it is created.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>A ticket entering</b> {Object.values(REENROL_STAGES).join(", ")} - worked out again.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>Any ESO or TSA ticket without a value</b> - for example one handed over from Back Office - picked up within minutes.</Typography>
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="amber" title="Automated tickets: the value their automation gives" note={`Checked first - a ticket of one of these kinds never goes down the path below unless its value is missing · ${tickets}`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Ticket", "Its value", "Confidence", "Tickets"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i === 3 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {auto.map((x) => (
                <TableRow key={x.rule}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}>{x.label}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{x.from}</TableCell>
                  <TableCell sx={bodyCell}><Conf c={x.confidence} /></TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(n(x.rule))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>
          The average first order: {bi.firstOrder ? <><b>{full(Math.round(bi.firstOrder))}</b> (median {full(Math.round(bi.firstOrderMedian ?? 0))}) - the first orders of the newest {full(bi.firstOrderN)} customers of the last 12 months, worked out {when(bi.firstOrderAt)}, again every week.</> : bi.firstOrderProgress ? `being worked out - ${bi.firstOrderProgress.done} of ${bi.firstOrderProgress.of} customers read.` : "worked out within the hour."}
          {" "}What an article sells for per piece: its revenue ÷ quantity this year and last ({full(bi.pricedArticles)} articles, from last night&apos;s orders).
        </Typography>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Customer requests: the path, in order" note={`E-mails, forms, chats - the first rule that finds a value wins · ${full(requests)} ${tickets}`} />
        <Box sx={{ maxWidth: 940 }}>
          {path.map((x, i) => (
            <Step key={x.rule} n={i + 1} tint={tint(x.confidence)} title={x.label} count={n(x.rule)} of={requests} last={i === path.length - 1}
              text={<>{x.from}{x.rule === "product" ? ". Products & Pricing's list price is per price unit (1, 100 or 1,000 pieces) and never says which - so the hub uses what the article really sold for. “1120036838 x 100”, “100 Stk”, “Menge: 100” count, and every article is added up." : x.rule === "company" ? ". The ticket is linked to the company when it was found through its contact or the e-mail domain." : ""}</>}
              aside={<Conf c={x.confidence} />} />
          ))}
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="green" title="What it writes" note="Every change kept with what was there before" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• On the ticket: <b>Sales potential estimate</b>, <b>its source</b> and <b>its confidence</b> - only when one of them changes.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The ticket&apos;s <b>link to its company</b>, when the company was found through the contact or the e-mail domain.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Rows in the <b>KPI object</b> (ticket created, value created, closed, won / lost, open) - the Customer journey KPIs read them. Back Office, GQS and Special Prices tickets are counted there, without a value.</Typography>
        </Box>
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------- Settings

type Checked = {
  ticketId: string; subject: string; pipeline: string; now: Values;
  company: { id: string; via: string; mandant: string; yp: number; tickets12m: number } | null;
  history: { prop: string; entries: { value: string | null; at: string | null; by: string }[] }[];
  better?: { rule?: string; ruleLabel?: string; action: string; final: Values; changes: boolean; company?: { id: string; via: string; mandant: string; yp: number; tickets12m: number } | null };
};
/** Who wrote a value, in words. */
const byLabel = (by: string) => (by === "app 50521064" ? "the hub" : by === "workflow" || by === "app 30109717" ? "earlier" : by === "crm_ui" ? "a person" : by);

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<{ row?: Checked; error?: string } | null>(null);
  const call = async (what: string, method: "PUT" | "POST", body: unknown) => {
    setBusy(what); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-value", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; error?: string; data?: { skipped?: string } };
      setMsg(j.ok ? (j.data?.skipped ? `Not run: ${j.data.skipped}.` : "Done.") : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const r = await fetch(`/api/uc/ticket-value?ticket=${encodeURIComponent(tid.trim())}`);
      const j = (await r.json()) as { ok: boolean; data?: Checked; error?: string };
      setCheck(j.ok && j.data ? { row: j.data } : { error: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setCheck({ error: (e as Error).message }); } finally { setBusy(null); }
  };
  const c = check?.row;
  const company = c?.better?.company ?? c?.company;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={d.settings.mode} onChange={(m) => {
            if (!d.admin || m === d.settings.mode) return;
            if (m === "live" && !window.confirm("Switch Ticket value to live? The hub writes each ESO and TSA ticket's value again. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "live", label: "Live - the hub writes" }, { key: "shadow", label: "Paused - works values out, writes nothing" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {d.live?.writing
              ? <>Writing{d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}.</>
              : d.settings.mode === "live"
                ? <><b>Waiting:</b> the old HubSpot workflow “SARCLA | TICKET VALUE CALCULATION” is {d.live?.workflowOn ? "switched on again" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub goes on within 2 minutes.</>
                : d.settings.mode === "shadow" ? "Paused: values are worked out, nothing is written." : "Off."}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="outlined" size="small" disabled={!d.admin || !!busy} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            {busy === "run" && <CircularProgress size={14} />}
          </Box>
          {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </GlassCard>
      {d.live?.jobs && <JobsCard j={d.live.jobs} />}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read only - what the hub's rules give it now, next to what is on it. Nothing is written" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (tid.trim() && !busy) void doCheck(); }} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Ticket id, e.g. 440083382514" inputProps={{ "aria-label": "Ticket id", inputMode: "numeric" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!/^\d+$/.test(tid.trim()) || !!busy} sx={{ textTransform: "none" }}>
            {busy === "check" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check?.error && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1.5 }}>{check.error}</Typography>}
        {c && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.6 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>
              <Box component="a" href={hsTicket(c.ticketId)} target="_blank" rel="noopener" sx={{ color: INK }}>{c.subject || c.ticketId}</Box>
              <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}> - {c.pipeline}</Box>
            </Typography>
            <Typography sx={{ ...small, color: INK }}><b>On it now:</b> {valueText(c.now)} · confidence {c.now.sales_potential_confidence ?? "—"}</Typography>
            {c.better && <Typography sx={{ ...small, color: INK }}><b>The hub&apos;s rules give:</b> {c.better.rule === "not-eso-tsa" ? "no value - not an ESO or TSA ticket" : <>{valueText(c.better.final)} · confidence {c.better.final.sales_potential_confidence ?? "—"} · path: {c.better.ruleLabel ?? "—"} ({c.better.action}){c.better.changes ? "" : " - already on the ticket"}</>}</Typography>}
            {company && <Typography sx={{ ...small, color: INK }}><b>Company:</b> {company.id} (found through the {company.via}) · {company.mandant} · yearly potential {full(company.yp)} · {full(company.tickets12m)} tickets in 12 months</Typography>}
            <Box sx={{ overflowX: "auto", mt: 0.5 }}>
              <Table size="small">
                <TableHead><TableRow>{["Property", "Value", "When", "By"].map((h) => <TableCell key={h} sx={{ ...headCell, py: 0.5 }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {c.history.flatMap((h) => h.entries.map((e, i) => (
                    <TableRow key={`${h.prop}${i}`}>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: i ? FAINT : INK }}>{i ? "" : h.prop.replace("sales_potential_", "")}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>{h.prop.endsWith("source") ? srcLabel(e.value) : h.prop.endsWith("estimate") ? amount(e.value) : e.value ?? "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, whiteSpace: "nowrap" }}>{when(e.at)}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: MUTED }}>{byLabel(e.by)}</TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function TicketValue() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const [days, setDays] = useState(7);
  const [chosenWin, setChosenWin] = useState<MonthWindow | null>(null);
  const [pipe, setPipe] = useState<Pipe>("both");
  const [panel, setPanel] = useState(false);
  const [fold, setFold] = useState<{ period?: boolean; pipe?: boolean }>({ period: true });
  const url = `/api/uc/ticket-value?days=${days}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = () => setN((x) => x + 1);
  const ok = r?.state === "ok" ? r.data : null;
  // the months of this year, the current one too
  const fig = ok?.figures?.value;
  const done = fig?.months ?? new Date().getMonth() + 1, year = fig?.year ?? new Date().getFullYear();
  const win: MonthWindow = chosenWin && chosenWin.end < done ? chosenWin : { start: 0, end: done - 1 };
  const isDefault = win.start === 0 && win.end === done - 1;
  const chosen = (isDefault ? 0 : 1) + (pipe === "both" ? 0 : 1);
  const frame: Frame = { win, pipe, year };
  const filtered = view === "overview" || view === "how";
  // the months' figures are read in the background: ask again until they are in
  const computing = !!ok?.figures?.computing && !fig;
  useEffect(() => {
    if (!computing) return;
    const t = setTimeout(() => setN((x) => x + 1), 15_000);
    return () => clearTimeout(t);
  }, [computing, n]);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ticket value" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={again} />;
  else if (view === "tickets") body = <TicketsTab key={`${days}`} d={r.data} days={days} onDays={setDays} />;
  else if (view === "how") body = <HowTab d={r.data} f={frame} />;
  else body = <Overview d={r.data} f={frame} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ticket value"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
        <ReportTabs name="ticketvalue" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: ok ? full(ok.measure.written ?? 0) : null },
          { id: "how", label: "How it works", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
        </Box>
        <Box sx={{ flex: 1 }} />
        {filtered && (
          <Button onClick={() => setPanel((x) => !x)} variant={panel || chosen ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="ticketvalue-filters" startIcon={<TuneIcon />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen ? undefined : "#fff" }}>
            Filters{chosen ? ` · ${chosen}` : ""}
          </Button>
        )}
      </Box>
      {filtered && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", mt: -1 }}>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, mr: 0.5 }}>
            <b style={{ color: INK }}>{frameLabel(frame)}</b> · {pipeLabel(pipe)} tickets created in these months, their value as it is on them now{computing ? " · being read from HubSpot" : ""}
          </Typography>
          {!isDefault && <MuiChip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />}
          {pipe !== "both" && <MuiChip size="small" label={<span><b>Pipeline:</b> {pipe}</span>} onDelete={() => setPipe("both")} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />}
        </Box>
      )}
      <FilterPanel id="ticketvalue-filters" open={panel && filtered} onClose={() => setPanel(false)} subtitle="The months, the pipeline" onClearAll={chosen ? () => { setChosenWin(null); setPipe("both"); } : undefined}>
        <FilterSection id="tv-f-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!!fold.period} onFlip={() => setFold((o) => ({ ...o, period: !o.period }))} summary={monthsLabel(win)} chosen={!isDefault}>
          <PeriodPicker done={done} win={win} onChange={(x) => setChosenWin(x)} />
        </FilterSection>
        <FilterSection id="tv-f-pipe" index={1} title="Pipeline" icon={<AltRouteOutlinedIcon />} tint="purple" open={!!fold.pipe} onFlip={() => setFold((o) => ({ ...o, pipe: !o.pipe }))} summary={pipeLabel(pipe)} chosen={pipe !== "both"}>
          <Choice<Pipe> value={pipe} onChange={setPipe} options={[{ key: "both", label: "ESO and TSA" }, { key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" }]} />
        </FilterSection>
      </FilterPanel>
      <Box id={`ticketvalue-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
