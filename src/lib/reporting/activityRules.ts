// THE ACTIVITIES CHART'S RULES (SARCLA 02.11.2026: "on the ESO reports it missed the activity - just a graph with the
// number of activities in total, split by e-mails, calls, customer visits"). The e-mails a person sent and the calls they
// made, day by day, this year; the customer visits are the Visits page's own (its completed visit reports), so the two
// never disagree. The read: ./activityReport.ts. No HubSpot here, so the page and the tests read it as it is.

export type ActivityData = {
  generatedAt: string;
  /** this year - e-mails and calls are read for it only */
  year: number;
  /** the day the read reaches, "2026-11-02" */
  today: string;
  /** owner id -> each day they sent an e-mail or made a call: [yyyymmdd, e-mails sent, calls] */
  days: Record<string, [number, number, number][]>;
  /** the owners read (ESO and TSA): anyone else has no e-mails or calls here - not none, unread */
  owners: string[];
};

/** A window of the Visits page: whole months from..to (0 = January), of this year (year 0) or the last (1), cut to d0..d1. */
export type ActivityWin = { from: number; to: number; year?: 0 | 1; d0?: number; d1?: number };

/**
 * Sent by the person: HubSpot's EMAIL (sent from HubSpot or logged from their inbox) and a forward. An answer received
 * (INCOMING_EMAIL) is the customer's doing, not the person's.
 */
export const isSent = (direction: string | null | undefined) => direction === "EMAIL" || direction === "FORWARDED_EMAIL";

/** Each owner's e-mails sent and calls by day, from one row per e-mail and per call. */
export function activityDays(mails: { owner: string; day: number }[], calls: { owner: string; day: number }[]): Record<string, [number, number, number][]> {
  const by = new Map<string, Map<number, [number, number, number]>>();
  const at = (owner: string, day: number) => {
    const m = by.get(owner) ?? new Map<number, [number, number, number]>();
    by.set(owner, m);
    const e = m.get(day) ?? [day, 0, 0];
    m.set(day, e);
    return e;
  };
  for (const x of mails) if (x.owner && x.day) at(x.owner, x.day)[1]++;
  for (const x of calls) if (x.owner && x.day) at(x.owner, x.day)[2]++;
  return Object.fromEntries([...by].map(([owner, m]) => [owner, [...m.values()].sort((a, b) => a[0] - b[0])]));
}

/** An owner's e-mails sent and calls in a window - none for last year, which is not read. */
export function activityOf(d: ActivityData, owner: string, win: ActivityWin): { mails: number; calls: number } {
  const out = { mails: 0, calls: 0 };
  if (win.year) return out;
  for (const [day, mails, calls] of d.days[owner] ?? []) {
    const month = (Math.floor(day / 100) % 100) - 1;
    if (Math.floor(day / 10000) !== d.year || month < win.from || month > win.to) continue;
    if ((win.d0 && day < win.d0) || (win.d1 && day > win.d1)) continue;
    out.mails += mails;
    out.calls += calls;
  }
  return out;
}
