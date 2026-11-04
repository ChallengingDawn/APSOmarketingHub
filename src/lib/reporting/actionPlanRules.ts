// THE ACTION PLAN, AS RULES - how the rows of "APSOparts Business Improvement Action Plan" (its first
// tab, APSORoadmap-Active-New) become the plan's tree, what a status says about progress, how the
// figures roll up, and where a dragged row may land. Pure, so tests/action-plan.test.ts runs it
// without a database; actionPlan.ts keeps the plan and actionPlanSeed.json holds the workbook's rows.
//
// The workbook's own structure, kept as it is (SARCLA 31.10.2026: "per topic main topic, drill down"):
//   0000           the goal (GROW APSOparts to 30M€ revenue by 2031)
//   1000, 2000 ... the topics (priority 0, a round thousand)
//   1001 / 100     a group inside a topic (priority 0 with a sub task number)
//   1001 / 101     an action - under the group of its hundred, or the topic when there is none
// Sub-actions are not rows here: they are the tasks the KPI tiles already keep (kpiActions.ts).

export type SeedRow = {
  row: number; p?: string; topic?: string; sub?: string; text?: string; freeze?: string; main?: string;
  perimeter?: string; expected?: string; who?: string; due?: string; referent?: string; status?: string;
  result?: string; complexity?: string; release?: string;
};

export type PlanKind = "goal" | "topic" | "group" | "action";
export type PlanState = "todo" | "doing" | "done" | "hold";
export const PLAN_STATES: readonly PlanState[] = ["todo", "doing", "done", "hold"];
export const STATE_LABEL: Record<PlanState, string> = { todo: "Not started", doing: "In progress", done: "Done", hold: "On hold" };

/** A person an action is assigned to: a HubSpot user (owner id), as the KPI tasks keep them. */
export type PlanOwner = { id: string; name: string };

/* ── an action speaks the "From Scroll to Sale" ticket's language ─────────────────────────────────
   SARCLA 01.11.2026: "uniform the values of the stages - follow at the maximum what we use on the From Scroll to
   Sale pipeline ... planned date, go-live date instead of start, due ... priority as HubSpot's Low / Medium /
   High / Urgent". The stages and choices below are the pipeline's (4197562568) as read on 01.11.2026; the hub
   offers HubSpot's live choices where it can read them. `start` and `due` keep their names in the data and
   are the planned date and the go-live date on screen. */

/** The pipeline's stages, in its order; `pct` = what the stage says about progress (null: counts nowhere). */
export type Stage = { id: string; label: string; closed: boolean; pct: number | null };
export const STAGES: readonly Stage[] = [
  { id: "6161860807", label: "Idea box", closed: false, pct: 0 },
  { id: "6161860808", label: "In Progress", closed: false, pct: 50 },
  { id: "6161845476", label: "Waiting on APSO", closed: false, pct: 50 },
  { id: "6161845477", label: "Waiting on Agency", closed: false, pct: 50 },
  { id: "6161860809", label: "Ready to Roll", closed: false, pct: 90 },
  { id: "6161856758", label: "Live", closed: true, pct: 100 },
  { id: "6161856759", label: "Maintaining Internally", closed: true, pct: 100 },
  // dropped: neither done nor to do, so it leaves the averages above it
  { id: "6161860810", label: "Killed", closed: true, pct: null },
];
export const IDEA = "6161860807", IN_PROGRESS = "6161860808", LIVE = "6161856758", KILLED = "6161860810";
const WAITING = ["6161845476", "6161845477"];
export const stageOf = (id: string | null | undefined): Stage | null => STAGES.find((s) => s.id === id) ?? null;
/** Done or dropped: Live, Maintaining Internally, Killed. */
export const isClosed = (id: string | null | undefined) => !!stageOf(id)?.closed;

/**
 * The BUC's members, as HubSpot's users: an action's referent / challenger is one of them (SARCLA 01.11.2026: "referent
 * / challenger should be a BUC member - Alexandre, Claudio, Bernd, Marc or Rose - like a user"). Owner ids read from
 * HubSpot that day; Claudio is Claudio Saraiva (Claudio Gabinato is a sales agent).
 */
export const BUC_MEMBERS: readonly PlanOwner[] = [
  { id: "76033827", name: "Alexandre Lecomte" },
  { id: "1229976033", name: "Claudio Saraiva" },
  { id: "817647087", name: "Bernd Rausmann" },
  { id: "817497321", name: "Marc Frech" },
  { id: "31935670", name: "Rose Rasteiro" },
];

