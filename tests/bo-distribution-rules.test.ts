import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LEGACY, PEOPLE, STAGE, SUB, assignBo, assignGqs, chatPlan, findSalesAgent, route,
  type AssignInput, type Availability, type Classified, type RouteFacts, type SalesAgent,
} from "../src/lib/boDistribution/rules";

const facts = (f: Partial<RouteFacts> = {}): RouteFacts => ({
  subject: "BO | Request | Hello", sourceType: "EMAIL", aiChatSource: null, c2sProblemOrder: false,
  stage: STAGE.boNew, stagesEver: [STAGE.boNew], category: null, subs: {}, emailToSales: false, emailFromSalesRep: false, ...f,
});
const none: () => Classified = () => ({ category: null, subProperty: null, subCategory: null });
const as = (category: string, subProperty: string | null = null, subCategory: string | null = null) => (): Classified => ({ category, subProperty, subCategory });

test("an email goes through the classifier and the category router - each branch to its code step and priority", () => {
  const rfq = route(facts(), as("Product Price", SUB.price, "Request for quotation"));
  assert.equal(rfq.assigner, "42");
  assert.equal(rfq.sets.hs_ticket_priority, "URGENT");
  assert.equal(rfq.sets.dispatch, "Send to ESO/TSA");
  assert.deepEqual(rfq.path, ["EMAIL", "#22 classifier", "PRODUCT PRICE", "Request for quotation"]);

  const login = route(facts(), as("Website Issue", SUB.website, "Login Issue"));
  assert.equal(login.assigner, "23");
  assert.equal(login.sets.hs_ticket_priority, "HIGH");

  const late = route(facts(), as("Delivery", SUB.delivery, "Existing Order"));
  assert.equal(late.assigner, "27");
  assert.equal(late.sets.hs_ticket_priority, "URGENT");

  const tds = route(facts(), as("Product Information", SUB.product, "Technical Data Sheet request"));
  assert.equal(tds.assigner, "27");
  assert.equal(tds.sets.hs_ticket_priority, "MEDIUM");

  const moq = route(facts(), as("Product Information", SUB.product, "Minimum order quantity for a product"));
  assert.equal(moq.assigner, "42");

  const inv = route(facts(), as("Invoicing & Accounting", SUB.invoicing, "Other invoicing issue"));
  assert.equal(inv.sets.hs_ticket_priority, "LOW");
});

test("nothing recognised -> Others, MEDIUM, the Load Balancer", () => {
  const r = route(facts(), none);
  assert.equal(r.assigner, "31");
  assert.equal(r.sets.enquiry_category, "Others");
  assert.equal(r.sets.hs_ticket_priority, "MEDIUM");
});

test("the email special cases come before the classifier", () => {
  assert.equal(route(facts({ subject: "BO | EMAIL | GQS | Task Status Report O26.18101230" }), none).assigner, "50");
  const erp = route(facts({ subject: "BO | ERP Order Export failed" }), none);
  assert.equal(erp.assigner, "23");
  assert.equal(erp.sets.enquiry_category, "Delivery");
  assert.equal(route(facts({ subject: "Request billing address change" }), none).sets[SUB.website], "Login Issue");
  // to sales@ from a rep -> ESO with the rep; from anyone else -> the classifier
  assert.equal(route(facts({ emailToSales: true, emailFromSalesRep: true }), none).assigner, "75");
  assert.equal(route(facts({ emailToSales: true }), none).path[2], "#22 classifier");
  const stopped = route(facts({ subject: "PERFORMIS | stopped order" }), none);
  assert.equal(stopped.assigner, "27");
  assert.equal(stopped.sets.hs_ticket_priority, "HIGH");
  // back from sales: Load Balancer, no classification
  const back = route(facts({ stagesEver: [STAGE.boNew, "2338232556"] }), as("Product Price", SUB.price, "Request for quotation"));
  assert.equal(back.assigner, "31");
  assert.equal(back.classified, undefined);
});

