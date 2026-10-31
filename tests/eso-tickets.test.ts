import assert from "node:assert/strict";
import { test } from "node:test";
import { OUTCOMES } from "../src/lib/marketingKpis/handoverCube";
import {
  CHANNEL_ORDER, MAIL, PUSHES, byDays, comparable, firstContact, flowOf, inDayOf, kindOf, labelOf, median, outcomeIndex, pushOf, quietOf, rateOf, rowsOf, sameWin, speedOf, startLabels, statsBy,
  winDays, winFrom, winParams,
  type TicketsData,
} from "../src/lib/reporting/ticketsRules";

const lc = { UC15_Lost_Leads_TICKETS_2607_FEHDIA: "uc15", UC2_v2_New_Leads_Tickets_2609: "uc2" };
const O = (id: string) => OUTCOMES.findIndex((o) => o.id === id);

test("tickets: incoming or system - the Hand-over page's sorting, the UC hand-overs and the pushes as system tickets", () => {
  assert.deepEqual(kindOf({ subject: "BO | Email | Anfrage 1234" }, lc), { group: "incoming", channel: MAIL, newLead: false });
  assert.deepEqual(kindOf({ subject: "Direct ESO request | Product Price | x" }, lc), { group: "incoming", channel: "Direct request to the ESO", newLead: false });
  assert.deepEqual(kindOf({ subject: "Lost Lead | Push for First Purchase", workflow: "UC15_Lost_Leads_TICKETS_2607_FEHDIA" }, lc), { group: "system", channel: "Lost Leads (UC15)", newLead: false });
  assert.deepEqual(kindOf({ subject: "New Registrant | x", workflow: "UC2_v2_New_Leads_Tickets_2609" }, lc), { group: "system", channel: "New registrant (UC2)", newLead: true });
  assert.deepEqual(kindOf({ subject: "Abandoned Cart 512,00 €EUR" }, lc), { group: "system", channel: "Abandoned cart (UC4)", newLead: false });
  assert.deepEqual(kindOf({ subject: "EROSION | Muster AG" }, lc), { group: "system", channel: "Erosion", newLead: false });
  assert.deepEqual(kindOf({ subject: "BO | Email | x", resolution: "Not a sales topic" }, lc), { skip: "not a sales topic" });
  assert.deepEqual(kindOf({ subject: "BO | Email | x", resolution: "Misassigned" }, lc), { skip: "misassigned" });
  assert.equal(pushOf("SEPT PUSH | Muster"), "September push");
  assert.equal(pushOf("Win Back Action | x"), "Win back");
  assert.equal(pushOf("Bestellung Witzig"), PUSHES[5]);
  assert.ok(CHANNEL_ORDER.includes("Erosion") && CHANNEL_ORDER.includes("New registrant (UC2)"));
});

test("tickets: won - ordered or a one-shot order, a new registrant when qualified; open and no resolution apart", () => {
  assert.equal(outcomeIndex(false, "Ordered", false), O("open"));
  assert.equal(outcomeIndex(true, "Ordered", false), O("won"));
  assert.equal(outcomeIndex(true, "One-shot C2S order", false), O("won"));
  assert.equal(outcomeIndex(true, "Qualified - Registered on their own", true), O("won"));
  assert.equal(outcomeIndex(true, "Qualified - Registered on their own", false), O("other"));
  assert.equal(outcomeIndex(true, "Only looking for info", false), O("info"));
  assert.equal(outcomeIndex(true, "Price issue", false), O("price"));
  assert.equal(outcomeIndex(true, "", false), O("nores"));
});

test("tickets: the first contact - the earliest move after the ticket came in; how fast in working hours", () => {
  assert.deepEqual(firstContact(1000, [{ at: 5000, kind: 0 }, { at: 3000, kind: 2 }, { at: null, kind: 1 }, { at: 500, kind: 1 }]), { at: 3000, kind: 2 });
  assert.equal(firstContact(1000, [{ at: 500, kind: 1 }]), null);
  assert.equal(speedOf(2), 0);
  assert.equal(speedOf(9), 0);
  assert.equal(speedOf(20), 1);
  assert.equal(speedOf(40), 2);
  assert.equal(speedOf(null), 3);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([]), null);
});

