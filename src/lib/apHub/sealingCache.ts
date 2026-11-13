// SEALING BUSINESS REVIEW - the answers already worked out, kept in the process (SARCLA 13.11.2026: "'Reading the
// sealing figures…' takes a lot of time"). An answer is kept under its route, the question asked - normalised, so the
// same filters in another order are the same question - and the stamp of the data it was read from (the morning
// delivery's loaded_at): a new delivery changes the stamp, and every answer kept before it is no longer found. Two
// requests asking the same at the same moment share one reading. Each route keeps its last answers, the oldest let go.

/** The question in one stable form: object keys in order, lists of words sorted (bu=APCH&bu=APDE is bu=APDE&bu=APCH). */
export function stableKey(x: unknown): string {
  if (x === null || x === undefined) return "";
  if (Array.isArray(x)) {
    const parts = x.map(stableKey);
    return `[${(x.every((v) => typeof v === "string") ? [...parts].sort() : parts).join(",")}]`;
  }
  if (typeof x === "object") {
    return `{${Object.keys(x as Record<string, unknown>).sort().filter((k) => (x as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${k}:${stableKey((x as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(x);
}

export const cacheKey = (route: string, stamp: string, ask: unknown) => `${route}|${stamp}|${stableKey(ask)}`;

/** How many answers each route keeps - the overview's are large, a list's page or a detail small. */
const KEEP: Record<string, number> = { overview: 40, list: 400, detail: 300 };

type Kept = { value: unknown; at: number };
const kept = new Map<string, Map<string, Kept>>();
const reading = new Map<string, Promise<unknown>>();

/**
 * The answer to `ask` on `route` for the data stamped `stamp`: the one kept, or worked out once by `compute` and kept.
 * `hit` says which - the route logs it.
 */
export async function sealingCached<T>(route: string, stamp: string, ask: unknown, compute: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const key = cacheKey(route, stamp, ask);
  const box = kept.get(route) ?? new Map<string, Kept>();
  kept.set(route, box);
  const old = box.get(key);
  if (old) {
    // the most recently used last - the first in the map is the one to let go
    box.delete(key);
    box.set(key, old);
    return { value: old.value as T, hit: true };
  }
  const running = reading.get(key);
  if (running) return { value: (await running) as T, hit: true };
  const p = compute();
  reading.set(key, p);
  try {
    const value = await p;
    box.set(key, { value, at: Date.now() });
    // answers of an older delivery are never asked again: let them go; then the least recently used past the limit
    for (const k of [...box.keys()]) if (!k.startsWith(`${route}|${stamp}|`)) box.delete(k);
    const cap = KEEP[route] ?? 200;
    for (const k of box.keys()) {
      if (box.size <= cap) break;
      box.delete(k);
    }
    return { value, hit: false };
  } finally {
    reading.delete(key);
  }
}

/** Every answer let go - the morning delivery saved in this process. */
export function sealingCacheClear(): void {
  kept.clear();
}

/** How many answers a route keeps now (the tests). */
export const sealingCacheSize = (route: string) => kept.get(route)?.size ?? 0;
