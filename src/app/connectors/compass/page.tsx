"use client";

// THE CHAIN - what the hub does with each ERP delivery (the Compass sync), and nothing
// else: the last delivery and its run on top, then one line per Compass step with its
// last result. Click a step for what it reads and writes and, for an admin, a test run
// and its switch. HubSpot apps that only shared the connector's server (wrong owners,
// holiday redirection, erosion, segmentation) have their own pages (SARCLA, 10.10.2026).

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
import { GlassCard, HAIRLINE, INK, MUTED, Notice, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { GROUPS, STEPS, stepName, type Group, type Step } from "@/lib/connectors/compass";
import { exampleLine, summarize } from "@/lib/connectors/summary";
import type { HubRun } from "@/lib/connectors/steps/run";
import { Chip, Choice, ConnectorsPage, Info, usePaged, useHubSteps, when, type HubStepInfo, type Snapshot, type StepsData } from "../parts";

const RED = "#c5221f";
const RHYTHM: Record<string, string> = {
  chain: "with each ERP delivery",
  "30min": "every 30 minutes",
  "15min": "every 15 minutes",
  manual: "only when started by hand",
};

/** A run in plain words, without its time (the table has a column for that). */
function result(r: HubRun | null | undefined): { text: string; bad?: boolean } | null {
  if (!r) return null;
  if (!r.finished) return { text: "Running now" };
  if (r.error) return { text: `Failed: ${r.error}`, bad: true };
  return { text: summarize(r.result, r.mode === "live") };
}

/** Does the hub run this step right now? Switched on here, and let go by the connector. */
const runsHere = (i: HubStepInfo | undefined) => !!i?.live && i.connectorSkips !== false;

/** The last ERP delivery and what the hub did with it. */
function Delivery({ d }: { d: StepsData | null }) {
  const c = d?.chain;
  const mb = (c?.files ?? []).reduce((t, f) => t + f.mb, 0);
  const failed = (c?.steps ?? []).filter((x) => !x.ok);
  const chip = !c ? { tint: "slate" as const, text: "No run yet" }
    : c.status === "running" ? { tint: "blue" as const, text: `Running${c.step ? `: ${stepName(c.step)}` : ""}` }
      : c.status === "failed" || failed.length ? { tint: "pink" as const, text: c.status === "failed" ? "Failed" : "Done, with failures" }
        : { tint: "green" as const, text: "Done" };
  return (
    <GlassCard>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>Last ERP delivery</Typography>
        <Chip tint={chip.tint}>{chip.text}</Chip>
        {c && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{c.status === "running" ? "since" : "finished"} {when(c.ts)}</Typography>}
      </Box>
      {c && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5, mt: 1.5 }}>
          {[
            { v: String(c.pulled), l: "files received" },
            { v: mb ? `${Math.round(mb).toLocaleString("en-US")} MB` : "—", l: c.pullSeconds !== undefined ? `downloaded in ${c.pullSeconds} s` : "downloaded" },
            { v: String(c.steps.length), l: "steps run" },
            { v: String(failed.length), l: failed.length ? `failed: ${failed.map((x) => stepName(x.step)).join(", ")}` : "failed" },
          ].map((x) => (
            <Box key={x.l} sx={{ p: 1.25, borderRadius: "12px", bgcolor: TINT.slate.bg }}>
              <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{x.v}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{x.l}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {c?.status === "failed" && c.error && <Typography sx={{ fontSize: "0.82rem", color: RED, mt: 1 }}>{c.error}</Typography>}
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.25 }}>
        {d?.connectorPulls
          ? "The old connector reads the ERP's files at the moment (the backup) - the hub's ERP steps wait until it lets them go again."
          : "The hub checks the ERP's folder every 15 minutes and runs the steps as soon as a delivery is complete."}
      </Typography>
    </GlassCard>
  );
}

function StepPanel({ step, info, admin, busy, act }: { step: Step; info: HubStepInfo | undefined; admin: boolean; busy: boolean; act: (key: string, action: string) => void }) {
  const line = (label: string, text: React.ReactNode) => (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "110px minmax(0,1fr)" }, gap: { xs: 0, md: 1.5 }, py: 0.4 }}>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.5 }}>{text}</Typography>
    </Box>
  );
  const run = info?.run ?? null;
  const test = info?.preview ?? null;
  const r = result(run);
  const t = result(test);
  const examples = ((run?.result?.examples ?? test?.result?.examples) as unknown[] | undefined) ?? [];
  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1.5, bgcolor: "rgba(36,89,209,.03)" }}>
      {line("What it does", step.what)}
      {line("When", info?.cadence ? RHYTHM[info.cadence] ?? step.when : step.when)}
      {line("Reads", step.reads)}
      {step.writes.map((w, i) => <Fragment key={i}>{line("Writes", <><b>{w.object}</b>{w.how ? ` (${w.how})` : ""}: {w.props.join(", ")}</>)}</Fragment>)}
      {step.associations?.length ? line("Links", step.associations.join(" · ")) : null}
      {line("Last run", <span style={{ color: r?.bad ? RED : undefined }}>{r ? `${r.text} · ${when(run?.finished ?? run?.started)}` : "none yet"}</span>)}
      {test && t && line("Last test run", <span style={{ color: t.bad ? RED : MUTED }}>{t.text} · {when(test.finished ?? test.started)} (writes nothing)</span>)}
      {examples.length > 0 && line("Examples", (
        <Box sx={{ maxHeight: 130, overflow: "auto" }}>
          {examples.slice(0, 5).map((e, i) => <Typography key={i} sx={{ fontSize: "0.76rem", color: MUTED, overflowWrap: "anywhere" }}>{exampleLine(e)}</Typography>)}
        </Box>
      ))}
      {admin && info && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
          <Button size="small" variant="outlined" disabled={busy}
            onClick={() => { if (!info.file || confirm(`This test run downloads the ERP's files and reads ${info.file}. It writes nothing. Start now?`)) act(info.key, "preview"); }}>
            Test run
          </Button>
          {info.live
            ? <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => { if (confirm(`Switch "${step.name}" off? The hub stops writing it until it is switched on again.`)) act(info.key, "live-off"); }}>Switch off</Button>
            : <Button size="small" variant="contained" disableElevation disabled={busy || (!info.connectorSkips && info.cadence !== "manual")}
              onClick={() => { if (confirm(`Switch "${step.name}" on? The hub then writes it to HubSpot ${RHYTHM[info.cadence ?? ""] ?? ""}.`)) act(info.key, "live-on"); }}>Switch on</Button>}
        </Box>
      )}
    </Box>
  );
}

