"use client";

// THE CHAIN - every Compass step in the order it runs, and who runs it today: the
// hub, or the old connector until the step is switched over. One line per step:
// its last result in plain words and the hub's last test run beside it. Click a
// step for what it reads and writes and, for an admin, the test run and the switch.

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
import { GlassCard, HAIRLINE, INK, MUTED, Notice, TINT, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { GROUPS, STEPS, phaseOf, progress, stepName, type Group, type Step } from "@/lib/connectors/compass";
import { stepResults, type StepMemo } from "@/lib/connectors/snapshot";
import { exampleLine, summarize } from "@/lib/connectors/summary";
import type { HubRun } from "@/lib/connectors/steps/run";
import { Chip, Choice, ConnectorsPage, Info, PHASE, usePaged, useHubSteps, when, type HubStepInfo, type Snapshot, type StepsData } from "../parts";

const RED = "#c5221f";

const RHYTHM: Record<string, string> = {
  chain: "after each ERP delivery",
  "30min": "every 30 minutes",
  "15min": "every 15 minutes",
  manual: "only when started by hand",
};

/** The connector's last result for a step, in plain words. */
function connectorLine(step: Step, r: StepMemo | undefined): { text: string; bad?: boolean } {
  if (!r) {
    if (step.key === "ticket_assoc") return { text: "Runs only by hand" };
    if (step.key === "deputy_sweep") return { text: "Runs every 15 minutes - the connector does not report it" };
    return { text: "No run recorded yet" };
  }
  if (r.error) return { text: `Failed · ${when(r.at)}`, bad: true };
  return { text: `${summarize(r.result, true)} · ${when(r.at)}` };
}

/** A run in the hub - test or live - in plain words. */
function hubLine(r: HubRun | null | undefined): { text: string; bad?: boolean } | null {
  if (!r) return null;
  if (!r.finished) return { text: `Running now - since ${when(r.started)}` };
  if (r.error) return { text: `Failed · ${when(r.finished)}: ${r.error}`, bad: true };
  return { text: `${summarize(r.result, r.mode === "live")} · ${when(r.finished)}` };
}

function Cell({ line, empty }: { line: { text: string; bad?: boolean } | null; empty: string }) {
  const text = line?.text ?? empty;
  return (
    <Typography title={text} sx={{ fontSize: "0.8rem", color: line?.bad ? RED : line ? INK : MUTED, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {text}
    </Typography>
  );
}

/** Who runs the steps today - the three counts, and who reads the ERP's files. */
function WhoRuns({ live, hub }: { live: Set<string>; hub: StepsData | null }) {
  const p = progress(live);
  const puller = hub?.connectorPulls === false ? "The hub" : "The connector";
  const c = hub?.chain;
  const stats: { n: number; tint: Tint; label: string; note: string }[] = [
    { n: p.hub, tint: "green", label: "Run by the hub", note: "Erosion and Smart Segmentation, and every step switched over" },
    { n: p.ready, tint: "purple", label: "Ready in the hub", note: "The connector still runs them - each moves after a matching test run and your go" },
    { n: p.connector, tint: "slate", label: "Connector only", note: "Not rebuilt in the hub yet" },
  ];
  return (
    <GlassCard>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" }, gap: 1.5 }}>
        {stats.map((x) => (
          <Box key={x.label} sx={{ p: 1.5, borderRadius: "14px", bgcolor: TINT[x.tint].bg }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: TINT[x.tint].fg, lineHeight: 1.1 }}>{x.n}</Typography>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{x.label}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>{x.note}</Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 1.5 }}>
        {puller} checks the ERP&apos;s SFTP folder every 30 minutes; a step that reads a file runs when its file changed.
        {c ? ` The hub's own chain: ${c.status === "done" ? "done" : c.status === "running" ? `running${c.step ? ` (${stepName(c.step)})` : ""}` : "failed"} · ${when(c.ts)}.` : ""}
      </Typography>
    </GlassCard>
  );
}

function HubPanel({ info, admin, busy, act, sftp }: { info: HubStepInfo; admin: boolean; busy: boolean; act: (key: string, action: string, fullRun?: boolean) => void; sftp: boolean }) {
  const noFiles = !!info.file && !sftp;
  const rhythm = RHYTHM[info.cadence ?? ""] ?? "";
  const status = info.live
    ? { tint: "green" as const, chip: "Live", text: `Runs in the hub ${rhythm} - the connector no longer does` }
    : info.connectorSkips
      ? { tint: "amber" as const, chip: "Waiting for the switch", text: "The connector has let it go - switch it on here, or nobody runs it" }
      : { tint: "purple" as const, chip: "Ready", text: "The connector still runs it. A test run here reads the same data and says what it would change - it writes nothing." };
  const examples = (info.preview?.result?.examples as unknown[] | undefined) ?? [];
  const canFull = info.key === "company_stats" || info.key === "contact_shipment";
  const test = hubLine(info.preview);
  const run = hubLine(info.run);
  return (
    <Box sx={{ mt: 1.25, p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>In the hub</Typography>
        <Chip tint={status.tint}>{status.chip}</Chip>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{status.text}</Typography>
      </Box>
      {noFiles && <Typography sx={{ fontSize: "0.8rem", color: "#a96a12" }}>Reads the ERP&apos;s {info.file} - the hub can test it once it holds the SFTP key.</Typography>}
      <Typography sx={{ fontSize: "0.8rem", color: test?.bad ? RED : INK }}><b>Last test run</b> (writes nothing): {test?.text ?? "none yet"}</Typography>
      {examples.length > 0 && (
        <Box sx={{ pl: 1.5, borderLeft: `2px solid ${HAIRLINE}`, maxHeight: 150, overflow: "auto" }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>Examples from the test run</Typography>
          {examples.slice(0, 5).map((e, i) => (
            <Typography key={i} sx={{ fontSize: "0.76rem", color: MUTED, overflowWrap: "anywhere" }}>{exampleLine(e)}</Typography>
          ))}
        </Box>
      )}
      {(info.live || run) && <Typography sx={{ fontSize: "0.8rem", color: run?.bad ? RED : INK }}><b>Last live run</b>: {run?.text ?? "none yet"}</Typography>}
      {admin && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
          <Button size="small" variant="outlined" disabled={busy || noFiles} onClick={() => act(info.key, "preview")}>Test run</Button>
          {canFull && <Button size="small" variant="outlined" disabled={busy} onClick={() => act(info.key, "preview", true)}>Full test run</Button>}
          {!info.live && (
            <Button size="small" variant="contained" disableElevation disabled={busy || noFiles || (!info.connectorSkips && info.cadence !== "manual")}
              onClick={() => { if (confirm(`Switch "${stepName(info.key)}" on in the hub? It then writes to HubSpot ${rhythm}.`)) act(info.key, "live-on"); }}>
              Switch on in the hub
            </Button>
          )}
          {info.live && <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => act(info.key, "live-off")}>Switch off in the hub</Button>}
        </Box>
      )}
    </Box>
  );
}

function Detail({ step, last, hub, admin, busy, act, sftp }: {
  step: Step; last: StepMemo | undefined; hub: HubStepInfo | undefined; admin: boolean; busy: boolean;
  act: (key: string, action: string, fullRun?: boolean) => void; sftp: boolean;
}) {
  const line = (label: string, text: React.ReactNode) => (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "120px minmax(0,1fr)" }, gap: { xs: 0, md: 1.5 }, py: 0.4 }}>
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
      {last?.error ? line("Last error", <span style={{ color: RED }}>{last.error}</span>) : null}
      {step.fix?.length ? line("Known issues", <span style={{ color: "#a96a12" }}>In the connector&apos;s code: {step.fix.join(" · ")}</span>) : null}
      {hub && <HubPanel info={hub} admin={admin} busy={busy} act={act} sftp={sftp} />}
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
  const hubData = useHubSteps(tick);
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
      {s.stateError && <Notice tone="warn">{s.stateError} - the connector&apos;s last results appear once it is readable.</Notice>}
      {note && <Info>{note}</Info>}
      {running && (
        <Info>
          <b>{stepName(running.key)}</b>: {running.mode === "preview" ? "a test run in the hub (writes nothing)" : "a live run in the hub"}, started {when(running.started)}.
        </Info>
      )}
      <WhoRuns live={live} hub={hubData} />
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5 }}>
          <Choice value={group} onChange={pick} options={[
            { key: "all", label: "All", count: STEPS.length },
            ...[...GROUPS].sort((a, b) => (a.order || 9) - (b.order || 9)).map((g) => ({ key: g.key, label: g.name, count: STEPS.filter((x) => x.group === g.key).length })),
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCell, width: 36 }}>#</TableCell>
                <TableCell sx={headCell}>Step</TableCell>
                <TableCell sx={headCell}>Runs in</TableCell>
                <TableCell sx={headCell}>Last result</TableCell>
                <TableCell sx={headCell}>Hub test run</TableCell>
                <TableCell sx={{ ...headCell, width: 36 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.map(({ step, n }) => {
                const last = lastBy.get(step.key);
                const isOpen = open === step.key;
                const phase = phaseOf(step, live);
                const info = hubBy.get(step.key);
                const result = phase === "hub"
                  ? hubLine(info?.run) ?? { text: step.phase === "hub" ? "Runs in the hub - see its own page" : "No run in the hub yet" }
                  : connectorLine(step, last);
                const test = info
                  ? hubLine(info.preview) ?? { text: info.file && !hubData?.sftpConfigured ? "Waits for the ERP files" : "Not tested yet" }
                  : null;
                return (
                  <Fragment key={step.key}>
                    <TableRow hover onClick={() => setOpen(isOpen ? null : step.key)} sx={{ cursor: "pointer", "& td": { borderBottom: isOpen ? "none" : undefined } }}>
                      <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.8rem" }}>{n}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.86rem", fontWeight: 600, color: INK }}>{step.name}</TableCell>
                      <TableCell sx={bodyCell}><span title={PHASE[phase].note}><Chip tint={PHASE[phase].tint}>{PHASE[phase].label}</Chip></span></TableCell>
                      <TableCell sx={bodyCell}><Cell line={result} empty="" /></TableCell>
                      <TableCell sx={bodyCell}><Cell line={test} empty={phase === "hub" ? "" : "—"} /></TableCell>
                      <TableCell sx={bodyCell}>
                        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, borderColor: HAIRLINE, borderBottom: isOpen ? undefined : "none" }}>
                        <Collapse in={isOpen} unmountOnExit>
                          <Detail step={step} last={last} hub={info} admin={admin} busy={!!running} act={act} sftp={!!hubData?.sftpConfigured} />
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
    <ConnectorsPage title="The chain" subtitle="Every Compass step in the order it runs, and who runs it today - click one for what it reads and writes">
      {(s) => <Chain s={s} />}
    </ConnectorsPage>
  );
}
