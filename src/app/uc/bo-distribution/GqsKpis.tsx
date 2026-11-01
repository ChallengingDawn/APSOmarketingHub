"use client";

// BACK OFFICE DISTRIBUTION - GQS's own figures (SARCLA 01.11.2026: "GQS should have its own KPI subdivided like we do in
// advanced reporting - create a main toggle in between pipelines"). With GQS picked on the page's toggle, GQS has Back
// Office's tabs (SARCLA 01.11.2026: "keep the same then to GQS the same tab, but instead of sentiment resolution for win
// or lost"): Overview, Tickets, Flow, Type of request (Detection's place), Resolution (Sentiment's), Speed (Priority's),
// People, Settings. The figure tabs are here, each drawn the same way: the period's tasks against the same number of
// days just before (DimChart, blue this period, grey before), then "All the figures" with the same columns everywhere;
// Open now is on Tickets. Who gets a task, and by which rule, is GqsTab.tsx (Tickets, Flow, the team on People). Every
// task of the GQS pipeline is read every 30 minutes (src/lib/gqsFigures).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { DEEMPHASIS, DELTA, SERIES } from "@/app/charts/palette";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Choice, usePaged } from "@/app/connectors/parts";
import { dayOf, previousWindow, rangeLabel } from "@/lib/boDetection/figures";
import {
  GQS_STAGE, WORK_STAGES, ageDays, byKey, byMonth, daysToOffer, inPeriod, median, outcomeOf, ownerOf, refusedBy, resultOf, sentIn, stageTimes, sumOf, typeOf, wonShare,
  type GqsRow, type GqsStore, type Sum,
} from "@/lib/gqsFigures/figures";
import { pct } from "./shared";

/** GQS's figure tabs: Overview, Type of request (Detection's place), Resolution (Sentiment's), Speed (Priority's), People's figures. */
export type GqsView = "gqs" | "gqs-type" | "gqs-resolution" | "gqs-speed" | "gqs-people";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const days = (d: number | null) => (d === null ? "—" : d * 24 < 1 ? "under an hour" : d < 1 ? `${Math.round(d * 24)} hours` : `${d < 10 ? d.toFixed(1) : Math.round(d)} days`);
const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
/** The change of a count against the days before, for a tile. */
const delta = (now: number, was: number | null, versus: string, goodWhenUp = true) => (was ? { ratio: now / was - 1, versus, goodWhenUp } : undefined);

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
      // a period before the first task has nothing to compare with
      hasBefore: prev.to >= first,
    };
  }, [store, from, to]);
}

