import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_EXCLUSIONS, extractKeys, findDuplicates, keysMatch, type Ticket } from "../src/lib/ticketDuplicates/rules";

const T = (id: string, subject: string, extra: Partial<Ticket> = {}): Ticket => ({
  id, subject, orderNumber: null, owner: null, createdate: "2026-10-18T08:00:00Z", closed: false, erosionKey: null, pipeline: "1726786777", ...extra,
});
const none = new Set<string>();

test("order keys: core + position, .000 is the whole order, any separator", () => {
  assert.deepEqual(extractKeys("A26.632870.003 and A26-640000 / A25 504807 000"), [
    { core: "632870", pos: "003" }, { core: "640000", pos: null }, { core: "504807", pos: null },
  ]);
  assert.ok(keysMatch(extractKeys("A26.632870"), extractKeys("A26.632870.003")));
  assert.ok(!keysMatch(extractKeys("A26.632870.001"), extractKeys("A26.632870.003")));
});

test("a duplicate hands over the owner of the oldest open duplicate of the last 30 days, in any pipeline", () => {
  const me = T("10", "BO | Delivery A26.666379", { owner: "76134337", createdate: "2026-10-18T09:00:00Z" });
  const r = findDuplicates(me, [
    T("8", "Re: A26.666379 late", { owner: "1229976033", createdate: "2026-10-15T09:00:00Z", pipeline: "1726599376" }),
    T("9", "A26.666379", { owner: "30050251", createdate: "2026-10-17T09:00:00Z" }),
  ], DEFAULT_EXCLUSIONS, none);
  assert.deepEqual(r.duplicates, ["8", "9"]);
  assert.equal(r.reason, "Same order number 666379");
  assert.deepEqual(r.ownerChange, { ownerId: "1229976033", fromTicket: "8" }); // the ESO ticket's owner - any pipeline
  // the setting "owner from the same pipeline only" keeps it in Back Office
  assert.deepEqual(findDuplicates(me, [
    T("8", "A26.666379", { owner: "1229976033", createdate: "2026-10-15T09:00:00Z", pipeline: "1726599376" }),
    T("9", "A26.666379", { owner: "30050251", createdate: "2026-10-17T09:00:00Z" }),
  ], { ...DEFAULT_EXCLUSIONS, ownerFromSamePipelineOnly: true }, none).ownerChange, { ownerId: "30050251", fromTicket: "9" });
});

test("no owner change: already the owner, closed or too old duplicates, deactivated owners, flag-only", () => {
  const me = T("10", "A26.666379", { owner: "76134337", createdate: "2026-10-18T09:00:00Z" });
  assert.equal(findDuplicates(me, [T("8", "A26.666379", { owner: "76134337", createdate: "2026-10-15T00:00:00Z" })], DEFAULT_EXCLUSIONS, none).ownerChange, null);
  assert.equal(findDuplicates(me, [T("8", "A26.666379", { owner: "1", createdate: "2026-10-15T00:00:00Z", closed: true })], DEFAULT_EXCLUSIONS, none).ownerChange, null);
  assert.equal(findDuplicates(me, [T("8", "A26.666379", { owner: "1", createdate: "2026-08-01T00:00:00Z" })], DEFAULT_EXCLUSIONS, none).ownerChange, null);
  assert.equal(findDuplicates(me, [T("8", "A26.666379", { owner: "76134415", createdate: "2026-10-15T00:00:00Z" })], DEFAULT_EXCLUSIONS, new Set(["76134415"])).ownerChange, null);
  const flag = findDuplicates(me, [T("8", "A26.666379", { owner: "1", createdate: "2026-10-15T00:00:00Z" })], { ...DEFAULT_EXCLUSIONS, flagOnly: true }, none);
  assert.deepEqual(flag.duplicates, ["8"]);
  assert.equal(flag.ownerChange, null);
});

test("never matched: certificates, C2S problems, warnings - and the extra texts from the settings", () => {
  assert.equal(findDuplicates(T("10", "CERTIFICATES | FDA | A26.666379"), [T("8", "A26.666379")], DEFAULT_EXCLUSIONS, none).skip, "ticket category excluded from dup matching");
  assert.deepEqual(findDuplicates(T("10", "A26.666379"), [T("8", "C2S PROBLEM | A26.666379"), T("9", "⚠ A26.666379")], DEFAULT_EXCLUSIONS, none).duplicates, []);
  assert.deepEqual(findDuplicates(T("10", "A26.666379"), [T("8", "ERP Order Export Stale Warning for A26.666379")], { ...DEFAULT_EXCLUSIONS, neverMatchTexts: ["ERP Order Export"] }, none).duplicates, []);
});

test("erosion tickets only match erosion tickets with the same erosion key, and never change owner", () => {
  const me = T("10", "EROSION | Kunde AG | A26.111111", { erosionKey: "c1|a1|2026", owner: "7" });
  const r = findDuplicates(me, [
    T("8", "A26.111111", { owner: "9" }),
    T("9", "EROSION | Kunde AG | A26.222222", { erosionKey: "c1|a1|2026", owner: "9", createdate: "2026-10-10T00:00:00Z" }),
  ], DEFAULT_EXCLUSIONS, none);
  assert.deepEqual(r.duplicates, ["9"]);
  assert.equal(r.ownerChange, null);
  assert.match(r.message, /Owner not changed/);
});

test("at most three duplicates; a ticket without an order key is not compared", () => {
  const me = T("10", "A26.666379");
  assert.equal(findDuplicates(me, ["1", "2", "3", "4"].map((i) => T(i, "A26.666379")), DEFAULT_EXCLUSIONS, none).duplicates.length, 3);
  assert.equal(findDuplicates(T("10", "Hello"), [T("8", "Hello")], DEFAULT_EXCLUSIONS, none).skip, "no order key in subject/order_number");
});