// person, year, month, day, group, channel, prio, category, country, outcome, firstH x10, first, emails, calls, meetings, notes, resolution
const ch = (l: string) => CHANNEL_ORDER.indexOf(l);
const d: TicketsData = {
  generatedAt: "2026-10-30T08:00:00Z", year: 2026, today: "2026-10-30",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
  labels: { ...startLabels(), category: ["APSOcore", "APSOprospect"], country: ["Switzerland", "Germany"], resolution: ["Ordered", "Price issue", "Disqualified - Not our Focus Customer Type"] },
  tickets: [
    [0, 0, 2, 5, 0, ch("Website form"), 0, 0, 0, O("won"), 30, 0, 1, 0, 0, 0, 0], // replied in 3 h, won
    [0, 0, 2, 9, 0, ch("Website form"), 0, 0, 0, O("price"), 200, 1, 2, 0, 0, 1, 1], // e-mail after 20 h, lost on price
    [0, 0, 3, 1, 0, ch(MAIL), 1, 1, 1, O("open"), -1, -1, 0, 0, 0, 0, -1], // open, nothing yet
    [1, 0, 3, 2, 0, ch("Helpline"), 3, 1, 1, O("nores"), -1, -1, 0, 0, 0, 0, -1], // closed, nothing at all
    [0, 0, 3, 4, 1, ch("Erosion"), 0, 0, 0, O("won"), 50, 2, 0, 1, 0, 0, 0], // a system ticket, called in 5 h, won
    [1, 0, 9, 4, 1, ch("New registrant (UC2)"), 3, 1, 1, O("disq"), -1, -1, 0, 0, 0, 2, 2], // notes only, disqualified
    [0, 1, 8, 4, 0, ch("Website form"), 0, 0, 0, O("won"), 10, 0, 0, 0, 0, 0, 0], // last year
  ],
  texts: {},
  coverage: { read: 9, kept: 7, withCompany: 7, left: { "not a sales topic": 2 } },
};

test("tickets: a group's rows of a period under the filters, a breakdown's own filter left out", () => {
  const all = { from: 0, to: 11 };
  assert.equal(rowsOf(d, "incoming", all, {}, null).length, 4);
  assert.equal(rowsOf(d, "system", all, {}, null).length, 2);
  assert.equal(rowsOf(d, "incoming", { ...all, year: 1 }, {}, null).length, 1);
  assert.equal(rowsOf(d, "incoming", all, {}, new Set([1])).length, 1);
  assert.equal(rowsOf(d, "incoming", all, { channel: ["Website form"] }, null).length, 2);
  assert.equal(rowsOf(d, "incoming", all, { channel: ["Website form"] }, null, "channel").length, 4);
  assert.equal(labelOf(d, d.tickets[4], "channel"), "Erosion");
  assert.equal(labelOf(d, d.tickets[3], "country"), "Germany");
});

test("tickets: the figures - win rate of those closed with a resolution, the first contact, closed without any activity", () => {
  const win = { from: 0, to: 11 };
  const s = statsBy(rowsOf(d, "incoming", win, {}, null), win).get("")!;
  assert.equal(s.tickets, 4);
  assert.equal(s.closed, 3);
  assert.equal(s.resolved, 2);
  assert.equal(s.won, 1);
  assert.equal(rateOf(s), 0.5);
  assert.equal(s.open, 1);
  assert.deepEqual(s.speed, [1, 1, 0, 2]);
  assert.deepEqual(s.speedWon, [1, 0, 0, 0]);
  assert.deepEqual(s.speedResolved, [1, 1, 0, 0]);
  assert.deepEqual(s.first, [1, 1, 0, 0]);
  assert.equal(inDayOf(s), 0.25);
  // the helpline ticket: closed, nothing logged; the open one does not count
  assert.equal(s.quiet, 1);
  assert.equal(quietOf(s), 1 / 3);
  assert.deepEqual([s.emails, s.withEmails, s.notes], [3, 2, 1]);
  assert.deepEqual(s.hours, [3, 20]);
  assert.equal(s.months[3], 2);
  assert.equal(s.monthsWon[2], 1);
  const sys = statsBy(rowsOf(d, "system", win, {}, null), win).get("")!;
  // a ticket with notes only is not closed without any activity - but it had no contact
  assert.equal(sys.quiet, 0);
  assert.deepEqual(sys.speed, [1, 0, 0, 1]);
  assert.equal(rateOf(sys), 0.5);
  const byPerson = statsBy(rowsOf(d, "incoming", win, {}, null), win, (r) => labelOf(d, r, "person"));
  assert.equal(byPerson.get("Ben")!.quiet, 1);
  assert.equal(rateOf(byPerson.get("Ana")!), 0.5);
});

