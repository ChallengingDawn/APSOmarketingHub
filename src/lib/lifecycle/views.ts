// THE LIFECYCLE PAGES - what each page shows, from a page's dataset, the shared
// email sends and the hub-wide period. Pure, so it is tested with the rules
// (tests/lifecycle.test.ts) and the route only reads and hands over.
//
// One reading for every page: the TILES and the LIST follow the period (who
// entered the flow in it, and what has happened to them since); the monthly
// CHARTS show every month since January 2025 whatever the period, because a
// trend of one month is not a trend. "Did it buy" is always the hub's real ERP
// order facts; the workflows' own "Bought ..." fields are a side note.

import {
  CUSTOMER_STAGES, FEB_RESTAGE, QUAL_KINDS, qualKind, STAGE, STAGES, UC12_MONTHS, UC15_BACKFILL_MONTH, UC2_DAYS, UC4_DAYS, UC9_MONTHS, UCS,
  ucOf, type UcKey,
} from "./config";
import {
  RESTAGE_NOTE, addMonths, afterVsYearBefore, cartValue, churnEpisodes, daysBetween, inWin, isRestageMonth, lastStepBefore,
  monthLabel, monthOf, monthsFrom, nextEntry, parseEmailName, rateOf, ratingOf, revenueBetween, tally, touchesRestage, within,
  withinMonths, type Follow, type Win,
} from "./rules";
import type {
  ChartView, Co, EmailData, EmailRow, EmailView, OverviewData, Row, Source, Ticket, Tile, UcData, View,
} from "./types";

export const LIST_CAP = 300;

/* ── small words ───────────────────────────────────────────────────────── */

const n0 = (n: number) => Math.round(n).toLocaleString("en-US");
const eur = (n: number) => `€${n0(n)}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2025-11-18" -> "18 Nov 2025". */
export const longDay = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n0(n)} ${n === 1 ? one : many}`;

const byId = (cos: Co[]) => new Map(cos.map((c) => [c.id, c]));
const chartMonths = (horizon: string, today: string) => monthsFrom(horizon, today);
const foot = (months: string[]) => (touchesRestage(months) ? RESTAGE_NOTE : undefined);
const PERIOD_NOTE = "Tiles and the list follow the period; the monthly charts show every month since January 2025.";

/** "Closed 3 Oct" / the open stage's name. */
const ticketStatus = (t: Ticket) => (t.closed ? "Closed" : t.stage || "Open");
const answerOf = (t: Ticket) => t.resolution || (t.closed ? "Closed, no answer given" : "Not answered yet");

function resolutionBars(tickets: Ticket[], title = "What ESO and TSA answered"): ChartView {
  const t = tally(tickets.map(answerOf));
  return {
    kind: "bars", tab: "follow", title, note: `${plural(tickets.length, "ticket")} raised in the period, by the answer on the ticket`, fmt: "n",
    rows: t.map((r) => ({ label: r.label, value: r.n, secondary: pct(r.n, tickets.length) })),
  };
}

function ticketTile(tickets: Ticket[], label = "Tickets raised"): Tile {
  const open = tickets.filter((t) => !t.closed).length;
  return { label, value: tickets.length, fmt: "n", icon: "ticket", tint: "pink", note: `${n0(open)} open · ${n0(tickets.length - open)} closed` };
}

/** "None since": a task flow whose latest task is more than 60 days old. */
function dormant(lastTask: { era: string; day: string | null }[], eras: string[], what: string, today: string): string | null {
  const days = lastTask.filter((l) => eras.includes(l.era) && l.day).map((l) => l.day as string).sort();
  const last = days[days.length - 1];
  if (!last || daysBetween(last, today) <= 60) return null;
  return `The ${what} tasks stopped on ${longDay(last)} - none since.`;
}

function outcomeNote(d: UcData): string | null {
  if (!d.outcomeTally?.length) return null;
  const parts = d.outcomeTally.map((t) => `${t.label} ${n0(t.n)}`).join(" · ");
  const rev = d.outcomeRevenue && d.outcomeRevenue.n ? `; its revenue field holds ${eur(d.outcomeRevenue.sum)} on ${plural(d.outcomeRevenue.n, "company", "companies")}` : "";
  return `Workflow outcome field: ${parts}${rev}. The figures above use real ERP orders.`;
}

/**
 * Items counted per month and part. `mark` puts the February 2026 star on the
 * month label - for stage moves only, where the mass re-stage shows.
 */
function monthly<T>(items: T[], dayOf: (t: T) => string | null, months: string[], parts: { key: string; label: string }[], partOf: (t: T) => string | null, mark = false): Row[] {
  const rows = new Map<string, Row>(months.map((m) => [m, { x: monthLabel(m, mark), ...Object.fromEntries(parts.map((p) => [p.key, 0])) }]));
  for (const t of items) {
    const d = dayOf(t);
    if (!d) continue;
    const r = rows.get(monthOf(d));
    const k = partOf(t);
    if (r && k && typeof r[k] === "number") r[k] = (r[k] as number) + 1;
  }
  return [...rows.values()];
}

function cap(rows: Row[]): Row[] {
  return rows.slice(0, LIST_CAP);
}

function view(key: UcKey, win: Win, d: UcData, parts: Pick<View, "tiles" | "charts" | "list" | "findings" | "notes">): View {
  const uc = ucOf(key);
  return {
    key, generatedAt: d.generatedAt, code: uc.code, title: uc.title, does: uc.does, converted: uc.converted, window: win, ...parts,
    findings: [...parts.findings, ...uc.findings],
    notes: [...parts.notes, PERIOD_NOTE],
    sources: d.sources,
  };
}

/* ── emails, every page ────────────────────────────────────────────────── */

/** Sends per email step of the given UC numbers: in the period, since the horizon, and the statistics when there are any. */
export function emailView(data: EmailData | null, ucNums: string[], win: Win, expected: string[] = []): EmailView | null {
  if (!data) return null;
  const parsed = data.names.map((n) => parseEmailName(n));
  type G = { step: string; raw: string; version: string; names: Set<string>; sendsWin: number; companies: Set<number>; sendsAll: number; last: string | null };
  const groups = new Map<string, G>();
  for (const [ni, day, ci] of data.sends) {
    const p = parsed[ni];
    if (!p || !ucNums.includes(p.uc)) continue;
    const step = ucNums.length > 1 ? `UC${p.uc} · ${p.step}` : p.step;
    const k = `${p.version}|${step}`;
    let g = groups.get(k);
    if (!g) { g = { step, raw: p.step, version: p.version, names: new Set(), sendsWin: 0, companies: new Set(), sendsAll: 0, last: null }; groups.set(k, g); }
    g.names.add(data.names[ni]);
    g.sendsAll += 1;
    if (!g.last || day > g.last) g.last = day;
    if (inWin(day, win)) { g.sendsWin += 1; if (ci >= 0) g.companies.add(ci); }
  }
  const rows: EmailRow[] = [...groups.values()]
    .sort((a, b) => b.version.localeCompare(a.version) || a.step.localeCompare(b.step, "en", { numeric: true }))
    .map((g) => {
      let stats: EmailRow["stats"] = null;
      if (data.stats) {
        stats = { sent: 0, open: 0, click: 0 };
        for (const nm of g.names) {
          const s = data.stats[nm];
          if (s) { stats.sent += s.sent; stats.open += s.open; stats.click += s.click; }
        }
      }
      return { step: g.step, version: g.version, variants: g.names.size, sendsWin: g.sendsWin, companiesWin: g.companies.size, sendsAll: g.sendsAll, lastSent: g.last, stats };
    });
  const seen = new Set([...groups.values()].filter((g) => g.sendsAll > 0).map((g) => g.raw));
  return {
    rows, unseen: expected.filter((s) => !seen.has(s)), contactsRead: data.contactsRead, horizon: data.horizon,
    statsOn: data.stats !== null, statsError: data.statsError,
  };
}

