import assert from "node:assert/strict";
import { test } from "node:test";
import { addFact, dayOf, emptyDay, factOf, howOf, mergeDays, monthsSince, previousWindow, rangeLabel, sumDays } from "../src/lib/boDetection/figures";

test("a person re-filed a ticket only when they set ANOTHER category", () => {
  const auto = { value: "Others", timestamp: "2026-10-01T08:00:00Z", sourceType: "AUTOMATION_PLATFORM" };
  assert.deepEqual(factOf("Delivery", [{ value: "Delivery", timestamp: "2026-10-01T09:00:00Z", sourceType: "CRM_UI" }, auto]), { cat: "Delivery", person: true, fromOthers: true, how: "person" });
  // the same value again is no correction
  assert.equal(factOf("Others", [{ value: "Others", timestamp: "2026-10-01T09:00:00Z", sourceType: "CRM_UI" }, auto]).person, false);
  // an automatic change is never a person
  assert.equal(factOf("Delivery", [{ value: "Delivery", timestamp: "2026-10-02T00:00:00Z", sourceType: "INTEGRATION" }, auto]).person, false);
  // a person moving a real category to another: re-filed, not from Others
  const f = factOf("Product Price", [
    { value: "Product Price", timestamp: "2026-10-03T00:00:00Z", sourceType: "CRM_UI" },
    { value: "Delivery", timestamp: "2026-10-02T00:00:00Z", sourceType: "AUTOMATION_PLATFORM" },
  ]);
  assert.deepEqual([f.person, f.fromOthers], [true, false]);
  assert.deepEqual(factOf(null, []), { cat: "", person: false, fromOthers: false, how: "none" });
});

test("who set today's category: a person, the flag, the AI at the close, the form or app, keywords", () => {
  const at = (sourceType: string, sourceId?: string, timestamp = "2026-10-05T10:00:00Z") => ({ value: "Delivery", timestamp, sourceType, sourceId });
  assert.equal(howOf("Delivery", at("CRM_UI")), "person");
  assert.equal(howOf("Delivery", at("CONVERSATIONS")), "person");
  assert.equal(howOf("Internal e-mail", at("INTEGRATION", "50521064")), "flag");
  assert.equal(howOf("Delivery", at("INTEGRATION", "50521064"), "2026-10-05T09:59:30Z"), "ai"); // the hub, at the close
  assert.equal(howOf("Delivery", at("INTEGRATION", "50521064"), "2026-10-09T00:00:00Z"), "keywords"); // the hub, before it
  assert.equal(howOf("Delivery", at("INTEGRATION", "30109717")), "keywords");
  assert.equal(howOf("Delivery", at("INTEGRATION", "34987322")), "keywords");
  assert.equal(howOf("Delivery", at("INTEGRATION", "40488847")), "source");
  assert.equal(howOf("Delivery", at("AUTOMATION_PLATFORM", "enrollmentId:1")), "keywords");
  assert.equal(howOf("Others", at("CRM_UI")), "none");
  assert.equal(howOf("", undefined), "none");
});

test("a day's counts and a period's sum", () => {
  const d = emptyDay();
  addFact(d, { cat: "Delivery", person: false, fromOthers: false, how: "keywords" });
  addFact(d, { cat: "Others", person: false, fromOthers: false, how: "none" });
  addFact(d, { cat: "", person: true, fromOthers: true, how: "none" });
  assert.deepEqual([d.n, d.others, d.empty, d.person, d.fromOthers], [3, 1, 1, 1, 1]);
  assert.deepEqual(d.topics, { Delivery: { keywords: 1 }, Others: { none: 1 }, "(empty)": { none: 1 } });
  const w = sumDays({ "2026-10-01": d, "2026-10-02": d, "2026-09-30": d }, "2026-10-01", "2026-10-31");
  assert.deepEqual([w.n, w.others, w.topics.Delivery.keywords], [6, 2, 2]);
});

test("a day that appears in two month stores is added, not replaced", () => {
  const a = emptyDay(); addFact(a, { cat: "Delivery", person: false, fromOthers: false, how: "ai" });
  const b = emptyDay(); addFact(b, { cat: "Delivery", person: false, fromOthers: false, how: "ai" });
  const m = mergeDays([{ "2026-04-01": a }, { "2026-04-01": b }]);
  assert.deepEqual([m["2026-04-01"].n, m["2026-04-01"].topics.Delivery.ai], [2, 2]);
});

test("days are Swiss days, the period before has the same length, months run to today", () => {
  assert.equal(dayOf("2026-03-31T22:30:00Z"), "2026-04-01"); // 00:30 in Zurich (summer time)
  assert.equal(dayOf("2026-01-31T22:30:00Z"), "2026-01-31"); // 23:30 in Zurich (winter time)
  assert.deepEqual(previousWindow("2025-10-26", "2026-10-25"), { from: "2024-10-26", to: "2025-10-25" });
  assert.deepEqual(previousWindow("2026-10-19", "2026-10-25"), { from: "2026-10-12", to: "2026-10-18" });
  assert.deepEqual(monthsSince("2025-11", new Date("2026-02-10T00:00:00Z")), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(rangeLabel("2025-10-26", "2026-10-25"), "26 Oct 2025 – 25 Oct 2026");
  assert.equal(rangeLabel("2026-10-25", "2026-10-25"), "25 Oct 2026");
});

test("the AI's unsure guess counts apart, and the period splits by month", async () => {
  const { howOf, monthsOf } = await import("../src/lib/boDetection/figures");
  const hub = { value: "Delivery", timestamp: "2026-10-05T10:00:00Z", sourceType: "INTEGRATION", sourceId: "50521064" };
  assert.equal(howOf("Delivery", hub, "2026-10-05T09:00:00Z", { cat: "Delivery", sure: "low" }), "guess");
  assert.equal(howOf("Delivery", hub, "2026-10-05T09:00:00Z", { cat: "Delivery", sure: "high" }), "ai");
  assert.equal(howOf("Delivery", hub, "2026-10-05T09:00:00Z", { cat: "Product Price", sure: "low" }), "ai"); // re-filed since
  const day = (t: Record<string, Record<string, number>>) => ({ n: 0, others: 0, empty: 0, person: 0, fromOthers: 0, topics: t });
  const m = monthsOf({ "2026-09-30": day({ Delivery: { keywords: 2 } }), "2026-10-01": day({ Delivery: { ai: 1 }, Others: { none: 3 } }), "2026-11-01": day({ Delivery: { keywords: 9 } }) }, "2026-09-01", "2026-10-31");
  assert.deepEqual(m, [{ ym: "2026-09", topics: { Delivery: 2 } }, { ym: "2026-10", topics: { Delivery: 1, Others: 3 } }]);
});
