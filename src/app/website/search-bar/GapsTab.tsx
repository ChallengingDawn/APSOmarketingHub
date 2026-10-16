"use client";

// Search bar > Gaps: searches the bar could not place - they went to the AI assistant, or the assistant failed
// too (the dashboard's "Search Gaps"). These are what to add: a synonym, a brand, a missing product.

import { useState } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import GpsNotFixedOutlinedIcon from "@mui/icons-material/GpsNotFixedOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { Gaps } from "@/lib/searchbar/gateway";
import { Empty, Loaded, Num, when } from "./shared";

type Win = "24h" | "7d" | "30d";

function GapTable({ g }: { g: Gaps }) {
  const rows = (g.gaps ?? []).slice().sort((a, b) => b.count - a.count);
  const { slice, pager } = usePaged(rows, 20);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 560 }}>
          <TableHead><TableRow>{["Search", "Times", "Why", "Language", "Last seen"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} sx={bodyCell}><Empty>No gaps in this period - every search found something.</Empty></TableCell></TableRow>}
            {slice.map((x, i) => (
              <TableRow key={`${x.query_norm}-${i}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, ...clip(360) }} title={x.query_norm}>{x.query_norm}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Num>{full(x.count)}</Num></TableCell>
                <TableCell sx={bodyCell}>{x.reason ? <Chip tint={/fail|error/.test(x.reason) ? "pink" : "amber"}>{x.reason.replace(/_/g, " ")}</Chip> : <Chip tint="purple">to the assistant</Chip>}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{x.locale ?? "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: FAINT }}>{when(x.last_seen)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function GapsTab() {
  const [win, setWin] = useState<Win>("7d");
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<GpsNotFixedOutlinedIcon />} tint="amber" title="Searches the bar could not place"
          note="They went to the AI assistant, or the assistant failed too. Each is a synonym, a brand or a product to add."
          right={<Choice<Win> value={win} onChange={setWin} options={[{ key: "24h", label: "24 hours" }, { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }]} />} />
      </Box>
      <Loaded<Gaps> url={`/api/website/search-bar?part=gaps&window=${win}`} what="the gaps">
        {(g) => <GapTable g={g} />}
      </Loaded>
    </GlassCard>
  );
}
