import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, buyersOf, rowsOf, type ArticleRow, type Doc, type Line } from "../src/lib/articles/model";
import {
  articlePage, bucketPage, bucketsOf, companiesOf, exploreOf, figuresOf, filtersOf, keyOf, matching, searched, NONE, PRODUCTS_SENT,
} from "../src/lib/articles/explore";

// SARCLA 01.11.2026: "Articles rebuilt like Figures" - the figures, the breakdowns, the article list and the companies
// behind a graph, worked out on the server from the report and the buyers kept beside it.

const L = (art: string, rev: number, pc = "DT", qty = 1): Line => ({ art, rev, qty, pc, text: `text ${art}` });
const doc = (no: string, date: string, ls: Line[], un: string | null): Doc => ({ no, date, un, lines: ls });
const O = { cy: 2026, ly: 2025, today: "2026-11-01", basis: "orders" as const };

const DOCS: Doc[] = [
  doc("1.000", "2026-02-01", [L("A", 500), L("B", 100, "KT")], "100-1"),
  doc("2.000", "2026-03-01", [L("A", 200)], "100-2"),
  doc("3.000", "2025-02-01", [L("A", 400), L("C", 300, "KT")], "100-1"),
  doc("4.000", "2025-12-01", [L("D", 900, "FT")], "100-3"),            // after the same day: all of last year only
  doc("5.000", "2026-04-01", [L("3394560", -50)], "100-2"),             // a credit note: revenue, not an article
  doc("6.000", "2026-05-01", [L("E", 70, "FT")], null),                 // no customer number: revenue, no company
];
const HIER: Record<string, Partial<ArticleRow>> = {
  A: { group: "O-rings", sub: "NBR", product: "P1", productName: "O-Ring NBR" },
  B: { group: "Plates", sub: "PEEK", product: "P2", productName: "PEEK plate" },
  C: { group: "Plates", sub: "PEEK", product: "P2", productName: "PEEK plate" },
};
const CO: Record<string, { id: string; name: string; country: string }> = {
  "100-1": { id: "11", name: "Alpha AG", country: "Switzerland" },
  "100-2": { id: "22", name: "Beta GmbH", country: "Germany" },
};
function build() {
  const agg = aggregate(DOCS, O);
  const rows = rowsOf(agg, (un) => CO[un]?.country ?? null);
  for (const r of rows) Object.assign(r, { group: "", sub: "", product: "", productName: "", ...HIER[r.article] });
  return { rows, buyers: buyersOf(agg, "gen", (un) => CO[un]) };
}

test("the buyers: each article's customer numbers, their company, this year's and last year's same days", () => {
  const { buyers } = build();
  assert.equal(buyers.generated, "gen");
  const name = (i: number) => buyers.companies[i][2] || buyers.companies[i][0];
  const a = buyers.byArticle.A;
  const seen = [];
  for (let i = 0; i < a.length; i += 4) seen.push([name(a[i]), a[i + 1], a[i + 2], a[i + 3]]);
  // Alpha bought A both years (flags 1 + 2), Beta this year only
  assert.deepEqual(seen.sort(), [["Alpha AG", 3, 500, 400], ["Beta GmbH", 1, 200, 0]]);
  // a customer number HubSpot does not know keeps its number, no company
  assert.deepEqual(buyers.companies.find((c) => c[0] === "100-3"), undefined); // D: after the same day - not a buyer here
  // no customer number: no buyer
  assert.equal(buyers.byArticle.E, undefined);
});

test("the figures: revenue in full, articles sold without the accounting lines, new and gone quiet, the companies", () => {
  const { rows, buyers } = build();
  const f = figuresOf(rows, buyers);
  assert.equal(f.revCy, 500 + 100 + 200 - 50 + 70);
  assert.equal(f.revLyYtd, 400 + 300);
  assert.equal(f.revLy, 400 + 300 + 900);
  assert.equal(f.articlesCy, 3);          // A, B, E - not the credit note
  assert.equal(f.articlesLyYtd, 2);       // A, C
  assert.deepEqual([f.fresh, f.freshRev], [2, 170]);   // B and E: not sold at all last year
  assert.deepEqual([f.quiet, f.quietRev], [1, 300]);   // C
  assert.deepEqual([f.companiesCy, f.companiesLyYtd], [2, 1]);
  // without the buyers: no companies, never a guess
  assert.equal(figuresOf(rows).companiesCy, null);
});

