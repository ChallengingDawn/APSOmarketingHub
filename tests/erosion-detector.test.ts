import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WATERMARK, addDays, aggregate, anniversary, aggKey, buildGroups, buildOutlook, countryMinRev, draftTicket,
  memoryFromTickets, positions, pyRound, selectCandidates, swissInt,
  type OrderRec, type Resolved,
} from "../src/lib/erosion/detector";

// The rules are a port of the connector's erosion_load.py; these tests pin the
// places where a port quietly drifts: rounding, the invoice year, the open order,
// the floors, the grouping, the text of the ticket.

const ESO_OWNER = "32968527";          // Yani Alioua (ESO roster)
const LUCA = "1229999587";             // Luca Fantasia: 1000 EUR everywhere

function order(id: string, o: {
  un?: string; date: string; status?: string; inv?: string; type?: string; number?: string;
  lines: { a: string; r: number; t?: string }[];
}): OrderRec {
  const [mand, cust] = (o.un ?? "100-111").split("-");
  return {
    id,
    props: {
      order_mandant: mand, order_customer_number: cust, order_order_date: o.date, order_order_status: o.status ?? "invoiced",
      order_invoice_date: o.inv ?? "", order_order_type: o.type ?? "Order", order_order_number: o.number ?? `A${id}`,
      order_positions_json: JSON.stringify(o.lines.map((l) => ({ article: l.a, revenue: l.r, text: l.t ?? "" }))),
    },
  };
}

test("pyRound rounds half to even, like Python's round()", () => {
  assert.equal(pyRound(0.5), 0);
  assert.equal(pyRound(1.5), 2);
  assert.equal(pyRound(2.5), 2);
  assert.equal(pyRound(2.51), 3);
  assert.equal(pyRound(1234.4), 1234);
});

test("swissInt groups thousands with an apostrophe", () => {
  assert.equal(swissInt(1234), "1'234");
  assert.equal(swissInt(1234567), "1'234'567");
  assert.equal(swissInt(999), "999");
});

test("countryMinRev: Swiss mandant 1000, everyone else 500", () => {
  assert.equal(countryMinRev("100-1"), 1000);
  assert.equal(countryMinRev("110-1"), 500);
});

test("positions: fixmap repairs internal ids; text falls back to the fixmap's", () => {
  const p = positions({ order_positions_json: JSON.stringify([{ a: "22407406", r: 10 }, { article: "", r: 5 }]) },
    { "22407406": { n: "8001219968", t: "Timing belt" } });
  assert.deepEqual(p, [{ article: "8001219968", text: "Timing belt", rev: 10 }]);
  assert.deepEqual(positions({ order_positions_json: "not json" }, {}), []);
});

test("aggregate: only invoiced documents count; an open current-year order marks the pair", () => {
  const { agg, noCust } = aggregate([
    order("1", { date: "2025-03-01", inv: "2025-03-10", lines: [{ a: "1111111111", r: 700 }] }),
    // the .000 'entered' twin of the same goods - not money
    order("2", { date: "2025-03-01", status: "entered", lines: [{ a: "1111111111", r: 700 }] }),
    order("3", { date: "2026-02-01", status: "entered", lines: [{ a: "1111111111", r: 50 }] }),
    order("4", { date: "2025-01-01", type: "Credit note", lines: [{ a: "1111111111", r: -700 }] }),
    order("5", { un: "-", date: "2025-01-01", lines: [{ a: "1111111111", r: 1 }] }),
    order("6", { date: "2025-05-05", lines: [{ a: "12345", r: 9999 }] }),          // not 10 digits
  ], {});
  const a = agg.get(aggKey("100-111", "1111111111"))!;
  assert.equal(a.revPrev, 700);
  assert.equal(a.cntPrev, 1);
  assert.equal(a.openCur, true);
  assert.equal(a.lastInvPrev, "2025-03-10");
  assert.equal(noCust, 1);
  assert.equal(agg.size, 1);
});

test("anniversary runs from the invoice date, else the order date", () => {
  const { agg } = aggregate([order("1", { date: "2025-09-08", inv: "2025-10-20", lines: [{ a: "1111111111", r: 2000 }] })], {});
  assert.equal(anniversary(agg.get(aggKey("100-111", "1111111111"))!), "2026-10-20");
  assert.equal(addDays("2025-02-28", 365), "2026-02-28");
});