/** HubSpot's ticket priority. */
export const PRIORITIES = [
  { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["value"];
export const priorityLabel = (v: string) => PRIORITIES.find((p) => p.value === v)?.label ?? "";

/** The ticket's choices (mkt_channel, mkt_implementation_country, mkt_agency, mkt_roadmap_year) as read 01.11.2026. */
export type Opt = { value: string; label: string };
const opts = (...v: string[]): Opt[] => v.map((x) => ({ value: x, label: x }));
export const S2S_CHOICES: Record<"channel" | "country" | "agency" | "roadmapYear", Opt[]> = {
  channel: opts("SEA", "HubSpot", "LinkedIn", "Website", "Internal communication", "Newsletter", "Print", "SEO/GEO", "Other"),
  country: opts("All", "CH", "DE", "IT", "FR"),
  agency: opts("Bespoke", "Moskito", "SMEC", "TBC", "dotSource"),
  roadmapYear: opts("2026", "2027"),
};

/** The fields a person can change on a row: the Scroll to Sale ticket's, plus what only the plan has. */
export type PlanFields = {
  /**
   * Who does it: people, picked (SARCLA 01.11.2026: "assignment should be done by user, not names like Sales
   * leader"). `responsible` keeps the workbook's words ("LEAL/FRMA/RABE", "Sales leaders") beside them.
   */
  owners: PlanOwner[];
  title: string; detail: string; priority: string; responsible: string; referent: string;
  /** The pipeline's stage id (STAGES); null = nobody has said yet. */
  stage: string | null;
  channel: string[]; country: string[]; agency: string[]; roadmapYear: string;
  kpis: string; nextSteps: string; statusNote: string;
  start: string | null; due: string | null; dueNote: string; percent: number | null; dg: boolean;
  /** KPI tracking, Yes or No - picked in the table's column (SARCLA 04.11.2026: "just a dropdown, yes or no - this will
   *  then be implemented in the page in the header like KPIs, we will come to that later"); no when never picked */
  tracked?: boolean;
  /** The KPI it tracks, picked when KPI tracking is set to Yes (SARCLA 04.11.2026: "if put yes, a pop-up to select the
   *  KPI"): one of the KPIs promoted to the plan's KPIs tab, by its tile's key, and its name as it was picked. */
  trackKpi?: string; trackKpiTitle?: string;
  // the workbook's own columns, kept in the data but no longer shown - their words moved to the ticket's fields
  // once (toS2s); SARCLA 01.11.2026: "copy the HubSpot one made with the agency and delete those not needed"
  status: string; state: PlanState | null; result: string; mainTopic: string; perimeter: string; expected: string;
  codeFreeze: string; complexity: string; release: string;
};

export type PlanItem = PlanFields & {
  id: number; parentId: number | null; kind: PlanKind; code: string; sort: number; src: number | null;
  updatedBy: string; updatedAt: string;
};

export type PlanSeedItem = Omit<PlanFields, "stage" | "channel" | "country" | "agency" | "roadmapYear" | "kpis" | "nextSteps" | "statusNote">
  & { src: number; parentSrc: number | null; kind: PlanKind; code: string; sort: number };

/**
 * A sub-action: a KPI task kept for an action (tile "plan:<id>"), or one made on a KPI tile and linked to it. A small
 * action since 01.11.2026 (SARCLA: a sub-action "should be a small action"): the pipeline's stage, a priority, who does
 * it, a planned and a go-live date (`start`, `due`) - its open / doing / done follows the stage (statusOfStage), as the
 * KPI tiles show it. A task that never got a stage keeps its open / doing / done.
 */
export type PlanSub = {
  id: number; item: number; title: string; owner: string; ownerName: string; start: string | null; due: string | null;
  status: "open" | "doing" | "done"; stage: string | null; priority: string;
  /** Made on a KPI tile: its page, to go back to the KPI. Empty when made on the plan. */
  kpiHref: string; kpiTile: string; tickets: number;
  /** Its tickets' ids, to count each ticket once over the plan's rows (a duplicate shares its original's). */
  ticketIds?: string[];
  /** KPI tracking, its own - not its action's (SARCLA 04.11.2026: "KPI tracking should be available at sub-action level"). */
  tracked?: boolean; trackKpi?: string; trackKpiTitle?: string;
  /** Its place among its action's sub-actions, as dragged (SARCLA 03.11.2026); none until one of them is. */
  sort?: number | null;
};

/* ── reading the workbook ───────────────────────────────────────────────── */

const DG_CODES = ["FEHDIA", "SARCLA", "PYTALE", "PITALE", "LANKAR", "WIDA"];
/**
 * Led by the Digital Growth team: one of its people is responsible. Only these actions take a "From
 * Scroll to Sale" ticket - the sales actions have no pipeline (SARCLA 31.10.2026). A person can turn it
 * on or off per action; this is only the first reading.
 */
export function isDigitalGrowth(who: string | undefined | null): boolean {
  const up = (who ?? "").toUpperCase();
  return DG_CODES.some((c) => new RegExp(`(^|[^A-Z])${c}([^A-Z]|$)`).test(up));
}

/** One of the Digital Growth team, by the codes their name gives (codesOf): Aleksandra Pytlik is PYTALE. */
export const isDgPerson = (name: string | null | undefined): boolean => [...codesOf(name ?? "")].some((c) => DG_CODES.includes(c));

/**
 * Where a "From Scroll to Sale" ticket may be: an action Digital Growth leads, and any sub-action of one - and a
 * sub-action that is one of the Digital Growth team's own, whoever leads its action (SARCLA 03.11.2026: "Launch
 * APSOparts Wikipedia", Aleksandra's, under "Bring more traffic to the shop" that no one leads in the workbook - "I
 * should be able to also create a ticket if Digital Growth"). Without a person, as its action.
 */
export const takesTicket = (action: Pick<PlanItem, "dg">, person?: string | null): boolean => action.dg || isDgPerson(person);

const ENUM = /^(?:\d{1,2}\s*[-.)]\s+|[a-z]\.\s+|[•·\-–]\s*)/i;
const lines = (text: string) => text.split("\n").map((l) => l.trim().replace(ENUM, "").trim()).filter(Boolean);

/**
 * The row's name: the first line of "Action and Description of main steps", without its numbering.
 * A heading that ends with ":" ("Find parts by:") takes the lines under it, so it still says what it is.
 * Longer than fits is cut at a word; the whole text stays in the detail.
 */
export function titleOf(text: string | undefined, max = 140): string {
  const ls = lines(text ?? "");
  if (!ls.length) return "";
  let t = ls[0];
  if (t.endsWith(":") && ls.length > 1) {
    t = `${t} ${ls.slice(1).join(", ")}`;
  }
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;/=>-]+$/, "")}…`;
}

/** The status column (and a deadline of "Done") read as a state; null when it says nothing clear. */
export function stateOf(status: string | undefined, due?: string): PlanState | null {
  const s = (status ?? "").trim().toLowerCase();
  const first = s.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if ((due ?? "").trim().toLowerCase() === "done") return "done";
  if (/^done\b/.test(first) || /\bdone[.!]?$/.test(s)) return "done";
  if (/^(on hold|de-prioriti[sz]ed)/.test(first)) return "hold";
  if (/^not started/.test(first)) return "todo";
  if (/^(on[- ]?going|started|work in progress|in progress|campaing running|campaign running|launched)/.test(first)) return "doing";
  return null;
}

/** Planner's reading of a state: not started 0 %, in progress 50 %, done 100 %. */
export function percentOf(state: PlanState | null): number | null {
  return state === "done" ? 100 : state === "doing" ? 50 : state === "todo" ? 0 : null;
}

/** The state a percentage means, when somebody types one. */
export function stateOfPercent(p: number, was: PlanState | null): PlanState {
  if (p >= 100) return "done";
  if (p <= 0) return was === "hold" ? "hold" : "todo";
  return "doing";
}

/** The workbook's reading of a status as the pipeline's stage; on hold waits on APSO. */
export function stageOfState(state: PlanState | null): string | null {
  return state === "todo" ? IDEA : state === "doing" ? IN_PROGRESS : state === "hold" ? WAITING[0] : state === "done" ? LIVE : null;
}
/** And back, for the old column (a hub rolled back still shows where each action stands). */
export function stateOfStage(id: string | null): PlanState | null {
  if (!id) return null;
  if (id === IDEA) return "todo";
  if (WAITING.includes(id) || id === KILLED) return "hold";
  return stageOf(id)?.closed ? "done" : "doing";
}
/** The progress a stage means. */
export const percentOfStage = (id: string | null): number | null => stageOf(id)?.pct ?? null;

/**
 * The stage a typed percentage means: 100 % is live (or stays maintained), 0 % the idea box unless it is waiting
 * on someone, anything between in progress unless it already stands further on an open stage.
 */
export function stageOfPercent(p: number, was: string | null): string {
  if (p >= 100) return was === LIVE || was === "6161856759" ? was : LIVE;
  if (p <= 0) return was && WAITING.includes(was) ? was : IDEA;
  return was && !isClosed(was) && was !== IDEA ? was : IN_PROGRESS;
}

/** The workbook's priority 1, 2, 3 as HubSpot's; anything else is not a priority. */
export function priorityOfWorkbook(p: string): Priority | "" {
  const t = p.trim().toUpperCase();
  if ((PRIORITIES as readonly { value: string }[]).some((x) => x.value === t)) return t as Priority;
  return t === "1" ? "HIGH" : t === "2" ? "MEDIUM" : t === "3" ? "LOW" : "";
}

/** The workbook's "Main topic" as the ticket's marketing channels, where it names one. */
export function channelsOfTopic(main: string): string[] {
  const t = main.toLowerCase();
  const out: string[] = [];
  if (/\b(seo|geo)\b/.test(t)) out.push("SEO/GEO");
  if (/\bsea\b/.test(t)) out.push("SEA");
  if (/\b(hubspot|crm)\b/.test(t)) out.push("HubSpot");
  if (/\blinkedin\b/.test(t)) out.push("LinkedIn");
  if (/\bnewsletter\b/.test(t)) out.push("Newsletter");
  if (/\b(website|web ?shop|e-?shop)\b/.test(t)) out.push("Website");
  return out;
}

/**
 * A row in the ticket's terms, once: the status as a stage, 1/2/3 as Low/Medium/High, the workbook's status and
 * result words into the status note, its expected result into the KPIs, its main topic into the channels. Fields
 * already filled are kept; nothing is made up - a row the workbook says nothing about keeps no stage.
 */
export function toS2s(r: Pick<PlanFields, "state" | "priority" | "status" | "result" | "expected" | "mainTopic" | "stage" | "statusNote" | "kpis" | "channel">): Pick<PlanFields, "stage" | "priority" | "statusNote" | "kpis" | "channel"> {
  const prio = priorityOfWorkbook(r.priority);
  const odd = r.priority.trim() && !prio ? r.priority.trim() : "";
  const note = [r.status.trim(), r.result.trim() ? `Result: ${r.result.trim()}` : "", odd].filter(Boolean).join("\n\n");
  return {
    stage: r.stage ?? stageOfState(r.state),
    priority: prio,
    statusNote: r.statusNote.trim() ? r.statusNote : note,
    kpis: r.kpis.trim() ? r.kpis : r.expected.trim() ? `Expected: ${r.expected.trim()}` : "",
    channel: r.channel.length ? r.channel : channelsOfTopic(r.mainTopic),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * The deadline as a date when it is one. The workbook also writes "Done", "?", "September", "2027",
 * "20.08.2026 for briefing" - the date is taken where there is one and the words are kept beside it.
 * "31.09.2026" means the end of September, so a day past the month's end is its last day.
 */
export function parseDue(raw: string | undefined): { date: string | null; note: string } {
  const text = (raw ?? "").trim();
  if (!text) return { date: null, note: "" };
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return { date: text, note: "" };
  const dmy = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(text);
  if (dmy) {
    const [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (m >= 1 && m <= 12 && d >= 1) return { date: `${y}-${pad(m)}-${pad(Math.min(d, lastDay(y, m)))}`, note: text };
  }
  return { date: null, note: text };
}

const tidy = (s: string | undefined) => (s ?? "").trim();
const isThousand = (code: string) => /^\d+$/.test(code) && Number(code) % 1000 === 0;
const topicOf = (code: string) => (/^\d+$/.test(code) ? String(Number(code) - (Number(code) % 1000)).padStart(4, "0") : code);
const hundred = (sub: string) => (/^\d+$/.test(sub) ? Math.floor(Number(sub) / 100) * 100 : null);

/** The workbook's rows as the plan's tree: every row once, in the workbook's order. */
export function planFromSeed(rows: SeedRow[]): PlanSeedItem[] {
  const out: PlanSeedItem[] = [];
  let goal: number | null = null;
  const topics = new Map<string, number>();
  // the open group per topic: "100" until the next priority-0 row with a sub task number
  const groups = new Map<string, { src: number; hundred: number }>();
  for (const r of rows) {
    const code = tidy(r.topic);
    const sub = tidy(r.sub);
    const header = tidy(r.p) === "0";
    let kind: PlanKind;
    let parentSrc: number | null;
    if (header && code === "0000") { kind = "goal"; parentSrc = null; goal = r.row; }
    else if (header && isThousand(code)) { kind = "topic"; parentSrc = goal; topics.set(code, r.row); groups.delete(code); }
    else if (header && sub) {
      kind = "group";
      const t = topicOf(code);
      parentSrc = topics.get(t) ?? goal;
      const h = hundred(sub);
      if (h != null) groups.set(t, { src: r.row, hundred: h });
    } else {
      kind = "action";
      const t = topicOf(code);
      const g = groups.get(t);
      const h = hundred(sub);
      parentSrc = g && h != null && h === g.hundred ? g.src : topics.get(t) ?? goal;
    }
    const due = parseDue(r.due);
    const state = kind === "action" ? stateOf(r.status, r.due) : null;
    out.push({
      src: r.row, parentSrc, kind, code: [code, sub].filter(Boolean).join(" · "), sort: out.length,
      title: titleOf(r.text) || `Row ${r.row}`, detail: tidy(r.text),
      priority: header ? "" : tidy(r.p), responsible: tidy(r.who), referent: tidy(r.referent),
      status: tidy(r.status), state, result: tidy(r.result), mainTopic: tidy(r.main), perimeter: tidy(r.perimeter),
      expected: tidy(r.expected), codeFreeze: tidy(r.freeze), complexity: tidy(r.complexity), release: tidy(r.release),
      start: null, due: due.date, dueNote: due.note, percent: percentOf(state),
      dg: kind === "action" && isDigitalGrowth(r.who), owners: [],
    });
  }
  return out;
}

/* ── the workbook's codes as people ─────────────────────────────────────── */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]+/g, " ").trim();

/**
 * The short codes a person goes by in the workbook - the start of the last name, then of the first:
 * SARCLA = SARaiva CLAudio, FEHDIA = FEHr DIAna, WIDA = WIeland DAniel. Every split of a longer name counts.
 */
export function codesOf(name: string): Set<string> {
  const t = plain(name).split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  if (t.length < 2) return out;
  const first = t[0];
  // each word after the first name, and every ending of the name run together ("de Vries" -> DEVRIES)
  const lasts = [...t.slice(1), ...t.slice(1).map((_, k) => t.slice(k + 1).join(""))];
  for (const l of lasts) {
    for (const [a, b] of [[3, 3], [2, 2], [4, 2], [3, 2], [2, 3]]) {
      if (l.length >= a && first.length >= b) out.add(l.slice(0, a) + first.slice(0, b));
    }
  }
  return out;
}

/**
 * The people behind "Responsible of action": each code written in capitals ("LEAL/FRMA/RABE") that exactly one
 * person answers to. Words ("Sales leaders", "Bespoke") and codes nobody or several people answer to are left
 * for a person to pick - a guess would put someone's name on an action that is not theirs.
 */
export function ownersFromCodes(responsible: string, people: PlanOwner[]): PlanOwner[] {
  const out: PlanOwner[] = [];
  const codes = (responsible.match(/\b[A-Z]{4,7}\b/g) ?? []);
  for (const code of codes) {
    const hits = people.filter((p) => codesOf(p.name).has(code));
    if (hits.length === 1 && !out.some((o) => o.id === hits[0].id)) out.push({ id: hits[0].id, name: hits[0].name });
  }
  return out;
}

/* ── the figures a row shows ────────────────────────────────────────────── */

export type Rolled = {
  /**
   * % complete: the row's own, its sub-actions' when it has some. Above an action, the average over every
   * action underneath, one with no status counting as 0 % (Planner's new task) - averaging only the ones
   * with a figure made a topic with 3 done actions of 17 read 100 %.
   */
  percent: number | null;
  /** The bar: from the earliest start (or due) to the latest due underneath. */
  from: string | null; to: string | null;
  /** Sub-actions under the row (all levels), and how many are not done. */
  subs: number; subsOpen: number;
  /** Actions under the row that are late (isLate) - for an action, 1 when it is. */
  late: number;
  /** The action itself late (isLate, its sub-actions read). */
  lateSelf: boolean;
  /** An action's planned date, its go-live date, its status are its sub-actions' (subsSpan, mainStage) - shown, not set. */
  startFromSubs: boolean; dueFromSubs: boolean; stageFromSubs: boolean;
};

const SUB_PCT = { open: 0, doing: 50, done: 100 } as const;
type SubStatus = PlanSub["status"];
/** What a stage means for a KPI task: Idea box (or none) open, Live / Maintaining / Killed done, the rest doing. */
export const statusOfStage = (stage: string | null): SubStatus => (!stage || stage === IDEA ? "open" : isClosed(stage) ? "done" : "doing");
/** A KPI task set open / doing / done on its tile, when it has a stage: the stage that says the same. */
export const stageOfStatus = (status: SubStatus): string => (status === "done" ? LIVE : status === "doing" ? IN_PROGRESS : IDEA);
/** A sub-action's %: its stage's (Ready to Roll 90), else its status's; null when killed - it leaves the average. */
export const subPct = (s: Pick<PlanSub, "stage" | "status">): number | null => (s.stage && stageOf(s.stage) ? stageOf(s.stage)!.pct : SUB_PCT[s.status]);
/**
 * A sub-action's status in the actions' own words (SARCLA 02.11.2026: "the status should stay the same even on
 * sub-actions"): its stage; a KPI task with none, the stage its open / doing / done means - "No status" (null) for an
 * open one, as an action without one.
 */
export const subStage = (s: Pick<PlanSub, "stage" | "status">): Stage | null =>
  stageOf(s.stage) ?? (s.status === "open" ? null : stageOf(stageOfStatus(s.status)));
const minD = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxD = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * A main action's dates: its sub-actions' first planned date to their last go-live date (SARCLA 02.11.2026: "go-live and
 * planned date do not go as planned"); a sub-action with no planned date starts at its go-live. A planned date is never a
 * go-live: with no go-live among them the action keeps its own (null there). Null when none of them has a date.
 */
export function subsSpan(subs: { start: string | null; due: string | null }[]): { start: string | null; due: string | null } | null {
  let from: string | null = null, to: string | null = null;
  for (const s of subs) { from = minD(from, s.start ?? s.due); to = maxD(to, s.due); }
  return from || to ? { start: from, due: to } : null;
}

/**
 * A main action's status, its sub-actions' (SARCLA 02.11.2026: "the top stage is not changing even if it's live and a new
 * sub-action"; "the sub-ticket is killed - the main action should be, if it's the only one"): all killed - Killed; all done,
 * the killed ones aside - Live (Maintaining Internally when none is live); some still open - the least advanced of those
 * under way, as far as its slowest part goes; none under way but some done - In Progress. A sub-action with no status is
 * in the Idea box. Null - the action keeps its own - when none has a status, or none is under way or done.
 */
export function mainStage(subs: Pick<PlanSub, "stage" | "status">[]): string | null {
  const st = subs.map(subStage);
  if (!st.some(Boolean)) return null;
  const all = st.map((s) => s ?? stageOf(IDEA)!);
  const alive = all.filter((s) => s.id !== KILLED);
  if (!alive.length) return KILLED;
  const open = alive.filter((s) => !s.closed);
  if (!open.length) return alive.some((s) => s.id === LIVE) ? LIVE : alive[0].id;
  const going = open.filter((s) => s.id !== IDEA);
  if (going.length) return going.reduce((a, b) => (STAGES.indexOf(b) < STAGES.indexOf(a) ? b : a)).id;
  return open.length < alive.length ? IN_PROGRESS : null;
}

/**
 * An action imported from the workbook, its description put right (SARCLA 02.11.2026: "take out KPIs and next steps
 * completely on the old imported ones, enrich the description with this data and fix the description"): the first line
 * that only repeats its name goes, its KPIs - the workbook's expected result - and its next steps follow, word for word.
 */
export function foldedDetail(a: Pick<PlanFields, "title" | "detail" | "kpis" | "nextSteps">): string {
  const ls = a.detail.replace(/\r/g, "").split("\n");
  while (ls.length && !ls[0].trim()) ls.shift();
  const first = (ls[0] ?? "").trim(), title = a.title.trim();
  // the name is the first line, or that line ending in ":" with the next ones (titleOf)
  if (first && (first === title || (first.endsWith(":") && title.startsWith(`${first} `)))) ls.shift();
  return withNotes({ ...a, detail: ls.join("\n") });
}

/**
 * A description with the action's KPIs and next steps after it, word for word - the workbook's expected result as such
 * (SARCLA 03.11.2026: "I've already told you to take out KPIs and next steps overall": no form asks them any more).
 */
export function withNotes(a: Pick<PlanFields, "detail" | "kpis" | "nextSteps">): string {
  const k = a.kpis.trim();
  const kpis = !k ? "" : /^expected:\s*/i.test(k) ? `Expected result: ${k.replace(/^expected:\s*/i, "")}` : `KPIs: ${k}`;
  const next = a.nextSteps.trim() ? `Next steps:\n${a.nextSteps.trim()}` : "";
  return [a.detail.trim(), kpis, next].filter(Boolean).join("\n\n");
}

/** The workbook names the sales leaders as a group ("Sales leaders", "LEAL + sales leader"): the hierarchy's are meant. */
export const namesSalesLeaders = (responsible: string): boolean => /\bsales[\s-]*leaders?\b/i.test(responsible);

/**
 * Late: past its planned date and neither live, maintained nor dropped (SARCLA 02.11.2026: "late should be on the planned
 * date, not on the go-live - go-live is just the release date; of course if it was late but is live it should not count
 * any more").
 */
export function isLate(i: Pick<PlanItem, "start" | "percent" | "stage">, today: string, subs: Pick<PlanSub, "start" | "due" | "stage" | "status">[] = []): boolean {
  if (isClosed(i.stage) || (i.percent ?? 0) >= 100) return false;
  // dated by its sub-actions: late only when one still open is - a live one no longer counts (SARCLA 03.11.2026: its
  // first sub-action planned 22.10 and live, the open one planned for 16.12, and the action shown late)
  if (subs.some((s) => s.start || s.due)) return subs.some((s) => subLate(s, today));
  return !!i.start && i.start < today;
}

/** A sub-action late as an action is: its planned date passed, and not live, maintained, killed or done. */
export const subLate = (s: Pick<PlanSub, "start" | "stage" | "status">, today: string): boolean =>
  !!s.start && s.start < today && s.status !== "done" && !subStage(s)?.closed;

/** The day n days after an ISO day. */
const plusDays = (iso: string, n: number): string =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);

/**
 * Due within a week (SARCLA 03.11.2026: "we have the filter late but we should have also 1 week to deadline"): a planned
 * date today or in the next seven days, not yet live, maintained, killed or done - the action's own, or one of its
 * sub-actions'. Past that date it is late (isLate), never both.
 */
export function dueSoon(i: Pick<PlanItem, "start" | "percent" | "stage">, subs: Pick<PlanSub, "start" | "due" | "stage" | "status">[], today: string, days = 7): boolean {
  // dated by its sub-actions: one still open planned in the week, as isLate reads them
  if (subs.some((s) => s.start || s.due)) return subs.some((s) => subSoon(s, today, days));
  return !!i.start && i.start >= today && i.start <= plusDays(today, days) && !isClosed(i.stage) && (i.percent ?? 0) < 100;
}

/**
 * A sub-action due within a week: still open, planned for today or one of the next days - the one that puts its action
 * under "Due within a week", its planned date shown in amber as a late one is red (SARCLA 03.11.2026: "how is this due
 * within a week also" - "Aggregate all UC's review actions", by "Use Case: Purchaser Leaving" planned 09.11).
 */
export const subSoon = (s: Pick<PlanSub, "start" | "stage" | "status">, today: string, days = 7): boolean =>
  !!s.start && s.start >= today && s.start <= plusDays(today, days) && !subClosed(s);

/** A sub-action closed: done, or live, maintained or killed. */
export const subClosed = (s: Pick<PlanSub, "stage" | "status">): boolean => s.status === "done" || !!subStage(s)?.closed;

/**
 * An action's sub-actions in their order (SARCLA 03.11.2026: "I can't move the closed sub-actions up or down, and by
 * default they should go to the end if they are closed"): the open ones first, the closed ones after; in each as they were
 * dragged, the ones never dragged after those by go-live date.
 */
export function subOrder<T extends Pick<PlanSub, "id" | "stage" | "status" | "due" | "sort">>(subs: T[]): T[] {
  const sortOf = (s: T) => s.sort ?? Number.MAX_SAFE_INTEGER;
  const dueOf = (s: T) => s.due ?? "9999-12-31";
  return [...subs].sort((a, b) => Number(subClosed(a)) - Number(subClosed(b)) || sortOf(a) - sortOf(b) || dueOf(a).localeCompare(dueOf(b)) || a.id - b.id);
}

/** The sub-actions' order (ids, top to bottom) once one is dropped before or after another; null when it cannot go there. */
export function placeSub(order: number[], drag: number, target: number, where: "before" | "after"): number[] | null {
  if (drag === target || !order.includes(target)) return null;
  const rest = order.filter((id) => id !== drag);
  const at = rest.indexOf(target) + (where === "after" ? 1 : 0);
  return [...rest.slice(0, at), drag, ...rest.slice(at)];
}

/** Every row's figures, bottom up. */
export function rollup(items: PlanItem[], subs: PlanSub[], today: string): Map<number, Rolled> {
  const kids = new Map<number | null, PlanItem[]>();
  for (const i of items) (kids.get(i.parentId) ?? kids.set(i.parentId, []).get(i.parentId)!).push(i);
  const subsOf = new Map<number, PlanSub[]>();
  for (const s of subs) (subsOf.get(s.item) ?? subsOf.set(s.item, []).get(s.item)!).push(s);
  const out = new Map<number, Rolled>();
  // per row: the actions underneath and their % added up, for the parents' average
  const sums = new Map<number, { n: number; sum: number }>();
  const seen = new Set<number>();
  const walk = (i: PlanItem): Rolled => {
    if (out.has(i.id)) return out.get(i.id)!;
    if (seen.has(i.id)) return { percent: null, from: null, to: null, subs: 0, subsOpen: 0, late: 0, lateSelf: false, startFromSubs: false, dueFromSubs: false, stageFromSubs: false };
    seen.add(i.id);
    const mine = subsOf.get(i.id) ?? [];
    // an action's own dates; a category's only from what is in it - its first date to its last, actions and sub-actions
    // alike (SARCLA 02.11.2026: "main categories' planned and go-live dates should inherit from the first date of any
    // action or sub-action and end at the latest")
    // - and an action with sub-actions, its sub-actions' first to their last (subsSpan)
    const own = i.kind === "action";
    const span = own ? subsSpan(mine) : null;
    let from = span?.start ?? (own ? minD(i.start, i.due) : null), to = span?.due ?? (own ? maxD(i.start, i.due) : null);
    if (!own) for (const s of mine) { from = minD(minD(from, s.start), s.due); to = maxD(maxD(to, s.start), s.due); }
    let n = mine.length, open = mine.filter((s) => s.status !== "done").length;
    const lateSelf = own && isLate(i, today, mine);
    let late = lateSelf ? 1 : 0;
    const acc = { n: 0, sum: 0 };
    for (const c of kids.get(i.id) ?? []) {
      const r = walk(c);
      from = minD(from, r.from); to = maxD(to, r.to);
      n += r.subs; open += r.subsOpen; late += r.late;
      const s = sums.get(c.id)!;
      acc.n += s.n; acc.sum += s.sum;
    }
    let percent: number | null;
    if (i.kind === "action") {
      const counted = mine.map(subPct).filter((x): x is number => x != null);
      percent = counted.length && !isClosed(i.stage) && i.percent !== 100
        ? Math.round(counted.reduce((s, x) => s + x, 0) / counted.length)
        : i.percent;
      // a killed action is neither done nor to do: it leaves the average
      if (i.stage !== KILLED) { acc.n += 1; acc.sum += percent ?? 0; }
    } else {
      percent = acc.n ? Math.round(acc.sum / acc.n) : null;
    }
    sums.set(i.id, acc);
    const r = { percent, from, to, subs: n, subsOpen: open, late, lateSelf, startFromSubs: !!span?.start, dueFromSubs: !!span?.due, stageFromSubs: own && mainStage(mine) != null };
    out.set(i.id, r);
    return r;
  };
  for (const i of items) walk(i);
  return out;
}

/* ── where a dragged row may land ───────────────────────────────────────── */

/** What may hold what: an action sits in a topic or a group, a group in a topic, a topic under the goal. */
const HOLDS: Record<PlanKind, PlanKind[]> = { goal: ["topic"], topic: ["group", "action"], group: ["action"], action: [] };

/**
 * Drop `drag` on `target`: "into" puts it last inside the target, "before" just above it among the
 * target's siblings. Returns the new parent and that parent's children in their new order, or null
 * when the move is not allowed (a topic into an action, a row into itself or below itself).
 */
export function reorder(items: PlanItem[], dragId: number, targetId: number, where: "into" | "before"): { parentId: number; order: number[] } | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  const drag = byId.get(dragId), target = byId.get(targetId);
  if (!drag || !target || drag.id === target.id || drag.kind === "goal") return null;
  const parentId = where === "into" ? target.id : target.parentId;
  if (parentId == null) return null;
  const parent = byId.get(parentId);
  if (!parent || !HOLDS[parent.kind].includes(drag.kind)) return null;
  // never under itself
  for (let p: PlanItem | undefined = parent; p; p = p.parentId == null ? undefined : byId.get(p.parentId)) {
    if (p.id === drag.id) return null;
  }
  const siblings = items.filter((i) => i.parentId === parentId && i.id !== drag.id).sort((a, b) => a.sort - b.sort || a.id - b.id).map((i) => i.id);
  const at = where === "into" ? siblings.length : siblings.indexOf(target.id);
  siblings.splice(at < 0 ? siblings.length : at, 0, drag.id);
  return { parentId, order: siblings };
}

/* ── the plan in HubSpot ───────────────────────────────────────────────────
   SARCLA 01.11.2026: "create new properties in HubSpot to populate the action plan's main categories and sub and so
   forth". Three ticket properties beside the agency's (group marketing_roadmap), their choices the plan's rows - the
   value is the row's id, so a renamed row stays the same choice. actionPlanHubspot.ts keeps them in HubSpot. */

export const PLAN_PROPS = [
  { name: "mkt_plan_category", label: "Action plan - main category", kind: "topic" },
  { name: "mkt_plan_subcategory", label: "Action plan - sub-category", kind: "group" },
  { name: "mkt_plan_action", label: "Action plan - action", kind: "action" },
] as const;
export type PlanPropName = (typeof PLAN_PROPS)[number]["name"];
export type HsOption = { value: string; label: string; displayOrder: number; hidden: boolean };
type TreeRow = Pick<PlanItem, "id" | "parentId" | "kind" | "title" | "code" | "sort">;

/** The rows in the plan's order: each one, then what is under it. */
export function treeOrder<T extends TreeRow>(items: T[]): T[] {
  const kids = new Map<number | null, T[]>();
  for (const i of items) (kids.get(i.parentId) ?? kids.set(i.parentId, []).get(i.parentId)!).push(i);
  const ids = new Set(items.map((i) => i.id));
  const out: T[] = [];
  const seen = new Set<number>();
  const walk = (i: T) => {
    if (seen.has(i.id)) return;
    seen.add(i.id); out.push(i);
    for (const c of (kids.get(i.id) ?? []).sort((a, b) => a.sort - b.sort || a.id - b.id)) walk(c);
  };
  for (const r of items.filter((i) => i.parentId == null || !ids.has(i.parentId)).sort((a, b) => a.sort - b.sort || a.id - b.id)) walk(r);
  return out;
}

/**
 * A property's choices: the plan's rows of its kind, in the plan's order. A row that left the plan stays as a hidden
 * choice, so a ticket that carries it keeps its name. HubSpot takes no two choices with the same name: a second one
 * gets its roadmap ID, else its number.
 */
export function planOptions(items: TreeRow[], kind: PlanKind, current: { value: string; label: string }[] = []): HsOption[] {
  const rows = treeOrder(items).filter((i) => i.kind === kind);
  const used = new Set<string>();
  const out: HsOption[] = rows.map((r, k) => {
    const base = (r.title.trim() || `Row ${r.id}`).slice(0, 200);
    let label = base;
    if (used.has(label.toLowerCase())) label = r.code ? `${base} (${r.code})` : `${base} #${r.id}`;
    if (used.has(label.toLowerCase())) label = `${base} #${r.id}`;
    used.add(label.toLowerCase());
    return { value: String(r.id), label, displayOrder: k, hidden: false };
  });
  const live = new Set(out.map((o) => o.value));
  for (const c of current) {
    if (live.has(String(c.value))) continue;
    let label = c.label;
    if (used.has(label.toLowerCase())) label = `${label} #${c.value}`;
    used.add(label.toLowerCase());
    out.push({ value: String(c.value), label, displayOrder: out.length, hidden: true });
  }
  return out;
}

