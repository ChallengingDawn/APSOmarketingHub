"use client";

// CERTIFICATES - a HubSpot app (UC & HubSpot Apps > HubSpot apps). The Back Office's certificate requests: AVOR for a
// new EC 1935/2004 article, the Back Office, the conformity experts, the reminders and the 15-day hand-over - run by
// the hub every 3 minutes (SARCLA 04-05.11.2026: "migrate ASAP this certificates process to the hub as a sub-app,
// follow the logic"; 07.11.2026: "I want to do it only via the hub").
// Overview = the figures and the process drawn with where each open request stands; Tickets = filters, search, hold;
// Agenda = every step of the next 7 days, day by day; From the shop; Activity = what the hub did (or would do), the
// mails; Console = what the hub runs, the run, who has what, the tickets on hold; Settings = the mails and who gets
// them, the ERP's dates, the shop's tickets, the steps, the times, the rotations, the rules (Console.tsx; SARCLA
// 07.11.2026: "split the console in 2 tabs").

import { useMemo, useState } from "react";
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
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, clip, headCell, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import type { OpenTicket, OthersRow, Row } from "@/lib/certificates/engine";
import { stepWords, type StepName, type Timing } from "@/lib/certificates/rules";
import { Console, SettingsTab } from "./Console";
import { ShopTab } from "./ShopTab";
import { MailsTab } from "./MailsTab";
import { BO_STEPS, LATE, MAIL_STEPS, PHASE, STAGE_LABEL, TicketLink, dueText, hh, isLate, put, span, type Data } from "./shared";
import type { DateRow } from "@/lib/certificates/erpData";

type View = "overview" | "tickets" | "agenda" | "shop" | "activity" | "mails" | "console" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", agenda: "#agenda", shop: "#shop", activity: "#activity", mails: "#mails", console: "#console", settings: "#settings" };

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
function lanes(t: Timing): { title: string; who: string; tint: Tint; boxes: Box_[]; then?: string }[] {
  const e = (h: number) => `+${span(h)}`;
  return [
    { title: "New request", who: "Back Office creates it, with the certificates", tint: "slate", then: "EC 1935/2004 → AVOR, else → Back Office", boxes: [
      { id: "start", label: "Started by the hub", when: "within 3 min", tint: "slate" },
    ] },
    { title: "AVOR", who: "Owner = the requester; a new article number first", tint: "amber", then: "Article received", boxes: [
      { id: "avor", label: "Waiting for the new article", when: "set", tint: "amber" },
      { id: "avor48", label: "Remind AVOR", when: e(t.avorEveryH), tint: "amber" },
      { id: "avor96", label: "Remind AVOR again", when: e(t.avorEveryH), tint: "amber" },
      { id: "avorWeek", label: "Over a week", when: e(t.avorEveryH), tint: "pink" },
      { id: "avorRose", label: "Hand-over + note", when: `+${t.escalationDays} days`, tint: "pink" },
    ] },
    { title: "Back Office", who: "Owner = next of the rotation; a mail to the owner at each reminder", tint: "blue", then: "Assign to Conformity Expert", boxes: [
      { id: "bo", label: "Certificates stage", when: "set", tint: "blue" },
      { id: "bo3days", label: "Create the certificate", when: `delivery -${t.boDaysBefore} days, ${hh(t.boHour)}`, tint: "amber" },
      { id: "boToday", label: "Certificate due today", when: `delivery day, ${hh(t.boHour)}`, tint: "amber" },
      { id: "bo48", label: "Due 48 hours ago", when: e(t.boEveryH), tint: "pink" },
      { id: "bo96", label: "Due 96 hours ago", when: e(t.boEveryH), tint: "pink" },
      { id: "boWeek", label: "More than a week", when: e(t.boEveryH), tint: "pink" },
      { id: "boRose", label: "Hand-over + note", when: `+${t.escalationDays} days`, tint: "pink" },
    ] },
    { title: "Conformity expert", who: "Next of the experts' rotation, also owner", tint: "purple", then: "Sent out to customer and EDA", boxes: [
      { id: "expert", label: "With the expert", when: "set", tint: "purple" },
      { id: "today", label: "Delivery date is today", when: `delivery day, ${hh(t.expertHour)}`, tint: "amber" },
      { id: "late", label: "Certificate is late", when: e(t.lateEveryH), tint: "pink" },
      { id: "late96", label: "96 hours yet not sent", when: e(t.lateEveryH), tint: "pink" },
      { id: "lateWeek", label: "Over a week, not sent", when: e(t.lateEveryH), tint: "pink" },
      { id: "lateRose", label: "Hand-over + note", when: `+${t.escalationDays} days`, tint: "pink" },
    ] },
    { title: "Done", who: "Plain subject, stage Resolved", tint: "green", boxes: [
      { id: "sent", label: "Sent out - Resolved", when: "at once", tint: "green" },
    ] },
  ];
}

