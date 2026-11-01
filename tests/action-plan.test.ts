import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  isDigitalGrowth, parseDue, percentOf, planFromSeed, reorder, rollup, stateOf, stateOfPercent, titleOf,
  type PlanItem, type PlanSub, type SeedRow,
} from "../src/lib/reporting/actionPlanRules";
import { SUMMIT, summitOf } from "../src/lib/reporting/summitRules";

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
  start: null, due: null, dueNote: "", percent: null, dg: false, updatedBy: "", updatedAt: "", ...p,
});
const sub = (id: number, item: number, status: PlanSub["status"], due: string | null = null): PlanSub => ({ id, item, title: `s${id}`, ownerName: "", due, status, kpiHref: "", kpiTile: "", tickets: 0 });

test("action plan: % complete and dates roll up; sub-actions count for their action", () => {
  const items = [
    it(1, null, "goal"), it(2, 1, "topic"), it(3, 2, "group"),
    it(4, 3, "action", { state: "doing", percent: 50, start: "2026-10-01", due: "2026-11-30" }),
    it(5, 3, "action", { state: "todo", percent: 0, due: "2026-10-15" }),
    it(6, 2, "action", { state: "done", percent: 100, due: "2026-09-01" }),
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
  assert.equal(rollup([it(1, null, "topic"), it(2, 1, "action", { state: "done", percent: 100 }), it(3, 1, "action"), it(4, 1, "action")], [], "2026-11-01").get(1)!.percent, 33);
  assert.deepEqual([r.get(3)!.from, r.get(3)!.to], ["2026-10-01", "2026-12-20"]);
  assert.equal(r.get(5)!.late, 1); // due 15.10, not done
  assert.equal(r.get(2)!.late, 1);
  assert.deepEqual([r.get(1)!.subs, r.get(1)!.subsOpen], [3, 2]);
  // done is done, whatever its sub-actions say
  assert.equal(rollup([it(9, null, "action", { state: "done", percent: 100 })], [sub(4, 9, "open")], "2026-11-01").get(9)!.percent, 100);
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
