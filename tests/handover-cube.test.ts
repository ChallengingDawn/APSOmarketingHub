import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, flowOf, outcomeOf, statsBy, statsOf, winRate, workingHours, type HandoverData, type HandoverRow } from "../src/lib/marketingKpis/handoverCube";

const LIFECYCLE = { UC2_v2_New_Leads_Tickets_2609: "uc2", UC15_Lost_Leads_TICKETS_2607_FEHDIA: "uc15", UC6_v2_FIRST_PURCHASE_NPS_TICKETS_2604: "uc6" };

test("what a ticket is: a customer's request, a new registrant, a lifecycle hand-over - or left out", () => {
  // the help desk made it from what the customer sent
  assert.deepEqual(classify({ subject: "Anfrage O-Ringe", sourceType: "EMAIL", objectSource: "CONVERSATIONS" }, LIFECYCLE), { g: "request", c: "email" });
  assert.deepEqual(classify({ subject: "Customer Form | price", sourceType: "FORM", objectSource: "CONVERSATIONS" }, LIFECYCLE), { g: "request", c: "form" });
  assert.deepEqual(classify({ subject: "Hello", sourceType: "CHAT", objectSource: "BOT" }, LIFECYCLE), { g: "request", c: "chat" });
  // typed in by a person, still the customer's request (the "Direct ESO request" trap)
  assert.deepEqual(classify({ subject: "Direct ESO request | Product Price |", objectSource: "CRM_UI" }, LIFECYCLE), { g: "request", c: "direct" });
  assert.deepEqual(classify({ subject: "BO | Email | price", objectSource: "INTEGRATION" }, LIFECYCLE), { g: "request", c: "bo" });
  // the lifecycle workflows, by the workflow that made the ticket or by its tag
  assert.deepEqual(classify({ subject: "New lead", objectSource: "AUTOMATION_PLATFORM", workflow: "UC2_v2_New_Leads_Tickets_2609" }, LIFECYCLE), { g: "newlead", c: "uc2" });
  assert.deepEqual(classify({ subject: "x", objectSource: "AUTOMATION_PLATFORM", workflow: "UC15_Lost_Leads_TICKETS_2607_FEHDIA" }, LIFECYCLE), { g: "lifecycle", c: "uc15" });
  assert.deepEqual(classify({ subject: "x", tags: "40108945" }, LIFECYCLE), { g: "lifecycle", c: "uc9" });
  // left out
  assert.ok("skip" in classify({ subject: "TSA | MAIL TO CUSTOMER | RESOLUTION : x", outbound: "true" }, LIFECYCLE));
  assert.ok("skip" in classify({ subject: "x", sourceType: "EMAIL", objectSource: "CONVERSATIONS", resolution: "Not a sales topic" }, LIFECYCLE));
  assert.ok("skip" in classify({ subject: "TSA | MAIL FROM FINANCE | invoice", sourceType: "EMAIL", objectSource: "CONVERSATIONS" }, LIFECYCLE));
  assert.ok("skip" in classify({ subject: "EROSION | Muster AG", objectSource: "INTEGRATION", tags: "42249278" }, LIFECYCLE));
  // sales asking inside the company is not a customer's lead
  assert.ok("skip" in classify({ subject: "Special price request | Muster AG", objectSource: "CRM_UI" }, LIFECYCLE));
  // a ticket on the wrong desk, and TSA's non qualified - each named in the footnote
  assert.deepEqual(classify({ subject: "x", sourceType: "EMAIL", objectSource: "CONVERSATIONS", resolution: "Misassigned" }, LIFECYCLE), { skip: "misassigned" });
  assert.deepEqual(classify({ subject: "x", sourceType: "EMAIL", objectSource: "CONVERSATIONS", resolution: "TSA NON QUALIFIED" }, LIFECYCLE), { skip: "TSA non qualified" });
});