/** The columns every breakdown shows, in one order. */
type Col = { key: string; label: string; v: (s: Sum) => number | null; show: (s: Sum) => string; tip?: string };
const COLS: Col[] = [
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
const RES_COLS: Col[] = [
  { key: "n", label: "Requests", v: (s) => s.n, show: (s) => full(s.n) },
  { key: "offer", label: "Offers sent", v: (s) => s.offer, show: (s) => (s.offer ? full(s.offer) : "—") },
  { key: "won", label: "Won", v: (s) => s.won, show: (s) => (s.won ? full(s.won) : "—") },
  { key: "lost", label: "Lost", v: (s) => s.lost, show: (s) => (s.lost ? full(s.lost) : "—") },
  { key: "wait", label: "Waiting", v: (s) => s.waiting, show: (s) => (s.waiting ? full(s.waiting) : "—"), tip: "Offers sent whose outcome is not in STATUS OF GQS yet" },
  COLS.find((c) => c.key === "share")!,
];

/** "All the figures, by X": every column, sortable by its header, a total line, the first 25 then all. */
function FiguresTable({ title, rows, total, first, extra, cols = COLS }: {
  title: string; rows: { label: string; s: Sum }[]; total: Sum; first: string;
  extra?: { label: string; v: (label: string) => number; tip?: string }; cols?: Col[];
}) {
  const COLS = cols;
  const [by, setBy] = useState<string>("n");
  const [asc, setAsc] = useState(false);
  const [all, setAll] = useState(false);
  const col = COLS.find((c) => c.key === by);
  const val = (r: { label: string; s: Sum }) => (by === "label" ? null : by === "extra" ? extra?.v(r.label) ?? 0 : col?.v(r.s) ?? null);
  const sorted = [...rows].sort((a, b) => {
    if (by === "label") return asc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
    const x = val(a), y = val(b);
    if (x === y) return b.s.n - a.s.n;
    if (x === null) return 1;
    if (y === null) return -1;
    return asc ? x - y : y - x;
  });
  const shown = all ? sorted : sorted.slice(0, 25);
  const sort = (k: string) => { if (by === k) setAsc((x) => !x); else { setBy(k); setAsc(k === "label"); } };
  const head = (k: string, label: string, right: boolean, tip?: string) => (
    <TableCell key={k} sx={{ ...headCell, textAlign: right ? "right" : "left" }} title={tip}>
      <TableSortLabel active={by === k} direction={by === k && asc ? "asc" : "desc"} onClick={() => sort(k)}>{label}</TableSortLabel>
    </TableCell>
  );
  return (
    <>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, mt: 2.5, mb: 0.75 }}>{title}</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            {head("label", first, false)}
            {COLS.map((c) => head(c.key, c.label, true, c.tip))}
            {extra && head("extra", extra.label, true, extra.tip)}
          </TableRow></TableHead>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.label}>
                <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, ...clip(260) }}>{r.label}</TableCell>
                {COLS.map((c) => <TableCell key={c.key} sx={{ ...num, color: c.v(r.s) ? INK : MUTED }}>{c.show(r.s)}</TableCell>)}
                {extra && <TableCell sx={num}>{extra.v(r.label) ? full(extra.v(r.label)) : "—"}</TableCell>}
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: "rgba(36, 89, 209, 0.04)" }}>
              <TableCell sx={{ ...bodyCell, fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>All GQS requests</TableCell>
              {COLS.map((c) => <TableCell key={c.key} sx={{ ...num, fontWeight: 700 }}>{c.show(total)}</TableCell>)}
              {extra && <TableCell sx={{ ...num, fontWeight: 700 }}>{full(rows.reduce((a, r) => a + extra.v(r.label), 0))}</TableCell>}
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      {rows.length > 25 && (
        <Box component="button" type="button" onClick={() => setAll((x) => !x)} sx={{ all: "unset", cursor: "pointer", color: "#2459d1", fontSize: "0.8rem", fontWeight: 600, mt: 0.75 }}>
          {all ? "Show the first 25" : `Show all ${full(rows.length)}`}
        </Box>
      )}
    </>
  );
}

/**
 * The four counts. Requests and offers sent count by their own day, so they compare with the days before; refused and
 * won are what came of the period's requests so far - a young period has had less time, so they carry no comparison.
 */
