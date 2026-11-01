import assert from "node:assert/strict";
import { test } from "node:test";
import { addFact, dayOf, emptyDay, factOf, givenOf, howOf, intakeOf, setterOf, isC2s, journeyOf, mergeDays, monthsOf, monthsSince, ownerDays, ownerJourneyOf, pairKey, pairOf, previousWindow, rangeLabel, sumDays, type Fact, type Hist, type How, type Owned } from "../src/lib/boDetection/figures";

/** a fact that kept its intake topic, unless told otherwise */
const fact = (cat: string, how: How, more: Partial<Fact> = {}): Fact => ({ cat, person: false, fromOthers: false, how, intake: cat, journey: cat && cat !== "Others" ? "kept" : "open", ...more });

test("a person re-filed a ticket only when they set ANOTHER category", () => {
  const auto = { value: "Others", timestamp: "2026-10-01T08:00:00Z", sourceType: "AUTOMATION_PLATFORM" };
  assert.deepEqual(factOf("Delivery", [{ value: "Delivery", timestamp: "2026-10-01T09:00:00Z", sourceType: "CRM_UI" }, auto]), { cat: "Delivery", person: true, fromOthers: true, how: "person", intake: "Others", journey: "person" });
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
  assert.deepEqual(factOf(null, []), { cat: "", person: false, fromOthers: false, how: "none", intake: "", journey: "open" });
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
  addFact(d, fact("Delivery", "keywords"));
  addFact(d, fact("Others", "none"));
  addFact(d, fact("", "none", { person: true, fromOthers: true }));
  assert.deepEqual([d.n, d.others, d.empty, d.person, d.fromOthers], [3, 1, 1, 1, 1]);
  assert.deepEqual(d.topics, { Delivery: { keywords: 1 }, Others: { none: 1 }, "(empty)": { none: 1 } });
  const w = sumDays({ "2026-10-01": d, "2026-10-02": d, "2026-09-30": d }, "2026-10-01", "2026-10-31");
  assert.deepEqual([w.n, w.others, w.topics.Delivery.keywords], [6, 2, 2]);
});

test("a day that appears in two month stores is added, not replaced", () => {
  const a = emptyDay(); addFact(a, fact("Delivery", "ai"));
  const b = emptyDay(); addFact(b, fact("Delivery", "ai"));
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
  const day = (t: Record<string, Record<string, number>>, j = {}) => ({ n: 0, others: 0, empty: 0, person: 0, fromOthers: 0, topics: t, j, tj: {}, pairs: {} });
  const m = monthsOf({ "2026-09-30": day({ Delivery: { keywords: 2 } }, { kept: 2 }), "2026-10-01": day({ Delivery: { ai: 1 }, Others: { none: 3 } }, { hub: 1, open: 3 }), "2026-11-01": day({ Delivery: { keywords: 9 } }) }, "2026-09-01", "2026-10-31");
  assert.deepEqual(m, [{ ym: "2026-09", topics: { Delivery: 2 }, j: { kept: 2 }, oj: {}, pr: {} }, { ym: "2026-10", topics: { Delivery: 1, Others: 3 }, j: { hub: 1, open: 3 }, oj: {}, pr: {} }]);
});

test("the topic a ticket came with: its first half hour, a person only at the creation", () => {
  const c = "2026-10-05T10:00:00Z";
  const h = (value: string, min: number, sourceType: string) => ({ value, timestamp: new Date(Date.parse(c) + min * 60_000).toISOString(), sourceType });
  // the routing's keywords at two minutes, the AI at the close days later
  assert.equal(intakeOf([h("Others", 2, "INTEGRATION"), h("Delivery", 4000, "INTEGRATION")], c), "Others");
  // a form's value at the creation, the routing over it a minute later: the last one inside the half hour
  assert.equal(intakeOf([h("Product Price", 0, "INTEGRATION"), h("Delivery", 1, "INTEGRATION")], c), "Delivery");
  // created by hand with its category: that is what it came with
  assert.equal(intakeOf([h("Certificates (ONLY FOR BO)", 0, "CRM_UI")], c), "Certificates (ONLY FOR BO)");
  // a person changing it ten minutes in is a re-filing, not the intake
  assert.equal(intakeOf([h("Product Price", 2, "INTEGRATION"), h("Delivery", 10, "CRM_UI")], c), "Product Price");
  assert.equal(intakeOf([], c), "");
  // the journeys
  assert.equal(journeyOf("Delivery", "Delivery", "keywords"), "kept");
  assert.equal(journeyOf("Delivery", "Others", "ai"), "hub");
  assert.equal(journeyOf("MS365", "", "flag"), "hub");
  assert.equal(journeyOf("Delivery", "Product Price", "person"), "person");
  assert.equal(journeyOf("Others", "Others", "none"), "open");
  assert.equal(journeyOf("", "", "none"), "open");
  // a whole ticket: the routing said Others, the AI at the close Delivery
  const hub = (x: ReturnType<typeof h>) => ({ ...x, sourceId: "50521064" });
  const f = factOf("Delivery", [hub(h("Delivery", 4000, "INTEGRATION")), hub(h("Others", 2, "INTEGRATION"))], new Date(Date.parse(c) + 3999 * 60_000).toISOString(), undefined, c);
  assert.deepEqual([f.intake, f.journey, f.how], ["Others", "hub", "ai"]);
});

