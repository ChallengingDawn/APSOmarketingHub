import assert from "node:assert/strict";
import { test } from "node:test";
import { ESO_OWNERS, PIPE_STAGE, TSA_OWNERS } from "../src/lib/datatracker/rosters";
import {
  MIN_PREV_CH, MIN_PREV_OTHER, PRIORITY_FROM, calendarOf, priorityOf, companyOf, draftOf, dropped, due, erodedAt, erosionOf, floorOf, swissOf, filledOf, firstEnd, historyEnds, inScope, loadedTo, measureOf, memoryKey, monthsOfYears,
  propsFor, runs, stepOf, verdictOf, windowOf, type DropCompany, type Measure,
} from "../src/lib/lifecycle/revenueDrop";
import { RD_FIELDS, RD_GROUP, RD_TAG, createBody, planFields } from "../src/lib/lifecycle/revenueDropFields";

const YEARS = [2024, 2025, 2026];
const MONTHS = monthsOfYears(YEARS);
const ESO = Object.keys(ESO_OWNERS)[0];
const TSA = Object.keys(TSA_OWNERS)[0];
const at = (m: string) => MONTHS.indexOf(m);

/** A made-up company: `rev` and `oi` each month from `from` to `to`. */
function co(id: string, spans: { from: string; to: string; rev: number; oi?: number }[], extra: Partial<DropCompany> = {}): DropCompany {
  const rev = MONTHS.map(() => 0), oi = MONTHS.map(() => 0);
  for (const s of spans) for (let i = at(s.from); i <= at(s.to); i++) { rev[i] += s.rev; oi[i] += s.oi ?? 0; }
  return { id, name: `Example ${id} AG`, owner: ESO, segment: "APSOcore", prio: "Prio 1", un: `100-${id}`, swiss: true, internal: false, country: null, major: null, split: null, lastOrder: null, rev, oi, ...extra };
}
const m = (prev: number, last: number): Measure => ({ revLast: last, oiLast: 0, revPrev: prev, oiPrev: 0, last, prev, change: prev > 0 ? (last - prev) / prev : null });

/* ── the windows ──────────────────────────────────────────────────────── */

test("the last 12 months end at the window's month; the 12 before end the month before they start", () => {
  assert.deepEqual(windowOf("2026-06"), { end: "2026-06", last: ["2025-07", "2026-06"], prev: ["2024-07", "2025-06"] });
  assert.deepEqual(windowOf("2025-12"), { end: "2025-12", last: ["2025-01", "2025-12"], prev: ["2024-01", "2024-12"] });
  assert.equal(firstEnd(MONTHS), "2025-12");
});

test("the calendar replays a first run 11 months back and every month after - never the first run's anniversary", () => {
  const four = monthsOfYears([2023, 2024, 2025, 2026]);
  const h = historyEnds(four, "2026-06");
  assert.equal(h.length, 12);
  assert.deepEqual([h[0], h[11]], ["2025-07", "2026-06"]);
  assert.deepEqual(historyEnds(MONTHS, "2026-06"), ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  assert.deepEqual(historyEnds(MONTHS, "2025-06"), []);
});

test("a month is loaded once revenue AND order intake reach 60% of the companies a year earlier; the running month never is", () => {
  const filled = { rev: MONTHS.map(() => 100), oi: MONTHS.map(() => 100) };
  filled.oi[at("2026-07")] = 59; // order intake half loaded
  for (const mo of ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]) filled.oi[at(mo)] = 0;
  assert.equal(loadedTo(MONTHS, filled, "2026-10-30"), "2026-06");
  filled.oi[at("2026-07")] = 60;
  assert.equal(loadedTo(MONTHS, filled, "2026-10-30"), "2026-07");
  const all = { rev: MONTHS.map(() => 100), oi: MONTHS.map(() => 100) };
  assert.equal(loadedTo(MONTHS, all, "2026-10-01"), "2026-09");
  assert.equal(loadedTo(MONTHS, { rev: MONTHS.map(() => 0), oi: MONTHS.map(() => 0) }, "2026-10-30"), null);
});

/* ── the company ──────────────────────────────────────────────────────── */

