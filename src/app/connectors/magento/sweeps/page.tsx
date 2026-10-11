"use client";

// SHOP ORDERS - SWEEPS. The sync looks at the shop every minute; most looks find nothing.
// Today in four numbers, the last sweep, and the list - by default only the sweeps that
// found or wrote something or failed, as a minute-by-minute list of zeros says nothing.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { GlassCard, KpiTile, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "../../parts";
import { Pager, RUN_MODE, ShopPage, ts, type ShopCtx, type Status } from "../parts";
import type { Run, SweepFilter } from "@/lib/connectors/magento/sync";

type Data = { rows: Run[]; total: number; today: { sweeps: number; failed: number; found: number; written: number } };

const cell = { ...bodyCell, fontSize: "0.82rem" };

/** How long a sweep took, "4 s" / "1 min 20 s". */
function took(r: Run): string {
  if (!r.finished_at) return "—";
  const s = Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

function Sweeps({ s, ctx }: { s: Status; ctx: ShopCtx }) {
  const [filter, setFilter] = useState<SweepFilter>("busy");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filter]);
  const url = `/api/connectors/magento?view=sweeps&filter=${filter}&page=${page}&n=${ctx.tick}`;
  const held = useHeld<Data>(url, [url]);
  const d = held.result?.state === "ok" ? held.result.data : null;
  const t = d?.today;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ScheduleOutlinedIcon />} tint="blue" label="Sweeps today" value={t ? full(t.sweeps) : "—"} note="one a minute, by one copy of the hub" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ErrorOutlineIcon />} tint={t?.failed ? "pink" : "green"} label="Failed today" value={t ? full(t.failed) : "—"} note="a failed sweep waits 10 minutes" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ShoppingBagOutlinedIcon />} tint="green" label="Changed in the shop" value={t ? full(t.found) : "—"} note="orders the sweeps found today" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CloudUploadOutlinedIcon />} tint="green" label="Written today" value={t ? full(t.written) : "—"} note={s.mode === "active" ? "orders into HubSpot" : "the hub writes nothing yet"} />
        </Grid>
      </Grid>

      <Choice value={filter} onChange={setFilter} options={[
        { key: "busy", label: "Found or wrote something" },
        { key: "failed", label: "Failed" },
        { key: "all", label: "All" },
      ]} />

      <GlassCard sx={{ p: 0, pt: 1 }}>
        {held.result === null ? <LoadingPanel label="Reading the sweeps…" />
          : !d ? <Box sx={{ p: 2 }}><Notice tone="warn">The sweeps could not be read.</Notice></Box>
            : !d.rows.length ? <Typography sx={{ fontSize: "0.86rem", color: MUTED, p: 2 }}>{filter === "failed" ? "No sweep failed." : "No sweep yet."}</Typography>
              : (
                <>
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 760 }}>
                      <TableHead><TableRow>
                        <TableCell sx={headCell}>When</TableCell>
                        <TableCell sx={headCell}>Mode</TableCell>
                        <TableCell sx={headCell}>Read since</TableCell>
                        <TableCell sx={headCell} align="right">Changed in the shop</TableCell>
                        <TableCell sx={headCell} align="right">Written</TableCell>
                        <TableCell sx={headCell} align="right">Failed</TableCell>
                        <TableCell sx={headCell} align="right">Took</TableCell>
                        <TableCell sx={headCell}>Result</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {d.rows.map((r) => (
                          <TableRow key={r.id} sx={{ verticalAlign: "top" }}>
                            <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}>{when(ts(r.started_at))}</TableCell>
                            <TableCell sx={{ ...cell, color: MUTED }}>{RUN_MODE[r.mode] ?? r.mode}</TableCell>
                            <TableCell sx={{ ...cell, color: MUTED, whiteSpace: "nowrap" }}>{r.window_from ? when(ts(r.window_from)) : "—"}</TableCell>
                            <TableCell sx={cell} align="right">{full(r.orders_found)}</TableCell>
                            <TableCell sx={cell} align="right">{full(r.orders_written)}</TableCell>
                            <TableCell sx={cell} align="right">{full(r.errors)}</TableCell>
                            <TableCell sx={{ ...cell, color: MUTED, whiteSpace: "nowrap" }} align="right">{took(r)}</TableCell>
                            <TableCell sx={cell}>
                              {r.ok ? <Chip tint="green">OK</Chip> : <Chip tint="pink">{(r.error ?? "failed").slice(0, 70)}</Chip>}
                              {r.skus && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.25, fontFamily: "monospace", overflowWrap: "anywhere" }}>{r.skus}</Typography>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                  <Pager total={d.total} page={page} onPage={setPage} />
                </>
              )}
      </GlassCard>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
        Each sweep reads what the shop changed since the last good one (5 minutes overlap). A read back reads a whole week once, writing nothing.
      </Typography>
    </>
  );
}

export default function ShopOrdersSweeps() {
  return (
    <ShopPage title="Sweeps" subtitle="The minute-by-minute look at the shop, and what each one found">
      {(s, ctx) => <Sweeps s={s} ctx={ctx} />}
    </ShopPage>
  );
}
