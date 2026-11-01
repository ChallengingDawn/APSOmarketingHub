"use client";

// BACK OFFICE DISTRIBUTION - GQS's own figures (SARCLA 01.11.2026: "GQS should have its own KPI subdivided like we do in
// advanced reporting - create a main toggle in between pipelines"). With GQS picked on the page's toggle, GQS has Back
// Office's tabs (SARCLA 01.11.2026: "keep the same then to GQS the same tab, but instead of sentiment resolution for win
// or lost"): Overview, Tickets, Flow, Type of request (Detection's place), Resolution (Sentiment's), Speed (Priority's),
// People, Settings. The figure tabs are here, each drawn the same way: the period's tasks against the same number of
// days just before (DimChart, blue this period, grey before), then "All the figures" in cards of their own, as advanced
// reporting draws them; Open now is under Tickets. The rule each task was given by is GqsTab.tsx (Flow, the team on
// People). Every task of the GQS pipeline is read every 30 minutes (src/lib/gqsFigures) - with, since 01.11.2026, the
// owner each was given when it arrived and the ESO / TSA ticket it belongs to, read from its links (SARCLA: "why so many
// not linked?", "it would be great to see also the ticket owner of the sales team"), so Tickets answers for any period
// ("the time filter on top should really filter it").

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { ChartBox, FullTable, TWO, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { DEEMPHASIS, DELTA, SERIES } from "@/app/charts/palette";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Choice, usePaged } from "@/app/connectors/parts";
import { dayOf, previousWindow, rangeLabel, type OwnerJ } from "@/lib/boDetection/figures";
import {
  GQS_STAGE, NOT_ASKED, WORK_STAGES, ageDays, byKey, byMonth, daysToOffer, givenOf, inPeriod, median, outcomeOf, ownerOf, refusedBy, resultOf, salesOwnerOf, salesStageOf,
  sentIn, stageTimes, sumOf, typeOf, wonShare, type GqsRow, type GqsStore, type Sum,
} from "@/lib/gqsFigures/figures";
import { pct } from "./shared";
import { OJ } from "./BoOverview";

