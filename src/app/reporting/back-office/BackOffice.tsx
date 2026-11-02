"use client";
// BACK-OFFICE REPORTS (SARCLA 02.11.2026: "and the back office reports based on file?" - his picks "Live, file = the KPI
// list" and "like on the ESO / TSA, split per topic"): the Back Office's KPI workbook (sheet "BO KPI") worked out live, a
// page per part - Figures (the team totals), Topics, Sales tickets (ESO / TSA / all against the orders), GQS. Each month
// of the year beside last year's same month, the figures top right over the complete months, "All the figures" laid out as
// the workbook (a KPI a row, a month a column). The rules are in src/lib/reporting/boReportRules.ts, the read in
// boReport.ts. The hours worked are typed in here (not in HubSpot); OTD and the stopped orders come next.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { FAINT, INK, MUTED, TINT, glass } from "@/app/uc/report/ui";
import { ChartBox, H1, TWO } from "@/app/reporting/eso-benchmark/Figures";
import { MonthTrend } from "@/app/reporting/eso-benchmark/TicketsCharts";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { Choices, FigureCards, MONTHS, changeOf, int, pct, tone, signedPct, type Fig } from "@/app/reporting/products/views/kit";
import type { BoRead } from "@/lib/reporting/boReport";
import { TOPIC_ORDER, hasTickets, kpisOf, sumGqs, sumMonths, topicLabel, type BoKpis, type BoMonth, type GqsMonth } from "@/lib/reporting/boReportRules";

/* ── the read ──────────────────────────────────────────────────────────── */

type Data = BoRead & { hours: Record<string, number> };
type Answer = { state: { computing: boolean; progress: string | null; error: string | null; computedAt: string | null }; data: Data | null; canEdit: boolean };

function useBo() {
  const [a, setA] = useState<Answer | null>(null);
  const [err, setErr] = useState<{ error: string; status: number | null } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let off = false;
    fetch("/api/reporting/back-office", { cache: "no-store" })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error ?? `HTTP ${r.status}`), { status: r.status }); return j as Answer; })
      .then((j) => { if (!off) { setA(j); setErr(null); } })
      .catch((e) => { if (!off) setErr({ error: String(e?.message ?? e), status: e?.status ?? null }); });
    return () => { off = true; };
  }, [tick]);
  // while the months are counted: ask again every 10 seconds
  useEffect(() => {
    if (!a?.state.computing) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [a]);
  const setHours = useCallback(async (ym: string, hours: number | null) => {
    const r = await fetch("/api/reporting/back-office", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ym, hours }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    setA((x) => (x?.data ? { ...x, data: { ...x.data, hours: j.hours } } : x));
  }, []);
  return { a, err, again: () => setTick((n) => n + 1), setHours };
}

/* ── the year shown: its months, last year's beside them ──────────────── */

/** a month not counted yet */
const EMPTY = (ym: string): BoMonth => ({ ym, created: 0, closed: 0, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, eso: 0, tsa: 0, all: 0, orders: 0, lines: 0, pending: true });
const EMPTY_GQS = (ym: string): GqsMonth => ({ ym, created: 0, sentDays: 0, sentN: 0, doneDays: 0, doneN: 0 });

type Frame = {
  year: number; years: number[]; setYear: (y: number) => void;
  yms: string[]; labels: string[];
  /** the year's months, and last year's same months (null: not read - two years back) */
  cur: BoMonth[]; prev: (BoMonth | null)[]; gqs: GqsMonth[]; gqsPrev: (GqsMonth | null)[];
  hours: (number | null)[]; hoursPrev: (number | null)[];
  /** the complete months - the figures top right and the totals compare these */
  done: number; doneWords: string;
  /** the first month the totals add up - the first with tickets in HubSpot */
  from: number;
  k: (i: number) => BoKpis; kPrev: (i: number) => BoKpis | null;
  /** the complete months added up, this year and last */
  total: BoKpis; totalPrev: BoKpis | null;
};

