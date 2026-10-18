"use client";

// BACK OFFICE DISTRIBUTION - a HubSpot app (UC & HubSpot Apps > HubSpot apps), in SHADOW MODE (SARCLA 18.10.2026:
// move the distribution to the hub, "really vital ... it should work seamlessly"). For every ticket entering Back
// Office "New" or GQS "New for Back-Office" the hub works out what the HubSpot workflows decide and puts it next to
// what HubSpot really did - nothing is written to HubSpot. Comparison, Rules & teams and Settings as UC tabs.

import { Fragment, useState } from "react";
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
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Row, RunInfo, Settings } from "@/lib/boDistribution/engine";
import type { Person } from "@/lib/boDistribution/rules";

type Summary = {
  seen: number; bo: number; gqs: number; decided: number; checked: number; sameOwner: number; hubDiffers: number;
  categoryChecked: number; sameCategory: number; priorityChecked: number; samePriority: number; noDistribution: number; errors: number;
};
type Data = {
  settings: Settings; last: RunInfo | null; everyMinutes: number; rows: Row[]; summary: Summary; admin: boolean;
  rosters: Record<"saToOwnerBo" | "saToOwnerGqs" | "team27" | "team31" | "team23" | "team50" | "gqsTeam" | "gqsDt" | "deactivated", Person[]>;
};
type View = "comparison" | "rules" | "settings";
const VIEW_HASH: Record<View, string> = { comparison: "#comparison", rules: "#rules", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const STEP: Record<string, string> = {
  "23": "Assignment System (Maida, Sara, team)", "27": "General Distribution", "42": "General Distribution, then ESO/TSA",
  "31": "Load Balancer", "50": "Task Status Report merge", "75": "Sales split to ESO",
};

function Verdict({ r }: { r: Row }) {
  if (r.error) return <Chip tint="pink">error</Chip>;
  if (!r.legacy) return <Chip tint="slate">no distribution</Chip>;
  if (!r.actual) return <Chip tint="slate">waiting</Chip>;
  return r.actual.ownerId === r.legacy.ownerId ? <Chip tint="green">same owner</Chip> : <Chip tint="amber">different</Chip>;
}

function Comparison({ d }: { d: Data }) {
  const [filter, setFilter] = useState<"all" | "different" | "hub">("all");
  const [open, setOpen] = useState<string | null>(null);
  const s = d.summary;
  const rows = d.rows.filter((r) => filter === "all" || (filter === "different" ? r.actual && r.legacy && r.actual.ownerId !== r.legacy.ownerId : r.hub?.ownerId !== r.legacy?.ownerId));
  const { slice, pager } = usePaged(rows, 15);
  const kpis = [
    { label: "Tickets seen", value: s.seen, note: `${full(s.bo)} Back Office, ${full(s.gqs)} GQS - last 7 days`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "Same owner as HubSpot", value: pct(s.sameOwner, s.checked), note: `${full(s.sameOwner)} of ${full(s.checked)} checked - the copy of the rules against what the workflows did`, icon: <PersonOutlineOutlinedIcon />, tint: "green" as const },
    { label: "Same category", value: pct(s.sameCategory, s.categoryChecked), note: `${full(s.sameCategory)} of ${full(s.categoryChecked)}; priority ${pct(s.samePriority, s.priorityChecked)}`, icon: <CategoryOutlinedIcon />, tint: "purple" as const },
    { label: "Fixes change the owner", value: full(s.hubDiffers), note: "Tickets where the hub's fixed rules pick someone else than the copy", icon: <CompareArrowsOutlinedIcon />, tint: "amber" as const },
  ];
  return (
    <>
      <Info>
        Shadow mode - the hub writes nothing to HubSpot. For every ticket that enters Back Office &quot;New&quot; or GQS &quot;New for Back-Office&quot;
        it works out what the distribution workflows decide (<b>copy</b>: the same rules, quirks included), what it would decide with the faults
        fixed (<b>hub</b>: a deactivated person is never picked, a failed count is not read as an idle person), and ten minutes later it reads
        what HubSpot really did.
      </Info>
      <Grid container spacing={2}>
        {kpis.map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={typeof k.value === "number" ? full(k.value) : k.value} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket" note={d.last ? `Last look ${when(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.decided)} new, ${full(d.last.checked)} checked${d.last.error ? ` - ${d.last.error}` : ""}` : "Not run yet"} />
        <Box sx={{ mb: 1.5 }}>
          <Choice<"all" | "different" | "hub"> value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: d.rows.length },
            { key: "different", label: "HubSpot did otherwise", count: d.rows.filter((r) => r.actual && r.legacy && r.actual.ownerId !== r.legacy.ownerId).length },
            { key: "hub", label: "Fixes change it", count: s.hubDiffers },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Entered", "Ticket", "Path", "HubSpot gave", "Copy gives", "Hub gives", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((r) => (
                <Fragment key={r.key}>
                  <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.enteredAt)}</TableCell>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>
                        {r.subject || r.ticketId}
                      </Box>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.pipeline === "gqs" ? "GQS" : "Back Office"}{r.source ? ` · ${r.source}` : ""}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, ...clip(240) }}>{r.route ? `${r.route.path.join(" › ")}${r.route.assigner ? ` › ${STEP[r.route.assigner]}` : ""}` : r.pipeline === "gqs" ? "GQS distribution" : "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.actual ? r.actual.ownerName ?? "nobody" : "…"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.legacy?.ownerName ?? "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: r.hub?.ownerId !== r.legacy?.ownerId ? 700 : 400 }}>{r.hub?.ownerName ?? "—"}</TableCell>
                    <TableCell sx={bodyCell}><Verdict r={r} /></TableCell>
                  </TableRow>
                  {open === r.key && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}>
                        <Detail r={r} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!d.rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No ticket yet - the first ones appear within {d.everyMinutes} minutes of entering the stage.</Typography>}
      </GlassCard>
    </>
  );
}

