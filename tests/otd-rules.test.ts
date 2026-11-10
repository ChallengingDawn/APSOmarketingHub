import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GLC, OTHER, addWorkdays, buildOtdCube, changeCat, dateChange, fromErpLines, impactRank, keysFor, lateCat, lateDays, mergeCubes, monthly,
  networkdays, onTimeShare, parseHistory, positionCat, priorityOf, sumSlices, type OtdLine,
} from "../src/lib/reporting/otdRules";

test("otd: NETWORKDAYS and the file's late days (column AZ)", () => {
  assert.equal(networkdays("2025-01-13", "2025-01-13"), 1); // a Monday
  assert.equal(networkdays("2025-01-10", "2025-01-13"), 2); // Fri -> Mon
  assert.equal(networkdays("2025-01-13", "2025-01-09"), -3); // backwards: Thu, Fri, Mon
  assert.equal(networkdays("2025-01-01", "2025-12-31"), 261);
  assert.equal(addWorkdays("2025-01-10", 1), "2025-01-13");
  // the file's first row: first date 13.01.2025, at the customer 09.01.2025 -> 2 days early
  assert.equal(lateDays("2025-01-13", "2025-01-09"), -2);
  assert.equal(lateDays("2025-01-13", "2025-01-13"), 0);
  assert.equal(lateDays("2025-01-10", "2025-01-13"), 1); // Fri -> Mon: one working day late
  assert.equal(lateDays("2025-01-11", "2025-01-13"), 0); // a Saturday first date, there on Monday: on time
  assert.equal(dateChange("2025-01-13", ""), 0);
});