test("revenue and order intake are read per month from the profit-centre blobs, every profit centre added", () => {
  const c = companyOf("7", {
    name: " Example Seals GmbH ", hubspot_owner_id: TSA, apso_customer: "APSOgrowth", sales_priority: "2-Prio 2 - Pot btw 2500 & 24999€",
    rev_2025_pc_monthly: JSON.stringify({ jan: { dt: 100.5, ft: 50 }, Dec: { other: 10 } }),
    oi_2026_pc_monthly: JSON.stringify({ jun: { kt: 40 } }),
    rev_2024_pc_monthly: "not json",
  }, YEARS);
  assert.equal(c.name, "Example Seals GmbH");
  assert.equal(c.prio, "Prio 2");
  assert.equal(c.rev.length, 36);
  assert.equal(c.rev[at("2025-01")], 150.5);
  assert.equal(c.rev[at("2025-12")], 10);
  assert.equal(c.oi[at("2026-06")], 40);
  assert.equal(c.rev[at("2024-03")], 0);
  assert.equal(companyOf("8", {}, YEARS).name, "Company 8");
  assert.equal(companyOf("8", {}, YEARS).owner, null);
});

test("order intake per month is the oi_<y>_<month> total, the profit-centre blob only where that total is empty", () => {
  const c = companyOf("9", {
    oi_2025_pc_monthly: JSON.stringify({ jun: { dt: 70 }, jul: { kt: 5 } }),
    oi_2025_jun: "70", oi_2025_aug: "120.456", oi_2025_sep: "", oi_2025_oct: "n/a",
    oi_2024_pc_monthly: JSON.stringify({ nov: { ft: 30 } }),
  }, YEARS);
  assert.equal(c.oi[at("2025-06")], 70);
  assert.equal(c.oi[at("2025-07")], 5);
  assert.equal(c.oi[at("2025-08")], 120.46);
  assert.equal(c.oi[at("2025-09")], 0);
  assert.equal(c.oi[at("2025-10")], 0);
  assert.equal(c.oi[at("2024-11")], 30);
  assert.ok(propsFor(YEARS).includes("oi_2026_oct"));
});

test("the floor: €10,000 in Switzerland by Country/Region, €5,000 elsewhere; the customer key only without a country", () => {
  assert.equal(swissOf("Switzerland", "110-1"), true);
  assert.equal(swissOf(" CH ", null), true);
  assert.equal(swissOf("GB", "100-1"), false); // an export customer on the Swiss mandant
  assert.equal(swissOf("", "100-1"), true);
  assert.equal(swissOf(null, "110-1"), false);
  assert.equal(swissOf(null, null), false);
  assert.deepEqual([floorOf({ swiss: true }), floorOf({ swiss: false })], [MIN_PREV_CH, MIN_PREV_OTHER]);
  assert.equal(stepOf(m(5000, 0), MIN_PREV_OTHER), 1);
  assert.equal(stepOf(m(5000, 3500), MIN_PREV_OTHER), 2);
  assert.equal(stepOf(m(4999.99, 0), MIN_PREV_OTHER), null);
  assert.equal(stepOf(m(6000, 0), MIN_PREV_CH), null);
  const p = { apso_customer: "APSOcore", sales_priority: "1-Prio 1 - Pot >25000€" };
  const de = companyOf("1", { ...p, country: "DE", company_unique_number: "110-5" }, YEARS);
  assert.deepEqual([de.swiss, de.internal], [false, false]);
  // €6,000 a year before: a German company is in step 1, a Swiss one is not
  const w = windowOf("2025-12");
  const lost = (extra: Partial<DropCompany>) => verdictOf(co("x", [{ from: "2024-01", to: "2024-12", rev: 500 }], extra), MONTHS, w).step;
  assert.deepEqual([lost({ swiss: false }), lost({ swiss: true })], [1, null]);
});

