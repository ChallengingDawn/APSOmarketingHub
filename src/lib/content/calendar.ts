// THE CONTENT CALENDAR (list 104).
//
// A calendar without a planned date is a list sorted by whoever edited last,
// which answers "what did somebody touch" and not "what goes out next week".
// So projects get a date they are DUE, and this builds the month around them.
//
// Everything here speaks in "YYYY-MM-DD" strings and never in Date objects.
// A DATE column read back as a Date lands at midnight UTC, which in Zurich is
// the previous day at 23:00, and the whole calendar shifts by one day for
// half the year. That bug has been shipped in this building before; the fix
// is to never let a timestamp near a calendar day.

export type Day = {
  /** YYYY-MM-DD. */
  iso: string;
  /** The day of the month, for the label. */
  day: number;
  /** False for the days bled in from the months either side. */
  inMonth: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one, and it is the only
  // leap-year rule worth trusting.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday = 0. Europe starts its week on Monday and so does every A+P plan. */
export function weekdayIndex(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (d + 6) % 7;
}

/**
 * The month as whole weeks, Monday first.
 *
 * The days either side are included rather than left blank: a campaign due on
 * the 1st of next month is a thing somebody looking at the end of this one
 * needs to see.
 */
export function monthGrid(year: number, month: number): Day[][] {
  const total = daysInMonth(year, month);
  const lead = weekdayIndex(year, month, 1);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);

  const cells: Day[] = [];
  for (let i = lead; i > 0; i -= 1) {
    const day = prevTotal - i + 1;
    cells.push({ iso: isoDate(prevYear, prevMonth, day), day, inMonth: false });
  }
  for (let day = 1; day <= total; day += 1) {
    cells.push({ iso: isoDate(year, month, day), day, inMonth: true });
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let day = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ iso: isoDate(nextYear, nextMonth, day), day, inMonth: false });
    day += 1;
  }

  const weeks: Day[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Group anything that carries a due date by the day it falls on. */
export function byDueDate<T extends { dueDate: string | null }>(items: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    if (!item.dueDate) continue;
    // Tolerates a full timestamp arriving by accident: the day is the first
    // ten characters and nothing else about it matters here.
    const key = item.dueDate.slice(0, 10);
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

/** The ones with no date. The list that makes a calendar honest. */
export function unscheduled<T extends { dueDate: string | null }>(items: T[]): T[] {
  return items.filter((i) => !i.dueDate);
}

/**
 * Is this day in the past?
 *
 * Compared as strings, which for YYYY-MM-DD is the same as comparing dates
 * and cannot be knocked over by a time zone.
 */
export function isPast(iso: string, today: string): boolean {
  return iso < today;
}

/**
 * Today, as the person in front of the screen would write it.
 *
 * Built from the LOCAL parts. toISOString() would give the UTC day, which
 * after 01:00 Zurich in summer is yesterday - and "today" highlighted on the
 * wrong square is the kind of wrong that makes people distrust the whole view.
 */
export function isoFromLocal(d: Date): string {
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
