"use client";

// BACK OFFICE DISTRIBUTION - a HubSpot app (UC & HubSpot Apps > HubSpot apps), in SHADOW MODE (SARCLA 18.10.2026: move the
// distribution to the hub, "really vital ... it should work seamlessly"; then "really raw - much more: people, GQS, the
// flow, the detection, changing people without changing the code"). For every ticket entering Back Office "New" or GQS
// "New for Back-Office" the hub works out what the HubSpot workflows decide and puts it next to what HubSpot did; the
// last 7 days are replayed. Nothing is written to HubSpot. Tabs: Overview, Tickets, Flow, Detection, People, GQS, Settings.

import { Fragment, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
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
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { PersonRow, Row, RunInfo, Settings } from "@/lib/boDistribution/engine";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { Person, RosterKey } from "@/lib/boDistribution/rules";

type ClassInfo = { category: string; keywords: number; sample: string[]; subs: { key: string; value: string; keywords: number; sample: string[] }[] }[];
type Data = {
  settings: Settings; last: RunInfo | null; backfill: { from: number; cursor: number; done: boolean; startedAt: string } | null; everyMinutes: number;
  rows: Row[]; admin: boolean; legacy: Record<RosterKey, Person[]>; labels: Record<RosterKey, string>; deactivated: Person[]; classifier: ClassInfo;
};
type PeopleData = { people: PersonRow[]; owners: Person[]; at: string };
type View = "overview" | "tickets" | "flow" | "detection" | "people" | "gqs" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", flow: "#flow", detection: "#detection", people: "#people", gqs: "#gqs", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const STEP: Record<string, string> = {
  "23": "Assignment System - Maida, Sara, team", "27": "General Distribution", "42": "General Distribution, then ESO/TSA",
  "31": "Load Balancer", "50": "Task Status Report merge", "75": "Sales split to ESO",
};
const CHAT_LABEL: Record<string, string> = { available: "Available", away: "Away" };
const sameOwner = (r: Row) => !!r.actual && !!r.legacy && r.actual.ownerId === r.legacy.ownerId;
const fixesDiffer = (r: Row) => !!r.legacy && r.hub?.ownerId !== r.legacy.ownerId;

/* ── figures ── */

