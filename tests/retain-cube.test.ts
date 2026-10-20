import assert from "node:assert/strict";
import { test } from "node:test";
import { addOrder, eroding, finish, newAcc, totalsBy, totalsOf, viewOf, windowOf, keyLast, keyOwner, kindOf, monthsBetween, rowsOf, byOwner, byDim, byKind, matches, csvOf, HEADLINE, KIND_INFO, STOPPED_MONTHS, type RetainData } from "../src/lib/marketingKpis/retainCube";

const pos = (...xs: [string, number, string?][]) => JSON.stringify(xs.map(([a, r, pc]) => ({ a, r, pc: pc ?? "FT", t: `Article ${a}` })));
const order = (p: Record<string, unknown>) => ({ order_mandant: "100", order_customer_number: "7001", order_order_type: "Order", ...p });

test("the window: the five years before today's, the last 12 months, the orders of 24 months still open", () => {
  const w = windowOf("2026-10-19");
  assert.deepEqual(w.years, [2021, 2022, 2023, 2024, 2025]);
  assert.equal(w.since12, "2025-10-19");
  assert.equal(w.openSince, "2024-10-19");
});

test("the money: invoiced documents only, by the invoice's year; open orders = ordered less invoiced, per order and article", () => {
  const acc = newAcc("2026-10-19");
  const A = "0654435080", B = "1301037002";
  // 2022: the best year of A - 4,000 invoiced; the order as placed (.000, entered) never counts as money
  addOrder(acc, order({ order_order_number: "A22.1.000", order_order_status: "entered", order_order_date: "2022-03-01", order_positions_json: pos([A, 4000]) }), {});
  addOrder(acc, order({ order_order_number: "A22.1.001", order_order_status: "invoiced", order_order_date: "2022-03-01", order_invoice_date: "2022-03-05", order_positions_json: pos([A, 4000]) }), {});
  // ordered Dec 2024, invoiced Jan 2025: the year is the invoice's
  addOrder(acc, order({ order_order_number: "A24.2.001", order_order_status: "invoiced", order_order_date: "2024-12-20", order_invoice_date: "2025-01-08", order_positions_json: pos([A, 1000]) }), {});
  // the last 12 months: 500 invoiced; and an open order of 800, of which 300 already delivered and invoiced
  addOrder(acc, order({ order_order_number: "A26.3.001", order_order_status: "invoiced", order_order_date: "2026-02-01", order_invoice_date: "2026-02-03", order_positions_json: pos([A, 500]) }), {});
  addOrder(acc, order({ order_order_number: "A26.4.000", order_order_status: "entered", order_order_date: "2026-09-01", order_positions_json: pos([A, 800]) }), {});
  addOrder(acc, order({ order_order_number: "A26.4.001", order_order_status: "invoiced", order_order_date: "2026-09-01", order_invoice_date: "2026-09-10", order_positions_json: pos([A, 300]) }), {});
  // a credit note never counts; a web order without a customer number is counted as such
  addOrder(acc, order({ order_order_number: "G26.5", order_order_type: "Credit note", order_order_status: "invoiced", order_order_date: "2026-05-01", order_invoice_date: "2026-05-01", order_positions_json: pos([A, -4000]) }), {});
  addOrder(acc, { order_mandant: "100", order_order_number: "A26.6.000", order_order_status: "invoiced", order_order_date: "2026-06-01", order_positions_json: pos([A, 999]) }, {});
  // B: never above 2,500 in a year - not counted
  addOrder(acc, order({ order_order_number: "A23.7.001", order_order_status: "invoiced", order_order_date: "2023-04-01", order_invoice_date: "2023-04-02", order_positions_json: pos([B, 2400]) }), {});
  const lines = finish(acc);
  assert.equal(lines.length, 1);
  const [l] = lines;
  assert.deepEqual(l.y, [0, 4000, 0, 0, 1000]);
  assert.equal(l.l, 800);           // 500 + 300 invoiced since 19.10.2025
  assert.equal(l.o, 500);           // ordered 800, 300 of it invoiced
  assert.equal(acc.noCustomer, 1);
  assert.equal(l.d, "2026-09-10");  // the last invoice of the article to the customer (the credit note and the uninvoiced .000 never count)
  const v = viewOf(l, windowOf("2026-10-19").years, "2026-10-19");
  assert.equal(v.months, 1);
  assert.equal(v.best, 4000);
  assert.equal(v.bestYear, 2022);
  assert.equal(v.now, 1300);
  assert.equal(v.gap, 2700);
  assert.equal(v.stopped, false);
});

