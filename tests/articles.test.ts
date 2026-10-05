import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, filterRows, fixText, kpis, lines, movers, rowsOf, sortRows, type Doc, type Line } from "../src/lib/articles/model";

const L = (art: string, rev: number, qty = 1, pc = "DT", text = "x"): Line => ({ art, rev, qty, pc, text });
const doc = (no: string, date: string, ls: Line[], un: string | null = "100-1"): Doc => ({ no, date, un, lines: ls });
const O = { cy: 2026, ly: 2025, today: "2026-10-05" };

test("lines(): article ids repaired through the fixmap, its text and PC first", () => {
  const ls = lines(JSON.stringify([
    { a: "53213", r: 100, q: 2, t: "old text", pc: "" },
    { a: "1120072140", r: "50.5", q: 1, t: "PrÃ¤zisions-Ring", pc: "KT" },
    { r: 9 },
  ]), { "53213": { n: "1110000001", t: "Fixed text", pc: "DT" } });
  assert.deepEqual(ls, [
    { art: "1110000001", rev: 100, qty: 2, text: "Fixed text", pc: "DT" },
    { art: "1120072140", rev: 50.5, qty: 1, text: "Präzisions-Ring", pc: "KT" },
  ]);
  assert.deepEqual(lines("not json", {}), []);
});

test("fixText repairs a double-encoded text and leaves a clean one alone", () => {
  assert.equal(fixText("O-Ring Ã˜ 20"), "O-Ring Ø 20");
  assert.equal(fixText("Präzision"), "Präzision");
});

test("an order counts once: delivered where delivered, as placed where not yet", () => {
  const docs = [
    // delivered in full: .000 and .001 carry the same 100 - the old report counted 200
    doc("8000000001.000", "2026-03-01", [L("A", 100)]),
    doc("8000000001.001", "2026-03-05", [L("A", 100)]),
    // half delivered: placed 300, delivered 120 so far - the order is worth 300
    doc("8000000002.000", "2026-04-01", [L("B", 300)]),
    doc("8000000002.001", "2026-04-09", [L("B", 120)]),
    // not delivered yet: only the .000
    doc("8000000003.000", "2026-05-01", [L("C", 80)]),
    // a credit note stands on its own
    doc("G00000001.000", "2026-05-02", [L("A", -30)]),
  ];
  const once = Object.fromEntries(rowsOf(aggregate(docs, { ...O, basis: "orders" })).map((r) => [r.article, r.revenueCy]));
  assert.deepEqual(once, { A: 70, B: 300, C: 80 });
  const docsBasis = Object.fromEntries(rowsOf(aggregate(docs, { ...O, basis: "documents" })).map((r) => [r.article, r.revenueCy]));
  assert.deepEqual(docsBasis, { A: 170, B: 420, C: 80 });
});

test("like for like: last year to the same day, and all of last year beside it", () => {
  const docs = [
    doc("1.000", "2026-02-01", [L("A", 500)]),
    doc("2.000", "2025-02-01", [L("A", 400)], "100-2"),
    doc("3.000", "2025-10-05", [L("A", 50)], "100-3"),  // the same day last year: in
    doc("4.000", "2025-10-06", [L("A", 900)], "100-4"), // the day after: full year only
    doc("5.000", "2024-12-31", [L("A", 999)]),          // neither year
  ];
  const [a] = rowsOf(aggregate(docs, { ...O, basis: "orders" }));
  assert.equal(a.revenueCy, 500);
  assert.equal(a.revenueLyYtd, 450);
  assert.equal(a.revenueLy, 1350);
  assert.equal(a.delta, 50);
  assert.equal(a.deltaPct, 11.1);
  assert.equal(a.customersCy, 1);
  assert.equal(a.customersLyYtd, 2);
  assert.equal(a.customersLy, 3);
});

test("kpis: new, gone quiet, growing and falling, per profit centre", () => {
  const docs = [
    doc("1.000", "2026-02-01", [L("UP", 300, 1, "KT"), L("NEW", 70, 1, "DT")]),
    doc("2.000", "2025-02-01", [L("UP", 100, 1, "KT"), L("QUIET", 40, 1, "DT")]),
    doc("3.000", "2025-11-01", [L("LATE", 60, 1, "DT")]), // sold last year after today's date only
  ];
  const k = kpis(rowsOf(aggregate(docs, { ...O, basis: "orders" })));
  assert.equal(k.totalCy, 370);
  assert.equal(k.totalLyYtd, 140);
  assert.equal(k.totalLy, 200);
  assert.equal(k.delta, 230);
  assert.equal(k.gainers, 2);
  assert.equal(k.losers, 1);
  assert.equal(k.newArticles, 1); // NEW: LATE was sold last year, so it is not new
  assert.equal(k.newRevenueCy, 70);
  assert.equal(k.lostArticles, 1); // QUIET: LATE's sale lies after today's date
  assert.deepEqual(k.byPc.map((p) => [p.pc, p.cy, p.lyYtd]), [["KT", 300, 100], ["DT", 70, 40]]);
});

test("movers leave accounting lines out; filters and sorting", () => {
  const docs = [
    doc("1.000", "2026-02-01", [L("1110000001", 300, 1, "KT", "Seal"), L("3394560", 900, 1, "?", "credit")]),
    doc("2.000", "2025-02-01", [L("1110000002", 200, 1, "DT", "Hose")]),
  ];
  const rows = rowsOf(aggregate(docs, { ...O, basis: "orders" }));
  const m = movers(rows);
  assert.deepEqual(m.top.map((r) => r.article), ["1110000001"]);
  assert.deepEqual(m.flop.map((r) => r.article), ["1110000002"]);
  assert.deepEqual(filterRows(rows, { pc: "DT" }).map((r) => r.article), ["1110000002"]);
  assert.deepEqual(filterRows(rows, { q: "seal" }).map((r) => r.article), ["1110000001"]);
  assert.deepEqual(sortRows(rows, "deltaAsc").map((r) => r.article)[0], "1110000002");
});
