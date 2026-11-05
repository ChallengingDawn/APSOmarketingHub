"use client";

// BACK OFFICE DISTRIBUTION - a HubSpot app (UC & HubSpot Apps > HubSpot apps). The hub DOES the
// distribution (SARCLA 18.10.2026: move it to the hub, "really vital ... it should work seamlessly";
// then "really raw - much more: people, GQS, the flow, the detection, changing people without
// changing the code"). Every ticket entering Back Office "New" or GQS "New for Back-Office" gets its
// owner, stage and category from here, and the last 7 days are replayed so a rule change can be
// seen before it is saved.
//
// It began as a shadow of two HubSpot workflows - BACK OFFICE MAIN ROUTING 3678508243 and NEW FOR
// BACK-OFFICE GQS DISTRIBUTION 3680656607 - and both were switched off on 19.10.2026, when the hub
// took over. The page was still written as though they were running: SARCLA, 24.10.2026, "a lot of
// Back Office distribution still talks about workflow ... the service has been migrated, it should
// not mention it anymore". So the present tense belongs to the hub, and the workflows appear only
// where they are genuinely the subject - the rollback path, and figures from before the hand-over.
//
// A main toggle, Back Office | GQS (SARCLA 01.11.2026: "GQS should have its own KPI subdivided like we do in advanced
// reporting - create a main toggle in between pipelines"), and each pipeline its own tabs:
//   Back Office - Overview, Tickets, Flow, Detection, Sentiment, Priority, People, Settings;
//   GQS - the same eight (SARCLA 01.11.2026: "keep the same then to GQS the same tab, but instead of sentiment resolution
//   for win or lost"): Overview, Tickets, Flow, Type of request, Resolution, Speed, People, Settings - the figures from
//   every GQS task (GqsKpis.tsx), Tickets / Flow / the team from the routing (GqsTab.tsx).
// People and Settings are each pipeline's own ("GQS still on back office setting"): its team lists, its live switch.

import { useMemo, useState } from "react";
import { ApprovalsTab } from "./ApprovalsTab";
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
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { Chip, when } from "@/app/connectors/parts";
import type { Person, RosterKey } from "@/lib/boDistribution/rules";

import {
  CHAT_LABEL, GQS_KPI_VIEWS, GQS_ROSTERS, PIPE_OF, VIEW_HASH, gave,
  type Data, type PeopleData, type Pipe, type View,
} from "./shared";
import type { GqsStore } from "@/lib/gqsFigures/figures";
import { dayOf, rangeLabel } from "@/lib/boDetection/figures";
import { FlowTab } from "./FlowTab";
import { GqsFlow, GqsTeam } from "./GqsTab";
import { GqsKpis, OpenNow, openCount, type GqsView } from "./GqsKpis";
import { PriorityTab } from "./PriorityTab";
import { SettingsTab } from "./SettingsTab";
import { IntakeCard } from "./IntakeCard";
import { DetectionTab } from "./DetectionTab";
import { SentimentTab, type MachineTopics, type SentimentData } from "./SentimentTab";
import type { PeriodFigures } from "@/lib/boDetection/engine";
import { BoOverview, BoTickets } from "./BoOverview";
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
        {custom ? <Chip tint="amber">changed here</Chip> : <Chip tint="slate">unchanged</Chip>}
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
          {custom && <Button size="small" disabled={busy} onClick={() => void save(null)} sx={{ textTransform: "none" }}>Back to the original list</Button>}
        </Box>
      )}
    </Box>
  );
}
/**
 * People, per pipeline (01.11.2026): Back Office's people and its team lists; on GQS only GQS's lists - the GQS team
 * table (GqsTeam) and each owner's figures stand above them there.
 */
