"use client";

// CERTIFICATES - a HubSpot app (UC & HubSpot Apps > HubSpot apps). The Back Office's certificate requests: AVOR for a
// new EC 1935/2004 article, the Back Office, the conformity experts, the reminders and the 15-day hand-over - run by
// the hub every 3 minutes in place of the workflow SARCLA | CERTIFICATES NEW PROCESS (SARCLA 04.11.2026: "migrate ASAP
// this certificates process to the hub as a sub-app, follow the logic"). Overview = the figures and the process drawn
// with where each open ticket stands; Tickets; Activity = what the hub did (or, in Preview, would do); Settings.
// 05.11.2026 ("migrate the rest of certificates"): the Back Office's reminders of the workflow Back Office Ticket Remind
// too, from the moment that workflow no longer takes certificate tickets - Settings shows the switch-over.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
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
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { Mode, OpenTicket, OthersRow, RemindState, Row, RunInfo, Settings, Stats } from "@/lib/certificates/engine";
import { STEP_WORDS, type Phase, type StepName } from "@/lib/certificates/rules";

type Data = {
  settings: Settings; last: RunInfo | null; rows: Row[]; open: OpenTicket[]; stats: Stats | null;
  names: Record<string, string>; choices: { id: string; name: string }[];
  workflowOn: boolean | null; writing: boolean; offAt: string; admin: boolean;
  /** Back Office Ticket Remind: still mailing (takesCerts), or the hub's since offAt; null = not readable */
  remind: (RemindState & { offAt: string | null }) | null; mailReady: boolean;
  /** the Backoffice Team's reminder on every other ticket: the hub's since offAt (the workflow switched off) */
  others: { offAt: string | null; rows: OthersRow[] };
};
type View = "overview" | "tickets" | "activity" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", activity: "#activity", settings: "#settings" };

const PHASE: Record<Phase, { label: string; tint: Tint }> = {
  start: { label: "New request", tint: "slate" },
  avor: { label: "AVOR - new article", tint: "amber" },
  backOffice: { label: "Back Office", tint: "blue" },
  merged: { label: "Back Office (merged)", tint: "blue" },
  expert: { label: "Conformity expert", tint: "purple" },
  sent: { label: "Sent out", tint: "green" },
};
const STAGE_LABEL: Record<string, string> = {
  "2338266325": "New", "2554860732": "Redirected from Chat/Helpline", "2338266326": "Assigned", "2473210048": "Waiting on Customer",
  "2726922455": "Waiting Internally", "2728031473": "Customer/Internal replied", "5948837104": "CHAT/C2S Issue",
  "2338266327": "Remind Back Office", "3640065212": "Certificates", "2338266328": "Resolved",
};
const LATE: StepName[] = ["late", "late96", "lateWeek", "lateRose", "bo48", "bo96", "boWeek", "boRose"];
const isLate = (t: OpenTicket) => !!t.step && LATE.includes(t.step);
const BO_STEPS: StepName[] = ["bo3days", "boToday", "bo48", "bo96", "boWeek", "boRose"];
const REMIND_NAME = "Back Office Ticket Remind | Notification";