test("selectCandidates: floor, forward-only window, open order counted, dedup key", () => {
  const { agg } = aggregate([
    order("1", { date: "2025-09-30", inv: "2025-10-02", lines: [{ a: "1111111111", r: 1500 }] }),   // lapses 2026-10-02
    order("2", { date: "2025-09-30", inv: "2025-10-02", lines: [{ a: "2222222222", r: 900 }] }),    // under the CH floor
    order("3", { date: "2025-08-01", inv: "2025-08-01", lines: [{ a: "3333333333", r: 1500 }] }),   // lapsed before the watermark
    order("4", { date: "2025-09-30", inv: "2025-10-02", lines: [{ a: "4444444444", r: 1500 }] }),
    order("5", { date: "2026-03-01", status: "entered", lines: [{ a: "4444444444", r: 1 }] }),      // buying it now
    order("6", { date: "2025-09-30", inv: "2025-10-02", lines: [{ a: "5555555555", r: 1500 }] }),
    order("7", { date: "2026-03-01", inv: "2026-03-02", lines: [{ a: "5555555555", r: 100 }] }),    // bought this year
    // ordered 16.07, invoiced 16.09.2025: the invoice year lapses 16.09.2026 - before the 01.10 rules, so never
    order("8", { date: "2025-07-16", inv: "2025-09-16", lines: [{ a: "6666666666", r: 1500 }] }),
  ], {});
  const r = selectCandidates(agg, { horizon: "2026-10-04", keys: new Set() });
  assert.deepEqual(r.cands.map((c) => c.art), ["1111111111"]);
  assert.equal(r.openOrders, 1);
  assert.equal(r.cands[0].key, "100-111|1111111111|2026");
  assert.equal(selectCandidates(agg, { horizon: "2026-10-04", keys: new Set(["100-111|1111111111|2026"]) }).cands.length, 0);
  assert.equal(WATERMARK, "2026-10-01");
});

function resolvedFor(agg: ReturnType<typeof aggregate>["agg"], owner: string): Resolved[] {
  return selectCandidates(agg, { horizon: "2026-10-31", keys: new Set() }).cands.map((c) => ({
    ...c, company: { id: "c1", name: "PrÃ¤zisions AG", ownerId: owner }, owner,
  }));
}

test("buildGroups: one group per company and month, owner floor, off-roster skip", () => {
  const { agg } = aggregate([
    order("1", { un: "110-9", date: "2025-10-01", inv: "2025-10-02", lines: [{ a: "1111111111", r: 800 }] }),
    order("2", { un: "110-9", date: "2025-10-10", inv: "2025-10-12", lines: [{ a: "2222222222", r: 3000 }] }),
  ], {});
  const eso = buildGroups(resolvedFor(agg, ESO_OWNER), agg, new Map());
  assert.equal(eso.groups.size, 1);
  const g = [...eso.groups.values()][0];
  assert.equal(g.mkey, "110-9|2026-10");
  assert.equal(g.members.length, 2);
  assert.equal(g.name, "Präzisions AG");
  // Luca: 800 is under his 1000 floor though above the 500 country rule
  const luca = buildGroups(resolvedFor(agg, LUCA), agg, new Map());
  assert.deepEqual(luca.report.skippedThreshold.map((x) => x.amount), [800]);
  // an owner on neither roster gets nothing, visibly
  const off = buildGroups(resolvedFor(agg, "999"), agg, new Map());
  assert.equal(off.groups.size, 0);
  assert.equal(off.report.skippedOwner.length, 2);
});

