import assert from "node:assert/strict";
import { test } from "node:test";
import { greetingFor, languageFor, renderEmail, storeLangFromIncrement, countryLang } from "../src/lib/doc/email";
import { displayName, genderOf } from "../src/lib/doc/salutation";
import { boardRow, leadingStatus, phaseOf } from "../src/lib/doc/board";
import { dedupeName } from "../src/lib/doc/magento";
import { TEXTS } from "../src/lib/doc/texts";
import { copyTo, isInternalAddress } from "../src/lib/doc/config";

const INVOICED = "5093092552";
const CANCELLED = "5676846286";

// ── language: exactly as C2S V1 chose it ─────────────────────────────────

test("the contact's language wins over the store and the country", () => {
  assert.equal(languageFor({ contactLang: "fr", webNo: "6000290830", country: "DE" }), "fr");
});

test("a contact language we have no copy for falls to English, not to the store", () => {
  // C2S V1 behaviour, kept on purpose so the two can be compared like for like
  assert.equal(languageFor({ contactLang: "es", webNo: "6000290830", country: "DE" }), "en");
});

test("without a contact language, the store decides - Switzerland by its prefix", () => {
  assert.equal(storeLangFromIncrement("6000290830"), "de");
  assert.equal(storeLangFromIncrement("7000123456"), "fr");
  assert.equal(storeLangFromIncrement("22000001234"), "nl");
  assert.equal(storeLangFromIncrement("not an order"), "");
});

test("a store counter starting with zero does not turn store 7 into store 70", () => {
  // C2S V1 read "70" here, found no store 70, and sent a French-Swiss customer English
  assert.equal(storeLangFromIncrement("7000012345"), "fr");
  assert.equal(languageFor({ contactLang: "", webNo: "7000012345", country: "CH" }), "fr");
});

test("then the billing country, then English", () => {
  assert.equal(countryLang(" pl "), "pl");
  assert.equal(languageFor({ webNo: "123", country: "IT" }), "it");
  assert.equal(languageFor({ webNo: "123", country: "CH" }), "en");
});

test("a test override beats everything", () => {
  assert.equal(languageFor({ override: "nl", contactLang: "de", webNo: "6000290830" }), "nl");
});

// ── greeting: personal only when the contact really says who we write to ──

const anna = { firstname: "Anna", lastname: "Müller", salutation: "Female", salutation_phrase: "Guten Tag Frau" };

test("a known person gets a personal greeting in the email's language", () => {
  assert.deepEqual(greetingFor({ lang: "de", props: anna, email: "anna.mueller@firma.ch" }), { text: "Guten Tag Frau Müller", personal: true });
  assert.equal(greetingFor({ lang: "fr", props: anna, email: "anna.mueller@firma.ch" }).text, "Bonjour Madame Müller");
});

test("Polish uses the vocative", () => {
  const jan = { lastname: "Kowalski", salutation: "Male", salutation_phrase: "Dzień dobry Pan" };
  assert.equal(greetingFor({ lang: "pl", props: jan, email: "jan@firma.pl" }).text, "Dzień dobry Panie Kowalski");
});

test("a role mailbox is not a person", () => {
  for (const email of ["einkauf@firma.ch", "purchasing@x.com", "info@x.de", "einkauf2@firma.ch", "sales.team@x.com"]) {
    assert.equal(greetingFor({ lang: "de", props: anna, email }).personal, false, email);
  }
});

test("a company in the name fields is not a person", () => {
  const p = { ...anna, lastname: "Müller AG" };
  assert.deepEqual(greetingFor({ lang: "de", props: p, email: "m@firma.ch" }), { text: TEXTS.de.greeting, personal: false });
});

test("no stored greeting phrase, no gender or no surname means the generic opening", () => {
  assert.equal(greetingFor({ lang: "de", props: { ...anna, salutation_phrase: "" }, email: "a@b.ch" }).personal, false);
  assert.equal(greetingFor({ lang: "de", props: { lastname: "Muster", salutation_phrase: "Guten Tag" }, email: "a@b.ch" }).personal, false);
  assert.equal(greetingFor({ lang: "de", props: { ...anna, lastname: "" }, email: "a@b.ch" }).personal, false);
  assert.equal(greetingFor({ lang: "de", props: null, email: "a@b.ch" }).personal, false);
});

test("gender is deduced, never guessed from a first name", () => {
  assert.equal(genderOf({ salutation: "Other", salutation_phrase: "Guten Tag Herr" }).gender, "Male");
  assert.equal(genderOf({ eyemagine_prefix: "Mme." }).gender, "Female");
  assert.equal(genderOf({ firstname: "Maria" }).gender, "");
});