// ---------------- the process, drawn ----------------
/** The box of the drawing a ticket sits in. */
function boxOf(t: OpenTicket): string {
  if (t.phase === "start") return "start";
  if (t.phase === "avor") return t.step ?? "avor";
  if (t.phase === "backOffice" || t.phase === "merged") return t.step && BO_STEPS.includes(t.step) ? t.step : "bo";
  if (t.phase === "expert") return !t.step || t.step === "expert-entry" ? "expert" : t.step;
  return "sent";
}
type Box_ = { id: string; label: string; when: string; tint: Tint };
const LANES: { title: string; who: string; tint: Tint; boxes: Box_[]; then?: string }[] = [
  { title: "New request", who: "Back Office creates it, with the certificates", tint: "slate", then: "EC 1935/2004 -> AVOR, else -> Back Office", boxes: [
    { id: "start", label: "Started by the hub", when: "within 3 min", tint: "slate" },
  ] },
  { title: "AVOR", who: "Owner = the requester; a new article number first", tint: "amber", then: "Article received", boxes: [
    { id: "avor", label: "Waiting for the new article", when: "set", tint: "amber" },
    { id: "avor48", label: "48 h - remind AVOR", when: "+48 h", tint: "amber" },
    { id: "avor96", label: "96 h - remind AVOR", when: "+96 h", tint: "amber" },
    { id: "avorWeek", label: "Over a week", when: "+6 days", tint: "pink" },
    { id: "avorRose", label: "To Rose Rasteiro + note", when: "+15 days", tint: "pink" },
  ] },
  { title: "Back Office", who: "Owner = next of the Back Office rotation; a mail to the owner at each reminder", tint: "blue", then: "Assign to Conformity Expert", boxes: [
    { id: "bo", label: "Certificates stage", when: "set", tint: "blue" },
    { id: "bo3days", label: "3 days before delivery - create the certificate", when: "delivery -3 days, 07:00", tint: "amber" },
    { id: "boToday", label: "Certificate due today", when: "delivery day, 07:00", tint: "amber" },
    { id: "bo48", label: "Due 48 hours ago", when: "+48 h", tint: "pink" },
    { id: "bo96", label: "Due 96 hours ago", when: "+48 h", tint: "pink" },
    { id: "boWeek", label: "More than a week", when: "+48 h", tint: "pink" },
    { id: "boRose", label: "To Rose Rasteiro + note", when: "+15 days", tint: "pink" },
  ] },
  { title: "Conformity expert", who: "Next of the experts' rotation, also owner", tint: "purple", then: "Sent out to customer and EDA", boxes: [
    { id: "expert", label: "With the expert", when: "set", tint: "purple" },
    { id: "today", label: "Delivery date is today", when: "delivery day, 05:00", tint: "amber" },
    { id: "late", label: "Certificate is late", when: "+48 h", tint: "pink" },
    { id: "late96", label: "96 hours yet not sent", when: "+48 h", tint: "pink" },
    { id: "lateWeek", label: "Over a week, not sent", when: "+48 h", tint: "pink" },
    { id: "lateRose", label: "To Rose Rasteiro + note", when: "+15 days", tint: "pink" },
  ] },
  { title: "Done", who: "Plain subject, stage Resolved", tint: "green", boxes: [
    { id: "sent", label: "Sent out - Resolved", when: "at once", tint: "green" },
  ] },
];

