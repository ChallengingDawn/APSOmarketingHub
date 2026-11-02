"use client";

// DUPLICATES & MERGES - a HubSpot app (UC & HubSpot Apps > HubSpot apps). SARCLA 18.10.2026: "DUPS and merge should be a
// separate app"; 02.11.2026: "improve a lot the duplicated app ... with also tabs to steer the different types" - one
// tab per type of duplicate (the same request twice, the same order, the same erosion win-back), each with its switch,
// its figures and its tickets; Decisions = what people chose on the ticket card and what the hub did; Settings = shadow
// or live, merging, the properties. The design of the reporting pages: tiles, chart cards, the tickets window.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import DoNotDisturbAltOutlinedIcon from "@mui/icons-material/DoNotDisturbAltOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, RED, TINT, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Choice, Info } from "@/app/connectors/parts";
import { ChartBox } from "@/app/reporting/eso-benchmark/Figures";
import { Table as KitTable } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { CompanyDialog, type CompanyItem, type CompanySource } from "@/app/reporting/CompanyList";
import { ListCard, StatusCard, dayTime } from "@/app/uc/segmentation/lists";
import type { Backfill, Mode, RunInfo, Settings } from "@/lib/ticketDuplicates/engine";
import type { Row, MergeState } from "@/lib/ticketDuplicates/model";
import type { Measure } from "@/lib/ticketDuplicates/measure";
import { workflowFlagged, type Figures, type Why } from "@/lib/ticketDuplicates/figures";
import type { PropsState } from "@/lib/ticketDuplicates/properties";
import type { LogEntry, Pending } from "@/lib/ticketDuplicates/live";
import { DUP_TYPES, type DupType, type TypeSettings } from "@/lib/ticketDuplicates/types";

type Data = {
  settings: Settings; last: RunInfo | null; decided: { at: string; done: number; errors: number; error?: string } | null; backfill: Backfill | null;
  everyMinutes: number; days: number; rows: Row[]; totalRows: number; figures: Figures; measure: Measure;
  workflows: { dups: boolean | null; merging: boolean | null }; props: PropsState; pending: Pending[]; log: LogEntry[]; admin: boolean;
};
type TabId = "overview" | DupType | "decisions" | "settings";
const TAB_HASH: Record<TabId, string> = { overview: "#overview", twice: "#same-request-twice", order: "#same-order", erosion: "#erosion", decisions: "#decisions", settings: "#settings" };

const TYPE: Record<DupType, { label: string; status: string; tint: Tint; rule: string }> = {
  twice: {
    label: "Same request twice", status: "Possible duplicate", tint: "purple",
    rule: "The same subject from the same customer, or on the same order, while the earlier ticket is still open in the same pipeline - within the hours set here. Flagged \"Possible duplicate\": a person merges the two on the ticket's card, or says they are not duplicates. Mail servers, absence notices and the senders listed as systems (the shop, the ERP, A+P itself) never count as a customer writing twice.",
  },
  order: {
    label: "Same order", status: "Same order - another open ticket", tint: "blue",
    rule: "Another open ticket on the same order in the same pipeline - another request about it (an AVOR mail beside a customer's question). Shown as \"Same order\", nothing to merge; the owner of the oldest one takes this ticket too, so one person has the order. Closed tickets on the same order are history only, and an open one in another pipeline is shown, never flagged.",
  },
  erosion: {
    label: "Same erosion win-back", status: "Possible duplicate", tint: "amber",
    rule: "Two erosion win-back tickets with the same erosion key - the same customer, article and year: the erosion engine fired twice. Flagged \"Possible duplicate\"; the owners always stay with the sales reps.",
  },
};
const PIPES: Record<string, string> = { "1726786777": "Back Office", "1726599376": "ESO", "1726599377": "TSA", "1726786775": "GQS", "1553929403": "Special Prices", "1737150687": "Product Management" };
const pipeLabel = (id: string | null | undefined) => (id ? PIPES[id] ?? `pipeline ${id}` : "—");
const STATE: Record<MergeState, string> = { merged: "Merged", closed: "Closed, not merged", open: "Still open", gone: "Deleted" };
const WHY: Record<Why, string> = { "closed only": "only closed tickets on the order", "other pipeline only": "open only in another pipeline", "not the same order": "not the same order line or request", "never compared": "never compared (certificates, notices)" };
const PROP_LABEL: Record<string, string> = { dup_status: "Duplicate", dup_type: "Duplicate type", dup_of_ticket: "Duplicate of ticket", dup_why: "Duplicate - why", dup_checked_at: "Duplicate checked at", dup_decision: "Duplicate - decision", dup_decided_by: "Duplicate - decided by" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const dd = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const small = { fontSize: "0.8rem" } as const;

const link = (id: string, text?: string) => (
  <Box component="a" href={hsTicket(id)} target="_blank" rel="noreferrer" title="Open in HubSpot" onClick={(e: React.MouseEvent) => e.stopPropagation()}
    sx={{ color: INK, textDecoration: "underline", textDecorationColor: "rgba(21,34,58,.35)", textUnderlineOffset: "3px", "&:hover": { color: TINT.blue.fg } }}>{text ?? id}</Box>
);
/** The other tickets of a row: each linked, with its subject, pipeline and state as the check saw them. */
function Others({ r, ids }: { r: Row; ids: string[] }) {
  if (!ids.length) return <>—</>;
  return (
    <Box component="span" sx={{ display: "grid", gap: 0.25, minWidth: 0 }}>
      {ids.slice(0, 3).map((id) => {
        const x = r.dups?.[id];
        return (
          <Box key={id} component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {link(id, x?.subject || id)}
            <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}> · {x ? `${pipeLabel(x.pipeline)}, ${x.closed ? "closed" : "open"}${x.owner ? `, ${r.ownerNames[x.owner] ?? x.owner}` : ""}` : "—"}</Box>
          </Box>
        );
      })}
      {ids.length > 3 && <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>and {ids.length - 3} more</Box>}
    </Box>
  );
}
const then = (r: Row) => (r.merge ? `${STATE[r.merge.state]}${r.merge.final || r.merge.state === "merged" ? "" : " so far"}` : Date.now() - Date.parse(r.enteredAt) < 3600_000 ? "…" : "not read yet");
const written = (r: Row) => (r.live ? (r.live.error ? `error: ${r.live.error}` : r.live.flagged ? `written${r.live.owner ? ", owner handed over" : ""}${r.live.note ? ` (${r.live.note})` : ""}` : r.live.note ?? "not written") : "shadow - not written");

