import assert from "node:assert/strict";
import { test } from "node:test";
import { addFact, dayOf, emptyDay, factOf, mergeDays, monthsSince, previousWindow, rangeLabel, sumDays } from "../src/lib/boDetection/figures";

test("a person re-filed a ticket only when they set ANOTHER category", () => {
  const auto = { value: "Others", timestamp: "2026-10-01T08:00:00Z", sourceType: "AUTOMATION_PLATFORM" };
  assert.deepEqual(factOf("Delivery", [{ value: "Delivery", timestamp: "2026-10-01T09:00:00Z", sourceType: "CRM_UI" }, auto]), { cat: "Delivery", person: true, fromOthers: true });
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
  assert.deepEqual(factOf(null, []), { cat: "", person: false, fromOthers: false });
});

test("a day's counts and a period's sum", () => {
  const d = emptyDay();
  addFact(d, { cat: "Delivery", person: false, fromOthers: false });
  addFact(d, { cat: "Others", person: false, fromOthers: false });
  addFact(d, { cat: "", person: true, fromOthers: true });
  assert.deepEqual([d.n, d.others, d.empty, d.person, d.fromOthers], [3, 1, 1, 1, 1]);
  assert.deepEqual(d.cats, { Delivery: 1, Others: 1, "(empty)": 1 });
  const w = sumDays({ "2026-10-01": d, "2026-10-02": d, "2026-09-30": d }, "2026-10-01", "2026-10-31");
  assert.deepEqual([w.n, w.others, w.cats.Delivery], [6, 2, 2]);
});

test("a day that appears in two month stores is added, not replaced", () => {
  const a = emptyDay(); addFact(a, { cat: "Delivery", person: false, fromOthers: false });
  const b = emptyDay(); addFact(b, { cat: "Others", person: false, fromOthers: false });
  const m = mergeDays([{ "2026-04-01": a }, { "2026-04-01": b }]);
  assert.equal(m["2026-04-01"].n, 2);
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