test("APSOparts' and Angst + Pfister's own companies are never in scope, by name or by domain", () => {
  const p = { apso_customer: "APSOcore", sales_priority: "1-Prio 1 - Pot >25000€" };
  assert.equal(inScope(companyOf("1", { ...p, name: "Angst Pfister Example A.S." }, YEARS)), false);
  assert.equal(inScope(companyOf("2", { ...p, name: "APSOparts Example" }, YEARS)), false);
  assert.equal(inScope(companyOf("3", { ...p, name: "Example Person", domain: "angst-pfister.com" }, YEARS)), false);
  assert.equal(inScope(companyOf("4", { ...p, name: "Example Seals AG", domain: "seals.example" }, YEARS)), true);
});

test("in scope: APSOcore or APSOgrowth, and Prio 1 or Prio 2 - both", () => {
  assert.equal(inScope({ segment: "APSOcore", prio: "Prio 1" }), true);
  assert.equal(inScope({ segment: "APSOgrowth", prio: "Prio 2" }), true);
  assert.equal(inScope({ segment: "APSOcore", prio: "Prio 3" }), false);
  assert.equal(inScope({ segment: "APSOprospect", prio: "Prio 1" }), false);
  assert.equal(inScope({ segment: "APSOmicro", prio: "Not set" }), false);
});

/* ── the measure and the steps ────────────────────────────────────────── */

test("order intake adds to revenue, in both windows", () => {
  const c = co("1", [{ from: "2024-07", to: "2025-06", rev: 1000, oi: 500 }, { from: "2025-07", to: "2026-06", rev: 600, oi: 300 }]);
  const x = measureOf(c, MONTHS, windowOf("2026-06"));
  assert.deepEqual([x.revPrev, x.oiPrev, x.prev], [12000, 6000, 18000]);
  assert.deepEqual([x.revLast, x.oiLast, x.last], [7200, 3600, 10800]);
  assert.equal(Math.round(x.change! * 100), -40);
});

test("30% down is the line, 29.99% is not; growth and nothing-before never drop", () => {
  assert.equal(dropped(m(100, 70)), true);
  assert.equal(dropped(m(1000, 700.01)), false);
  assert.equal(dropped(m(100, 130)), false);
  assert.equal(dropped(m(0, 0)), false);
  assert.equal(dropped(m(-50, -100)), false);
});

test("step 1 is lost business, step 2 a revenue drop - both only from €10,000 before", () => {
  assert.equal(stepOf(m(10000, 0), MIN_PREV_CH), 1);
  assert.equal(stepOf(m(25000, -400), MIN_PREV_CH), 1); // credit notes after the last order
  assert.equal(stepOf(m(9999.99, 0), MIN_PREV_CH), null);
  assert.equal(stepOf(m(10000, 7000), MIN_PREV_CH), 2);
  assert.equal(stepOf(m(10000, 7000.01), MIN_PREV_CH), null);
  assert.equal(stepOf(m(50000, 0.01), MIN_PREV_CH), 2); // still buying, a little
  assert.equal(stepOf(m(9000, 1000), MIN_PREV_CH), null);
  assert.equal(stepOf(m(20000, 21000), MIN_PREV_CH), null);
});

test("out of scope is never in a step, whatever the figures", () => {
  const w = windowOf("2026-06");
  assert.equal(verdictOf(co("2", [{ from: "2024-07", to: "2025-06", rev: 5000 }]), MONTHS, w).step, 1);
  assert.equal(verdictOf(co("3", [{ from: "2024-07", to: "2025-06", rev: 5000 }], { prio: "Prio 3" }), MONTHS, w).step, null);
});

/* ── the runs ─────────────────────────────────────────────────────────── */

test("a company is ticketed at most once per step in 12 months", () => {
  assert.equal(due(undefined, "2026-06"), true);
  assert.equal(due("2026-01", "2026-06"), false);
  assert.equal(due("2025-06", "2026-06"), true);
  assert.equal(due("2025-07", "2026-06"), false);
  assert.notEqual(memoryKey("9", 1), memoryKey("9", 2));
});