/** Whether HubSpot's choices already are these. */
export function sameOptions(a: { value: string; label: string; hidden?: boolean; displayOrder?: number }[], b: HsOption[]): boolean {
  if (a.length !== b.length) return false;
  const byValue = new Map(a.map((o) => [String(o.value), o]));
  return b.every((o) => {
    const x = byValue.get(o.value);
    return !!x && x.label === o.label && !!x.hidden === o.hidden && (x.displayOrder ?? o.displayOrder) === o.displayOrder;
  });
}

/** Where a row sits, as the three properties say it - "" clears one (an action taken out of its sub-category). */
export function planValuesOf(itemId: number, items: TreeRow[]): Record<PlanPropName, string> | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  const v: Record<PlanPropName, string> = { mkt_plan_category: "", mkt_plan_subcategory: "", mkt_plan_action: "" };
  let i = byId.get(itemId);
  if (!i) return null;
  for (let n = 0; i && n < 10; i = i.parentId == null ? undefined : byId.get(i.parentId), n++) {
    const p = PLAN_PROPS.find((x) => x.kind === i!.kind);
    if (p && !v[p.name]) v[p.name] = String(i.id);
  }
  return v;
}

/**
 * A sub-action's ticket starts from its action (SARCLA 01.11.2026: "we should try to uniform everything"): its place in
 * the plan, priority, channels, countries, agency, roadmap year, dates, KPIs and status note - only the
 * choices HubSpot offers, nothing made up. The stage stays the pipeline's first: the sub-action has not started.
 */
