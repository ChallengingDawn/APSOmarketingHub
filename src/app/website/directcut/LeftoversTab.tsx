"use client";

// DirectCut: orders that are a leftover and nothing else, and the mail that tells AVOR to pack them.
//
// SARCLA, 17.10.2026. The rule lives in the middleware (every line a whole piece off the shelf; one line
// needing the saw disqualifies the order), the wording is Daniel Wieland's of 14.10, and the Lagerplatz
// comes from HOMAG's own inventory. This screen shows what would be sent and sends it.

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
import Collapse from "@mui/material/Collapse";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, Notice, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import type { Leftovers, MailReport, SentLog } from "@/lib/directcut/leftovers";
import { Pill, day, when } from "./shared";

export default function LeftoversTab({ data, isAdmin, onDone }:
  { data: Leftovers & { sent: SentLog; canMail: boolean }; isAdmin: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState<"" | "dry" | "live">("");
  const [report, setReport] = useState<MailReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState<string | null>(null);

  const run = useCallback(async (dry: boolean, erpNo?: string) => {
    setBusy(dry ? "dry" : "live"); setErr(null);
    try {
      const res = await fetch("/api/website/directcut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "avor", dry, erpNo }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error ?? `HTTP ${res.status}`);
      else { setReport(j.data as MailReport); if (!dry) onDone(); }
    } catch (e) { setErr(String((e as Error)?.message ?? e)); }
    finally { setBusy(""); }
  }, [onDone]);

  const sendable = data.orders.filter((o) => o.ready && o.erpNo && !data.sent[o.erpNo] && o.withLocation === o.lines.length);

  return (
    <GlassCard>
      <CardTitle
        icon={<Inventory2OutlinedIcon fontSize="small" />}
        tint={sendable.length ? "amber" : "green"}
        title="Leftovers to pack"
        note={`${full(data.ready)} ready · ${full(data.waiting)} waiting for the A-number`
          + (sendable.length ? ` · ${sendable.length} not yet told to AVOR` : "")}
      />

      {!data.canMail && <Notice tone="warn">The hub has no SMTP credentials, so nothing can be sent from here.</Notice>}

      {data.orders.length === 0 ? (
        <Typography sx={{ fontSize: "0.86rem", color: GREEN }}>No order is a leftover on its own right now.</Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCell}>Order</TableCell>
                  <TableCell sx={headCell}>Article</TableCell>
                  <TableCell sx={headCell}>Size</TableCell>
                  <TableCell sx={{ ...headCell, textAlign: "right" }}>Pieces</TableCell>
                  <TableCell sx={headCell}>Lagerplatz</TableCell>
                  <TableCell sx={headCell}>Promised</TableCell>
                  <TableCell sx={headCell}>AVOR</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.orders.flatMap((o) => o.lines.map((l, i) => {
                  const told = o.erpNo ? data.sent[o.erpNo] : undefined;
                  return (
                    <TableRow key={`${o.orderNo}-${l.key}`} hover>
                      <TableCell sx={bodyCell}>
                        {i === 0 && (<>
                          <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{o.erpNo || o.orderNo}</Typography>
                          {!o.ready && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>no A-number yet</Typography>}
                        </>)}
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography sx={{ fontSize: "0.84rem", color: INK }}>{l.cutArticle}</Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...clip(220) }} title={l.basisName}>{l.basisName || l.basis}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap" }}>
                          {l.l} × {l.w}{l.thickness ? ` × ${l.thickness}` : ""} mm
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.qty}</TableCell>
                      <TableCell sx={bodyCell}>
                        {l.location
                          ? <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>{l.location}</Typography>
                          : <Typography sx={{ fontSize: "0.8rem", color: RED }}>not on the feed</Typography>}
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        <Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{day(l.date)}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCell}>
                        {i === 0 && (told
                          ? <Pill text={`told ${when(told.at)}`} bg="#e9f4ed" fg="#1e7e45" />
                          : o.ready
                            ? <Pill text="not told" bg="#fdeaea" fg="#c5221f" />
                            : <Pill text="waiting" bg="#f2f2f4" fg="#5d6b85" />)}
                      </TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </Box>

          {/* what would actually be sent, in the words AVOR will read */}
          {sendable.map((o) => (
            <Box key={o.orderNo} sx={{ mt: 2 }}>
              <Button size="small" onClick={() => setShow(show === o.orderNo ? null : o.orderNo)} sx={{ fontSize: "0.78rem" }}>
                {show === o.orderNo ? "Hide" : "Show"} the mail for {o.erpNo}
              </Button>
              <Collapse in={show === o.orderNo}>
                <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: "#f7f8fa", border: "1px solid rgba(21,34,58,.10)" }}>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>To: {o.mail?.to} · Subject: {o.mail?.subject}</Typography>
                  <Typography component="pre" sx={{ fontSize: "0.82rem", color: INK, whiteSpace: "pre-wrap", m: 0, mt: 1, fontFamily: "inherit" }}>
                    {o.mail?.body}
                  </Typography>
                </Box>
              </Collapse>
            </Box>
          ))}

          {isAdmin && data.canMail && (
            <Box sx={{ mt: 2.5, display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="outlined" size="small" disabled={!!busy || !sendable.length} onClick={() => run(true)}
                startIcon={busy === "dry" ? <CircularProgress size={14} /> : undefined}>Rehearse</Button>
              <Button variant="contained" size="small" disabled={!!busy || !sendable.length} onClick={() => run(false)}
                startIcon={busy === "live" ? <CircularProgress size={14} /> : <MailOutlineIcon fontSize="small" />}>
                {sendable.length ? `Tell AVOR (${sendable.length})` : "Nothing to tell"}
              </Button>
              <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
                An order already told is never told twice. One without a Lagerplatz is held back.
              </Typography>
            </Box>
          )}
        </>
      )}

      {err && <Typography sx={{ fontSize: "0.82rem", color: RED, mt: 2 }}>{err}</Typography>}
      {report && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>
            {report.dry ? "Rehearsal — nothing was sent" : "Sent"}
          </Typography>
          {report.outcomes.map((o, i) => (
            <Typography key={i} sx={{ fontSize: "0.84rem", color: o.outcome === "error" ? RED : MUTED }}>
              {o.erpNo || o.orderNo} ·{" "}
              {o.outcome === "sent" ? (report.dry ? "would be told" : "told")
                : o.outcome === "already" ? "already told"
                : o.outcome === "no-location" ? "held back — no Lagerplatz on the feed"
                : o.outcome === "not-ready" ? "no A-number yet"
                : o.error ?? "failed"}
            </Typography>
          ))}
        </Box>
      )}
    </GlassCard>
  );
}
