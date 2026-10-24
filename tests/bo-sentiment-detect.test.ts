import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, detect, detectLang, fold, isUnattributable, latest, needsModel } from "../src/lib/boSentiment/detect";
import { legacyScore } from "../src/lib/boSentiment/legacy";
import { OVERRIDE_TERMS, VOCABULARY } from "../src/lib/boSentiment/terms";
import {
  RESOL_NEG_TAGGED, RESOL_POS_TAGGED, TONE_NEG_TAGGED, TONE_POS_TAGGED,
} from "../src/lib/boSentiment/legacyTagged";

const cust = (text: string, at = 1_700_000_000_000) =>
  ({ direction: "INCOMING_EMAIL", from: "buyer@kunde.de", text, at });
const ours = (text: string, at = 1_700_000_100_000) =>
  ({ direction: "EMAIL", from: "claudia@apsoparts.com", text, at });

/* ─────────── the config cannot rot ─────────── */

test("every term the override lists name really exists in the vocabulary", () => {
  const known = new Set([
    ...TONE_POS_TAGGED, ...TONE_NEG_TAGGED, ...RESOL_POS_TAGGED, ...RESOL_NEG_TAGGED,
  ].map((t) => t.term));
  const dead = OVERRIDE_TERMS.filter((t) => !known.has(t));
  assert.deepEqual(dead, [], `these override terms match no keyword: ${dead.join(", ")}`);
});

test("urgency and chasing really left the negative-tone bucket", () => {
  const byDim = (d: string) => VOCABULARY.filter((t) => t.dim === d);
  assert.ok(byDim("urgency").length >= 10, "urgency terms exist");
  assert.ok(byDim("chasing").length >= 30, "chasing terms exist");
  // A term may appear on BOTH sides and mean different things there - the Italian "tutto a posto"
  // is the customer saying they are satisfied and us saying the job is done, and the workflow
  // lists it in both. What must never happen is one term in two dimensions on the SAME side,
  // because then one occurrence would score twice.
  const side = (d: string) => (d.startsWith("resol") ? "agent" : "customer");
  const seen = new Map<string, string>();
  for (const t of VOCABULARY) {
    const key = `${t.lang}|${t.term}|${side(t.dim)}`;
    if (seen.has(key)) assert.equal(seen.get(key), t.dim, `${key} sits in two dimensions on one side`);
    seen.set(key, t.dim);
  }
  // chasing is half weight by construction
  assert.ok(byDim("chasing").every((t) => t.weight === 0.5));
});

/* ─────────── the defects legacy.ts pins, now fixed ─────────── */

test("FIXED: a polite 'urgent' is a deadline, not an unhappy customer", () => {
  const input = {
    subject: "Order 12345",
    mails: [cust("Dear team, could you please confirm? It is urgent for us. Many thanks!")],
  };
  // the old scorer calls this negative
  assert.equal(legacyScore({ subject: input.subject, mails: [{ direction: "INCOMING_EMAIL", text: input.mails[0].text }] }).tone, "negative");
  // the new one does not, and says the urgency out loud instead
  const d = detect(input);
  assert.notEqual(d.tone, "negative");
  assert.ok(d.urgency > 0, "the urgency is reported");
});

test("FIXED: a French quote request is not a complaint", () => {
  const text = "Bonjour, nous vous prions de nous faire une demande d'offre pour des joints. Merci beaucoup pour votre retour.";
  assert.ok(legacyScore({ mails: [{ direction: "INCOMING_EMAIL", text }] }).toneNeg > 0, "the old scorer found negatives");
  const d = detect({ mails: [cust(text)] });
  assert.equal(d.customer.points.tone_neg, 0, `no negative tone, got ${JSON.stringify(d.customer.hits)}`);
  assert.equal(d.lang, "fr");
});

test("FIXED: our apology no longer reads as a failed resolution", () => {
  const input = {
    mails: [
      cust("Perfect, thanks a lot, that helps!"),
      ours("Sorry for the delay - the credit note has been issued and the replacement shipped."),
    ],
  };
  const d = detect(input);
  assert.equal(d.tone, "positive");
  assert.equal(d.resolution, "positive", `apology outweighed the fix: ${JSON.stringify(d.agent.hits)}`);
});

test("FIXED: the customer's subject is never scored as our resolution", () => {
  const d = detect({ subject: "URGENT: wrong delivery", content: "" });
  assert.equal(d.agent.points.resol_neg, 0);
  assert.equal(d.agent.points.resol_pos, 0);
  assert.equal(d.resolution, "unknown", "nothing of ours was written, so we do not know");
});

test("FIXED: a word boundary stops 'sent' firing inside 'consent'", () => {
  const d = detect({ mails: [ours("We have your consent on file.")] });
  assert.equal(d.agent.hits.some((h) => h.term === "sent"), false, JSON.stringify(d.agent.hits));
});

