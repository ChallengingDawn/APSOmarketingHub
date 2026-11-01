"use client";

// BACK OFFICE DISTRIBUTION - the Detection tab: how every Back Office ticket of the period got the topic it has.
//
// SARCLA 01.11.2026, on the tab as it was: the topics table still had "Others" and "No category" rows ("this should
// really be classified, all the others"), and below it "What the 387 Others are" and "How to shrink Others" counted
// something else entirely - the e-mails the routing had read in its own store, as the keywords saw them at intake,
// next to a table of every ticket as HubSpot has it today ("then figures don't match - rethink the app based on the
// logic we have and improve it a lot"). So the tab now follows the logic the topics are made by, from ONE count
// (src/lib/boDetection, every Back Office ticket of the period, from HubSpot):
//   1. intake - the routing's keywords, the form or app the ticket came from, or the person who created it;
//   2. the hub's reading - the sentiment flag says what a machine's or a colleague's mail is, the AI reads the rest,
//      two hours after the ticket arrived (still open) or at its close (ticketClose/engine.ts);
//   3. a person re-filing it.
// The four tiles are those three and what is still Others, and they add up to the period's tickets; then what the
// tickets are (the three groups accepted 27.10.2026), what changed after intake (a line opens its tickets), what is
// still open on Others; the classifier to try and its keyword lists last. The routing's e-mail by e-mail comparison of
// the keyword classifier and the improved one is gone with the cards it fed.

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
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS } from "@/app/charts/palette";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { ListItem, PeriodFigures } from "@/lib/boDetection/engine";
import { JOURNEYS, pairOf, rangeLabel, type How, type Journey, type Win } from "@/lib/boDetection/figures";
import { FLAG_TOPICS, TOPIC } from "@/lib/ticketClose/topics";
import { pct, type Data } from "./shared";

type Both = { v1: Classification; v2: Classification & { fixes: string[] } };
const sub = (c: string | null | undefined) => (c ? ` / ${c}` : "");

function Answer({ cat, subCat, words, fixes, d }: { cat: string; subCat?: string | null; words?: string[]; fixes?: string[]; d: Data }) {
  return (
    <Box sx={{ display: "grid", gap: 0.4 }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: cat === "Others" ? MUTED : INK }}>{cat}{sub(subCat)}</Typography>
      {!!fixes?.length && (
        <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap" }}>
          {fixes.map((f) => { const fx = d.fixes.find((x) => x.id === f); return <Tooltip key={f} title={fx?.description ?? f}><span><Chip tint="green">{fx?.title ?? f}</Chip></span></Tooltip>; })}
        </Box>
      )}
      {!!words?.length && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{words.slice(0, 6).join(" · ")}</Typography>}
    </Box>
  );
}

const isTopic = (c: string) => c !== "Others" && c !== "(empty)" && c !== "";
const notAsked = (c: string) => FLAG_TOPICS.includes(c) || c === TOPIC.spam || c === TOPIC.gqs;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
/** a category as a person reads it: none is "No category" */
const catName = (c: string) => (c === "(empty)" || !c ? "No category" : c);
const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };

/** The four ways a ticket of the period came to its topic - the tiles, the table rows, the list's choice. */
const JOURNEY: Record<Journey, { label: string; short: string; note: string }> = {
  kept: { label: "Kept the topic it came with", short: "Came with it", note: "the routing's keywords, the form or app it came from, or the person who created it" },
  hub: { label: "Topic found by the hub", short: "Found by the hub", note: "it came with Others or none: the sentiment flag or the AI read it, two hours after it arrived or at its close" },
  person: { label: "Re-filed by a person", short: "Re-filed by a person", note: "a person gave it another topic than the one it came with" },
  open: { label: "Still Others", short: "Still Others", note: "open tickets on Others or with no category - the hub reads them two hours after they arrive" },
};
/** Who set the topic a ticket has today, in words (the list's last column). */
const HOW: Record<How, string> = {
  person: "a person", flag: "the sentiment flag", ai: "the AI, on the conversation", guess: "the AI's closest topic", source: "the form or app",
  keywords: "the keywords", none: "—",
};

