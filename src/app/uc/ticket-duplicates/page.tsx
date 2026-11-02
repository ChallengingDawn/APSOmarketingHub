"use client";

// DUPLICATES & MERGES - a HubSpot app (UC & HubSpot Apps > HubSpot apps). SARCLA 02.11.2026: "improve a lot the duplicated
// app ... tabs to steer the different types"; then "we need the last 365 days", the workflow comparison and erosion "not
// necessary", "never compared should have its own tab and be more developed", the quality of the rest of the platform,
// and "if we are 100% ... merge the 100% directly and the rest await for the manual". Overview = the flow from a new
// ticket to a merge; a tab per type (the same request twice, the same order); Never compared; Decisions = what people
// chose on the ticket card and what the hub did; Settings. The period: the platform's time frame, up to 365 days.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputBase from "@mui/material/InputBase";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import TextFieldsOutlinedIcon from "@mui/icons-material/TextFieldsOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Choice, Info } from "@/app/connectors/parts";
import { ChartBox } from "@/app/reporting/eso-benchmark/Figures";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { Table as KitTable } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { CompanyDialog, type CompanyItem, type CompanySource } from "@/app/reporting/CompanyList";
import { ListCard, StatusCard, dayTime } from "@/app/uc/segmentation/lists";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import type { Mode, RunInfo, Settings } from "@/lib/ticketDuplicates/engine";
import { outcomeOf, type Row } from "@/lib/ticketDuplicates/model";
import { gapKey, isElsewhereOnly, isHistoryOnly, isSure, ownerOfFirst, type Count, type Figures } from "@/lib/ticketDuplicates/figures";
import type { PropsState } from "@/lib/ticketDuplicates/properties";
import type { LogEntry, Pending } from "@/lib/ticketDuplicates/live";
import type { YearState } from "@/lib/ticketDuplicates/year";
import { BUILT_IN, type TypeSettings } from "@/lib/ticketDuplicates/types";

type Data = {
  settings: Settings; last: RunInfo | null; decided: { at: string; done: number; errors: number } | null; year: YearState | null;
  everyMinutes: number; from: string; to: string; days: number; figures: Figures; rows: Row[];
  workflows: { dups: boolean | null; merging: boolean | null }; props: PropsState; pending: Pending[]; log: LogEntry[]; admin: boolean;
};
type TabId = "overview" | "twice" | "order" | "never" | "decisions" | "settings";
const TAB_HASH: Record<TabId, string> = { overview: "#overview", twice: "#same-request-twice", order: "#same-order", never: "#never-compared", decisions: "#decisions", settings: "#settings" };

