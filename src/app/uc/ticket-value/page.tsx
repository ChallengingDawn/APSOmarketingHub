"use client";

// TICKET VALUE - a HubSpot app (UC & HubSpot Apps > HubSpot apps), in SHADOW MODE (SARCLA 20.10.2026: "bring the
// workflow SARCLA | TICKET VALUE CALCULATION as a sub app on the hub"). For every ticket the workflow takes - a new
// ticket, or one entering ESO/TSA "Waiting on customer" or "In progress" - the hub works the value out with the
// workflow's own rules, at the moment the workflow runs, and puts it next to what the workflow wrote. Nothing is written
// to HubSpot. Overview, Tickets, How it works and Settings as UC tabs; figures from src/lib/ticketValue/model.ts.

import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, TRACK, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Row, RunInfo, Settings } from "@/lib/ticketValue/engine";
import type { Jobs } from "@/lib/ticketValue/live";
import type { Measure, Values, Verdict } from "@/lib/ticketValue/model";
import { HUB_RULES, REENROL_STAGES } from "@/lib/ticketValue/rules";

type BetterInfo = { firstOrder: number | null; firstOrderMedian: number | null; firstOrderN: number; firstOrderAt: string | null; pricedArticles: number; firstOrderProgress: { done: number; of: number } | null };
type LiveInfo = { workflowOn: boolean | null; writing: boolean; jobs: Jobs | null };
type Data = { settings: Settings; last: RunInfo | null; everyMinutes: number; days: number; rows: Row[]; totalRows: number; measure: Measure; better?: BetterInfo; live?: LiveInfo; admin: boolean };
/** The hub writes: live switched on and the workflow off in HubSpot. */
const writing = (d: Data) => !!d.live?.writing;
type View = "overview" | "tickets" | "how" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", how: "#how-it-works", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const small = { fontSize: "0.8rem" } as const;

