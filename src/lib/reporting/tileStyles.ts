// A KPI'S STYLE IN THE BUC VIEW (SARCLA 04.11.2026: "different type of design and sizes per graphics that you can choose -
// half width and full width are kept, to not mess around with the current BUC View - but also more versions: a mini
// editor in styles, same data of course"). Picked on the KPI's Actions page, one choice for everyone like its size; none
// picked = the look it has today, so nothing in the BUC View changes until someone picks one. Only a KPI with its months
// can be drawn as columns, a line or a trend, and only one added up month by month (a count, a sum - never a rate) as a
// running total toward its target; a count of the year so far has no months.
// Rules only: the Actions page (src/app/reporting/actions) and the BUC View draw them, tests/tile-styles.test.ts holds them.

/** kpiActions.TileFormat, written here so this file stays free of the database (the tests compile it alone) */
type TileFormat = "tile" | "half" | "card";

export type TileStyle = "columns" | "line" | "cumul" | "ytd" | "trend" | "progress";

/** What a KPI's data allows: its months, and whether they add up (a sum, not a rate or an average). */
export type KpiShape = { months: boolean; additive: boolean };
type Needs = "months" | "sum" | null;

export const TILE_STYLES: { id: TileStyle; label: string; needs: Needs; sizes: TileFormat[] }[] = [
  { id: "columns", label: "Months · columns", needs: "months", sizes: ["tile", "half", "card"] },
  { id: "line", label: "Months · line", needs: "months", sizes: ["half", "card"] },
  { id: "cumul", label: "Toward the target", needs: "sum", sizes: ["half", "card"] },
  { id: "ytd", label: "Year so far · two bars", needs: null, sizes: ["tile", "half", "card"] },
  { id: "trend", label: "Figure + trend", needs: "months", sizes: ["tile", "half", "card"] },
  { id: "progress", label: "Progress to target", needs: null, sizes: ["tile", "half", "card"] },
];
const fits = (n: Needs, k: KpiShape) => n == null || (n === "months" ? k.months : k.months && k.additive);

export const isTileStyle = (x: unknown): x is TileStyle => typeof x === "string" && TILE_STYLES.some((s) => s.id === x);

/** The style a KPI has today, before anyone picks one: its months as columns, or two bars for a count of the year so far. */
export const todaysStyle = (k: KpiShape): TileStyle => (k.months ? "columns" : "ytd");

/** The styles a KPI can take at a size: those that fit it, and only those its data has. */
export function stylesFor(format: TileFormat, k: KpiShape): TileStyle[] {
  return TILE_STYLES.filter((s) => s.sizes.includes(format) && fits(s.needs, k)).map((s) => s.id);
}

/** The style drawn: the one picked when it fits the size and the data, else today's (null = draw it as it is today). */
export function styleShown(picked: TileStyle | null | undefined, format: TileFormat, k: KpiShape): TileStyle | null {
  if (!picked) return null;
  return stylesFor(format, k).includes(picked) ? picked : null;
}

/** The running total of the months up to the last whole one (`upTo` months, 1-12); null after it. */
export function runningTotal(months: (number | null)[], upTo: number): (number | null)[] {
  let sum = 0;
  return months.map((x, i) => {
    if (i >= upTo) return null;
    sum += x ?? 0;
    return sum;
  });
}

/** How far a figure is toward its target, 0..n (1 = reached); null without both. */
export function shareOfTarget(value: number | null | undefined, target: number | null | undefined): number | null {
  if (value == null || target == null || !(target > 0)) return null;
  return value / target;
}

/** Green when reached, amber from 80 %, red below - the Actions window's target box's own rule. */
export const targetTone = (share: number): "good" | "near" | "far" => (share >= 1 ? "good" : share >= 0.8 ? "near" : "far");
