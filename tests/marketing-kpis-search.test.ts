import assert from "node:assert/strict";
import { test } from "node:test";
import { completeOnly, mergeHistory, monthlyFromDaily, seriesFromMonths, type SearchDay } from "../src/lib/marketingKpis/searchMonthly";
import { total, type Series } from "../src/lib/marketingKpis/measures";

/** Every day from `from` to `to`, each with the same figures. */
function days(from: string, to: string, clicks: number, impressions: number, position: number): SearchDay[] {
  const out: SearchDay[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    out.push({ date: d.toISOString().slice(0, 10), clicks, impressions, position });
  }
  return out;
}

test("days fold into months: sums, CTR, position weighted by impressions, brand share", () => {
  const all = [...days("2026-09-01", "2026-09-30", 10, 1000, 12), ...days("2026-08-01", "2026-08-31", 20, 1000, 10)];
  // one heavy day in August at position 2 pulls the weighted average down
  all.push({ date: "2026-08-31", clicks: 0, impressions: 31000, position: 2 });
  const brand = days("2026-09-01", "2026-09-30", 4, 50, 1);
  const m = monthlyFromDaily(all, brand, 2026, new Date("2026-10-17T10:00:00Z"));
  assert.equal(m.series.R04.months[8], 30_000);
  assert.equal(m.series.R05.months[8], 300);
  assert.equal(m.series.R06.months[8], 0.01);
  assert.equal(m.series.R07.months[8], 12);
  assert.equal(m.series.R08B.months[8], 120);
  assert.equal(m.series.R08.months[8], 0.4);
  // August: 31 days at 10 on 1,000 + one day at 2 on 31,000 -> (310,000 + 62,000) / 62,000 = 6
  assert.equal(m.series.R07.months[7], 6);
  assert.equal(m.firstDay, "2026-08-01");
  assert.equal(m.lastDay, "2026-09-30");
});

test("a past month Google holds only in part is empty, not low; the month in progress counts as far as it goes", () => {
  const all = [...days("2025-06-18", "2025-07-31", 5, 500, 9), ...days("2026-10-01", "2026-10-15", 7, 700, 8)];
  const m = monthlyFromDaily(all, [], 2026, new Date("2026-10-17T10:00:00Z"));
  assert.equal(m.series.R04.py[5], null);                 // June 2025 from the 18th: not a month
  assert.equal(m.series.R04.py[6], 31 * 500);             // July 2025 whole
  assert.equal(m.series.R04.months[9], 15 * 700);         // October 2026 so far
  assert.equal(m.series.R08.py[6], 0);                    // no brand clicks: 0%, not empty
  assert.equal(m.series.R04.months[10], null);            // November not yet
});

test("like for like: last year's figure and this year's on the same months only", () => {
  const s: Series = { months: [10, 10, 10, 10, null, null, null, null, null, null, null, null], py: [null, null, 5, 5, null, null, null, null, null, null, null, null] };
  const get = () => s;
  const both = s.months.map((v, i) => i < 4 && v != null && s.py[i] != null);
  assert.equal(total("R05", s, "months", get, 4), 40);
  assert.equal(total("R05", s, "months", get, 4, both), 20);
  assert.equal(total("R05", s, "py", get, 4, both), 10);
});

test("the hub keeps the months Google drops: a whole month kept beats a part re-read; a re-read whole month wins", () => {
  const kept = { "2025-06": { days: 30, clicks: 100, impr: 1000, posW: 10000, brand: 10 }, "2025-07": { days: 31, clicks: 50, impr: 500, posW: 5000, brand: 5 } };
  const fresh = { "2025-06": { days: 12, clicks: 40, impr: 400, posW: 4000, brand: 4 }, "2025-07": { days: 31, clicks: 55, impr: 550, posW: 5500, brand: 6 } };
  const m = mergeHistory(kept, fresh);
  assert.equal(m["2025-06"].clicks, 100);   // Google has begun to drop June: the kept whole month stays
  assert.equal(m["2025-07"].clicks, 55);    // July read again whole: Google's revision wins
  // only whole months are kept
  const c = completeOnly({ ...m, "2026-10": { days: 15, clicks: 1, impr: 10, posW: 10, brand: 0 } });
  assert.deepEqual(Object.keys(c).sort(), ["2025-06", "2025-07"]);
  // and they make last year's months
  const s = seriesFromMonths(m, 2026, new Date("2026-10-17T00:00:00Z"));
  assert.equal(s.R05.py[5], 100);
  assert.equal(s.R05.py[6], 55);
});
