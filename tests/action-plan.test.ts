import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  IDEA, IN_PROGRESS, KILLED, LIVE, channelsOfTopic, codesOf, isDigitalGrowth, isLate, ownersFromCodes, parseDue, percentOf, percentOfStage,
  planFromSeed, planOptions, planValuesOf, priorityOfWorkbook, reorder, rollup, sameOptions, stageOfPercent, stageOfState, stateOf, stateOfPercent,
  stateOfStage, stageOfStatus, statusOfStage, subPct, subStage, syncWay, ticketFromAction, ticketSync, titleOf, toS2s, treeOrder, BUC_MEMBERS,
  type PlanItem, type PlanSub, type SeedRow,
} from "../src/lib/reporting/actionPlanRules";
import { SUMMIT, standingOf, summitOf } from "../src/lib/reporting/summitRules";

// SARCLA 31.10.2026: the "APSOparts Business Improvement Action Plan" workbook's first tab as a Gantt in the hub,
// by topic, sub-actions from the KPI tiles, Scroll to Sale tickets only for Digital Growth's actions; the home
// card's mountain = where we stand on the way to 30 M€ by 2031.
// The workbook's rows are company data: the sandbox snapshot leaves them out, and the tests that read them skip there.
const SEED = join(__dirname, "../../src/data/actionPlanSeed.json");
const noSeed = existsSync(SEED) ? false : "no workbook seed in this copy";
const seed = noSeed ? [] : (JSON.parse(readFileSync(SEED, "utf8")) as SeedRow[]);
const plan = planFromSeed(seed);
const bySrc = new Map(plan.map((p) => [p.src, p]));

test("action plan: the workbook's tab as one goal, its topics, groups and actions", { skip: noSeed }, () => {
  assert.equal(plan.length, seed.length);
  assert.deepEqual(plan.filter((p) => p.kind === "goal").map((p) => p.src), [2]);
  assert.deepEqual(plan.filter((p) => p.kind === "topic").map((p) => p.code), ["1000", "2000", "3000", "4000", "5000", "9000", "10000", "11000"]);
  assert.deepEqual(plan.filter((p) => p.kind === "group").map((p) => p.code), ["1001 · 100", "1001 · 200", "2001 · 100", "2001 · 200", "2001 · 300"]);
  // every topic hangs off the goal; nothing is left without a parent but the goal
  for (const p of plan) if (p.kind === "topic") assert.equal(p.parentSrc, 2);
  assert.ok(plan.every((p) => p.kind === "goal" || p.parentSrc != null));
});

test("action plan: an action sits in the group of its hundred, else in its topic", { skip: noSeed }, () => {
  assert.equal(bySrc.get(5)!.parentSrc, 4); // 1001 · 101 -> Increase efficiency of Sales
  assert.equal(bySrc.get(14)!.parentSrc, 4); // 1001 · 110, priority 3, still group 100
  assert.equal(bySrc.get(22)!.parentSrc, 21); // 1001 · 201 -> P12 preparation
  assert.equal(bySrc.get(34)!.parentSrc, 32); // 2001 · 102 -> Competitive prices
  assert.equal(bySrc.get(49)!.parentSrc, 48); // 2001 · 301 -> Right availability
  assert.equal(bySrc.get(51)!.parentSrc, 50); // 3001 without a sub task number -> Marketing automation
  assert.equal(bySrc.get(96)!.parentSrc, 95); // 9001 · 1 (no group "0") -> People development
  assert.equal(bySrc.get(124)!.parentSrc, 123);
});

test("action plan: a row's name is its first line, numbering off, a heading with what is under it", () => {
  assert.equal(titleOf("Find parts by:\n  • OEM reference\n  • Dimensions\n  • Material"), "Find parts by: OEM reference, Dimensions, Material");
  assert.equal(titleOf("    1- Bring more traffic to the shop (SEO/GEO/SEA/Referrals…)\n    a. Know where"), "Bring more traffic to the shop (SEO/GEO/SEA/Referrals…)");
  const long = titleOf("Segmentation / priority by potential => Focus on the bigger accounts => In place, the team works the first two priorities => Execution + Monitoring");
  assert.ok(long.length <= 141 && long.endsWith("…") && !long.includes("Monitoring"));
  assert.equal(titleOf("A goal on its first line\nWhat it means, on the next\n\nAnd more"), "A goal on its first line");
});