function ProcessCard({ open, resolvedThisMonth, sel, onPick, remindByHub }: { open: OpenTicket[]; resolvedThisMonth: number | null; sel: string | null; onPick: (id: string | null) => void; remindByHub: boolean }) {
  const counts = new Map<string, number>();
  for (const t of open) counts.set(boxOf(t), (counts.get(boxOf(t)) ?? 0) + 1);
  return (
    <GlassCard>
      <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="The process, and where each open request stands"
        note={`Left to right, as the workflows ran it. The figure in a box = open requests there now - click a box for them.${remindByHub ? "" : ` The Back Office's reminders after the 3 days: still by HubSpot's ${REMIND_NAME} until the switch-over (Settings).`}`} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 1.25, alignItems: "stretch" }}>
        {LANES.map((lane, i) => (
          <Box key={lane.title} sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0, position: "relative", p: 1.25, borderRadius: "16px", bgcolor: TINT[lane.tint].bg + "66", border: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: TINT[lane.tint].fg }}>{i + 1}. {lane.title}</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 0.5, minHeight: { md: 30 } }}>{lane.who}</Typography>
            {lane.boxes.map((b) => {
              const n = b.id === "sent" ? resolvedThisMonth ?? 0 : counts.get(b.id) ?? 0;
              const on = sel === b.id;
              return (
                <Box key={b.id} component="button" type="button" onClick={() => onPick(on ? null : b.id)} disabled={b.id === "sent"} sx={{
                  all: "unset", cursor: b.id === "sent" ? "default" : "pointer", display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.75, borderRadius: "10px",
                  bgcolor: on ? TINT[b.tint].fg : "rgba(255,255,255,.85)", border: `1px solid ${on ? TINT[b.tint].fg : HAIRLINE}`,
                  "&:focus-visible": { outline: `2px solid ${TINT[b.tint].fg}`, outlineOffset: 2 },
                }}>
                  <Box sx={{ minWidth: 30, textAlign: "center", fontWeight: 800, fontSize: "1.05rem", fontVariantNumeric: "tabular-nums", color: on ? "#fff" : n ? TINT[b.tint].fg : FAINT }}>{full(n)}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: on ? "#fff" : INK, lineHeight: 1.2 }}>{b.label}</Typography>
                    <Typography sx={{ fontSize: "0.68rem", color: on ? "rgba(255,255,255,.85)" : FAINT }}>{b.id === "sent" ? "this month" : b.when}</Typography>
                  </Box>
                </Box>
              );
            })}
            {lane.then && (
              <Typography sx={{ mt: "auto", pt: 0.75, fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>
                → {lane.then}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}

// ---------------- tables ----------------
function TicketLink({ id, subject, max = 360 }: { id: string; subject: string | null; max?: number }) {
  return (
    <Box component="a" href={hsTicket(id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(max) }}>
      {subject || `Ticket ${id}`}
    </Box>
  );
}
const dueText = (d: string | null) => (d ? d.split("-").reverse().join(".") : "no date");

function TicketsTable({ rows, names, empty }: { rows: OpenTicket[]; names: Record<string, string>; empty: string }) {
  const { slice, pager } = usePaged(rows, 25);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Certificates", "Delivery", "Where it stands", "Owner", "Next step"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>{empty}</TableCell></TableRow>}
            {slice.map((t) => {
              const late = isLate(t);
              return (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    <TicketLink id={t.id} subject={t.subject} />
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{[t.company, t.order].filter(Boolean).join(" · ") || "-"}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{t.certs || "-"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: late ? RED : INK, fontWeight: late ? 700 : 400 }}>{dueText(t.due)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    <Chip tint={PHASE[t.phase].tint}>{PHASE[t.phase].label}</Chip>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }}>
                      {t.step ? STEP_WORDS[t.step].split(" - ")[0] : "started"} · {STAGE_LABEL[t.stage ?? ""] ?? t.stage ?? "-"}{t.remindStep ? " · by the Remind workflow" : t.workflowStep ? " · by the workflow" : ""}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {t.owner ? names[t.owner] ?? t.owner : "-"}
                    {t.phase === "expert" && t.expert && t.expert !== t.owner ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>expert {names[t.expert] ?? t.expert}</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    {t.next ? (
                      <>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>{when(t.next.at)}</Typography>
                        <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(280) }}>{STEP_WORDS[t.next.name]}{t.nextRemind ? " - by HubSpot's Remind workflow until the switch-over" : ""}</Typography>
                      </>
                    ) : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{t.due ? "nothing more - waits for the next action" : "no delivery date - nothing timed"}</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </>
  );
}

const WHAT: Record<Row["what"], { tint: Tint; label: string }> = { done: { tint: "green", label: "done" }, would: { tint: "blue", label: "would do (Preview)" }, failed: { tint: "pink", label: "failed - tried again" } };
function written(r: Row, names: Record<string, string>): string {
  const out: string[] = [];
  if (r.props.hs_pipeline_stage) out.push(`stage ${STAGE_LABEL[r.props.hs_pipeline_stage] ?? r.props.hs_pipeline_stage}`);
  if (r.props.hubspot_owner_id) out.push(`owner ${names[r.props.hubspot_owner_id] ?? r.props.hubspot_owner_id}`);
  if (r.props.conformity_expert) out.push(`expert ${names[r.props.conformity_expert] ?? r.props.conformity_expert}`);
  if (r.props.actions_for_certificates !== undefined) out.push(r.props.actions_for_certificates ? `action "${r.props.actions_for_certificates}"` : "action emptied");
  if (r.note) out.push("note");
  return out.join(" · ");
}
function ActivityTable({ rows, names }: { rows: Row[]; names: Record<string, string> }) {
  const { slice, pager } = usePaged(rows, 25);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Step", "Result", "Written"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nothing yet - the next step of an open request is under Tickets, with its time.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <TicketLink id={r.ticketId} subject={r.props.subject ?? r.subject} max={340} />
                  {r.props.subject && r.subject && r.props.subject !== r.subject ? <Typography sx={{ fontSize: "0.72rem", color: FAINT, ...clip(340) }}>was: {r.subject}</Typography> : null}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>{r.steps.map((s) => <Typography key={s} sx={{ fontSize: "0.78rem" }}>{STEP_WORDS[s]}</Typography>)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                  <Chip tint={WHAT[r.what].tint}>{WHAT[r.what].label}</Chip>
                  {r.error && <Typography sx={{ fontSize: "0.72rem", color: RED }}>{r.error}</Typography>}
                  {r.mail && <Typography sx={{ fontSize: "0.72rem", color: r.mailFailed ? RED : MUTED, mt: 0.25 }}>{r.mail}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED }}>{written(r, names) || "subject"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </>
  );
}

function OthersTable({ rows }: { rows: OthersRow[] }) {
  const { slice, pager } = usePaged(rows, 15);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Went to Remind", "Result"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={4} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>None yet - the next ticket to go to Remind Back Office shows here within 3 minutes.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.enteredAt}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketLink id={r.ticketId} subject={r.subject} max={420} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                  <Chip tint={WHAT[r.what].tint}>{r.what === "would" ? "would mail" : WHAT[r.what].label}</Chip>
                  <Typography sx={{ fontSize: "0.72rem", color: r.what === "failed" ? RED : MUTED, mt: 0.25 }}>{r.mail}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </>
  );
}

// ---------------- the tabs ----------------
function statusLine(d: Data): string {
  const wf = d.workflowOn === true ? "The workflow is switched ON again - the hub writes nothing while it runs." : d.workflowOn === false ? "The workflow is off." : "The workflow's state could not be read - the hub writes nothing.";
  const mode = d.settings.mode === "off" ? "Off - the hub does not look." : d.settings.mode === "preview" ? "Preview - every 3 minutes the hub works out each request's steps and lists them; it writes nothing." : d.writing ? "Live - every 3 minutes the hub takes each request's steps that fell due." : "Live, but not writing.";
  const last = d.last ? ` Last look ${when(d.last.at)}: ${full(d.last.tickets)} open requests${d.last.mailed ? `, ${full(d.last.mailed)} mailed` : ""}${d.last.error ? ` - failed: ${d.last.error}` : ""}.` : " Not looked yet.";
  return `${mode} ${wf} ${remindLine(d)}${last}`;
}
function remindLine(d: Data): string {
  if (!d.remind) return `The Back Office's reminders: ${REMIND_NAME} could not be read - the hub takes none of them now.`;
  if (d.remind.takesCerts) return `The Back Office's reminders after the 3 days: still by ${REMIND_NAME} (it mails the owner) - the switch-over is under Settings.`;
  return `The Back Office's reminders: the hub's${d.remind.offAt ? ` since ${when(d.remind.offAt)}` : ""} - ${d.remind.why}.`;
}

function Overview({ d }: { d: Data }) {
  const [sel, setSel] = useState<string | null>(null);
  const open = d.open;
  const now = Date.now();
  const in7 = open.filter((t) => t.due && Date.parse(`${t.due}T23:59:59`) >= now && Date.parse(`${t.due}T00:00:00`) <= now + 7 * 86400_000).length;
  const late = open.filter(isLate).length;
  const avor = open.filter((t) => t.phase === "avor").length;
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = d.stats?.months.find((m) => m.month === month) ?? null;
  const months = d.stats?.months ?? [];
  const shown = sel ? open.filter((t) => boxOf(t) === sel) : [];
  return (
    <>
      <Typography sx={{ fontSize: "0.84rem", color: d.workflowOn === true ? RED : MUTED }}>{statusLine(d)}</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="blue" label="Open requests" value={full(open.length)} note="in the process now" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ScheduleOutlinedIcon />} tint="amber" label="Waiting for AVOR" value={full(avor)} note="a new EC 1935/2004 article first" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<EventOutlinedIcon />} tint="purple" label="Delivery in 7 days" value={full(in7)} note="open, delivery date this week" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ReportProblemOutlinedIcon />} tint="pink" label="Late" value={full(late)} note="delivery date passed, no certificate sent yet" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Resolved this month" value={thisMonth ? full(thisMonth.resolved) : "—"} note={thisMonth ? `${full(thisMonth.created)} new this month` : "read every 30 min"} /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TimerOutlinedIcon />} tint="slate" label="Days to resolve" value={d.stats?.medianDays !== null && d.stats?.medianDays !== undefined ? String(d.stats.medianDays) : "—"} note={d.stats ? `median, ${full(d.stats.resolved90)} resolved in 90 days` : "read every 30 min"} /></Grid>
      </Grid>
      <ProcessCard open={open} resolvedThisMonth={thisMonth?.resolved ?? null} sel={sel} onPick={setSel} remindByHub={!!d.remind && !d.remind.takesCerts} />
      {sel && (
        <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 }, display: "flex", alignItems: "center", gap: 1 }}>
            <CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="blue" title={`${LANES.flatMap((l) => l.boxes).find((b) => b.id === sel)?.label ?? sel}: ${full(shown.length)} open`} note="Click the box again to close" />
          </Box>
          <TicketsTable rows={shown} names={d.names} empty="No open request at this step." />
        </GlassCard>
      )}
      {months.length > 0 && (
        <GlassCard>
          <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title="Certificate requests per month" note="Back Office tickets naming a certificate: created, and resolved, the last 13 months" />
          <GroupedColumns height={230} currentFirst currentLabel="New requests" priorLabel="Resolved" data={months.map((m) => ({ x: m.month.slice(2).split("-").reverse().join("."), current: m.created, prior: m.resolved, partial: m.month === month }))} />
        </GlassCard>
      )}
    </>
  );
}

