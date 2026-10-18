import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES, PROPERTY_MAPPING, classifyTicket, extractOrderNumbers, removeSignatureNoise, type Classification } from "../src/lib/boDistribution/classifier";

// Expected values below come from RUNNING the workflow step's own Python (flow 3678508243 step #22, snapshot
// 18.10.2026) on these tickets, HubSpot stubbed out - its PATCH captured - not from reading it.

/** What the step writes, as its PATCH has it. */
function written(c: Classification): Record<string, string> {
  const out: Record<string, string> = {};
  if (c.category) out.enquiry_category = c.category;
  if (c.subProperty && c.subCategory) out[c.subProperty] = c.subCategory;
  if (c.orderNumber) out.order_number = c.orderNumber;
  return out;
}
const w = (subject: string, content: string) => written(classifyTicket({ subject, content }));
const PRICE = "enquiry_sub_category___price_1", INFO = "enquiry_sub_category___product_information___1";
const DELIVERY = "enquiry_sub_category___delivery___1", WEB = "enquiry_sub_category___website_issue___1";
const INVOICE = "enquiry_sub_category___invoicing___accounting___1", CANCEL = "enquiry_sub_category___order_cancellation___1";

test("six categories, each with its own sub-category property", () => {
  assert.deepEqual(CATEGORIES, ["Product Price", "Product Information", "Delivery", "Website Issue", "Invoicing & Accounting", "Order Cancellation"]);
  assert.deepEqual(Object.values(PROPERTY_MAPPING.sub_categories), [PRICE, INFO, DELIVERY, WEB, INVOICE, CANCEL]);
});

test("Product Price - German and French quotations, an Italian wrong price, a French hidden price", () => {
  assert.deepEqual(w("Anfrage Flachdichtungen", "Guten Tag\n\nim Anhang finden Sie unsere Anfrage für 200 Stk. Flachdichtungen.\nBitte um Angebot bis Freitag.\n\nMit freundlichen Grüssen\nPeter Muster\nMuster AG\nwww.muster.ch"),
    { enquiry_category: "Product Price", [PRICE]: "Request for quotation" });
  assert.deepEqual(w("Demande d'offre joints toriques", "Bonjour,\n\nMerci de me faire une offre de prix selon annexe.\n\nCordialement\nJean Dupont\nDupont SA"),
    { enquiry_category: "Product Price", [PRICE]: "Request for quotation" });
  assert.deepEqual(w("Prezzo sbagliato ordine", "Buongiorno,\nsull'ordine A23.112233 il prezzo è sbagliato: prezzo errato rispetto all'offerta.\nDistinti saluti"),
    { enquiry_category: "Product Price", [PRICE]: "Wrong price on my order", order_number: "A23.112233" });
  assert.deepEqual(w("Prix pas visible", "Bonjour,\nje ne vois pas le prix sur le site, prix pas visible pour cet article.\nBien à vous"),
    { enquiry_category: "Product Price", [PRICE]: "Price is not visible" });
  // "im anhang" is listed 5x and "finden sie unsere" 4x: one sentence scores 9 ("anfrage" is a sub-category keyword only)
  const c = classifyTicket({ subject: "Anfrage Flachdichtungen", content: "im Anhang finden Sie unsere Anfrage" });
  assert.equal(c.scores["Product Price"], 9);
  assert.equal(c.subCategory, "Request for quotation");
});

test("Product Information - data sheet, 3D model, certificates, alternative, MOQ, technical, not found", () => {
  assert.deepEqual(w("Datasheet request", "Hello,\ncould you send us the technical data sheet / datasheet for EPDM 70?"),
    { enquiry_category: "Product Information", [INFO]: "Technical Data Sheet request" });
  assert.deepEqual(w("Model 3D", "Dzień dobry,\nproszę o model 3D, plik 3D w formacie STEP."),
    { enquiry_category: "Product Information", [INFO]: "3D Model request" });
  assert.deepEqual(w("Certificaat", "Hallo,\ngraag het certificaat en de conformiteit verklaring (REACH)."),
    { enquiry_category: "Product Information", [INFO]: "Conformities / Certificates" });
  // the sub-category's dropdown value is not its name
  assert.deepEqual(w("Alternativa prodotto", "Buongiorno,\ncerchiamo un sostituto o un prodotto simile, un'alternativa al vostro articolo."),
    { enquiry_category: "Product Information", [INFO]: "I need an alternative on a existing product" });
  assert.deepEqual(w("Product niet gevonden", "Hallo,\nik kan het product niet vinden in de shop, niet gevonden."),
    { enquiry_category: "Product Information", [INFO]: "Product cannot be found in the shop/Alternative products" });
  assert.deepEqual(w("Mindestbestellmenge", "Hallo,\nwie hoch ist die Mindestbestellmenge bzw. Mindestmenge für diesen Artikel?"),
    { enquiry_category: "Product Information", [INFO]: "Minimum order quantity for a product" });
  assert.deepEqual(w("Pytanie techniczne", "Dzień dobry,\npytanie techniczne: jak to działa w temperaturze 200 stopni?"),
    { enquiry_category: "Product Information", [INFO]: "Technical question on a product" });
  // "reach" (the regulation, listed 6x and 8x) also hits "reach out"
  const c = classifyTicket({ subject: "Product question", content: "Hi, could you reach out to me regarding the product dimensions?" });
  assert.equal(c.scores["Product Information"], 30);
  assert.equal(c.subCategory, "Conformities / Certificates");
  assert.match(c.explanation, /^Product Information \(score 30\) on .*"reach"/);
});

