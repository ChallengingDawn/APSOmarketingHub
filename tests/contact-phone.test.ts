import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPhone, decidePhone, normCountry, samePhone, toE164 } from "../src/lib/contactPhone/rules";

test("contact phone: the workflow's helpers", () => {
  assert.equal(normCountry(" Österreich "), "OSTERREICH");
  assert.equal(cleanPhone("+49 (0) 30 / 123-4567"), "+49301234567");
  assert.equal(cleanPhone("+41+79 123"), "+4179123");
  assert.ok(samePhone("+41 79 123 45 67", "41791234567"));
  assert.equal(toE164("079 123 45 67", "Switzerland"), "+41791234567");
});

test("contact phone: the contact's own country when the ERP country is unknown (the workflow never received it)", () => {
  const v = decidePhone({ shop: "079 123 45 67", countryCustom: "", country: "Switzerland" });
  assert.deepEqual([v.phone, v.status, v.countryFrom], ["+41791234567", "normalized", "contact"]);
  const erp = decidePhone({ shop: "079 123 45 67", countryCustom: "Germany", country: "Switzerland" });
  assert.deepEqual([erp.phone, erp.countryFrom], ["+49791234567", "erp"]);
});

// the workflow's own Python gave these answers (scratchpad parity run 25.10.2026: 26 made-up numbers, and 3,426 real
// contacts all identical); the one difference on purpose: "Österreich" (the workflow's table had it garbled)
const VECTORS: [string, string, string | null, string][] = [
  ["079 123 45 67", "Switzerland", "+41791234567", "normalized"],
  ["+41 79 123 45 67", "Germany", "+41791234567", "normalized"],
  ["0041791234567", "", "+41791234567", "normalized"],
  ["41791234567", "CH", "+41791234567", "normalized"],
  ["030 1234567", "Germany", "+49301234567", "normalized"],
  ["+49 (0) 30 1234567", "Germany", "+49301234567", "normalized"],
  ["06 12 34 56 78", "France", "+33612345678", "normalized"],
  ["02 1234 5678", "Italy", "+390212345678", "normalized"],
  ["3912345678", "Italy", "+393912345678", "normalized"],
  ["0664 123 4567", "Österreich", "+436641234567", "normalized"],
  ["0664 123 4567", "Austria", "+436641234567", "normalized"],
  ["079 123 45 67", "", "0791234567", "cleaned"],
  ["123", "Switzerland", null, "invalid"],
  ["n/a", "Switzerland", null, "none"],
  ["+", "Switzerland", null, "none"],
  ["(044) 123-45-67", "schweiz", "+41441234567", "normalized"],
  ["+41+79 123", "CH", "+4179123", "normalized"],
  ["0031 20 123 4567", "Netherlands", "+31201234567", "normalized"],
  ["071 234 56 78", "Liechtenstein", "+423712345678", "normalized"],
  ["12 34 5", "Narnia", "12345", "cleaned"],
  ["1234", "Narnia", "1234", "cleaned"],
  ["0 7 9", "CH", null, "invalid"],
  ["+44 20 7946 0958", "UK", "+442079460958", "normalized"],
  ["020 7946 0958", "United Kingdom", "+442079460958", "normalized"],
];

test("contact phone: the same answers as the workflow's Python", () => {
  for (const [shop, cc, phone, status] of VECTORS) {
    const v = decidePhone({ shop, countryCustom: cc });
    assert.deepEqual([v.phone, v.status], [phone, status], `${shop} / ${cc}`);
  }
  // a phone already there and the same: nothing to write
  assert.equal(decidePhone({ shop: "079 123 45 67", phone: "+41791234567", countryCustom: "Switzerland" }).status, "same");
  assert.equal(decidePhone({ shop: "", phone: "", countryCustom: "Switzerland" }).status, "none");
});
