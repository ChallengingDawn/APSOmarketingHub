"use client";

// FILES & RUNS - what the ERP delivered and what the hub did with it: the files of the
// last delivery (and how long they took to come down), each step of that run, and the
// hub's last look at the ERP's folder. The hub's own record - not the old connector's.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import PlaylistAddCheckOutlinedIcon from "@mui/icons-material/PlaylistAddCheckOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import { CardTitle, GlassCard, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { stepName } from "@/lib/connectors/compass";
import { Chip, ConnectorsPage, Muted, useHubSteps, when, type Snapshot } from "../parts";

const cell = { ...bodyCell, fontSize: "0.82rem" };

function Files({ s: _s }: { s: Snapshot }) {
  const d = useHubSteps();
  const c = d?.chain ?? null;
  const files = [...(c?.files ?? [])].sort((a, b) => b.mb - a.mb);
  const mb = files.reduce((t, f) => t + f.mb, 0);
  const pull = d?.pull ?? null;
  return (
    <>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<CloudDownloadOutlinedIcon />} title="The last delivery"
            note={c ? `${c.pulled} file${c.pulled === 1 ? "" : "s"} · ${Math.round(mb).toLocaleString("en-US")} MB${c.pullSeconds !== undefined ? ` · downloaded in ${c.pullSeconds} s` : ""} · ${when(c.ts)}` : "No delivery processed by the hub yet"} />
        </Box>
        {files.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 420 }}>
              <TableHead><TableRow>
                <TableCell sx={headCell}>File</TableCell><TableCell sx={headCell} align="right">MB</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell sx={{ ...cell, fontFamily: "monospace" }}>{f.name}</TableCell>
                    <TableCell sx={cell} align="right">{f.mb.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Muted>{c ? "The file list is kept from the next delivery on." : "Nothing yet."}</Muted></Box>}
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<PlaylistAddCheckOutlinedIcon />} tint="green" title="What the hub did with it"
            note={c ? `${c.status === "running" ? "Running" : c.status === "failed" ? "Failed" : "Done"} · ${when(c.ts)}` : "No run yet"} />
        </Box>
        {c?.steps.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 420 }}>
              <TableHead><TableRow>
                <TableCell sx={headCell}>Step</TableCell><TableCell sx={headCell}>Result</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {c.steps.map((x) => (
                  <TableRow key={x.step}>
                    <TableCell sx={cell}>{stepName(x.step)}</TableCell>
                    <TableCell sx={cell}>{x.ok ? <Chip tint="green">OK</Chip> : <Chip tint="pink">{(x.error ?? "failed").slice(0, 80)}</Chip>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Muted>{c?.status === "failed" && c.error ? c.error : "No steps recorded yet."}</Muted></Box>}
        {c?.status === "running" && c.step && <Box sx={{ px: { xs: 2, md: 2.75 }, py: 1.5 }}><Muted>Now running: {stepName(c.step)}</Muted></Box>}
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<FolderOpenOutlinedIcon />} tint="slate" title="The last look at the ERP's folder" note="Every 15 minutes; a look that finds nothing new runs nothing" />
        {pull ? (
          <Typography sx={{ fontSize: "0.84rem", color: pull.error ? "#c5221f" : MUTED }}>
            {when(pull.ts)} · {pull.error ? `failed: ${pull.error}` : pull.pulled.length ? `${pull.pulled.length} new file${pull.pulled.length === 1 ? "" : "s"}` : "nothing new"}
            {pull.incomplete?.length ? ` · still being written: ${pull.incomplete.join(", ")}` : ""}
          </Typography>
        ) : <Muted>{d?.connectorPulls ? "The old connector reads the folder at the moment (the backup)." : "No look recorded yet."}</Muted>}
      </GlassCard>
    </>
  );
}

export default function FilesAndRuns() {
  return (
    <ConnectorsPage title="Files & runs" subtitle="What the ERP delivered, and what the hub did with it">
      {(s) => <Files s={s} />}
    </ConnectorsPage>
  );
}
