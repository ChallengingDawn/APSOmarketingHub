// TABLES AND CHARTS ON THE CANVAS (canvas list 23, 24).
//
// A spec table and a "revenue by year" column chart are the two things a
// product page and a sales one-pager always need, and until now the only way
// to get either onto a layout was to build it in Excel, screenshot it, and
// paste a picture that nobody can correct a typo in.
//
// Only the GEOMETRY lives here, with no Konva and no React, so what a chart
// is actually shaped like can be tested rather than squinted at. The colours
// come from src/app/charts/palette.ts - the hub's charts already have a
// palette that was checked for colour-blind separation, and a second one
// invented here would be the fourth blue in the building.

export type Datum = { label: string; value: number };

/* ─────────────────────────── tables ─────────────────────────── */

export type TableCell = {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** The first row, which is drawn differently. */
  header: boolean;
};

export type GridLine = { x1: number; y1: number; x2: number; y2: number };

export type TableLayout = {
  cells: TableCell[];
  lines: GridLine[];
  cols: number;
  rowH: number;
};

/**
 * Lay a table out in its box.
 *
 * The column count is the WIDEST row, and short rows are padded with empty
 * cells. A ragged table is a data problem, and drawing it ragged hides the
 * problem behind what looks like a design choice.
 */
export function tableLayout(
  rows: string[][],
  w: number,
  h: number,
  colFractions?: number[],
): TableLayout {
  const boxW = Math.max(1, w);
  const boxH = Math.max(1, h);
  if (rows.length === 0) return { cells: [], lines: [], cols: 0, rowH: boxH };

  const cols = Math.max(1, ...rows.map((r) => r.length));
  const rowH = boxH / rows.length;

  // Fractions are normalised rather than trusted: a stored set that no longer
  // adds to 1 (a column was deleted) would otherwise draw a table narrower
  // than its own border.
  let widths: number[];
  if (colFractions && colFractions.length === cols) {
    const sum = colFractions.reduce((a, b) => a + Math.max(0, b), 0);
    widths = sum > 0
      ? colFractions.map((f) => (Math.max(0, f) / sum) * boxW)
      : Array.from({ length: cols }, () => boxW / cols);
  } else {
    widths = Array.from({ length: cols }, () => boxW / cols);
  }

  const xs: number[] = [0];
  for (const cw of widths) xs.push(xs[xs.length - 1] + cw);

  const cells: TableCell[] = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < cols; c += 1) {
      cells.push({
        row: r,
        col: c,
        x: xs[c],
        y: r * rowH,
        w: widths[c],
        h: rowH,
        text: row[c] ?? "",
        header: r === 0,
      });
    }
  });

  const lines: GridLine[] = [];
  // Horizontal rules BETWEEN rows only: a line above the first row and below
  // the last is the node's own border, and drawing both doubles their weight.
  for (let r = 1; r < rows.length; r += 1) {
    lines.push({ x1: 0, y1: r * rowH, x2: boxW, y2: r * rowH });
  }
  for (let c = 1; c < cols; c += 1) {
    lines.push({ x1: xs[c], y1: 0, x2: xs[c], y2: boxH });
  }

  return { cells, lines, cols, rowH };
}

/** Turn pasted text into rows. Tabs first, because that is what Excel gives. */
export function parseTable(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // A tab is unambiguous. A semicolon is next, because a Swiss CSV uses it
  // and its numbers use the comma as a decimal separator - splitting those on
  // the comma would cut every price in half.
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) ? ";" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.trim()));
}

/* ─────────────────────────── charts ─────────────────────────── */