function Detail({ r }: { r: Row }) {
  const line = (k: string, v: React.ReactNode) => (
    <Box sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.25 }}><Box sx={{ color: MUTED, minWidth: 150 }}>{k}</Box><Box sx={{ color: INK }}>{v}</Box></Box>
  );
  const sets = r.route ? Object.entries(r.route.sets) : [];
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {r.error && line("Error", <span style={{ color: RED }}>{r.error}</span>)}
      {r.route?.classified && line("Classifier", `${r.route.classified.category ?? "nothing recognised"}${r.route.classified.subCategory ? ` / ${r.route.classified.subCategory}` : ""}`)}
      {!!sets.length && line("Workflow would set", sets.map(([k, v]) => `${k.replace(/^enquiry_sub_category___|_+\d?$/g, "")} = ${v}`).join(" · "))}
      {r.legacy && line("Copy", `${r.legacy.ownerName ?? "nobody"} - ${r.legacy.method}${r.legacy.reasons.length ? ` (${r.legacy.reasons.join("; ")})` : ""}`)}
      {r.hub && line("Hub", `${r.hub.ownerName ?? "nobody"} - ${r.hub.method}${r.hub.reasons.length ? ` (${r.hub.reasons.join("; ")})` : ""}`)}
      {r.note && line("Note", r.note)}
      {r.actual && line("HubSpot", `${r.actual.ownerName ?? "nobody"}${r.actual.ownerSetBy ? ` (set by ${r.actual.ownerSetBy})` : ""} · category ${r.actual.category ?? "—"}${r.actual.subCategory ? ` / ${r.actual.subCategory}` : ""} · priority ${r.actual.priority ?? "—"}${r.actual.dispatch ? ` · dispatch ${r.actual.dispatch}` : ""} · read ${when(r.actual.at)}`)}
    </Box>
  );
}

