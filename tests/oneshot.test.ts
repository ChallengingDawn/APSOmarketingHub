import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAMPAIGNS, callNext, clipWindow, contactDay, contacted, groupOf, pushStatus, pushSummary, reactivationSummary, stateOf,
  ticketCalled, workingDays,
  type PushCard, type PushData, type ReCard,
} from "../src/lib/oneshot/model";

const MARC = CAMPAIGNS.marc; // from 2026-09-22, no end

function card(over: Partial<ReCard>): ReCard {
  return {
    un: "100-1", name: "A AG", value: 1000, potential: 1300, reason: "no order for 9 months", source: "from the list",
    ticket: { id: "t1", stage: "New", closed: false, resolution: null, lastActivity: null, contacted: 0 },
    companyId: "c1", lastContacted: null, lastCall: null, orders: [], ...over,
  };
}

test("groupOf reads the reason the list gave", () => {
  assert.equal(groupOf("no order for 15 months"), "dormant");
  assert.equal(groupOf("down -46% vs last year"), "declining");
  assert.equal(groupOf("biggest buyer, keep them"), "defend");
});

test("workingDays counts Monday to Friday, both ends included", () => {
  assert.equal(workingDays("2026-09-01", "2026-09-30"), 22);
  assert.equal(workingDays("2026-09-05", "2026-09-06"), 0); // a weekend
  assert.equal(workingDays("2026-09-07", "2026-09-07"), 1);
});

test("clipWindow cuts the viewer's period to the action's own days", () => {
  assert.deepEqual(clipWindow(MARC, "2026-09-01", "2026-10-31", "2026-10-05"),
    { from: "2026-09-22", to: "2026-10-05", empty: false, clipped: true });
  assert.deepEqual(clipWindow(CAMPAIGNS.sept, "2026-09-20", "2026-10-05", "2026-10-05"),
    { from: "2026-09-20", to: "2026-09-30", empty: false, clipped: true });
  assert.equal(clipWindow(CAMPAIGNS.sept, "2026-10-01", "2026-10-05", "2026-10-05").empty, true);
  assert.equal(clipWindow(MARC, "2026-09-25", "2026-10-01", "2026-10-05").clipped, false);
});

test("contacted: activity on the ticket OR a contact logged on the company since the start", () => {
  const quiet = card({});
  assert.equal(ticketCalled(quiet), false);
  assert.equal(contacted(quiet, MARC.start), false);
  // the connector's signal alone
  assert.equal(contacted(card({ ticket: { ...quiet.ticket!, lastActivity: "2026-09-25" } }), MARC.start), true);
  assert.equal(contacted(card({ ticket: { ...quiet.ticket!, contacted: 2 } }), MARC.start), true);
  // a call on the company counts, but only from the action's start
  assert.equal(contacted(card({ lastContacted: "2026-09-23" }), MARC.start), true);
  assert.equal(contacted(card({ lastContacted: "2026-09-10" }), MARC.start), false);
  assert.equal(contactDay(card({ lastContacted: "2026-09-23", ticket: { ...quiet.ticket!, lastActivity: "2026-09-29" } }), MARC.start), "2026-09-29");
});

test("stateOf: ordered again beats contacted beats closed", () => {
  const o = { no: "A1", date: "2026-09-30", rev: 120, src: null };
  assert.equal(stateOf(card({ orders: [o], ticket: { id: "t", stage: "Closed", closed: true, resolution: null, lastActivity: null, contacted: 0 } }), MARC.start), "won");
  assert.equal(stateOf(card({ lastContacted: "2026-09-30" }), MARC.start), "contacted");
  assert.equal(stateOf(card({ ticket: { id: "t", stage: "Closed", closed: true, resolution: "No demand", lastActivity: null, contacted: 0 } }), MARC.start), "closed");
  assert.equal(stateOf(card({}), MARC.start), "open");
  // orders that add up to nothing are not a reactivation (the connector's rev > 0)
  assert.equal(stateOf(card({ orders: [{ ...o, rev: 0 }] }), MARC.start), "open");
});

test("reactivationSummary: period figures follow the window, the list figures do not", () => {
  const cards = [
    card({ un: "1", value: 5000, orders: [{ no: "a", date: "2026-09-25", rev: 300, src: null }, { no: "b", date: "2026-10-02", rev: 200, src: null }], lastContacted: "2026-09-23" }),
    card({ un: "2", value: 3000, reason: "down -50%", orders: [{ no: "c", date: "2026-10-03", rev: 700, src: null }] }),
    card({ un: "3", value: 2000, reason: "defend", ticket: { id: "t3", stage: "Closed", closed: true, resolution: "No demand", lastActivity: "2026-09-24", contacted: 1 } }),
    card({ un: "4", value: 9000 }),
  ];
  const data = { cards, today: "2026-10-04", ticketsFound: 4 };
  const all = reactivationSummary(MARC, data, "2026-09-01", "2026-10-31");
  assert.equal(all.customers, 4);
  assert.equal(all.reactivated, 2);
  assert.equal(all.wonBack, 1200);
  assert.equal(all.orders, 3);
  assert.equal(all.contacted, 2);
  assert.equal(all.ticketCalled, 1);
  assert.equal(all.reactivatedAfterContact, 1);
  assert.equal(all.closed, 1);
  assert.equal(all.stillToContact, 2);
  assert.equal(all.valueNotContacted, 12000);
  assert.deepEqual(all.outcomes, [{ label: "No demand", count: 1 }]);
  assert.equal(all.timeline[0].date, "2026-09-22");
  assert.equal(all.timeline.at(-1)!.date, "2026-10-04");
  assert.equal(all.timeline.at(-1)!.cumRevenue, 1200);
  assert.equal(all.timeline.at(-1)!.cumContacted, 2);

  // October only: the September order drops out, the contacts do not
  const oct = reactivationSummary(MARC, data, "2026-10-01", "2026-10-31");
  assert.equal(oct.wonBack, 900);
  assert.equal(oct.reactivated, 2);
  assert.equal(oct.contacted, 2);
  // a period before the action: nothing in it
  const before = reactivationSummary(MARC, data, "2026-08-01", "2026-08-31");
  assert.equal(before.window.empty, true);
  assert.equal(before.wonBack, 0);
});

