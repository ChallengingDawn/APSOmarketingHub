"use client";

// DUPLICATES & MERGES - a HubSpot app (UC & HubSpot Apps > HubSpot apps), in SHADOW MODE (SARCLA 18.10.2026: "DUPS and
// merge should be a separate app, and we should also improve that, exclude something"; then "really raw" - "features and
// measurement and how we can also improve it"). For every ticket entering Back Office "New" the hub looks for its
// duplicates as the DUPS workflow does ("copy"), and with the exclusions set here ("hub"), puts both next to what HubSpot
// wrote, and follows each ticket for 7 days to see whether people merged it. Nothing is written to HubSpot.
// Overview, Tickets, How it works, Improvements, Exclusions and Settings as UC tabs; figures from measure.ts.

import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
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
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, TRACK, bodyCell, clip, headCell, hsTicket, type Tint } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Backfill, RunInfo, Settings } from "@/lib/ticketDuplicates/engine";
import type { Exclusions } from "@/lib/ticketDuplicates/rules";
import { hsDuplicates, hsText, type MergeState, type Row } from "@/lib/ticketDuplicates/model";
import { SKIP, copyFound, hubDiffers, hubFound, type Agreement, type Count, type Measure, type Rate } from "@/lib/ticketDuplicates/measure";

type Data = { settings: Settings; last: RunInfo | null; backfill: Backfill | null; everyMinutes: number; days: number; rows: Row[]; totalRows: number; measure: Measure; admin: boolean };
type View = "overview" | "tickets" | "how" | "improvements" | "exclusions" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", tickets: "#tickets", how: "#how-it-works", improvements: "#improvements", exclusions: "#exclusions", settings: "#settings" };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const PIPES: { id: string; label: string }[] = [
  { id: "1726786777", label: "Back Office" }, { id: "1726599376", label: "ESO" }, { id: "1726599377", label: "TSA" },
  { id: "1726786775", label: "GQS" }, { id: "1553929403", label: "Special Prices" }, { id: "1737150687", label: "Product Management" },
];
const pipeLabel = (id: string | null | undefined) => PIPES.find((p) => p.id === id)?.label ?? (!id || id === "unknown" ? "unknown" : id === "not recorded" ? "not recorded" : `pipeline ${id}`);
/** Why the owner stayed (model.ts OwnerWhy), in words. */
const WHY: Record<string, string> = {
  erosion: "erosion ticket - stays with the sales rep",
  "flag-only": "flag only - the owner never changes",
  "no-open-recent": "no open duplicate from the 30 days before",
  "other-pipeline": "open duplicates only in another pipeline",
  "already-owner": "already with that person",
  deactivated: "that person is deactivated",
  unknown: "unknown",
  "not recorded": "checked before this was recorded",
};
const SKIPS: Record<string, string> = {
  certificates: "has been in Certificates", "erosion amount": "erosion amount known", "never-match subject": "subject never matched",
  "erosion without key": "erosion ticket without an erosion key", "no order key": "no order number", error: "could not be read", searched: "searched, nothing found",
};
const STATE: Record<MergeState, { label: string; tint: Tint }> = {
  merged: { label: "merged", tint: "green" }, closed: { label: "closed, not merged", tint: "slate" }, open: { label: "still open", tint: "amber" }, gone: { label: "deleted", tint: "pink" },
};
const dd = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const ids = (d: string[] | undefined) => (d?.length ? d.join(", ") : "none");
const owner = (r: Row, id: string | null | undefined) => (id ? r.ownerNames[String(id)] ?? String(id) : "—");
const small = { fontSize: "0.8rem" } as const;
const tickets = (n: number) => `${full(n)} ticket${n === 1 ? "" : "s"}`;

function Period({ days, onChange }: { days: number; onChange: (n: number) => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Tickets that entered</Typography>
      <Choice<"7" | "14" | "21"> value={String(days) as "7" | "14" | "21"} onChange={(k) => onChange(Number(k))} options={[
        { key: "7", label: "Last 7 days" }, { key: "14", label: "Last 14 days" }, { key: "21", label: "Last 21 days" },
      ]} />
    </Box>
  );
}

function ReplayLine({ b }: { b: Backfill | null }) {
  if (!b || b.done) return null;
  return (
    <Info>
      Replaying the last 7 days: {full(b.checked)} older tickets checked so far, now at tickets that entered {when(b.cursor ? new Date(b.cursor).toISOString() : null)}
      {" "}(25 every 3 minutes, oldest first). Replayed tickets are checked against the tickets of today - the owner at the check is today&apos;s owner, not the one at the time.
    </Info>
  );
}

// ---------------------------------------------------------------- Overview