test("a C2S problem is Delivery / late / URGENT and ends in the Cut-to-Size stage", () => {
  const r = route(facts({ subject: "C2S PROBLEM | 8001234567", c2sProblemOrder: true }), none);
  assert.equal(r.assigner, "27");
  assert.equal(r.sets.hs_ticket_priority, "URGENT");
  assert.equal(r.c2sStageAfter, true);
});

test("chat tickets never reach a distribution step", () => {
  assert.equal(route(facts({ sourceType: "CHAT" }), none).sets.hs_pipeline_stage, STAGE.chatNewBoTopic);
  const resent = route(facts({ sourceType: "CHAT", stagesEver: ["1", STAGE.boNew], category: "Delivery" }), none);
  assert.equal(resent.sets.hubspot_owner_id, PEOPLE.rose.id);
  assert.equal(resent.sets.subject, "📍CHAT REQUEST | Delivery | ROSE");
  assert.equal(route(facts({ sourceType: "CHAT" }), none).assigner, null);
  // EMAIL wins over an AI chat source
  assert.equal(route(facts({ aiChatSource: "CHAT" }), none).path[0], "EMAIL");
  assert.equal(route(facts({ sourceType: null, aiChatSource: "CHAT" }), none).path[0], "AI CHAT");
});

test("the chat's new way: CHAT/C2S Issue with #27 instead of parking or Rose - exclusions and other origins untouched", () => {
  const handed = chatPlan(route(facts({ sourceType: "CHAT", stage: STAGE.boRedirectedFromChat, stagesEver: [STAGE.boRedirectedFromChat] }), none));
  assert.equal(handed?.stage, STAGE.cutToSizeIssue);
  assert.equal(handed?.stage, "5948837104");
  assert.equal(handed?.assigner, "27");
  assert.equal(handed?.callWithinMin, 60);
  assert.equal(handed?.today, "parked in New BO Topic");
  const resent = chatPlan(route(facts({ sourceType: null, aiChatSource: "CHAT", stagesEver: ["1", STAGE.boNew], category: "Delivery" }), none));
  assert.equal(resent?.today, "Rose");
  assert.equal(resent?.path[0], "AI CHAT");
  assert.equal(resent?.path[1], "SENT BACK BY TSA");
  // the shop bug and the 3D model request keep their own way
  assert.equal(chatPlan(route(facts({ sourceType: "CHAT", category: "Website Issue", subs: { [SUB.website]: "Other Issue" } }), none)), null);
  assert.equal(chatPlan(route(facts({ sourceType: "CHAT", category: "Product Information", subs: { [SUB.product]: "3D Model request" } }), none)), null);
  // not a chat: no plan
  assert.equal(chatPlan(route(facts(), as("Delivery", SUB.delivery, "Existing Order"))), null);
  assert.equal(chatPlan(route(facts({ sourceType: "FORM", category: "Order Cancellation" }), none)), null);
  // today's path itself is unchanged by the plan (shadow)
  assert.equal(route(facts({ sourceType: "CHAT" }), none).sets.hs_pipeline_stage, STAGE.chatNewBoTopic);
});

test("forms skip the classifier; API / hub tickets stop on CERTIFICATES and MAIL TO CUSTOMER", () => {
  const form = route(facts({ sourceType: "FORM", category: "Order Cancellation" }), () => { throw new Error("no classifier for forms"); });
  assert.equal(form.assigner, "27");
  assert.equal(form.sets.hs_ticket_priority, "URGENT");
  assert.equal(route(facts({ sourceType: null, subject: "CERTIFICATES | FDA | M100" }), none).assigner, null);
  assert.equal(route(facts({ sourceType: null, category: "Certificates (ONLY FOR BO)" }), none).sets.enquiry_category, "Others");
});

/* ── the sales agent ── */