test("callNext: not contacted, ticket open, no order back - biggest value first", () => {
  const next = callNext(MARC, [
    card({ un: "small", value: 100 }),
    card({ un: "big", value: 9000 }),
    card({ un: "called", value: 99999, lastContacted: "2026-09-30" }),
    card({ un: "back", value: 99999, orders: [{ no: "x", date: "2026-09-30", rev: 10, src: null }] }),
    card({ un: "closed", value: 99999, ticket: { id: "t", stage: "Closed", closed: true, resolution: null, lastActivity: null, contacted: 0 } }),
  ]);
  assert.deepEqual(next.map((c) => c.un), ["big", "small"]);
});

test("pushStatus: as the connector", () => {
  assert.equal(pushStatus(1000, 1000, null), "done");
  assert.equal(pushStatus(1, 1000, null), "partial");
  assert.equal(pushStatus(0, 1000, { id: "t", stage: "Closed", closed: true, resolution: null, resolutionDetail: null, lastActivity: null }), "closed");
  assert.equal(pushStatus(0, 1000, null), "open");
  assert.equal(pushStatus(0, 0, null), "open");
});

function pushCard(over: Partial<PushCard>): PushCard {
  return {
    id: "1", un: "100-1", name: "A", rep: "Jan Kalt", tier: "Week 1", prio: "1", country: null, target: 0, to_get: 1000,
    baseline: 0, booked_before: 0, reasons: [], r25: 0, r26: 0, sep25: 0, offer_amt: 0, ero_amt: 0, last_act: "",
    ticket: null, orders: [], ...over,
  };
}

test("pushSummary: the company month, the asks, the reps and the waves", () => {
  const data: Pick<PushData, "meta" | "cards" | "daily" | "today" | "ticketsFound"> = {
    meta: { campaign: "SEPT PUSH 2026", start: "2026-09-14", end: "2026-09-30", month_start: "2026-09-01", company_target: 2_100_000, reps: ["Jan Kalt", "Yani Alioua"] },
    today: "2026-10-04",
    ticketsFound: 1,
    daily: [{ date: "2026-09-02", rev: 100_000, orders: 10 }, { date: "2026-09-15", rev: 50_000, orders: 4 }],
    cards: [
      pushCard({ un: "1", to_get: 1000, orders: [{ no: "a", date: "2026-09-15", rev: 1200, src: null, pc: null }] }),
      pushCard({ un: "2", to_get: 3000, rep: "Yani Alioua", tier: "E-mail", orders: [{ no: "b", date: "2026-09-29", rev: 500, src: null, pc: null }] }),
      pushCard({ un: "3", to_get: 2000, tier: "Week 2", ticket: { id: "t", stage: "Closed", closed: true, resolution: "No demand", resolutionDetail: null, lastActivity: null } }),
    ],
  };
  const s = pushSummary(data, "2026-09-01", "2026-10-31");
  assert.equal(s.monthOver, true);
  assert.equal(s.bookedMonth, 150_000);
  assert.equal(s.bookedSinceStart, 50_000);
  assert.equal(s.workingDaysDone, 22);
  assert.equal(s.projection, 150_000);
  assert.equal(s.gap, 1_950_000);
  assert.equal(s.bookedOnTargets, 1700);
  assert.equal(s.toGet, 6000);
  assert.equal(s.accountsOrdered, 2);
  assert.equal(s.accountsDone, 1);
  assert.deepEqual(s.cards.map((c) => c.status), ["partial", "closed", "done"]); // biggest ask first
  assert.deepEqual(s.reps.map((r) => [r.rep, r.targets, r.booked, r.done]), [["Jan Kalt", 2, 1200, 1], ["Yani Alioua", 1, 500, 0]]);
  assert.deepEqual(s.waves.map((w) => w.wave), ["Week 1", "Week 2", "E-mail"]);
  assert.deepEqual(s.outcomes, [{ label: "No demand", count: 1 }]);

  // the last week only: the 15.09 order falls out of the accounts, the month stays the month
  const late = pushSummary(data, "2026-09-24", "2026-10-31");
  assert.equal(late.bookedOnTargets, 500);
  assert.equal(late.bookedMonth, 150_000);
});
