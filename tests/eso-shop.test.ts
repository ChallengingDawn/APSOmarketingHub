import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayNo, dayOf, dayRange, labelOf, liveSeries, looksBy, ordersBy, ordersCover, passOf, periodFor, periodOf, presetsOf, quarterPicks, rangeId, rangeOf, rangeWords, sameWin, shortDays, statsBy, totalsOf, yearSeries,
  type ShopData,
} from "../src/lib/reporting/shopRules";

// two owners (ESO, TSA) and a company without one; four companies: 0 logs in, looks and orders; 1 logs in and looks at
// nothing; 2 only looks (a tab left open - no login); 3 has the Performis years only
const d: ShopData = {
  generatedAt: "2026-10-29T08:00:00Z", today: "2026-10-29", liveFrom: "2026-10-02", dtYears: [2024, 2025, 2026], dtLoaded: "2026-04-15",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }, { id: "", name: "No owner", team: "Other" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], country: ["Switzerland", "Germany"], pc: ["DT", "KT", "Not assigned"] },
  // person, prio, category, country
  companies: [[0, 0, 0, 0], [0, 1, 0, 1], [1, 2, 1, 0], [2, 3, 3, 1]],
  // company, day, logins, views, orders, carts
  days: [
    [0, 3, 2, 5, 1, 1], [0, 4, 1, 3, 0, 0], [0, 20, 1, 1, 0, 0],
    [1, 3, 1, 0, 0, 0], [1, 26, 1, 0, 0, 0],
    [2, 4, 0, 7, 0, 0],
    [0, 27, 1, 2, 0, 0], // today, so far
  ],
  // company, year, logins, views, orders
  years: [[0, 1, 40, 90, 3], [3, 1, 10, 0, 0], [3, 0, 12, 4, 1], [0, 2, 9, 30, 0]],
  // company, day, profit centre, looked at, into the cart, ordered
  looks: [[0, 3, 0, 4, 1, 1], [0, 20, 1, 2, 0, 0], [1, 26, 2, 1, 0, 0], [2, 4, 0, 3, 0, 0]],
  // company, day placed, profit centres as bits (1 DT, 2 KT): company 0 since December 2025, three orders; 1 its first; 3 in September
  orders: [[0, -300, 1], [0, 5, 3], [0, 21, 2], [1, 22, 1], [3, -10, 1]],
  ordersFrom: "2025-01-01",
  coverage: { companies: 4, live: 3, performis: 2, internal: 0 },
};

test("shop: days count from the first live day", () => {
  assert.equal(dayNo("2026-10-02", "2026-10-29"), 27);
  assert.equal(dayOf("2026-10-02", 27), "2026-10-29");
  assert.equal(dayNo("2026-10-02", "2026-10-01"), -1);
});

test("shop: the periods - live first, the last 4 weeks the default, each compared only where the counters reach back", () => {
  const p = Object.fromEntries(presetsOf(d).map((x) => [x.id, x]));
  // "since 2 Oct" is the month to date while the counters are in their first month - offered once it differs
  assert.deepEqual(presetsOf(d).map((x) => x.id), ["28d", "7d", "mtd", "y2026", "y2025", "y2024"]);
  // the last 4 weeks reach before the counters: from their first day, nothing to compare with
  assert.deepEqual(p["28d"].win, { kind: "live", from: 0, to: 26 });
  assert.equal(p["28d"].prev, null);
  // the last 7 whole days, to yesterday, against the 7 before
  assert.deepEqual(p["7d"].win, { kind: "live", from: 20, to: 26 });
  assert.deepEqual(p["7d"].prev, { kind: "live", from: 13, to: 19 });
  // the month to date counts today; September has no counters
  assert.deepEqual(p.mtd.win, { kind: "live", from: 0, to: 27 });
  assert.equal(p.mtd.prev, null);
  // the export's 2026 stops at its load: on its own; a whole year against the one before; the first has none
  assert.equal(p.y2026.partial, true);
  assert.equal(p.y2026.label, "2026 to 15 Apr");
  assert.equal(p.y2026.prev, null);
  assert.deepEqual(p.y2025.prev, { kind: "year", y: 0 });
  assert.equal(p.y2024.prev, null);
});

