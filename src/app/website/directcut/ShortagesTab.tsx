"use client";

// DirectCut: the promises the shelf can no longer keep, and the Back Office ticket for them.
//
// SARCLA, 17.10.2026: "if we cant keep it we need to create the ticket on back office as a fallback v1 but
// this time via the apsohub."
//
// This is the one page in the hub that can create a C2S ticket, and the ticket is a mail to a customer at
// one remove, so it is built to be looked at before it is used: REHEARSE reports exactly what it would do
// and writes nothing. The dedupe is the ticket's own c2s_problem_order, the property V1 wrote and which 68
// of its tickets still carry, so an order V1 already raised is never raised again.

import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, Notice, RED, bodyCell, headCell, clip } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import type { Broken, RunReport, TicketOutcome } from "@/lib/directcut/tickets";
import { Pill, when } from "./shared";

const OUTCOME: Record<string, { label: string; bg: string; fg: string }> = {
  created: { label: "ticket raised", bg: "#e9f4ed", fg: "#1e7e45" },
  exists: { label: "already has one", bg: "#eef2fb", fg: "#2459d1" },
  "no-order": { label: "no order number", bg: "#f4f1e8", fg: "#8a6d1f" },
  error: { label: "failed", bg: "#fdeaea", fg: "#c5221f" },
};

function Report({ r }: { r: RunReport }) {
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK, mb: 1 }}>
        {r.dry ? "Rehearsal — nothing was created" : "Run complete"}
      </Typography>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 1.5 }}>
        {r.checked} promise(s) checked · {r.broken} order(s) the shelf cannot cover ·{" "}
        {r.dry ? `${r.created} would be raised` : `${r.created} raised`} · {r.existing} already had a ticket
        {r.skipped ? ` · ${r.skipped} with no order number` : ""}
        {r.failed ? ` · ${r.failed} failed` : ""}
      </Typography>
      {r.outcomes.map((o: TicketOutcome, i: number) => {
        const t = OUTCOME[o.outcome] ?? OUTCOME.error;
        return (
          <Box key={`${o.orderNo ?? "none"}-${i}`} sx={{ display: "flex", gap: 1, alignItems: "baseline", py: 0.4, flexWrap: "wrap" }}>
            <Pill text={r.dry && o.outcome === "created" ? "would raise" : t.label} bg={t.bg} fg={t.fg} />
            <Typography sx={{ fontSize: "0.84rem", color: INK }}>{o.erpNo || o.orderNo || "—"}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
              {full(o.pieces)} piece(s) · {o.articles.join(", ")}
              {o.ticketId ? ` · ticket ${o.ticketId}` : ""}
            </Typography>
            {o.error && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{o.error}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

export default function ShortagesTab({ broken, isAdmin, onDone }: { broken: Broken; isAdmin: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState<"" | "dry" | "live">("");
  const [report, setReport] = useState<RunReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (dry: boolean) => {
    setBusy(dry ? "dry" : "live");
    setErr(null);
    try {
      const res = await fetch("/api/website/directcut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tickets", dry }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error ?? `HTTP ${res.status}`);
      else { setReport(j.data as RunReport); if (!dry) onDone(); }
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy("");
    }
  }, [onDone]);

  const none = broken.orders.length === 0;

  return (
    <GlassCard>
      <CardTitle
        icon={<ReportProblemOutlinedIcon fontSize="small" />}
        tint={none ? "green" : "amber"}
        title="Promises the shelf cannot keep"
        note={none
          ? `All ${full(broken.promisesChecked)} promise(s) across ${full(broken.articlesChecked)} article(s) still fit the shelf.`
          : `${full(broken.pieces)} piece(s) on ${broken.orders.length} order(s), from ${full(broken.promisesChecked)} promise(s) checked`}
      />

      {none ? (
        <Typography sx={{ fontSize: "0.86rem", color: GREEN }}>
          Nothing to raise. Every piece stock accepted can still be cut from what is on the shelf.
        </Typography>
      ) : (
        <>
          <Notice tone="bad">
            These pieces were accepted by stock and cannot be cut from the shelf as it stands. Nobody finds that
            out unless the Back Office is told — that is what the ticket is for.
          </Notice>

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCell}>Order</TableCell>
                  <TableCell sx={headCell}>Article</TableCell>
                  <TableCell sx={headCell}>Size</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Promised</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Can be cut</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Cannot</TableCell>
                  <TableCell sx={headCell}>Accepted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {broken.orders.flatMap((o) => o.lines.map((l, i) => (
                  <TableRow key={`${o.orderNo ?? "none"}-${l.cutArticle}-${i}`} hover>
                    <TableCell sx={bodyCell}>
                      {i === 0 && (
                        <>
                          <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{o.erpNo || o.orderNo || "—"}</Typography>
                          {o.erpNo && o.orderNo && (
                            <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>shop {o.orderNo}</Typography>
                          )}
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
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ mt: 2.5, display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            {isAdmin ? (
              <>
                <Button variant="outlined" size="small" disabled={!!busy} onClick={() => run(true)}
                  startIcon={busy === "dry" ? <CircularProgress size={14} /> : undefined}>
                  Rehearse
                </Button>
                <Button variant="contained" size="small" color="error" disabled={!!busy} onClick={() => run(false)}
                  startIcon={busy === "live" ? <CircularProgress size={14} /> : <ConfirmationNumberOutlinedIcon fontSize="small" />}>
                  Raise the Back Office ticket{broken.orders.length > 1 ? "s" : ""}
                </Button>
                <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
                  Rehearse writes nothing. An order that already has a ticket is never given a second one.
                </Typography>
              </>
            ) : (
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Admins raise these tickets.</Typography>
            )}
          </Box>
        </>
      )}

      {err && <Typography sx={{ fontSize: "0.82rem", color: RED, mt: 2 }}>{err}</Typography>}
      {report && <Report r={report} />}
    </GlassCard>
  );
}