/**
 * Three groups, the same colour in every month (SARCLA 27.10.2026: "graphs still really confusing" - chose one chart,
 * three groups, a group's topics on a click): what customers asked, what was not a customer request, and what is still
 * Others (open tickets, decided two hours after they arrive).
 */
type Group = "asked" | "not" | "open";
const GROUPS: { key: Group; label: string; of: (c: string) => boolean }[] = [
  { key: "asked", label: "Customer request", of: (c) => isTopic(c) && !notAsked(c) },
  { key: "not", label: "Not a customer request", of: (c) => notAsked(c) },
  { key: "open", label: "Still Others", of: (c) => !isTopic(c) },
];
const groupOf = (c: string) => GROUPS.find((g) => g.of(c))!.key;

/** What the tickets of the period are: month by month in three groups, a group's topics, and every figure. */
function Splits({ f, w, label }: { f: PeriodFigures; w: Win; label: string }) {
  const [group, setGroup] = useState<Group>("asked");
  const months = f.byMonth;
  const topics = Object.entries(w.topics).map(([c, hows]) => ({ c, n: Object.values(hows).reduce((a, x) => a + (x ?? 0), 0), g: groupOf(c), tj: w.tj[c] ?? {} }))
    .sort((a, b) => b.n - a.n);
  const inGroup = (g: Group, m: Record<string, number>) => Object.entries(m).filter(([c]) => groupOf(c) === g).reduce((t, [, n]) => t + n, 0);
  const groupN = (g: Group) => topics.filter((t) => t.g === g).reduce((a, t) => a + t.n, 0);
  // a group with nothing in the period is not drawn - "Still Others" disappears once every ticket has its topic
  const shown = GROUPS.filter((g) => groupN(g.key) > 0);
  const data = months.map((m) => ({ x: m.ym, asked: inGroup("asked", m.topics), not: inGroup("not", m.topics), open: inGroup("open", m.topics) }));
  const table: TableTwin = {
    columns: ["Month", ...shown.map((g) => g.label), "All Back Office tickets"],
    rows: data.map((r) => [monthLabel(r.x), ...shown.map((g) => r[g.key]), r.asked + r.not + r.open]),
    numeric: shown.map((_, i) => i + 1).concat(shown.length + 1),
  };
  const monthTotal = (ym: string, g?: Group) => Object.entries(months.find((m) => m.ym === ym)?.topics ?? {}).filter(([c]) => !g || groupOf(c) === g).reduce((t, [, n]) => t + n, 0);
  const share = (tj: Partial<Record<Journey, number>>, j: Journey, n: number) => (tj[j] ? pct(tj[j]!, n) : "—");
  const Line = ({ title, n, cells, strong, tj }: { title: string; n: number; cells: number[]; strong?: boolean; tj?: Partial<Record<Journey, number>> }) => (
    <TableRow sx={strong ? { bgcolor: "rgba(36, 89, 209, 0.04)" } : undefined}>
      <TableCell sx={{ ...bodyCell, fontWeight: strong ? 800 : 600, whiteSpace: "nowrap", color: INK }}>{title}</TableCell>
      {cells.map((v, i) => <TableCell key={months[i].ym} sx={{ ...num, fontWeight: strong ? 700 : 400, color: v ? INK : MUTED }}>{v ? full(v) : "—"}</TableCell>)}
      <TableCell sx={{ ...num, fontWeight: 800 }}>{full(n)}</TableCell>
      <TableCell sx={{ ...num, color: MUTED }}>{pct(n, w.n)}</TableCell>
      <TableCell sx={{ ...num, color: MUTED }}>{tj ? share(tj, "kept", n) : ""}</TableCell>
      <TableCell sx={{ ...num, color: MUTED }}>{tj ? share(tj, "person", n) : ""}</TableCell>
    </TableRow>
  );
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="blue" title="What the Back Office tickets are"
        note={`The ${full(w.n)} Back Office tickets created ${label}, by the topic they have today, month by month. The first and last month count only the days inside the period`} />
      <ChartFrame caption="Back Office tickets per month" table={table} empty={w.n ? null : "No ticket in this period."}>
        <StackedColumns data={data} parts={shown.map(({ key, label: l }) => ({ key, label: l, color: key === "open" ? DEEMPHASIS : undefined }))} format={(v) => full(v ?? 0)} xFormat={monthLabel} />
      </ChartFrame>
      <Box sx={{ mt: 2.5, mb: 1.25 }}>
        <Choice<Group> value={shown.some((g) => g.key === group) ? group : "asked"} onChange={setGroup} options={shown.map((g) => ({ key: g.key, label: g.label, count: groupN(g.key) }))} />
      </Box>
      <BarList rows={topics.filter((t) => t.g === group).map((t) => ({ label: catName(t.c), value: t.n }))} labelWidth={230} format={(v) => `${full(v ?? 0)} · ${pct(v ?? 0, w.n)}`}
        emptyMessage="None in this period." />
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, mt: 2.5, mb: 0.75 }}>All the figures</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["", ...months.map((m) => monthLabel(m.ym)), "Tickets", "Share", "Came with it", "Re-filed by a person"].map((h, i) => (
            <TableCell key={h || "topic"} sx={{ ...headCell, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</TableCell>
          ))}</TableRow></TableHead>
          <TableBody>
            {shown.map((g) => (
              <Fragment key={g.key}>
                <Line title={g.label} n={groupN(g.key)} cells={months.map((m) => monthTotal(m.ym, g.key))} strong />
                {topics.filter((t) => t.g === g.key).map((t) => <Line key={t.c} title={`   ${catName(t.c)}`} n={t.n} cells={months.map((m) => m.topics[t.c] ?? 0)} tj={t.tj} />)}
              </Fragment>
            ))}
            <Line title="All Back Office tickets" n={w.n} cells={months.map((m) => monthTotal(m.ym))} strong tj={w.j} />
          </TableBody>
        </Table>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>
        Came with it = the share of a topic&apos;s tickets that still have the topic they arrived with; re-filed by a person = the share a person gave that topic afterwards.
      </Typography>
    </GlassCard>
  );
}

