import assert from "node:assert/strict";
import { test } from "node:test";
import { addOrder, eroding, finish, newAcc, totalsBy, totalsOf, viewOf, windowOf, keyLast, keyOwner, type RetainData } from "../src/lib/marketingKpis/retainCube";

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
  const v = viewOf(l, windowOf("2026-10-19").years);
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
