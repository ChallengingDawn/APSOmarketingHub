// The two mails with a declaration made on the ticket card (SARCLA 08.11.2026: "it should be much less" - the Back
// Office's own text; EDA's "base yourself on the mails colleagues have written").
import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_TEXT, SAMPLE, companyOf, customerMail, edaMail } from "../src/lib/certificates/makerMail";
import { renderEmail } from "../src/lib/doc/email";

test("customer's mail - the Back Office's short text, the order without its line, signed by the issuer and the company", () => {
  const c = customerMail({ ...SAMPLE, decl: { ...SAMPLE.decl, order: "A26.666379.001" } }, "de");
  assert.equal(c.subject, "APSOparts® | Zertifikat für A26.666379");
  assert.equal(c.body[0], "Sehr geehrter Partner,");
  assert.match(c.body[1], /Bestellung A26\.666379 danken\.\nAnbei finden Sie das Zertifikat für Ihre Unterlagen\./);
  assert.equal(c.body.at(-1), "Sara Gashi\nAPSOparts® AG");
  assert.equal(customerMail({ ...SAMPLE, decl: { ...SAMPLE.decl, entity: "eu" } }, "fr").body.at(-1), "Sara Gashi\nAPSOparts® GmbH");
  for (const lang of Object.keys(CUSTOMER_TEXT) as (keyof typeof CUSTOMER_TEXT)[]) assert.ok(customerMail(SAMPLE, lang).body.join(" ").length < 420, lang);
});
test("customer's mail - in the DoC frame, line breaks kept, the footer the issuing company", () => {
  const c = customerMail(SAMPLE, "de");
  const m = renderEmail({ lang: "de", to: "x@y.ch", company: companyOf(SAMPLE.decl), subject: c.subject, body: c.body });
  assert.equal(m.subject, "APSOparts® | Zertifikat für A26.600000");
  assert.match(m.html, /danken\.<br>Anbei finden Sie/);
  assert.doesNotMatch(m.html, /Konformitätsstatus/);
  assert.match(m.html, /APSOparts® AG<br>/);
});
test("EDA's mail - as the Back Office writes it, the articles and who signed", () => {
  const m = edaMail(SAMPLE, "FDA, EC 1935/2004", null);
  assert.equal(m.subject, "Declaration of conformity FDA, EC 1935/2004 | A26.600000 | Sample Customer AG");
  assert.match(m.text, /^Dear EDA Team\n\nCustomer ordered following article with FDA, EC 1935\/2004 certificate:\n\n8001167981 POM C/);
  assert.match(m.text, /signed by Sara Gashi and Maida Osmani\.\n\nthanks and BR,\nSara Gashi$/);
});