test("action plan: the workbook's names", { skip: noSeed }, () => {
  assert.ok(bySrc.get(2)!.title.startsWith("GROW APSOparts to 30M€ revenue by 2031"));
  assert.ok(!bySrc.get(2)!.title.includes("\n"));
  assert.equal(bySrc.get(109)!.title, "Find parts by: OEM reference, Dimensions, Material, Industry application");
});

test("action plan: the status column read as Planner's states", () => {
  assert.equal(stateOf("Done"), "done");
  assert.equal(stateOf(" \nDONE\npage is live in all language versions"), "done");
  assert.equal(stateOf("Created for the purpose of social media & FAQ and shared with FEHDIA. DONE"), "done");
  assert.equal(stateOf(undefined, "Done"), "done");
  assert.equal(stateOf("On-going"), "doing");
  assert.equal(stateOf("Ongoing on Beta testing"), "doing");
  assert.equal(stateOf("Started\n1)Promote Search Bar during Sommer"), "doing");
  assert.equal(stateOf("Not started\nLANKAR: Evaluate if this still makes sense"), "todo");
  assert.equal(stateOf("On Hold"), "hold");
  assert.equal(stateOf("De-prioritized as agreed with LEAL"), "hold");
  assert.equal(stateOf("Need approval"), null);
  assert.deepEqual([percentOf("todo"), percentOf("doing"), percentOf("done"), percentOf(null)], [0, 50, 100, null]);
  assert.deepEqual([stateOfPercent(100, null), stateOfPercent(0, "hold"), stateOfPercent(0, "doing"), stateOfPercent(40, "todo")], ["done", "hold", "todo", "doing"]);
});

test("action plan: a deadline is a date where there is one, the words kept beside it", () => {
  assert.deepEqual(parseDue("2026-11-30"), { date: "2026-11-30", note: "" });
  assert.deepEqual(parseDue("31.09.2026"), { date: "2026-09-30", note: "31.09.2026" });
  assert.deepEqual(parseDue("20.08.2026 for briefing"), { date: "2026-08-20", note: "20.08.2026 for briefing" });
  assert.equal(parseDue("30/04/2026 (delivered)\nDeadline for new submission TBC").date, "2026-04-30");
  assert.deepEqual(parseDue("September"), { date: null, note: "September" });
  assert.deepEqual(parseDue("2027"), { date: null, note: "2027" });
  assert.deepEqual(parseDue(undefined), { date: null, note: "" });
});

test("action plan: Digital Growth leads when one of its people is responsible", () => {
  for (const w of ["FEHDIA/SARCLA", "SMEC / LANKAR ", "PYTALE / EGGMIR", "WIDA/SARCLA", "PITALE", "SARCLA/DOEN"]) assert.ok(isDigitalGrowth(w), w);
  for (const w of ["LEAL/FRMA/RABE", "Sales leaders", "DOEN", "RARO", "BUC", "", undefined]) assert.ok(!isDigitalGrowth(w), String(w));
  if (noSeed) return;
  assert.equal(bySrc.get(9)!.dg, true); // buying signals, FEHDIA/SARCLA
  assert.equal(bySrc.get(6)!.dg, false); // territories, LEAL/FRMA/RABE
  assert.equal(bySrc.get(4)!.dg, false); // a group is never "led"
});

const it = (id: number, parentId: number | null, kind: PlanItem["kind"], p: Partial<PlanItem> = {}): PlanItem => ({
  id, parentId, kind, code: "", sort: id, src: null, title: `#${id}`, detail: "", priority: "", responsible: "", referent: "", status: "",
  state: null, result: "", mainTopic: "", perimeter: "", expected: "", codeFreeze: "", complexity: "", release: "",
  start: null, due: null, dueNote: "", percent: null, dg: false, owners: [], updatedBy: "", updatedAt: "",
  stage: null, channel: [], country: [], agency: [], roadmapYear: "", kpis: "", nextSteps: "", statusNote: "", ...p,
});

