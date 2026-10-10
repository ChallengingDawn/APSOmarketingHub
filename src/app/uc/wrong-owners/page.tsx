"use client";

// WRONG OWNERS - a HubSpot app (UC & HubSpot Apps). An open support ticket whose owner
// belongs to another team goes to that team's pipeline, flagged until somebody takes it
// over or it is closed. It runs every 30 minutes in the hub. It used to run on the
// Compass connector's 30-minute loop only because that was the one always-on server -
// it has nothing to do with the ERP data (SARCLA, 10.10.2026).

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
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import OutlinedFlagIcon from "@mui/icons-material/OutlinedFlag";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, bodyCell, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { HubRun } from "@/lib/connectors/steps/run";

type Example = { action: "flag" | "restore"; id: string; from?: string; to?: string; reason?: string; why?: string; subject?: string };
type Data = {
  live: boolean; run: HubRun | null; preview: HubRun | null;
  running: { mode: string; started: string } | null; otherRunning: boolean; admin: boolean;
};

const RED = "#c5221f";
const num = (r: HubRun | null, k: string) => (typeof r?.result?.[k] === "number" ? (r.result[k] as number) : null);

function Rules() {
  const rule = (n: number, text: React.ReactNode) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 1, py: 0.6 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#fdf0e3", color: "#a96a12", fontSize: "0.76rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</Box>
      <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<ManageAccountsOutlinedIcon />} tint="amber" title="What it does" note="Every 30 minutes, on every open ticket in Back Office, ESO and TSA" />
      {rule(1, <>A ticket whose owner is from <b>ESO</b> or <b>TSA</b> goes to that team&apos;s pipeline (stage <i>Redirected</i>), with the same owner.</>)}
      {rule(2, <>A ticket in ESO or TSA whose owner is from <b>Back Office</b> goes back to Back Office and is given to Maida.</>)}
      {rule(3, <>The subject starts with <b>&quot;WRONG OWNER PLEASE CORRECT IT -&quot;</b> so the team sees it. The original subject comes back as soon as somebody else takes the ticket over, or it is closed.</>)}
      {rule(4, <>Left alone: closed tickets, campaign tickets, owners from Management or E-Commerce, and people who work in more than one team.</>)}
    </GlassCard>
  );
}

function Tickets({ run, label }: { run: HubRun | null; label: string }) {
  const ex = ((run?.result?.examples as Example[] | undefined) ?? []);
  const { slice, pager } = usePaged(ex, 10);
  if (!run) return <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No {label} yet.</Typography></GlassCard>;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1 }}>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          {run.finished ? `${label[0].toUpperCase()}${label.slice(1)} on ${when(run.finished)}` : `Running since ${when(run.started)}`}
          {run.mode === "preview" ? " - a test run writes nothing; these are the tickets it would change." : "."}
          {ex.length >= 20 ? " The first 20 of each kind are listed." : ""}
        </Typography>
        {run.error && <Typography sx={{ fontSize: "0.82rem", color: RED, mt: 0.5 }}>Failed: {run.error}</Typography>}
      </Box>
      {ex.length ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead><TableRow>
              <TableCell sx={headCell}>What happened</TableCell><TableCell sx={headCell}>Ticket</TableCell><TableCell sx={headCell}>Why</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {slice.map((x) => (
                <TableRow key={`${x.action}-${x.id}`} hover sx={{ verticalAlign: "top" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    {x.action === "flag" ? <Chip tint="amber">Moved {x.from} → {x.to}</Chip> : <Chip tint="green">Flag removed</Chip>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", maxWidth: 360 }}>
                    <a href={hsTicket(x.id)} target="_blank" rel="noreferrer" style={{ color: "#2459d1", textDecoration: "none" }}>{x.subject || `Ticket ${x.id}`}</a>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>
                    {x.action === "flag" ? x.reason : x.why === "closed" ? "The ticket is closed" : "Somebody else has taken it over"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No ticket {run.mode === "preview" ? "would be" : "was"} changed.</Typography></Box>}
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
      {!d.live && <Notice tone="warn">Switched off - no ticket is checked until it is switched on again.</Notice>}
      {failed > 0 && <Notice tone="bad">{failed} ticket{failed === 1 ? "" : "s"} could not be written in the last run.</Notice>}

      <GlassCard>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
          <Chip tint={d.live ? "green" : "slate"}>{d.live ? "On" : "Off"}</Chip>
          <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 220 }}>
            {d.live ? "Runs every 30 minutes in the hub." : "Off."} Last run: {r?.finished ? when(r.finished) : "none yet"}.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" disabled={!!d.running || d.otherRunning} onClick={() => act("preview")}>Test run</Button>
              {d.live
                ? <Button size="small" variant="outlined" color="warning" onClick={() => { if (confirm("Switch wrong owners off? Tickets are no longer moved or flagged.")) act("live-off"); }}>Switch off</Button>
                : <Button size="small" variant="contained" disableElevation onClick={() => { if (confirm("Switch wrong owners on? It then moves and flags tickets every 30 minutes.")) act("live-on"); }}>Switch on</Button>}
            </Box>
          )}
        </Box>
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ManageAccountsOutlinedIcon />} tint="blue" label="Open tickets checked" value={num(r, "tickets_open_or_flagged") === null ? "—" : full(num(r, "tickets_open_or_flagged"))} note="last run" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<FlagOutlinedIcon />} tint="amber" label="Moved and flagged" value={num(r, "flagged") === null ? "—" : full(num(r, "flagged"))} note="last run" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<OutlinedFlagIcon />} tint="green" label="Flags removed" value={num(r, "restored") === null ? "—" : full(num(r, "restored"))} note="taken over or closed" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CampaignOutlinedIcon />} tint="purple" label="Campaign tickets" value={num(r, "skipped_campaign") === null ? "—" : full(num(r, "skipped_campaign"))} note="left alone" />
        </Grid>
      </Grid>

      <Box sx={{ display: "grid", gap: 1.25 }}>
        <Choice value={view} onChange={setView} options={[{ key: "run", label: "Last run" }, { key: "preview", label: "Last test run" }]} />
        {view === "run" ? <Tickets run={d.run} label="last run" /> : <Tickets run={d.preview} label="last test run" />}
      </Box>

      <Rules />
    </>
  );
}

export default function WrongOwners() {
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const url = `/api/uc/wrong-owners?n=${tick}`;
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
    const j = await fetch("/api/uc/wrong-owners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      .then((x) => x.json()).catch(() => null);
    setNote(j?.ok ? j.data.note : j?.error ?? "Could not start.");
    setTimeout(() => setTick((n) => n + 1), 1500);
  }, []);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the last runs…" />;
  else if (r.state === "error") body = <UpstreamPanel source="Wrong owners" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Wrong owners" error="Not available" status={null} onRetry={() => setTick((n) => n + 1)} />;
  else body = <Board d={r.data} act={act} note={note} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Wrong owners" subtitle="Open tickets owned by someone from another team - moved to that team and flagged until it is corrected" />
      {body}
    </Box>
  );
}