function AgreementCard({ m }: { m: Measure }) {
  const cell = (a: number, b: number) => (
    <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      <b>{pct(a, b)}</b> <Box component="span" sx={{ color: FAINT, fontSize: "0.76rem" }}>{full(a)} of {full(b)}</Box>
    </TableCell>
  );
  const lines: [string, (a: Agreement) => [number, number]][] = [
    ["Duplicates, yes or no", (a) => [a.sameVerdict, a.compared]],
    ["The same duplicate tickets", (a) => [a.sameIds, a.bothFound]],
    ["The same owner hand-over", (a) => [a.sameOwner, a.ownerCompared]],
  ];
  const { live, backfill } = m.agreement;
  return (
    <GlassCard sx={{ height: "100%" }}>
      <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="green" title="The copy against HubSpot" note="Does the hub's copy of the workflow answer what the workflow wrote? Replayed tickets are checked against today's tickets, so they agree less" />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["", "Live", "Replayed"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {lines.map(([label, f]) => (
              <TableRow key={label}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{label}</TableCell>
                {cell(...f(live))}
                {cell(...f(backfill))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>Copy found duplicates, HubSpot did not</TableCell>
              <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{full(live.copyOnly)}</TableCell>
              <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{full(backfill.copyOnly)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>HubSpot found duplicates, the copy did not</TableCell>
              <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{full(live.hubspotOnly)}</TableCell>
              <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{full(backfill.hubspotOnly)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>The owner hand-over is compared from the workflow&apos;s own owner change on the ticket; tickets read before that was recorded are left out.</Typography>
    </GlassCard>
  );
}

function Overview({ d }: { d: Data }) {
  const m = d.measure;
  const p = m.merge.precision.copy;
  const kpis = [
    { label: "Tickets checked", value: full(m.totals.checked), note: `${full(m.totals.live)} live, ${full(m.totals.backfill)} replayed; ${full(m.totals.stopped)} stopped before the check`, icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const },
    { label: "Duplicates found", value: full(m.flags.copy), note: `HubSpot flagged ${full(m.flags.hubspot)}; with your exclusions ${full(m.flags.hub)}`, icon: <ContentCopyOutlinedIcon />, tint: "purple" as const },
    { label: "Same answer as HubSpot", value: pct(m.agreement.live.sameVerdict, m.agreement.live.compared), note: `live tickets, ${full(m.agreement.live.compared)} compared; replayed ${pct(m.agreement.backfill.sameVerdict, m.agreement.backfill.compared)}`, icon: <CompareArrowsOutlinedIcon />, tint: "green" as const },
    { label: "Owner handed over", value: full(m.owner.copy), note: `HubSpot ${full(m.owner.hubspot)}, with your exclusions ${full(m.owner.hub)}; ${full(m.owner.copyOtherPipeline)} from another pipeline`, icon: <PersonOutlineOutlinedIcon />, tint: "amber" as const },
    { label: "Merged by people", value: pct(p.merged, p.flagged), note: p.flagged ? `${full(p.merged)} of ${full(p.flagged)} flags followed for 7 days` : "The first figures come 7 days after the first flags", icon: <CallMergeOutlinedIcon />, tint: "pink" as const },
  ];
  const skips = m.skips.map((s) => ({ label: SKIPS[s.key] ?? s.key, value: s.count }));
  const pipes = m.pipelines.map((s) => ({ label: pipeLabel(s.key), value: s.count }));
  const people = m.owner.byPerson.filter((x) => x.copy + x.hub + x.hubspot).map((x) => ({ label: x.name, value: x.copy, secondary: `hub ${x.hub} · HubSpot ${x.hubspot}` }));
  return (
    <>
      <Info>
        Shadow mode - nothing is written to HubSpot. For each new Back Office ticket the hub searches its duplicates exactly as the DUPS workflow
        does (<b>copy</b>) and with your exclusions (<b>hub</b>), reads what HubSpot wrote, and reads the ticket again for 7 days to see whether
        people merged it. Merging stays a person&apos;s decision in HubSpot (&quot;Merge the tickets, I&apos;ve checked&quot;).
      </Info>
      <ReplayLine b={d.backfill} />
      <Grid container spacing={2}>
        {kpis.map((k) => <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} /></Grid>)}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="Tickets per day"
              caption="By the day they entered Back Office New: duplicates found by the copy, searched without a find, and not compared (stopped, no order number, never matched)."
              empty={!m.perDay.length ? "No ticket checked yet." : null}
              table={{ columns: ["Day", "With duplicates", "Searched, none found", "Not compared"], rows: m.perDay.map((x) => [dd(x.day), x.withDups, x.noDups, x.notCompared]), numeric: [1, 2, 3] }}
            >
              <StackedColumns data={m.perDay.map((x) => ({ x: x.day, withDups: x.withDups, noDups: x.noDups, notCompared: x.notCompared }))}
                parts={[{ key: "withDups", label: "With duplicates" }, { key: "noDups", label: "Searched, none found" }, { key: "notCompared", label: "Not compared" }]}
                height={230} format={(n) => full(n)} xFormat={dd} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame title="Why tickets were not compared" caption="Every ticket that never reached the search, and why." empty={!skips.length ? "Every ticket was searched." : null}
              table={{ columns: ["Why", "Tickets"], rows: skips.map((s) => [s.label, s.value]), numeric: [1] }}>
              <BarList rows={skips} format={(n) => full(n)} labelWidth={190} />
            </ChartFrame>
          </GlassCard>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame title="Where the duplicates sit" caption="The pipeline of each duplicate the copy found - the workflow searches every pipeline." empty={!pipes.length ? "No duplicate found yet." : null}
              table={{ columns: ["Pipeline", "Duplicates"], rows: pipes.map((s) => [s.label, s.value]), numeric: [1] }}>
              <BarList rows={pipes} format={(n) => full(n)} labelWidth={130} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame title="Owner hand-overs, by person" caption="Who the copy hands tickets to; beside it the hub (your exclusions) and what HubSpot did." empty={!people.length ? "Nobody handed a ticket yet." : null}
              table={{ columns: ["Person", "Copy", "Hub", "HubSpot"], rows: m.owner.byPerson.map((x) => [x.name, x.copy, x.hub, x.hubspot]), numeric: [1, 2, 3] }}>
              <BarList rows={people} format={(n) => full(n)} labelWidth={130} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}><AgreementCard m={m} /></Grid>
      </Grid>
    </>
  );
}

// ---------------------------------------------------------------- Tickets

type What = "found" | "differs" | "merged" | "never" | "nokey" | "all";

function MergeChip({ r }: { r: Row }) {
  if (r.merge) return <Chip tint={STATE[r.merge.state].tint}>{STATE[r.merge.state].label}{r.merge.final || r.merge.state === "merged" ? "" : " so far"}</Chip>;
  if (r.error || Date.now() - Date.parse(r.enteredAt) < 3600_000) return <Typography component="span" sx={{ ...small, color: FAINT }}>…</Typography>;
  return <Typography component="span" sx={{ ...small, color: FAINT }}>not read yet</Typography>;
}

function Detail({ r }: { r: Row }) {
  const dupIds = [...new Set([...(r.legacy?.duplicates ?? []), ...(r.hub?.duplicates ?? [])])];
  const line = (label: string, text: React.ReactNode) => <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>{label}</b> {text}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      {r.backfill && <Typography sx={{ ...small, color: MUTED }}>Replayed: checked against today&apos;s tickets - the owner at the check ({owner(r, r.ownerAtCheck)}) is today&apos;s owner, not the one at the time.</Typography>}
      {r.stopped && line("Stopped:", r.stopped)}
      {r.error && line("Error:", r.error)}
      {r.legacy && line("Copy:", <>{r.legacy.message}{r.legacy.skip ? ` (${r.legacy.skip})` : ""}{r.legacy.ownerChange ? ` - owner to ${owner(r, r.legacy.ownerChange.ownerId)} (owner of ticket ${r.legacy.ownerChange.fromTicket})` : r.ownerWhy?.legacy ? ` - owner unchanged: ${WHY[r.ownerWhy.legacy]}` : ""}</>)}
      {r.hub && line("Hub:", <>{r.hub.message}{r.hub.ownerChange ? ` - owner to ${owner(r, r.hub.ownerChange.ownerId)}` : r.ownerWhy?.hub ? ` - owner unchanged: ${WHY[r.ownerWhy.hub]}` : " - owner unchanged"}</>)}
      {r.actual && line("HubSpot:", <>{hsText(r) ?? "nothing written"}{r.actual.hsOwner ? ` - owner to ${owner(r, r.actual.hsOwner.ownerId)} at ${when(r.actual.hsOwner.at)}` : r.actual.hsOwner === null ? " - no owner change by the workflow" : ""} · owner now {r.actual.ownerAfterName ?? "—"} · read {when(r.actual.at)}</>)}
      {dupIds.length > 0 && (
        <Box sx={{ overflowX: "auto", mt: 0.5 }}>
          <Table size="small">
            <TableHead><TableRow>{["Duplicate", "Pipeline", "Created", "State", "Owner", "Found by"].map((h) => <TableCell key={h} sx={{ ...headCell, py: 0.5 }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {dupIds.map((id) => {
                const x = r.dups?.[id];
                const by = [r.legacy?.duplicates.includes(id) ? "copy" : null, r.hub?.duplicates.includes(id) ? "hub" : null, hsDuplicates(hsText(r)).includes(id) ? "HubSpot" : null].filter(Boolean).join(", ");
                return (
                  <TableRow key={id}>
                    <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>
                      <Box component="a" href={hsTicket(id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, display: "block", ...clip(320) }}>{x?.subject || id}</Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>{x ? pipeLabel(x.pipeline) : "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, py: 0.5, ...small, whiteSpace: "nowrap" }}>{x ? when(x.createdate) : "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>{x ? (x.closed ? "closed" : "open") : "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, py: 0.5, ...small }}>{x ? owner(r, x.owner) : "—"}</TableCell>
                    <TableCell sx={{ ...bodyCell, py: 0.5, ...small, color: MUTED }}>{by}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      {r.merge && line("Then:", <>
        {STATE[r.merge.state].label}
        {r.merge.state === "merged" ? ` - ${r.merge.into === r.ticketId ? `${ids(r.merge.with)} merged into this ticket` : `into ticket ${r.merge.into}`}${r.merge.at ? ` on ${when(r.merge.at)}` : ""}${r.merge.by ? ` by ${r.merge.by}` : ""}${r.merge.withFlagged ? " - with a flagged duplicate" : " - with a ticket nobody flagged"}` : ""}
        {` · read ${r.merge.checks} time${r.merge.checks === 1 ? "" : "s"}, last ${when(r.merge.checkedAt)}${r.merge.final ? " (final)" : ""}`}
      </>)}
      {r.later && line("Order number later:", <>{r.later.keys} (seen {when(r.later.at)}){r.later.wouldFind ? ` - the order-number search finds ${r.later.wouldFind.length ? ids(r.later.wouldFind) : "no duplicate"}` : ""}</>)}
    </Box>
  );
}

function TicketsTab({ d }: { d: Data }) {
  const [what, setWhat] = useState<What>("found");
  const [src, setSrc] = useState<"all" | "live" | "replayed">("all");
  const [open, setOpen] = useState<string | null>(null);
  const test: Record<What, (r: Row) => boolean> = {
    found: (r) => copyFound(r) || hubFound(r),
    differs: (r) => !!r.legacy && !r.stopped && hubDiffers(r),
    merged: (r) => r.merge?.state === "merged",
    never: (r) => copyFound(r) && !!r.merge?.final && (r.merge.state === "open" || r.merge.state === "closed"),
    nokey: (r) => r.legacy?.skip === SKIP.noKey,
    all: () => true,
  };
  const bySrc = d.rows.filter((r) => src === "all" || (src === "replayed" ? !!r.backfill : !r.backfill));
  const rows = bySrc.filter(test[what]);
  const { slice, pager } = usePaged(rows, 15);
  const count = (k: What) => bySrc.filter(test[k]).length;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket"
        note={`${d.totalRows > d.rows.length ? `The latest ${full(d.rows.length)} of ${full(d.totalRows)} tickets. ` : ""}${d.last ? `Last look ${when(d.last.at)}: ${full(d.last.read)} read, ${full(d.last.checked)} new, ${full(d.last.settled)} settled${d.last.backfilled ? `, ${full(d.last.backfilled)} replayed` : ""}${d.last.followed ? `, ${full(d.last.followed)} read again` : ""}${d.last.error ? ` - ${d.last.error}` : ""}` : "Not run yet"}`} />
      <Box sx={{ display: "grid", gap: 1, mb: 1.5 }}>
        <Choice<What> value={what} onChange={setWhat} options={[
          { key: "found", label: "With duplicates", count: count("found") },
          { key: "differs", label: "Exclusions change it", count: count("differs") },
          { key: "merged", label: "Merged by people", count: count("merged") },
          { key: "never", label: "Flagged, not merged after 7 days", count: count("never") },
          { key: "nokey", label: "No order number", count: count("nokey") },
          { key: "all", label: "All", count: bySrc.length },
        ]} />
        <Choice<"all" | "live" | "replayed"> value={src} onChange={setSrc} options={[
          { key: "all", label: "Live and replayed" }, { key: "live", label: "Live only" }, { key: "replayed", label: "Replayed only" },
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Entered", "Ticket", "Order", "Copy finds", "Hub finds", "HubSpot wrote", "Then", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((r) => (
              <Fragment key={r.key}>
                <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>{when(r.enteredAt)}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || r.ticketId}</Box>
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{r.keys || "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.stopped ? "—" : ids(r.legacy?.duplicates)}{r.legacy?.ownerChange ? ` → ${owner(r, r.legacy.ownerChange.ownerId)}` : ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{r.stopped ? "—" : ids(r.hub?.duplicates)}{r.hub?.ownerChange ? ` → ${owner(r, r.hub.ownerChange.ownerId)}` : ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, ...clip(240) }}>{r.actual ? hsText(r) ?? "nothing" : "…"}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><MergeChip r={r} /></TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    {r.backfill && <Chip tint="slate">replayed</Chip>}{" "}
                    {r.error ? <Chip tint="pink">error</Chip> : r.stopped ? <Chip tint="slate">skipped</Chip> : null}
                  </TableCell>
                </TableRow>
                {open === r.key && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}><Detail r={r} /></TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>Nothing here - tickets appear within {d.everyMinutes} minutes of entering Back Office &quot;New&quot;.</Typography>}
    </GlassCard>
  );
}

// ---------------------------------------------------------------- How it works

type Tone = "flow" | "out" | "found" | "owner" | "merge";
const TONE_TINT: Record<Tone, Tint> = { flow: "blue", out: "slate", found: "purple", owner: "amber", merge: "green" };

/** One step of the check: its number, what happens in a plain sentence, and how many tickets it applies to. */
function Step({ n, tone, title, text, count, of, unit, aside, last }: { n: number; tone: Tone; title: string; text: string; count: number; of: number; unit?: string; aside?: React.ReactNode; last?: boolean }) {
  const t = TINT[TONE_TINT[tone]];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", columnGap: 1.75 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: t.bg, color: t.fg, fontSize: "0.82rem", fontWeight: 700, flexShrink: 0 }}>{n}</Box>
        {!last && <Box sx={{ flex: 1, width: "2px", bgcolor: HAIRLINE, my: 0.5, minHeight: 18 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 2.25, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 650, color: INK }}>{title}</Typography>
          {tone === "out" && <Chip tint="slate">left out</Chip>}
        </Box>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45, mt: 0.25 }}>{text}</Typography>
        <Box sx={{ height: 6, borderRadius: 99, bgcolor: TRACK, mt: 0.9, maxWidth: 520, overflow: "hidden" }}>
          <Box sx={{ height: "100%", width: `${of ? Math.max(count ? 1.5 : 0, (count / of) * 100) : 0}%`, bgcolor: t.fg, opacity: 0.75, borderRadius: 99 }} />
        </Box>
        {aside && <Box sx={{ mt: 0.9 }}>{aside}</Box>}
      </Box>
      <Box sx={{ textAlign: "right", pt: 0.25 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(count)}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: FAINT, whiteSpace: "nowrap" }}>{n === 1 ? "tickets" : `${pct(count, of)} ${unit ?? "of all"}`}</Typography>
      </Box>
    </Box>
  );
}

const Reasons = ({ items, label }: { items: Count[]; label: (k: string) => string }) => (
  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
    {items.map((x) => <Chip key={x.key} tint="slate">{label(x.key)} · {full(x.count)}</Chip>)}
  </Box>
);

function HowTab({ d }: { d: Data }) {
  const m = d.measure, s = m.steps, all = s.entered;
  const fin = m.merge.precision.copy;
  const ex = d.settings.exclusions;
  return (
    <>
      <Info>
        The DUPS workflow, step by step, with how many of the {full(all)} tickets of the period each step applied to. The numbers are the
        copy&apos;s - what HubSpot does today; where your exclusions give a different number it says so.
      </Info>
      <GlassCard>
        <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="How a ticket is checked" note="From entering Back Office New to a merge by a person" />
        <Box sx={{ maxWidth: 900 }}>
          <Step n={1} tone="flow" title="A ticket enters Back Office “New”" count={all} of={all}
            text={`The workflow starts on every ticket that lands in Back Office New. The hub sees it within ${d.everyMinutes} minutes; replayed tickets come from the last 7 days.`} />
          <Step n={2} tone="out" title="Stopped before the check" count={s.stoppedCertificates + s.stoppedErosion} of={all}
            text="After 4 minutes the workflow stops for tickets that have been in Certificates, or that carry an erosion amount."
            aside={<Reasons items={[{ key: "Certificates", count: s.stoppedCertificates }, { key: "erosion amount", count: s.stoppedErosion }].filter((x) => x.count)} label={(k) => k} />} />
          <Step n={3} tone="out" title="Subject never matched" count={s.never} of={all}
            text={`Certificate requests, C2S problems and warning tickets (⚠) are never compared${ex.neverMatchTexts.length ? `; the hub also leaves out subjects with “${ex.neverMatchTexts.join("”, “")}”` : ""}.`} />
          <Step n={4} tone="out" title="Erosion ticket without an erosion key" count={s.erosionNoKey} of={all}
            text="Erosion tickets are only compared with each other, on their erosion key (customer, article and year). Without a key there is nothing to compare." />
          <Step n={5} tone="out" title="No order number" count={s.noKey} of={all}
            text="Without an order number like A26.123456 in the subject or in Order Number, there is nothing to look for."
            aside={m.noKey.later ? <Typography sx={{ fontSize: "0.8rem", color: INK }}>{full(m.noKey.later)} of them got an order number later{m.noKey.laterWouldFind ? `, and ${full(m.noKey.laterWouldFind)} of those have duplicates` : ""} - see Improvements.</Typography> : undefined} />
          <Step n={6} tone="flow" title="Searched" count={s.searched} of={all}
            text="The order number is looked up in Order Number and subject of all tickets, in every pipeline. When that finds nothing, the newest 1000 tickets are read as well." />
          <Step n={7} tone="found" title="Duplicates found" count={s.found} of={all}
            text={`At most 3 tickets about the same order: the same line, or one side without a line (.000 is the whole order). With your exclusions: ${full(s.hubFound)}.`} />
          <Step n={8} tone="owner" title="Owner handed over" count={s.ownerChanged} of={all}
            text={`The ticket goes to the owner of the oldest open duplicate created up to 30 days before - in any pipeline, never to a deactivated person. With your exclusions: ${full(s.hubOwnerChanged)}.`}
            aside={s.unchanged.length ? (
              <Box>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 0.5 }}>Duplicates found, owner unchanged ({full(s.found - s.ownerChanged)}):</Typography>
                <Reasons items={s.unchanged} label={(k) => WHY[k] ?? k} />
              </Box>
            ) : undefined} />
          <Step n={9} tone="merge" title="People decide" count={fin.merged} of={fin.flagged} unit="of the flags followed for 7 days" last
            text="The ticket gets “⚠️ POSSIBLE DUPLICATE”; a person merges it in HubSpot - or not. The hub reads every ticket again after an hour, daily, and at 7 days."
            aside={<Reasons items={[
              { key: "flags followed for 7 days", count: fin.flagged },
              { key: "merged", count: fin.merged },
              { key: "merged with the flagged duplicate itself", count: fin.mergedWithFlagged },
              { key: "merged although nobody flagged them", count: m.merge.unflaggedMerged },
            ]} label={(k) => k} />} />
        </Box>
        {s.errors > 0 && <Typography sx={{ fontSize: "0.8rem", color: RED, mt: 1.5 }}>{full(s.errors)} tickets could not be read - see Tickets.</Typography>}
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------- Improvements

type Status = { label: string; tint: Tint };
const ACTIVE: Status = { label: "Active in the hub", tint: "green" };
const IDEA: Status = { label: "Idea", tint: "purple" };
const WAIT: Status = { label: "Needs more data", tint: "slate" };

function Idea({ icon, tint, title, status, figure, effect, next }: { icon: React.ReactNode; tint: Tint; title: string; status: Status; figure: string; effect: React.ReactNode; next: string }) {
  return (
    <GlassCard sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardTitle icon={icon} tint={tint} title={title} right={<Chip tint={status.tint}>{status.label}</Chip>} />
      <Typography sx={{ fontSize: "1.45rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em", lineHeight: 1.15, mb: 0.75 }}>{figure}</Typography>
      <Typography component="div" sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.5 }}>{effect}</Typography>
      <Box sx={{ mt: "auto", pt: 1.5 }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45, borderTop: `1px solid ${HAIRLINE}`, pt: 1 }}><b>Next:</b> {next}</Typography>
      </Box>
    </GlassCard>
  );
}

function ImprovementsTab({ d }: { d: Data }) {
  const m = d.measure, ex = d.settings.exclusions;
  const pc = m.merge.precision;
  const enough = (r: Rate) => r.flagged >= 10;
  const rateText = (r: Rate) => `${pct(r.merged, r.flagged)} (${full(r.merged)} of ${full(r.flagged)})`;
  const textRows = m.texts.reduce((a, t) => a + t.rows, 0);
  const pipes = m.merge.neverMergedByPipeline.slice(0, 3).map((x) => `${pipeLabel(x.key)} ${full(x.count)}`).join(", ");
  const ages = m.merge.byAge.filter((x) => x.flagged);
  return (
    <>
      <Info>
        What the measurement says the check could do better - each card with its effect over the tickets of the period. Merges count only once a
        ticket has been followed for 7 days, so the merge figures grow day by day.
      </Info>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<AltRouteOutlinedIcon />} tint="amber" title="Owner from the same pipeline only" status={ex.ownerFromSamePipelineOnly ? ACTIVE : IDEA}
            figure={`${full(m.owner.copyOtherPipeline)} of ${full(m.owner.copy)} hand-overs`}
            effect={<>came from a duplicate in another pipeline - a Back Office ticket handed to an ESO or TSA owner. With the hub&apos;s exclusions {full(m.owner.hub)} hand-overs remain instead of {full(m.owner.copy)}.{m.owner.copyKnownPipeline < m.owner.copy ? ` (${full(m.owner.copy - m.owner.copyKnownPipeline)} checked before the pipeline was recorded.)` : ""}</>}
            next="Keep it when the hub takes over; the other pipeline's owner still sees the duplicate flag." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<BlockOutlinedIcon />} tint="slate" title="Automatic warnings are never a duplicate" status={m.texts.length ? ACTIVE : IDEA}
            figure={`${full(textRows)} flags taken away`}
            effect={m.texts.length ? <>{m.texts.map((t) => <div key={t.text}>“{t.text}”: {full(t.rows)} tickets lose a duplicate</div>)}</> : "No text is excluded in the hub yet."}
            next="Add other automatic mails that name an order but are never the same request (Exclusions)." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<CallMergeOutlinedIcon />} tint="pink" title="Merged by people" status={enough(pc.copy) ? IDEA : WAIT}
            figure={`${pct(pc.copy.merged, pc.copy.flagged)} of the flags`}
            effect={<>
              <div>Copy (the workflow today): {rateText(pc.copy)}, {full(pc.copy.mergedWithFlagged)} with the flagged ticket itself.</div>
              <div>Hub (your exclusions): {rateText(pc.hub)}. HubSpot&apos;s own flags: {rateText(pc.hubspot)}.</div>
              <div>Only tickets followed for 7 days count; {full(m.merge.tracked)} are being followed.</div>
            </>}
            next="High: the flag is right - the hub could prepare the merge for a person to confirm. Low: flag less (the cards below say where)." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<ScheduleOutlinedIcon />} tint="purple" title="Flagged, never merged after 7 days" status={enough(pc.copy) ? IDEA : WAIT}
            figure={`${full(m.merge.neverMerged)} of ${full(pc.copy.flagged)} flags`}
            effect={<>were left alone for a week{pipes ? ` - the duplicate sat in ${pipes}` : ""}. {full(m.merge.allClosed.flagged)} flags had only closed duplicates; {full(m.merge.allClosed.merged)} of those were merged.</>}
            next="Candidates to exclude: the biggest group that is never merged (a pipeline, closed duplicates, a kind of subject)." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<QueryStatsOutlinedIcon />} tint="blue" title="Age of the duplicate" status={ages.some((x) => x.flagged >= 5) ? IDEA : WAIT}
            figure={m.age.medianDays === null ? "—" : `${Math.round(m.age.medianDays)} days old, typically`}
            effect={<>
              <div>The oldest duplicate of a flag{m.age.oldestDays !== null ? `: up to ${full(Math.round(m.age.oldestDays))} days old` : ""} - the workflow flags any age, only the owner needs 30 days.</div>
              {ages.map((x) => <div key={x.key}>{x.key}: {full(x.merged)} of {full(x.flagged)} merged</div>)}
            </>}
            next="Flag only duplicates up to the age where people stop merging them." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<SearchOffOutlinedIcon />} tint="amber" title="No order number" status={m.noKey.later ? IDEA : WAIT}
            figure={`${tickets(m.noKey.count)} (${pct(m.noKey.count, m.noKey.of)})`}
            effect={<>had no order number when they entered, so they were never compared. {full(m.noKey.later)} got one later (the hub&apos;s ticket association engine fills Order Number from e-mails and shop links){m.noKey.laterWouldFind ? `; for ${full(m.noKey.laterWouldFind)} of them the order-number search finds duplicates` : ""}.</>}
            next="Check a ticket again once its Order Number is filled - the workflow re-runs on an Order Number change, the hub could too." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<ManageSearchOutlinedIcon />} tint="green" title="Merged without a flag" status={m.merge.unflaggedMerged ? IDEA : WAIT}
            figure={tickets(m.merge.unflaggedMerged)}
            effect={<>were merged by people although nobody flagged them{m.merge.unflaggedMergedWhy.length ? `: ${m.merge.unflaggedMergedWhy.map((x) => `${SKIPS[x.key] ?? x.key} ${full(x.count)}`).join(", ")}` : ""}. These are the duplicates the check misses.</>}
            next="Look at them (Tickets > Merged by people) for what they share - often no order number, or a different one." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Idea icon={<VerifiedOutlinedIcon />} tint="blue" title="Before the hub takes over" status={m.agreement.live.compared >= 50 ? IDEA : WAIT}
            figure={`${pct(m.agreement.live.sameVerdict, m.agreement.live.compared)} the same answer`}
            effect={<>on {full(m.agreement.live.compared)} live tickets: {full(m.agreement.live.copyOnly)} found only by the copy, {full(m.agreement.live.hubspotOnly)} only by HubSpot; the same owner hand-over on {pct(m.agreement.live.sameOwner, m.agreement.live.ownerCompared)}.</>}
            next="When the copy and HubSpot agree and the exclusions are agreed, the hub can write the flag itself and the workflow can stop." />
        </Grid>
      </Grid>
    </>
  );
}

// ---------------------------------------------------------------- Exclusions (unchanged behaviour)

function ExclusionsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [ex, setEx] = useState<Exclusions>(d.settings.exclusions);
  const [texts, setTexts] = useState(d.settings.exclusions.neverMatchTexts.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-duplicates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exclusions: { ...ex, neverMatchTexts: texts.split("\n") } }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved - new tickets are checked with these exclusions (shadow only)." : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const togglePipe = (id: string) => setEx((x) => ({ ...x, pipelines: x.pipelines.includes(id) ? x.pipelines.filter((p) => p !== id) : [...x.pipelines, id] }));
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<FilterAltOffOutlinedIcon />} tint="purple" title="Exclusions" note="What the hub's own check leaves out. The defaults are exactly the workflow; the copy always follows the workflow" />
      <Box sx={{ display: "grid", gap: 2, maxWidth: 760 }}>
        <Box>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Pipelines that can hold a duplicate</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>None ticked = every pipeline, as the workflow does today.</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {PIPES.map((p) => <FormControlLabel key={p.id} sx={{ m: 0 }} control={<Checkbox size="small" checked={ex.pipelines.includes(p.id)} onChange={() => togglePipe(p.id)} disabled={!d.admin} />} label={<Typography sx={{ fontSize: "0.82rem" }}>{p.label}</Typography>} />)}
          </Box>
        </Box>
        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ex.ownerFromSamePipelineOnly} onChange={(e) => setEx({ ...ex, ownerFromSamePipelineOnly: e.target.checked })} disabled={!d.admin} />}
          label={<Typography sx={{ fontSize: "0.84rem" }}>Take the owner only from a duplicate in the <b>same pipeline</b> (today: any pipeline - a Back Office ticket can go to an ESO owner)</Typography>} />
        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={ex.flagOnly} onChange={(e) => setEx({ ...ex, flagOnly: e.target.checked })} disabled={!d.admin} />}
          label={<Typography sx={{ fontSize: "0.84rem" }}>Only flag duplicates - <b>never change the owner</b></Typography>} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField size="small" type="number" label="Owner from duplicates up to (days)" value={ex.ownerMaxAgeDays} onChange={(e) => setEx({ ...ex, ownerMaxAgeDays: Number(e.target.value) })} disabled={!d.admin} sx={{ width: 260 }} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Today: 30</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>Never a duplicate when the subject contains</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>One text per line, on top of the workflow&apos;s own (certificates, C2S problems, warnings; erosion only matches erosion). E.g. &quot;ERP Order Export&quot;.</Typography>
          <TextField multiline minRows={3} fullWidth size="small" value={texts} onChange={(e) => setTexts(e.target.value)} disabled={!d.admin} />
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="contained" size="small" disabled={!d.admin || busy} onClick={() => void save()} sx={{ textTransform: "none" }}>Save exclusions</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </Box>
    </GlassCard>
  );
}

