"use client";

// THE CHAIN - the Compass connector's steps in the order they run. One line per
// step: what it is, its group, where it runs, how it went last time. Click a
// step for the detail - what it reads and writes, and what the move must fix.

import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { full } from "@/app/charts/format";
import { GlassCard, HAIRLINE, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { GROUPS, STEPS, type Group, type Step } from "@/lib/connectors/compass";
import { stepResults, type StepMemo } from "@/lib/connectors/snapshot";
import { Chip, Choice, ConnectorsPage, PHASE, usePaged, when, type Snapshot } from "../parts";

const GROUP_NAME = Object.fromEntries(GROUPS.map((g) => [g.key, g.name])) as Record<Group, string>;

/** The one number that says what a step did - the first non-zero count it reported. */
function headline(r: StepMemo | undefined): string {
  if (!r) return "not seen yet";
  if (r.error) return `Failed · ${when(r.at)}`;
  const n = Object.entries(r.result ?? {}).find(([, v]) => typeof v === "number" && v);
  return `${n ? `${n[0].replace(/_/g, " ")} ${full(n[1] as number)}` : "Done"} · ${when(r.at)}`;
}

function Detail({ step, last }: { step: Step; last: StepMemo | undefined }) {
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
      {step.writes.map((w) => line(`Writes`, <><b>{w.object}</b>{w.how ? ` (${w.how})` : ""}: {w.props.join(", ")}</>))}
      {step.associations?.length ? line("Links", step.associations.join(" · ")) : null}
      {last?.error ? line("Last error", <span style={{ color: "#c5221f" }}>{last.error}</span>) : null}
      {step.fix?.length ? line("Fix on the move", <span style={{ color: "#a96a12" }}>{step.fix.join(" · ")}</span>) : null}
    </Box>
  );
}

function Chain({ s }: { s: Snapshot }) {
  const lastBy = stepResults(s);
  const [group, setGroup] = useState<"all" | Group>("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = STEPS.map((x, i) => ({ step: x, n: i + 1 })).filter((r) => group === "all" || r.step.group === group);
  const { slice, pager, setPage } = usePaged(rows, 10);
  const pick = (g: "all" | Group) => { setGroup(g); setPage(0); setOpen(null); };
  return (
    <>
      {s.stateError && <Notice tone="warn">{s.stateError} - last results appear once it is readable.</Notice>}
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
            The connector checks the ERP's SFTP folder every 30 minutes and runs the steps whose file changed. Click a step for what it reads and writes.
          </Typography>
          <Choice value={group} onChange={pick} options={[
            { key: "all", label: "All", count: STEPS.length },
            ...GROUPS.sort((a, b) => (a.order || 9) - (b.order || 9)).map((g) => ({ key: g.key, label: g.name, count: STEPS.filter((x) => x.group === g.key).length })),
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
                return (
                  <Fragment key={step.key}>
                    <TableRow hover onClick={() => setOpen(isOpen ? null : step.key)} sx={{ cursor: "pointer", "& td": { borderBottom: isOpen ? "none" : undefined } }}>
                      <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.8rem" }}>{n}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.86rem", fontWeight: 600, color: INK }}>{step.name}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{GROUP_NAME[step.group]}</TableCell>
                      <TableCell sx={bodyCell}><Chip tint={PHASE[step.phase].tint}>{PHASE[step.phase].label}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: last?.error && step.phase !== "hub" ? "#c5221f" : MUTED, whiteSpace: "nowrap" }}>{step.phase === "hub" ? "Runs in the hub - see its page" : headline(last)}</TableCell>
                      <TableCell sx={bodyCell}>
                        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, borderColor: HAIRLINE, borderBottom: isOpen ? undefined : "none" }}>
                        <Collapse in={isOpen} unmountOnExit><Detail step={step} last={last} /></Collapse>
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
