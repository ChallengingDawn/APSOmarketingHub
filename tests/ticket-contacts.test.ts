import assert from "node:assert/strict";
import { test } from "node:test";
import { contactAddresses, contactCompanies } from "../src/lib/ticketAssoc/contactRules";

test("the customer addresses of a ticket's e-mails: headers, case folded, colleagues and robots left out", () => {
  const r = contactAddresses([
    { from: "Jane Doe <Jane.Doe@Customer.ch>", to: "helpline@apsoparts.com", cc: "boss@angst-pfister.com; buyer@customer.ch", text: "hello" },
    { from: "noreply@shop.example", to: "sales@apso-parts.com", bcc: "x@sub.angst-pfister.com" },
  ]);
  assert.deepEqual(r.external, ["buyer@customer.ch", "jane.doe@customer.ch"]);
  assert.deepEqual(r.forwarded, []);
});

test("a forwarded mail: the customer is in the quoted header block, in any of the five languages", () => {
  const body = [
    "Hallo zusammen, bitte anschauen.",
    "---------- Forwarded message ---------",
    "Von: Max Muster <max@kunde.de>",
    "Gesendet: Montag, 12. Oktober 2026",
    "An: verkauf@angst-pfister.com",
    "",
    "De : Marie <marie@client.fr>",
    "Da: luigi@cliente.it",
    "Per: ordini@cliente.it",
    "Remetente: joao@cliente.pt",
    "Betreff: Anfrage O-Ringe",
  ].join("\r\n");
  const r = contactAddresses([{ from: "rep@angst-pfister.com", to: "helpline@apsoparts.com", text: body }]);
  assert.deepEqual(r.external, ["joao@cliente.pt", "luigi@cliente.it", "marie@client.fr", "max@kunde.de", "ordini@cliente.it"]);
  assert.deepEqual(r.forwarded, r.external);
  // a body line that is not a header ("Anfrage: ...") is not read; an address in running text neither
  assert.deepEqual(contactAddresses([{ text: "Please write to info@other.com.\nSubject: hi" }]).external, []);
});

test("a contact brings its primary company - not every company it is on; without one, all of them", () => {
  assert.deepEqual(contactCompanies("111", ["111", "222", "333"]), ["111"]);
  assert.deepEqual(contactCompanies(null, ["222", "333", "222"]), ["222", "333"]);
  assert.deepEqual(contactCompanies(undefined, []), []);
});
