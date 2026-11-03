import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  IDEA, IN_PROGRESS, KILLED, LIVE, channelsOfTopic, dgTargets, codesOf, foldedDetail, mainStage, namesSalesLeaders, isDigitalGrowth, isLate, dueSoon, subLate, subOrder, placeSub, ownersFromCodes, parseDue, percentOf, percentOfStage,
  planFromSeed, planOptions, planValuesOf, priorityOfWorkbook, reorder, rollup, sameOptions, stageOfPercent, stageOfState, stateOf, stateOfPercent,
  stateOfStage, stageOfStatus, statusOfStage, sharedTicketSync, subPct, subStage, subTicketSync, subsSpan, syncWay, ticketFromAction, ticketSync, titleOf, toS2s, treeOrder, BUC_MEMBERS,
  isDgPerson, takesTicket, subSoon,
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
    it(5, 3, "action", { stage: IDEA, percent: 0, start: "2026-10-15" }),
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
  // 5 is dated by its sub-actions (one going live 20.12, none planned in the past): not late, whatever its own 15.10 says
  // (SARCLA 03.11.2026)
  assert.equal(r.get(5)!.late, 0);
  // late on the planned date, not the go-live (SARCLA 02.11.2026): 4 - planned 01.10, go-live 30.11, in progress
  assert.equal(r.get(4)!.late, 1);
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
  for (const st of [LIVE, "6161856759", KILLED]) assert.equal(isLate(it(1, null, "action", { stage: st, start: "2026-01-01", percent: null }), "2026-11-01"), false);
  assert.equal(isLate(it(1, null, "action", { stage: "6161845476", start: "2026-01-01" }), "2026-11-01"), true);
  // the go-live alone makes nothing late; a sub-action the same way
  assert.equal(isLate(it(1, null, "action", { stage: IN_PROGRESS, due: "2026-01-01" }), "2026-11-01"), false);
  assert.equal(subLate({ start: "2026-10-01", stage: IN_PROGRESS, status: "doing" }, "2026-11-01"), true);
  assert.equal(subLate({ start: "2026-10-01", stage: LIVE, status: "done" }, "2026-11-01"), false);
  assert.equal(subLate({ start: null, stage: IN_PROGRESS, status: "doing" }, "2026-11-01"), false);
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
  // neither changed since they agreed: left alone
  assert.equal(syncWay("2026-11-02T09:00:00.000Z", "2026-11-02T09:30:00.000Z", synced), null);
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

test("action plan: a category's dates are only what is in it - its first date to its last, sub-actions too", () => {
  const items = [
    // the workbook gave the category its own dates: they no longer count
    it(1, null, "topic", { start: "2026-01-01", due: "2028-12-31" }),
    it(2, 1, "group"),
    it(3, 2, "action", { start: "2026-11-02", due: "2026-12-15" }),
    it(4, 1, "action", { due: "2027-01-20" }),
  ];
  const r = rollup(items, [sub(1, 3, "open", "2027-02-10", { start: "2026-10-20" })], "2026-11-01");
  assert.deepEqual([r.get(1)!.from, r.get(1)!.to], ["2026-10-20", "2027-02-10"]);
  assert.deepEqual([r.get(2)!.from, r.get(2)!.to], ["2026-10-20", "2027-02-10"]);
  // an action with sub-actions: their first date to their last
  assert.deepEqual([r.get(3)!.from, r.get(3)!.to, r.get(3)!.startFromSubs, r.get(3)!.dueFromSubs], ["2026-10-20", "2027-02-10", true, true]);
  assert.equal(r.get(4)!.startFromSubs, false);
  // nothing dated in it: no dates
  assert.deepEqual([rollup([it(5, null, "topic", { start: "2026-01-01" })], [], "2026-11-01").get(5)!.from], [null]);
});