/**
 * A top of the axis somebody can read.
 *
 * 1, 2 or 5 times a power of ten, just above the biggest value. An axis that
 * ends at 8,437 makes every bar a measurement problem.
 */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export type Column = {
  label: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ColumnLayout = {
  columns: Column[];
  max: number;
  /** Where zero sits: the bars grow up from it. */
  baseline: number;
  /** Room left under the baseline for the labels. */
  labelY: number;
};

/**
 * Vertical columns, the shape for "how much, by category".
 *
 * A 2px gap between neighbours comes out of the bar, not out of the spacing,
 * so the columns stay on their category centres when one is removed.
 */
export function columnLayout(
  data: Datum[],
  w: number,
  h: number,
  opts: { labelRoom?: number; valueRoom?: number; gap?: number } = {},
): ColumnLayout {
  const boxW = Math.max(1, w);
  const boxH = Math.max(1, h);
  const labelRoom = opts.labelRoom ?? 22;
  const valueRoom = opts.valueRoom ?? 18;
  const gap = opts.gap ?? 2;

  const baseline = boxH - labelRoom;
  const plotH = Math.max(1, baseline - valueRoom);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = boxW / Math.max(1, data.length);

  const columns = data.map((d, i) => {
    const barW = Math.max(1, slot - gap * 2);
    // A value of zero still draws a hairline, so a category with nothing in
    // it is visibly a zero rather than a missing column.
    const barH = Math.max(d.value > 0 ? 1 : 0, (Math.max(0, d.value) / max) * plotH);
    return {
      label: d.label,
      value: d.value,
      x: i * slot + gap,
      y: baseline - barH,
      w: barW,
      h: barH,
    };
  });

  return { columns, max, baseline, labelY: baseline + 4 };
}

export type BarRow = Column & { labelW: number };

/**
 * Horizontal bars, the shape for "how much, by name" when the names are words
 * rather than years - a sideways label is a label nobody reads.
 */
export function barLayout(
  data: Datum[],
  w: number,
  h: number,
  opts: { labelW?: number; gap?: number } = {},
): { bars: BarRow[]; max: number; labelW: number } {
  const boxW = Math.max(1, w);
  const boxH = Math.max(1, h);
  const labelW = Math.min(boxW * 0.45, opts.labelW ?? boxW * 0.3);
  const gap = opts.gap ?? 2;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = boxH / Math.max(1, data.length);
  const plotW = Math.max(1, boxW - labelW);

  const bars = data.map((d, i) => ({
    label: d.label,
    value: d.value,
    x: labelW,
    y: i * slot + gap,
    w: Math.max(d.value > 0 ? 1 : 0, (Math.max(0, d.value) / max) * plotW),
    h: Math.max(1, slot - gap * 2),
    labelW,
  }));

  return { bars, max, labelW };
}

export type LineLayout = {
  /** Flat x,y pairs, which is what Konva's Line wants. */
  points: number[];
  dots: { x: number; y: number; value: number; label: string }[];
  max: number;
  baseline: number;
};

/** A line, for "how it moved" - the only shape that implies time. */
export function lineLayout(
  data: Datum[],
  w: number,
  h: number,
  opts: { labelRoom?: number; valueRoom?: number } = {},
): LineLayout {
  const boxW = Math.max(1, w);
  const boxH = Math.max(1, h);
  const labelRoom = opts.labelRoom ?? 22;
  const valueRoom = opts.valueRoom ?? 14;
  const baseline = boxH - labelRoom;
  const plotH = Math.max(1, baseline - valueRoom);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));

  // A single point has no line; it is placed in the middle rather than at the
  // left edge, where it would read as the start of something cut off.
  const step = data.length > 1 ? boxW / (data.length - 1) : 0;
  const dots = data.map((d, i) => ({
    x: data.length > 1 ? i * step : boxW / 2,
    y: baseline - (Math.max(0, d.value) / max) * plotH,
    value: d.value,
    label: d.label,
  }));

  return { points: dots.flatMap((p) => [p.x, p.y]), dots, max, baseline };
}

export type Slice = {
  label: string;
  value: number;
  /** Degrees, clockwise from twelve o'clock. */
  rotation: number;
  angle: number;
  share: number;
};

/**
 * A ring, for "what share of the whole".
 *
 * It starts at twelve o'clock because that is where a reader starts, and the
 * slices run clockwise in the order they were given - sorting them would
 * change which colour belongs to which thing every time a number moved.
 */
export function donutSlices(data: Datum[]): { slices: Slice[]; total: number } {
  const values = data.map((d) => Math.max(0, d.value));
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return { slices: [], total: 0 };

  let at = -90;
  const slices = data.map((d, i) => {
    const share = values[i] / total;
    const angle = share * 360;
    const slice: Slice = { label: d.label, value: d.value, rotation: at, angle, share };
    at += angle;
    return slice;
  });
  return { slices, total };
}

/** Numbers as a person wrote them: no units invented, no decimals added. */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trimZero(v / 1_000_000)}M`;
  if (abs >= 10_000) return `${trimZero(v / 1000)}k`;
  return trimZero(v);
}

function trimZero(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** "2024: 1.2, 2025: 1.4" or one number per line - whichever they typed. */
export function parseSeries(text: string): Datum[] {
  const out: Datum[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split(/[\n;]/)) {
    const line = raw.trim();
    if (!line) continue;
    // The apostrophe is in the NUMBER class, not a separator: a Swiss sheet
    // writes 1'234.5, and without it the number reads as "1" and the rest of
    // the amount is silently dropped.
    const m = /^(.*?)[\s:,=]+(-?[\d.,'’]+)\s*$/.exec(line);
    if (!m) continue;
    // A Swiss sheet writes 1'234.5 and a German one 1.234,5. Strip the
    // thousands marks, then treat a lone comma as the decimal point.
    const num = m[2].replace(/['’\s]/g, "");
    const normalised = /,\d{1,2}$/.test(num) ? num.replace(/\./g, "").replace(",", ".") : num.replace(/,/g, "");
    const value = Number(normalised);
    if (!Number.isFinite(value)) continue;
    out.push({ label: m[1].trim(), value });
  }
  return out;
}