function Rules({ d }: { d: Data }) {
  const off = new Set(d.rosters.deactivated.map((p) => p.id));
  const names = (ps: Person[]) => ps.map((p) => <Chip key={p.id} tint={off.has(p.id) ? "pink" : "slate"}>{p.name}{off.has(p.id) ? " (deactivated)" : ""}</Chip>);
  const lists: [string, string, Person[]][] = [
    ["Sales Agent names (Back Office)", "A company's or contact's Sales Agent / SA Sub only counts when it is one of these", d.rosters.saToOwnerBo],
    ["General Distribution (#27, #42)", "Most categories; RFQ, technical questions and MOQ then go on to ESO/TSA", d.rosters.team27],
    ["Load Balancer (#31)", "Others, and tickets back from ESO/TSA - same team, Sara third", d.rosters.team31],
    ["Assignment System (#23)", "Login issues, billing address, ERP export: Maida, then Sara, then least busy of", d.rosters.team23],
    ["Task Status Report, no GQS task (#50)", "Least busy of", d.rosters.team50],
    ["GQS team", "Least busy after Sales Agent and SA Sub", d.rosters.gqsTeam],
    ["GQS - DT New Business", "Always first, in this order", d.rosters.gqsDt],
  ];
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="How the workflows decide" note="SARCLA | BACK OFFICE MAIN ROUTING and NEW FOR BACK-OFFICE GQS DISTRIBUTION, read 18.10.2026" />
        <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.75, fontSize: "0.86rem", color: INK }}>
          <li>One minute after a ticket enters Back Office &quot;New&quot;: a C2S problem is Delivery / late / urgent; an Anyseals stock file is resolved.</li>
          <li>Chat tickets are never distributed: parked in &quot;New BO Topic&quot;, or - sent back by TSA - given to Rose Rasteiro.</li>
          <li>E-mails: &quot;Task Status Report&quot; merges into its GQS task; billing address / ERP export go to Maida; a mail to sales@ from a sales rep goes to ESO with that rep; PERFORMIS / AVOR stopped orders are late deliveries; tickets back from ESO/TSA go to the Load Balancer; everything else is read by the keyword classifier.</li>
          <li>The category and sub-category then set the priority and pick the step: Login issue → Assignment System; RFQ, technical question, MOQ → General Distribution then ESO/TSA; nothing recognised → Others, Load Balancer; the rest → General Distribution.</li>
          <li>Each step: the Sales Agent if available (no limit), else the SA Sub, else the least busy available person of its team; nobody available → the least busy of everyone. &quot;Available&quot; = the green dot of HubSpot chat. Workload = open Back Office tickets.</li>
          <li>GQS, on &quot;New for Back-Office&quot;: Sales Agent, SA Sub, DT New Business to Claudio then Leart, then the least busy of the GQS team.</li>
        </Box>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="The teams in the workflow code" note="Order breaks ties. Pink = deactivated in HubSpot but still in the code; the hub never picks them" />
        <Box sx={{ display: "grid", gap: 1.25 }}>
          {lists.map(([t, n, ps]) => (
            <Box key={t}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{t}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>{n}</Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{names(ps)}</Box>
            </Box>
          ))}
        </Box>
      </GlassCard>
    </>
  );
}

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
        <Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Mode</Typography>
          <Choice<"off" | "shadow"> value={d.settings.mode} onChange={(m) => d.admin && void call("PUT", { mode: m })} options={[
            { key: "shadow", label: "Shadow - compare, write nothing" }, { key: "off", label: "Off" },
          ]} />
          {d.settings.at && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>Set {when(d.settings.at)} by {d.settings.by}</Typography>}
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="outlined" size="small" disabled={!d.admin || busy} onClick={() => void call("POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
          There is no live mode yet: the hub starts writing owners only after the comparison has been clean for a while, one pipeline at a time,
          with the matching workflow steps switched off in the same minute.
        </Typography>
      </Box>
    </GlassCard>
  );
}

export default function BoDistribution() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "comparison");
  const [n, setN] = useState(0);
  const url = `/api/uc/bo-distribution${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Back Office distribution" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else if (view === "settings") body = <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><SettingsTab d={r.data} onChanged={() => setN((x) => x + 1)} /></Box>;
  else if (view === "rules") body = <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Rules d={r.data} /></Box>;
  else body = <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Comparison d={r.data} /></Box>;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Back Office distribution"
        subtitle="Who gets each new Back Office and GQS ticket - the workflows, side by side with the hub (shadow mode)"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="bodist" tab={view} onSelect={setView} tabs={[
          { id: "comparison", label: "Comparison", count: r?.state === "ok" && r.data.summary.seen ? full(r.data.summary.seen) : null },
          { id: "rules", label: "Rules & teams", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {body}
    </Box>
  );
}