test("shop: a finished month joins the periods; the month to date against the same days of the month before", () => {
  const later = { ...d, today: "2026-12-05" };
  const p = Object.fromEntries(presetsOf(later).map((x) => [x.id, x]));
  assert.deepEqual(presetsOf(later).filter((x) => x.win.kind === "live").map((x) => x.id), ["28d", "7d", "mtd", "m2026-11", "m2026-10", "live"]);
  // October from the counters' first day; November against October only once October is whole - it is not
  assert.deepEqual(p["m2026-10"].win, { kind: "live", from: 0, to: 29 });
  assert.equal(p["m2026-11"].prev, null);
  // 1-5 December against 1-5 November
  assert.deepEqual(p.mtd.win, { kind: "live", from: dayNo(d.liveFrom, "2026-12-01"), to: dayNo(d.liveFrom, "2026-12-05") });
  assert.deepEqual(p.mtd.prev, { kind: "live", from: dayNo(d.liveFrom, "2026-11-01"), to: dayNo(d.liveFrom, "2026-11-05") });
  // the 28 days before the last 4 weeks are counted by now
  assert.deepEqual(p["28d"].prev, { kind: "live", from: dayNo(d.liveFrom, "2026-10-10"), to: dayNo(d.liveFrom, "2026-11-06") });
});

test("shop: one's own days - the id, cut to the counters, against the same number of days right before", () => {
  // 20-26 Oct: days 18-24, against 13-19 Oct (days 11-17)
  const r = rangeOf(d, "d2026-10-20_2026-10-26")!;
  assert.equal(r.id, "d2026-10-20_2026-10-26");
  assert.deepEqual(r.win, { kind: "live", from: 18, to: 24 });
  assert.deepEqual(r.prev, { kind: "live", from: 11, to: 17 });
  assert.equal(r.label, "20 – 26 Oct 2026");
  assert.equal(r.title, r.label);
  assert.equal(r.custom, true);
  // the last day first: the same range, its id the right way round
  assert.equal(rangeOf(d, "d2026-10-26_2026-10-20")!.id, r.id);
  assert.equal(rangeId("2026-10-20", "2026-10-26"), r.id);
  // 16 days from 5 Oct: the 16 before reach back before the counters - nothing to compare with
  const early = rangeOf(d, "d2026-10-05_2026-10-20")!;
  assert.deepEqual(early.win, { kind: "live", from: 3, to: 18 });
  assert.equal(early.prev, null);
  // one day, against the day before
  const one = rangeOf(d, "d2026-10-28_2026-10-28")!;
  assert.deepEqual([one.win, one.prev, one.label], [{ kind: "live", from: 26, to: 26 }, { kind: "live", from: 25, to: 25 }, "28 Oct 2026"]);
  // cut to the counters: from their first day to today
  const wide = rangeOf(d, "d2026-09-20_2026-11-15")!;
  assert.equal(wide.id, "d2026-10-02_2026-10-29");
  assert.deepEqual(wide.win, { kind: "live", from: 0, to: 27 });
  assert.equal(wide.prev, null);
  // no counter on those days, a day that is none, an id that is no range
  assert.equal(rangeOf(d, "d2026-09-01_2026-09-30"), null);
  assert.equal(rangeOf(d, "d2026-02-31_2026-10-05"), null);
  assert.equal(rangeOf(d, "d2026-10-05"), null);
  assert.equal(rangeOf(d, "7d"), null);
  // the shop orders read by the day follow it
  assert.equal(ordersCover(d, r.win), true);
  assert.deepEqual(ordersBy(d, r.win, passOf(d, {}, null)).get(""), { orders: 2, buyers: 2, oneShot: 1, second: 0, multiple: 1 });
  assert.equal(rangeWords("2026-12-30", "2027-01-03"), "30 Dec 2026 – 3 Jan 2027");
  assert.equal(rangeWords("2026-10-28", "2026-11-04"), "28 Oct – 4 Nov 2026");
});

test("shop: the quarters - one the counters cannot show greyed with its reason, the running one to date", () => {
  const q = quarterPicks(d);
  assert.deepEqual(q.map((x) => x.id), ["q2026-1", "q2026-2", "q2026-3", "q2026-4"]);
  // Q1-Q3 2026 ended before the counters started: greyed, not left out
  assert.deepEqual(q.slice(0, 3).map((x) => [x.label, x.per, x.off]), [["Q1 2026", null, "early"], ["Q2 2026", null, "early"], ["Q3 2026", null, "early"]]);
  // Q4 from the counters' first day, today counted; 1 Oct has no counter, so nothing to compare with
  const q4 = q[3].per!;
  assert.deepEqual([q4.label, q4.win, q4.prev], ["Q4 2026 to date", { kind: "live", from: 0, to: 27 }, null]);
  // in October the quarter to date is the month to date
  assert.ok(sameWin(q4.win, presetsOf(d).find((p) => p.id === "mtd")!.win));
  assert.equal(sameWin(q4.win, { kind: "year", y: 2 }), false);
  // next July: Q4 2026 whole from 2 Oct; Q1 2027 against nothing (Q4 2026 lacks 1 Oct); Q2 against Q1 whole; Q3 to date
  // against the same days of Q2; Q4 2027 not started
  const later = { ...d, today: "2027-07-05" };
  const p = Object.fromEntries(quarterPicks(later).map((x) => [x.id, x]));
  const n = (iso: string) => dayNo(d.liveFrom, iso);
  assert.equal(quarterPicks(later).length, 8);
  assert.deepEqual([p["q2026-4"].label, p["q2026-4"].per!.win], ["Q4 2026", { kind: "live", from: 0, to: n("2026-12-31") }]);
  assert.equal(p["q2027-1"].per!.prev, null);
  assert.deepEqual(p["q2027-2"].per!.win, { kind: "live", from: n("2027-04-01"), to: n("2027-06-30") });
  assert.deepEqual(p["q2027-2"].per!.prev, { kind: "live", from: n("2027-01-01"), to: n("2027-03-31") });
  assert.equal(p["q2027-3"].label, "Q3 2027 to date");
  assert.deepEqual(p["q2027-3"].per!.win, { kind: "live", from: n("2027-07-01"), to: n("2027-07-05") });
  assert.deepEqual(p["q2027-3"].per!.prev, { kind: "live", from: n("2027-04-01"), to: n("2027-04-05") });
  assert.deepEqual([p["q2027-4"].per, p["q2027-4"].off], [null, "ahead"]);
});