/** Where a value comes from, in words (sales_potential_source). */
const SOURCE: Record<string, string> = {
  direct_field: "on the ticket",
  child_gqs: "its GQS ticket",
  text_qty_price: "quantity × price in the text",
  product_lookup: "article × quantity",
  company_baseline: "the company's potential",
  unknown: "no signal (0)",
  unqualified: "not a sales ticket",
  manual_override: "typed by a person",
  "(none)": "no value",
};
const srcLabel = (s: string | null | undefined) => SOURCE[s ?? "(none)"] ?? s ?? "no value";
const BRANCH: Record<string, string> = {
  score: "Scored by its Python step", erosion: "Erosion ticket: its erosion amount", sept: "September push: its target",
  pricecheck: "Price check: left as it is", newcustomer: "New customer: left as it is", "not taken": "Stage entry the workflow does not take again",
};
const VERDICT: Record<Verdict, { label: string; tint: Tint }> = {
  agree: { label: "same", tint: "green" }, differ: { label: "different", tint: "amber" }, missed: { label: "workflow wrote nothing", tint: "pink" },
  pending: { label: "waiting for the workflow", tint: "slate" }, error: { label: "could not be read", tint: "pink" },
  live: { label: "written", tint: "green" },
};
/** A ticket's status chip: the copy's verdict, or what the hub wrote. */
function StatusChip({ r }: { r: Row }) {
  if (r.verdict !== "live") return <Chip tint={VERDICT[r.verdict].tint}>{VERDICT[r.verdict].label}</Chip>;
  if (r.written?.error) return <Chip tint="pink">not written</Chip>;
  return r.written?.changed ? <Chip tint="green">written</Chip> : <Chip tint="slate">no change</Chip>;
}
const amount = (v: string | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("de-CH", { maximumFractionDigits: 2 }) : v;
};
/** The amount, and where it comes from under it. */
function ValueCell({ v, label }: { v: Values; label?: string }) {
  if (!v.sales_potential_source && !v.sales_potential_estimate) return <Box component="span" sx={{ color: FAINT }}>no value</Box>;
  return (
    <Box>
      <Box sx={{ fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{amount(v.sales_potential_estimate)}</Box>
      <Box sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{label ?? srcLabel(v.sales_potential_source)}</Box>
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
/** The hub's value: the amount, the path that gave it, its confidence. */
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
const valueText = (v: Values) => v.sales_potential_source || v.sales_potential_estimate ? `${amount(v.sales_potential_estimate)} · ${srcLabel(v.sales_potential_source)}` : "no value";

function Period({ days, onChange, live }: { days: number; onChange: (n: number) => void; live: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{live ? "Tickets valued" : "Tickets taken by the workflow"}</Typography>
      <Choice<"1" | "7" | "14" | "21"> value={String(days) as "1" | "7" | "14" | "21"} onChange={(k) => onChange(Number(k))} options={[
        { key: "1", label: "Today" }, { key: "7", label: "Last 7 days" }, { key: "14", label: "Last 14 days" }, { key: "21", label: "Last 21 days" },
      ]} />
    </Box>
  );
}

// ---------------------------------------------------------------- Overview

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

function Overview({ d }: { d: Data }) {
  const m = d.measure;
  const byRule = m.byRule ?? [], byConf = m.byConfidence ?? [];
  const live = writing(d);
  const conf = (c: string) => byConf.find((x) => x.confidence === c) ?? { n: 0, value: 0 };
  const total = byConf.reduce((t, x) => t + x.value, 0);
  const kpis = [
    { label: "ESO and TSA tickets", value: full(m.valued ?? 0), note: live ? `${full(m.live ?? 0)} handled, ${full(m.written ?? 0)} written` : `${full(m.checked)} the workflow took${m.pending ? `, ${full(m.pending)} waiting` : ""}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "Their value", value: full(Math.round(m.valueBetter ?? m.valueHub)), note: live ? "What the hub gives them" : `With the hub's rules; the workflow left ${full(Math.round(m.valueWorkflow))}`, icon: <PaidOutlinedIcon />, tint: "purple" as const },
    { label: "High confidence", value: full(conf("high").n), note: `${full(Math.round(conf("high").value))} of the value - on the ticket or the customer's own data`, icon: <AutoFixHighOutlinedIcon />, tint: "green" as const },
    { label: "Medium / low", value: `${full(conf("medium").n)} / ${full(conf("low").n)}`, note: "Worked out from articles / estimated from averages", icon: <EditNoteOutlinedIcon />, tint: "amber" as const },
    live
      ? { label: "Written", value: full(m.written ?? 0), note: `of ${full(m.live ?? 0)} tickets - only what changes is written`, icon: <EditNoteOutlinedIcon />, tint: "slate" as const }
      : { label: "The copy matches the workflow", value: m.agreeShare === null ? "—" : `${Math.round(m.agreeShare * 100)}%`, note: `${full(m.agree)} of ${full(m.checked)} - the check of the move`, icon: <CompareArrowsOutlinedIcon />, tint: "slate" as const },
  ];
  const order = HUB_RULES.map((x) => x.rule as string);
  const paths = [...byRule].sort((x, y) => order.indexOf(x.rule) - order.indexOf(y.rule));
  return (
    <>
      {live ? (
        <Info>
          Live - the hub writes each ESO and TSA ticket&apos;s sales potential: the value an automated ticket already carries, or the first rule on
          the path that finds one, with how sure it is (How it works). Only what changes is written; every change is kept with what was there before.
        </Info>
      ) : (
        <Info>
          Shadow mode - nothing is written to HubSpot. For every ESO and TSA ticket the workflow takes, the hub works the value out with its own
          rules: the value an automated ticket already carries, or the first rule on the path that finds one (How it works). Next to it runs an exact
          copy of the workflow, checked against what the workflow writes - the proof that nothing is lost when the hub takes over.
        </Info>
      )}
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <GlassCard>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Where each value comes from" note="The hub's rules: the path that gave the value, how many tickets, how much, and how sure" />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Path", "The value is", "Confidence", "Tickets", "Value", "Per ticket"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i > 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {paths.map((x) => {
                const r = ruleOf(x.rule);
                return (
                  <TableRow key={x.rule}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}>{r?.label ?? x.rule}{r?.automated ? <Box component="span" sx={{ color: FAINT, fontWeight: 400 }}> · automated</Box> : null}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{r?.from ?? ""}</TableCell>
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
        {!paths.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No ticket yet - the first come within minutes.</Typography>}
        {(m.earlier ?? 0) > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1 }}>{full(m.earlier)} tickets looked at before the hub recorded the path (21.10, 12:29) are left out of these figures.</Typography>}
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="green" title="By confidence" note="How sure the hub is of its values" />
            <SmallTable head={["Confidence", "Tickets", "Value", "Share"]} rows={byConf.map((x) => [x.confidence, x.n, Math.round(x.value), pct(x.value, total)])} />
          </GlassCard>
        </Grid>
        {!live && (
          <Grid size={{ xs: 12, lg: 7 }}>
            <GlassCard sx={{ height: "100%" }}>
              <CardTitle icon={<AccountTreeOutlinedIcon />} tint="blue" title="The copy by pipeline" note="Every ticket the workflow took, the exact copy against what the workflow wrote" />
              <SmallTable head={["Pipeline", "Compared", "Same", "Different", "Wrote nothing"]} rows={m.byPipeline.map((x) => [x.pipeline, x.checked, x.agree, x.differ, x.missed])} />
            </GlassCard>
          </Grid>
        )}
      </Grid>
      {!live && <GlassCard>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title="Where the copy is not the same" note="What the workflow wrote, and what the exact copy of it gives, for the tickets that differ" />
        {m.pairs.length ? <SmallTable head={["Workflow wrote", "The copy gives", "Tickets"]} rows={m.pairs.slice(0, 10).map((x) => [srcLabel(x.workflow), srcLabel(x.hub), x.n])} />
          : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{m.checked ? "Every ticket compared has the same value." : "Nothing compared yet."}</Typography>}
      </GlassCard>}
    </>
  );
}

// ---------------------------------------------------------------- Tickets

function Detail({ r }: { r: Row }) {
  const line = (label: string, text: React.ReactNode) => <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>{label}</b> {text}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      {r.late && <Typography sx={{ ...small, color: MUTED }}>Looked at late (the first day&apos;s replay): the ticket&apos;s company and figures may have changed since the workflow ran.</Typography>}
      {r.error && line("Error:", r.error)}
      {line("Taken because:", r.trigger === "created" ? "the ticket was created" : `it entered ${r.stage}${r.enrols ? "" : " - not taken again: its value was written between 10 days ago and yesterday"}`)}
      {line("Before:", valueText(r.before))}
      {r.hub && line("The hub:", <>{BRANCH[r.hub.branch] ?? r.hub.branch} - {r.hub.action}{r.hub.company ? ` · company ${r.hub.company}` : ""}{r.hub.link ? ` · would link the ticket to company ${r.hub.link}` : ""}</>)}
      {r.hub?.kpi && (r.hub.kpi.upsert.length > 0 || r.hub.kpi.archive.length > 0) && line("KPI object:", <>{r.hub.kpi.upsert.length ? `writes ${r.hub.kpi.upsert.map((x) => x.split("|")[1]).join(", ")}` : ""}{r.hub.kpi.archive.length ? `${r.hub.kpi.upsert.length ? "; " : ""}removes ${r.hub.kpi.archive.map((x) => x.split("|")[1]).join(", ")}` : ""}</>)}
      {r.hub?.better && line("The hub's rules:", <>{r.hub.better.rule === "not-eso-tsa" ? "no value - not an ESO or TSA ticket" : <>{valueText(r.hub.better.final)} · confidence {r.hub.better.final.sales_potential_confidence ?? "—"} · path: {ruleOf(r.hub.better.rule)?.label ?? "—"} ({r.hub.better.action}){r.hub.better.company ? ` · company ${r.hub.better.company}` : ""}</>}</>)}
      {line("The workflow:", r.verdict === "pending" ? "not read yet" : r.workflow.wrote ? `wrote ${valueText(r.workflow.final)} at ${when(r.workflow.at)} (${r.workflow.by === "code" ? "its Python step" : "its copy branch"})` : "wrote nothing")}
    </Box>
  );
}

type What = "differ" | "missed" | "improved" | "agree" | "pending" | "all";
const esoTsa = (r: Row) => r.pipeline === "ESO" || r.pipeline === "TSA";
const improvedRow = (r: Row) => !!r.hub?.better && r.hub.better.rule !== "not-eso-tsa" && JSON.stringify(r.hub.better.final) !== JSON.stringify(r.hub.final);
function LiveTickets({ d }: { d: Data }) {
  const [what, setWhat] = useState<"written" | "nochange" | "all">("written");
  const [open, setOpen] = useState<string | null>(null);
  const live = d.rows.filter((r) => r.verdict === "live" && esoTsa(r));
  const test = { written: (r: Row) => !!r.written?.changed, nochange: (r: Row) => !r.written?.changed, all: () => true };
  const rows = live.filter(test[what]);
  const { slice, pager } = usePaged(rows, 15);
  const l = d.last;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket" note={l ? `Last look ${when(l.at)}: ${full(l.found)} found, ${full(l.checked)} handled, ${full(l.written ?? 0)} written${l.error ? ` - ${l.error}` : ""}` : "Not run yet"} />
      <Box sx={{ mb: 1.5 }}>
        <Choice<"written" | "nochange" | "all"> value={what} onChange={setWhat} options={[
          { key: "written", label: "Written", count: live.filter(test.written).length }, { key: "nochange", label: "No change", count: live.filter(test.nochange).length }, { key: "all", label: "All", count: live.length },
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

function TicketsTab({ d }: { d: Data }) {
  const [what, setWhat] = useState<What>(d.measure.differ + d.measure.missed ? "differ" : "all");
  const [open, setOpen] = useState<string | null>(null);
  const [pipes, setPipes] = useState<"esotsa" | "all">("esotsa");
  const test: Record<What, (r: Row) => boolean> = {
    differ: (r) => r.verdict === "differ", missed: (r) => r.verdict === "missed", improved: improvedRow, agree: (r) => r.verdict === "agree", pending: (r) => r.verdict === "pending", all: () => true,
  };
  const inScope = d.rows.filter((r) => pipes === "all" || esoTsa(r));
  const rows = inScope.filter(test[what]);
  const { slice, pager } = usePaged(rows, 15);
  const count = (k: What) => inScope.filter(test[k]).length;
  const l = d.last;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket"
        note={`${d.totalRows > d.rows.length ? `The latest ${full(d.rows.length)} of ${full(d.totalRows)}. ` : ""}${l ? `Last look ${when(l.at)}: ${full(l.found)} found, ${full(l.checked)} new, ${full(l.settled)} compared${l.rechecked ? `, ${full(l.rechecked)} read again` : ""}${l.behind ? ` - catching up, at ${when(l.behind)}` : ""}${l.error ? ` - ${l.error}` : ""}` : "Not run yet"}`} />
      <Box sx={{ mb: 1.5 }}>
        <Choice<What> value={what} onChange={setWhat} options={[
          { key: "differ", label: "Different", count: count("differ") },
          { key: "missed", label: "Workflow wrote nothing", count: count("missed") },
          { key: "improved", label: "Improved by the hub", count: count("improved") },
          { key: "agree", label: "Same", count: count("agree") },
          { key: "pending", label: "Waiting", count: count("pending") },
          { key: "all", label: "All", count: inScope.length },
        ]} />
        <Box sx={{ mt: 1 }}>
          <Choice<"esotsa" | "all"> value={pipes} onChange={setPipes} options={[
            { key: "esotsa", label: "ESO and TSA", count: d.rows.filter(esoTsa).length }, { key: "all", label: "All pipelines - for the copy's check", count: d.rows.length },
          ]} />
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Taken because", "Workflow wrote", "The copy gives", "The hub: value, confidence, path", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((r) => (
              <Fragment key={r.key}>
                <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.at)}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(260) }}>{r.subject || r.ticketId}</Box>
                    <Box sx={{ fontSize: "0.74rem", color: MUTED }}>{r.pipeline || "—"}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, ...small, color: MUTED, minWidth: 90 }}>{r.trigger === "created" ? "created" : r.stage}</TableCell>
                  <TableCell sx={{ ...bodyCell, ...small }}>{r.verdict === "pending" ? "…" : r.workflow.wrote ? <ValueCell v={r.workflow.final} /> : <Box component="span" sx={{ color: FAINT }}>nothing</Box>}</TableCell>
                  <TableCell sx={{ ...bodyCell, ...small }}>{r.hub ? (JSON.stringify(r.hub.final) === JSON.stringify(r.before) ? <Box component="span" sx={{ color: FAINT }}>leaves it</Box> : <ValueCell v={r.hub.final} />) : <Box component="span" sx={{ color: FAINT }}>{r.enrols ? "—" : "not taken"}</Box>}</TableCell>
                  <TableCell sx={{ ...bodyCell, ...small }}>{r.hub?.better ? <HubCell v={r.hub.better.final} rule={r.hub.better.rule} /> : <Box component="span" sx={{ color: FAINT }}>—</Box>}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><StatusChip r={r} />{r.late ? <> <Chip tint="slate">late</Chip></> : null}</TableCell>
                </TableRow>
                {open === r.key && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}><Detail r={r} /></TableCell>
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

