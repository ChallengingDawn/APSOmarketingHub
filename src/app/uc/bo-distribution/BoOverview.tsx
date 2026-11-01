"use client";

// BACK OFFICE DISTRIBUTION - Back Office's Overview and Tickets, for ANY period (SARCLA 01.11.2026, on "Entered New
// 15 Oct 2026 - 1 Nov 2026" under a 365-day period: "we should see the last 365 days in every report, the time filter
// on top should really filter it - I know that new rules came in now, but we can back-track"). They were drawn from
// the routing's own record of each decision, which begins with the hub (19.10.2026) and is kept 21 days. Now they are
// counted from every Back Office ticket in HubSpot (src/lib/boDetection, every 30 minutes): the owner each was given
// when it arrived and what became of it, from the owner's history - the workflow's routing before 19.10.2026, the
// hub's since; the hub's rule where it recorded one; the topic each has today. The cards are advanced reporting's:
// this period against the same number of days just before (DimChart, a page of ten at a time), then "All the figures".

import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { ChartBox, FullTable, TWO, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Choice, usePaged } from "@/app/connectors/parts";
import type { Row } from "@/lib/boDistribution/engine";
import type { ListItem, PeriodFigures } from "@/lib/boDetection/engine";
import { OWNER_JS, WORKFLOW_RULE, previousWindow, rangeLabel, type OwnerJ } from "@/lib/boDetection/figures";
import { Detail, STEP, pct, type Data } from "./shared";
import { StraysCard } from "./StraysCard";
import { ChatCard } from "./ChatCard";

/** The period's figures as the route gives them: the count, and the owners' names by id. */
type Figures = PeriodFigures & { owners: Record<string, string> };
const useFigures = (from: string, to: string) => {
  const url = `/api/uc/bo-distribution?detection=1&from=${from}&to=${to}`;
  return useHeld<Figures>(url, [url]).result;
};

/** What became of the owner a ticket was given (figures.ts OwnerJ), in the order the chart stacks them. */
export const OJ: Record<OwnerJ, { label: string; color: string }> = {
  kept: { label: "Kept the owner given", color: SERIES[0] },
  moved: { label: "Moved by a person", color: SERIES[1] },
  later: { label: "Given again later", color: SERIES[3] },
  none: { label: "No owner given", color: DEEMPHASIS },
};
/** The hub's rule for a ticket; before the hand-over the workflow routed and recorded no rule per ticket. */
export const ruleName = (k: string) =>
  STEP[k] ?? (k === WORKFLOW_RULE ? "Before 19.10.2026 (the workflow - not recorded)" : k === "-" ? "The hub - no rule gave an owner" : k ? `Step ${k}` : "Not in the hub's record");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const catName = (c: string) => (!c || c === "(empty)" ? "No category" : c);
const sum = (m: Partial<Record<string, number>> | undefined) => Object.values(m ?? {}).reduce<number>((a, n) => a + (n ?? 0), 0);

function namer(f: Figures) {
  return (id: string) => (id ? f.owners[id] ?? `Owner ${id}` : "No owner");
}
const loading = (r: ReturnType<typeof useFigures>, what: string) =>
  r === null ? <LoadingPanel label={`Counting the Back Office tickets ${what}…`} />
    : r.state !== "ok" ? <Typography sx={{ color: RED, fontSize: "0.86rem" }}>{r.state === "error" ? r.error : "not configured"}</Typography>
    : null;

/**
 * The four counts, one unit - tickets: the period's, then what became of the owner each was given (they add up). The
 * tickets compare with the days before; what became of the owner does not - an older ticket has had longer to be moved.
 */