// ---------------------------------------------------------------- Settings

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<{ row?: Row; error?: string } | null>(null);
  const call = async (what: string, method: "PUT" | "POST", body: object) => {
    setBusy(what); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-duplicates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; error?: string; data?: { skipped?: string } };
      setMsg(j.ok ? (j.data?.skipped ? `Not run: ${j.data.skipped}.` : what === "replay" ? "The replay starts again from 7 days ago - 25 tickets every 3 minutes." : "Done.") : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const r = await fetch(`/api/uc/ticket-duplicates?ticket=${encodeURIComponent(tid.trim())}`);
      const j = (await r.json()) as { ok: boolean; data?: Row; error?: string };
      setCheck(j.ok && j.data ? { row: j.data } : { error: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setCheck({ error: (e as Error).message }); } finally { setBusy(null); }
  };
  const b = d.backfill;
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes; nothing is written to HubSpot in shadow mode`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Choice<"off" | "shadow"> value={d.settings.mode} onChange={(m) => d.admin && void call("mode", "PUT", { mode: m })} options={[{ key: "shadow", label: "Shadow - compare, write nothing" }, { key: "off", label: "Off" }]} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button variant="outlined" size="small" disabled={!d.admin || !!busy} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            {busy === "run" && <CircularProgress size={14} />}
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>No live mode yet: the hub takes over from the DUPS workflow only once the comparison is clean and the exclusions are agreed.</Typography>
        </Box>
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ReplayOutlinedIcon />} tint="amber" title="The last 7 days" note="Back Office tickets from before the hub watched: checked the same way, 25 every 3 minutes, oldest first - tickets already here are skipped" />
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {b ? `${b.done ? "Done" : "Running"}: ${full(b.checked)} tickets replayed since ${when(b.startedAt)}${b.done ? "" : `, now at tickets that entered ${when(new Date(b.cursor).toISOString())}`}${b.by && b.by !== "first run" ? ` (asked by ${b.by})` : ""}.` : "Starts with the next run."}
          </Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>A replayed ticket is checked against today&apos;s tickets: its owner at the check is today&apos;s owner, not the one at the time, so its owner hand-over can differ from what the workflow did.</Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button variant="outlined" size="small" disabled={!!busy} onClick={() => void call("replay", "POST", { action: "replay" })} sx={{ textTransform: "none" }}>Replay the last 7 days</Button>
              {busy === "replay" && <CircularProgress size={14} />}
            </Box>
          )}
        </Box>
      </GlassCard>
      {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read only - what the copy and the hub find for it now, next to what HubSpot wrote. Nothing is stored" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (tid.trim() && !busy) void doCheck(); }} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Ticket id, e.g. 439114412256" inputProps={{ "aria-label": "Ticket id", inputMode: "numeric" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!/^\d+$/.test(tid.trim()) || !!busy} sx={{ textTransform: "none" }}>
            {busy === "check" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check?.error && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1.5 }}>{check.error}</Typography>}
        {check?.row && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>
              <Box component="a" href={hsTicket(check.row.ticketId)} target="_blank" rel="noopener" sx={{ color: INK }}>{check.row.subject || check.row.ticketId}</Box>
              <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}> - order {check.row.keys || "none"}</Box>
            </Typography>
            <Detail r={check.row} />
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function TicketDuplicates() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const [days, setDays] = useState(14);
  const url = `/api/uc/ticket-duplicates?days=${days}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const again = () => setN((x) => x + 1);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the Back Office tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Duplicates & merges" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={again} />;
  else if (view === "settings") body = <SettingsTab d={r.data} onChanged={again} />;
  else if (view === "exclusions") body = <ExclusionsTab key={r.data.settings.at ?? "x"} d={r.data} onChanged={again} />;
  else if (view === "tickets") body = <TicketsTab d={r.data} />;
  else if (view === "how") body = <HowTab d={r.data} />;
  else if (view === "improvements") body = <ImprovementsTab d={r.data} />;
  else body = <Overview d={r.data} />;
  const ok = r?.state === "ok" ? r.data : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Duplicates & merges"
        subtitle="Back Office tickets about the same order - the DUPS workflow, side by side with the hub, and what people merged (shadow mode)"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={again} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box>
        <ReportTabs name="ticketdup" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "tickets", label: "Tickets", count: ok?.measure.flags.copy ? full(ok.measure.flags.copy) : null },
          { id: "how", label: "How it works", count: null },
          { id: "improvements", label: "Improvements", count: null },
          { id: "exclusions", label: "Exclusions", count: null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {view !== "settings" && view !== "exclusions" && <Period days={days} onChange={setDays} />}
      <Box id={`ticketdup-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
