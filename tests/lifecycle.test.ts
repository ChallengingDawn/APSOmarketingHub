import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGE, UCS, VIEW_KEYS, isViewKey, qualKind, ucForEmailNumber } from "../src/lib/lifecycle/config";
import {
  addDays, addMonths, afterVsYearBefore, cartValue, churnEpisodes, companyOfContact, enrolledOn, inWin, lastStepBefore, monthLabel,
  monthsFrom, nextEntry, orderDays, parseEmailName, parseWin, rateOf, ratingOf, revProp, revenueByMonth, secondOrderDay, sendsOf,
  qualOf, shiftMonth, sourceOf, stageEntries, tally, toDay, touchesRestage, within, withinMonths, type Entry,
} from "../src/lib/lifecycle/rules";
import {
  emailView, firstOnOrAfter, overviewView, whoQualified, secondOrderCurve, stepsByCompany, uc10View, uc12View, uc13View, uc15View, uc2View, uc4View, uc6View, uc9View,
} from "../src/lib/lifecycle/views";
import type { Co, EmailData, OverviewData, Ticket, UcData } from "../src/lib/lifecycle/types";

/* ── days ─────────────────────────────────────────────────────────────── */

test("a HubSpot datetime is the Zurich day it happened; a date stays a date", () => {
  assert.equal(toDay("2026-03-31T22:30:00Z"), "2026-04-01"); // 00:30 in Zurich (summer time)
  assert.equal(toDay("2026-01-31T22:30:00Z"), "2026-01-31"); // 23:30 in Zurich (winter time)
  assert.equal(toDay("2014-12-11"), "2014-12-11");
  assert.equal(toDay(String(Date.parse("2026-07-01T10:00:00Z"))), "2026-07-01");
  assert.equal(toDay(""), null);
  assert.equal(toDay(null), null);
  assert.equal(toDay("not a date"), null);
});

test("months and days add up across year ends and short months", () => {
  assert.equal(addDays("2026-12-25", 10), "2027-01-04");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2025-11-15", 9), "2026-08-15");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2025-11", 3), "2026-02");
  assert.deepEqual(monthsFrom("2025-11-03", "2026-02-10"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(revProp("2026-07"), "rev_2026_jul");
});

test("February 2026 is marked wherever it appears", () => {
  assert.equal(monthLabel("2026-02"), "Feb 26 *");
  assert.equal(monthLabel("2026-02", false), "Feb 26");
  assert.equal(monthLabel("2026-03"), "Mar 26");
  assert.equal(touchesRestage(["2026-01", "2026-02"]), true);
  assert.equal(touchesRestage(["2026-03"]), false);
});

/* ── the period ───────────────────────────────────────────────────────── */