test("the first run tickets every company in a step; later runs only those new in it - a drop that turns into lost business is ticketed again", () => {
  const cos = [
    co("a", [{ from: "2024-01", to: "2024-12", rev: 2000 }, { from: "2025-01", to: "2026-12", rev: 100 }]), // step 2 since the first window
    co("b", [{ from: "2024-01", to: "2025-12", rev: 1000 }]), // stops buying in 2026: step 2 in April, step 1 by December
    co("c", [{ from: "2024-01", to: "2026-12", rev: 1000 }]), // steady
    co("d", [{ from: "2024-01", to: "2024-12", rev: 1000 }], { segment: "APSOprospect" }), // out of scope
    co("e", [{ from: "2024-01", to: "2024-12", rev: 500 }]), // €6,000 before: under the floor
  ];
  const r = runs(cos, MONTHS, ["2025-12", "2026-01", "2026-04", "2026-06"]);
  assert.deepEqual(r.map((x) => x.tickets.map((v) => `${v.id}${v.step}`)), [["a2"], [], ["b2"], []]);
  assert.deepEqual(r.map((x) => x.found), [[0, 1], [0, 1], [0, 2], [0, 2]]);
  assert.deepEqual(r.map((x) => x.heldCooldown), [0, 1, 1, 2]);
  const later = runs(cos, MONTHS, ["2026-06", "2026-12"], { [memoryKey("b", 2)]: "2026-04", [memoryKey("a", 2)]: "2025-12" });
  assert.deepEqual(later[0].tickets, []); // both held: ticketed in step 2 within the year
  assert.deepEqual(later[1].tickets.map((v) => `${v.id}${v.step}`), ["b1"]); // b: now lost; a: its low year is under €10,000
});

test("the calendar: today's first run per person and step, and what each earlier month's run added after its first", () => {
  const cos = [
    co("a", [{ from: "2024-01", to: "2024-12", rev: 2000 }, { from: "2025-01", to: "2026-12", rev: 100 }]),
    co("b", [{ from: "2024-01", to: "2025-06", rev: 1000 }], { owner: TSA }),
    co("c", [{ from: "2024-01", to: "2026-12", rev: 1000 }], { owner: TSA }),
    co("f", [{ from: "2024-01", to: "2025-12", rev: 1000 }], { owner: "999" }),
  ];
  const ends = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const today = runs(cos, MONTHS, ["2026-06"])[0];
  const cal = calendarOf(cos, MONTHS, today, runs(cos, MONTHS, ends));
  const eso = cal.find((r) => r.owner === ESO)!, tsa = cal.find((r) => r.owner === TSA)!, none = cal.find((r) => r.owner === "999")!;
  assert.deepEqual([eso.inScope, eso.big, eso.today, eso.team], [1, 1, [0, 1], "ESO"]);
  assert.deepEqual([tsa.inScope, tsa.big, tsa.today, tsa.team], [2, 2, [1, 0], "TSA"]);
  assert.equal(tsa.months.length, 6);
  // b was a revenue drop at the first run (Dec 2025) and became lost business in June 2026
  assert.deepEqual(tsa.months.map((x) => x[0]).reduce((s, n) => s + n), 1);
  assert.equal(Math.round(tsa.perMonth[0] * 6), 1);
  assert.equal(none.team, null);
  assert.deepEqual(none.today, [0, 1]);
});

