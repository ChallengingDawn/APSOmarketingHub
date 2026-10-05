// One company's eshop_activity JSON as rows - pure, so it is tested without a
// database. See store.ts for why these are kept.

type Line = { t?: string; a?: string; p?: string; q?: number; c?: number; o?: number; u?: string | number };
type Counters = { v?: number; l?: number; c?: number; o?: number };

export type LookRow = {
  day: string; article: string; product: string; at: string;
  qty: number | null; carted: boolean; ordered: boolean; contact: string | null;
};
export type DayRow = { day: string; views: number; logins: number; carts: number; orders: number };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One company's JSON, as rows. Pure, so it is tested without a database. */
export function parseActivity(raw: unknown): { looks: LookRow[]; days: DayRow[] } {
  let j: { days?: Record<string, Counters>; recent?: Line[] };
  try { j = JSON.parse(String(raw ?? "")); } catch { return { looks: [], days: [] }; }
  const looks = new Map<string, LookRow>();
  for (const l of Array.isArray(j?.recent) ? j.recent : []) {
    const at = String(l?.t ?? "");
    const day = at.slice(0, 10);
    const article = l?.a ? String(l.a).slice(0, 32) : "";
    const product = l?.p ? String(l.p).slice(0, 32) : "";
    if (!ISO_DAY.test(day) || (!article && !product)) continue;
    const k = `${day}|${article}|${product}`;
    const q = num(l.q);
    const prev = looks.get(k);
    looks.set(k, {
      day, article, product,
      at: prev && prev.at > at ? prev.at : at,
      qty: q ?? prev?.qty ?? null,
      carted: (prev?.carted ?? false) || l.c === 1,
      ordered: (prev?.ordered ?? false) || l.o === 1,
      contact: prev?.contact ?? (l.u != null && String(l.u).trim() ? String(l.u).trim().slice(0, 20) : null),
    });
  }
  const days: DayRow[] = [];
  for (const [day, c] of Object.entries(j?.days && typeof j.days === "object" ? j.days : {})) {
    if (!ISO_DAY.test(day)) continue;
    days.push({ day, views: num(c?.v) ?? 0, logins: num(c?.l) ?? 0, carts: num(c?.c) ?? 0, orders: num(c?.o) ?? 0 });
  }
  return { looks: [...looks.values()], days };
}