function ProcessCard({ open, resolvedThisMonth, sel, onPick, timing }: { open: OpenTicket[]; resolvedThisMonth: number | null; sel: string | null; onPick: (id: string | null) => void; timing: Timing }) {
  const counts = new Map<string, number>();
  for (const t of open) counts.set(boxOf(t), (counts.get(boxOf(t)) ?? 0) + 1);
  return (
    <GlassCard>
      <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="The process, and where each open request stands"
        note="Left to right, with the times on the Settings tab. The figure in a box = open requests there now - click a box for them" />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 1.25, alignItems: "stretch" }}>
        {lanes(timing).map((lane, i) => (
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
            {lane.then && <Typography sx={{ mt: "auto", pt: 0.75, fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>→ {lane.then}</Typography>}
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}

// ---------------- the tickets ----------------
type Filter = "all" | "start" | "avor" | "bo" | "expert" | "late" | "held" | "erp";
const FILTERS: { key: Filter; label: string; test: (t: OpenTicket) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "start", label: "New", test: (t) => t.phase === "start" },
  { key: "avor", label: "AVOR", test: (t) => t.phase === "avor" },
  { key: "bo", label: "Back Office", test: (t) => t.phase === "backOffice" || t.phase === "merged" },
  { key: "expert", label: "Conformity expert", test: (t) => t.phase === "expert" },
  { key: "late", label: "Late", test: isLate },
  { key: "held", label: "On hold", test: (t) => !!t.held },
  { key: "erp", label: "ERP date differs", test: (t) => t.erp?.state === "would" },
];
function FilterChips<K extends string>({ items, value, onChange }: { items: { key: K; label: string; n: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {items.map((f) => {
        const on = f.key === value;
        return (
          <Box key={f.key} component="button" type="button" onClick={() => onChange(f.key)} sx={{
            all: "unset", cursor: "pointer", px: 1.25, py: 0.4, borderRadius: "999px", fontSize: "0.8rem", fontWeight: on ? 700 : 500,
            color: on ? "#fff" : INK, bgcolor: on ? INK : "rgba(255,255,255,.85)", border: `1px solid ${on ? INK : HAIRLINE}`,
            "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 2 },
          }}>{f.label} <span style={{ opacity: 0.7 }}>{full(f.n)}</span></Box>
        );
      })}
    </Box>
  );
}

function TicketsTable({ rows, d, empty, onChanged }: { rows: OpenTicket[]; d: Data; empty: string; onChanged: () => void }) {
  const { slice, pager } = usePaged(rows, 25);
  const [busy, setBusy] = useState<string | null>(null);
  const t = d.settings.timing;
  const hold = async (id: string, on: boolean) => {
    if (on && !window.confirm("Put this ticket on hold?\n\nThe hub leaves it alone - no stage, subject, owner or mail - until you release it. What falls due meanwhile is taken then.")) return;
    setBusy(id); await put(on ? { hold: id } : { release: id }); setBusy(null); onChanged();
  };
  const cols = ["Ticket", "Certificates", "Delivery", "Where it stands", "Owner", "Next step", ...(d.admin ? [""] : [])];
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{cols.map((h, i) => <TableCell key={`${h}${i}`} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={cols.length} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>{empty}</TableCell></TableRow>}
            {slice.map((x) => {
              const late = isLate(x);
              return (
                <TableRow key={x.id} hover sx={x.held ? { bgcolor: "rgba(120,130,150,.06)" } : undefined}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    <TicketLink id={x.id} subject={x.subject} />
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{[x.company, x.order].filter(Boolean).join(" · ") || "-"}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{x.certs || "-"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: late ? RED : INK, fontWeight: late ? 700 : 400 }}>
                    {dueText(x.due)}
                    {x.erp && (x.erp.state !== "same" || x.erp.shipped) && (
                      <Tooltip title={`${x.erp.delivery}: ${x.erp.why}`}>
                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: x.erp.state === "would" ? "#b26a00" : MUTED }}>
                          {x.erp.state === "would" ? `ERP ${dueText(x.erp.date)}` : x.erp.state === "moved" ? "from the ERP" : x.erp.state === "kept" ? `ERP ${dueText(x.erp.date)} - kept by hand` : ""}{x.erp.shipped ? `${x.erp.state === "same" ? "" : " · "}the goods left` : ""}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Chip tint={PHASE[x.phase].tint}>{PHASE[x.phase].label}</Chip>
                      {x.held && <Chip tint="slate">on hold</Chip>}
                      {late && <Chip tint="pink">late</Chip>}
                    </Box>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }}>
                      {x.step ? stepWords(x.step, t).split(" - ")[0] : "started"} · {STAGE_LABEL[x.stage ?? ""] ?? x.stage ?? "-"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {x.owner ? d.names[x.owner] ?? x.owner : "-"}
                    {x.phase === "expert" && x.expert && x.expert !== x.owner ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>expert {d.names[x.expert] ?? x.expert}</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    {x.held ? <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>on hold - nothing until released</Typography> : x.next ? (
                      <>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>{when(x.next.at)}</Typography>
                        <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(280) }}>{stepWords(x.next.name, t)}</Typography>
                      </>
                    ) : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{x.due ? "nothing more - waits for the next action" : "no delivery date - nothing timed"}</Typography>}
                  </TableCell>
                  {d.admin && (
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                      <Button size="small" variant={x.held ? "contained" : "text"} disableElevation disabled={!!busy} onClick={() => void hold(x.id, !x.held)}>
                        {busy === x.id ? <CircularProgress size={12} /> : x.held ? "Release" : "Hold"}
                      </Button>
                    </TableCell>
                  )}
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

function TicketsTab({ d, onChanged, initial = "all" }: { d: Data; onChanged: () => void; initial?: Filter }) {
  const [f, setF] = useState<Filter>(initial);
  const [q, setQ] = useState("");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (t: OpenTicket) => !words.length || words.every((w) => [t.id, t.subject, t.company, t.order, t.certs].join(" ").toLowerCase().includes(w));
  const base = d.open.filter(hit);
  const rows = base.filter(FILTERS.find((x) => x.key === f)!.test).sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9"));
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25 }}>
        <CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="blue" title="Open certificate requests" note="Delivery date first; where each stands, its next step - hold one and the hub leaves it alone" />
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <FilterChips items={FILTERS.map((x) => ({ key: x.key, label: x.label, n: base.filter(x.test).length }))} value={f} onChange={setF} />
          <TextField size="small" placeholder="Search: subject, company, order, ticket" value={q} onChange={(e) => setQ(e.target.value)} sx={{ ml: { md: "auto" }, minWidth: 260 }} />
        </Box>
      </Box>
      <TicketsTable rows={rows} d={d} onChanged={onChanged} empty={words.length || f !== "all" ? "No open request matches." : "No open certificate request."} />
    </GlassCard>
  );
}

// ---------------- the agenda ----------------
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
const dayLabel = (key: string) => {
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86400_000).toISOString());
  const d = new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return key === today ? `Today - ${d}` : key === tomorrow ? `Tomorrow - ${d}` : d;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
function Agenda({ d }: { d: Data }) {
  const t = d.settings.timing;
  const items = useMemo(() => d.open.filter((x) => !x.held).flatMap((x) => (x.upcoming ?? []).map((u) => ({ ...u, t: x }))).sort((a, b) => a.at.localeCompare(b.at)), [d.open]);
  const days = new Map<string, typeof items>();
  for (const it of items) { const k = dayKey(it.at); days.set(k, [...(days.get(k) ?? []), it]); }
  const mails = d.settings.mails.owner ? items.filter((i) => MAIL_STEPS.includes(i.name)).length : 0;
  const held = d.open.filter((x) => x.held).length;
  return (
    <>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
        The next 7 days: {full(items.length)} steps on {full(new Set(items.map((i) => i.t.id)).size)} requests, {full(mails)} with a mail to the owner{held ? ` · ${full(held)} on hold, left out` : ""}. Times are Swiss time; a step is taken within 3 minutes.
      </Typography>
      {!items.length && <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing falls due in the next 7 days.</Typography></GlassCard>}
      {[...days.entries()].map(([k, list]) => (
        <GlassCard key={k} sx={{ p: 0, pt: { xs: 1.75, md: 2 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 }, display: "flex", alignItems: "baseline", gap: 1 }}>
            <CardTitle icon={<CalendarMonthOutlinedIcon />} tint="amber" title={dayLabel(k)} note={`${full(list.length)} step${list.length === 1 ? "" : "s"}`} />
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableBody>
                {list.map((i) => (
                  <TableRow key={`${i.t.id}-${i.name}-${i.at}`} hover>
                    <TableCell sx={{ ...bodyCell, width: 70, fontSize: "0.82rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{timeOf(i.at)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", minWidth: 260 }}>
                      <TicketLink id={i.t.id} subject={i.t.subject} max={420} />
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{[i.t.company, i.t.order, i.t.certs].filter(Boolean).join(" · ")}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 0.25 }}>
                        <Chip tint={PHASE[i.t.phase].tint}>{PHASE[i.t.phase].label}</Chip>
                        {LATE.includes(i.name) && <Chip tint="pink">late</Chip>}
                        {d.settings.mails.owner && MAIL_STEPS.includes(i.name) && <Chip tint="purple">mail to {i.t.owner ? d.names[i.t.owner] ?? "the owner" : "the owner"}</Chip>}
                      </Box>
                      <Typography sx={{ fontSize: "0.76rem", color: INK }}>{stepWords(i.name as StepName, t)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </GlassCard>
      ))}
    </>
  );
}

// ---------------- the activity ----------------
const WHAT: Record<Row["what"], { tint: Tint; label: string }> = {
  done: { tint: "green", label: "done" }, would: { tint: "blue", label: "would do (Preview)" }, failed: { tint: "pink", label: "failed - tried again" },
  skipped: { tint: "slate", label: "skipped - switched off on the Settings tab" },
};
function written(r: Row, names: Record<string, string>): string {
  const out: string[] = [];
  if (r.props.hs_pipeline_stage) out.push(`stage ${STAGE_LABEL[r.props.hs_pipeline_stage] ?? r.props.hs_pipeline_stage}`);
  if (r.props.hubspot_owner_id) out.push(`owner ${names[r.props.hubspot_owner_id] ?? r.props.hubspot_owner_id}`);
  if (r.props.conformity_expert) out.push(`expert ${names[r.props.conformity_expert] ?? r.props.conformity_expert}`);
  if (r.props.actions_for_certificates !== undefined) out.push(r.props.actions_for_certificates ? `action "${r.props.actions_for_certificates}"` : "action emptied");
  if (r.note) out.push("note");
  return out.join(" · ");
}
function ActivityTable({ rows, d }: { rows: Row[]; d: Data }) {
  const { slice, pager } = usePaged(rows, 25);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Step", "Result", "Written"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nothing here - the next steps are on the Agenda.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <TicketLink id={r.ticketId} subject={r.props.subject ?? r.subject} max={340} />
                  {r.props.subject && r.subject && r.props.subject !== r.subject ? <Typography sx={{ fontSize: "0.72rem", color: FAINT, ...clip(340) }}>was: {r.subject}</Typography> : null}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>{r.steps.map((s) => <Typography key={s} sx={{ fontSize: "0.78rem" }}>{stepWords(s, d.settings.timing)}</Typography>)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                  <Chip tint={WHAT[r.what].tint}>{WHAT[r.what].label}</Chip>
                  {r.error && <Typography sx={{ fontSize: "0.72rem", color: RED }}>{r.error}</Typography>}
                  {r.mail && <Typography sx={{ fontSize: "0.72rem", color: r.mailFailed ? RED : MUTED, mt: 0.25 }}>{r.mail}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED }}>{written(r, d.names) || "subject"}</TableCell>
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
                  <Chip tint={r.mail.startsWith("mail to") ? "green" : r.what === "failed" ? "pink" : "slate"}>{r.mail.startsWith("mail to") ? "mailed" : r.what === "failed" ? "failed" : r.what === "would" ? "would mail" : "not sent"}</Chip>
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
function DatesTable({ rows }: { rows: DateRow[] }) {
  const { slice, pager } = usePaged(rows, 15);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["When", "Ticket", "Date", "ERP delivery", "Result"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>None yet - each open request&apos;s ERP order is read every 30 minutes.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketLink id={r.ticketId} subject={r.subject} max={380} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{dueText(r.from)} → <b>{dueText(r.to)}</b></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{r.delivery}{r.shipped ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>the goods have left</Typography> : null}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                  <Chip tint={r.what === "done" ? "green" : r.what === "failed" ? "pink" : "blue"}>{r.what === "done" ? "written" : r.what === "failed" ? "failed - tried again" : "would write"}</Chip>
                  {r.error && <Typography sx={{ fontSize: "0.72rem", color: RED }}>{r.error}</Typography>}
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
type AFilter = "all" | "mail" | "failed" | "today";
function ActivityTab({ d }: { d: Data }) {
  const [f, setF] = useState<AFilter>("all");
  const today = dayKey(new Date().toISOString());
  const tests: Record<AFilter, (r: Row) => boolean> = {
    all: () => true, mail: (r) => !!r.mail, failed: (r) => r.what === "failed" || !!r.mailFailed, today: (r) => dayKey(r.at) === today,
  };
  const rows = d.rows.filter(tests[f]);
  return (
    <>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.25 }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="What the hub did" note="Each step the hub took (Live) or would take (Preview), newest first - with the mail it sent" />
          <FilterChips<AFilter> value={f} onChange={setF} items={[
            { key: "all", label: "All", n: d.rows.length }, { key: "today", label: "Today", n: d.rows.filter(tests.today).length },
            { key: "mail", label: "With a mail", n: d.rows.filter(tests.mail).length }, { key: "failed", label: "Failed", n: d.rows.filter(tests.failed).length },
          ]} />
        </Box>
        <ActivityTable rows={rows} d={d} />
      </GlassCard>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<EventOutlinedIcon />} tint="amber" title="Delivery dates from the ERP" note={d.settings.erpDates === "write" ? "Each date the hub moved to the ERP's, newest first" : "Each date the hub would move to the ERP's (Show only - switch on the Settings tab), newest first"} />
        </Box>
        <DatesTable rows={d.dates} />
      </GlassCard>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<MailOutlineIcon />} tint="blue" title="Reminders on every other ticket in Remind" note={`Every other Back Office ticket (no certificate) that went to stage Remind Back Office - mailed to its owner${d.settings.teamTo.length ? `, and to ${d.settings.teamTo.map((id) => d.names[id] ?? id).join(", ")}` : ""}`} />
        </Box>
        <OthersTable rows={d.others.rows} />
      </GlassCard>
    </>
  );
}

// ---------------- the late ones (SARCLA 07.11.2026: "7 late ... can be improved, not just a line here") ----------------
const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - Date.parse(`${date}T12:00:00`)) / 86400_000));
function LateCard({ d, onAll }: { d: Data; onAll: () => void }) {
  const late = d.open.filter(isLate).sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9"));
  if (!late.length) return null;
  const byOwner = Object.entries(late.reduce<Record<string, number>>((a, t) => { const k = t.owner ? d.names[t.owner] ?? t.owner : "nobody"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const left = late.filter((t) => t.erp?.shipped).length;
  return (
    <GlassCard sx={{ borderLeft: `4px solid ${RED}` }}>
      <CardTitle icon={<ReportProblemOutlinedIcon />} tint="pink" title={`${full(late.length)} request${late.length === 1 ? " is" : "s are"} late`}
        note={`The delivery date has passed and no certificate went out${left ? ` - for ${full(left)} of them the goods have already left` : ""}`} />
      <Typography sx={{ fontSize: "0.8rem", color: INK, mb: 1 }}>
        {byOwner.map(([n, c]) => `${n} ${c}`).join(" · ")}
      </Typography>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {late.slice(0, 5).map((t) => (
          <Box key={t.id} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 150px 170px" }, gap: { xs: 0.25, md: 1.5 }, alignItems: "center", py: 0.75, borderTop: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ minWidth: 0 }}>
              <TicketLink id={t.id} subject={t.subject} max={620} />
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{[t.company, t.order, t.certs].filter(Boolean).join(" · ")}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: INK }}>{t.owner ? d.names[t.owner] ?? t.owner : "nobody"}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: RED, fontWeight: 600 }}>{t.due ? `due ${dueText(t.due)} · ${daysSince(t.due)} days ago` : "no date"}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
        <Button size="small" variant="contained" disableElevation onClick={onAll}>{late.length > 5 ? `See all ${full(late.length)} on the Tickets tab` : "Open them on the Tickets tab"}</Button>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Late = the &quot;48 h after the delivery date&quot; step or a later one has been taken.</Typography>
      </Box>
    </GlassCard>
  );
}

// ---------------- the overview ----------------
function Overview({ d, go, onChanged, onLate }: { d: Data; go: (v: View) => void; onChanged: () => void; onLate: () => void }) {
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
  const todayKey = dayKey(new Date().toISOString());
  const dueToday = open.filter((x) => !x.held).flatMap((x) => (x.upcoming ?? []).filter((u) => dayKey(u.at) === todayKey)).length;
  const byHub = d.board.filter((w) => w.by === "hub").length;
  const problems = d.board.filter((w) => w.error || w.today.failed).length;
  return (
    <>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip tint={d.settings.mode === "live" ? "green" : d.settings.mode === "off" ? "slate" : "amber"}>{d.settings.mode === "live" ? "Live - writing" : d.settings.mode === "preview" ? "Preview" : "Off"}</Chip>
        <Chip tint={byHub === d.board.length ? "green" : "amber"}>{byHub} of {d.board.length} parts live</Chip>
        {problems > 0 && <Chip tint="pink">{problems} with a problem</Chip>}
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          {d.last ? `Last look ${when(d.last.at)} · ${full(d.last.tickets)} open · ${full(dueToday)} steps still due today` : "Not looked yet"}
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <Button size="small" variant="text" onClick={() => go("agenda")}>Agenda</Button>
          <Button size="small" variant="text" onClick={() => go("mails")}>Mails</Button>
          <Button size="small" variant="text" onClick={() => go("console")}>Console</Button>
          <Button size="small" variant="text" onClick={() => go("settings")}>Settings</Button>
        </Box>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="blue" label="Open requests" value={full(open.length)} note="in the process now" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ScheduleOutlinedIcon />} tint="amber" label="Waiting for AVOR" value={full(avor)} note="a new EC 1935/2004 article first" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<EventOutlinedIcon />} tint="purple" label="Delivery in 7 days" value={full(in7)} note="open, delivery date this week" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<ReportProblemOutlinedIcon />} tint="pink" label="Late" value={full(late)} note="delivery date passed, no certificate sent yet" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TaskAltOutlinedIcon />} tint="green" label="Resolved this month" value={thisMonth ? full(thisMonth.resolved) : "—"} note={thisMonth ? `${full(thisMonth.created)} new this month` : "read every 30 min"} /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2 }}><KpiTile icon={<TimerOutlinedIcon />} tint="slate" label="Days to resolve" value={d.stats?.medianDays !== null && d.stats?.medianDays !== undefined ? String(d.stats.medianDays) : "—"} note={d.stats ? `median, ${full(d.stats.resolved90)} resolved in 90 days` : "read every 30 min"} /></Grid>
      </Grid>
      <LateCard d={d} onAll={onLate} />
      <ProcessCard open={open} resolvedThisMonth={thisMonth?.resolved ?? null} sel={sel} onPick={setSel} timing={d.settings.timing} />
      {sel && (
        <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 } }}>
            <CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="blue" title={`${lanes(d.settings.timing).flatMap((l) => l.boxes).find((b) => b.id === sel)?.label ?? sel}: ${full(shown.length)} open`} note="Click the box again to close" />
          </Box>
          <TicketsTable rows={shown} d={d} empty="No open request at this step." onChanged={onChanged} />
        </GlassCard>
      )}
      {months.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
          <GlassCard>
            <CardTitle icon={<BarChartOutlinedIcon />} tint="blue" title="Certificate requests per month" note="Back Office tickets naming a certificate: created, and resolved, the last 13 months" />
            <GroupedColumns height={230} currentFirst currentLabel="New requests" priorLabel="Resolved" data={months.map((m) => ({ x: m.month.slice(2).split("-").reverse().join("."), current: m.created, prior: m.resolved, partial: m.month === month }))} />
          </GlassCard>
          {!!d.stats?.punctual?.length && (
            <GlassCard>
              <CardTitle icon={<TaskAltOutlinedIcon />} tint="green" title="Sent on time, per month" note="Resolved requests with a delivery date: resolved on or before it, and after it" />
              <GroupedColumns height={230} currentFirst currentLabel="On time" priorLabel="After the date" data={d.stats.punctual.map((m) => ({ x: m.month.slice(2).split("-").reverse().join("."), current: m.onTime, prior: m.late, partial: m.month === month }))} />
            </GlassCard>
          )}
        </Box>
      )}
    </>
  );
}

