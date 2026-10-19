import assert from "node:assert/strict";
import { test } from "node:test";
import { cubeTable, groupOf, groupsByMonth, knownByCountry, landingTable, noPageVisits, storeChannels, storeName, storeOf, storeTable, usersAbroad, visitSeries, visitYtd, type VisitData } from "../src/lib/marketingKpis/visitCube";

const d: VisitData = {
  generatedAt: "2026-10-18T00:00:00Z", year: 2026, monthsDone: 9,
  users: { "2025-09": [1000, 400, 1500], "2026-09": [1200, 500, 1800] },
  channels: ["Direct", "Organic Search", "Paid Search"],
  cube: [
    ["2025-09", "CH", 0, 500, 300, 100], ["2025-09", "DE", 1, 600, 400, 200], ["2025-09", "IT", 2, 400, 350, 100],
    ["2026-09", "CH", 0, 600, 350, 120], ["2026-09", "DE", 1, 700, 450, 260], ["2026-09", "IT", 2, 500, 420, 130], ["2026-09", "", 0, 10, 8, 2],
  ],
  // exact per country - lower than the cube's users, which count a visitor once per channel
  countryUsers: [
    ["2025-09", "CH", 300, 100, 500], ["2025-09", "DE", 380, 190, 600], ["2025-09", "IT", 340, 95, 400],
    ["2026-09", "CH", 340, 115, 600], ["2026-09", "DE", 430, 250, 700], ["2026-09", "IT", 410, 125, 500], ["2026-09", "", 8, 2, 10],
  ],
  logins: [["2025-09", "CH", 90], ["2025-09", "DE", 30], ["2026-09", "CH", 120], ["2026-09", "DE", 40], ["2026-09", "IT", 20]],
  unlinked: null, liveLogins: null,
  landing: {
    months: 9,
    cy: [["/de-CH", "Paid Search", 900, 700], ["/it-IT/o-rings", "Organic Search", 400, 350], ["(not set)", "Direct", 300, 250], ["/en-INT/x", "Direct", 50, 40], ["/blog", "Referral", 20, 18]],
    py: [["/de-CH", "Paid Search", 800, 650], ["/it-IT/o-rings", "Organic Search", 300, 280]],
  },
  prio: [{ band: "Prio 1", all: 100, cy: 60, py: 70 }, { band: "Prio 2", all: 400, cy: 120, py: 150 }, { band: "Prio 3", all: 900, cy: 90, py: 100 }],
  errors: {},
};

test("stores from the landing page's address, named in full", () => {
  assert.equal(storeOf("/de-CH"), "de-CH");
  assert.equal(storeOf("/it-it/o-rings"), "it-IT");
  assert.equal(storeOf("/en-INT/x"), "en-INT");
  assert.equal(storeOf("/blog"), null);
  assert.equal(storeOf("(not set)"), null);
  assert.equal(storeName("de-CH"), "German · Switzerland");
  assert.equal(storeName("en-INT"), "English · International");
  assert.equal(storeName("blog"), null);
});

test("users, new users, sessions and users outside Switzerland per month - exact, or from the cube when a channel is chosen", () => {
  const s = visitSeries(d, 2026);
  assert.equal(s.V01.months[8], 1200);              // GA4's exact monthly users
  assert.equal(s.V02.months[8], 500 / 1200);
  assert.equal(s.V03.months[8], 1800);
  assert.equal(s.V04.months[8], 430 + 410 + 8);     // every country but Switzerland, unknown included - exact per country
  assert.equal(s.V01.py[8], 1000);
  const de = visitSeries(d, 2026, { country: ["de"] });
  assert.equal(de.V01.months[8], 430);              // GA4's exact users for the country
  assert.equal(de.V03.months[8], 700);
  const paid = visitSeries(d, 2026, { channel: ["Paid Search"] });
  assert.equal(paid.V03.months[8], 500);            // the channel needs the cube
  assert.equal(paid.V03.py[8], 400);
  assert.equal(paid.V04.months[8], 420);
});

test("the visitors who log in and their share - by country, never by channel", () => {
  const s = visitSeries(d, 2026);
  assert.equal(s.V06G.months[8], 180);
  assert.equal(s.V06U.months[8], 1200);
  assert.equal(s.V06S.months[8], 0.15);
  assert.equal(s.V06S.py[8], 120 / 1000);
  const de = visitSeries(d, 2026, { country: ["DE"] });
  assert.equal(de.V06S.months[8], 40 / 430);
  // the login event has no channel: a channel choice leaves the share as it is
  assert.equal(visitSeries(d, 2026, { channel: ["Paid Search"] }).V06S.months[8], 0.15);
  assert.equal(visitSeries({ ...d, logins: [] }, 2026).V06S.months[8], null);
  const k = knownByCountry(d, 2026, [8]);
  assert.deepEqual(k.map((r) => [r.code, r.users, r.known, r.pyKnown]), [["CH", 340, 120, 90], ["DE", 430, 40, 30], ["IT", 410, 20, 0], ["ZZ", 8, 0, 0]]);
});

