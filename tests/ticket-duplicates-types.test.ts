import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TYPES, coreSubject, coreText, decide, excludedBy, makeSure, sameText, type Cand, type Me } from "../src/lib/ticketDuplicates/types";

const BO = "1726786777", ESO = "1726599376";
const H = 3600_000;
const T0 = Date.parse("2026-10-20T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const C = (id: string, subject: string, extra: Partial<Cand> = {}): Cand => ({
  id, subject, orderNumber: null, owner: "1", createdate: iso(T0 - 2 * H), closed: false, closedAt: null, erosionKey: null, pipeline: BO, ...extra,
});
const customer = { id: "c1", domain: "kunde.ch", name: "Anna Muster" };
const M = (subject: string, extra: Partial<Me> = {}): Me => ({ ...C("100", subject, { owner: "9", createdate: iso(T0) }), sender: customer, ...extra });
const none = new Set<string>();

test("the words a person wrote: the routing's parts, Re:/AW:, accents and case left out", () => {
  assert.equal(coreSubject("BO |   Email | AW: Lieferung Bestellung 4711 / Rückfrage |"), "lieferung bestellung 4711 ruckfrage");
  assert.equal(coreSubject("RE: TR: Lieferung Bestellung 4711 / Rückfrage"), "lieferung bestellung 4711 ruckfrage");
  assert.equal(coreSubject("BO | EMAIL | AVOR | WBWR / A26.664540.003 |"), "wbwr a26 664540 003");
});

test("the same request twice: same subject from the same customer, the earlier one still open in the same pipeline", () => {
  const me = M("BO | Email | Liefertermin Bestellung 4711");
  const v = decide(me, [C("90", "RE: Liefertermin Bestellung 4711", { sameSender: true, owner: "5", createdate: iso(T0 - 40 * 60_000) })], DEFAULT_TYPES, none, (o) => (o === "5" ? "Claudia" : o));
  assert.deepEqual([v.type, v.status, v.of], ["twice", "possible", ["90"]]);
  assert.equal(v.why, "Same subject from the same sender, 40 min after ticket 90 (Claudia), still open");
  assert.deepEqual(v.ownerChange, { ownerId: "5", fromTicket: "90" });
  // closed before this one came: history, never a flag
  const closed = decide(me, [C("90", "Liefertermin Bestellung 4711", { sameSender: true, closed: true, closedAt: iso(T0 - H) })], DEFAULT_TYPES, none);
  assert.deepEqual([closed.status, closed.of], [null, []]);
  // too long ago, or in another pipeline: not the same request
  assert.equal(decide(me, [C("90", "Liefertermin Bestellung 4711", { sameSender: true, createdate: iso(T0 - 100 * H) })], DEFAULT_TYPES, none).status, null);
  assert.equal(decide(me, [C("90", "Liefertermin Bestellung 4711", { sameSender: true, pipeline: ESO })], DEFAULT_TYPES, none).status, null);
  // switched off
  assert.equal(decide(me, [C("90", "Liefertermin Bestellung 4711", { sameSender: true })], { ...DEFAULT_TYPES, twice: { ...DEFAULT_TYPES.twice, on: false } }, none).status, null);
});

test("a system or a colleague sending the same subject is not the same request - unless it is on the same order", () => {
  const shop = { id: "c2", domain: "apsoparts.com", name: null };
  const me = M("BO | Email | Request billing address change", { sender: shop });
  const fromShop = decide(me, [C("90", "Request billing address change", { sameSender: true })], DEFAULT_TYPES, none);
  assert.deepEqual([fromShop.status, fromShop.systemSender], [null, true]); // counted as a system writing the same again, never "twice"
  assert.equal(decide(me, [C("90", "Order confirmation", { sameSender: true })], DEFAULT_TYPES, none).systemSender, undefined);
  // the ERP twice about the same order: that is the same notice twice
  const erp = M("BO | Email | ERP Order Export Failed for A26.659170.000", { sender: { id: "c3", domain: "angst-pfister.com", name: null } });
  const v = decide(erp, [C("90", "ERP Order Export Failed for A26.659170.000")], DEFAULT_TYPES, none);
  assert.deepEqual([v.type, v.of], ["twice", ["90"]]);
  assert.match(v.why, /^Same subject on order 659170/);
  // a subject that is only the sender's name, or a chat's or a web form's template, says nothing
  const named = M("BO | Delivery | Anna Muster");
  assert.equal(decide(named, [C("90", "BO | Delivery | Anna Muster", { sameSender: true })], DEFAULT_TYPES, none).status, null);
  assert.equal(decide(M("Request from chat |  | BO TOPIC"), [C("90", "Request from chat |  | BO TOPIC", { sameSender: true })], DEFAULT_TYPES, none).status, null);
  assert.equal(decide(M("Customer Form | Delivery: Existing Order |  Henrik Woldt"), [C("90", "Customer Form | Delivery: Existing Order |  Henrik Woldt", { sameSender: true })], DEFAULT_TYPES, none).status, null);
  // ... unless it is about the same order
  assert.equal(decide(M("Customer Form | Delivery: Existing Order A26.666379"), [C("90", "Customer Form | Delivery: Existing Order A26.666379", { sameSender: true })], DEFAULT_TYPES, none).type, "order");
});