export function ticketFromAction(a: PlanItem, items: TreeRow[], options: Record<string, { value: string }[]>): Record<string, string> {
  const offered = (prop: string, v: string[]) => {
    const o = options[prop];
    return (o?.length ? v.filter((x) => o.some((y) => y.value === x)) : v).join(";");
  };
  const v: Record<string, string> = {
    content: [`From the action plan: "${a.title}".`, a.detail && a.detail !== a.title ? a.detail : ""].filter(Boolean).join("\n\n").slice(0, 5000),
    hs_ticket_priority: a.priority && PRIORITIES.some((p) => p.value === a.priority) ? a.priority : "",
    mkt_channel: offered("mkt_channel", a.channel),
    mkt_implementation_country: offered("mkt_implementation_country", a.country),
    mkt_agency: offered("mkt_agency", a.agency),
    mkt_roadmap_year: a.roadmapYear ? offered("mkt_roadmap_year", [a.roadmapYear]) : "",
    mkt_planned_date: a.start ?? "",
    mkt_golive_date: a.due ?? "",
    mkt_status_note: a.statusNote,
    ...(planValuesOf(a.id, items) ?? {}),
  };
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x));
}

/* ── an action and its ticket, kept in step (SARCLA 02.11.2026: "if a ticket is associated to an action - only one per
   action - the properties communicate with each other: a change in the hub changes the ticket, the ticket's status
   comes back as well - this should be a sync") ───────────────────────────────────────────────────────────────── */