test("action plan: a main action's dates are its sub-actions' - first to last, its own no longer count", () => {
  // SARCLA 02.11.2026: "go-live and planned date do not go as planned"
  assert.deepEqual(subsSpan([{ start: "2026-11-02", due: "2026-12-15" }, { start: null, due: "2027-01-31" }, { start: "2026-10-05", due: null }]), { start: "2026-10-05", due: "2027-01-31" });
  assert.equal(subsSpan([{ start: null, due: null }]), null);
  // a planned date is never a go-live: none among them - the action keeps its own go-live
  assert.deepEqual(subsSpan([{ start: "2026-11-01", due: null }]), { start: "2026-11-01", due: null });
  const own = rollup([it(2, null, "action", { start: "2026-09-01", due: "2026-12-31" })], [sub(1, 2, "open", null, { start: "2026-11-01" })], "2026-11-01").get(2)!;
  assert.deepEqual([own.from, own.to, own.startFromSubs, own.dueFromSubs], ["2026-11-01", "2026-12-31", true, false]);
  // its sub-actions all killed - the only one, or every one: the action is killed; one still open, it is not
  // a main action's status, its sub-actions' (SARCLA 02.11.2026: "the top stage is not changing even if it's live and a new sub-action")
  const k = (stage: string | null, status: PlanSub["status"] = "open") => ({ stage, status });
  const WAIT_APSO = "6161845476", READY = "6161860809", MAINT = "6161856759";
  assert.equal(mainStage([k(LIVE, "done"), k(WAIT_APSO, "doing")]), WAIT_APSO);
  assert.equal(mainStage([k(KILLED, "done")]), KILLED);
  assert.equal(mainStage([k(KILLED, "done"), k(LIVE, "done")]), LIVE);
  assert.equal(mainStage([k(MAINT, "done"), k(KILLED, "done")]), MAINT);
  assert.equal(mainStage([k(READY, "doing"), k(IN_PROGRESS, "doing"), k(IDEA)]), IN_PROGRESS);
  assert.equal(mainStage([k(LIVE, "done"), k(null)]), IN_PROGRESS);
  // nothing under way or done: the action keeps its own
  assert.equal(mainStage([k(IDEA), k(null)]), null);
  assert.equal(mainStage([k(null)]), null);
  assert.equal(mainStage([]), null);
  const r = rollup([it(1, null, "group"), it(2, 1, "action", { start: "2026-01-01", due: "2028-12-31" })], [sub(1, 2, "doing", "2026-12-01", { start: "2026-11-02" })], "2026-11-01");
  assert.deepEqual([r.get(2)!.from, r.get(2)!.to], ["2026-11-02", "2026-12-01"]);
  // no sub-action dated: the action keeps its own
  assert.deepEqual([rollup([it(2, null, "action", { start: "2026-01-01", due: "2026-03-01" })], [sub(1, 2, "open", null)], "2026-11-01").get(2)!.from], ["2026-01-01"]);
});

test("action plan: an imported action's description put right - its name not repeated, its expected result and next steps in it", () => {
  // SARCLA 02.11.2026: "take out KPIs and next steps completely on the old imported ones, enrich the description with this data and fix the description"
  const a = { title: "Expand Apsoparts market reach to new territories in Europe", detail: "Expand Apsoparts market reach to new territories in Europe\nWhich countries are interesting? => See matrix of country fit", kpis: "Expected: Increase Revenue", nextSteps: "" };
  assert.equal(foldedDetail(a), "Which countries are interesting? => See matrix of country fit\n\nExpected result: Increase Revenue");
  // only its name: the expected result alone
  assert.equal(foldedDetail({ ...a, detail: a.title }), "Expected result: Increase Revenue");
  // a name made of a line ending in ":" and the next ones (titleOf): that first line goes
  assert.equal(foldedDetail({ title: "Pricing project linked to Pricing Hub: Step 1 : see low margin…", detail: "Pricing project linked to Pricing Hub:\nStep 1 : see low margin articles\nStep 2 : own prices", kpis: "", nextSteps: "Ask Claudio\nTest on 10 articles" }),
    "Step 1 : see low margin articles\nStep 2 : own prices\n\nNext steps:\nAsk Claudio\nTest on 10 articles");
  // KPIs someone typed, word for word; a description that does not repeat the name stays whole
  assert.equal(foldedDetail({ title: "Price check", detail: "Check prices weekly", kpis: "Share of prices checked", nextSteps: "" }), "Check prices weekly\n\nKPIs: Share of prices checked");
  assert.equal(namesSalesLeaders("Sales leaders"), true);
  assert.equal(namesSalesLeaders("LEAL + sales leader"), true);
  assert.equal(namesSalesLeaders("LEAL/FRMA/RABE"), false);
});

