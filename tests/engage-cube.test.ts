import assert from "node:assert/strict";
import { test } from "node:test";
import { engageSeries, engageTable, engageYtd, minSec, siteSearchGa4, toolTotals, type EngageData } from "../src/lib/marketingKpis/engageCube";

const d: EngageData = {
  generatedAt: "2026-10-19T00:00:00Z", year: 2026, monthsDone: 9,
  months: { "2025-09": [1000, 700, 300000, 500], "2026-09": [1200, 900, 360000, 600] },
  channels: ["Direct", "Organic Search"],
  cube: [
    ["2025-09", "CH", 0, 600, 400, 200000, 300], ["2025-09", "DE", 1, 400, 300, 100000, 200],
    ["2026-09", "CH", 0, 700, 500, 210000, 350], ["2026-09", "DE", 1, 500, 400, 150000, 260],
  ],
  views: { "2025-09": [7000, 900], "2026-09": [5000, 800] },
  topItems: [{ name: "HITEC® O-Ring NBR 70.10-02", id: "11400511", views: 900 }],
  events: {
    "2025-09": { directup_form_submit_manualupload: [200, 40], view_search_results: [2000, 300], search_results_click: [500, 120] },
    "2026-09": { directup_form_submit_manualupload: [220, 42], directup_form_submit: [8, 2], oring_expert_add_to_cart: [2, 1], view_search_results: [1500, 260], search_results_click: [600, 150] },
  },
  search: { days: 365, since: "2026-07-05", total: 3000, zero: 300, byMonth: { "2026-09": [400, 340] }, byLocale: [], top: [], gaps: [] },
  prices: { since: "2026-09-30", byDay: [["2026-10-01", 4, 3], ["2026-10-02", 2, 1]], byTeam: { ESO: 5, TSA: 1 }, companies: 5 },
  errors: {},
};

test("engagement per month: engaged sessions, sessions, seconds, users - exact, or from the cube when filtered", () => {
  const s = engageSeries(d, 2026);
  assert.equal(s.E02N.months[8], 900);
  assert.equal(s.E02D.months[8], 1200);
  assert.equal(s.E01N.months[8], 300);           // bounced = sessions - engaged
  assert.equal(s.E03S.months[8], 360000);
  assert.equal(s.E03U.py[8], 500);
  assert.equal(s.E02.months[8], 0.75);              // the ratios month by month, for the cards
  assert.equal(s.E01.months[8], 0.25);
  assert.equal(s.E03.months[8], 600);
  const de = engageSeries(d, 2026, { country: ["de"] });
  assert.equal(de.E02D.months[8], 500);
  assert.equal(de.E02N.months[8], 400);
  assert.equal(engageSeries(d, 2026, { channel: ["Direct"] }).E03S.months[8], 210000);
});

test("article views, smart-bar searches (and those that found nothing), the tools", () => {
  const s = engageSeries(d, 2026);
  assert.equal(s.E04.months[8], 5000);
  assert.equal(s.E04.py[8], 7000);
  assert.equal(s.E05.months[8], 400);
  assert.equal(s.E05N.months[8], 60);
  assert.equal(s.E05Z.months[8], 0.15);
  assert.equal(s.E06.months[8], 230);              // uploads + requests + O-ring
  assert.equal(s.E06.py[8], 200);
  const t = toolTotals(d, 2026, [8]);
  assert.deepEqual(t.map((x) => [x.count, x.pyCount]), [[220, 200], [8, 0], [2, 0]]);
  assert.deepEqual(siteSearchGa4(d, 2026, [8]), { searches: 1500, clicks: 600, pySearches: 2000, pyClicks: 500, searchers: 260 });
});

test("price checks since the tracker started; engagement by channel and country; minutes", () => {
  assert.equal(engageYtd(d).E07.cy, 6);
  assert.equal(engageYtd({ ...d, prices: null }).E07.cy, null);
  const ch = engageTable(d, 2026, [8], "channel");
  assert.deepEqual(ch.map((r) => [r.key, r.sessions, r.engaged, r.pySessions]), [["Direct", 700, 500, 600], ["Organic Search", 500, 400, 400]]);
  assert.deepEqual(engageTable(d, 2026, [8], "country").map((r) => r.label), ["Switzerland", "Germany"]);
  assert.equal(minSec(281), "4 min 41 s");
  assert.equal(minSec(65), "1 min 05 s");
});
