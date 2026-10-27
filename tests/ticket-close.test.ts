import assert from "node:assert/strict";
import { test } from "node:test";
import { before, conversation, flagTopic, fromAi, isOpen, ownText, patchFor } from "../src/lib/ticketClose/rules";

test("no customer request gets the hidden topic of what it is, without asking the AI (the sentiment flags)", () => {
  for (const [k, topic] of [["mail_from_colleague", "Internal e-mail"], ["only_our_own_words", "Internal e-mail"], ["bulk_mail", "Automatic e-mail"],
    ["mail_from_noreply", "Automatic e-mail"], ["auto_reply", "Automatic e-mail"], ["newsletter", "Automatic e-mail"], ["mail_had_no_words", "Empty e-mail"]]) {
    assert.equal(flagTopic(k), topic);
    const d = before({ subject: "Microsoft 365 security: messages in quarantine", text: "x", notValid: k });
    assert.deepEqual([d?.category, d?.stay, d?.by], [topic, null, "flag"]);
    assert.deepEqual(patchFor(d!, {}), { enquiry_category: topic });
  }
  // the sub-division of "one of us wrote it": a person or shared mailbox of ours, our systems' templated mail, Microsoft's quarantine
  for (const [k, topic] of [["from_finance", "Finance e-mail"], ["from_avor", "AVOR e-mail"], ["from_mailbox", "Internal e-mail"],
    ["from_performis", "Automatic e-mail"], ["from_lvs", "Automatic e-mail"], ["from_pdm", "Automatic e-mail"], ["from_ms365", "MS365"]]) assert.equal(flagTopic(k), topic);
  assert.equal(flagTopic("order_confirmation"), null); // a customer's order confirmation is read by the AI
  assert.equal(before({ subject: "Liefertermin", text: "Wann kommt die Ware?", notValid: null }), null);
  assert.equal(before({ subject: "", text: "  ", notValid: null })?.category, "Empty e-mail");
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

test("a customer's e-mail nobody could place gets the AI's closest topic, never Others", async () => {
  const { guessParse, guessSystem } = await import("../src/lib/ticketClose/guess");
  const { fromGuess, isCustomer } = await import("../src/lib/ticketClose/rules");
  assert.ok(!guessSystem().includes('- "Others"'));
  assert.deepEqual(guessParse('{"category":"Delivery","sub":"","sure":"low","why":"asks about a parcel"}'), { category: "Delivery", sub: null, sure: "low", why: "asks about a parcel" });
  assert.equal(guessParse('{"category":"Others","sure":"high","why":"x"}'), null); // Others is not an answer here
  // nobody asks anything: its own hidden topic, not a business one
  assert.equal(guessParse('{"category":"Spam or advertising","sub":"","sure":"high","why":"a prize draw"}')?.category, "Spam or advertising");
  assert.ok(guessSystem().includes("Spam or advertising"));
  assert.equal(guessParse('{"category":"Product Price","sure":"maybe"}')?.sure, "low");
  const d = fromGuess({ category: "Delivery", sub: null, why: "x", sure: "medium" }, "Bestellung A26.551982.001", "");
  assert.deepEqual([d.category, d.by, d.sure, d.order], ["Delivery", "guess", "medium", "A26.551982.001"]);
  assert.equal(isCustomer("negative"), true);
  assert.equal(isCustomer("not_valid_email"), false);
  assert.equal(isCustomer(null), false);
});

test("an internal e-mail is read for what it is about; Finance and system mail have their own topics", async () => {
  const { guessParse, guessSystem } = await import("../src/lib/ticketClose/guess");
  const sys = guessSystem("internal");
  assert.ok(sys.includes("Finance e-mail") && sys.includes("Automatic e-mail") && sys.includes("Internal e-mail"));
  assert.ok(!sys.includes('- "Others"'));
  assert.equal(guessParse('{"category":"Delivery","sub":"Existing Order","sure":"high","why":"expedite"}', "internal")?.category, "Delivery");
  assert.equal(guessParse('{"category":"Finance e-mail","sub":"","sure":"high","why":"customer blocked"}', "internal")?.category, "Finance e-mail");
  // the outside list has no Finance e-mail: only the internal reading may give it
  assert.equal(guessParse('{"category":"Finance e-mail","sure":"high"}', "outside"), null);
});