test("a breakdown shows every value of its level - its own filter left out - with distinct companies", () => {
  const { rows, buyers } = build();
  const pc = bucketsOf(rows, { pc: ["KT"] }, "pc", buyers);
  assert.deepEqual(pc.map((b) => b.key), ["DT", "KT", "FT"]);
  const dt = pc.find((b) => b.key === "DT")!;
  assert.deepEqual([dt.cy, dt.lyYtd, dt.articlesCy, dt.companiesCy, dt.companiesLyYtd], [650, 400, 1, 2, 1]);
  // another level's filter does apply: only KT's groups
  const groups = bucketsOf(rows, { pc: ["KT"] }, "group", buyers);
  assert.deepEqual(groups.map((b) => [b.key, b.cy, b.lyYtd, b.fresh, b.quiet]), [["Plates", 100, 300, 1, 1]]);
  // an article Products & Pricing does not know has no group
  assert.ok(bucketsOf(rows, {}, "group", buyers).some((b) => b.key === NONE));
  // a product carries its name and place
  const p2 = bucketsOf(rows, {}, "product").find((b) => b.key === "P2")!;
  assert.deepEqual([p2.name, p2.pc, p2.group, p2.sub, p2.companiesCy], ["PEEK plate", "KT", "Plates", "PEEK", null]);
});

test("the filters: known levels only, values trimmed and short, the same value once", () => {
  const f = filtersOf((d) => (d === "pc" ? ["DT", " DT ", ""] : d === "group" ? "O-rings" : d === "article" ? ["x".repeat(500)] : undefined));
  assert.deepEqual(f.pc, ["DT"]);
  assert.deepEqual(f.group, ["O-rings"]);
  assert.equal(f.article![0].length, 120);
  assert.equal(f.sub, undefined);
  const { rows } = build();
  assert.deepEqual(matching(rows, { product: ["P2"] }).map((r) => r.article).sort(), ["B", "C"]);
  assert.deepEqual(matching(rows, { product: [NONE] }).map((r) => keyOf(r, "product")), [NONE, NONE, NONE]);
  assert.deepEqual(searched(rows, "peek").map((r) => r.article).sort(), ["B", "C"]);
});

test("the article list: the largest first, any column either way, an empty change last, 25 a page", () => {
  const { rows } = build();
  const p = articlePage(rows, {}, {});
  assert.deepEqual(p.rows.map((r) => r.article), ["A", "B", "E", "C", "D", "3394560"]);
  assert.equal(p.total, 6);
  assert.equal(p.sum.revCy, 820);
  assert.equal("byCountryCy" in p.rows[0], false);
  // by the change, the largest fall first when asked the other way
  assert.deepEqual(articlePage(rows, {}, { sort: "delta", desc: false }).rows.map((r) => r.article).slice(0, 2), ["C", "3394560"]);
  // the change in %: articles without last year's same days last, whichever way
  const pctAsc = articlePage(rows, {}, { sort: "deltaPct", desc: false }).rows.map((r) => r.article);
  assert.deepEqual(pctAsc.slice(0, 2), ["C", "A"]);
  // by the number, A first
  assert.equal(articlePage(rows, {}, { sort: "article" }).rows[0].article, "3394560");
  const two = articlePage(rows, {}, { size: 2, page: 1 });
  assert.deepEqual([two.page, two.rows.map((r) => r.article)], [1, ["E", "C"]]);
  assert.equal(articlePage(rows, {}, { size: 2, page: 99 }).page, 2);
});