test("article erosion first: a company with an erosion ticket in the 12 months up to the run is left to it, and not remembered", () => {
  const cos = [
    co("a", [{ from: "2024-01", to: "2024-12", rev: 2000 }, { from: "2025-01", to: "2026-12", rev: 100 }]), // step 2 all along
    co("b", [{ from: "2024-01", to: "2025-06", rev: 1000 }], { owner: TSA }), // lost business by June 2026
    co("c", [{ from: "2024-01", to: "2024-12", rev: 2000 }, { from: "2025-01", to: "2026-12", rev: 100 }], { un: null }),
  ];
  const erosion = erosionOf(cos, [
    { un: " 100-a ", created: "2026-01" }, { un: "100-b", created: "2025-06" }, { un: "100-x", created: "2026-01" }, { un: "100-c", created: null },
  ]);
  assert.deepEqual(erosion, { a: ["2026-01"], b: ["2025-06"] });
  // the run on the window to Dec 2025 is made in Jan 2026: the 12 months Feb 2025 - Jan 2026
  assert.equal(erodedAt(["2026-01"], "2025-12"), true);
  assert.equal(erodedAt(["2025-02"], "2025-12"), true);
  assert.equal(erodedAt(["2025-01"], "2025-12"), false);
  assert.equal(erodedAt(["2026-02"], "2025-12"), false);
  assert.equal(erodedAt(undefined, "2025-12"), false);
  const r = runs(cos, MONTHS, ["2025-12", "2026-06", "2026-12"], {}, erosion);
  assert.deepEqual(r.map((x) => x.tickets.map((v) => `${v.id}${v.step}`)), [["c2"], ["b1"], []]);
  // b: a revenue drop in Dec 2025 with an erosion ticket in Jun 2025 - left to it; lost business by Jun 2026, ticket too old
  assert.deepEqual(r.map((x) => x.eroded.map((v) => `${v.id}${v.step}`)), [["a2", "b2"], ["a2"], []]);
  // never ticketed while eroding, so UC12 takes it the first run its erosion ticket is older than 12 months
  const d = co("d", [{ from: "2024-01", to: "2024-12", rev: 2000 }, { from: "2025-01", to: "2026-12", rev: 100 }]);
  const late = runs([d], MONTHS, ["2025-12", "2026-01"], {}, { d: ["2025-02"] });
  assert.deepEqual(late.map((x) => [x.eroded.length, x.tickets.length]), [[1, 0], [0, 1]]);
  const cal = calendarOf(cos, MONTHS, r[1], []);
  assert.deepEqual(cal.find((p) => p.owner === ESO)!.erosion, [0, 1]);
  assert.deepEqual(cal.find((p) => p.owner === ESO)!.today, [0, 0]);
});

/* ── the ticket ───────────────────────────────────────────────────────── */

