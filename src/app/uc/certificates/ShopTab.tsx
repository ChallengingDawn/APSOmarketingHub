"use client";

// CERTIFICATES > From the shop (SARCLA 06.11.2026: "would it be possible to detect the certificate via the magento order
// and auto create the ticket?"). Every shop order with the plastics declaration line (8001133004) of the last 30 days:
// its ERP order, which certificate (the shop's options or the ERP's comment), and its ticket - the Back Office's, the
// hub's, or the one the hub would create (Preview). The figures say how the hub compares with the Back Office.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { ShopRow } from "@/lib/certificates/shopIntake";
import { TicketLink, type Data } from "./shared";

const STATE: Record<ShopRow["state"], { label: string; tint: Tint }> = {
  "waiting-number": { label: "not in the ERP yet", tint: "slate" },
  "waiting-type": { label: "waiting for the certificate's name", tint: "amber" },
  would: { label: "the hub would create it", tint: "blue" },
  created: { label: "created by the hub", tint: "green" },
  "by-hand": { label: "made by the Back Office", tint: "purple" },
  cancelled: { label: "cancelled in the shop", tint: "slate" },
  "no-type": { label: "no certificate named - Back Office", tint: "pink" },
  failed: { label: "failed - tried again", tint: "pink" },
};
const hours = (a: string | null | undefined, b: string | null | undefined) => (a && b ? (Date.parse(b) - Date.parse(a)) / 3600_000 : null);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const span = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`);
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "-");

type F = "all" | ShopRow["state"] | "waiting";
export function ShopTab({ d }: { d: Data }) {
  const [f, setF] = useState<F>("all");
  const rows = d.shop;
  const hand = rows.filter((r) => r.state === "by-hand");
  const handLag = median(hand.map((r) => hours(r.orderedAt ?? r.seenAt, r.ticket?.at)).filter((x): x is number => x !== null && x >= 0));
  const ahead = hand.filter((r) => r.wouldAt && r.ticket && Date.parse(r.wouldAt) < Date.parse(r.ticket.at));
  const aheadBy = median(ahead.map((r) => hours(r.wouldAt, r.ticket!.at)!));
  const created = rows.filter((r) => r.state === "created");
  const waiting = rows.filter((r) => r.state === "waiting-number" || r.state === "waiting-type");
  const fromShop = rows.filter((r) => r.typeFrom === "shop").length;
  const fromErp = rows.filter((r) => r.typeFrom === "erp").length;
  const tests: Record<F, (r: ShopRow) => boolean> = {
    all: () => true, waiting: (r) => r.state === "waiting-number" || r.state === "waiting-type",
    "waiting-number": (r) => r.state === "waiting-number", "waiting-type": (r) => r.state === "waiting-type", would: (r) => r.state === "would",
    created: (r) => r.state === "created", "by-hand": (r) => r.state === "by-hand", cancelled: (r) => r.state === "cancelled", "no-type": (r) => r.state === "no-type", failed: (r) => r.state === "failed",
  };
  const shown = rows.filter(tests[f]);
  const { slice, pager } = usePaged(shown, 25);
  const mode = d.settings.shop;
  const chips: { key: F; label: string }[] = [
    { key: "all", label: "All" }, { key: "waiting", label: "Waiting" }, { key: "would", label: "Would create" }, { key: "created", label: "Created by the hub" },
    { key: "by-hand", label: "By the Back Office" }, { key: "no-type", label: "No certificate named" }, { key: "cancelled", label: "Cancelled" }, { key: "failed", label: "Failed" },
  ];
  return (
    <>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip tint={mode === "live" ? "green" : mode === "preview" ? "amber" : "slate"}>{mode === "live" ? `Live - creating since ${when(d.settings.shopFrom)}` : mode === "preview" ? "Preview - lists what it would create" : "Off"}</Chip>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          The shop&apos;s orders with the plastics declaration (8001133004), the last 30 days. Which certificate: the shop&apos;s order {full(fromShop)} times, the ERP&apos;s comment {full(fromErp)} times. The ERP&apos;s order file {d.erpRead ? `last read ${when(d.erpRead.at)}: ${full(d.erpRead.found)} orders asking for a declaration` : "not read yet"} ({full(d.erpRequests)} known). Switch it on the Settings tab.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<StorefrontOutlinedIcon />} tint="blue" label="Shop orders" value={full(rows.length)} note="with the declaration line, 30 days" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="purple" label="By the Back Office" value={full(hand.length)} note={`a ticket ${span(handLag)} after the order (median)`} /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<BoltOutlinedIcon />} tint="green" label={mode === "live" ? "Created by the hub" : "The hub was ready first"} value={full(mode === "live" ? created.length : ahead.length)} note={mode === "live" ? "tickets the hub made" : ahead.length ? `${span(aheadBy)} before the Back Office's ticket (median)` : "of the Back Office's tickets"} /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<HourglassEmptyOutlinedIcon />} tint="amber" label="Waiting" value={full(waiting.length)} note="for the ERP's number or the certificate's name" /></Grid>
        <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><KpiTile icon={<FactCheckOutlinedIcon />} tint="pink" label="No ticket at all" value={full(rows.filter((r) => r.state === "no-type").length)} note="no certificate named after 6 days" /></Grid>
      </Grid>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1 }}>
          <CardTitle icon={<StorefrontOutlinedIcon />} tint="blue" title="The shop's orders with the declaration" note="Newest first - its ERP order, the certificates, and its ticket" />
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {chips.map((c) => {
              const on = c.key === f;
              return (
                <Box key={c.key} component="button" type="button" onClick={() => setF(c.key)} sx={{
                  all: "unset", cursor: "pointer", px: 1.25, py: 0.4, borderRadius: "999px", fontSize: "0.8rem", fontWeight: on ? 700 : 500,
                  color: on ? "#fff" : INK, bgcolor: on ? INK : "rgba(255,255,255,.85)", border: `1px solid ${on ? INK : HAIRLINE}`, "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: 2 },
                }}>{c.label} <span style={{ opacity: 0.7 }}>{full(rows.filter(tests[c.key]).length)}</span></Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto", mt: 1 }}>
          <Table size="small">
            <TableHead><TableRow>{["Shop order", "ERP order", "Certificates", "Where it stands", "Ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {!shown.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>{rows.length ? "None here." : "None yet - the shop's orders with the line show here within 3 minutes of the shop sync seeing them."}</TableCell></TableRow>}
              {slice.map((r) => (
                <TableRow key={r.entity} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{r.web}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{day(r.orderedAt ?? r.seenAt)}{r.company || r.customer ? ` · ${r.company ?? r.customer}` : ""}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {r.a ?? "-"}{r.mandant ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.mandant}</Typography> : null}
                    {r.a && r.numberFrom && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>from {r.numberFrom === "shop" ? "the shop" : r.numberFrom === "ERP order" ? "the ERP's order" : "the web order"}</Typography>}
                    {!r.a && r.askedAt && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>shop asked {when(r.askedAt)}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    {r.certs?.length ? <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{[r.certs.join(", "), r.other].filter(Boolean).join(" · ")}</Typography> : <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>not known yet</Typography>}
                    {r.pos && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.pos}</Typography>}
                    {r.typeFrom && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>from {r.typeFrom === "erp" ? "the ERP's comment" : r.typeFrom === "ticket" ? "the Back Office's ticket" : "the shop's order"}</Typography>}
                    {!!r.shopOptions?.length && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>the shop&apos;s options: {r.shopOptions.join(" · ")}</Typography>}
                    {r.probeError && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>the shop&apos;s options could not be read: {r.probeError}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    <Chip tint={STATE[r.state].tint}>{STATE[r.state].label}</Chip>
                    {(r.error || r.why) && <Typography sx={{ fontSize: "0.72rem", color: r.error ? RED : MUTED, mt: 0.25 }}>{r.error ?? r.why}</Typography>}
                    {r.due && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>delivery {day(r.due)}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", minWidth: 220 }}>
                    {r.ticket ? (
                      <>
                        <TicketLink id={r.ticket.id} subject={r.ticket.subject ?? null} max={320} />
                        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
                          {r.ticket.by === "hub" ? "by the hub" : "by the Back Office"}, {when(r.ticket.at)}{r.ticket.by === "hand" && r.wouldAt ? ` · the hub was ready ${when(r.wouldAt)}` : ""}
                        </Typography>
                      </>
                    ) : r.would ? (
                      <>
                        <Typography sx={{ fontSize: "0.78rem", color: INK }}>{r.would.subject}</Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.would.avor ? "AVOR first (EC 1935/2004) - owner = the requester, next of the Back Office rotation" : "Back Office - next of the rotation"}</Typography>
                      </>
                    ) : <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>-</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}
