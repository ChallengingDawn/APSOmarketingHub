"use client";

// THE COMPASS CHAIN - every step of the connector in the order it runs: what it
// does, when, what it reads and writes, how it went last time, and where it is
// on its way into the hub. Then the files the ERP delivered, and the run history.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { STEPS, type Step } from "@/lib/connectors/compass";
import type { StepResult } from "@/lib/connectors/snapshot";
import { Chip, ConnectorsPage, Muted, PHASE, when, type Snapshot } from "../parts";

type TabId = "chain" | "files" | "history";
const TAB_HASH: Record<TabId, string> = { chain: "#chain", files: "#files", history: "#history" };

function StepRow({ n, step, last }: { n: number; step: Step; last: StepResult | undefined }) {
  const nums = last?.result ? Object.entries(last.result).filter(([, v]) => typeof v === "number" && v) .slice(0, 5) : [];
  return (
    <Box sx={{ py: 1.5, borderTop: n > 1 ? `1px solid ${HAIRLINE}` : "none" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED, width: 22 }}>{n}</Typography>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{step.name}</Typography>
        <Chip tint={PHASE[step.phase].tint}>{PHASE[step.phase].label}</Chip>
        {last && (last.error ? <Chip tint="pink">Failed last time</Chip> : <Chip tint="green">Done last time</Chip>)}
      </Box>
      <Box sx={{ pl: "30px", display: "grid", gap: 0.4 }}>
        <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.5 }}>{step.what}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}><b>When</b> {step.when} · <b>Reads</b> {step.reads}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
          <b>Writes</b> {step.writes.map((w) => `${w.object}: ${w.props.length} propert${w.props.length === 1 ? "y" : "ies"}`).join(" · ")}
          {step.associations?.length ? ` · ${step.associations.length} kind${step.associations.length > 1 ? "s" : ""} of association` : ""}
        </Typography>
        {last?.error && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f" }}>Last error: {last.error}</Typography>}
        {nums.length > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Last time: {nums.map(([k, v]) => `${k.replace(/_/g, " ")} ${full(v as number)}`).join(" · ")}</Typography>}
        {step.fix?.length ? (
          <Typography sx={{ fontSize: "0.78rem", color: "#a96a12" }}>To fix on the move: {step.fix.join(" · ")}</Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function Compass({ s }: { s: Snapshot }) {
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "chain");
  const proc = s.state?.sftp?.last_processing;
  const lastBy = new Map((proc?.processing ?? []).map((x) => [x.step, x]));
  const history = [...(s.state?.sftp?.history ?? [])].reverse();
  return (
    <>
      {s.stateError && <Notice tone="warn">{s.stateError}. The steps below come from the connector's code; their last results appear once it is readable.</Notice>}
      <Box>
        <ReportTabs name="compass" tab={tab} onSelect={selectTab} tabs={[
          { id: "chain", label: "The chain", count: String(STEPS.length) },
          { id: "files", label: "Files", count: proc?.pulled?.length ? String(proc.pulled.length) : null },
          { id: "history", label: "History", count: null },
        ]} />
      </Box>

      {tab === "chain" && (
        <GlassCard>
          <CardTitle icon={<SyncAltOutlinedIcon />} title="Every step, in the order it runs"
            note={`The connector checks the SFTP folder every 30 minutes and runs the steps whose file changed. Last run with new files: ${when(proc?.ts ?? null)}`} />
          {STEPS.map((x, i) => <StepRow key={x.key} n={i + 1} step={x} last={lastBy.get(x.key)} />)}
        </GlassCard>
      )}

      {tab === "files" && (
        <>
          <GlassCard>
            <CardTitle icon={<FolderOpenOutlinedIcon />} title="The last delivery" note={proc?.ts ? `Pulled from ${s.state?.sftp?.host ?? "the SFTP server"}${s.state?.sftp?.dir ?? ""} at ${when(proc.ts)}` : "No delivery recorded"} />
            {proc?.pulled?.length ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 520 }}>
                  <TableHead><TableRow>
                    <TableCell sx={headCell}>File on the server</TableCell><TableCell sx={headCell}>Saved as</TableCell><TableCell sx={headCell} align="right">MB</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {proc.pulled.map((f) => (
                      <TableRow key={f.remote}>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{f.remote}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontFamily: "monospace" }}>{f.as}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{f.mb}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : <Muted>Nothing pulled in the last run with files.</Muted>}
          </GlassCard>
          <GlassCard>
            <CardTitle icon={<FolderOpenOutlinedIcon />} tint="slate" title="Files the connector holds" note="What the steps read - the SFTP folder only keeps the latest delivery" />
            {s.files?.length ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 520 }}>
                  <TableHead><TableRow>
                    <TableCell sx={headCell}>File</TableCell><TableCell sx={headCell} align="right">MB</TableCell><TableCell sx={headCell}>Received</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {s.files.filter((f) => !f.name.endsWith(".part")).map((f) => (
                      <TableRow key={f.name}>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontFamily: "monospace" }}>{f.name}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{(f.size / 1048576).toFixed(1)}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{f.uploaded}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : <Muted>{s.files ? "No files." : "Not readable yet."}</Muted>}
          </GlassCard>
        </>
      )}

      {tab === "history" && (
        <GlassCard>
          <CardTitle icon={<HistoryOutlinedIcon />} title="The last checks of the SFTP folder" note="Every 30 minutes; a check that finds nothing new runs only the company and ticket sweeps" />
          {history.length ? (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 480 }}>
                <TableHead><TableRow>
                  <TableCell sx={headCell}>When</TableCell><TableCell sx={headCell} align="right">Files pulled</TableCell><TableCell sx={headCell} align="right">Steps run</TableCell><TableCell sx={headCell}>Error</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.ts}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{when(h.ts)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{h.pulled}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{h.steps}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: h.error ? "#c5221f" : MUTED }}>{h.error ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : <Muted>{s.stateError ? "Not readable yet." : "No checks recorded - the connector keeps only the latest one (a known fault, fixed on the move)."}</Muted>}
        </GlassCard>
      )}
    </>
  );
}

export default function CompassChain() {
  return (
    <ConnectorsPage title="Compass chain" subtitle="The ERP's files, step by step: what each part of the connector reads, writes, and how it went">
      {(s) => <Compass s={s} />}
    </ConnectorsPage>
  );
}
