import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bucket, hits, legacyScore, normalize, score, stripQuoted,
} from "../src/lib/boSentiment/legacy";
import { RESOL_NEG, RESOL_POS, TONE_NEG, TONE_POS, WEIGHTED } from "../src/lib/boSentiment/legacyLists";

/* ─────────── the lists are the workflow's, and stay the workflow's ─────────── */

test("the weight table is derived from the lists, not typed by hand", () => {
  const tally = (list: readonly string[]) => {
    const m = new Map<string, number>();
    for (const k of list) m.set(k, (m.get(k) ?? 0) + 1);
    return Object.fromEntries([...m].filter(([, c]) => c > 1));
  };
  assert.deepEqual(WEIGHTED.TONE_POS, tally(TONE_POS));
  assert.deepEqual(WEIGHTED.TONE_NEG, tally(TONE_NEG));
  assert.deepEqual(WEIGHTED.RESOL_POS, tally(RESOL_POS));
  assert.deepEqual(WEIGHTED.RESOL_NEG, tally(RESOL_NEG));
  // the single worst offender, pinned: one "urgent" scores six against a threshold of two
  assert.equal(WEIGHTED.TONE_NEG.urgent, 6);
});

/* ─────────── the text pipeline, as the workflow runs it ─────────── */

test("normalize strips accents, tags and punctuation", () => {
  assert.equal(normalize("<p>D&eacute;sol&eacute;</p>"), "d eacute sol eacute");
  assert.equal(normalize("Réclamation URGENTE !"), "reclamation urgente");
  assert.equal(normalize("<b>Danke</b> schön"), "danke schon");
  assert.equal(normalize(null), "");
  // the apostrophe and hyphen survive, which is why "c'est bon pour moi" can match
  assert.equal(normalize("C'est bon pour moi - merci"), "c'est bon pour moi - merci");
});

test("the quoted history is cut at the first marker", () => {
  const mail = "Thanks a lot, that helps.\nFrom: someone@customer.com\nvielen dank perfekt excellent";
  // the marker begins AT the newline, so that newline goes with it
  assert.equal(stripQuoted(mail), "Thanks a lot, that helps.");
  // without a marker nothing is cut
  assert.equal(stripQuoted("plain text"), "plain text");
  // this is the v4 fix: the words below the marker must NOT be scored
  assert.equal(score(normalize(stripQuoted(mail)), TONE_POS) > 0, true);
  assert.ok(score(normalize(mail), TONE_POS) > score(normalize(stripQuoted(mail)), TONE_POS));
});

/* ─────────── the thresholds ─────────── */

test("fewer than two hits either side is neutral, then a margin of two decides", () => {
  assert.equal(bucket(0, 0), "neutral");
  assert.equal(bucket(1, 0), "neutral");   // one hit is never enough
  assert.equal(bucket(0, 1), "neutral");
  assert.equal(bucket(2, 0), "positive");
  assert.equal(bucket(0, 2), "negative");
  assert.equal(bucket(3, 2), "neutral");   // a margin of one is not enough
  assert.equal(bucket(5, 2), "positive");
  assert.equal(bucket(2, 5), "negative");
});

/* ─────────── the defects, pinned so the rewrite can be measured against them ─────────── */

test("DEFECT: one polite 'urgent' makes the customer negative", () => {
  const r = legacyScore({
    subject: "Order 12345",
    mails: [{ direction: "INCOMING_EMAIL", text: "Dear team, could you please confirm? It is urgent for us. Many thanks!" }],
  });
  // "many thanks" is positive, but one "urgent" scores six
  assert.equal(r.toneNeg, 6);
  assert.equal(r.tone, "negative");
  assert.deepEqual(hits(normalize("it is urgent for us"), TONE_NEG), [{ term: "urgent", count: 6 }]);
});

test("DEFECT: a French quote request reads as a complaint", () => {
  // "demande" (a request) contains the English negative "demand"
  const r = legacyScore({
    subject: "Demande d'offre",
    mails: [{ direction: "INCOMING_EMAIL", text: "Bonjour, je vous fais une demande d'offre pour des joints. Merci beaucoup." }],
  });
  assert.ok(r.toneNeg > 0, "the request scored as negative tone");
  assert.equal(hits(normalize("une demande d'offre"), TONE_NEG).some((h) => h.term === "demand"), true);
});

test("DEFECT: our own apology counts as a failed resolution", () => {
  const r = legacyScore({
    mails: [
      { direction: "INCOMING_EMAIL", text: "Perfect, thanks a lot, that helps!" },
      { direction: "EMAIL", text: "Sorry for the delay - the credit note has been issued and the replacement shipped." },
    ],
  });
  assert.equal(r.tone, "positive");
  // "sorry" and "delayed"/"further delay" sit in RESOL_NEG beside a real resolution
  assert.ok(r.resolNeg > 0, "the apology scored against us");
});

