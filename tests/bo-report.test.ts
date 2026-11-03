import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RW, WORKBOOK_TYPED, articlePcs, checkTyped, emptyMonth, filteredMonth, gqsTally, inboundByMonth, kpisOf, monthStart, monthsBetween, orderTally, originOf, passes,
  pcFinder, rowsOf, sumMonths, swissDay, ticketTally, type BoMonth,
} from "../src/lib/reporting/boReportRules";

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
  assert.deepEqual([t.orders, t.lines], [2, 8]);
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
  const m = (ym: string, x: Partial<BoMonth>): BoMonth => ({ ym, ...emptyMonth(), ...x });
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
  const m = (ym: string): BoMonth => ({ ym, ...emptyMonth(), created: 2, closed: 1, eso: 6, tsa: 1, all: 481, orders: 4488, lines: 9847 });
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
  const m = (ym: string, pending?: boolean): BoMonth => ({ ym, ...emptyMonth(), ...(pending ? { pending } : {}) });
  const k = kpisOf(m("2026-03", true), null, 900);
  assert.deepEqual([k.created, k.orders, k.lines, k.perLine, k.hoursPerTicket], [null, null, null, null, null]);
  assert.equal(kpisOf(sumMonths([m("2026-02"), m("2026-03", true)]), null, null).created, null);
  assert.equal(kpisOf(m("2026-03"), null, null).created, 0);
});

// SARCLA 03.11.2026: "did you read this file ... and what is expected?" - its comments and its new KPIs.

test("the C2S tickets (all, and those filed Delivery), the customer tone's neutral share over the scored ones, the orders by profit centre", () => {
  const t = ticketTally([
    { topic: "Delivery", toClose: null, toReply: null, chat: false, c2s: true, tone: "neutral" },
    { topic: "Delivery", toClose: null, toReply: null, chat: false, c2s: false, tone: "negative" },
    { topic: "Product Price", toClose: null, toReply: null, chat: false, c2s: true, tone: "Positive" },
    { topic: "Others", toClose: null, toReply: null, chat: false, tone: null }, // not scored
  ]);
  assert.deepEqual([t.c2s, t.c2sDelivery], [2, 1]);
  const k = kpisOf({ ym: "2026-09", ...emptyMonth(), ...t }, null, null);
  assert.equal(k.neutral, 1 / 3);
  assert.equal(k.negative, 1 / 3);
  const o = orderTally([
    { number: "A26.1.000", type: null, status: null, lines: 2 }, // the shop's record names no profit centre
    { number: "A26.1.001", type: "Order", status: "invoiced", lines: 2, pc: "DT" }, // the ERP's does
    { number: "A26.2.000", type: null, status: null, lines: 1 },
  ]);
  assert.deepEqual(o.pcs, { DT: 1, "": 1 });
});

test("ESO and TSA inbound: the incoming tickets of the ESO Reports' read, by pipeline and month - the sales actions left out", () => {
  const at = { year: 1, month: 2, group: 4, pipe: 21 };
  const row = (yOff: number, month: number, group: number, pipe: number) => { const r = new Array(22).fill(0); r[1] = yOff; r[2] = month; r[4] = group; r[21] = pipe; return r; };
  const got = inboundByMonth([row(0, 8, 0, 0), row(0, 8, 1, 0), row(0, 8, 0, 1), row(1, 0, 0, 0)], 2026, at);
  assert.deepEqual(got, { eso: { "2026-09": 1, "2025-01": 1 }, tsa: { "2026-09": 1 } });
});

test("typed figures: a share typed as 95.5 or 95,5 % or 0.955 is 95.5 %; a count is whole; empty clears it", () => {
  assert.deepEqual(checkTyped("pct", "95,5 %"), { ok: true, value: 0.955 });
  assert.deepEqual(checkTyped("pct", 0.955), { ok: true, value: 0.955 });
  assert.deepEqual(checkTyped("n", "712"), { ok: true, value: 712 });
  assert.deepEqual(checkTyped("pct", ""), { ok: true, value: null });
  assert.equal(checkTyped("pct", "150").ok, false);
  assert.equal(checkTyped("n", "-3").ok, false);
  // the workbook's own figures to start: OTD online, all, September 2026 80.8 %; pass rate mandant 100 January 96.43 %
  assert.equal(WORKBOOK_TYPED["otd.online-all"]["2026-09"], 0.808);
  assert.equal(WORKBOOK_TYPED["pass.m100"]["2026-01"], 0.9643);
});