const PIPES: Record<string, string> = { "1726786777": "Back Office", "1726599376": "ESO", "1726599377": "TSA", "1726786775": "GQS", "1553929403": "Special Prices", "1737150687": "Product Management" };
const pipeLabel = (id: string | null | undefined) => (id ? PIPES[id] ?? `pipeline ${id}` : "—");
const OUTCOME: Record<"merged" | "closed" | "open", string> = { merged: "Merged", closed: "Closed, not merged", open: "Still open" };
const COLOR = { sure: "#1b7a55", possible: "#7c5cd6", order: "#2d6fa8", history: "#8a94a6", never: "#c47a00" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const small = { fontSize: "0.8rem" } as const;
const dd = (x: string) => (x.length === 10 ? `${x.slice(8, 10)}.${x.slice(5, 7)}` : `${x.slice(5, 7)}.${x.slice(2, 4)}`);

type Answer = { ok: boolean; error?: string; data?: { skipped?: string; done?: number; errors?: number } };
async function send(method: "PUT" | "POST", body: object): Promise<Answer> {
  const r = await fetch("/api/uc/ticket-duplicates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as Answer;
}

// ---------------------------------------------------------------- the tickets, in the reporting window's table

const link = (id: string, text?: string) => (
  <Box component="a" href={hsTicket(id)} target="_blank" rel="noreferrer" title="Open in HubSpot" onClick={(e: React.MouseEvent) => e.stopPropagation()}
    sx={{ color: INK, textDecoration: "underline", textDecorationColor: "rgba(21,34,58,.35)", textUnderlineOffset: "3px", "&:hover": { color: TINT.blue.fg } }}>{text ?? id}</Box>
);
/** The tickets a row points at: the hub's, else the closed or elsewhere ones it only shows. */
const shownIds = (r: Row) => { const v = r.v; return v?.of.length ? v.of : v?.history.length ? v.history : v?.elsewhere ?? []; };
function Others({ r }: { r: Row }) {
  const ids = shownIds(r);
  if (!ids.length) return <>—</>;
  return (
    <Box component="span" sx={{ display: "grid", gap: 0.25, minWidth: 0 }}>
      {ids.slice(0, 3).map((id) => {
        const x = r.dups?.[id];
        return (
          <Box key={id} component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {link(id, x?.subject || `Ticket ${id}`)}
            <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}> · {x ? `${pipeLabel(x.pipeline)}, ${x.closed ? "closed" : "open"}${x.owner ? `, ${r.ownerNames[x.owner] ?? x.owner}` : ""}` : "—"}</Box>
          </Box>
        );
      })}
      {ids.length > 3 && <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>and {ids.length - 3} more</Box>}
    </Box>
  );
}
const why = (r: Row) => {
  const v = r.v;
  if (!v) return "—";
  if (v.why) return v.why;
  if (v.excludedBy) return `Never compared - ${v.excludedBy}`;
  if (isHistoryOnly(r)) return "Only closed tickets on the same order - history, shown on the card";
  if (isElsewhereOnly(r)) return "Open only in another pipeline - shown on the card";
  return v.skip ?? "Nothing found";
};
const hubDid = (r: Row) => (r.live?.merged ? `merged into ${r.live.merged}` : r.live?.error ? `error: ${r.live.error}` : r.live?.flagged ? `written${r.live.owner ? ", owner handed over" : ""}` : r.live?.note ?? (r.backfill ? "from the year's read" : "shadow - not written"));

type Cols = "flags" | "never";
/** The tickets of a list: the ticket (to HubSpot), when, the others, why, owner, what became of it, what the hub did. */
function ticketSource(key: string, rows: Row[], note: string, cols: Cols = "flags"): CompanySource {
  if (cols === "never") {
    return {
      key, note, object: "tickets", head: ["Entered", "Left out by", "Sender"], left: [2, 3], widths: ["minmax(110px, 0.5fr)", "minmax(220px, 1.4fr)", "minmax(160px, 1fr)"],
      rows: () => rows.map((r): CompanyItem => ({ id: r.ticketId, name: r.subject || `Ticket ${r.ticketId}`, cells: [dayTime(r.enteredAt), r.v?.excludedBy ?? "—", r.sender ?? "—"], values: [r.enteredAt, r.v?.excludedBy ?? null, r.sender ?? null] })),
    };
  }
  return {
    key, note, object: "tickets",
    head: ["Entered", "The other tickets", "Why", "Owner", "Then", "The hub"],
    left: [2, 3, 4, 5, 6],
    widths: ["minmax(92px, 0.5fr)", "minmax(220px, 1.7fr)", "minmax(240px, 1.9fr)", "minmax(120px, 0.8fr)", "minmax(110px, 0.7fr)", "minmax(130px, 0.9fr)"],
    rows: () => rows.map((r): CompanyItem => {
      const v = r.v;
      const own = v?.ownerChange ? `→ ${r.ownerNames[v.ownerChange.ownerId] ?? v.ownerChange.ownerId}` : r.ownerAtCheck ? r.ownerNames[r.ownerAtCheck] ?? r.ownerAtCheck : "—";
      return {
        id: r.ticketId, name: r.subject || `Ticket ${r.ticketId}`,
        cells: [dayTime(r.enteredAt), <Others key="o" r={r} />, why(r), own, OUTCOME[outcomeOf(r)], hubDid(r)],
        values: [r.enteredAt, null, why(r), null, outcomeOf(r), null],
      };
    }),
  };
}
/** A list that opens in the window - the tickets of a figure, a bar or a step. */
function useTickets() {
  const [open, setOpen] = useState<{ title: string; source: CompanySource } | null>(null);
  return {
    show: (title: string, rows: Row[], note: string, cols: Cols = "flags") => { if (rows.length) setOpen({ title, source: ticketSource(`${title}|${rows.length}`, rows, note, cols) }); },
    dialog: open ? <CompanyDialog source={open.source} title={open.title} onClose={() => setOpen(null)} /> : null,
  };
}
const Tiles = ({ items }: { items: { label: string; value: number; icon: React.ReactNode; tint: Tint; note: string }[] }) => (
  <Grid container spacing={2}>
    {items.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>)}
  </Grid>
);
/** A breakdown as the reporting pages draw it: a bar per value, a click lists its tickets. */
function Breakdown({ title, rows, fixed, onPick, source, labelWidth }: { title: string; rows: Count[]; fixed?: boolean; onPick: (key: string) => void; source: CompanySource | null; labelWidth?: number }) {
  const data = rows.filter((x) => x.count || fixed).map((x) => ({ label: x.key, n: x.count }));
  if (!data.length) return <ChartBox title={title}><Typography sx={{ ...small, color: FAINT }}>Nothing in this period.</Typography></ChartBox>;
  return (
    <DimChart title={title} rows={data} cur={(r) => r.n} prev={() => 0} curLabel="Tickets" prevLabel="" fmt={(n) => full(n)} single fixedOrder={fixed}
      onPick={onPick} pickHint="Click a bar for its tickets" companies={source} pageSize={8} labelWidth={labelWidth ?? 170} />
  );
}
type Part = "sure" | "possible" | "order";
const PART_LABEL: Record<Part, string> = { sure: "100% sure", possible: "Possible - a person decides", order: "Same order, still open" };
function Series({ f, parts, source }: { f: Figures; parts: Part[]; source: CompanySource | null }) {
  return (
    <ChartBox title={f.byDay ? "Day by day" : "Month by month"} hint={`By the ${f.byDay ? "day" : "month"} the ticket entered Back Office New`} companies={source}>
      {f.series.some((s) => parts.some((p) => s[p]))
        ? <StackedColumns data={f.series.map((s) => ({ x: s.x, ...Object.fromEntries(parts.map((p) => [p, s[p]])) }))} parts={parts.map((p) => ({ key: p, label: PART_LABEL[p] }))} height={240} format={(n) => full(n ?? 0)} xFormat={dd} />
        : <Typography sx={{ ...small, color: FAINT }}>Nothing in this period.</Typography>}
    </ChartBox>
  );
}

// ---------------------------------------------------------------- the line every tab starts with