test("shop: a period by its id - preset, quarter or one's own days; days picked that are a named period become it", () => {
  assert.equal(periodOf(d, "7d")!.label, "Last 7 days");
  assert.equal(periodOf(d, "q2026-4")!.label, "Q4 2026 to date");
  assert.deepEqual(periodOf(d, "d2026-10-20_2026-10-26")!.win, { kind: "live", from: 18, to: 24 });
  assert.equal(periodOf(d, "y2025")!.title, "2025");
  // a month not ended, a quarter greyed, nothing: not a period (the page falls back to its default)
  assert.equal(periodOf(d, "m2026-10"), null);
  assert.equal(periodOf(d, "q2026-2"), null);
  assert.equal(periodOf(d, null), null);
  // the last 7 whole days, the counters' first 4 weeks, the month to date (before the quarter to date - the same days)
  assert.equal(periodFor(d, "2026-10-28", "2026-10-22"), "7d");
  assert.equal(periodFor(d, "2026-10-02", "2026-10-28"), "28d");
  assert.equal(periodFor(d, "2026-10-02", "2026-10-29"), "mtd");
  assert.equal(periodFor(d, "2026-10-05", "2026-10-20"), "d2026-10-05_2026-10-20");
  assert.equal(periodFor(d, "2026-09-01", "2026-09-30"), null);
});

test("shop: a company counts when it logged in - with its views and shop orders", () => {
  const all = statsBy(d, totalsOf(d, { kind: "live", from: 0, to: 27 }), passOf(d, {}, null)).get("")!;
  // company 2 only looked, no login recorded: left out of every figure
  assert.deepEqual(all, { companies: 2, logins: 7, views: 11, ordered: 1, idle: 1 });
  // the last 7 days: company 0 on day 20, company 1 on day 26 (looked at nothing)
  const week = statsBy(d, totalsOf(d, { kind: "live", from: 20, to: 26 }), passOf(d, {}, null)).get("")!;
  assert.deepEqual(week, { companies: 2, logins: 2, views: 1, ordered: 0, idle: 1 });
  // a Performis year
  const y25 = statsBy(d, totalsOf(d, { kind: "year", y: 1 }), passOf(d, {}, null)).get("")!;
  assert.deepEqual(y25, { companies: 2, logins: 50, views: 90, ordered: 1, idle: 1 });
});

test("shop: the owners shown and the filters, a breakdown's own filter left out when grouping by it", () => {
  const t = totalsOf(d, { kind: "live", from: 0, to: 27 });
  const eso = new Set([0]);
  assert.equal(statsBy(d, t, passOf(d, {}, eso)).get("")!.companies, 2);
  assert.equal(statsBy(d, t, passOf(d, {}, new Set([1]))).get(""), undefined);
  const byCountry = statsBy(d, t, passOf(d, { country: ["Germany"] }, null, "country"), (co) => labelOf(d, co, "country"));
  assert.deepEqual([...byCountry.keys()].sort(), ["Germany", "Switzerland"]);
  const filtered = statsBy(d, t, passOf(d, { country: ["Germany"] }, null), (co) => labelOf(d, co, "person"));
  assert.deepEqual([...filtered.entries()], [["Ana", { companies: 1, logins: 2, views: 0, ordered: 0, idle: 1 }]]);
  assert.equal(labelOf(d, 3, "person"), "No owner");
});

