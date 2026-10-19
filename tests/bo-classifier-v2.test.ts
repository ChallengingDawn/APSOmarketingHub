import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTicket, removeSignatureNoise } from "../src/lib/boDistribution/classifier";
import { FIXES, classifyTicketV2, type ClassificationV2, type FixId, type FixSwitches } from "../src/lib/boDistribution/classifierV2";

// The classifier v2: v1 (the live step, tests/bo-classifier.test.ts) with named, switchable fixes. Each fix gets
// a test on an invented ticket: v1's answer, v2's answer, and v2 with that one fix off. All texts are made up.

const v1 = (subject: string | null, content: string | null) => classifyTicket({ subject, content });
const v2 = (subject: string | null, content: string | null, switches?: FixSwitches) => classifyTicketV2({ subject, content }, switches);
const ALL_OFF: FixSwitches = Object.fromEntries(FIXES.map((f) => [f.id, false]));
const withoutFixes = ({ fixes: _fixes, ...rest }: ClassificationV2) => rest;
/** v2 with this fix off answers as v1 does on this ticket */
function offIsV1(id: FixId, subject: string | null, content: string | null) {
  const c = v2(subject, content, { [id]: false });
  const a = v1(subject, content);
  assert.equal(c.category, a.category, `${id} off: category`);
  assert.equal(c.subCategory, a.subCategory, `${id} off: sub-category`);
  assert.ok(!c.fixes.includes(id), `${id} off is not reported`);
}

test("FIXES: unique ids, each with a title and a plain-English description", () => {
  const ids = FIXES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of FIXES) assert.ok(f.title.length > 5 && f.description.length > 40, f.id);
});

test("null-fields: an empty subject or body no longer stops the classifier", () => {
  const body = "Guten Tag\nbitte um Angebot für 200 O-Ringe 20x2 NBR.";
  assert.equal(v1(null, body).status, "error");
  assert.equal(v1(null, body).category, null);
  const c = v2(null, body);
  assert.equal(c.category, "Product Price");
  assert.equal(c.subCategory, "Request for quotation");
  assert.deepEqual(c.fixes, ["null-fields"]);
  assert.equal(v2("Payment advice 0000123456", null).category, "Invoicing & Accounting");
  assert.equal(v2(null, body, { "null-fields": false }).status, "error");
  assert.equal(v2(null, null).status, "skipped");
});

test("curly-apostrophe: \"demande d’offre\" reads as \"demande d'offre\"", () => {
  const [s, b] = ["Demande d’offre joints toriques", "Bonjour,\nvoir ci-dessous les quantités."];
  assert.equal(v1(s, b).subCategory, null);
  const c = v2(s, b);
  assert.equal(c.category, "Product Price");
  assert.equal(c.subCategory, "Request for quotation");
  assert.ok(c.fixes.includes("curly-apostrophe"));
  offIsV1("curly-apostrophe", s, b);
});

test("company-line: \"Incorrect…\", \"50 kg…\" and the French \"sa\" are no longer dropped as company names", () => {
  const s = "Commande 4711";
  for (const b of [
    "Hello,\nIncorrect delivery: we got the wrong item.",
    "Bonjour,\nNous avons reçu 50 kg au lieu de 500 kg.",
    "Bonjour,\nPouvez-vous confirmer sa livraison ?",
  ]) {
    assert.equal(v1(s, b).category, null, b);
    const c = v2(s, b);
    assert.equal(c.category, "Delivery", b);
    assert.deepEqual(c.fixes, ["company-line"], b);
    offIsV1("company-line", s, b);
  }
  // a real company line still goes
  const sig = "Hello,\nplease send the datasheet.\nMuster Pricing AG\n";
  assert.equal(v2("Documents", sig).category, "Product Information");
  assert.deepEqual(v2("Documents", sig).fixes, []);
});

test("more-greetings: Regards, Viele Grüsse, Met vriendelijke groet, Pozdrawiam… end the message", () => {
  const s = "Unterlagen";
  for (const greeting of ["Regards", "Viele Grüsse", "Met vriendelijke groet", "Pozdrawiam", "Bien à vous", "Saluti", "Gruss", "LG"]) {
    const b = `Guten Tag\nbitte senden Sie uns das Datenblatt.\n${greeting}\nAnna Muster\nEinkauf | Preise & Kosten`;
    assert.equal(v1(s, b).category, "Product Price", greeting); // the signature's "Preise", "Kosten"
    const c = v2(s, b);
    assert.equal(c.category, "Product Information", greeting);
    assert.deepEqual(c.fixes, ["more-greetings"], greeting);
    offIsV1("more-greetings", s, b);
  }
  // "Grüss Gott" opens a mail; "Regarding" is not "Regards"
  assert.equal(v2(s, "Grüss Gott\nbitte senden Sie uns das Datenblatt.").category, "Product Information");
  assert.equal(v2(s, "Regarding the datasheet: please send it.").category, "Product Information");
});

