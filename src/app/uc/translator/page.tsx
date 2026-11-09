"use client";

// APSO TRANSLATOR > OVERVIEW - what was translated, as KPIs and graphs, a tab per question (SARCLA 09.11.2026: "this should
// come back on the level of UC's as a main app - bring more graphs as KPIs and much more by tabs, and the sub apps on the
// side panel"). The look is Back-Office Reports': figure tiles, then a tab row, then two graphs side by side and the
// figures under them. Every customer message not in English gets a comment in English for the agent; an agent's "!" note
// translates or replies in the customer's language (src/lib/translator). Replaces apsotranslator.com.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { ChartBox, TWO } from "@/app/reporting/eso-benchmark/Figures";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Choice } from "@/app/connectors/parts";
import type { Day } from "@/lib/translator/engine";
import { CHANNEL, EMPTY, Frame, dm, lang, lastDays, n0, pct, useTranslator, type Data } from "./shared";

type Period = "7" | "30" | "90" | "365";
const PERIODS: { key: Period; label: string }[] = [{ key: "7", label: "7 days" }, { key: "30", label: "30 days" }, { key: "90", label: "90 days" }, { key: "365", label: "12 months" }];
type Tab = "time" | "langs" | "inboxes" | "agents" | "hours" | "speed";
const HASH: Record<Tab, string> = { time: "#over-time", langs: "#languages", inboxes: "#inboxes", agents: "#agents", hours: "#hours", speed: "#speed" };
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A day's figures as the pages count them - a day before 09.11.2026 knows only its totals. */
function figures(d: Day) {
  const k = d.kinds;
  return {
    inc: k ? k.incoming ?? 0 : d.n - d.replies,
    notes: k ? (k.lang ?? 0) + (k.reply ?? 0) : d.replies,
    replies: d.replies, convs: d.convs ?? 0, english: d.english ?? 0, failed: d.failed ?? 0, chars: d.chars,
  };
}
type Fig = ReturnType<typeof figures>;
const ZERO: Fig = figures(EMPTY);
const plus = (a: Fig, b: Fig): Fig => ({ inc: a.inc + b.inc, notes: a.notes + b.notes, replies: a.replies + b.replies, convs: a.convs + b.convs, english: a.english + b.english, failed: a.failed + b.failed, chars: a.chars + b.chars });
const merge = (into: Record<string, number>, from?: Record<string, number> | Partial<Record<string, number>>) => {
  for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + (v ?? 0);
  return into;
};
/** The breakdowns a day may not have: the hub counts them from 09.11.2026 on, the Railway translator's days have some. */
type Field = "inboxes" | "channels" | "agents" | "hours" | "convs" | "english" | "replyLangs";
const FIELDS: Field[] = ["inboxes", "channels", "agents", "hours", "convs", "english", "replyLangs"];
/** The period's days merged into one: the counts, and each breakdown summed. */
function together(xs: { d: Day }[]) {
  const t = { fig: ZERO, langs: {} as Record<string, number>, replyLangs: {} as Record<string, number>, inboxes: {} as Record<string, number>, channels: {} as Record<string, number>,
    agents: {} as Record<string, number>, kinds: {} as Record<string, number>, hours: Array(24).fill(0) as number[], weekdays: Array(7).fill(0) as number[], broken: 0,
    railway: 0, lacks: Object.fromEntries(FIELDS.map((k) => [k, 0])) as Record<Field, number> };
  for (const x of xs as { key?: string; d: Day }[]) {
    const f = figures(x.d);
    t.fig = plus(t.fig, f);
    merge(t.langs, x.d.langs); merge(t.replyLangs, x.d.replyLangs); merge(t.inboxes, x.d.inboxes); merge(t.channels, x.d.channels);
    merge(t.agents, x.d.agents); merge(t.kinds, x.d.kinds);
    x.d.hours?.forEach((v, h) => { t.hours[h] += v; });
    if (x.key) { const wd = (new Date(`${x.key}T12:00:00Z`).getUTCDay() + 6) % 7; t.weekdays[wd] += f.inc + f.notes; }
    if (x.d.n && !x.d.kinds) t.broken++;
    if (x.d.src === "railway") t.railway++;
    // a day of the hub's knows "english" only from 09.11.2026 on; the Railway translator never read the English ones
    if (x.d.n) for (const k of FIELDS) if (x.d[k] === undefined || (k === "english" && x.d.src === "railway")) t.lacks[k]++;
  }
  return t;
}
/** The period in columns: a day each up to 30 days, a week each for 90, a month each for 12 months. */
function buckets(days: Record<string, Day>, period: Period) {
  const n = Number(period);
  const xs = lastDays(days, n);
  const by = period === "90" ? "week" : period === "365" ? "month" : "day";
  const out: { key: string; label: string; fig: Fig }[] = [];
  for (const x of xs) {
    let key = x.key, label = dm(x.key);
    if (by === "month") { key = x.key.slice(0, 7); label = new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); }
    if (by === "week") {
      const dt = new Date(`${x.key}T12:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
      key = dt.toISOString().slice(0, 10); label = `w/c ${dm(key)}`;
    }
    const last = out[out.length - 1];
    if (last && last.key === key) last.fig = plus(last.fig, figures(x.d));
    else out.push({ key, label, fig: figures(x.d) });
  }
  return { by, rows: out };
}
const ratio = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
const secs = (s: number | null) => (s === null ? "—" : s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
const ranked = (m: Record<string, number>, name: (k: string) => string, total?: number) =>
  Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: name(k), value: v, secondary: total ? pct(v, total) : undefined }));

/** The figures as a table: the first ten rows, the rest a click away, and the total. */
function FigureTable({ head, rows, total }: { head: string[]; rows: (string | number)[][]; total?: (string | number)[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 10);
  const cell = (v: string | number, i: number, strong = false) => (
    <TableCell key={i} align={i ? "right" : "left"} sx={{ ...bodyCell, fontSize: "0.84rem", color: INK, fontWeight: strong ? 700 : 400, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {typeof v === "number" ? n0(v) : v}
    </TableCell>
  );
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 520 }}>
        <TableHead><TableRow>{head.map((h, i) => <TableCell key={h} align={i ? "right" : "left"} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {shown.map((r, j) => <TableRow key={j} hover>{r.map((v, i) => cell(v, i))}</TableRow>)}
          {total && <TableRow>{total.map((v, i) => cell(v, i, true))}</TableRow>}
        </TableBody>
      </Table>
      {rows.length > 10 && (
        <Box sx={{ px: 2, py: 1.25 }}>
          <Button size="small" onClick={() => setAll((x) => !x)}>{all ? "Show the first 10" : `Show all ${rows.length}`}</Button>
        </Box>
      )}
    </Box>
  );
}
const TableCard = ({ title, note, children }: { title: string; note: string; children: React.ReactNode }) => (
  <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
    <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1 }}><CardTitle icon={<TableChartOutlinedIcon />} tint="slate" title={title} note={note} /></Box>
    {children}
  </GlassCard>
);

function Board({ d }: { d: Data }) {
  const [period, setPeriod] = useState<Period>("30");
  const [tab, setTab] = useHashTab<Tab>(HASH, "time");
  const n = Number(period);
  const word = PERIODS.find((p) => p.key === period)!.label;
  const cur = useMemo(() => together(lastDays(d.days, n)), [d.days, n]);
  const prev = useMemo(() => together(lastDays(d.days, n, n)), [d.days, n]);
  const cols = useMemo(() => buckets(d.days, period), [d.days, period]);
  const f = cur.fig, p = prev.fig;
  const versus = `the ${word} before`;
  // a breakdown counted only from some day on (the hub's from 09.11.2026): say so where the period starts earlier
  const keys = Object.keys(d.days).sort();
  const sinceOf = (k: Field) => keys.find((x) => d.days[x][k] !== undefined && !(k === "english" && d.days[x].src === "railway"));
  const partlyOf = (k: Field) => (cur.lacks[k] > 0 ? `counted since ${sinceOf(k) ? dm(sinceOf(k)!) : "today"}` : "");
  const hint = (s: string, k?: Field) => [s, k ? partlyOf(k) : ""].filter(Boolean).join(" · ");
  const partly = partlyOf("convs");
  // the Railway translator's days, before the hub: named on the graphs that show them
  const railLast = [...keys].reverse().find((x) => d.days[x].src === "railway");
  const hubFirst = keys.find((x) => !d.days[x].src && d.days[x].n > 0);
  const before = cur.railway > 0 && railLast ? `until ${dm(railLast)} the Railway translator${hubFirst ? `, from ${dm(hubFirst)} the hub` : ""}` : "";
  const custTotal = f.inc + f.english;
  const langCount = Object.values(cur.langs).filter((v) => v > 0).length;
  const topLangs = ranked(cur.langs, lang).slice(0, 2).map((r) => `${r.label} ${pct(r.value, Object.values(cur.langs).reduce((a, b) => a + b, 0))}`).join(", ");
  const unit = cols.by === "day" ? "per day" : cols.by === "week" ? "per week" : "per month";
  const inboxName = (id: string) => d.inboxes[id] ?? `Inbox ${id}`;
  // the hub's agents are HubSpot actors (A-123); the Railway translator's days carry their names
  const agentName = (id: string) => (/^A-\d+$/.test(id) ? d.agents[id] ?? `Agent ${id.slice(2)}` : id);

  const tabs = [
    { id: "time" as const, label: "Over time", count: n0(f.inc + f.notes) },
    { id: "langs" as const, label: "Languages", count: n0(langCount) },
    { id: "inboxes" as const, label: "Inboxes & channels", count: n0(Object.keys(cur.inboxes).length) },
    { id: "agents" as const, label: "Agents", count: n0(Object.keys(cur.agents).length) },
    { id: "hours" as const, label: "When customers write", count: null },
    { id: "speed" as const, label: "Speed & DeepL", count: null },
  ];

  let body: React.ReactNode = null;
  if (tab === "time") {
    body = (
      <>
        <Box sx={TWO}>
          <ChartBox title={`Translations ${unit}, last ${word}`} hint={["customer messages in English for the agent, and the agents' ! notes", before].filter(Boolean).join(" · ")}>
            <StackedColumns height={260} format={n0} data={cols.rows.map((r) => ({ x: r.label, inc: r.fig.inc, notes: r.fig.notes }))}
              parts={[{ key: "inc", label: "Customer messages" }, { key: "notes", label: "! notes by agents" }]} />
          </ChartBox>
          <ChartBox title={`Conversations ${unit}, last ${word}`} hint={hint("a conversation with a translation, once a day", "convs")}>
            <StackedColumns height={260} format={n0} data={cols.rows.map((r) => ({ x: r.label, convs: r.fig.convs }))} parts={[{ key: "convs", label: "Conversations" }]} />
          </ChartBox>
        </Box>
        <TableCard title={`All the figures, ${unit}`} note={`Last ${word}, newest first`}>
          <FigureTable head={[cols.by === "day" ? "Day" : cols.by === "week" ? "Week" : "Month", "Translated", "Already English", "Conversations", "! notes", "Replies sent", "Characters", "Failed"]}
            rows={[...cols.rows].reverse().map((r) => [r.label, r.fig.inc, r.fig.english, r.fig.convs, r.fig.notes, r.fig.replies, r.fig.chars, r.fig.failed])}
            total={["Total", f.inc, f.english, f.convs, f.notes, f.replies, f.chars, f.failed]} />
        </TableCard>
      </>
    );
  } else if (tab === "langs") {
    const all = Object.values(cur.langs).reduce((a, b) => a + b, 0);
    const replyAll = Object.values(cur.replyLangs).reduce((a, b) => a + b, 0);
    body = (
      <>
        <Box sx={TWO}>
          <ChartBox title={`The customers' languages, last ${word}`} hint="translations, by the language the customer wrote in">
            <BarList rows={ranked(cur.langs, lang, all)} format={n0} labelWidth={130} emptyMessage="Nothing translated in this period." />
          </ChartBox>
          <ChartBox title={`Replies sent, by language, last ${word}`} hint={hint("an agent's !text, sent to the customer in their language", "replyLangs")}>
            <BarList rows={ranked(cur.replyLangs, lang, replyAll)} format={n0} labelWidth={130} emptyMessage="No reply sent with ! in this period." />
          </ChartBox>
        </Box>
        <TableCard title="All the figures, by language" note={`Last ${word}`}>
          <FigureTable head={["Language", "Translations", "Share", "Replies sent"]}
            rows={Object.entries(cur.langs).sort((a, b) => b[1] - a[1]).map(([k, v]) => [lang(k), v, pct(v, all), cur.replyLangs[k] ?? 0])}
            total={["Total", all, all ? "100%" : "—", replyAll]} />
        </TableCard>
      </>
    );
  } else if (tab === "inboxes") {
    const all = Object.values(cur.inboxes).reduce((a, b) => a + b, 0);
    const chAll = Object.values(cur.channels).reduce((a, b) => a + b, 0);
    body = (
      <>
        <Box sx={TWO}>
          <ChartBox title={`Translations by inbox, last ${word}`} hint={hint("the HubSpot inbox the conversation is in", "inboxes")}>
            <BarList rows={ranked(cur.inboxes, inboxName, all)} format={n0} labelWidth={200} emptyMessage="Nothing counted by inbox in this period yet." />
          </ChartBox>
          <ChartBox title={`Translations by channel, last ${word}`} hint={hint("the chat on the shop, or e-mail", "channels")}>
            <BarList rows={ranked(cur.channels, (k) => CHANNEL[k as keyof typeof CHANNEL] ?? k, chAll)} format={n0} labelWidth={130} emptyMessage="Nothing counted by channel in this period yet." />
          </ChartBox>
        </Box>
        <TableCard title="All the figures, by inbox" note={`Last ${word}`}>
          <FigureTable head={["Inbox", "Translations", "Share"]} rows={Object.entries(cur.inboxes).sort((a, b) => b[1] - a[1]).map(([k, v]) => [inboxName(k), v, pct(v, all)])}
            total={["Total", all, all ? "100%" : "—"]} />
        </TableCard>
      </>
    );
  } else if (tab === "agents") {
    const all = Object.values(cur.agents).reduce((a, b) => a + b, 0);
    body = (
      <>
        <Box sx={TWO}>
          <ChartBox title={`! notes by agent, last ${word}`} hint={hint(cur.railway ? "who asked for a translation (on Railway: whoever translated in the side panel)" : "the agents who asked for a translation on a conversation", "agents")}>
            <BarList rows={ranked(cur.agents, agentName, all)} format={n0} labelWidth={190} emptyMessage="No agent used ! in this period." />
          </ChartBox>
          <ChartBox title={`What the agents asked for, last ${word}`} hint={hint("!FR, !DE … or a reply written with !", "agents")}>
            <BarList rows={[
              { label: "Message in another language", value: cur.kinds.lang ?? 0, secondary: "!FR, !DE …" },
              { label: "Reply in the customer's language", value: cur.kinds.reply ?? 0, secondary: "!text" },
            ]} format={n0} labelWidth={230} maxLabel={40} />
          </ChartBox>
        </Box>
        <TableCard title="All the figures, by agent" note={`Last ${word}`}>
          <FigureTable head={["Agent", "! notes", "Share"]} rows={Object.entries(cur.agents).sort((a, b) => b[1] - a[1]).map(([k, v]) => [agentName(k), v, pct(v, all)])}
            total={["Total", all, all ? "100%" : "—"]} />
        </TableCard>
      </>
    );
  } else if (tab === "hours") {
    body = (
      <Box sx={TWO}>
        <ChartBox title={`Translations by the hour the customer wrote, last ${word}`} hint={hint("Swiss time", "hours")}>
          <StackedColumns height={260} format={n0} data={cur.hours.map((v, h) => ({ x: String(h).padStart(2, "0"), n: v }))} parts={[{ key: "n", label: "Translations" }]} />
        </ChartBox>
        <ChartBox title={`Translations by weekday, last ${word}`} hint="customer messages and ! notes">
          <StackedColumns height={260} format={n0} data={cur.weekdays.map((v, i) => ({ x: WEEKDAYS[i].slice(0, 3), n: v }))} parts={[{ key: "n", label: "Translations" }]} />
        </ChartBox>
      </Box>
    );
  } else {
    const u = d.usage;
    body = (
      <Box sx={TWO}>
        <ChartBox title="How long a customer's message waited for its comment" hint={`the last 30 days, ${n0(d.speed.n)} message${d.speed.n === 1 ? "" : "s"} · it looks every ${d.everySeconds} seconds`}>
          <BarList rows={[{ label: "Half of them within", value: d.speed.median }, { label: "Nine in ten within", value: d.speed.p90 }]} format={(v) => secs(v)} labelWidth={170} emptyMessage="No comment made in the last 30 days." />
          {d.speed.n > 0 && (
            <>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mt: 1.5 }}>Comments, by how long the message waited</Typography>
              <BarList rows={(d.speed.bands ?? []).map((b) => ({ label: b.label, value: b.n, secondary: pct(b.n, d.speed.n) }))} format={n0} labelWidth={170} />
            </>
          )}
        </ChartBox>
        <ChartBox title={`Characters sent to DeepL ${unit}, last ${word}`} hint={u ? (u.limit ? `${n0(u.used)} of ${n0(u.limit)} used this DeepL period (${pct(u.used, u.limit)})` : `${n0(u.used)} used this DeepL period`) : "DeepL did not answer"}>
          <StackedColumns height={260} format={n0} data={cols.rows.map((r) => ({ x: r.label, chars: r.fig.chars }))} parts={[{ key: "chars", label: "Characters" }]} />
        </ChartBox>
      </Box>
    );
  }

  return (
    <>
      {!d.configured && <Notice tone="warn">No DeepL key on the hub - nothing can be translated.</Notice>}
      {d.last?.error && d.settings.mode !== "off" && <Notice tone="bad">Last look: {d.last.error}</Notice>}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, fontWeight: 600 }}>Period</Typography>
        <Choice value={period} onChange={setPeriod} options={PERIODS} />
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<TranslateOutlinedIcon />} tint="blue" label="Customer messages translated" value={n0(f.inc)}
            delta={{ ratio: ratio(f.inc, p.inc), versus }} note={custTotal && !cur.lacks.english ? `${pct(f.inc, custTotal)} of the customer messages read were not in English` : `last ${word}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ForumOutlinedIcon />} tint="purple" label="Conversations" value={n0(f.convs)}
            delta={{ ratio: ratio(f.convs, p.convs), versus }} note={partly ? `with a translation, ${partly}` : "with a translation"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ReplyOutlinedIcon />} tint="green" label="! notes by agents" value={n0(f.notes)}
            delta={{ ratio: ratio(f.notes, p.notes), versus }} note={`${n0(f.replies)} repl${f.replies === 1 ? "y" : "ies"} sent to customers in their language`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<LanguageOutlinedIcon />} tint="amber" label="Languages" value={n0(langCount)}
            delta={{ ratio: ratio(langCount, Object.values(prev.langs).filter((v) => v > 0).length), versus }} note={topLangs || "none yet"} />
        </Grid>
      </Grid>
      <ReportTabs name="translator" tab={tab} onSelect={setTab} tabs={tabs} />
      {body}
    </>
  );
}

export default function TranslatorOverview() {
  const { d, wait } = useTranslator("overview");
  return (
    <Frame title="APSO Translator" subtitle="Customers' chats and e-mails in English for the agent, replies in their language - every minute, with DeepL" d={d}>
      {d ? <Board d={d} /> : wait}
    </Frame>
  );
}
