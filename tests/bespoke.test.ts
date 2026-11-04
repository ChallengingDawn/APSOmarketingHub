import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  EXPORT_COLUMNS, dmy, exportRow, isOpenCheck, lateOf, stateOf, subNote, subStatusNote, ticketValues, validationCell, yearOf,
  type BespokeCheck, type BespokeData, type BespokeSub, type LiveSub,
} from "../src/lib/reporting/bespokeRules";
import { S2S_FIELDS, missingRequired } from "../src/lib/reporting/scrollToSaleRules";
import { PRIORITIES, STAGES } from "../src/lib/reporting/actionPlanRules";

// SARCLA 04.11.2026: Bespoke's technical check in the Action plan - one sub-action per open request, each with its own
// ticket, the check's status taken from that sub-action, Bespoke's own columns exported back. Made-up checks below; the
// real file (company data, left out of the sandbox) is checked only where it exists.

const LIVE = "6161856758", KILLED = "6161860810", WAITING = "6161845477", MAINTAINING = "6161856759";
const check = (p: Partial<BespokeCheck> = {}): BespokeCheck => ({
  id: 7, topic: "Crawling", page: "All pages", scope: "SEO/GEO", desc: "Pages answer quickly", prio: "1", status: "KO",
  observation: "Slow pages.", who: "WIDA", solved: "", next: "Ask the agency.", resolved: "", validation: "0", feedback: "",
  tier: "TIER 1", rank: 3, difficulty: "Easy", found: "12 pages are slow.", ask: "Make them fast.", ...p,
});
const sub = (p: Partial<BespokeSub> = {}): BespokeSub => ({
  key: "7", check: 7, title: "Bespoke #7 - Fast pages", stage: WAITING, priority: "URGENT", owner: "111", ownerName: "Pat Example",
  planned: "2026-11-20", golive: "2026-11-20", agency: ["dotSource"], work: "dotSource · ANP-1", speed: "Fast", why: "Small and paid.",
  basis: "Two weeks after the release list.", ticket: null, ...p,
});
const live = (p: Partial<LiveSub> = {}): LiveSub => ({
  taskId: 5, title: "Bespoke #7 - Fast pages", stage: WAITING, owner: "754305239", ownerName: "Pat Example", start: "2026-11-20",
  due: "2026-11-20", statusNote: "Speed: Fast - Small and paid.", ticketId: "99", ...p,
});

test("bespoke: a check's state comes from its sub-action, else from Bespoke's sheet", () => {
  assert.equal(stateOf(check(), live()), "open");
  assert.equal(stateOf(check(), live({ stage: LIVE })), "ok");
  assert.equal(stateOf(check(), live({ stage: MAINTAINING })), "ok");
  assert.equal(stateOf(check(), live({ stage: KILLED })), "na");
  assert.equal(stateOf(check({ status: "OK" }), null), "ok");
  assert.equal(stateOf(check({ status: "Incomplete" }), null), "open");
  assert.equal(stateOf(check({ status: "N/A" }), null), "na");
  assert.ok(isOpenCheck({ status: "KO" }) && isOpenCheck({ status: "Incomplete" }) && !isOpenCheck({ status: "OK" }));
});

test("bespoke: late = open and its planned date passed", () => {
  assert.equal(lateOf(live({ start: "2026-11-03" }), "2026-11-04"), true);
  assert.equal(lateOf(live({ start: "2026-11-04" }), "2026-11-04"), false);
  assert.equal(lateOf(live({ start: "2026-11-03", stage: LIVE }), "2026-11-04"), false);
  assert.equal(lateOf(live({ start: "2026-11-03", stage: KILLED }), "2026-11-04"), false);
  assert.equal(lateOf(live({ start: null }), "2026-11-04"), false);
  assert.equal(lateOf(null, "2026-11-04"), false);
});

