"use client";

// Search bar > Report: what customers searched for in the period - the most searched texts with how often they
// found something, and the searches the bar handed to the AI assistant. (The dashboard's "Search Report",
// SARCLA's APSOboard KPIs: settled searches, typing prefixes deduplicated, QA sessions left out.)

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { full } from "@/app/charts/format";
import { AMBER, CardTitle, GREEN, GlassCard, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { usePaged } from "@/app/connectors/parts";
import type { Report, ReportRow } from "@/lib/searchbar/gateway";
import { Empty, Num } from "./shared";

function Rows({ rows, empty }: { rows: ReportRow[]; empty: string }) {
  const { slice, pager } = usePaged(rows, 15);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead><TableRow>{["Search", "Searches", "Found something", "To the AI", "Results on average", "Shop languages"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} sx={bodyCell}><Empty>{empty}</Empty></TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={r.query} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, ...clip(320) }} title={r.query}>{r.query}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Num>{full(r.searches)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: r.success_pct >= 80 ? GREEN : r.success_pct >= 40 ? AMBER : RED }}><Num>{r.success_pct}%</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Num>{full(r.ai_fallbacks)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Num>{full(r.avg_results)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", ...clip(260) }} title={r.locales}>{r.locales}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function ReportTab({ r, label }: { r: Report; label: string }) {
  const xlsx = `/api/website/search-bar?part=report-xlsx&days=${r.days}`;
  const [find, setFind] = useState("");
  const f = find.trim().toLowerCase();
  const top = f ? r.keywords_top.filter((x) => x.query.toLowerCase().includes(f)) : r.keywords_top;
  return (
    <>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<LeaderboardOutlinedIcon />} tint="blue" title="Most searched" note={`${label} · ${full(r.keywords_all_count)} different texts; the most frequent here`}
            right={<Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField size="small" placeholder="Find a search…" value={find} onChange={(e) => setFind(e.target.value)} sx={{ width: 220 }} />
              <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />} href={xlsx} sx={{ borderRadius: "999px", textTransform: "none", fontWeight: 600 }}>Excel</Button>
            </Box>} />
        </Box>
        <Rows rows={top} empty={f ? "No search with that text in the list." : "No searches in this period."} />
      </GlassCard>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<SmartToyOutlinedIcon />} tint="purple" title="Handed to the AI assistant" note={`${label} · searches the bar could not answer itself - the gaps to close first`} />
        </Box>
        <Rows rows={r.keywords_ai} empty="No search went to the assistant in this period." />
      </GlassCard>
    </>
  );
}