function Status({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const s = d.settings, wf = d.workflows.dups, ready = d.props.ready;
  const [busy, setBusy] = useState(false);
  const live = s.mode === "live" && wf === false && ready;
  const waiting = s.mode === "live" && !live;
  const tone = live ? "#1f8a4c" : waiting ? "#c47a00" : s.mode === "off" ? "#8a94a6" : TINT.blue.fg;
  const title = live ? "Live - the hub writes on the tickets and merges the 100% sure ones"
    : waiting ? `Live is chosen - the hub waits: ${wf !== false ? "the DUPS workflow is still on in HubSpot" : "the properties are missing"}`
    : s.mode === "off" ? "Off - nothing is checked" : "Shadow - every new Back Office ticket is checked, nothing is written";
  const y = d.year;
  const line = [
    d.last ? `last look ${dayTime(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.checked)} checked${d.last.merged ? `, ${full(d.last.merged)} merged` : ""}${d.last.written ? `, ${full(d.last.written)} written` : ""}` : "not run yet",
    y && !y.done ? `the last 365 days: ${y.error ? `stopped - ${y.error}` : y.step}${y.tickets ? `, ${full(y.tickets)} tickets read` : ""}${y.built ? `, ${full(y.built)} checked` : ""}` : y?.at ? `the year read ${dayTime(y.at)}` : "the year is read after the first run",
    `merging ${s.merging}`,
  ].join(" · ");
  const create = async () => { setBusy(true); try { await send("POST", { action: "properties" }); onChanged(); } finally { setBusy(false); } };
  return (
    <StatusCard tone={tone} beat={live || s.mode === "shadow" || !!(y && !y.done && !y.error)} title={title} line={line}
      right={!ready && d.admin ? <Button variant="contained" size="small" disableElevation disabled={busy} onClick={() => void create()} sx={{ textTransform: "none" }}>{busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Create the properties"}</Button> : undefined} />
  );
}

// ---------------------------------------------------------------- Overview: from a new ticket to a merge

function Flow({ d, show }: { d: Data; show: ReturnType<typeof useTickets>["show"] }) {
  const f = d.figures, rows = d.rows;
  const twice = rows.filter((r) => r.v?.type === "twice"), possible = twice.filter((r) => !isSure(r));
  const by = (k: "merged" | "closed" | "open") => possible.filter((r) => outcomeOf(r) === k);
  type Step = { label: string; value: number; note: string; color: string; level: 0 | 1 | 2 | 3; list?: Row[]; cols?: Cols };
  const steps: Step[] = [
    { label: "Checked", value: f.checked, note: `every ticket that entered Back Office New in ${d.days} days`, color: "#15223a", level: 0 },
    { label: "Never compared", value: f.excluded, note: "certificates, C2S problems, warnings, erosion win-backs and the texts set - see Never compared", color: COLOR.never, level: 1, list: rows.filter((r) => r.v?.excludedBy), cols: "never" },
    { label: "Same request twice", value: f.twice.flagged, note: "the same subject from the same sender or on the same order, the earlier ticket still open", color: COLOR.possible, level: 1, list: twice },
    { label: "100% sure - the same e-mail", value: f.twice.sure, note: d.settings.mode === "live" ? `merged into the older ticket by the hub, its owner kept - ${full(f.twice.autoMerged)} so far` : "merged into the older ticket by the hub, its owner kept - once Live", color: COLOR.sure, level: 2, list: twice.filter(isSure) },
    { label: "Possible - a person decides", value: f.twice.possible, note: "flagged on the ticket: Merge or Not a duplicate on its card", color: COLOR.possible, level: 2, list: possible },
    { label: "Merged", value: by("merged").length, note: "", color: "#1f8a4c", level: 3, list: by("merged") },
    { label: "Closed, not merged", value: by("closed").length, note: "", color: "#8a94a6", level: 3, list: by("closed") },
    { label: "Still open", value: by("open").length, note: "", color: "#eda100", level: 3, list: by("open") },
    { label: "Same order, still open", value: f.order.flagged, note: "another request on the order - the owner of the oldest takes it, nothing to merge", color: COLOR.order, level: 1, list: rows.filter((r) => r.v?.type === "order") },
    { label: "Only closed tickets on the order", value: f.order.historyOnly, note: "the earlier request was done - history on the card, never a flag", color: COLOR.history, level: 1, list: rows.filter(isHistoryOnly) },
    { label: "Open only in another pipeline", value: f.order.elsewhereOnly, note: "ESO or TSA has the order - shown on the card, never a flag", color: COLOR.history, level: 1, list: rows.filter(isElsewhereOnly) },
    { label: "Nothing found", value: Math.max(0, f.nothing - f.order.historyOnly - f.order.elsewhereOnly), note: "no order number, or nobody else on it", color: "#c9cfd8", level: 1 },
  ];
  const n = f.checked;
  return (
    <ChartBox title="From a new ticket to a merge" hint="Every step is a share of the tickets checked - a click on a step lists its tickets">
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {steps.map((x) => {
          const click = x.list && x.value ? () => show(x.label, x.list!, x.note || x.label, x.cols) : undefined;
          return (
            <Box key={x.label} component={click ? "button" : "div"} type={click ? "button" : undefined} onClick={click}
              sx={{ all: "unset", display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "300px minmax(0, 1fr) 130px" }, gap: { xs: 0.5, md: 1.5 }, alignItems: "center", cursor: click ? "pointer" : "default",
                pl: { xs: x.level * 1.5, md: x.level * 2.5 }, py: 0.5, borderRadius: "10px", "&:hover": click ? { bgcolor: "rgba(21,34,58,.03)" } : {} }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: x.level ? "0.84rem" : "0.9rem", fontWeight: x.level < 2 ? 700 : 600, color: INK }}>{x.label}</Typography>
                {x.note && <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.4 }}>{x.note}</Typography>}
              </Box>
              <Box sx={{ height: x.level < 2 ? 16 : 10, borderRadius: "6px", bgcolor: "rgba(21,34,58,.05)", overflow: "hidden" }}>
                <Box sx={{ height: "100%", width: `${n ? Math.max(x.value ? 0.4 : 0, (100 * x.value) / n) : 0}%`, bgcolor: x.color, borderRadius: "6px", transition: "width .4s ease" }} />
              </Box>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, textAlign: { xs: "left", md: "right" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {full(x.value)} <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}>· {pct(x.value, n)}</Box>
              </Typography>
            </Box>
          );
        })}
      </Box>
    </ChartBox>
  );
}