test("what is at stake: eroding lines only, stopped or buying less, by owner", () => {
  const d: RetainData = {
    years: [2021, 2022, 2023, 2024, 2025],
    lines: [
      { u: "100-1", a: "0000000001", y: [0, 5000, 0, 0, 0], l: 0, o: 0 },        // stopped: 5,000 at stake
      { u: "100-1", a: "0000000002", y: [3000, 0, 0, 0, 0], l: 2000, o: 0 },     // buying less: 1,000
      { u: "100-2", a: "0000000003", y: [0, 0, 0, 0, 4000], l: 4500, o: 0 },     // growing: not eroding
      { u: "110-3", a: "0000000004", y: [0, 0, 2600, 0, 0], l: 0, o: 600 },      // an open order: buying less, 2,000
    ],
    articles: { "0000000001": { t: "a", p: "FT" }, "0000000002": { t: "b", p: "DT" }, "0000000003": { t: "c", p: "FT" }, "0000000004": { t: "d", p: "ST" } },
    companies: { "100-1": { n: "One", o: "11", k: "Switzerland" }, "100-2": { n: "Two", o: "11", k: "Switzerland" }, "110-3": { n: "Three", o: "22", k: "Germany" } },
    owners: { "11": "Anna", "22": "Ben" }, asOf: "2026-10-19", readAt: "", orders: 0, noCustomer: 0, errors: {},
  };
  const all = eroding(d, {});
  assert.deepEqual(all.map((v) => v.gap), [5000, 2000, 1000]);
  const t = totalsOf(all);
  assert.deepEqual([t.gap, t.lines, t.customers, t.stoppedGap, t.stoppedLines], [8000, 3, 2, 5000, 1]);
  assert.deepEqual(totalsBy(all, keyOwner(d)).map(([k, x]) => [k, x.gap]), [["11", 6000], ["22", 2000]]);
  assert.equal(eroding(d, { state: ["stopped"] }).length, 1);
  assert.equal(eroding(d, { pc: ["ST"] })[0].u, "110-3");
  assert.equal(eroding(d, { country: ["Germany"] }).length, 1);
  // one-off (one year only) or recurring: all three eroding lines here are one-offs
  assert.equal(eroding(d, { kind: ["recurring"] }).length, 0);
  assert.equal(eroding(d, { kind: ["oneoff"] }).length, 3);
  assert.deepEqual(totalsBy(all, keyLast()).map(([k]) => k).sort(), ["In the last 12 months", "Last bought in 2022", "Last bought in 2023"]);
});

test("months since the last invoice: whole months, a day short is a month less", () => {
  assert.equal(monthsBetween("2024-10-20", "2026-10-20"), 24);
  assert.equal(monthsBetween("2024-10-21", "2026-10-20"), 23);
  assert.equal(monthsBetween("2024-09-19", "2026-10-20"), 25);
  assert.equal(monthsBetween("2026-10-20", "2026-10-20"), 0);
  assert.equal(STOPPED_MONTHS, 24);
});