test("the first company with a known SA wins; internal companies and contacts are skipped; contacts only without a company SA", () => {
  const map = LEGACY.saToOwnerBo;
  const a = findSalesAgent(
    [{ id: "1", name: "Angst + Pfister AG", sa: "Leart Asllani" }, { id: "2", name: "Kunde AG", sa: "Sara Gashi", saSub: "Claudia Cagnoni" }],
    [{ id: "9", name: "x", email: "a@kunde.ch", sa: "Leart Asllani" }], map,
  );
  assert.equal(a.sa?.id, PEOPLE.sara.id);
  assert.equal(a.saSub?.id, PEOPLE.claudia.id);
  assert.deepEqual(a.skippedInternal, ["Angst + Pfister AG (company)"]);
  // an SA that is not a Back Office person does not count; the contact's SA then wins, and its company is remembered when the ticket has none
  const b = findSalesAgent([], [{ id: "9", name: "Hans", email: "hans@kunde.ch", sa: "Leart Asllani", companyId: "77" }], map);
  assert.equal(b.sa?.id, PEOPLE.leart.id);
  assert.equal(b.companyToAssociate, "77");
  assert.equal(findSalesAgent([{ id: "2", name: "Kunde AG", sa: "Marc Frech" }], [], map).sa, null);
});

/* ── the assigners: legacy = the workflow code, hub = the fixes ── */

const noSa: SalesAgent = { sa: null, saSub: null, source: null, skippedInternal: [], companyToAssociate: null };
const input = (a: [string, string | null][], w: [string, number | null][], extra: Partial<AssignInput> = {}): AssignInput => {
  const availability: Availability = new Map(a);
  return { sa: noSa, availability, availabilityFirstPage: availability, workload: new Map(w), archived: new Set([PEOPLE.adriana.id, PEOPLE.vanessa.id]), ...extra };
};
const { claudia, claudioG, leart, adriana, sara, maida } = PEOPLE;

test("General Distribution: SA when available (no cap), else least busy of the available, ties by list order", () => {
  const base = input([[claudia.id, "available"], [claudioG.id, "available"], [leart.id, "away"], [sara.id, "available"]], [[claudia.id, 5], [claudioG.id, 5], [leart.id, 1], [adriana.id, 0], [sara.id, 9]]);
  assert.equal(assignBo("27", base, "legacy").owner?.id, claudia.id); // 5 = 5, Claudia first in the list
  assert.equal(assignBo("27", { ...base, sa: { ...noSa, sa: sara, source: "company: X" } }, "legacy").owner?.id, sara.id);
  assert.equal(assignBo("27", { ...base, sa: { ...noSa, sa: leart, saSub: claudioG, source: "company: X" } }, "legacy").owner?.id, claudioG.id);
});

test("everyone away: legacy picks deactivated Adriana with 0 tickets; the hub never does", () => {
  const w: [string, number | null][] = [[claudia.id, 5], [claudioG.id, 4], [leart.id, 3], [adriana.id, 0], [sara.id, 6]];
  const allAway = input([], w);
  assert.equal(assignBo("27", allAway, "legacy").owner?.id, adriana.id);
  assert.equal(assignBo("27", allAway, "hub").owner?.id, leart.id);
});

test("a failed count reads as 0 in legacy (that person looks idle); the hub leaves the person out", () => {
  const i = input([[claudia.id, "available"], [claudioG.id, "available"], [sara.id, "available"]], [[claudia.id, 4], [claudioG.id, null], [sara.id, 2]]);
  assert.equal(assignBo("27", i, "legacy").owner?.id, claudioG.id);
  assert.equal(assignBo("27", i, "hub").owner?.id, sara.id);
});

test("the Load Balancer's list puts Sara third, so ties break differently", () => {
  const i = input([[claudioG.id, "available"], [sara.id, "available"], [leart.id, "available"]], [[claudioG.id, 3], [sara.id, 2], [leart.id, 2]]);
  assert.equal(assignBo("27", i, "legacy").owner?.id, leart.id);
  assert.equal(assignBo("31", i, "legacy").owner?.id, sara.id);
});