function Overview({ d }: { d: Data }) {
  const f = d.figures;
  const t = useTickets();
  const flagged = d.rows.filter((r) => r.v?.status);
  const possible = d.rows.filter((r) => r.v?.type === "twice" && !isSure(r));
  return (
    <>
      <Tiles items={[
        { label: "Tickets checked", value: f.checked, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue", note: `entered Back Office New in ${d.days} days${f.rebuilt === f.checked ? " · read from the year's tickets" : f.rebuilt ? ` · ${full(f.rebuilt)} from the year's read` : ""}` },
        { label: "100% sure - merged by the hub", value: f.twice.sure, icon: <VerifiedOutlinedIcon />, tint: "green", note: d.settings.mode === "live" ? `the same e-mail twice · ${full(f.twice.autoMerged)} merged by the hub` : "the same e-mail twice · merged by the hub once Live" },
        { label: "Possible - a person decides", value: f.twice.possible, icon: <HourglassEmptyOutlinedIcon />, tint: "purple", note: `flagged on the ticket · ${full(possible.filter((r) => outcomeOf(r) === "merged").length)} merged, ${full(possible.filter((r) => outcomeOf(r) === "open").length)} still open` },
        { label: "Same order, still open", value: f.order.flagged, icon: <ReceiptLongOutlinedIcon />, tint: "blue", note: `another request on an open order · ${full(f.order.owner)} owners handed over` },
      ]} />
      <Flow d={d} show={t.show} />
      <Series f={f} parts={["sure", "possible", "order"]} source={flagged.length ? ticketSource(`series|${d.from}|${d.to}`, flagged, "Every ticket flagged in the period, newest first") : null} />
      {t.dialog}
    </>
  );
}

// ---------------------------------------------------------------- the rule of a type, at the foot of its tab