test("tickets: the path - where they came from, how fast, the outcome, the resolution", () => {
  const fl = flowOf(d, rowsOf(d, "incoming", { from: 0, to: 11 }, {}, null));
  assert.deepEqual(fl.columns, ["Came from", "First contact", "Outcome", "Resolution"]);
  const link = (a: string, b: string) => fl.links.find((l) => l.from === a && l.to === b)?.value ?? 0;
  assert.equal(link(`c:${ch("Website form")}`, "s:0"), 1);
  assert.equal(link(`c:${ch("Website form")}`, "s:1"), 1);
  assert.equal(link("s:3", "o:open"), 1);
  // closed without a resolution is its own node, never folded into "closed otherwise"
  assert.equal(link("s:3", "o:nores"), 1);
  assert.equal(link("s:3", "o:other"), 0);
  assert.equal(link("o:lost", "r:1"), 1);
  assert.equal(link("o:won", "r:0"), 1);
  assert.equal(fl.nodes.find((n) => n.id === "o:nores")!.label, "Closed without a resolution");
});

test("tickets: last year beside this year only when each month held enough of the group's tickets", () => {
  const many: TicketsData = { ...d, tickets: [...d.tickets, ...Array.from({ length: 60 }, () => [0, 1, 9, 1, 0, 0, 0, 0, 0, O("price"), -1, -1, 0, 0, 0, 0])] };
  assert.equal(comparable(many, "incoming", { from: 9, to: 9 }, null), true);
  assert.equal(comparable(many, "system", { from: 9, to: 9 }, null), false);
  assert.equal(comparable(many, "incoming", { from: 8, to: 9 }, null), false);
  assert.equal(comparable(many, "incoming", { from: 9, to: 9 }, new Set([1])), false);
});

// one's own dates (SARCLA 31.10.2026: "really custom dates with a mini calendar"): the days of the first and the last month
test("tickets: a window of days - each ticket on the day it came in, last year's on the same days", () => {
  // 6 March - 2 April: the website form of 9 March, the Back Office one of 1 April, the helpline one of 2 April
  const w = { from: 2, d0: 6, to: 3, d1: 2 };
  assert.equal(rowsOf(d, "incoming", w, {}, null).length, 3);
  assert.equal(rowsOf(d, "system", w, {}, null).length, 0);
  // within one month both ends cut it: 2-4 April
  assert.equal(rowsOf(d, "incoming", { from: 3, to: 3, d0: 2, d1: 4 }, {}, null).length, 1);
  assert.equal(rowsOf(d, "system", { from: 3, to: 3, d0: 2, d1: 4 }, {}, null).length, 1);
  // the same days a year earlier: 4 September last year is in from the 4th, out from the 5th
  assert.equal(rowsOf(d, "incoming", { from: 8, to: 8, d0: 4, year: 1 }, {}, null).length, 1);
  assert.equal(rowsOf(d, "incoming", { from: 8, to: 8, d0: 5, year: 1 }, {}, null).length, 0);
  // the figures by month: the cut months counted on their days only
  const s = statsBy(rowsOf(d, "incoming", w, {}, null), w).get("")!;
  assert.deepEqual(s.months, [1, 2]);
  assert.equal(s.won, 0);
  // whole months: no days, as before
  assert.equal(rowsOf(d, "incoming", { from: 2, to: 3 }, {}, null).length, 4);
});

test("tickets: a window from the address or the calendar - months or days, this year, in either order, cut at the read's day", () => {
  assert.deepEqual(winFrom(d, "2026-03-05", "2026-05-17"), { from: 2, to: 4, d0: 5, d1: 17 });
  assert.deepEqual(winFrom(d, "2026-05-17", "2026-03-05"), { from: 2, to: 4, d0: 5, d1: 17 });
  assert.deepEqual(winFrom(d, "2026-04", "2026-06"), { from: 3, to: 5 });
  assert.deepEqual(winFrom(d, "2026-06", "2026-04"), { from: 3, to: 5 });
  // from the 1st to the month's end: whole months, the same window as the month picks
  assert.deepEqual(winFrom(d, "2026-03-01", "2026-05-31"), { from: 2, to: 4 });
  assert.deepEqual(winFrom(d, "2026-02-01", "2026-02-28"), { from: 1, to: 1 });
  // past the read's day (30 October): a month to date, a day the read's day
  assert.deepEqual(winFrom(d, "2026-10-05", "2026-12-24"), { from: 9, to: 9, d0: 5, d1: 30 });
  assert.deepEqual(winFrom(d, "2026-09", "2026-12"), { from: 8, to: 9 });
  // a range ending on the read's day keeps it: last year then stops on 30 October too
  assert.deepEqual(winFrom(d, "2026-01-01", "2026-10-30"), { from: 0, to: 9, d1: 30 });
  // last year, a day that does not exist, nonsense: none
  assert.equal(winFrom(d, "2025-03", "2026-05"), null);
  assert.equal(winFrom(d, "2026-02-30", "2026-03-10"), null);
  assert.equal(winFrom(d, "2026-13", "2026-03"), null);
  assert.equal(winFrom(d, null, "2026-03"), null);
  assert.ok(sameWin({ from: 2, to: 4 }, winFrom(d, "2026-03-01", "2026-05-31")!));
  assert.ok(!sameWin({ from: 2, to: 4 }, { from: 2, to: 4, d0: 2 }));
  assert.ok(byDays({ from: 2, to: 2, d1: 9 }) && !byDays({ from: 2, to: 2 }));
});