function useFrame(d: Data): Frame {
  const cy = Number(d.current.slice(0, 4));
  const [year, setYear] = useState(cy);
  return useMemo(() => {
    const by = new Map(d.months.map((m) => [m.ym, m]));
    const gby = new Map(d.gqs.map((m) => [m.ym, m]));
    const last = year === cy ? Number(d.current.slice(5, 7)) : 12;
    const yms = Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const back = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
    const cur = yms.map((ym) => by.get(ym) ?? EMPTY(ym));
    const prev = yms.map((ym) => by.get(back(ym)) ?? null);
    const gqs = yms.map((ym) => gby.get(ym) ?? EMPTY_GQS(ym));
    const gqsPrev = yms.map((ym) => (by.has(back(ym)) ? gby.get(back(ym)) ?? EMPTY_GQS(back(ym)) : null));
    const hrs = (ym: string) => (d.hours[ym] != null ? d.hours[ym] : null);
    const hours = yms.map(hrs), hoursPrev = yms.map((ym) => hrs(back(ym)));
    const done = yms.filter((ym) => ym < d.current).length;
    // the totals from the first month with tickets in HubSpot - July in 2025 - so a year's figures are never all "—"
    const from = Math.min(Math.max(0, yms.findIndex(hasTickets)), Math.max(0, done - 1));
    const doneWords = done === 0 ? "" : done - from === 1 ? MONTHS[from] : `${MONTHS[from]}–${MONTHS[done - 1]}`;
    const sumH = (xs: (number | null)[]) => (xs.slice(from, done).every((x) => x != null) && done ? xs.slice(from, done).reduce<number>((s, x) => s + (x ?? 0), 0) : null);
    const total = kpisOf(sumMonths(cur.slice(from, done)), sumGqs(gqs.slice(from, done)), sumH(hours));
    const havePrev = done > 0 && prev.slice(from, done).every((x) => x);
    const totalPrev = havePrev ? kpisOf(sumMonths(prev.slice(from, done) as BoMonth[]), sumGqs(gqsPrev.slice(from, done) as GqsMonth[]), sumH(hoursPrev)) : null;
    return {
      year, years: [cy, cy - 1], setYear, yms,
      labels: yms.map((ym, i) => `${MONTHS[i]}${ym === d.current ? " (to date)" : ""}`),
      cur, prev, gqs, gqsPrev, hours, hoursPrev, done, from, doneWords,
      k: (i: number) => kpisOf(cur[i], gqs[i], hours[i]),
      kPrev: (i: number) => (prev[i] ? kpisOf(prev[i] as BoMonth, gqsPrev[i], hoursPrev[i]) : null),
      total, totalPrev,
    };
  }, [d, year, cy]);
}

/* ── formats ───────────────────────────────────────────────────────────── */

const days = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} days`);
const daysTick = (v: number | null) => (v == null ? "" : v.toFixed(0));
const hrs = (v: number | null) => (v == null ? "—" : v.toLocaleString("en", { maximumFractionDigits: 1 }));
const n0 = (v: number | null) => (v == null ? "—" : int(v));
const share = (v: number | null) => pct(v);

/* ── the page around each part ─────────────────────────────────────────── */

const SHELL = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;

function Page({ title, children, figs }: { title: string; children: (f: Frame, d: Data, canEdit: boolean, setHours: (ym: string, h: number | null) => Promise<void>) => React.ReactNode; figs: (f: Frame) => Fig[] }) {
  const { a, err, again, setHours } = useBo();
  const head = <Typography component="h1" sx={H1}>{title}</Typography>;
  if (err && !a?.data) return <Box sx={SHELL}>{head}<UpstreamPanel source="Back-Office Reports" error={err.error} status={err.status} onRetry={again} /></Box>;
  if (!a?.data) {
    const label = a?.state.error ? `The last count stopped: ${a.state.error}` : `Counting the Back Office's months from HubSpot - the newest first, each shown as soon as it is counted${a?.state.progress ? ` · ${a.state.progress}` : "…"}`;
    return <Box sx={SHELL}>{head}<LoadingPanel label={label} /></Box>;
  }
  return <Loaded title={title} d={a.data} a={a} figs={figs} canEdit={a.canEdit} setHours={setHours}>{children}</Loaded>;
}

