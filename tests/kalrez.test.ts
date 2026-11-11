import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KZ, PIPELINE, chf, compoundsOf, kzBody, kzCallNext, kzContacted, kzKey, kzLinesOf, kzState, kzSubject, kzSummary,
  kzTicketProperties, offerText,
  type KzArticles, type KzCard, type KzTarget,
} from "../src/lib/oneshot/kalrez";

const ARTS: KzArticles = {
  kalrez: { "1144300225": "6230", "1144210325": "6221" },
  evolast: { "1034100001": "PN794", "1034100002": "PB794" },
};

function target(over: Partial<KzTarget> = {}): KzTarget {
  return {
    un: "100-704456", companyId: "c1", name: "Esco-Labor AG", sae: "Kalt Jan", ownerId: "37053854", ownerName: "Jan Kalt", team: "ESO",
    chf: 84973.4, chf6221: 69842, chf6230: 15132, lastKalrez: "2026-10-15",
    articles: [{ a: "1144210325", t: "FFKM O-ring KALREZ® 6221 ID 37.47 x 5.33 mm", cpd: "6221", qty: 65, chf: 19578, last: "2026-10-15" }],
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

test("the title carries the CHF the customer bought, written the Swiss way", () => {
  assert.equal(chf(84973.4), "84'973");
  assert.equal(chf(1026), "1'026");
  assert.equal(chf(999), "999");
  assert.equal(kzSubject(target()), "Kalrez 6221/6230 discontinued | 84'973 CHF | Esco-Labor AG");
});

test("the offer names the evolast for each compound bought, biggest first", () => {
  assert.deepEqual(compoundsOf({ chf6221: 100, chf6230: 900 }), ["6230", "6221"]);
  assert.equal(offerText({ chf6221: 0, chf6230: 900 }), "evolast PN794 (for 6230)");
  assert.equal(offerText({ chf6221: 5, chf6230: 0 }), "evolast PB794 (for 6221)");
});

test("the body says the dates, the offer and what they bought", () => {
  const b = kzBody(target());
  assert.match(b, /Last order date: 27\.11\.2026\. Call before 22\.11\.2026\./);
  assert.match(b, /84'973 CHF of Kalrez 6221 and Kalrez 6230 \(last order 15\.10\.2026\)/);
  assert.match(b, /evolast PB794 \/ evolast PN794/);
  assert.match(b, /- 1144210325 FFKM O-ring KALREZ® 6221 ID 37\.47 x 5\.33 mm · 65 pc · 19'578 CHF · 15\.10\.2026/);
  assert.match(b, /and 11 more Kalrez 6221\/6230 articles/);
});

test("ticket properties: the person's team picks the pipeline; no owner means no owner field", () => {
  const eso = kzTicketProperties(target());
  assert.equal(eso.hs_pipeline, PIPELINE.ESO.id);
  assert.equal(eso.hs_pipeline_stage, PIPELINE.ESO.stage);
  assert.equal(eso.hubspot_owner_id, "37053854");
  assert.equal(eso.hs_ticket_priority, "HIGH");
  assert.equal(eso.kalrez_switch_key, "100-704456|2026-11");
  assert.equal(eso.kalrez_switch_value, "84973");
  const tsa = kzTicketProperties(target({ team: "TSA", ownerId: null, chf: 4010 }));
  assert.equal(tsa.hs_pipeline, PIPELINE.TSA.id);
  assert.equal("hubspot_owner_id" in tsa, false);
  assert.equal(tsa.hs_ticket_priority, "MEDIUM");
  assert.equal(kzKey(target()), `100-704456|${KZ.keySuffix}`);
});

test("order lines: Kalrez and evolast kept, the rest dropped, EUR turned into CHF", () => {
  const json = JSON.stringify([
    { a: "1144300225", r: 100 }, { a: "1034100001", r: 50 }, { a: "9999999999", r: 999 },
  ]);
  const chfLines = kzLinesOf({ no: "A1", date: "2026-11-13", currency: "CHF", positionsJson: json }, ARTS);
  assert.deepEqual(chfLines.map((l) => [l.kind, l.compound, l.chf]), [["kalrez", "6230", 100], ["evolast", "PN794", 50]]);
  const eurLines = kzLinesOf({ no: "A2", date: "2026-11-13", currency: "EUR", positionsJson: json }, ARTS);
  assert.equal(Math.round(eurLines[0].chf), 94);
  assert.deepEqual(kzLinesOf({ no: "A3", date: "2026-11-13", currency: "CHF", positionsJson: "not json" }, ARTS), []);
});

test("states: evolast ordered wins, then a last Kalrez order, then a call", () => {
  const ev = { date: "2026-11-13", no: "A", article: "1034100001", kind: "evolast" as const, compound: "PN794", chf: 300 };
  const kz = { date: "2026-11-13", no: "B", article: "1144300225", kind: "kalrez" as const, compound: "6230", chf: 900 };
  assert.equal(kzState(card({ lines: [kz, ev] })), "switched");
  assert.equal(kzState(card({ lines: [kz] })), "lastbuy");
  assert.equal(kzState(card({ lastContacted: "2026-11-12" })), "contacted");
  assert.equal(kzState(card({ lastContacted: "2026-11-11" })), "open"); // before the start
  assert.equal(kzState(card({ ticket: { id: "t", subject: "", stage: "Closed", closed: true, resolution: "Not interested", lastActivity: null, contacted: 0 } })), "closed");
  assert.equal(kzContacted(card({ ticket: { id: "t", subject: "", stage: "New", closed: false, resolution: null, lastActivity: "2026-11-14", contacted: 0 } })), true);
});

test("summary counts per person and the days left", () => {
  const cards = [
    card({ un: "a", chf: 1000, ownerName: "Jan Kalt", lastContacted: "2026-11-13" }),
    card({ un: "b", chf: 3000, ownerName: "Jan Kalt" }),
    card({ un: "c", chf: 2000, ownerName: "Nancy Pielock", lines: [{ date: "2026-11-13", no: "x", article: "1034100002", kind: "evolast", compound: "PB794", chf: 500 }] }),
  ];
  const s = kzSummary({ cards, today: "2026-11-12", ticketsFound: 3 });
  assert.equal(s.customers, 3);
  assert.equal(s.contacted, 1);
  assert.equal(s.stillToCall, 2);
  assert.equal(s.stillToCallChf, 5000);
  assert.equal(s.switched, 1);
  assert.equal(s.evolastChf, 500);
  assert.equal(s.daysToCallBy, 10);
  assert.equal(s.daysToLastOrder, 15);
  assert.deepEqual(s.byOwner.map((o) => [o.owner, o.customers, o.contacted, o.switched]), [["Jan Kalt", 2, 1, 0], ["Nancy Pielock", 1, 0, 1]]);
  assert.deepEqual(kzCallNext(cards).map((c) => c.un), ["b"]);
});