/** The tickets a row points at: the hub's, else the closed or elsewhere ones it only shows, else the workflow's. */
const shownIds = (r: Row) => { const v = r.v; return v?.of.length ? v.of : v?.history.length ? v.history : v?.elsewhere.length ? v.elsewhere : r.legacy?.duplicates ?? []; };
const shownWhy = (r: Row) => {
  const v = r.v;
  if (!v) return "not checked with these rules yet";
  if (v.why) return v.why;
  if (v.history.length && !v.elsewhere.length) return "Only closed tickets on the same order - history, not flagged";
  if (v.elsewhere.length) return "Open only in another pipeline - shown, not flagged";
  return v.skip ?? "Not the same order or request - not flagged";
};
/** The tickets of a list, in the reporting window's table: the ticket (to HubSpot), when, what, the others, what became of it. */
function ticketSource(key: string, rows: Row[], note: string, withType = true): CompanySource {
  // a type's own tab leaves its type out - the table fits the page
  const keep = <T,>(a: T[]) => (withType ? a : a.filter((_, i) => i !== 1));
  return {
    key, note, object: "tickets",
    head: keep(["Entered", "Type", "The other tickets", "Why", "Owner", "Then", "The hub"]),
    left: withType ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6],
    widths: keep(["minmax(92px, 0.5fr)", "minmax(110px, 0.7fr)", "minmax(220px, 1.8fr)", "minmax(220px, 1.8fr)", "minmax(120px, 0.8fr)", "minmax(110px, 0.7fr)", "minmax(130px, 0.9fr)"]),
    rows: () => rows.map((r): CompanyItem => {
      const v = r.v;
      const own = v?.ownerChange ? `→ ${r.ownerNames[v.ownerChange.ownerId] ?? v.ownerChange.ownerId}` : r.ownerAtCheck ? r.ownerNames[r.ownerAtCheck] ?? r.ownerAtCheck : "—";
      return {
        id: r.ticketId, name: r.subject || `Ticket ${r.ticketId}`,
        cells: keep<React.ReactNode>([dayTime(r.enteredAt), v?.type ? TYPE[v.type].label : "—", <Others key="o" r={r} ids={shownIds(r)} />, shownWhy(r), own, then(r), written(r)]),
        values: keep<string | null>([r.enteredAt, v?.type ?? null, null, v?.why ?? null, null, r.merge?.state ?? null, null]),
      };
    }),
  };
}
/** A list that opens in the window - the tickets of a figure. */
function useTickets() {
  const [open, setOpen] = useState<{ title: string; source: CompanySource } | null>(null);
  return {
    show: (title: string, source: CompanySource) => setOpen({ title, source }),
    dialog: open ? <CompanyDialog source={open.source} title={open.title} onClose={() => setOpen(null)} /> : null,
  };
}

