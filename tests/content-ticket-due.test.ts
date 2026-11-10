import assert from "node:assert/strict";
import { test } from "node:test";
import { ticketDue } from "../src/lib/reporting/scrollToSaleRules";

// SARCLA 10.11.2026: "due date should be copied from the ticket if there is one" - its Go-live date, else its Planned date.
test("a ticket's due date: Go-live first, then Planned, as YYYY-MM-DD", () => {
  assert.equal(ticketDue({ mkt_golive_date: "2026-11-27", mkt_planned_date: "2026-11-20" }), "2026-11-27");
  assert.equal(ticketDue({ mkt_golive_date: "", mkt_planned_date: "2026-11-20" }), "2026-11-20");
  assert.equal(ticketDue({ mkt_golive_date: String(Date.UTC(2026, 11, 4)) }), "2026-12-04");
  assert.equal(ticketDue({}), "");
  assert.equal(ticketDue({ mkt_golive_date: "soon" }), "");
});
