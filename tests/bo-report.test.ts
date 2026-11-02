import assert from "node:assert/strict";
import { test } from "node:test";
import { gqsTally, kpisOf, monthStart, monthsBetween, orderTally, sumMonths, swissDay, ticketTally, type BoMonth } from "../src/lib/reporting/boReportRules";

// SARCLA 02.11.2026: "and the back office reports based on file?" - the Back Office's KPI workbook worked out live. The
// workbook's January 2026: 4,224 orders and 9,074 order lines, where HubSpot holds 4,879 order records (deliveries .000,
// .001, .002 ... and credit notes); an order number once, its lines those of its largest delivery, gave 4,224 and 9,070.

const DAY = 86_400_000;

test("an order number counts once, whatever its deliveries and whichever system wrote it; its lines are its largest delivery's", () => {
  const t = orderTally([
    { number: "A26.500123.001", type: "Order", status: "invoiced", lines: 3 },
    { number: "A26.500123.002", type: "Order", status: "invoiced", lines: 2 }, // a part delivery repeats the order's lines
    { number: "A26.500123.000", type: null, status: null, lines: 3 }, // the shop's own record of the same order
    { number: "A26.500124.000", type: null, status: "entered", lines: 5 }, // the shop's records carry no type
    { number: "A26.500125.001", type: "Credit note", status: "credit_note", lines: 4 }, // credit notes are not orders
    { number: "A26.500126.000", type: null, status: "credit_note", lines: 1 },
    { number: null, type: "Order", status: null, lines: 9 },
  ]);
  assert.deepEqual(t, { orders: 2, lines: 8 });
});

test("a month begins at Swiss midnight - CET in winter, CEST in summer", () => {
  assert.equal(new Date(monthStart("2026-01")).toISOString(), "2025-12-31T23:00:00.000Z");
  assert.equal(new Date(monthStart("2026-07")).toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(swissDay(monthStart("2026-11")), "2026-11-01");
  assert.equal(swissDay(monthStart("2026-11") - 1), "2026-10-31");
  assert.deepEqual(monthsBetween("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("the created tickets: topics, days to close and to the first reply over those that have them, the chat's", () => {
  const t = ticketTally([
    { topic: "Delivery", toClose: 2 * DAY, toReply: DAY, chat: false },
    { topic: "Delivery", toClose: null, toReply: 3 * DAY, chat: true },
    { topic: null, toClose: 4 * DAY, toReply: null, chat: false },
  ]);
  assert.equal(t.created, 3);
  assert.deepEqual(t.topics, { Delivery: 2, "": 1 });
  assert.deepEqual([t.closeDays, t.closeN, t.replyDays, t.replyN, t.chat], [6, 2, 4, 2, 1]);
});

test("the KPIs as the workbook names them: averages over the tickets, ratios to the orders, hours per ticket only when typed in", () => {
  const m = (ym: string, x: Partial<BoMonth>): BoMonth => ({ ym, created: 0, closed: 0, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, eso: 0, tsa: 0, all: 0, orders: 0, lines: 0, ...x });
  const both = sumMonths([m("2026-01", { created: 100, closeDays: 300, closeN: 50, lines: 400, orders: 200, topics: { A: 1 } }), m("2026-02", { created: 100, closeDays: 100, closeN: 50, lines: 400, orders: 200, topics: { A: 2, B: 1 } })]);
  const k = kpisOf(both, null, 80);
  assert.equal(k.resolution, 4); // 400 days over 100 tickets, not the average of the two months' averages
  assert.equal(k.perLine, 0.25);
  assert.equal(k.perOrder, 0.5);
  assert.equal(k.hoursPerTicket, 0.4);
  assert.deepEqual(both.topics, { A: 3, B: 1 });
  assert.equal(kpisOf(both, null, null).hoursPerTicket, null);
  assert.equal(kpisOf(m("2026-03", {}), null, null).perLine, null);
});

test("GQS by the month a task was created: the days before it went to GQS, the days to its close", () => {
  const g = gqsTally([
    { created: "2026-01-10T09:00:00Z", toClose: 10 * DAY, sentMs: 2 * DAY },
    { created: "2026-01-31T23:30:00Z", toClose: null, sentMs: 0 }, // 00:30 on 1 February in Switzerland
    { created: "2026-01-12T09:00:00Z", toClose: 4 * DAY, sentMs: DAY },
  ]);
  assert.deepEqual(g, [
    { ym: "2026-01", created: 2, sentDays: 3, sentN: 2, doneDays: 14, doneN: 2 },
    { ym: "2026-02", created: 1, sentDays: 0, sentN: 0, doneDays: 0, doneN: 0 },
  ]);
});

test("before July 2025 the tickets were not in HubSpot's pipelines: no ticket figure, not zero - the orders still count", () => {
  const m = (ym: string): BoMonth => ({ ym, created: 2, closed: 1, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, eso: 6, tsa: 1, all: 481, orders: 4488, lines: 9847 });
  const june = kpisOf(m("2025-06"), null, null), july = kpisOf(m("2025-07"), null, null);
  assert.equal(june.created, null);
  assert.equal(june.all, null);
  assert.equal(june.perLine, null);
  assert.equal(june.orders, 4488);
  assert.equal(july.created, 2);
  // the year to date from January 2025 has no ticket total to compare with
  assert.equal(kpisOf(sumMonths([m("2025-01"), m("2025-07")]), null, null).created, null);
});

test("a month not counted yet has no figure at all - not zero - and months added up with one of them neither", () => {
  const m = (ym: string, pending?: boolean): BoMonth => ({ ym, created: 0, closed: 0, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, eso: 0, tsa: 0, all: 0, orders: 0, lines: 0, ...(pending ? { pending } : {}) });
  const k = kpisOf(m("2026-03", true), null, 900);
  assert.deepEqual([k.created, k.orders, k.lines, k.perLine, k.hoursPerTicket], [null, null, null, null, null]);
  assert.equal(kpisOf(sumMonths([m("2026-02"), m("2026-03", true)]), null, null).created, null);
  assert.equal(kpisOf(m("2026-03"), null, null).created, 0);
});
