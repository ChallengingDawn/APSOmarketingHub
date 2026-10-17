import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barLayout,
  columnLayout,
  donutSlices,
  formatValue,
  lineLayout,
  niceMax,
  parseSeries,
  parseTable,
  tableLayout,
  type Datum,
} from "../src/lib/editor/dataShapes";

const near = (a: number, b: number, msg?: string) =>
  assert.ok(Math.abs(a - b) < 0.01, msg ?? `${a} is not ${b}`);

const data: Datum[] = [
  { label: "2024", value: 40 },
  { label: "2025", value: 80 },
  { label: "2026", value: 60 },
];

/* ─── tables ─── */

test("a table fills its box, every cell inside it", () => {
  const t = tableLayout([["A", "B"], ["1", "2"]], 400, 100);
  assert.equal(t.cols, 2);
  near(t.rowH, 50);
  assert.equal(t.cells.length, 4);
  for (const c of t.cells) {
    assert.ok(c.x >= 0 && c.x + c.w <= 400.01, "inside horizontally");
    assert.ok(c.y >= 0 && c.y + c.h <= 100.01, "inside vertically");
  }
});

test("the first row is the header and nothing else is", () => {
  const t = tableLayout([["A"], ["1"], ["2"]], 100, 90);
  assert.deepEqual(t.cells.map((c) => c.header), [true, false, false]);
});

test("a ragged table is padded, not drawn ragged", () => {
  // A row short of a cell is a data problem; drawing it short hides the
  // problem behind what looks like a design choice.
  const t = tableLayout([["A", "B", "C"], ["1"]], 300, 100);
  assert.equal(t.cols, 3);
  assert.equal(t.cells.length, 6);
  assert.deepEqual(
    t.cells.filter((c) => c.row === 1).map((c) => c.text),
    ["1", "", ""],
  );
});

test("column fractions that no longer add up are normalised, not trusted", () => {
  // A deleted column leaves a stored set summing to less than 1, which would
  // draw a table narrower than its own border.
  const t = tableLayout([["A", "B"], ["1", "2"]], 400, 100, [0.3, 0.3]);
  const widest = t.cells.filter((c) => c.row === 0);
  near(widest[0].w + widest[1].w, 400);
  const bad = tableLayout([["A", "B"], ["1", "2"]], 400, 100, [0, 0]);
  near(bad.cells[0].w, 200, "all-zero falls back to equal columns");
});

test("the rules go between rows, never around the outside", () => {
  const t = tableLayout([["A", "B"], ["1", "2"], ["3", "4"]], 400, 120);
  const horizontals = t.lines.filter((l) => l.y1 === l.y2);
  assert.equal(horizontals.length, 2, "two gaps between three rows");
  assert.equal(horizontals.some((l) => l.y1 === 0 || l.y1 === 120), false, "no border lines");
});

test("an empty table lays out without throwing", () => {
  const t = tableLayout([], 400, 100);
  assert.deepEqual(t.cells, []);
  assert.deepEqual(t.lines, []);
});