function RuleCard({ k, d, onSaved }: { k: "twice" | "order"; d: Data; onSaved: () => void }) {
  const [ts, setTs] = useState<TypeSettings>(d.settings.types);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const off = !d.admin;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const j = await send("PUT", { types: k === "twice" ? { twice: ts.twice } : { order: ts.order } }); setMsg(j.ok ? "Saved - new tickets are checked with it." : j.error ?? "Not saved"); onSaved(); }
    finally { setBusy(false); }
  };
  const box = (checked: boolean, set: (v: boolean) => void, label: React.ReactNode) => (
    <FormControlLabel sx={{ m: 0, alignItems: "flex-start" }} control={<Checkbox size="small" checked={checked} disabled={off} onChange={(e) => set(e.target.checked)} sx={{ pt: 0.25 }} />} label={<Typography sx={{ fontSize: "0.84rem", color: INK }}>{label}</Typography>} />
  );
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<RuleOutlinedIcon />} tint={k === "twice" ? "purple" : "blue"} title="The rule" note={k === "twice"
        ? "The same subject from the same customer - or on the same order - while the earlier ticket is still open in the same pipeline. The same e-mail, word for word, makes it 100% sure"
        : "Another open ticket on the same order in the same pipeline: another request about it. Closed tickets on the order are history only, an open one in another pipeline is shown"} />
      <Box sx={{ display: "grid", gap: 1.25, maxWidth: 820 }}>
        <Choice<"on" | "off"> value={ts[k].on ? "on" : "off"} onChange={(v) => { if (!off) setTs((x) => ({ ...x, [k]: { ...x[k], on: v === "on" } })); }} options={[{ key: "on", label: "On" }, { key: "off", label: "Off - never flagged" }]} />
        {k === "twice" ? (
          <>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField size="small" type="number" label="Within (hours)" value={ts.twice.withinHours} disabled={off} onChange={(e) => setTs((x) => ({ ...x, twice: { ...x.twice, withinHours: Number(e.target.value) } }))} sx={{ width: 150 }} />
              <Typography sx={{ ...small, color: MUTED }}>the earlier ticket at most this long before</Typography>
            </Box>
            {box(ts.twice.autoMerge, (v) => setTs((x) => ({ ...x, twice: { ...x.twice, autoMerge: v } })), <><b>Merge the 100% sure ones</b> - into the older ticket, which keeps its owner, as long as it is open. The others wait for a person.</>)}
            {box(ts.twice.handOver, (v) => setTs((x) => ({ ...x, twice: { ...x.twice, handOver: v } })), "Give a possible duplicate to the owner of the first ticket, so one person sees both")}
          </>
        ) : (
          <>
            {box(ts.order.handOver, (v) => setTs((x) => ({ ...x, order: { ...x.order, handOver: v } })), "Give the ticket to the owner of the oldest open ticket on the order - one person per order, within the pipeline")}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField size="small" type="number" label="Owner from tickets up to (days)" value={ts.order.ownerMaxAgeDays} disabled={off} onChange={(e) => setTs((x) => ({ ...x, order: { ...x.order, ownerMaxAgeDays: Number(e.target.value) } }))} sx={{ width: 230 }} />
              <Typography sx={{ ...small, color: MUTED }}>an older open ticket still shows, its owner is not taken</Typography>
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

/** A list on its tab, with the choice of what it shows. */
function TypeList<K extends string>({ title, hint, all, filters, cols }: { title: string; hint: string; all: Row[]; filters: { key: K; label: string; test: (r: Row) => boolean }[]; cols?: Cols }) {
  const [on, setOn] = useState<K>(filters[0].key);
  const f = filters.find((x) => x.key === on) ?? filters[0];
  const rows = all.filter(f.test);
  return (
    <ListCard title={title} hint={`${hint} · a click on a column orders by it`} source={ticketSource(`${title}|${on}|${rows.length}|${rows[0]?.key ?? ""}`, rows, f.label, cols)}>
      <Choice<K> value={on} onChange={setOn} options={filters.map((x) => ({ key: x.key, label: x.label, count: all.filter(x.test).length }))} />
    </ListCard>
  );
}

// ---------------------------------------------------------------- Same request twice

function TwiceTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const f = d.figures, x = f.twice;
  const t = useTickets();
  const rows = d.rows.filter((r) => r.v?.type === "twice");
  const src = (key: string) => (rows.length ? ticketSource(`${key}|${d.from}|${d.to}`, rows, "Same request twice") : null);
  return (
    <>
      <Tiles items={[
        { label: "Same request twice", value: x.flagged, icon: <ContentCopyOutlinedIcon />, tint: "purple", note: `${pct(x.flagged, f.compared)} of the tickets compared` },
        { label: "100% sure", value: x.sure, icon: <VerifiedOutlinedIcon />, tint: "green", note: "the same e-mail, word for word - merged by the hub" },
        { label: "Merged", value: x.merged, icon: <CallMergeOutlinedIcon />, tint: "green", note: `${pct(x.merged, x.flagged)} of them${x.autoMerged ? ` · ${full(x.autoMerged)} by the hub` : ""}` },
        { label: "Still open", value: x.open, icon: <HourglassEmptyOutlinedIcon />, tint: "amber", note: `${full(x.closed)} closed without a merge` },
      ]} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}><Series f={f} parts={["sure", "possible"]} source={src("tw-series")} /></Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Breakdown title="Time between the two tickets" rows={f.gaps} fixed source={src("tw-gap")} labelWidth={150}
            onPick={(k) => t.show(`${k} between the two`, rows.filter((r) => gapKey(r.v!.gapMin ?? 0) === k), "Same request twice")} />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Breakdown title="Who has the first ticket" rows={f.twiceOwners} source={src("tw-own")}
            onPick={(k) => t.show(`First ticket with ${k}`, rows.filter((r) => ownerOfFirst(r) === k), "Same request twice")} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Breakdown title="Who sent them - by e-mail domain" rows={f.twiceSenders} source={src("tw-snd")} labelWidth={190}
            onPick={(k) => t.show(`Sent from ${k}`, rows.filter((r) => (r.sender ?? "no sender") === k), "Same request twice")} />
        </Grid>
      </Grid>
      <TypeList title="Same request twice - the tickets" hint={`${full(rows.length)} in ${d.days} days, newest first`} all={rows} filters={[
        { key: "all", label: "All", test: () => true },
        { key: "sure", label: "100% sure", test: isSure },
        { key: "possible", label: "Possible", test: (r) => !isSure(r) },
        { key: "merged", label: "Merged", test: (r) => outcomeOf(r) === "merged" },
        { key: "open", label: "Still open", test: (r) => outcomeOf(r) === "open" },
      ]} />
      <RuleCard key={`tw|${d.settings.at ?? ""}`} k="twice" d={d} onSaved={onSaved} />
      {t.dialog}
    </>
  );
}

// ---------------------------------------------------------------- Same order

function OrderTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const f = d.figures, x = f.order;
  const t = useTickets();
  const rows = d.rows.filter((r) => r.v?.type === "order");
  const shown = d.rows.filter((r) => r.v?.type === "order" || isHistoryOnly(r) || isElsewhereOnly(r));
  const src = (key: string) => (rows.length ? ticketSource(`${key}|${d.from}|${d.to}`, rows, "Same order, still open") : null);
  return (
    <>
      <Tiles items={[
        { label: "Same order, still open", value: x.flagged, icon: <ReceiptLongOutlinedIcon />, tint: "blue", note: "another request on an order someone already works" },
        { label: "Owner handed over", value: x.owner, icon: <PersonOutlineOutlinedIcon />, tint: "amber", note: "to the owner of the oldest open ticket on the order" },
        { label: "Only closed tickets on the order", value: x.historyOnly, icon: <HistoryOutlinedIcon />, tint: "slate", note: "a new request after the earlier one was done - history, never a flag" },
        { label: "Open in another pipeline", value: x.elsewhereOnly, icon: <AltRouteOutlinedIcon />, tint: "slate", note: "ESO or TSA has the order - shown, never a flag" },
      ]} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}><Series f={f} parts={["order"]} source={src("or-series")} /></Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Breakdown title="Who has the order" rows={f.orderOwners} source={src("or-own")}
            onPick={(k) => t.show(`Orders with ${k}`, rows.filter((r) => ownerOfFirst(r) === k), "Same order, still open")} />
        </Grid>
      </Grid>
      <TypeList title="Same order - the tickets" hint={`${full(shown.length)} in ${d.days} days, newest first`} all={shown} filters={[
        { key: "open", label: "Still open on the order", test: (r) => r.v?.type === "order" },
        { key: "history", label: "Only closed on the order", test: isHistoryOnly },
        { key: "elsewhere", label: "Open in another pipeline", test: isElsewhereOnly },
      ]} />
      <RuleCard key={`or|${d.settings.at ?? ""}`} k="order" d={d} onSaved={onSaved} />
      {t.dialog}
    </>
  );
}

