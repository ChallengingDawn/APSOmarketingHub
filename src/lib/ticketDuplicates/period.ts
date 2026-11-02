// DUPLICATES & MERGES - the period a page asks for, in days (pure - the tests read it).

/** Every day from `from` to `to` (YYYY-MM-DD, both included). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end && out.length < 400; t += 86400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** The period asked for, made safe: two dates, `from` first, at most 365 days, never after today - else the last 28 days. */
export function spanOk(from: string | null, to: string | null, today: string): { from: string; to: string; days: number } {
  const ok = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T00:00:00Z`));
  let t = ok(to) ? (to! > today ? today : to!) : today;
  let f = ok(from) ? from! : new Date(Date.parse(`${t}T00:00:00Z`) - 27 * 86400_000).toISOString().slice(0, 10);
  if (f > t) [f, t] = [t, f];
  const min = new Date(Date.parse(`${t}T00:00:00Z`) - 364 * 86400_000).toISOString().slice(0, 10);
  if (f < min) f = min;
  return { from: f, to: t, days: daysBetween(f, t).length };
}
