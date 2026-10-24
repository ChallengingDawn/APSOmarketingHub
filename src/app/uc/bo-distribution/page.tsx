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
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { PersonRow, Row, RunInfo, Settings } from "@/lib/boDistribution/engine";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { Person, RosterKey } from "@/lib/boDistribution/rules";

import {
  CHAT_LABEL, Detail, STEP, TicketTable, VIEW_HASH, count, fixesDiffer, gave, measure, pct, sameOwner,
  type Data, type PeopleData, type View,
} from "./shared";
import { FlowTab } from "./FlowTab";
import { GqsTab } from "./GqsTab";
import { PriorityTab } from "./PriorityTab";
import { SettingsTab } from "./SettingsTab";
import { DetectionTab } from "./DetectionTab";
import { SentimentTab, type SentimentData } from "./SentimentTab";
import { StraysCard } from "./StraysCard";
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
  const owners = count(d.rows.filter((r) => r.actual), (r) => gave(r)!.name);
  const steps = count(d.rows.filter((r) => r.route?.assigner), (r) => STEP[r.route!.assigner!]);
  const cats = count(d.rows.filter((r) => r.actual), (r) => r.actual!.category ?? "No category");
  const [cat, setCat] = useState<string | null>(null);
  // deliveries, and how many of them are cut-to-size (SARCLA 19.10.2026: "from deliveries, how many C2S")
  const deliveries = d.rows.filter((r) => r.pipeline === "bo" && (r.route?.sets.enquiry_category ?? r.actual?.category) === "Delivery");
  const c2s = deliveries.filter((r) => r.c2s);
  const delSubs = count(deliveries, (r) => r.route?.sets.enquiry_sub_category___delivery___1 ?? r.actual?.subCategory ?? "No sub-category")
    .map((x) => ({ ...x, secondary: `${full(deliveries.filter((r) => (r.route?.sets.enquiry_sub_category___delivery___1 ?? r.actual?.subCategory ?? "No sub-category") === x.label && r.c2s).length)} C2S` }));
  const inCat = !cat ? [] : cat.startsWith("Delivery: ")
    ? d.rows.filter((r) => (r.route?.sets.enquiry_category ?? r.actual?.category) === "Delivery" && (r.route?.sets.enquiry_sub_category___delivery___1 ?? r.actual?.subCategory ?? "No sub-category") === cat.slice(10))
    : d.rows.filter((r) => r.actual && (r.actual.category ?? "No category") === cat);
  return (
    <>
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <StraysCard d={d} />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title="Day by day" note="Copy against HubSpot: same owner, another owner, no distribution on the path, not settled yet" />
        <StackedColumns data={days} parts={[{ key: "same", label: "Same owner" }, { key: "different", label: "Another owner" }, { key: "none", label: "No distribution" }, { key: "waiting", label: "Not settled" }]} format={(v) => full(v ?? 0)} />
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<PersonOutlineOutlinedIcon />} tint="green" title="Who got them" note="Owner in HubSpot" /><BarList rows={owners} labelWidth={150} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title="Which step picked" note="The workflow step on each ticket's path" /><BarList rows={steps} labelWidth={170} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title="Categories" note="As HubSpot has them now - click one to see its tickets" /><BarList rows={cats} labelWidth={150} format={(v) => full(v ?? 0)} onSelect={(l) => setCat(cat === l ? null : l)} selectedLabel={cat} /></GlassCard></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="pink" title={`Deliveries: ${full(deliveries.length)}, of which cut-to-size (C2S): ${full(c2s.length)} (${pct(c2s.length, deliveries.length)})`}
          note="C2S = flagged by the ticket associations (c2s_ticket), a C2S problem order, or C2S / Zuschnitt in the subject. Second figure: the C2S ones" />
        <BarList rows={delSubs} labelWidth={200} format={(v) => full(v ?? 0)} onSelect={(l) => setCat(cat === `Delivery: ${l}` ? null : `Delivery: ${l}`)} />
      </GlassCard>
      {cat && (
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<CategoryOutlinedIcon />} tint="amber" title={`${cat} - ${full(inCat.length)} tickets`}
            note={cat === "Others" ? "Others = the keyword classifier recognised nothing in the e-mail (or a form / hub ticket came without a known category) - the workflow then sets Others and the Load Balancer picks. Detection > Not recognised shows why." : "Click the category again to close"} />
          <TicketTable rows={inCat} empty="No ticket." />
        </GlassCard>
      )}
    </>
  );
}