test("action plan: a sub-action and its ticket - its own fields both ways, the ticket's way back kept", () => {
  const s = { title: "Brief the agency", note: "Two waves", stage: IN_PROGRESS, priority: "HIGH", owner: "11", start: "2026-11-02", due: null, statusNote: "" };
  const t = {
    subject: "Brief the agency", content: "Two waves\n\nOpen it: https://hub/action-plan?item=7", hs_pipeline_stage: LIVE, hs_ticket_priority: "HIGH",
    hubspot_owner_id: "11", mkt_planned_date: "2026-11-02", mkt_golive_date: "2026-12-01", mkt_status_note: "Sent",
  };
  // the link at the end of the ticket's description is not a difference
  const pull = subTicketSync(s, t, "pull");
  assert.deepEqual(pull.fields, ["hs_pipeline_stage", "mkt_golive_date", "mkt_status_note"]);
  assert.deepEqual(pull.pull, { stage: LIVE, due: "2026-12-01", statusNote: "Sent" });
  // a new description pushed keeps the way back
  const push = subTicketSync({ ...s, note: "Three waves" }, t, "push");
  assert.equal(push.push.content, "Three waves\n\nOpen it: https://hub/action-plan?item=7");
  // a task made on a KPI tile with the maker's e-mail as owner: no owner for the ticket
  assert.equal("hubspot_owner_id" in subTicketSync({ ...s, owner: "ann@example.com" }, { ...t, hubspot_owner_id: "" }, "push").push, false);
  // the first time: the ticket wins where both say something, an empty side takes the other's
  const merge = subTicketSync({ ...s, statusNote: "", due: "2026-12-05" }, { ...t, mkt_status_note: "" }, "merge");
  assert.deepEqual(merge.pull, { stage: LIVE, due: "2026-12-01" });
  assert.deepEqual(merge.push, {});
});

test("action plan: a sub-action duplicated onto another action keeps its ticket - all three kept in step in one run", () => {
  const base = { title: "Brief the agency", note: "Two waves", stage: IN_PROGRESS, priority: "HIGH", owner: "11", start: "2026-11-02", due: "2026-12-01", statusNote: "" };
  const t = {
    subject: "Brief the agency", content: "Two waves\n\nOpen it: https://hub/action-plan?item=7", hs_pipeline_stage: IN_PROGRESS, hs_ticket_priority: "HIGH",
    hubspot_owner_id: "11", mkt_planned_date: "2026-11-02", mkt_golive_date: "2026-12-01", mkt_status_note: "",
  };
  const synced = new Map([[1, "2026-11-02T10:00:00.000Z"], [2, "2026-11-02T10:00:00.000Z"]]);
  const now = "2026-11-02T12:00:00.000Z";
  // the original changed since: the ticket takes it, the copy takes it from the ticket at once
  const a = { ...base, id: 1, statusNote: "Sent", updatedAt: "2026-11-02T11:00:00.000Z" }, b = { ...base, id: 2, updatedAt: "2026-11-02T09:00:00.000Z" };
  let r = sharedTicketSync([b, a], t, "2026-11-02T09:30:00.000Z", synced, now);
  assert.deepEqual(r.push, { mkt_status_note: "Sent" });
  assert.deepEqual(r.pulls, [{ id: 2, pull: { statusNote: "Sent" } }]);
  assert.deepEqual(r.agreed, [1, 2]);
  // both changed: the last change wins, for the ticket and for the other one
  r = sharedTicketSync([a, { ...b, statusNote: "Waiting", updatedAt: "2026-11-02T11:30:00.000Z" }], t, "2026-11-02T09:30:00.000Z", synced, now);
  assert.deepEqual([r.push, r.pulls], [{ mkt_status_note: "Waiting" }, [{ id: 1, pull: { statusNote: "Waiting" } }]]);
  // the ticket changed in HubSpot: both take it, nothing is pushed
  r = sharedTicketSync([{ ...base, id: 1, updatedAt: "2026-11-02T09:00:00.000Z" }, b], { ...t, hs_pipeline_stage: LIVE }, "2026-11-02T11:00:00.000Z", synced, now);
  assert.deepEqual([r.push, r.pulls.map((x) => x.id)], [{}, [1, 2]]);
  // nothing changed: left alone; a copy that never met the ticket and says the same: in step, nothing moves
  r = sharedTicketSync([{ ...base, id: 1, updatedAt: "2026-11-02T09:00:00.000Z" }, { ...base, id: 3, updatedAt: "2026-11-02T11:00:00.000Z" }], t, "2026-11-02T09:30:00.000Z", synced, now);
  assert.deepEqual([r.push, r.pulls, r.agreed], [{}, [], [3]]);
});

