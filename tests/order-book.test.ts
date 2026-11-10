import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, type Cube } from "../src/lib/marketingKpis/cube";
import type { Ledger } from "../src/lib/marketingKpis/ledger";
import {
  OrderBookSheet, bookBySae, bookQuarters, ledgerLookups, monthOfCell, pcCode, sumBooks, type OrderBookKept,
} from "../src/lib/reporting/orderBookRules";

// Bernd Rausmann on My Sales Reports > Targets (SARCLA 10.11.2026): "show the relevant order book and the % of order book
// against the target" - the ERP's order book (BI measure OB_NET_REV_EUR) by customer, profit centre and delivery date.

const HEAD = ["[Customer]", "[ProfitCenter]", "[DeliveryDate]", "[OrderBookEUR]"];

test("the sheet: its header by its columns, then a sum per customer, profit centre and month due", () => {
  const s = new OrderBookSheet();
  s.feed(1, ["notes above the query"]); // not the header
  s.feed(2, HEAD);
  s.feed(3, ["100-700527", "DT", 46337, 1200.5]); // 46337 = 2026-11-11
  s.feed(4, ["100-700527", "DT", "2026-11-28", 300]); // same month: added up
  s.feed(5, ["100-700527", "KT", "15.01.2027", "450"]);
  s.feed(6, ["110-55", "ASW", null, 80]); // the hoses' old code; no date
  s.feed(7, ["300-1", "DT", 46337, 999]); // another mandant: left out
  s.feed(8, ["100-9", "DT", 46337, 0]); // nothing on order
  s.feed(9, ["", "", "", ""]); // a blank row at the end
  const r = s.finish()!;
  assert.deepEqual(r.book, [["100-700527", "dt", "2026-11", 1500.5], ["100-700527", "kt", "2027-01", 450], ["110-55", "ft", "", 80]]);
  assert.equal(r.rows, 6); // the blank row is no row
  assert.equal(r.skipped, 2);
  assert.equal(r.customers, 2);
  assert.equal(r.total, 2031);
  // a sheet without the header: nothing
  const none = new OrderBookSheet();
  none.feed(1, ["[Order]", "[InvoiceNumber]"]);
  assert.equal(none.finish(), null);
});

test("the ERP's profit centres as the cube spells its own; a month from any date cell", () => {
  assert.deepEqual(["DT", " kt ", "FT", "ASW", "PW", "WS", "", "Service"].map(pcCode), ["dt", "kt", "ft", "ft", "pw", "ws", "other", "other"]);
  assert.equal(monthOfCell(46337), "2026-11");
  assert.equal(monthOfCell("2026-03-31T00:00:00"), "2026-03");
  assert.equal(monthOfCell("02.04.2026"), "2026-04");
  assert.equal(monthOfCell(new Date(Date.UTC(2026, 6, 1))), "2026-07");
  assert.equal(monthOfCell(""), "");
});

test("a book on the year's quarters: overdue and undated in the running one, the rest in the quarter it is due, next year apart", () => {
  // November 2026: Q4 runs (3)
  const b = bookQuarters({ "": 10, "2025-12": 20, "2026-02": 30, "2026-11": 40, "2026-12": 50, "2027-01": 60 }, 2026, 3);
  assert.deepEqual(b, { q: [0, 0, 0, 150], later: 60 });
  // May 2026: Q2 runs (1) - what is due in Q3 and Q4 stays there
  assert.deepEqual(bookQuarters({ "2026-01": 5, "2026-05": 10, "2026-08": 20, "2026-10": 30 }, 2026, 1), { q: [0, 15, 20, 30], later: 0 });
});

/** Two people's customers: Adem (two companies, one of them new this year) and Sara (one); one customer has no company. */
function world() {
  const sae = DIMS.indexOf("sae");
  const cell = (who: number) => DIMS.map((_, i) => (i === sae ? who : 0)).concat([1, 0]);
  const labels = Object.fromEntries(DIMS.map((d) => [d, d === "sae" ? ["Adem Can", "Sara Muster"] : ["x"]])) as Cube["labels"];
  const cube = { cells: [cell(0), cell(1)], labels };
  const ledger: Pick<Ledger, "ids" | "cells" | "firsts" | "rev" | "orders"> = {
    ids: ["11", "12", "21", "13"],
    cells: [0, 0, 1, 0],
    firsts: [[1, 26], [2, 14]], // 12: first invoice March this year (24 = January); 21: last year
    rev: [[0, 1, 5], [1, 0, 7], [2, 1, 3]], // 13 never invoiced in the three years
    orders: [[3, 20261002, 20261002], [0, 20180101, 20261001]], // 13: first order ever this October
  };
  return { cube, ledger };
}

test("each customer's book goes to its company's SAE; the new customers' to the new-customer target too", () => {
  const { cube, ledger } = world();
  const { saeOf, isNew } = ledgerLookups(cube, ledger, 2026);
  assert.equal(saeOf("12"), "Adem Can");
  assert.equal(saeOf("21"), "Sara Muster");
  assert.equal(saeOf("99"), undefined);
  assert.deepEqual(["11", "12", "21", "13"].map(isNew), [false, true, false, true]);
  const kept: OrderBookKept = { v: 1, at: "2026-11-10T06:00:00Z", day: "2026-11-10", file: "f.xlsx", rows: 6, total: 0, customers: 5, book: [
    ["100-1", "dt", "2026-11", 100], ["100-1", "ft", "2026-12", 50], // Adem's old customer
    ["100-2", "kt", "", 70], // Adem's new customer
    ["110-3", "dt", "2027-02", 40], // Sara's
    ["100-4", "at", "2026-11", 30], // a new customer by its first order, Adem's
    ["100-5", "dt", "2026-11", 999], // no company in HubSpot
  ] };
  const companies = new Map([["100-1", "11"], ["100-2", "12"], ["110-3", "21"], ["100-4", "13"]]);
  const by = bookBySae(kept, (u) => companies.get(u), saeOf, isNew);
  assert.deepEqual(by.sae["Adem Can"], {
    own: { "2026-11": 130, "2026-12": 50, "": 70 }, dt: { "2026-11": 100 }, kt: { "": 70 }, new: { "": 70, "2026-11": 30 },
  });
  assert.deepEqual(by.sae["Sara Muster"], { own: { "2027-02": 40 }, dt: { "2027-02": 40 }, kt: {}, new: {} });
  assert.deepEqual(by.unmatched, { customers: 1, eur: 999 });
  // a team adds its people up; someone with no book adds nothing
  const team = sumBooks([by.sae["Adem Can"], by.sae["Sara Muster"], undefined]);
  assert.deepEqual(team.own, { "2026-11": 130, "2026-12": 50, "": 70, "2027-02": 40 });
  assert.deepEqual(bookQuarters(team.own, 2026, 3), { q: [0, 0, 0, 250], later: 40 });
});