export default function Certificates() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const [ticketFilter, setTicketFilter] = useState<Filter>("all");
  const held = useHeld<Data>(`/api/uc/certificates${n ? `?n=${n}` : ""}`, [n]);
  const r = held.result;
  const reload = () => setN((x) => x + 1);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the certificate requests…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Certificates" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={reload} />;
  else if (view === "tickets") body = <TicketsTab key={ticketFilter} d={r.data} onChanged={reload} initial={ticketFilter} />;
  else if (view === "agenda") body = <Agenda d={r.data} />;
  else if (view === "activity") body = <ActivityTab d={r.data} />;
  else if (view === "mails") body = <MailsTab d={r.data} />;
  else if (view === "shop") body = <ShopTab d={r.data} />;
  else if (view === "console") body = <Console d={r.data} onChanged={reload} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={reload} />;
  else body = <Overview d={r.data} go={setView} onChanged={reload} onLate={() => { setTicketFilter("late"); setView("tickets"); }} />;
  const d = r?.state === "ok" ? r.data : null;
  const late = d ? d.open.filter(isLate).length : 0;
  const next7 = d ? d.open.filter((x) => !x.held).reduce((a, x) => a + (x.upcoming?.length ?? 0), 0) : 0;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Certificates"
        subtitle="The Back Office's certificate requests - AVOR, the Back Office, the conformity experts - run by the hub"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="certificates" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: late ? `Tickets · ${full(late)} late` : "Tickets", count: d ? full(d.open.length) : null },
          { id: "agenda", label: "Agenda", count: d && next7 ? full(next7) : null },
          { id: "shop", label: "From the shop", count: d && d.shop.length ? full(d.shop.length) : null },
          { id: "activity", label: "Activity", count: d && d.rows.length ? full(d.rows.length) : null },
          { id: "mails", label: "Mails", count: null },
          { id: "console", label: "Console", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box id={`certificates-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
