import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, emailDomain, hasLegalForm, isNameGuess, nameSlug, pickBest, websiteDomain, type Facts } from "../src/lib/companyDomain/rules";

const facts = (f: Partial<Facts>): Facts => ({ name: "Muster", website: null, apso: "APSOprospect", turnover: 0, revenue: 0, contacts: 1, emails: [], ...f });

test("e-mail and website domains, lower case, nothing that is not one", () => {
  assert.equal(emailDomain(" Anna.Muster@Muster-AG.CH "), "muster-ag.ch");
  assert.equal(emailDomain("no-at-sign"), null);
  assert.equal(emailDomain("a@localhost"), null);
  assert.equal(websiteDomain("https://www.Foo-AG.ch/de/home?x=1"), "foo-ag.ch");
  assert.equal(websiteDomain("www2.bar.de"), "bar.de");
  assert.equal(websiteDomain(""), null);
});

test("the workflow's pick: the best ending first, then the most contacts", () => {
  assert.equal(pickBest(["muster.ch", "muster.com"]), "muster.com");
  assert.equal(pickBest(["a.ch", "b.ch", "b.ch"]), "b.ch");
  assert.equal(pickBest(["x.io", "y.de"]), "y.de");
  assert.equal(pickBest([]), null);
});

test("legal forms, Sàrl and B.V.-less names alike", () => {
  assert.equal(hasLegalForm("Fornay Frères Sàrl"), true);
  assert.equal(hasLegalForm("Steiger galvanotechnique SA"), true);
  assert.equal(hasLegalForm("Samsung Electronics"), false); // "SA" inside a word is not one
  assert.equal(hasLegalForm("Hans Muster"), false);
});

test("the name guesses the workflow wrote are recognised (real cases from 25.10.2026)", () => {
  assert.equal(nameSlug("TMW Hoffmann CNC Fräsen Drehen 3D Druck"), "tmw-hoffmann-cnc-fraesen-drehen-3d-druck");
  assert.equal(isNameGuess("tmw-hoffmann-cnc-fraesen-drehen-3d-druck.de", "TMW Hoffmann CNC Fräsen Drehen 3D Druck"), true);
  assert.equal(isNameGuess("sulzer-pumps-wastewater-netherlands-bv.nl", "Sulzer Pumps Wastewater Netherlands B.V."), true);
  assert.equal(isNameGuess("eta-centre-de-production-usine-16.ch", "ETA SA Centre de production usine 16"), true);
  assert.equal(isNameGuess("hugo-kemmerich.de", "Hugo Kemmerich GmbH"), true);
  assert.equal(isNameGuess("muster.co.uk", "Muster Ltd"), true);
  assert.equal(isNameGuess("sulzer.com", "Sulzer Pumps Wastewater Netherlands B.V."), false);
  assert.equal(isNameGuess("kemmerich.de", "Hugo Kemmerich GmbH"), false);
  assert.equal(isNameGuess("x.de", "X"), false); // a one-letter name is never taken for a guess
});

test("a company without a domain gets its contacts' work domain - never a guess from the name", () => {
  const v = decide(facts({ name: "Muster AG", emails: ["a@gmail.com", "b@muster.ch", "c@muster.com", "d@angst-pfister.com"] }));
  assert.deepEqual([v.kind, v.domain, v.micro], ["contacts", "muster.com", false]);
  assert.deepEqual(v.from, ["c@muster.com"]);
  // A+P's own people never give a customer its domain; the website comes next
  const w = decide(facts({ name: "Muster AG", website: "https://www.muster.ch/", emails: ["x@apsoparts.com"] }));
  assert.deepEqual([w.kind, w.domain], ["website", "muster.ch"]);
  // nothing usable: no domain at all
  assert.deepEqual(decide(facts({ name: "Muster AG", contacts: 0 })), { kind: "nocontacts", domain: null, from: [], micro: false });
  assert.equal(decide(facts({ name: "Muster AG", contacts: 2 })).kind, "noemail");
});

test("private or micro: only private e-mails, no legal form, never bought, still a prospect", () => {
  assert.equal(decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"] })).micro, true);
  assert.equal(decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"], apso: "" })).micro, true);
  assert.equal(decide(facts({ name: "Muster GmbH", emails: ["hans@bluewin.ch"] })).micro, false); // a legal form
  assert.equal(decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"], revenue: 120 })).micro, false); // bought once
  assert.equal(decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"], apso: "APSOcore" })).micro, false); // a real customer
  assert.equal(decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"], apso: "APSOlost" })).micro, false);
  assert.equal(decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"], turnover: 5000 })).micro, false);
  const v = decide(facts({ name: "Hans Muster", emails: ["hans@bluewin.ch"] }));
  assert.deepEqual([v.kind, v.domain, v.from], ["generic", null, ["hans@bluewin.ch"]]);
});