test("the period is inclusive, never in the future, never inverted, never longer than a year", () => {
  const w = parseWin("2026-09-01", "2026-09-30", "2026-10-13");
  assert.deepEqual(w, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(inWin("2026-09-30", w), true);
  assert.equal(inWin("2026-09-30T23:00:00Z", w), true);
  assert.equal(inWin("2026-10-01", w), false);
  assert.equal(inWin(null, w), false);
  assert.deepEqual(parseWin(null, null, "2026-10-13"), { from: "2026-09-16", to: "2026-10-13" });
  assert.deepEqual(parseWin("2026-10-20", "2026-12-01", "2026-10-13"), { from: "2026-10-13", to: "2026-10-13" });
  assert.deepEqual(parseWin("2020-01-01", "2026-10-13", "2026-10-13"), { from: "2025-10-12", to: "2026-10-13" });
  assert.deepEqual(parseWin("junk", "2026-10-13", "2026-10-13").to, "2026-10-13");
});

/* ── conversion ───────────────────────────────────────────────────────── */

test("a cohort still inside its days is open, not a failure", () => {
  assert.equal(within("2026-09-01", "2026-10-15", 90, "2026-10-20"), "yes");
  assert.equal(within("2026-09-01", null, 90, "2026-10-20"), "open");
  assert.equal(within("2026-01-01", null, 90, "2026-10-20"), "no");
  assert.equal(within("2026-01-01", "2026-06-01", 90, "2026-10-20"), "no"); // bought, but after the 90 days
  assert.equal(within("2026-01-01", "2025-12-01", 90, "2026-10-20"), "no"); // bought before: not this flow's doing
  assert.equal(rateOf(["yes", "no", "open", "yes"]), 2 / 3);
  assert.equal(rateOf(["open"]), null);
});

test("the second order within 9 months counts only a later order, up to the same day 9 months on", () => {
  assert.equal(withinMonths("2025-11-15", "2026-08-15", 9, "2026-10-13"), "yes");
  assert.equal(withinMonths("2025-11-15", "2026-08-16", 9, "2026-10-13"), "no");
  assert.equal(withinMonths("2026-06-01", null, 9, "2026-10-13"), "open");
  assert.equal(withinMonths("2026-06-01", "2026-06-01", 9, "2026-10-13"), "open");
});

test("orders count as the company facts count them: ERP-linked, no credit note, no cancelled, .000/.001 as one", () => {
  const o = (number: string | null, date: string, extra: { pipeline?: string; stage?: string } = {}) => ({ number, date, pipeline: extra.pipeline ?? "3687945443", stage: extra.stage ?? "x" });
  const orders = [
    o("110.4711.000", "2026-01-10"), o("110.4711.001", "2026-02-01"),  // one order, split delivery
    o("G4712", "2026-01-20"),                                           // credit note
    o("4713", "2026-01-25", { stage: "5676846286" }),                   // cancelled
    o(null, "2026-01-26"),                                              // web order not taken over by the ERP yet
    o("4714", "2026-01-27", { pipeline: "other" }),                     // another pipeline
    o("4715", "2026-03-05"),
  ];
  assert.deepEqual(orderDays(orders), ["2026-01-10", "2026-03-05"]);
  assert.equal(secondOrderDay(orders), "2026-03-05");
  assert.equal(secondOrderDay([o("1", "2026-01-10"), o("2", "2026-01-10")]), null); // same day twice is not a second order day
  assert.equal(secondOrderDay([]), null);
});

/* ── stage history ────────────────────────────────────────────────────── */

const hist = (rows: [string | null, string, string?][]) => rows.map(([value, timestamp, sourceType]) => ({ value, timestamp, sourceType: sourceType ?? "AUTOMATION_PLATFORM" }));

test("stage history becomes the stages entered, oldest first, repeats and blanks handled", () => {
  // HubSpot gives the history newest first
  const h = hist([
    [STAGE.reactivated, "2026-05-02T08:00:00Z"],
    [STAGE.churn, "2026-02-10T08:00:00Z", "CRM_UI_BULK_ACTION"],
    [STAGE.churn, "2026-02-09T08:00:00Z"],             // same value again: not a new entry
    [null, "2025-06-01T08:00:00Z"],                    // cleared
    [STAGE.churn, "2025-03-01T08:00:00Z"],
    [STAGE.loyalty, "2024-03-01T08:00:00Z"],           // before the horizon
  ]);
  const e = stageEntries(h, "2025-01-01");
  assert.deepEqual(e, [[STAGE.churn, "2025-03-01", "wf"], [STAGE.churn, "2026-02-09", "wf"], [STAGE.reactivated, "2026-05-02", "wf"]]);
  assert.equal(sourceOf("CRM_UI_BULK_ACTION"), "bulk");
  assert.equal(sourceOf("IMPORT"), "bulk");
  assert.equal(sourceOf("MERGE_OBJECTS"), "merge");
  assert.equal(sourceOf("FORM"), "other");
  assert.deepEqual(nextEntry(e, "2026-01-01", [STAGE.reactivated]), [STAGE.reactivated, "2026-05-02", "wf"]);
  assert.equal(nextEntry(e, "2026-06-01", [STAGE.reactivated]), null);
});

test("each churn entry is followed to Reactivated, Not reactivated or still open", () => {
  const e: Entry[] = [
    [STAGE.churn, "2025-03-01", "wf"], [STAGE.reactivated, "2025-05-01", "wf"],
    [STAGE.churn, "2026-02-09", "bulk"], [STAGE.notReactivated, "2026-08-01", "wf"],
    [STAGE.churn, "2026-09-01", "wf"],
  ];
  assert.deepEqual(churnEpisodes(e), [
    { start: "2025-03-01", src: "wf", outcome: "reactivated", on: "2025-05-01" },
    { start: "2026-02-09", src: "bulk", outcome: "not", on: "2026-08-01" },
    { start: "2026-09-01", src: "wf", outcome: "open", on: null },
  ]);
});

test("a company enters a UC flow on its last \"Enrolled\"", () => {
  assert.equal(enrolledOn(hist([["Bought 1st email", "2026-08-20T10:00:00Z"], ["Enrolled", "2026-07-02T10:00:00Z"]])), "2026-07-02");
  assert.equal(enrolledOn(hist([["Enrolled", "2026-09-01T10:00:00Z"], ["Enrolled", "2026-07-02T10:00:00Z"]])), "2026-09-01");
  assert.equal(enrolledOn(hist([["Bought 2nd email", "2026-08-20T10:00:00Z"]])), "2026-08-20");
  assert.equal(enrolledOn([]), null);
});

/* ── revenue ──────────────────────────────────────────────────────────── */

test("revenue months are read from rev_<y>_<mon>, and compared like for like after a flag", () => {
  const rev = revenueByMonth({ rev_2026_jul: "100.5", rev_2026_aug: "", rev_2026_sep: "x", rev_2025_jul: "50" }, ["2025-07", "2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(rev, { "2025-07": 50, "2026-07": 100.5 });
  const r = { "2025-02": 10, "2025-03": 20, "2025-04": 30, "2026-02": 5, "2026-03": 5, "2026-04": 5 };
  assert.deepEqual(afterVsYearBefore(r, "2026-01", 3, "2026-10"), { after: 15, before: 60 });
  assert.equal(afterVsYearBefore(r, "2026-08", 3, "2026-10"), null); // November is not over
});

/* ── tickets ──────────────────────────────────────────────────────────── */

test("the cart value and the rating come out of the ticket subject", () => {
  assert.equal(cartValue("Abandoned Cart 13.563,18 €EUR | Firma | Max"), 13563.18);
  assert.equal(cartValue("Abandoned Cart 556,05 €EUR | x | y"), 556.05);
  assert.equal(cartValue("Abandoned Cart 1,239.98 EUR | x"), 1239.98);
  assert.equal(cartValue("Abandoned Cart 1'239.50 EUR | x"), 1239.5);
  assert.equal(cartValue("Abandoned Cart 4.669 €EUR | x"), 4669);
  assert.equal(cartValue("Direct ESO request | x"), null);
  assert.equal(ratingOf("Negative First Purchase Survey | Firma | Rating 3/10"), 3);
  assert.equal(ratingOf("BO | x"), null);
  assert.deepEqual(tally(["a", "b", "a", null, ""]), [{ label: "a", n: 2 }, { label: "Not filled in", n: 2 }, { label: "b", n: 1 }]);
});

/* ── emails ───────────────────────────────────────────────────────────── */

test("an email's name gives its UC, step, version and language", () => {
  assert.deepEqual(parseEmailName("DE_UC15_v2_Email_4_2607"), { uc: "15", step: "Email 4", version: "v2", lang: "DE" });
  assert.deepEqual(parseEmailName("DE_CH_UC10_Retention_2023_Email_2_Instructions_2404"), { uc: "10", step: "Email 2 Instructions", version: "v1", lang: "DE_CH" });
  assert.deepEqual(parseEmailName("IT_UC9_v2_Reactivation_2_2605"), { uc: "9", step: "Reactivation 2", version: "v2", lang: "IT" });
  assert.deepEqual(parseEmailName("FRANCE_UC2_v2_Discover_2504"), { uc: "2", step: "Discover", version: "v2", lang: "FRANCE" });
  assert.deepEqual(parseEmailName("DE_UC6_ThanksForYourPurchase_Email_2308"), { uc: "6", step: "Thanks For Your Purchase Email", version: "v1", lang: "DE" });
  assert.equal(parseEmailName("DE_New_Features_email_2609"), null);
  assert.equal(parseEmailName("SARCLA | SALES REDIRECTION TSA DE"), null);
  assert.equal(ucForEmailNumber("11"), "uc10");
  assert.equal(ucForEmailNumber("5"), null);
});

test("a contact's email history becomes its UC sends; the primary company is the contact's own", () => {
  const h = [
    { value: "DE_New_Features_email_2609", timestamp: "2026-09-20T08:00:00Z" },
    { value: "DE_UC15_v2_Email_2_2607", timestamp: "2026-08-10T08:00:00Z" },
    { value: "DE_UC15_v2_Email_1_2607", timestamp: "2026-07-20T08:00:00Z" },
    { value: "DE_UC5_WinBackCustomers_Email_2311", timestamp: "2023-11-02T08:00:00Z" },
  ];
  assert.deepEqual(sendsOf(h, "2025-01-01"), [{ name: "DE_UC15_v2_Email_1_2607", day: "2026-07-20" }, { name: "DE_UC15_v2_Email_2_2607", day: "2026-08-10" }]);
  assert.equal(companyOfContact("123456"), "123456");
  assert.equal(companyOfContact(123456), "123456");
  assert.equal(companyOfContact(""), null);
  assert.equal(companyOfContact(null), null);
  assert.equal(lastStepBefore([{ step: "Email 1", day: "2026-07-20" }, { step: "Email 2", day: "2026-08-10" }], "2026-08-01"), "Email 1");
  assert.equal(lastStepBefore([{ step: "Email 1", day: "2026-07-20" }], "2026-07-19"), null);
});

const EMAILS: EmailData = {
  generatedAt: "2026-10-13T06:00:00Z", horizon: "2025-01-01", contactsRead: 4,
  names: ["DE_UC15_v2_Email_1_2607", "FR_UC15_v2_Email_1_2607", "DE_UC15_v2_Email_4_2607", "DE_CH_UC10_Retention_2023_Email_1_Reorder_2404", "DE_UC11_Retention_2022_Email_1_Reorder_2405"],
  companies: ["c1", "c2"],
  sends: [[0, "2026-07-20", 0], [1, "2026-07-21", 1], [2, "2026-09-02", 0], [0, "2026-09-05", -1], [3, "2025-10-01", 1], [4, "2025-10-02", 1]],
  stats: null, statsError: null,
};

test("sends per email step: in the period, since January 2025, language versions folded, unseen steps named", () => {
  const v = emailView(EMAILS, ["15"], { from: "2026-07-01", to: "2026-07-31" }, ["Email 1", "Email 4", "Email 5"])!;
  assert.deepEqual(v.rows.map((r) => [r.step, r.variants, r.sendsWin, r.companiesWin, r.sendsAll, r.lastSent]), [
    ["Email 1", 2, 2, 2, 3, "2026-09-05"],
    ["Email 4", 1, 0, 0, 1, "2026-09-02"],
  ]);
  assert.deepEqual(v.unseen, ["Email 5"]);
  assert.equal(v.statsOn, false);
  const both = emailView(EMAILS, ["10", "11"], { from: "2025-01-01", to: "2026-10-13" })!;
  assert.deepEqual(both.rows.map((r) => r.step), ["UC10 · Email 1 Reorder", "UC11 · Email 1 Reorder"]);
  const withStats = emailView({ ...EMAILS, stats: { DE_UC15_v2_Email_1_2607: { sent: 10, open: 4, click: 1 }, FR_UC15_v2_Email_1_2607: { sent: 5, open: 1, click: 0 } } }, ["15"], { from: "2026-07-01", to: "2026-07-31" })!;
  assert.deepEqual(withStats.rows[0].stats, { sent: 15, open: 5, click: 1 });
  assert.equal(emailView(null, ["15"], { from: "2026-07-01", to: "2026-07-31" }), null);
  assert.deepEqual(stepsByCompany(EMAILS, ["15"]).get("c1"), [{ step: "Email 1", day: "2026-07-20" }, { step: "Email 4", day: "2026-09-02" }]);
});

/* ── the pages ────────────────────────────────────────────────────────── */

const co = (o: Partial<Co> & { id: string }): Co => ({ name: `Co ${o.id}`, stage: null, first: null, last: null, orders: null, ...o });
const tk = (o: Partial<Ticket> & { id: string; created: string }): Ticket => ({ closed: false, closedOn: null, stage: "New", team: "ESO", resolution: null, subject: "", workflow: "", companyId: null, ...o });
const data = (uc: UcData["uc"], o: Partial<UcData>): UcData => ({ uc, generatedAt: "", today: "2026-10-13", horizon: "2025-01-01", companies: [], tickets: [], tasks: [], lastTask: [], sources: [], ...o });
const SEPT = { from: "2026-09-01", to: "2026-09-30" };
const tile = (v: { tiles: { label: string; value: unknown }[] }, label: string) => v.tiles.find((t) => t.label === label)?.value;

test("UC2: new MQLs of the period, the 90-day first order, and customers already left out", () => {
  const d = data("uc2", {
    companies: [
      co({ id: "1", stage: STAGE.newCustomer, first: "2026-09-20", entries: [[STAGE.mql, "2026-09-05", "wf"], [STAGE.sql, "2026-09-10", "wf"], [STAGE.newCustomer, "2026-09-20", "wf"]] }),
      co({ id: "2", stage: STAGE.lostLead, entries: [[STAGE.mql, "2026-09-07", "wf"], [STAGE.lostLead, "2026-09-30", "wf"]] }),
      co({ id: "3", stage: STAGE.mql, first: "2020-01-01", entries: [[STAGE.mql, "2026-09-08", "wf"]] }), // a customer already
      co({ id: "4", stage: STAGE.mql, entries: [[STAGE.mql, "2026-08-01", "wf"]] }),                     // outside the period
    ],
    tickets: [tk({ id: "t1", created: "2026-09-06", companyId: "1", closed: true, resolution: "Qualified - Registered on their own" })],
  });
  const v = uc2View(d, null, SEPT);
  assert.equal(tile(v, "Became an MQL"), 2);
  assert.equal(tile(v, "Moved to SQL"), 1);
  assert.equal(tile(v, "First order within 90 days"), 1);
  assert.equal(tile(v, "Moved to Lost lead"), 1);
  assert.equal(v.list?.rows.length, 2);
  assert.equal(v.list?.rows[0].id, "2");
  assert.equal(v.list?.rows.find((r) => r.id === "1")?.ticket, "Qualified - Registered on their own");
  assert.ok(v.converted.includes("90 days"));
});

test("UC15: the July back-fill is shown apart, and buying is a real first order after entering", () => {
  const d = data("uc15", {
    companies: [
      co({ id: "c1", enrolled: "2026-07-03", first: "2026-08-01", rev: { "2026-08": 500 } }),
      co({ id: "c2", enrolled: "2026-07-03" }),
      co({ id: "3", enrolled: "2026-08-12", first: "2026-09-01", rev: { "2026-09": 200, "2026-07": 999 } }),
      co({ id: "4", enrolled: "2026-08-20", first: "2019-05-05" }), // bought long before: not converted
    ],
  });
  const v = uc15View(d, EMAILS, { from: "2026-07-01", to: "2026-08-31" });
  assert.equal(tile(v, "Entered the flow"), 2);
  assert.equal(tile(v, "Back-filled in July 2026"), 2);
  assert.equal(tile(v, "Bought for the first time since"), 1);
  assert.equal(tile(v, "Their revenue since"), 700);
  const bars = v.charts.find((c) => c.title === "Which email they bought after");
  assert.ok(bars && bars.kind === "bars");
  assert.deepEqual(bars.rows.map((r) => [r.label, r.value]), [["Email 1", 1], ["No flow email before the order", 1]]);
  assert.ok(v.findings.some((f) => f.startsWith("Email 2")));
});

test("UC9: the second order within 9 months, the curve counts only companies old enough", () => {
  const curve = secondOrderCurve([
    { first: "2026-01-10", second: "2026-02-01" },
    { first: "2026-01-10", second: null },
    { first: "2026-09-20", second: null }, // too young for month 1
  ], "2026-10-13", 2);
  assert.deepEqual(curve, [{ k: 1, base: 2, yes: 1, share: 0.5 }, { k: 2, base: 2, yes: 1, share: 0.5 }]);
  const d = data("uc9", {
    companies: [
      co({ id: "1", first: "2026-09-02", second: "2026-09-25", orders: 2, entries: [[STAGE.newCustomer, "2026-09-02", "wf"], [STAGE.grow, "2026-09-25", "wf"]] }),
      co({ id: "2", first: "2026-09-10", orders: 1, entries: [[STAGE.newCustomer, "2026-09-10", "wf"]] }),
    ],
  });
  const v = uc9View(d, null, SEPT);
  assert.equal(tile(v, "New customers"), 2);
  assert.equal(tile(v, "Second order within 9 months"), 1);
  assert.equal(tile(v, "Moved to Grow / Nurture"), 1);
  assert.equal(v.list?.rows[0].id, "2"); // no second order first
});

test("UC13: churn entries of the period and what followed; the inactivity rule is named", () => {
  const d = data("uc13", {
    companies: [
      co({ id: "1", rev: { "2026-09": 300, "2026-10": 100 }, entries: [[STAGE.churn, "2026-09-02", "wf"], [STAGE.reactivated, "2026-09-20", "wf"]] }),
      co({ id: "2", entries: [[STAGE.churn, "2026-09-03", "bulk"], [STAGE.notReactivated, "2026-10-01", "wf"]] }),
      co({ id: "3", entries: [[STAGE.churn, "2026-09-04", "wf"]] }),
    ],
    lastTask: [{ era: "Follow-up", day: "2026-04-27" }],
  });
  const v = uc13View(d, null, SEPT);
  assert.equal(tile(v, "Entered Churn / Reactivate"), 3);
  assert.equal(tile(v, "Reactivated"), 1);
  assert.equal(tile(v, "Not reactivated"), 1);
  assert.equal(tile(v, "Still open"), 1);
  assert.equal(tile(v, "Revenue since reactivation"), 400);
  assert.ok(v.findings.some((f) => f.includes("27 Apr 2026")));
  assert.ok(v.notes.some((n) => n.includes("6 months")));
});

test("UC10+11: overdue against the company's own rhythm, promotions and dormant tasks", () => {
  const d = data("uc10", {
    companies: [
      co({ id: "1", stage: STAGE.grow, orders: 5, last: "2026-01-01", avgDays: 60, entries: [[STAGE.grow, "2026-09-05", "wf"]] }),
      co({ id: "2", stage: STAGE.grow, orders: 3, last: "2026-10-01", avgDays: 60 }),
      co({ id: "3", stage: STAGE.loyalty, orders: 14, entries: [[STAGE.loyalty, "2026-09-15", "wf"]] }),
    ],
    lastTask: [{ era: "UC10", day: "2025-11-18" }, { era: "UC11", day: "2025-11-17" }],
  });
  const v = uc10View(d, null, SEPT);
  assert.equal(tile(v, "Past their usual reorder"), 1);
  assert.equal(tile(v, "Promoted to Loyalty / Retain"), 1);
  assert.equal(tile(v, "Entered Grow / Nurture"), 1);
  assert.ok(v.findings.some((f) => f.includes("18 Nov 2025")));
});

test("UC4: web orders within 30 days of the cart and of the ticket, and value recovered", () => {
  assert.equal(firstOnOrAfter(["2026-08-01", "2026-09-10"], "2026-09-02"), "2026-09-10");
  const d = data("uc4", {
    carts: [["2026-09-01", "c1"], ["2026-09-05", "c1"], ["2026-09-02", "c2"], ["2026-09-03", null]],
    webOrders: { c1: ["2026-09-10"], c2: ["2026-11-01"] },
    companies: [co({ id: "c1" })],
    tickets: [tk({ id: "t1", created: "2026-09-02", companyId: "c1", closed: true, resolution: "Ordered", subject: "Abandoned Cart 1.000,00 €EUR | x" })],
  });
  const v = uc4View(d, null, SEPT);
  assert.equal(tile(v, "Companies with an abandoned cart"), 2);
  assert.equal(tile(v, "Ordered on the web within 30 days"), 1);
  assert.equal(tile(v, "Value recovered"), 1000);
  assert.equal(tile(v, "Web order within 30 days of the ticket"), 1);
  assert.equal(v.list?.rows[0].web, "2026-09-10");
});

test("UC6 and UC12: poor ratings followed to the next order; revenue after a flag against a year before", () => {
  const v6 = uc6View(data("uc6", {
    firstDays: ["2026-09-03", "2026-09-04", "2026-08-01"],
    companies: [co({ id: "c1", last: "2026-10-01", orders: 2 })],
    tickets: [tk({ id: "t1", created: "2026-09-10", companyId: "c1", subject: "Negative First Purchase Survey | x | Rating 4/10" })],
  }), EMAILS, SEPT);
  assert.equal(tile(v6, "First purchasers"), 2);
  assert.equal(tile(v6, "Ordered again after the ticket"), 1);
  assert.equal(tile(v6, "Average rating on them"), "4.0 / 10");
  assert.ok(v6.findings.some((f) => f.includes("v2 thank-you")));

  const v12 = uc12View(data("uc12", {
    tasks: [{ id: "k1", created: "2026-05-10", done: true, workflow: "UC12_v2_Revenue Drop_High_Value", companyId: "c1" }],
    companies: [co({ id: "c1", rev: { "2026-06": 100, "2026-07": 100, "2026-08": 100, "2025-06": 100, "2025-07": 100, "2025-08": 200 } })],
    erosion: ["c1"],
  }), null, { from: "2026-05-01", to: "2026-05-31" });
  assert.equal(tile(v12, "Revenue held"), 0);
  assert.equal(tile(v12, "3 months after the flag"), 300);
  assert.equal(tile(v12, "Also an erosion ticket"), 1);
  assert.equal(v12.list?.rows[0].change, "−25%");
});

test("the overview counts stage changes by who made them and marks February 2026", () => {
  const d: OverviewData = {
    generatedAt: "", today: "2026-10-13", horizon: "2025-01-01",
    now: [{ stage: STAGE.mql, n: 10 }, { stage: STAGE.newCustomer, n: 5 }], noStage: 3, total: 18,
    entries: [
      { day: "2026-01-10", stage: STAGE.mql, src: "wf", n: 4 },
      { day: "2026-02-03", stage: STAGE.churn, src: "wf", n: 40 },
      { day: "2026-03-10", stage: STAGE.mql, src: "wf", n: 6 },
      { day: "2026-09-10", stage: STAGE.mql, src: "bulk", n: 2 },
    ],
    lastTask: [{ era: "UC10", day: "2025-11-18" }, { era: "UC13", day: "2026-04-27" }], sources: [],
  };
  const v = overviewView(d, EMAILS, SEPT);
  assert.equal(tile(v, "Stage changes in the period"), 2);
  assert.equal(tile(v, "Customers"), 5);
  const stack = v.charts.find((c) => c.kind === "stack");
  assert.ok(stack && stack.kind === "stack" && stack.footnote?.includes("February 2026"));
  assert.ok(stack.rows.some((r) => r.x === "Feb 26 *" && r.wf === 40));
  assert.ok(v.findings.some((f) => f.includes("18 Nov 2025")));
  assert.ok(v.findings.some((f) => f.includes("27 Apr 2026")));
  assert.ok(v.findings.some((f) => f === "UC15: Email 5 has never been sent."));
  assert.ok(v.findings.some((f) => f.startsWith("February 2026: 40 stage changes")));
});

test("the config names every page once, with a plain line and a definition of converted", () => {
  assert.deepEqual(VIEW_KEYS, ["overview", "uc2", "uc15", "uc6", "uc9", "uc10", "uc13", "uc4", "uc12"]);
  assert.equal(isViewKey("uc15"), true);
  assert.equal(isViewKey("uc99"), false);
  for (const u of UCS) {
    assert.ok(u.does.length > 20 && u.converted.startsWith("Converted = "), u.key);
    assert.ok(u.href.startsWith("/uc/lifecycle/"), u.key);
  }
  assert.equal(new Set(UCS.map((u) => u.href)).size, UCS.length);
});


/* ── UC2: who qualified ───────────────────────────────────────────────── */

test("the qualification field's values map to the ticket's three Qualified answers and No", () => {
  assert.equal(qualKind("Yes"), "own");
  assert.equal(qualKind("Yes – registered with ESO-Support"), "support");
  assert.equal(qualKind("Yes - registered by ESO"), "byEso");
  assert.equal(qualKind("No"), "no");
  assert.equal(qualKind(""), null);
  assert.equal(qualKind(null), null);
});

test("who qualified = the user who last set today's value; a merge names no one", () => {
  // newest first is not guaranteed - sorted by time
  const h = [
    { value: "Yes", timestamp: "2026-05-02T10:00:00Z", sourceType: "MERGE_OBJECTS" },
    { value: "Yes", timestamp: "2026-04-01T09:00:00Z", sourceType: "CRM_UI", updatedByUserId: 777 },
    { value: "No", timestamp: "2026-03-01T09:00:00Z", sourceType: "CRM_UI", updatedByUserId: 555 },
  ];
  assert.deepEqual(qualOf(h), { v: "Yes", by: "777", day: "2026-04-01" });
  assert.deepEqual(qualOf([{ value: "No", timestamp: "2026-03-01T09:00:00Z", sourceType: "MERGE_OBJECTS" }]), { v: "No", by: null, day: "2026-03-01" });
  // cleared: no decision
  assert.equal(qualOf([{ value: "", timestamp: "2026-06-01T09:00:00Z" }, { value: "Yes", timestamp: "2026-05-01T09:00:00Z", updatedByUserId: 1 }]), null);
  assert.equal(qualOf([]), null);
});

test("the who-qualified table counts each person's decisions; the undecided go to the company owner", () => {
  const co = (id: string, qual: Co["qual"], owner: string | null): Co => ({ id, name: id, stage: null, first: null, last: null, orders: null, qual, owner });
  const t = whoQualified([
    co("1", { v: "Yes", by: "10", day: "2026-04-01" }, "o1"),
    co("2", { v: "Yes – registered with ESO-Support", by: "10", day: "2026-04-01" }, "o1"),
    co("3", { v: "No", by: "10", day: "2026-04-01" }, "o2"),
    co("4", { v: "Yes - registered by ESO", by: null, day: "2026-04-01" }, "o2"), // set by a merge: the owner
    co("5", null, "o2"),
    co("6", null, null),
  ], { "u:10": "Ana", "o:o2": "Ben" });
  assert.equal(t.kind, "table");
  if (t.kind !== "table") return;
  const row = (p: string) => t.rows.find((r) => r.person === p);
  assert.deepEqual(row("Ana"), { person: "Ana", own: 1, support: 1, byEso: 0, yes: 2, no: 1, open: 0, total: 3 });
  assert.deepEqual(row("Ben"), { person: "Ben", own: 0, support: 0, byEso: 1, yes: 1, no: 0, open: 1, total: 2 });
  assert.deepEqual(row("No owner"), { person: "No owner", own: 0, support: 0, byEso: 0, yes: 0, no: 0, open: 1, total: 1 });
  assert.equal(t.rows[0].person, "Ana"); // most decisions first
});
