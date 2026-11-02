// DUPLICATES & MERGES - the order key, as the workflow "SARCLA | BACK OFFICE FILTERING | DUPS HANDLING WITH CODE"
// (2864393419) reads it: the 6-digit core + an optional 3-digit position (A26.632870.003); ".000" is the whole order and
// matches any line. The hub's rules by type are in types.ts.

export type Key = { core: string; pos: string | null };
const ORDER_KEY = /A2\d[\s._-]*(\d{6})(?:[\s._-]*(\d{3}))?(?!\d)/gi;

export function extractKeys(text: string | null | undefined): Key[] {
  const out = new Map<string, Key>();
  for (const m of String(text ?? "").matchAll(ORDER_KEY)) {
    const pos = m[2] === undefined || m[2] === "000" ? null : m[2];
    out.set(`${m[1]}.${pos ?? ""}`, { core: m[1], pos });
  }
  return [...out.values()];
}
/** Same core and the same position, or one side without a position. */
export const keysMatch = (a: Key[], b: Key[]) => a.some((x) => b.some((y) => x.core === y.core && (x.pos === null || y.pos === null || x.pos === y.pos)));
export const fmtKeys = (k: Key[]) => k.map((x) => x.core + (x.pos ? `.${x.pos}` : "")).sort().join(", ") || "(none)";
export const isErosion = (s: string | null | undefined) => /^\s*EROSION\s*\|/i.test(String(s ?? "").trim());
