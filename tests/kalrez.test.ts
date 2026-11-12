import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KZ, PIPELINE, amount, compoundsOf, convert, kzBody, kzCallNext, kzContacted, kzKey, kzLinesOf, kzState, kzSubject, kzSummary,
  kzTicketProperties, offerText, ownerLabel, toEur,
  type KzArticles, type KzCard, type KzTarget,
} from "../src/lib/oneshot/kalrez";

const ARTS: KzArticles = {
  kalrez: { "1144300225": "6230", "1144210325": "6221" },
  evolast: { "1034100001": "PN794", "1034100002": "PB794" },
};

function target(over: Partial<KzTarget> = {}): KzTarget {
  return {
    un: "100-704456", companyId: "c1", name: "Esco-Labor AG", sae: "Kalt Jan", mandant: "CH",
    ownerId: "37053854", ownerName: "Jan Kalt", team: "ESO", cur: "CHF",
    value: 84973.4, v6221: 69842, v6230: 15132, lastKalrez: "2026-10-15",
    articles: [{ a: "1144210325", t: "FFKM O-ring KALREZ® 6221 ID 37.47 x 5.33 mm", cpd: "6221", qty: 65, value: 19578, last: "2026-10-15" }],
    moreArticles: 11, orderIds: ["o1"], ...over,
  };
}

function card(over: Partial<KzCard> = {}): KzCard {
  return {
    ...target(),
    ticket: { id: "t1", subject: "x", stage: "New", closed: false, resolution: null, lastActivity: null, contacted: 0 },
    lastContacted: null, lastCall: null, lines: [], ...over,
  };
}

test("the title carries the amount in the customer's currency, written the Swiss way", () => {
  assert.equal(amount(84973.4), "84'973");
  assert.equal(amount(999), "999");
  assert.equal(kzSubject(target()), "Kalrez 6221/6230 discontinued | 84'973 CHF | Esco-Labor AG");
  assert.equal(kzSubject(target({ cur: "EUR", value: 80504, name: "De Dietrich Germany Besigheim GmbH" })),
    "Kalrez 6221/6230 discontinued | 80'504 EUR | De Dietrich Germany Besigheim GmbH");
});

test("one fixed rate between EUR and CHF", () => {
  assert.equal(convert(100, "EUR", "CHF"), 94);
  assert.equal(Math.round(convert(94, "CHF", "EUR")), 100);
  assert.equal(convert(5, "EUR", "EUR"), 5);
  assert.equal(Math.round(toEur(9400, "CHF")), 10000);
});

test("the offer names the evolast for each compound bought, biggest first", () => {
  assert.deepEqual(compoundsOf({ v6221: 100, v6230: 900 }), ["6230", "6221"]);
  assert.equal(offerText({ v6221: 0, v6230: 900 }), "evolast PN794 (for 6230)");
  assert.equal(offerText({ v6221: 5, v6230: 0 }), "evolast PB794 (for 6221)");
});