test("buildGroups puts this month's earlier articles back onto the merged ticket", () => {
  const { agg } = aggregate([
    order("1", { un: "110-9", date: "2025-10-01", inv: "2025-10-02", lines: [{ a: "1111111111", r: 800 }] }),
    order("2", { un: "110-9", date: "2025-10-10", inv: "2025-10-12", lines: [{ a: "2222222222", r: 3000 }] }),
  ], {});
  // 1111 already ticketed this month as T1; today only 2222 is a candidate
  const cands = selectCandidates(agg, { horizon: "2026-10-31", keys: new Set(["110-9|1111111111|2026"]) }).cands
    .map((c) => ({ ...c, company: { id: "c1", name: "X", ownerId: ESO_OWNER }, owner: ESO_OWNER }));
  const { groups } = buildGroups(cands, agg, new Map([["110-9|2026-10", { tid: "T1", arts: ["1111111111"] }]]));
  assert.deepEqual([...groups.values()][0].members.map((m) => m.art).sort(), ["1111111111", "2222222222"]);
});

test("draftTicket: the subject, the sums and the properties the connector writes", () => {
  const { agg } = aggregate([
    order("1", { un: "110-9", date: "2025-10-01", inv: "2025-10-02", number: "A1", lines: [{ a: "1111111111", r: 800.5 }] }),
    order("2", { un: "110-9", date: "2025-10-10", inv: "2025-10-12", number: "A2", lines: [{ a: "2222222222", r: 4200 }] }),
  ], {});
  const { groups } = buildGroups(resolvedFor(agg, ESO_OWNER), agg, new Map());
  const d = draftTicket([...groups.values()][0], { "2222222222": "Seal kit", "1111111111": "" });
  assert.equal(d.title, "EROSION | 2 articles | 5'000 EUR | Präzisions AG");
  assert.equal(d.total, 5000);                          // 800.5 + 4200 = 5000.5 -> half to even
  assert.deepEqual(d.arts, ["2222222222", "1111111111"]); // highest revenue first
  assert.equal(d.props.erosion_key, "110-9|2222222222|2026");
  assert.equal(d.props.hs_ticket_priority, "HIGH");     // >= 5000, as the connector
  assert.equal(d.props.erosion_order_numbers, "A1; A2");
  assert.equal(d.props.erosion_article_description, "2 articles: 2222222222, 1111111111");
  assert.equal(d.props.hs_pipeline, "1726599376");
  assert.equal(d.props.tags, "erosion");
  assert.match(String(d.props.content), /^EROSION - Win-back\n\nThe customer bought these 2 articles in 2025/);
  assert.match(String(d.props.content), /Total at risk: 5'000 EUR\n/);
  assert.match(String(d.props.content), /Team:          ESO \(Yani Alioua\)/);
});

test("buildOutlook: one entry per company and month, due on the first lapse, to 31 December", () => {
  const { agg } = aggregate([
    order("1", { un: "110-9", date: "2025-11-03", inv: "2025-11-05", lines: [{ a: "1111111111", r: 600.5 }] }),
    order("2", { un: "110-9", date: "2025-11-20", inv: "2025-11-21", lines: [{ a: "2222222222", r: 700 }] }),
    order("3", { un: "110-8", date: "2025-10-01", inv: "2025-10-01", lines: [{ a: "3333333333", r: 900 }] }),   // already lapsed
  ], {});
  const o = buildOutlook(agg, {
    today: "2026-10-04", keys: new Set(),
    companyOf: () => ({ name: "Co", ownerId: ESO_OWNER }), ownerName: () => undefined,
  });
  assert.equal(o.days, 88);
  assert.equal(o.items.length, 1);
  assert.deepEqual(o.items[0], {
    due: "2026-11-05", un: "110-9", month: "2026-11", company: "Co", amount: 1300, // 600.5 -> 600 (even) + 700
    articles: ["1111111111", "2222222222"], article: "2 articles", team: "ESO", owner: "Yani Alioua",
  });
});

test("memoryFromTickets: every article on a ticket is a key; imported keys are kept", () => {
  const { agg } = aggregate([order("1", { un: "110-9", date: "2025-10-01", inv: "2025-10-02", lines: [{ a: "1111111111", r: 800 }] })], {});
  const m = memoryFromTickets([{ id: "T1", un: "110-9", articles: ["1111111111", "2222222222"], created: "2026-10-02" }], agg, ["100-1|9999999999|2026"]);
  assert.equal(m.keys.size, 3);
  assert.deepEqual(m.month.get("110-9|2026-10"), { tid: "T1", arts: ["1111111111", "2222222222"] });
});