/** GQS's figure tabs: Overview, Tickets, Type of request (Detection's place), Resolution (Sentiment's), Speed (Priority's), People's figures. */
export type GqsView = "gqs" | "gqs-tickets" | "gqs-type" | "gqs-resolution" | "gqs-speed" | "gqs-people";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const days = (d: number | null) => (d === null ? "—" : d * 24 < 1 ? "under an hour" : d < 1 ? `${Math.round(d * 24)} hours` : `${d < 10 ? d.toFixed(1) : Math.round(d)} days`);
const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
/** The change of a count against the days before, for a tile. */
const delta = (now: number, was: number | null, versus: string, goodWhenUp = true) => (was ? { ratio: now / was - 1, versus, goodWhenUp } : undefined);
const link = (r: GqsRow, w = 320) => (
  <Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(w) }}>{r.subject || r.id}</Box>
);
const small = { ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" as const };
const dateCell = (r: GqsRow) => <TableCell sx={small}>{rangeLabel(dayOf(r.created), dayOf(r.created))}</TableCell>;

/** The period and the same number of days just before it, with their tasks. */
function usePeriod(store: GqsStore, from: string, to: string) {
  return useMemo(() => {
    const prev = previousWindow(from, to);
    const first = store.rows.map((r) => r.created).sort()[0]?.slice(0, 10) ?? from;
    return {
      now: inPeriod(store.rows, from, to), before: inPeriod(store.rows, prev.from, prev.to),
      // the offers sent in the period and in the days before - like-for-like, whatever the day they were asked for
      sentNow: sentIn(store.rows, from, to), sentBefore: sentIn(store.rows, prev.from, prev.to),
      label: rangeLabel(first > from ? first : from, to), beforeLabel: rangeLabel(prev.from, prev.to),
      // a period before the first task (July 2025) has nothing, or only part, to compare with
      hasBefore: prev.from >= first,
    };
  }, [store, from, to]);
}
type Period = ReturnType<typeof usePeriod>;

/** The columns every breakdown shows, in one order. */
type ColDef = { key: string; label: string; v: (s: Sum) => number | null; show: (s: Sum) => string; tip?: string };
const COLS: ColDef[] = [
  { key: "n", label: "Requests", v: (s) => s.n, show: (s) => full(s.n) },
  { key: "offer", label: "Offers sent", v: (s) => s.offer, show: (s) => `${full(s.offer)} · ${pct(s.offer, s.n)}` },
  { key: "refused", label: "Refused", v: (s) => s.refused, show: (s) => (s.refused ? `${full(s.refused)} · ${pct(s.refused, s.n)}` : "—") },
  { key: "open", label: "Open", v: (s) => s.open, show: (s) => (s.open ? full(s.open) : "—"), tip: "Still open today" },
  { key: "won", label: "Won", v: (s) => s.won, show: (s) => (s.won ? full(s.won) : "—") },
  { key: "lost", label: "Lost", v: (s) => s.lost, show: (s) => (s.lost ? full(s.lost) : "—") },
  { key: "share", label: "Won %", v: (s) => wonShare(s), show: (s) => { const w = wonShare(s); return w === null ? "—" : `${Math.round(w * 100)}%`; }, tip: "Won of the offers whose outcome is in STATUS OF GQS (WON or LOST)" },
  { key: "days", label: "Days to offer", v: (s) => median(s.days), show: (s) => { const d = median(s.days); return d === null ? "—" : d < 1 ? "< 1" : d.toFixed(1); }, tip: "The median days from the request to Offer Sent to Sales, of those that have it" },
];

/** Resolution's columns: what came of the offers. */
const RES_COLS: ColDef[] = [
  { key: "n", label: "Requests", v: (s) => s.n, show: (s) => full(s.n) },
  { key: "offer", label: "Offers sent", v: (s) => s.offer, show: (s) => (s.offer ? full(s.offer) : "—") },
  { key: "won", label: "Won", v: (s) => s.won, show: (s) => (s.won ? full(s.won) : "—") },
  { key: "lost", label: "Lost", v: (s) => s.lost, show: (s) => (s.lost ? full(s.lost) : "—") },
  { key: "wait", label: "Waiting", v: (s) => s.waiting, show: (s) => (s.waiting ? full(s.waiting) : "—"), tip: "Offers sent whose outcome is not in STATUS OF GQS yet" },
  COLS.find((c) => c.key === "share")!,
];

type SumRow = { label: string; s: Sum };
const TOTAL = "All GQS requests";

/**
 * "All the figures, by X" - a card of its own, as advanced reporting draws it (SARCLA 01.11.2026: "this table should be
 * separated - All the figures, by month as in advanced reporting"): every column sorts by its header, a total line,
 * twenty-five rows a page.
 */
function FiguresTable({ title, hint, rows, total, first, extra, cols = COLS, natural = false }: {
  title: string; hint: string; rows: SumRow[]; total: Sum; first: string; natural?: boolean;
  extra?: { label: string; v: (label: string) => number; tip?: string }; cols?: ColDef[];
}) {
  const extraTotal = extra ? rows.reduce((a, r) => a + extra.v(r.label), 0) : 0;
  const all: Col<SumRow>[] = [
    ...cols.map((c): Col<SumRow> => ({ key: c.key, head: c.label, tip: c.tip, cell: (r) => <span style={{ color: c.v(r.s) ? INK : MUTED }}>{c.show(r.s)}</span>, sort: (r) => c.v(r.s) ?? -1 })),
    ...(extra ? [{ key: "extra", head: extra.label, tip: extra.tip, cell: (r: SumRow) => { const v = r.label === TOTAL ? extraTotal : extra.v(r.label); return v ? full(v) : "—"; }, sort: (r: SumRow) => extra.v(r.label) }] : []),
  ];
  return (
    <ChartBox title={title} hint={hint}>
      <FullTable first={first} cols={all} rows={rows} total={{ label: TOTAL, s: total }} natural={natural} find={rows.length > 12 ? first.toLowerCase() : undefined} />
    </ChartBox>
  );
}
const monthRows = (rows: GqsRow[]): SumRow[] => byMonth(rows).map((m) => ({ label: monthLabel(m.label), s: m.s }));

/**
 * The four counts. Requests and offers sent count by their own day, so they compare with the days before; refused and
 * won are what came of the period's requests so far - a young period has had less time, so they carry no comparison.
 */
function Tiles({ now, before, sentNow, sentBefore, label, beforeLabel, hasBefore }: Period) {
  const s = sumOf(now);
  const w = wonShare(s);
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="blue" label="Requests" value={full(s.n)}
        delta={hasBefore ? delta(s.n, before.length, beforeLabel) : undefined} note={`GQS tasks created ${label}${hasBefore ? `; ${full(before.length)} the days before` : ""}.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SendOutlinedIcon />} tint="green" label="Offers sent to Sales" value={full(sentNow.length)}
        delta={hasBefore ? delta(sentNow.length, sentBefore.length, beforeLabel) : undefined}
        note={`Sent ${label}, whenever they were asked for. Of the period's ${full(s.n)} requests, ${full(s.offer)} have their offer and ${full(s.open)} are still open.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<DoNotDisturbOnOutlinedIcon />} tint="amber" label="Refused" value={full(s.refused)}
        note={`${pct(s.refused, s.n)} of the ${full(s.n)} requests created ${label} - so far.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<EmojiEventsOutlinedIcon />} tint="purple" label="Won" value={full(s.won)}
        note={`Of the period's requests: ${full(s.won)} won, ${full(s.lost)} lost${w === null ? "" : ` (${Math.round(w * 100)}% won)`}; ${full(s.waiting)} offers wait for their outcome.`} /></Grid>
    </Grid>
  );
}

/** Overview: the tiles, month by month, the refusals and why. */
function Overview({ store, from, to }: { store: GqsStore; from: string; to: string }) {
  const p = usePeriod(store, from, to);
  const months = byMonth(p.now);
  const data = months.map((m) => ({ x: m.label, offer: m.s.offer, refused: m.s.refused, open: m.s.open }));
  const table: TableTwin = { columns: ["Month", "Offers sent", "Refused", "Still open", "Requests"], rows: data.map((r) => [monthLabel(r.x), r.offer, r.refused, r.open, r.offer + r.refused + r.open]), numeric: [1, 2, 3, 4] };
  const refused = p.now.filter((r) => outcomeOf(r) === "refused").sort((a, b) => b.created.localeCompare(a.created));
  const { slice, pager } = usePaged(refused, 10);
  return (
    <>
      <Tiles {...p} />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title="GQS requests month by month"
          note={`The ${full(p.now.length)} GQS tasks created ${p.label}, by where they ended: an offer sent to Sales, refused, or still open. The first and last month count only the days inside the period`} />
        <ChartFrame caption="GQS requests per month" table={table} empty={p.now.length ? null : "No GQS request in this period."}>
          <StackedColumns data={data} parts={[{ key: "offer", label: "Offer sent" }, { key: "refused", label: "Refused" }, { key: "open", label: "Still open", color: DEEMPHASIS }]} format={(v) => full(v ?? 0)} xFormat={monthLabel} />
        </ChartFrame>
      </GlassCard>
      <FiguresTable title={`All the figures, month by month, ${p.label}`} hint="Each month's requests and what came of them so far - WON and LOST are kept in STATUS OF GQS on almost every offer since February 2026; an earlier month shows few outcomes"
        first="Month" rows={monthRows(p.now)} total={sumOf(p.now)} natural />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<DoNotDisturbOnOutlinedIcon />} tint="amber" title={`Refused, and why: ${full(refused.length)}`} note={`The requests created ${p.label} that ended in Refused - who refused them and the reason given, newest first`} />
        {refused.length ? (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Created", "Request", "Type", "Refused", "Reason to refuse", "Owner"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {slice.map((r) => (
                    <TableRow key={r.id} sx={{ verticalAlign: "top" }}>
                      {dateCell(r)}
                      <TableCell sx={bodyCell}>{link(r, 300)}</TableCell>
                      <TableCell sx={small}>{typeOf(r)}</TableCell>
                      <TableCell sx={small}>{refusedBy(r)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: r.reason ? INK : MUTED, minWidth: 220 }}>{r.reason ?? "no reason given"}</TableCell>
                      <TableCell sx={small}>{ownerOf(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {pager}
          </>
        ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None refused in this period.</Typography>}
      </GlassCard>
    </>
  );
}

/** A breakdown tab: the tiles, this period against the days before by X, and every figure by X (and by a second X). */
function Breakdown({ store, from, to, by, title, first, note, extra, also }: {
  store: GqsStore; from: string; to: string; by: (r: GqsRow) => string; title: string; first: string; note: string;
  extra?: { label: string; v: (label: string) => number; tip?: string };
  also?: { by: (r: GqsRow) => string; title: string; first: string; hint: string };
}) {
  const p = usePeriod(store, from, to);
  const rows = byKey(p.now, by);
  const was = new Map(byKey(p.before, by).map((x) => [x.label, x.s]));
  const chart = rows.map((r) => ({ label: r.label, now: r.s.n, before: was.get(r.label)?.n ?? 0 }));
  // offers by the day they were sent, as on the tile - every value either side has, in the requests' order
  const sentN = new Map(byKey(p.sentNow, by).map((x) => [x.label, x.s.n])), sentB = new Map(byKey(p.sentBefore, by).map((x) => [x.label, x.s.n]));
  const order = [...new Set([...rows.map((r) => r.label), ...sentN.keys(), ...sentB.keys()])];
  const offers = order.map((label) => ({ label, now: sentN.get(label) ?? 0, before: sentB.get(label) ?? 0 })).filter((x) => x.now || x.before);
  return (
    <>
      <Tiles {...p} />
      <Box sx={TWO}>
        <DimChart title={`Requests created ${p.label}, by ${title}`} rows={chart} cur={(r) => r.now} prev={(r) => r.before} curLabel={p.label} prevLabel={p.beforeLabel} fmt={full} single={!p.hasBefore} labelWidth={190} />
        <DimChart title={`Offers sent to Sales ${p.label}, by ${title}`} rows={offers} cur={(r) => r.now} prev={(r) => r.before} curLabel={p.label} prevLabel={p.beforeLabel} fmt={full} single={!p.hasBefore} labelWidth={190} fixedOrder />
      </Box>
      <FiguresTable title={`All the figures, ${p.label}, by ${title}`} hint={note} first={first} rows={rows} total={sumOf(p.now)} extra={extra} />
      {also && <FiguresTable title={`All the figures, ${p.label}, ${also.title}`} hint={also.hint} first={also.first} rows={byKey(p.now, also.by)} total={sumOf(p.now)} />}
    </>
  );
}

/**
 * Speed: how long a request took to its offer, and where the time went - over the offers SENT in the period, so a young
 * period is not made to look fast by the requests that have not got theirs yet (and their stages are all counted).
 */
function Speed({ store, from, to }: { store: GqsStore; from: string; to: string }) {
  const p = usePeriod(store, from, to);
  const label = (id: string) => store.stages.find((s) => s.id === id)?.label ?? id;
  const now = stageTimes(p.sentNow), was = new Map(stageTimes(p.sentBefore).map((x) => [x.stage, x]));
  const toOffer = (rows: GqsRow[]) => median(rows.map(daysToOffer).filter((d): d is number => d !== null));
  const at = (st: string) => now.find((x) => x.stage === st);
  const tile = (st: string, icon: React.ReactNode, name: string) => {
    const x = at(st), y = was.get(st);
    return <KpiTile icon={icon} tint="slate" label={name} value={days(x?.days ?? null)} note={`The median of the ${full(x?.tasks ?? 0)} offers that were there.${p.hasBefore && y?.days != null ? ` ${p.beforeLabel}: ${days(y.days)}.` : ""}`} />;
  };
  const b = p.hasBefore ? toOffer(p.sentBefore) : null;
  // the days from the request to the offer, by type: this period's offers against the days before's, the median of each
  const speedBy = (key: (r: GqsRow) => string) => {
    const before = new Map(byKey(p.sentBefore, key).map((x) => [x.label, x.s]));
    return byKey(p.sentNow, key).filter((x) => x.s.days.length).map((x) => ({ label: x.label, now: median(x.s.days) ?? 0, before: median(before.get(x.label)?.days ?? []) ?? 0, n: x.s.days.length, nb: before.get(x.label)?.days.length ?? 0 }));
  };
  const types = speedBy(typeOf);
  const sales = speedBy(salesOwnerOf);
  type SpeedRow = { label: string; now: number; before: number; n: number; nb: number };
  const speedCols: Col<SpeedRow>[] = [
    { key: "n", head: "Offers sent", cell: (x) => full(x.n), sort: (x) => x.n },
    { key: "now", head: "Median, request to offer", cell: (x) => days(x.now), sort: (x) => x.now },
    ...(p.hasBefore ? [
      { key: "nb", head: `Offers, ${p.beforeLabel}`, cell: (x: SpeedRow) => (x.nb ? full(x.nb) : "—"), sort: (x: SpeedRow) => x.nb },
      { key: "before", head: `Median, ${p.beforeLabel}`, cell: (x: SpeedRow) => (x.nb ? days(x.before) : "—"), sort: (x: SpeedRow) => x.before },
    ] : []),
  ];
  const allNow = median(p.sentNow.map(daysToOffer).filter((d): d is number => d !== null)), allB = median(p.sentBefore.map(daysToOffer).filter((d): d is number => d !== null));
  const total: SpeedRow = { label: "All offers sent", now: allNow ?? 0, before: allB ?? 0, n: p.sentNow.length, nb: p.sentBefore.length };
  const months = byKey(p.sentNow, (r) => dayOf(r.offerAt!).slice(0, 7)).sort((x, y) => x.label.localeCompare(y.label)).map((m) => ({ label: monthLabel(m.label), now: median(m.s.days) ?? 0, before: 0, n: m.s.days.length, nb: 0 }));
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ScheduleOutlinedIcon />} tint="blue" label="Request to offer" value={days(toOffer(p.sentNow))}
          note={`The median of the ${full(p.sentNow.length)} offers sent ${p.label}, from their request.${b !== null ? ` ${p.beforeLabel}: ${days(b)}.` : ""}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{tile(GQS_STAGE.open, <PendingActionsOutlinedIcon />, "In Open the GQS Task")}</Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{tile(GQS_STAGE.waitingGqs, <HourglassEmptyOutlinedIcon />, "Waiting on GQS")}</Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{tile(GQS_STAGE.waitingCustomer, <HourglassEmptyOutlinedIcon />, "Waiting on Customer")}</Grid>
      </Grid>
      <Box sx={TWO}>
        <DimChart title={`Request to offer, by type of request - the median, ${p.label}`} rows={types} cur={(x) => x.now} prev={(x) => x.before} curLabel={p.label} prevLabel={p.beforeLabel}
          fmt={(v) => days(v)} single={!p.hasBefore} labelWidth={190} curNote={(x) => ({ text: `${full(x.n)} offers`, color: MUTED })} />
        <DimChart title={`Request to offer, by the sales ticket's owner - the median, ${p.label}`} rows={sales} cur={(x) => x.now} prev={(x) => x.before} curLabel={p.label} prevLabel={p.beforeLabel}
          fmt={(v) => days(v)} single={!p.hasBefore} labelWidth={190} curNote={(x) => ({ text: `${full(x.n)} offers`, color: MUTED })} />
      </Box>
      <ChartBox title={`All the figures, month by month, ${p.label}`} hint="The offers sent each month and the median days from their request - by the month the offer was sent">
        <FullTable first="Month" cols={speedCols.filter((c) => c.key === "n" || c.key === "now")} rows={months} total={total} natural />
      </ChartBox>
      <ChartBox title={`All the figures, ${p.label}, by type of request`} hint={`The offers sent and the median days from their request${p.hasBefore ? ` - against ${p.beforeLabel}` : ""}`}>
        <FullTable first="Type of request" cols={speedCols} rows={types} total={total} />
      </ChartBox>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ScheduleOutlinedIcon />} tint="blue" title="Where the time went" note={`The offers sent ${p.label}: the median time in each stage, of those that were there at all - all the times they were there`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Stage", "Offers that were there", "Median time", p.hasBefore ? p.beforeLabel : ""].filter(Boolean).map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {WORK_STAGES.map((st) => { const x = at(st)!, y = was.get(st); return (
                <TableRow key={st}>
                  <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{label(st)}</TableCell>
                  <TableCell sx={{ ...num, color: x.tasks ? INK : MUTED }}>{x.tasks ? `${full(x.tasks)} · ${pct(x.tasks, p.sentNow.length)}` : "—"}</TableCell>
                  <TableCell sx={{ ...num, fontWeight: 700 }}>{days(x.days)}</TableCell>
                  {p.hasBefore && <TableCell sx={{ ...num, color: MUTED }}>{days(y?.days ?? null)}</TableCell>}
                </TableRow>
              ); })}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>
    </>
  );
}