test("same order, another request: related, the owner of the oldest open one takes it - closed ones and other pipelines are only shown", () => {
  const me = M("BO | Email | Rechnung zu A26.666379.001");
  const v = decide(me, [
    C("80", "AVOR A26.666379.001", { owner: "7", createdate: iso(T0 - 50 * H) }),
    C("85", "Liefertermin A26.666379", { owner: "8", createdate: iso(T0 - 5 * H) }),
    C("70", "Bestellung A26.666379", { closed: true, closedAt: iso(T0 - 100 * H), createdate: iso(T0 - 200 * H) }),
    C("75", "A26.666379 offer", { pipeline: ESO }),
    C("60", "A26.666379.004 other line", { owner: "6" }),
  ], DEFAULT_TYPES, none);
  assert.deepEqual([v.type, v.status, v.of], ["order", "related", ["80", "85"]]);
  assert.deepEqual(v.ownerChange, { ownerId: "7", fromTicket: "80" });
  assert.deepEqual([v.history, v.elsewhere], [["70"], ["75"]]);
  assert.equal(v.why, "Order 666379.001 is also open in ticket 80 (7) and 1 more - another request on the same order");
  // a deactivated owner is skipped; already the owner: nothing changes; too old: nobody
  assert.deepEqual(decide(me, [C("80", "A26.666379", { owner: "7" }), C("85", "A26.666379", { owner: "8", createdate: iso(T0 - H) })], DEFAULT_TYPES, new Set(["7"])).ownerChange, { ownerId: "8", fromTicket: "85" });
  assert.equal(decide(me, [C("80", "A26.666379", { owner: "9" })], DEFAULT_TYPES, none).ownerChange, null);
  assert.equal(decide(me, [C("80", "A26.666379", { owner: "7", createdate: iso(T0 - 40 * 24 * H) })], DEFAULT_TYPES, none).ownerChange, null);
  // hand-over switched off: still related, the owner stays
  const off = decide(me, [C("80", "A26.666379", { owner: "7" })], { ...DEFAULT_TYPES, order: { ...DEFAULT_TYPES.order, handOver: false } }, none);
  assert.deepEqual([off.status, off.ownerChange], ["related", null]);
});

test("never compared: the built-in rules, erosion win-backs and the texts; newer tickets ignored", () => {
  assert.equal(excludedBy("CERTIFICATES | A26.666379", []), "Certificates");
  assert.equal(excludedBy("EROSION | 8001198990 | Giesserei", []), "Erosion win-backs");
  assert.equal(excludedBy("BO | Email | Automatische Antwort: Ferien", DEFAULT_TYPES.neverMatchTexts), "Automatische Antwort");
  assert.equal(excludedBy("BO | Email | Liefertermin", DEFAULT_TYPES.neverMatchTexts), null);
  const v = decide(M("CERTIFICATES | A26.666379"), [C("90", "A26.666379")], DEFAULT_TYPES, none);
  assert.deepEqual([v.status, v.excludedBy], [null, "Certificates"]);
  assert.equal(decide(M("ERP Order Export Stale Warning A26.666379"), [C("90", "A26.666379")], DEFAULT_TYPES, none).excludedBy, "ERP Order Export Stale Warning");
  assert.equal(decide(M("EROSION | 8001198990 | Giesserei", { erosionKey: "k" }), [C("90", "EROSION | 8001198990 | Giesserei", { erosionKey: "k" })], DEFAULT_TYPES, none).excludedBy, "Erosion win-backs");
  // a ticket created after this one is checked itself and points back
  assert.equal(decide(M("A26.666379"), [C("90", "A26.666379", { createdate: iso(T0 + H) })], DEFAULT_TYPES, none).status, null);
  assert.match(decide(M("Hallo", { sender: null }), [], DEFAULT_TYPES, none).skip ?? "", /no order number/);
});

test("100% sure: the same e-mail, word for word - a quoted earlier mail and a footer do not change it", () => {
  const body = "Guten Tag, bitte senden Sie uns die Auftragsbestätigung für unsere Bestellung 4711 mit dem Liefertermin. Freundliche Grüsse Anna Muster";
  assert.ok(sameText(coreText(body), coreText(body)));
  assert.ok(sameText(coreText(body), coreText(`${body}
Von: Anna Muster
Gesendet: Montag
Alte Nachricht mit anderen Worten`)));
  // a footer a mail server adds: the same on a mail of normal length; on a two-line mail it is too much - a person decides
  const long = `${body} Wir benötigen zusätzlich das Datenblatt, die Konformitätserklärung und das Ursprungszeugnis für die Positionen eins bis fünf, sowie eine Bestätigung der Verpackungsvorschriften und der Lieferadresse in Solothurn.`;
  assert.ok(sameText(coreText(long), coreText(`${long} Diese E-Mail wurde gescannt`)));
  assert.ok(!sameText(coreText(body), coreText(`${body} Diese E-Mail wurde auf Viren gescannt und geprüft`)));
  assert.ok(!sameText(coreText(body), coreText("Guten Tag, wann wird die Bestellung 4711 geliefert? Die Rechnung fehlt auch noch. Freundliche Grüsse Anna Muster")));
  assert.ok(!sameText("", coreText(body)));
  const v = decide(M("BO | Email | Liefertermin Bestellung 4711"), [C("90", "Liefertermin Bestellung 4711", { sameSender: true, createdate: iso(T0 - 5 * 60_000) })], DEFAULT_TYPES, none);
  assert.equal(v.gapMin, 5);
  const sure = makeSure(v, "kunde.ch");
  assert.deepEqual([sure.sure, sure.type], [true, "twice"]);
  assert.match(sure.why, /the same e-mail from kunde\.ch, word for word$/);
  // never on another type
  assert.equal(makeSure({ ...v, type: "order" }, null).sure, v.sure);
});