test("mail-headers: quoted From / Sent lines no longer score Delivery", () => {
  const s = "AW: Ihre Nachricht";
  const b = "Guten Tag\nwir brauchen das Datenblatt.\n\nVon: Peter Muster\nGesendet: Montag, 5. Oktober 2026 10:00\nAn: Info\nBetreff: Ihre Nachricht\n\nVon: Info\nGesendet: Freitag, 2. Oktober 2026 08:00\nAn: Peter Muster\nBetreff: Ihre Nachricht";
  assert.equal(v1(s, b).category, "Delivery"); // "Gesendet" twice
  const c = v2(s, b);
  assert.equal(c.category, "Product Information");
  assert.deepEqual(c.fixes, ["mail-headers"]);
  offIsV1("mail-headers", s, b);
});

test("read-forwarded: a forward with a short note is read past the colleague's greeting", () => {
  const s = "WG: Muster AG / Kundenanfrage";
  const quoted = "Von: Peter Muster <peter@muster.example>\nGesendet: Montag, 5. Oktober 2026 10:00\nAn: Info\nBetreff: Kundenanfrage\n\nGuten Tag\nkönnen Sie uns das Datenblatt für EPDM 70 senden?\nFreundliche Grüsse\nPeter Muster";
  const b = `Bitte übernehmen.\nMit freundlichen Grüssen\nElli\n\n${quoted}`;
  assert.equal(v1(s, b).category, null);
  const c = v2(s, b);
  assert.equal(c.category, "Product Information");
  assert.ok(c.fixes.includes("read-forwarded"));
  assert.equal(v2(s, b, { "read-forwarded": false }).category, null);
  // a reply is not a forward, and our own quoted mail is not the customer's message
  assert.equal(v2("AW: Muster AG / Kundenanfrage", b).category, null);
  assert.equal(v2(s, b.replace("Peter Muster <peter@muster.example>", "APSOparts Support <support@apsoparts.example>")).category, null);
});

test("reach-verb: \"reach out\" is not the REACH regulation", () => {
  const [s, b] = ["Product question", "Hi, could you reach out to me regarding the product dimensions?"];
  assert.equal(v1(s, b).subCategory, "Conformities / Certificates");
  const c = v2(s, b);
  assert.equal(c.category, "Product Information");
  assert.notEqual(c.subCategory, "Conformities / Certificates");
  assert.deepEqual(c.fixes, ["reach-verb"]);
  offIsV1("reach-verb", s, b);
  // the regulation still counts
  assert.equal(v2(s, "Hello, please send the REACH declaration for this product.").subCategory, "Conformities / Certificates");
});

test("invoice-not-received: \"not received the invoice\" is Invoicing, not Delivery", () => {
  const [s, b] = ["Order A26.123456", "Hello,\nwe have not received the invoice for this order yet."];
  assert.equal(v1(s, b).category, "Delivery"); // "received" ties "invoice", Delivery comes first
  const c = v2(s, b);
  assert.equal(c.category, "Invoicing & Accounting");
  assert.equal(c.subCategory, "Invoice not received");
  assert.equal(c.orderNumber, "A26.123456");
  assert.deepEqual(c.fixes, ["invoice-not-received"]);
  offIsV1("invoice-not-received", s, b);
  // German, the words apart
  const de = v2("Bestellung 4711", "Guten Tag\nwir haben die Rechnung zu dieser Lieferung noch nicht erhalten.");
  assert.equal(de.category, "Invoicing & Accounting");
  assert.equal(de.subCategory, "Invoice not received");
});

test("rfq-own-name: \"request for quotation\" names its own sub-category", () => {
  const [s, b] = ["Request for quotation - O-rings", "Hello,\n100 pcs O-ring 20x2 NBR 70."];
  assert.equal(v1(s, b).category, "Product Price");
  assert.equal(v1(s, b).subCategory, null);
  const c = v2(s, b);
  assert.equal(c.subCategory, "Request for quotation");
  assert.deepEqual(c.fixes, ["rfq-own-name"]);
  offIsV1("rfq-own-name", s, b);
});