test("tickets: a window in the address and back - whole months as before, days as days, a running end as the month", () => {
  assert.deepEqual(winParams(d, { from: 3, to: 5 }), ["2026-04", "2026-06"]);
  assert.deepEqual(winParams(d, { from: 2, to: 4, d0: 5, d1: 17 }), ["2026-03-05", "2026-05-17"]);
  assert.deepEqual(winParams(d, { from: 2, to: 4, d0: 5 }), ["2026-03-05", "2026-05-31"]);
  assert.deepEqual(winParams(d, { from: 8, to: 9, d0: 15 }), ["2026-09-15", "2026-10"]);
  assert.deepEqual(winDays(d, { from: 8, to: 9, d0: 15 }), ["2026-09-15", "2026-10-30"]);
  assert.deepEqual(winDays(d, { from: 1, to: 1 }), ["2026-02-01", "2026-02-28"]);
  for (const w of [{ from: 3, to: 5 }, { from: 0, to: 9 }, { from: 2, to: 4, d0: 5, d1: 17 }, { from: 2, to: 4, d0: 5 }, { from: 8, to: 9, d0: 15 }, { from: 9, to: 9, d1: 12 }, { from: 0, to: 9, d1: 30 }]) {
    const [a, b] = winParams(d, w);
    assert.deepEqual(winFrom(d, a, b), w, `${a} ${b}`);
  }
});

test("tickets: last year beside a window of days - a cut month held to its share of the 50, on the same days", () => {
  const ly = (days: number[]) => days.map((day) => [0, 1, 9, day, 0, 0, 0, 0, 0, O("price"), -1, -1, 0, 0, 0, 0]);
  const every = (k: number) => Array.from({ length: 31 }, (_, i) => Array(k).fill(i + 1)).flat();
  // two a day all October last year: the month passes, and 1-10 October (20 of 50 x 10/31 = 16.1)
  const two: TicketsData = { ...d, tickets: [...d.tickets, ...ly(every(2))] };
  assert.equal(comparable(two, "incoming", { from: 9, to: 9 }, null), true);
  assert.equal(comparable(two, "incoming", { from: 9, to: 9, d1: 10 }, null), true);
  // one a day: 31 fail the month, and 10 fail 1-10 October
  const one: TicketsData = { ...d, tickets: [...d.tickets, ...ly(every(1))] };
  assert.equal(comparable(one, "incoming", { from: 9, to: 9 }, null), false);
  assert.equal(comparable(one, "incoming", { from: 9, to: 9, d1: 10 }, null), false);
  // a pipeline that began on the 20th: 60 tickets on 20-31 October pass the whole month and 20-31, not 1-15
  const late: TicketsData = { ...d, tickets: [...d.tickets, ...ly(Array.from({ length: 60 }, (_, i) => 20 + (i % 12)))] };
  assert.equal(comparable(late, "incoming", { from: 9, to: 9 }, null), true);
  assert.equal(comparable(late, "incoming", { from: 9, to: 9, d0: 20 }, null), true);
  assert.equal(comparable(late, "incoming", { from: 9, to: 9, d1: 15 }, null), false);
  // across months: September last year held one ticket - a window into it is not comparable, from October it is
  assert.equal(comparable(two, "incoming", { from: 8, to: 9, d0: 25, d1: 10 }, null), false);
  assert.equal(comparable(two, "incoming", { from: 9, to: 9, d0: 25 }, null), true);
});