type Res = "won" | "lost" | "waiting" | "none";
/** What came of a request: WON / LOST, an offer waiting for its outcome, or no offer (refused or still open). */
const resOf = (r: GqsRow): Res => resultOf(r) ?? (outcomeOf(r) === "offer" ? "waiting" : "none");
const RES: Record<Res, { label: string; color: string }> = {
  won: { label: "Won", color: DELTA.good }, lost: { label: "Lost", color: DELTA.bad },
  waiting: { label: "Waiting for the outcome", color: SERIES[0] }, none: { label: "No offer (refused or open)", color: DEEMPHASIS },
};

/**
 * Resolution - what came of the offers (SARCLA 01.11.2026: GQS has Back Office's tabs, "but instead of sentiment,
 * resolution for win or lost"). The period's requests: won, lost, an offer waiting for its outcome, no offer; month by
 * month; by type, by GQS owner and by the sales ticket's owner, each in a card of its own; where the sales tickets stand
 * - of the offers waiting, won or lost ("can't I see the won also"); and the requests themselves. STATUS OF GQS carries
 * WON / LOST, with no date - so this is what came of the period's requests so far, never compared with the days before.
 */
function Resolution({ store, from, to }: { store: GqsStore; from: string; to: string }) {
  const p = usePeriod(store, from, to);
  const s = sumOf(p.now);
  const w = wonShare(s);
  const months = byMonth(p.now);
  const per = (rows: GqsRow[], k: Res) => rows.filter((r) => resOf(r) === k).length;
  const data = months.map((m) => { const rows = p.now.filter((r) => dayOf(r.created).startsWith(m.label)); return { x: m.label, won: per(rows, "won"), lost: per(rows, "lost"), waiting: per(rows, "waiting"), none: per(rows, "none") }; });
  const keys: Res[] = ["won", "lost", "waiting", "none"];
  const table: TableTwin = { columns: ["Month", ...keys.map((k) => RES[k].label)], rows: data.map((r) => [monthLabel(r.x), r.won, r.lost, r.waiting, r.none]), numeric: [1, 2, 3, 4] };
  const [stand, setStand] = useState<Res | "offers">("waiting");
  const offers = p.now.filter((r) => (stand === "offers" ? resOf(r) !== "none" : resOf(r) === stand));
  const standRows = byKey(offers, salesStageOf).map((x) => ({ label: x.label, n: x.s.n }));
  const [show, setShow] = useState<Res>("won");
  const list = p.now.filter((r) => resOf(r) === show).sort((a, b) => b.created.localeCompare(a.created));
  const { slice, pager } = usePaged(list, 10);
  const tiles: { k: Res; icon: React.ReactNode; tint: "green" | "pink" | "blue" | "slate"; note: string }[] = [
    { k: "won", icon: <EmojiEventsOutlinedIcon />, tint: "green", note: `${pct(s.won, s.n)} of the ${full(s.n)} requests created ${p.label}${w === null ? "" : ` - ${Math.round(w * 100)}% of the offers whose outcome is known`}.` },
    { k: "lost", icon: <DoNotDisturbOnOutlinedIcon />, tint: "pink", note: `${pct(s.lost, s.n)} of the requests.` },
    { k: "waiting", icon: <HourglassEmptyOutlinedIcon />, tint: "blue", note: `Offers sent to Sales with no WON or LOST in STATUS OF GQS yet - ${pct(s.waiting, s.offer)} of the offers.` },
    { k: "none", icon: <PendingActionsOutlinedIcon />, tint: "slate", note: `No offer and no outcome: ${full(p.now.filter((r) => resOf(r) === "none" && outcomeOf(r) === "refused").length)} refused, ${full(p.now.filter((r) => resOf(r) === "none" && outcomeOf(r) === "open").length)} still open.` },
  ];
  const hint = "WON and LOST are kept in STATUS OF GQS on almost every offer since February 2026";
  return (
    <>
      <Grid container spacing={2}>
        {tiles.map((t) => <Grid key={t.k} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={t.icon} tint={t.tint} label={RES[t.k].label} value={full(per(p.now, t.k))} note={t.note} /></Grid>)}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<EmojiEventsOutlinedIcon />} tint="green" title="Won and lost, month by month"
          note={`The ${full(s.n)} GQS requests created ${p.label}, by what came of them so far. ${hint}`} />
        <ChartFrame caption="GQS requests per month, by outcome" table={table} empty={p.now.length ? null : "No GQS request in this period."}>
          <StackedColumns data={data} parts={keys.map((k) => ({ key: k, label: RES[k].label, color: RES[k].color }))} format={(v) => full(v ?? 0)} xFormat={monthLabel} />
        </ChartFrame>
      </GlassCard>
      <FiguresTable title={`All the figures, month by month, ${p.label}`} hint={`Each month's requests and what came of their offers so far - ${hint}`} first="Month" rows={monthRows(p.now)} total={s} cols={RES_COLS} natural />
      <FiguresTable title={`All the figures, ${p.label}, by the sales ticket's owner`} hint="The owner of the ESO / TSA ticket each request belongs to - the sales team's person who takes the offer to the customer"
        first="Sales ticket owner" rows={byKey(p.now, salesOwnerOf)} total={s} cols={RES_COLS} />
      <FiguresTable title={`All the figures, ${p.label}, by type of request`} hint="Running Business, or New Business by profit centre" first="Type of request" rows={byKey(p.now, typeOf)} total={s} cols={RES_COLS} />
      <FiguresTable title={`All the figures, ${p.label}, by GQS owner`} hint="The GQS task's owner in HubSpot today" first="GQS owner" rows={byKey(p.now, ownerOf)} total={s} cols={RES_COLS} />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<FlagOutlinedIcon />} tint="blue" title="Where the sales tickets stand"
          note="The stage of the ESO / TSA ticket each offer belongs to, read from its link - a closed sales ticket on an offer still waiting is an outcome nobody wrote down" />
        <Box sx={{ mb: 1.5 }}>
          <Choice<Res | "offers"> value={stand} onChange={setStand} options={[
            { key: "waiting", label: RES.waiting.label, count: per(p.now, "waiting") }, { key: "won", label: "Won", count: per(p.now, "won") },
            { key: "lost", label: "Lost", count: per(p.now, "lost") }, { key: "offers", label: "Every offer", count: p.now.filter((r) => resOf(r) !== "none").length },
          ]} />
        </Box>
        <BarList rows={standRows.map((x) => ({ label: x.label, value: x.n }))} labelWidth={240} format={(v) => full(v ?? 0)} emptyMessage="None in this period." />
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="slate" title="The requests" note={`Created ${p.label}, newest first`} />
        <Box sx={{ mb: 1.5 }}>
          <Choice<Res> value={show} onChange={setShow} options={keys.map((k) => ({ key: k, label: RES[k].label, count: per(p.now, k) }))} />
        </Box>
        {list.length ? (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Created", "Request", "GQS owner", "STATUS OF GQS", "Sales ticket", "Sales ticket owner", "Days to offer"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i === 6 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {slice.map((r) => (
                    <TableRow key={r.id}>
                      {dateCell(r)}
                      <TableCell sx={bodyCell}>{link(r, 320)}</TableCell>
                      <TableCell sx={small}>{ownerOf(r)}</TableCell>
                      <TableCell sx={small}>{r.status ?? "—"}</TableCell>
                      <TableCell sx={small}>{r.sales ? <Box component="a" href={hsTicket(r.sales.id)} target="_blank" rel="noopener" sx={{ color: "inherit" }}>{salesStageOf(r)}</Box> : salesStageOf(r)}</TableCell>
                      <TableCell sx={small}>{r.sales ? salesOwnerOf(r) : "—"}</TableCell>
                      <TableCell sx={num}>{daysToOffer(r) === null ? "—" : days(daysToOffer(r))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {pager}
          </>
        ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None in this period.</Typography>}
      </GlassCard>
    </>
  );
}