test("the erosion list: still buying less and stopped 12-24 months in the headline; lost, one year only and 800x apart", () => {
  const d: RetainData = {
    years: [2021, 2022, 2023, 2024, 2025],
    lines: [
      { u: "100-1", a: "1000000001", y: [3000, 4000, 3500, 3000, 2800], l: 1000, o: 0, d: "2026-08-15" },   // still buying, less: 3,000
      { u: "100-1", a: "1000000002", y: [0, 0, 2000, 3000, 2600], l: 0, o: 0, d: "2025-03-10" },           // stopped 19 months ago: 3,000
      { u: "100-2", a: "1000000003", y: [5000, 4000, 0, 3000, 0], l: 0, o: 0, d: "2024-06-01" },           // lost: 28 months: 5,000
      { u: "100-2", a: "1000000004", y: [0, 0, 6000, 0, 0], l: 0, o: 0, d: "2023-05-05" },                 // one year only: 6,000
      { u: "110-3", a: "8001000005", y: [0, 3000, 0, 4000, 0], l: 500, o: 0, d: "2026-01-01" },            // made to order (800x): 3,500
      { u: "110-3", a: "1000000006", y: [0, 0, 0, 3000, 2700], l: 0, o: 400, d: "2025-06-30" },            // on order only: still buying, less: 2,600
      { u: "100-2", a: "1000000007", y: [0, 2600, 2700, 2800, 3000], l: 3500, o: 0, d: "2026-10-01" },     // growing: not at stake
    ],
    articles: Object.fromEntries(["1000000001", "1000000002", "1000000003", "1000000004", "8001000005", "1000000006", "1000000007"].map((a) => [a, { t: `Text ${a}`, p: a === "1000000006" ? "ST" : "FT" }])),
    companies: { "100-1": { n: "One; AG", o: "11", k: "Switzerland" }, "100-2": { n: "Two", o: "11", k: "Switzerland" }, "110-3": { n: "Three", o: "22", k: "Germany" } },
    owners: { "11": "Anna", "22": "Ben" }, asOf: "2026-10-20", readAt: "", orders: 0, noCustomer: 0, errors: {},
  };
  assert.deepEqual(eroding(d, {}).map((v) => [v.a, kindOf(v), v.months]).sort(), [
    ["1000000001", "less", 2], ["1000000002", "stopped", 19], ["1000000003", "gone", 28], ["1000000004", "oneoff", 41], ["1000000006", "less", 15], ["8001000005", "made", 9],
  ]);
  assert.deepEqual(HEADLINE, ["less", "stopped"]);
  assert.match(KIND_INFO.find((k) => k.id === "stopped")!.label, /12–24 months/);

  // the list: the headline kinds, the most at stake first
  const rows = rowsOf(d, {});
  assert.deepEqual(rows.map((r) => [r.a, r.kind, r.gap]), [["1000000001", "less", 3000], ["1000000002", "stopped", 3000], ["1000000006", "less", 2600]]);
  assert.equal(rowsOf(d, { kinds: ["less", "stopped", "gone", "oneoff", "made"] }).length, 6);
  assert.deepEqual(rowsOf(d, { kinds: ["made"] }).map((r) => r.a), ["8001000005"]);
  assert.deepEqual(rowsOf(d, { owner: ["22"] }).map((r) => r.a), ["1000000006"]);
  assert.deepEqual(rowsOf(d, { pc: ["ST"] }).map((r) => r.u), ["110-3"]);
  // the search: the customer's name or number, the article's number or text
  assert.deepEqual(rowsOf(d, {}).filter((r) => matches(d, r, "one")).map((r) => r.a), ["1000000001", "1000000002"]);
  assert.deepEqual(rowsOf(d, {}).filter((r) => matches(d, r, "110-3")).map((r) => r.a), ["1000000006"]);
  assert.deepEqual(rowsOf(d, {}).filter((r) => matches(d, r, "text 1000000002")).map((r) => r.a), ["1000000002"]);

  // by any of the page's tabs: country, profit centre, customer, article - and a customer or an article as a filter
  assert.deepEqual(byDim(d, {}, "country").map((x) => [x.key, x.sums.gap]), [["Switzerland", 6000], ["Germany", 2600]]);
  assert.deepEqual(byDim(d, {}, "pc").map((x) => [x.key, x.sums.gap]), [["FT", 6000], ["ST", 2600]]);
  assert.deepEqual(byDim(d, {}, "customer").map((x) => [x.key, x.sums.lines]), [["100-1", 2], ["110-3", 1]]);
  assert.deepEqual(byDim(d, { kinds: ["gone", "oneoff"] }, "article").map((x) => x.key), ["1000000004", "1000000003"]);
  assert.deepEqual(rowsOf(d, { customer: ["100-1"], article: ["1000000002"] }).map((r) => r.gap), [3000]);
  // the graph: per owner, split by kind
  assert.deepEqual(byOwner(d, {}).map((o) => [o.owner, o.sums.gap, o.sums.customers, o.sums.byKind.less, o.sums.byKind.stopped]), [["11", 6000, 1, 3000, 3000], ["22", 2600, 1, 2600, 0]]);
  // what is shown apart
  const k = byKind(d, {});
  assert.deepEqual(Object.fromEntries(Object.entries(k).map(([x, v]) => [x, [v.gap, v.lines, v.customers]])), {
    less: [5600, 2, 2], stopped: [3000, 1, 1], gone: [5000, 1, 1], oneoff: [6000, 1, 1], made: [3500, 1, 1],
  });

  // for Excel: the Excel's columns, ";" with a name holding one quoted
  const csv = csvOf(d, rows).split("\r\n");
  assert.equal(csv.length, 4);
  assert.equal(csv[0], "Customer number;Customer;Country;Owner;Article;Article text;Profit centre;2021;2022;2023;2024;2025;Last 12 months;Open orders;Best year;Best year in;At stake;Last invoice;Months since;Status");
  assert.equal(csv[2], '100-1;"One; AG";Switzerland;Anna;1000000002;Text 1000000002;FT;0;0;2000;3000;2600;0;0;3000;2024;3000;2025-03-10;19;Stopped 12–24 months');
});

test("a read from before 20.10 (no day of the last invoice): stopped by the years, as before", () => {
  const years = [2021, 2022, 2023, 2024, 2025];
  const v1 = viewOf({ u: "100-1", a: "1000000001", y: [0, 0, 2000, 3000, 0], l: 0, o: 0 }, years, "2026-10-20");
  const v2 = viewOf({ u: "100-1", a: "1000000002", y: [3000, 3000, 0, 0, 0], l: 0, o: 0 }, years, "2026-10-20");
  assert.equal(v1.months, null);
  assert.equal(kindOf(v1), "stopped");
  assert.equal(kindOf(v2), "gone");
});
