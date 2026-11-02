"use client";

// SMART SEGMENTATION - is a run alive, and what did it do (SARCLA 02.11.2026: "with this steering I don't know if it's live
// and working, reworking the priority as it should - 'Live - the hub gives every new company its first APSO segment' is a
// good example; Websites and Yearly the same, they are really incomplete"). Each run's tab, in the order of the others:
// its pulse and when it ran last and runs next, its counts, its days one by one with the companies behind them in the
// reporting pages' window, and the list of the companies it changed (SARCLA: "you don't have the button on the modal and
// the design changes from page to page"). Reads /api/uc/segmentation/history.

import { useState } from "react";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { DEEMPHASIS } from "@/app/charts/palette";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { ChartBox } from "@/app/reporting/eso-benchmark/Figures";
import type { CompanySource } from "@/app/reporting/CompanyList";
import { FAINT, MUTED } from "@/app/uc/report/ui";
import { Choice, Info } from "@/app/connectors/parts";
import { YEARLY_RULES } from "@/lib/segmentation/yearly";
import type { Move, RunAction, RunDay } from "@/lib/integrations/segmentation";
import type { Run, Status, Topic } from "./Runs";
import { ListCard, StatusCard, dayTime } from "./lists";

const HOUR = 3_600_000;
const ago = (ms: number) => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))} s ago` : ms < 2 * HOUR ? `${Math.round(ms / 60_000)} min ago` : ms < 48 * HOUR ? `${Math.round(ms / HOUR)} h ago` : `${Math.round(ms / 86_400_000)} days ago`);
const eur = (v: string) => (v && Number.isFinite(Number(v)) ? `${full(Math.round(Number(v)))} €` : v || "none");
const prio = (v: string) => (v ? `P${v[0]}${v[0] === "4" ? " (no priority)" : ""}` : "none");

type Part = { key: string; label: string; color: string; of: (d: RunDay) => number };
type Cfg = {
  /** what it is, before whether it is alive */
  name: string;
  action: RunAction; last: (st: Status) => Run; every: number; what: string; next: string;
  parts: Part[]; whyLabel?: Record<string, string>; from?: (v: string) => string; to?: (v: string) => string; movesTitle?: string;
  /** the columns of its list: what was, what is now */
  was?: string; now?: string;
};
const s = (d: RunDay, k: string) => d.stats[k] ?? 0;
const CFG: Record<Topic, Cfg> = {
  new: {
    name: "The watcher", action: "watch", last: (st) => st.watcher_last, every: 6 * 60_000, what: "every 2 minutes: the companies created in the last 48 hours get a priority and a starter potential", next: "the next pass within 2 minutes",
    parts: [
      { key: "prio", label: "Priority set", color: "#1b7a55", of: (d) => ["P1", "P2", "P3", "P4"].reduce((a, k) => a + s(d, k), 0) },
      { key: "seed", label: "Starter potential", color: "#5b8def", of: (d) => s(d, "potential_seeded") },
    ],
    whyLabel: { prio: "Priority set", seed: "Starter potential", prio_seed: "Priority and starter potential", enrich: "APIC, industry or keywords" }, from: prio, to: prio,
    movesTitle: "The companies the watcher gave a priority or a potential", was: "Priority before", now: "Priority now",
  },
  sweep: {
    name: "The nightly sweep", action: "sweep", last: (st) => st.last_sweep, every: 30 * HOUR, what: "every night after the ERP chain: every company's priority from its potential and its best revenue year - raised when it should be, never lowered", next: "the next tonight, after the ERP chain",
    parts: [
      { key: "up", label: "Priority raised", color: "#1b7a55", of: (d) => s(d, "upgrade") },
      // not "fill": the chart takes a row's "fill" for the colour of its bars - the sweep's columns drew black
      { key: "filled", label: "Filled or bought again", color: "#eda100", of: (d) => s(d, "fill_empty") + s(d, "unlost") },
      { key: "facts", label: "Helper fields refreshed", color: DEEMPHASIS, of: (d) => s(d, "facts_only") },
    ],
    whyLabel: { upgrade: "Priority raised", fill: "Had no priority", unlost: "APSOlost bought again" }, from: prio, to: prio, movesTitle: "What the last night changed", was: "Priority before", now: "Priority now",
  },
  potential: {
    name: "The potential recalculation", action: "potential", last: (st) => st.last_potential, every: 30 * HOUR, what: "every night: the potentials the engine set itself recalculated from revenue and product fit - raised, never lowered, a person's value never touched", next: "the next tonight, after the ERP chain",
    parts: [
      { key: "recalc", label: "Raised to the formula", color: "#1b7a55", of: (d) => s(d, "machine_recalc") },
      { key: "filled", label: "Filled (was empty)", color: "#eda100", of: (d) => s(d, "filled") },
      { key: "restored", label: "A person's value restored", color: "#9a7bf0", of: (d) => s(d, "human_restored") },
    ],
    whyLabel: { machine_recalc: "Raised to the formula", filled: "Was empty", human_restored: "A person's value restored" }, from: eur, to: eur, movesTitle: "What the last run changed", was: "Potential before", now: "Potential now",
  },
  web: {
    name: "The website reading", action: "web", last: (st) => st.last_web, every: 30 * HOUR, what: "every night 200 companies, and every new company within minutes: its own website read for an empty description, size and address - each site once in 30 days", next: "new companies as they come, the next batch tonight",
    parts: [
      { key: "ok", label: "Something learned", color: "#1b7a55", of: (d) => s(d, "site_ok") },
      { key: "no", label: "Tried, nothing to learn", color: DEEMPHASIS, of: (d) => Math.max(0, s(d, "attempted") - s(d, "site_ok")) },
    ],
    whyLabel: { web: "From its website" }, from: (v) => v, to: (v) => v.replace("numberofemployees", "employees").replace("apic_ap", "APIC"), movesTitle: "The websites read lately", was: "Website", now: "Filled",
  },
  yearly: {
    name: "The yearly reclassification", action: "yearly", last: (st) => st.last_yearly, every: 400 * 24 * HOUR, what: "once a year, in January, by hand after a preview: every APSO segment decided again by 14 rules, every priority set exactly to the rule - up or down", next: "January, after a preview and its Excel",
    parts: [{ key: "written", label: "Companies written", color: "#9a7bf0", of: (d) => d.written }],
  },
};

export type History = { days: Record<string, RunDay>; moves: { at: string; rows: Move[] } | null };
export function useRunHistory(topic: Topic): History | null {
  const action = CFG[topic].action;
  const r = useHeld<History>(`/api/uc/segmentation/history?action=${action}`, [action]).result;
  return r?.state === "ok" ? r.data : null;
}

/** The companies a run changed, as the companies window lists them. */
function movesSource(topic: Topic, rows: Move[], key: string, note: string): CompanySource {
  const c = CFG[topic];
  const money = topic === "potential";
  return {
    key, note, head: [c.was ?? "Was", c.now ?? "Now", "Why", "When"], left: money ? [3] : [1, 2, 3],
    rows: () => rows.map((m) => ({
      id: m.id, name: m.n || m.id,
      cells: [c.from ? c.from(m.from) : m.from, <b key="to">{c.to ? c.to(m.to) : m.to}</b>, c.whyLabel?.[m.why] ?? m.why, dayTime(m.at)],
      values: [money ? Number(m.from) || null : m.from || null, money ? Number(m.to) || null : m.to || null, c.whyLabel?.[m.why] ?? m.why, m.at],
    })),
  };
}

/** Is it alive: running, live and working, late, not run - and when it ran last and runs next. */
export function RunStatus({ topic, st, live }: { topic: Topic; st: Status; live: boolean }) {
  const c = CFG[topic];
  const last = c.last(st);
  const lastAt = last && typeof last.at === "string" ? last.at : null;
  const age = lastAt ? Date.now() - Date.parse(lastAt) : Infinity;
  // the nightly runs the sweep, the potentials and a website batch one after the other under one name
  const isRunning = !!st.running && (st.running.what === topic || (topic === "new" && st.running.what === "watch") || (st.running.what === "nightly" && ["sweep", "potential", "web"].includes(topic)));
  const yearlyDone = topic === "yearly" && st.yearly_done === st.year;
  const ok = topic === "yearly" ? yearlyDone : !!lastAt && !last?.dry && age < c.every;
  const tone = !live ? FAINT : isRunning ? "#eda100" : ok ? "#1b7a55" : topic === "yearly" ? "#eda100" : "#c5221f";
  const state = !live ? "the Compass connector runs it here, not the hub"
    : isRunning ? `running now - since ${dayTime(st.running!.started)}`
    : topic === "yearly" ? (yearlyDone ? `done for ${st.year}` : `not run for ${st.year} - due in January, by hand`)
    : ok ? "live, working as it should"
    : lastAt ? `late - the last real run was ${ago(age)}` : "not run yet";
  return (
    <StatusCard tone={tone} beat={live && (ok || isRunning) && topic !== "yearly"} title={`${c.name} - ${state}`}
      line={`${lastAt ? `Last run ${dayTime(lastAt)} - ${ago(age)}${last?.dry ? " (a preview, nothing written)" : ""}. ` : ""}It runs ${c.what}. Next: ${c.next}.`} />
  );
}

/** Its days one by one - the companies of its last run behind the chart's button; the yearly run: its 14 rules. */
export function RunDays({ topic, st, h }: { topic: Topic; st: Status; h: History | null }) {
  const c = CFG[topic];
  if (topic === "yearly") return <YearlyRules st={st} />;
  const days = h ? Object.keys(h.days).sort().slice(-30) : [];
  const moves = h?.moves?.rows ?? [];
  return (
    <ChartBox title="Day by day" hint={c.parts.map((p) => p.label).join(" · ")}
      companies={moves.length ? movesSource(topic, moves, `days|${topic}|${h!.moves!.at}`, `${c.movesTitle} - ${full(moves.length)} ${moves.length === 1 ? "company" : "companies"}, ${dayTime(h!.moves!.at)}`) : null}>
      {days.length ? (
        <StackedColumns height={180} data={days.map((k) => ({ x: k, ...Object.fromEntries(c.parts.map((p) => [p.key, p.of(h!.days[k])])) }))}
          parts={c.parts.map(({ key, label, color }) => ({ key, label, color }))} format={(v) => full(v ?? 0)} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`} />
      ) : (
        <Info>Counted from 02.11.2026 on - the first day shows after its next run.</Info>
      )}
    </ChartBox>
  );
}