// ---------------------------------------------------------------- the line every tab starts with

function Status({ d }: { d: Data }) {
  const s = d.settings, wf = d.workflows.dups, ready = d.props.ready;
  const live = s.mode === "live" && wf === false && ready;
  const waiting = s.mode === "live" && !live;
  const tone = live ? "#1f8a4c" : waiting ? "#c47a00" : s.mode === "off" ? "#8a94a6" : TINT.blue.fg;
  const title = live ? "Live - the hub writes the duplicates on the tickets"
    : waiting ? `Live is chosen - the hub waits: ${wf !== false ? "the DUPS workflow is still on in HubSpot" : "the properties are missing (Settings)"}`
    : s.mode === "off" ? "Off - nothing is checked" : "Shadow - every new Back Office ticket is checked, nothing is written";
  const b = d.backfill;
  const line = [
    d.last ? `Last look ${dayTime(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.checked)} checked${d.last.written ? `, ${full(d.last.written)} written` : ""}${d.last.error ? ` - ${d.last.error}` : ""}` : "Not run yet",
    b && !b.done ? `re-checking the last 7 days with these rules: ${full(b.checked)} so far, 25 every ${d.everyMinutes} minutes` : null,
    `merging ${d.settings.merging === "on" ? "on" : "off"}`,
  ].filter(Boolean).join(" · ");
  return <StatusCard tone={tone} beat={live || s.mode === "shadow"} title={title} line={line} />;
}

// ---------------------------------------------------------------- Overview