test("shouted or lower-case surnames are put in mixed case for the greeting only", () => {
  assert.equal(displayName("LEFEBVRE"), "Lefebvre");
  assert.equal(displayName("van der berg"), "van der Berg"); // particles stay lower case, as C2S V1 wrote them
  assert.equal(displayName("McDonald"), "McDonald");
});

// ── the email ────────────────────────────────────────────────────────────

test("the subject is the approved copy and carries no order number", () => {
  const m = renderEmail({ lang: "de", to: "a@b.ch" });
  assert.equal(m.subject, "Ihre bestellte Konformitätserklärung");
  assert.ok(!/\d{6,}/.test(m.subject));
});

test("every body paragraph of the copy is in the email, in order, after the greeting", () => {
  for (const lang of ["en", "de", "fr", "it", "nl", "pl"] as const) {
    const m = renderEmail({ lang, to: "a@b.ch", greeting: "Hallo" });
    const paras = ["Hallo", ...TEXTS[lang].body];
    assert.equal(m.text.split("\n\n").slice(0, paras.length).join("|"), paras.join("|"), lang);
  }
});

test("the recipient is escaped in the HTML", () => {
  const m = renderEmail({ lang: "en", to: '<script>"x"</script>@b.ch' });
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("&lt;script&gt;&quot;x&quot;"));
});

// ── where a web order stands ─────────────────────────────────────────────

test("the most advanced record speaks for the order", () => {
  assert.equal(leadingStatus(["waiting", "sent 2026-10-02T07:00Z (1 declaration)"]), "sent 2026-10-02T07:00Z (1 declaration)");
  assert.equal(leadingStatus(["waiting", "sending 2026-10-02T07:00:00.000Z"]).startsWith("sending"), true);
});

test("phases follow the order from the shop to the email", () => {
  assert.equal(phaseOf({ statuses: ["waiting"], stages: [], base: null }), "awaiting-erp");
  assert.equal(phaseOf({ statuses: ["waiting"], stages: ["5093087452"], base: "A26.659425" }), "awaiting-invoice");
  assert.equal(phaseOf({ statuses: ["waiting"], stages: ["5093087452", INVOICED], base: "A26.659425" }), "due");
  assert.equal(phaseOf({ statuses: ["back office 2026-10-02T07:00Z (no declaration found) ticket 1"], stages: [INVOICED], base: "A26.1" }), "back-office");
  assert.equal(phaseOf({ statuses: ["cancelled"], stages: [CANCELLED], base: "A26.1" }), "cancelled");
  assert.equal(phaseOf({ statuses: ["expired (never linked to an ERP order)"], stages: [], base: null }), "expired");
});

test("a board row names the furthest ERP stage and the time it was sent", () => {
  const row = boardRow({
    web: "6000290830", ids: ["1", "2"], statuses: ["sent 2026-10-02T07:15Z (2 declarations)", "waiting"],
    stages: ["5093087452", INVOICED, "5093087453"], base: "A26.659425", company: "Esco-Labor", orderedAt: "2026-09-30T08:00:00Z",
  });
  assert.equal(row.phase, "sent");
  assert.equal(row.erpStage, "Invoiced");
  assert.equal(row.sentAt, "2026-10-02T07:15Z");
  assert.deepEqual(row.steps, { ordered: true, linked: true, invoiced: true, emailed: true });
});

// ── the follow-along copy ────────────────────────────────────────────────

test("copies go to our own mailboxes only, each once", () => {
  assert.deepEqual(copyTo("claudio.saraiva@apsoparts.com"), ["claudio.saraiva@apsoparts.com"]);
  assert.deepEqual(
    copyTo(" Claudio.Saraiva@apsoparts.com; someone@angst-pfister.com, claudio.saraiva@apsoparts.com "),
    ["claudio.saraiva@apsoparts.com", "someone@angst-pfister.com"],
  );
  assert.deepEqual(copyTo("buyer@customer.ch, claudio.saraiva2apsoparts.com"), []);
  assert.deepEqual(copyTo(null), []);
  assert.equal(isInternalAddress("x@apsoparts.com.evil.io"), false);
});

// ── shop line names ──────────────────────────────────────────────────────

test("a product name the shop printed twice is said once, size tail kept", () => {
  assert.equal(
    dedupeName("PMMA-GS Platte transparent klar PMMA -GS Platte transparent klar # 2200 x 800 x 3 mm"),
    "PMMA-GS Platte transparent klar # 2200 x 800 x 3 mm",
  );
  assert.equal(dedupeName("O-Ring FKM 75 10 x 2"), "O-Ring FKM 75 10 x 2");
});