/** The companies it changed, the table of the companies window, narrowed by why. */
export function RunMoves({ topic, h }: { topic: Topic; h: History | null }) {
  const c = CFG[topic];
  const [why, setWhy] = useState("all");
  if (!c.movesTitle) return null;
  const all = h?.moves?.rows ?? [];
  if (!all.length) return <Info>{h?.moves ? `${c.movesTitle}: nothing changed.` : `${c.movesTitle}: kept from 02.11.2026 on - the companies show after the next run.`}</Info>;
  const whys = [...new Set(all.map((m) => m.why))];
  const rows = all.filter((m) => why === "all" || m.why === why);
  return (
    <ListCard title={c.movesTitle} hint={`${full(all.length)} ${all.length === 1 ? "company" : "companies"}, ${dayTime(h!.moves!.at)} · a click on a column orders by it`}
      source={movesSource(topic, rows, `moves|${topic}|${why}|${h!.moves!.at}`, topic === "web" ? "The website each was read from and the fields it filled" : "What it was before the run and what the run set")}>
      {whys.length > 1 && (
        <Choice<string> value={why} onChange={setWhy} options={[{ key: "all", label: "All", count: all.length }, ...whys.map((k) => ({ key: k, label: c.whyLabel?.[k] ?? k, count: all.filter((m) => m.why === k).length }))]} />
      )}
    </ListCard>
  );
}

/** The yearly run's 14 rules in the order they are tried, with the companies each took in the last preview or run. */
function YearlyRules({ st }: { st: Status }) {
  const ys = st.yearly_summary;
  const by = ys?.byRule ?? {};
  return (
    <ChartBox title="The 14 rules, the first that fits decides"
      hint={ys ? `The companies each took in the last ${ys.dry ? "preview" : "run"}, ${dayTime(ys.at)}` : "Not previewed yet: a preview reads every company and writes nothing - it shows here how many each rule would take, and the Excel lists them"}>
      <Table head={["When", "Gives", "Companies"]} left={[1]} firstWidth="minmax(280px, 3fr)" widths={["minmax(150px, 1fr)", "minmax(110px, 0.6fr)"]} minWidth={620}
        rows={YEARLY_RULES.map((rule, i) => ({ key: rule.key, cells: [
          <span key="w"><span style={{ color: MUTED, marginRight: 8 }}>{i + 1}</span>{rule.text}</span>, rule.segment, ys ? full(by[rule.key] ?? 0) : "—",
        ] }))} />
    </ChartBox>
  );
}