type SyncKind = "text" | "list" | "date";
type SyncField = { prop: string; hub: (a: PlanItem) => string; kind?: SyncKind };
/** The ticket's property behind each field of an action. */
export const TICKET_SYNC: readonly SyncField[] = [
  { prop: "subject", hub: (a) => a.title },
  { prop: "content", hub: (a) => a.detail },
  { prop: "hs_pipeline_stage", hub: (a) => a.stage ?? "" },
  { prop: "hs_ticket_priority", hub: (a) => a.priority },
  { prop: "hubspot_owner_id", hub: (a) => a.owners[0]?.id ?? "" },
  { prop: "mkt_planned_date", hub: (a) => a.start ?? "", kind: "date" },
  { prop: "mkt_golive_date", hub: (a) => a.due ?? "", kind: "date" },
  { prop: "mkt_channel", hub: (a) => a.channel.join(";"), kind: "list" },
  { prop: "mkt_implementation_country", hub: (a) => a.country.join(";"), kind: "list" },
  { prop: "mkt_agency", hub: (a) => a.agency.join(";"), kind: "list" },
  { prop: "mkt_roadmap_year", hub: (a) => a.roadmapYear },
  { prop: "mkt_status_note", hub: (a) => a.statusNote },
];
const norm = (kind: SyncKind | undefined, v: string | null | undefined): string => {
  const x = String(v ?? "").replace(/\r\n/g, "\n").trim();
  return kind === "list" ? x.split(";").map((y) => y.trim()).filter(Boolean).sort().join(";") : kind === "date" ? x.slice(0, 10) : x;
};

