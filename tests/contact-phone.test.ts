import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPhone, cleanPhone, decidePhone, normCountry, repairPhone, samePhone, toE164, validE164 } from "../src/lib/contactPhone/rules";

test("contact phone: the workflow's helpers", () => {
  assert.equal(normCountry(" Österreich "), "OSTERREICH");
  assert.equal(cleanPhone("+49 (0) 30 / 123-4567"), "+49301234567");
  assert.equal(cleanPhone("+41+79 123"), "+4179123");
  assert.ok(samePhone("+41 79 123 45 67", "41791234567"));
  assert.equal(toE164("079 123 45 67", "Switzerland"), "+41791234567");
  assert.equal(validE164("+41791234567"), "+41791234567");
  assert.equal(validE164("+4179123"), null);
  assert.equal(validE164("0791234567"), null);
});

test("contact phone: the contact's own country when the ERP country is unknown or gives no valid number", () => {
  const v = decidePhone({ shop: "079 123 45 67", countryCustom: "", country: "Switzerland" });
  assert.deepEqual([v.phone, v.status, v.countryFrom], ["+41791234567", "normalized", "contact"]);
  const erp = decidePhone({ shop: "079 123 45 67", countryCustom: "Germany", country: "Switzerland" });
  assert.deepEqual([erp.phone, erp.countryFrom], ["+49791234567", "erp"]);
  // Liechtenstein's code on a Swiss number is not valid - the contact's own country is
  const li = decidePhone({ shop: "071 234 56 78", countryCustom: "Liechtenstein", country: "Switzerland" });
  assert.deepEqual([li.phone, li.status, li.countryFrom], ["+41712345678", "normalized", "contact"]);
});

// the workflow's own Python gave these numbers (scratchpad parity run 25.10.2026: 26 made-up numbers and 3,426 real
// contacts identical); since the audit of the same evening only a VALID number is written - the workflow's digits-only
// and too-short answers are "invalid" now (shown with what the workflow would have written)
const VECTORS: [string, string, string | null, string, string | null][] = [
  ["079 123 45 67", "Switzerland", "+41791234567", "normalized", null],
  ["+41 79 123 45 67", "Germany", "+41791234567", "normalized", null],
  ["0041791234567", "", "+41791234567", "normalized", null],
  ["41791234567", "CH", "+41791234567", "normalized", null],
  ["030 1234567", "Germany", "+49301234567", "normalized", null],
  ["+49 (0) 30 1234567", "Germany", "+49301234567", "normalized", null],
  ["06 12 34 56 78", "France", "+33612345678", "normalized", null],
  ["02 1234 5678", "Italy", "+390212345678", "normalized", null],
  ["3912345678", "Italy", "+393912345678", "normalized", null],
  ["0664 123 4567", "Österreich", "+436641234567", "normalized", null],
  ["0664 123 4567", "Austria", "+436641234567", "normalized", null],
  ["(044) 123-45-67", "schweiz", "+41441234567", "normalized", null],
  ["0031 20 123 4567", "Netherlands", "+31201234567", "normalized", null],
  ["+44 20 7946 0958", "UK", "+442079460958", "normalized", null],
  ["020 7946 0958", "United Kingdom", "+442079460958", "normalized", null],
  ["079 123 45 67", "", null, "invalid", "0791234567"],
  ["123", "Switzerland", null, "invalid", null],
  ["+41+79 123", "CH", null, "invalid", "+4179123"],
  ["071 234 56 78", "Liechtenstein", null, "invalid", "+423712345678"],
  ["12 34 5", "Narnia", null, "invalid", "12345"],
  ["0 7 9", "CH", null, "invalid", null],
  ["n/a", "Switzerland", null, "none", null],
  ["+", "Switzerland", null, "none", null],
];

test("contact phone: only valid numbers - the workflow's answer when it is valid", () => {
  for (const [shop, cc, phone, status, asWorkflow] of VECTORS) {
    const v = decidePhone({ shop, countryCustom: cc });
    assert.deepEqual([v.phone, v.status], [phone, status], `${shop} / ${cc}`);
    if (status === "invalid") assert.equal(v.asWorkflow ?? null, asWorkflow, `${shop} / ${cc} (as the workflow)`);
  }
  assert.equal(decidePhone({ shop: "079 123 45 67", phone: "+41791234567", countryCustom: "Switzerland" }).status, "same");
});

test("contact phone: the workflow's two faults repaired - two country codes, a 0 after the code (never Italy's 0)", () => {
  // a Dutch mobile typed without "+" for a Swiss customer: the workflow wrote +41 31 6…
  const dbl = decidePhone({ shop: "31 6 1234 5678", countryCustom: "Switzerland" });
  assert.deepEqual([dbl.phone, dbl.status, dbl.how], ["+31612345678", "repaired", "double"]);
  const zero = decidePhone({ shop: "+41 079 123 45 67", countryCustom: "Switzerland" });
  assert.deepEqual([zero.phone, zero.status, zero.how], ["+41791234567", "repaired", "zero"]);
  assert.equal(decidePhone({ shop: "+39 02 1234 5678", countryCustom: "Italy" }).phone, "+390212345678");
  assert.equal(repairPhone("+39 0212345678"), null);
  // a national number (leading 0) is never read as an international one
  assert.equal(repairPhone("0316123456789"), null);
});

test("contact phone: a phone already in HubSpot - valid, or its certain repair, or for a person", () => {
  assert.equal(checkPhone({ phone: "+41791234567" }), null);
  assert.deepEqual(checkPhone({ phone: "0791234567", country: "Switzerland" }), { repair: "+41791234567", how: "nocode" });
  assert.deepEqual(checkPhone({ phone: "+4131612345678", shop: "31612345678", countryCustom: "Switzerland" }), { repair: "+31612345678", how: "double" });
  assert.deepEqual(checkPhone({ phone: "+410791234567", countryCustom: "Switzerland" }), { repair: "+41791234567", how: "zero" });
  assert.deepEqual(checkPhone({ phone: "+41791234", countryCustom: "Switzerland" }), { repair: null, how: null });
  // two codes only when the old workflow put them there (the shop phone is the number without the code)
  assert.deepEqual(checkPhone({ phone: "+4131612345678", shop: "+41 31 612 34 56 78", countryCustom: "Switzerland" }), { repair: null, how: null });
});