// ---------------------------------------------------------------- Never compared

/** A list of words to edit: each a chip with its count and a cross, a field to add one, Save. */
function WordsCard({ icon, title, note, words: start, counts, placeholder, admin, onSave }: {
  icon: React.ReactNode; title: string; note: string; words: string[]; counts?: Record<string, number>; placeholder: string; admin: boolean; onSave: (w: string[]) => Promise<string>;
}) {
  const [words, setWords] = useState(start);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const changed = words.join("\n") !== start.join("\n");
  const add = () => { const w = typed.trim(); if (w && !words.some((x) => x.toLowerCase() === w.toLowerCase())) setWords([...words, w]); setTyped(""); };
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
      <CardTitle icon={icon} tint="amber" title={title} note={note} />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
        {words.map((w) => (
          <Box key={w} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, pl: 1.25, pr: admin ? 0.25 : 1.25, py: 0.25, borderRadius: 99, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
            <Typography sx={{ fontSize: "0.8rem", color: INK }}>{w}</Typography>
            {counts && <Typography sx={{ fontSize: "0.74rem", color: counts[w] ? TINT.amber.fg : FAINT, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{full(counts[w] ?? 0)}</Typography>}
            {admin && <IconButton size="small" aria-label={`Take out ${w}`} onClick={() => setWords(words.filter((x) => x !== w))} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 14, color: MUTED }} /></IconButton>}
          </Box>
        ))}
      </Box>
      {admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <InputBase value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder}
            inputProps={{ "aria-label": placeholder }} sx={{ fontSize: "0.82rem", px: 1, py: 0.25, border: `1px solid ${HAIRLINE}`, borderRadius: "9px", bgcolor: "#fff", width: { xs: "100%", sm: 280 } }} />
          <Button size="small" variant="outlined" onClick={add} disabled={!typed.trim()} sx={{ textTransform: "none" }}>Add</Button>
          <Button size="small" variant="contained" disableElevation disabled={!changed || busy} onClick={async () => { setBusy(true); setMsg(await onSave(words)); setBusy(false); }} sx={{ textTransform: "none" }}>Save</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ ...small, color: MUTED }}>{msg}</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}

function NeverTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const f = d.figures;
  const t = useTickets();
  const out = d.rows.filter((r) => r.v?.excludedBy);
  const counts = Object.fromEntries(f.exclusions.map((x) => [x.key, x.count]));
  const builtIn = f.exclusions.filter((x) => x.builtIn).reduce((a, x) => a + x.count, 0);
  const save = async (types: Partial<TypeSettings>) => { const j = await send("PUT", { types }); onSaved(); return j.ok ? "Saved - new tickets are checked with it." : j.error ?? "Not saved"; };
  return (
    <>
      <Info>
        Never compared: the tickets no rule should ever call a duplicate - a certificate request, a C2S problem, a warning, an erosion win-back
        (the hub&apos;s erosion engine never makes the same one twice), and every subject containing one of the texts below. A system or a
        colleague sending the same subject again is not a customer writing twice either - unless it is about the same order.
      </Info>
      <Tiles items={[
        { label: "Never compared", value: f.excluded, icon: <BlockOutlinedIcon />, tint: "amber", note: `${pct(f.excluded, f.checked)} of the tickets checked` },
        { label: "By the built-in rules", value: builtIn, icon: <RuleOutlinedIcon />, tint: "slate", note: "certificates, C2S problems, warnings, erosion win-backs" },
        { label: "By your texts", value: f.excluded - builtIn, icon: <TextFieldsOutlinedIcon />, tint: "amber", note: `${full(d.settings.types.neverMatchTexts.length)} texts - mail servers, absences, the ERP's warnings` },
        { label: "Systems writing the same again", value: f.systemSender, icon: <DnsOutlinedIcon />, tint: "slate", note: "the shop, the ERP, A+P itself - not a customer writing twice" },
      ]} />
      <Breakdown title="Why they were never compared" rows={f.exclusions} source={out.length ? ticketSource(`nv-why|${d.from}|${d.to}`, out, "Never compared", "never") : null} labelWidth={240}
        onPick={(k) => t.show(`Never compared - ${k}`, out.filter((r) => r.v!.excludedBy === k), "Never compared", "never")} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <WordsCard key={`w|${d.settings.at ?? ""}`} icon={<TextFieldsOutlinedIcon />} title="Subjects never compared" admin={d.admin} placeholder="A text, e.g. Out of Office"
            note={`A subject containing one of these is never a duplicate, of any type - the figure: the tickets it left out in ${d.days} days. Built in, always: ${BUILT_IN.map((b) => b.label.toLowerCase()).join(", ")}`}
            words={d.settings.types.neverMatchTexts} counts={counts} onSave={(w) => save({ neverMatchTexts: w })} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <WordsCard key={`s|${d.settings.at ?? ""}`} icon={<DnsOutlinedIcon />} title="Systems and colleagues" admin={d.admin} placeholder="An e-mail domain, e.g. apsoparts.com"
            note="E-mail domains that are never a customer writing twice: the same subject from them only counts when it is about the same order (the ERP's error twice on one order)"
            words={d.settings.types.twice.internalDomains} onSave={(w) => save({ twice: { ...d.settings.types.twice, internalDomains: w } })} />
        </Grid>
      </Grid>
      <TypeList title="Never compared - the tickets" hint={`${full(out.length)} in ${d.days} days, newest first`} all={out} cols="never" filters={[
        { key: "all", label: "All", test: () => true },
        ...f.exclusions.slice(0, 6).map((x) => ({ key: x.key, label: x.key, test: (r: Row) => r.v?.excludedBy === x.key })),
      ]} />
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
      const j = await send("POST", { action: "decisions" });
      setMsg(!j.ok ? j.error ?? "Failed" : j.data?.skipped ? `Not run: ${j.data.skipped}.` : `${full(j.data?.done ?? 0)} done, ${full(j.data?.errors ?? 0)} failed.`);
      onChanged();
    } finally { setBusy(false); }
  };
  const on = d.settings.merging === "on" && d.props.ready;
  const merges = d.log.filter((e) => e.what === "merge");
  const logSource: CompanySource = {
    key: `log|${d.log.length}|${d.log[0]?.at ?? ""}`, object: "tickets", note: "The last 300 things the hub did on tickets - newest first",
    head: ["When", "What", "Details", "Decided by"], left: [2, 3, 4], widths: ["minmax(110px, 0.6fr)", "minmax(130px, 0.7fr)", "minmax(320px, 2.5fr)", "minmax(140px, 1fr)"],
    rows: () => d.log.map((e) => ({ id: e.ticketId, name: `Ticket ${e.ticketId}`, cells: [dayTime(e.at), WHAT[e.what], e.text, e.by ?? "—"], values: [e.at, e.what, e.text, e.by ?? null] })),
  };
  return (
    <>
      <StatusCard tone={on ? "#1f8a4c" : "#8a94a6"} beat={on} title={on ? "Merging is on - the hub carries out the decisions within a minute" : "Merging is off - decisions wait"}
        line={[
          d.decided ? `last look ${dayTime(d.decided.at)}: ${full(d.decided.done)} done${d.decided.errors ? `, ${full(d.decided.errors)} failed` : ""}` : "not run yet",
          !d.props.ready ? "the properties are missing" : null,
          d.workflows.merging ? "the old workflow SARCLA | BO MERGING is still on - it acts only on the old Merge_ticket_decision" : null,
        ].filter(Boolean).join(" · ")}
        right={d.admin ? <Button variant="outlined" size="small" disabled={busy || !on} onClick={() => void now()} sx={{ textTransform: "none" }}>{busy ? <CircularProgress size={14} /> : "Carry them out now"}</Button> : undefined} />
      {msg && <Typography sx={{ ...small, color: MUTED }}>{msg}</Typography>}
      <Tiles items={[
        { label: "Waiting for the hub", value: d.pending.length, icon: <HourglassEmptyOutlinedIcon />, tint: "amber", note: "decisions set on tickets, not carried out yet" },
        { label: "Merged by the hub, 100% sure", value: merges.filter((e) => e.by === "APSOhub").length, icon: <VerifiedOutlinedIcon />, tint: "green", note: "the same e-mail twice - in the log below" },
        { label: "Merged on a person's click", value: merges.filter((e) => e.by !== "APSOhub").length, icon: <CallMergeOutlinedIcon />, tint: "purple", note: "Merge on the ticket's card - in the log below" },
        { label: "Not a duplicate", value: d.log.filter((e) => e.what === "not_duplicate").length, icon: <BlockOutlinedIcon />, tint: "slate", note: "kept apart for good - in the log below" },
      ]} />
      <ChartBox title="Waiting for the hub" hint={d.props.have.includes("dup_decision") ? "Decisions set on tickets and not carried out yet" : "Once the properties exist"}>
        {d.pending.length ? (
          <KitTable head={["Ticket", "Decision", "Decided by", "Since"]} left={[1, 2]} minWidth={520} rows={d.pending.map((p) => ({
            key: p.id, cells: [link(p.id, p.subject || `Ticket ${p.id}`), p.decision === "merge" ? "Merge them" : p.decision === "not_duplicate" ? "Not a duplicate" : p.decision, p.by ?? "—", p.at ? dayTime(p.at) : "—"],
          }))} />
        ) : <Typography sx={{ ...small, color: FAINT }}>Nothing waiting.</Typography>}
      </ChartBox>
      <ListCard title="What the hub did" hint="Merges, flags written, owners handed over and decisions - a click on a column orders by it" source={logSource} />
    </>
  );
}

// ---------------------------------------------------------------- Settings

