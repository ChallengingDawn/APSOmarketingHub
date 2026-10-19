"use client";

// BACK OFFICE DISTRIBUTION - what the tabs share: the data's shape, the figures, the ticket table and its detail.

import { Fragment, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { PersonRow, Row, RunInfo, Settings } from "@/lib/boDistribution/engine";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { Person, RosterKey } from "@/lib/boDistribution/rules";


export type ClassInfo = { category: string; keywords: number; sample: string[]; subs: { key: string; value: string; keywords: number; sample: string[] }[] }[];
export type Data = {
  settings: Settings; last: RunInfo | null; backfill: { from: number; cursor: number; done: boolean; startedAt: string } | null; everyMinutes: number;
  rows: Row[]; admin: boolean; legacy: Record<RosterKey, Person[]>; labels: Record<RosterKey, string>; deactivated: Person[]; classifier: ClassInfo;
  stages: { bo: { id: string; label: string }[]; gqs: { id: string; label: string }[] };
  fixes: { id: string; title: string; description: string }[];
  priorityTable: { key: string; category: string; sub: string | null; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }[];
  defaults: { hub: Settings["hub"]; priority: Settings["priority"] };
};
export type PeopleData = { people: PersonRow[]; owners: Person[]; at: string };
export type View = "overview" | "tickets" | "flow" | "detection" | "priority" | "people" | "gqs" | "settings";
export const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", flow: "#flow", detection: "#detection", priority: "#priority", people: "#people", gqs: "#gqs", settings: "#settings" };
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
export const STEP: Record<string, string> = {
  "23": "Assignment System - Maida, Sara, team", "27": "General Distribution", "42": "General Distribution, then ESO/TSA",
  "31": "Load Balancer", "50": "Task Status Report merge", "75": "Sales split to ESO",
};
export const CHAT_LABEL: Record<string, string> = { available: "Available", away: "Away" };
/** What the distribution step gave: its own write; a later DUPS hand-over is shown apart (19.10.2026). */
export const gave = (r: Row) => (r.actual ? { id: r.actual.distOwnerId ?? r.actual.ownerId, name: r.actual.distOwnerName ?? r.actual.ownerName } : null);
export const sameOwner = (r: Row) => !!r.actual && !!r.legacy && gave(r)!.id === r.legacy.ownerId;
export const fixesDiffer = (r: Row) => !!r.legacy && r.hub?.ownerId !== r.legacy.ownerId;

/* ── figures ── */

export function measure(rows: Row[]) {
  const bo = rows.filter((r) => r.pipeline === "bo"), gqs = rows.filter((r) => r.pipeline === "gqs");
  const owned = rows.filter((r) => r.legacy?.ownerId && r.actual);
  const live = owned.filter((r) => !r.approx), replay = owned.filter((r) => r.approx);
  const cat = rows.filter((r) => r.actual && r.route?.sets.enquiry_category);
  const prio = rows.filter((r) => r.actual && r.route?.sets.hs_ticket_priority);
  return {
    total: rows.length, bo: bo.length, gqs: gqs.length,
    live: live.length, liveSame: live.filter(sameOwner).length, replay: replay.length, replaySame: replay.filter(sameOwner).length,
    cat: cat.length, catSame: cat.filter((r) => r.route!.sets.enquiry_category === r.actual!.category).length,
    prio: prio.length, prioSame: prio.filter((r) => r.route!.sets.hs_ticket_priority === r.actual!.priority).length,
    fixes: rows.filter(fixesDiffer).length, noDistribution: rows.filter((r) => !r.legacy && !r.error).length, errors: rows.filter((r) => r.error).length,
  };
}
export const count = <T,>(xs: T[], key: (x: T) => string | null | undefined) => {
  const m = new Map<string, number>();
  for (const x of xs) { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
};

/* ── Tickets ── */

export function Detail({ r }: { r: Row }) {
  const line = (k: string, v: React.ReactNode) => <Box sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.25 }}><Box sx={{ color: MUTED, minWidth: 140 }}>{k}</Box><Box sx={{ color: INK }}>{v}</Box></Box>;
  const sets = r.route ? Object.entries(r.route.sets) : [];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {r.approx && line("Replayed", "availability and workload are today's - the owner comparison is only a rough one")}
      {r.error && line("Error", <span style={{ color: RED }}>{r.error}</span>)}
      {r.route && line("Path", r.route.path.join(" › ") + (r.route.assigner ? ` › ${STEP[r.route.assigner]}` : ""))}
      {r.route?.classified && line("Classifier", `${r.route.classified.category ?? "nothing recognised"}${r.route.classified.subCategory ? ` / ${r.route.classified.subCategory}` : ""}`)}
      {!!sets.length && line("Workflow sets", sets.map(([k, v]) => `${k.replace(/^enquiry_sub_category___/, "sub ").replace(/_+\d?$/, "")} = ${v}`).join(" · "))}
      {r.legacy && line("Copy", `${r.legacy.ownerName ?? "nobody"} - ${r.legacy.method}${r.legacy.reasons.length ? ` (${r.legacy.reasons.join("; ")})` : ""}`)}
      {r.hub && line("Hub", `${r.hub.ownerName ?? "nobody"} - ${r.hub.method}${r.hub.reasons.length ? ` (${r.hub.reasons.join("; ")})` : ""}`)}
      {r.note && line("Note", r.note)}
      {r.actual?.distOwnerName && line("Distribution gave", r.actual.distOwnerName)}
      {r.actual?.dupsOwnerName && line("Then DUPS", `handed it to ${r.actual.dupsOwnerName}${r.actual.dupsNote ? ` ${r.actual.dupsNote}` : ""} - an older ticket on the same order (Duplicates & merges)`)}
      {r.actual && line("HubSpot now", `${r.actual.ownerName ?? "nobody"}${r.actual.ownerSetBy ? ` (last set by ${r.actual.ownerSetBy})` : ""} · ${r.actual.category ?? "no category"}${r.actual.subCategory ? ` / ${r.actual.subCategory}` : ""} · priority ${r.actual.priority ?? "—"}${r.actual.dispatch ? ` · ${r.actual.dispatch}` : ""}`)}
    </Box>
  );
}
export function Verdict({ r }: { r: Row }) {
  if (r.error) return <Chip tint="pink">error</Chip>;
  if (!r.legacy) return <Chip tint="slate">no distribution</Chip>;
  if (!r.actual) return <Chip tint="slate">waiting</Chip>;
  return sameOwner(r) ? <Chip tint="green">same owner</Chip> : <Chip tint="amber">{r.approx ? "differs (rough)" : "differs"}</Chip>;
}
export function TicketTable({ rows, empty }: { rows: Row[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const { slice, pager } = usePaged(rows, 15);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Entered", "Ticket", "Path", "Distribution gave", "Copy gives", "Hub gives", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((r) => (
              <Fragment key={r.key}>
                <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.enteredAt)}{r.approx && <Box component="span" sx={{ ml: 0.5 }}><Chip tint="slate">replayed</Chip></Box>}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || r.ticketId}</Box>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.pipeline === "gqs" ? "GQS" : "Back Office"}{r.source ? ` · ${r.source}` : ""}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, ...clip(240) }}>{r.route ? (r.route.assigner ? STEP[r.route.assigner] : r.route.path[r.route.path.length - 1]) : r.pipeline === "gqs" ? (r.legacy?.method ?? "GQS") : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                    {r.actual ? gave(r)!.name ?? "nobody" : "…"}
                    {r.actual?.dupsOwnerName && r.actual.dupsOwnerId !== gave(r)!.id && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>then DUPS → {r.actual.dupsOwnerName}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.legacy?.ownerName ?? "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: fixesDiffer(r) ? 700 : 400 }}>{r.hub?.ownerName ?? "—"}</TableCell>
                  <TableCell sx={bodyCell}><Verdict r={r} /></TableCell>
                </TableRow>
                {open === r.key && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}><Detail r={r} /></TableCell></TableRow>}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{empty}</Typography>}
    </>
  );
}