test("the ticket reads like an erosion ticket: subject in four parts, the description in its order, the Revenue drop fields", () => {
  const w = windowOf("2026-06");
  const c = co("1", [{ from: "2024-07", to: "2025-06", rev: 1000, oi: 500 }, { from: "2025-07", to: "2026-06", rev: 600, oi: 300 }],
    { country: "DE", swiss: false, major: "DT", split: "Major DT, then KT", segment: "APSOgrowth" });
  const d = draftOf(c, verdictOf(c, MONTHS, w), w)!;
  assert.equal(d.owner, ESO);
  assert.deepEqual([d.pipeline, d.stage, d.step, d.priority], [PIPE_STAGE.ESO.pipeline, PIPE_STAGE.ESO.stage, 2, "MEDIUM"]);
  assert.equal(d.key, "100-1|2|2026-06");
  assert.equal(d.subject, "REVENUE DROP | -40% | 7'200 EUR | Example 1 AG");
  assert.match(d.content, /^REVENUE DROP - Win-back\n\nRevenue plus order intake is 40% below the 12 months before\./);
  assert.match(d.content, /Last 12 months:  10'800 EUR \(Jul 2025 - Jun 2026\) - revenue 7'200 \+ order intake 3'600/);
  assert.match(d.content, /12 months before:  18'000 EUR \(Jul 2024 - Jun 2025\)/);
  assert.match(d.content, /Down by:  7'200 EUR/);
  assert.match(d.content, /Major profit center:  DT \(Major DT, then KT\)/);
  assert.match(d.content, /Company:  Example 1 AG \(100-1\)/);
  assert.match(d.content, /Segment:  APSOgrowth · Prio 1 · DE \(floor 5'000 EUR\)/);
  assert.match(d.content, /Source: Revenue drop \(automated, ERP revenue and order intake\)$/);
  assert.deepEqual(
    [d.props.tags, d.props.source_type, d.props.hs_ticket_priority, d.props.revenue_drop_step, d.props.revenue_drop_amount_at_risk, d.props.revenue_drop_change_pct],
    ["revenue_drop", "AUTOMATION", "MEDIUM", "revenue_drop", 7200, -40]);
  assert.deepEqual([d.props.revenue_drop_last_12, d.props.revenue_drop_prev_12, d.props.revenue_drop_window], [10800, 18000, "Jul 2025 - Jun 2026"]);
  assert.deepEqual([d.props.revenue_drop_customer_number, d.props.revenue_drop_major_profit_center], ["100-1", "DT"]);

  const lost = co("2", [{ from: "2024-07", to: "2025-06", rev: 1500 }], { owner: TSA, country: "Switzerland", lastOrder: "2025-06-20" });
  const l = draftOf(lost, verdictOf(lost, MONTHS, w), w)!;
  assert.equal(l.subject, "LOST BUSINESS | -100% | 18'000 EUR | Example 2 AG");
  assert.deepEqual([l.pipeline, l.priority, l.props.revenue_drop_step, l.props.revenue_drop_change_pct], [PIPE_STAGE.TSA.pipeline, "HIGH", "lost_business", -100]);
  assert.match(l.content, /^LOST BUSINESS - Win-back\n\nThe customer bought nothing in the last 12 months \(Jul 2025 - Jun 2026\): no revenue, no order intake\./);
  assert.match(l.content, /Last order:  2025-06-20/);
  assert.match(l.content, /Switzerland \(floor 10'000 EUR\)/);
  assert.doesNotMatch(l.content, /Major profit center/);

  const stranger = { ...c, owner: "999" };
  assert.equal(draftOf(stranger, verdictOf(stranger, MONTHS, w), w), null);
  const small = co("3", [{ from: "2024-07", to: "2025-06", rev: 500 }]);
  assert.equal(draftOf(small, verdictOf(small, MONTHS, w), w), null);
});

test("priority by the amount at risk: High from €15,000, Medium from €5,000", () => {
  assert.deepEqual([priorityOf(PRIORITY_FROM.HIGH), priorityOf(14_999), priorityOf(PRIORITY_FROM.MEDIUM), priorityOf(4_999)], ["HIGH", "MEDIUM", "MEDIUM", "LOW"]);
});

test("the HubSpot fields: what is missing, what clashes, and the Tags choice", () => {
  const none = planFields(false, [{ name: "tags", type: "enumeration", options: [{ value: "erosion" }] }]);
  assert.deepEqual([none.group, none.create.length, none.tag, none.ok], [true, RD_FIELDS.length, true, false]);
  const all = planFields(true, [
    ...RD_FIELDS.map((x) => ({ name: x.name, type: x.type })),
    { name: "tags", type: "enumeration", options: [{ value: "erosion" }, { value: RD_TAG.value }] },
  ]);
  assert.deepEqual([all.group, all.create, all.clash, all.tag, all.ok], [false, [], [], false, true]);
  const clash = planFields(true, [{ name: "revenue_drop_amount_at_risk", type: "string" }]);
  assert.deepEqual(clash.clash, [{ name: "revenue_drop_amount_at_risk", has: "string", wants: "number" }]);
  assert.equal(clash.create.includes("revenue_drop_amount_at_risk"), false);
  const step = createBody(RD_FIELDS.find((x) => x.name === "revenue_drop_step")!);
  assert.deepEqual([step.groupName, step.type, step.fieldType, step.options?.map((o) => o.value)], [RD_GROUP.name, "enumeration", "select", ["lost_business", "revenue_drop"]]);
  // every value the ticket writes has a field
  const w = windowOf("2026-06");
  const c = co("1", [{ from: "2024-07", to: "2025-06", rev: 1000 }, { from: "2025-07", to: "2026-06", rev: 100 }]);
  const written = Object.keys(draftOf(c, verdictOf(c, MONTHS, w), w)!.props).filter((k) => k.startsWith("revenue_drop_"));
  assert.deepEqual(written.sort(), RD_FIELDS.map((x) => x.name).sort());
});

test("filled counts the companies with a figure each month", () => {
  const f = filledOf([co("1", [{ from: "2026-01", to: "2026-01", rev: 5, oi: 1 }]), co("2", [{ from: "2026-01", to: "2026-02", rev: 5 }])], MONTHS.length);
  assert.deepEqual([f.rev[at("2026-01")], f.oi[at("2026-01")], f.rev[at("2026-02")], f.oi[at("2026-02")]], [2, 1, 1, 0]);
});