test("what changed after intake is counted by line, and the four journeys add up to the tickets", () => {
  const d = emptyDay();
  addFact(d, fact("Delivery", "keywords"));
  addFact(d, fact("Delivery", "ai", { intake: "Others", journey: "hub" }));
  addFact(d, fact("Delivery", "ai", { intake: "Others", journey: "hub" }));
  addFact(d, fact("Delivery", "person", { intake: "Product Price", journey: "person", person: true }));
  addFact(d, fact("Others", "none"));
  assert.deepEqual(d.j, { kept: 1, hub: 2, person: 1, open: 1 });
  assert.equal(Object.values(d.j).reduce((a, n) => a + (n ?? 0), 0), d.n);
  assert.deepEqual(d.tj.Delivery, { kept: 1, hub: 2, person: 1 });
  assert.deepEqual(d.pairs, { [pairKey("Others", "Delivery", "hub")]: 2, [pairKey("Product Price", "Delivery", "person")]: 1 });
  assert.deepEqual(pairOf(pairKey("", "MS365", "hub")), { intake: "", today: "MS365", journey: "hub" });
  const w = sumDays({ "2026-10-01": d, "2026-10-02": d }, "2026-10-01", "2026-10-31");
  assert.deepEqual([w.j.hub, w.pairs[pairKey("Others", "Delivery", "hub")], w.tj.Delivery.kept], [4, 4, 2]);
});

test("the owner a ticket was given: the routing's last pick in its first half hour - not the help desk's echo, not a person later", () => {
  const c = "2026-10-27T08:00:00Z";
  const at = (min: number) => new Date(Date.parse(c) + min * 60_000).toISOString();
  // a workflow puts it on the team at once, the hub's app gives the owner, HELP_DESK echoes both, a person moves it next day
  const h: Hist[] = [
    { value: "76164822", timestamp: at(0), sourceType: "AUTOMATION_PLATFORM" }, { value: "76164822", timestamp: at(0.5), sourceType: "HELP_DESK" },
    { value: "37413486", timestamp: at(1.5), sourceType: "INTEGRATION", sourceId: "50521064" }, { value: "37413486", timestamp: at(1.6), sourceType: "HELP_DESK" },
    { value: "30050251", timestamp: at(1500), sourceType: "CRM_UI" }, { value: "30050251", timestamp: at(1500.1), sourceType: "HELP_DESK" },
  ];
  assert.equal(givenOf(h, c), "37413486");
  assert.equal(ownerJourneyOf("37413486", "30050251", h), "moved");
  assert.equal(ownerJourneyOf("37413486", "37413486", h), "kept");
  // the routing gave another owner later (the hub waited for someone available) - not a person
  const later: Hist[] = [...h.slice(0, 4), { value: "11", timestamp: at(90), sourceType: "INTEGRATION", sourceId: "50521064" }, { value: "11", timestamp: at(90.1), sourceType: "HELP_DESK" }];
  assert.equal(ownerJourneyOf("37413486", "11", later), "later");
  // a change made in the help desk's own view, echoing nothing, is a person
  const desk: Hist[] = [...h.slice(0, 4), { value: "36930032", timestamp: at(45), sourceType: "HELP_DESK" }];
  assert.equal(ownerJourneyOf("37413486", "36930032", desk), "moved");
  // created by hand with an owner: that person; nothing in the first half hour: none
  assert.equal(givenOf([{ value: "9", timestamp: at(0.2), sourceType: "CRM_UI" }], c), "9");
  assert.equal(givenOf([{ value: "9", timestamp: at(45), sourceType: "INTEGRATION" }], c), "");
  assert.equal(ownerJourneyOf("", "9", []), "none");
  // who set the priority: the inbox's MEDIUM at the creation, the routing's app, a person in the CRM or later in the inbox
  const pr = (value: string, min: number, sourceType: string) => ({ value, timestamp: at(min), sourceType });
  assert.equal(setterOf("MEDIUM", [pr("MEDIUM", 0, "CONVERSATIONS")], c), "default");
  assert.equal(setterOf("HIGH", [pr("MEDIUM", 0, "CONVERSATIONS"), pr("HIGH", 1.5, "INTEGRATION")], c), "rule");
  assert.equal(setterOf("URGENT", [pr("MEDIUM", 0, "CONVERSATIONS"), pr("URGENT", 300, "CRM_UI")], c), "person");
  assert.equal(setterOf("LOW", [pr("MEDIUM", 0, "CONVERSATIONS"), pr("LOW", 90, "CONVERSATIONS")], c), "person");
  assert.equal(setterOf("MEDIUM", [pr("MEDIUM", 0, "CONVERSATIONS"), pr("MEDIUM", 50, "MERGE_OBJECTS")], c), "default");
  assert.equal(setterOf("MEDIUM", [], c), "default");
  assert.equal(setterOf("", [], c), "none");
});

