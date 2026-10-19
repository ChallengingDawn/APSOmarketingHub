import assert from "node:assert/strict";
import { test } from "node:test";
import { ANYSEALS_FOLDER, GQS_WAITING_APSO, NOTE_NO_O, customerEmail, mergeIntoGqs, noteMerged, noteNoMatch, oNumber, salesCategory, type Call } from "../src/lib/boDistribution/codeSteps";

test("step #50: the O number as the code reads it", () => {
  assert.equal(oNumber("Task Status Report O26.12345678 done"), "O26.12345678");
  assert.equal(oNumber("re: o26.12345678"), "O26.12345678");
  assert.equal(oNumber("XO26.123456789Y"), "O26.12345678"); // no boundaries, 9th digit ignored
  assert.equal(oNumber("O26.1234567"), null);
  assert.equal(oNumber("O26.11111111 and O27.22222222"), "O26.11111111"); // leftmost
  assert.equal(oNumber(null), null);
  assert.match(NOTE_NO_O, /^⚠️ NO O NUMBER FOUND/);
  assert.match(noteNoMatch("O26.1"), /O Number: O26\.1/);
  assert.match(noteMerged("O26.1", false, true), /please set it by hand/);
  assert.equal(ANYSEALS_FOLDER, "397778236611");
});

test("step #50: the merge - GQS primary, owner copied, Waiting on APSO, a note", async () => {
  const calls: string[] = [];
  const call: Call = async <T,>(path: string, method = "GET", body?: unknown) => {
    calls.push(`${method} ${path} ${body ? JSON.stringify(body) : ""}`);
    if (path.endsWith("/merge")) return { id: "900" } as T;
    if (method === "GET") return { properties: { hs_pipeline_stage: GQS_WAITING_APSO } } as T;
    return {} as T;
  };
  const r = await mergeIntoGqs(call, "100", "O26.12345678", { id: "900", ownerId: "7" });
  assert.equal(r.ok, true);
  assert.match(calls[0], /^PATCH \/crm\/v3\/objects\/tickets\/100 .*"hubspot_owner_id":"7"/);
  assert.match(calls[1], /^POST \/crm\/v3\/objects\/tickets\/merge .*"primaryObjectId":"900","objectIdToMerge":"100"/);
  assert.match(calls[2], /^PATCH \/crm\/v3\/objects\/tickets\/900 .*"hs_pipeline_stage":"2338266316".*"hubspot_owner_id":"7"/);
  assert.match(calls.at(-1)!, /^POST \/crm\/v3\/objects\/notes .*TASK STATUS UPDATE MERGED/);
});

test("step #75: the category by keywords, as the code counts them", () => {
  assert.equal(salesCategory("Bitte um Angebot und Preis"), "Product Price");
  assert.equal(salesCategory("Datenblatt und Zeichnung bitte"), "Product Information");
  assert.equal(salesCategory("price and datasheet"), "Product Price"); // a tie goes to Product Price
  assert.equal(salesCategory("specification"), "Product Information"); // spec + specifica + specification = 3
  assert.equal(salesCategory("hello"), "");
});

test("step #75: the customer's address from the forwarded e-mail", () => {
  const body = ["Hi team, please handle", "", "Von: Müller Hans <hans.mueller@kunde.ch>", "Gesendet: Montag", "An: jeremy.borey@apsoparts.com"].join("\n");
  assert.equal(customerEmail(body, "jeremy.borey@apsoparts.com"), "hans.mueller@kunde.ch");
  assert.equal(customerEmail("see info@apsoparts.com and buyer@acme.de", "x@apsoparts.com"), "buyer@acme.de"); // internal skipped, fallback pass
  assert.equal(customerEmail("From: jeremy.borey@apsoparts.com", "jeremy.borey@apsoparts.com"), "");
  assert.equal(customerEmail("De : José <josé.núñez@cliente.es>", "a@apsoparts.com"), "josé.núñez@cliente.es"); // Unicode like Python's \w
});
