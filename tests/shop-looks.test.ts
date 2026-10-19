import assert from "node:assert/strict";
import { test } from "node:test";
import { largestEarlierQuantity, parseActivity } from "../src/lib/shopLooks/parse";

test("parseActivity: one row per day and article, flags only grow, the latest quantity wins", () => {
  const raw = JSON.stringify({
    updated: "2026-10-05T10:00:00Z",
    days: { "2026-10-05": { v: 9, l: 2, c: 1 }, "2026-10-04": { v: 3, l: 1 }, "bad": { v: 1 } },
    recent: [
      { t: "2026-10-05T07:15", a: "1221470103", q: 16, u: "91805" },
      { t: "2026-10-05T07:38", a: "1221470103", q: 20, c: 1 },
      { t: "2026-10-05T07:28", p: "13010404" },
      { t: "2026-10-04T14:57", a: "1221470103", q: 5, o: 1 },
      { t: "2026-10-05T08:00" },
      { t: "nonsense", a: "1" },
    ],
  });
  const { looks, days } = parseActivity(raw);
  assert.equal(looks.length, 3, "same article on two days is two rows; a line with nothing to be about is none");
  const today = looks.find((l) => l.day === "2026-10-05" && l.article === "1221470103")!;
  assert.equal(today.qty, 20);
  assert.equal(today.carted, true);
  assert.equal(today.at, "2026-10-05T07:38");
  assert.equal(today.contact, "91805");
  assert.equal(looks.find((l) => l.product === "13010404")?.article, "");
  assert.equal(looks.find((l) => l.day === "2026-10-04")?.ordered, true);
  assert.deepEqual(days.sort((a, b) => a.day.localeCompare(b.day)), [
    { day: "2026-10-04", views: 3, logins: 1, carts: 0, orders: 0 },
    { day: "2026-10-05", views: 9, logins: 2, carts: 1, orders: 0 },
  ]);
  assert.deepEqual(parseActivity("not json"), { looks: [], days: [] });
  assert.deepEqual(parseActivity(null), { looks: [], days: [] });
});

test("largestEarlierQuantity: the typed quantity a later 1 overwrote, from the property's history", () => {
  // PMD Pumpen, 14.10.2026, newest version first as HubSpot returns them: 50, 49, then the 1 that stayed
  const v = (recent: object[]) => JSON.stringify({ recent });
  const history = [
    v([{ t: "2026-10-14T10:17", a: "1140073025", q: 1 }, { t: "2026-10-14T10:20", a: "1140074035", q: 1 }]),
    v([{ t: "2026-10-14T10:17", a: "1140073025", q: 1 }, { t: "2026-10-14T10:20", a: "1140074035", q: 49 }]),
    v([{ t: "2026-10-14T10:17", a: "1140073025", q: 1 }, { t: "2026-10-14T10:20", a: "1140074035", q: 50 }]),
    v([{ t: "2026-10-13T09:00", a: "1140074035", q: 500 }]),   // another day: not this look
    "not json",
  ];
  const wanted = new Set(["2026-10-14|1140073025", "2026-10-14|1140074035"]);
  const found = largestEarlierQuantity(history, wanted);
  assert.equal(found.get("2026-10-14|1140074035"), 50, "the largest typed quantity of the day");
  assert.equal(found.has("2026-10-14|1140073025"), false, "never anything but 1: nothing to recover");
  assert.equal(found.size, 1);
  assert.equal(largestEarlierQuantity(history, new Set()).size, 0, "only the lines asked about");
  // half a metre is a typed quantity too
  assert.equal(largestEarlierQuantity([v([{ t: "2026-10-14T08:00", a: "1220350194", q: 0.5 }])],
    new Set(["2026-10-14|1220350194"])).get("2026-10-14|1220350194"), 0.5);
});
