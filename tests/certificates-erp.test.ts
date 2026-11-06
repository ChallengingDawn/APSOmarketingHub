import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articlesIn, baseOf, certsOf, dateCheck, parseRequests, pickDelivery, positionsText, subjectWithDate, typesInOptions, type Delivery,
} from "../src/lib/certificates/erpRules";
import { intakeOf, teamOf, type IntakeFacts } from "../src/lib/boDistribution/intake";

// ---------------- the ERP's requests (real comments of the ERP's July file) ----------------
test("one request: position and certificate", () => {
  assert.deepEqual(parseRequests("Auftragspos.: 10 - Bitte Konformitätserklärung erstellen: FDA."), [{ pos: "10", type: "FDA" }]);
});
test("two requests on one position, the second after a slash", () => {
  const r = parseRequests("Auftragspos.: 30 - Bitte Konformitätserklärung erstellen: EG 1935/2004 + EU 10/2011. / Auftragspos.: 30 - Bitte Konformitätserklärung erstellen: FDA.");
  assert.deepEqual(r, [{ pos: "30", type: "EG 1935/2004 + EU 10/2011" }, { pos: "30", type: "FDA" }]);
});
test("a ticket link the Back Office pasted after it, with or without a space", () => {
  assert.deepEqual(parseRequests("Auftragspos.: 10 - Bitte Konformitätserklärung erstellen: EG 1935/2004 + EU 10/2011.https://app-eu1.hubspot.com/contacts/26492587/record/0-5/409138375876"), [{ pos: "10", type: "EG 1935/2004 + EU 10/2011" }]);
  assert.deepEqual(parseRequests("Auftragspos.: 20 - Bitte Konformitätserklärung erstellen: EG 1935/2004 + EU 10/2011.   https://app-eu1.hubspot.com/contacts/26492587/record/0-5/357347067070"), [{ pos: "20", type: "EG 1935/2004 + EU 10/2011" }]);
});
test("the German as the ERP's file decodes it badly still reads; free text is not a request", () => {
  assert.deepEqual(parseRequests("Auftragspos.: 60 - Bitte Konformit�tserkl�rung erstellen: BfR. / Auftragspos.: 60 - Bitte Konformit�tserkl�rung erstellen: DM 21/03/1973."), [{ pos: "60", type: "BfR" }, { pos: "60", type: "DM 21/03/1973" }]);
  assert.deepEqual(parseRequests("Kunde braucht FDA Zertifikat, bitte AVOR fragen"), []);
  assert.deepEqual(parseRequests(null), []);
});
test("the ERP's words -> the ticket's certificates (FDA, EC 1935/2004, OTHERS + the rest)", () => {
  assert.deepEqual(certsOf([{ pos: "30", type: "EG 1935/2004 + EU 10/2011" }, { pos: "30", type: "FDA" }]), { certs: ["FDA", "EC 1935/2004"], other: null });
  assert.deepEqual(certsOf([{ pos: "60", type: "BfR" }, { pos: "60", type: "DM 21/03/1973" }, { pos: "60", type: "FDA" }]), { certs: ["FDA", "OTHERS"], other: "BfR, DM 21/03/1973" });
  assert.deepEqual(certsOf([{ pos: "10", type: "EG 1935/2004" }]), { certs: ["EC 1935/2004"], other: null });
});
test("position N = the N/10-th article line of the web order", () => {
  const reqs = [{ pos: "20", type: "FDA" }, { pos: "10", type: "FDA" }, { pos: "20", type: "EG 1935/2004" }];
  assert.equal(positionsText(reqs, ["8001260406", "8001098176"]), "Pos 10. 8001260406 / Pos 20. 8001098176");
  assert.equal(positionsText([{ pos: "40", type: "FDA" }], ["8001260406"]), "Pos 40");
  assert.equal(positionsText([{ pos: "", type: "FDA" }], ["8001260406"]), "");
});
test("the ERP order number's base", () => {
  assert.equal(baseOf("A26.671011.001"), "A26.671011");
  assert.equal(baseOf("A26.671011 "), "A26.671011");
  assert.equal(baseOf("6000290506"), null);
});
test("the shop's options naming a certificate", () => {
  assert.deepEqual(typesInOptions(["FDA", "blau", "EG 1935/2004 + EU 10/2011."]), [{ pos: "", type: "FDA" }, { pos: "", type: "EG 1935/2004 + EU 10/2011" }]);
  assert.deepEqual(typesInOptions(["765 x 465 x 30 mm"]), []);
});

// ---------------- the delivery date (the open tickets of 06.11.2026) ----------------
const D = (s: string) => Date.parse(`${s}T08:00:00Z`);
/** a record of the ERP's order; its date last changed on `changed` (default 06.11) */
const del = (num: string, ship: string | null, status: string, history: string[] = [], lines: string[] = [], changed = "2026-11-06"): Delivery => ({ num, ship, status, history: history.length ? history : ship ? [ship] : [], lines, changedAt: ship ? D(changed) : null });
const TYPED = D("2026-10-28");