test("DEFECT: the ticket's own words are scored as ours too", () => {
  const onlyTicket = legacyScore({ subject: "URGENT: wrong delivery", content: "" });
  // nothing was ever written by us, yet the resolution side has hits
  assert.ok(onlyTicket.resolNeg > 0, "the customer's subject scored against our resolution");
  assert.ok(onlyTicket.toneNeg > 0);
});

test("DEFECT: a forwarded customer mail is treated as our own words", () => {
  const r = legacyScore({ mails: [{ direction: "FORWARDED_EMAIL", text: "This is unacceptable, still waiting!" }] });
  // the customer's anger lands on the resolution side and the tone stays blank
  assert.equal(r.toneNeg, 0);
  assert.equal(r.tone, "neutral");
});

test("DEFECT: length decides - the same sentiment, scored twice", () => {
  const short = legacyScore({ mails: [{ direction: "INCOMING_EMAIL", text: "perfect" }] });
  assert.equal(short.tone, "neutral", "one clear positive word is not enough");
  const long = legacyScore({ mails: [{ direction: "INCOMING_EMAIL", text: "perfect, great, excellent" }] });
  assert.equal(long.tone, "positive");
});

test("a real complaint still comes out negative - the baseline is not useless", () => {
  const r = legacyScore({
    mails: [{ direction: "INCOMING_EMAIL", text: "This is a complaint. Unacceptable, we are still waiting and very disappointed." }],
  });
  assert.equal(r.tone, "negative");
});

/* ─────────── the real-ticket gate ─────────── */

import { fold, gate, hasCustomerVoice, looksBulk, REASON_LABEL } from "../src/lib/boSentiment/realTicket";
import { mailText } from "../src/lib/boSentiment/detect";

const customer = (text = "Hello, where is my order?") => ({ direction: "INCOMING_EMAIL", from: "buyer@kunde.de", text });

test("a customer writing in is a real ticket", () => {
  assert.deepEqual(gate({ subject: "Wrong delivery on order 12345", mails: [customer()] }),
    { real: true, reasons: [], customerVoice: true, noCustomerWords: false });
});

test("the templates measured in the live data are disqualified", () => {
  const cases: [string, string][] = [
    ["ERP Order Export Stale Warning", "erp_stale_warning"],
    ["Anyseals stock list 24.10", "anyseals"],
    ["DirectCut order 8001-123", "directcut"],
    ["Declaration of Conformity requested", "doc_declaration"],
    ["Order confirmation 4711", "order_confirmation"],
    ["Auftragsbestätigung 4711", "order_confirmation"],      // accents folded
    ["Shipping notification for order 99", "shipping_notification"],
    ["New registrant KOLE", "new_registrant"],
    ["Automatic reply: out of office", "auto_reply"],
    ["Undeliverable: your message", "bounce"],
    ["Newsletter October", "newsletter"],
  ];
  for (const [subject, reason] of cases) {
    const v = gate({ subject, mails: [customer()] });
    assert.equal(v.real, false, subject);
    assert.ok(v.reasons.includes(reason as never), `${subject} -> ${v.reasons}`);
  }
});

test("a ticket nobody outside wrote into is still a real ticket", () => {
  // It arrived by web form, by chat, by phone, or one of our own people raised it for a customer.
  // 18 of 100 "not a customer" tickets were exactly this (SARCLA, 25.10.2026: "crazy high"), and
  // calling them machine-made said the customer did not exist when only their words were missing.
  const v = gate({ subject: "Customer Form | Delivery: Existing Order | michel roth", mails: [] });
  assert.equal(v.real, true);
  assert.deepEqual(v.reasons, []);
  assert.equal(v.noCustomerWords, true, "real, but with no words to read a tone from");
  // our own outgoing reply, and nothing in: still a real matter, still no tone
  const ours = [{ direction: "EMAIL", from: "claudia@apsoparts.com", text: "assigned" }];
  assert.equal(gate({ subject: "Please check stock", mails: ours }).real, true);
  assert.equal(gate({ subject: "Please check stock", mails: ours }).noCustomerWords, true);

  // but an INBOUND mail that is only ours or a no-reply IS a machine
  const machine = [{ direction: "INCOMING_EMAIL", from: "no-reply@apsoparts.com", text: "ERP export stale" }];
  assert.deepEqual(gate({ subject: "Stock report", mails: machine }).reasons, ["only_our_own_words"]);
});

