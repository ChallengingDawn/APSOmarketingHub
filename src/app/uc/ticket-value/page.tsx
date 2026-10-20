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
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
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
import type { Measure, Values, Verdict } from "@/lib/ticketValue/model";
import { COMPANY_WIN_RATE, REENROL_STAGES } from "@/lib/ticketValue/rules";

type BetterInfo = { firstOrder: number | null; firstOrderMedian: number | null; firstOrderN: number; firstOrderAt: string | null; pricedArticles: number; firstOrderProgress: { done: number; of: number } | null };
type Data = { settings: Settings; last: RunInfo | null; everyMinutes: number; days: number; rows: Row[]; totalRows: number; measure: Measure; better?: BetterInfo; admin: boolean };
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
};
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
/** Where the hub's own rules give another value than the copy, by the workflow branch the ticket took. */
const IMPROVED: Record<string, string> = { pricecheck: "price checks", newcustomer: "new registrants", score: "scored tickets", erosion: "erosion", sept: "September push" };
const valueText = (v: Values) => v.sales_potential_source || v.sales_potential_estimate ? `${amount(v.sales_potential_estimate)} · ${srcLabel(v.sales_potential_source)}` : "no value";

function Period({ days, onChange }: { days: number; onChange: (n: number) => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Tickets taken by the workflow</Typography>
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
  const kpis = [
    { label: "Tickets compared", value: full(m.checked), note: `${full(m.pending)} waiting for the workflow${m.late ? `, ${full(m.late)} looked at late (left out)` : ""}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "The copy matches the workflow", value: m.agreeShare === null ? "—" : `${Math.round(m.agreeShare * 100)}%`, note: `${full(m.agree)} of ${full(m.checked)}; ${full(m.differ)} different, ${full(m.missed)} the workflow left empty`, icon: <CompareArrowsOutlinedIcon />, tint: "green" as const },
    { label: "The hub improves", value: full(m.improved ?? 0), note: m.improvedBy?.length ? m.improvedBy.map((x) => `${IMPROVED[x.branch] ?? x.branch} ${full(x.n)}`).join(", ") : "Its own rules give the same as the copy", icon: <AutoFixHighOutlinedIcon />, tint: "amber" as const },
    { label: "Value: the workflow", value: full(Math.round(m.valueWorkflow)), note: "What the workflow left on these tickets", icon: <PaidOutlinedIcon />, tint: "slate" as const },
    { label: "Value: the hub", value: full(Math.round(m.valueBetter ?? m.valueHub)), note: "With the hub's own rules - what it would leave", icon: <PaidOutlinedIcon />, tint: "purple" as const },
  ];
  return (
    <>
      <Info>
        Shadow mode - nothing is written to HubSpot. Each time the workflow <b>SARCLA | TICKET VALUE CALCULATION</b> takes a ticket, the hub works the
        value out twice, at the moment the workflow runs: with the workflow&apos;s rules copied exactly (<b>the copy</b> - compared with what the workflow
        wrote 20 minutes later) and with <b>the hub&apos;s own rules</b> (price checks, new registrants, products at the price they sell for, the primary
        company - see How it works). When the copy agrees, the hub can take over with its own rules and the workflow can be switched off.
      </Info>
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title="Where the copy is not the same" note="What the workflow wrote, and what the hub's exact copy of it gives, for the tickets that differ" />
            {m.pairs.length ? <SmallTable head={["Workflow wrote", "The copy gives", "Tickets"]} rows={m.pairs.slice(0, 12).map((x) => [srcLabel(x.workflow), srcLabel(x.hub), x.n])} />
              : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{m.checked ? "Every ticket compared has the same value." : "Nothing compared yet - the first tickets come within 25 minutes."}</Typography>}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<AccountTreeOutlinedIcon />} tint="blue" title="By pipeline" note="Tickets compared per pipeline" />
            <SmallTable head={["Pipeline", "Compared", "Same", "Different", "Wrote nothing"]} rows={m.byPipeline.map((x) => [x.pipeline, x.checked, x.agree, x.differ, x.missed])} />
          </GlassCard>
        </Grid>
      </Grid>
      <GlassCard>
        <CardTitle icon={<EditNoteOutlinedIcon />} tint="purple" title="Where the values come from" note="The value's source after the run - as the workflow left it, and as the hub's exact copy would" />
        <SmallTable head={["Source", "Workflow", "The copy"]} rows={m.bySource.map((x) => [srcLabel(x.source), x.workflow, x.hub])} />
      </GlassCard>
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
      {r.hub?.better && line("The hub's rules:", <>{improvedRow(r) ? valueText(r.hub.better.final) : "the same as the copy"} - {r.hub.better.action}{r.hub.better.company && r.hub.better.company !== r.hub.company ? ` · company ${r.hub.better.company}` : ""}</>)}
      {line("The workflow:", r.verdict === "pending" ? "not read yet" : r.workflow.wrote ? `wrote ${valueText(r.workflow.final)} at ${when(r.workflow.at)} (${r.workflow.by === "code" ? "its Python step" : "its copy branch"})` : "wrote nothing")}
    </Box>
  );
}

type What = "differ" | "missed" | "improved" | "agree" | "pending" | "all";
const improvedRow = (r: Row) => !!r.hub?.better && JSON.stringify(r.hub.better.final) !== JSON.stringify(r.hub.final);
function TicketsTab({ d }: { d: Data }) {
  const [what, setWhat] = useState<What>(d.measure.differ + d.measure.missed ? "differ" : "all");
  const [open, setOpen] = useState<string | null>(null);
  const test: Record<What, (r: Row) => boolean> = {
    differ: (r) => r.verdict === "differ", missed: (r) => r.verdict === "missed", improved: improvedRow, agree: (r) => r.verdict === "agree", pending: (r) => r.verdict === "pending", all: () => true,
  };
  const rows = d.rows.filter(test[what]);
  const { slice, pager } = usePaged(rows, 15);
  const count = (k: What) => d.rows.filter(test[k]).length;
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
          { key: "all", label: "All", count: d.rows.length },
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Taken because", "Workflow wrote", "The copy gives", "The hub's rules", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
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
                  <TableCell sx={{ ...bodyCell, ...small }}>{r.hub?.better ? (improvedRow(r) ? <ValueCell v={r.hub.better.final} label={r.hub.branch === "newcustomer" ? "average first order" : undefined} /> : <Box component="span" sx={{ color: FAINT }}>same</Box>) : <Box component="span" sx={{ color: FAINT }}>—</Box>}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={VERDICT[r.verdict].tint}>{VERDICT[r.verdict].label}</Chip>{r.late ? <> <Chip tint="slate">late</Chip></> : null}</TableCell>
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
  const imp = (k: string) => (m.improvedBy ?? []).find((x) => x.branch === k)?.n ?? 0;
  const br = (k: string) => m.byBranch.find((x) => x.branch === k)?.n ?? 0;
  const src = (k: string) => m.scoredBySource.find((x) => x.source === k)?.n ?? 0;
  const all = m.checked;
  const scored = br("score");
  return (
    <>
      <Info>
        The workflow <b>SARCLA | TICKET VALUE CALCULATION</b> (HubSpot flow 4326395107, its Python step &quot;Sales potential scorer v2&quot;), step by step -
        the hub runs the same rules. The numbers are the tickets of the period, as the hub&apos;s copy sees them.
      </Info>
      <GlassCard>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="When a ticket is taken, and which way it goes" note="Any pipeline; the Python step only works on ESO, TSA, GQS, Special Prices and Back Office" />
        <Box sx={{ maxWidth: 900 }}>
          <Step n={1} tint="blue" title="A ticket is created, or enters a stage" count={all} of={all}
            text={<>Every new ticket, and a ticket entering {Object.values(REENROL_STAGES).join(", ")}. On a stage entry only when its value is unknown, was written since yesterday, or not in the last 10 days ({full(br("not taken"))} were not taken again). The workflow waits 4 minutes, then goes on.</>} />
          <Step n={2} tint="amber" title="Erosion and September push tickets" count={br("erosion") + br("sept")} of={all}
            text="An erosion ticket takes its erosion amount (erosion_amount_2025), a September push ticket its target - source “on the ticket”, confidence high. Copied again at every stage entry." />
          <Step n={3} tint="slate" title="Price checks and new customers" count={br("pricecheck") + br("newcustomer")} of={all}
            text="A price-check ticket, and a ticket tagged as a new customer, are left as they are - they get no value from the workflow." />
          <Step n={4} tint="purple" title="Scored by the Python step" count={scored} of={all} last
            text="Every other ticket in ESO, TSA, GQS, Special Prices or Back Office: the first rule below that gives a value wins. A value typed by a person is never overwritten, and a ticket marked as not a sales ticket stays so." />
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<EditNoteOutlinedIcon />} tint="purple" title="The scoring rules, in order" note="Of the tickets the Python step scored, how many each rule gave (the hub's copy)" />
        <Box sx={{ maxWidth: 900 }}>
          <Step n={1} tint="slate" title="Not a sales ticket" count={src("unqualified")} of={scored} text="Tagged BISPHENOL ACTION, or an NPS survey / follow-up / feedback in the subject: 0, “not a sales ticket”." />
          <Step n={2} tint="slate" title="Typed by a person" count={src("manual_override")} of={scored} text="A person changed the value in HubSpot last (its history): kept, marked “typed by a person”." />
          <Step n={3} tint="green" title="On the ticket" count={src("direct_field")} of={scored} text="The ticket's own Order potential, or “Abandoned cart 123 €” in the subject - confidence high." />
          <Step n={4} tint="green" title="Its GQS ticket" count={src("child_gqs")} of={scored} text="A GQS ticket linked to it with an Order potential (the special request holds the real value) - confidence high." />
          <Step n={5} tint="blue" title="Quantity × price in the text" count={src("text_qty_price")} of={scored} text="A quantity with a word (pcs, Stück, pièces, pezzi…) and a price per piece in the e-mail - confidence medium." />
          <Step n={6} tint="blue" title="Article × quantity, list price" count={src("product_lookup")} of={scored} text="An article number (from an apsoparts.com link or 10 digits) and a quantity: the article's scale price or list price in Products & Pricing (M100 or M110 by the company), per sales unit - confidence medium." />
          <Step n={7} tint="amber" title="The company's potential" count={src("company_baseline")} of={scored}
            text={<>The ticket&apos;s company - else the company of its contact, else a company with the contact&apos;s e-mail domain (the ticket is then linked to it): yearly customer potential × {Math.round(COMPANY_WIN_RATE * 100)}% ÷ its tickets of the last 12 months (÷ 12 when that is not filled) - confidence low.</>} />
          <Step n={8} tint="slate" title="No signal" count={src("unknown")} of={scored} last text="None of the above: 0, “no signal”, confidence low." />
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="green" title="What it writes" note="The workflow today; the hub the same once it takes over" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>Sales potential estimate</b>, <b>its source</b> and <b>its confidence</b> on the ticket - only when the value or the source changes.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The ticket&apos;s <b>link to a company</b>, when the company was found through its contact or the e-mail domain ({full(m.links)} in this period).</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Rows in the <b>KPI object</b> (sales_funnel): ticket created, value created, GQS, Special Prices, closed, won / lost value, open, typed by a person - the hub&apos;s Customer journey KPIs read them.</Typography>
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<AutoFixHighOutlinedIcon />} tint="amber" title="What the hub does better" note="Its own rules - what it writes once it takes over; the copy above stays as the check against the workflow" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>Price checks</b> get a value: the articles and quantities the customer priced × what each article sells for per piece - “article × quantity”, confidence high. Articles that never sold are left out. ({full(imp("pricecheck"))} in this period)</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>New registrants</b> get the average first order of a new customer{bi.firstOrder ? <>: <b>{full(Math.round(bi.firstOrder))}</b> (median {full(Math.round(bi.firstOrderMedian ?? 0))}, the first orders of the newest {full(bi.firstOrderN)} customers of the last 12 months, worked out {when(bi.firstOrderAt)})</> : bi.firstOrderProgress ? ` - being worked out: ${bi.firstOrderProgress.done} of ${bi.firstOrderProgress.of} customers read` : " - worked out within the hour"}; confidence low. ({full(imp("newcustomer"))} in this period)</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• <b>Products</b> at the price they sell for: Products &amp; Pricing&apos;s list price is per price unit (1, 100 or 1,000 pieces) and never says which, so the copy reads O-rings 100× too dear. The hub takes each article&apos;s own price per piece from its sales this year and last ({full(bi.pricedArticles)} articles), gives each article the quantity on its own line (“1120036838 x 100”, “100 Stk”), adds every article of the e-mail up, and counts Stk, pz, szt and ks as pieces.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The ticket&apos;s <b>primary</b> company, not the first one HubSpot lists. ({full(imp("score"))} scored tickets get another value in this period, products and company together)</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• It runs on every ticket the workflow takes - none is left empty because a step failed.</Typography>
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<LightbulbOutlinedIcon />} tint="amber" title="What the comparison shows about the workflow" note="Found while copying it - for when the hub takes over" />
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• It takes the ticket&apos;s <b>first</b> company as HubSpot lists it (the lowest id), not the primary one - a ticket with two companies can get the other company&apos;s potential.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• It scores 4 minutes after the ticket is created, often before the ticket&apos;s company is linked; the value is only worked out again when the ticket enters one of the four stages.</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• Price checks and new-customer tickets never get a value; on a few tickets a day the workflow writes nothing where its rules give a value ({full(m.missed)} in this period).</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>• The &quot;closed&quot; and &quot;won / lost&quot; KPI rows are only written when the workflow happens to run on the day a ticket closes - closing a ticket does not start it.</Typography>
        </Box>
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------- Settings

type Checked = {
  ticketId: string; subject: string; pipeline: string; now: Values; branchLabel: string; action: string; final: Values; changes: boolean;
  why: string | null; company: { id: string; via: string; mandant: string; yp: number; tickets12m: number } | null; link: string | null;
  lastWorkflowWrite: string | null; history: { prop: string; entries: { value: string | null; at: string | null; by: string }[] }[];
  /** the hub's own rules (missing from a server still on the first version) */
  better?: { action: string; final: Values; changes: boolean };
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
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes; nothing is written to HubSpot in shadow mode`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow"> value={d.settings.mode} onChange={(m) => d.admin && void call("mode", "PUT", { mode: m })} options={[{ key: "shadow", label: "Shadow - compare, write nothing" }, { key: "off", label: "Off" }]} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="outlined" size="small" disabled={!d.admin || !!busy} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            {busy === "run" && <CircularProgress size={14} />}
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
            No live mode yet: the hub takes over from the workflow once the comparison is clean - then the workflow is switched off in HubSpot and the hub writes the value, the company link and the KPI rows itself.
          </Typography>
          {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </GlassCard>
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
            {c.better && <Typography sx={{ ...small, color: INK }}><b>The hub&apos;s rules give:</b> {c.better.changes ? valueText(c.better.final) : "no change"} - {c.better.action}</Typography>}
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
  else if (view === "tickets") body = <TicketsTab key={`${days}`} d={r.data} />;
  else if (view === "how") body = <HowTab d={r.data} />;
  else body = <Overview d={r.data} />;
  const ok = r?.state === "ok" ? r.data : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ticket value"
        subtitle="Each ticket's sales potential - the workflow SARCLA | TICKET VALUE CALCULATION, side by side with the hub (shadow mode)"
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
      {view !== "settings" && <Period days={days} onChange={setDays} />}
      <Box id={`ticketvalue-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
