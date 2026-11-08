// The mail to AVOR from the ticket card, and AVOR's answer merged back (SARCLA 08.11.2026: "can we send the mail directly
// from here"): what goes, to whom, and which incoming mail counts as AVOR's answer.
import assert from "node:assert/strict";
import { test } from "node:test";
import { AVOR_TO, avorNotSending, avorRefOf, isAvorAnswer, parseAvor, type AvorState } from "../src/lib/certificates/makerRules";

const queued: AvorState = {
  v: 1, status: "queued", kind: "", to: AVOR_TO,
  subject: "WSMB | EG1935/2004 | M100 | A26.675846 | 858826 ALMATECH SRL | APSOparts®",
  body: "Hallo Zusammen\n\nBitte ein EG1935 Artikel erstellen:\n1 Stk 8001167981 POM C\n\ndanke und liebe grüsse\nSara Gashi",
  by: { name: "Sara Gashi", email: "s@x", owner: "1" }, at: "2026-11-08T08:00:00Z",
};
const f = { id: "448941777101", hold: null };
const DEMO = "Claudio Saraiva · 1229976033 · claudio.saraiva@apsoparts.com";

test("AVOR mail - reads the card's state, and nothing else", () => {
  assert.equal(parseAvor(JSON.stringify(queued))?.status, "queued");
  assert.equal(parseAvor(""), null);
  assert.equal(parseAvor("{x"), null);
  assert.equal(parseAvor(JSON.stringify({ v: 1, status: "queued" })), null);
});
test("AVOR mail - goes to AVOR's address only; a DEMO to the demo user only; never on hold", () => {
  assert.equal(avorNotSending(f, queued, {}), null);
  assert.match(String(avorNotSending({ ...f, hold: "SARCLA · 2026-11-08" }, queued, {})), /hold/);
  assert.match(String(avorNotSending(f, { ...queued, to: "support@apsoparts.com" }, {})), /AVOR/);
  // a DEMO: the queued mail to the demo user goes, AVOR's address does not
  assert.equal(avorNotSending({ ...f, demo: DEMO }, { ...queued, to: "claudio.saraiva@apsoparts.com" }, {}), null);
  assert.match(String(avorNotSending({ ...f, demo: DEMO }, queued, {})), /AVOR/);
  assert.match(String(avorNotSending(f, { ...queued, status: "sent" }, {})), /nothing/);
  assert.match(String(avorNotSending(f, { ...queued, body: " " }, {})), /text/);
});
test("AVOR mail - the A-number in the subject, as written and as answered", () => {
  assert.equal(avorRefOf(queued.subject), "A26.675846");
  assert.equal(avorRefOf(`AW: ${queued.subject}`), "A26.675846");
  assert.equal(avorRefOf(`RE: Erinnerung: ${queued.subject}`), "A26.675846");
  assert.equal(avorRefOf("WSMB | EG 1935 / 2004 | M110 | a26.001234 | x"), "A26.001234");
  assert.equal(avorRefOf("CERTIFICATES | FDA | M100 | A26.675846 | 10.11.26 |"), null);
  assert.equal(avorRefOf(null), null);
});
test("AVOR's answer - one of ours, naming the request, after the hub's mail went out", () => {
  const sent = { ...queued, status: "sent" as const, sent: [{ at: "2026-11-08T08:03:00Z", to: AVOR_TO, by: "Sara Gashi" }] };
  const at = Date.parse("2026-11-08T10:00:00Z");
  assert.equal(isAvorAnswer({ from: "avor@angst-pfister.com", subject: `AW: ${queued.subject}`, at }, "A26.675846", sent), true);
  assert.equal(isAvorAnswer({ from: "Peter.Muster@angst-pfister.com", subject: `AW: ${queued.subject}`, at }, "A26.675846", sent), true);
  // a customer, another order, before the mail, or no mail sent by the hub: not AVOR's answer
  assert.equal(isAvorAnswer({ from: "buyer@almatech-it.com", subject: `AW: ${queued.subject}`, at }, "A26.675846", sent), false);
  assert.equal(isAvorAnswer({ from: "avor@angst-pfister.com", subject: "AW: WSMB | EG1935/2004 | M100 | A26.111111 | x", at }, "A26.675846", sent), false);
  assert.equal(isAvorAnswer({ from: "avor@angst-pfister.com", subject: `AW: ${queued.subject}`, at: Date.parse("2026-11-07T10:00:00Z") }, "A26.675846", sent), false);
  assert.equal(isAvorAnswer({ from: "avor@angst-pfister.com", subject: `AW: ${queued.subject}`, at }, "A26.675846", queued), false);
});
test("AVOR's answer in a DEMO - the demo user's reply counts, only on a DEMO request", () => {
  const demo = { ...queued, status: "sent" as const, kind: "demo" as const, to: "claudio.saraiva@apsoparts.com", sent: [{ at: "2026-11-08T08:55:13Z", to: "claudio.saraiva@apsoparts.com", by: "Claudio Saraiva" }] };
  const at = Date.parse("2026-11-08T09:10:00Z");
  assert.equal(isAvorAnswer({ from: "Claudio.Saraiva@apsoparts.com", subject: `AW: [DEMO] ${queued.subject}`, at }, "A26.675846", demo), true);
  assert.equal(isAvorAnswer({ from: "claudio.saraiva@apsoparts.com", subject: `AW: ${queued.subject}`, at }, "A26.675846", { ...demo, kind: "" }), false);
  assert.equal(isAvorAnswer({ from: "someone@apsoparts.com", subject: `AW: ${queued.subject}`, at }, "A26.675846", demo), false);
});
test("AVOR mail - switched off on Settings: a real request's mail does not go, a DEMO's still does", () => {
  assert.match(String(avorNotSending(f, queued, {}, false)), /off on Certificates > Settings/);
  assert.equal(avorNotSending({ ...f, demo: DEMO }, { ...queued, to: "claudio.saraiva@apsoparts.com" }, {}, false), null);
  // on hold stays on hold (it waits), whatever the switch
  assert.match(String(avorNotSending({ ...f, hold: "SARCLA · 2026-11-08" }, queued, {}, false)), /hold/);
});
