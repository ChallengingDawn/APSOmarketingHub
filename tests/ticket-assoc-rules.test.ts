import assert from "node:assert/strict";
import { test } from "node:test";
import { alertsPlan, firstSince, nextSince, reason } from "../src/lib/ticketAssoc/rules";

test("the workflow's two triggers: a ticket new to the hub, or one that moved stage", () => {
  assert.equal(reason("1", undefined), "new");
  assert.equal(reason("2", { stage: "1", ok: true }), "stage");
  // an edit, or the hub's own write coming back: left alone, as the workflow left it
  assert.equal(reason("1", { stage: "1", ok: true }), null);
  // a failed processing is asked again whatever happened since
  assert.equal(reason("1", { stage: null, ok: false }), "retry");
});

test("the window moves on to the newest change read, never back", () => {
  assert.equal(nextSince(1000, [1500, 1200, 1800]), 1800);
  assert.equal(nextSince(2000, [1500]), 2000);
  assert.equal(nextSince(2000, []), 2000);
  assert.equal(nextSince(2000, [NaN, 0]), 2000);
});

test("order alerts: every 15 minutes, on the next tick while a backlog waits - and a backlog drops the overlap", () => {
  const at = "2026-10-17T06:00:00Z";
  const t = Date.parse(at);
  const MIN = 60_000;
  assert.deepEqual(alertsPlan(null, t, 15 * MIN, 300, 5 * MIN), { due: true, overlapMs: 5 * MIN });
  assert.deepEqual(alertsPlan({ at, read: 12 }, t + 3 * MIN, 15 * MIN, 300, 5 * MIN), { due: false, overlapMs: 5 * MIN });
  assert.deepEqual(alertsPlan({ at, read: 12 }, t + 15 * MIN, 15 * MIN, 300, 5 * MIN), { due: true, overlapMs: 5 * MIN });
  // the chain changed more than 300 orders: the next check comes at once and starts at the mark itself
  assert.deepEqual(alertsPlan({ at, read: 300 }, t + 3 * MIN, 15 * MIN, 300, 5 * MIN), { due: true, overlapMs: 0 });
});

test("after a start or a long stop the first look goes back half an hour, not days", () => {
  const now = Date.parse("2026-10-17T10:00:00Z");
  assert.equal(firstSince(null, now), now - 30 * 60_000);
  assert.equal(firstSince(now - 5 * 60_000, now), now - 5 * 60_000);
  assert.equal(firstSince(now - 3 * 86_400_000, now), now - 30 * 60_000);
});

import { alertArticles, msOf, normArticle, sharedMailbox } from "../src/lib/ticketAssoc/rules";

test("an order alert is never mailed to a shared mailbox - it would come back as a ticket", () => {
  for (const m of ["helpline@apsoparts.com", "support@apsoparts.com", "sales@apsoparts.com", " Info@angst-pfister.com", "no-reply@apsoparts.com"]) assert.equal(sharedMailbox(m), true, m);
  for (const m of ["claudio.saraiva@angst-pfister.com", "salesmanager@x.ch", "helpline.team@x.ch", null, ""]) assert.equal(sharedMailbox(m), false, String(m));
});

test("an order alerts an open ESO / TSA ticket it shares an article with, placed on or after the ticket's day", () => {
  const base = { orderArticles: ["1120030724", "254001102"], orderDayMs: Date.parse("2026-10-17"), ticketCreatedMs: Date.parse("2026-10-10T15:00:00Z"), ticketArticles: ["0254001102"], open: true, pipeline: "ESO" };
  assert.deepEqual(alertArticles(base), ["0254001102"]);
  // the same day counts (the order may come in the morning after an afternoon ticket's offer, or the reverse)
  assert.deepEqual(alertArticles({ ...base, orderDayMs: Date.parse("2026-10-10") }), ["0254001102"]);
  assert.deepEqual(alertArticles({ ...base, orderDayMs: Date.parse("2026-10-09") }), []);
  assert.deepEqual(alertArticles({ ...base, open: false }), []);
  assert.deepEqual(alertArticles({ ...base, pipeline: "BO" }), []);
  assert.deepEqual(alertArticles({ ...base, ticketArticles: ["9999999999"] }), []);
  assert.deepEqual(alertArticles({ ...base, orderDayMs: NaN }), []);
  // an order placed weeks ago that only changed now is old news
  assert.deepEqual(alertArticles({ ...base, now: Date.parse("2026-11-20") }), []);
  assert.deepEqual(alertArticles({ ...base, now: Date.parse("2026-10-20") }), ["0254001102"]);
});