function Loaded({ title, d, a, figs, canEdit, setHours, children }: {
  title: string; d: Data; a: Answer; figs: (f: Frame) => Fig[]; canEdit: boolean; setHours: (ym: string, h: number | null) => Promise<void>;
  children: (f: Frame, d: Data, canEdit: boolean, setHours: (ym: string, h: number | null) => Promise<void>) => React.ReactNode;
}) {
  const f = useFrame(d);
  const counted = new Date(d.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <Box sx={SHELL}>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
          <Typography component="h1" sx={H1}>{title}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>Back Office</b> · {f.year}{f.done ? <> · the figures: <b style={{ color: INK }}>{f.doneWords} {f.year}</b>{f.totalPrev ? <> against {f.doneWords} {f.year - 1}</> : null}</> : null} · counted {counted}
            {a.state.computing && <> · <CircularProgress size={10} sx={{ mx: 0.4 }} />{d.pending?.length ? `counting - ${d.pending.length} of ${d.pending.length + d.months.length} months still to come, the newest first` : "counting again"}{a.state.progress ? `: ${a.state.progress}` : ""}</>}
          </Typography>
          <Choices items={f.years.map((y) => ({ id: String(y), label: String(y) }))} on={String(f.year)} onPick={(y) => f.setYear(Number(y))} />
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><FigureCards items={figs(f)} /></Box>
      </Box>
      {children(f, d, canEdit, setHours)}
    </Box>
  );
}

/** a figure top right: this year's complete months against last year's - no change shown where last year has no figure */
const fig = (label: string, value: string, a: number | null, b: number | null | undefined, sub: string, icon: React.ReactNode, tint: keyof typeof TINT, lower = false): Fig =>
  ({ label, value, ch: a != null && b != null ? changeOf(a, b) : undefined, sub, icon, tint, lower });

/** the months a chart draws: the complete ones - a month two days old would read as a collapse (its orders come in days
 *  later: 3 on 2 November, so 615 % tickets per order line) - the month to date only while none is complete */
const drawn = (f: Frame) => Math.max(1, f.done);

/** A monthly figure as a line, last year's beside it. */
function Trend({ f, title, hint, pick, fmt, tick }: { f: Frame; title: string; hint?: string; pick: (k: BoKpis) => number | null; fmt: (v: number | null) => string; tick?: (v: number | null) => string; lower?: boolean }) {
  const n = drawn(f);
  const values = f.yms.slice(0, n).map((_, i) => pick(f.k(i)));
  const compare = f.prev.some((x) => x) ? f.yms.slice(0, n).map((_, i) => { const p = f.kPrev(i); return p ? pick(p) : null; }) : null;
  const a = pick(f.total), b = f.totalPrev ? pick(f.totalPrev) : null;
  const ch = a != null && b != null ? changeOf(a, b) : null;
  const words = f.done && a != null ? `${f.doneWords}: ${fmt(a)}${ch != null ? ` (${signedPct(ch)} on last year)` : ""}` : undefined;
  return (
    <ChartBox title={title} hint={[hint, words].filter(Boolean).join(" · ")}>
      <MonthTrend values={values} compare={compare?.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} tick={tick} />
    </ChartBox>
  );
}

/** "All the figures": a KPI a row, a month a column, then the complete months, last year's and the change - as the workbook. */
/** `whole`: a ratio to the orders - "—" for the month to date, whose orders come in days later */
type KRow = { key: string; label: string; pick: (k: BoKpis) => number | null; fmt: (v: number | null) => string; lower?: boolean; strong?: boolean; whole?: boolean };
function AllFigures({ f, rows, title = "All the figures", hint }: { f: Frame; rows: KRow[]; title?: string; hint?: string }) {
  const sum = f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year);
  const head = ["KPI", ...f.labels.map((l) => l.replace(" (to date)", "*")), sum, ...(f.totalPrev ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])];
  return (
    <ChartBox title={title} hint={hint ?? `${f.labels.some((l) => l.includes("to date")) ? "* to date - " : ""}the last columns add up the complete months`}>
      <Table head={head} minWidth={Math.max(900, 150 + head.length * 74)} firstWidth="minmax(220px, 1.8fr)"
        rows={rows.map((r) => {
          const a = r.pick(f.total), b = f.totalPrev ? r.pick(f.totalPrev) : null;
          const ch = a != null && b != null ? changeOf(a, b) : null;
          return {
            key: r.key, strong: r.strong,
            cells: [r.label, ...f.yms.map((_, i) => (r.whole && f.labels[i].includes("to date") ? "—" : r.fmt(r.pick(f.k(i))))), r.fmt(a),
              ...(f.totalPrev ? [r.fmt(b), <Box key="ch" component="span" sx={{ fontWeight: 700, color: tone(ch, r.lower) }}>{signedPct(ch)}</Box>] : [])],
          };
        })} />
    </ChartBox>
  );
}

