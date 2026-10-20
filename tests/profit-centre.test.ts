import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMED, decide, isWellFormedSplit, normalise, sumByPc, wanted, type PcTotals } from "../src/lib/segmentation/profitCentre";
import { MAIN } from "../src/lib/connectors/steps/revenueRules";

/** The live options, read off the property on 20.10.2026 — typos and all. */
const SPLIT = [
  "100 % DT", "100% KT", "100% FT", "100% ST", "100% AT",
  ">80% KT", ">80% DT", ">80% FT", ">80% ST", ">80% AT",
  "Mix different PC", "No sales",
  "Major KT, then DT", "Major KT, then FT", "Major KT, then mix other PC",
  "Major DT, then KT", "Major DT, then FT", "Major DT, then ST", "Major DT, then AT", "Major DT, then mix other PC",
  "Major FT, then DT", "Major FT, then KT", "Major FT, then ST", "Major FT, then AT", "Major FT, then mix other PC",
  "Major ST, then DT", "Major ST, then FT", "Major ST, then KT", "Major ST, then AT", "Majot ST, then mix other PC",
  "Major AT, then DT", "Major AT, then KT", "Major AT, then FT", "Majot AT, then ST", "Major AT, then mix other PC",
];
const MAJOR = ["DT", "KT", "FT", "ST", "AT", "Mix different PC", "No sales"];

const blob = (o: Record<string, Record<string, number>>) => JSON.stringify(o);

test("sumByPc adds every month and every year together", () => {
  const t = sumByPc([
    blob({ jan: { dt: 100, kt: 50 }, feb: { dt: 25 } }),
    blob({ mar: { kt: 25 } }),
  ]);
  assert.equal(t.dt, 125);
  assert.equal(t.kt, 75);
});

test("sumByPc survives the rubbish a sweep of 34,000 companies will meet", () => {
  assert.deepEqual(sumByPc([null, undefined, "", "{}", "not json", "[1,2]"]), {});
  // a value stored as a string still counts; a nonsense one does not
  assert.deepEqual(sumByPc([blob({ jan: { dt: "12.5" as unknown as number, kt: "x" as unknown as number } })]), { dt: 12.5 });
});

test("only the five named centres may be named; everything else is revenue without a name", () => {
  // `unknown` is an ERP catch-all carried by almost every company. Naming it
  // produced "Major DT, then UNKNOWN" and ">80% UNKNOWN" — buckets for a
  // centre that does not exist. It still counts towards the total.
  assert.equal(wanted({ dt: 50, unknown: 50 }).split, "Major DT, then mix other PC");
  assert.equal(wanted({ dt: 99, unknown: 1 }).split, ">80% DT");
  // pw and ws are real revenue but not named centres here, as revenueRules.MAIN has it
  assert.equal(wanted({ pw: 900 }).split, "Mix different PC");
  assert.equal(wanted({ unknown: 900 }).split, "Mix different PC");
  assert.equal(wanted({ ws: 10 }).major, "Mix different PC");
  // but the sum still sees them — the total must not lie
  assert.deepEqual(sumByPc([blob({ jan: { pw: 900 } })]), { pw: 900 });
});

test("NAMED is exactly the hub's own MAIN, so the two cannot drift", () => {
  assert.deepEqual([...NAMED].sort(), [...MAIN].sort());
});

test("the CEO's thresholds", () => {
  assert.equal(wanted({}).split, "No sales");
  assert.equal(wanted({ dt: 100 }).split, "100% DT");
  assert.equal(wanted({ dt: 9_999, kt: 1 }).split, "100% DT");          // >= 99.9%
  assert.equal(wanted({ dt: 85, kt: 15 }).split, ">80% DT");
  assert.equal(wanted({ dt: 60, kt: 40 }).split, "Major DT, then KT");  // second >= 20%
  assert.equal(wanted({ dt: 50, kt: 15, ft: 10, st: 10, at: 15 }).split, "Major DT, then mix other PC");
  assert.equal(wanted({ dt: 40, kt: 35, ft: 25 }).split, "Mix different PC"); // top < 45%
});

test("a credit note never turns into a share", () => {
  // Negative centres are real but meaningless as a percentage of a mixed total.
  assert.equal(wanted({ dt: 100, kt: -40 }).split, "100% DT");
  assert.equal(wanted({ dt: -10 }).split, "No sales");
});

test("normalise forgives the property's own spelling", () => {
  assert.equal(normalise("100 % DT"), normalise("100% DT"));
  assert.equal(normalise("Majot ST, then mix other PC"), normalise("Major ST, then mix other PC"));
});