/** Per company, the UC's email steps that reached it, with the day. */
export function stepsByCompany(data: EmailData | null, ucNums: string[]): Map<string, { step: string; day: string }[]> {
  const out = new Map<string, { step: string; day: string }[]>();
  if (!data) return out;
  const parsed = data.names.map((n) => parseEmailName(n));
  for (const [ni, day, ci] of data.sends) {
    const p = parsed[ni];
    if (!p || ci < 0 || !ucNums.includes(p.uc)) continue;
    const id = data.companies[ci];
    const list = out.get(id) ?? [];
    list.push({ step: p.step, day });
    out.set(id, list);
  }
  return out;
}

/* ── overview ──────────────────────────────────────────────────────────── */

export function overviewView(d: OverviewData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const staged = d.total - d.noStage;
  const customers = d.now.filter((s) => CUSTOMER_STAGES.includes(s.stage)).reduce((a, s) => a + s.n, 0);
  const inW = d.entries.filter((e) => inWin(e.day, win));
  const changes = inW.reduce((a, e) => a + e.n, 0);
  const byWf = inW.filter((e) => e.src === "wf").reduce((a, e) => a + e.n, 0);

  const SRC = [
    { key: "wf", label: "A workflow" },
    { key: "bulk", label: "A person, in bulk or by import" },
    { key: "merge", label: "A merge" },
    { key: "other", label: "Anything else" },
  ];
  const bySrc = new Map<string, Row>(months.map((m) => [m, { x: monthLabel(m), wf: 0, bulk: 0, merge: 0, other: 0 }]));
  const byStage = new Map<string, Row>(months.map((m) => [m, { id: m, month: monthLabel(m), ...Object.fromEntries(STAGES.map((s) => [s.id, 0])), total: 0 }]));
  for (const e of d.entries) {
    const m = monthOf(e.day);
    const r = bySrc.get(m);
    if (r) r[e.src] = (r[e.src] as number) + e.n;
    const s = byStage.get(m);
    if (s) { s[e.stage] = ((s[e.stage] as number) ?? 0) + e.n; s.total = (s.total as number) + e.n; }
  }

  // the findings, from the data where the data can say it
  const findings: string[] = [];
  const t10 = dormant(d.lastTask, ["UC10", "UC11"], "UC10+11 \"No repeated purchase\"", d.today);
  if (t10) findings.push(t10);
  const t13 = dormant(d.lastTask, ["UC13"], "UC13 \"did not react to the discount code\"", d.today);
  if (t13) findings.push(t13);
  if (emails) {
    const e6 = emailView(emails, ["6"], win);
    if (!e6?.rows.some((r) => r.version !== "v1")) findings.push("UC6: the v2 thank-you / rating email has never been sent.");
    const e15 = emailView(emails, ["15"], win, ucOf("uc15").expectedSteps);
    for (const s of e15?.unseen ?? []) findings.push(`UC15: ${s} has never been sent.`);
  }
  const feb = byStage.get(FEB_RESTAGE);
  if (feb) {
    const others = months.filter((m) => m.startsWith(FEB_RESTAGE.slice(0, 4)) && !isRestageMonth(m) && m < d.today.slice(0, 7)).map((m) => byStage.get(m)?.total as number).sort((a, b) => a - b);
    const usual = others.length ? others[Math.floor(others.length / 2)] : null;
    findings.push(`February 2026: ${n0(feb.total as number)} stage changes${usual !== null ? ` against a usual ${n0(usual)} a month` : ""} - a mass re-stage.`);
  }

  return {
    key: "overview", generatedAt: d.generatedAt, code: "UC", title: "Use Cases Overview",
    does: "Every use case, where every company stands in its lifecycle today, and how many moved stage each month.",
    converted: "Each UC page says what converted means there; all of them count companies and real ERP orders.",
    window: win,
    tiles: [
      { label: "Companies", value: d.total, fmt: "n", icon: "companies", tint: "blue", note: `${n0(d.noStage)} without a lifecycle stage` },
      { label: "With a stage", value: staged, fmt: "n", icon: "stage", tint: "purple", note: `${pct(staged, d.total)} of all companies` },
      { label: "Customers", value: customers, fmt: "n", icon: "order", tint: "green", note: "a stage from New customer on" },
      { label: "Stage changes in the period", value: changes, fmt: "n", icon: "up", tint: "amber", note: `${pct(byWf, changes)} made by a workflow` },
    ],
    charts: [
      {
        kind: "bars", title: "Companies per stage today", note: "Every company with a lifecycle stage, in the pipeline's order", fmt: "n",
        rows: STAGES.map((s) => ({ label: s.label, value: d.now.find((x) => x.stage === s.id)?.n ?? 0, secondary: pct(d.now.find((x) => x.stage === s.id)?.n ?? 0, staged) })),
      },
      {
        kind: "stack", title: "Stage changes per month, by who made them", note: "Every entry into a stage, from each company's stage history", fmt: "n",
        parts: SRC, rows: [...bySrc.values()], footnote: foot(months),
      },
    ],
    list: {
      title: "Stage changes per month", note: "Companies entering each stage; a company that re-enters a stage counts again", link: null,
      cols: [{ key: "month", label: "Month", fmt: "text" }, ...STAGES.map((s) => ({ key: s.id, label: s.label, fmt: "n" as const })), { key: "total", label: "All", fmt: "n" }],
      rows: [...byStage.values()].reverse(), total: byStage.size, empty: "No stage changes since January 2025.",
    },
    findings,
    notes: ["Stage changes come from every company's lifecycle-stage history since January 2025.", PERIOD_NOTE],
    sources: d.sources,
  };
}

/* ── UC2 Welcome ───────────────────────────────────────────────────────── */

