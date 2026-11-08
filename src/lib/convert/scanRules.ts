// APSOconvert > the night scan's rules (./scan.ts), pure so they are tested: how many pages a night, when.

export const SCAN = { pagesPerNight: 5, waitingCap: 30, fromHour: 1, toHour: 5 } as const;

/** How many pages tonight's scan may read: the night's 5, fewer as the waiting ideas near 30 (a page brings 3-5). */
export function pagesTonight(waiting: number): number {
  if (waiting >= SCAN.waitingCap) return 0;
  return Math.max(0, Math.min(SCAN.pagesPerNight, Math.ceil((SCAN.waitingCap - waiting) / 4)));
}

/** The Swiss hour and day of a moment (the scan runs at night in Switzerland, whatever the server's clock says). */
export function swissNow(at = new Date()): { hour: number; day: string } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { hour: Number(get("hour")) % 24, day: `${get("year")}-${get("month")}-${get("day")}` };
}