function Tickets({ d }: { d: Data }) {
  const [filter, setFilter] = useState<"all" | "different" | "fixes" | "live" | "wrote">("all");
  const [pipe, setPipe] = useState<"all" | "bo" | "gqs">("all");
  const [id, setId] = useState("");
  const [check, setCheck] = useState<string | null>(null);
  const checked = useHeld<Row>(check ? `/api/uc/bo-distribution?ticket=${check}` : null, [check]);
  const rows = d.rows.filter((r) => (pipe === "all" || r.pipeline === pipe) && (filter === "all" || (filter === "different" ? r.actual && r.legacy && !sameOwner(r) : filter === "fixes" ? fixesDiffer(r) : filter === "wrote" ? !!r.wrote : !r.approx)));
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
          <Choice<"all" | "different" | "fixes" | "live" | "wrote"> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: d.rows.length },
            { key: "different", label: "HubSpot did otherwise", count: d.rows.filter((r) => r.actual && r.legacy && !sameOwner(r)).length },
            { key: "fixes", label: "Fixes change it", count: d.rows.filter(fixesDiffer).length },
            { key: "live", label: "Seen live (not replayed)", count: d.rows.filter((r) => !r.approx).length },
            // live mode (SARCLA 19.10.2026: "this filter should also show the change now"): written, or left to the workflow and why
            { key: "wrote", label: `Live: written by the hub ${d.rows.filter((r) => r.wrote?.ok).length} / left to the workflow`, count: d.rows.filter((r) => r.wrote).length },
          ]} />
          <Choice<"all" | "bo" | "gqs"> value={pipe} onChange={setPipe} options={[{ key: "all", label: "Both" }, { key: "bo", label: "Back Office" }, { key: "gqs", label: "GQS" }]} />
        </Box>
        <TicketTable rows={rows} empty={`Nothing yet - tickets appear within ${d.everyMinutes} minutes of entering the stage; the replay fills the last 7 days.`} />
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
  const got = (id: string) => d.rows.filter((x) => x.actual && gave(x)!.id === id).length;
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

/**
 * The Sentiment tab reads its own endpoint (/api/uc/bo-sentiment), so it loads itself rather than
 * widening this page's payload with figures the other tabs never use. Rendered with a key of its
 * own: two held loaders in one slot is the crash we fixed once already.
 */
function SentimentPanel() {
  const [n, setN] = useState(0);
  const url = `/api/uc/bo-sentiment${n ? `?n=${n}` : ""}`;
  const held = useHeld<SentimentData>(url, [url]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading the tone of the Back Office tickets…" />;
  if (r.state !== "ok") {
    return <UpstreamPanel source="Back Office sentiment" error={r.state === "error" ? r.error : "not configured"}
      status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  }
  return <SentimentTab d={r.data} onChanged={() => setN((x) => x + 1)} />;
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
  else if (view === "flow") body = <FlowTab d={r.data} />;
  else if (view === "detection") body = <DetectionTab d={r.data} />;
  else if (view === "sentiment") body = <SentimentPanel key="sentiment" />;
  else if (view === "people") body = <People d={r.data} onSaved={reload} />;
  else if (view === "gqs") body = <GqsTab d={r.data} />;
  else if (view === "settings") body = <SettingsTab key={r.data.settings.at ?? "s"} d={r.data} onChanged={reload} />;
  else if (view === "priority") body = <PriorityTab key={r.data.settings.at ?? "p"} d={r.data} onSaved={reload} />;
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
          { id: "sentiment", label: "Sentiment", count: null },
          { id: "priority", label: "Priority", count: null },
          { id: "people", label: "People", count: null },
          { id: "gqs", label: "GQS", count: rows.filter((x) => x.pipeline === "gqs").length ? full(rows.filter((x) => x.pipeline === "gqs").length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