function RowDetail({ r }: { r: Row }) {
  const v = r.v;
  const line = (label: string, text: React.ReactNode) => <Typography sx={{ fontSize: "0.82rem", color: INK }}><b>{label}</b> {text}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      {line("The hub:", why(r))}
      {v?.type === "twice" && line("Certainty:", v.sure ? "100% sure - the same e-mail, word for word: merged by the hub when Live" : "possible - a person decides")}
      {v?.ownerChange && line("Owner:", `to ${r.ownerNames[v.ownerChange.ownerId] ?? v.ownerChange.ownerId}, the owner of ticket ${v.ownerChange.fromTicket}`)}
      {shownIds(r).length > 0 && line("The other tickets:", <Others r={r} />)}
      {r.sender && line("Sender:", r.sender)}
      {r.error && line("Error:", r.error)}
    </Box>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<{ row?: Row; error?: string } | null>(null);
  const call = async (what: string, method: "PUT" | "POST", body: object, done: string) => {
    setBusy(what); setMsg(null);
    try { const j = await send(method, body); setMsg(!j.ok ? j.error ?? "Failed" : j.data?.skipped ? `Not run: ${j.data.skipped}.` : done); onChanged(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const j = (await (await fetch(`/api/uc/ticket-duplicates?ticket=${encodeURIComponent(tid.trim())}`)).json()) as { ok: boolean; data?: Row; error?: string };
      setCheck(j.ok && j.data ? { row: j.data } : { error: j.error ?? "Failed" });
    } catch (e) { setCheck({ error: (e as Error).message }); } finally { setBusy(null); }
  };
  const wf = d.workflows, y = d.year;
  const flow = (on: boolean | null) => (on === null ? "could not be read" : on ? "ON" : "off");
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes, four minutes after a ticket enters Back Office New`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<Mode> value={d.settings.mode} onChange={(m) => { if (d.admin) void call("mode", "PUT", { mode: m }, "Saved."); }} options={[
            { key: "shadow", label: "Shadow - check, write nothing" }, { key: "live", label: "Live - write and merge" }, { key: "off", label: "Off" },
          ]} />
          <Typography sx={{ ...small, color: MUTED }}>
            Live writes only while the workflow <b>SARCLA | BACK OFFICE FILTERING | DUPS HANDLING WITH CODE</b> is off in HubSpot (now: <b>{flow(wf.dups)}</b>), so the two never write at once - choose Live here, then switch the workflow off.
            Live, a 100% sure duplicate is merged into the older ticket right away (Same request twice &gt; The rule); the others are flagged for a person. Rollback: the workflow on again.
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Merging</Typography>
            <Choice<"off" | "on"> value={d.settings.merging} onChange={(m) => { if (d.admin) void call("merging", "PUT", { merging: m }, "Saved."); }} options={[{ key: "on", label: "On - carry out the decisions" }, { key: "off", label: "Off" }]} />
          </Box>
          <Typography sx={{ ...small, color: MUTED }}>
            The decisions people take on the ticket card. The old workflow <b>SARCLA | BO MERGING</b> (now: <b>{flow(wf.merging)}</b>) acts on the old Merge_ticket_decision only - switch it off once the card is in use.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button variant="outlined" size="small" disabled={!!busy} onClick={() => void call("run", "POST", { action: "run" }, "Done.")} sx={{ textTransform: "none" }}>Look now</Button>
              {busy === "run" && <CircularProgress size={14} />}
            </Box>
          )}
        </Box>
      </GlassCard>
      {msg && <Typography sx={{ ...small, color: MUTED }}>{msg}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ReplayOutlinedIcon />} tint="amber" title="The last 365 days" note="Every Back Office ticket of the last year checked with these rules from one read of all tickets - as they are today. A ticket seen live keeps what the live check found" />
        <Typography sx={{ fontSize: "0.84rem", color: INK }}>
          {!y ? "Read after the first run." : y.error ? `Stopped: ${y.error}` : y.done ? `Read ${dayTime(y.at!)}: ${full(y.tickets)} tickets, ${full(y.entries)} Back Office entries, ${full(y.twice)} the same request twice (${full(y.sure)} 100% sure).` : `Reading now - ${y.step}: ${full(y.tickets)} tickets, ${full(y.built)} checked.`}
        </Typography>
        {d.admin && <Box sx={{ mt: 1 }}><Button variant="outlined" size="small" disabled={!!busy || (!!y && !y.done && !y.error)} onClick={() => void call("year", "POST", { action: "year" }, "The year is read again with the next run (a few minutes).")} sx={{ textTransform: "none" }}>Read the year again</Button></Box>}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read only - what the hub finds for it now. Nothing is stored or written" />
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
  const { window: win } = useReportingWindow();
  const url = `/api/uc/ticket-duplicates?from=${win.from}&to=${win.to}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = () => setN((x) => x + 1);
  const d = r?.state === "ok" ? r.data : null;
  const counts = useMemo(() => (d ? { twice: d.figures.twice.flagged, order: d.figures.order.flagged, never: d.figures.excluded } : null), [d]);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok" || !d) body = <UpstreamPanel source="Duplicates & merges" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (tab === "settings") body = <SettingsTab d={d} onChanged={again} />;
  else if (tab === "decisions") body = <DecisionsTab d={d} onChanged={again} />;
  else if (tab === "twice") body = <TwiceTab d={d} onSaved={again} />;
  else if (tab === "order") body = <OrderTab d={d} onSaved={again} />;
  else if (tab === "never") body = <NeverTab d={d} onSaved={again} />;
  else body = <Overview d={d} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Duplicates & merges"
        subtitle="Back Office tickets that are the same request twice, or about an order someone already works - merged when 100% sure, flagged for a person otherwise"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            {tab !== "settings" && tab !== "decisions" && <WindowPicker />}
            <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {d && <Status d={d} onChanged={again} />}
      <Box>
        <ReportTabs name="ticketdup" tab={tab} onSelect={setTab} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "twice", label: "Same request twice", count: counts?.twice ? full(counts.twice) : null },
          { id: "order", label: "Same order", count: counts?.order ? full(counts.order) : null },
          { id: "never", label: "Never compared", count: counts?.never ? full(counts.never) : null },
          { id: "decisions", label: "Decisions", count: d?.pending.length ? full(d.pending.length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box id={`ticketdup-panel-${tab}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