/**
 * Who qualified the period's new MQLs: the person who set "Qualified by Company
 * Owner" (task or ticket era alike), its three "Yes" kinds and "No"; a company
 * with no decision yet counts under its owner.
 */
export function whoQualified(cos: Co[], names: Record<string, string>): ChartView {
  type P = { person: string; own: number; support: number; byEso: number; yes: number; no: number; open: number; total: number };
  const by = new Map<string, P>();
  for (const c of cos) {
    const kind = qualKind(c.qual?.v);
    const id = kind && c.qual?.by ? `u:${c.qual.by}` : c.owner ? `o:${c.owner}` : "";
    // owners (archived too) and users both looked up: an id still unnamed is someone removed from HubSpot
    const person = id ? names[id] ?? `Former user ${id.slice(2)}` : "No owner";
    const p = by.get(person) ?? { person, own: 0, support: 0, byEso: 0, yes: 0, no: 0, open: 0, total: 0 };
    if (kind === "no") p.no++;
    else if (kind) { p[kind]++; p.yes++; }
    else p.open++;
    p.total++;
    by.set(person, p);
  }
  return {
    kind: "table", tab: "follow", title: "Who qualified", fmt: "n",
    note: "The period's new MQLs, by the person who set \"Qualified by Company Owner\"; not decided yet = the company owner",
    cols: [
      { key: "person", label: "Person", fmt: "text" },
      ...QUAL_KINDS.map((k) => ({ key: k.key, label: k.label, fmt: "n" as const })),
      { key: "yes", label: "Qualified", fmt: "n" },
      { key: "no", label: "Disqualified", fmt: "n" },
      { key: "open", label: "Not decided yet", fmt: "n" },
      { key: "total", label: "Total", fmt: "n" },
    ],
    rows: [...by.values()].sort((a, b) => b.yes + b.no - (a.yes + a.no) || b.total - a.total || a.person.localeCompare(b.person)),
  };
}

export function uc2View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  type C = { c: Co; mql: string; already: boolean; sql: boolean; lost: boolean; order: Follow };
  const cohort: C[] = [];
  for (const c of d.companies) {
    const e = c.entries ?? [];
    const mql = e.find((x) => x[0] === STAGE.mql)?.[1] ?? (c.enrolled && c.enrolled >= d.horizon ? c.enrolled : null);
    if (!mql) continue;
    const already = !!c.first && c.first < mql;
    cohort.push({
      c, mql, already,
      sql: !!nextEntry(e, mql, [STAGE.sql]), lost: !!nextEntry(e, mql, [STAGE.lostLead]),
      order: already ? "no" : within(mql, c.first, UC2_DAYS, d.today),
    });
  }
  const fresh = cohort.filter((x) => !x.already);
  const inW = fresh.filter((x) => inWin(x.mql, win));
  const alreadyW = cohort.filter((x) => x.already && inWin(x.mql, win)).length;
  const yes = inW.filter((x) => x.order === "yes").length;
  const open = inW.filter((x) => x.order === "open").length;
  const rate = rateOf(inW.map((x) => x.order));
  const sql = inW.filter((x) => x.sql).length;
  const lost = inW.filter((x) => x.lost).length;
  const tW = d.tickets.filter((t) => inWin(t.created, win));
  const taskW = d.tasks.filter((t) => inWin(t.created, win));
  const lastTaskDay = d.lastTask.map((l) => l.day).filter((x): x is string => !!x).sort().pop() ?? null;

  const latestTicket = new Map<string, Ticket>();
  for (const t of d.tickets) if (t.companyId && (!latestTicket.get(t.companyId) || t.created > latestTicket.get(t.companyId)!.created)) latestTicket.set(t.companyId, t);

  const where = (c: Co) => (c.stage && CUSTOMER_STAGES.includes(c.stage) ? "customer" : c.stage === STAGE.sql ? "sql" : c.stage === STAGE.mql ? "mql" : "other");
  const list = [...inW].sort((a, b) => b.mql.localeCompare(a.mql)).map((x): Row => {
    const t = latestTicket.get(x.c.id);
    return {
      id: x.c.id, name: x.c.name, mql: x.mql, stage: x.c.stage, ticket: t ? `${answerOf(t)}` : "No ticket",
      first: x.c.first && x.c.first >= x.mql ? x.c.first : null,
    };
  });

  const notes = [outcomeNote(d)].filter((s): s is string => !!s);
  return view("uc2", win, d, {
    tiles: [
      { label: "Became an MQL", value: inW.length, fmt: "n", icon: "companies", tint: "blue", note: alreadyW ? `${n0(alreadyW)} more were customers already - left out` : "new companies, by the day they became an MQL" },
      { label: "Moved to SQL", value: sql, fmt: "n", icon: "stage", tint: "purple", note: `${pct(sql, inW.length)} of them` },
      { label: "First order within 90 days", value: yes, fmt: "n", icon: "order", tint: "green", note: `${rate === null ? "—" : `${Math.round(rate * 100)}%`} of those whose 90 days are over · ${n0(open)} still inside` },
      { label: "Moved to Lost lead", value: lost, fmt: "n", icon: "down", tint: "amber", note: `${pct(lost, inW.length)} of them` },
      ticketTile(tW),
      { label: "Tasks created", value: taskW.length, fmt: "n", icon: "task", tint: "slate", note: `${n0(taskW.filter((t) => t.done).length)} done${lastTaskDay ? ` · latest ever: ${longDay(lastTaskDay)}` : ""}` },
    ],
    charts: [
      {
        kind: "stack", title: "Each month's new MQLs, by where they are now", note: "New companies by the month they became an MQL, coloured by their stage today", fmt: "n",
        parts: [{ key: "customer", label: "Customer now" }, { key: "sql", label: "SQL now" }, { key: "mql", label: "Still MQL" }, { key: "other", label: "Lost lead or other" }],
        rows: monthly(fresh, (x) => x.mql, months, [{ key: "customer", label: "" }, { key: "sql", label: "" }, { key: "mql", label: "" }, { key: "other", label: "" }], (x) => where(x.c), true),
        footnote: foot(months),
      },
      {
        kind: "stack", tab: "follow", title: "ESO's follow-up: tasks until October 2026, tickets since", note: "Tasks and tickets the UC2 workflows created each month", fmt: "n",
        parts: [{ key: "tasks", label: "Tasks" }, { key: "tickets", label: "Tickets" }],
        rows: (() => {
          const r = monthly(d.tasks, (t) => t.created, months, [{ key: "tasks", label: "" }, { key: "tickets", label: "" }], () => "tasks");
          const t = monthly(d.tickets, (x) => x.created, months, [{ key: "tasks", label: "" }, { key: "tickets", label: "" }], () => "tickets");
          return r.map((row, i) => ({ ...row, tickets: t[i].tickets }));
        })(),
      },
      resolutionBars(tW),
      whoQualified(inW.map((x) => x.c), d.people ?? {}),
    ],
    list: {
      title: "New MQLs in the period", note: "Their stage today, their latest UC2 ticket and their first real order", link: "company",
      cols: [
        { key: "name", label: "Company", fmt: "text" }, { key: "mql", label: "Became MQL", fmt: "date" }, { key: "stage", label: "Stage now", fmt: "stage" },
        { key: "ticket", label: "Ticket", fmt: "text", hint: "The answer on the company's latest UC2 ticket" }, { key: "first", label: "First order", fmt: "date" },
      ],
      rows: cap(list), total: list.length, empty: "No company became an MQL in this period.",
    },
    findings: [], notes,
  });
}