function People({ d, onSaved, pipe }: { d: Data; onSaved: () => void; pipe: Pipe }) {
  const [n, setN] = useState(0);
  const held = useHeld<PeopleData>(`/api/uc/bo-distribution?people=1&n=${n}`, [n]);
  const r = held.result;
  if (r === null) return <LoadingPanel label="Reading everyone's status and open tickets…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Back Office distribution - people" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const p = r.data;
  const got = (id: string) => d.rows.filter((x) => x.actual && gave(x)!.id === id).length;
  const copy = (id: string) => d.rows.filter((x) => x.legacy?.ownerId === id).length;
  const hub = (id: string) => d.rows.filter((x) => x.hub?.ownerId === id).length;
  const keys = (Object.keys(d.labels) as RosterKey[]).filter((k) => GQS_ROSTERS.includes(k) === (pipe === "gqs"));
  return (
    <>
      {pipe === "bo" && (
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<GroupsOutlinedIcon />} tint="green" title="The people" note={`Everyone in a team - chat status and open Back Office tickets now (${when(p.at)}); the tickets of the days the routing keeps`} />
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>{["Person", "Status", "Open Back Office", "Got", "Old rules", "Hub gives", "Teams"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {[...p.people].sort((a, b) => Number(a.deactivated) - Number(b.deactivated) || a.name.localeCompare(b.name)).map((x) => (
                  <TableRow key={x.id}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 700, color: x.deactivated ? RED : INK }}>{x.name}</TableCell>
                    <TableCell sx={bodyCell}>{x.deactivated ? <Chip tint="pink">deactivated</Chip> : x.chat === "available" ? <Chip tint="green">available</Chip> : <Chip tint="slate">{x.chat ? CHAT_LABEL[x.chat] ?? x.chat : "no status"}</Chip>}</TableCell>
                    <TableCell sx={bodyCell}>{x.boOpen ?? "—"}</TableCell>
                    <TableCell sx={bodyCell}>{got(x.id) || ""}</TableCell>
                    <TableCell sx={bodyCell}>{copy(x.id) || ""}</TableCell>
                    <TableCell sx={bodyCell}>{hub(x.id) || ""}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.72rem", color: MUTED }}>{x.lists.length} list{x.lists.length === 1 ? "" : "s"}{x.inWorkflow.length !== x.lists.length ? " (changed here)" : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>&quot;Available&quot; is the green dot of HubSpot chat. Old rules = what the rules before the hand-over would have given; Hub gives = the rules in use.</Typography>
        </GlassCard>
      )}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title={`The ${pipe === "gqs" ? "GQS" : "Back Office"} teams - change them here, not in code`} note="These are the lists tickets are handed out from. Order matters: it breaks ties and sets who is tried first" />
        <Grid container spacing={2}>
          {keys.map((k) => <Grid key={k} size={{ xs: 12, md: 6, xl: 4 }}><RosterEditor k={k} d={d} owners={p.owners} onSaved={() => { onSaved(); setN((x) => x + 1); }} /></Grid>)}
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
function SentimentPanel({ days, from, to, label }: { days: number; from: string; to: string; label: string }) {
  const [n, setN] = useState(0);
  const url = `/api/uc/bo-sentiment?days=${days}&from=${from}&to=${to}${n ? `&n=${n}` : ""}`;
  const held = useHeld<SentimentData>(url, [url]);
  const r = held.result;
  // the machine tickets by their topic, from the Detection count of the same period
  const durl = `/api/uc/bo-distribution?detection=1&from=${from}&to=${to}`;
  const det = useHeld<PeriodFigures>(durl, [durl]).result;
  const topics: MachineTopics = det?.state === "ok" && det.data.now.mt ? { now: det.data.now.mt, before: det.data.before.mt ?? {} } : null;
  if (r === null) return <LoadingPanel label="Reading the tone of the Back Office tickets…" />;
  if (r.state !== "ok") {
    return <UpstreamPanel source="Back Office sentiment" error={r.state === "error" ? r.error : "not configured"}
      status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  }
  return <SentimentTab d={r.data} periodLabel={label} onChanged={() => setN((x) => x + 1)} topics={topics} />;
}

/**
 * The store keeps 21 days of decided tickets, which is not the same as the period somebody asks
 * for (SARCLA 25.10.2026: "why only 21, this is not what is expected"). The page therefore uses
 * the platform's own period picker, and the parts that cannot reach back that far say so instead
 * of silently showing less: the Sentiment figures come from HubSpot and cover any period, the
 * decision detail is capped at what is stored.
 */
// keep in step with DAYS_KEPT in src/lib/boSentiment/engine.ts and DETAIL_DAYS in the route
const STORE_DAYS = 90;

/** What the Flow tabs can and cannot reach - said above them, where it matters. */
const FLOW_NOTE = (
  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
    The flow is the hub&rsquo;s own record of each decision: it decides since 19.10.2026 and keeps each record 21 days, so the
    flow shows the period&rsquo;s days within those. Who got the tickets, what they are about and what became of the owner are
    counted for any period on Overview and Tickets.
  </Typography>
);

/** Back Office | GQS - the page's main toggle (SARCLA 01.11.2026), drawn as the ESO reports draw ESO | TSA | Total. */
const PIPES: { id: Pipe; label: string; count: null }[] = [{ id: "bo", label: "Back Office", count: null }, { id: "gqs", label: "GQS", count: null }];

export default function BoDistribution() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  // every tab belongs to one pipeline, so the toggle follows the tab (an old #gqs opens GQS)
  const pipe = PIPE_OF(view);
  const choosePipe = (p: Pipe) => setView(p === "gqs" ? "gqs" : "overview");
  const [n, setN] = useState(0);
  const { window: win, days: askedDays, label: periodLabel } = useReportingWindow();
  const days = Math.min(STORE_DAYS, Math.max(1, askedDays));
  const url = `/api/uc/bo-distribution?days=${days}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  // GQS's own figures: every GQS task, read only once GQS is picked
  const gqsUrl = pipe === "gqs" ? `/api/uc/bo-distribution?gqs=1${n ? `&n=${n}` : ""}` : null;
  const gqsHeld = useHeld<GqsStore | null>(gqsUrl, [gqsUrl]);
  const g = gqsHeld.result;
  const store = g?.state === "ok" ? g.data : null;
  const reload = () => setN((x) => x + 1);
  const all = r?.state === "ok" ? r.data : null;
  // the Back Office tabs see the Back Office's tickets; GQS's are on GQS > Tickets
  const bo = useMemo(() => (all ? { ...all, rows: all.rows.filter((x) => x.pipeline === "bo") } : null), [all]);
  // the Flow tabs draw the routing's own record of each decision - the period's days of it (it begins 19.10.2026 and is kept 21 days)
  const inWin = (x: Data): Data => ({ ...x, rows: x.rows.filter((r) => { const k = dayOf(r.enteredAt); return k >= win.from && k <= win.to; }) });
  const gqsRows = all ? inWin(all).rows.filter((x) => x.pipeline === "gqs") : [];
  // the days the routing's rows cover, named - never the period asked for (they are kept 21 days)
  const span = (() => { const e = gqsRows.map((x) => x.enteredAt).sort(); return e.length ? rangeLabel(dayOf(e[0]), dayOf(e[e.length - 1])) : "in these days"; })();
  /** a part drawn from every GQS task (the 30-minute read) */
  const withStore = (draw: (s: GqsStore) => React.ReactNode): React.ReactNode =>
    g === null ? <LoadingPanel label="Reading the GQS tasks…" />
      : g.state !== "ok" ? <UpstreamPanel source="GQS figures" error={g.state === "error" ? g.error : "not configured"} status={g.state === "error" ? g.status : null} onRetry={reload} />
      : !store ? <LoadingPanel label="The GQS tasks are read every 30 minutes - the first read after a release takes about five minutes" />
      : draw(store);
  let body: React.ReactNode;
  // Approvals has its own engine and API (src/lib/gqsApprovals) - it never waits for the distribution's data
  if (view === "gqs-approvals") body = <ApprovalsTab from={win.from} to={win.to} />;
  else if (GQS_KPI_VIEWS.includes(view)) {
    body = withStore((s) => <GqsKpis key={view} view={view as GqsView} store={s} from={win.from} to={win.to} />);
  } else if (r === null || !all || !bo) {
    body = r !== null && r.state !== "ok"
      ? <UpstreamPanel source="Back Office distribution" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={reload} />
      : <LoadingPanel label="Reading the Back Office tickets…" />;
  }
  else if (view === "tickets") body = <BoTickets from={win.from} to={win.to} label={periodLabel} />;
  else if (view === "flow") body = <>{FLOW_NOTE}<FlowTab d={inWin(all)} /></>;
  else if (view === "detection") body = <DetectionTab d={all} from={win.from} to={win.to} />;
  else if (view === "sentiment") body = <SentimentPanel key="sentiment" days={days} from={win.from} to={win.to} label={periodLabel} />;
  else if (view === "people") body = <People d={bo} onSaved={reload} pipe="bo" />;
  // the way in (Back Office Ticket Created | Notification, SARCLA 05.11.2026) above the distribution's own settings
  else if (view === "settings") body = <><IntakeCard /><SettingsTab key={all.settings.at ?? "s"} d={all} onChanged={reload} pipe="bo" /></>;
  else if (view === "priority") body = <PriorityTab key={all.settings.at ?? "p"} d={all} onSaved={reload} from={win.from} to={win.to} label={periodLabel} />;
  // GQS: Tickets and Flow from the routing's rows (GqsTab.tsx), with every open task under the tickets; People = each
  // owner's figures, the GQS team, GQS's lists
  else if (view === "gqs-tickets") body = withStore((s) => <><GqsKpis key={view} view="gqs-tickets" store={s} from={win.from} to={win.to} /><OpenNow store={s} /></>);
  else if (view === "gqs-flow") body = <>{FLOW_NOTE}<GqsFlow d={inWin(all)} span={span} /></>;
  else if (view === "gqs-people") body = <>{withStore((s) => <GqsKpis key={view} view="gqs-people" store={s} from={win.from} to={win.to} />)}<GqsTeam d={all} /><People d={all} onSaved={reload} pipe="gqs" /></>;
  else if (view === "gqs-settings") body = <SettingsTab key={`g${all.settings.at ?? "s"}`} d={all} onChanged={reload} pipe="gqs" />;
  else body = <BoOverview d={bo} from={win.from} to={win.to} label={periodLabel} />;
  const open = openCount(store);
  const tabs: { id: View; label: string; count: string | null }[] = pipe === "gqs" ? [
    { id: "gqs", label: "Overview", count: null },
    { id: "gqs-tickets", label: "Tickets", count: open ? full(open) : null },
    { id: "gqs-approvals", label: "Approvals", count: null },
    { id: "gqs-flow", label: "Flow", count: null },
    { id: "gqs-type", label: "Type of request", count: null },
    { id: "gqs-resolution", label: "Resolution", count: null },
    { id: "gqs-speed", label: "Speed", count: null },
    { id: "gqs-people", label: "People", count: null },
    { id: "gqs-settings", label: "Settings", count: null },
  ] : [
    { id: "overview", label: "Overview", count: null },
    { id: "tickets", label: "Tickets", count: null },
    { id: "flow", label: "Flow", count: null },
    { id: "detection", label: "Detection", count: null },
    { id: "sentiment", label: "Sentiment", count: null },
    { id: "priority", label: "Priority", count: null },
    { id: "people", label: "People", count: null },
    { id: "settings", label: "Settings", count: null },
  ];
  const busy = r === null || held.stale || (pipe === "gqs" && (g === null || gqsHeld.stale));
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Back Office distribution"
        subtitle={pipe === "gqs" ? "GQS: the requests for an offer - how many, what came of them, how long they take, and who gets each" : "Back Office: who gets each new ticket, what it is about, and why"}
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WindowPicker />
            {busy && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {/* Back Office | GQS - a row of its own above the tabs, as ESO | TSA | Total on the ESO reports */}
      <Box sx={{ display: "grid", gap: 1.25 }}>
        <Box sx={{ justifySelf: "start" }}><ReportTabs name="bodist-pipeline" tab={pipe} onSelect={choosePipe} tabs={PIPES} /></Box>
        <Box><ReportTabs name="bodist" tab={tabs.some((t) => t.id === view) ? view : tabs[0].id} onSelect={setView} tabs={tabs} /></Box>
      </Box>
      <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
