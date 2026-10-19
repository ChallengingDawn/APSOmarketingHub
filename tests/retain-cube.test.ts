import assert from "node:assert/strict";
import { test } from "node:test";
import { addOrder, eroding, finish, newAcc, totalsBy, totalsOf, viewOf, windowOf, keyLast, keyOwner, kindOf, kindInfo, pivot, byKind, actionsOf, HEADLINE, type RetainAction, type RetainData } from "../src/lib/marketingKpis/retainCube";

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

test("the erosion Excel's pivot: still buying less and stopped recently in the headline, the rest apart; owner > customer > article", () => {
  const d: RetainData = {
    years: [2021, 2022, 2023, 2024, 2025],
    lines: [
      { u: "100-1", a: "1000000001", y: [3000, 4000, 3500, 3000, 2800], l: 1000, o: 0 },   // still buying, less: 3,000
      { u: "100-1", a: "1000000002", y: [0, 0, 2000, 3000, 2600], l: 0, o: 0 },           // stopped recently (bought in 2025): 3,000
      { u: "100-2", a: "1000000003", y: [5000, 4000, 0, 0, 0], l: 0, o: 0 },               // lost before (last in 2022): 5,000
      { u: "100-2", a: "1000000004", y: [0, 0, 6000, 0, 0], l: 0, o: 0 },                  // one year only: 6,000
      { u: "110-3", a: "8001000005", y: [0, 3000, 0, 4000, 0], l: 500, o: 0 },             // made to order (800x): 3,500
      { u: "110-3", a: "1000000006", y: [0, 0, 0, 3000, 2700], l: 0, o: 400 },             // an open order: still buying, less: 2,600
      { u: "100-2", a: "1000000007", y: [0, 2600, 2700, 2800, 3000], l: 3500, o: 0 },      // growing: not at stake
    ],
    articles: Object.fromEntries(["1000000001", "1000000002", "1000000003", "1000000004", "8001000005", "1000000006", "1000000007"].map((a) => [a, { t: a, p: a === "1000000006" ? "ST" : "FT" }])),
    companies: { "100-1": { n: "One", o: "11", k: "Switzerland" }, "100-2": { n: "Two", o: "11", k: "Switzerland" }, "110-3": { n: "Three", o: "22", k: "Germany" } },
    owners: { "11": "Anna", "22": "Ben" }, asOf: "2026-10-20", readAt: "", orders: 0, noCustomer: 0, errors: {},
  };
  assert.deepEqual(eroding(d, {}).map((v) => [v.a, kindOf(v)]).sort(), [
    ["1000000001", "less"], ["1000000002", "stopped"], ["1000000003", "gone"], ["1000000004", "oneoff"], ["1000000006", "less"], ["8001000005", "made"],
  ]);
  assert.deepEqual(HEADLINE, ["less", "stopped"]);
  assert.match(kindInfo(d.years)[1].note, /2024 or 2025/);

  // the headline pivot: Anna 6,000 (One: two articles), Ben 2,600 (Three: the open order - its 800x line apart)
  const p = pivot(d, {});
  assert.deepEqual(p.map((o) => [o.owner, o.sums.gap, o.sums.customers, o.sums.lines]), [["11", 6000, 1, 2], ["22", 2600, 1, 1]]);
  assert.deepEqual([p[0].sums.best, p[0].sums.last, p[0].sums.now, p[0].sums.less, p[0].sums.stopped], [7000, 5400, 1000, 3000, 3000]);
  assert.deepEqual(p[0].customers.map((c) => [c.u, c.lines.map((l) => l.kind)]), [["100-1", ["less", "stopped"]]]);
  // every kind: Two (11,000) above One (6,000); Ben's made-to-order line joins
  const all = pivot(d, { kinds: ["less", "stopped", "gone", "oneoff", "made"] });
  assert.deepEqual(all.map((o) => [o.owner, o.sums.gap, o.customers.map((c) => c.u)]), [["11", 17000, ["100-2", "100-1"]], ["22", 6100, ["110-3"]]]);
  assert.deepEqual(pivot(d, { owner: ["22"] }).map((o) => o.owner), ["22"]);
  assert.deepEqual(pivot(d, { pc: ["ST"] }).flatMap((o) => o.customers.map((c) => c.u)), ["110-3"]);

  // what is shown apart
  const k = byKind(d, {});
  assert.deepEqual(Object.fromEntries(Object.entries(k).map(([x, v]) => [x, [v.gap, v.lines, v.customers]])), {
    less: [5600, 2, 2], stopped: [3000, 1, 1], gone: [5000, 1, 1], oneoff: [6000, 1, 1], made: [3500, 1, 1],
  });

  // the erosion tickets beside a customer, and an article
  const t = (id: string, un: string, articles: string[], won = false): RetainAction => ({ id, un, articles, created: "2026-09-01", closed: null, result: "", won, open: !won, owner: "11" });
  const acts = [t("1", "100-1", ["1000000002"]), t("2", "100-1", ["1000000001", "1000000002"], true), t("3", "110-3", ["1000000006"])];
  assert.deepEqual(actionsOf(acts, "100-1").map((x) => x.id), ["1", "2"]);
  assert.deepEqual(actionsOf(acts, "100-1", "1000000001").map((x) => x.id), ["2"]);
  assert.deepEqual(actionsOf(acts, "100-2"), []);
});
