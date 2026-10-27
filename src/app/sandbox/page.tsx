"use client";

// SANDBOX - the hub's door to the copies on Railway that people build in (SARCLA 26.10.2026: "a sandbox they operate
// via the hub directly as a front end for data pulling"). Each sandbox shows what waits in it - the reads its pages
// could not answer, the asks filed from the CLI - and the three buttons: Bring data, Bring requested data, Delete all.
// Nothing leaves the hub until somebody presses here; what is brought is coded (customers by their HubSpot number,
// colleagues as Owner <id>, customer money by a hidden factor) and leak-checked. Every press is in the log below.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, KpiTile, MUTED, Notice, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { SandboxCard, SandboxData } from "@/app/api/sandboxes/route";

type Action = "bring" | "bring-requested" | "delete-all";
const ACTION_LABEL: Record<string, string> = {
  bring: "Bring data", "bring-requested": "Bring requested data", "delete-all": "Delete all", open: "Opened", cli: "Let the CLI in",
};
const mono = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.8rem" } as const;

/** How to start building in this sandbox - the commands with its own address, for the CLI and Claude Code. */
function StartBuilding({ s }: { s: SandboxCard }) {
  const step = (n: number, body: React.ReactNode) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 1, py: 0.6 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#e9eef5", color: "#4a5a70", fontSize: "0.76rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</Box>
      <Typography component="div" sx={{ fontSize: "0.86rem", lineHeight: 1.6, minWidth: 0, overflowWrap: "anywhere" }}>{body}</Typography>
    </Box>
  );
  return (
    <Box>
      {step(1, <>On your computer: Node 22, Git, the Railway CLI (<Box component="code" sx={mono}>npm i -g @railway/cli</Box>) and Claude Code.</>)}
      {step(2, <>In an empty folder: <Box component="code" sx={mono}>curl -O {s.url}/sbx.mjs</Box>, then <Box component="code" sx={mono}>node sbx.mjs login</Box> - it shows a link to this page; confirm the code here.</>)}
      {step(3, <><Box component="code" sx={mono}>node sbx.mjs pull</Box>, <Box component="code" sx={mono}>npm install</Box>, then start Claude Code in that folder - its CLAUDE.md has the rules and the way of working.</>)}
    </Box>
  );
}

