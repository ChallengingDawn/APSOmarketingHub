"use client";

// BACK OFFICE DISTRIBUTION - the Detection tab (SARCLA 19.10.2026: "improve the classifier page with the reason why it gets
// classified that way"; "how can we improve the detection of Others?"). The workflow's keyword classifier and the improved
// one (classifierV2.ts) side by side on every e-mail: the category, the keywords that decided it, the fixes that changed it,
// and the category a person set afterwards - the only real measure. Then what the "Others" are, and how to shrink them.
// The three tiles and the splits (one chart, three groups: customer request, not a customer request, not decided yet;
// a group's topics; every figure) count every Back Office ticket of the period picked on top, from HubSpot
// (src/lib/boDetection), beside the same number of days just before it; the e-mail by e-mail part below is what the hub
// read itself and names its dates.

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
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { Row } from "@/lib/boDistribution/engine";
import type { PeriodFigures } from "@/lib/boDetection/engine";
import { dayOf, rangeLabel, type Win } from "@/lib/boDetection/figures";
import { FLAG_TOPICS, TOPIC } from "@/lib/ticketClose/topics";
import { count, pct, type Data } from "./shared";

type Both = { v1: Classification; v2: Classification & { fixes: string[] } };
const v1cat = (r: Row) => r.route!.classified!.category ?? "Others";
const v2cat = (r: Row) => (r.v2 ? r.v2.category ?? "Others" : null);
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

const isTopic = (c: string) => c !== "Others" && c !== "(empty)";
const notAsked = (c: string) => FLAG_TOPICS.includes(c) || c === TOPIC.spam;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

/**
 * Three groups, the same colour in every month (SARCLA 27.10.2026: "graphs still really confusing" - chose one chart,
 * three groups, a group's topics on a click): what customers asked, what was not a customer request, and what is not
 * decided yet (Others or no category - open tickets, decided when they close).
 */
type Group = "asked" | "not" | "open";
const GROUPS: { key: Group; label: string; of: (c: string) => boolean }[] = [
  { key: "asked", label: "Customer request", of: (c) => isTopic(c) && !notAsked(c) },
  { key: "not", label: "Not a customer request", of: (c) => notAsked(c) },
  { key: "open", label: "Not decided yet", of: (c) => !isTopic(c) },
];
const groupOf = (c: string) => GROUPS.find((g) => g.of(c))!.key;

