"use client";

// HOLIDAY REDIRECTION - a HubSpot app (UC & HubSpot Apps). An open ESO ticket whose owner
// is out of office goes to the first deputy who is in, with a note on the ticket. It runs
// every 15 minutes in the hub. It used to run beside the Compass connector only because
// that was the one always-on server - it has nothing to do with the ERP (SARCLA, 10.10.2026).

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import BeachAccessOutlinedIcon from "@mui/icons-material/BeachAccessOutlined";
import ForwardToInboxOutlinedIcon from "@mui/icons-material/ForwardToInboxOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, bodyCell, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { HubRun } from "@/lib/connectors/steps/run";
import People from "./People";

type Move = { ticket: string; from?: string; to?: string; reason?: string; subject?: string };
type Data = {
  live: boolean; run: HubRun | null; preview: HubRun | null;
  running: { mode: string; started: string } | null; otherRunning: boolean; admin: boolean;
};

const num = (r: HubRun | null, k: string) => (typeof r?.result?.[k] === "number" ? (r.result[k] as number) : null);
const show = (n: number | null) => (n === null ? "—" : full(n));

function Rules() {
  const rule = (n: number, text: React.ReactNode) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 1, py: 0.6 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#e6edfd", color: "#2459d1", fontSize: "0.76rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</Box>
      <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<BeachAccessOutlinedIcon />} tint="blue" title="What it does" note="Every 15 minutes, on the ESO tickets in New, Redirected and Customer replied" />
      {rule(1, <>When a ticket&apos;s owner is <b>out of office</b> in HubSpot, the ticket goes to their <b>first deputy</b> who is in (the second deputy if the first is away too).</>)}
      {rule(2, <>A note <b>&quot;DEPUTY REASSIGNMENT&quot;</b> on the ticket says who it came from and why. A ticket in <i>Customer replied</i> goes back to <i>New</i>, so the deputy sees it.</>)}
      {rule(3, <>With absence hours set, only tickets from within the absence move. Without them, every ticket in those stages moves - as on the connector.</>)}
      {rule(4, <>Left alone: campaign tickets (erosion, pushes, lost leads, C2S problems, duplicates), and tickets whose owner has no deputy who is in.</>)}
    </GlassCard>
  );
}

function Moves({ run, label }: { run: HubRun | null; label: string }) {
  const moves = ((run?.result?.examples as Move[] | undefined) ?? []);
  const { slice, pager } = usePaged(moves, 10);
  if (!run) return <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No {label} yet.</Typography></GlassCard>;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1 }}>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          {run.finished ? `${label[0].toUpperCase()}${label.slice(1)} on ${when(run.finished)}` : `Running since ${when(run.started)}`}
          {run.mode === "preview" ? " - a test run writes nothing; these are the tickets it would move." : "."}
        </Typography>
        {run.error && <Typography sx={{ fontSize: "0.82rem", color: "#c5221f", mt: 0.5 }}>Failed: {run.error}</Typography>}
      </Box>
      {moves.length ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 560, tableLayout: "fixed" }}>
            <TableHead><TableRow>
              <TableCell sx={{ ...headCell, width: "55%" }}>Ticket</TableCell><TableCell sx={headCell}>Why it moved</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {slice.map((m) => (
                <TableRow key={m.ticket} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                    <a href={hsTicket(m.ticket)} target="_blank" rel="noreferrer" style={{ color: "#2459d1", textDecoration: "none" }}>{m.subject || `Ticket ${m.ticket}`}</a>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{m.reason ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No ticket {run.mode === "preview" ? "would move" : "moved"} - nobody with open tickets in those stages is away.</Typography></Box>}
      {pager}
    </GlassCard>
  );
}

function Board({ d, act, note }: { d: Data; act: (action: string) => void; note: string | null }) {
  const [view, setView] = useState<"run" | "preview">("run");
  const r = d.run;
  const failed = num(r, "failed") ?? 0;
  return (
    <>
      {note && <Info>{note}</Info>}
      {d.running && <Info>{d.running.mode === "preview" ? "A test run" : "A run"} is going on since {when(d.running.started)}.</Info>}
      {!d.live && <Notice tone="warn">Switched off - tickets of people who are away stay where they are until it is switched on again.</Notice>}
      {failed > 0 && <Notice tone="bad">{failed} ticket{failed === 1 ? "" : "s"} could not be moved in the last run.</Notice>}

      <GlassCard>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
          <Chip tint={d.live ? "green" : "slate"}>{d.live ? "On" : "Off"}</Chip>
          <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 220 }}>
            {d.live ? "Runs every 15 minutes in the hub." : "Off."} Last run: {r?.finished ? when(r.finished) : "none yet"}.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" disabled={!!d.running || d.otherRunning} onClick={() => act("preview")}>Test run</Button>
              {d.live
                ? <Button size="small" variant="outlined" color="warning" onClick={() => { if (confirm("Switch holiday redirection off? Tickets of people who are away are no longer moved.")) act("live-off"); }}>Switch off</Button>
                : <Button size="small" variant="contained" disableElevation onClick={() => { if (confirm("Switch holiday redirection on? It then moves tickets to deputies every 15 minutes.")) act("live-on"); }}>Switch on</Button>}
            </Box>
          )}
        </Box>
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<BeachAccessOutlinedIcon />} tint="blue" label="Open ESO tickets checked" value={show(num(r, "scanned"))} note="last run" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ForwardToInboxOutlinedIcon />} tint="amber" label="Moved to a deputy" value={show(num(r, "moved"))} note="last run" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ScheduleOutlinedIcon />} tint="slate" label="From before the absence" value={show(num(r, "older_than_absence"))} note="stay with the owner" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CampaignOutlinedIcon />} tint="purple" label="Campaign tickets" value={show(num(r, "system_kept"))} note="left alone" />
        </Grid>
      </Grid>

      <People />

      <Box sx={{ display: "grid", gap: 1.25 }}>
        <Choice value={view} onChange={setView} options={[{ key: "run", label: "Last run" }, { key: "preview", label: "Last test run" }]} />
        {view === "run" ? <Moves run={d.run} label="last run" /> : <Moves run={d.preview} label="last test run" />}
      </Box>

      <Rules />
    </>
  );
}

export default function HolidayRedirection() {
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const url = `/api/uc/holiday-redirection?n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const running = r?.state === "ok" ? r.data.running : null;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [running, tick]);
  const act = useCallback(async (action: string) => {
    setNote(null);
    const j = await fetch("/api/uc/holiday-redirection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      .then((x) => x.json()).catch(() => null);
    setNote(j?.ok ? j.data.note : j?.error ?? "Could not start.");
    setTimeout(() => setTick((n) => n + 1), 1500);
  }, []);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the last runs…" />;
  else if (r.state === "error") body = <UpstreamPanel source="Holiday redirection" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Holiday redirection" error="Not available" status={null} onRetry={() => setTick((n) => n + 1)} />;
  else body = <Board d={r.data} act={act} note={note} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Holiday redirection" subtitle="ESO tickets of people who are out of office go to their deputy - every 15 minutes" />
      {body}
    </Box>
  );
}