// SARCLA 01.11.2026: "assignment should be done by user, not names like Sales leader" - the workbook's codes read as
// people once, only where exactly one person answers to the code (made-up people here)
test("action plan: a workbook code is the start of the last name, then of the first", () => {
  const c = codesOf("Anna Beispiel");
  for (const code of ["BEIANN", "BEAN", "BEISAN", "BEIAN", "BEANN"]) assert.ok(c.has(code), code);
  assert.ok(codesOf("Jörg Müller-Lüdenscheid").has("MULJOR")); // accents and hyphens away
  assert.ok(codesOf("Marie Claire de Vries").has("DEVMAR")); // a last name in parts, run together
  assert.equal(codesOf("Madonna").size, 0);
});

test("action plan: the people behind 'Responsible of action' - one match per code, words and doubts left to pick", () => {
  const people = [
    { id: "1", name: "Anna Beispiel" }, { id: "2", name: "Marco Rossi" }, { id: "3", name: "Lea Albers" },
    { id: "4", name: "Bea Rabe" }, { id: "5", name: "Ben Rauch" }, // both answer to RABE
  ];
  assert.deepEqual(ownersFromCodes("BEIANN/ROSMAR", people), [{ id: "1", name: "Anna Beispiel" }, { id: "2", name: "Marco Rossi" }]);
  assert.deepEqual(ownersFromCodes("ALLE / ROSMAR", people), [{ id: "3", name: "Lea Albers" }, { id: "2", name: "Marco Rossi" }]);
  assert.deepEqual(ownersFromCodes("RABE", people), []); // two people answer to it: nobody is guessed
  assert.deepEqual(ownersFromCodes("Sales leaders", people), []); // words are not codes
  assert.deepEqual(ownersFromCodes("Bespoke / XYZQ", people), []); // an agency, a code nobody answers to
  assert.deepEqual(ownersFromCodes("BEIANN BEIANN", people), [{ id: "1", name: "Anna Beispiel" }]); // once
});
const sub = (id: number, item: number, status: PlanSub["status"], due: string | null = null, p: Partial<PlanSub> = {}): PlanSub => ({ id, item, title: `s${id}`, owner: "", ownerName: "", start: null, due, status, stage: null, priority: "", kpiHref: "", kpiTile: "", tickets: 0, ...p });

test("action plan: % complete and dates roll up; sub-actions count for their action", () => {
  const items = [
    it(1, null, "goal"), it(2, 1, "topic"), it(3, 2, "group"),
    it(4, 3, "action", { stage: IN_PROGRESS, percent: 50, start: "2026-10-01", due: "2026-11-30" }),
    it(5, 3, "action", { stage: IDEA, percent: 0, due: "2026-10-15" }),
    it(6, 2, "action", { stage: LIVE, percent: 100, due: "2026-09-01" }),
    it(7, 2, "action"),
  ];
  const r = rollup(items, [sub(1, 5, "done", "2026-12-20"), sub(2, 5, "doing"), sub(3, 5, "open")], "2026-11-01");
  assert.equal(r.get(5)!.percent, 50); // (100 + 50 + 0) / 3, not its own 0
  assert.equal(r.get(4)!.percent, 50);
  assert.equal(r.get(3)!.percent, 50);
  // every action underneath counts, one with no status as 0 %: (50 + 50 + 100 + 0) / 4 - not 100 % from the
  // only ones that have a figure (a topic with 3 done actions of 17 read 100 %)
  assert.equal(r.get(2)!.percent, 50);
  assert.equal(r.get(7)!.percent, null); // the action itself still says it has no figure
  assert.equal(rollup([it(1, null, "topic"), it(2, 1, "action", { stage: LIVE, percent: 100 }), it(3, 1, "action"), it(4, 1, "action")], [], "2026-11-01").get(1)!.percent, 33);
  assert.deepEqual([r.get(3)!.from, r.get(3)!.to], ["2026-10-01", "2026-12-20"]);
  assert.equal(r.get(5)!.late, 1); // due 15.10, not done
  assert.equal(r.get(2)!.late, 1);
  assert.deepEqual([r.get(1)!.subs, r.get(1)!.subsOpen], [3, 2]);
  // done is done, whatever its sub-actions say
  assert.equal(rollup([it(9, null, "action", { stage: LIVE, percent: 100 })], [sub(4, 9, "open")], "2026-11-01").get(9)!.percent, 100);
  // a killed action leaves the average: (100 + 0) / 2, not / 3
  assert.equal(rollup([it(1, null, "topic"), it(2, 1, "action", { stage: LIVE, percent: 100 }), it(3, 1, "action", { stage: IDEA, percent: 0 }), it(4, 1, "action", { stage: KILLED })], [], "2026-11-01").get(1)!.percent, 50);
});