test("article numbers compare with the leading zero the order lines drop; dates read as ms or ISO", () => {
  assert.equal(normArticle("254001102"), "0254001102");
  assert.equal(normArticle(" 1120-030-724 "), "1120030724");
  assert.equal(msOf("1760659200000"), 1760659200000);
  assert.equal(msOf("2026-10-17"), Date.parse("2026-10-17"));
  assert.ok(Number.isNaN(msOf(null)));
});

import { closeProps, closedStageOf, countsAsOrder, mailBlock, purchaseOf } from "../src/lib/ticketAssoc/rules";

test("one purchase, one mail: the shop's .000 and the ERP's .001 are the same order (19.10.2026, TSA ticket 433687111892)", () => {
  assert.equal(purchaseOf("A26.667139.000", "1403955288306"), "A26.667139");
  assert.equal(purchaseOf(" A26.667139.001 ", "1406428571887"), "A26.667139");
  assert.equal(purchaseOf("A26.667139", "1"), "A26.667139");
  // anything that is not an A-number stays itself - never merged with another order by accident
  assert.equal(purchaseOf("6000293377", "1"), "6000293377");
  assert.equal(purchaseOf(null, "1403955288306"), "order 1403955288306");
  assert.equal(purchaseOf("", "7"), "order 7");
});

test("a credit note or a cancelled order is never an order alert", () => {
  assert.equal(countsAsOrder("A26.667139.001", "5093092552"), true);
  assert.equal(countsAsOrder("G26.666867.000", "5093092552"), false);
  assert.equal(countsAsOrder("A26.667139.001", "5676846286"), false);
  assert.equal(countsAsOrder(null, null), true);
});

test("the alert's mail: not twice in one check, never without an owner, an address, a person or the relay", () => {
  const ok = { ownerId: "1", ownerEmail: "marc.frech@angst-pfister.com", relay: true, mailedNow: null };
  assert.equal(mailBlock(ok), null);
  // the .001 after the .000 in the same check, or a second purchase on the ticket the check just mailed (and closed)
  assert.match(mailBlock({ ...ok, mailedNow: "A26.667139" }) ?? "", /^not mailed: .*A26\.667139/);
  assert.equal(mailBlock({ ...ok, ownerId: null, ownerEmail: null }), "the ticket has no owner");
  assert.equal(mailBlock({ ...ok, ownerEmail: null }), "the ticket's owner has no e-mail address");
  assert.match(mailBlock({ ...ok, ownerEmail: "helpline@apsoparts.com" }) ?? "", /^not mailed: the owner is the shared mailbox/);
  assert.equal(mailBlock({ ...ok, relay: false }), "the hub's mail relay is not set up");
});

test("closing after the mail: the pipeline's one CLOSED stage by id, resolution Ordered unless a person chose one", () => {
  const eso = [
    { id: "2338232556", metadata: { ticketState: "OPEN" } }, { id: "3865966812", metadata: { ticketState: "OPEN" } },
    { id: "2338232559", metadata: { ticketState: "CLOSED" } },
  ];
  assert.equal(closedStageOf(eso), "2338232559");
  assert.equal(closedStageOf([...eso, { id: "9", archived: true, metadata: { ticketState: "CLOSED" } }]), "2338232559");
  // two closed stages, or none: the hub does not guess
  assert.equal(closedStageOf([...eso, { id: "9", metadata: { ticketState: "CLOSED" } }]), null);
  assert.equal(closedStageOf(eso.slice(0, 2)), null);
  assert.deepEqual(closeProps("2338232563", null), { hs_pipeline_stage: "2338232563", ticket_resolution_eso: "Ordered" });
  assert.deepEqual(closeProps("2338232563", " "), { hs_pipeline_stage: "2338232563", ticket_resolution_eso: "Ordered" });
  assert.deepEqual(closeProps("2338232559", "One-shot order"), { hs_pipeline_stage: "2338232559" });
});