function Overview({ d }: { d: Data }) {
  const f = d.figures, w = f.workflow;
  const t = useTickets();
  const flagged = d.rows.filter((r) => r.v?.type);
  const typeRows = (k: DupType) => d.rows.filter((r) => r.v?.type === k);
  const tiles = [
    { label: "Tickets checked", value: full(f.checked), icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const, note: f.waiting ? `${full(f.waiting)} more waiting for the re-check with these rules` : `entered Back Office New in the last ${d.days} days` },
    { label: TYPE.twice.label, value: full(f.byType.twice.flagged), icon: <ContentCopyOutlinedIcon />, tint: "purple" as const, note: `possible duplicates · ${full(f.byType.twice.merged)} merged, ${full(f.byType.twice.open)} still open` },
    { label: "Same order, still open", value: full(f.byType.order.flagged), icon: <ReceiptLongOutlinedIcon />, tint: "blue" as const, note: `another request on an open order · ${full(f.byType.order.owner)} owners handed over` },
    { label: "Workflow flags the hub drops", value: full(w.dropped), icon: <FilterAltOffOutlinedIcon />, tint: "amber" as const, note: `${pct(w.dropped, w.flagged)} of the ${full(w.flagged)} the DUPS workflow flagged${w.droppedWhy[0] ? ` - mostly ${WHY[w.droppedWhy[0].key]}` : ""}` },
  ];
  const wfRow = (key: string, label: string, n: number, rows: Row[], strong = false) => ({
    key, strong, cells: [label, full(n)], onPick: n ? () => t.show(label, ticketSource(`wf|${key}|${d.days}`, rows, "The tickets of this line, newest first")) : undefined,
  });
  const wfFlag = d.rows.filter((r) => r.v && workflowFlagged(r));
  return (
    <>
      <Grid container spacing={2}>
        {tiles.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ChartBox title="Day by day, by type" hint="Back Office tickets by the day they entered New - the ones the hub flags, by type"
            companies={flagged.length ? ticketSource(`days|${d.days}|${flagged.length}`, flagged, "Every ticket the hub flags, newest first") : null}>
            {f.perDay.length
              ? <StackedColumns data={f.perDay.map((x) => ({ x: x.day, twice: x.twice, order: x.order, erosion: x.erosion }))}
                  parts={DUP_TYPES.map((k) => ({ key: k, label: TYPE[k].label }))} height={240} format={(n) => full(n ?? 0)} xFormat={dd} />
              : <Typography sx={{ ...small, color: FAINT }}>No ticket checked yet.</Typography>}
          </ChartBox>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ChartBox title="The DUPS workflow against the hub" hint="What the workflow flags today, and what the hub keeps - a click on a line shows its tickets">
            <KitTable head={["", "Tickets"]} firstWidth="minmax(220px, 2fr)" minWidth={320} rows={[
              wfRow("wf", "The workflow flagged", w.flagged, wfFlag, true),
              wfRow("kept", "… the hub flags them too", w.kept, wfFlag.filter((r) => r.v!.status)),
              ...w.droppedWhy.map((x) => wfRow(`drop-${x.key}`, `… the hub drops: ${WHY[x.key]}`, x.count, wfFlag.filter((r) => !r.v!.status && (x.key === "closed only" ? r.v!.history.length && !r.v!.elsewhere.length : x.key === "other pipeline only" ? r.v!.elsewhere.length : x.key === "never compared" ? /never compared/.test(r.v!.skip ?? "") : !r.v!.history.length && !r.v!.elsewhere.length && !/never compared/.test(r.v!.skip ?? ""))))),
              wfRow("hubonly", "The hub finds, the workflow did not", w.hubOnly, d.rows.filter((r) => r.v?.status && !workflowFlagged(r)), true),
            ]} />
          </ChartBox>
        </Grid>
      </Grid>
      <ChartBox title="What people did with them" hint="Each flagged ticket read again after an hour, daily, and at 7 days - a click on a type shows its tickets">
        <KitTable head={["Type", "Flagged", "Merged", "Closed, not merged", "Still open", "Owner handed over"]} minWidth={640} rows={DUP_TYPES.map((k) => {
          const x = f.byType[k];
          return { key: k, cells: [TYPE[k].label, full(x.flagged), full(x.merged), full(x.closed), full(x.open), full(x.owner)], onPick: x.flagged ? () => t.show(TYPE[k].label, ticketSource(`type|${k}|${d.days}`, typeRows(k), TYPE[k].status)) : undefined };
        })} />
      </ChartBox>
      {t.dialog}
    </>
  );
}

// ---------------------------------------------------------------- a type's tab

function TypeSettingsCard({ k, d, onSaved }: { k: DupType; d: Data; onSaved: () => void }) {
  const [ts, setTs] = useState<TypeSettings>(d.settings.types);
  const [domains, setDomains] = useState(d.settings.types.twice.internalDomains.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    const types: Partial<TypeSettings> = k === "twice" ? { twice: { ...ts.twice, internalDomains: domains.split("\n") } } : k === "order" ? { order: ts.order } : { erosion: ts.erosion };
    try {
      const r = await fetch("/api/uc/ticket-duplicates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ types }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved - new tickets are checked with it." : j.error ?? `HTTP ${r.status}`);
      onSaved();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const off = !d.admin;
  const on = ts[k].on;
  const setOn = (v: boolean) => setTs((x) => ({ ...x, [k]: { ...x[k], on: v } }));
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint={TYPE[k].tint} title="How it is decided" note={TYPE[k].rule} />
      <Box sx={{ display: "grid", gap: 1.5, maxWidth: 760 }}>
        <Choice<"on" | "off"> value={on ? "on" : "off"} onChange={(v) => !off && setOn(v === "on")} options={[{ key: "on", label: "On" }, { key: "off", label: "Off - never flagged" }]} />
        {k === "twice" && (
          <>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField size="small" type="number" label="Within (hours)" value={ts.twice.withinHours} disabled={off} onChange={(e) => setTs((x) => ({ ...x, twice: { ...x.twice, withinHours: Number(e.target.value) } }))} sx={{ width: 160 }} />
              <Typography sx={{ ...small, color: MUTED }}>the earlier ticket at most this long before - 72 hours to start with</Typography>
            </Box>
            <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ts.twice.handOver} disabled={off} onChange={(e) => setTs((x) => ({ ...x, twice: { ...x.twice, handOver: e.target.checked } }))} />}
              label={<Typography sx={{ fontSize: "0.84rem" }}>Give the second ticket to the owner of the first, so one person sees both and merges them</Typography>} />
            <Box>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Systems and colleagues - never a customer writing twice</Typography>
              <Typography sx={{ ...small, color: MUTED, mb: 0.5 }}>One e-mail domain per line. The same subject twice from them only counts when it is on the same order (the ERP's error twice about one order).</Typography>
              <TextField multiline minRows={3} fullWidth size="small" value={domains} disabled={off} onChange={(e) => setDomains(e.target.value)} />
            </Box>
          </>
        )}
        {k === "order" && (
          <>
            <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ts.order.handOver} disabled={off} onChange={(e) => setTs((x) => ({ ...x, order: { ...x.order, handOver: e.target.checked } }))} />}
              label={<Typography sx={{ fontSize: "0.84rem" }}>Give the ticket to the owner of the oldest open ticket on the order - one person per order (the workflow does it today, in any pipeline; the hub only within the pipeline)</Typography>} />
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField size="small" type="number" label="Owner from tickets up to (days)" value={ts.order.ownerMaxAgeDays} disabled={off} onChange={(e) => setTs((x) => ({ ...x, order: { ...x.order, ownerMaxAgeDays: Number(e.target.value) } }))} sx={{ width: 240 }} />
              <Typography sx={{ ...small, color: MUTED }}>an older open ticket still shows, its owner is not taken - 30 as the workflow</Typography>
            </Box>
          </>
        )}
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="contained" size="small" disableElevation disabled={busy} onClick={() => void save()} sx={{ textTransform: "none" }}>Save</Button>
            {busy && <CircularProgress size={14} />}
            {msg && <Typography sx={{ ...small, color: MUTED }}>{msg}</Typography>}
          </Box>
        )}
      </Box>
    </GlassCard>
  );
}

