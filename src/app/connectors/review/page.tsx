"use client";

// THE REVIEW QUEUE - ERP customers whose revenue arrived but who have no HubSpot
// company the connector could match. Their revenue is held, never written to a
// guess, and the connector never creates a company. Read-only here for now:
// resolving still happens on the old Data Transfer page until this step moves.

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, ConnectorsPage, Muted, when, type Snapshot } from "../parts";

function Review({ s }: { s: Snapshot }) {
  if (!s.review) return <Notice tone="warn">{s.stateError ?? "The review queue cannot be read yet."}</Notice>;
  const items = s.review.items;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="amber" title={`${full(s.review.pending)} waiting · ${full(s.review.resolved)} resolved`}
          note="Revenue from the ERP that matched no HubSpot company - held, not written. Largest first. Resolve them on the Data Transfer page until this step moves to the hub" />
      </Box>
      {items.length ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead><TableRow>
              <TableCell sx={headCell}>Customer number</TableCell><TableCell sx={headCell}>Type</TableCell>
              <TableCell sx={headCell} align="right">Revenue €</TableCell><TableCell sx={headCell}>Years</TableCell>
              <TableCell sx={headCell}>Status</TableCell><TableCell sx={headCell}>Since</TableCell><TableCell sx={headCell}>Note</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {items.map((i, n) => (
                <TableRow key={`${i.type}-${i.un}-${n}`} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontFamily: "monospace", color: INK }}>{i.un}{i.resolved_un ? ` → ${i.resolved_un}` : ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{i.type ?? "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{i.revenue_eur !== undefined ? full(Math.round(i.revenue_eur)) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{(i.years ?? []).join(", ")}</TableCell>
                  <TableCell sx={bodyCell}>{i.status === "resolved" ? <Chip tint="green">Resolved</Chip> : <Chip tint="amber">Waiting</Chip>}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{i.ts ? when(i.ts) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{i.note ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Muted>Nothing waiting - every ERP customer with revenue has a company.</Muted></Box>}
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
