"use client";

// FILES & RUNS - what the ERP delivered to the SFTP folder, what the connector
// holds, and its last checks of the folder.

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { CardTitle, GlassCard, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { fileTime, lastDelivery } from "@/lib/connectors/snapshot";
import { Chip, ConnectorsPage, Muted, usePaged, when, type Snapshot } from "../parts";

const cell = { ...bodyCell, fontSize: "0.82rem" };

function Files({ s }: { s: Snapshot }) {
  const delivery = lastDelivery(s);
  const held = (s.files ?? []).filter((f) => !f.name.endsWith(".part")).sort((a, b) => (fileTime(b) ?? 0) - (fileTime(a) ?? 0));
  const latest = delivery.at ? held.filter((f) => delivery.at! - (fileTime(f) ?? 0) <= 3 * 3600) : [];
  const history = [...(s.state?.sftp?.history ?? [])].reverse();
  const heldP = usePaged(held, 10);
  const histP = usePaged(history, 10);
  return (
    <>
      {s.stateError && <Notice tone="warn">{s.stateError}.</Notice>}
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<CloudDownloadOutlinedIcon />} title="The last delivery"
            note={delivery.at ? `${delivery.files} file${delivery.files === 1 ? "" : "s"} from the ERP, the newest at ${when(delivery.at)}` : "No files received yet"}
            right={s.sftpFromHub ? <Chip tint={s.sftpFromHub.ok ? "green" : "amber"}>{s.sftpFromHub.ok ? "The hub reaches the server" : "The hub cannot reach the server"}</Chip> : undefined} />
        </Box>
        {latest.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 480 }}>
              <TableHead><TableRow>
                <TableCell sx={headCell}>File</TableCell><TableCell sx={headCell} align="right">MB</TableCell><TableCell sx={headCell}>Arrived</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {latest.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell sx={{ ...cell, fontFamily: "monospace" }}>{f.name}</TableCell>
                    <TableCell sx={cell} align="right">{(f.size / 1048576).toFixed(1)}</TableCell>
                    <TableCell sx={{ ...cell, color: MUTED }}>{when(fileTime(f))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Muted>{s.files ? "Nothing received yet." : "Not readable yet."}</Muted></Box>}
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<FolderOpenOutlinedIcon />} tint="slate" title={`Files the connector holds (${held.length})`} note="What the steps read - the SFTP folder keeps only the latest delivery" />
        </Box>
        {held.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 480 }}>
              <TableHead><TableRow>
                <TableCell sx={headCell}>File</TableCell><TableCell sx={headCell} align="right">MB</TableCell><TableCell sx={headCell}>Received</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {heldP.slice.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell sx={{ ...cell, fontFamily: "monospace" }}>{f.name}</TableCell>
                    <TableCell sx={cell} align="right">{(f.size / 1048576).toFixed(1)}</TableCell>
                    <TableCell sx={{ ...cell, color: MUTED }}>{when(fileTime(f))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Muted>{s.files ? "No files." : "Not readable yet."}</Muted></Box>}
        {heldP.pager}
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="purple" title="Checks of the SFTP folder" note="Every 30 minutes - a check with no new files only runs the company and ticket sweeps" />
        </Box>
        {history.length ? (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 420 }}>
              <TableHead><TableRow>
                <TableCell sx={headCell}>When</TableCell><TableCell sx={headCell} align="right">Files</TableCell><TableCell sx={headCell} align="right">Steps</TableCell><TableCell sx={headCell}>Result</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {histP.slice.map((h) => (
                  <TableRow key={h.ts}>
                    <TableCell sx={cell}>{when(h.ts)}</TableCell>
                    <TableCell sx={cell} align="right">{h.pulled}</TableCell>
                    <TableCell sx={cell} align="right">{h.steps}</TableCell>
                    <TableCell sx={cell}>{h.error ? <Chip tint="pink">{h.error.slice(0, 60)}</Chip> : <Chip tint="green">OK</Chip>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Muted>No checks recorded yet.</Muted></Box>}
        {histP.pager}
      </GlassCard>
    </>
  );
}

export default function FilesAndRuns() {
  return (
    <ConnectorsPage title="Files & runs" subtitle="What the ERP delivered, what the connector holds, and its checks of the folder">
      {(s) => <Files s={s} />}
    </ConnectorsPage>
  );
}