function PeoplePicker({ label, ids, choices, names, single, onSave, disabled }: {
  label: string; ids: string[]; choices: { id: string; name: string }[]; names: Record<string, string>; single?: boolean;
  onSave: (ids: string[]) => void; disabled: boolean;
}) {
  const [add, setAdd] = useState("");
  return (
    <Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        {ids.map((id, i) => (
          <Box key={id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", fontSize: "0.8rem" }}>
            {single ? "" : `${i + 1}. `}{names[id] ?? `Owner ${id}`}
            {!single && ids.length > 1 && !disabled && (
              <Box component="button" type="button" aria-label={`Take ${names[id] ?? id} out`} onClick={() => onSave(ids.filter((x) => x !== id))} sx={{ all: "unset", cursor: "pointer", color: FAINT, px: 0.25, "&:hover": { color: RED } }}>×</Box>
            )}
          </Box>
        ))}
        {!disabled && (
          <Box component="select" value={add} aria-label={`${label}: add`} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const v = e.target.value; setAdd(""); if (v) onSave(single ? [v] : [...ids.filter((x) => x !== v), v]); }}
            sx={{ fontSize: "0.8rem", px: 1, py: 0.4, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", color: MUTED, maxWidth: 220 }}>
            <option value="">{single ? "Change…" : "Add…"}</option>
            {choices.filter((c) => !ids.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const call = async (method: "PUT" | "POST", body: object, done: (j: { ok: boolean; data?: RunInfo; error?: string }) => string) => {
    setBusy(method); setMsg(null);
    try {
      const r = await fetch("/api/uc/certificates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; data?: RunInfo; error?: string };
      setMsg(j.ok ? { ok: true, text: done(j) } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const save = (change: object) => call("PUT", change, () => "Saved - the next look (within 3 minutes) works this way.");
  const p = d.settings.people;
  return (
    <>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note="Every 3 minutes, on the open Back Office tickets that ask for a certificate" />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Mode</Typography>
            {d.admin ? (
              <Choice<Mode> value={d.settings.mode} onChange={(m) => void save({ mode: m })} options={[
                { key: "off", label: "Off" }, { key: "preview", label: "Preview - writes nothing" }, { key: "live", label: "Live - writes to HubSpot" },
              ]} />
            ) : <Chip tint={d.settings.mode === "live" ? "green" : "slate"}>{d.settings.mode}</Chip>}
          </Box>
          <Typography sx={{ fontSize: "0.82rem", color: d.workflowOn === true ? RED : MUTED }}>{statusLine(d)}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
            Live takes every step that falls due from {when(d.offAt)} - when the workflow SARCLA | CERTIFICATES NEW PROCESS was switched off. What fell due before was the workflow&apos;s, so the requests it held go on where they stood. Steps that fell due while in Preview are taken when Live is switched on.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" disabled={!!busy || d.settings.mode === "off"} onClick={() => void call("POST", { action: "run" }, (j) => `Looked: ${full(j.data?.tickets ?? 0)} open requests, ${full(j.data?.written ?? 0)} written, ${full(j.data?.listed ?? 0)} listed.`)}>
                {busy === "POST" ? <CircularProgress size={14} /> : "Look now"}
              </Button>
              {d.settings.by && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Last change: {d.settings.by}, {when(d.settings.at)}</Typography>}
            </Box>
          )}
          {msg && <Typography sx={{ fontSize: "0.82rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
        </Box>
      </GlassCard>
      <SwitchOverCard d={d} />
      <GlassCard>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="Who gets the requests" note="Each rotation hands the next request to the next person; people who left HubSpot are skipped" />
        <Box sx={{ display: "grid", gap: 1.75 }}>
          <PeoplePicker label="Back Office rotation (owner when a request starts or the article is received)" ids={p.backOffice} choices={d.choices} names={d.names} disabled={!d.admin || !!busy} onSave={(ids) => void save({ people: { backOffice: ids } })} />
          <PeoplePicker label="Conformity experts (rotation - expert and owner on Assign to Conformity Expert)" ids={p.experts} choices={d.choices} names={d.names} disabled={!d.admin || !!busy} onSave={(ids) => void save({ people: { experts: ids } })} />
          <PeoplePicker label="After 15 days without the certificate (owner, with the note)" ids={[p.escalation]} single choices={d.choices} names={d.names} disabled={!d.admin || !!busy} onSave={(ids) => void save({ people: { escalation: ids[0] } })} />
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<VerifiedOutlinedIcon />} tint="green" title="The workflow's logic, and what the hub puts right" note="SARCLA | CERTIFICATES NEW PROCESS (2959551709), step for step" />
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5, fontSize: "0.82rem", color: INK }}>
          <li>Kept as it was: every subject, stage, owner, rotation and time (Swiss time, 07:00 and 05:00), the 15-day hand-over to Rose Rasteiro with the note.</li>
          <li>Put right: the 96 h AVOR subject named the certificates twice.</li>
          <li>Put right: after the AVOR &quot;over a week&quot; wait the workflow sent the ticket to Rose even when the article had come - the hub moves it on to the Back Office.</li>
          <li>Put right: the expert&apos;s last wait waited for &quot;Article received&quot; in place of &quot;Sent out&quot;.</li>
          <li>Put right: &quot;Sent out&quot; set before the delivery date was missed and the ticket called late - the hub resolves it at once (the workflow also waited 48 h more on time).</li>
          <li>Put right: a merged ticket lost every later &quot;Assign to Conformity Expert&quot; (its merged branch emptied the action again).</li>
          <li>The company in the subject is the ticket&apos;s primary company - the workflow took the last-modified one, often A+P.</li>
          <li>The Back Office&apos;s reminders ({REMIND_NAME}), kept: the mail to the owner at 3 days, then due today, 48 h, 96 h, more than a week (subject and mail each), 15 days later to Rose Rasteiro.</li>
          <li>Put right: the reminders come on the delivery date (07:00) and after it - the workflow counted 72 h from the moment the ticket went to Remind, so a late article made &quot;due today&quot; days late.</li>
          <li>Put right: the expert no longer gets the Back Office&apos;s reminders - the expert&apos;s own &quot;today&quot; and &quot;late&quot; steps put the ticket back in Remind, and that workflow ran its Back Office chain again, mailing the expert &quot;please create it&quot; and writing over the expert&apos;s subjects.</li>
          <li>Put right: the last two mails said &quot;96 hours ago&quot; after a week.</li>
        </Box>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Still in HubSpot, next to it" note="Both stay on" />
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5, fontSize: "0.82rem", color: INK }}>
          <li><b>SARCLA | Back Office Ticket Created | Notification</b> - the way in: it sets the requester on a new certificate request (and the subject, owner and mail on every other Back Office ticket). Its step &quot;enrol in the certificates workflow&quot; does nothing now - the hub starts the request within 3 minutes, with the requester already set. The hub has its copy under Back Office distribution &gt; Settings (&quot;The way in&quot;): compared while the workflow runs, the hub&apos;s once it is switched off.</li>
          <li><b>{REMIND_NAME}</b> - {d.others.offAt ? "switched off: both its parts are the hub's - the certificate reminders and the reminder to the Backoffice Team." : d.remind && !d.remind.takesCerts ? "its certificates part is the hub's; its reminder to the Backoffice Team on every other ticket is the hub's once the workflow is switched off." : "its certificates branch (the mails to the owner after the 3 days) is the hub's from the switch-over above."}</li>
        </Box>
      </GlassCard>
    </>
  );
}

function SwitchOverCard({ d }: { d: Data }) {
  const r = d.remind;
  const hub = !!r && !r.takesCerts;
  const before = r?.offAt ? Date.parse(r.offAt) : Date.now();
  // in stage Remind since before the switch-over = enrolled in that workflow: they must leave it, or it mails them too
  const enrolled = d.open.filter((t) => t.stage === "2338266327" && (!t.remindAt || Date.parse(t.remindAt) < before))
    .sort((a, b) => (a.remindAt ?? "").localeCompare(b.remindAt ?? ""));
  return (
    <GlassCard>
      <CardTitle icon={<HistoryOutlinedIcon />} tint={hub ? "green" : "amber"} title={`The Back Office's reminders - ${hub ? "the hub's" : `still by ${REMIND_NAME}`}`}
        note={hub ? `Since ${when(r?.offAt ?? null)}: ${r?.why}. The hub mails the owner at each reminder.` : "One change in HubSpot hands them to the hub; the hub sees it within 3 minutes"} />
      <Box sx={{ display: "grid", gap: 1.25, fontSize: "0.82rem", color: INK }}>
        {!d.mailReady && <Typography sx={{ fontSize: "0.82rem", color: RED }}>The hub cannot send mail here (no SMTP credentials) - the reminders&apos; mails would not go out.</Typography>}
        {!r && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{REMIND_NAME} could not be read - the hub takes none of its reminders until it can.</Typography>}
        {!hub && (
          <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5, listStyleType: "decimal", "& > li": { display: "list-item" } }}>
            <li>In HubSpot, open the workflow <b>{REMIND_NAME}</b>. In its enrollment trigger (pipeline Back Office, stage Remind Back Office) add <b>&quot;Which certificate ?&quot; is unknown</b>, then save. Certificate tickets stop entering it; its reminder to the Backoffice Team on the other tickets stays.</li>
            <li>Unenroll the certificate tickets still in it - listed below (on each ticket: Workflows, Unenroll; or in the workflow&apos;s list of enrolled tickets). Otherwise it goes on mailing them next to the hub.</li>
            <li>Nothing to do in the hub: it reads the workflow every few minutes, takes the reminders from the moment of the change and this card turns green. What fell due before stays HubSpot&apos;s.</li>
          </Box>
        )}
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          {enrolled.length
            ? `${full(enrolled.length)} certificate ticket${enrolled.length === 1 ? "" : "s"} in stage Remind Back Office${hub ? " since before the switch-over" : ""} - enrolled in ${REMIND_NAME}${hub ? "; unenroll them if not done yet" : ""}:`
            : `No certificate ticket in stage Remind Back Office${hub ? " from before the switch-over" : ""}.`}
        </Typography>
        <Typography sx={{ fontSize: "0.82rem", color: d.others.offAt ? "#1b7a55" : MUTED }}>
          <b>Every other Back Office ticket</b> (no certificate) that goes to stage Remind Back Office:{" "}
          {d.others.offAt
            ? `the hub mails the Backoffice Team "Reminder to Review Ticket" within 3 minutes - since ${when(d.others.offAt)}, when the workflow was switched off.`
            : r?.on === false
              ? "the workflow is off - the hub takes the reminder at its next look."
              : `${REMIND_NAME} still mails the Backoffice Team. Switched off, the hub mails it within 3 minutes from that moment - the Activity tab lists each one.`}
        </Typography>
        {enrolled.length > 0 && (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {enrolled.map((t) => (
              <Box key={t.id} sx={{ display: "flex", gap: 1, alignItems: "baseline", minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT, whiteSpace: "nowrap", minWidth: 92 }}>{t.remindAt ? when(t.remindAt) : "-"}</Typography>
                <Chip tint={PHASE[t.phase].tint}>{PHASE[t.phase].label}</Chip>
                <Box sx={{ minWidth: 0, flex: 1 }}><TicketLink id={t.id} subject={t.subject} max={520} /></Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </GlassCard>
  );
}

export default function Certificates() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const held = useHeld<Data>(`/api/uc/certificates${n ? `?n=${n}` : ""}`, [n]);
  const r = held.result;
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the certificate requests…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Certificates" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else if (view === "tickets") body = (
    <Box id="certificates-panel-tickets" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}><CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="blue" title="Open certificate requests" note="Delivery date first; each with where it stands and its next step" /></Box>
        <TicketsTable rows={[...r.data.open].sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9"))} names={r.data.names} empty="No open certificate request." />
      </GlassCard>
    </Box>
  );
  else if (view === "activity") body = (
    <Box id="certificates-panel-activity" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}><CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="What the hub did" note="Each step the hub took (Live) or would take (Preview), newest first" /></Box>
        <ActivityTable rows={r.data.rows} names={r.data.names} />
      </GlassCard>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}><CardTitle icon={<HistoryOutlinedIcon />} tint="blue" title="Reminders to the Backoffice Team" note="Every other Back Office ticket (no certificate) that went to stage Remind Back Office - the mail of Back Office Ticket Remind, newest first" /></Box>
        <OthersTable rows={r.data.others.rows} />
      </GlassCard>
    </Box>
  );
  else if (view === "settings") body = <Box id="certificates-panel-settings" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><SettingsTab d={r.data} onChanged={() => setN((x) => x + 1)} /></Box>;
  else body = <Box id="certificates-panel-overview" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Overview d={r.data} /></Box>;
  const late = r?.state === "ok" ? r.data.open.filter(isLate).length : 0;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Certificates"
        subtitle="The Back Office's certificate requests - AVOR, the Back Office, the conformity experts - by the hub every 3 minutes"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="certificates" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: r?.state === "ok" ? full(r.data.open.length) : null },
          { id: "activity", label: "Activity", count: r?.state === "ok" && r.data.rows.length ? full(r.data.rows.length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {late > 0 && view !== "overview" && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{full(late)} late - delivery date passed, no certificate sent yet.</Typography>}
      {body}
    </Box>
  );
}