test("our own address and no-reply senders are not the customer", () => {
  assert.equal(hasCustomerVoice([{ direction: "INCOMING_EMAIL", from: "shop@apsoparts.com", text: "x" }]), false);
  assert.equal(hasCustomerVoice([{ direction: "INCOMING_EMAIL", from: "no-reply@someshop.com", text: "x" }]), false);
  assert.equal(hasCustomerVoice([{ direction: "INCOMING_EMAIL", from: "mailer-daemon@x.com", text: "x" }]), false);
  assert.equal(hasCustomerVoice([{ direction: "INCOMING_EMAIL", from: "buyer@kunde.de", text: "x" }]), true);
  // an empty inbound mail is not a voice
  assert.equal(hasCustomerVoice([{ direction: "INCOMING_EMAIL", from: "buyer@kunde.de", text: "   " }]), false);
});

test("uncertainty keeps the ticket - the gate only acts on evidence", () => {
  // a subject that merely mentions an invoice is NOT a template: invoices are argued about
  assert.equal(gate({ subject: "Invoice 2026-114 is wrong", mails: [customer()] }).real, true);
  // a template the customer replied to: out of the clean report, in when asked for
  const replied = { subject: "Re: Order confirmation 4711", mails: [customer("Perfect, thanks a lot!")] };
  assert.equal(gate(replied).real, false, "excluded by default");
  assert.equal(gate(replied).customerVoice, true, "but the customer did write");
  assert.equal(gate(replied, { templateRepliesCount: true }).real, true, "and the switch lets it in");
  // the switch never rescues a ticket nobody outside wrote into
  const silent = { subject: "Order confirmation 4711", mails: [{ direction: "EMAIL", from: "shop@apsoparts.com", text: "sent" }] };
  assert.equal(gate(silent, { templateRepliesCount: true }).real, false);
});

test("every reason has the words the report shows", () => {
  const used = new Set<string>();
  for (const s of ["ERP Order Export Stale Warning", "Anyseals", "DirectCut", "Declaration of Conformity",
    "Order confirmation", "Shipping notification", "New registrant", "Automatic reply", "Undeliverable", "Newsletter"]) {
    for (const r of gate({ subject: s, mails: [customer()] }).reasons) used.add(r);
  }
  used.add("no_inbound_mail");       // kept as a label: rows written before 25.10.2026 carry it
  used.add("only_our_own_words");
  used.add("bulk_mail");            // set from the body, tested on its own below
  used.add("model_says_machine");   // set by the engine from the model, never by the gate
  for (const r of used) assert.ok(REASON_LABEL[r as never], `${r} has no label`);
  assert.equal(Object.keys(REASON_LABEL).length, used.size, "a reason exists with no test, or a label with no reason");
});

test("fold makes one rule cover every spelling", () => {
  assert.equal(fold("  Auftragsbestätigung   4711 "), "auftragsbestatigung 4711");
  assert.equal(fold("Réponse Automatique"), "reponse automatique");
  assert.equal(fold(null), "");
});

test("third-party bulk mail is recognised from its body, not its subject", () => {
  // an ordinary subject from an ordinary address - only the footer gives it away
  const flyer = {
    subject: "Our new catalogue is here",
    mails: [{ direction: "INCOMING_EMAIL", from: "marketing@supplier.it", text: "Discover our offers. To stop receiving these, unsubscribe here." }],
  };
  assert.equal(gate(flyer).real, false);
  assert.ok(gate(flyer).reasons.includes("bulk_mail"));

  // two weak signals are enough
  assert.equal(looksBulk("Join our webinar - see our privacy policy"), true);
  // one weak signal is not
  assert.equal(looksBulk("Please add me to your newsletter"), false);

  // a real letter in the same ticket keeps it, even beside a bulk one
  const mixed = {
    subject: "Order 4711",
    mails: [
      { direction: "INCOMING_EMAIL", from: "news@supplier.it", text: "Our offers - unsubscribe here" },
      { direction: "INCOMING_EMAIL", from: "buyer@kunde.de", text: "Where is my delivery?" },
    ],
  };
  assert.equal(gate(mixed).real, true);
});

test("the mail system's own banners are not the customer's words", () => {
  const withBanner = "You don't often get email from buyer@kunde.de. Learn why this is important<https://aka.ms/x>\nThis is unacceptable.";
  const t = mailText({ text: withBanner });
  assert.equal(t.includes("often get email"), false);
  assert.equal(t.includes("Learn why this is important"), false);
  assert.match(t, /This is unacceptable\./);
  // the padding newsletters use to defeat preview text goes too
  assert.equal(mailText({ text: "a\u00adb\u200bc" }), "abc");
});