/* ── UC15 Lost Leads ───────────────────────────────────────────────────── */

export function uc15View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today).filter((m) => m >= UC15_BACKFILL_MONTH);
  const cur = d.today.slice(0, 7);
  const cos = byId(d.companies);
  const cohort = d.companies.filter((c) => c.enrolled && c.enrolled >= d.horizon);
  const bought = (c: Co) => !!c.first && !!c.enrolled && c.first >= c.enrolled;
  const backfill = (c: Co) => monthOf(c.enrolled as string) === UC15_BACKFILL_MONTH;
  const inW = cohort.filter((c) => inWin(c.enrolled, win));
  const newW = inW.filter((c) => !backfill(c));
  const bfW = inW.filter(backfill);
  const conv = (l: Co[]) => l.filter(bought).length;
  const revenue = inW.filter(bought).reduce((s, c) => s + revenueBetween(c.rev, monthOf(c.enrolled as string), cur), 0);
  const tW = d.tickets.filter((t) => inWin(t.created, win));

  const steps = stepsByCompany(emails, ["15"]);
  const stepRows = new Map<string, number>();
  for (const c of inW.filter(bought)) {
    const k = lastStepBefore(steps.get(c.id) ?? [], c.first as string) ?? "No flow email before the order";
    stepRows.set(k, (stepRows.get(k) ?? 0) + 1);
  }
  const buyers = inW.filter(bought).length;

  const tiles: Tile[] = [
    { label: "Entered the flow", value: newW.length, fmt: "n", icon: "companies", tint: "blue", note: bfW.length ? `plus ${n0(bfW.length)} back-filled in July 2026 when the flow started` : "companies, by the day they entered" },
    { label: "Bought for the first time since", value: conv(newW), fmt: "n", icon: "order", tint: "green", note: `${pct(conv(newW), newW.length)} of them` },
  ];
  if (bfW.length) tiles.push({ label: "Back-filled in July 2026", value: bfW.length, fmt: "n", icon: "stage", tint: "slate", note: `${n0(conv(bfW))} bought since (${pct(conv(bfW), bfW.length)})` });
  tiles.push(
    { label: "Their revenue since", value: revenue, fmt: "eur", icon: "euro", tint: "purple", note: "ERP revenue of the companies that bought, from the month they entered" },
    ticketTile(tW),
  );

  const list = [...tW].sort((a, b) => b.created.localeCompare(a.created)).map((t): Row => {
    const c = t.companyId ? cos.get(t.companyId) : undefined;
    return { id: t.id, created: t.created, name: c?.name ?? "—", status: ticketStatus(t), answer: answerOf(t), bought: c?.first && c.first >= t.created ? c.first : "No" };
  });

  const e15 = emailView(emails, ["15"], win, ucOf("uc15").expectedSteps);
  const findings = (e15?.unseen ?? []).map((s) => `${s} has never been sent.`);

  return view("uc15", win, d, {
    tiles,
    charts: [
      {
        kind: "bars", title: "Which email they bought after", note: `${plural(buyers, "company", "companies")} of the period that bought, by the last UC15 email that reached them before the order`, fmt: "n",
        rows: [...stepRows.entries()].sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true })).map(([label, value]) => ({ label, value, secondary: pct(value, buyers) })),
        footnote: emails ? undefined : "Fills in once the email history is read.",
      },
      {
        kind: "stack", title: "Companies entering the flow each month", note: "By the month they entered, split by whether they have bought since", fmt: "n",
        parts: [{ key: "yes", label: "Bought since" }, { key: "no", label: "Not yet" }],
        rows: monthly(cohort, (c) => c.enrolled ?? null, months, [{ key: "yes", label: "" }, { key: "no", label: "" }], (c) => (bought(c) ? "yes" : "no")),
        footnote: "July 2026 holds the lost leads back-filled when the flow started.",
      },
      resolutionBars(tW),
    ],
    list: {
      title: "UC15 tickets in the period", note: "Each ticket's answer, and whether the company has bought for the first time since it was raised", link: "ticket",
      cols: [
        { key: "created", label: "Raised", fmt: "date" }, { key: "name", label: "Company", fmt: "text" }, { key: "status", label: "Status", fmt: "text" },
        { key: "answer", label: "Answer", fmt: "text" }, { key: "bought", label: "First order since", fmt: "date", hint: "The company's first real order, on or after the ticket day" },
      ],
      rows: cap(list), total: list.length, empty: "No UC15 ticket was raised in this period.",
    },
    findings, notes: [outcomeNote(d)].filter((s): s is string => !!s),
  });
}

/* ── UC6 Thank You ─────────────────────────────────────────────────────── */