test("action plan: a Scroll to Sale ticket goes under a Digital Growth action, or as a new action in a category holding one", () => {
  const items = [
    it(1, null, "goal"), it(2, 1, "topic", { title: "Boost" }), it(3, 2, "group", { title: "Sales" }), it(4, 3, "action", { title: "Ads", dg: true }),
    it(5, 3, "action", { title: "Calls" }), it(6, 2, "group", { title: "Ops" }), it(7, 6, "action", { title: "Stock" }), it(8, 1, "topic", { title: "Other" }),
  ];
  const t = dgTargets(items);
  assert.deepEqual(t.actions.map((a) => a.id), [4]);
  // the categories above a Digital Growth action - not the goal, not the ones without one
  assert.deepEqual(t.categories.map((c) => c.id), [2, 3]);
  assert.equal(t.path(items[3]), "Boost > Sales");
});

test("action plan: sub-actions in their order - the open ones first, as dragged, then by go-live; a drop's new order", () => {
  const sub = (id: number, x: Partial<PlanSub> = {}): PlanSub => ({
    id, item: 1, title: `s${id}`, owner: "", ownerName: "", start: null, due: null, status: "open", stage: null, priority: "", kpiHref: "", kpiTile: "", tickets: 0, ...x,
  });
  // never dragged: open by go-live, the ones without one after them; the closed ones (done, live, killed) at the end
  const plain = [sub(1, { status: "done", due: "2026-08-01" }), sub(2, { due: "2026-12-01" }), sub(3, { stage: LIVE, status: "doing" }), sub(4, { due: "2026-09-01" }), sub(5), sub(6, { stage: KILLED })];
  assert.deepEqual(subOrder(plain).map((s) => s.id), [4, 2, 5, 1, 3, 6]);
  // dragged: their places first, a new one after them; a closed one stays below the open ones whatever its place
  const dragged = [sub(1, { sort: 1, status: "done" }), sub(2, { sort: 3 }), sub(4, { sort: 2 }), sub(7, { due: "2026-01-01" })];
  assert.deepEqual(subOrder(dragged).map((s) => s.id), [4, 2, 7, 1]);
  // a drop above or below another
  assert.deepEqual(placeSub([4, 2, 7], 7, 4, "before"), [7, 4, 2]);
  assert.deepEqual(placeSub([4, 2, 7], 4, 7, "after"), [2, 7, 4]);
  assert.deepEqual(placeSub([4, 2, 7], 4, 2, "after"), [2, 4, 7]);
  // from another action: put in among them
  assert.deepEqual(placeSub([4, 2], 9, 2, "before"), [4, 9, 2]);
  assert.equal(placeSub([4, 2], 4, 4, "before"), null);
  assert.equal(placeSub([4, 2], 4, 8, "before"), null);
});

test("action plan: due within a week - a planned date today to seven days on, not yet live; the action's or a sub-action's", () => {
  const today = "2026-11-03";
  const a = (start: string | null, stage: string | null = IN_PROGRESS) => it(1, null, "action", { start, stage, percent: null });
  const s = (start: string | null, x: Partial<PlanSub> = {}): PlanSub => ({ id: 0, item: 1, title: "", owner: "", ownerName: "", start, due: null, status: "doing", stage: IN_PROGRESS, priority: "", kpiHref: "", kpiTile: "", tickets: 0, ...x });
  assert.equal(dueSoon(a("2026-11-03"), [], today), true); // today: due, not late
  assert.equal(dueSoon(a("2026-11-10"), [], today), true); // seven days on
  assert.equal(dueSoon(a("2026-11-11"), [], today), false);
  assert.equal(dueSoon(a("2026-11-02"), [], today), false); // past: late instead
  assert.equal(isLate(a("2026-11-02"), today), true);
  assert.equal(dueSoon(a("2026-11-05", LIVE), [], today), false); // live: nothing due
  assert.equal(dueSoon(a(null), [], today), false);
  // an action already late, one of its sub-actions planned in five days: due within a week too
  assert.equal(dueSoon(a("2026-10-01"), [s("2026-10-01"), s("2026-11-08")], today), true);
  assert.equal(dueSoon(a("2026-10-01"), [s("2026-11-08", { stage: LIVE, status: "done" })], today), false);
  // across a month's end
  assert.equal(dueSoon(a("2026-12-03"), [], "2026-11-28"), true);
});