test("pasted text becomes rows, with the right separator", () => {
  assert.deepEqual(parseTable("A\tB\n1\t2"), [["A", "B"], ["1", "2"]]);
  // A Swiss CSV uses the semicolon AND the comma as a decimal point, so
  // splitting on the comma would cut every price in half.
  assert.deepEqual(parseTable("Part;Price\nO-ring;1,50"), [["Part", "Price"], ["O-ring", "1,50"]]);
  assert.deepEqual(parseTable("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseTable("\n   \n"), []);
});

/* ─── the axis ─── */

test("the top of the axis is a number somebody can read", () => {
  assert.equal(niceMax(8437), 10000);
  assert.equal(niceMax(1), 1);
  assert.equal(niceMax(1.4), 2);
  assert.equal(niceMax(43), 50);
  assert.equal(niceMax(230), 500);
  assert.equal(niceMax(0), 1, "an empty chart still has an axis");
  assert.equal(niceMax(-5), 1);
});

/* ─── columns ─── */

test("columns stand on the baseline and the tallest reaches the axis top", () => {
  const l = columnLayout(data, 300, 200);
  assert.equal(l.max, 100);
  for (const c of l.columns) near(c.y + c.h, l.baseline, "every column sits on the baseline");
  // 80 of a 100 axis, in the plot height.
  const plotH = l.baseline - 18;
  near(l.columns[1].h, plotH * 0.8);
});

test("columns keep their category centres when the gap is taken out of the bar", () => {
  const l = columnLayout(data, 300, 200);
  const slot = 300 / 3;
  l.columns.forEach((c, i) => near(c.x + c.w / 2, i * slot + slot / 2, `column ${i} centre`));
});

test("a zero column is a visible zero, not a missing column", () => {
  const l = columnLayout([{ label: "a", value: 0 }, { label: "b", value: 10 }], 200, 100);
  assert.equal(l.columns[0].h, 0, "nothing is nothing");
  assert.ok(l.columns[1].h > 0);
});

test("labels have room under the baseline", () => {
  const l = columnLayout(data, 300, 200);
  assert.ok(l.labelY > l.baseline);
  assert.ok(l.labelY < 200, "and the room is inside the box");
});

/* ─── bars ─── */

test("horizontal bars start after the label column", () => {
  const l = barLayout(data, 400, 150);
  for (const b of l.bars) {
    assert.equal(b.x, l.labelW);
    assert.ok(b.x + b.w <= 400.01, "inside the box");
  }
});

test("the label column never eats the chart", () => {
  const l = barLayout(data, 400, 150, { labelW: 9999 });
  assert.ok(l.labelW <= 400 * 0.45);
});

/* ─── line ─── */

test("a line has one point per value, flat for Konva", () => {
  const l = lineLayout(data, 300, 200);
  assert.equal(l.points.length, 6);
  assert.equal(l.dots.length, 3);
  near(l.dots[0].x, 0);
  near(l.dots[2].x, 300, "the last point is at the right edge");
  assert.ok(l.dots[1].y < l.dots[0].y, "80 is higher up the canvas than 40");
});

test("a single point sits in the middle, not at the left edge", () => {
  // At the edge it reads as the start of something that got cut off.
  const l = lineLayout([{ label: "now", value: 5 }], 300, 200);
  near(l.dots[0].x, 150);
  assert.equal(l.points.length, 2);
});

/* ─── donut ─── */

test("a ring starts at twelve o'clock and closes exactly once round", () => {
  const { slices, total } = donutSlices(data);
  assert.equal(total, 180);
  assert.equal(slices[0].rotation, -90, "twelve o'clock");
  const sum = slices.reduce((a, s) => a + s.angle, 0);
  near(sum, 360);
  near(slices[slices.length - 1].rotation + slices[slices.length - 1].angle, 270);
});

test("the slices stay in the order they were given", () => {
  // Sorting them would move a colour from one thing to another every time a
  // number changed.
  const { slices } = donutSlices(data);
  assert.deepEqual(slices.map((s) => s.label), ["2024", "2025", "2026"]);
  near(slices[1].share, 80 / 180);
});

test("a ring of nothing draws nothing instead of dividing by zero", () => {
  assert.deepEqual(donutSlices([]), { slices: [], total: 0 });
  assert.deepEqual(donutSlices([{ label: "a", value: 0 }]), { slices: [], total: 0 });
});

/* ─── numbers and parsing ─── */

test("values are shortened without inventing precision", () => {
  assert.equal(formatValue(8), "8");
  assert.equal(formatValue(8.25), "8.3");
  assert.equal(formatValue(12_400), "12.4k");
  assert.equal(formatValue(3_000_000), "3M");
  assert.equal(formatValue(9999), "9999", "not yet a k");
  assert.equal(formatValue(Number.NaN), "");
});

test("a typed series is read as labels and numbers", () => {
  assert.deepEqual(parseSeries("2024: 40\n2025: 80"), [
    { label: "2024", value: 40 },
    { label: "2025", value: 80 },
  ]);
  assert.deepEqual(parseSeries("Switzerland 1.2; Italy 0.8"), [
    { label: "Switzerland", value: 1.2 },
    { label: "Italy", value: 0.8 },
  ]);
});

test("a Swiss or German number survives being typed the local way", () => {
  // 1'234.5 and 1.234,5 are the same amount in two offices.
  assert.deepEqual(parseSeries("CH 1'234.5"), [{ label: "CH", value: 1234.5 }]);
  assert.deepEqual(parseSeries("DE 1.234,5"), [{ label: "DE", value: 1234.5 }]);
  assert.deepEqual(parseSeries("IT 0,8"), [{ label: "IT", value: 0.8 }]);
});

test("a line with no number in it is skipped, not read as zero", () => {
  // A zero is a claim about the business. A typo is not.
  assert.deepEqual(parseSeries("2024: 40\nnotes to self\n2025: 80"), [
    { label: "2024", value: 40 },
    { label: "2025", value: 80 },
  ]);
  assert.deepEqual(parseSeries(""), []);
});
