// The declaration made on the ticket card goes out only when it should (SARCLA 07.11.2026: the certificate maker - the
// issuer and the conformity expert sign, "then sent automatically to the customer and EDA").
import assert from "node:assert/strict";
import { test } from "node:test";
import { demoOf, notSending, parseMaker, type MakerState } from "../src/lib/certificates/makerRules";

const signed: MakerState = {
  v: 1, status: "signed",
  decl: { date: "2026-11-15", customer: ["ALMATECH SRL"], customerNo: "858826", order: "A26.675846", job: "A26.675846.001", issuer: { name: "Sara Gashi", email: "s@x", code: "GASHSA" }, positions: [{ article: "8001267100", text: "POM-C", master: "ec-pom-c-00-001-00" }] },
  files: [{ id: "1", name: "Declaration of Conformity A26.675846.001 POM-C 00.001-00.pdf", master: "ec-pom-c-00-001-00" }],
  signers: {}, send: { to: "buyer@almatech-it.com", lang: "it", at: "2026-11-15T08:00:00Z", by: "Maida Osmani" },
};
const f = { id: "448761174255", hold: null };

test("certificate maker - reads the card's state, and nothing else", () => {
  assert.equal(parseMaker(JSON.stringify(signed))?.status, "signed");
  assert.equal(parseMaker(""), null);
  assert.equal(parseMaker("{not json"), null);
  assert.equal(parseMaker(JSON.stringify({ v: 2, status: "signed" })), null);
});
test("certificate maker - goes out once the expert signed, sending is Live, not held and not a test", () => {
  assert.equal(notSending(f, signed, {}, "live"), null);
});
test("certificate maker - never: sending off, a test, on hold (card or console), not signed by the expert, an address of ours", () => {
  assert.match(String(notSending(f, signed, {}, "off")), /off/);
  assert.match(String(notSending(f, { ...signed, test: true }, {}, "live")), /test/);
  assert.match(String(notSending({ ...f, hold: "Claudio Saraiva · 2026-11-07T17:52:41Z" }, signed, {}, "live")), /hold/);
  assert.match(String(notSending(f, signed, { [f.id]: { by: "x", at: "y" } }, "live")), /hold/);
  assert.match(String(notSending(f, { ...signed, status: "issuer" }, {}, "live")), /expert/);
  assert.match(String(notSending(f, { ...signed, status: "sent" }, {}, "live")), /expert/);
  assert.match(String(notSending(f, { ...signed, send: { ...signed.send!, to: "support@apsoparts.com" } }, {}, "live")), /address/);
  assert.match(String(notSending(f, { ...signed, send: { ...signed.send!, to: "x@support.hs-inbox.com" } }, {}, "live")), /address/);
  assert.match(String(notSending(f, { ...signed, files: [] }, {}, "live")), /PDF/);
});
test("certificate maker - a DEMO request goes to the demo user only, whatever the switch, never as a test or on hold", () => {
  const demo = "Claudio Saraiva · 1229976033 · claudio.saraiva@apsoparts.com";
  assert.deepEqual(demoOf(demo), { name: "Claudio Saraiva", owner: "1229976033", email: "claudio.saraiva@apsoparts.com" });
  assert.equal(demoOf(""), null);
  assert.equal(demoOf("Claudio Saraiva · x · y"), null);
  const own = { ...signed, send: { ...signed.send!, to: "claudio.saraiva@apsoparts.com" } };
  assert.equal(notSending({ ...f, demo }, own, {}, "off"), null);
  assert.match(String(notSending({ ...f, demo }, { ...own, test: true }, {}, "live")), /test/);
  assert.match(String(notSending({ ...f, demo, hold: "x · y" }, own, {}, "live")), /hold/);
  assert.match(String(notSending({ ...f, demo }, { ...own, files: [] }, {}, "live")), /PDF/);
});
