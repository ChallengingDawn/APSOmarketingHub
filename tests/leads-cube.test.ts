import assert from "node:assert/strict";
import { test } from "node:test";
import { answersOf, channelOf, flowOf, howOf, monthly, outcomeOf, pathBy, pathOf, qualOf, sumPaths, type LeadRow, type LeadsData } from "../src/lib/marketingKpis/leadsCube";

test("where a lead came from: HubSpot's original source and its details", () => {
  assert.equal(channelOf("PAID_SEARCH", "brand (deutsch)", "Google"), "sea-google");
  assert.equal(channelOf("PAID_SEARCH", "bing", ""), "sea-microsoft");
  assert.equal(channelOf("ORGANIC_SEARCH", "Unknown keywords (SSL)", ""), "seo");
  assert.equal(channelOf("AI_REFERRALS", "chatgpt.com", ""), "ai");
  // the shop's registration page is a step, not a source: a direct visit is direct
  assert.equal(channelOf("DIRECT_TRAFFIC", "www.apsoparts.com/de-de/customer/account/create", ""), "direct");
  assert.equal(channelOf("DIRECT_TRAFFIC", "www.apsoparts.com/en-int", ""), "direct");
  assert.equal(channelOf("OFFLINE", "CONVERSATIONS", ""), "chat");
  assert.equal(channelOf("OFFLINE", "CHATSPOT", ""), "chat");
  assert.equal(channelOf("OFFLINE", "IMPORT", ""), "import");
  assert.equal(channelOf("OFFLINE", "CRM_UI", ""), "sales");
  assert.equal(channelOf(null, null, null), "other");
});

test("the owner's qualification: yes in any wording, no, or not yet", () => {
  assert.equal(qualOf("Yes"), 1);
  assert.equal(qualOf("Yes - registered by ESO"), 1);
  assert.equal(qualOf("Yes – registered with ESO-Support"), 1);
  assert.equal(qualOf("No"), 0);
  assert.equal(qualOf(""), null);
  assert.equal(qualOf(null), null);
});

const row = (p: Partial<LeadRow>): LeadRow => ({ m: "2026-03", c: "seo", h: "shop", k: "Switzerland", o: "1", n: 1, q: null, s: false, via: null, td: false, f: null, a: false, orders: 0, rev: 0, ...p });
const data = (rows: LeadRow[]): LeadsData => ({ rows, owners: {}, year: 2026, monthsDone: 9, contacts: {}, readAt: "", errors: {} });

test("the path of the months chosen, against the same months a year earlier", () => {
  const d = data([
    row({ m: "2026-02", n: 2, s: true, q: 1, f: "2026-03", orders: 3, rev: 1200 }),
    row({ m: "2026-05", c: "sea-google", f: "2026-05", a: true, orders: 1, rev: 90 }),
    row({ m: "2026-11" }), // after the window
    row({ m: "2025-04", q: 0 }),
    row({ m: "2025-12" }), // last year, outside the same months
  ]);
  const { cur, prev } = pathOf(d, { start: 0, end: 8 }, {});
  assert.deepEqual([cur.companies, cur.contacts, cur.toSales, cur.qualified, cur.notYet, cur.customers, cur.onOwn, cur.orders, cur.rev], [2, 3, 1, 1, 1, 2, 1, 4, 1290]);
  assert.deepEqual([prev.companies, prev.notQualified], [1, 1]);
  // filtered on a channel
  assert.equal(pathOf(d, { start: 0, end: 8 }, { channel: ["sea-google"] }).cur.companies, 1);
  // broken down by channel
  const by = pathBy(d, { start: 0, end: 8 }, {}, (r) => r.c);
  assert.equal(by.get("seo")?.cur.companies, 1);
  assert.equal(by.get("seo")?.prev.companies, 1);
  assert.equal(by.get("sea-google")?.cur.onOwn, 1);
});

test("the UC2 task counts as the way to sales, and the leads flow through the steps", () => {
  const d = data([
    row({ s: true, via: "task", td: true, q: null }),
    row({ s: true, via: "ticket", q: 1, f: "2026-04" }),
    row({ c: "sea-google", q: 0 }),
    row({ c: "chat", f: "2026-03", a: true }),
  ]);
  const { cur } = pathOf(d, { start: 0, end: 8 }, {});
  assert.deepEqual([cur.toSales, cur.viaTask, cur.viaTicket, cur.notYet, cur.taskDoneNoAnswer], [2, 1, 1, 2, 1]);
  const fl = flowOf(d, { start: 0, end: 8 }, {}, ["source", "contact", "outcome"], 2);
  // two sources by name (seo has 2), the rest together
  assert.equal(fl.totals["source:seo"], 2);
  assert.equal(fl.totals["source:rest"], 1);
  // the task and the ticket are one way to sales
  assert.equal(fl.totals["contact:sales"], 2);
  assert.equal(fl.totals["contact:none"], 2);
  // the buyers split: after a sales contact, or on their own (before any task or ticket)
  assert.equal(fl.totals["o:sales"], 1);
  assert.equal(fl.totals["o:own"], 1);
  const l = fl.links.find((x) => x.from === "source:seo" && x.to === "contact:sales");
  assert.equal(l?.value, 2);
  // every lead leaves each step once
  assert.equal(fl.links.filter((x) => x.from.startsWith("source:")).reduce((a, x) => a + x.value, 0), 4);
  // the nodes top to bottom: biggest source first, the rest last; the task before the ticket before none
  assert.deepEqual(fl.nodes.map((n) => n.id), ["source:seo", "source:sea-google", "source:rest", "contact:sales", "contact:none", "o:sales", "o:own", "o:none"]);
  const all = flowOf(d, { start: 0, end: 8 }, {}, ["all", "qualification"]);
  assert.equal(all.totals.all, 4);
  assert.deepEqual(all.nodes.map((n) => n.id), ["all", "q:yes", "q:no", "q:open"]);
  assert.deepEqual(d.rows.map(outcomeOf), ["open", "customer", "notQualified", "customer"]);
});