/** How the tickets of each month came to their topic - the tiles' four, month by month. */
function JourneyTable({ f, w }: { f: PeriodFigures; w: Win }) {
  const months = f.byMonth;
  const total = (ym: string) => JOURNEYS.reduce((a, j) => a + (months.find((m) => m.ym === ym)?.j[j] ?? 0), 0);
  const rows = JOURNEYS.filter((j) => j !== "open" || (w.j.open ?? 0) > 0);
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<RouteOutlinedIcon />} tint="green" title="How each ticket got its topic, month by month"
        note="At intake, by the hub's reading afterwards, or by a person - every ticket of a month is in exactly one line" />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["", ...months.map((m) => monthLabel(m.ym)), "Tickets", "Share"].map((h, i) => (
            <TableCell key={h || "how"} sx={{ ...headCell, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</TableCell>
          ))}</TableRow></TableHead>
          <TableBody>
            {rows.map((j) => (
              <TableRow key={j}>
                <TableCell sx={{ ...bodyCell, fontWeight: 600, whiteSpace: "nowrap", color: INK }}>
                  <Tooltip title={JOURNEY[j].note}><Box component="span" tabIndex={0} sx={{ cursor: "help" }}>{JOURNEY[j].short}</Box></Tooltip>
                </TableCell>
                {months.map((m) => { const v = m.j[j] ?? 0; return <TableCell key={m.ym} sx={{ ...num, color: v ? INK : MUTED }}>{v ? `${full(v)} · ${pct(v, total(m.ym))}` : "—"}</TableCell>; })}
                <TableCell sx={{ ...num, fontWeight: 800 }}>{full(w.j[j] ?? 0)}</TableCell>
                <TableCell sx={{ ...num, color: MUTED }}>{pct(w.j[j] ?? 0, w.n)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: "rgba(36, 89, 209, 0.04)" }}>
              <TableCell sx={{ ...bodyCell, fontWeight: 800, color: INK }}>All Back Office tickets</TableCell>
              {months.map((m) => <TableCell key={m.ym} sx={{ ...num, fontWeight: 700 }}>{full(total(m.ym))}</TableCell>)}
              <TableCell sx={{ ...num, fontWeight: 800 }}>{full(w.n)}</TableCell>
              <TableCell sx={{ ...num, color: MUTED }}>100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

/** The tickets behind a line of the page - read from the same count, newest first. */
function Tickets({ from, to, pick, empty }: { from: string; to: string; pick: { intake?: string; today?: string; journey?: Journey }; empty: string }) {
  const qs = new URLSearchParams({ detection: "list", from, to });
  if (pick.intake !== undefined) qs.set("intake", pick.intake);
  if (pick.today !== undefined) qs.set("today", pick.today);
  if (pick.journey) qs.set("journey", pick.journey);
  const url = `/api/uc/bo-distribution?${qs}`;
  const r = useHeld<{ rows: ListItem[]; total: number }>(url, [url]).result;
  const rows = r?.state === "ok" ? r.data.rows : [];
  const { slice, pager } = usePaged(rows, 15);
  if (r === null) return <Box sx={{ display: "flex", gap: 1, alignItems: "center", py: 1 }}><CircularProgress size={14} /><Typography sx={{ fontSize: "0.82rem", color: MUTED }}>Reading the tickets…</Typography></Box>;
  if (r.state !== "ok") return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>The tickets could not be read - try again in a moment.</Typography>;
  if (!rows.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{empty}</Typography>;
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Created", "Ticket", "Came with", "Has today", "Set by"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((x) => (
              <TableRow key={x.id}>
                <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{rangeLabel(x.d, x.d)}</TableCell>
                <TableCell sx={bodyCell}>
                  <Box component="a" href={hsTicket(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(360) }}>{x.s || x.id}</Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{catName(x.i)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{catName(x.t)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{HOW[x.h]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {r.data.total > rows.length && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>The newest {full(rows.length)} of {full(r.data.total)}.</Typography>}
    </>
  );
}

/** What changed after intake: "came with -> has today", by the hub or by a person; a line opens its tickets. */
function Changes({ w, from, to }: { w: Win; from: string; to: string }) {
  const [who, setWho] = useState<"all" | "hub" | "person">("all");
  const [open, setOpen] = useState<string | null>(null);
  const pairs = Object.entries(w.pairs).map(([k, n]) => ({ k, n, ...pairOf(k) })).sort((a, b) => b.n - a.n);
  const kept = pairs.filter((p) => who === "all" || p.journey === who);
  const changed = (w.j.hub ?? 0) + (w.j.person ?? 0);
  const [all, setAll] = useState(false);
  const shown = all ? kept : kept.slice(0, 15);
  const picked = pairs.find((p) => p.k === open) ?? null;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="purple" title="What changed after intake"
        note={`The ${full(changed)} tickets (${pct(changed, w.n)}) that have another topic today than the one they came with - what the keywords miss, and what people correct. Click a line for its tickets`} />
      <Box sx={{ mb: 1.5 }}>
        <Choice<"all" | "hub" | "person"> value={who} onChange={(v) => { setWho(v); setOpen(null); }} options={[
          { key: "all", label: "All", count: changed },
          { key: "hub", label: "Found by the hub", count: w.j.hub ?? 0 },
          { key: "person", label: "Re-filed by a person", count: w.j.person ?? 0 },
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Came with", "", "Has today", "By", "Tickets", "Of the changes"].map((h, i) => (
            <TableCell key={h || `c${i}`} sx={{ ...headCell, textAlign: i >= 4 ? "right" : "left" }}>{h}</TableCell>
          ))}</TableRow></TableHead>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.k} hover selected={open === p.k} onClick={() => setOpen(open === p.k ? null : p.k)} sx={{ cursor: "pointer" }}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED, whiteSpace: "nowrap" }}>{catName(p.intake)}</TableCell>
                <TableCell sx={{ ...bodyCell, color: MUTED, px: 0.5 }}>→</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{catName(p.today)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>{p.journey === "person" ? "a person" : "the hub"}</TableCell>
                <TableCell sx={{ ...num, fontWeight: 700 }}>{full(p.n)}</TableCell>
                <TableCell sx={{ ...num, color: MUTED }}>{pct(p.n, changed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {!kept.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 1 }}>Nothing changed after intake in this period.</Typography>}
      {kept.length > 15 && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", mt: 0.75 }}>{all ? "Show the first 15" : `Show all ${full(kept.length)}`}</Button>}
      {picked && (
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, mb: 1 }}>
            {catName(picked.intake)} → {catName(picked.today)}, {picked.journey === "person" ? "re-filed by a person" : "found by the hub"} - {full(picked.n)} {picked.n === 1 ? "ticket" : "tickets"}
          </Typography>
          <Tickets key={picked.k} from={from} to={to} pick={{ intake: picked.intake, today: picked.today, journey: picked.journey }} empty="None." />
        </Box>
      )}
    </GlassCard>
  );
}

/** The period's figures: the tiles, how each ticket got its topic, what the tickets are, what changed, what is open. */
function Period({ from, to }: { from: string; to: string }) {
  const url = `/api/uc/bo-distribution?detection=1&from=${from}&to=${to}`;
  const r = useHeld<PeriodFigures>(url, [url]).result;
  const f = r?.state === "ok" ? r.data : null;
  const counting = !f || f.missing.some((ym) => ym >= from.slice(0, 7));
  const since = f?.since ?? null;
  const label = (w: Win) => rangeLabel(since && w.from < since ? since : w.from, w.to);
  // the days before, only when they hold tickets and are counted completely
  const b = f && f.before.n > 0 && !f.missing.some((ym) => ym < from.slice(0, 7)) ? f.before : null;
  const wait = r && r.state !== "ok" ? "The figures could not be read - try again in a moment" : "Counting the Back Office history - the first count after a release takes a few minutes";
  const icons: Record<Journey, React.ReactNode> = { kept: <TaskAltOutlinedIcon />, hub: <AutoAwesomeOutlinedIcon />, person: <CompareArrowsOutlinedIcon />, open: <HelpOutlineOutlinedIcon /> };
  if (counting || !f) {
    return (
      <Grid container spacing={2}>
        {JOURNEYS.map((j) => <Grid key={j} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={icons[j]} tint="slate" label={JOURNEY[j].label} value="—" note={wait} /></Grid>)}
      </Grid>
    );
  }
  const n = f.now;
  const tint: Record<Journey, "green" | "blue" | "purple" | "amber"> = { kept: "green", hub: "blue", person: "purple", open: (n.j.open ?? 0) ? "amber" : "green" };
  const note = (j: Journey) => {
    const v = n.j[j] ?? 0;
    if (j === "open" && !v) return `Every Back Office ticket created ${label(n)} has its topic.`;
    return `${pct(v, n.n)} of the ${full(n.n)} tickets created ${label(n)} - ${JOURNEY[j].note}.`;
  };
  // the same journey's count over the same number of days just before; fewer re-filed is the good way. Still Others has
  // none: the days before have had longer to be read and closed, so it would always "rise" (01.11.2026: +1,367%)
  const delta = (j: Journey) => (b && b.j[j] && j !== "open" ? { ratio: (n.j[j] ?? 0) / b.j[j]! - 1, versus: `${full(b.j[j]!)} ${label(b)}`, goodWhenUp: j === "kept" || j === "hub" } : undefined);
  return (
    <>
      <Grid container spacing={2}>
        {JOURNEYS.map((j) => <Grid key={j} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={icons[j]} tint={tint[j]} label={JOURNEY[j].label} value={full(n.j[j] ?? 0)} note={note(j)} delta={delta(j)} /></Grid>)}
      </Grid>
      <JourneyTable f={f} w={n} />
      <Splits f={f} w={n} label={label(n)} />
      <Changes w={n} from={from} to={to} />
      {(n.j.open ?? 0) > 0 && (
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<HelpOutlineOutlinedIcon />} tint="amber" title={`Still Others: ${full(n.j.open ?? 0)}`}
            note="Open tickets on Others or with no category. Two hours after a ticket arrives the hub reads it - the sentiment flag, else the AI on the conversation so far - and gives it its topic; one it could not place is read again the next day" />
          <Tickets from={from} to={to} pick={{ journey: "open" }} empty="None - every ticket has its topic." />
        </GlassCard>
      )}
    </>
  );
}

