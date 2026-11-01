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
  kpis: string; nextSteps: string; statusNote: string; reportLink: string;
  start: string | null; due: string | null; dueNote: string; percent: number | null; dg: boolean;
  // the workbook's own columns, kept in the data but no longer shown - their words moved to the ticket's fields
  // once (toS2s); SARCLA 01.11.2026: "copy the HubSpot one made with the agency and delete those not needed"
  status: string; state: PlanState | null; result: string; mainTopic: string; perimeter: string; expected: string;
  codeFreeze: string; complexity: string; release: string;
};

export type PlanItem = PlanFields & {
  id: number; parentId: number | null; kind: PlanKind; code: string; sort: number; src: number | null;
  updatedBy: string; updatedAt: string;
};

export type PlanSeedItem = Omit<PlanFields, "stage" | "channel" | "country" | "agency" | "roadmapYear" | "kpis" | "nextSteps" | "statusNote" | "reportLink">
  & { src: number; parentSrc: number | null; kind: PlanKind; code: string; sort: number };

/** A sub-action: a KPI task kept for an action (tile "plan:<id>"), or one made on a KPI tile and linked to it. */
export type PlanSub = {
  id: number; item: number; title: string; ownerName: string; due: string | null; status: "open" | "doing" | "done";
  /** Made on a KPI tile: its page, to go back to the KPI. Empty when made on the plan. */
  kpiHref: string; kpiTile: string; tickets: number;
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
  /** Actions under the row that are past their due and not done. */
  late: number;
};

const SUB_PCT = { open: 0, doing: 50, done: 100 } as const;
const minD = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxD = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Past its go-live date and neither live nor dropped. */
export function isLate(i: Pick<PlanItem, "due" | "percent" | "stage">, today: string): boolean {
  return !!i.due && i.due < today && !isClosed(i.stage) && (i.percent ?? 0) < 100;
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
    if (seen.has(i.id)) return { percent: null, from: null, to: null, subs: 0, subsOpen: 0, late: 0 };
    seen.add(i.id);
    const mine = subsOf.get(i.id) ?? [];
    let from = minD(i.start, i.due), to = maxD(i.start, i.due);
    for (const s of mine) { from = minD(from, s.due); to = maxD(to, s.due); }
    let n = mine.length, open = mine.filter((s) => s.status !== "done").length;
    let late = i.kind === "action" && isLate(i, today) ? 1 : 0;
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
      percent = mine.length && !isClosed(i.stage) && i.percent !== 100
        ? Math.round(mine.reduce((s, x) => s + SUB_PCT[x.status], 0) / mine.length)
        : i.percent;
      // a killed action is neither done nor to do: it leaves the average
      if (i.stage !== KILLED) { acc.n += 1; acc.sum += percent ?? 0; }
    } else {
      percent = acc.n ? Math.round(acc.sum / acc.n) : null;
    }
    sums.set(i.id, acc);
    const r = { percent, from, to, subs: n, subsOpen: open, late };
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