function Tiles({ now, before, sentNow, sentBefore, label, beforeLabel, hasBefore }: {
  now: GqsRow[]; before: GqsRow[]; sentNow: GqsRow[]; sentBefore: GqsRow[]; label: string; beforeLabel: string; hasBefore: boolean;
}) {
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
        <FiguresTable title="All the figures, by month" first="Month" rows={months.map((m) => ({ label: monthLabel(m.label), s: m.s }))} total={sumOf(p.now)} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>WON and LOST are kept in STATUS OF GQS on almost every offer since February 2026; an earlier period shows few outcomes.</Typography>
      </GlassCard>
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
                      <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{rangeLabel(r.created.slice(0, 10), r.created.slice(0, 10))}</TableCell>
                      <TableCell sx={bodyCell}><Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || r.id}</Box></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{typeOf(r)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{refusedBy(r)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: r.reason ? INK : MUTED, minWidth: 220 }}>{r.reason ?? "no reason given"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{ownerOf(r)}</TableCell>
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

/** A breakdown tab: the tiles, this period against the days before by X, and every figure by X. */
function Breakdown({ store, from, to, by, title, first, note, extra }: {
  store: GqsStore; from: string; to: string; by: (r: GqsRow) => string; title: string; first: string; note: string;
  extra?: { label: string; v: (label: string) => number; tip?: string };
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
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title={`GQS requests created ${p.label}, by ${title}`} note={note} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
          <DimChart title={`Requests, by ${title}`} rows={chart} cur={(r) => r.now} prev={(r) => r.before} curLabel={p.label} prevLabel={p.beforeLabel} fmt={full} single={!p.hasBefore} labelWidth={190} />
          <DimChart title={`Offers sent to Sales ${p.label}, by ${title}`} rows={offers} cur={(r) => r.now} prev={(r) => r.before} curLabel={p.label} prevLabel={p.beforeLabel} fmt={full} single={!p.hasBefore} labelWidth={190} fixedOrder />
        </Box>
        <FiguresTable title={`All the figures, by ${title}`} first={first} rows={rows} total={sumOf(p.now)} extra={extra} />
      </GlassCard>
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
  const byType = byKey(p.sentNow, typeOf).filter((x) => x.s.days.length);
  const b = p.hasBefore ? toOffer(p.sentBefore) : null;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ScheduleOutlinedIcon />} tint="blue" label="Request to offer" value={days(toOffer(p.sentNow))}
          note={`The median of the ${full(p.sentNow.length)} offers sent ${p.label}, from their request.${b !== null ? ` ${p.beforeLabel}: ${days(b)}.` : ""}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{tile(GQS_STAGE.open, <PendingActionsOutlinedIcon />, "In Open the GQS Task")}</Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{tile(GQS_STAGE.waitingGqs, <HourglassEmptyOutlinedIcon />, "Waiting on GQS")}</Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>{tile(GQS_STAGE.waitingCustomer, <HourglassEmptyOutlinedIcon />, "Waiting on Customer")}</Grid>
      </Grid>
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
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, mt: 2.5, mb: 0.75 }}>Request to offer, by type of request</Typography>
        <BarList rows={byType.map((x) => ({ label: x.label, value: median(x.s.days) ?? 0, secondary: `${full(x.s.days.length)} offers` }))} labelWidth={190} format={(v) => days(v ?? null)} emptyMessage="No offer sent in this period." />
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
 * month; by type and by owner; where the sales ticket of an offer still waiting stands; and the requests themselves.
 * STATUS OF GQS carries WON / LOST, with no date - so this is what came of the period's requests so far, never compared
 * with the days before (they have had longer).
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
  const waiting = p.now.filter((r) => resOf(r) === "waiting");
  const [show, setShow] = useState<Res>("won");
  const list = p.now.filter((r) => resOf(r) === show).sort((a, b) => b.created.localeCompare(a.created));
  const { slice, pager } = usePaged(list, 10);
  const tiles: { k: Res; icon: React.ReactNode; tint: "green" | "pink" | "blue" | "slate"; note: string }[] = [
    { k: "won", icon: <EmojiEventsOutlinedIcon />, tint: "green", note: `${pct(s.won, s.n)} of the ${full(s.n)} requests created ${p.label}${w === null ? "" : ` - ${Math.round(w * 100)}% of the offers whose outcome is known`}.` },
    { k: "lost", icon: <DoNotDisturbOnOutlinedIcon />, tint: "pink", note: `${pct(s.lost, s.n)} of the requests.` },
    { k: "waiting", icon: <HourglassEmptyOutlinedIcon />, tint: "blue", note: `Offers sent to Sales with no WON or LOST in STATUS OF GQS yet - ${pct(s.waiting, s.offer)} of the offers.` },
    { k: "none", icon: <PendingActionsOutlinedIcon />, tint: "slate", note: `No offer and no outcome: ${full(p.now.filter((r) => resOf(r) === "none" && outcomeOf(r) === "refused").length)} refused, ${full(p.now.filter((r) => resOf(r) === "none" && outcomeOf(r) === "open").length)} still open.` },
  ];
  return (
    <>
      <Grid container spacing={2}>
        {tiles.map((t) => <Grid key={t.k} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={t.icon} tint={t.tint} label={RES[t.k].label} value={full(per(p.now, t.k))} note={t.note} /></Grid>)}
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<EmojiEventsOutlinedIcon />} tint="green" title="Won and lost, month by month"
          note={`The ${full(s.n)} GQS requests created ${p.label}, by what came of them so far. WON and LOST are kept in STATUS OF GQS on almost every offer since February 2026`} />
        <ChartFrame caption="GQS requests per month, by outcome" table={table} empty={p.now.length ? null : "No GQS request in this period."}>
          <StackedColumns data={data} parts={keys.map((k) => ({ key: k, label: RES[k].label, color: RES[k].color }))} format={(v) => full(v ?? 0)} xFormat={monthLabel} />
        </ChartFrame>
        <FiguresTable title="All the figures, by month" first="Month" rows={months.map((m) => ({ label: monthLabel(m.label), s: m.s }))} total={s} cols={RES_COLS} />
        <FiguresTable title="By type of request" first="Type of request" rows={byKey(p.now, typeOf)} total={s} cols={RES_COLS} />
        <FiguresTable title="By owner" first="Owner" rows={byKey(p.now, ownerOf)} total={s} cols={RES_COLS} />
      </GlassCard>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HourglassEmptyOutlinedIcon />} tint="blue" title={`Offers waiting for their outcome: ${full(waiting.length)}`}
          note="Where the sales ticket of each stands now (ESO PIPELINE STATUS (FOR GQS)) - a closed sales ticket with no WON or LOST is an outcome nobody wrote down" />
        <BarList rows={byKey(waiting, (r) => r.eso ?? "No sales ticket status").map((x) => ({ label: x.label, value: x.s.n }))} labelWidth={220} format={(v) => full(v ?? 0)} emptyMessage="None waiting." />
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
                <TableHead><TableRow>{["Created", "Request", "Owner", "STATUS OF GQS", "Sales ticket", "Days to offer"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i === 5 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {slice.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{rangeLabel(r.created.slice(0, 10), r.created.slice(0, 10))}</TableCell>
                      <TableCell sx={bodyCell}><Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(340) }}>{r.subject || r.id}</Box></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{ownerOf(r)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{r.status ?? "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{r.eso ?? "—"}</TableCell>
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
      <CardTitle icon={<PendingActionsOutlinedIcon />} tint="amber" title={`Open now: ${full(open.length)}`}
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
                  <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{rangeLabel(r.created.slice(0, 10), r.created.slice(0, 10))}</TableCell>
                  <TableCell sx={{ ...num, fontWeight: 700, color: ageDays(r) > 30 ? "#a96a12" : INK }}>{days(ageDays(r))}</TableCell>
                  <TableCell sx={bodyCell}><Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>{r.subject || r.id}</Box></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{ownerOf(r)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: INK, whiteSpace: "nowrap" }}>{label(r.stage)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{r.status ?? "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{r.eso ?? "—"}</TableCell>
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
  if (view === "gqs-type") {
    return <Breakdown store={store} from={from} to={to} by={typeOf} title="type of request" first="Type of request"
      note="Running Business, or New Business by profit centre (DT, KT, AT, ST, FT) - against the same number of days just before. The type is set on almost every request since February 2026; earlier ones are mostly No type" />;
  }
  if (view === "gqs-people") {
    return <Breakdown store={store} from={from} to={to} by={ownerOf} title="owner" first="Owner"
      note="The task's owner in HubSpot today - against the same number of days just before" extra={{ label: "Open now", v: (l) => openBy.get(l) ?? 0, tip: "Open GQS tasks the person owns today, whenever they were created" }} />;
  }
  if (view === "gqs-speed") return <Speed store={store} from={from} to={to} />;
  if (view === "gqs-resolution") return <Resolution store={store} from={from} to={to} />;
  return <Overview store={store} from={from} to={to} />;
}

/** The count of open GQS tasks, for the tab. */
export const openCount = (store: GqsStore | null) => (store ? store.rows.filter((r) => outcomeOf(r) === "open").length : null);
