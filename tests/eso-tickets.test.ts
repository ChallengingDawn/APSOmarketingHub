import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNEL_ORDER, KINDS, PUSHES, STATE, bandOf, comparable, kindOf, labelOf, pushOf, rateOf, rowsOf, startLabels, stateOf, statsBy, type TicketsData } from "../src/lib/reporting/ticketsRules";

const lc = { UC15_Lost_Leads_TICKETS_2607_FEHDIA: "uc15", UC2_v2_New_Leads_Tickets_2609: "uc2" };

test("tickets: the kind of a ticket - the Hand-over page's sorting, the pushes kept, new registrants left out", () => {
  assert.deepEqual(kindOf({ subject: "BO | Email | Anfrage 1234" }, lc), { kind: KINDS[0], channel: "Redirected from Back Office" });
  assert.deepEqual(kindOf({ subject: "Direct ESO request | Product Price | x" }, lc), { kind: KINDS[0], channel: "Direct request to the ESO" });
  assert.deepEqual(kindOf({ subject: "Lost Lead | Push for First Purchase", workflow: "UC15_Lost_Leads_TICKETS_2607_FEHDIA" }, lc), { kind: KINDS[1], channel: "Lost Leads (UC15)" });
  assert.deepEqual(kindOf({ subject: "Abandoned Cart 512,00 €EUR" }, lc), { kind: KINDS[1], channel: "Abandoned cart (UC4)" });
  assert.deepEqual(kindOf({ subject: "EROSION | Muster AG" }, lc), { kind: KINDS[2], channel: "Erosion" });
  assert.deepEqual(kindOf({ subject: "Win Back Action | Muster AG" }, lc), { kind: KINDS[2], channel: "Win back" });
  assert.deepEqual(kindOf({ subject: "New Registrant | x", workflow: "UC2_v2_New_Leads_Tickets_2609" }, lc), { skip: "new registrant to qualify" });
  assert.deepEqual(kindOf({ subject: "BO | Email | x", resolution: "Not a sales topic" }, lc), { skip: "not a sales topic" });
  assert.deepEqual(kindOf({ subject: "BO | Email | x", resolution: "Misassigned" }, lc), { skip: "misassigned" });
  assert.equal(pushOf("SEPT PUSH | Muster"), "September push");
  assert.equal(pushOf("PRICE CHECK | A26.1"), "Price check");
  assert.equal(pushOf("GQS SALES FOLLOW-UP TICKET"), "GQS sales follow-up");
  assert.equal(pushOf("Bestellung Witzig"), PUSHES[5]);
  assert.ok(CHANNEL_ORDER.includes("Erosion") && !CHANNEL_ORDER.includes("New registrant (UC2)"));
});

test("tickets: the company's potential in bands - a placeholder over €1m counts as not set", () => {
  assert.equal(bandOf(100000), "€100,000 and more");
  assert.equal(bandOf(40000), "€25,000 – 99,999");
  assert.equal(bandOf(499), "Under €500");
  assert.equal(bandOf(0), "Not set");
  assert.equal(bandOf(2_000_000), "Not set");
});

test("tickets: where a ticket stands - open, ordered (one-shot too), another resolution, none", () => {
  assert.equal(stateOf(false, "Ordered"), STATE.open);
  assert.equal(stateOf(true, "Ordered"), STATE.ordered);
  assert.equal(stateOf(true, "One-shot C2S order"), STATE.ordered);
  assert.equal(stateOf(true, "Only looking for info"), STATE.lost);
  assert.equal(stateOf(true, ""), STATE.nores);
});

// two people; person, year, month, day, kind, channel, prio, category, country, band, state, value
const labels = { ...startLabels(), country: ["Switzerland", "Germany"] };
const d: TicketsData = {
  generatedAt: "2026-10-29T08:00:00Z", year: 2026, today: "2026-10-29",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
  labels,
  tickets: [
    [0, 0, 2, 5, 0, 4, 0, 0, 0, 1, STATE.ordered, 1200],
    [0, 0, 2, 9, 0, 4, 0, 0, 0, 1, STATE.lost, 300],
    [0, 0, 3, 1, 2, 10, 1, 0, 0, 1, STATE.ordered, 5000],
    [0, 0, 3, 2, 2, 10, 1, 0, 0, 1, STATE.open, 800],
    [1, 0, 3, 4, 1, 9, 3, 3, 1, 5, STATE.nores, 0],
    [1, 0, 9, 4, 0, 0, 3, 3, 1, 5, STATE.lost, 50],
    [0, 1, 8, 4, 0, 4, 0, 0, 0, 1, STATE.ordered, 100], // last year
  ],
  coverage: { read: 9, kept: 7, withCompany: 7, left: { "not a sales topic": 2 } },
};

test("tickets: a period's rows under the filters, the people of a team, a breakdown's own filter left out", () => {
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, null).length, 6);
  assert.equal(rowsOf(d, { from: 3, to: 3 }, {}, null).length, 3);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, new Set([1])).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11, year: 1 }, {}, null).length, 1);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { kind: [KINDS[2]] }, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { kind: [KINDS[2]] }, null, "kind").length, 6);
  assert.equal(labelOf(d, d.tickets[2], "channel"), "Erosion");
  assert.equal(labelOf(d, d.tickets[4], "person"), "Ben");
  assert.equal(labelOf(d, d.tickets[4], "country"), "Germany");
});

test("tickets: the figures - ordered of those closed with a resolution, the value of the orders, the months", () => {
  const win = { from: 0, to: 11 };
  const all = statsBy(rowsOf(d, win, {}, null), win).get("")!;
  assert.equal(all.tickets, 6);
  assert.equal(all.resolved, 4);
  assert.equal(all.ordered, 2);
  assert.equal(all.open, 1);
  assert.equal(all.nores, 1);
  assert.equal(rateOf(all), 0.5);
  assert.equal(all.value, 6200);
  assert.equal(all.openValue, 800);
  assert.deepEqual([all.months[2], all.months[3], all.monthsOrdered[3], all.monthsResolved[2]], [2, 3, 1, 2]);
  const by = statsBy(rowsOf(d, win, {}, null), win, (r) => labelOf(d, r, "person"));
  assert.equal(rateOf(by.get("Ana")!), 2 / 3);
  assert.equal(rateOf(by.get("Ben")!), 0);
  assert.equal(rateOf({ ordered: 0, resolved: 0 }), null);
});

test("tickets: last year beside this year only when each month held enough tickets", () => {
  const many: TicketsData = { ...d, tickets: [...d.tickets, ...Array.from({ length: 60 }, () => [0, 1, 9, 1, 0, 4, 0, 0, 0, 1, STATE.lost, 0])] };
  assert.equal(comparable(many, { from: 9, to: 9 }, null), true);
  assert.equal(comparable(many, { from: 8, to: 9 }, null), false);
  assert.equal(comparable(many, { from: 9, to: 9 }, new Set([1])), false);
  assert.equal(comparable(d, { from: 0, to: 9 }, null), false);
});