test("an order's profit centre: the one it names, else most of its lines' - the line's own, else its article's, by number or by its first four digits (SARCLA 03.11.2026: \"STILL NO PROFIT CENTER?\")", () => {
  const known = articlePcs([
    { number: "A26.1.000", type: "Order", status: null, lines: 2, pc: "DT", arts: ["0301020030", "1301098020"], lpcs: ["DT", "KT"] },
    { number: "A26.2.000", type: "Order", status: null, lines: 1, pc: "FT", arts: ["0653601016"], lpcs: ["FT"] },
  ]);
  assert.deepEqual(known, { "0301020030": "DT", "1301098020": "KT", "0653601016": "FT" });
  const find = pcFinder(known);
  assert.equal(find("0653601016"), "FT");
  // an article never seen: what the known ones of its first four digits are
  assert.equal(find("0301999999"), "DT");
  assert.equal(find("9999000000"), null);
  const t = orderTally([
    // named on the order: kept, whatever its lines
    { number: "A26.10.000", type: "Order", status: null, lines: 2, pc: "KT", arts: ["0301020030", "0301020031"], lpcs: [null, null] },
    // the shop's own record, no profit centre: most of its lines are DT
    { number: "A26.11.000", type: null, status: null, lines: 3, pc: null, arts: ["0301020030", "0301777777", "1301098020"], lpcs: [null, null, null] },
    // "Unknown" names none
    { number: "A26.12.000", type: null, status: null, lines: 1, pc: "Unknown", arts: ["0653601016"], lpcs: [null] },
    // nothing to go on
    { number: "A26.13.000", type: null, status: null, lines: 1, pc: null, arts: [], lpcs: [] },
  ], find);
  assert.deepEqual(t.pcs, { KT: 1, DT: 1, FT: 1, "": 1 });
  assert.deepEqual(t.linePcs, { DT: 4, KT: 1, FT: 1 });
});

test("where a ticket came from: the chat, what no customer wrote (automatic, internal, spam ... or made by a system), else a customer (SARCLA 03.11.2026: \"how many came in automatic or customer\")", () => {
  assert.equal(originOf("Delivery", true, "EMAIL"), "Chat");
  assert.equal(originOf("Automatic e-mail", false, "EMAIL"), "Automatic & internal");
  assert.equal(originOf("Delivery", false, "AUTOMATION_PLATFORM"), "Automatic & internal");
  assert.equal(originOf("Delivery", false, "EMAIL"), "Customer");
  assert.equal(originOf(null, false, null), "Customer");
});

test("the tickets one by one, filtered: the month's ticket figures counted again from the rows that pass; the orders untouched", () => {
  const rows = rowsOf([
    { day: 3, topic: "Delivery", owner: "11", origin: "Customer", toClose: 2 * 86_400_000, toReply: 86_400_000, c2s: true, tone: "Neutral", company: "c1" },
    { day: 4, topic: "Product Price", owner: "22", origin: "Chat", toClose: null, toReply: null, tone: "positive", company: "c2" },
    { day: 5, topic: "Delivery", owner: "22", origin: "Customer", toClose: 4 * 86_400_000, toReply: null, tone: "negative", company: "c2" },
  ], [
    { day: 9, topic: "Delivery", owner: "11", origin: "Customer", company: "c1" },
    { day: 9, topic: "Delivery", owner: "22", origin: "Customer", company: "c2" },
  ]);
  assert.equal(rows.dict[rows.created[0][RW.topic]], "Delivery");
  assert.equal(rows.created[0][RW.close], 20);
  assert.equal(rows.created[1][RW.close], -1);
  const m: BoMonth = { ym: "2026-10", ...emptyMonth(), created: 3, closed: 2, orders: 100, rows };
  const co = { c1: ["Key account", "Switzerland", "P1"], c2: ["Shop", "Germany", "P3"] } as Record<string, [string, string, string]>;
  // no filter: the month as it is
  assert.equal(filteredMonth(m, {}, co), m);
  const only22 = filteredMonth(m, { person: ["22"] }, co);
  assert.equal(only22.created, 2);
  assert.equal(only22.closed, 1);
  assert.equal(only22.chat, 1);
  assert.equal(only22.closeN, 1);
  assert.equal(only22.closeDays, 4);
  assert.equal(only22.orders, 100);
  assert.deepEqual(only22.topics, { Delivery: 1, "Product Price": 1 });
  const swiss = filteredMonth(m, { country: ["Switzerland"] }, co);
  assert.equal(swiss.created, 1);
  assert.equal(swiss.c2s, 1);
  assert.equal(swiss.c2sDelivery, 1);
  assert.deepEqual(swiss.tones, { neutral: 1 });
  // a company without facts is "Not set"
  assert.equal(passes({ category: ["Not set"] }, co, { topic: "", owner: "", origin: "Customer", company: "c9" }), true);
  assert.equal(passes({ topic: ["No topic"] }, co, { topic: "", owner: "", origin: "Customer", company: "" }), true);
});