test("Delivery - three sub-categories write Existing Order, plus Pre Order and Previous Order", () => {
  const faster = classifyTicket({ subject: "Liefertermin vorziehen", content: "Hallo\nkönnen Sie den Liefertermin vorziehen? Es ist dringend, wir brauchen es schneller." });
  assert.deepEqual(written(faster), { enquiry_category: "Delivery", [DELIVERY]: "Existing Order" });
  assert.equal(faster.subKey, "I require faster lead time");
  const late = classifyTicket({ subject: "Vertraging levering", content: "Hallo,\nde levering is vertraagd, nog niet aangekomen. Wanneer komt het?" });
  assert.deepEqual(written(late), { enquiry_category: "Delivery", [DELIVERY]: "Existing Order" });
  assert.equal(late.subKey, "Delivery is late");
  assert.deepEqual(w("Question before ordering", "Hi,\nbefore ordering I'd like to know the lead time for delivery. We haven't ordered yet."),
    { enquiry_category: "Delivery", [DELIVERY]: "Pre Order" });
  assert.deepEqual(w("Reclamo qualità", "Buongiorno,\nreclamo per difetto: problema qualità sui pezzi ricevuti."),
    { enquiry_category: "Delivery", [DELIVERY]: "Previous Order" });
});

test("Website Issue, Invoicing & Accounting, Order Cancellation - in two languages each", () => {
  assert.deepEqual(w("Problème connexion", "Bonjour,\nje ne peux pas me connecter à mon compte, mot de passe refusé."),
    { enquiry_category: "Website Issue", [WEB]: "Login Issue" });
  assert.deepEqual(w("Sito web problema", "Buongiorno, il sito non funziona, altro problema con il carrello."),
    { enquiry_category: "Website Issue", [WEB]: "Other Issue" });
  assert.deepEqual(w("Brak faktury", "Dzień dobry,\nbrak faktury do zamówienia, nie otrzymałem faktury."),
    { enquiry_category: "Invoicing & Accounting", [INVOICE]: "Invoice not received" });
  assert.deepEqual(w("Creditnota", "Hallo,\ngraag een creditnota voor factuur 5566, btw is verkeerd."),
    { enquiry_category: "Invoicing & Accounting", [INVOICE]: "Other invoicing issue" });
  assert.deepEqual(w("Cancel order A21.313131", "Hello,\nplease cancel my order A21.313131, we ordered by mistake."),
    { enquiry_category: "Order Cancellation", [CANCEL]: "Cancel existing order", order_number: "A21.313131" });
  const de = classifyTicket({ subject: "Stornierung Bestellung", content: "Guten Tag\nwir möchten die Bestellung stornieren. Bitte um Bestätigung der Stornierung." });
  assert.deepEqual(written(de), { enquiry_category: "Order Cancellation", [CANCEL]: "Cancel existing order" });
  assert.deepEqual(de.scores, { "Product Price": 1, "Product Information": 0, Delivery: 2, "Website Issue": 0, "Invoicing & Accounting": 11, "Order Cancellation": 52 });
});

test("signatures: a greeting or a bare thanks ends the mail; company, phone and link lines go", () => {
  assert.equal(removeSignatureNoise("Hello, see below.\nKind regards\nInvoice Department\nAcme GmbH"), "Hello, see below.");
  assert.equal(removeSignatureNoise("Please check the delivery status.\nThanks\nP.S. the invoice is attached"), "Please check the delivery status.");
  // Python's strip() keeps a BOM, so this "Thanks" is not bare
  const bom = "Please check the delivery status.\n﻿Thanks\nthe invoice is attached";
  assert.equal(removeSignatureNoise(bom), bom);
  // \binc has no closing edge: a short "Incorrect ..." line is a company line
  assert.equal(removeSignatureNoise("Incorrect delivery received\nwe got the wrong item"), "we got the wrong item");
  // an order word saves a short company line - unless it starts "Name GmbH"
  assert.equal(removeSignatureNoise("Muster GmbH - Bestellung anbei\nmuster gmbh bestellung anbei"), "muster gmbh bestellung anbei");
  // one line of HTML holding the greeting: all of it goes
  assert.equal(removeSignatureNoise("<p>Bonjour,</p><p>Veuillez trouver ci-joint notre commande.</p><br>Cordialement<br>Jean"), "");
  // the invoice only in the signature: nothing to classify
  const sig = classifyTicket({ subject: "Question", content: "Hello, see below.\nKind regards\nInvoice Department\nAcme GmbH" });
  assert.equal(sig.status, "not_classified");
  assert.equal(sig.category, null);
});