function TypeTab({ k, d, onSaved }: { k: DupType; d: Data; onSaved: () => void }) {
  const x = d.figures.byType[k];
  const rows = d.rows.filter((r) => r.v?.type === k);
  const t = useTickets();
  const shownOnly = (which: "history" | "elsewhere") => d.rows.filter((r) => r.v && !r.v.status && r.v[which].length && (which === "elsewhere" || !r.v.elsewhere.length));
  const tiles = [
    { label: k === "order" ? "Same order, still open" : "Flagged", value: full(x.flagged), icon: <ContentCopyOutlinedIcon />, tint: TYPE[k].tint, note: `${TYPE[k].status} · ${d.days} days` },
    { label: "Merged by people", value: full(x.merged), icon: <CallMergeOutlinedIcon />, tint: "green" as const, note: `${pct(x.merged, x.flagged)} of them` },
    { label: "Closed, not merged", value: full(x.closed), icon: <DoNotDisturbAltOutlinedIcon />, tint: "slate" as const, note: `${full(x.open)} still open` },
    { label: k === "erosion" ? "Written on the ticket" : "Owner handed over", value: full(k === "erosion" ? x.written : x.owner), icon: <PersonOutlineOutlinedIcon />, tint: "amber" as const, note: k === "erosion" ? "live only" : d.settings.mode === "live" ? `${full(x.written)} written on the ticket` : "shadow - what the hub would do" },
  ];
  return (
    <>
      <TypeSettingsCard key={d.settings.at ?? "x"} k={k} d={d} onSaved={onSaved} />
      <Grid container spacing={2}>
        {tiles.map((y) => <Grid key={y.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={y.icon} tint={y.tint} label={y.label} value={y.value} note={y.note} /></Grid>)}
      </Grid>
      {k === "order" && (
        <ChartBox title="Shown on the ticket, never flagged" hint="The DUPS workflow flags these today - a click on a line shows its tickets">
          <KitTable head={["", "Tickets"]} firstWidth="minmax(260px, 2fr)" minWidth={320} rows={[
            { key: "h", cells: ["Only closed tickets on the order - the earlier request was done", full(d.figures.historyOnly)], onPick: d.figures.historyOnly ? () => t.show("Only closed tickets on the order", ticketSource(`hist|${d.days}`, shownOnly("history"), "History - the card lists them, nothing to merge")) : undefined },
            { key: "e", cells: ["Open only in another pipeline (ESO, TSA)", full(d.figures.elsewhereOnly)], onPick: d.figures.elsewhereOnly ? () => t.show("Open only in another pipeline", ticketSource(`else|${d.days}`, shownOnly("elsewhere"), "Another team has the order - shown, never flagged")) : undefined },
          ]} />
        </ChartBox>
      )}
      <ListCard title={`${TYPE[k].label} - the tickets`} hint={`${full(rows.length)} ticket${rows.length === 1 ? "" : "s"} in the last ${d.days} days, newest first · a click on a column orders by it`}
        source={ticketSource(`list|${k}|${d.days}|${rows.length}`, rows, TYPE[k].status, false)} />
      {t.dialog}
    </>
  );
}

// ---------------------------------------------------------------- Decisions

const WHAT: Record<LogEntry["what"], string> = { flag: "Flagged", owner: "Owner handed over", merge: "Merged", not_duplicate: "Not a duplicate", nothing: "Nothing to do", error: "Failed" };
function DecisionsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const now = async () => {
    setBusy(true); setMsg(null);
    try {
      const j = (await (await fetch("/api/uc/ticket-duplicates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decisions" }) })).json()) as { ok: boolean; error?: string; data?: { skipped?: string; done?: number; errors?: number } };
      setMsg(!j.ok ? j.error ?? "Failed" : j.data?.skipped ? `Not run: ${j.data.skipped}.` : `${full(j.data?.done ?? 0)} done, ${full(j.data?.errors ?? 0)} failed.`);
      onChanged();
    } finally { setBusy(false); }
  };
  const on = d.settings.merging === "on" && d.props.ready;
  const logSource: CompanySource = {
    key: `log|${d.log.length}|${d.log[0]?.at ?? ""}`, object: "tickets", note: "The last 200 things the hub did on tickets - newest first",
    head: ["When", "What", "Details", "Decided by"], left: [2, 3, 4], widths: ["minmax(110px, 0.6fr)", "minmax(130px, 0.7fr)", "minmax(320px, 2.5fr)", "minmax(140px, 1fr)"],
    rows: () => d.log.map((e) => ({ id: e.ticketId, name: `Ticket ${e.ticketId}`, cells: [dayTime(e.at), WHAT[e.what], e.text, e.by ?? "—"], values: [e.at, e.what, e.text, e.by ?? null] })),
  };
  return (
    <>
      <StatusCard tone={on ? "#1f8a4c" : "#8a94a6"} beat={on} title={on ? "Merging is on - the hub carries out the decisions within a minute" : "Merging is off - decisions wait"}
        line={[
          d.decided ? `Last look ${dayTime(d.decided.at)}: ${full(d.decided.done)} done${d.decided.errors ? `, ${full(d.decided.errors)} failed` : ""}` : "Not run yet",
          !d.props.ready ? "the properties are missing (Settings)" : null,
          d.workflows.merging ? "the old workflow SARCLA | BO MERGING is still on - it acts only on the old Merge_ticket_decision" : null,
        ].filter(Boolean).join(" · ")}
        right={d.admin ? <Button variant="outlined" size="small" disabled={busy || !on} onClick={() => void now()} sx={{ textTransform: "none" }}>{busy ? <CircularProgress size={14} /> : "Carry them out now"}</Button> : undefined} />
      {msg && <Typography sx={{ ...small, color: MUTED }}>{msg}</Typography>}
      <Info>
        On the ticket&apos;s card (the right sidebar, and the Help Desk) a person clicks <b>Merge</b> or <b>Not a duplicate</b> - or sets
        &quot;Duplicate - decision&quot; in the ticket&apos;s left sidebar. The hub merges every ticket of the group in the same pipeline into the
        oldest <b>open</b> one - never into a closed ticket, never across pipelines - and empties the decision. &quot;Not a duplicate&quot; is kept: the
        same tickets are never flagged together again.
      </Info>
      <ChartBox title="Waiting for the hub" hint={d.props.have.includes("dup_decision") ? "Decisions set on tickets and not carried out yet" : "Once the properties exist (Settings)"}>
        {d.pending.length ? (
          <KitTable head={["Ticket", "Decision", "Decided by", "Since"]} left={[1, 2]} minWidth={520} rows={d.pending.map((p) => ({
            key: p.id, cells: [link(p.id, p.subject || `Ticket ${p.id}`), p.decision === "merge" ? "Merge them" : p.decision === "not_duplicate" ? "Not a duplicate" : p.decision, p.by ?? "—", p.at ? dayTime(p.at) : "—"],
          }))} />
        ) : <Typography sx={{ ...small, color: FAINT }}>Nothing waiting.</Typography>}
      </ChartBox>
      <ListCard title="What the hub did" hint="Flags written, owners handed over, merges and decisions - a click on a column orders by it" source={logSource} />
    </>
  );
}