/**
 * Where one side and its ticket differ, by property, and what goes which way: "push" ours to the ticket, "pull" the
 * ticket's to us, "merge" - the first time they meet, as when a ticket is linked - an empty side takes the other's and
 * where both say something the ticket wins. No empty name or status is pushed: the ticket needs both.
 */
function diff(defs: readonly { prop: string; kind?: SyncKind }[], mine: Record<string, string>, t: Record<string, string | null | undefined>, way: "push" | "pull" | "merge") {
  const fields: string[] = [];
  const push: Record<string, string> = {};
  const pull: Record<string, string> = {};
  for (const f of defs) {
    const m = norm(f.kind, mine[f.prop]), theirs = norm(f.kind, t[f.prop]);
    if (m === theirs) continue;
    fields.push(f.prop);
    if (way === "push" || (way === "merge" && !theirs)) {
      if (!(["subject", "hs_pipeline_stage"].includes(f.prop) && !m)) push[f.prop] = m;
    } else pull[f.prop] = theirs;
  }
  return { fields, push, pull };
}

/**
 * Where an action and its ticket differ, and what goes which way (diff); the ticket's values as the action's fields - its
 * owner as an id, `ownerId` - never a stage or priority the plan does not know.
 */
export function ticketSync(a: PlanItem, t: Record<string, string | null | undefined>, way: "push" | "pull" | "merge"): {
  fields: string[]; push: Record<string, string>; pull: Partial<PlanFields> & { ownerId?: string };
} {
  const d = diff(TICKET_SYNC, Object.fromEntries(TICKET_SYNC.map((f) => [f.prop, f.hub(a)])), t, way);
  const pull: Partial<PlanFields> & { ownerId?: string } = {};
  for (const [prop, theirs] of Object.entries(d.pull)) {
    const list = theirs ? theirs.split(";") : [];
    switch (prop) {
      case "subject": if (theirs) pull.title = theirs; break;
      case "content": pull.detail = theirs; break;
      case "hs_pipeline_stage": if (stageOf(theirs)) pull.stage = theirs; break;
      case "hs_ticket_priority": if (!theirs || PRIORITIES.some((p) => p.value === theirs)) pull.priority = theirs; break;
      case "hubspot_owner_id": if (theirs) pull.ownerId = theirs; break;
      case "mkt_planned_date": pull.start = theirs || null; break;
      case "mkt_golive_date": pull.due = theirs || null; break;
      case "mkt_channel": pull.channel = list; break;
      case "mkt_implementation_country": pull.country = list; break;
      case "mkt_agency": pull.agency = list; break;
      case "mkt_roadmap_year": pull.roadmapYear = theirs; break;
      case "mkt_status_note": pull.statusNote = theirs; break;
    }
  }
  return { fields: d.fields, push: d.push, pull };
}