// SARCLA 01.11.2026: a sub-action "should be a small action" - the pipeline's stage, a priority, planned and go-live
test("a sub-action's stage gives its open / doing / done and its %", () => {
  assert.equal(statusOfStage(null), "open");
  assert.equal(statusOfStage(IDEA), "open");
  assert.equal(statusOfStage(IN_PROGRESS), "doing");
  assert.equal(statusOfStage(LIVE), "done");
  assert.equal(statusOfStage(KILLED), "done");
  // set on a KPI tile: the stage that says the same
  assert.deepEqual([stageOfStatus("open"), stageOfStatus("doing"), stageOfStatus("done")], [IDEA, IN_PROGRESS, LIVE]);
  // the stage's own % (Ready to Roll 90); none: the status's; killed: out of the average
  assert.equal(subPct({ stage: "6161860809", status: "doing" }), 90);
  assert.equal(subPct({ stage: null, status: "doing" }), 50);
  assert.equal(subPct({ stage: KILLED, status: "done" }), null);
});

test("an action's % and dates take its sub-actions' stages and planned dates", () => {
  const items = [it(1, null, "action", { start: "2026-11-01", due: "2026-11-30" })];
  const r = rollup(items, [sub(1, 1, "done", "2026-12-15", { stage: LIVE, start: "2026-10-20" }), sub(2, 1, "doing", null, { stage: "6161860809" }), sub(3, 1, "done", null, { stage: KILLED })], "2026-11-01").get(1)!;
  // (100 + 90) / 2 - the killed one leaves the average
  assert.equal(r.percent, 95);
  assert.deepEqual([r.from, r.to], ["2026-10-20", "2026-12-15"]);
});

test("the referent is one of the five BUC members, as HubSpot users", () => {
  assert.deepEqual(BUC_MEMBERS.map((m) => m.name.split(" ")[0]), ["Alexandre", "Claudio", "Bernd", "Marc", "Rose"]);
  assert.ok(BUC_MEMBERS.every((m) => /^\d+$/.test(m.id)));
});

// SARCLA 01.11.2026: "uniform the values of the stages - follow at the maximum what we use on the From Scroll to Sale
// pipeline ... priority as HubSpot's Low / Medium / High / Urgent"
test("action plan: an action speaks the Scroll to Sale ticket's stages", () => {
  assert.deepEqual(["todo", "doing", "hold", "done", null].map((x) => stageOfState(x as never)), [IDEA, IN_PROGRESS, "6161845476", LIVE, null]);
  // and back for the old column, so a rolled-back hub still shows where things stand
  assert.deepEqual([IDEA, IN_PROGRESS, "6161845477", "6161860809", LIVE, "6161856759", KILLED, null].map(stateOfStage), ["todo", "doing", "hold", "doing", "done", "done", "hold", null]);
  assert.deepEqual([IDEA, IN_PROGRESS, "6161860809", LIVE, KILLED, null].map(percentOfStage), [0, 50, 90, 100, null, null]);
  // a typed percentage moves the stage, but never off a wait or a maintained live
  assert.equal(stageOfPercent(100, IN_PROGRESS), LIVE);
  assert.equal(stageOfPercent(100, "6161856759"), "6161856759");
  assert.equal(stageOfPercent(0, "6161845477"), "6161845477");
  assert.equal(stageOfPercent(0, IN_PROGRESS), IDEA);
  assert.equal(stageOfPercent(40, IDEA), IN_PROGRESS);
  assert.equal(stageOfPercent(40, "6161860809"), "6161860809");
  assert.equal(stageOfPercent(40, LIVE), IN_PROGRESS); // reopened
  // live, maintained or killed is never late
  for (const st of [LIVE, "6161856759", KILLED]) assert.equal(isLate(it(1, null, "action", { stage: st, due: "2026-01-01", percent: null }), "2026-11-01"), false);
  assert.equal(isLate(it(1, null, "action", { stage: "6161845476", due: "2026-01-01" }), "2026-11-01"), true);
});

