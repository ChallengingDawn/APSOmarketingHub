import assert from "node:assert/strict";
import { test } from "node:test";
import { cubeTable, landingTable, storeName, storeOf, storeTable, visitSeries, visitYtd, type VisitData } from "../src/lib/marketingKpis/visitCube";

const d: VisitData = {
  generatedAt: "2026-10-18T00:00:00Z", year: 2026, monthsDone: 9,
  users: { "2025-09": [1000, 400, 1500], "2026-09": [1200, 500, 1800] },
  channels: ["Direct", "Organic Search", "Paid Search"],
  cube: [
    ["2025-09", "CH", 0, 500, 300, 100], ["2025-09", "DE", 1, 600, 400, 200], ["2025-09", "IT", 2, 400, 350, 100],
    ["2026-09", "CH", 0, 600, 350, 120], ["2026-09", "DE", 1, 700, 450, 260], ["2026-09", "IT", 2, 500, 420, 130], ["2026-09", "", 0, 10, 8, 2],
  ],
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

test("users, new users, sessions and users outside Switzerland per month - exact, or from the cube when filtered", () => {
  const s = visitSeries(d, 2026);
  assert.equal(s.V01.months[8], 1200);              // GA4's exact monthly users
  assert.equal(s.V02.months[8], 500 / 1200);
  assert.equal(s.V03.months[8], 1800);
  assert.equal(s.V04.months[8], 450 + 420 + 8);     // every country but Switzerland, unknown included
  assert.equal(s.V01.py[8], 1000);
  const de = visitSeries(d, 2026, { country: ["de"] });
  assert.equal(de.V01.months[8], 450);              // from the cube
  assert.equal(de.V03.months[8], 700);
  const paid = visitSeries(d, 2026, { channel: ["Paid Search"] });
  assert.equal(paid.V03.months[8], 500);
  assert.equal(paid.V03.py[8], 400);
});

test("traffic origin and countries over the months chosen, against the same months a year earlier", () => {
  const ch = cubeTable(d, 2026, [8], "channel");
  assert.deepEqual(ch.map((r) => r.key), ["Organic Search", "Direct", "Paid Search"]);
  assert.equal(ch.find((r) => r.key === "Direct")!.sessions, 610);
  assert.equal(ch.find((r) => r.key === "Direct")!.pySessions, 500);
  // a country chosen narrows the channel table, not the other way round
  assert.equal(cubeTable(d, 2026, [8], "channel", { country: ["IT"] }).length, 1);
  const co = cubeTable(d, 2026, [8], "country", { channel: ["Direct"] });
  assert.deepEqual(co.map((r) => r.label), ["Switzerland", "Unknown region"]);
});

test("stores, landing pages and the year-so-far KPIs", () => {
  const st = storeTable(d);
  assert.deepEqual(st.map((r) => r.code), ["de-CH", "it-IT", "(not set)", "en-INT", "(other)"]);
  assert.equal(st[0].pySessions, 800);
  assert.equal(storeTable(d, { channel: ["Direct"] }).length, 2);
  const lp = landingTable(d, {}, 2);
  assert.deepEqual(lp.map((r) => r.page), ["/de-CH", "/it-IT/o-rings"]);
  const y = visitYtd(d);
  assert.equal(y.V05.cy, 900 + 400 + 50);          // store addresses only
  assert.equal(y.V05.py, 1100);
  assert.equal(y.V07.cy, 180);                      // Prio 1 + 2
  assert.equal(y.V07.pyNote, "2025 whole year");
  assert.equal(y.V08.cy, 1670);
  assert.equal(y.V08.pyNote, "same months Jan–Sep");
});