/** A sub-action as its ticket sees it (a KPI task of the plan). */
export type SubSyncable = { title: string; note: string; stage: string | null; priority: string; owner: string; start: string | null; due: string | null; statusNote: string };
/** The ticket's property behind each field of a sub-action. */
export const SUB_TICKET_SYNC: readonly { prop: string; sub: (s: SubSyncable) => string; kind?: SyncKind }[] = [
  { prop: "subject", sub: (s) => s.title },
  { prop: "content", sub: (s) => s.note },
  { prop: "hs_pipeline_stage", sub: (s) => s.stage ?? "" },
  { prop: "hs_ticket_priority", sub: (s) => s.priority },
  // a task made on a KPI tile without a HubSpot owner has the maker's e-mail: no owner for the ticket
  { prop: "hubspot_owner_id", sub: (s) => (/^\d+$/.test(s.owner) ? s.owner : "") },
  { prop: "mkt_planned_date", sub: (s) => s.start ?? "", kind: "date" },
  { prop: "mkt_golive_date", sub: (s) => s.due ?? "", kind: "date" },
  { prop: "mkt_status_note", sub: (s) => s.statusNote },
];
/** The way back to the plan a sub-action's ticket ends its description with ("Open it: <link>"). */
const OPEN_IT = /\s*Open it: \S+\s*$/;

/**
 * Where a sub-action and its ticket differ, and what goes which way (SARCLA 02.11.2026: "here it has a ticket associated
 * but did not copy the properties back to the action plan"), as an action's: the ticket's values as the sub-action's
 * fields. The ticket's description keeps its way back to the plan; it is not part of the sub-action's.
 */
export function subTicketSync(s: SubSyncable, t: Record<string, string | null | undefined>, way: "push" | "pull" | "merge"): {
  fields: string[]; push: Record<string, string>; pull: Partial<SubSyncable>;
} {
  const content = String(t.content ?? "");
  const tail = content.match(OPEN_IT)?.[0].trim() ?? "";
  const d = diff(SUB_TICKET_SYNC, Object.fromEntries(SUB_TICKET_SYNC.map((f) => [f.prop, f.sub(s)])), { ...t, content: content.replace(OPEN_IT, "") }, way);
  if (d.push.content !== undefined && tail) d.push.content = d.push.content ? `${d.push.content}\n\n${tail}` : tail;
  const pull: Partial<SubSyncable> = {};
  for (const [prop, theirs] of Object.entries(d.pull)) {
    switch (prop) {
      case "subject": if (theirs) pull.title = theirs; break;
      case "content": pull.note = theirs; break;
      case "hs_pipeline_stage": if (stageOf(theirs)) pull.stage = theirs; break;
      case "hs_ticket_priority": if (!theirs || PRIORITIES.some((p) => p.value === theirs)) pull.priority = theirs; break;
      case "hubspot_owner_id": if (theirs) pull.owner = theirs; break;
      case "mkt_planned_date": pull.start = theirs || null; break;
      case "mkt_golive_date": pull.due = theirs || null; break;
      case "mkt_status_note": pull.statusNote = theirs; break;
    }
  }
  return { fields: d.fields, push: d.push, pull };
}

