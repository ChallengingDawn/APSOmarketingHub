import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMENT, cleanForTranslation, customerOf, isInternal, messageText, parseCommand, targetOf, toRichText, type RawMessage } from "../src/lib/translator/text";

test("APSO Translator - an agent's note: !help, !FR, a reply; a shout at a colleague is none of them", () => {
  assert.deepEqual(parseCommand("!help"), { kind: "help" });
  assert.deepEqual(parseCommand("!fr"), { kind: "lang", code: "FR", target: "FR" });
  assert.deepEqual(parseCommand("!PT-BR"), { kind: "lang", code: "PT-BR", target: "PT-BR" });
  assert.deepEqual(parseCommand("!XX"), { kind: "lang", code: "XX", target: null });
  assert.deepEqual(parseCommand("!Hello, your order left today"), { kind: "reply", text: "Hello, your order left today" });
  assert.equal(parseCommand("Hello"), null);
  assert.equal(parseCommand("!!! urgent - check the stock"), null);
  assert.equal(parseCommand("! 12"), null);
  assert.equal(parseCommand("!"), null);
});

test("APSO Translator - DeepL's targets: English and Portuguese need their variant", () => {
  assert.equal(targetOf("EN"), "EN-US");
  assert.equal(targetOf("en-gb"), "EN-GB");
  assert.equal(targetOf("PT"), "PT-PT");
  assert.equal(targetOf("IT"), "IT");
  assert.equal(targetOf("CS"), "CS");
});

test("APSO Translator - never sent to one of our addresses or a HubSpot inbox", () => {
  assert.equal(isInternal("support@apsoparts.com"), true);
  assert.equal(isInternal("maya.gustak@angst-pfister.com"), true);
  assert.equal(isInternal("26492587@eu1.hubspot-inbox.com"), true);
  assert.equal(isInternal("buyer@fortini.it"), false);
  assert.equal(isInternal(null), false);
});

test("APSO Translator - an e-mail cleaned before DeepL: links, reply chain, signature and legal footer off", () => {
  const mail = "Buongiorno,\nvorrei sapere il prezzo dell'anello 50x70x8 in FKM.\nGrazie\n\nCordiali saluti\nLaura Bonfanti\nFortini Servizi\nhttps://www.fortini.it\n\nFrom: support@apsoparts.com\nSent: Monday\n> old text";
  const c = cleanForTranslation(mail);
  assert.match(c, /^Buongiorno,\nvorrei sapere il prezzo/);
  assert.doesNotMatch(c, /Laura|fortini|From:|old text/);
  assert.equal(cleanForTranslation("Bitte senden Sie mir die Rechnung.\n\nAPSOparts AG\nFeldeggstrasse 20"), "Bitte senden Sie mir die Rechnung.");
  assert.ok(cleanForTranslation("x".repeat(4000)).length <= 1500);
});

test("APSO Translator - a message's text: the fullest field, HTML read, nothing left = empty", () => {
  assert.equal(messageText({ text: "Ciao", richText: "<p>Salve, mi serve <b>un anello</b></p>" }), "Salve, mi serve un anello");
  assert.equal(messageText({ text: "Ho bisogno di 10 pezzi &amp; della scheda tecnica", richText: null }), "Ho bisogno di 10 pezzi & della scheda tecnica");
  assert.equal(messageText({ text: "", richText: "<p> </p>" }), "");
});

test("APSO Translator - the customer of a conversation: the newest incoming sender's address, else an outgoing recipient's", () => {
  const msgs: RawMessage[] = [
    { id: "1", type: "MESSAGE", direction: "INCOMING", createdAt: "2026-11-05T12:52:57Z", channelId: 1002, channelAccountId: 77, senders: [{ actorId: "V-1", deliveryIdentifier: { value: "laura@fortini.it" } }] },
    { id: "2", type: "MESSAGE", direction: "OUTGOING", createdAt: "2026-11-05T12:55:00Z", senders: [{ actorId: "A-9" }], recipients: [{ deliveryIdentifiers: [{ value: "laura@fortini.it" }] }] },
    { id: "3", type: "COMMENT", createdAt: "2026-11-05T13:00:00Z", senders: [{ actorId: "A-9" }] },
  ];
  assert.deepEqual(customerOf(msgs), { actorId: "V-1", email: "laura@fortini.it", channelId: "1002", channelAccountId: "77" });
  // a chat visitor without an address: the actor, and an e-mail only from an outgoing recipient
  const chat: RawMessage[] = [{ id: "4", type: "MESSAGE", direction: "INCOMING", createdAt: "2026-11-05T12:52:57Z", channelId: 3799457, senders: [{ actorId: "V-913757850853", deliveryIdentifier: { value: "cee023ab" } }] }];
  assert.deepEqual(customerOf(chat), { actorId: "V-913757850853", email: null, channelId: "3799457", channelAccountId: null });
});

test("APSO Translator - the comments read as the Back Office knows them; nothing a customer writes becomes HTML", () => {
  assert.equal(COMMENT.incoming("IT", "I would like the price"), "🌐 Auto-translation (IT → EN):\n\nI would like the price");
  assert.equal(COMMENT.lang("DE", "FR", "Bonjour"), "🌐 Translation (DE → FR):\n\nBonjour");
  assert.equal(toRichText("a <b>\nb\n\nc & d"), "<p>a &lt;b&gt;<br>b</p><p>c &amp; d</p>");
});