test("shop: day by day, a company once a day; past two months, month by month; the Performis years", () => {
  const s = liveSeries(d, { kind: "live", from: 3, to: 5 }, passOf(d, {}, null));
  assert.deepEqual(s.keys, ["2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.deepEqual(s.companies, [2, 1, 0]);
  assert.deepEqual(s.logins, [3, 1, 0]);
  assert.deepEqual(s.views, [5, 3, 0]);
  assert.deepEqual(s.ordered, [1, 0, 0]);
  const long = liveSeries({ ...d, today: "2027-01-10" }, { kind: "live", from: 0, to: 99 }, passOf(d, {}, null));
  assert.deepEqual(long.keys, ["2026-10", "2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(long.companies, [2, 0, 0, 0]);
  const y = yearSeries(d, passOf(d, {}, null));
  assert.deepEqual(y.keys, ["2024", "2025", "2026"]);
  assert.deepEqual(y.companies, [1, 2, 1]);
  assert.deepEqual(y.ordered, [1, 1, 0]);
});

test("shop: a weekday far below the others is marked - weekends never", () => {
  const keys = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"];
  const s = { keys, companies: [612, 712, 662, 165, 528, 26, 24, 617], logins: [], views: [], ordered: [] };
  assert.deepEqual([...shortDays(s)], ["2026-10-22"]);
  // four weekdays are not enough to tell
  assert.deepEqual([...shortDays({ ...s, keys: keys.slice(2, 8), companies: s.companies.slice(2, 8) })], []);
  // months are never marked
  assert.deepEqual([...shortDays({ keys: ["2026-10", "2026-11"], companies: [10, 1], logins: [], views: [], ordered: [] })], []);
});

test("shop: no view and no cart - a company that only filled its cart is not idle", () => {
  const carted = { ...d, days: [...d.days, [1, 10, 0, 0, 0, 2]] };
  assert.equal(statsBy(carted, totalsOf(carted, { kind: "live", from: 0, to: 27 }), passOf(carted, {}, null)).get("")!.idle, 0);
  assert.equal(statsBy(d, totalsOf(d, { kind: "live", from: 0, to: 27 }), passOf(d, {}, null)).get("")!.idle, 1);
});

test("shop: the articles looked at by profit centre - live periods only, a company once per profit centre", () => {
  const all = looksBy(d, { kind: "live", from: 0, to: 27 }, passOf(d, {}, null));
  assert.deepEqual(all.get("DT"), { looks: 7, carted: 1, ordered: 1, companies: 2 });
  assert.deepEqual(all.get("KT"), { looks: 2, carted: 0, ordered: 0, companies: 1 });
  assert.deepEqual(all.get("Not assigned"), { looks: 1, carted: 0, ordered: 0, companies: 1 });
  assert.equal(looksBy(d, { kind: "year", y: 1 }, passOf(d, {}, null)).size, 0);
  // under a team: Ben's company only
  assert.deepEqual([...looksBy(d, { kind: "live", from: 0, to: 27 }, passOf(d, {}, new Set([1]))).keys()], ["DT"]);
});

test("shop: shop orders - all, and the buyers by their orders so far: one-shot, second, multiple; per profit centre", () => {
  const week = { kind: "live" as const, from: 20, to: 26 };
  const pass = passOf(d, {}, null);
  // company 0's third order (multiple), company 1's first (one-shot)
  assert.deepEqual(ordersBy(d, week, pass).get(""), { orders: 2, buyers: 2, oneShot: 1, second: 0, multiple: 1 });
  // DT: only company 1's order is of it this week; KT: company 0's second order with a KT line
  assert.deepEqual(ordersBy(d, week, pass, undefined, 0).get(""), { orders: 1, buyers: 1, oneShot: 1, second: 0, multiple: 0 });
  assert.deepEqual(ordersBy(d, week, pass, undefined, 1).get(""), { orders: 1, buyers: 1, oneShot: 0, second: 1, multiple: 0 });
  // by owner
  assert.deepEqual([...ordersBy(d, week, pass, (co) => labelOf(d, co, "person")).entries()], [["Ana", { orders: 2, buyers: 2, oneShot: 1, second: 0, multiple: 1 }]]);
  // a Performis year as its calendar days: 2025 holds company 0's December order; 2024 is before the orders read
  assert.deepEqual(dayRange(d, { kind: "year", y: 2 }), [dayNo(d.liveFrom, "2026-01-01"), dayNo(d.liveFrom, "2026-04-15")]);
  assert.equal(ordersCover(d, { kind: "year", y: 1 }), true);
  assert.equal(ordersCover(d, { kind: "year", y: 0 }), false);
  assert.deepEqual(ordersBy(d, { kind: "year", y: 1 }, pass).get(""), { orders: 1, buyers: 1, oneShot: 1, second: 0, multiple: 0 });
  // nothing read yet
  assert.equal(ordersCover({ ...d, ordersFrom: null }, week), false);
});
