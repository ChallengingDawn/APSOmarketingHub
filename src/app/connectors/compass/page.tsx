"use client";

// THE CHAIN - the Compass connector's steps in the order they run. One line per
// step: what it is, its group, where it runs, how it went last time. Click a
// step for the detail - what it reads and writes, what the move must fix, and
// for a step already ported: its preview in the hub and the switch.

import { Fragment, useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { full } from "@/app/charts/format";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GlassCard, HAIRLINE, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { GROUPS, STEPS, phaseOf, type Group, type Step } from "@/lib/connectors/compass";
import { stepResults, type StepMemo } from "@/lib/connectors/snapshot";
import type { HubRun } from "@/lib/connectors/steps/run";
import { Chip, Choice, ConnectorsPage, PHASE, usePaged, when, type Snapshot } from "../parts";

const GROUP_NAME = Object.fromEntries(GROUPS.map((g) => [g.key, g.name])) as Record<Group, string>;

type HubStepInfo = { key: string; live: boolean; connectorSkips: boolean | null; preview: HubRun | null; run: HubRun | null };
type StepsData = { steps: HubStepInfo[]; running: { key: string; mode: string; started: string } | null; connectorReachable: boolean };

/** The one number that says what a step did - the first non-zero count it reported. */
function headline(r: StepMemo | undefined): string {
  if (!r) return "not seen yet";
  if (r.error) return `Failed · ${when(r.at)}`;
  const n = Object.entries(r.result ?? {}).find(([, v]) => typeof v === "number" && v);
  return `${n ? `${n[0].replace(/_/g, " ")} ${full(n[1] as number)}` : "Done"} · ${when(r.at)}`;
}

/** A hub run in one line: when, and its counts. */
function runLine(r: HubRun | null | undefined): string {
  if (!r) return "never";
  if (!r.finished) return `running since ${when(r.started)}`;
  if (r.error) return `${when(r.finished)} - failed: ${r.error}`;
  const nums = Object.entries(r.result ?? {}).filter(([k, v]) => typeof v === "number" && k !== "seconds").map(([k, v]) => `${k.replace(/_/g, " ")} ${full(v as number)}`);
  return `${when(r.finished)} - ${nums.join(" · ")}`;
}

function HubPanel({ info, admin, busy, act }: { info: HubStepInfo; admin: boolean; busy: boolean; act: (key: string, action: string, fullRun?: boolean) => void }) {
  const status = info.live
    ? { tint: "green" as const, chip: "Live", text: "Runs in the hub, once a day - the connector no longer does" }
    : info.connectorSkips
      ? { tint: "amber" as const, chip: "Waiting for the switch", text: "The connector has let it go - switch it on here, or nobody runs it" }
      : { tint: "slate" as const, chip: "Preview", text: "Ported - preview only; the connector still runs it" };
  const examples = (info.preview?.result?.examples as unknown[] | undefined) ?? [];
  const canFull = info.key !== "mandant_sweep";
  return (
    <Box sx={{ mt: 1.25, p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>In the hub</Typography>
        <Chip tint={status.tint}>{status.chip}</Chip>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{status.text}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>Last preview</b> (writes nothing): {runLine(info.preview)}</Typography>
      {examples.length > 0 && (
        <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, fontFamily: "monospace", whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>
          {examples.slice(0, 5).map((e) => JSON.stringify(e)).join("\n")}
        </Typography>
      )}
      <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>Last live run</b>: {runLine(info.run)}</Typography>
      {admin && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => act(info.key, "preview")}>Preview in the hub</Button>
          {canFull && <Button size="small" variant="outlined" disabled={busy} onClick={() => act(info.key, "preview", true)}>Full preview</Button>}
          {!info.live && (
            <Button size="small" variant="contained" disableElevation disabled={busy || !info.connectorSkips}
              onClick={() => { if (confirm("Switch this step on in the hub? It then writes to HubSpot every day.")) act(info.key, "live-on"); }}>
              Switch on in the hub
            </Button>
          )}
          {info.live && <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => act(info.key, "live-off")}>Switch off in the hub</Button>}
        </Box>
      )}
    </Box>
  );
}

function Detail({ step, last, hub, admin, busy, act }: {
  step: Step; last: StepMemo | undefined; hub: HubStepInfo | undefined; admin: boolean; busy: boolean;
  act: (key: string, action: string, fullRun?: boolean) => void;
}) {
  const line = (label: string, text: React.ReactNode) => (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "110px minmax(0,1fr)" }, gap: { xs: 0, md: 1.5 }, py: 0.4 }}>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  );
  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1.5, bgcolor: "rgba(36,89,209,.03)" }}>
      {line("What it does", step.what)}
      {line("When", step.when)}
      {line("Reads", step.reads)}
      {step.writes.map((w, i) => <Fragment key={i}>{line("Writes", <><b>{w.object}</b>{w.how ? ` (${w.how})` : ""}: {w.props.join(", ")}</>)}</Fragment>)}
      {step.associations?.length ? line("Links", step.associations.join(" · ")) : null}
      {last?.error ? line("Last error", <span style={{ color: "#c5221f" }}>{last.error}</span>) : null}
      {step.fix?.length ? line("Fix on the move", <span style={{ color: "#a96a12" }}>{step.fix.join(" · ")}</span>) : null}
      {hub && <HubPanel info={hub} admin={admin} busy={busy} act={act} />}
    </Box>
  );
}