export function uc6View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const cos = byId(d.companies);
  const firsts = d.firstDays ?? [];
  const fW = firsts.filter((x) => inWin(x, win)).length;
  const tW = d.tickets.filter((t) => inWin(t.created, win));
  const rating = (t: Ticket) => ratingOf(t.subject) ?? (t.companyId ? cos.get(t.companyId)?.nps ?? null : null);
  const rated = tW.map(rating).filter((r): r is number => r !== null);
  const again = (t: Ticket) => {
    const c = t.companyId ? cos.get(t.companyId) : undefined;
    return c?.last && c.last > t.created && (c.orders ?? 0) >= 2 ? c.last : null;
  };
  const againW = tW.filter((t) => again(t)).length;

  const perMonth = new Map(months.map((m) => [m, 0]));
  for (const x of firsts) perMonth.set(monthOf(x), (perMonth.get(monthOf(x)) ?? 0) + 1);

  const e6 = emailView(emails, ["6"], win);
  const findings: string[] = [];
  if (e6 && !e6.rows.some((r) => r.version !== "v1")) findings.push("The v2 thank-you / rating email has never been sent.");

  const list = [...tW].sort((a, b) => b.created.localeCompare(a.created)).map((t): Row => {
    const c = t.companyId ? cos.get(t.companyId) : undefined;
    const r = rating(t);
    return { id: t.id, created: t.created, name: c?.name ?? "—", rating: r === null ? "—" : `${r} / 10`, status: ticketStatus(t), answer: answerOf(t), again: again(t) ?? "No" };
  });

  return view("uc6", win, d, {
    tiles: [
      { label: "First purchasers", value: fW, fmt: "n", icon: "companies", tint: "blue", note: "companies whose first real order was in the period" },
      ticketTile(tW, "Poor-rating tickets"),
      { label: "Average rating on them", value: rated.length ? `${(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1)} / 10` : "—", fmt: "text", icon: "star", tint: "amber", note: `${plural(rated.length, "rating")} read` },
      { label: "Ordered again after the ticket", value: againW, fmt: "n", icon: "order", tint: "green", note: `${pct(againW, tW.length)} of the tickets' companies` },
    ],
    charts: [
      {
        kind: "trend", title: "First purchasers per month", note: "Companies whose first real ERP order fell in the month (this month so far)", fmt: "n",
        label: "First purchasers", points: months.map((m) => ({ x: monthLabel(m, false), value: perMonth.get(m) ?? 0 })),
      },
      resolutionBars(tW),
    ],
    list: {
      title: "Poor-rating tickets in the period", note: "The rating the customer gave, the answer, and whether the company has ordered since", link: "ticket",
      cols: [
        { key: "created", label: "Raised", fmt: "date" }, { key: "name", label: "Company", fmt: "text" }, { key: "rating", label: "Rating", fmt: "text" },
        { key: "status", label: "Status", fmt: "text" }, { key: "answer", label: "Answer", fmt: "text" }, { key: "again", label: "Ordered since", fmt: "date", hint: "The company's latest real order, when it came after the ticket" },
      ],
      rows: cap(list), total: list.length, empty: "No poor-rating ticket was raised in this period.",
    },
    findings, notes: [],
  });
}

/* ── UC9 Second Purchase ───────────────────────────────────────────────── */

/**
 * How fast the second order comes, pooled over cohorts: for k = 1..max months,
 * the share of companies at least k months past their first order that had a
 * second within k months. A company too young for month k is not counted in it.
 */
export function secondOrderCurve(cos: { first: string; second: string | null }[], today: string, max = UC9_MONTHS): { k: number; base: number; yes: number; share: number | null }[] {
  const out: { k: number; base: number; yes: number; share: number | null }[] = [];
  for (let k = 1; k <= max; k++) {
    const old = cos.filter((c) => addMonths(c.first, k) <= today);
    const yes = old.filter((c) => c.second && c.second > c.first && c.second <= addMonths(c.first, k)).length;
    out.push({ k, base: old.length, yes, share: old.length ? yes / old.length : null });
  }
  return out;
}

export function uc9View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const cohort = d.companies.filter((c) => c.first && c.first >= d.horizon);
  const f = (c: Co) => withinMonths(c.first as string, c.second, UC9_MONTHS, d.today);
  const path = (c: Co) => nextEntry(c.entries ?? [], c.first as string, [STAGE.grow, STAGE.newCustomerLost])?.[0] ?? null;
  const inW = cohort.filter((c) => inWin(c.first, win));
  const yes = inW.filter((c) => f(c) === "yes").length;
  const open = inW.filter((c) => f(c) === "open").length;
  const rate = rateOf(inW.map(f));
  const grow = inW.filter((c) => path(c) === STAGE.grow).length;
  const lost = inW.filter((c) => path(c) === STAGE.newCustomerLost).length;
  const tW = d.tickets.filter((t) => inWin(t.created, win));
  const curve = secondOrderCurve(cohort.map((c) => ({ first: c.first as string, second: c.second ?? null })), d.today);

  const latestTicket = new Map<string, Ticket>();
  for (const t of d.tickets) if (t.companyId && (!latestTicket.get(t.companyId) || t.created > latestTicket.get(t.companyId)!.created)) latestTicket.set(t.companyId, t);

  const list = inW
    .map((c) => ({ c, since: daysBetween(c.first as string, d.today), f: f(c) }))
    .sort((a, b) => Number(a.f === "yes") - Number(b.f === "yes") || b.since - a.since)
    .map(({ c, since }): Row => {
      const t = latestTicket.get(c.id);
      return { id: c.id, name: c.name, first: c.first, since, second: c.second ?? null, stage: c.stage, ticket: t ? answerOf(t) : "No ticket" };
    });

  return view("uc9", win, d, {
    tiles: [
      { label: "New customers", value: inW.length, fmt: "n", icon: "companies", tint: "blue", note: "companies whose first real order was in the period" },
      { label: "Second order within 9 months", value: yes, fmt: "n", icon: "order", tint: "green", note: `${rate === null ? "—" : `${Math.round(rate * 100)}%`} of those whose 9 months are over · ${n0(open)} still inside` },
      { label: "Moved to Grow / Nurture", value: grow, fmt: "n", icon: "up", tint: "purple", note: `${pct(grow, inW.length)} of them` },
      { label: "Became New customer lost", value: lost, fmt: "n", icon: "down", tint: "amber", note: `${pct(lost, inW.length)} of them` },
      ticketTile(tW),
    ],
    charts: [
      {
        kind: "trend", title: "How fast the second order comes", note: "Share of new customers (every one since January 2025) with a second real order by month after the first", fmt: "pct",
        label: "Second order by then", points: curve.map((p) => ({ x: `${p.k} mo`, value: p.share })),
        extra: { columns: ["Months after the first order", "Companies that old", "With a second order by then", "Share"], rows: curve.map((p) => [p.k, p.base, p.yes, p.share === null ? "—" : `${(p.share * 100).toFixed(1)}%`]) },
      },
      {
        kind: "stack", title: "Each month's new customers: second order or not", note: "By the month of the first order", fmt: "n",
        parts: [{ key: "yes", label: "Second order within 9 months" }, { key: "open", label: "Still inside the 9 months" }, { key: "no", label: "No second order in 9 months" }],
        rows: monthly(cohort, (c) => c.first, months, [{ key: "yes", label: "" }, { key: "open", label: "" }, { key: "no", label: "" }], f),
      },
      resolutionBars(tW),
    ],
    list: {
      title: "New customers of the period", note: "Those without a second order first, longest since the first order on top", link: "company",
      cols: [
        { key: "name", label: "Company", fmt: "text" }, { key: "first", label: "First order", fmt: "date" }, { key: "since", label: "Days since", fmt: "n" },
        { key: "second", label: "Second order", fmt: "date" }, { key: "stage", label: "Stage now", fmt: "stage" }, { key: "ticket", label: "Ticket", fmt: "text", hint: "The answer on the company's latest UC9 ticket" },
      ],
      rows: cap(list), total: list.length, empty: "No company placed its first order in this period.",
    },
    findings: [], notes: [outcomeNote(d)].filter((s): s is string => !!s),
  });
}

/* ── UC10+11 Repeat Purchase ───────────────────────────────────────────── */

