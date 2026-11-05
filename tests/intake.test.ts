import assert from "node:assert/strict";
import { test } from "node:test";
import { BO_TEAM, CERT_CATEGORY, STAGE_ASSIGNED, STAGE_CERTIFICATES, intakeOf, teamOf, type IntakeFacts } from "../src/lib/boDistribution/intake";

const base = (x: Partial<IntakeFacts>): IntakeFacts => ({
  createdBy: null, stage: "2338266325", category: null, certs: null, sourceType: "EMAIL", requirement: null, channel: "1002",
  owner: null, ownerName: null, email: { from: "someone@customer.ch", subject: "WSMB A26.664122.002", owner: "1229976030" }, ...x,
});

test("an e-mail from a customer: BO | Email | its subject, owner Backoffice Team, the mail - as the workflow wrote it", () => {
  const r = intakeOf(base({ category: "Delivery", owner: "76164822" }));
  assert.equal(r.branch, "EMAIL");
  assert.deepEqual(r.props, { subject: "BO |  Delivery Email | WSMB A26.664122.002 | ", back_office_ticket_requester: "76164822", hubspot_owner_id: BO_TEAM });
  assert.equal(r.mail, true);
  // nothing known: the workflow's three blanks
  assert.equal(intakeOf(base({})).props.subject, "BO |   Email | WSMB A26.664122.002 | ");
});

test("an e-mail from an A+P team: the team in the subject, the first list that names the sender", () => {
  const r = intakeOf(base({ email: { from: "AVOR@angst-pfister.com", subject: "WSMB A26.664122.002", owner: null } }));
  assert.equal(r.branch, "EMAIL TEAM");
  assert.equal(r.props.subject, "BO | EMAIL | AVOR | WSMB A26.664122.002 |");
  assert.equal(teamOf("sales-at@angst-pfister.com"), "AT SPEED BOAT");
  assert.equal(teamOf("_apd._apd@angst-pfister.com"), "APDE");
  assert.equal(teamOf("sensorsandpower.de@angst-pfister.com"), "SENSORS & POWER DE");
  assert.equal(teamOf("nobody@angst-pfister.com"), null);
});

test("created by hand: BO | category | the owner's name; a certificate named = only the requester", () => {
  const r = intakeOf(base({ sourceType: null, createdBy: "59853573", category: "Others", owner: "1229976029", ownerName: "Maya Marzena Gustak", email: null }));
  assert.equal(r.branch, "BY HAND");
  assert.deepEqual(r.props, { subject: "BO |  Others | Maya Marzena Gustak ", back_office_ticket_requester: "1229976029", hubspot_owner_id: BO_TEAM });
  const c = intakeOf(base({ sourceType: null, createdBy: "59853579", category: CERT_CATEGORY, certs: "FDA", owner: BO_TEAM, email: null }));
  assert.deepEqual(c, { branch: "CERTIFICATE", team: null, props: { back_office_ticket_requester: BO_TEAM }, mail: false });
});

test("created by the Back Office: a mail to a customer - stage Assigned, owner = the e-mail's; a certificate request as by hand", () => {
  const r = intakeOf(base({ createdBy: "30050251", sourceType: null, category: "Delivery", owner: "30050251" }));
  assert.deepEqual(r, { branch: "MAIL TO CUSTOMER", team: null, props: { subject: "BO | MAIL TO CUSTOMER or A+P TEAMS", hs_pipeline_stage: STAGE_ASSIGNED, hubspot_owner_id: "1229976030" }, mail: false });
  assert.equal(intakeOf(base({ createdBy: "30050251", category: CERT_CATEGORY, certs: "FDA", owner: "30050251" })).branch, "CERTIFICATE");
  // already in Certificates: not the Back Office's mail branch
  assert.equal(intakeOf(base({ createdBy: "30050251", stage: STAGE_CERTIFICATES, sourceType: null, certs: "FDA" })).branch, "CERTIFICATE");
});

test("a form: only the mail", () => {
  assert.deepEqual(intakeOf(base({ sourceType: "FORM", owner: BO_TEAM })), { branch: "FORM", team: null, props: {}, mail: true });
});