test("#23: Maida, else Sara, else least busy - reading only the FIRST page of users in legacy", () => {
  const all = input([[maida.id, "available"]], []);
  assert.equal(assignBo("23", all, "legacy").owner?.id, maida.id);
  // Maida on page 2: legacy does not see her (away) and goes to Sara
  const paged = { ...input([[maida.id, "available"], [sara.id, "available"]], []), availabilityFirstPage: new Map([[sara.id, "available"]]) };
  assert.equal(assignBo("23", paged, "legacy").owner?.id, sara.id);
  assert.equal(assignBo("23", paged, "hub").owner?.id, maida.id);
});

test("#50 without a GQS task: a user missing from the list counts as available in legacy", () => {
  const i = input([[claudia.id, "away"], [claudioG.id, "away"], [leart.id, "away"], [sara.id, "away"]], [[claudia.id, 1], [claudioG.id, 1], [leart.id, 1], [adriana.id, 7], [sara.id, 1]]);
  assert.equal(assignBo("50", i, "legacy").owner?.id, adriana.id); // missing from the users list -> "available"
  assert.equal(assignBo("50", i, "hub").owner?.id, claudia.id);
});

test("GQS: DT New Business goes to Claudio then Leart; a missing user is available for DT in legacy but away for the SA", () => {
  const i = input([[claudioG.id, "away"]], [[claudia.id, 3], [claudioG.id, 0], [leart.id, 1], [sara.id, 2]]);
  assert.equal(assignGqs("DT -  New Business", i, "legacy").owner?.id, leart.id); // Leart not in the list -> available
  assert.equal(assignGqs("DT -  New Business", i, "hub").method, "Least busy");
  const sa = { ...i, sa: { ...noSa, sa: maida, source: "company: X" } };
  assert.notEqual(assignGqs("Running Business", sa, "legacy").owner?.id, maida.id); // Maida missing -> away for the SA check
  // a failed GQS count is 999 in legacy
  const fail = input([[claudia.id, "available"], [sara.id, "available"]], [[claudia.id, null], [sara.id, 400]]);
  assert.equal(assignGqs("Running Business", fail, "legacy").owner?.id, sara.id);
});

test("teams changed on the page drive the hub's answer, never the copy's", () => {
  const base = input([[claudia.id, "available"], [claudioG.id, "available"], [sara.id, "available"], [maida.id, "away"]], [[claudia.id, 5], [claudioG.id, 3], [sara.id, 1], [leart.id, 0]]);
  // Sara left out of the General Distribution team on the page
  const pools = { team27: [claudia, claudioG, leart] };
  assert.equal(assignBo("27", { ...base, pools }, "legacy").owner?.id, sara.id);
  assert.equal(assignBo("27", { ...base, pools }, "hub").owner?.id, claudioG.id);
  // Sara tried first for login / billing on the page
  assert.equal(assignBo("23", { ...base, pools: { primary23: [sara, maida] } }, "hub").method, "Primary (Sara Gashi)");
  // the page's Sales Agent names: the hub uses saHub, the copy keeps sa
  const sa = { ...noSa, sa: claudia, source: "company: X" };
  assert.equal(assignBo("27", { ...base, sa: noSa, saHub: sa }, "hub").owner?.id, claudia.id);
  assert.equal(assignBo("27", { ...base, sa: noSa, saHub: sa }, "legacy").owner?.id, sara.id);
});

import { DEFAULT_PRIORITY, priorityFacts, priorityFor } from "../src/lib/boDistribution/rules";

