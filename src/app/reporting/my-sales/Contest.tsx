"use client";
// MY SALES REPORTS > NEW CUSTOMER CONTEST (Diana Fehr 06.11.2026: "we have a contest to see which ESOs can bring more
// Order intake ... show me order intake for these customers per eso per team (sarcla, falu, rabe) per month"): the new
// customers since 5 October with a sales action by someone in ESO up to their first order, their Compass order intake month by month - by ESO, by team,
// and every customer; the new customers no one in ESO has called, written to, met or visited yet as their own list. The rules:
// src/lib/reporting/contestRules.ts; the read: src/lib/reporting/contestReport.ts.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { FAINT, KpiTile, MUTED, TINT } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartBox, FullTable, H1, Leaderboard, NoLeadYet, TWO, Waiting, type BoardRow, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { hsCompany } from "@/app/reporting/CompanyList";
import type { SlowState } from "@/lib/integrations/slowReport";
import {
  CONTEST, MONTH_HEADS, NO_TEAM, NOT_ESO, actionCount, byPerson, byTeam, counts, headline, nothingYet, onlyActionMissing, started, totalOf,
  type ContestCompany, type ContestData, type DayFrom, type Line,
} from "@/lib/reporting/contestRules";
import { Note, shell } from "./shared";

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-12" -> "12 Oct 2026" */
const dayWords = (d: string | null) => (d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : "—");
const FROM: Record<DayFrom, string> = { compass: "Compass's first order date", shop: "The shop's first order (Compass has no date yet)", created: "No first order date yet - the company was created after 5 October" };

type View = "eso" | "team" | "customers" | Missing;
/** The new customers outside the contest: those that order and miss only a sales action, those that miss both. */
type Missing = "action" | "both";
const VIEWS: { id: View; label: string }[] = [
  { id: "eso", label: "By ESO" }, { id: "team", label: "By team" }, { id: "customers", label: "Customers" },
  { id: "action", label: "Only a sales action missing" }, { id: "both", label: "No sales action, no order intake" },
];
const MISSING: Record<Missing, (c: ContestCompany) => boolean> = { action: onlyActionMissing, both: nothingYet };

/** The read: asked again every 5 seconds while it runs; a finished read is set once, not on every answer. */
function useContest() {
  const [st, setSt] = useState<{ d: ContestData | null; computing: boolean; progress?: string; error?: string }>({ d: null, computing: true });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/my-sales/contest").then((r) => r.json())
      .then((j: SlowState<ContestData> & { ok?: boolean }) => {
        if (!alive) return;
        setSt((s) => {
          const d = j.value && j.value.generatedAt !== s.d?.generatedAt ? j.value : s.d;
          return d === s.d && s.computing === !!j.computing && s.progress === j.progress && s.error === j.error ? s : { d, computing: !!j.computing, progress: j.progress, error: j.error };
        });
        if (j.computing) timer = setTimeout(load, 5000);
      })
      .catch((e) => { if (alive) setSt((s) => ({ ...s, computing: false, error: String((e as Error)?.message ?? e) })); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return st;
}

export function ContestPage() {
  const { d, computing, progress, error } = useContest();
  const [view, setView] = useState<View>("eso");
  const head = (
    <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
      <Typography component="h1" sx={H1}>New customer contest</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
        Order intake from customers with no order and no revenue before 5 October, with a call, e-mail, meeting or visit by someone in ESO up to their first order · <b>{CONTEST.label}</b>
        {d ? ` · Compass's order intake, read from HubSpot ${new Date(d.generatedAt).toLocaleString("en-GB")}` : ""}{computing && d ? " · reading HubSpot again" : ""}
      </Typography>
    </Box>
  );
  if (!d) return <Box sx={shell}>{head}<Waiting computing={computing} progress={progress} error={error} /></Box>;
  return (
    <Box sx={shell}>
      {head}
      <Figures d={d} />
      <Box sx={{ justifySelf: "start", minWidth: 0 }}>
        <ReportTabs name="contest" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ ...v, count: v.id in MISSING ? String(d.companies.filter(MISSING[v.id as Missing]).length) : null }))} />
      </Box>
      {view === "eso" && <ByEso key="eso" d={d} />}
      {view === "team" && <ByTeam key="team" d={d} />}
      {view === "customers" && <Customers key="customers" d={d} rows={d.companies.filter(counts)} />}
      {(view === "action" || view === "both") && <Customers key={view} d={d} rows={d.companies.filter(MISSING[view])} missing={view} />}
    </Box>
  );
}