/* ── Figures: the team totals ──────────────────────────────────────────── */

const TEAM_ROWS: KRow[] = [
  { key: "created", label: "Number of tickets created", pick: (k) => k.created, fmt: n0, strong: true },
  { key: "hours", label: "Hours worked", pick: (k) => k.hours, fmt: hrs },
  { key: "lines", label: "Order lines", pick: (k) => k.lines, fmt: n0 },
  { key: "orders", label: "Orders", pick: (k) => k.orders, fmt: n0 },
  { key: "closed", label: "Number of tickets closed", pick: (k) => k.closed, fmt: n0 },
  { key: "resolution", label: "Avg. resolution time (days)", pick: (k) => k.resolution, fmt: (v) => (v == null ? "—" : v.toFixed(1)), lower: true },
  { key: "reply", label: "Avg. first response time (days)", pick: (k) => k.firstReply, fmt: (v) => (v == null ? "—" : v.toFixed(1)), lower: true },
  { key: "chat", label: "Number of chat tickets", pick: (k) => k.chat, fmt: n0 },
  { key: "gqs", label: "Number of GQS tasks created", pick: (k) => k.gqsCreated, fmt: n0 },
  { key: "gqsSent", label: "Avg. time before sent to GQS (days)", pick: (k) => k.gqsSent, fmt: (v) => (v == null ? "—" : v.toFixed(1)), lower: true },
  { key: "gqsDone", label: "Avg. resolution time GQS (days)", pick: (k) => k.gqsResolution, fmt: (v) => (v == null ? "—" : v.toFixed(1)), lower: true },
  { key: "perLine", label: "Ratio tickets vs order lines", pick: (k) => k.perLine, fmt: share, lower: true, whole: true },
  { key: "perOrder", label: "Ratio tickets vs orders", pick: (k) => k.perOrder, fmt: share, lower: true, whole: true },
  { key: "perHour", label: "Avg. hours per ticket", pick: (k) => k.hoursPerTicket, fmt: (v) => (v == null ? "—" : v.toFixed(2)), whole: true },
];