test("action plan: an action dated by its sub-actions is late only when an open one is - a live one no longer counts", () => {
  const today = "2026-11-03";
  // SARCLA 03.11.2026: planned 22.10 from its first sub-action, which is live; the open one planned for 16.12
  const action = it(1, null, "action", { start: "2026-10-22", due: "2026-11-10", stage: "6161845476", percent: null });
  const live = { start: "2026-10-22", due: "2026-11-10", stage: LIVE, status: "done" as const };
  const waiting = { start: "2026-12-16", due: null, stage: "6161845476", status: "doing" as const };
  assert.equal(isLate(action, today, [live, waiting]), false);
  assert.equal(isLate(action, today), true); // on its own date alone it would be
  assert.equal(isLate(action, today, [live, { ...waiting, start: "2026-10-30" }]), true);
  // sub-actions without a date: the action's own
  assert.equal(isLate(action, today, [{ start: null, due: null, stage: null, status: "open" }]), true);
  // due within a week the same way: the live one's date is not a deadline
  assert.equal(dueSoon(action, [{ ...live, start: "2026-11-05" }, waiting], today), false);
  assert.equal(dueSoon(action, [live, { ...waiting, start: "2026-11-05" }], today), true);
  // the rollup: the action and its category
  const items = [it(10, null, "topic"), it(11, 10, "action", { start: "2026-10-22", due: "2026-11-10", stage: "6161845476", percent: null })];
  const subsOf = (xs: Partial<PlanSub>[]): PlanSub[] => xs.map((x, k) => ({ id: 100 + k, item: 11, title: "", owner: "", ownerName: "", start: null, due: null, status: "open", stage: null, priority: "", kpiHref: "", kpiTile: "", tickets: 0, ...x }));
  const r = rollup(items, subsOf([live, waiting]), today);
  assert.equal(r.get(11)!.lateSelf, false);
  assert.equal(r.get(10)!.late, 0);
});

test("action plan: a Digital Growth person's sub-action takes a Scroll to Sale ticket, whoever leads its action", () => {
  assert.equal(isDgPerson("Aleksandra Pytlik"), true); // PYTALE
  assert.equal(isDgPerson("Claudio Saraiva"), true); // SARCLA
  assert.equal(isDgPerson("Diana Fehr"), true); // FEHDIA
  assert.equal(isDgPerson("Marc Muster"), false);
  assert.equal(isDgPerson(""), false);
  assert.equal(isDgPerson(null), false);
  // SARCLA 03.11.2026: "Launch APSOparts Wikipedia", Aleksandra's, under an action no one leads
  assert.equal(takesTicket({ dg: false }, "Aleksandra Pytlik"), true);
  assert.equal(takesTicket({ dg: false }, "Marc Muster"), false);
  assert.equal(takesTicket({ dg: false }), false); // the action itself: only when Digital Growth leads it
  assert.equal(takesTicket({ dg: true }, "Marc Muster"), true);
});

test("action plan: the sub-action that makes its action due within a week is the one marked", () => {
  const today = "2026-11-03";
  const open = { stage: "6161860808", status: "doing" as const };
  // SARCLA 03.11.2026: "Use Case: Purchaser Leaving", in progress, planned 09.11
  assert.equal(subSoon({ start: "2026-11-09", ...open }, today), true);
  assert.equal(subSoon({ start: "2026-11-03", ...open }, today), true); // today
  assert.equal(subSoon({ start: "2026-11-10", ...open }, today), true); // the 7th day
  assert.equal(subSoon({ start: "2026-11-11", ...open }, today), false);
  assert.equal(subSoon({ start: "2026-11-02", ...open }, today), false); // late, not soon
  assert.equal(subSoon({ start: "2027-01-18", ...open }, today), false);
  assert.equal(subSoon({ start: "2026-11-09", stage: LIVE, status: "done" }, today), false);
  assert.equal(subSoon({ start: null, ...open }, today), false);
  // the action is due within a week exactly when one of its sub-actions is marked
  const action = { start: "2026-07-25", percent: 58, stage: "6161860808" };
  const subs = [{ start: "2027-02-14", due: "2027-01-16", ...open }, { start: "2026-11-09", due: null, ...open }, { start: "2027-01-18", due: null, ...open }];
  assert.equal(dueSoon(action, subs, today), true);
  assert.deepEqual(subs.map((s) => subSoon(s, today)), [false, true, false]);
});