/**
 * The funnel on top: new customers, those with a sales action, those that qualify - a sales action and order intake -
 * and the order intake they bring (SARCLA 10.11.2026: four tiles in a row, the fourth the order intake).
 */
function Figures({ d }: { d: ContestData }) {
  const h = useMemo(() => headline(d), [d]);
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
      <KpiTile icon={<PersonAddAltOutlinedIcon />} tint="blue" label="New customers" value={int(h.fresh)} note="No order intake or revenue before 5 October" />
      <KpiTile icon={<PhoneInTalkOutlinedIcon />} tint="purple" label="With a sales action" value={int(h.counted)}
        note={`${pct(h.counted, h.fresh)} of the new customers · with or without order intake`} />
      <KpiTile icon={<EmojiEventsOutlinedIcon />} tint="green" label="Qualifying" value={int(h.bringing)}
        note={`${pct(h.bringing, h.counted)} of those with a sales action · new, a sales action and order intake`} />
      <KpiTile icon={<EuroOutlinedIcon />} tint="amber" label="Order intake" value={eur(h.intake)}
        note={`From the new customers with a sales action, as on the boards below · ${CONTEST.label}`} />
    </Box>
  );
}

/* ── by ESO, by team ───────────────────────────────────────────────────── */

const monthCols = (d: ContestData): Col<Line>[] => MONTH_HEADS.map((m, i) => ({
  key: `m${i}`, head: m, tip: i === 0 ? "Compass's order intake in October - none of these customers had any before the 5th" : `Compass's order intake in ${m === "Nov" ? "November" : "December"}`,
  cell: (r: Line) => (started(d.today, i) ? eur(r.intake[i]) : <span style={{ color: FAINT }}>—</span>), sort: (r: Line) => r.intake[i],
}));
const totalLine = (rows: Line[], label = "Total"): Line => ({
  label, team: "", eso: true, customers: rows.reduce((a, r) => a + r.customers, 0), total: rows.reduce((a, r) => a + r.total, 0),
  intake: MONTH_HEADS.map((_, i) => rows.reduce((a, r) => a + r.intake[i], 0)),
});
const board = (rows: Line[], sub: (r: Line) => string, f: (r: Line) => number): BoardRow[] => rows.map((r) => ({ label: r.label, cur: f(r), prev: 0, sub: sub(r) }));
const custWord = (n: number) => `${int(n)} customer${n === 1 ? "" : "s"}`;

function ByEso({ d }: { d: ContestData }) {
  const lines = useMemo(() => byPerson(d), [d]);
  const eso = lines.filter((l) => l.eso), others = lines.filter((l) => !l.eso);
  const all = totalLine(lines);
  const sub = (r: Line) => `${custWord(r.customers)} · ${r.team}`;
  const away = { why: "Not in ESO - customers outside the contest", rows: board(others, (r) => custWord(r.customers), (r) => r.total) };
  const cols: Col<Line>[] = [
    { key: "team", head: "Team", tip: "The line manager's team in Map assignment", cell: (r) => r.team || "" },
    { key: "cust", head: "Customers", tip: "New customers with a sales action that brought order intake", cell: (r) => int(r.customers), sort: (r) => r.customers },
    ...monthCols(d),
    { key: "total", head: "Total", tip: CONTEST.label, cell: (r) => <b>{eur(r.total)}</b>, sort: (r) => r.total },
  ];
  return (
    <>
      <Box sx={TWO}>
        <Leaderboard title="Order intake by ESO" rows={board(eso, sub, (r) => r.total)} curLabel={CONTEST.label} prevLabel="" noChange
          summary={`${eur(eso.reduce((a, r) => a + r.total, 0))} from ${custWord(eso.reduce((a, r) => a + r.customers, 0))}`} unranked={others.length ? away : undefined} />
        <Leaderboard title="New customers by ESO" rows={board(eso, (r) => `${eur(r.total)} · ${r.team}`, (r) => r.customers)} curLabel={CONTEST.label} prevLabel="" noChange fmt={int}
          unranked={others.length ? { ...away, rows: board(others, (r) => eur(r.total), (r) => r.customers) } : undefined} />
      </Box>
      <ChartBox title="All the figures, by ESO" hint="Each company counts for its Performis SAE, as on ESO Reports > Figures">
        <FullTable<Line> first="ESO" rows={lines} cols={cols} total={all} initial="total" find="an ESO" />
      </ChartBox>
    </>
  );
}

