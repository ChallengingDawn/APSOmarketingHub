import assert from "node:assert/strict";
import { test } from "node:test";
import { decideLink, domainKind, emailDomain, mandantOf } from "../src/lib/contactLink/rules";

const A = { id: "1", name: "Sika Schweiz AG", mandant: "M100" };
const B = { id: "2", name: "Sika Deutschland GmbH", mandant: "M110" };
const C = { id: "3", name: "Sika Services AG", mandant: "M100" };

test("the e-mail domain; free, A+P and empty addresses are never matched", () => {
  assert.equal(emailDomain(" Hans.Muster@Sika.CH "), "sika.ch");
  assert.equal(domainKind("gmail.com"), "free");
  assert.equal(domainKind("bluewin.ch"), "free");
  assert.equal(domainKind("swisscom.ch"), "free");
  assert.equal(domainKind("apsoparts.com"), "internal");
  assert.equal(domainKind(""), "noemail");
  assert.equal(domainKind("sika.ch"), null);
  assert.equal(decideLink({ email: "x@gmail.com" }, [A]).kind, "free");
});

test("one company on the domain: that one", () => {
  const v = decideLink({ email: "a@sika.ch", country: "Germany" }, [A]);
  assert.equal(v.kind, "one");
  assert.equal(v.company?.id, "1");
});

test("several: the Mandant of the contact's country, when exactly one is left (the workflow's rule)", () => {
  assert.equal(mandantOf("", "Schweiz"), "M100");
  assert.equal(mandantOf("Switzerland", "Germany"), "M100");
  assert.equal(mandantOf(null, "France"), "M110");
  assert.equal(mandantOf(null, ""), null);
  const de = decideLink({ email: "a@sika.com", country: "Germany" }, [A, B]);
  assert.equal(de.kind, "mandant");
  assert.equal(de.company?.id, "2");
  // two M100 companies: nothing linked
  assert.equal(decideLink({ email: "a@sika.com", country: "CH" }, [A, B, C]).kind, "several");
  // no country: nothing linked
  assert.equal(decideLink({ email: "a@sika.com" }, [A, B]).kind, "several");
  assert.equal(decideLink({ email: "a@nobody.ch" }, []).kind, "none");
});
