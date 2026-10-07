"use client";

// THE REVIEW QUEUE - ERP customers whose revenue arrived but who have no HubSpot
// company the connector could match. Their revenue is held, never written to a
// guess, and the connector never creates a company. Read-only here for now:
// resolving still happens on the old Data Transfer page until this step moves.

import { useState } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { full } from "@/app/charts/format";
import { GlassCard, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, ConnectorsPage, usePaged, when, type Snapshot } from "../parts";

type Show = "waiting" | "resolved" | "all";
const cell = { ...bodyCell, fontSize: "0.82rem" };

function Review({ s }: { s: Snapshot }) {
  const [show, setShow] = useState<Show>("waiting");
  const [q, setQ] = useState("");
  const all = s.review?.items ?? [];
  const rows = all.filter((i) => (show === "all" || (show === "resolved") === (i.status === "resolved")) && (!q || (i.un ?? "").includes(q.trim())));
  const { slice, pager, setPage } = usePaged(rows, 15);
  if (!s.review) return <Notice tone="warn">{s.stateError ?? "The review queue cannot be read yet."}</Notice>;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "grid", gap: 1.25 }}>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          Revenue from the ERP that matched no HubSpot company - held, never written to a guess. Largest first. Resolve them on the Data Transfer page until this step moves to the hub.
        </Typography>
        <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
          <Choice value={show} onChange={(k) => { setShow(k); setPage(0); }} options={[
            { key: "waiting", label: "Waiting", count: s.review.pending },
            { key: "resolved", label: "Resolved", count: s.review.resolved },
            { key: "all", label: "All", count: s.review.total },
          ]} />
          <TextField size="small" placeholder="Customer number" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            sx={{ ml: { md: "auto" }, minWidth: 200 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }} />
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 600 }}>
          <TableHead><TableRow>
            <TableCell sx={headCell}>Customer number</TableCell>
            <TableCell sx={headCell} align="right">Revenue €</TableCell>
            <TableCell sx={headCell}>Years</TableCell>
            <TableCell sx={headCell}>Status</TableCell>
            <TableCell sx={headCell}>Since</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {slice.map((i, n) => (
              <TableRow key={`${i.type}-${i.un}-${n}`} hover>
                <TableCell sx={{ ...cell, fontFamily: "monospace", color: INK }}>
                  {i.un}{i.resolved_un ? ` → ${i.resolved_un}` : ""}
                  {i.note ? <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontFamily: "inherit" }}>{i.note}</Typography> : null}
                </TableCell>
                <TableCell sx={cell} align="right">{i.revenue_eur !== undefined ? full(Math.round(i.revenue_eur)) : "—"}</TableCell>
                <TableCell sx={{ ...cell, color: MUTED }}>{(i.years ?? []).join(", ")}</TableCell>
                <TableCell sx={bodyCell}>{i.status === "resolved" ? <Chip tint="green">Resolved</Chip> : <Chip tint="amber">Waiting</Chip>}</TableCell>
                <TableCell sx={{ ...cell, color: MUTED, whiteSpace: "nowrap" }}>{i.ts ? when(i.ts) : "—"}</TableCell>
              </TableRow>
            ))}
            {!slice.length && (
              <TableRow><TableCell colSpan={5} sx={{ ...cell, color: MUTED, py: 3, textAlign: "center" }}>
                {show === "waiting" && !q ? "Nothing waiting - every ERP customer with revenue has a company." : "No customer matches."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </GlassCard>
  );
}

export default function ReviewQueue() {
  return (
    <ConnectorsPage title="Review queue" subtitle="ERP customers with revenue but no HubSpot company - held until someone says which company they are">
      {(s) => <Review s={s} />}
    </ConnectorsPage>
  );
}