function ByTeam({ d }: { d: ContestData }) {
  const lines = useMemo(() => byTeam(d), [d]);
  const people = useMemo(() => {
    const out = new Map<string, number>();
    for (const l of byPerson(d)) if (l.customers) { const t = l.eso ? (d.teams.includes(l.team) ? l.team : NO_TEAM) : NOT_ESO; out.set(t, (out.get(t) ?? 0) + 1); }
    return out;
  }, [d]);
  const inTeams = lines.filter((l) => d.teams.includes(l.label)), rest = lines.filter((l) => !d.teams.includes(l.label));
  const nobody = !d.people.some((p) => p.eso && d.teams.includes(p.team));
  const sub = (r: Line) => `${custWord(r.customers)} · ${int(people.get(r.label) ?? 0)} ESO people scoring`;
  const away = rest.length ? { why: "Outside the teams", rows: board(rest, (r) => custWord(r.customers), (r) => r.total) } : undefined;
  const cols: Col<Line>[] = [
    { key: "people", head: "ESO people scoring", tip: "People with order intake from a new customer", cell: (r) => int(people.get(r.label) ?? 0), sort: (r) => people.get(r.label) ?? 0 },
    { key: "cust", head: "Customers", tip: "New customers with a sales action that brought order intake", cell: (r) => int(r.customers), sort: (r) => r.customers },
    ...monthCols(d),
    { key: "total", head: "Total", tip: CONTEST.label, cell: (r) => <b>{eur(r.total)}</b>, sort: (r) => r.total },
  ];
  const all = { ...totalLine(lines) };
  return (
    <>
      {nobody && <NoLeadYet name="the teams" />}
      <Box sx={TWO}>
        <Leaderboard title="Order intake by team" rows={board(inTeams, sub, (r) => r.total)} curLabel={CONTEST.label} prevLabel="" noChange unranked={away} />
        <Leaderboard title="New customers by team" rows={board(inTeams, (r) => eur(r.total), (r) => r.customers)} curLabel={CONTEST.label} prevLabel="" noChange fmt={int}
          unranked={away ? { ...away, rows: board(rest, (r) => eur(r.total), (r) => r.customers) } : undefined} />
      </Box>
      <ChartBox title="All the figures, by team" hint="A team: the ESO people whose line manager leads it, in Map assignment">
        <FullTable<Line> first="Team" rows={lines} cols={cols} total={all} natural />
      </ChartBox>
    </>
  );
}

/* ── the customers ─────────────────────────────────────────────────────── */

type CRow = ContestCompany & { label: string; total: number };
const EMPTY: Record<Missing, string> = { action: "Every new customer that orders had a sales action up to its first order", both: "Every new customer has a sales action up to its first order or order intake" };
const TITLE: Record<Missing, string> = {
  action: "New customers that order, with no call, e-mail, meeting or visit by ESO up to their first order",
  both: "New customers with no order intake yet and no call, e-mail, meeting or visit by ESO up to their first order",
};