function measure(rows: Row[]) {
  const bo = rows.filter((r) => r.pipeline === "bo"), gqs = rows.filter((r) => r.pipeline === "gqs");
  const owned = rows.filter((r) => r.legacy?.ownerId && r.actual);
  const live = owned.filter((r) => !r.approx), replay = owned.filter((r) => r.approx);
  const cat = rows.filter((r) => r.actual && r.route?.sets.enquiry_category);
  const prio = rows.filter((r) => r.actual && r.route?.sets.hs_ticket_priority);
  return {
    total: rows.length, bo: bo.length, gqs: gqs.length,
    live: live.length, liveSame: live.filter(sameOwner).length, replay: replay.length, replaySame: replay.filter(sameOwner).length,
    cat: cat.length, catSame: cat.filter((r) => r.route!.sets.enquiry_category === r.actual!.category).length,
    prio: prio.length, prioSame: prio.filter((r) => r.route!.sets.hs_ticket_priority === r.actual!.priority).length,
    fixes: rows.filter(fixesDiffer).length, noDistribution: rows.filter((r) => !r.legacy && !r.error).length, errors: rows.filter((r) => r.error).length,
  };
}
const count = <T,>(xs: T[], key: (x: T) => string | null | undefined) => {
  const m = new Map<string, number>();
  for (const x of xs) { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
};

/* ── Overview ── */

function Overview({ d }: { d: Data }) {
  const m = measure(d.rows);
  const days = useMemo(() => {
    const by = new Map<string, { same: number; different: number; none: number; waiting: number }>();
    for (const r of d.rows) {
      const k = r.enteredAt.slice(0, 10);
      const b = by.get(k) ?? { same: 0, different: 0, none: 0, waiting: 0 };
      if (!r.legacy) b.none++; else if (!r.actual) b.waiting++; else if (sameOwner(r)) b.same++; else b.different++;
      by.set(k, b);
    }
    return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([x, v]) => ({ x: x.slice(8, 10) + "." + x.slice(5, 7), ...v }));
  }, [d.rows]);
  const kpis = [
    { label: "Tickets, 7 days", value: full(m.total), note: `${full(m.bo)} Back Office, ${full(m.gqs)} GQS${d.backfill && !d.backfill.done ? " - replay still running" : ""}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "Same owner as HubSpot", value: pct(m.liveSame, m.live), note: `${full(m.liveSame)} of ${full(m.live)} live tickets; replayed days ${pct(m.replaySame, m.replay)} (availability of today)`, icon: <PersonOutlineOutlinedIcon />, tint: "green" as const },
    { label: "Same category", value: pct(m.catSame, m.cat), note: `${full(m.catSame)} of ${full(m.cat)}; same priority ${pct(m.prioSame, m.prio)}`, icon: <CategoryOutlinedIcon />, tint: "purple" as const },
    { label: "Fixes change the owner", value: full(m.fixes), note: "The hub's fixed rules would pick someone else than the copy", icon: <CompareArrowsOutlinedIcon />, tint: "amber" as const },
  ];
  const owners = count(d.rows.filter((r) => r.actual), (r) => r.actual!.ownerName);
  const steps = count(d.rows.filter((r) => r.route?.assigner), (r) => STEP[r.route!.assigner!]);
  const cats = count(d.rows.filter((r) => r.actual), (r) => r.actual!.category);
  return (
    <>
      <Info>
        Shadow mode - the hub writes nothing to HubSpot. For each ticket entering Back Office &quot;New&quot; or GQS &quot;New for Back-Office&quot; it works out
        what the workflows decide (<b>copy</b>: their rules, quirks included) and what it would decide with the faults fixed (<b>hub</b>), and reads what
        HubSpot really did. The last 7 days are replayed: their category and path compare exactly; their owner only roughly, as today&apos;s availability is used.
      </Info>
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title="Day by day" note="Copy against HubSpot: same owner, another owner, no distribution on the path, not settled yet" />
        <StackedColumns data={days} parts={[{ key: "same", label: "Same owner" }, { key: "different", label: "Another owner" }, { key: "none", label: "No distribution" }, { key: "waiting", label: "Not settled" }]} format={(v) => full(v ?? 0)} />
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<PersonOutlineOutlinedIcon />} tint="green" title="Who got them" note="Owner in HubSpot" /><BarList rows={owners} labelWidth={150} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Which step picked" note="The workflow step on each ticket's path" /><BarList rows={steps} labelWidth={170} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title="Categories" note="As HubSpot has them now" /><BarList rows={cats} labelWidth={150} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
      </Grid>
    </>
  );
}

/* ── Tickets ── */

function Detail({ r }: { r: Row }) {
  const line = (k: string, v: React.ReactNode) => <Box sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.25 }}><Box sx={{ color: MUTED, minWidth: 140 }}>{k}</Box><Box sx={{ color: INK }}>{v}</Box></Box>;
  const sets = r.route ? Object.entries(r.route.sets) : [];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {r.approx && line("Replayed", "availability and workload are today's - the owner comparison is only a rough one")}
      {r.error && line("Error", <span style={{ color: RED }}>{r.error}</span>)}
      {r.route && line("Path", r.route.path.join(" › ") + (r.route.assigner ? ` › ${STEP[r.route.assigner]}` : ""))}
      {r.route?.classified && line("Classifier", `${r.route.classified.category ?? "nothing recognised"}${r.route.classified.subCategory ? ` / ${r.route.classified.subCategory}` : ""}`)}
      {!!sets.length && line("Workflow sets", sets.map(([k, v]) => `${k.replace(/^enquiry_sub_category___/, "sub ").replace(/_+\d?$/, "")} = ${v}`).join(" · "))}
      {r.legacy && line("Copy", `${r.legacy.ownerName ?? "nobody"} - ${r.legacy.method}${r.legacy.reasons.length ? ` (${r.legacy.reasons.join("; ")})` : ""}`)}
      {r.hub && line("Hub", `${r.hub.ownerName ?? "nobody"} - ${r.hub.method}${r.hub.reasons.length ? ` (${r.hub.reasons.join("; ")})` : ""}`)}
      {r.note && line("Note", r.note)}
      {r.actual && line("HubSpot", `${r.actual.ownerName ?? "nobody"}${r.actual.ownerSetBy ? ` (set by ${r.actual.ownerSetBy})` : ""} · ${r.actual.category ?? "no category"}${r.actual.subCategory ? ` / ${r.actual.subCategory}` : ""} · priority ${r.actual.priority ?? "—"}${r.actual.dispatch ? ` · ${r.actual.dispatch}` : ""}`)}
    </Box>
  );
}
function Verdict({ r }: { r: Row }) {
  if (r.error) return <Chip tint="pink">error</Chip>;
  if (!r.legacy) return <Chip tint="slate">no distribution</Chip>;
  if (!r.actual) return <Chip tint="slate">waiting</Chip>;
  return sameOwner(r) ? <Chip tint="green">same owner</Chip> : <Chip tint="amber">{r.approx ? "differs (rough)" : "differs"}</Chip>;
}
function TicketTable({ rows, empty }: { rows: Row[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const { slice, pager } = usePaged(rows, 15);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Entered", "Ticket", "Path", "HubSpot gave", "Copy gives", "Hub gives", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((r) => (
              <Fragment key={r.key}>
                <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.enteredAt)}{r.approx && <Box component="span" sx={{ ml: 0.5 }}><Chip tint="slate">replayed</Chip></Box>}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || r.ticketId}</Box>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.pipeline === "gqs" ? "GQS" : "Back Office"}{r.source ? ` · ${r.source}` : ""}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, ...clip(240) }}>{r.route ? (r.route.assigner ? STEP[r.route.assigner] : r.route.path[r.route.path.length - 1]) : r.pipeline === "gqs" ? (r.legacy?.method ?? "GQS") : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.actual ? r.actual.ownerName ?? "nobody" : "…"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.legacy?.ownerName ?? "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: fixesDiffer(r) ? 700 : 400 }}>{r.hub?.ownerName ?? "—"}</TableCell>
                  <TableCell sx={bodyCell}><Verdict r={r} /></TableCell>
                </TableRow>
                {open === r.key && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}><Detail r={r} /></TableCell></TableRow>}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{empty}</Typography>}
    </>
  );
}
function Tickets({ d }: { d: Data }) {
  const [filter, setFilter] = useState<"all" | "different" | "fixes" | "live">("all");
  const [pipe, setPipe] = useState<"all" | "bo" | "gqs">("all");
  const [id, setId] = useState("");
  const [check, setCheck] = useState<string | null>(null);
  const checked = useHeld<Row>(check ? `/api/uc/bo-distribution?ticket=${check}` : null, [check]);
  const rows = d.rows.filter((r) => (pipe === "all" || r.pipeline === pipe) && (filter === "all" || (filter === "different" ? r.actual && r.legacy && !sameOwner(r) : filter === "fixes" ? fixesDiffer(r) : !r.approx)));
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Check a ticket" note="Any ticket number: the copy, the hub and HubSpot side by side, now - nothing stored, nothing written" />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField size="small" placeholder="ticket number" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} sx={{ width: 220 }} />
          <Button variant="outlined" size="small" disabled={!id} onClick={() => setCheck(id)} sx={{ textTransform: "none" }}>Check</Button>
          {check && checked.result === null && <CircularProgress size={14} />}
        </Box>
        {check && checked.result?.state === "ok" && <Box sx={{ mt: 1.5 }}><Detail r={checked.result.data} /></Box>}
        {check && checked.result && checked.result.state !== "ok" && <Typography sx={{ mt: 1, fontSize: "0.82rem", color: RED }}>{checked.result.state === "error" ? checked.result.error : "not configured"}</Typography>}
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket" note={d.last ? `Last look ${when(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.decided)} new, ${full(d.last.checked)} checked${d.last.error ? ` - ${d.last.error}` : ""}` : "Not run yet"} />
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
          <Choice<"all" | "different" | "fixes" | "live"> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: d.rows.length },
            { key: "different", label: "HubSpot did otherwise", count: d.rows.filter((r) => r.actual && r.legacy && !sameOwner(r)).length },
            { key: "fixes", label: "Fixes change it", count: d.rows.filter(fixesDiffer).length },
            { key: "live", label: "Live only", count: d.rows.filter((r) => !r.approx).length },
          ]} />
          <Choice<"all" | "bo" | "gqs"> value={pipe} onChange={setPipe} options={[{ key: "all", label: "Both" }, { key: "bo", label: "Back Office" }, { key: "gqs", label: "GQS" }]} />
        </Box>
        <TicketTable rows={rows} empty={`Nothing yet - tickets appear within ${d.everyMinutes} minutes of entering the stage; the replay fills the last 7 days.`} />
      </GlassCard>
    </>
  );
}

/* ── Flow ── */

type Node = { label: string; text: string; match?: string | string[]; step?: string; tone?: "blue" | "green" | "amber" | "purple" | "slate" | "pink" };
const FLOW: { title: string; note: string; nodes: Node[] }[] = [
  { title: "1 · Entry checks", note: "One minute after the ticket enters Back Office New", nodes: [
    { label: "C2S problem", text: "Delivery / late / URGENT, then the category router", match: "C2S Problem", tone: "pink" },
    { label: "Anyseals stock file", text: "Processed and resolved - nobody assigned", match: "ANYSEALS", tone: "slate" },
  ] },
  { title: "2 · Where it comes from", note: "First match wins", nodes: [
    { label: "Chat / AI chat", text: "Never distributed: parked in New BO Topic, or to Rose when TSA sends it back", match: ["CHAT", "AI CHAT"], tone: "slate" },
    { label: "E-mail", text: "The e-mail rules, then the classifier", match: "EMAIL", tone: "blue" },
    { label: "Form", text: "Its category goes straight to the router", match: "FORM", tone: "blue" },
    { label: "API / hub / UI", text: "CERTIFICATES and MAIL TO CUSTOMER stop; the rest to the router", match: "ELSE (API / hub / UI)", tone: "blue" },
  ] },
  { title: "3 · E-mail rules", note: "Before the classifier", nodes: [
    { label: "Task Status Report", text: "Merged into its GQS task (owner = the task's)", match: "GQS EXCLUSION AND MAILS", tone: "purple" },
    { label: "Billing address / ERP export", text: "To Maida, then Sara", match: "CHANGES OF ACCOUNT ADDRESS", tone: "purple" },
    { label: "Mail to sales@ from a rep", text: "To ESO New with that rep", match: "Sales", tone: "purple" },
    { label: "PERFORMIS / AVOR stopped order", text: "Late delivery, HIGH", match: "STOPPED ORDERS", tone: "purple" },
    { label: "Back from ESO / TSA", text: "Load Balancer, no classification", match: "ESO/TSA PIPELINE REDIRECT", tone: "purple" },
    { label: "Keyword classifier", text: "Category and sub-category from subject and body", match: "#22 classifier", tone: "blue" },
  ] },
  { title: "4 · Category router", note: "Sets the priority and the step", nodes: [
    { label: "Website issue", text: "Login issue → Assignment System; else General Distribution", match: "Registration/Website issue", tone: "blue" },
    { label: "Product price", text: "Quotation → General then ESO/TSA (URGENT); else General", match: "PRODUCT PRICE", tone: "blue" },
    { label: "Delivery", text: "Existing / previous order URGENT, else HIGH", match: "DELIVERY", tone: "blue" },
    { label: "Microsoft quarantine", text: "Resolved - nobody assigned", match: "MICROSOFT EXCLUSION", tone: "slate" },
    { label: "Invoicing & accounting", text: "Invoice not received MEDIUM, else LOW", match: "INVOICING AND ACCOUNTING", tone: "blue" },
    { label: "Order cancellation", text: "URGENT", match: "ORDER CANCELLATION", tone: "blue" },
    { label: "Product information", text: "Technical question / MOQ → General then ESO/TSA; else General", match: "PRODUCT INFORMATION", tone: "blue" },
    { label: "Nothing recognised", text: "Others, MEDIUM, Load Balancer", match: "ELSE -> Others", tone: "amber" },
  ] },
  { title: "5 · Who gets it", note: "The step's rule picks the owner", nodes: [
    { label: "General Distribution", text: "Sales Agent if available, SA Sub, else the least busy available of the team", step: "27", tone: "green" },
    { label: "… then to ESO / TSA", text: "Same pick, then BO DISPATCH moves it to the contact owner's team", step: "42", tone: "green" },
    { label: "Load Balancer", text: "Same rule, Sara third in the team", step: "31", tone: "green" },
    { label: "Assignment System", text: "Maida, else Sara, else least busy", step: "23", tone: "green" },
    { label: "Task Status Report merge", text: "The GQS task's owner, else least busy", step: "50", tone: "green" },
    { label: "Sales split", text: "The forwarding rep, in ESO", step: "75", tone: "green" },
  ] },
];
const TONE: Record<string, string> = { blue: "#2459d1", green: "#1b7a55", amber: "#a96a12", purple: "#6b4bc4", slate: "#5d6b85", pink: "#c2185b" };

function Flow({ d }: { d: Data }) {
  const bo = d.rows.filter((r) => r.pipeline === "bo" && r.route);
  const n = (node: Node) => node.step ? bo.filter((r) => r.route!.assigner === node.step).length
    : bo.filter((r) => (Array.isArray(node.match) ? node.match : [node.match]).some((m) => r.route!.path.includes(m!))).length;
  const gqs = d.rows.filter((r) => r.pipeline === "gqs" && r.legacy);
  const g = (p: RegExp) => gqs.filter((r) => p.test(r.legacy!.method)).length;
  return (
    <>
      <Info>How the two HubSpot workflows decide, step by step, with how many of the last 7 days&apos; {full(bo.length)} Back Office tickets took each branch. Read from HubSpot on 18.10.2026 - this is what the hub copies.</Info>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="Back Office - SARCLA | BACK OFFICE MAIN ROUTING" note="Left to right; in each column the first box that matches wins" />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, alignItems: "start" }}>
          {FLOW.map((col, ci) => (
            <Box key={col.title} sx={{ position: "relative" }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: INK }}>{col.title}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, mb: 1 }}>{col.note}</Typography>
              <Box sx={{ display: "grid", gap: 1 }}>
                {col.nodes.map((node) => {
                  const c = n(node);
                  return (
                    <Box key={node.label} sx={{ border: `1px solid ${HAIRLINE}`, borderLeft: `4px solid ${TONE[node.tone ?? "blue"]}`, borderRadius: "10px", p: 1, bgcolor: c ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.4)", opacity: c ? 1 : 0.7 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{node.label}</Typography>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: TONE[node.tone ?? "blue"] }}>{full(c)}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>{node.text}</Typography>
                    </Box>
                  );
                })}
              </Box>
              {ci < FLOW.length - 1 && <Box sx={{ display: { xs: "none", md: "block" }, position: "absolute", top: 4, right: -14, color: MUTED, fontSize: "1rem" }}>›</Box>}
            </Box>
          ))}
        </Box>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="GQS - NEW FOR BACK-OFFICE GQS DISTRIBUTION" note={`On "New for Back-Office"; ${full(gqs.length)} GQS tickets in the last 7 days`} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
          {[
            { label: "Sales Agent", text: "The company's / contact's Sales Agent, if available - no limit", c: g(/^Sales Agent/) },
            { label: "SA Sub", text: "If available", c: g(/^SA Sub/) },
            { label: "DT New Business", text: "Claudio Gabinato, then Leart Asllani", c: g(/^DT New Business/) },
            { label: "Least busy", text: "Of the GQS team (Claudia, Claudio, Leart, Sara)", c: g(/^Least busy/) },
          ].map((x) => (
            <Box key={x.label} sx={{ border: `1px solid ${HAIRLINE}`, borderLeft: `4px solid ${TONE.purple}`, borderRadius: "10px", p: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>{x.label}</Typography><Typography sx={{ fontWeight: 800, color: TONE.purple }}>{full(x.c)}</Typography></Box>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{x.text}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>
    </>
  );
}

/* ── Detection ── */

const WEAK = [
  "\"received\" is a Delivery keyword, so a forwarded \"Invoice not received\" goes to Delivery",
  "\"reach\" is listed several times, so \"reach out\" files a ticket as a certificate request",
  "Short lines with \"inc\", \"ltd\", \"co.\" or \"kg\" are dropped as company lines - \"incorrect delivery\", \"50 kg…\" only count from the subject",
  "\"Regards\", \"Met vriendelijke groet\", \"Pozdrawiam\", \"Viele Grüsse\" do not start the signature, so signatures are read as text",
  "A curly apostrophe (’) never matches \"demande d'offre\"",
  "\"Request for quotation\" is not among its own sub-category's keywords",
  "An empty subject or body makes the step write nothing (the ticket then goes to Others)",
];
function Detection({ d }: { d: Data }) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [res, setRes] = useState<Classification | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", subject, content: content.slice(0, 6000) }) });
      const j = (await r.json()) as { ok: boolean; data?: Classification };
      setRes(j.ok && j.data ? j.data : null);
    } finally { setBusy(false); }
  };
  const read = d.rows.filter((r) => r.route?.classified && r.actual);
  const recognised = read.filter((r) => r.route!.classified!.category);
  const byCat = new Map<string, { n: number; same: number }>();
  for (const r of recognised) {
    const c = r.route!.classified!.category!;
    const b = byCat.get(c) ?? { n: 0, same: 0 };
    b.n++; if (r.actual!.category === c) b.same++;
    byCat.set(c, b);
  }
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CategoryOutlinedIcon />} tint="purple" label="Read by the classifier" value={full(read.length)} note="E-mails of the last 7 days that went through it" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<PriorityHighOutlinedIcon />} tint="green" label="Recognised" value={pct(recognised.length, read.length)} note={`${full(read.length - recognised.length)} not recognised → Others, Load Balancer`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="blue" label="Same category in HubSpot" value={pct([...byCat.values()].reduce((a, b) => a + b.same, 0), recognised.length)} note="When it recognised one - a person may have changed it since" /></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Try it" note="Paste a subject and an e-mail: what the workflow's classifier makes of it, and why (up to 6,000 characters)" />
        <Box sx={{ display: "grid", gap: 1, maxWidth: 900 }}>
          <TextField size="small" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField size="small" label="E-mail text" multiline minRows={4} value={content} onChange={(e) => setContent(e.target.value.slice(0, 6000))} />
          <Box><Button variant="contained" size="small" disabled={busy || (!subject && !content)} onClick={() => void run()} sx={{ textTransform: "none" }}>Classify</Button></Box>
        </Box>
        {res && (
          <Box sx={{ mt: 2, display: "grid", gap: 0.5, fontSize: "0.84rem" }}>
            <Typography sx={{ fontWeight: 800, color: INK }}>{res.category ?? "Nothing recognised - the ticket would go to Others"}{res.subCategory ? ` / ${res.subCategory}` : ""}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{res.explanation}{res.orderNumber ? ` · order number ${res.orderNumber}` : ""}</Typography>
            {!!res.matched.length && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{res.matched.slice(0, 30).map((k) => <Chip key={k} tint="purple">{k}</Chip>)}</Box>}
            <Box sx={{ maxWidth: 520, mt: 1 }}><BarList rows={Object.entries(res.scores).map(([label, value]) => ({ label, value })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))} labelWidth={170} format={(v) => String(v ?? 0)} /></Box>
          </Box>
        )}
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<InsightsOutlinedIcon />} tint="green" title="What it recognised" note="Last 7 days; second figure = how often HubSpot still has that category" />
            <BarList rows={[...byCat].sort((a, b) => b[1].n - a[1].n).map(([label, v]) => ({ label, value: v.n, secondary: pct(v.same, v.n) }))} labelWidth={170} format={(v) => full(v ?? 0)} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<ReportProblemOutlinedIcon />} tint="amber" title="Weak spots found while copying it" note="Kept 1:1 in the copy; the hub fixes them only after shadow mode shows the effect" />
            <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5 }}>{WEAK.map((w) => <Typography component="li" key={w} sx={{ fontSize: "0.8rem", color: INK }}>{w}</Typography>)}</Box>
          </GlassCard>
        </Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="The keyword lists" note="Six languages; the subject counts ten times; the highest score wins, then the sub-category" />
        <Grid container spacing={2}>
          {d.classifier.map((c) => (
            <Grid key={c.category} size={{ xs: 12, md: 6, xl: 4 }}>
              <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%" }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK }}>{c.category} <span style={{ color: MUTED, fontWeight: 500 }}>· {full(c.keywords)} keywords</span></Typography>
                <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap", my: 0.75 }}>{c.sample.map((k) => <Chip key={k} tint="slate">{k}</Chip>)}</Box>
                {c.subs.map((s) => <Typography key={s.key} sx={{ fontSize: "0.76rem", color: MUTED }}>→ {s.value} <span style={{ color: INK }}>({s.keywords})</span></Typography>)}
              </Box>
            </Grid>
          ))}
        </Grid>
      </GlassCard>
    </>
  );
}

/* ── People ── */

function RosterEditor({ k, d, owners, onSaved }: { k: RosterKey; d: Data; owners: Person[]; onSaved: () => void }) {
  const current = d.settings.rosters[k] ?? d.legacy[k];
  const [list, setList] = useState<Person[]>(current);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(list.map((x) => x.id)) !== JSON.stringify(current.map((x) => x.id));
  const custom = !!d.settings.rosters[k];
  const off = new Set(d.deactivated.map((x) => x.id));
  const move = (i: number, dir: -1 | 1) => setList((l) => { const n = [...l]; const j = i + dir; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async (value: Person[] | null) => {
    setBusy(true);
    try { await fetch("/api/uc/bo-distribution", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rosters: { [k]: value } }) }); onSaved(); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{d.labels[k]}</Typography>
        {custom ? <Chip tint="amber">changed here</Chip> : <Chip tint="slate">as in the workflow</Chip>}
      </Box>
      <Box sx={{ display: "grid", gap: 0.5, my: 1 }}>
        {list.map((p, i) => (
          <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem" }}>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, width: 16 }}>{i + 1}</Typography>
            <Typography sx={{ fontSize: "0.82rem", flex: 1, color: off.has(p.id) ? RED : INK, textDecoration: off.has(p.id) ? "line-through" : "none" }}>{p.name}{off.has(p.id) ? " - deactivated" : ""}</Typography>
            {d.admin && <>
              <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Up"><ArrowUpwardIcon sx={{ fontSize: 14 }} /></IconButton>
              <IconButton size="small" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Down"><ArrowDownwardIcon sx={{ fontSize: 14 }} /></IconButton>
              <IconButton size="small" onClick={() => setList((l) => l.filter((x) => x.id !== p.id))} aria-label="Remove"><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
            </>}
          </Box>
        ))}
      </Box>
      {d.admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Autocomplete size="small" options={owners.filter((o) => !list.some((x) => x.id === o.id))} getOptionLabel={(o) => o.name} sx={{ minWidth: 220, flex: 1 }}
            onChange={(_, o) => o && setList((l) => [...l, o])} value={null} renderInput={(p) => <TextField {...p} placeholder="add a person" />} />
          <Button size="small" variant="contained" disabled={!changed || busy} onClick={() => void save(list)} sx={{ textTransform: "none" }}>Save</Button>
          {custom && <Button size="small" disabled={busy} onClick={() => void save(null)} sx={{ textTransform: "none" }}>Back to the workflow&apos;s</Button>}
        </Box>
      )}
    </Box>
  );
}
function People({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const [n, setN] = useState(0);
  const held = useHeld<PeopleData>(`/api/uc/bo-distribution?people=1&n=${n}`, [n]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading everyone's status and open tickets…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Back Office distribution - people" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const p = r.data;
  const got = (id: string) => d.rows.filter((x) => x.actual?.ownerId === id).length;
  const copy = (id: string) => d.rows.filter((x) => x.legacy?.ownerId === id).length;
  const hub = (id: string) => d.rows.filter((x) => x.hub?.ownerId === id).length;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="green" title="The people" note={`Everyone in a team - chat status and open tickets now (${when(p.at)}); tickets of the last 7 days`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Person", "Status", "Open Back Office", "Open GQS", "Got (HubSpot)", "Copy gives", "Hub gives", "Teams"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {[...p.people].sort((a, b) => Number(a.deactivated) - Number(b.deactivated) || a.name.localeCompare(b.name)).map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={{ ...bodyCell, fontWeight: 700, color: x.deactivated ? RED : INK }}>{x.name}</TableCell>
                  <TableCell sx={bodyCell}>{x.deactivated ? <Chip tint="pink">deactivated</Chip> : x.chat === "available" ? <Chip tint="green">available</Chip> : <Chip tint="slate">{x.chat ? CHAT_LABEL[x.chat] ?? x.chat : "no status"}</Chip>}</TableCell>
                  <TableCell sx={bodyCell}>{x.boOpen ?? "—"}</TableCell>
                  <TableCell sx={bodyCell}>{x.gqsOpen ?? "—"}{x.gqsOpenFixed !== null && x.gqsOpenFixed !== x.gqsOpen ? <Tooltip title="Counting the real 'Waiting on APSO' stage instead of the deleted one the workflow counts"><span style={{ color: MUTED }}> ({x.gqsOpenFixed})</span></Tooltip> : null}</TableCell>
                  <TableCell sx={bodyCell}>{got(x.id) || ""}</TableCell>
                  <TableCell sx={bodyCell}>{copy(x.id) || ""}</TableCell>
                  <TableCell sx={bodyCell}>{hub(x.id) || ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.72rem", color: MUTED }}>{x.lists.length} list{x.lists.length === 1 ? "" : "s"}{x.inWorkflow.length !== x.lists.length ? " (changed here)" : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>&quot;Available&quot; is the green dot of HubSpot chat - what the workflows use today. In brackets: GQS open tickets counted with the right &quot;Waiting on APSO&quot; stage.</Typography>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title="The teams - change them here, not in code" note="The hub's answer uses these lists now; the copy keeps the workflow's. Order matters: it breaks ties and sets who is tried first" />
        <Grid container spacing={2}>
          {(Object.keys(d.labels) as RosterKey[]).map((k) => <Grid key={k} size={{ xs: 12, md: 6, xl: 4 }}><RosterEditor k={k} d={d} owners={p.owners} onSaved={() => { onSaved(); setN((x) => x + 1); }} /></Grid>)}
        </Grid>
      </GlassCard>
    </>
  );
}

/* ── GQS ── */

function Gqs({ d }: { d: Data }) {
  const rows = d.rows.filter((r) => r.pipeline === "gqs");
  const settled = rows.filter((r) => r.legacy?.ownerId && r.actual);
  const methods = count(rows.filter((r) => r.legacy), (r) => r.legacy!.method.replace(/ \(.*$/, ""));
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="purple" label="GQS tickets, 7 days" value={full(rows.length)} note="Entered New for Back-Office" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<PersonOutlineOutlinedIcon />} tint="green" label="Same owner as HubSpot" value={pct(settled.filter(sameOwner).length, settled.length)} note={`${full(settled.filter(sameOwner).length)} of ${full(settled.length)}`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="amber" label="Fixes change the owner" value={full(rows.filter(fixesDiffer).length)} note="Deactivated people, failed counts, unknown users" /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="How GQS tickets were picked" note="By the copy of the rules" />
            <BarList rows={methods} labelWidth={170} format={(v) => full(v ?? 0)} />
            <Box component="ul" sx={{ m: 0, mt: 2, pl: 2.5, display: "grid", gap: 0.5 }}>
              {["Sales Agent, then SA Sub - if available, no limit", "DT New Business: Claudio Gabinato, then Leart Asllani - a user missing from HubSpot's list counts as available", "Else the least busy of the GQS team; nobody available → least busy of everyone",
                "The workload counts a deleted stage and misses the real 'Waiting on APSO' (see People)"].map((t) => <Typography component="li" key={t} sx={{ fontSize: "0.8rem" }}>{t}</Typography>)}
            </Box>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="GQS tickets" note="Click a row for the reasons" />
            <TicketTable rows={rows} empty="No GQS ticket in the last 7 days yet." />
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}

/* ── Settings ── */

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const call = async (method: "PUT" | "POST", body: object) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Done." : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes; nothing is written to HubSpot in shadow mode`} />
      <Box sx={{ display: "grid", gap: 1.5 }}>
        <Choice<"off" | "shadow"> value={d.settings.mode} onChange={(m) => d.admin && void call("PUT", { mode: m })} options={[{ key: "shadow", label: "Shadow - compare, write nothing" }, { key: "off", label: "Off" }]} />
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Replay of the last 7 days: {d.backfill ? (d.backfill.done ? `done (started ${when(d.backfill.startedAt)})` : `running - up to ${when(new Date(d.backfill.cursor).toISOString())}`) : "starts with the next run"}</Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="outlined" size="small" disabled={!d.admin || busy} onClick={() => void call("POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
          <Button variant="outlined" size="small" disabled={!d.admin || busy} onClick={() => void call("POST", { action: "replay" })} sx={{ textTransform: "none" }}>Replay the last 7 days</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>No live mode yet: the hub takes over one pipeline at a time once the comparison is clean, with the matching workflow steps switched off in the same minute.</Typography>
      </Box>
    </GlassCard>
  );
}

export default function BoDistribution() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const url = `/api/uc/bo-distribution${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const reload = () => setN((x) => x + 1);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Back Office distribution" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={reload} />;
  else if (view === "tickets") body = <Tickets d={r.data} />;
  else if (view === "flow") body = <Flow d={r.data} />;
  else if (view === "detection") body = <Detection d={r.data} />;
  else if (view === "people") body = <People d={r.data} onSaved={reload} />;
  else if (view === "gqs") body = <Gqs d={r.data} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={reload} />;
  else body = <Overview d={r.data} />;
  const rows = r?.state === "ok" ? r.data.rows : [];
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Back Office distribution"
        subtitle="Who gets each new Back Office and GQS ticket, and why - the workflows side by side with the hub (shadow mode)"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="bodist" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: rows.length ? full(rows.length) : null },
          { id: "flow", label: "Flow", count: null },
          { id: "detection", label: "Detection", count: null },
          { id: "people", label: "People", count: null },
          { id: "gqs", label: "GQS", count: rows.filter((x) => x.pipeline === "gqs").length ? full(rows.filter((x) => x.pipeline === "gqs").length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