function OwnerTiles({ f, label }: { f: Figures; label: string }) {
  const n = f.now.n, oj = f.now.oj ?? {};
  const kept = oj.kept ?? 0, moved = oj.moved ?? 0, later = oj.later ?? 0, none = oj.none ?? 0;
  const given = kept + moved + later;
  const prev = previousWindow(f.now.from, f.now.to);
  // a period before the pipeline began (March 2025) holds part of its days only - nothing to compare with
  const was = full_(f) ? f.before.n : 0;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ConfirmationNumberOutlinedIcon />} tint="blue" label="Back Office tickets" value={full(n)}
        delta={was ? { ratio: n / was - 1, versus: rangeLabel(prev.from, prev.to), goodWhenUp: true } : undefined} note={`Created ${label}${was ? `; ${full(was)} the days before` : ""}.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PersonOutlineOutlinedIcon />} tint="green" label={OJ.kept.label} value={full(kept)}
        note={`${pct(kept, given)} of the ${full(given)} given an owner when they arrived - they still have that owner.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="amber" label={OJ.moved.label} value={full(moved)}
        note={`${pct(moved, given)} of those given an owner - a person gave them to someone else afterwards.`} /></Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ScheduleOutlinedIcon />} tint="slate" label="Given later, or not at all" value={full(later + none)}
        note={`${full(later)} got another owner from the routing or a workflow later (waiting for someone available, a merge); ${full(none)} had no owner in their first half hour.`} /></Grid>
    </Grid>
  );
}

/** The days before the period are all inside the Back Office's history - else a comparison would read a short period as growth. */
const full_ = (f: Figures) => !!f.since && previousWindow(f.now.from, f.now.to).from >= f.since;

/** Overview: the counts, the period day by day or month by month, who got them, what they are, the rule, deliveries. */
export function BoOverview({ d, from, to, label }: { d: Data; from: string; to: string; label: string }) {
  const r = useFigures(from, to);
  const [pick, setPick] = useState<Pick | null>(null);
  const wait = loading(r, label);
  if (wait || r?.state !== "ok") return wait;
  const f = r.data;
  if (!f.now.n && f.missing.length) return <LoadingPanel label="The Back Office tickets are counted again after a release - the first count takes a few minutes" />;
  return <OverviewBody f={f} d={d} label={label} pick={pick} setPick={setPick} />;
}

type Pick = { kind: "given" | "today" | "rule"; key: string; label: string };