test("users outside Switzerland by country - exact, from the cube with a channel", () => {
  const a = usersAbroad(d, 2026, [8]);
  assert.deepEqual(a.map((r) => [r.label, r.users, r.pyUsers]), [["Germany", 430, 380], ["Italy", 410, 340], ["Unknown region", 8, 0]]);
  assert.deepEqual(usersAbroad(d, 2026, [8], { channel: ["Paid Search"] }).map((r) => [r.code, r.users, r.pyUsers]), [["IT", 420, 350]]);
  // users per country: Switzerland too
  assert.deepEqual(usersAbroad(d, 2026, [8], {}, true).map((r) => r.code), ["DE", "IT", "CH", "ZZ"]);
});

test("traffic origin and countries over the months chosen, against the same months a year earlier", () => {
  const ch = cubeTable(d, 2026, [8], "channel");
  assert.deepEqual(ch.map((r) => r.key), ["Organic Search", "Direct", "Paid Search"]);
  assert.equal(ch.find((r) => r.key === "Direct")!.sessions, 610);
  assert.equal(ch.find((r) => r.key === "Direct")!.pySessions, 500);
  // a country chosen narrows the channel table, not the other way round
  assert.equal(cubeTable(d, 2026, [8], "channel", { country: ["IT"] }).length, 1);
  // countries: exact users per country; with a channel chosen, from the cube
  assert.deepEqual(cubeTable(d, 2026, [8], "country").map((r) => [r.key, r.users, r.sessions]), [["DE", 430, 700], ["CH", 340, 600], ["IT", 410, 500], ["ZZ", 8, 10]]);
  const co = cubeTable(d, 2026, [8], "country", { channel: ["Direct"] });
  assert.deepEqual(co.map((r) => r.label), ["Switzerland", "Unknown region"]);
});

test("stores, landing pages and the year-so-far KPIs", () => {
  const st = storeTable(d);
  // the stores first; the pages outside a store and the visits without a page (a tab left open) last
  assert.deepEqual(st.map((r) => r.code), ["de-CH", "it-IT", "en-INT", "(other)", "(not set)"]);
  assert.equal(st[0].pySessions, 800);
  assert.equal(st[4].label, "Shop tab left open - no page loaded");
  assert.equal(storeTable(d, { channel: ["Direct"] }).length, 2);
  // a visit without a page is not a landing page
  const lp = landingTable(d, {}, 3);
  assert.deepEqual(lp.map((r) => r.page), ["/de-CH", "/it-IT/o-rings", "/en-INT/x"]);
  assert.deepEqual(noPageVisits(d), { cy: 300, py: 0 });
  const sc = storeChannels(d);
  assert.deepEqual(sc.map((r) => [r.code, r.total, r.pyTotal]), [["de-CH", 900, 800], ["it-IT", 400, 300], ["en-INT", 50, 0]]);
  assert.deepEqual(sc[0].channels, { "Paid Search": 900 });
  assert.deepEqual(storeChannels(d, { channel: ["Direct"] }).map((r) => r.code), ["en-INT"]);
  const y = visitYtd(d);
  assert.equal(y.V05.cy, 900 + 400 + 50);          // store addresses only
  assert.equal(y.V05.py, 1100);
  assert.equal(y.V07.cy, 180);                      // Prio 1 + 2
  assert.equal(y.V07.pyNote, "2025 whole year");
  assert.equal(y.V08.cy, 900 + 400 + 50 + 20);       // without the 300 visits that had no page
  assert.equal(y.V08.pyNote, "same months Jan–Sep");
});

test("visits per month by channel group: organic, paid, direct, AI and the rest", () => {
  assert.equal(groupOf("Organic Search"), "Organic");
  assert.equal(groupOf("Cross-network"), "Paid");
  assert.equal(groupOf("AI Assistant"), "AI assistants");
  assert.equal(groupOf("Referral"), "Other");
  const g = groupsByMonth(d, 2026, [8]);
  assert.deepEqual(g[0].groups, { Direct: 610, Organic: 700, Paid: 500 });
  assert.equal(g[0].total, 1810);
  assert.equal(g[0].pyTotal, 1500);
  assert.deepEqual(groupsByMonth(d, 2026, [8], { country: ["CH"] })[0].groups, { Direct: 600 });
});