test("action plan: the workbook's words moved into the ticket's fields once, nothing made up", () => {
  assert.deepEqual(["1", "2", "3", " 2 ", "HIGH", "urgent", "To be transferred", ""].map(priorityOfWorkbook), ["HIGH", "MEDIUM", "LOW", "MEDIUM", "HIGH", "URGENT", "", ""]);
  assert.deepEqual(channelsOfTopic("SEO / GEO"), ["SEO/GEO"]);
  assert.deepEqual(channelsOfTopic("Hubspot"), ["HubSpot"]);
  assert.deepEqual(channelsOfTopic("CRM / SEA"), ["SEA", "HubSpot"]);
  assert.deepEqual(channelsOfTopic("Price management"), []);
  const row = { state: "doing" as const, priority: "1", status: "Ongoing, first wave sent", result: "Two answers", expected: "More visits", mainTopic: "SEA", stage: null, statusNote: "", kpis: "", channel: [] };
  assert.deepEqual(toS2s(row), { stage: IN_PROGRESS, priority: "HIGH", statusNote: "Ongoing, first wave sent\n\nResult: Two answers", kpis: "Expected: More visits", channel: ["SEA"] });
  // what is already filled stays; a priority that is not one goes to the note
  assert.deepEqual(toS2s({ ...row, stage: LIVE, statusNote: "Mine", kpis: "Clicks", channel: ["Website"], priority: "To be transferred in E-commerce roadmap" }),
    { stage: LIVE, priority: "", statusNote: "Mine", kpis: "Clicks", channel: ["Website"] });
  assert.equal(toS2s({ ...row, state: null, status: "", result: "", priority: "To be transferred" }).statusNote, "To be transferred");
  // no status in the workbook, no stage
  assert.equal(toS2s({ ...row, state: null }).stage, null);
});

// SARCLA 01.11.2026: "create new properties in HubSpot to populate the action plan's main categories and sub and so forth"
test("action plan: HubSpot's plan properties - the rows as choices in the plan's order, a removed one hidden, never two alike", () => {
  const items = [
    it(1, null, "goal"), it(2, 1, "topic", { title: "Grow", sort: 2 }), it(9, 1, "topic", { title: "Ship", sort: 1 }),
    it(3, 2, "group", { title: "Pricing" }), it(4, 3, "action", { title: "Same name", code: "101" }), it(5, 2, "action", { title: "Same name" }),
    it(6, 9, "action", { title: "Faster" }),
  ];
  assert.deepEqual(treeOrder(items).map((i) => i.id), [1, 9, 6, 2, 3, 4, 5]);
  assert.deepEqual(planOptions(items, "topic").map((o) => [o.value, o.label, o.hidden]), [["9", "Ship", false], ["2", "Grow", false]]);
  // a second "Same name" gets its number (no roadmap ID), the first keeps its own name
  assert.deepEqual(planOptions(items, "action").map((o) => o.label), ["Faster", "Same name", "Same name #5"]);
  // a row that left the plan stays, hidden, so its tickets keep a name
  const now = planOptions(items, "group", [{ value: "3", label: "Pricing" }, { value: "77", label: "Gone" }]);
  assert.deepEqual(now.map((o) => [o.value, o.label, o.hidden]), [["3", "Pricing", false], ["77", "Gone", true]]);
  assert.equal(sameOptions(now, now), true);
  assert.equal(sameOptions(now.slice(0, 1), now), false);
  assert.equal(sameOptions([{ ...now[0], label: "Renamed" }, now[1]], now), false);
  // where a ticket sits: an action in a sub-category, one straight in its main category (the sub-category cleared)
  assert.deepEqual(planValuesOf(4, items), { mkt_plan_category: "2", mkt_plan_subcategory: "3", mkt_plan_action: "4" });
  assert.deepEqual(planValuesOf(6, items), { mkt_plan_category: "9", mkt_plan_subcategory: "", mkt_plan_action: "6" });
  assert.equal(planValuesOf(99, items), null);
});

