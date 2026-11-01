// What the action plan's pieces share: the colours of a state, day arithmetic on "YYYY-MM-DD", the
// writes, and the viewer's own settings (zoom, grouping, what is folded) kept in their browser.

import type { PlanItem, PlanOwner, PlanState, PlanSub } from "@/lib/reporting/actionPlanRules";

/** `people` = HubSpot's users, to assign an action to; empty with `peopleError` when HubSpot could not be read. */
export type PlanData = { canWrite: boolean; items: PlanItem[]; subs: PlanSub[]; people: PlanOwner[]; peopleError: string | null };

/** Planner's colours, in the hub's tones: not started grey, in progress blue, done green, on hold amber. */
export const STATE_COLOR: Record<PlanState | "none", { bar: string; soft: string; ink: string }> = {
  todo: { bar: "#93a3bd", soft: "#e6ebf3", ink: "#4f5d78" },
  doing: { bar: "#2f6fe4", soft: "#dbe7fd", ink: "#2459d1" },
  done: { bar: "#1f9d6b", soft: "#d8f1e6", ink: "#1b7a55" },
  hold: { bar: "#d08a1e", soft: "#f8ead2", ink: "#a96a12" },
  none: { bar: "#b9c3d3", soft: "#eef1f6", ink: "#5d6b85" },
};
export const SUB_COLOR = { open: STATE_COLOR.todo, doing: STATE_COLOR.doing, done: STATE_COLOR.done } as const;
/**
 * One colour per main category, in the workbook's order - its bracket, its actions' bars and its sub-actions all
 * carry it (SARCLA 01.11.2026: "Gantt colours per project"). The hub's tint inks, then a teal and an orange; none
 * is the late red.
 */
export const PROJECT_COLORS = ["#2459d1", "#1b7a55", "#6a46c9", "#a96a12", "#b63a76", "#0f7f8c", "#c0581f", "#4a5a70"] as const;
export const LATE = "#c5221f";
export const SUMMARY = "#2b3550";

const DAY = 86_400_000;
/** Days since 1970-01-01 for "YYYY-MM-DD" (UTC, so no clock change moves a bar). */
export const dayOf = (s: string) => Math.round(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY);
export const isoOf = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
export const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
/** "30.11.2026" - the way the team writes dates. */
export const dmy = (s: string | null) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "");

export async function send(url: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok || !j?.ok) throw new Error(String(j?.error ?? j?.message ?? `the hub answered ${r.status}`));
  return j;
}

/** The viewer's own settings for the page - a convenience: a private window simply starts from the defaults. */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(`actionPlan.${key}`);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function writePref(key: string, value: unknown): void {
  try { window.localStorage.setItem(`actionPlan.${key}`, JSON.stringify(value)); } catch { /* storage off: the default next time */ }
}