export function DetectionTab({ d, from, to }: { d: Data; from: string; to: string }) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [res, setRes] = useState<Both | null>(null);
  const [busy, setBusy] = useState(false);
  const [lists, setLists] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", subject, content: content.slice(0, 6000) }) });
      const j = (await r.json()) as { ok: boolean; data?: Both };
      setRes(j.ok && j.data ? j.data : null);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Period key="detection-period" from={from} to={to} />

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Try the intake classifier" note="Paste a subject and an e-mail: what the routing's keywords make of it at intake, and the improved keywords (not in use), with why (up to 6,000 characters)" />
        <Box sx={{ display: "grid", gap: 1, maxWidth: 900 }}>
          <TextField size="small" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField size="small" label="E-mail text" multiline minRows={4} value={content} onChange={(e) => setContent(e.target.value.slice(0, 6000))} />
          <Box><Button variant="contained" size="small" disabled={busy || (!subject && !content)} onClick={() => void run()} sx={{ textTransform: "none" }}>Classify</Button></Box>
        </Box>
        {res && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {([["At intake (in use)", res.v1, [] as string[]], ["Improved keywords (not in use)", res.v2, res.v2.fixes]] as const).map(([title, c, fx]) => (
              <Grid key={title} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, display: "grid", gap: 0.75 }}>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</Typography>
                  <Answer d={d} cat={c.category ?? "Others"} subCat={c.subCategory} words={c.matched} fixes={fx as string[]} />
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{c.explanation}{c.orderNumber ? ` · order ${c.orderNumber}` : ""}</Typography>
                  <BarList rows={Object.entries(c.scores).map(([label, value]) => ({ label, value })).filter((x) => (x.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))} labelWidth={160} format={(v) => String(v ?? 0)} emptyMessage="No category scored - at intake that is Others, and the hub reads it two hours later." />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="The intake keyword lists" note="Six languages, the subject counts ten times, the highest score wins, then the sub-category"
          right={<Button size="small" onClick={() => setLists((x) => !x)} sx={{ textTransform: "none" }}>{lists ? "Hide" : "Show"}</Button>} />
        <Collapse in={lists}>
          <Grid container spacing={2}>
            {d.classifier.map((c) => (
              <Grid key={c.category} size={{ xs: 12, md: 6, xl: 4 }}>
                <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK }}>{c.category} <span style={{ color: MUTED, fontWeight: 500 }}>· {full(c.keywords)} keywords</span></Typography>
                  <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap", my: 0.75 }}>{c.sample.map((k) => <Chip key={k} tint="slate">{k}</Chip>)}</Box>
                  {c.subs.map((s) => <Typography key={s.key} sx={{ fontSize: "0.76rem", color: MUTED }}>→ {s.value} <span style={{ color: INK }}>({s.keywords})</span></Typography>)}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Collapse>
      </GlassCard>
    </>
  );
}