function HowTab({ d }: { d: Data }) {
  const m = d.measure, bi: BetterInfo = d.better ?? { firstOrder: null, firstOrderMedian: null, firstOrderN: 0, firstOrderAt: null, pricedArticles: 0, firstOrderProgress: null };
  const n = (k: string) => (m.byRule ?? []).find((x) => x.rule === k)?.n ?? 0;
  const auto = HUB_RULES.filter((x) => x.automated);
  const path = HUB_RULES.filter((x) => !x.automated && x.rule !== "not-eso-tsa");
  const requests = path.reduce((t, x) => t + n(x.rule), 0);
  const created = d.rows.filter((r) => r.trigger === "created").length, stage = d.rows.length - created;
  const tint = (c: string): Tint => CONF_TINT[c] ?? "slate";
  return (
    <>
      <Info>
        <b>In short.</b> The hub gives every ESO and TSA ticket a sales potential. An automated ticket (erosion, a push, a price check, a new
        registrant, a lost lead, a second purchase, an abandoned cart) takes the value its automation knows. A customer&apos;s request (e-mail,
        form, chat) takes the first rule on the path below that finds one. The <b>confidence</b> says how sure it is: <b>high</b> - written on the
        ticket or from the customer&apos;s own data; <b>medium</b> - worked out from articles and quantities, or from the customer&apos;s first
        order; <b>low</b> - an estimate from averages. A value a person typed is never overwritten. Tickets in other pipelines get no value.
      </Info>
      <GlassCard>
        <CardTitle icon={<ScheduleIcon />} tint="blue" title="When the value is worked out" note={writing(d) ? "Every 2 minutes, for the tickets of these moments" : "As the workflow: the same moments, the same 4 minutes' wait"} />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>A new ticket</b>, 4 minutes after it is created ({full(created)} in this period).</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>A ticket entering</b> {Object.values(REENROL_STAGES).join(", ")} - worked out again, unless its value was written between 10 days ago and yesterday ({full(stage)} in this period, {full(m.notTaken)} not worked out again).</Typography>
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="amber" title="Automated tickets: the value their automation gives" note="Checked first - a ticket of one of these kinds never goes down the path below unless its value is missing" />
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
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Customer requests: the path, in order" note={`E-mails, forms, chats - the first rule that finds a value wins (${full(requests)} tickets in this period)`} />
        <Box sx={{ maxWidth: 940 }}>
          {path.map((x, i) => (
            <Step key={x.rule} n={i + 1} tint={tint(x.confidence)} title={x.label} count={n(x.rule)} of={requests} last={i === path.length - 1}
              text={<>{x.from}{x.rule === "product" ? ". Products & Pricing's list price is per price unit (1, 100 or 1,000 pieces) and never says which - so the hub uses what the article really sold for. “1120036838 x 100”, “100 Stk”, “Menge: 100” count, and every article is added up." : x.rule === "company" ? ". The ticket is linked to the company when it was found through its contact or the e-mail domain." : ""}</>}
              aside={<Conf c={x.confidence} />} />
          ))}
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="green" title={writing(d) ? "What it writes" : "What it writes, once the hub takes over"} note={writing(d) ? "Every change kept with what was there before" : "In shadow mode nothing - the workflow still writes"} />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• On the ticket: <b>Sales potential estimate</b>, <b>its source</b> and <b>its confidence</b> - only when one of them changes.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The ticket&apos;s <b>link to its company</b>, when the company was found through the contact or the e-mail domain.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Rows in the <b>KPI object</b> (ticket created, value created, closed, won / lost, open) - the Customer journey KPIs read them.</Typography>
        </Box>
      </GlassCard>
      {!writing(d) && <GlassCard>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="slate" title="Why the hub does it differently from the workflow" note="What copying the workflow showed" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The workflow values every pipeline (Back Office, GQS, Special Prices too); the hub only ESO and TSA.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Price checks, new registrants, lost leads and second-purchase pushes got no value or the company&apos;s average (values like 0.75); the hub uses what each automation knows.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Products: it reads O-rings at the price per 100 as if per piece (100× too dear), uses one quantity for one article, and misses “Stk”.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• It takes the ticket&apos;s first company as HubSpot lists it, not the primary one - a ticket with two companies can get the wrong potential (0.02 instead of 9).</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Its step sometimes fails and leaves the ticket empty ({full(m.missed)} in this period); an erosion or push value typed over by a person is copied back at the next stage.</Typography>
        </Box>
      </GlassCard>}
    </>
  );
}