export function uc10View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const grow = d.companies.filter((c) => c.stage === STAGE.grow);
  const loyalty = d.companies.filter((c) => c.stage === STAGE.loyalty);
  const growBand = grow.filter((c) => (c.orders ?? 0) >= 2 && (c.orders ?? 0) <= 11).length;
  const loyaltyBand = loyalty.filter((c) => (c.orders ?? 0) >= 12).length;
  const entries = d.companies.flatMap((c) => (c.entries ?? []).filter((e) => e[0] === STAGE.grow || e[0] === STAGE.loyalty));
  const growW = entries.filter((e) => e[0] === STAGE.grow && inWin(e[1], win)).length;
  const loyW = entries.filter((e) => e[0] === STAGE.loyalty && inWin(e[1], win)).length;
  const overdue = grow
    .filter((c) => c.last && c.avgDays && c.avgDays > 0)
    .map((c) => ({ c, since: daysBetween(c.last as string, d.today), gap: c.avgDays as number }))
    .filter((x) => x.since > x.gap)
    .sort((a, b) => b.since / b.gap - a.since / a.gap);
  const taskW = d.tasks.filter((t) => inWin(t.created, win));
  const last = [...d.lastTask].filter((l) => l.day).sort((a, b) => String(b.day).localeCompare(String(a.day)))[0];

  const findings: string[] = [];
  const dm = dormant(d.lastTask, ["UC10", "UC11"], "\"No repeated purchase\"", d.today);
  if (dm) findings.push(dm);

  return view("uc10", win, d, {
    tiles: [
      { label: "In Grow / Nurture now", value: grow.length, fmt: "n", icon: "companies", tint: "blue", note: `${n0(growBand)} of them with 2-11 orders` },
      { label: "In Loyalty / Retain now", value: loyalty.length, fmt: "n", icon: "star", tint: "purple", note: `${n0(loyaltyBand)} of them with 12 orders or more` },
      { label: "Entered Grow / Nurture", value: growW, fmt: "n", icon: "stage", tint: "slate", note: "in the period" },
      { label: "Promoted to Loyalty / Retain", value: loyW, fmt: "n", icon: "up", tint: "green", note: "entered the stage in the period" },
      { label: "Past their usual reorder", value: overdue.length, fmt: "n", icon: "time", tint: "amber", note: "in Grow / Nurture, longer since the last order than their own average gap" },
      { label: "Reminder tasks", value: taskW.length, fmt: "n", icon: "task", tint: "pink", note: last?.day ? `latest ever: ${longDay(last.day)}` : "none ever read" },
    ],
    charts: [
      {
        kind: "stack", title: "Entries per month", note: "Companies entering Grow / Nurture, and promoted to Loyalty / Retain", fmt: "n",
        parts: [{ key: "grow", label: "Entered Grow / Nurture" }, { key: "loyalty", label: "Promoted to Loyalty / Retain" }],
        rows: monthly(entries, (e) => e[1], months, [{ key: "grow", label: "" }, { key: "loyalty", label: "" }], (e) => (e[0] === STAGE.grow ? "grow" : "loyalty"), true),
        footnote: foot(months),
      },
      {
        kind: "stack", tab: "follow", title: "Reminder tasks per month", note: "\"No repeated purchase\" tasks for the owner, UC10 and UC11", fmt: "n",
        parts: [{ key: "UC10", label: "UC10" }, { key: "UC11", label: "UC11" }],
        rows: monthly(d.tasks, (t) => t.created, months, [{ key: "UC10", label: "" }, { key: "UC11", label: "" }], (t) => (/UC_11/i.test(t.workflow) ? "UC11" : "UC10")),
      },
      {
        kind: "bars", tab: "follow", title: "Why they did not buy again", note: "The reason on the company, every company that has one", fmt: "n",
        rows: (d.reasons ?? []).map((r) => ({ label: r.label, value: r.n })),
      },
    ],
    list: {
      title: "Grow / Nurture companies past their usual reorder", note: "Longest overdue against their own rhythm first", link: "company",
      cols: [
        { key: "name", label: "Company", fmt: "text" }, { key: "orders", label: "Orders", fmt: "n" }, { key: "last", label: "Last order", fmt: "date" },
        { key: "since", label: "Days since", fmt: "n" }, { key: "gap", label: "Usual gap (days)", fmt: "n", hint: "Average days between this company's orders" },
        { key: "over", label: "Overdue by (days)", fmt: "n" }, { key: "reason", label: "Reason given", fmt: "text" },
      ],
      rows: cap(overdue.map(({ c, since, gap }) => ({ id: c.id, name: c.name, orders: c.orders, last: c.last, since, gap: Math.round(gap), over: Math.round(since - gap), reason: c.reason ?? "—" }))),
      total: overdue.length, empty: "No company in Grow / Nurture is past its usual reorder.",
    },
    findings, notes: [],
  });
}

/* ── UC13 Reactivation ─────────────────────────────────────────────────── */

