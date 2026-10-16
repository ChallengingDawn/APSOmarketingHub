// SEGMENT MOVEMENTS (KPI C08) - the pure part: the ranks, one company's history
// as moves, and the moves folded into month counts. The read is movements.ts.
//
// Up and down:
//   priority   Prio 1 > Prio 2 > Prio 3 > No priority
//   segment    APSOcore (and the ERP's ESO, DS and Growth Engine customers beside it)
//              > APSOgrowth > APSOprospect > APSOmicro > APSOlost > No sales focus
//   potential  a larger yearly potential is up

import { prioOf } from "../reporting/esoRules";

export type MoveKind = "prio" | "segment" | "potential";
export const MOVE_KINDS: MoveKind[] = ["prio", "segment", "potential"];
export type MonthCount = { up: number; down: number; set: number; upPerson: number; downPerson: number };
export type Movements = {
  generatedAt: string;
  /** the first month counted, "2025-01" */
  from: string;
  companies: number;
  /**
   * kind -> the first month any company had a value: the property's history starts
   * there (sales_priority came in May 2026), so no year-earlier figure before it.
   */
  since: Record<MoveKind, string | null>;
  /** kind -> "YYYY-MM" -> counts */
  counts: Record<MoveKind, Record<string, MonthCount>>;
  /** priority and segment: "YYYY-MM" -> "from → to" -> moves */
  transitions: Record<"prio" | "segment", Record<string, Record<string, number>>>;
};

/* ── ranks: a smaller number is higher ───────────────────────────────── */

export const PRIO_RANK: Record<string, number> = { "Prio 1": 1, "Prio 2": 2, "Prio 3": 3, "No priority": 4 };
export function segmentRank(v: string): number | null {
  if (!v) return null;
  if (v === "APSOcore" || /^ESO/i.test(v) || /^DS /i.test(v) || /Growth Engine/i.test(v)) return 1;
  const r: Record<string, number> = { APSOgrowth: 2, APSOprospect: 3, APSOmicro: 4, APSOlost: 5, "No sales focus": 6 };
  return r[v] ?? null;
}

export type Entry = { value?: string | null; timestamp?: string; sourceType?: string };
/** A change made by a person in HubSpot - the rest is the engine, workflows and imports. */
export const byPerson = (sourceType?: string) => /^CRM_UI|^MOBILE/i.test(sourceType ?? "");

export type Move = { kind: MoveKind; month: string; dir: "up" | "down" | "set"; person: boolean; from?: string; to?: string };

/** One company's history of one property, oldest first, as the moves since `from` ("YYYY-MM"). */
export function movesOf(kind: MoveKind, history: Entry[], from: string): Move[] {
  const h = [...history].filter((e) => e.timestamp).sort((a, b) => (a.timestamp! < b.timestamp! ? -1 : 1));
  const label = (v: string) => (kind === "prio" ? prioOf(v) : v);
  const out: Move[] = [];
  let prev: string | null = null;
  for (const e of h) {
    const v = (e.value ?? "").trim();
    const month = e.timestamp!.slice(0, 7);
    const before: string | null = prev;
    prev = v || before;          // a cleared value leaves the last one standing
    if (!v || v === before) continue;
    if (month < from) continue;
    const person = byPerson(e.sourceType);
    if (before == null || before === "") { out.push({ kind, month, dir: "set", person, to: label(v) }); continue; }
    let dir: "up" | "down" | null = null;
    if (kind === "prio") {
      const a = PRIO_RANK[prioOf(before)], b = PRIO_RANK[prioOf(v)];
      if (a && b && a !== b) dir = b < a ? "up" : "down";
    } else if (kind === "segment") {
      const a = segmentRank(before), b = segmentRank(v);
      if (a && b && a !== b) dir = b < a ? "up" : "down";
    } else {
      const a = Number(before), b = Number(v);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) dir = b > a ? "up" : "down";
    }
    if (dir) out.push({ kind, month, dir, person, from: label(before), to: label(v) });
  }
  return out;
}

/** The first month this history has a value - "" when it has none. */
export function firstMonth(history: Entry[]): string {
  let first = "";
  for (const e of history) if (e.timestamp && (e.value ?? "").trim() && (!first || e.timestamp.slice(0, 7) < first)) first = e.timestamp.slice(0, 7);
  return first;
}

/** Folds moves into the month counts and the from → to transitions. */
export function tally(moves: Iterable<Move>): Pick<Movements, "counts" | "transitions"> {
  const counts = { prio: {}, segment: {}, potential: {} } as Movements["counts"];
  const transitions = { prio: {}, segment: {} } as Movements["transitions"];
  for (const m of moves) {
    const c = (counts[m.kind][m.month] ??= { up: 0, down: 0, set: 0, upPerson: 0, downPerson: 0 });
    c[m.dir] += 1;
    if (m.person && m.dir !== "set") c[m.dir === "up" ? "upPerson" : "downPerson"] += 1;
    if (m.kind !== "potential" && m.dir !== "set" && m.from && m.to) {
      const t = (transitions[m.kind][m.month] ??= {});
      const k = `${m.from} → ${m.to}`;
      t[k] = (t[k] ?? 0) + 1;
    }
  }
  return { counts, transitions };
}
