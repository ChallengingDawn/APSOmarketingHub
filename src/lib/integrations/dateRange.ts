// Resolves a reporting window into the explicit dates the Google APIs take.
// Both GA4 and Search Console accept YYYY-MM-DD, so a relative "last N days"
// and a custom range go down the same path, and the equivalent window
// immediately before is always available for comparisons.

export type ResolvedRange = {
  startDate: string;
  endDate: string;
  /** Inclusive length in days. */
  days: number;
  previous: { startDate: string; endDate: string };
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function utcDay(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function shiftIso(iso: string, days: number): string {
  return toIso(utcDay(iso) + days * 86_400_000);
}

export function spanDays(from: string, to: string): number {
  return Math.max(1, Math.round((utcDay(to) - utcDay(from)) / 86_400_000) + 1);
}

export function resolveRange(
  input: { days?: number; from?: string | null; to?: string | null },
  maxDays: number,
): ResolvedRange {
  if (isIsoDate(input.from) && isIsoDate(input.to) && utcDay(input.from) <= utcDay(input.to)) {
    let startDate = input.from;
    const endDate = input.to;
    if (spanDays(startDate, endDate) > maxDays) startDate = shiftIso(endDate, -(maxDays - 1));
    const days = spanDays(startDate, endDate);
    return {
      startDate,
      endDate,
      days,
      previous: { startDate: shiftIso(startDate, -days), endDate: shiftIso(startDate, -1) },
    };
  }
  const requested = Number.isFinite(input.days) ? Math.floor(input.days as number) : 28;
  const days = Math.min(Math.max(requested, 1), maxDays);
  const today = toIso(Date.now());
  const startDate = shiftIso(today, -(days - 1));
  return {
    startDate,
    endDate: today,
    days,
    previous: { startDate: shiftIso(startDate, -days), endDate: shiftIso(startDate, -1) },
  };
}

/** Reads ?from=&to= off a request, returning undefined for anything malformed. */
export function rangeParams(sp: URLSearchParams): { from?: string; to?: string } {
  const from = sp.get("from");
  const to = sp.get("to");
  return { from: isIsoDate(from) ? from : undefined, to: isIsoDate(to) ? to : undefined };
}
