"use client";

// DirectCut: the promises the shelf can no longer keep, and the Back Office ticket for them.
//
// 17.10.2026, after SARCLA used it: the page now says what already HAS a ticket, in the table, without
// being asked. He raised one, came back, and could not tell — "I've clicked earlier, has the ticket been
// created or not" — and had to run a rehearsal to find out. A screen that knows the answer should say it.
// With that visible, Rehearse had no job left ("only raise ticket stays"), so it is gone.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Link from "@mui/material/Link";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import type { RunReport } from "@/lib/directcut/tickets";
import { when, type BrokenWithTickets } from "./shared";

export default function ShortagesTab({ broken, isAdmin, onDone }: { broken: BrokenWithTickets; isAdmin: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<RunReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ticketed = broken.ticketed ?? {};
  const open = useMemo(() => broken.orders.filter((o) => !o.orderNo || !ticketed[o.orderNo]), [broken.orders, ticketed]);

  const raise = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/website/directcut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tickets", dry: false }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error ?? `HTTP ${res.status}`);
      else { setReport(j.data as RunReport); onDone(); }
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [onDone]);

  const none = broken.orders.length === 0;

  return (
    <GlassCard>
      <CardTitle
        icon={<ReportProblemOutlinedIcon fontSize="small" />}
        tint={none ? "green" : open.length ? "amber" : "blue"}
        title="Promises the shelf cannot keep"
        note={none
          ? `All ${full(broken.promisesChecked)} promise(s) still fit the shelf.`
          : `${full(broken.pieces)} piece(s) on ${broken.orders.length} order(s)` +
            (open.length ? ` · ${open.length} without a ticket` : " · all ticketed")}
      />

      {none ? (
        <Typography sx={{ fontSize: "0.86rem", color: GREEN }}>
          Every piece stock accepted can still be cut from what is on the shelf.
        </Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCell}>Order</TableCell>
                  <TableCell sx={headCell}>Article</TableCell>
                  <TableCell sx={headCell}>Size</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Promised</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Can be cut</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Cannot</TableCell>
                  <TableCell sx={headCell}>Accepted</TableCell>
                  <TableCell sx={headCell}>Ticket</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {broken.orders.flatMap((o) => o.lines.map((l, i) => {
                  const tid = o.orderNo ? ticketed[o.orderNo] : undefined;
                  return (
                    <TableRow key={`${o.orderNo ?? "none"}-${l.cutArticle}-${i}`} hover>
                      <TableCell sx={bodyCell}>
                        {i === 0 && (
                          <>
                            <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{o.erpNo || o.orderNo || "—"}</Typography>
                            {o.erpNo && o.orderNo && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>shop {o.orderNo}</Typography>}
                          </>
                        )}
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography sx={{ fontSize: "0.84rem", color: INK }}>{l.basisArticle}</Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...clip(240) }} title={l.basisName}>{l.basisName}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap" }}>{l.size} mm</Typography>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.qty}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: GREEN }}>{l.served}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: RED, fontWeight: 600 }}>{l.short}</TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(l.promisedAt)}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        {i === 0 && (tid
                          ? <Link href={hsTicket(tid)} target="_blank" rel="noreferrer" sx={{ fontSize: "0.8rem", color: GREEN, whiteSpace: "nowrap" }}>
                              raised · {tid}
                            </Link>
                          : <Typography sx={{ fontSize: "0.8rem", color: RED, whiteSpace: "nowrap" }}>none yet</Typography>)}
                      </TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </Box>

          {isAdmin && (
            <Box sx={{ mt: 2.5, display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="contained" size="small" color="error" disabled={busy || open.length === 0} onClick={raise}
                startIcon={busy ? <CircularProgress size={14} /> : <ConfirmationNumberOutlinedIcon fontSize="small" />}>
                {open.length === 0
                  ? "Every order has its ticket"
                  : `Raise the Back Office ticket${open.length > 1 ? "s" : ""}`}
              </Button>
            </Box>
          )}
        </>
      )}

      {err && <Typography sx={{ fontSize: "0.82rem", color: RED, mt: 2 }}>{err}</Typography>}

      {report && (
        <Box sx={{ mt: 2 }}>
          {report.outcomes.map((o, i) => (
            <Typography key={`${o.orderNo ?? "none"}-${i}`} sx={{ fontSize: "0.84rem", color: o.outcome === "error" ? RED : INK }}>
              {o.erpNo || o.orderNo || "—"} · {full(o.pieces)} piece(s) ·{" "}
              {o.outcome === "created" ? `ticket ${o.ticketId ?? "raised"}`
                : o.outcome === "exists" ? `already had ticket ${o.ticketId ?? ""}`.trim()
                : o.outcome === "no-order" ? "no order number to key a ticket on"
                : o.error ?? "failed"}
              {o.linkedTo && o.outcome === "created" && !o.linkedTo.company
                ? " — on no company, so its subject will come out blank" : ""}
            </Typography>
          ))}
        </Box>
      )}
    </GlassCard>
  );
}