function Chain({ s }: { s: Snapshot }) {
  const lastBy = stepResults(s);
  const [group, setGroup] = useState<"all" | Group>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/me/access").then((r) => (r.ok ? r.json() : null)).then((j) => setAdmin(j?.role === "admin")).catch(() => {});
  }, []);
  const url = `/api/connectors/steps?n=${tick}`;
  const held = useHeld<StepsData>(url, [url]);
  const hubData = held.result?.state === "ok" ? held.result.data : null;
  const hubBy = new Map((hubData?.steps ?? []).map((x) => [x.key, x]));
  const live = new Set((hubData?.steps ?? []).filter((x) => x.live).map((x) => x.key));
  const running = hubData?.running ?? null;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [running, tick]);
  const act = useCallback(async (key: string, action: string, fullRun = false) => {
    setNote(null);
    const j = await fetch("/api/connectors/steps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, action, full: fullRun }) })
      .then((r) => r.json()).catch(() => null);
    setNote(j?.ok ? j.data.note : j?.error ?? "Could not start.");
    setTimeout(() => setTick((n) => n + 1), 1500);
  }, []);

  const rows = STEPS.map((x, i) => ({ step: x, n: i + 1 })).filter((r) => group === "all" || r.step.group === group);
  const { slice, pager, setPage } = usePaged(rows, 10);
  const pick = (g: "all" | Group) => { setGroup(g); setPage(0); setOpen(null); };
  return (
    <>
      {s.stateError && <Notice tone="warn">{s.stateError} - last results appear once it is readable.</Notice>}
      {note && <Notice tone="warn">{note}</Notice>}
      {running && <Notice tone="warn">{running.key} ({running.mode}) running in the hub since {when(running.started)}.</Notice>}
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
            The connector checks the ERP&apos;s SFTP folder every 30 minutes and runs the steps whose file changed. Click a step for what it reads and writes - and, once ported, its preview in the hub.
          </Typography>
          <Choice value={group} onChange={pick} options={[
            { key: "all", label: "All", count: STEPS.length },
            ...[...GROUPS].sort((a, b) => (a.order || 9) - (b.order || 9)).map((g) => ({ key: g.key, label: g.name, count: STEPS.filter((x) => x.group === g.key).length })),
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCell, width: 36 }}>#</TableCell>
                <TableCell sx={headCell}>Step</TableCell>
                <TableCell sx={headCell}>Group</TableCell>
                <TableCell sx={headCell}>Runs</TableCell>
                <TableCell sx={headCell}>Last time</TableCell>
                <TableCell sx={{ ...headCell, width: 36 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.map(({ step, n }) => {
                const last = lastBy.get(step.key);
                const isOpen = open === step.key;
                const phase = phaseOf(step, live);
                const hubRun = hubBy.get(step.key)?.run;
                return (
                  <Fragment key={step.key}>
                    <TableRow hover onClick={() => setOpen(isOpen ? null : step.key)} sx={{ cursor: "pointer", "& td": { borderBottom: isOpen ? "none" : undefined } }}>
                      <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.8rem" }}>{n}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.86rem", fontWeight: 600, color: INK }}>{step.name}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{GROUP_NAME[step.group]}</TableCell>
                      <TableCell sx={bodyCell}><Chip tint={PHASE[phase].tint}>{PHASE[phase].label}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: last?.error && phase !== "hub" ? "#c5221f" : MUTED, whiteSpace: "nowrap" }}>
                        {phase === "hub" ? (hubRun ? runLine(hubRun).slice(0, 60) : step.phase === "hub" ? "Runs in the hub - see its page" : "In the hub - no run yet") : headline(last)}
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, borderColor: HAIRLINE, borderBottom: isOpen ? undefined : "none" }}>
                        <Collapse in={isOpen} unmountOnExit>
                          <Detail step={step} last={last} hub={hubBy.get(step.key)} admin={admin} busy={!!running} act={act} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
      </GlassCard>
    </>
  );
}

export default function CompassChain() {
  return (
    <ConnectorsPage title="The chain" subtitle="The Compass connector's steps, in the order they run - click one for what it reads and writes">
      {(s) => <Chain s={s} />}
    </ConnectorsPage>
  );
}