test("a day counts the owner, the rule, the machines and the deliveries - and they add up to the tickets", () => {
  const d = emptyDay();
  const f = (cat: string, intake = cat): Fact => ({ cat, person: false, fromOthers: false, how: "keywords", intake, journey: cat === intake ? "kept" : "hub" });
  const o = (x: Partial<Owned>): Owned => ({ given: "1", now: "1", oj: "kept", rule: "27", machine: false, sub: null, c2s: false, ...x });
  addFact(d, f("Delivery"), o({ sub: "Delivery date", c2s: true }));
  addFact(d, f("Delivery"), o({ given: "2", now: "3", oj: "moved", sub: "Delivery date" }));
  addFact(d, f("Internal e-mail", "Others"), o({ given: "", now: "", oj: "none", rule: "wf", machine: true }));
  assert.deepEqual(d.own, { 1: { kept: 1 }, 2: { moved: 1 }, "": { none: 1 } });
  assert.deepEqual(d.oj, { kept: 1, moved: 1, none: 1 });
  assert.deepEqual(d.ic, { Delivery: 2, Others: 1 });
  assert.deepEqual(d.rule, { 27: 2, wf: 1 });
  assert.deepEqual(d.mt, { "Internal e-mail": 1 });
  assert.deepEqual([d.del, d.c2s], [{ "Delivery date": 2 }, { "Delivery date": 1 }]);
  const w = sumDays(mergeDays([{ "2026-10-27": d }, { "2026-10-27": d }]), "2026-10-01", "2026-10-31");
  assert.equal(w.n, 6);
  assert.deepEqual(w.oj, { kept: 2, moved: 2, none: 2 });
  assert.deepEqual(monthsOf({ "2026-10-27": d }, "2026-10-01", "2026-10-31")[0].oj, { kept: 1, moved: 1, none: 1 });
  // the priority: per value, of them set by a person, per topic
  const e = emptyDay();
  addFact(e, f("Delivery"), o({ prio: "HIGH", prioBy: "rule" }));
  addFact(e, f("Delivery"), o({ prio: "URGENT", prioBy: "person" }));
  addFact(e, f("Product Price"), o({ prio: "MEDIUM", prioBy: "default" }));
  assert.deepEqual([e.pr, e.prp, e.prd, e.prs], [{ HIGH: 1, URGENT: 1, MEDIUM: 1 }, { URGENT: 1 }, { MEDIUM: 1 }, { rule: 1, person: 1, default: 1 }]);
  assert.deepEqual(e.tpr, { Delivery: { HIGH: 1, URGENT: 1 }, "Product Price": { MEDIUM: 1 } });
  assert.deepEqual(monthsOf({ "2026-10-27": e }, "2026-10-01", "2026-10-31")[0].pr, { HIGH: 1, URGENT: 1, MEDIUM: 1 });
  assert.deepEqual(ownerDays({ "2026-10-27": d, "2026-09-01": emptyDay() }, "2026-10-01", "2026-10-31"), [{ d: "2026-10-27", n: 3, oj: { kept: 1, moved: 1, none: 1 }, pr: {} }]);
  // a day of an older store (version 4) has none of these and still adds
  assert.equal(sumDays({ "2026-10-28": emptyDay() }, "2026-10-01", "2026-10-31").oj, undefined);
});

test("cut-to-size, as the routing reads it", () => {
  assert.equal(isC2s("true", null, ""), true);
  assert.equal(isC2s(null, "12345", ""), true);
  assert.equal(isC2s(null, null, "AW: Zuschnitt 4711"), true);
  assert.equal(isC2s(null, null, "Lieferdatum"), false);
});
