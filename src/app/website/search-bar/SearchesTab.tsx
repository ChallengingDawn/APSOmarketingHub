"use client";

// Search bar > Searches: the search log, newest first (the dashboard's "Search Logs"). Personal data is
// removed before a search is stored (e-mails, phone-like numbers, IDs of 12+ digits).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { LogRow } from "@/lib/searchbar/gateway";
import { Empty, Loaded, Num, tierLabel, when } from "./shared";

function LogTable({ rows }: { rows: LogRow[] }) {
  const [tier, setTier] = useState("all");
  const [loc, setLoc] = useState("all");
  const tiers = useMemo(() => [...new Set(rows.map((r) => r.tier))].sort(), [rows]);
  const locs = useMemo(() => [...new Set(rows.map((r) => r.locale))].sort(), [rows]);
  const shown = rows.filter((r) => (tier === "all" || r.tier === tier) && (loc === "all" || r.locale === loc));
  const { slice, pager } = usePaged(shown, 20);
  return (
    <>
      <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1, mb: 1.5 }}>
        <Choice value={tier} onChange={setTier} options={[{ key: "all", label: "Every answer", count: rows.length }, ...tiers.map((t) => ({ key: t, label: tierLabel(t), count: rows.filter((r) => r.tier === t).length }))]} />
        <Choice value={loc} onChange={setLoc} options={[{ key: "all", label: "Every language" }, ...locs.map((l) => ({ key: l, label: l, count: rows.filter((r) => r.locale === l).length }))]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead><TableRow>{["When", "Search", "Language", "Answered by", "Results", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {shown.length === 0 && <TableRow><TableCell colSpan={6} sx={bodyCell}><Empty>No search matches these filters.</Empty></TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={r.query_id} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: FAINT }}>{when(r.created_at, true)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, ...clip(340) }} title={r.query_raw}>{r.query_raw}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.locale}</TableCell>
                <TableCell sx={bodyCell}><Chip tint={r.tier === "assistant" ? "purple" : r.hit_count ? "blue" : "amber"}>{tierLabel(r.tier)}</Chip></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", color: r.hit_count ? undefined : RED }}><Num>{full(r.hit_count)}</Num></TableCell>
                <TableCell sx={bodyCell}>{(r.fallback_reason || r.degraded) && <Chip tint="amber">{(r.fallback_reason || "degraded").replace(/_/g, " ")}</Chip>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function SearchesTab() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Search log" note="The last 1,000 searches, newest first. Personal data (e-mails, phone numbers, long IDs) is removed before a search is kept."
          right={
            <Box component="form" onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }}>
              <TextField size="small" placeholder="Find a search… (Enter)" value={text} onChange={(e) => setText(e.target.value)} sx={{ width: 240 }} />
            </Box>
          } />
      </Box>
      <Loaded<LogRow[]> url={`/api/website/search-bar?part=logs&limit=1000${q ? `&q=${encodeURIComponent(q)}` : ""}`} what="the search log">
        {(rows) => <LogTable rows={Array.isArray(rows) ? rows : []} />}
      </Loaded>
    </GlassCard>
  );
}