test("FIXED: a forwarded mail is counted on neither side", () => {
  assert.equal(isUnattributable({ direction: "FORWARDED_EMAIL" }), true);
  const d = detect({ mails: [{ direction: "FORWARDED_EMAIL", text: "This is unacceptable, still waiting!", at: 1 }] });
  assert.equal(d.customer.chars, 0);
  assert.equal(d.agent.chars, 0);
  assert.equal(d.tone, "unknown");
  // The old scorer read the customer's words with OUR vocabulary, so this anger vanished
  // entirely: "unacceptable" and "still waiting" are tone words, and the tone side saw nothing.
  const old = legacyScore({ mails: [{ direction: "FORWARDED_EMAIL", text: "This is unacceptable, still waiting!" }] });
  assert.equal(old.toneNeg, 0, "the complaint never reached the tone side");
  assert.equal(old.tone, "neutral", "so a forwarded complaint read as neutral");
  // and where the customer's words DO overlap our resolution list, they counted against us
  const overlap = legacyScore({ mails: [{ direction: "FORWARDED_EMAIL", text: "You sent us a wrong delivery again!" }] });
  assert.ok(overlap.resolNeg > 0, "the customer's complaint scored against our own resolution");
});

test("FIXED: one clear word is enough, and shouting is not louder", () => {
  // the old scorer forced a single "perfect" to neutral
  assert.equal(legacyScore({ mails: [{ direction: "INCOMING_EMAIL", text: "perfect" }] }).tone, "neutral");
  assert.equal(detect({ mails: [cust("perfect")] }).tone, "positive");
  // and five of them is still one opinion
  const once = detect({ mails: [cust("perfect")] }).customer.points.tone_pos;
  const fives = detect({ mails: [cust("perfect perfect perfect perfect perfect")] }).customer.points.tone_pos;
  assert.equal(once, 2);
  assert.equal(fives, 4, "capped at two occurrences");
});

test("FIXED: no evidence says unknown instead of pretending to be neutral", () => {
  const d = detect({ subject: "Order 4711", mails: [cust("Please send 20 pieces of 1234567 to our Basel site.")] });
  assert.equal(d.tone, "unknown");
  assert.equal(d.toneConfidence, 0);
  // the old scorer called exactly this "neutral", which is the 64% in the live data
  assert.equal(legacyScore({ subject: "Order 4711", mails: [{ direction: "INCOMING_EMAIL", text: "Please send 20 pieces of 1234567 to our Basel site." }] }).tone, "neutral");
});

test("negation stops praise from counting", () => {
  assert.equal(detect({ mails: [cust("this is not perfect at all")] }).customer.points.tone_pos, 0);
  assert.equal(detect({ mails: [cust("das ist nicht perfekt")] }).customer.points.tone_pos, 0);
  // but a complaint inside a negation is still a complaint
  assert.ok(detect({ mails: [cust("this is not acceptable")] }).customer.points.tone_neg > 0);
});

/* ─────────── the pieces ─────────── */

test("a real complaint is still negative, and strongly", () => {
  const d = detect({ mails: [cust("This is a complaint. Unacceptable - we are still waiting and very disappointed.")] });
  assert.equal(d.tone, "negative");
  assert.ok(d.toneConfidence >= 0.75, `confidence ${d.toneConfidence}`);
  assert.equal(needsModel(d), false, "a clear case does not cost a model call");
});

test("the model is asked exactly where the words run out", () => {
  const quiet = detect({ mails: [cust("Please confirm the delivery date for order 4711.")] });
  assert.equal(quiet.tone, "unknown");
  assert.equal(needsModel(quiet), true);
  const thin = detect({ mails: [cust("thanks, but the pallet was damaged again on arrival")] });
  assert.ok(needsModel(thin), "a thin margin is asked about");
});

test("language is told from function words, and says when it is unsure", () => {
  assert.equal(detectLang(fold("Guten Tag, wir haben die Lieferung nicht erhalten und bitten um eine Antwort")).lang, "de");
  assert.equal(detectLang(fold("Bonjour, nous vous remercions pour votre retour dans les plus brefs delais")).lang, "fr");
  assert.equal(detectLang(fold("Buongiorno, non abbiamo ricevuto la merce che avete spedito con grazie")).lang, "it");
  // a part number is not a language
  assert.equal(detectLang(fold("1234567 O-ring NBR 70")).confident, false);
});

test("the newest mails are read, whatever order they arrived in", () => {
  const mails = [cust("oldest", 1000), cust("newest", 9000), cust("middle", 5000)];
  assert.deepEqual(latest(mails, 2).map((m) => m.text), ["middle", "newest"]);
  // undated mails never push a dated one out
  assert.deepEqual(latest([{ text: "undated" }, cust("dated", 10)], 1).map((m) => m.text), ["dated"]);
});

test("the margin of two is kept, so old and new differ on words not goalposts", () => {
  assert.deepEqual(decide(0, 0), { bucket: "unknown", confidence: 0 });
  assert.equal(decide(2, 0).bucket, "positive");
  assert.equal(decide(0, 2).bucket, "negative");
  assert.equal(decide(3, 2).bucket, "neutral");
  assert.equal(decide(1, 0).bucket, "neutral", "some evidence, no margin");
});