test("generic-words-need-price: \"anbei\" alone is not a quotation request; with an order or an enquiry it still is", () => {
  const [s, b] = ["Zahlungsavis", "Guten Tag\nAnbei erhalten Sie den Zahlungsavis vom 02.10.2026."];
  assert.equal(v1(s, b).subCategory, "Request for quotation");
  const c = v2(s, b);
  assert.equal(c.category, null);
  assert.deepEqual(c.fixes, ["generic-words-need-price"]);
  offIsV1("generic-words-need-price", s, b);
  for (const [subject, body] of [
    ["Bestellung 4711", "Guten Tag\nAnbei erhalten Sie unsere Bestellung."],
    ["Anfrage", "Guten Tag\nAnbei erhalten Sie unsere Anfrage."],
    ["Einkaufsbeleg B-4711", "Guten Tag\nAnbei der Einkaufsbeleg. Bitte um Zusendung der Auftragsbestätigung."],
  ]) {
    assert.equal(v2(subject, body).category, "Product Price", subject);
    assert.equal(v2(subject, body).subCategory, "Request for quotation", subject);
  }
});

test("existing-order: on a reply to our order confirmation, order words are not a new order", () => {
  const s = "AW: Ihre Bestellung 4711 / Auftragsbestätigung A26.123456 vom 01.10.2026";
  const b = "Guten Tag\nbitte ändern Sie unsere Bestellung auf 10 Stück.";
  assert.equal(v1(s, b).category, "Product Price");
  const c = v2(s, b);
  assert.equal(c.category, "Delivery");
  assert.ok(c.fixes.includes("existing-order"));
  offIsV1("existing-order", s, b);
  // price words still count
  assert.equal(v2(s, "Guten Tag\nfalscher Preis auf der Auftragsbestätigung.").subCategory, "Wrong price on my order");
  // our order number alone is enough; without it (or a confirmation word) the order words count as in v1
  assert.equal(v2("unsere Bestellung A26.123456.000", b).category, "Delivery");
  assert.equal(v2("Bestellung 4711", b).category, "Product Price");
});

test("enquiry-is-rfq: an \"Anfrage\" with nothing else to go on is a quotation request", () => {
  const [s, b] = ["WG: Anfrage 6000123456", "Guten Tag\nbitte übernehmen.\nGruss Peter"];
  assert.equal(v1(s, b).category, null);
  const c = v2(s, b);
  assert.equal(c.category, "Product Price");
  assert.equal(c.subCategory, "Request for quotation");
  assert.ok(c.fixes.includes("enquiry-is-rfq"));
  offIsV1("enquiry-is-rfq", "Angebotsanfrage 4711", "Guten Tag");
  // any other word wins; an existing order and "Ihre Anfrage" (an answer) are not quotation requests
  assert.equal(v2("Anfrage Liefertermin", "Guten Tag").category, "Delivery");
  assert.equal(v2("Anfrage zu A26.123456", "Guten Tag").category, null);
  assert.equal(v2("Ihre Anfrage", "Guten Tag").category, null);
});

test("product-info-words: Datenblätter, Zertifikate, Konformitätserklärung are Product Information", () => {
  for (const [s, sub] of [
    ["Datenblätter EPDM", "Technical Data Sheet request"],
    ["Zertifikate für Artikel 4711", "Conformities / Certificates"],
    ["Konformitätserklärung für Artikel 4711", "Conformities / Certificates"],
  ]) {
    const b = "Guten Tag\nbitte senden.";
    assert.equal(v1(s, b).category, null, s);
    const c = v2(s, b);
    assert.equal(c.category, "Product Information", s);
    assert.equal(c.subCategory, sub, s);
    assert.deepEqual(c.fixes, ["product-info-words"], s);
    offIsV1("product-info-words", s, b);
  }
});

test("delivery-words: Liefertermin, Liefermahnung, le délai… are Delivery", () => {
  for (const [s, b] of [
    ["Liefertermin Bestellung 4711", "Guten Tag\nkönnen Sie uns den Liefertermin bestätigen?"],
    ["Liefermahnung 4711", "Guten Tag\nbitte um Rückmeldung."],
    ["Commande 4711", "Bonjour,\npouvez-vous réduire le délai ?"],
  ]) {
    assert.equal(v1(s, b).category, null, s);
    const c = v2(s, b);
    assert.equal(c.category, "Delivery", s);
    assert.deepEqual(c.fixes, ["delivery-words"], s);
    offIsV1("delivery-words", s, b);
  }
});