test("A26.671011: the ticket had the ERP's first date 05.11, the goods left 03.11 - the date moves", () => {
  const ds = [del("A26.671011.001", "2026-11-03", "invoiced", ["2026-11-05", "2026-11-03"])];
  const c = dateCheck("2026-11-05", TYPED, [], ds);
  assert.deepEqual(c.move, { from: "2026-11-05", to: "2026-11-03" });
  assert.deepEqual(c.erp, { date: "2026-11-03", delivery: "A26.671011.001", shipped: true });
});
test("A26.672969: the ticket's date is the ERP's - nothing to do", () => {
  const ds = [del("A26.672969.000", null, "entered"), del("A26.672969.001", "2026-11-11", "being_delivered"), del("A26.672969.002", "2026-11-12", "being_delivered")];
  const c = dateCheck("2026-11-11", TYPED, [], ds);
  assert.equal(c.move, null);
  assert.equal(c.erp?.delivery, "A26.672969.001");
});
test("two deliveries: the one whose date the ticket was given (A26.668591)", () => {
  const ds = [del("A26.668591.000", null, "entered"), del("A26.668591.001", "2026-10-29", "invoiced", ["2026-11-05", "2026-10-29"]), del("A26.668591.002", "2026-10-29", "invoiced", ["2026-10-30", "2026-10-29"])];
  assert.equal(pickDelivery("2026-11-05", [], ds).d?.num, "A26.668591.001");
});
test("two deliveries: the one carrying the ticket's article wins", () => {
  const ds = [del("A26.1.001", "2026-11-03", "invoiced", [], ["8000000001"]), del("A26.1.002", "2026-11-20", "entered", [], ["8001195777"])];
  assert.equal(pickDelivery("2026-11-05", articlesIn("Pos 20. 8001195777"), ds).d?.num, "A26.1.002");
});
test("two deliveries, none named: the first that has not left", () => {
  const ds = [del("A26.1.001", "2026-11-03", "invoiced"), del("A26.1.002", "2026-11-20", "being_delivered"), del("A26.1.003", "2026-11-18", "pending")];
  assert.equal(pickDelivery("2026-12-01", [], ds).d?.num, "A26.1.003");
});
test("several deliveries, all left, none with the ticket's date: not clear - the date stays", () => {
  const ds = [del("A26.643073.001", "2026-08-20", "invoiced"), del("A26.643073.002", "2026-08-27", "invoiced")];
  const c = dateCheck("2026-11-24", TYPED, [], ds);
  assert.equal(c.erp, null);
  assert.equal(c.move, null);
});
test("only the order, no delivery yet: the ERP has no date - the ticket's stays", () => {
  const c = dateCheck("2027-01-07", TYPED, [], [del("A26.662544.000", null, "entered")]);
  assert.equal(c.move, null);
  assert.match(c.why, /no delivery date yet/);
});
test("no date on the ticket: the ERP's is written", () => {
  assert.deepEqual(dateCheck(null, null, [], [del("A26.9.001", "2026-11-13", "being_delivered")]).move, { from: null, to: "2026-11-13" });
});
test("a credit note or a cancelled record is never the delivery", () => {
  assert.equal(pickDelivery(null, [], [del("A26.9.001", "2026-11-13", "credit_note"), del("A26.9.002", "2026-11-14", "cancelled")]).d, null);
});
test("the newer one wins: a date typed after the ERP's last change stands (A26.643073: fixed by hand 12.10, the ERP's .002 from August)", () => {
  const ds = [del("A26.643073.001", "2026-08-20", "invoiced", [], [], "2026-10-02"), del("A26.643073.002", "2026-08-27", "being_delivered", [], [], "2026-10-02")];
  const c = dateCheck("2026-11-24", D("2026-10-12"), [], ds);
  assert.equal(c.move, null);
  assert.match(c.why, /stands until the ERP/);
});
test("the ERP's date changes again after that: it follows again; the hub's own write is newer - nothing moves", () => {
  assert.deepEqual(dateCheck("2026-11-15", D("2026-11-06"), [], [del("A26.9.001", "2026-11-17", "being_delivered", [], [], "2026-11-08")]).move, { from: "2026-11-15", to: "2026-11-17" });
  assert.equal(dateCheck("2026-11-17", D("2026-11-09"), [], [del("A26.9.001", "2026-11-17", "being_delivered", [], [], "2026-11-08")]).move, null);
});
test("the subject keeps its words, only its date changes", () => {
  assert.equal(subjectWithDate("⚠️ 3 days for delivery - create the certificate | FDA | M110 | A26.671011 | 05.11.26 | Körber |", "2026-11-05", "2026-11-03"),
    "⚠️ 3 days for delivery - create the certificate | FDA | M110 | A26.671011 | 03.11.26 | Körber |");
  assert.equal(subjectWithDate("110/A26.658716 / 706617 Metaflon AG", "2026-11-05", "2026-11-03"), null);
});

// ---------------- the way in's lists, steered ----------------
const facts = (x: Partial<IntakeFacts>): IntakeFacts => ({
  createdBy: null, stage: "2338266325", category: null, certs: null, sourceType: "EMAIL", requirement: null, channel: "1002",
  owner: "76164822", ownerName: null, email: { from: "lager@neu.example", subject: "Lieferung", owner: null }, ...x,
});
test("a team added on the Way in tab names the sender's mails", () => {
  const cfg = { teams: [{ team: "LAGER", from: ["lager@neu.example"] }], creators: [] as string[] };
  assert.equal(teamOf("Lager@Neu.Example", cfg.teams), "LAGER");
  const r = intakeOf(facts({}), cfg);
  assert.equal(r.branch, "EMAIL TEAM");
  assert.equal(r.props.subject, "BO | EMAIL | LAGER | Lieferung |");
  // the workflow's own list does not know it
  assert.equal(intakeOf(facts({})).branch, "EMAIL");
});
test("a person added to the Back Office's own people: their ticket is a mail to a customer", () => {
  const f = facts({ createdBy: "99", sourceType: null, email: { from: null, subject: null, owner: "1229976030" } });
  assert.equal(intakeOf(f, { teams: [], creators: ["99"] }).branch, "MAIL TO CUSTOMER");
  assert.equal(intakeOf(f).branch, "BY HAND");
});