function Customers({ d, rows, missing }: { d: ContestData; rows: ContestCompany[]; missing?: Missing }) {
  const open = !!missing;
  const list = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((c): CRow => {
      // the table keys its rows by name: two companies of one name keep both
      const name = c.name || "Unnamed company";
      const label = seen.has(name) ? `${name} (${c.id})` : name;
      seen.add(label);
      return { ...c, label, total: totalOf(c) };
    });
  }, [rows]);
  if (!list.length) return <Note title={missing ? EMPTY[missing] : "No new customer with a sales action yet"} />;
  const person = (r: CRow) => d.people[r.person];
  const cols: Col<CRow>[] = [
    { key: "eso", head: "ESO", tip: "The company's Performis SAE", cell: (r) => person(r).name },
    { key: "first", head: "First order", tip: "Compass's first order date - else the shop's first order", cell: (r) => <span title={FROM[r.from]}>{dayWords(r.day)}</span>, sort: (r) => Number((r.day ?? "").replace(/-/g, "")) },
    ...(open ? [] : [
      { key: "actions", head: "Sales actions", tip: "Calls, e-mails sent from their own address (not a shared mailbox), HubSpot meetings and completed visits by someone in ESO up to the first order, on the company or one of its contacts - hover a figure for the split",
        cell: (r: CRow) => <span title={`${int(r.actions.calls)} calls · ${int(r.actions.emails)} e-mails sent · ${int(r.actions.meetings)} meetings · ${int(r.actions.visits)} visits`}>{int(actionCount(r.actions))}</span>,
        sort: (r: CRow) => actionCount(r.actions) },
      { key: "last", head: "Last action", tip: "The last call, e-mail sent, meeting or visit by someone in ESO up to the first order, on the company or one of its contacts", cell: (r: CRow) => dayWords(r.actions.last), sort: (r: CRow) => Number((r.actions.last ?? "").replace(/-/g, "")) },
    ]),
    // with no order intake, the months are all nought: the table keeps to who and since when
    ...(missing === "both" ? [] : [
      ...MONTH_HEADS.map((m, i): Col<CRow> => ({ key: `m${i}`, head: m, cell: (r) => (started(d.today, i) ? eur(r.intake[i]) : <span style={{ color: FAINT }}>—</span>), sort: (r) => r.intake[i] })),
      { key: "total", head: "Total", tip: CONTEST.label, cell: (r: CRow) => <b>{eur(r.total)}</b>, sort: (r: CRow) => r.total },
    ]),
    { key: "hs", head: "HubSpot", cell: (r) => (
      <Box component="a" href={hsCompany(r.id)} target="_blank" rel="noreferrer" aria-label={`${r.label} in HubSpot`} onClick={(e) => e.stopPropagation()}
        sx={{ color: TINT.blue.fg, display: "inline-flex", alignItems: "center", gap: 0.4, fontWeight: 600, textDecoration: "none" }}>Open<OpenInNewIcon sx={{ fontSize: 14 }} /></Box>
    ) },
  ];
  const sum = (f: (r: CRow) => number) => list.reduce((a, r) => a + f(r), 0);
  const total = {
    ...list[0], label: "Total", total: sum((r) => r.total), intake: MONTH_HEADS.map((_, i) => sum((r) => r.intake[i])), day: null,
    actions: { calls: sum((r) => r.actions.calls), emails: sum((r) => r.actions.emails), meetings: sum((r) => r.actions.meetings), visits: sum((r) => r.actions.visits), last: null },
  } as CRow;
  const totalCols = cols.map((x) => (["eso", "first", "last", "hs"].includes(x.key) ? { ...x, cell: (r: CRow) => (r === total ? "" : x.cell(r)) } : x));
  return (
    <ChartBox title={missing ? TITLE[missing] : "Every new customer in the contest"}
      hint={missing === "action" ? `${int(list.length)} new customers with order intake and no sales action by ESO up to their first order · ${eur(sum((r) => r.total))} order intake`
        : missing === "both" ? `${int(list.length)} new customers with neither order intake nor a sales action by ESO up to their first order`
        : `${int(list.length)} customers · ${int(sum((r) => actionCount(r.actions)))} sales actions up to the first order`}>
      <FullTable<CRow> first="Customer" rows={list} cols={totalCols} total={missing === "both" ? undefined : total} initial={missing === "both" ? "first" : "total"} find="a customer" />
    </ChartBox>
  );
}