test("the companies behind a graph: each one's revenue on its articles, the largest first, adding up to the graph", () => {
  const { rows, buyers } = build();
  const all = companiesOf(rows, buyers, {});
  assert.deepEqual(all.rows.map((r) => [r.name, r.cy, r.lyYtd, r.articles, r.articlesLy]), [
    ["Alpha AG", 600, 700, 2, 2],
    ["Beta GmbH", 150, 0, 2, 0],
  ]);
  assert.deepEqual(all.rows.map((r) => [r.id, r.un, r.country]), [["11", "100-1", "Switzerland"], ["22", "100-2", "Germany"]]);
  // the graph's revenue less the line without a customer number
  assert.equal(all.sum.cy, figuresOf(rows).revCy - 70);
  // a column clicked, either way; a name or a customer number found
  assert.deepEqual(companiesOf(rows, buyers, { sort: "lyYtd", desc: false }).rows.map((r) => r.name), ["Beta GmbH", "Alpha AG"]);
  assert.deepEqual(companiesOf(rows, buyers, { sort: "name", desc: true }).rows.map((r) => r.name), ["Beta GmbH", "Alpha AG"]);
  assert.deepEqual(companiesOf(rows, buyers, { q: "100-2" }).rows.map((r) => r.name), ["Beta GmbH"]);
  // only the graph's articles
  const kt = companiesOf(matching(rows, { pc: ["KT"] }), buyers, {});
  assert.deepEqual(kt.rows.map((r) => [r.name, r.cy, r.lyYtd]), [["Alpha AG", 100, 300]]);
  // a buyer HubSpot does not know: its customer number, no link
  const lone = buyersOf(aggregate([doc("9.000", "2026-01-05", [L("Z", 10)], "200-9")], O), "g");
  const z = companiesOf(rowsOf(aggregate([doc("9.000", "2026-01-05", [L("Z", 10)], "200-9")], O)), lone, {});
  assert.deepEqual(z.rows.map((r) => [r.id, r.name]), [["", "Customer 200-9"]]);
});

test("explore: the figures follow every filter, each breakdown leaves out its own, the chosen ones named", () => {
  const { rows, buyers } = build();
  const x = exploreOf(rows, { pc: ["KT"], product: ["P2"], article: ["B"] }, buyers);
  assert.equal(x.figures.revCy, 100);
  // the profit centres' table total: every profit centre, the other filters in force
  assert.equal(x.all.pc.revCy, 100);
  assert.deepEqual(x.by.pc.map((b) => b.key), ["KT"]);
  // the movers leave the article filter out - B and C both show
  assert.deepEqual([x.movers.top.map((r) => r.article), x.movers.flop.map((r) => r.article)], [["B"], ["C"]]);
  assert.deepEqual(x.names, { product: { P2: "PEEK plate" }, article: { B: "text B" } });
  // no filter: the total is the figures'
  const plain = exploreOf(rows, {}, buyers);
  assert.equal(plain.all.group, plain.figures);
});

test("the products a page at a time: found by number, name or group, any column, an empty change last", () => {
  const { rows, buyers } = build();
  const all = bucketsOf(rows, {}, "product", buyers);
  assert.deepEqual(bucketPage(all, {}).rows.map((b) => b.key), ["P1", "P2", NONE]);
  assert.deepEqual(bucketPage(all, { q: "plates" }).rows.map((b) => b.key), ["P2"]);
  assert.deepEqual(bucketPage(all, { q: "p1" }).rows.map((b) => b.key), ["P1"]);
  assert.deepEqual(bucketPage(all, { sort: "lyYtd" }).rows.map((b) => b.key), ["P1", "P2", NONE]);
  // the change in %: none without last year's same days, last either way
  assert.deepEqual(bucketPage(all, { sort: "deltaPct", desc: false }).rows.map((b) => b.key), ["P2", "P1", NONE]);
  // by name from A, a product without one last
  assert.deepEqual(bucketPage(all, { sort: "name" }).rows.map((b) => b.key), ["P1", "P2", NONE]);
  assert.deepEqual(bucketPage(all, { size: 2, page: 1 }).rows.map((b) => b.key), [NONE]);
  // with the figures, only the largest products travel - and how many there are
  const x = exploreOf(rows, {}, buyers);
  assert.equal(x.products, 3);
  assert.ok(x.by.product.length <= PRODUCTS_SENT);
});
