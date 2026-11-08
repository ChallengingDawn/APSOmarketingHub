// A FIGURE ON SCREEN (08.11.2026): the "big number" scene counts a plain number up to its value ("100,000+", "17,000",
// "7") and slams any other in ("48/72h", "1:1"). Pure - tests/studio-video-features.test.ts.

/** "100,000+" -> its parts, when it is one plain number that can count up; null for "48/72h", "1:1". */
export function countable(fig: string): { pre: string; value: number; sep: string; post: string } | null {
  const m = /^([^\d]*)(\d{1,3}(?:([,.' ])\d{3})+|\d+)([^\d]*)$/.exec(fig.trim());
  if (!m || /[/:]/.test(m[4])) return null;
  return { pre: m[1], value: Number(m[2].replace(/[^\d]/g, "")), sep: m[3] ?? "", post: m[4] };
}

/** A number with its thousands marked as the figure had them: 100000 with "," -> "100,000". */
export const group = (n: number, sep: string) => (sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n));