test("cancellation-words: Bestellstornierung is a cancellation; \"sauf erreur\" is not", () => {
  const [s, b] = ["Bestellstornierung 4711", "Guten Tag\nanbei unsere Bestellstornierung."];
  assert.equal(v1(s, b).category, "Product Price");
  const c = v2(s, b);
  assert.equal(c.category, "Order Cancellation");
  assert.equal(c.subCategory, "Cancel existing order");
  assert.ok(c.fixes.includes("cancellation-words"));
  const [s2, b2] = ["Votre commande", "Bonjour,\nsauf erreur de ma part, il reste une position à recevoir."];
  assert.equal(v1(s2, b2).category, "Order Cancellation");
  assert.equal(v2(s2, b2).category, "Delivery");
  assert.equal(v2(s2, b2, { "cancellation-words": false }).category, "Delivery"); // "à recevoir" is still Delivery
  assert.equal(v2(s2, b2, { "cancellation-words": false, "delivery-words": false }).category, "Order Cancellation");
});

/* ── where no fix applies, v2 is v1 ─────────────────────────────────────── */

const NORMAL: Array<[string, string]> = [
  ["Anfrage Flachdichtungen", "Guten Tag\n\nim Anhang finden Sie unsere Anfrage für 200 Stk. Flachdichtungen.\nBitte um Angebot bis Freitag.\n\nMit freundlichen Grüssen\nPeter Muster\nMuster AG\nwww.muster.example"],
  ["Demande d'offre joints toriques", "Bonjour,\n\nMerci de me faire une offre de prix selon annexe.\n\nCordialement\nJean Dupont\nDupont SA"],
  ["Prezzo sbagliato ordine", "Buongiorno,\nsull'ordine A23.112233 il prezzo è sbagliato: prezzo errato rispetto all'offerta.\nDistinti saluti"],
  ["Datasheet request", "Hello,\ncould you send us the technical data sheet / datasheet for EPDM 70?"],
  ["Certificaat", "Hallo,\ngraag het certificaat en de conformiteit verklaring (REACH)."],
  ["Lieferung verspätet", "Guten Tag\nunsere Lieferung ist verspätet, wann kommt die Ware?\nMit freundlichen Grüssen"],
  ["Rechnung", "Guten Tag\nbitte senden Sie uns eine Gutschrift zur Rechnung 12345.\nKind regards"],
  ["Login", "Hello,\nI can't login to my account, the password doesn't work.\nBest regards\nJohn"],
  ["Stornierung", "Guten Tag\nwir möchten stornieren: Bestellung stornieren, Auftrag 4711.\nVielen Dank"],
  ["Hello", "Just a short note without any keyword."],
];

test("unchanged where no fix applies: v2 answers as v1 and reports no fix", () => {
  for (const [s, b] of NORMAL) {
    const c = v2(s, b);
    assert.deepEqual(c.fixes, [], s);
    assert.deepEqual(withoutFixes(c), v1(s, b), s);
  }
});

test("every fix off: v2 is v1, on the normal texts and on every fix's own example", () => {
  const examples: Array<[string | null, string | null]> = [
    ...NORMAL,
    ["Demande d’offre", "Bonjour"], ["Commande 4711", "Hello,\nIncorrect delivery: we got the wrong item."],
    ["Unterlagen", "Guten Tag\nbitte senden Sie uns das Datenblatt.\nRegards\nEinkauf | Preise & Kosten"],
    ["WG: Kundenanfrage", "Bitte übernehmen.\nMit freundlichen Grüssen\nElli\n\nVon: Peter\nGesendet: Montag\n\nDatenblatt bitte"],
    ["Product question", "could you reach out to me?"], ["Order", "we have not received the invoice"],
    ["Zahlungsavis", "Anbei der Zahlungsavis."], ["Bestellstornierung 4711", "anbei unsere Bestellstornierung"],
    [null, "Bitte um Angebot"], ["Payment advice", null], ["WG: Anfrage 4711", "Guten Tag"], ["Zertifikate", "bitte senden"],
    ["Liefertermin 4711", "Guten Tag"], ["AW: Auftragsbestätigung A26.123456", "bitte ändern Sie unsere Bestellung"],
  ];
  for (const [s, b] of examples) {
    const c = v2(s, b, ALL_OFF);
    assert.deepEqual(c.fixes, [], String(s));
    assert.deepEqual(withoutFixes(c), v1(s, b), String(s));
  }
  // v2's line cleaner, all fixes off, drops what v1's does: same answer on a signature-heavy text
  const sig = "Hallo\nPreis bitte.\nMuster GmbH\nTel. 123\nhttps://muster.example\nMit freundlichen Grüssen\nKosten";
  assert.equal(removeSignatureNoise(sig), "Hallo\nPreis bitte.");
  assert.deepEqual(withoutFixes(v2("x", sig, ALL_OFF)), v1("x", sig));
});
