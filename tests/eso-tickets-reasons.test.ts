import assert from "node:assert/strict";
import { test } from "node:test";
import { outcomeOf } from "../src/lib/marketingKpis/handoverCube";
import { CHANNEL_ORDER, FROM_SALES, MAIL, NO_ORDER, PUSHES, T, TOUTCOMES, kindOf, outcomeGroup, outcomeIndex, quietRow } from "../src/lib/reporting/ticketsRules";

// SARCLA 31.10.2026 on the live Tickets pages: "Bought at AP should count as lost as well"; "GQS sales follow-up is not a
// system ticket, it's a sales ticket"; "Other, typed in by hand should not exist - give it the real reason".
const lc = { UC2_v2_New_Leads_Tickets_2609: "uc2" };
const ch = (x: ReturnType<typeof kindOf>) => ("skip" in x ? `skip: ${x.skip}` : `${x.group}: ${x.channel}`);

test("tickets: Bought at AP is lost here - Hand-over keeps its own outcome", () => {
  assert.equal(outcomeGroup(outcomeIndex(true, "Bought at AP", false)), "lost");
  assert.equal(TOUTCOMES[outcomeIndex(true, "Bought at AP", false)].id, "ap");
  assert.equal(outcomeGroup(outcomeIndex(false, "Bought at AP", false)), "open");
  assert.equal(outcomeGroup(outcomeIndex(true, "Ordered", false)), "won");
  assert.equal(outcomeGroup(outcomeIndex(true, "Visit arranged", false)), "other");
  assert.equal(outcomeOf({ g: "request", x: 1, r: "Bought at AP" }), "other");
});

test("tickets: GQS is Sales' - with the incoming tickets, never a system one", () => {
  assert.equal(ch(kindOf({ subject: "GQS SALES FOLLOW-UP TICKET | 721511 / Studer Innotec SA", objectSource: "AUTOMATION_PLATFORM", workflow: "SARCLA | GQS Ticket Created by Sales" }, lc)), `incoming: ${FROM_SALES}`);
  assert.equal(ch(kindOf({ subject: "GQS Special Request | Running Business | Katja Storm | 750714", objectSource: "CRM_UI" }, lc)), `incoming: ${FROM_SALES}`);
  assert.ok(CHANNEL_ORDER.indexOf(FROM_SALES) < CHANNEL_ORDER.indexOf("New registrant (UC2)"));
});

test("tickets: typed in by hand, by its real reason - no 'Other, typed in by hand'", () => {
  assert.equal(ch(kindOf({ subject: "Qualified Lead | ALPA SUD | No Order in the first 30 days", objectSource: "AUTOMATION_PLATFORM", workflow: "UC2_v2_New_Leads_Notifications" }, lc)), `system: ${NO_ORDER}`);
  assert.equal(ch(kindOf({ subject: "Qualified Lead | APSOparts AG | No Order in the first 30 days", objectSource: "AUTOMATION_PLATFORM", workflow: "TEST_FEHDIA_UC2_v2_New_Leads_T" }, lc)), "skip: a workflow's test");
  assert.equal(ch(kindOf({ subject: "Bestellung : Witzig & Frank / Erinnerung", objectSource: "CLONE_OBJECTS", workflow: "BO |   Email | Task Status Rep" }, lc)), `incoming: ${MAIL}`);
  assert.equal(ch(kindOf({ subject: "Direct Request | Rubix", objectSource: "CRM_UI" }, lc)), "incoming: Direct request to the ESO");
  assert.equal(ch(kindOf({ subject: "Certificate PTFE 1145020656: ALTECONET Moreno Tessari", objectSource: "CRM_UI" }, lc)), "incoming: Direct request to the ESO");
  assert.equal(ch(kindOf({ subject: "Request from the chat | Price | TSA", sourceType: "CHAT", objectSource: "CRM_UI" }, lc)), "incoming: Chat");
  assert.equal(ch(kindOf({ subject: "Low Margin / A25.512849 / 1120035846 /-86%", objectSource: "CRM_UI" }, lc)), "system: Price check");
  assert.equal(ch(kindOf({ subject: "Product Management | Data or other topics | Luca Fantasia", objectSource: "CRM_UI" }, lc)), "skip: internal, not a customer's");
  assert.equal(ch(kindOf({ subject: "EROSION | Muster AG" }, lc)), "system: Erosion");
  assert.ok(!CHANNEL_ORDER.some((c) => /typed in by hand|GQS sales follow-up/i.test(c)));
  assert.equal(CHANNEL_ORDER.indexOf(NO_ORDER), CHANNEL_ORDER.indexOf("New registrant (UC2)") + 1);
  assert.deepEqual(CHANNEL_ORDER.slice(-PUSHES.length), [...PUSHES]);
});

test("tickets: closed without any activity - the rows a quiet graph's companies come from", () => {
  const O = (id: string) => TOUTCOMES.findIndex((o) => o.id === id);
  // person, year, month, day, group, channel, prio, category, country, outcome, firstH, first, emails, calls, meetings, notes, resolution, company
  const row = (o: string, first: number, notes: number) => [0, 0, 9, 1, 0, 0, 0, 0, 0, O(o), first >= 0 ? 30 : -1, first, 0, 0, 0, notes, -1, 4];
  assert.equal(quietRow(row("nores", -1, 0)), true);
  assert.equal(quietRow(row("open", -1, 0)), false);
  assert.equal(quietRow(row("nores", -1, 1)), false);
  assert.equal(quietRow(row("won", 0, 0)), false);
  assert.equal(row("won", 0, 0)[T.company], 4);
});