function HoursCard({ f, canEdit, setHours }: { f: Frame; canEdit: boolean; setHours: (ym: string, h: number | null) => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (ym: string) => {
    const v = draft[ym];
    if (v === undefined) return;
    const n = v.trim() === "" ? null : Number(v.replace(",", "."));
    if (n !== null && !Number.isFinite(n)) { setMsg("Hours are a number, e.g. 908.6"); return; }
    try { await setHours(ym, n); setMsg(null); setDraft((x) => { const y = { ...x }; delete y[ym]; return y; }); } catch (e) { setMsg(String((e as Error).message)); }
  };
  return (
    <ChartBox title="Hours worked" hint={canEdit ? "Not in HubSpot - typed in per month; the hours per ticket follow" : "Not in HubSpot - typed in per month by the Back Office"}>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
        {f.yms.map((ym, i) => (
          <Box key={ym} sx={{ ...glass, borderRadius: "12px", px: 1.2, py: 0.8, display: "grid", gap: 0.2 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{f.labels[i]}</Typography>
            {canEdit
              ? <InputBase value={draft[ym] ?? (f.hours[i] != null ? String(f.hours[i]) : "")} placeholder="—" inputProps={{ inputMode: "decimal", "aria-label": `Hours worked, ${f.labels[i]}` }}
                  onChange={(e) => setDraft((x) => ({ ...x, [ym]: e.target.value }))} onBlur={() => save(ym)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, "& input": { p: 0 } }} />
              : <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: f.hours[i] != null ? INK : FAINT }}>{hrs(f.hours[i])}</Typography>}
          </Box>
        ))}
      </Box>
      {msg && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f" }}>{msg}</Typography>}
    </ChartBox>
  );
}

export function BoFiguresPage() {
  return (
    <Page title="Figures" figs={(f) => [
      fig(`Tickets created`, n0(f.total.created), f.total.created, f.totalPrev?.created ?? null, f.doneWords || "this year", <ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
      fig("Days to close", days(f.total.resolution), f.total.resolution, f.totalPrev?.resolution ?? null, "tickets created then, on average", <TimerOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
      fig("Days to the first reply", days(f.total.firstReply), f.total.firstReply, f.totalPrev?.firstReply ?? null, "first agent e-mail", <ReplyOutlinedIcon sx={{ fontSize: 14 }} />, "purple", true),
      fig("Tickets per order line", share(f.total.perLine), f.total.perLine, f.totalPrev?.perLine ?? null, `${n0(f.total.lines)} order lines`, <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
    ]}>
      {(f, _d, canEdit, setHours) => (
        <>
          <Box sx={TWO}>
            <Trend f={f} title="Tickets created" hint="The Back Office's tickets, by the month they came in" pick={(k) => k.created} fmt={n0} />
            <Trend f={f} title="Tickets closed" hint="By their close date" pick={(k) => k.closed} fmt={n0} />
            <Trend f={f} title="Days to close" hint="Tickets created in the month and closed since, on average" pick={(k) => k.resolution} fmt={days} tick={daysTick} lower />
            <Trend f={f} title="Days to the first reply" hint="To the first agent e-mail reply, tickets created in the month" pick={(k) => k.firstReply} fmt={days} tick={daysTick} lower />
            <Trend f={f} title="Tickets per order line" hint="Tickets created against the month's order lines" pick={(k) => k.perLine} fmt={share} lower />
            <Trend f={f} title="Tickets per order" hint="Tickets created against the month's orders (an order number once, credit notes out)" pick={(k) => k.perOrder} fmt={share} lower />
            <Trend f={f} title="Orders" hint="By order date - an order number once whatever its deliveries" pick={(k) => k.orders} fmt={n0} />
            <Trend f={f} title="Order lines" hint="Per order, the lines of its largest delivery" pick={(k) => k.lines} fmt={n0} />
            <Trend f={f} title="Chat tickets" hint="Handed over to the Back Office by the chat" pick={(k) => k.chat} fmt={n0} />
            <Trend f={f} title="Hours per ticket" hint="Hours worked against the tickets created - where the hours are typed in" pick={(k) => k.hoursPerTicket} fmt={(v) => (v == null ? "—" : `${v.toFixed(2)} h`)} tick={(v) => (v == null ? "" : v.toFixed(2))} />
          </Box>
          <HoursCard f={f} canEdit={canEdit} setHours={setHours} />
          <AllFigures f={f} rows={TEAM_ROWS} />
        </>
      )}
    </Page>
  );
}

/* ── Topics ────────────────────────────────────────────────────────────── */

const topicSort = (a: string, b: string) => {
  const ia = TOPIC_ORDER.indexOf(a), ib = TOPIC_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

function TopicsBody({ f }: { f: Frame }) {
  const [picked, setPicked] = useState<string[]>([]);
  const sumOf = (ms: (BoMonth | null)[]) => sumMonths(ms.filter((x): x is BoMonth => !!x)).topics;
  // last year beside it only where its tickets are in HubSpot (from July 2025)
  const compare = f.totalPrev?.created != null;
  const cur = sumOf(f.cur.slice(f.from, f.done || f.cur.length)), prev = compare ? sumOf(f.prev.slice(f.from, f.done)) : {};
  const all = [...new Set([...f.cur, ...f.prev].flatMap((m) => (m ? Object.keys(m.topics) : [])))].sort(topicSort);
  const rows = all.map((t) => ({ label: topicLabel(t), key: t, cur: cur[t] ?? 0, prev: prev[t] ?? 0 }));
  const keys = picked.length ? all.filter((t) => picked.includes(topicLabel(t))) : all;
  const pickN = (m: BoMonth | null) => (m && hasTickets(m.ym) && !m.pending ? keys.reduce((s, t) => s + (m.topics[t] ?? 0), 0) : null);
  const what = picked.length ? picked.join(", ") : "every topic";
  return (
    <>
      <Box sx={TWO}>
        <DimChart title="Tickets per topic" rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year)} prevLabel={compare ? `${f.doneWords} ${f.year - 1}` : ""}
          single={!compare} fmt={int} selected={picked} onPick={(l) => setPicked((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]))} pickHint="Click topics to follow only them month by month" pageSize={20} />
        <ChartBox title={`Month by month: ${what}`} hint="The topic each ticket has today - tickets re-filed since move with it">
          <MonthTrend values={f.cur.slice(0, drawn(f)).map(pickN)} compare={f.prev.some((x) => x && hasTickets(x.ym)) ? f.prev.slice(0, drawn(f)).map(pickN) : null} labels={f.labels.slice(0, drawn(f))} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={n0} />
        </ChartBox>
      </Box>
      <ChartBox title="All the figures" hint="Back Office tickets per topic, by the month they came in">
        <Table head={["Topic", ...f.labels.map((l) => l.replace(" (to date)", "*")), ...(f.done ? [`${f.doneWords} ${f.year}`] : []), ...(compare ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])]}
          minWidth={Math.max(900, 150 + (f.yms.length + 3) * 74)} firstWidth="minmax(220px, 1.8fr)"
          rows={[...rows, { label: "Grand total", key: "__total", cur: rows.reduce((s, r) => s + r.cur, 0), prev: rows.reduce((s, r) => s + r.prev, 0) }].map((r) => ({
            key: r.key, strong: r.key === "__total",
            cells: [r.label, ...f.cur.map((m) => (hasTickets(m.ym) && !m.pending ? n0(r.key === "__total" ? m.created : m.topics[r.key] ?? 0) : "—")), ...(f.done ? [int(r.cur)] : []),
              ...(compare ? [int(r.prev), <Box key="ch" component="span" sx={{ fontWeight: 700, color: tone(changeOf(r.cur, r.prev), true) }}>{r.prev ? signedPct(changeOf(r.cur, r.prev)) : "—"}</Box>] : [])],
          }))} />
      </ChartBox>
    </>
  );
}

export function BoTopicsPage() {
  return (
    <Page title="Topics" figs={(f) => {
      const t = sumMonths(f.cur.slice(f.from, f.done || f.cur.length)).topics, p = f.totalPrev?.created != null ? sumMonths(f.prev.slice(f.from, f.done) as BoMonth[]).topics : null;
      const top = Object.entries(t).filter(([k]) => k).sort((a, b) => b[1] - a[1])[0];
      const n = Object.values(t).reduce((s, x) => s + x, 0);
      return [
        fig("Tickets", int(n), n, p ? Object.values(p).reduce((s, x) => s + x, 0) : null, f.doneWords || String(f.year), <ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
        fig(top ? top[0] : "Biggest topic", top ? int(top[1]) : "—", top?.[1] ?? null, top && p ? p[top[0]] ?? 0 : null, top && n ? `${pct(top[1] / n)} of the tickets` : "", <CategoryOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
        fig("No topic", int(t[""] ?? 0), t[""] ?? 0, p ? p[""] ?? 0 : null, "not yet given one", <HelpOutlineIcon sx={{ fontSize: 14 }} />, "slate", true),
      ];
    }}>
      {(f) => <TopicsBody f={f} />}
    </Page>
  );
}

/* ── Sales tickets: ESO, TSA, all against the orders ──────────────────── */

const SALES_ROWS: KRow[] = [
  { key: "eso", label: "Total number of tickets - ESO", pick: (k) => k.eso, fmt: n0, strong: true },
  { key: "esoL", label: "Ratio tickets vs order lines", pick: (k) => k.esoPerLine, fmt: share, lower: true, whole: true },
  { key: "esoO", label: "Ratio tickets vs orders", pick: (k) => k.esoPerOrder, fmt: share, lower: true, whole: true },
  { key: "tsa", label: "Total number of tickets - TSA", pick: (k) => k.tsa, fmt: n0, strong: true },
  { key: "tsaL", label: "Ratio tickets vs order lines", pick: (k) => k.tsaPerLine, fmt: share, lower: true, whole: true },
  { key: "tsaO", label: "Ratio tickets vs orders", pick: (k) => k.tsaPerOrder, fmt: share, lower: true, whole: true },
  { key: "all", label: "Total number of tickets - APSOparts", pick: (k) => k.all, fmt: n0, strong: true },
  { key: "allL", label: "Ratio tickets vs order lines", pick: (k) => k.allPerLine, fmt: share, lower: true, whole: true },
  { key: "allO", label: "Ratio tickets vs orders", pick: (k) => k.allPerOrder, fmt: share, lower: true, whole: true },
];

export function BoSalesTicketsPage() {
  return (
    <Page title="Sales tickets" figs={(f) => [
      fig("ESO tickets", n0(f.total.eso), f.total.eso, f.totalPrev?.eso ?? null, `${share(f.total.esoPerLine)} of the order lines`, <GroupsOutlinedIcon sx={{ fontSize: 14 }} />, "blue", true),
      fig("TSA tickets", n0(f.total.tsa), f.total.tsa, f.totalPrev?.tsa ?? null, `${share(f.total.tsaPerLine)} of the order lines`, <SupportAgentOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
      fig("All APSOparts", n0(f.total.all), f.total.all, f.totalPrev?.all ?? null, `${share(f.total.allPerLine)} of the order lines`, <ApartmentOutlinedIcon sx={{ fontSize: 14 }} />, "purple", true),
    ]}>
      {(f) => (
        <>
          <Box sx={TWO}>
            <Trend f={f} title="ESO tickets" hint="Every ticket created in the ESO pipeline" pick={(k) => k.eso} fmt={n0} />
            <Trend f={f} title="ESO tickets per order line" pick={(k) => k.esoPerLine} fmt={share} lower />
            <Trend f={f} title="TSA tickets" hint="Every ticket created in the TSA pipeline" pick={(k) => k.tsa} fmt={n0} />
            <Trend f={f} title="TSA tickets per order line" pick={(k) => k.tsaPerLine} fmt={share} lower />
            <Trend f={f} title="All APSOparts tickets" hint="Every pipeline - Back Office, ESO, TSA, GQS and the others" pick={(k) => k.all} fmt={n0} />
            <Trend f={f} title="All tickets per order line" pick={(k) => k.allPerLine} fmt={share} lower />
          </Box>
          <AllFigures f={f} rows={SALES_ROWS} hint="Tickets created in each pipeline against the month's orders and order lines - the last columns add up the complete months" />
        </>
      )}
    </Page>
  );
}

/* ── GQS ───────────────────────────────────────────────────────────────── */

const GQS_ROWS: KRow[] = [
  { key: "gqs", label: "Number of GQS tasks created", pick: (k) => k.gqsCreated, fmt: n0, strong: true },
  { key: "gqsSent", label: "Avg. time before sent to GQS (days)", pick: (k) => k.gqsSent, fmt: (v) => (v == null ? "—" : v.toFixed(1)), lower: true },
  { key: "gqsDone", label: "Avg. resolution time GQS (days)", pick: (k) => k.gqsResolution, fmt: (v) => (v == null ? "—" : v.toFixed(1)), lower: true },
];

export function BoGqsPage() {
  return (
    <Page title="GQS" figs={(f) => [
      fig("GQS tasks", n0(f.total.gqsCreated), f.total.gqsCreated, f.totalPrev?.gqsCreated ?? null, f.doneWords || String(f.year), <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
      fig("Days before GQS", days(f.total.gqsSent), f.total.gqsSent, f.totalPrev?.gqsSent ?? null, "in New and Open the GQS Task", <SendOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
      fig("Days to close", days(f.total.gqsResolution), f.total.gqsResolution, f.totalPrev?.gqsResolution ?? null, "offer sent to Sales or refused", <TaskAltOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
    ]}>
      {(f) => (
        <>
          <Box sx={TWO}>
            <Trend f={f} title="GQS tasks created" hint="Back Office - Special Tasks GQS, by the month they were created" pick={(k) => k.gqsCreated} fmt={n0} />
            <Trend f={f} title="Days before sent to GQS" hint="Time in New for Back-Office and Open the GQS Task, on average" pick={(k) => k.gqsSent} fmt={days} tick={daysTick} lower />
            <Trend f={f} title="Days to close" hint="HubSpot's time to close - to the offer sent to Sales, or refused; the tasks closed so far" pick={(k) => k.gqsResolution} fmt={days} tick={daysTick} lower />
          </Box>
          <AllFigures f={f} rows={GQS_ROWS} hint="Every GQS task, by the month it was created - the last columns add up the complete months" />
        </>
      )}
    </Page>
  );
}