function OverviewBody({ f, d, label, pick, setPick }: { f: Figures; d: Data; label: string; pick: Pick | null; setPick: (p: Pick | null) => void }) {
  const name = namer(f);
  const prev = previousWindow(f.now.from, f.now.to);
  const before = rangeLabel(prev.from, prev.to);
  const single = !full_(f);
  const byDay = f.byDay.length <= 62;
  const data = byDay
    ? f.byDay.map((x) => ({ x: x.d, kept: x.oj.kept ?? 0, moved: x.oj.moved ?? 0, later: x.oj.later ?? 0, none: x.oj.none ?? 0 }))
    : f.byMonth.map((m) => ({ x: m.ym, kept: m.oj.kept ?? 0, moved: m.oj.moved ?? 0, later: m.oj.later ?? 0, none: m.oj.none ?? 0 }));
  // who got them: each owner given, this period and the days before - by name, one person being two HubSpot owners at times
  const own = f.now.own ?? {}, ownB = f.before.own ?? {};
  const byName = new Map<string, { id: string; label: string; n: number; b: number; oj: Partial<Record<OwnerJ, number>> }>();
  for (const id of new Set([...Object.keys(own), ...Object.keys(ownB)])) {
    const label = name(id);
    const x = byName.get(label) ?? { id: "", label, n: 0, b: 0, oj: {} };
    x.id = x.id ? `${x.id},${id}` : id;
    x.n += sum(own[id]); x.b += sum(ownB[id]);
    for (const k of OWNER_JS) if (own[id]?.[k]) x.oj[k] = (x.oj[k] ?? 0) + own[id]![k]!;
    byName.set(label, x);
  }
  const owners = [...byName.values()].filter((x) => x.n || x.b);
  const topics = [...new Set([...Object.keys(f.now.topics), ...Object.keys(f.before.topics)])].map((c) => ({ id: c, label: catName(c), n: sum(f.now.topics[c]), b: sum(f.before.topics[c]) })).filter((x) => x.n || x.b);
  const rule = f.now.rule ?? {}, ruleB = f.before.rule ?? {};
  const rules = [...new Set([...Object.keys(rule), ...Object.keys(ruleB)])].map((k) => ({ id: k, label: ruleName(k), n: rule[k] ?? 0, b: ruleB[k] ?? 0 })).filter((x) => x.n || x.b);
  const del = f.now.del ?? {}, delB = f.before.del ?? {}, c2s = f.now.c2s ?? {};
  const subs = [...new Set([...Object.keys(del), ...Object.keys(delB)])].map((k) => ({ id: k, label: k || "No sub-category", n: del[k] ?? 0, b: delB[k] ?? 0, c2s: c2s[k] ?? 0 })).filter((x) => x.n || x.b);
  const deliveries = sum(del), cut = sum(c2s);
  const choose = (kind: Pick["kind"], rows: { id: string; label: string }[]) => (l: string) => {
    const x = rows.find((y) => y.label === l);
    if (!x) return;
    setPick(pick?.kind === kind && pick.key === x.id ? null : { kind, key: x.id, label: l });
    if (typeof document !== "undefined") setTimeout(() => document.getElementById("bo-overview-tickets")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const ownerCols: Col<(typeof owners)[number]>[] = [
    { key: "n", head: "Tickets given", cell: (x) => full(x.n), sort: (x) => x.n },
    { key: "share", head: "Share of the period", cell: (x) => pct(x.n, f.now.n), sort: (x) => x.n },
    ...OWNER_JS.filter((k) => k !== "none").map((k) => ({ key: k, head: OJ[k].label, cell: (x: (typeof owners)[number]) => (x.oj[k] ? `${full(x.oj[k]!)} · ${pct(x.oj[k]!, x.n)}` : "—"), sort: (x: (typeof owners)[number]) => x.oj[k] ?? 0 })),
    ...(single ? [] : [{ key: "b", head: before, cell: (x: (typeof owners)[number]) => (x.b ? full(x.b) : "—"), sort: (x: (typeof owners)[number]) => x.b }]),
  ];
  const total = { id: "", label: "All Back Office tickets", n: f.now.n, b: f.before.n, oj: f.now.oj ?? {} };
  return (
    <>
      {!!f.missing.length && <Counting missing={f.missing} />}
      <OwnerTiles f={f} label={label} />
      <StraysCard d={d} />
      <ChatCard d={d} />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="blue" title={byDay ? "Day by day" : "Month by month"}
          note={`The ${full(f.now.n)} Back Office tickets created ${label}, by what became of the owner each was given when it arrived - the workflow's routing until 19.10.2026, the hub's since. Until February 2026 most were given to the Backoffice Team queue and a person took each from there, so they count as moved${byDay ? "" : ". The first and last month count only the days inside the period"}`} />
        <StackedColumns data={data} parts={OWNER_JS.map((k) => ({ key: k, label: OJ[k].label, color: OJ[k].color }))} format={(v) => full(v ?? 0)}
          xFormat={byDay ? (x) => `${x.slice(8, 10)}.${x.slice(5, 7)}` : monthLabel} />
      </GlassCard>
      <Box sx={TWO}>
        <DimChart title={`Who got them, ${label}`} rows={owners} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={170} single={single}
          curNote={(x) => (x.oj.moved ? { text: `${pct(x.oj.moved, x.n)} moved`, color: MUTED } : null)}
          selected={pick?.kind === "given" ? [pick.label] : undefined} onPick={choose("given", owners)} />
        <DimChart title={`What they are about, ${label}`} rows={topics} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={190} single={single}
          selected={pick?.kind === "today" ? [pick.label] : undefined} onPick={choose("today", topics)} />
      </Box>
      <Box sx={TWO}>
        <DimChart title={`Which rule picked, ${label}`} rows={rules} cur={(x) => x.n} prev={(x) => x.b} curLabel={label} prevLabel={before} fmt={full} labelWidth={230} single={single}
          selected={pick?.kind === "rule" ? [pick.label] : undefined} onPick={choose("rule", rules)} />
        <DimChart title={`Deliveries by sub-category: ${full(deliveries)}, of which cut-to-size ${full(cut)} (${pct(cut, deliveries)})`} rows={subs} cur={(x) => x.n} prev={(x) => x.b}
          curLabel={label} prevLabel={before} fmt={full} labelWidth={210} single={single} curNote={(x) => (x.c2s ? { text: `${full(x.c2s)} C2S`, color: MUTED } : null)} />
      </Box>
      <ChartBox title={`All the figures, ${label}, by owner given`}
        hint={`Each person or team the routing gave tickets to when they arrived, and what became of them${single ? "" : ` - against ${before}`} · a click on a row lists its tickets`}>
        <FullTable first="Owner given" cols={ownerCols} rows={owners} total={total} onPick={choose("given", owners)} selected={pick?.kind === "given" ? [pick.label] : undefined} find="an owner" />
      </ChartBox>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: -1 }}>
        The rule is the hub&rsquo;s own record of each decision, since it took the routing over on 19.10.2026; the workflow before it recorded none per ticket.
        A topic is the one each ticket has today - how it got there, from intake to the hub&rsquo;s reading, is on Detection.
      </Typography>
      {pick && (
        <Box id="bo-overview-tickets" sx={{ scrollMarginTop: 16, minWidth: 0 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title={`${pick.kind === "given" ? "Given to" : pick.kind === "rule" ? "Rule" : "Topic"}: ${pick.label}`} note={`Created ${label} - newest first; a row shows the hub's reasons and HubSpot now`}
              right={<Button size="small" onClick={() => setPick(null)} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}>Close</Button>} />
            <TicketList from={f.now.from} to={f.now.to} names={f.owners} fixed={{ [pick.kind]: pick.key }} />
          </GlassCard>
        </Box>
      )}
    </>
  );
}

/** After a release every month is counted again, the newest first - until then the period's older months are missing. */
function Counting({ missing }: { missing: string[] }) {
  return (
    <Typography sx={{ fontSize: "0.84rem", color: "#a96a12", fontWeight: 600 }}>
      Still counting {missing.length === 1 ? monthLabel(missing[0]) : `${missing.length} months (${monthLabel(missing[0])} to ${monthLabel(missing[missing.length - 1])})`} - the figures below leave {missing.length === 1 ? "it" : "them"} out until the count reaches {missing.length === 1 ? "it" : "them"}, a few minutes after a release.
    </Typography>
  );
}

/** One ticket opened: the hub's reasons and HubSpot now, read when asked. */
function Opened({ id }: { id: string }) {
  const r = useHeld<Row>(`/api/uc/bo-distribution?ticket=${id}`, [id]).result;
  if (r === null) return <CircularProgress size={14} />;
  if (r.state !== "ok") return <Typography sx={{ fontSize: "0.8rem", color: RED }}>{r.state === "error" ? r.error : "not configured"}</Typography>;
  return <Detail r={r.data} />;
}

/** The tickets of the period narrowed to a pick: newest first, the 300 newest of any number. */
function TicketList({ from, to, names, fixed }: { from: string; to: string; names: Record<string, string>; fixed: Record<string, string> }) {
  const [oj, setOj] = useState<OwnerJ | "all">("all");
  const [q, setQ] = useState(""), [asked, setAsked] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const params = new URLSearchParams({ detection: "list", from, to, ...fixed, ...(oj !== "all" ? { oj } : {}), ...(asked ? { q: asked } : {}) });
  const url = `/api/uc/bo-distribution?${params}`;
  const r = useHeld<{ rows: ListItem[]; total: number; oj: Partial<Record<OwnerJ, number>> }>(url, [url]).result;
  const rows = r?.state === "ok" ? r.data.rows : [];
  const { slice, pager } = usePaged(rows, 25);
  const name = (id: string | undefined) => (id ? names[id] ?? `Owner ${id}` : "nobody");
  const counts = r?.state === "ok" ? r.data.oj : {};
  const all = sum(counts);
  return (
    <>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
        <Choice<OwnerJ | "all"> value={oj} onChange={setOj} options={[{ key: "all", label: "All", count: all }, ...OWNER_JS.map((k) => ({ key: k, label: OJ[k].label, count: counts[k] ?? 0 }))]} />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setAsked(q.trim()); }} sx={{ display: "flex", gap: 0.75 }}>
          <TextField size="small" placeholder="words of the subject, or a ticket number" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 280 }} />
          <Button type="submit" size="small" variant="outlined" sx={{ textTransform: "none" }}>Find</Button>
          {asked && <Button size="small" onClick={() => { setQ(""); setAsked(""); }} sx={{ textTransform: "none" }}>Clear</Button>}
        </Box>
        {r === null && <CircularProgress size={14} />}
      </Box>
      {r?.state === "ok" && r.data.total > rows.length && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>The {full(rows.length)} newest of {full(r.data.total)} - a word of the subject or a shorter period narrows them.</Typography>}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Created", "Ticket", "Topic", "Given to", "Owner today", "Rule"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((x) => (
              <Fragment key={x.id}>
                <TableRow hover onClick={() => setOpen(open === x.id ? null : x.id)} sx={{ cursor: "pointer" }}>
                  <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{rangeLabel(x.d, x.d)}</TableCell>
                  <TableCell sx={bodyCell}><Box component="a" href={hsTicket(x.id)} target="_blank" rel="noopener" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>{x.s || x.id}</Box></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {catName(x.t)}
                    {x.i !== x.t && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>came as {catName(x.i)}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{name(x.o)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: x.oj === "kept" ? MUTED : INK, fontWeight: x.oj === "moved" ? 700 : 400 }}>
                    {x.oj === "kept" ? "the same" : name(x.n)}
                    {x.oj && x.oj !== "kept" && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{OJ[x.oj].label.toLowerCase()}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, ...clip(220) }}>{ruleName(x.r ?? "")}</TableCell>
                </TableRow>
                {open === x.id && <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}><Opened id={x.id} /></TableCell></TableRow>}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {r?.state === "ok" && !rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No ticket.</Typography>}
    </>
  );
}