test("what became of it: won is ordered - or qualified for a new registrant", () => {
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Ordered" }), "won");
  assert.equal(outcomeOf({ g: "request", x: 1, r: "One-shot C2S order" }), "won");
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Sent offer (Note the result)" }), "other");
  assert.equal(outcomeOf({ g: "newlead", x: 1, r: "Qualified - Registered by ESO" }), "won");
  assert.equal(outcomeOf({ g: "newlead", x: 1, r: "Disqualified - Private Customer" }), "disq");
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Price is too high in Sealing" }), "price");
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Can't supply the item" }), "supply");
  // "Only looking for info" is a lost sale
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Only looking for info" }), "info");
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Delivery time/cost" }), "delivery");
  assert.equal(outcomeOf({ g: "request", x: 0 }), "open");
  // closed, no resolution set: not "closed otherwise" in disguise
  assert.equal(outcomeOf({ g: "request", x: 1 }), "nores");
});

test("working hours: Monday to Friday, 8 to 17 in Zurich", () => {
  const z = (iso: string) => Date.parse(iso); // in UTC; Zurich is UTC+2 in summer, +1 in winter
  // Wed 1 Oct 2026, 09:00 -> 11:00 Zurich (07:00 -> 09:00 UTC)
  assert.equal(workingHours(z("2026-10-01T07:00:00Z"), z("2026-10-01T09:00:00Z")), 2);
  // Fri 16:00 -> Mon 09:00 Zurich: one hour on Friday, one on Monday
  assert.equal(workingHours(z("2026-10-02T14:00:00Z"), z("2026-10-05T07:00:00Z")), 2);
  // the weekend only
  assert.equal(workingHours(z("2026-10-03T08:00:00Z"), z("2026-10-04T16:00:00Z")), 0);
  // in winter (UTC+1): Mon 7 Dec 2026, 07:30 -> 08:30 Zurich = half an hour of work
  assert.equal(workingHours(z("2026-12-07T06:30:00Z"), z("2026-12-07T07:30:00Z")), 0.5);
});

const row = (p: Partial<HandoverRow>): HandoverRow => ({ m: "2026-03", t: "ESO", g: "request", c: "email", k: "Switzerland", o: "1", x: 0, a: null, z: 3, ...p });
const data = (rows: HandoverRow[]): HandoverData => ({ rows, owners: {}, year: 2026, monthsDone: 9, readAt: "", errors: {}, skipped: {} });

test("the figures: a first contact (reply or call) within a working day, win rate on the resolved, open and stale", () => {
  const d = data([
    row({ a: 2, x: 1, r: "Ordered", z: 4 }),
    row({ a: 20, x: 1, r: "Only looking for info", z: 10 }),
    row({ a: null, x: 1, z: 2 }), // closed with no reply and no resolution
    row({ t: "TSA", a: 1, x: 0, z: 40 }), // open, stale
    row({ m: "2025-03", a: 3, x: 1, r: "Ordered" }),
    row({ g: "lifecycle", c: "uc15", a: null, x: 1, r: "No reply", z: 9 }), // a hand-over nobody called
  ]);
  const { cur, prev } = statsOf(d, { start: 0, end: 8 }, {});
  assert.deepEqual([cur.incoming, cur.inDay, cur.noReply, cur.closed, cur.resolved, cur.won, cur.open, cur.stale], [5, 2, 2, 4, 3, 1, 1, 1]);
  assert.equal(Math.round(winRate(cur)!), 33);
  assert.equal(prev.won, 1);
  const by = statsBy(d, { start: 0, end: 8 }, {}, (r) => r.t);
  assert.equal(by.get("TSA")?.cur.incoming, 1);
  assert.equal(statsOf(d, { start: 0, end: 8 }, { team: ["TSA"] }).cur.incoming, 1);
  const fl = flowOf(d, { start: 0, end: 8 }, {});
  assert.equal(fl.totals["t:ESO"], 4);
  assert.equal(fl.totals["o:won"], 1);
  assert.equal(fl.totals["s:none"], 2);
  // why: the lost by their reason, the closed otherwise by theirs - won and open end at the outcome
  assert.equal(fl.columns.length, 5);
  assert.equal(fl.totals["w:l:info"], 1);
  assert.equal(fl.totals["w:l:noreply"], 1);
  assert.equal(fl.totals["w:o:none"], 1);
  assert.ok(!fl.links.some((l) => l.from === "o:won" || l.from === "o:open"));
  // one kind at a time: the UC hand-overs alone
  assert.equal(flowOf(d, { start: 0, end: 8 }, { kind: ["newlead", "lifecycle"] }).totals["c:uc15"], 1);
});