test("the subject counts ten times: one word in it beats a body full of another category", () => {
  const c = classifyTicket({ subject: "Invoice", content: "Hello, the delivery is late, the shipment was delayed and we are still waiting for the tracking." });
  assert.deepEqual(written(c), { enquiry_category: "Invoicing & Accounting" });
  assert.equal(c.scores["Invoicing & Accounting"], 10);
  assert.equal(c.scores.Delivery, 7);
  assert.equal(c.confidence, 33.3);
  const body = classifyTicket({ subject: "Login", content: "Our delivery is late, delayed, overdue. Shipping tracking please. Late late late. When when when?" });
  assert.deepEqual(written(body), { enquiry_category: "Delivery", [DELIVERY]: "Existing Order" });
  assert.equal(body.scores["Website Issue"], 10);
  assert.equal(body.scores.Delivery, 14);
});

test("order numbers: A2x.xxxxxx with any .yyy, any Unicode digits, written only with a category", () => {
  assert.equal(w("Lieferung A21.765432.003", "Wann kommt die Lieferung A21.765432.003? Die .001 und .002 sind angekommen.").order_number, "A21.765432.003");
  assert.equal(w("Delivery A21.1234567", "Order A21.1234567 is late.").order_number, "A21.123456");
  // two or more: the Python writes them in its set's order, which changes from run to run - compare as sets
  const many = classifyTicket({ subject: "Delivery late", content: "Order A21.123456. is late. Also A21.654321.x and A21.111222.0001." });
  assert.deepEqual(many.orderNumber?.split(", ").sort(), ["A21.111222.0001", "A21.123456", "A21.654321"]);
  assert.deepEqual(extractOrderNumbers("A21.000001 A21.000001 a21.000001 - late").sort(), ["A21.000001", "a21.000001"]);
  const unicode = classifyTicket({ subject: "Delivery late", content: "Order A2١.١٢٣٤٥٦ is late, A2２.１２３４５６ too, and A21.123456.٠٠١ as well." });
  assert.deepEqual(unicode.orderNumber?.split(", ").sort(), ["A21.123456.٠٠١", "A2١.١٢٣٤٥٦", "A2２.１２３４５６"]);
  const noCat = classifyTicket({ subject: "A21.999999", content: "see above" });
  assert.equal(noCat.status, "not_classified");
  assert.deepEqual(noCat.orderNumbers, ["A21.999999"]);
  assert.equal(noCat.orderNumber, null);
});

test("no keyword, empty, null: nothing is written", () => {
  const none = classifyTicket({ subject: "Hello", content: "Hi team, see you at the fair next week." });
  assert.equal(none.status, "not_classified");
  assert.deepEqual(written(none), {});
  assert.ok(Object.values(none.scores).every((s) => s === 0));
  assert.equal(classifyTicket({ subject: "", content: "" }).status, "skipped");
  assert.equal(classifyTicket({}).status, "skipped");
  // HubSpot sends an unset property as null: title[:60] / len(None) raise before anything is written
  const nul = classifyTicket({ subject: "Invoice", content: null });
  assert.equal(nul.status, "error");
  assert.deepEqual(written(nul), {});
});

test("ties: the first category, and the first sub-category, in list order wins", () => {
  const cat = classifyTicket({ subject: "", content: "price delivery" });
  assert.equal(cat.scores["Product Price"], cat.scores.Delivery);
  assert.deepEqual(written(cat), { enquiry_category: "Product Price" });
  assert.match(cat.explanation, /tied with Delivery/);
  assert.deepEqual(w("", "invoice cancel"), { enquiry_category: "Invoicing & Accounting" });
  const sub = classifyTicket({ subject: "", content: "late. will order" });
  assert.equal(sub.subScores["I have not yet placed an order"], sub.subScores["Delivery is late"]);
  assert.deepEqual(written(sub), { enquiry_category: "Delivery", [DELIVERY]: "Pre Order" });
  assert.equal(sub.confidence, 66.7);
  assert.deepEqual(w("", "datasheet drawing"), { enquiry_category: "Product Information", [INFO]: "Technical Data Sheet request" });
});