test("decide only ever writes a value the property actually offers", () => {
  const cases: PcTotals[] = [
    {}, { dt: 1 }, { kt: 1 }, { pw: 1 }, { dt: 60, kt: 40 }, { kt: 60, st: 40 },
    { kt: 55, at: 45 }, { pw: 70, dt: 30 }, { dt: 40, kt: 35, ft: 25 },
  ];
  for (const totals of cases) {
    const v = decide(totals, SPLIT, MAJOR);
    assert.ok(SPLIT.includes(v.split), `split "${v.split}" is not an option`);
    assert.ok(MAJOR.includes(v.major), `major "${v.major}" is not an option`);
  }
});

test("the typo options are matched, not duplicated", () => {
  assert.equal(decide({ dt: 100 }, SPLIT, MAJOR).split, "100 % DT");          // the one with the space
  assert.equal(decide({ st: 50, dt: 18, kt: 17, ft: 15 }, SPLIT, MAJOR).split, "Majot ST, then mix other PC");
});

test("a bucket with no option falls back BROADER and says so", () => {
  // "Major KT, then ST" does not exist in the property today.
  const v = decide({ kt: 60, st: 40 }, SPLIT, MAJOR);
  assert.equal(v.wantedSplit, "Major KT, then ST");
  assert.equal(v.split, "Major KT, then mix other PC");
  assert.equal(v.fellBack, true);
  assert.equal(v.major, "KT"); // the major centre is still exactly right
});

test("a company with only unnamed revenue is a mix, written cleanly, no fall-back", () => {
  const v = decide({ pw: 100 }, SPLIT, MAJOR);
  assert.equal(v.split, "Mix different PC");
  assert.equal(v.major, "Mix different PC");
  assert.equal(v.fellBack, false); // the option exists, so nothing was rounded
});

test("an exact match is not reported as a fall-back", () => {
  assert.equal(decide({ dt: 60, kt: 40 }, SPLIT, MAJOR).fellBack, false);
  assert.equal(decide({}, SPLIT, MAJOR).fellBack, false);
});

test("the rotation that made 53 of 100 companies wrong cannot happen here", () => {
  // A sealing customer. The ERP calls sealing DT; the workflow called it ST.
  const sealing = sumByPc([blob({ jan: { dt: 1000 } })]);
  assert.equal(decide(sealing, SPLIT, MAJOR).major, "DT");
  // An anti-vibration customer: ST, which the workflow called AT.
  assert.equal(decide(sumByPc([blob({ jan: { st: 1000 } })]), SPLIT, MAJOR).major, "ST");
  // A drive-belt customer: AT, which the workflow called DT.
  assert.equal(decide(sumByPc([blob({ jan: { at: 1000 } })]), SPLIT, MAJOR).major, "AT");
});

test("only a well-formed bucket may ever be added to the property", () => {
  // the shapes the thresholds can produce
  for (const ok of ["100% DT", ">80% KT", "Major KT, then ST", "Major AT, then mix other PC"]) {
    assert.equal(isWellFormedSplit(ok), true, ok);
  }
  // and nothing else — a stray code, a typo, free text, or the fixed options,
  // which already exist and must never be re-added
  for (const no of [
    "100% PW", "Major DT, then UNKNOWN", ">80% UNKNOWN", "Mix different PC", "No sales",
    "100 % DT", "Majot ST, then mix other PC", "Major DT, then DT", "", "Major KT, then",
    "drop table companies", "100% dt",
  ]) {
    assert.equal(isWellFormedSplit(no), false, no);
  }
});

test("every bucket the thresholds can produce is well formed", () => {
  const codes = ["AT", "DT", "FT", "KT", "ST"];
  const seen = new Set<string>();
  for (const a of codes) {
    for (const b of codes) {
      if (a === b) continue;
      const v = wanted({ [a.toLowerCase()]: 60, [b.toLowerCase()]: 40 }).split;
      seen.add(v);
      assert.equal(isWellFormedSplit(v), true, v);
    }
    for (const v of [wanted({ [a.toLowerCase()]: 100 }).split, wanted({ [a.toLowerCase()]: 85, unknown: 15 }).split]) {
      seen.add(v);
      assert.equal(isWellFormedSplit(v), true, v);
    }
  }
  // 20 pairs + 5 "100%" + 5 ">80%" — a closed, countable space
  assert.equal(seen.size, 30);
});