// ---------------------------------------------------------------- Settings

/** The two one-time jobs of going live, as far as they have come. */
function JobsCard({ j }: { j: Jobs }) {
  const line = (title: string, done: boolean, text: string) => (
    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
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

type Checked = {
  ticketId: string; subject: string; pipeline: string; now: Values; branchLabel: string; action: string; final: Values; changes: boolean;
  why: string | null; company: { id: string; via: string; mandant: string; yp: number; tickets12m: number } | null; link: string | null;
  lastWorkflowWrite: string | null; history: { prop: string; entries: { value: string | null; at: string | null; by: string }[] }[];
  /** the hub's own rules (missing from a server still on the first version) */
  better?: { rule?: string; ruleLabel?: string; action: string; final: Values; changes: boolean };
};

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
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow" | "live"> value={d.settings.mode} onChange={(m) => {
            if (!d.admin || m === d.settings.mode) return;
            if (m === "live" && !window.confirm("Switch Ticket value to live?\n\nThe hub starts writing as soon as the workflow SARCLA | TICKET VALUE CALCULATION is switched off in HubSpot - until then it waits.\n\nThen, once: every open ESO and TSA ticket is valued with the hub's rules, and the values the workflow left on Back Office, GQS and Special Prices tickets are cleared. Every change is kept with what was there before.")) return;
            void call("mode", "PUT", { mode: m });
          }} options={[{ key: "shadow", label: "Shadow - compare, write nothing" }, { key: "live", label: "Live - the hub writes" }, { key: "off", label: "Off" }]} />
          {d.settings.mode === "live" && (
            <Box sx={{ display: "grid", gap: 0.5 }}>
              <Typography sx={{ fontSize: "0.84rem", color: INK }}>
                <b>The workflow in HubSpot:</b> {d.live?.workflowOn === false ? "switched off" : d.live?.workflowOn ? "still on" : "could not be read"} ·{" "}
                <b>The hub:</b> {d.live?.writing ? `writing${d.settings.liveFrom ? ` since ${when(d.settings.liveFrom)}` : ""}` : "waiting - it writes nothing while the workflow is on"}
              </Typography>
              {!d.live?.writing && (
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                  Next: in HubSpot, Automation → Workflows → “SARCLA | TICKET VALUE CALCULATION” → switch it off. The hub sees it within 2 minutes and starts.
                </Typography>
              )}
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="outlined" size="small" disabled={!d.admin || !!busy} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            {busy === "run" && <CircularProgress size={14} />}
          </Box>
          {d.settings.mode !== "live" && (
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
              Shadow writes nothing. Live: the hub writes the value, its source and confidence, the company link and the KPI rows - once the workflow is switched off in HubSpot.
            </Typography>
          )}
          {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </GlassCard>
      {d.live?.jobs && <JobsCard j={d.live.jobs} />}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read only - what the workflow's rules give it now, next to what is on it. Nothing is stored" />
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
            <Typography sx={{ ...small, color: INK }}><b>On it now:</b> {valueText(c.now)}</Typography>
            <Typography sx={{ ...small, color: INK }}><b>The workflow&apos;s rules give:</b> {c.changes ? valueText(c.final) : "no change"} - {c.branchLabel}; {c.action}</Typography>
            {c.better && <Typography sx={{ ...small, color: INK }}><b>The hub&apos;s rules give:</b> {valueText(c.better.final)} · confidence {c.better.final.sales_potential_confidence ?? "—"} · path: {c.better.ruleLabel ?? "—"} ({c.better.action}){c.better.changes ? "" : " - already on the ticket"}</Typography>}
            {c.company && <Typography sx={{ ...small, color: INK }}><b>Company:</b> {c.company.id} (found through the {c.company.via}) · {c.company.mandant} · yearly potential {full(c.company.yp)} · {full(c.company.tickets12m)} tickets in 12 months{c.link ? " · the ticket would be linked to it" : ""}</Typography>}
            <Typography sx={{ ...small, color: MUTED }}>The workflow wrote last {when(c.lastWorkflowWrite)}.</Typography>
            <Box sx={{ overflowX: "auto", mt: 0.5 }}>
              <Table size="small">
                <TableHead><TableRow>{["Property", "Value", "When", "By"].map((h) => <TableCell key={h} sx={{ ...headCell, py: 0.5 }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {c.history.flatMap((h) => h.entries.map((e, i) => (
                    <TableRow key={`${h.prop}${i}`}>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: i ? FAINT : INK }}>{i ? "" : h.prop.replace("sales_potential_", "")}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>{h.prop.endsWith("source") ? srcLabel(e.value) : h.prop.endsWith("estimate") ? amount(e.value) : e.value ?? "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, whiteSpace: "nowrap" }}>{when(e.at)}</TableCell>
                      <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: MUTED }}>{e.by}</TableCell>
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
  const url = `/api/uc/ticket-value?days=${days}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = () => setN((x) => x + 1);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ticket value" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={again} />;
  else if (view === "tickets") body = writing(r.data) ? <LiveTickets key={`l${days}`} d={r.data} /> : <TicketsTab key={`${days}`} d={r.data} />;
  else if (view === "how") body = <HowTab d={r.data} />;
  else body = <Overview d={r.data} />;
  const ok = r?.state === "ok" ? r.data : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ticket value"
        subtitle=""
        badge={ok?.live?.writing ? "Live" : ok?.settings.mode === "live" ? "Live - waiting for the workflow to be off" : "Shadow mode"}
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="ticketvalue" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: ok ? full(ok.measure.differ + ok.measure.missed) : null },
          { id: "how", label: "How it works", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {view !== "settings" && <Period days={days} onChange={setDays} live={!!ok && writing(ok)} />}
      <Box id={`ticketvalue-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
