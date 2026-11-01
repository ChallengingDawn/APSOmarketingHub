import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNEL_ORDER, DIRECT_TSA, PIPES, T, comparable, kindOf, rowsOf, type TicketsData } from "../src/lib/reporting/ticketsRules";

// SARCLA 01.11.2026: "move like the other the ticket also to TSA - all for all in ESO as well - and default TSA on TSA
// reports": the TSA pipeline read too, ESO | TSA | Total on both pages.
const lc = { UC2_v2_New_Leads_Tickets_2609: "uc2" };

test("tickets TSA: a direct request on the TSA pipeline is the TSA's, listed beside the ESO's", () => {
  const t = { subject: "Direct ESO request | Product Price | x" };
  assert.deepEqual(kindOf(t, lc), { group: "incoming", channel: "Direct request to the ESO", newLead: false });
  assert.deepEqual(kindOf(t, lc, "TSA"), { group: "incoming", channel: DIRECT_TSA, newLead: false });
  // typed in by hand: the same
  assert.deepEqual(kindOf({ subject: "Certificate PTFE 1145020656", objectSource: "CRM_UI" }, lc, "TSA"), { group: "incoming", channel: DIRECT_TSA, newLead: false });
  // every other channel keeps its name
  assert.equal((kindOf({ subject: "GQS Special Request | x", objectSource: "CRM_UI" }, lc, "TSA") as { channel: string }).channel, "From Sales (GQS)");
  assert.equal(CHANNEL_ORDER.indexOf(DIRECT_TSA), CHANNEL_ORDER.indexOf("Direct request to the ESO") + 1);
  assert.deepEqual(PIPES, ["ESO", "TSA"]);
});

test("tickets TSA: one pipeline's rows, or both - a read without the column is the ESO pipeline's", () => {
  const row = (pipe: number | null, month = 0, year = 0) => {
    const r = Array(22).fill(0) as number[];
    r[T.year] = year; r[T.month] = month; r[T.day] = 5; r[T.firstH] = -1; r[T.first] = -1; r[T.resolution] = -1; r[T.company] = -1;
    if (pipe == null) r.length = 21; else r[T.pipe] = pipe;
    return r;
  };
  const d = { tickets: [row(0), row(1), row(1), row(null)], people: [], labels: { channel: [], prio: [], category: [], country: [], resolution: [] } } as unknown as TicketsData;
  const win = { from: 0, to: 0 };
  assert.equal(rowsOf(d, "incoming", win, {}, null, undefined, 0).length, 2, "ESO: its own and the old read's");
  assert.equal(rowsOf(d, "incoming", win, {}, null, undefined, 1).length, 2, "TSA");
  assert.equal(rowsOf(d, "incoming", win, {}, null).length, 4, "Total: both");
  // last year compared per pipeline: 60 TSA tickets in January 2025, none on ESO
  const py = { ...d, year: 2026, tickets: Array.from({ length: 60 }, () => row(1, 0, 1)) } as unknown as TicketsData;
  assert.equal(comparable(py, "incoming", win, null, 1), true);
  assert.equal(comparable(py, "incoming", win, null, 0), false);
  assert.equal(comparable(py, "incoming", win, null), true);
});