/**
 * Which way a difference goes: the side changed since they last agreed; both, the latest change; never agreed, a
 * merge; neither, none - they are left as they agreed (a difference only in how a text is written stays). An ISO time
 * each; `synced` null when they never agreed.
 */
export function syncWay(hubAt: string, ticketAt: string, synced: string | null): "push" | "pull" | "merge" | null {
  if (!synced) return "merge";
  const hub = hubAt > synced, ticket = ticketAt > synced;
  if (!hub && !ticket) return null;
  if (hub && !ticket) return "push";
  if (ticket && !hub) return "pull";
  return ticketAt > hubAt ? "pull" : "push";
}

/**
 * One ticket and every sub-action it is on - a sub-action duplicated onto another action keeps its ticket (SARCLA
 * 02.11.2026: "it should not create a new ticket but keep the same, associated to a different action") - brought in step
 * in one run: the sub-action changed last goes first, as with a ticket of its own (syncWay, subTicketSync); what it gives
 * the ticket is the ticket's from then on, so the others take it at once. `ticketAt` the ticket's last change, `now` the
 * run's time. What the ticket is given, what each sub-action takes, and the ones now in step with it.
 */
export function sharedTicketSync(
  subs: (SubSyncable & { id: number; updatedAt: string })[], t: Record<string, string | null | undefined>, ticketAt: string, synced: Map<number, string>, now: string,
): { push: Record<string, string>; pulls: { id: number; pull: Partial<SubSyncable> }[]; agreed: number[] } {
  let ticket = t, at = ticketAt;
  const push: Record<string, string> = {};
  const pulls: { id: number; pull: Partial<SubSyncable> }[] = [];
  const agreed: number[] = [];
  for (const s of [...subs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const way = syncWay(s.updatedAt, at, synced.get(s.id) ?? null);
    if (!way) continue;
    const d = subTicketSync(s, ticket, way);
    agreed.push(s.id);
    if (Object.keys(d.push).length) { Object.assign(push, d.push); ticket = { ...ticket, ...d.push }; at = now; }
    if (Object.keys(d.pull).length) pulls.push({ id: s.id, pull: d.pull });
  }
  return { push, pulls, agreed };
}

/** Where a "From Scroll to Sale" ticket may go in the plan (scrollToSaleBoard.ts): the actions led by Digital Growth,
 *  and the categories that hold them - each with the path above it. */
export function dgTargets(items: PlanItem[]): { actions: PlanItem[]; categories: PlanItem[]; path: (i: PlanItem) => string } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const path = (i: PlanItem) => {
    const up: string[] = [];
    for (let p = i.parentId == null ? undefined : byId.get(i.parentId); p && up.length < 5; p = p.parentId == null ? undefined : byId.get(p.parentId)) if (p.kind !== "goal") up.unshift(p.title);
    return up.join(" > ");
  };
  const actions = items.filter((i) => i.kind === "action" && i.dg);
  const cats = new Set<number>();
  for (const a of actions) for (let p = a.parentId == null ? undefined : byId.get(a.parentId); p && p.kind !== "goal"; p = p.parentId == null ? undefined : byId.get(p.parentId)) cats.add(p.id);
  return { actions, categories: items.filter((i) => cats.has(i.id)), path };
}

/* ── the plan's filters ─────────────────────────────────────────────────── */

/** The person filter's choice for what nobody has been given yet. */
export const NOBODY = "__nobody";

/**
 * The plan's filters, read the same way on an action and on each of its sub-actions (SARCLA 04.11.2026: "sometimes when
 * filtering or searching for names the sub-actions are not appearing; the filter per person doesn't give the total number of
 * tickets; the filters are wrong") - they looked at the actions alone, and at the people given the action only.
 */
export type PlanFilter = { q: string; prios: string[]; stages: string[]; dg: boolean; late: boolean; soon: boolean; owner: string; hideLive: boolean };

export const isFiltering = (f: PlanFilter): boolean =>
  !!f.q.trim() || f.prios.length > 0 || f.stages.length > 0 || f.dg || f.late || f.soon || !!f.owner || f.hideLive;

const found = (texts: (string | null | undefined)[], q: string): boolean => {
  const w = q.trim().toLowerCase();
  return !w || texts.some((x) => (x ?? "").toLowerCase().includes(w));
};
const actionWords = (i: PlanItem) => [i.title, i.detail, i.code, i.statusNote, ...i.channel, ...i.agency];
const actionPeople = (i: PlanItem) => [i.responsible, ...i.owners.map((o) => o.name)];

/** An action by its own fields; its sub-actions count for late and due within a week, as ever. */
export function actionMatches(i: PlanItem, subs: Pick<PlanSub, "start" | "due" | "stage" | "status">[], f: PlanFilter, today: string): boolean {
  if (i.kind !== "action") return false;
  if (!found([...actionWords(i), ...actionPeople(i)], f.q)) return false;
  if (f.prios.length && !f.prios.includes(i.priority)) return false;
  if (f.stages.length && !f.stages.includes(i.stage ?? "none")) return false;
  if (f.dg && !i.dg) return false;
  if (f.late && !isLate(i, today, subs)) return false;
  if (f.soon && !dueSoon(i, subs, today)) return false;
  if (f.hideLive && i.stage === LIVE) return false;
  if (f.owner === NOBODY ? i.owners.length > 0 : !!f.owner && !i.owners.some((o) => o.id === f.owner)) return false;
  return true;
}

/**
 * A sub-action by its own fields: its name and person, its priority, status and planned date. One with no person is its
 * action's people's, one with no priority has its action's; a word of its action's finds it too - but not its action's
 * people's names when it has a person of its own. Its action shows with it, as a category shows with its actions.
 */
export function subMatches(s: PlanSub, a: PlanItem, f: PlanFilter, today: string): boolean {
  if (!found([s.title, s.ownerName, ...actionWords(a), ...(s.owner ? [] : actionPeople(a))], f.q)) return false;
  if (f.prios.length && !f.prios.includes(s.priority || a.priority)) return false;
  if (f.stages.length && !f.stages.includes(subStage(s)?.id ?? "none")) return false;
  if (f.dg && !takesTicket(a, s.ownerName)) return false;
  if (f.late && !subLate(s, today)) return false;
  if (f.soon && !subSoon(s, today)) return false;
  if (f.hideLive && subStage(s)?.id === LIVE) return false;
  const people = s.owner ? [s.owner] : a.owners.map((o) => o.id);
  if (f.owner === NOBODY ? people.length > 0 : !!f.owner && !people.includes(f.owner)) return false;
  return true;
}

/** The tickets of what shows, each once - a duplicated sub-action carries the same ticket as its original. */
export function ticketsShown(actions: { id: number }[], subs: Pick<PlanSub, "ticketIds">[], own: Record<string, string[] | undefined>): number {
  const t = new Set<string>();
  for (const a of actions) for (const id of own[String(a.id)] ?? []) t.add(id);
  for (const s of subs) for (const id of s.ticketIds ?? []) t.add(id);
  return t.size;
}