test("bespoke: the sub-action's description and status note say what Bespoke asks and why it can go fast", () => {
  const n = subNote(sub(), check());
  assert.match(n, /^Bespoke check #7 \(Crawling · All pages\): Pages answer quickly/);
  assert.match(n, /Bespoke found: 12 pages are slow\./);
  assert.match(n, /Bespoke asks: Make them fast\./);
  assert.match(n, /Who does it: dotSource · ANP-1/);
  assert.match(n, /Planned date: Two weeks after the release list\./);
  assert.match(n, /Done when Bespoke marks check #7 OK\.$/);
  assert.equal(subNote(sub({ check: null, work: "", basis: "" }), null), "Small and paid.");
  assert.equal(subStatusNote(sub()), "Speed: Fast - Small and paid.");
  assert.equal(subStatusNote(sub({ speed: "Killed", why: "No recipes." })), "Killed - No recipes.");
});

test("bespoke: a new ticket has every required field of the pipeline, and only its fields", () => {
  const v = ticketValues(sub(), "note", "https://hub/action-plan?sub=5", "MKT26-60", "2026-11-04");
  assert.deepEqual(missingRequired(v), []);
  const known = new Set(S2S_FIELDS.map((f) => f.name));
  assert.deepEqual(Object.keys(v).filter((k) => !known.has(k)), []);
  assert.equal(v.content, "note\n\nOpen it: https://hub/action-plan?sub=5");
  assert.equal(v.mkt_agency, "dotSource");
  assert.equal(v.mkt_roadmap_year, "2026");
  assert.equal(ticketValues(sub({ planned: "2027-02-26" }), "n", "x", "MKT27-01", "2026-11-04").mkt_roadmap_year, "2027");
  assert.equal(yearOf({ planned: null }, "2026-11-04"), "2026");
  assert.equal(ticketValues(sub({ planned: null, golive: null }), "n", "x", "MKT26-61", "2026-11-04").mkt_planned_date, "");
});

test("bespoke: the export is Bespoke's columns A..N with our answers in", () => {
  assert.equal(EXPORT_COLUMNS.length, 14);
  const open = exportRow(check(), live(), undefined);
  assert.equal(open.length, 14);
  assert.deepEqual(open.slice(0, 7), [7, "Crawling", "All pages", "SEO/GEO", "Pages answer quickly", 1, "KO"]);
  assert.equal(open[7], "Slow pages.");
  assert.equal(open[8], "WIDA");
  assert.equal(open[9], "No");
  assert.equal(open[10], "Waiting on Agency · Pat Example · planned 20.11.2026: Speed: Fast - Small and paid.");
  assert.equal(open[12], 0);
  const done = exportRow(check(), live({ stage: LIVE, due: "2026-11-18" }), { validation: "Yes", feedback: "Checked." });
  assert.equal(done[6], "OK");
  assert.equal(done[9], "Yes");
  assert.equal(done[10], "Live · Pat Example · live 18.11.2026: Speed: Fast - Small and paid.");
  assert.equal(done[11], "18.11.2026");
  assert.equal(done[12], 1);
  assert.equal(done[13], "Checked.");
  const killed = exportRow(check(), live({ stage: KILLED }), undefined);
  assert.deepEqual([killed[6], killed[9]], ["N/A", "N/A"]);
  // a check without a sub-action stays as Bespoke wrote it
  const passed = exportRow(check({ status: "OK", next: "", solved: "" }), null, undefined);
  assert.deepEqual([passed[6], passed[8], passed[9], passed[10]], ["OK", "WIDA", "", ""]);
  assert.equal(validationCell("No", "1"), 0);
  assert.equal(validationCell(undefined, ""), "");
  assert.equal(dmy("2026-02-03"), "03.02.2026");
  assert.equal(dmy(null), "");
});

const DATA = join(__dirname, "../../src/data/bespokeChecks.json");
const noData = existsSync(DATA) ? false : "no Bespoke check in this copy";
const data = noData ? null : (JSON.parse(readFileSync(DATA, "utf8")) as BespokeData);

test("bespoke: the real check - 137 checks, one sub-action per open request, each a valid ticket", { skip: noData }, () => {
  const d = data as BespokeData;
  assert.equal(d.checks.length, 137);
  assert.deepEqual(d.checks.map((c) => c.id), Array.from({ length: 137 }, (_, i) => i + 1));
  const open = d.checks.filter(isOpenCheck).map((c) => c.id).sort((a, b) => a - b);
  const subs = d.subs.filter((s) => s.check != null).map((s) => s.check as number).sort((a, b) => a - b);
  assert.deepEqual(subs, open, "each open check has exactly one sub-action");
  assert.equal(new Set(d.subs.map((s) => s.key)).size, d.subs.length);
  assert.equal(d.subs.filter((s) => s.check == null).length, 1, "and one for this tab");
  const stages = new Set(STAGES.map((s) => s.id)), prios = new Set<string>(PRIORITIES.map((p) => p.value));
  const owners = new Set(d.owners.map((o) => o.id));
  for (const s of d.subs) {
    assert.ok(stages.has(s.stage), s.title);
    assert.ok(prios.has(s.priority), s.title);
    assert.ok(owners.has(s.owner), s.title);
    assert.ok(s.title.length <= 300 && s.title.startsWith(s.check != null ? `Bespoke #${s.check} - ` : "Bespoke checks tab"), s.title);
    for (const x of [s.planned, s.golive]) assert.ok(x == null || /^\d{4}-\d{2}-\d{2}$/.test(x), s.title);
    assert.ok(s.agency.every((a) => a === "Bespoke" || a === "dotSource"), s.title);
    const c = d.checks.find((x) => x.id === s.check) ?? null;
    assert.ok(subNote(s, c).length <= 4000, s.title);
    if (c) assert.ok(c.ask && c.found, `#${c.id} says what Bespoke found and asks`);
    assert.deepEqual(missingRequired(ticketValues(s, "n", "x", "MKT26-01", "2026-11-04")), [], s.title);
  }
  // Organization (#65) and structured data (#61) are two requests, two sub-actions (SARCLA 04.11.2026)
  assert.ok(d.subs.some((s) => s.check === 65) && d.subs.some((s) => s.check === 61));
  // the existing store-view ticket carries #84
  assert.equal(d.subs.find((s) => s.check === 84)?.ticket, "435654298857");
  assert.equal(d.study.ticket, "442645087480");
  assert.deepEqual(Object.keys(d.columns), [...EXPORT_COLUMNS]);
});
