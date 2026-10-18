"use client";

// DUPLICATES & MERGES - a HubSpot app (UC & HubSpot Apps > HubSpot apps), in SHADOW MODE (SARCLA 18.10.2026: "DUPS and
// merge should be a separate app, and we should also improve that, exclude something"). For every ticket entering
// Back Office "New" the hub looks for its duplicates as the DUPS workflow does, and with the exclusions set here, and
// puts both next to what HubSpot wrote. Nothing is written to HubSpot. Comparison, Exclusions and Settings as UC tabs.

import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
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
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Row, RunInfo, Settings } from "@/lib/ticketDuplicates/engine";
import type { Exclusions } from "@/lib/ticketDuplicates/rules";

type Summary = {
  seen: number; checked: number; withKey: number; settled: number; legacyFound: number; hubspotFound: number; sameVerdict: number;
  legacyOwnerChanges: number; hubOwnerChanges: number; hubDiffers: number; stopped: number; errors: number;
};
type Data = { settings: Settings; last: RunInfo | null; everyMinutes: number; rows: Row[]; summary: Summary; admin: boolean };
type View = "comparison" | "exclusions" | "settings";
const VIEW_HASH: Record<View, string> = { comparison: "#comparison", exclusions: "#exclusions", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const PIPES: { id: string; label: string }[] = [
  { id: "1726786777", label: "Back Office" }, { id: "1726599376", label: "ESO" }, { id: "1726599377", label: "TSA" },
  { id: "1726786775", label: "GQS" }, { id: "1553929403", label: "Special Prices" }, { id: "1737150687", label: "Product Management" },
];

const ids = (d: string[] | undefined) => (d?.length ? d.join(", ") : "none");
const owner = (r: Row, id: string | null | undefined) => (id ? r.ownerNames[id] ?? id : "—");

function Comparison({ d }: { d: Data }) {
  const [filter, setFilter] = useState<"all" | "found" | "differs">("found");
  const [open, setOpen] = useState<string | null>(null);
  const s = d.summary;
  const rows = d.rows.filter((r) => filter === "all" || (filter === "found" ? r.legacy?.duplicates.length || r.hub?.duplicates.length : JSON.stringify(r.hub?.duplicates) !== JSON.stringify(r.legacy?.duplicates) || r.hub?.ownerChange?.ownerId !== r.legacy?.ownerChange?.ownerId));
  const { slice, pager } = usePaged(rows, 15);
  const kpis = [
    { label: "Tickets checked", value: full(s.checked), note: `${full(s.withKey)} name an order number; ${full(s.stopped)} stopped before (certificates, erosion)`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "Duplicates found", value: full(s.legacyFound), note: `HubSpot flagged ${full(s.hubspotFound)} of the ${full(s.settled)} settled`, icon: <ContentCopyOutlinedIcon />, tint: "purple" as const },
    { label: "Same verdict as HubSpot", value: pct(s.sameVerdict, s.settled), note: `${full(s.sameVerdict)} of ${full(s.settled)} - the copy of the workflow against what it did`, icon: <CompareArrowsOutlinedIcon />, tint: "green" as const },
    { label: "Owner handed over", value: full(s.legacyOwnerChanges), note: `With your exclusions: ${full(s.hubOwnerChanges)}; ${full(s.hubDiffers)} tickets come out differently`, icon: <PersonOutlineOutlinedIcon />, tint: "amber" as const },
  ];
  return (
    <>
      <Info>
        Shadow mode - nothing is written to HubSpot. For each new Back Office ticket the hub searches its duplicates exactly as the DUPS workflow
        does (<b>copy</b>) and with your exclusions (<b>hub</b>), and reads ten minutes later what HubSpot wrote. Merging stays a person&apos;s
        decision in HubSpot (&quot;Merge the tickets, I&apos;ve checked&quot;).
      </Info>
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket" note={d.last ? `Last look ${when(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.checked)} new, ${full(d.last.settled)} settled${d.last.error ? ` - ${d.last.error}` : ""}` : "Not run yet"} />
        <Box sx={{ mb: 1.5 }}>
          <Choice<"all" | "found" | "differs"> value={filter} onChange={setFilter} options={[
            { key: "found", label: "With duplicates", count: d.rows.filter((r) => r.legacy?.duplicates.length || r.hub?.duplicates.length).length },
            { key: "differs", label: "Exclusions change it", count: s.hubDiffers },
            { key: "all", label: "All", count: d.rows.length },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Entered", "Ticket", "Order", "Copy finds", "Hub finds", "HubSpot wrote", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((r) => (
                <Fragment key={r.key}>
                  <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.enteredAt)}</TableCell>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || r.ticketId}</Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{r.keys || "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.stopped ? "—" : ids(r.legacy?.duplicates)}{r.legacy?.ownerChange ? ` → ${owner(r, r.legacy.ownerChange.ownerId)}` : ""}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.stopped ? "—" : ids(r.hub?.duplicates)}{r.hub?.ownerChange ? ` → ${owner(r, r.hub.ownerChange.ownerId)}` : ""}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, ...clip(260) }}>{r.actual ? r.actual.message ?? "nothing" : "…"}</TableCell>
                    <TableCell sx={bodyCell}>{r.error ? <Chip tint="pink">error</Chip> : r.stopped ? <Chip tint="slate">skipped</Chip> : null}</TableCell>
                  </TableRow>
                  {open === r.key && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)", fontSize: "0.8rem" }}>
                        {r.stopped && <div>{r.stopped}</div>}
                        {r.error && <div>Error: {r.error}</div>}
                        {r.legacy && <div><b>Copy:</b> {r.legacy.message}{r.legacy.skip ? ` (${r.legacy.skip})` : ""}{r.legacy.ownerChange ? ` - owner to ${owner(r, r.legacy.ownerChange.ownerId)} (owner of ticket ${r.legacy.ownerChange.fromTicket})` : ""}</div>}
                        {r.hub && <div><b>Hub:</b> {r.hub.message}{r.hub.ownerChange ? ` - owner to ${owner(r, r.hub.ownerChange.ownerId)}` : " - owner unchanged"}</div>}
                        {r.actual && <div><b>HubSpot:</b> {r.actual.message ?? "nothing written"} · owner {r.actual.ownerAfterName ?? "—"}{r.actual.ownerSetBy ? ` (last set by ${r.actual.ownerSetBy})` : ""} · read {when(r.actual.at)}</div>}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>Nothing here yet - tickets appear within {d.everyMinutes} minutes of entering Back Office &quot;New&quot;.</Typography>}
      </GlassCard>
    </>
  );
}

function ExclusionsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [ex, setEx] = useState<Exclusions>(d.settings.exclusions);
  const [texts, setTexts] = useState(d.settings.exclusions.neverMatchTexts.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-duplicates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exclusions: { ...ex, neverMatchTexts: texts.split("\n") } }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved - new tickets are checked with these exclusions (shadow only)." : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const togglePipe = (id: string) => setEx((x) => ({ ...x, pipelines: x.pipelines.includes(id) ? x.pipelines.filter((p) => p !== id) : [...x.pipelines, id] }));
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<FilterAltOffOutlinedIcon />} tint="purple" title="Exclusions" note="What the hub's own check leaves out. The defaults are exactly the workflow; the copy always follows the workflow" />
      <Box sx={{ display: "grid", gap: 2, maxWidth: 760 }}>
        <Box>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Pipelines that can hold a duplicate</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>None ticked = every pipeline, as the workflow does today.</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {PIPES.map((p) => <FormControlLabel key={p.id} sx={{ m: 0 }} control={<Checkbox size="small" checked={ex.pipelines.includes(p.id)} onChange={() => togglePipe(p.id)} disabled={!d.admin} />} label={<Typography sx={{ fontSize: "0.82rem" }}>{p.label}</Typography>} />)}
          </Box>
        </Box>
        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ex.ownerFromSamePipelineOnly} onChange={(e) => setEx({ ...ex, ownerFromSamePipelineOnly: e.target.checked })} disabled={!d.admin} />}
          label={<Typography sx={{ fontSize: "0.84rem" }}>Take the owner only from a duplicate in the <b>same pipeline</b> (today: any pipeline - a Back Office ticket can go to an ESO owner)</Typography>} />
        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ex.flagOnly} onChange={(e) => setEx({ ...ex, flagOnly: e.target.checked })} disabled={!d.admin} />}
          label={<Typography sx={{ fontSize: "0.84rem" }}>Only flag duplicates - <b>never change the owner</b></Typography>} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField size="small" type="number" label="Owner from duplicates up to (days)" value={ex.ownerMaxAgeDays} onChange={(e) => setEx({ ...ex, ownerMaxAgeDays: Number(e.target.value) })} disabled={!d.admin} sx={{ width: 260 }} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Today: 30</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Never a duplicate when the subject contains</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>One text per line, on top of the workflow&apos;s own (certificates, C2S problems, warnings; erosion only matches erosion). E.g. &quot;ERP Order Export&quot;.</Typography>
          <TextField multiline minRows={3} fullWidth size="small" value={texts} onChange={(e) => setTexts(e.target.value)} disabled={!d.admin} />
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="contained" size="small" disabled={!d.admin || busy} onClick={() => void save()} sx={{ textTransform: "none" }}>Save exclusions</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </Box>
    </GlassCard>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const call = async (method: "PUT" | "POST", body: object) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-duplicates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="outlined" size="small" disabled={!d.admin || busy} onClick={() => void call("POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>No live mode yet: the hub takes over from the DUPS workflow only once the comparison is clean and the exclusions are agreed.</Typography>
      </Box>
    </GlassCard>
  );
}

export default function TicketDuplicates() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "comparison");
  const [n, setN] = useState(0);
  const url = `/api/uc/ticket-duplicates${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Duplicates & merges" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={() => setN((x) => x + 1)} />;
  else if (view === "exclusions") body = <ExclusionsTab key={r.data.settings.at ?? "x"} d={r.data} onChanged={() => setN((x) => x + 1)} />;
  else body = <Comparison d={r.data} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Duplicates & merges"
        subtitle="Back Office tickets about the same order - the DUPS workflow, side by side with the hub (shadow mode)"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="ticketdup" tab={view} onSelect={setView} tabs={[
          { id: "comparison", label: "Comparison", count: r?.state === "ok" && r.data.summary.legacyFound ? full(r.data.summary.legacyFound) : null },
          { id: "exclusions", label: "Exclusions", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      <Box role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