test("priority: the workflow's unless the page changes a line or a switched-on signal applies", () => {
  const facts = priorityFacts("Bitte dringend - Bandstillstand bei uns", "P1", DEFAULT_PRIORITY);
  assert.deepEqual(facts.urgentHits.slice(0, 2), ["dringend", "stillstand"]);
  // nothing switched on: the workflow's
  assert.equal(priorityFor("MEDIUM", "Invoicing & Accounting", "Invoice not received", facts, DEFAULT_PRIORITY)!.value, "MEDIUM");
  // a line changed on the page
  assert.equal(priorityFor("MEDIUM", "Invoicing & Accounting", "Invoice not received", facts, { ...DEFAULT_PRIORITY, overrides: { "Invoicing & Accounting|Invoice not received": "HIGH" } })!.value, "HIGH");
  // "any other" line of the category applies to an unlisted sub-category
  assert.equal(priorityFor("LOW", "Invoicing & Accounting", "Other invoicing issue", null, { ...DEFAULT_PRIORITY, overrides: { "Invoicing & Accounting|*": "MEDIUM" } })!.value, "MEDIUM");
  // urgent words and a key customer each raise one level, never past URGENT
  const both = priorityFor("MEDIUM", "Delivery", null, facts, { ...DEFAULT_PRIORITY, raiseOnUrgentWords: true, raiseKeyCustomers: true })!;
  assert.equal(both.value, "URGENT");
  assert.equal(both.why.length, 2);
  // newsletters go to LOW
  const news = priorityFacts("Our newsletter - unsubscribe here", null, DEFAULT_PRIORITY);
  assert.equal(priorityFor("HIGH", "Product Information", null, news, { ...DEFAULT_PRIORITY, lowerNewsletters: true })!.value, "LOW");
  assert.equal(priorityFor(null, "Delivery", null, facts, DEFAULT_PRIORITY), null);
});

test("hub only: out-of-office availability and a limit per person; the copy ignores both", () => {
  const base = input([[claudia.id, "away"], [claudioG.id, "available"], [sara.id, "available"]], [[claudia.id, 2], [claudioG.id, 9], [sara.id, 4]]);
  // the chat dot says Claudia is away; out of office says she is in
  const availabilityHub = new Map([[claudia.id, "available"], [claudioG.id, "available"], [sara.id, "available"]]) as Availability;
  assert.equal(assignBo("27", { ...base, availabilityHub }, "hub").owner?.id, claudia.id);
  assert.equal(assignBo("27", { ...base, availabilityHub }, "legacy").owner?.id, sara.id);
  // a limit of 3 open tickets passes Sara (4) over
  const capped = input([[claudioG.id, "available"], [sara.id, "available"]], [[claudioG.id, 6], [sara.id, 4]]);
  assert.equal(assignBo("27", { ...capped, pools: { team27: [claudioG, sara] }, cap: 5 }, "hub").owner?.id, sara.id);
  assert.equal(assignBo("27", { ...capped, pools: { team27: [claudioG, sara] }, cap: 3 }, "hub").owner?.id, sara.id); // everyone over: the limit is ignored
  assert.equal(assignBo("27", { ...capped, pools: { team27: [claudioG, sara] }, cap: 5, workloadHub: new Map([[claudioG.id, 1], [sara.id, 7]]) }, "hub").owner?.id, claudioG.id);
});

test("nobody available: the workflow gives it to the least busy of everyone; the hub can let it wait", () => {
  const away = input([[claudia.id, "away"], [claudioG.id, "away"], [sara.id, "away"]], [[claudia.id, 3], [claudioG.id, 1], [sara.id, 2]]);
  const pools = { team27: [claudia, claudioG, sara] };
  assert.notEqual(assignBo("27", { ...away, pools }, "legacy").owner, null); // the workflow's team; someone always gets it
  const wait = assignBo("27", { ...away, pools, waitWhenNobody: true }, "hub");
  assert.equal(wait.owner, null);
  assert.match(wait.reasons.join(" "), /waits in the queue/);
  assert.equal(assignBo("27", { ...away, pools, waitWhenNobody: false }, "hub").owner?.id, claudioG.id);
});