/* ── Tickets: every GQS task of the period, where it stands now ── */

/** Where a task stands now: open, its offer waiting for an outcome, won, lost, refused. */
type Now = "open" | "waiting" | "won" | "lost" | "refused";
const NOWS: Now[] = ["won", "lost", "waiting", "refused", "open"];
const nowOf = (r: GqsRow): Now => resultOf(r) ?? (outcomeOf(r) === "offer" ? "waiting" : outcomeOf(r) === "refused" ? "refused" : "open");
const NOW: Record<Now, { label: string; color: string }> = {
  won: { label: "Won", color: DELTA.good }, lost: { label: "Lost", color: DELTA.bad }, waiting: { label: "Offer waiting for its outcome", color: SERIES[0] },
  refused: { label: "Refused", color: SERIES[3] }, open: { label: "Still open", color: DEEMPHASIS },
};
/** A bar a person picked to narrow the list: which breakdown, which value. */
type Narrow = { by: "sales" | "salesOwner" | "status" | "given"; label: string };
const NARROW: Record<Narrow["by"], { name: string; of: (r: GqsRow) => string }> = {
  sales: { name: "Sales ticket", of: salesStageOf }, salesOwner: { name: "Sales ticket owner", of: salesOwnerOf },
  status: { name: "GQS status", of: (r) => tidy(r.status) || "No status" }, given: { name: "Given to", of: givenOf },
};

