// ABSENCES - the rule, pure (the writes in absenceEdit.ts). SARCLA 13.11.2026, on Back Office distribution >
// Availability: "allow also to see the absences and to record absences for colleagues".
//
// An absence is a window in the HubSpot user's "Out Of Office Hours" (hs_out_of_office_hours), the field HubSpot's
// own out-of-office uses and the holiday redirection (people.ts) and the Back Office distribution already read. Stored
// as HubSpot stores it: a JSON list of {startTimestamp, endTimestamp, _clientEventId, eventTitle}; a whole day runs
// from 00:00 to 23:59 Zurich time (what HubSpot wrote for the windows people entered themselves, read 13.11.2026).

export type AbsenceWindow = { id: string; title: string; start: number; end: number; from: string; to: string };
type Raw = { startTimestamp?: unknown; endTimestamp?: unknown; _clientEventId?: unknown; eventTitle?: unknown };

const TZ = "Europe/Zurich";

/** The day (YYYY-MM-DD) a moment falls on in Zurich. */
export function zurichDay(ms: number): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** 00:00 of a day in Zurich, as a moment. */
export function zurichDayStart(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`not a day: ${day}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Zurich is UTC+1 or +2: try both, keep the one that is midnight there
  for (const h of [1, 2]) {
    const t = utc - h * 3600_000;
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));
    if (p === "00:00" && zurichDay(t) === day) return t;
  }
  throw new Error(`no Zurich midnight found for ${day}`);
}

/** 23:59 of a day in Zurich, as HubSpot ends a whole day. */
export function zurichDayEnd(day: string): number {
  const next = new Date(zurichDayStart(day) + 36 * 3600_000);
  return zurichDayStart(zurichDay(next.getTime())) - 60_000;
}

/** Every window of a user's out-of-office hours, oldest first; a broken entry is left out. */
export function windowsOf(raw: string | null | undefined): AbsenceWindow[] {
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: AbsenceWindow[] = [];
  for (const w of arr as Raw[]) {
    const start = Number(w?.startTimestamp), end = Number(w?.endTimestamp);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    out.push({ id: String(w?._clientEventId ?? `${start}`), title: typeof w?.eventTitle === "string" ? w.eventTitle : "", start, end, from: zurichDay(start), to: zurichDay(end) });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The windows still to come or holding now. */
export const comingWindows = (all: AbsenceWindow[], nowMs: number): AbsenceWindow[] => all.filter((w) => w.end >= nowMs);

/** The list with one window more, as HubSpot keeps it (the others exactly as they were). */
export function withWindow(raw: string | null | undefined, w: { start: number; end: number; title: string; id: string }): string {
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { arr = []; }
  const list = Array.isArray(arr) ? arr : [];
  return JSON.stringify([...list, { startTimestamp: w.start, endTimestamp: w.end, _clientEventId: w.id, eventTitle: w.title }]);
}

/** The list without one window (by its id); the others exactly as they were. */
export function withoutWindow(raw: string | null | undefined, id: string): { raw: string; removed: boolean } {
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { return { raw: raw ?? "[]", removed: false }; }
  if (!Array.isArray(arr)) return { raw: raw ?? "[]", removed: false };
  const keep = (arr as Raw[]).filter((w) => String(w?._clientEventId ?? `${Number(w?.startTimestamp)}`) !== id);
  return { raw: JSON.stringify(keep), removed: keep.length !== arr.length };
}

/** A new absence from the page: checked, then as HubSpot stores it. */
export function newWindow(from: string, to: string, title: string, by: string, nowMs: number): { start: number; end: number; title: string; id: string } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "A first and a last day, please" };
  if (to < from) return { error: "The last day is before the first" };
  if (to < zurichDay(nowMs)) return { error: "That absence is over already" };
  const start = zurichDayStart(from), end = zurichDayEnd(to);
  if (end - start > 370 * 86400_000) return { error: "More than a year - check the dates" };
  const t = title.trim().replace(/\s+/g, " ").slice(0, 120);
  return { start, end, id: `clientEventId${nowMs}`, title: t ? `${t} (entry by ${by})` : `Away - entry by ${by}` };
}
