import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ctrAt, targetPosition, valuePerClickFrom, worthOf, YEAR_FRACTION,
} from "../src/app/seo/worth";
import type { CannibalGroup, DecayRow, QuickWin } from "../src/app/seo/analysis";

const win = (position: number, impressions: number): QuickWin => ({
  key: "shaft seals", clicks: null, impressions, ctr: null, position,
  proximity: 0, score: 0,
});

test("the click-through curve falls with position and never rises", () => {
  for (let p = 2; p <= 12; p++) assert.ok(ctrAt(p) <= ctrAt(p - 1), `position ${p}`);
  // Off the end of the table is the flat tail, not an error or a zero.
  assert.equal(ctrAt(40), ctrAt(11));
  // Nonsense in, top of the curve out, rather than NaN propagating into euros.
  assert.equal(ctrAt(0), ctrAt(1));
  assert.equal(ctrAt(Number.NaN), ctrAt(1));
});

// The target is what the work can realistically reach. A model that promises
// position 1 for everything produces a queue nobody believes twice.
test("nothing is promised position 1 from far away", () => {
  assert.equal(targetPosition(15), 8);
  assert.equal(targetPosition(9), 4);
  assert.equal(targetPosition(5), 2);
  assert.ok(targetPosition(30) > 1);
  // Already near the top: one place, not to the summit.
  assert.equal(targetPosition(2), 1);
});

test("a quick win is worth the clicks the better position would add", () => {
  const w = worthOf({ source: "quick-win", win: win(8, 1000) }, { valuePerClick: 2, windowDays: 365 });
  // position 8 -> target 4: (0.08 - 0.03) x 1000 x 0.75 = 37.5 clicks
  assert.ok(Math.abs(w.clicksPerYear - 37.5) < 0.01, String(w.clicksPerYear));
  assert.ok(Math.abs(w.eurosPerYear - 75) < 0.01, String(w.eurosPerYear));
  assert.match(w.basis, /1,000 impressions a year/);
});

test("the window is scaled to a year, not read as one", () => {
  const long = worthOf({ source: "quick-win", win: win(8, 1000) }, { valuePerClick: 1, windowDays: 365 });
  const short = worthOf({ source: "quick-win", win: win(8, 1000) }, { valuePerClick: 1, windowDays: 28 });
  // The same impressions in 28 days is a far bigger year than in 365.
  assert.ok(short.clicksPerYear > long.clicksPerYear * 12, "a 28-day window must annualise up");
});

test("a page that improved is worth nothing to refresh", () => {
  const row: DecayRow = {
    key: "/o-rings", currentClicks: 90, previousClicks: 50, deltaClicks: -40,
    deltaPct: null, currentImpressions: 0, previousImpressions: 0, currentPosition: 6,
  };
  const w = worthOf({ source: "decay", row }, { valuePerClick: 5, windowDays: 90 });
  assert.equal(w.eurosPerYear, 0);
});

test("decay is worth what it lost, and no more", () => {
  const row: DecayRow = {
    key: "/o-rings", currentClicks: 10, previousClicks: 110, deltaClicks: 100,
    deltaPct: null, currentImpressions: 0, previousImpressions: 0, currentPosition: 6,
  };
  const w = worthOf({ source: "decay", row }, { valuePerClick: 1, windowDays: 365 });
  assert.ok(Math.abs(w.clicksPerYear - 100 * YEAR_FRACTION) < 0.01, String(w.clicksPerYear));
});

test("ranking is value for work, not value alone", () => {
  // A big cannibalisation against a small quick win: the quick win is cheap and
  // likely, so it can out-rank a larger prize that costs six times the work.
  const group: CannibalGroup = {
    query: "nbr o ring", pages: [], pageCount: 2, totalClicks: 10, totalImpressions: 4000,
    bestPosition: 6, positionSpread: null, closeness: 1, severity: 0,
    recommendation: { kind: "consolidate", keep: "/a", fold: "/b" },
  };
  const big = worthOf({ source: "cannibalisation", group }, { valuePerClick: 1, windowDays: 365 });
  const small = worthOf({ source: "quick-win", win: win(6, 500) }, { valuePerClick: 1, windowDays: 365 });
  assert.ok(big.eurosPerYear > small.eurosPerYear, "the cannibalisation is worth more in euros");
  assert.ok(small.score > big.score, "but the quick win is the better use of a day");
});

// Every euro on the page has to come from the shop. A default would look like
// a measurement and be a guess.
test("no revenue, no euros", () => {
  assert.equal(valuePerClickFrom(null, 1000), null);
  assert.equal(valuePerClickFrom(5000, null), null);
  assert.equal(valuePerClickFrom(5000, 0), null);
  assert.equal(valuePerClickFrom(0, 1000), null);
  assert.equal(valuePerClickFrom(5000, 2500), 2);
});