test("the body says the dates, the offer, what they bought and which list", () => {
  const b = kzBody(target());
  assert.match(b, /Last order date: 27\.11\.2026\. Call before 22\.11\.2026\./);
  assert.match(b, /84'973 CHF of Kalrez 6221 and Kalrez 6230 \(last order 15\.10\.2026\)/);
  assert.match(b, /evolast PB794 \/ evolast PN794/);
  assert.match(b, /- 1144210325 FFKM O-ring KALREZ® 6221 ID 37\.47 x 5\.33 mm · 65 pc · 19'578 CHF · 15\.10\.2026/);
  assert.match(b, /and 11 more Kalrez 6221\/6230 articles/);
  assert.match(b, /List: APSO CH, more than 1,000 CHF/);
  assert.match(kzBody(target({ mandant: "DE", cur: "EUR" })), /List: APSO DE, more than 500 EUR.*\n?/);
  assert.match(kzBody(target({ mandant: "DE", cur: "EUR" })), /· 19'578 EUR ·/);
});

test("ticket properties: the person's team picks the pipeline; no owner means no owner field; priority in EUR", () => {
  const eso = kzTicketProperties(target());
  assert.equal(eso.hs_pipeline, PIPELINE.ESO.id);
  assert.equal(eso.hs_pipeline_stage, PIPELINE.ESO.stage);
  assert.equal(eso.hubspot_owner_id, "37053854");
  assert.equal(eso.hs_ticket_priority, "HIGH");
  assert.equal(eso.kalrez_switch_key, "100-704456|2026-11");
  assert.equal(eso.kalrez_switch_value, "84973");
  assert.equal(eso.kalrez_switch_currency, "CHF");
  assert.equal(eso.order_potential_, "90397"); // 84,973 CHF in EUR
  assert.equal(eso.sales_potential_estimate, "90397");
  assert.equal(eso.sales_potential_source, "direct_field");
  assert.equal(eso.sales_potential_confidence, "high");
  const tsa = kzTicketProperties(target({ team: "TSA", ownerId: null, value: 9500 }));
  assert.equal(tsa.hs_pipeline, PIPELINE.TSA.id);
  assert.equal("hubspot_owner_id" in tsa, false);
  assert.equal(tsa.hs_ticket_priority, "HIGH"); // 9,500 CHF = 10,106 EUR
  assert.equal(kzTicketProperties(target({ cur: "EUR", value: 9500 })).hs_ticket_priority, "MEDIUM");
  assert.equal(kzKey(target()), `100-704456|${KZ.keySuffix}`);
});

test("order lines: Kalrez and evolast kept, the rest dropped, turned into the customer's currency", () => {
  const json = JSON.stringify([{ a: "1144300225", r: 100 }, { a: "1034100001", r: 50 }, { a: "9999999999", r: 999 }]);
  const same = kzLinesOf({ no: "A1", date: "2026-11-13", currency: "CHF", positionsJson: json }, ARTS, "CHF");
  assert.deepEqual(same.map((l) => [l.kind, l.compound, l.value]), [["kalrez", "6230", 100], ["evolast", "PN794", 50]]);
  assert.equal(kzLinesOf({ no: "A2", date: "2026-11-13", currency: "EUR", positionsJson: json }, ARTS, "CHF")[0].value, 94);
  assert.equal(Math.round(kzLinesOf({ no: "A3", date: "2026-11-13", currency: "CHF", positionsJson: json }, ARTS, "EUR")[0].value), 106);
  assert.deepEqual(kzLinesOf({ no: "A4", date: "2026-11-13", currency: "CHF", positionsJson: "not json" }, ARTS, "CHF"), []);
});

test("states: evolast ordered wins, then a last Kalrez order, then a call", () => {
  const ev = { date: "2026-11-13", no: "A", article: "1034100001", kind: "evolast" as const, compound: "PN794", value: 300 };
  const kz = { date: "2026-11-13", no: "B", article: "1144300225", kind: "kalrez" as const, compound: "6230", value: 900 };
  assert.equal(kzState(card({ lines: [kz, ev] })), "switched");
  assert.equal(kzState(card({ lines: [kz] })), "lastbuy");
  assert.equal(kzState(card({ lastContacted: "2026-11-12" })), "contacted");
  assert.equal(kzState(card({ lastContacted: "2026-11-11" })), "open"); // before the start
  assert.equal(kzState(card({ ticket: { id: "t", subject: "", stage: "Closed", closed: true, resolution: "Not interested", lastActivity: null, contacted: 0 } })), "closed");
  assert.equal(kzContacted(card({ ticket: { id: "t", subject: "", stage: "New", closed: false, resolution: null, lastActivity: "2026-11-14", contacted: 0 } })), true);
});

test("summary counts per person in EUR, the unassigned on their own line, and the days left", () => {
  const cards = [
    card({ un: "a", value: 940, cur: "CHF", ownerName: "Jan Kalt", lastContacted: "2026-11-13" }),
    card({ un: "b", value: 3000, cur: "EUR", ownerName: "Jan Kalt" }),
    card({ un: "c", value: 2000, cur: "EUR", ownerId: null, ownerName: "TSA Team",
      lines: [{ date: "2026-11-13", no: "x", article: "1034100002", kind: "evolast", compound: "PB794", value: 500 }] }),
  ];
  const s = kzSummary({ cards, today: "2026-11-12", ticketsFound: 3 });
  assert.equal(s.customers, 3);
  assert.equal(s.contacted, 1);
  assert.equal(s.stillToCall, 2);
  assert.equal(Math.round(s.listEur), 6000); // 940 CHF = 1,000 EUR
  assert.equal(s.stillToCallEur, 5000);
  assert.equal(s.switched, 1);
  assert.equal(s.evolastEur, 500);
  assert.equal(s.unassigned, 1);
  assert.equal(s.daysToCallBy, 10);
  assert.equal(s.daysToLastOrder, 15);
  assert.deepEqual(s.byOwner.map((o) => [o.owner, o.customers, o.contacted, o.switched]), [["Jan Kalt", 2, 1, 0], ["Unassigned (TSA)", 1, 0, 1]]);
  assert.equal(ownerLabel(cards[2]), "Unassigned (TSA)");
  assert.deepEqual(kzCallNext(cards).map((c) => c.un), ["b"]);
});