export function uc13View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const cur = d.today.slice(0, 7);
  const eps = d.companies.flatMap((c) => churnEpisodes(c.entries ?? []).filter((e) => e.start >= d.horizon).map((e) => ({ ...e, c })));
  const inW = eps.filter((e) => inWin(e.start, win));
  const re = inW.filter((e) => e.outcome === "reactivated");
  const no = inW.filter((e) => e.outcome === "not");
  const open = inW.filter((e) => e.outcome === "open");
  const bulk = inW.filter((e) => e.src === "bulk").length;
  const revBack = (e: (typeof eps)[number]) => (e.on ? revenueBetween(e.c.rev, monthOf(e.on), cur) : 0);
  const revenue = re.reduce((s, e) => s + revBack(e), 0);
  const taskW = d.tasks.filter((t) => inWin(t.created, win));
  const lastFollow = d.lastTask.find((l) => l.era === "Follow-up")?.day ?? null;

  const findings: string[] = [];
  const dm = dormant(d.lastTask, ["Follow-up"], "\"did not react to the discount code\"", d.today);
  if (dm) findings.push(dm);

  const OUT = { reactivated: "Reactivated", not: "Not reactivated", open: "Still open" } as const;
  const order = { reactivated: 0, not: 1, open: 2 } as const;
  const list = inW
    .map((e) => ({ e, rev: revBack(e) }))
    .sort((a, b) => order[a.e.outcome] - order[b.e.outcome] || b.rev - a.rev || b.e.start.localeCompare(a.e.start))
    .map(({ e, rev }): Row => ({ id: e.c.id, name: e.c.name, start: e.start, then: OUT[e.outcome], on: e.on, rev, stage: e.c.stage }));

  return view("uc13", win, d, {
    tiles: [
      { label: "Entered Churn / Reactivate", value: inW.length, fmt: "n", icon: "companies", tint: "blue", note: bulk ? `${n0(bulk)} of them set by a person in bulk` : "entries in the period" },
      { label: "Reactivated", value: re.length, fmt: "n", icon: "up", tint: "green", note: `${pct(re.length, re.length + no.length)} of those decided` },
      { label: "Not reactivated", value: no.length, fmt: "n", icon: "down", tint: "amber", note: "moved to Not reactivated" },
      { label: "Still open", value: open.length, fmt: "n", icon: "time", tint: "slate", note: "neither yet" },
      { label: "Revenue since reactivation", value: revenue, fmt: "eur", icon: "euro", tint: "purple", note: "ERP revenue from the month of reactivation to now" },
      { label: "Follow-up tasks", value: taskW.length, fmt: "n", icon: "task", tint: "pink", note: lastFollow ? `latest ever: ${longDay(lastFollow)}` : "none ever read" },
    ],
    charts: [
      {
        kind: "stack", title: "Each month's entries into Churn / Reactivate, and what followed", note: "By the month the company entered the stage", fmt: "n",
        parts: [{ key: "reactivated", label: "Reactivated" }, { key: "not", label: "Not reactivated" }, { key: "open", label: "Still open" }],
        rows: monthly(eps, (e) => e.start, months, [{ key: "reactivated", label: "" }, { key: "not", label: "" }, { key: "open", label: "" }], (e) => e.outcome, true),
        footnote: foot(months),
      },
      {
        kind: "stack", tab: "follow", title: "Tasks per month", note: "Follow-up when the discount code got no reaction, and the countries' own outreach", fmt: "n",
        parts: [{ key: "follow", label: "Follow-up" }, { key: "country", label: "Country outreach" }],
        rows: monthly(d.tasks, (t) => t.created, months, [{ key: "follow", label: "" }, { key: "country", label: "" }], (t) => (/Outreach/i.test(t.workflow) ? "country" : "follow")),
      },
    ],
    list: {
      title: "Entries into Churn / Reactivate in the period", note: "Reactivated first, by revenue since", link: "company",
      cols: [
        { key: "name", label: "Company", fmt: "text" }, { key: "start", label: "Entered", fmt: "date" }, { key: "then", label: "Then", fmt: "text" },
        { key: "on", label: "On", fmt: "date" }, { key: "rev", label: "Revenue since", fmt: "eur" }, { key: "stage", label: "Stage now", fmt: "stage" },
      ],
      rows: cap(list), total: list.length, empty: "No company entered Churn / Reactivate in this period.",
    },
    findings,
    notes: ["Follows the lifecycle stage set by the workflow (the deck: 6 months without an order)."],
  });
}

/* ── UC4 Abandoned Cart ────────────────────────────────────────────────── */

/** The first web order on or after a day. */
export function firstOnOrAfter(days: string[] | undefined, day: string): string | null {
  for (const d of days ?? []) if (d >= day) return d;
  return null;
}

export function uc4View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const cos = byId(d.companies);
  const web = d.webOrders ?? {};
  const carts = d.carts ?? [];
  const cW = carts.filter(([day]) => inWin(day, win));
  const firstCart = new Map<string, string>();
  for (const [day, co] of cW) if (co && (!firstCart.get(co) || day < firstCart.get(co)!)) firstCart.set(co, day);
  const follow = [...firstCart.entries()].map(([co, day]) => within(day, firstOnOrAfter(web[co], day), UC4_DAYS, d.today));
  const yes = follow.filter((f) => f === "yes").length;
  const rate = rateOf(follow);
  const tW = d.tickets.filter((t) => inWin(t.created, win));
  const ordered = tW.filter((t) => /^ordered$/i.test(t.resolution ?? ""));
  const recovered = ordered.reduce((s, t) => s + (cartValue(t.subject) ?? 0), 0);
  const tWeb = tW.map((t) => within(t.created, t.companyId ? firstOnOrAfter(web[t.companyId], t.created) : null, UC4_DAYS, d.today));
  const tWebYes = tWeb.filter((f) => f === "yes").length;

  // per month: companies with a cart, tickets, companies that ordered within 30 days of their first cart that month
  const rows = new Map<string, Row>(months.map((m) => [m, { x: monthLabel(m), carts: 0, tickets: 0, ordered: 0 }]));
  const firstInMonth = new Map<string, string>();
  for (const [day, co] of carts) {
    if (!co) continue;
    const k = `${monthOf(day)}|${co}`;
    if (!firstInMonth.get(k) || day < firstInMonth.get(k)!) firstInMonth.set(k, day);
  }
  for (const [k, day] of firstInMonth) {
    const r = rows.get(k.slice(0, 7));
    if (!r) continue;
    r.carts = (r.carts as number) + 1;
    if (within(day, firstOnOrAfter(web[k.slice(8)], day), UC4_DAYS, d.today) === "yes") r.ordered = (r.ordered as number) + 1;
  }
  for (const t of d.tickets) { const r = rows.get(monthOf(t.created)); if (r) r.tickets = (r.tickets as number) + 1; }

  const list = [...tW].sort((a, b) => b.created.localeCompare(a.created)).map((t): Row => {
    const c = t.companyId ? cos.get(t.companyId) : undefined;
    const w = t.companyId ? firstOnOrAfter(web[t.companyId], t.created) : null;
    const f = within(t.created, w, UC4_DAYS, d.today);
    return { id: t.id, created: t.created, name: c?.name ?? "—", value: cartValue(t.subject), status: ticketStatus(t), answer: answerOf(t), web: f === "yes" ? w : f === "open" ? "Not yet" : "No" };
  });

  return view("uc4", win, d, {
    tiles: [
      { label: "Companies with an abandoned cart", value: firstCart.size, fmt: "n", icon: "cart", tint: "blue", note: `${n0(cW.length)} contacts · each contact keeps only its latest cart` },
      { label: "Ordered on the web within 30 days", value: yes, fmt: "n", icon: "order", tint: "green", note: `${rate === null ? "—" : `${Math.round(rate * 100)}%`} of those whose 30 days are over` },
      ticketTile(tW, "Tickets over 500 EUR"),
      { label: "Answered \"Ordered\"", value: ordered.length, fmt: "n", icon: "percent", tint: "purple", note: `${pct(ordered.length, tW.length)} of the tickets` },
      { label: "Value recovered", value: recovered, fmt: "eur", icon: "euro", tint: "amber", note: "cart value of the tickets answered Ordered" },
      { label: "Web order within 30 days of the ticket", value: tWebYes, fmt: "n", icon: "time", tint: "slate", note: `${pct(tWebYes, tWeb.filter((f) => f !== "open").length)} of those whose 30 days are over` },
    ],
    charts: [
      {
        kind: "lines", title: "Carts, tickets and orders per month", note: "Companies with a cart, tickets raised, and companies that ordered on the web within 30 days of their cart", fmt: "n",
        parts: [{ key: "carts", label: "Companies with a cart" }, { key: "tickets", label: "Tickets" }, { key: "ordered", label: "Ordered within 30 days" }],
        rows: [...rows.values()],
        footnote: "Web orders before 6 July 2026 come from the shop connector's backfill.",
      },
      resolutionBars(tW),
    ],
    list: {
      title: "Abandoned-cart tickets in the period", note: "The cart's value, the answer, and the company's first web order within 30 days", link: "ticket",
      cols: [
        { key: "created", label: "Raised", fmt: "date" }, { key: "name", label: "Company", fmt: "text" }, { key: "value", label: "Cart value", fmt: "eur" },
        { key: "status", label: "Status", fmt: "text" }, { key: "answer", label: "Answer", fmt: "text" }, { key: "web", label: "Web order", fmt: "date", hint: "The company's first web-shop order within 30 days of the ticket" },
      ],
      rows: cap(list), total: list.length, empty: "No abandoned-cart ticket was raised in this period.",
    },
    findings: [], notes: [],
  });
}