function Chain({ s }: { s: Snapshot }) {
  const [group, setGroup] = useState<"all" | Group>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/me/access").then((r) => (r.ok ? r.json() : null)).then((j) => setAdmin(j?.role === "admin")).catch(() => {});
  }, []);
  const d = useHubSteps(tick);
  const byKey = new Map((d?.steps ?? []).map((x) => [x.key, x]));
  const running = d?.running ?? null;
  const chainRunning = d?.chain?.status === "running";
  useEffect(() => {
    if (!running && !chainRunning) return;
    const t = setTimeout(() => setTick((n) => n + 1), 15_000);
    return () => clearTimeout(t);
  }, [running, chainRunning, tick]);
  const act = useCallback(async (key: string, action: string) => {
    setNote(null);
    const j = await fetch("/api/connectors/steps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, action }) })
      .then((r) => r.json()).catch(() => null);
    setNote(j?.ok ? j.data.note : j?.error ?? "Could not start.");
    setTimeout(() => setTick((n) => n + 1), 1500);
  }, []);
  // handed over by the connector but not switched on here - nobody runs them
  const waiting = (d?.steps ?? []).filter((x) => x.connectorSkips && !x.live && STEPS.some((st) => st.key === x.key));

  const rows = STEPS.map((x, i) => ({ step: x, n: i + 1 })).filter((r) => group === "all" || r.step.group === group);
  const { slice, pager, setPage } = usePaged(rows, 15);
  const pick = (g: "all" | Group) => { setGroup(g); setPage(0); setOpen(null); };
  const groups = [...GROUPS].sort((a, b) => a.order - b.order).filter((g) => STEPS.some((x) => x.group === g.key));
  return (
    <>
      {s.stateError && d?.connectorPulls && <Notice tone="warn">{s.stateError}</Notice>}
      {note && <Info>{note}</Info>}
      {running && <Info><b>{stepName(running.key)}</b>: {running.mode === "preview" ? "a test run (writes nothing)" : "running"}, started {when(running.started)}.</Info>}
      {waiting.length > 0 && (
        <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: TINT.amber.bg, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK, flex: 1, minWidth: 240 }}>
            <b>{waiting.length}</b> step{waiting.length === 1 ? " is" : "s are"} switched off here and nobody runs {waiting.length === 1 ? "it" : "them"}: {waiting.map((x) => stepName(x.key)).join(", ")}.
          </Typography>
          {admin && (
            <Button size="small" variant="contained" disableElevation disabled={!!running}
              onClick={() => { if (confirm(`Switch on ${waiting.length} steps? The hub then writes them to HubSpot.`)) act("", "live-on-all"); }}>
              Switch them all on
            </Button>
          )}
        </Box>
      )}
      <Delivery d={d} />
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5 }}>
          <Choice value={group} onChange={pick} options={[
            { key: "all", label: "All", count: STEPS.length },
            ...groups.map((g) => ({ key: g.key, label: g.name, count: STEPS.filter((x) => x.group === g.key).length })),
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640, tableLayout: "fixed" }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCell, width: 40 }}>#</TableCell>
                <TableCell sx={{ ...headCell, width: "34%" }}>Step</TableCell>
                <TableCell sx={headCell}>Last result</TableCell>
                <TableCell sx={{ ...headCell, width: 110 }}>When</TableCell>
                <TableCell sx={{ ...headCell, width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.map(({ step, n }) => {
                const info = byKey.get(step.key);
                const isOpen = open === step.key;
                const here = runsHere(info);
                const r = result(info?.run);
                const text = !info ? "—" : !here ? (info.live ? "The old connector runs it (backup)" : "Switched off") : r?.text ?? "Not run yet";
                const colour = r?.bad && here ? RED : info && !here ? "#a96a12" : INK;
                return (
                  <Fragment key={step.key}>
                    <TableRow hover onClick={() => setOpen(isOpen ? null : step.key)} sx={{ cursor: "pointer", "& td": { borderBottom: isOpen ? "none" : undefined } }}>
                      <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.8rem" }}>{n}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.86rem", fontWeight: 600, color: INK }}>{step.name}</TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography title={text} sx={{ fontSize: "0.82rem", color: colour, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</Typography>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{here && info?.run ? when(info.run.finished ?? info.run.started) : ""}</TableCell>
                      <TableCell sx={bodyCell}>
                        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ p: 0, borderColor: HAIRLINE, borderBottom: isOpen ? undefined : "none" }}>
                        <Collapse in={isOpen} unmountOnExit>
                          <StepPanel step={step} info={info} admin={admin} busy={!!running} act={act} />
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
    <ConnectorsPage title="The chain" subtitle="What the hub does with each ERP delivery, step by step - click one for what it reads and writes">
      {(s) => <Chain s={s} />}
    </ConnectorsPage>
  );
}
