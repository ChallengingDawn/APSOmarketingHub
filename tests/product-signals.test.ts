import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AR, LK, SIGNALS_FROM, addDays, articleExtremes, companiesOf, compactSignals, groupBy, kindOf, looksOf, periodById, periodsOf, prevWin, rangeWords, statsOf,
  type SignalsIn,
} from "../src/lib/productSignals/model";

// two companies; four articles: A empty shelf, B 4 on the shelf, C stock unknown to Products & Pricing, D with a minimum of 50
type Co = { companyId: string; companyName: string | null; customerNumber: string | null; country: string | null };
const co1: Co = { companyId: "101", companyName: "Alpha AG", customerNumber: "100-1", country: "Switzerland" };
const co2: Co = { companyId: "202", companyName: null, customerNumber: "100-2", country: "Germany" };
const facts = {
  "0111100001": { description: "O-ring A", profitCentre: "dt", mainGroup: "O-rings", subGroup: "FKM", product: "01111000", productName: "O-ring FKM", salesUnit: "Stk", minimum: null, stock: 0 },
  "0222200002": { description: "Plate B", profitCentre: "KT", mainGroup: "Plates", subGroup: "PA", product: "02222000", productName: "PA plate", salesUnit: "Stk", minimum: null, stock: 4 },
  "0333300003": { description: "Hose C", profitCentre: "FT", mainGroup: "Hoses", subGroup: "", product: "", productName: "", salesUnit: "m", minimum: null, stock: null },
  "0444400004": { description: "Seal D", profitCentre: "DT", mainGroup: "Seals", subGroup: "Lip", product: "04444000", productName: "Lip seal", salesUnit: "Stk", minimum: 50, stock: 900 },
};
const look = (c: Co, day: string, article: string, qty: number | null, extra: Partial<{ belowMoq: boolean; shortfall: number | null; stock: number | null }> = {}) => ({
  ...c, day, article, description: null, mainGroup: null, profitCentre: null, qty, salesUnit: null, moqMinimum: null, stock: 0, belowMoq: false, shortfall: null, ...extra,
});
const scan: SignalsIn = {
  availability: [
    look(co1, "2026-10-05", "0111100001", 1),                       // empty shelf, a bare 1: a look, no quantity
    look(co1, "2026-10-20", "0222200002", 10, { shortfall: 6 }),     // 4 on the shelf, 10 asked
    look(co2, "2026-10-21", "0222200002", 3),                         // the scan's list, but 3 <= 4: not short when checked again
    look(co2, "2026-10-22", "0333300003", 5),                         // the scan read an empty property as 0 - unknown, left out
  ],
  moq: [
    look(co1, "2026-10-06", "0444400004", 10, { belowMoq: true }),
    look(co2, "2026-10-07", "0444400004", 1, { belowMoq: true }),    // a bare 1: the shop's own number
    look(co2, "2026-10-08", "0444400004", 60, { belowMoq: false }),
  ],
  priceChecks: [
    { ...co1, day: "2026-10-06", ticketId: "t1", articles: [
      { article: "0444400004", description: null, qty: 10, profitCentre: "DT", salesUnit: "Stk", moqMinimum: 50 },
      { article: "0111100001", description: null, qty: 1, profitCentre: "DT", salesUnit: "Stk", moqMinimum: null },
      { article: "0222200002", description: null, qty: null, profitCentre: "KT", salesUnit: "Stk", moqMinimum: null },
    ] },
    { ...co2, day: "2026-10-25", ticketId: null, articles: [{ article: "0222200002", description: null, qty: 7, profitCentre: "KT", salesUnit: "Stk", moqMinimum: null }] },
  ],
  articleFacts: facts,
  // Alpha ordered D on 9 Oct (after the price check of the 6th) and B on 20 Oct (the same day as the shelf look - not later)
  orderedLooks: [{ companyId: "101", day: "2026-10-09", article: "0444400004" }, { companyId: "101", day: "2026-10-20", article: "0222200002" }],
  scanned: 2, kept: { merged: 12, unknownCompany: 1 }, quantityHistoryError: null, ticketLookupError: null,
};
const d = compactSignals(scan, { generatedAt: "2026-11-01T08:00:00Z", from: SIGNALS_FROM, through: "2026-11-01" });

test("availability: an empty shelf counts with or without a quantity; a gap only on a quantity typed; an unknown stock is left out", () => {
  const a = kindOf(d, "availability");
  assert.equal(a.looks.length, 2);
  const [first, second] = a.looks;
  assert.equal(a.articles[first[LK.article]][AR.number], "0111100001");
  assert.equal(first[LK.empty], 1);
  assert.equal(first[LK.qty], null, "a bare 1 is no quantity asked");
  assert.equal(first[LK.short], null);
  assert.equal(second[LK.empty], 0);
  assert.equal(second[LK.short], 6);
  assert.equal(second[LK.later], 0, "ordered the same day is not later");
  assert.equal(d.notes.unknownStock, 1);
  // the profit centre in capitals, as the page labels it
  assert.equal(a.articles[first[LK.article]][AR.pc], "DT");
  // a company without a name keeps its customer number
  assert.equal(d.companies.find((c) => c[0] === "202")?.[1], "100-2");
});

