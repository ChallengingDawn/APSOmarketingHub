// What the action plan's pieces share: the colours of a stage and a priority, day arithmetic on "YYYY-MM-DD", the
// writes, and the viewer's own settings (zoom, grouping, what is folded) kept in their browser.

import type { Opt, PlanItem, PlanOwner, PlanSub } from "@/lib/reporting/actionPlanRules";

/**
 * `people` = HubSpot's users, to assign an action to; empty with `peopleError` when HubSpot could not be read.
 * `choices` = the "From Scroll to Sale" ticket's choices for the same fields.
 */
export type PlanData = {
  canWrite: boolean; items: PlanItem[]; subs: PlanSub[]; people: PlanOwner[]; peopleError: string | null;
  /** Each action's own tickets' ids (linked on the action, not under a sub-action), by the action's id. */
  own?: Record<string, string[]>;
  choices: Record<"channel" | "country" | "agency" | "roadmapYear", Opt[]>;
};

type Tone = { bar: string; soft: string; ink: string };
const TONE = {
  grey: { bar: "#93a3bd", soft: "#e6ebf3", ink: "#4f5d78" },
  blue: { bar: "#2f6fe4", soft: "#dbe7fd", ink: "#2459d1" },
  amber: { bar: "#d08a1e", soft: "#f8ead2", ink: "#a96a12" },
  purple: { bar: "#8b6ad6", soft: "#ede6fb", ink: "#6a46c9" },
  teal: { bar: "#1592a0", soft: "#dcf1f3", ink: "#0f7f8c" },
  green: { bar: "#1f9d6b", soft: "#d8f1e6", ink: "#1b7a55" },
  dark: { bar: "#5b6b86", soft: "#e9eef5", ink: "#4a5a70" },
  none: { bar: "#b9c3d3", soft: "#eef1f6", ink: "#5d6b85" },
} satisfies Record<string, Tone>;
/** The pipeline's stages in the hub's tones: the idea box grey, the work blue, the waits amber and purple, ready teal, live green. */
export const STAGE_COLOR: Record<string, Tone> = {
  "6161860807": TONE.grey, "6161860808": TONE.blue, "6161845476": TONE.amber, "6161845477": TONE.purple,
  "6161860809": TONE.teal, "6161856758": TONE.green, "6161856759": TONE.green, "6161860810": TONE.dark, none: TONE.none,
};
export const stageColor = (id: string | null) => STAGE_COLOR[id ?? "none"] ?? TONE.none;
/** HubSpot's priorities, as square tags. */
export const PRIORITY_COLOR: Record<string, { bg: string; fg: string }> = {
  URGENT: { bg: "#fde7e7", fg: "#c5221f" }, HIGH: { bg: "#fdf0dc", fg: "#a96a12" },
  MEDIUM: { bg: "#e6edfd", fg: "#2459d1" }, LOW: { bg: "#eef1f6", fg: "#5d6b85" },
};
export const SUB_COLOR = { open: TONE.grey, doing: TONE.blue, done: TONE.green } as const;
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
