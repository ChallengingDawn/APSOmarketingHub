import assert from "node:assert/strict";
import { test } from "node:test";
import { before, conversation, fromAi, isOpen, ownText, patchFor, stayKey } from "../src/lib/ticketClose/rules";

test("no customer request stays Others without asking the AI (88's sentiment flags)", () => {
  for (const k of ["only_our_own_words", "bulk_mail", "auto_reply", "newsletter"]) {
    assert.equal(stayKey(k), k);
    assert.deepEqual(before({ subject: "Microsoft 365 security: messages in quarantine", text: "x", notValid: k })?.stay, k);
  }
  assert.equal(stayKey("order_confirmation"), null); // a customer's order confirmation is read by the AI
  assert.equal(before({ subject: "Liefertermin", text: "Wann kommt die Ware?", notValid: null }), null);
  assert.equal(before({ subject: "", text: "  ", notValid: null })?.stay, "empty");
});

test("the AI's answer: a real category with its order number, Others stays Others, no answer is tried again", () => {
  const d = fromAi({ category: "Delivery", sub: "Existing Order", why: "asks for the delivery date" }, "Our order A26.551982.001 - when?", "Terminnachfrage");
  assert.deepEqual([d.category, d.sub, d.order, d.stay], ["Delivery", "Existing Order", "A26.551982.001", null]);
  assert.equal(fromAi({ category: "Others", sub: null, why: "internal report" }, "x").stay, "unclear");
  assert.equal(fromAi(null, "x").stay, "ai_failed");
});

test("only Others or empty is ever written over", () => {
  assert.equal(isOpen(null), true);
  assert.equal(isOpen(""), true);
  assert.equal(isOpen("Others"), true);
  assert.equal(isOpen("Delivery"), false);
});

test("what is written: the category, its own sub-category property, the order number only when there is none", () => {
  const d = { category: "Product Information", sub: "Conformities / Certificates", order: "A26.630618.004", why: "", stay: null, by: "ai" as const };
  assert.deepEqual(patchFor(d, { order_number: "" }), {
    enquiry_category: "Product Information", enquiry_sub_category___product_information___1: "Conformities / Certificates", order_number: "A26.630618.004",
  });
  assert.deepEqual(patchFor(d, { order_number: "A25.1" }), { enquiry_category: "Product Information", enquiry_sub_category___product_information___1: "Conformities / Certificates" });
  assert.deepEqual(patchFor({ ...d, category: null }, {}), {});
});

test("the conversation: the customer's e-mails first without the quoted history, then chat and notes", () => {
  assert.equal(ownText("<p>Bitte Liefertermin bestätigen, danke vielmals für die Hilfe.</p><p>Von: shop@apsoparts.com</p><p>alt</p>"), "Bitte Liefertermin bestätigen, danke vielmals für die Hilfe.");
  const c = conversation({
    mails: [
      { text: "Our answer", direction: "EMAIL", at: "2026-10-02" },
      { text: "Customer question about the delivery date", direction: "INCOMING_EMAIL", at: "2026-10-01" },
    ],
    chat: ["chat line"], notes: ["<b>note</b>"],
  });
  assert.ok(c.startsWith("Customer question"));
  assert.ok(!c.includes("Our answer"));
  assert.ok(c.includes("chat line") && c.includes("note"));
});