/** Tickets: the same four counts as Overview, any ticket checked, and every ticket of the period with its owner's story. */
export function BoTickets({ from, to, label }: { from: string; to: string; label: string }) {
  const r = useFigures(from, to);
  const [id, setId] = useState("");
  const [check, setCheck] = useState<string | null>(null);
  const wait = loading(r, label);
  return (
    <>
      {wait ?? (r?.state === "ok" && <>{!!r.data.missing.length && <Counting missing={r.data.missing} />}<OwnerTiles f={r.data} label={label} /></>)}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Check a ticket" note="Any ticket number: the routing's reasons, the hub and HubSpot side by side, now - nothing stored, nothing written" />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField size="small" placeholder="ticket number" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} sx={{ width: 220 }} />
          <Button variant="outlined" size="small" disabled={!id} onClick={() => setCheck(id)} sx={{ textTransform: "none" }}>Check</Button>
        </Box>
        {check && <Box sx={{ mt: 1.5 }}><Opened id={check} /></Box>}
      </GlassCard>
      {r?.state === "ok" && (
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Ticket by ticket"
            note={`Every Back Office ticket created ${label}: its topic, the owner it was given when it arrived and the one it has today, the hub's rule - a row shows the hub's reasons and HubSpot now`} />
          <TicketList from={from} to={to} names={r.data.owners} fixed={{}} />
        </GlassCard>
      )}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Counted every 30 minutes from HubSpot{r?.state === "ok" && r.data.countedAt ? `, the oldest month counted ${new Date(r.data.countedAt).toLocaleString()}` : ""}.</Typography>
    </>
  );
}