test("action plan: a sub-action's ticket starts from its action - only what HubSpot offers, nothing made up", () => {
  const items = [it(1, null, "goal"), it(2, 1, "topic"), it(4, 2, "action", {
    title: "Run the spring campaign", detail: "Run the spring campaign", priority: "HIGH", channel: ["SEA", "Fax"], country: ["DE"], agency: [],
    roadmapYear: "2027", start: "2026-11-02", due: "2026-12-15", kpis: "Clicks", statusNote: "Briefed the agency",
  })];
  const v = ticketFromAction(items[2], items, { mkt_channel: [{ value: "SEA" }, { value: "HubSpot" }], mkt_roadmap_year: [{ value: "2026" }] });
  assert.deepEqual(v, {
    content: 'From the action plan: "Run the spring campaign".', hs_ticket_priority: "HIGH", mkt_channel: "SEA", mkt_implementation_country: "DE",
    mkt_planned_date: "2026-11-02", mkt_golive_date: "2026-12-15", mkt_kpis: "Clicks", mkt_status_note: "Briefed the agency",
    mkt_plan_category: "2", mkt_plan_action: "4",
  });
});

test("action plan: a dragged row lands only where it may", () => {
  const items = [
    it(1, null, "goal"), it(2, 1, "topic"), it(3, 2, "group"), it(4, 3, "action"), it(5, 3, "action"),
    it(6, 1, "topic"), it(7, 6, "group"), it(8, 6, "action"),
  ];
  assert.deepEqual(reorder(items, 4, 7, "into"), { parentId: 7, order: [4] });
  assert.deepEqual(reorder(items, 8, 4, "before"), { parentId: 3, order: [8, 4, 5] });
  assert.deepEqual(reorder(items, 5, 4, "before"), { parentId: 3, order: [5, 4] });
  assert.deepEqual(reorder(items, 4, 6, "into"), { parentId: 6, order: [7, 8, 4] }); // straight into a topic
  assert.deepEqual(reorder(items, 3, 6, "into"), { parentId: 6, order: [7, 8, 3] }); // a group to another topic
  assert.equal(reorder(items, 3, 7, "into"), null); // a group inside a group
  assert.equal(reorder(items, 2, 4, "into"), null); // a topic inside an action
  assert.equal(reorder(items, 4, 5, "into"), null); // nothing goes inside an action
  assert.equal(reorder(items, 1, 2, "into"), null); // the goal stays
  assert.equal(reorder(items, 2, 3, "into"), null); // never under itself
});

test("summit: the climb from the last full year to 30 M€ in 2031, this year as an estimate", () => {
  // round made-up figures, not the company's
  const full = [{ year: 2023, value: 18_000_000 }, { year: 2024, value: 19_000_000 }, { year: 2025, value: 20_000_000 }];
  const lfl = { year: 2026, value: 10_300_000, priorValue: 10_000_000, change: 0.03, monthsLabel: "January–September" };
  const s = summitOf(full, lfl, 2026);
  assert.deepEqual(s.base, { year: 2025, value: 20_000_000 });
  assert.ok(Math.abs(s.cagr! - (Math.pow(1.5, 1 / 6) - 1)) < 1e-12); // 20 -> 30 in six years: about +7 % a year
  assert.equal(s.path.length, 7);
  assert.ok(Math.abs(s.path[6].value - SUMMIT.value) < 1);
  assert.ok(Math.abs(s.current!.estimate - 20_600_000) < 1e-6);
  assert.ok(s.gap! < 0); // +3 % is behind the +7 % the path needs
  assert.ok(Math.abs(s.progress! - 0.06) < 1e-9);
  // a running year that is not the one after the base is never put on the mountain
  assert.equal(summitOf(full, { ...lfl, year: 2025 }, 2026).current, null);
  // the running year's own "full year" row never becomes the base
  assert.equal(summitOf([...full, { year: 2026, value: 15_000_000 }], null, 2026).base!.year, 2025);
  assert.equal(summitOf([], null, 2026).base, null);
});

