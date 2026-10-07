import assert from "node:assert/strict";
import { test } from "node:test";
import { verdictFrom, type Co } from "../src/lib/connectors/reviewRule";

const co = (id: string, p: Record<string, string>): Co => ({ id, properties: { name: `Co ${id}`, ...p } });

test("a key already on a company is linked - nothing to write", () => {
  assert.equal(verdictFrom("100-867048", [co("1", { company_unique_number: "100-867048" })], []).kind, "linked");
});

test("one company with the ERP id and the right mandant, key empty -> can link", () => {
  const v = verdictFrom("100-867048", [], [co("2", { erp_customer_id: "867048", mandant: "M100" }), co("3", { erp_customer_id: "867048", mandant: "M110" })]);
  assert.deepEqual(v, { kind: "can_link", companyId: "2", name: "Co 2" });
});

test("the mandant must agree; a record without mandant is the fallback", () => {
  assert.equal(verdictFrom("110-1", [], [co("2", { mandant: "M100" })]).kind, "missing");
  assert.equal(verdictFrom("110-1", [], [co("4", {})]).kind, "can_link");
});

test("never guesses: several candidates, another key, nothing, or not a key", () => {
  assert.equal(verdictFrom("100-5", [], [co("a", { mandant: "M100" }), co("b", { mandant: "M100" })]).kind, "several");
  const c = verdictFrom("100-5", [], [co("a", { mandant: "M100", company_unique_number: "100-6" })]);
  assert.equal(c.kind, "conflict");
  assert.equal(verdictFrom("100-5", [], []).kind, "missing");
  assert.equal(verdictFrom("ABC", [], []).kind, "invalid");
});