test("how the first contact was made: the shop, a person, the chat, a form", () => {
  assert.equal(howOf("INTEGRATION", "Magento Integration"), "shop");
  assert.equal(howOf("FORM", "Magento Last Order Summary Form"), "shop");
  assert.equal(howOf("CRM_UI", null), "person");
  assert.equal(howOf("EXTENSION", ""), "person");
  assert.equal(howOf("MOBILE_IOS", "Business card scanner"), "person");
  assert.equal(howOf("FORM", "EVENT VISIT REPORT "), "person");
  assert.equal(howOf("CONVERSATIONS", null), "chat");
  assert.equal(howOf("INTEGRATION", "APSOassistant"), "chat");
  assert.equal(howOf("FORM", "DE_Customer Facing | Contact Us Form_2507"), "web");
  assert.equal(howOf("IMPORT", "KT Action.xlsx"), "other");
  assert.equal(howOf(null, null), "other");
  const d = data([row({ h: "person" }), row({ h: "shop", s: true, via: "task" }), row({ h: "person", s: true, via: "ticket" })]);
  assert.equal(pathOf(d, { start: 0, end: 8 }, { how: ["person"] }).cur.companies, 2);
  const fl = flowOf(d, { start: 0, end: 8 }, {}, ["how", "contact"]);
  assert.deepEqual(fl.nodes.map((n) => n.id), ["how:shop", "how:person", "contact:sales", "contact:none"]);
  assert.equal(fl.links.find((l) => l.from === "how:person" && l.to === "contact:none")?.value, 1);
  assert.equal(fl.links.find((l) => l.from === "how:person" && l.to === "contact:sales")?.value, 1);
});

test("month by month for the small graphs: this year and last, the window summed", () => {
  const d = data([
    row({ m: "2026-01", c: "seo", f: "2026-02" }),
    row({ m: "2026-01", c: "chat" }),
    row({ m: "2026-03", c: "seo", s: true, via: "task" }),
    row({ m: "2025-01", c: "seo" }),
    row({ m: "2024-12", c: "seo" }), // two years back: in neither
  ]);
  const all = monthly(d, {});
  assert.deepEqual([all.cy[0].companies, all.cy[2].companies, all.py[0].companies], [2, 1, 1]);
  const seo = monthly(d, {}, (r) => r.c === "seo");
  assert.deepEqual([seo.cy[0].companies, seo.cy[0].customers, seo.cy[2].toSales], [1, 1, 1]);
  const jq = sumPaths(seo.cy.slice(0, 3));
  assert.deepEqual([jq.companies, jq.customers, jq.toSales], [2, 1, 1]);
  assert.equal(monthly(d, { channel: ["chat"] }).cy[0].companies, 1);
});

test("what the owners answered: the answer as written, why not, and why no order", () => {
  const d = data([
    row({ q: 1, qv: "Yes - registered by ESO", f: "2026-04" }),
    row({ q: 1, qv: "Yes - registered by ESO", np: "Delivery time" }),
    row({ q: 1, qv: "Yes - registered on their own", np: "Delivery time;Only looking for info" }),
    row({ q: 0, qv: "No", dr: "Private Customer" }),
    row({ q: 0, qv: "No" }),
    row({ q: null }),
    row({ m: "2025-03", q: 0, dr: "Other" }), // last year: not in the months chosen
  ]);
  const a = answersOf(d, { start: 0, end: 8 }, {});
  assert.equal(a.leads, 6);
  assert.deepEqual(Object.fromEntries(a.answers), { "Yes - registered by ESO": 2, "Yes - registered on their own": 1, No: 2, "Not answered yet": 1 });
  assert.deepEqual(Object.fromEntries(a.why), { "Private Customer": 1, "No reason given": 1 });
  // the qualified who bought are not asked why they did not
  // two reasons in one field count once each
  assert.deepEqual(Object.fromEntries(a.noOrder), { "Delivery time": 2, "Only looking for info": 1 });
});
