import assert from "node:assert/strict";
import { test } from "node:test";
import { monthsOfSeries } from "../src/lib/reporting/esoFiguresRules";

test("a KPI series per month, this year and last - other years and rows without a month left out", () => {
  const rows = [
    { year: 2026, month: 1, value: 10 }, { year: 2026, month: 1, value: 5 }, { year: 2025, month: 1, value: 7 },
    { year: 2024, month: 1, value: 99 }, { year: 2026, month: null, value: 1 }, { year: 2026, month: 12, value: 3 },
  ];
  const m = monthsOfSeries(rows, 2026);
  assert.deepEqual(m[0], { cy: 15, py: 7 });
  assert.deepEqual(m[11], { cy: 3, py: 0 });
  assert.equal(m.reduce((s, x) => s + x.cy + x.py, 0), 25);
});