function Waiting({ s }: { s: SandboxCard }) {
  const [view, setView] = useState<"reads" | "asks" | "start">(s.reads.length || !s.asks.length ? "reads" : "asks");
  const reads = usePaged(s.reads, 10);
  const asks = usePaged(s.asks, 10);
  return (
    <Box sx={{ display: "grid", gap: 1.25, minWidth: 0 }}>
      <Choice value={view} onChange={setView} options={[
        { key: "reads", label: "Waiting reads", count: s.reads.length },
        { key: "asks", label: "Requested from the CLI", count: s.asks.length },
        { key: "start", label: "Start building" },
      ]} />
      {view === "start" ? <StartBuilding s={s} /> : view === "reads" ? (
        s.reads.length === 0 ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Every read of this sandbox's pages is here.</Typography> : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell sx={headCell}>Read</TableCell>
                <TableCell sx={headCell} title="When a page first needed it">Waiting since</TableCell>
                <TableCell sx={headCell} align="right" title="How often a page asked for it">Asked</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {reads.slice.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell sx={{ ...bodyCell, ...clip(520), fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.78rem" }} title={r.what}>{r.what}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{when(r.since)}</TableCell>
                    <TableCell sx={bodyCell} align="right">{full(r.hits)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {reads.pager}
          </Box>
        )
      ) : (
        s.asks.length === 0 ? <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing asked from the CLI.</Typography> : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell sx={headCell}>Ask</TableCell>
                <TableCell sx={headCell}>By</TableCell>
                <TableCell sx={headCell}>Why</TableCell>
                <TableCell sx={headCell}>Since</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {asks.slice.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell sx={{ ...bodyCell, ...clip(360), fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.78rem" }} title={a.what}>{a.what}</TableCell>
                    <TableCell sx={{ ...bodyCell, ...clip(180) }}>{a.by}</TableCell>
                    <TableCell sx={{ ...bodyCell, ...clip(320) }} title={a.reason}>{a.reason || "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{when(a.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {asks.pager}
          </Box>
        )
      )}
    </Box>
  );
}

function Sandbox({ s, canAct, act, open, busy, result }: {
  s: SandboxCard; canAct: boolean; busy: boolean; result: { line: string; bad: boolean } | null;
  act: (host: string, action: Action) => void; open: (host: string) => void;
}) {
  const st = s.state;
  return (
    <GlassCard>
      <CardTitle icon={<ScienceOutlinedIcon />} tint="slate" title={s.title}
        note={[s.people.filter((p) => p.role === "user").map((p) => p.name).join(", "), s.host].filter(Boolean).join(" · ")}
        right={<Button size="small" variant="contained" disableElevation disabled={busy} onClick={() => open(s.host)}>Open</Button>} />
      {s.error ? <Notice tone="bad">This sandbox does not answer: {s.error}</Notice> : (
        <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" } }}>
            <KpiTile icon={<HourglassEmptyOutlinedIcon />} tint="amber" label="Waiting reads" value={full(st?.missing ?? 0)} note="what its pages could not answer" />
            <KpiTile icon={<TerminalOutlinedIcon />} tint="purple" label="Requested" value={full(st?.asks ?? 0)} note="asks from the CLI" />
            <KpiTile icon={<Inventory2OutlinedIcon />} tint="green" label="Brought" value={full(st?.brought ?? 0)} note="reads it holds, coded" />
            <KpiTile icon={<BlockOutlinedIcon />} tint="pink" label="Refused" value={full(st?.refused ?? 0)} note="not served by the hub" />
          </Box>
          {canAct && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="contained" disableElevation disabled={busy || !s.reads.length} onClick={() => act(s.host, "bring")}>
                {busy ? "Working…" : `Bring data${s.reads.length ? ` (${s.reads.length})` : ""}`}
              </Button>
              <Button size="small" variant="outlined" disabled={busy || !s.asks.length} onClick={() => act(s.host, "bring-requested")}>
                Bring requested data{s.asks.length ? ` (${s.asks.length})` : ""}
              </Button>
              <Button size="small" variant="outlined" color="warning" disabled={busy}
                onClick={() => { if (confirm(`Delete all brought and test data in ${s.title}? Logins stay.`)) act(s.host, "delete-all"); }}>
                Delete all
              </Button>
            </Box>
          )}
          {result && (result.bad ? <Notice tone="warn">{result.line}</Notice> : <Info>{result.line}</Info>)}
          <Waiting key={s.host} s={s} />
        </Box>
      )}
    </GlassCard>
  );
}

function Activity({ d }: { d: SandboxData }) {
  const page = usePaged(d.activity, 10);
  if (!d.activity.length) return null;
  return (
    <GlassCard>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="blue" title="What was brought" note="Every press, by whom" />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell sx={headCell}>When</TableCell>
            <TableCell sx={headCell}>Who</TableCell>
            <TableCell sx={headCell}>Pressed</TableCell>
            <TableCell sx={headCell}>Result</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {page.slice.map((a, i) => (
              <TableRow key={`${a.at}-${i}`}>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{when(a.at)}</TableCell>
                <TableCell sx={{ ...bodyCell, ...clip(200) }}>{a.who}</TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{ACTION_LABEL[a.action] ?? a.action}</TableCell>
                <TableCell sx={{ ...bodyCell, ...clip(560) }} title={a.line}>{a.line}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {page.pager}
      </Box>
    </GlassCard>
  );
}

export default function SandboxPage() {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { line: string; bad: boolean }>>({});
  const url = `/api/sandboxes?n=${tick}`;
  const held = useHeld<SandboxData>(url, [url]);
  const r = held.result;

  const act = useCallback(async (host: string, action: Action) => {
    setBusy(host);
    const j = await fetch("/api/sandboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, action }) })
      .then((x) => x.json()).catch(() => ({ error: "The hub did not answer" }));
    setResults((prev) => ({ ...prev, [host]: j.ok ? { line: j.line, bad: (j.refused ?? 0) > 0 } : { line: j.error ?? "Did not work", bad: true } }));
    setBusy(null);
    setTick((n) => n + 1);
  }, []);

  // Open: a one-time way in, made on the hub for the person signed in here. The tab is opened at the click (a tab
  // opened after a fetch is a pop-up the browser blocks) and sent on once the ticket exists.
  const openIt = useCallback(async (host: string) => {
    const tab = window.open("about:blank", "_blank");
    const j = await fetch("/api/sandboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, action: "open" }) })
      .then((x) => x.json()).catch(() => ({ error: "The hub did not answer" }));
    if (j.ok && tab) tab.location.href = j.url;
    else { tab?.close(); setResults((prev) => ({ ...prev, [host]: { line: j.error ?? "Could not open it", bad: true } })); }
  }, []);

  // `sbx login` sends people here with ?cli=<sandbox>:<code>
  const [cli, setCli] = useState<{ host: string; code: string } | null>(null);
  const [cliNote, setCliNote] = useState<{ line: string; bad: boolean } | null>(null);
  useEffect(() => {
    // <sandbox host, a port included>:<code> - the code is always the last part
    const m = /^(.+):([A-Z2-9]{4}-[A-Z2-9]{4})$/.exec(new URLSearchParams(window.location.search).get("cli") ?? "");
    if (m) setCli({ host: m[1], code: m[2] });
  }, []);
  const confirmCli = useCallback(async () => {
    if (!cli) return;
    const j = await fetch("/api/sandboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: cli.host, action: "cli-approve", code: cli.code }) })
      .then((x) => x.json()).catch(() => ({ error: "The hub did not answer" }));
    setCliNote(j.ok ? { line: j.line, bad: false } : { line: j.error ?? "Did not work", bad: true });
    if (j.ok) { window.history.replaceState(null, "", "/sandbox"); setCli(null); setTick((n) => n + 1); }
  }, [cli]);

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Asking the sandboxes…" />;
  else if (r.state === "not-configured") body = <Notice tone="warn">No sandboxes are connected to the hub yet.</Notice>;
  else if (r.state === "error") body = <UpstreamPanel source="Sandboxes" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Sandboxes" error="Not available" status={null} onRetry={() => setTick((n) => n + 1)} />;
  else if (!r.data.sandboxes.length) body = <Info>No sandbox names you yet - ask for one to be set up.</Info>;
  else body = (
    <>
      {r.data.sandboxes.map((s) => (
        <Sandbox key={s.host} s={s} canAct={r.data.canAct} act={act} open={openIt} busy={busy === s.host} result={results[s.host] ?? null} />
      ))}
      <Activity d={r.data} />
    </>
  );
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Sandbox" subtitle="Coded data for the sandboxes - nothing leaves the hub until it is brought here" />
      {cli && (
        <GlassCard>
          <CardTitle icon={<TerminalOutlinedIcon />} tint="purple" title="Let the CLI in?"
            note={`${r?.state === "ok" ? r.data.sandboxes.find((x) => x.host === cli.host)?.title ?? cli.host : cli.host} - code ${cli.code}`} />
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 1.5 }}>Only confirm a code your own terminal shows right now.</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="contained" disableElevation onClick={confirmCli}>Let the CLI in</Button>
            <Button size="small" variant="outlined" onClick={() => { window.history.replaceState(null, "", "/sandbox"); setCli(null); }}>Not me</Button>
          </Box>
        </GlassCard>
      )}
      {cliNote && (cliNote.bad ? <Notice tone="warn">{cliNote.line}</Notice> : <Info>{cliNote.line}</Info>)}
      {body}
    </Box>
  );
}
