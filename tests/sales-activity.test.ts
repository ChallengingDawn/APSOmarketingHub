import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASES, C, DEFAULT_BASE, DEFS, baseForDim, basesOf, baseOf, defOf, flagName, inBase, labelOf, potentialOf, prioLabel, reachedBits, reachedBy, rowsOf, sharesOf, statsBy,
  type SalesActData,
} from "../src/lib/reporting/salesActivityRules";

// four companies: two owners (ESO, TSA), one without; calls and visits = bit 0, visits only = bit 1, Sales e-mails = bit 2, all = bit 3
const data = (): SalesActData => ({
  generatedAt: "2026-11-05T10:00:00Z", year: 2026, today: "2026-11-05",
  read: { py: [true, true, true, true], cy: [true, true, true, true] },
  people: [{ name: "Ann ESO", team: "ESO" }, { name: "Tom TSA", team: "TSA" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOmicro"], country: ["CH", "DE"] },
  companies: [
    //  person prio cat country py cy bought revPy revCy pot
    [0, 0, 0, 0, 0b1001, 0b1011, 1, 10_000, 8_000, 50_000], // Prio 1, called/visited both years
    [0, 1, 1, 1, 0, 0b1001, 1, 2_000, 0, 5_000], // Prio 2, called this year only
    [1, 2, 0, 0, 0b1001, 0, 0, 0, 0, 1_000], // Prio 3, called last year only
    [-1, 3, 1, 1, 0, 0, 0, 0, 500, 0], // no owner, no priority, bought this year, never reached
  ],
  names: ["A", "B", "C", "D"], ids: ["1", "2", "3", "4"],
  coverage: { companies: 4, noOwner: 1, prioWorkedOut: 0 },
});

test("Diana's flags by their HubSpot names: calls and visits first (the CEO's 'sales activity'), the incl-BO one without a suffix", () => {
  assert.equal(flagName(2026, 0), "sales_activity_in_2026_calls_and_visits_sales");
  assert.equal(flagName(2025, 1), "sales_activity_in_2025_only_visits");
  assert.equal(flagName(2025, 2), "sales_activity_in_2025_all_excl_bo");
  assert.equal(flagName(2026, 3), "sales_activity_in_2026");
  assert.equal(DEFS.length, 4);
  assert.equal(defOf(null), 0);
  assert.equal(defOf("visits"), 1);
  assert.equal(defOf("nonsense"), 0);
});

test("a company's flags read as bits - only Yes counts", () => {
  const props = { sales_activity_in_2026_calls_and_visits_sales: "Yes", sales_activity_in_2026_only_visits: "No", sales_activity_in_2026: "Yes" };
  const bits = reachedBits(props, 2026);
  assert.equal(bits, 0b1001);
  assert.equal(reachedBits(props, 2025), 0);
  const row = [0, 0, 0, 0, 0, bits, 0, 0, 0, 0];
  assert.ok(reachedBy(row, 0, "cy"));
  assert.ok(!reachedBy(row, 1, "cy"));
  assert.ok(!reachedBy(row, 0, "py"));
});

test("the bases: all (the default - every priority, SARCLA 06.11.2026), Prio 1 + 2 (Claudio's pick), ever bought, the categories, bought this year", () => {
  const d = data();
  const ids = (b: Parameters<typeof inBase>[2]) => d.companies.flatMap((r, i) => (inBase(d, r, b) ? [d.ids[i]] : []));
  assert.equal(DEFAULT_BASE, "all");
  assert.equal(baseOf(null), "all");
  assert.equal(baseOf("prio12"), "prio12");
  assert.equal(BASES[0].id, DEFAULT_BASE);
  assert.equal(baseOf("all"), "all");
  assert.deepEqual(ids("prio12"), ["1", "2"]);
  assert.deepEqual(ids("all"), ["1", "2", "3", "4"]);
  assert.deepEqual(ids("bought"), ["1", "2"]);
  assert.deepEqual(ids("segments"), ["1", "3"]);
  assert.deepEqual(ids("active"), ["1", "4"]);
});

test("a base's figures: reached each year, both, neither - the revenue of the year reached, today's potential", () => {
  const d = data();
  const all = statsBy(d, rowsOf(d, "all", {}, null), 0).get("")!;
  assert.deepEqual([all.n, all.cy, all.py, all.both, all.never], [4, 2, 2, 1, 1]);
  assert.equal(all.revCy, 8_500);
  assert.equal(all.revCyHit, 8_000);
  assert.equal(all.revPy, 12_000);
  assert.equal(all.revPyHit, 10_000);
  assert.deepEqual([all.pot, all.potCy, all.potPy, all.potNever], [56_000, 55_000, 51_000, 0]);
  const x = sharesOf(all);
  assert.equal(x.reach.cy, 0.5);
  assert.equal(x.never, 0.25);
  // visits only: the first company alone, this year
  const visits = statsBy(d, rowsOf(d, "all", {}, null), 1).get("")!;
  assert.deepEqual([visits.cy, visits.py, visits.never], [1, 0, 3]);
});

test("the team is the company's owner - Total takes the companies without one too; filters by label", () => {
  const d = data();
  assert.deepEqual(rowsOf(d, "all", {}, new Set([0])), [0, 1]);
  assert.deepEqual(rowsOf(d, "all", {}, new Set([1])), [2]);
  assert.deepEqual(rowsOf(d, "all", {}, null), [0, 1, 2, 3]);
  assert.deepEqual(rowsOf(d, "all", { country: ["DE"] }, null), [1, 3]);
  // the Filters window's own list leaves its own filter out
  assert.deepEqual(rowsOf(d, "all", { country: ["DE"] }, null, "country"), [0, 1, 2, 3]);
  assert.equal(labelOf(d, d.companies[3], "person"), "No owner");
  const byOwner = statsBy(d, rowsOf(d, "all", {}, null), 0, (r) => labelOf(d, r, "person"));
  assert.deepEqual([...byOwner.keys()], ["Ann ESO", "Tom TSA", "No owner"]);
});

test("every base side by side, under the same filters and team", () => {
  const d = data();
  const by = basesOf(d, {}, new Set([0]), 0);
  assert.equal(by.get("prio12")!.n, 2);
  assert.equal(by.get("prio12")!.cy, 2);
  assert.equal(by.get("all")!.n, 2);
  assert.equal(by.get("segments")!.n, 1);
  assert.equal(by.get("active")!.n, 1);
});

test("a priority for every company and only a usable potential", () => {
  assert.deepEqual(prioLabel("1-Prio 1 - Pot >25000€", 0, 0), { prio: "Prio 1", worked: false });
  assert.deepEqual(prioLabel(null, 3_000, 0), { prio: "Prio 2", worked: true });
  assert.deepEqual(prioLabel("", 0, 30_000), { prio: "Prio 1", worked: true });
  assert.equal(potentialOf("12500.4"), 12_500);
  assert.equal(potentialOf("5000000"), 0);
  assert.equal(potentialOf(null), 0);
  assert.equal(C.pot, 9);
});

test("by priority every priority stands - a Prio 1 + 2 base widens to every company there, other bases keep theirs (SARCLA 06.11.2026)", () => {
  assert.equal(baseForDim("prio12", "prio"), "all");
  assert.equal(baseForDim("prio12", "person"), "prio12");
  assert.equal(baseForDim("prio12"), "prio12");
  assert.equal(baseForDim("bought", "prio"), "bought");
  const d = data();
  const byPrio = statsBy(d, rowsOf(d, baseForDim("prio12", "prio"), {}, null), 0, (r) => labelOf(d, r, "prio"));
  assert.deepEqual([...byPrio.keys()], ["Prio 1", "Prio 2", "Prio 3", "No priority"]);
});