test("minimum order: a quantity typed under the minimum; a bare 1 counted aside", () => {
  const m = kindOf(d, "moq");
  assert.equal(m.looks.length, 1);
  assert.equal(m.looks[0][LK.qty], 10);
  assert.equal(m.looks[0][LK.later], 1, "Alpha ordered D three days later");
  assert.equal(d.notes.bareOne.moq, 1);
  const s = statsOf(m, m.looks);
  assert.equal(s.shareN, 1);
  assert.equal(s.shareSum, 10 / 50);
});

test("price checks: a quantity typed, every profit centre; a bare 1 and no quantity are not prices asked for", () => {
  const p = kindOf(d, "price");
  assert.deepEqual(p.looks.map((l) => [p.articles[l[LK.article]][AR.number], l[LK.qty], l[LK.ticket], l[LK.later]]),
    [["0444400004", 10, 1, 1], ["0222200002", 7, 0, 0]]);
  assert.equal(d.notes.bareOne.price, 1);
});

test("kindOf numbers only the companies and articles a page names", () => {
  const m = kindOf(d, "moq");
  assert.equal(m.companies.length, 1);
  assert.equal(m.articles.length, 1);
  assert.equal(m.looks[0][LK.company], 0);
  assert.equal(m.notes.kept?.merged, 12);
});

test("filters, breakdowns and the companies", () => {
  const p = kindOf(d, "price");
  const all = { from: SIGNALS_FROM, to: "2026-11-01" };
  assert.equal(looksOf(p, all, {}).length, 2);
  assert.equal(looksOf(p, all, { pc: ["KT"] }).length, 1);
  assert.equal(looksOf(p, all, { pc: ["KT"] }, "pc").length, 2, "a breakdown's own filter left out");
  assert.equal(looksOf(p, all, { country: ["Germany"], group: ["Plates"] }).length, 1);
  assert.equal(looksOf(p, { from: "2026-10-01", to: "2026-10-10" }, {}).length, 1);
  assert.equal(looksOf(p, null, {}).length, 0);
  const by = groupBy(p, looksOf(p, all, {}), "product");
  assert.deepEqual([...by.keys()].sort(), ["02222000", "04444000"]);
  const cos = companiesOf(p, looksOf(p, all, {}));
  assert.equal(cos.length, 2);
  assert.equal(cos[0].stats.last, "2026-10-25", "the same count: the latest first");
  const av = kindOf(d, "availability");
  const s = statsOf(av, av.looks);
  assert.deepEqual([s.looks, s.empty, s.less, s.companies, s.articles], [2, 1, 1, 1, 2]);
  assert.deepEqual(articleExtremes(av.looks), { maxQty: 10, minQty: 10, maxShort: 6 });
});

test("the days before: the same number of days, only where they are read", () => {
  assert.deepEqual(prevWin({ from: "2026-10-20", to: "2026-10-29" }, SIGNALS_FROM), { from: "2026-10-10", to: "2026-10-19" });
  assert.equal(prevWin({ from: "2026-10-05", to: "2026-10-29" }, SIGNALS_FROM), null);
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(rangeWords("2026-10-02", "2026-11-01"), "2 Oct – 1 Nov 2026");
  assert.equal(rangeWords("2026-10-05", "2026-10-09"), "5 – 9 Oct 2026");
});

test("the periods: cut to the days read, the quarters before the tracker greyed, an own range by its id", () => {
  const { quick, quarters } = periodsOf(SIGNALS_FROM, "2026-11-01");
  assert.deepEqual(quick.find((p) => p.id === "all")?.win, { from: "2026-10-02", to: "2026-11-01" });
  assert.deepEqual(quick.find((p) => p.id === "30d")?.win, { from: "2026-10-03", to: "2026-11-01" });
  assert.deepEqual(quick.find((p) => p.id === "lm")?.win, { from: "2026-10-02", to: "2026-10-31" });
  assert.equal(quick.find((p) => p.id === "lm")?.label, "Oct 2026");
  assert.deepEqual(quarters.map((q) => [q.id, !!q.disabled, q.label]), [["q1", true, "Q1 2026"], ["q2", true, "Q2 2026"], ["q3", true, "Q3 2026"], ["q4", false, "Q4 2026 to date"]]);
  assert.equal(periodById(SIGNALS_FROM, "2026-11-01", "q1").id, "all", "a greyed quarter falls back");
  assert.deepEqual(periodById(SIGNALS_FROM, "2026-11-01", "d2026-09-01_2026-10-10").win, { from: "2026-10-02", to: "2026-10-10" });
  assert.equal(periodById(SIGNALS_FROM, "2026-11-01", "nonsense").id, "all");
});
