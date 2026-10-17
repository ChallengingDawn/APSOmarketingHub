"use client";

// DirectCut: the shelf the widget is allowed to promise from.
//
// THE THREE NUMBERS ARE IN DIFFERENT UNITS, and mixing them is the mistake this table exists to prevent
// (found 15.10.2026 while auditing the stock logic). "On the shelf" and "Offered" are PLATE counts; "In a
// cart" and "Behind an order" are PIECES a customer asked for. One 2000x1000 plate yields fifty small
// pieces, so the pieces columns can and should exceed the plate columns — subtracting one from the other
// says nothing. The netting the middleware really does is fractional and by area.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { useMemo, useState } from "react";
import { usePaged } from "@/app/connectors/parts";
import { CardTitle, FAINT, GlassCard, INK, MUTED, bodyCell, headCell, clip } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import type { StockRow } from "./shared";

const num = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" as const, textAlign: "right" as const };

export default function ShelfTab({ stock }: { stock: StockRow[] }) {
  /* NO FILTER (SARCLA, 17.10.2026: "i dont want the shelf filter"). The rows that matter sort to the
     top on their own - most spoken for first, then the fullest shelf - so a pill row was a second way of
     doing what the order already does. */
  const shown = useMemo(() =>
    [...stock].sort((a, b) => (b.held + b.pinned) - (a.held + a.pinned) || b.offered - a.offered), [stock]);

  const { slice, pager } = usePaged(shown, 25);
  const offered = stock.reduce((s, a) => s + a.offered, 0);

  return (
    <GlassCard>
      <CardTitle
        icon={<Inventory2OutlinedIcon fontSize="small" />}
        tint="slate"
        title="The shelf"
        note={`${stock.length} article(s) with work on them · ${full(offered)} plate(s) the widget may currently offer`}
      />

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Article</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Plate sizes</TableCell>
              <Tooltip title="Plates HOMAG says are on the shelf, with its own allocations already taken off" placement="top">
                <TableCell sx={{ ...headCell, textAlign: "right" }}>On the shelf</TableCell>
              </Tooltip>
              <Tooltip title="Plates the widget may offer — the shelf net of our own holds" placement="top">
                <TableCell sx={{ ...headCell, textAlign: "right" }}>Offered</TableCell>
              </Tooltip>
              <Tooltip title="PIECES inside a live 30-minute cart window. A piece is not a plate" placement="top">
                <TableCell sx={{ ...headCell, textAlign: "right" }}>In a cart</TableCell>
              </Tooltip>
              <Tooltip title="PIECES behind an order that has not been cut yet" placement="top">
                <TableCell sx={{ ...headCell, textAlign: "right" }}>Behind an order</TableCell>
              </Tooltip>
              <Tooltip title="Pieces stock could not serve at all — these have to be produced" placement="top">
                <TableCell sx={{ ...headCell, textAlign: "right" }}>To make</TableCell>
              </Tooltip>
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((a) => (
              <TableRow key={a.basis} hover>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{a.basis}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: a.known ? MUTED : FAINT, ...clip(300) }} title={a.name}>
                    {a.name || "not a woodStore article"}
                    {a.thickness ? ` · ${a.thickness} mm` : ""}
                  </Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, ...num, color: MUTED }}>{a.plates || "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, ...num }}>{a.physical}</TableCell>
                <TableCell sx={{ ...bodyCell, ...num, fontWeight: 600 }}>{a.offered}</TableCell>
                <TableCell sx={{ ...bodyCell, ...num, color: a.held ? INK : FAINT }}>{a.held || "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, ...num, color: a.pinned ? INK : FAINT }}>{a.pinned || "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, ...num, color: a.produced ? INK : FAINT }}>{a.produced || "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 2 }}>
        The first four columns count PLATES; the last three count PIECES a customer ordered. One plate yields many
        pieces, so the pieces columns may be the larger ones — that is not an error, and the two must never be
        subtracted from one another.
      </Typography>
    </GlassCard>
  );
}