test("otd: the file's categories", () => {
  assert.deepEqual([-3, 0, 1, 2, 3, 4, 5, 10, 11, 30, 31].map(lateCat), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.deepEqual([-2, 0, 1, 4, 5, 9, 10, 14, 15, 19, 20, 60].map(changeCat), [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(positionCat), [0, 0, 1, 2, 3, 3]);
  assert.deepEqual([100, 50, 49.9, 20, 10, 9.9].map(priorityOf), ["Critical", "Critical", "High", "High", "Medium", "Low"]);
});

const L = (o: Partial<OtdLine>): OtdLine => ({
  company: "100", order: "A26.000001.001", line: "10", source: "eShop", orderDay: "2026-03-02", firstDay: "2026-03-10", confDay: "2026-03-10",
  shipDay: "2026-03-09", atCustomer: "2026-03-10", article: "A1", st: "S", pc: "DT", supplier: "Anyseals NV", ...o,
});

test("otd: the cube - categories, the order's shape, date changes, suppliers, GLC, both month axes", () => {
  const lines = [
    // order 1: two positions, the same first date, delivered together on time
    L({}), L({ line: "20", article: "A2" }),
    // order 2: two positions, two first dates (several deliveries asked); the second one 12 working days late, its date moved 3 days
    L({ order: "A26.000002.001", firstDay: "2026-03-12", confDay: "2026-03-12", atCustomer: "2026-03-12", article: "A3", supplier: "" }),
    L({ order: "A26.000002.002", line: "20", firstDay: "2026-03-20", confDay: "2026-03-25", atCustomer: "2026-04-07", article: "A3", supplier: "" }),
    // order 3: one position, 2 days late, by the first date in March, delivered in April
    L({ order: "A26.000003.001", firstDay: "2026-03-31", confDay: "2026-03-31", atCustomer: "2026-04-02", company: "110", source: "manually entered", st: "P", pc: "KT" }),
    // order 4: three positions, one first date, delivered on two days -> more deliveries than confirmed
    L({ order: "A26.000004.001", firstDay: "2026-03-16", confDay: "2026-03-16", atCustomer: "2026-03-16", supplier: "Tecnogomma" }),
    L({ order: "A26.000004.001", line: "20", firstDay: "2026-03-16", confDay: "2026-03-16", atCustomer: "2026-03-16", supplier: "Tecnogomma" }),
    L({ order: "A26.000004.001", line: "30", firstDay: "2026-03-16", confDay: "2026-03-16", atCustomer: "2026-03-18", supplier: "Tecnogomma" }),
    // left out: not at the customer yet / after today
    L({ order: "A26.000005.001", atCustomer: "" }), L({ order: "A26.000006.001", atCustomer: "2026-12-01" }),
  ];
  const k = buildOtdCube(lines, "test", "2026-11-09");
  assert.equal(k.lines, 8);
  assert.deepEqual(k.skipped, { "not delivered yet": 1, "delivered after today": 1 });
  assert.equal(k.first, "2026-03"); assert.equal(k.last, "2026-03");
  const mar = sumSlices(keysFor(k.promised, ["2026-03"]).map((x) => k.promised.slices[x]));
  assert.equal(mar.n, 8);
  assert.equal(mar.late, 3); // 12, 2 and 2 working days
  assert.equal(mar.days, 16);
  assert.equal(mar.over10, 1);
  assert.deepEqual(mar.cat, [5, 2, 0, 0, 1, 0]);
  assert.equal(onTimeShare(mar), 5 / 8);
  // the order's shape: positions 2, 2, 2, 2, 1, 3, 3, 3
  assert.deepEqual(mar.pos.map((t) => t[0]), [1, 4, 3, 0]);
  // several deliveries asked: order 2's two lines
  assert.deepEqual(mar.shape[1 * 2 + 1].slice(0, 2), [2, 1]);
  // more deliveries than confirmed: order 4's three lines (two on one day, one on another)
  assert.deepEqual(mar.more[1].slice(0, 2), [3, 1]);
  // the date changed on one line (3 working days later)
  assert.deepEqual(mar.changed[1].slice(0, 2), [1, 1]);
  assert.deepEqual(mar.change[2].slice(0, 2), [1, 1]);
  // GLC: the lines without a supplier
  assert.deepEqual(mar.sup[GLC].slice(0, 3), [2, 1, 12]);
  // by the month the line reached the customer: order 2's late line and order 3 move to April
  assert.equal(sumSlices(keysFor(k.delivered, ["2026-04"]).map((x) => k.delivered.slices[x])).n, 2);
  // the filters: mandant 110 / manual source / special articles all pick order 3 only
  assert.equal(monthly(k.promised, ["2026-03"], { company: ["110"] })[0].n, 1);
  assert.equal(monthly(k.promised, ["2026-03"], { src: ["m"] })[0].n, 1);
  assert.equal(monthly(k.promised, ["2026-03"], { st: ["P"], pc: ["KT"] })[0].late, 1);
  // the impact ranking: GLC's 12 late days the most, then Anyseals 2 and Tecnogomma 2
  const r = impactRank(mar);
  assert.deepEqual(r.map((x) => [x.supplier, x.days, Math.round(x.index), x.priority]), [[GLC, 12, 100, "Critical"], ["Anyseals NV", 2, 17, "Medium"], ["Tecnogomma", 2, 17, "Medium"]]);
  // the articles late most often, by the first date's month
  assert.deepEqual(k.articles.map((a) => [a.a, a.m["2026-03"]]), [["A1", [5, 2, 4]], ["A3", [2, 1, 12]]]); // A2: never late, not listed
  assert.ok(!k.suppliers.includes(OTHER));
});

test("otd: the ERP's lines - the Back Office's choice of lines, the date at the customer from the transport time", () => {
  const base = { company: "100", order: "A26.1.000", line: "10", source: "eShop", orderDay: "2026-10-01", status: "invoiced", shipDay: "2026-10-02",
    country: "Germany", lineType: "Order", firstDay: "2026-10-06", confDay: "2026-10-06", article: "A1", artType: "Standard", pc: "DT" };
  const r = fromErpLines([
    base,
    { ...base, line: "20", artType: "Service" },
    { ...base, line: "30", status: "entered", shipDay: "" },
    { ...base, line: "40", company: "120" },
    { ...base, line: "50", lineType: "CreditNote" },
  ], (c) => (c === "Germany" ? 2 : 6), (a) => (a === "A1" ? "Anyseals NV" : undefined));
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].atCustomer, "2026-10-06"); // Fri 02.10 + 2 working days
  assert.equal(r.lines[0].supplier, "Anyseals NV");
  assert.equal(r.lines[0].st, "S");
  assert.deepEqual(r.skipped, { "service or unknown article type": 1, "not shipped yet": 1, "another mandant": 1, "not an order line": 1 });
});

test("otd: the OTD file's lines as history, and the two cubes as one", () => {
  const csv = "company;order;line;source;orderDay;firstDay;confDay;shipDay;atCustomer;article;pc;supplier;planned;group;comment\n"
    + "100;A25.000001.001;10;eShop;2025-01-02;2025-01-10;2025-01-10;2025-01-09;2025-01-10;A1;DT;-;J;NORMATEC O-ring;0\n"
    + "110;A25.000002.001;10;eShop;2025-11-02;2025-11-10;2025-11-10;2025-11-11;2025-11-14;A2;KT;Röchling;N;POM-C;1\n";
  const h = parseHistory(csv);
  assert.equal(h.length, 2);
  assert.equal(h[0].supplier, ""); // "-" = no supplier = GLC
  assert.equal(h[1].comment, true);
  assert.throws(() => parseHistory("company;order\n1;2"), /lacks/);
  const file = buildOtdCube(h, "file", "2026-11-09");
  assert.deepEqual(file.promised.slices["2025-01|100|e||DT"].planned[0].slice(0, 1), [1]);
  assert.deepEqual(file.promised.slices["2025-11|110|e||KT"].group["POM-C"], [1, 1, 4]);
  const erp = buildOtdCube([L({ firstDay: "2025-11-12", atCustomer: "2025-11-12", confDay: "2025-11-12", orderDay: "2025-11-01", shipDay: "2025-11-11" })], "erp", "2026-11-09");
  const m = mergeCubes(erp, file)!;
  // January 2025 from the file (before the ERP's first month), November 2025 from the ERP only
  assert.ok(m.promised.slices["2025-01|100|e||DT"]);
  assert.ok(!m.promised.slices["2025-11|110|e||KT"]);
  assert.equal(m.first, "2025-01");
  assert.equal(mergeCubes(null, file), file);
});