// ---------------------------------------------------------------- Settings

function RowDetail({ r }: { r: Row }) {
  const v = r.v;
  const line = (label: string, text: React.ReactNode) => <Typography sx={{ fontSize: "0.82rem", color: INK }}><b>{label}</b> {text}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      {v && line("The hub:", v.type ? <>{TYPE[v.type].status} ({TYPE[v.type].label}) - {v.why}{v.ownerChange ? ` - owner to ${r.ownerNames[v.ownerChange.ownerId] ?? v.ownerChange.ownerId}` : ""}</> : `nothing to flag${v.skip ? ` - ${v.skip}` : ""}`)}
      {v?.of.length ? line("The other tickets:", <Others r={r} ids={v.of} />) : null}
      {v?.history.length ? line("Closed on the same order:", v.history.map((id) => <Box component="span" key={id} sx={{ mr: 1 }}>{link(id)}</Box>)) : null}
      {v?.elsewhere.length ? line("Open in another pipeline:", v.elsewhere.map((id) => <Box component="span" key={id} sx={{ mr: 1 }}>{link(id)}</Box>)) : null}
      {r.stopped && line("The workflow:", r.stopped)}
      {r.legacy && line("The workflow (copy):", r.legacy.message)}
      {r.actual && line("HubSpot wrote:", r.actual.firstMessage ?? r.actual.message ?? "nothing")}
      {r.error && line("Error:", r.error)}
    </Box>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [texts, setTexts] = useState(d.settings.types.neverMatchTexts.join("\n"));
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<{ row?: Row; error?: string } | null>(null);
  const call = async (what: string, method: "PUT" | "POST", body: object, done: string) => {
    setBusy(what); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-duplicates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; error?: string; data?: { skipped?: string; error?: string; missing?: string[] } };
      setMsg(!j.ok ? j.error ?? `HTTP ${r.status}` : j.data?.skipped ? `Not run: ${j.data.skipped}.` : done);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const j = (await (await fetch(`/api/uc/ticket-duplicates?ticket=${encodeURIComponent(tid.trim())}`)).json()) as { ok: boolean; data?: Row; error?: string };
      setCheck(j.ok && j.data ? { row: j.data } : { error: j.error ?? "Failed" });
    } catch (e) { setCheck({ error: (e as Error).message }); } finally { setBusy(null); }
  };
  const wf = d.workflows;
  const flow = (on: boolean | null) => (on === null ? "could not be read" : on ? "ON" : "off");
  const b = d.backfill;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes, four minutes after a ticket enters Back Office New`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<Mode> value={d.settings.mode} onChange={(m) => d.admin && void call("mode", "PUT", { mode: m }, "Saved.")} options={[
            { key: "shadow", label: "Shadow - check, write nothing" }, { key: "live", label: "Live - write on the tickets" }, { key: "off", label: "Off" },
          ]} />
          <Typography sx={{ ...small, color: MUTED }}>
            Live writes only while the workflow <b>SARCLA | BACK OFFICE FILTERING | DUPS HANDLING WITH CODE</b> is off in HubSpot (now: <b>{flow(wf.dups)}</b>), so the two never write at once - switch Live on here, then the workflow off.
            Rollback: the workflow on again.
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Merging</Typography>
            <Choice<"off" | "on"> value={d.settings.merging} onChange={(m) => d.admin && void call("merging", "PUT", { merging: m }, "Saved.")} options={[{ key: "on", label: "On - carry out the decisions" }, { key: "off", label: "Off" }]} />
          </Box>
          <Typography sx={{ ...small, color: MUTED }}>
            The decisions people take on the ticket card. The old workflow <b>SARCLA | BO MERGING</b> (now: <b>{flow(wf.merging)}</b>) acts on the old Merge_ticket_decision only - switch it off once the card is in use.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button variant="outlined" size="small" disabled={!!busy} onClick={() => void call("run", "POST", { action: "run" }, "Done.")} sx={{ textTransform: "none" }}>Look now</Button>
              {busy && <CircularProgress size={14} />}
            </Box>
          )}
        </Box>
      </GlassCard>
      {msg && <Typography sx={{ ...small, color: MUTED }}>{msg}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ViewListOutlinedIcon />} tint="purple" title="The properties - group Duplicates (APSOhub)" note="What the hub writes, and what the card and the left sidebar show. The workflow's dup_detected, DUP REASON AND ID and Comment for Back Office are left as they are" />
        <Box sx={{ display: "grid", gap: 0.5, mb: 1.5 }}>
          {Object.keys(PROP_LABEL).map((n) => (
            <Typography key={n} sx={{ fontSize: "0.84rem", color: INK }}>
              <Box component="span" sx={{ color: d.props.have.includes(n) ? "#1f8a4c" : RED, fontWeight: 700 }}>{d.props.have.includes(n) ? "✓" : "✗"}</Box> {PROP_LABEL[n]} <Box component="span" sx={{ color: FAINT }}>· {n}</Box>
            </Typography>
          ))}
        </Box>
        {d.props.error && <Typography sx={{ ...small, color: RED, mb: 1 }}>{d.props.error}</Typography>}
        {d.admin && !d.props.ready && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="contained" size="small" disableElevation disabled={!!busy} onClick={() => void call("properties", "POST", { action: "properties" }, "Created.")} sx={{ textTransform: "none" }}>Create the properties</Button>
            {busy === "properties" && <CircularProgress size={14} />}
            <Typography sx={{ ...small, color: MUTED }}>Needs the app&apos;s permission to create ticket properties (crm.schemas.tickets.write).</Typography>
          </Box>
        )}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<BlockOutlinedIcon />} tint="slate" title="Never compared" note="A subject containing one of these is never a duplicate, of any type - on top of certificates, C2S problems and warnings (⚠)" />
        <TextField multiline minRows={4} fullWidth size="small" value={texts} disabled={!d.admin} onChange={(e) => setTexts(e.target.value)} sx={{ maxWidth: 760 }} />
        {d.admin && <Box sx={{ mt: 1 }}><Button variant="contained" size="small" disableElevation disabled={!!busy} onClick={() => void call("texts", "PUT", { types: { neverMatchTexts: texts.split("\n") } }, "Saved.")} sx={{ textTransform: "none" }}>Save</Button></Box>}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ReplayOutlinedIcon />} tint="amber" title="The last 7 days" note="Back Office tickets of the last week checked with these rules, 25 every 3 minutes, oldest first" />
        <Typography sx={{ fontSize: "0.84rem", color: INK }}>
          {b ? `${b.done ? "Done" : "Running"}: ${full(b.checked)} tickets since ${dayTime(b.startedAt)}${b.done ? "" : `, now at ${dayTime(new Date(b.cursor).toISOString())}`}.` : "Starts with the next run."}
        </Typography>
        {d.admin && <Box sx={{ mt: 1 }}><Button variant="outlined" size="small" disabled={!!busy} onClick={() => void call("replay", "POST", { action: "replay" }, "The replay starts again from 7 days ago.")} sx={{ textTransform: "none" }}>Replay the last 7 days</Button></Box>}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read only - what the hub finds for it now, beside the workflow. Nothing is stored or written" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (/^\d+$/.test(tid.trim()) && !busy) void doCheck(); }} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Ticket id, e.g. 439114412256" inputProps={{ "aria-label": "Ticket id", inputMode: "numeric" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!/^\d+$/.test(tid.trim()) || !!busy} sx={{ textTransform: "none" }}>
            {busy === "check" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check?.error && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1.5 }}>{check.error}</Typography>}
        {check?.row && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 600 }}>{link(check.row.ticketId, check.row.subject || check.row.ticketId)} <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}>- order {check.row.keys || "none"}</Box></Typography>
            <RowDetail r={check.row} />
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function TicketDuplicates() {
  const [tab, setTab] = useHashTab<TabId>(TAB_HASH, "overview");
  const [n, setN] = useState(0);
  const [days, setDays] = useState(14);
  const url = `/api/uc/ticket-duplicates?days=${days}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = () => setN((x) => x + 1);
  const d = r?.state === "ok" ? r.data : null;
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok" || !d) body = <UpstreamPanel source="Duplicates & merges" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (tab === "settings") body = <SettingsTab key={d.settings.at ?? "x"} d={d} onChanged={again} />;
  else if (tab === "decisions") body = <DecisionsTab d={d} onChanged={again} />;
  else if (tab === "overview") body = <Overview d={d} />;
  else body = <TypeTab k={tab} d={d} onSaved={again} />;
  const f = d?.figures;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Duplicates & merges"
        subtitle="Back Office tickets that are the same request twice, or about the same order - flagged on the ticket, merged by a click"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {d && <Status d={d} />}
      <Box>
        <ReportTabs name="ticketdup" tab={tab} onSelect={setTab} tabs={[
          { id: "overview", label: "Overview", count: null },
          ...DUP_TYPES.map((k) => ({ id: k, label: TYPE[k].label, count: f?.byType[k].flagged ? full(f.byType[k].flagged) : null })),
          { id: "decisions", label: "Decisions", count: d?.pending.length ? full(d.pending.length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {tab !== "settings" && tab !== "decisions" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <HourglassEmptyOutlinedIcon sx={{ fontSize: 16, color: MUTED }} />
          <Typography sx={{ ...small, color: MUTED }}>Tickets that entered Back Office New in the</Typography>
          <Choice<"7" | "14" | "21"> value={String(days) as "7" | "14" | "21"} onChange={(k) => setDays(Number(k))} options={[{ key: "7", label: "last 7 days" }, { key: "14", label: "last 14 days" }, { key: "21", label: "last 21 days" }]} />
        </Box>
      )}
      <Box id={`ticketdup-panel-${tab}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
