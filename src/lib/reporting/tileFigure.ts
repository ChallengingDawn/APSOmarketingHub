// A TILE'S FIGURE, FROM ITS OWN WORDS - the line a tile gives its ticket ("30,216 Jan-Sep, -28% vs last year", "73.4% ·
// KPI autonomy, Jan–Oct 2026"): the figure it opens with, for a target set on any tile (SARCLA 04.11.2026, of the plan's
// KPIs tab: "you should be able also to set a target").

/** A figure as people type it - "1'250", "1,250", "12.5", "12,5 %" - or null. */
export function numberOf(text: string): number | null {
  let t = text.replace(/[\s'’%€]|chf/gi, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (/^-?\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** The figure a tile's words open with - "30,216 Jan-Sep" 30216, "12.5% of visits" 12.5, "CHF 4'000" 4000 - or null. */
export function figureOf(text: string): number | null {
  const m = text.replace(/(CHF|EUR|€|\$)\s*/gi, "").match(/-?\d[\d',’]*(?:\.\d+)?/);
  return m ? numberOf(m[0]) : null;
}

/** The figure as the words write it - "73.4%", "CHF 4'000", "21,526" - or null. */
export function figureText(text: string): string | null {
  const m = text.match(/(?:CHF|EUR|€|\$)?\s*-?\d[\d',’]*(?:\.\d+)?\s*%?/i);
  return m ? m[0].trim() : null;
}