/** What the tickets of the period are: month by month in three groups, a group's topics, and every figure. */
function Splits({ f, w, label }: { f: PeriodFigures; w: Win; label: string }) {
  const [group, setGroup] = useState<Group>("asked");
  const months = f.byMonth;
  const topics = Object.entries(w.topics).map(([c, hows]) => ({ c, hows, n: Object.values(hows).reduce((a, x) => a + (x ?? 0), 0), g: groupOf(c) }))
    .sort((a, b) => b.n - a.n);
  const inGroup = (g: Group, m: Record<string, number>) => Object.entries(m).filter(([c]) => groupOf(c) === g).reduce((t, [, n]) => t + n, 0);
  const groupN = (g: Group) => topics.filter((t) => t.g === g).reduce((a, t) => a + t.n, 0);
  const data = months.map((m) => ({ x: m.ym, asked: inGroup("asked", m.topics), not: inGroup("not", m.topics), open: inGroup("open", m.topics) }));
  const table: TableTwin = {
    columns: ["Month", ...GROUPS.map((g) => g.label), "All Back Office tickets"],
    rows: data.map((r) => [monthLabel(r.x), r.asked, r.not, r.open, r.asked + r.not + r.open]),
    numeric: [1, 2, 3, 4],
  };
  const name = (c: string) => (c === "(empty)" ? "No category" : c);
  const monthTotal = (ym: string, g?: Group) => Object.entries(months.find((m) => m.ym === ym)?.topics ?? {}).filter(([c]) => !g || groupOf(c) === g).reduce((t, [, n]) => t + n, 0);
  const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" };
  const Line = ({ title, n, cells, strong, sub }: { title: string; n: number; cells: number[]; strong?: boolean; sub?: string }) => (
    <TableRow sx={strong ? { bgcolor: "rgba(36, 89, 209, 0.04)" } : undefined}>
      <TableCell sx={{ ...bodyCell, fontWeight: strong ? 800 : 600, whiteSpace: "nowrap", color: INK }}>{title}</TableCell>
      {cells.map((v, i) => <TableCell key={months[i].ym} sx={{ ...num, fontWeight: strong ? 700 : 400, color: v ? INK : MUTED }}>{v ? full(v) : "—"}</TableCell>)}
      <TableCell sx={{ ...num, fontWeight: 800 }}>{full(n)}</TableCell>
      <TableCell sx={{ ...num, color: MUTED }}>{pct(n, w.n)}</TableCell>
      <TableCell sx={{ ...num, color: MUTED }}>{sub ?? ""}</TableCell>
    </TableRow>
  );
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="blue" title="What the Back Office tickets are"
        note={`The ${full(w.n)} Back Office tickets created ${label}, by the topic they have today, month by month. The first and last month count only the days inside the period`} />
      <ChartFrame caption="Back Office tickets per month" table={table} empty={w.n ? null : "No ticket in this period."}>
        <StackedColumns data={data} parts={GROUPS.map(({ key, label: l }) => ({ key, label: l }))} format={(v) => full(v ?? 0)} xFormat={monthLabel} />
      </ChartFrame>
      <Box sx={{ mt: 2.5, mb: 1.25 }}>
        <Choice<Group> value={group} onChange={setGroup} options={GROUPS.map((g) => ({ key: g.key, label: g.label, count: groupN(g.key) }))} />
      </Box>
      <BarList rows={topics.filter((t) => t.g === group).map((t) => ({ label: name(t.c), value: t.n }))} labelWidth={230} format={(v) => `${full(v ?? 0)} · ${pct(v ?? 0, w.n)}`}
        emptyMessage={group === "open" ? "Nothing left undecided - every closed ticket has its topic." : "None in this period."} />
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, mt: 2.5, mb: 0.75 }}>All the figures</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["", ...months.map((m) => monthLabel(m.ym)), "Tickets", "Share", "By keywords only"].map((h, i) => <TableCell key={h || "topic"} sx={{ ...headCell, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {GROUPS.map((g) => {
              const rows = topics.filter((t) => t.g === g.key);
              if (!rows.length) return null;
              return (
                <Fragment key={g.key}>
                  <Line title={g.label} n={groupN(g.key)} cells={months.map((m) => monthTotal(m.ym, g.key))} strong />
                  {rows.map((t) => <Line key={t.c} title={`   ${name(t.c)}`} n={t.n} cells={months.map((m) => m.topics[t.c] ?? 0)} sub={t.hows.keywords ? pct(t.hows.keywords, t.n) : "—"} />)}
                </Fragment>
              );
            })}
            <Line title="All Back Office tickets" n={w.n} cells={months.map((m) => monthTotal(m.ym))} strong />
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

/** The period's tiles - every Back Office ticket created in it, as it is filed today, and the same days just before. */
function PeriodTiles({ from, to }: { from: string; to: string }) {
  const url = `/api/uc/bo-distribution?detection=1&from=${from}&to=${to}`;
  const r = useHeld<PeriodFigures>(url, [url]).result;
  const f = r?.state === "ok" ? r.data : null;
  const counting = !f || f.missing.some((ym) => ym >= from.slice(0, 7));
  const since = f?.since ?? null;
  const label = (w: Win) => rangeLabel(since && w.from < since ? since : w.from, w.to);
  const rec = (w: Win) => w.n - w.others - w.empty;
  // the days before, only when they hold tickets and are counted completely
  const b = f && f.before.n > 0 && !f.missing.some((ym) => ym < from.slice(0, 7)) ? f.before : null;
  const wait = r && r.state !== "ok" ? "The figures could not be read - try again in a moment" : "Counting the Back Office history - the first count after a release takes a few minutes";
  if (counting || !f) {
    return (
      <Grid container spacing={2}>
        {["Recognised", "Re-filed by a person", "Others"].map((l) => <Grid key={l} size={{ xs: 12, sm: 4 }}><KpiTile icon={<PriorityHighOutlinedIcon />} tint="slate" label={l} value="—" note={wait} /></Grid>)}
      </Grid>
    );
  }
  const n = f.now;
  return (
    <>
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<PriorityHighOutlinedIcon />} tint="green" label="Recognised" value={pct(rec(n), n.n)}
        note={`${full(rec(n))} of the ${full(n.n)} Back Office tickets created ${label(n)} have a category.${b ? ` ${label(b)}: ${pct(rec(b), b.n)} of ${full(b.n)}.` : ""}`} /></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="blue" label="Re-filed by a person" value={pct(n.person, n.n)}
        note={`${full(n.person)} tickets a person gave another category, ${full(n.fromOthers)} of them were Others or empty.${b ? ` ${label(b)}: ${pct(b.person, b.n)}.` : ""}`} /></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<HelpOutlineOutlinedIcon />} tint="amber" label="Others" value={full(n.others + n.empty)}
        note={`${pct(n.others + n.empty, n.n)} of the tickets. Nothing recognised means Others, and the ticket goes to whoever is least busy.${b ? ` ${label(b)}: ${full(b.others + b.empty)} (${pct(b.others + b.empty, b.n)}).` : ""}`} /></Grid>
    </Grid>
    <Splits f={f} w={n} label={label(n)} />
    </>
  );
}

export function DetectionTab({ d, from, to }: { d: Data; from: string; to: string }) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [res, setRes] = useState<Both | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"changed" | "others" | "ai" | "person" | "all">("changed");
  const [lists, setLists] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", subject, content: content.slice(0, 6000) }) });
      const j = (await r.json()) as { ok: boolean; data?: Both };
      setRes(j.ok && j.data ? j.data : null);
    } finally { setBusy(false); }
  };

  const read = d.rows.filter((r) => r.route?.classified);
  const withV2 = read.filter((r) => r.v2);
  const others1 = read.filter((r) => v1cat(r) === "Others");
  const others2 = withV2.filter((r) => v2cat(r) === "Others");
  const corrected = read.filter((r) => r.actual?.catByPerson);
  const right1 = corrected.filter((r) => r.actual!.catByPerson === v1cat(r));
  const right2 = corrected.filter((r) => r.v2 && r.actual!.catByPerson === v2cat(r));
  const changed = withV2.filter((r) => v1cat(r) !== v2cat(r));
  // the AI on what both classifiers leave as Others (shadow, aiClassify.ts)
  const asked = read.filter((r) => r.ai);
  const aiFiled = asked.filter((r) => r.ai!.category);
  const aiCorrected = asked.filter((r) => r.actual?.catByPerson);
  const aiRight = aiCorrected.filter((r) => r.actual!.catByPerson === (r.ai!.category ?? "Others"));
  const bothOthers = withV2.filter((r) => v1cat(r) === "Others" && v2cat(r) === "Others");
  const aiTokens = asked.reduce((a, r) => a + (r.ai!.tokens || 0), 0);
  const rows = view === "changed" ? changed : view === "others" ? others1 : view === "ai" ? asked : view === "person" ? corrected : read;
  const { slice, pager } = usePaged(rows, 12);
  const caught = others1.filter((r) => r.v2 && v2cat(r) !== "Others");
  // the days the hub's own e-mails cover, named
  const entered = d.rows.map((r) => r.enteredAt).filter(Boolean).sort();
  const span = entered.length ? rangeLabel(dayOf(entered[0]), dayOf(entered[entered.length - 1])) : null;

  return (
    <>
      <PeriodTiles key="detection-period" from={from} to={to} />

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Why each ticket got its category" note="The keywords each classifier found, the fixes that changed the improved one's answer (hover a fix), and what a person set afterwards" />
        {span && (
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.25 }}>
            The {full(read.length)} e-mails the hub read, {span}. The classifier in use → the improved one: recognised {pct(read.length - others1.length, read.length)} → {pct(withV2.length - others2.length, withV2.length)} ·
            Others {full(others1.length)} → {full(others2.length)} · right where a person re-filed it {pct(right1.length, corrected.length)} → {pct(right2.length, corrected.length)} of {full(corrected.length)}
            {asked.length ? ` · the AI files ${full(aiFiled.length)} of the ${full(asked.length)} it was asked` : ""}
          </Typography>
        )}
        <Box sx={{ mb: 1.5 }}>
          <Choice<"changed" | "others" | "ai" | "person" | "all"> value={view} onChange={setView} options={[
            { key: "changed", label: "The improved one decides otherwise", count: changed.length },
            { key: "others", label: "Others today", count: others1.length },
            { key: "ai", label: "Asked the AI", count: asked.length },
            { key: "person", label: "Re-filed by a person", count: corrected.length },
            { key: "all", label: "All", count: read.length },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Entered", "Ticket", "Workflow's classifier", "Improved classifier", "A person set"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((r) => {
                const person = r.actual?.catByPerson ?? null;
                return (
                  <TableRow key={r.key} sx={{ verticalAlign: "top" }}>
                    <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", display: "block", ...clip(280) }}>{r.subject || r.ticketId}</Box>
                      <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{r.fromDomain ?? "sender unknown"}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, minWidth: 200 }}><Answer d={d} cat={v1cat(r)} subCat={r.route!.classified!.subCategory} words={(r.route!.classified as Classification).matched} /></TableCell>
                    <TableCell sx={{ ...bodyCell, minWidth: 220 }}>{r.v2 ? <Answer d={d} cat={v2cat(r)!} subCat={r.v2.subCategory} words={r.v2.matched} fixes={r.v2.fixes} /> : <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>read with the next runs</Typography>}
                      {r.ai && <Typography sx={{ fontSize: "0.74rem", color: INK, mt: 0.5 }}>AI: <b>{r.ai.category ?? "Others"}{r.ai.sub ? ` / ${r.ai.sub}` : ""}</b>{r.ai.why ? <span style={{ color: MUTED }}> - {r.ai.why}</span> : null}</Typography>}</TableCell>
                    <TableCell sx={bodyCell}>{person ? <Chip tint={person === v2cat(r) ? "green" : person === v1cat(r) ? "blue" : "amber"}>{person}</Chip> : <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>—</Typography>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{span ? `None in ${span}.` : "None yet."}</Typography>}
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<HelpOutlineOutlinedIcon />} tint="amber" title={`What the ${full(others1.length)} "Others" are`} note={`Where those e-mails came from${span ? `, ${span}` : ""} - suppliers, newsletters, our own mailboxes and customers the keywords missed`} />
            <BarList rows={count(others1, (r) => r.fromDomain ?? "sender unknown").slice(0, 14)} labelWidth={200} format={(v) => full(v ?? 0)} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<LightbulbOutlinedIcon />} tint="green" title="How to shrink Others" note="Measured where it can be - each step in shadow first" />
            <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 1 }}>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>The improved classifier</b> - recognises {full(caught.length)} of these {full(others1.length)}: {count(caught, (r) => v2cat(r)).map((x) => `${x.label} ${x.value}`).join(", ") || "none yet"}.</Typography>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>Rules by sender</b> - our own mailboxes, known suppliers and newsletter senders (left) always mean the same thing: a short list per domain files them without reading a word.</Typography>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>The ticket&apos;s own facts</b> - an order number the hub found in the e-mail or a shop link (Ticket/order/article associations) points to Delivery; an article number to Product Information or Price.</Typography>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>AI for the rest</b> (on, shadow) - the smallest Claude model, only for what neither classifier recognises ({full(bothOthers.length)} of the e-mails{span ? ` of ${span}` : ""}), the first 1,200 characters without history or addresses, at most 60 a day.
                {asked.length
                  ? <> Asked {full(asked.length)}: {count(asked, (r) => r.ai!.category ?? "Others").map((x) => `${x.label} ${x.value}`).join(", ")}. Right where a person re-filed it: {full(aiRight.length)} of {full(aiCorrected.length)}. Used: {full(Math.round(aiTokens / 100) / 10)}k tokens.</>
                  : " Nothing asked yet - a few e-mails a run."}</Typography>
            </Box>
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Try it" note="Paste a subject and an e-mail: both classifiers' answers and why (up to 6,000 characters)" />
        <Box sx={{ display: "grid", gap: 1, maxWidth: 900 }}>
          <TextField size="small" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField size="small" label="E-mail text" multiline minRows={4} value={content} onChange={(e) => setContent(e.target.value.slice(0, 6000))} />
          <Box><Button variant="contained" size="small" disabled={busy || (!subject && !content)} onClick={() => void run()} sx={{ textTransform: "none" }}>Classify</Button></Box>
        </Box>
        {res && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {([["The classifier in use", res.v1, [] as string[]], ["The improved classifier", res.v2, res.v2.fixes]] as const).map(([title, c, fx]) => (
              <Grid key={title} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, display: "grid", gap: 0.75 }}>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</Typography>
                  <Answer d={d} cat={c.category ?? "Others"} subCat={c.subCategory} words={c.matched} fixes={fx as string[]} />
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{c.explanation}{c.orderNumber ? ` · order ${c.orderNumber}` : ""}</Typography>
                  <BarList rows={Object.entries(c.scores).map(([label, value]) => ({ label, value })).filter((x) => (x.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))} labelWidth={160} format={(v) => String(v ?? 0)} emptyMessage="No category scored." />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="The keyword lists" note="Six languages, the subject counts ten times, the highest score wins, then the sub-category"
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
