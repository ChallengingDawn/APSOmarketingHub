// PAGE - THE ADDRESSES A MODULE MAY CARRY (Content v13, 11.11.2026: moved out of ./model.ts so ./adds.ts can check its own
// without importing the registry). Pure, no imports.

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** An address a module may carry: the shop's own (www or acc), or a path on it - nothing else. */
export function shopAddress(v: unknown): string {
  const s = str(v, 600).trim();
  if (!s) return "";
  if (/^https:\/\/(www|acc)\.apsoparts\.com(\/[^\s"'<>]*)?$/i.test(s)) return s;
  if (/^\/[^/\s"'<>][^\s"'<>]*$/.test(s)) return s;
  return "";
}

/** A picture a module may show: the shop's media, or the hub's own picture store (it goes to Magento's media on publish). */
export function pictureAddress(v: unknown): string {
  const s = str(v, 600).trim();
  if (/^https:\/\/(www|acc)\.apsoparts\.com\/media\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/api\/content\/picture\/[\w-]+$/.test(s)) return s;
  return "";
}