test("otd: the morning lines' new columns - the ERP's own date at the customer, the shipping mode, the wish date, the planning", async () => {
  const { ErpLinesSheet, transitOf } = await import("../src/lib/reporting/boErpLines");
  const { ArticlesSheet } = await import("../src/lib/connectors/steps/productFactsRules");
  const { transportOf } = await import("../src/lib/reporting/otdRules");
  // the lines sheet reads them when they are there
  const s = new ErpLinesSheet();
  s.feed(1, ["[Company]", "[Order]", "[Customer]", "[OrderSource]", "[OrderDate]", "[OrderStatus]", "[ShipmentDate]", "[ShippedToCountry]", "[ShippingMode]",
    "[DeliveryDateCustomer]", "[Line]", "[LineType]", "[PriceSource]", "[ShippingDateInitial]", "[ShippingDateConfirmed]", "[CustomerWishDate]", "[Article]", "[ArticleType]", "[ProfitCenter]"]);
  s.feed(2, ["100", "A26.000001.000", "100-7", "eShop", 46297, "invoiced", 46297, "Switzerland", "DHL", 46300, "10", "Order", "automatically", 46300, 46300, 46299, "A1", "Standard", "DT"]);
  const got = s.finish()!.lines[0];
  assert.deepEqual([got.customer, got.mode, got.deliveredDay, got.wishDay], ["100-7", "DHL", "2026-10-05", "2026-10-04"]);
  // the articles sheet keeps the planning apart from the facts written to HubSpot
  const a = new ArticlesSheet();
  a.feed(1, ["[Article]", "[GwstdpCHF]", "[ConsumptionDriven]", "[ReplenishmentDays]"]);
  a.feed(2, ["A1", 12.5, "J", 21]);
  a.feed(3, ["A2", 3, "n", "84"]);
  assert.deepEqual([...a.planning()!], [["A1", ["J", 21]], ["A2", ["N", 84]]]);
  const old = new ArticlesSheet();
  old.feed(1, ["[Article]", "[GwstdpCHF]"]);
  old.feed(2, ["A1", 12.5]);
  assert.equal(old.planning(), null);
  // the transport days by the mode
  assert.equal(transportOf({ country: "Germany", mode: "will be picked up" }, transitOf), 0);
  assert.equal(transportOf({ country: "Liechtenstein", mode: "DHL" }, transitOf), 1);
  assert.equal(transportOf({ country: "Liechtenstein", mode: "" }, transitOf), 2);
  assert.equal(transportOf({ country: "Italy" }, transitOf), 4);
  // the ERP's own date wins where it has one (never before the shipment); the planning and the customer carried
  const base = { company: "100", order: "A26.1.000", line: "10", source: "eShop", orderDay: "2026-09-01", status: "invoiced", shipDay: "2026-10-02",
    country: "Germany", lineType: "Order", firstDay: "2026-10-06", confDay: "2026-10-06", article: "A2", artType: "Standard", pc: "DT" };
  const r = fromErpLines([
    { ...base, deliveredDay: "2026-10-08", customer: "100-7", wishDay: "2026-10-05" },
    { ...base, line: "20", deliveredDay: "2026-09-30" },
    { ...base, line: "30", mode: "will be picked up" },
  ], transitOf, undefined, (art) => (art === "A2" ? ["N", 84] : undefined));
  assert.deepEqual(r.lines.map((l) => l.atCustomer), ["2026-10-08", "2026-10-06", "2026-10-02"]);
  assert.equal(r.exactDays, 1);
  assert.deepEqual([r.lines[0].customer, r.lines[0].wishDay, r.lines[0].planned, r.lines[0].replen], ["100-7", "2026-10-05", "N", 84]);
  // the cube: against the wish (Mon 05.10 asked, there Thu 08.10: 3 days late; first confirmed Tue 06.10, later than asked),
  // promised faster than the replenishment (35 calendar days < 84), the customer kept
  const k = buildOtdCube(r.lines, "erp", "2026-11-09");
  const t = sumSlices(Object.values(k.promised.slices));
  assert.deepEqual(t.wish, [1, 1, 3]);
  assert.equal(t.wishLater, 1);
  assert.deepEqual(t.replen!.map((x) => x[0]), [0, 3]);
  assert.deepEqual(k.customers, [{ c: "100-7", company: "100", m: { "2026-10": [1, 1, 2] } }]);
});
