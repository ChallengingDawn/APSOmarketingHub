// THE CLIMB TO 30 M€ - where APSOparts stands against the plan's goal, "GROW APSOparts to 30M€ revenue
// by 2031" (SARCLA 31.10.2026: "the mountain ... should see real data and show what is our position
// until 30 millions in 2031"). Pure: summit.ts reads the figures, the home card and the plan draw this.
//
// The base camp is the last FULL year. The running year is never put beside it as it stands - Jan-Sep
// against twelve months reads as a collapse - but as last year's total moved by this year's like-for-like
// change (both years cut on the same day), and it is labelled an estimate wherever it is drawn.

export const SUMMIT = { value: 30_000_000, year: 2031 } as const;

export type YearFigure = { year: number; value: number };
export type Summit = {
  /** Full years, oldest first - the mountain's left side. */
  history: YearFigure[];
  /** The last full year: where the climb is measured from. */
  base: YearFigure | null;
  /** The running year, estimated: last year's total x (1 + the like-for-like change so far). */
  current: { year: number; estimate: number; ytd: number; ytdPrior: number; change: number; monthsLabel: string } | null;
  /** The growth a year it takes from the base to the summit. */
  cagr: number | null;
  /** On that path, each year from the base to the summit. */
  path: YearFigure[];
  /** The running year's estimate against the path's figure for it: positive = ahead. */
  gap: number | null;
  /** Share of the climb done: base 0, summit 1 (the running year's estimate when there is one). */
  progress: number | null;
};

export function summitOf(
  fullYears: YearFigure[],
  lfl: { year: number | null; value: number | null; priorValue: number | null; change: number | null; monthsLabel: string } | null,
  thisYear: number,
): Summit {
  const history = fullYears.filter((y) => y.year < thisYear && y.value > 0).sort((a, b) => a.year - b.year);
  const base = history.length ? history[history.length - 1] : null;
  const span = base ? SUMMIT.year - base.year : 0;
  const cagr = base && span > 0 ? Math.pow(SUMMIT.value / base.value, 1 / span) - 1 : null;
  const path = base && cagr != null
    ? Array.from({ length: span + 1 }, (_, k) => ({ year: base.year + k, value: base.value * Math.pow(1 + cagr, k) }))
    : [];
  let current: Summit["current"] = null;
  if (base && lfl && lfl.year === base.year + 1 && lfl.change != null && lfl.value != null && lfl.priorValue != null) {
    current = { year: lfl.year, estimate: base.value * (1 + lfl.change), ytd: lfl.value, ytdPrior: lfl.priorValue, change: lfl.change, monthsLabel: lfl.monthsLabel };
  }
  const due = current ? path.find((p) => p.year === current!.year) : undefined;
  const gap = current && due ? current.estimate - due.value : null;
  const at = current?.estimate ?? base?.value ?? null;
  const progress = base && at != null && SUMMIT.value !== base.value
    ? Math.max(0, Math.min(1, (at - base.value) / (SUMMIT.value - base.value)))
    : null;
  return { history, base, current, cagr, path, gap, progress };
}

/** "19.4 M€" - millions with one decimal, the way the plan writes its goal. */
export const mEur = (v: number) => `${(v / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M€`;
export const pct1 = (f: number) => `${f >= 0 ? "+" : "−"}${Math.abs(f * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