test("summit: within 0.05 M€ of the path is on it - never \"behind by 0.0 M€\"", () => {
  assert.equal(standingOf(-40_000), "on");
  assert.equal(standingOf(49_999), "on");
  assert.equal(standingOf(-50_000), "behind");
  assert.equal(standingOf(700_000), "ahead");
  assert.equal(standingOf(null), null);
});

test("action plan: a sub-action's status reads as an action's - No status when open without a stage", () => {
  assert.equal(subStage({ stage: null, status: "open" }), null);
  assert.equal(subStage({ stage: null, status: "doing" })?.id, IN_PROGRESS);
  assert.equal(subStage({ stage: null, status: "done" })?.id, LIVE);
  assert.equal(subStage({ stage: KILLED, status: "done" })?.id, KILLED);
});

test("action plan: an action and its ticket - which way a difference goes", () => {
  const synced = "2026-11-02T10:00:00.000Z";
  assert.equal(syncWay("2026-11-02T09:00:00.000Z", "2026-11-02T09:30:00.000Z", null), "merge");
  assert.equal(syncWay("2026-11-02T10:05:00.000Z", "2026-11-02T09:59:00.000Z", synced), "push");
  assert.equal(syncWay("2026-11-02T09:59:00.000Z", "2026-11-02T10:05:00.000Z", synced), "pull");
  // both changed since: the latest
  assert.equal(syncWay("2026-11-02T10:06:00.000Z", "2026-11-02T10:05:00.000Z", synced), "push");
  assert.equal(syncWay("2026-11-02T10:05:00.000Z", "2026-11-02T10:06:00.000Z", synced), "pull");
});

test("action plan: an action and its ticket - what goes over, only what the other side takes", () => {
  const a = it(7, 3, "action", {
    title: "Run the spring campaign", detail: "Two waves", stage: IN_PROGRESS, priority: "HIGH", owners: [{ id: "11", name: "Ann" }, { id: "12", name: "Bo" }],
    start: "2026-11-02", due: "2026-12-15", channel: ["SEA", "HubSpot"], country: ["CH"], kpis: "Clicks", statusNote: "",
  });
  const t = {
    subject: "Run the spring campaign", content: "Two waves\r\n", hs_pipeline_stage: LIVE, hs_ticket_priority: "HIGH", hubspot_owner_id: "12",
    mkt_planned_date: "2026-11-02", mkt_golive_date: "2026-12-20", mkt_channel: "HubSpot;SEA", mkt_implementation_country: "CH", mkt_agency: "",
    mkt_roadmap_year: "", mkt_kpis: "Clicks", mkt_next_steps: "", mkt_status_note: "Briefed",
  };
  // the same channels in another order, a trailing line break: no difference
  const pull = ticketSync(a, t, "pull");
  assert.deepEqual(pull.fields, ["hs_pipeline_stage", "hubspot_owner_id", "mkt_golive_date", "mkt_status_note"]);
  assert.deepEqual(pull.pull, { stage: LIVE, ownerId: "12", due: "2026-12-20", statusNote: "Briefed" });
  assert.deepEqual(pull.push, {});
  const push = ticketSync(a, t, "push");
  assert.deepEqual(push.push, { hs_pipeline_stage: IN_PROGRESS, hubspot_owner_id: "11", mkt_golive_date: "2026-12-15", mkt_status_note: "" });
  assert.deepEqual(push.pull, {});
  // the first time: an empty side takes the other's, where both say something the ticket wins
  const merge = ticketSync({ ...a, roadmapYear: "2026" }, t, "merge");
  assert.deepEqual(merge.push, { mkt_roadmap_year: "2026" });
  assert.deepEqual(merge.pull, { stage: LIVE, ownerId: "12", due: "2026-12-20", statusNote: "Briefed" });
  // never an empty name or status to the ticket, never a stage the plan does not know
  const odd = ticketSync({ ...a, stage: null }, { ...t, subject: "", hs_pipeline_stage: "999" }, "push");
  assert.equal("hs_pipeline_stage" in odd.push, false);
  assert.equal(ticketSync(a, { ...t, hs_pipeline_stage: "999" }, "pull").pull.stage, undefined);
});
