// DUPLICATES - the page's figures by type (SARCLA 02.11.2026). Pure: the stored rows in, what each tab shows out.
//   - per type: flagged, and what people did with it - merged, closed without a merge, still open (the follow-up of
//     model.ts, final after 7 days) -, the owners handed over, what the hub wrote when live;
//   - the workflow against the hub: what the workflow flagged (what HubSpot wrote; the copy before HubSpot's answer is
//     read) and the hub kept or dropped - and why -, and what the hub finds that the workflow does not.

import { hsFound, type Row } from "./model";
import { DUP_TYPES, type DupType } from "./types";

export type TypeFig = { flagged: number; merged: number; closed: number; open: number; owner: number; written: number };
export type Why = "closed only" | "other pipeline only" | "not the same order" | "never compared";
export type Figures = {
  /** rows with the hub's verdict, and those still waiting for the replay */
  checked: number; waiting: number;
  byType: Record<DupType, TypeFig>;
  /** the same order only in closed tickets, or open only in another pipeline: shown, never flagged */
  historyOnly: number; elsewhereOnly: number;
  workflow: { flagged: number; kept: number; dropped: number; droppedWhy: { key: Why; count: number }[]; hubOnly: number };
  perDay: { day: string; twice: number; order: number; erosion: number; nothing: number }[];
};

export const hasVerdict = (r: Row) => !!r.v && !r.error;
/** What the workflow flagged for this entry: HubSpot's own answer once read, else the copy. */
export const workflowFlagged = (r: Row) => (r.actual ? hsFound(r) : !!r.legacy?.duplicates.length);
export function droppedWhy(r: Row): Why {
  const v = r.v!;
  if (v.skip && /never compared/.test(v.skip)) return "never compared";
  if (v.history.length && !v.elsewhere.length) return "closed only";
  if (v.elsewhere.length) return "other pipeline only";
  return "not the same order";
}

export function figures(rows: Row[]): Figures {
  const done = rows.filter(hasVerdict);
  const byType = Object.fromEntries(DUP_TYPES.map((t) => [t, { flagged: 0, merged: 0, closed: 0, open: 0, owner: 0, written: 0 }])) as Record<DupType, TypeFig>;
  const days = new Map<string, Figures["perDay"][number]>();
  const why = new Map<Why, number>();
  let historyOnly = 0, elsewhereOnly = 0, wf = 0, kept = 0, dropped = 0, hubOnly = 0;
  for (const r of done) {
    const v = r.v!;
    const d = r.enteredAt.slice(0, 10);
    const x = days.get(d) ?? { day: d, twice: 0, order: 0, erosion: 0, nothing: 0 };
    if (v.type) {
      const f = byType[v.type];
      f.flagged++;
      if (r.merge?.state === "merged") f.merged++;
      else if (r.merge?.state === "closed") f.closed++;
      else f.open++;
      if (v.ownerChange) f.owner++;
      if (r.live?.flagged) f.written++;
      x[v.type]++;
    } else {
      x.nothing++;
      if (v.history.length && !v.elsewhere.length) historyOnly++;
      else if (v.elsewhere.length) elsewhereOnly++;
    }
    days.set(d, x);
    const w = workflowFlagged(r);
    if (w) { wf++; if (v.status) kept++; else { dropped++; const k = droppedWhy(r); why.set(k, (why.get(k) ?? 0) + 1); } }
    else if (v.status) hubOnly++;
  }
  return {
    checked: done.length, waiting: rows.filter((r) => !r.v && !r.error).length, byType, historyOnly, elsewhereOnly,
    workflow: { flagged: wf, kept, dropped, droppedWhy: [...why].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count), hubOnly },
    perDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}