/**
 * Tickets: every GQS task created in the period (SARCLA 01.11.2026, on "Entered New for Back-Office 15 Oct - 1 Nov"
 * under a 365-day period: "the time filter on top should really filter it"): what became of the owner each was given,
 * where each stands now - won and lost among them - its sales ticket and that ticket's owner, then the tasks.
 */
function Tickets({ store, from, to }: { store: GqsStore; from: string; to: string }) {
  const p = usePeriod(store, from, to);
  const [state, setState] = useState<Now | "all">("all");
  const [narrow, setNarrow] = useState<Narrow | null>(null);
  const rows = p.now;
  const oj = (k: OwnerJ) => rows.filter((r) => r.oj === k).length;
  const given = oj("kept") + oj("moved") + oj("later");
  const by: Record<Now, number> = { won: 0, lost: 0, waiting: 0, refused: 0, open: 0 };
  for (const r of rows) by[nowOf(r)]++;
  const inState = state === "all" ? rows : rows.filter((r) => nowOf(r) === state);
  const pick = (k: Narrow["by"]) => (l: string) => {
    setNarrow(narrow?.by === k && narrow.label === l ? null : { by: k, label: l });
    if (typeof document !== "undefined") setTimeout(() => document.getElementById("gqs-task-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const shown = (narrow ? inState.filter((r) => NARROW[narrow.by].of(r) === narrow.label) : inState).sort((a, b) => b.created.localeCompare(a.created));
  const { slice, pager } = usePaged(shown, 15);
  const bars = (k: Narrow["by"]) => byKey(inState, NARROW[k].of).map((x) => ({ label: x.label, n: x.s.n }));
  const sel = (k: Narrow["by"]) => (narrow?.by === k ? [narrow.label] : undefined);
  const stateWord = state === "all" ? "" : ` - ${NOW[state].label.toLowerCase()}`;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="blue" label="Requests" value={full(rows.length)}
          delta={p.hasBefore ? delta(rows.length, p.before.length, p.beforeLabel) : undefined} note={`GQS tasks created ${p.label}${p.hasBefore ? `; ${full(p.before.length)} the days before` : ""}.`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PersonOutlineOutlinedIcon />} tint="green" label={OJ.kept.label} value={full(oj("kept"))}
          note={`${pct(oj("kept"), given)} of the ${full(given)} given an owner on entering New for Back-Office - they still have that owner.`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="amber" label={OJ.moved.label} value={full(oj("moved"))}
          note={`${pct(oj("moved"), given)} of those given an owner - a person gave them to someone else afterwards.`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ScheduleOutlinedIcon />} tint="slate" label="Given later, or not at all" value={full(oj("later") + oj("none"))}
          note={`${full(oj("later"))} got another owner from the routing later; ${full(oj("none"))} had none in their first half hour.`} /></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<FlagOutlinedIcon />} tint="green" title="Where they stand now"
          note={`The ${full(rows.length)} GQS tasks created ${p.label}: won and lost (STATUS OF GQS), an offer waiting for its outcome, refused, still open - a part picks them`} />
        {rows.length ? (
          <Box role="img" aria-label={NOWS.map((k) => `${NOW[k].label} ${by[k]}`).join(", ")} sx={{ display: "flex", gap: "2px", height: 14, borderRadius: "7px", overflow: "hidden", bgcolor: "rgba(21,34,58,.06)", mb: 1.25 }}>
            {NOWS.filter((k) => by[k]).map((k) => (
              <Tooltip key={k} title={`${NOW[k].label}: ${full(by[k])} (${pct(by[k], rows.length)})`}>
                <Box onClick={() => setState(state === k ? "all" : k)} sx={{ flex: `${by[k]} 1 0`, minWidth: 4, bgcolor: NOW[k].color, cursor: "pointer", opacity: state === "all" || state === k ? 1 : 0.35 }} />
              </Tooltip>
            ))}
          </Box>
        ) : null}
        <Choice<Now | "all"> value={state} onChange={setState} options={[{ key: "all", label: "All", count: rows.length }, ...NOWS.map((k) => ({ key: k, label: NOW[k].label, count: by[k] }))]} />
      </GlassCard>
      <Box sx={TWO}>
        <DimChart title={`The sales ticket now${stateWord}`} rows={bars("sales")} cur={(x) => x.n} prev={() => 0} curLabel="Tasks" prevLabel="" single fmt={full} labelWidth={230} selected={sel("sales")} onPick={pick("sales")} />
        <DimChart title={`The sales ticket's owner${stateWord}`} rows={bars("salesOwner")} cur={(x) => x.n} prev={() => 0} curLabel="Tasks" prevLabel="" single fmt={full} labelWidth={190} selected={sel("salesOwner")} onPick={pick("salesOwner")} />
      </Box>
      <Box sx={TWO}>
        <DimChart title={`Who got them${stateWord}`} rows={bars("given")} cur={(x) => x.n} prev={() => 0} curLabel="Tasks" prevLabel="" single fmt={full} labelWidth={190} selected={sel("given")} onPick={pick("given")} />
        <DimChart title={`The GQS status now${stateWord}`} rows={bars("status")} cur={(x) => x.n} prev={() => 0} curLabel="Tasks" prevLabel="" single fmt={full} labelWidth={230} selected={sel("status")} onPick={pick("status")} />
      </Box>
      <Box id="gqs-task-list" sx={{ scrollMarginTop: 16, minWidth: 0 }}>
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="GQS tickets" note={`${full(shown.length)} of ${full(rows.length)} created ${p.label}, newest first`}
            right={narrow ? (
              <Box component="button" type="button" onClick={() => setNarrow(null)} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1.25, pr: 0.75, py: 0.5, borderRadius: "999px", border: "1px solid #2459d1", bgcolor: "rgba(36,89,209,.08)", color: "#2459d1", fontSize: "0.8rem", fontWeight: 600 }}>
                {NARROW[narrow.by].name}: {narrow.label}<CloseIcon sx={{ fontSize: 14 }} />
              </Box>
            ) : undefined} />
          {shown.length ? (
            <>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow>{["Created", "Request", "Given to", "Owner today", "Now", "Sales ticket", "Sales ticket owner"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {slice.map((r) => (
                      <TableRow key={r.id}>
                        {dateCell(r)}
                        <TableCell sx={bodyCell}>{link(r, 300)}</TableCell>
                        <TableCell sx={small}>{givenOf(r)}</TableCell>
                        <TableCell sx={{ ...small, color: r.oj === "moved" ? INK : MUTED, fontWeight: r.oj === "moved" ? 700 : 400 }}>{r.oj === "kept" ? "the same" : ownerOf(r)}</TableCell>
                        <TableCell sx={{ ...small, color: NOW[nowOf(r)].color === DEEMPHASIS ? MUTED : NOW[nowOf(r)].color, fontWeight: 600 }}>{NOW[nowOf(r)].label}</TableCell>
                        <TableCell sx={small}>{r.sales ? <Box component="a" href={hsTicket(r.sales.id)} target="_blank" rel="noopener" sx={{ color: "inherit" }}>{salesStageOf(r)}</Box> : salesStageOf(r)}</TableCell>
                        <TableCell sx={small}>{r.sales ? salesOwnerOf(r) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {pager}
            </>
          ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No GQS task here.</Typography>}
        </GlassCard>
      </Box>
    </>
  );
}

/** Open now: every GQS task not in Offer Sent or Refused, whatever the period - by stage, then the list, oldest first. */
export function OpenNow({ store }: { store: GqsStore }) {
  const label = (id: string) => store.stages.find((s) => s.id === id)?.label ?? id;
  const open = store.rows.filter((r) => outcomeOf(r) === "open").sort((a, b) => a.created.localeCompare(b.created));
  const [stage, setStage] = useState<string | null>(null);
  const rows = stage ? open.filter((r) => label(r.stage) === stage) : open;
  const { slice, pager } = usePaged(rows, 15);
  const old = open.filter((r) => ageDays(r) > 30).length;
  // a task whose STATUS OF GQS already says how it ended, while its stage was never moved (01.11.2026: 18 of 58)
  const ended = open.filter((r) => resultOf(r) || /^offer sent/i.test((r.status ?? "").trim())).length;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PendingActionsOutlinedIcon />} tint="amber" title={`Open now, whenever created: ${full(open.length)}`}
        note={`Every GQS task not in Offer Sent to Sales or Refused, today - ${full(old)} of them created more than 30 days ago${ended ? `; ${full(ended)} already have their outcome in STATUS OF GQS (Offer Sent to Sales, WON or LOST) but were never moved to a closed stage` : ""}. Click a stage to see only its tasks`} />
      <BarList rows={byKey(open, (r) => label(r.stage)).map((x) => ({ label: x.label, value: x.s.n }))} labelWidth={190} format={(v) => full(v ?? 0)}
        onSelect={(l) => setStage(stage === l ? null : l)} selectedLabel={stage} emptyMessage="Nothing open." />
      {!!rows.length && (
        <Box sx={{ overflowX: "auto", mt: 2 }}>
          <Table size="small">
            <TableHead><TableRow>{["Created", "Open for", "Request", "Owner", "Stage", "STATUS OF GQS", "Sales ticket"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((r) => (
                <TableRow key={r.id}>
                  {dateCell(r)}
                  <TableCell sx={{ ...num, fontWeight: 700, color: ageDays(r) > 30 ? "#a96a12" : INK }}>{days(ageDays(r))}</TableCell>
                  <TableCell sx={bodyCell}>{link(r, 320)}</TableCell>
                  <TableCell sx={small}>{ownerOf(r)}</TableCell>
                  <TableCell sx={{ ...small, color: INK }}>{label(r.stage)}</TableCell>
                  <TableCell sx={small}>{r.status ?? "—"}</TableCell>
                  <TableCell sx={small}>{salesStageOf(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {pager}
    </GlassCard>
  );
}

/** One of GQS's tabs, from the store the page read once. */
export function GqsKpis({ view, store, from, to }: { view: GqsView; store: GqsStore; from: string; to: string }) {
  const openBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of store.rows) if (outcomeOf(r) === "open") m.set(ownerOf(r), (m.get(ownerOf(r)) ?? 0) + 1);
    return m;
  }, [store]);
  if (view === "gqs-tickets") return <Tickets store={store} from={from} to={to} />;
  if (view === "gqs-type") {
    return <Breakdown store={store} from={from} to={to} by={typeOf} title="type of request" first="Type of request"
      note={`Running Business, or New Business by profit centre (DT, KT, AT, ST, FT) - against the same number of days just before. The type is asked on every request since January 2026; one before that is "${NOT_ASKED}"`} />;
  }
  if (view === "gqs-people") {
    return <Breakdown store={store} from={from} to={to} by={ownerOf} title="GQS owner" first="GQS owner"
      note="The task's owner in HubSpot today - against the same number of days just before" extra={{ label: "Open now", v: (l) => openBy.get(l) ?? 0, tip: "Open GQS tasks the person owns today, whenever they were created" }}
      also={{ by: salesOwnerOf, title: "by the sales ticket's owner", first: "Sales ticket owner", hint: "The owner of the ESO / TSA ticket each request belongs to - the sales team's person" }} />;
  }
  if (view === "gqs-speed") return <Speed store={store} from={from} to={to} />;
  if (view === "gqs-resolution") return <Resolution store={store} from={from} to={to} />;
  return <Overview store={store} from={from} to={to} />;
}

/** The count of open GQS tasks, for the tab. */
export const openCount = (store: GqsStore | null) => (store ? store.rows.filter((r) => outcomeOf(r) === "open").length : null);