/* ── UC12 Revenue Drop ─────────────────────────────────────────────────── */

export function uc12View(d: UcData, emails: EmailData | null, win: Win): View {
  const months = chartMonths(d.horizon, d.today);
  const cur = d.today.slice(0, 7);
  const cos = byId(d.companies);
  const erosion = new Set(d.erosion ?? []);
  const era = (w: string) => (/High_Value/i.test(w) ? "high" : /Medium_Value/i.test(w) ? "medium" : "v1");
  const flags = d.tasks.map((t) => {
    const c = t.companyId ? cos.get(t.companyId) : undefined;
    return { t, c, cmp: c ? afterVsYearBefore(c.rev, monthOf(t.created), UC12_MONTHS, cur) : null };
  });
  const inW = flags.filter((f) => inWin(f.t.created, win));
  const companies = new Set(inW.map((f) => f.t.companyId).filter(Boolean));
  const decided = inW.filter((f) => f.cmp);
  const held = decided.filter((f) => f.cmp!.after >= f.cmp!.before).length;
  const after = decided.reduce((s, f) => s + f.cmp!.after, 0);
  const before = decided.reduce((s, f) => s + f.cmp!.before, 0);
  const withErosion = new Set(inW.filter((f) => f.t.companyId && erosion.has(f.t.companyId)).map((f) => f.t.companyId)).size;

  const grouped = new Map<string, { x: string; current: number; prior: number }>();
  for (const f of flags) {
    if (!f.cmp) continue;
    const m = monthOf(f.t.created);
    const g = grouped.get(m) ?? { x: monthLabel(m), current: 0, prior: 0 };
    g.current += f.cmp.after; g.prior += f.cmp.before;
    grouped.set(m, g);
  }

  const SEG: Record<string, string> = { high: "High value", medium: "Medium value", v1: "First version" };
  const list = [...inW].sort((a, b) => b.t.created.localeCompare(a.t.created)).map(({ t, c, cmp }): Row => ({
    id: c?.id ?? null, created: t.created, name: c?.name ?? "—", segment: c?.segment ?? SEG[era(t.workflow)], task: t.done ? "Done" : "Open",
    after: cmp ? cmp.after : null, before: cmp ? cmp.before : null,
    change: cmp && cmp.before ? `${cmp.after >= cmp.before ? "+" : "−"}${Math.abs(Math.round(((cmp.after - cmp.before) / cmp.before) * 100))}%` : cmp ? "—" : "Too recent",
    erosion: t.companyId && erosion.has(t.companyId) ? "yes" : "no",
  }));

  return view("uc12", win, d, {
    tiles: [
      { label: "Companies flagged", value: companies.size, fmt: "n", icon: "companies", tint: "blue", note: `${n0(inW.filter((f) => era(f.t.workflow) === "high").length)} high value · ${n0(inW.filter((f) => era(f.t.workflow) === "medium").length)} medium value tasks` },
      { label: "Tasks done", value: inW.filter((f) => f.t.done).length, fmt: "n", icon: "task", tint: "slate", note: `${pct(inW.filter((f) => f.t.done).length, inW.length)} of ${plural(inW.length, "task")}` },
      { label: "Revenue held", value: held, fmt: "n", icon: "up", tint: "green", note: `of ${n0(decided.length)} whose 3 months after the flag are over` },
      { label: "3 months after the flag", value: after, fmt: "eur", icon: "euro", tint: "purple", note: `against ${eur(before)} in the same months a year earlier` },
      { label: "Also an erosion ticket", value: withErosion, fmt: "n", icon: "warning", tint: "amber", note: "flagged companies that also have an article-erosion ticket" },
    ],
    charts: [
      {
        kind: "stack", tab: "follow", title: "Flags per month", note: "Revenue-drop tasks created, by value segment", fmt: "n",
        parts: [{ key: "high", label: "High value" }, { key: "medium", label: "Medium value" }, { key: "v1", label: "First version" }],
        rows: monthly(d.tasks, (t) => t.created, months, [{ key: "high", label: "" }, { key: "medium", label: "" }, { key: "v1", label: "" }], (t) => era(t.workflow)),
      },
      {
        kind: "grouped", title: "Revenue after the flag against a year earlier", note: "Flagged companies, the 3 months after the flag month against the same 3 months a year before - months not yet over are left out", fmt: "eur",
        current: "3 months after", prior: "Same months a year before",
        rows: months.filter((m) => grouped.has(m)).map((m) => grouped.get(m)!),
      },
    ],
    list: {
      title: "Flags in the period", note: "Each flagged company, its task, and its revenue after the flag", link: "company",
      cols: [
        { key: "created", label: "Flagged", fmt: "date" }, { key: "name", label: "Company", fmt: "text" }, { key: "segment", label: "Value", fmt: "text" },
        { key: "task", label: "Task", fmt: "text" }, { key: "after", label: "3 months after", fmt: "eur" }, { key: "before", label: "A year before", fmt: "eur" },
        { key: "change", label: "Change", fmt: "text" }, { key: "erosion", label: "Erosion ticket", fmt: "yesno" },
      ],
      rows: cap(list), total: list.length, empty: "No company was flagged in this period.",
    },
    findings: [], notes: [],
  });
}

/* ── every page ────────────────────────────────────────────────────────── */

export const VIEWS: Record<UcKey, (d: UcData, emails: EmailData | null, win: Win) => View> = {
  uc2: uc2View, uc15: uc15View, uc6: uc6View, uc9: uc9View, uc10: uc10View, uc13: uc13View, uc4: uc4View, uc12: uc12View,
};

/** The email numbers a page's email section lists. */
export const emailUcsOf = (k: UcKey) => UCS.find((u) => u.key === k)?.emailUcs ?? [];

export type { Source };
