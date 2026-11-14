import assert from "node:assert/strict";
import { test } from "node:test";
import { asCross, crossClosed, crossHiddenApi, crossUserMaySend, homeFor, mfaRequired, planClosedTo } from "../src/lib/auth/access";
import { accessAt, levelsOf } from "../src/lib/auth/tree";
import { SealingSheet, buOf, isSealingHeader, keyMonths, materialOf, monthOf, monthsBetween, monthsSpan, noCompound, periodWords, priorities, rateMonths, sealingPeriod, sealingPresets, sumBy, sumMonths, tileSeries, topShare, yearBefore, type CompoundCustomer } from "../src/lib/apHub/sealingRules";
import { APPROVAL_ACTIONS, approvalKind, approvalKinds, approvalRefs, familyActions, familyFigures, isDetailKind, lowMarginLead, reviewActions, type Priority } from "../src/lib/apHub/sealingRules";
import { SEALING_DEFINITIONS, actionsCaption, leadingRefs, matchesQuery, rankBy } from "../src/lib/apHub/sealingRules";
import { MATERIAL_RULES, PER_DATA_SHEET, approvalLabel, approvalParts, cleanName, shortName } from "../src/lib/apHub/sealingRules";
import { APPROVAL_KINDS, APPROVAL_ROWS, NO_UNIT, approvalGroups, carriesApproval, meaningRows, namesApproval, refTexts, refersToDataSheet, tinyNoUnit } from "../src/lib/apHub/sealingRules";
import { twoLineLabel } from "../src/app/charts/format";
import { cacheKey, sealingCacheClear, sealingCacheSize, sealingCached, stableKey } from "../src/lib/apHub/sealingCache";
import {
  LIST_PAGE, NO_COMPOUND_NAME, PRIORITY_STATUSES, STATUS_NAME, approvalCandidates, canMove, candidateKey, commercialCandidates, compoundsKept, familyCandidates, isPriorityStatus,
  listAskOf, nextStatuses, openCards, overviewCandidates, pagesOf, priorityKeyOf, reviewCandidates,
} from "../src/lib/apHub/sealingRules";
import { SEALING_PAGES } from "../src/lib/apHub/sealingPages";
import { inviteContent, whatTheySee } from "../src/lib/auth/inviteMailRules";

test("cross access: the action plan is closed to a cross-user of Angst+Pfister, its page and its data - never to a cross-admin", () => {
  // a cross-admin is an admin of APSOparts too (SARCLA 11.11.2026: "cross admins are also admins in APSO, they should see everything")
  assert.equal(planClosedTo("user"), true);
  assert.equal(planClosedTo("admin"), false);
  assert.equal(planClosedTo(null), false);
  assert.equal(planClosedTo(undefined), false);
  for (const p of ["/action-plan", "/action-plan/kpis", "/action-plan/scroll-to-sale?x=1", "/api/action-plan", "/api/action-plan/summit"]) {
    assert.equal(crossClosed(p), true, p);
  }
  for (const p of ["/action-planner", "/reporting/actions", "/api/reporting/kpi-actions/tasks", "/ap", "/"]) {
    assert.equal(crossClosed(p), false, p);
  }
});

test("invitation mail: the way in, never a password or a link that signs in", () => {
  const c = inviteContent(
    { fullName: "Anna Muster", email: "anna.muster@angst-pfister.com", signInWith: "anna.muster@angst-pfister.com", role: "user", cross: "user" },
    { fullName: "Kim Admin", email: "kim.admin@apsoparts.com" },
  );
  assert.equal(c.subject, "Your access to the Angst+Pfister hub");
  assert.match(c.intro, /^Hello Anna, Kim Admin has opened the Angst\+Pfister hub to you\./);
  const rows = Object.fromEntries(c.rows);
  assert.equal(rows["Sign in with"], "anna.muster@angst-pfister.com");
  assert.equal(rows["You will see"], "The Angst+Pfister hub, and the APSOparts hub to look at.");
  assert.ok(rows["Second factor"], "a cross-user always carries a second factor");
  assert.ok(!JSON.stringify(c).match(/password:|\/invite\//i), "no password, no invitation token");
  // a user of the APSOparts hub alone: no second factor asked, the APSOhub named
  const u = inviteContent({ fullName: "Bo", email: "b@x.ch", signInWith: "b@x.ch", role: "user", cross: null }, { fullName: "Admin", email: null });
  assert.equal(u.subject, "Your access to the APSOhub");
  assert.ok(!Object.fromEntries(u.rows)["Second factor"]);
  assert.equal(u.footer, "Admin added you to the hub.");
  assert.equal(whatTheySee("admin", "admin"), "The Angst+Pfister hub and the APSOparts hub, as an admin of both.");
});

test("cross access: the mark as stored", () => {
  assert.equal(asCross("user"), "user");
  assert.equal(asCross("admin"), "admin");
  assert.equal(asCross(null), null);
  assert.equal(asCross("viewer"), null);
  assert.equal(homeFor("user"), "/ap");
  assert.equal(homeFor("admin"), "/ap");
  assert.equal(homeFor(null), "/");
});

test("cross access: a second factor, always", () => {
  // a user who only views goes without - unless they are a person of Angst+Pfister
  assert.equal(mfaRequired("user", false, false), false);
  assert.equal(mfaRequired("user", asCross("user") !== null, false), true);
});

test("cross access: a cross-user sends nothing but reads and their own account", () => {
  assert.equal(crossUserMaySend("GET", "/api/uc/map-assignment"), true);
  assert.equal(crossUserMaySend("POST", "/api/uc/map-assignment"), false);
  assert.equal(crossUserMaySend("PATCH", "/api/admin/users/3"), false);
  assert.equal(crossUserMaySend("DELETE", "/api/content/projects/1"), false);
  // but Pricing, theirs in full (SARCLA 14.11.2026) - its data and their saved filters
  assert.equal(crossUserMaySend("POST", "/api/pricing/api/matches/approve-group"), true);
  assert.equal(crossUserMaySend("PUT", "/api/pricing/prefs"), true);
  assert.equal(crossUserMaySend("POST", "/api/pricingx"), false);
  assert.equal(crossUserMaySend("POST", "/uc/some-page"), false); // a server action on a page
  assert.equal(crossUserMaySend("POST", "/api/me/prefs"), true);
  assert.equal(crossUserMaySend("POST", "/api/auth/logout"), true);
  assert.equal(crossUserMaySend("POST", "/api/reporting/customer-kpis"), true);
  assert.equal(crossUserMaySend("POST", "/api/reporting/customer-kpis/companies"), true);
  assert.equal(crossUserMaySend("POST", "/api/reporting/customer-kpis-other"), false);
  assert.equal(crossUserMaySend("POST", "/api/meeting"), false); // "/api/me/" is a folder, not a prefix of every word
});

test("cross access: the hidden reports' data by address", () => {
  for (const p of ["/api/reporting/eso-figures", "/api/reporting/tsa-calls", "/api/reporting/back-office", "/api/reporting/marketing-kpis/customers", "/api/reporting/my-sales", "/api/reporting/my-sales/order-book", "/api/reporting/sales-leader", "/api/reporting/sales-activity"]) {
    assert.equal(crossHiddenApi(p), true, p);
  }
  for (const p of ["/api/reporting/otd", "/api/reporting/customer-kpis", "/api/reporting/satisfaction", "/api/uc/lifecycle"]) {
    assert.equal(crossHiddenApi(p), false, p);
  }
});

test("cross access: a cross-user views everything else, edits nothing - but Pricing", () => {
  const lv = levelsOf("user", { datatracker: "write", uc: "write" }, "user");
  // Pricing is theirs in full (SARCLA 14.11.2026: "full access to pricing hub goes to AP member" - access.ts CROSS_FULL_APPS)
  assert.ok(Object.entries(lv).every(([k, l]) => l !== "write" || k === "pricing" || k.startsWith("pricing:") || k.startsWith("pricing#")), "nothing at Edit but Pricing");
  assert.equal(lv["pricing"], "write");
  assert.equal(lv["datatracker"], "read");
  assert.equal(lv["website"], "read"); // never granted, still viewed
  for (const slug of ["marketing", "tsa", "eso", "back-office", "sales-leader", "my-sales"]) {
    const k = `reporting:/reporting/${slug}`;
    if (k in lv) assert.equal(lv[k], "none", k);
  }
  // a page beneath a hidden category is hidden too, whatever a grant says
  const granted = levelsOf("user", { "reporting:/reporting/eso": "write" }, "user");
  if ("reporting:/reporting/eso" in granted) assert.equal(granted["reporting:/reporting/eso"], "none");
  assert.equal(accessAt("/reporting/eso", lv).level, "none");
  // an explicit No access is kept
  const taken = levelsOf("user", { website: "none" }, "user");
  assert.equal(taken["website"], "none");
  // a cross-admin is an admin
  const admin = levelsOf("admin", {}, "admin");
  assert.ok(Object.values(admin).every((l) => l === "write"));
  // nobody else changes
  assert.deepEqual(levelsOf("user", { datatracker: "read" }), levelsOf("user", { datatracker: "read" }, null));
});

test("sealing: the header and the rows", () => {
  const head = ["[Month]", "[CompanySt]", "[Channel]", "[CustomerNumberUnique]", "[CustomerName]", "[Article]", "[ArticleText]", "[CompoundDesignationAP]", "[Approval]", "[NetRevenueEUR]", "[GrossProfitEUR]"];
  assert.equal(isSealingHeader(head), true);
  assert.equal(isSealingHeader(["Article", "GWStdPCHF"]), false);
  const s = new SealingSheet();
  s.feed(1, ["a title row"]);
  s.feed(2, head);
  s.feed(3, ["2026-03", "APCH", "OEM", "1-324158", "Sonceboz Motion Boncourt SA", "8000657339", "Radial-shaft seal", "HNBR 80.45-02", "", 1000, 250]);
  s.feed(4, ["2026-03", "APDE", "OEM", "20-120385", "AVS Römer", "x", "y", "FKM 75.16-04", "FDA", 0, 0]); // nothing to count
  s.feed(5, ["", "APDE", "OEM", "20-120385", "AVS Römer", "x", "y", "FKM 75.16-04", "FDA", 10, 5]); // no month
  const got = s.finish();
  assert.ok(got);
  assert.equal(got.rows.length, 1);
  assert.equal(got.skipped, 2);
  assert.deepEqual({ ...got.rows[0] }, {
    month: "2026-03", bu: "APCH", channel: "OEM", customer: "1-324158", customerName: "Sonceboz Motion Boncourt SA",
    article: "8000657339", articleText: "Radial-shaft seal", compound: "HNBR 80.45-02", approval: "", rev: 1000, gp: 250,
  });
  // the cube's own measure names are understood too
  assert.equal(isSealingHeader(["CompanySt", "CompoundDesignationAP", "I_NET_REV_EUR"]), true);
  // the company NUMBER, as the query gives it, becomes the business unit
  const q = new SealingSheet();
  q.feed(1, ["[Month]", "[Company]", "[Channel]", "[CustomerNumberUnique]", "[CustomerName]", "[Article]", "[ArticleText]", "[CompoundDesignationAP]", "[Approval]", "[NetRevenueEUR]", "[GrossProfitEUR]"]);
  q.feed(2, ["2026-01", 20, "OEM", "20-120385", "AVS Römer", "x", "y", "FKM 75.16-04", "FDA", 10, 5]);
  q.feed(3, ["2026-01", "1", "OEM", "1-1", "A", "x", "y", "FKM 75.16-04", "", 10, 5]);
  q.feed(4, ["2026-01", "999", "OEM", "9-1", "B", "x", "y", "FKM 75.16-04", "", 10, 5]);
  assert.deepEqual(q.finish()!.rows.map((r) => r.bu), ["APDE", "APCH", "M999"]);
  assert.equal(buOf("APFR"), "APFR");
});

test("sealing: months in every shape the query may give", () => {
  assert.equal(monthOf("2026-03"), "2026-03");
  assert.equal(monthOf("2026/P09"), "2026-09");
  assert.equal(monthOf("202611"), "2026-11");
  assert.equal(monthOf("03.2026"), "2026-03");
  assert.equal(monthOf(new Date(Date.UTC(2026, 4, 1))), "2026-05");
  assert.equal(monthOf(46082), "2026-03"); // an Excel day number: 01.03.2026
  assert.equal(monthOf("Total"), "");
});

test("sealing: the pilot's material families", () => {
  assert.equal(materialOf("Kalrez® 6375"), "FFKM");
  assert.equal(materialOf("FKM 75.16-04"), "FKM");
  assert.equal(materialOf("HNBR 80.45-02"), "HNBR");
  assert.equal(materialOf("DW EPDM 70.503-00"), "EPDM");
  assert.equal(materialOf("PERTEC® UP VMQ 70.501-01"), "VMQ");
  assert.equal(materialOf("NBR 70.10-02"), "NBR");
  assert.equal(materialOf("something else"), "Unclassified");
  assert.equal(noCompound("No info"), true);
  assert.equal(noCompound("Drawing : 123"), true);
  assert.equal(noCompound("FKM 75.16-04"), false);
});

test("sealing: margins of the sums, never an average of margins", () => {
  const f = sumBy([{ k: "a", rev: 100, gp: 50 }, { k: "a", rev: 900, gp: 90 }], (r) => r.k);
  assert.equal(f.length, 1);
  assert.equal(f[0].rev, 1000);
  assert.equal(f[0].margin, 0.14);
});

test("sealing: the three priorities from the figures", () => {
  const compounds = [
    { key: "DW EPDM 70.503-00", name: "DW EPDM 70.503-00", rev: 3_030_000, gp: 3_030_000 * 0.565, margin: 0.565 },
    { key: "FKM 75.16-04", name: "FKM 75.16-04", rev: 2_730_000, gp: 2_730_000 * 0.629, margin: 0.629 },
    { key: "No info", name: "No info", rev: 9_000_000, gp: 900_000, margin: 0.1 },
  ];
  const pairs: CompoundCustomer[] = [
    { compound: "DW EPDM 70.503-00", customer: "1", customerName: "Elfo", rev: 122_900, gp: 122_900 * 0.24 },
    { compound: "FKM 75.16-04", customer: "2", customerName: "Huba", rev: 200_000, gp: 200_000 * 0.711 },
    { compound: "FKM 75.16-04", customer: "3", customerName: "Hilti", rev: 150_000, gp: 150_000 * 0.257 },
    { compound: "No info", customer: "4", customerName: "Big", rev: 5_000_000, gp: 0 },
  ];
  const p = priorities(compounds, pairs);
  const margin = p.find((x) => x.kind === "margin");
  assert.ok(margin);
  // Hilti's FKM gap (62.9 - 25.7) x 150k outweighs Elfo's EPDM gap (56.5 - 24.0) x 122.9k
  assert.equal(margin.title, "Review Hilti's FKM 75.16-04 economics");
  const growth = p.find((x) => x.kind === "growth");
  assert.equal(growth?.compound, "FKM 75.16-04");
  assert.ok(Math.abs((growth?.effect ?? 0) - 2_730_000 * 0.1 * 0.629) < 1);
  const spread = p.find((x) => x.kind === "spread");
  assert.equal(spread?.compound, "FKM 75.16-04");
  assert.match(spread?.evidence ?? "", /Huba reports 71\.1% GM and Hilti 25\.7%/);
  // an unnamed compound is never a priority
  assert.ok(p.every((x) => x.compound !== "No info"));
  // each names the pilot's suggested owner
  assert.equal(margin.owner, "Account manager + product manager");
  assert.equal(growth?.owner, "Sales leads + product manager");
  assert.equal(spread?.owner, "Account managers + controlling");
});

test("sealing: the months a page shows, within those the figures hold", () => {
  const held = { first: "2025-03", last: "2026-10" };
  // none asked: the year so far, up to the last month held
  assert.deepEqual(sealingPeriod({}, held, "2026-11"), { from: "2026-01", to: "2026-10" });
  // a past year: as asked
  assert.deepEqual(sealingPeriod({ from: "2025-04", to: "2025-12" }, held, "2026-11"), { from: "2025-04", to: "2025-12" });
  // before the first month or after the last: kept within
  assert.deepEqual(sealingPeriod({ from: "2025-01", to: "2025-12" }, held, "2026-11"), { from: "2025-03", to: "2025-12" });
  assert.deepEqual(sealingPeriod({ from: "2026-05", to: "2026-12" }, held, "2026-11"), { from: "2026-05", to: "2026-10" });
  // the last 12 months across two years
  assert.deepEqual(sealingPeriod({ from: "2025-11", to: "2026-10" }, held, "2026-11"), { from: "2025-11", to: "2026-10" });
  // nonsense or the wrong way round: the year so far of the month asked last
  assert.deepEqual(sealingPeriod({ from: "2026-13", to: "x" }, held, "2026-11"), { from: "2026-01", to: "2026-10" });
  assert.deepEqual(sealingPeriod({ from: "2026-06", to: "2026-02" }, held, "2026-11"), { from: "2026-01", to: "2026-02" });
  // the figures' first year: from their first month
  assert.deepEqual(sealingPeriod({ to: "2025-08" }, held, "2026-11"), { from: "2025-03", to: "2025-08" });
  // no figures yet: up to this month
  assert.deepEqual(sealingPeriod({}, { first: null, last: null }, "2026-11"), { from: "2026-01", to: "2026-11" });
});

test("sealing: the months between, a year before, the period in words", () => {
  assert.deepEqual(monthsBetween("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(monthsBetween("2026-03", "2026-03"), ["2026-03"]);
  assert.deepEqual(monthsBetween("2026-04", "2026-03"), []);
  assert.equal(yearBefore("2026-01"), "2025-01");
  assert.equal(periodWords("2026-01", "2026-10"), "Jan – Oct 2026");
  assert.equal(periodWords("2026-10", "2026-10"), "Oct 2026");
  assert.equal(periodWords("2025-11", "2026-10"), "Nov 2025 – Oct 2026");
});

test("sealing: the pages the side panel lists - the pilot's views in its order and names, then the hub's own", () => {
  assert.deepEqual(SEALING_PAGES.map((p) => p.href), [
    "/ap/reporting/sealing", "/ap/reporting/sealing/customers", "/ap/reporting/sealing/articles",
    "/ap/reporting/sealing/materials", "/ap/reporting/sealing/approvals", "/ap/reporting/sealing/units",
  ]);
  assert.deepEqual(SEALING_PAGES.map((p) => p.name), ["Overview", "Customers", "Articles", "Materials & compounds", "Approval information", "Business units"]);
  assert.equal(new Set(SEALING_PAGES.map((p) => p.slug)).size, SEALING_PAGES.length);
});

test("sealing: each key's months with the same month a year earlier", () => {
  const period = ["2026-01", "2026-02"];
  const now = [{ key: "APCH", month: "2026-01", rev: 100, gp: 40 }, { key: "APCH", month: "2026-01", rev: 50, gp: 10 }, { key: "APDE", month: "2026-02", rev: 70, gp: 20 }];
  const before = [{ key: "APCH", month: "2025-01", rev: 80, gp: 30 }, { key: "APFR", month: "2025-02", rev: 9, gp: 1 }];
  const km = keyMonths(period, now, before, "2025-01");
  // every key that sold in either period, every month of the period
  assert.equal(km.length, 6);
  assert.deepEqual(km.find((x) => x.key === "APCH" && x.month === "2026-01"), { key: "APCH", month: "2026-01", rev: 150, gp: 50, prevRev: 80, prevGp: 30 });
  // a month without a sale is a zero, a year earlier too when it is in the figures
  assert.deepEqual(km.find((x) => x.key === "APCH" && x.month === "2026-02"), { key: "APCH", month: "2026-02", rev: 0, gp: 0, prevRev: 0, prevGp: 0 });
  assert.equal(km.find((x) => x.key === "APFR" && x.month === "2026-02")?.prevRev, 9);
  // before the figures' first month: not known, never a zero
  const late = keyMonths(period, now, before, "2025-02");
  assert.equal(late.find((x) => x.key === "APCH" && x.month === "2026-01")?.prevRev, null);
  assert.equal(late.find((x) => x.key === "APDE" && x.month === "2026-02")?.prevRev, 0);
});

test("sealing: a figure against the same months a year earlier, like for like", () => {
  // all known
  assert.deepEqual(sumMonths([{ month: "2026-01", cur: 10, prev: 8 }, { month: "2026-02", cur: 5, prev: 4 }]), { cur: 15, prev: 12, same: null, sameMonths: [] });
  // none known: no comparison
  assert.deepEqual(sumMonths([{ month: "2026-01", cur: 10, prev: null }]), { cur: 10, prev: null, same: null, sameMonths: [] });
  // some known: both sides on those months alone
  assert.deepEqual(sumMonths([{ month: "2025-12", cur: 7, prev: null }, { month: "2026-01", cur: 10, prev: 8 }, { month: "2026-02", cur: 5, prev: 4 }]),
    { cur: 22, prev: 12, same: 15, sameMonths: ["2026-01", "2026-02"] });
  // a rate is the rate of the sums - never an average of the months' rates
  const gp = [{ month: "2026-01", cur: 50, prev: 30 }, { month: "2026-02", cur: 90, prev: 10 }];
  const rev = [{ month: "2026-01", cur: 100, prev: 60 }, { month: "2026-02", cur: 900, prev: 40 }];
  const r = rateMonths(gp, rev);
  assert.equal(r.cur, 0.14);
  assert.equal(r.prev, 0.4);
  assert.equal(r.same, null);
  // like for like: the months a year earlier that are known, on both sides
  const p = rateMonths([{ month: "2025-12", cur: 10, prev: null }, ...gp], [{ month: "2025-12", cur: 100, prev: null }, ...rev]);
  assert.equal(p.cur, 150 / 1100);
  assert.equal(p.same, 0.14);
  assert.equal(p.prev, 0.4);
  assert.deepEqual(p.sameMonths, ["2026-01", "2026-02"]);
  assert.equal(rateMonths([{ month: "2026-01", cur: 5, prev: null }], [{ month: "2026-01", cur: 0, prev: null }]).cur, null);
});

test("sealing: a tile's months - twelve in one calendar year, the period's own over a year end", () => {
  const ytd = tileSeries([{ month: "2026-01", cur: 1, prev: 2 }, { month: "2026-02", cur: 3, prev: null }]);
  assert.equal(ytd.labels, null);
  assert.equal(ytd.months.length, 12);
  assert.deepEqual(ytd.months.slice(0, 3), [1, 3, null]);
  assert.deepEqual(ytd.py.slice(0, 3), [2, null, null]);
  // a quarter: its months in their places, the others empty
  const q2 = tileSeries([{ month: "2026-04", cur: 4, prev: 1 }, { month: "2026-05", cur: 5, prev: 1 }, { month: "2026-06", cur: 6, prev: 1 }]);
  assert.deepEqual(q2.months, [null, null, null, 4, 5, 6, null, null, null, null, null, null]);
  const over = tileSeries([{ month: "2025-11", cur: 1, prev: null }, { month: "2025-12", cur: 2, prev: null }, { month: "2026-01", cur: 3, prev: 1 }]);
  assert.deepEqual(over.labels, ["Nov 25", "Dec 25", "Jan 26"]);
  assert.deepEqual(over.months, [1, 2, 3]);
  assert.deepEqual(over.py, [null, null, 1]);
});

test("sealing: the share of the largest, the months named, the ready-made periods", () => {
  assert.equal(topShare([{ rev: 10 }, { rev: 50 }, { rev: 40 }], 2, 200), 0.45);
  assert.equal(topShare([{ rev: 10 }], 10, 0), null);
  assert.equal(monthsSpan(["2026-03", "2026-04", "2026-10"]), "Mar–Oct");
  assert.equal(monthsSpan(["2026-10"]), "Oct");
  assert.equal(monthsSpan(["2025-11", "2026-10"]), "Nov 25–Oct 26");
  assert.equal(monthsSpan([]), "");
  const ps = sealingPresets("2025-03", "2026-10");
  const by = Object.fromEntries(ps.map((p) => [p.id, p]));
  assert.deepEqual(ps.map((p) => p.id), ["ytd", "lm", "12m", "ly", "q1", "q2", "q3"]);
  assert.deepEqual([by.ytd.from, by.ytd.to, by.ytd.label], ["2026-01", "2026-10", "Year to date"]);
  assert.deepEqual([by.lm.from, by.lm.to, by.lm.label], ["2026-10", "2026-10", "October 2026"]);
  assert.deepEqual([by["12m"].from, by["12m"].to], ["2025-11", "2026-10"]);
  // last year from the figures' first month
  assert.deepEqual([by.ly.from, by.ly.to, by.ly.label], ["2025-03", "2025-12", "Last year (2025)"]);
  assert.deepEqual([by.q3.from, by.q3.to, by.q3.label], ["2026-07", "2026-09", "Q3 2026"]);
  // the figures' first year: no last year, the year to date from the first month
  const first = sealingPresets("2026-02", "2026-05");
  assert.deepEqual(first.map((p) => p.id), ["ytd", "lm", "12m", "q1"]);
  assert.equal(first[0].from, "2026-02");
  assert.equal(first.find((p) => p.id === "q1")?.from, "2026-02");
  assert.deepEqual(sealingPresets("x", "2026-05"), []);
});

test("sealing: the pilot's approval categories, every one in its order, and its references - which overlap", () => {
  assert.equal(approvalKind(""), "none");
  assert.equal(approvalKind("(blank)"), "none");
  assert.equal(approvalKind("FDA 21 CFR 177.2600"), "explicit");
  assert.equal(approvalKind("KTW / W270 / WRAS"), "explicit");
  assert.equal(approvalKind("See technical datasheet"), "datasheet");
  assert.equal(approvalKind("Datenblatt beachten"), "datasheet");
  assert.equal(approvalKind("Customer drawing rev. B"), "other");
  const texts = [
    { name: "", rev: 800, gp: 300 },
    { name: "FDA, WRAS", rev: 100, gp: 50 },
    { name: "NSF 61", rev: 60, gp: 20 },
    { name: "TDS attached", rev: 30, gp: 10 },
    { name: "Customer spec", rev: 10, gp: 5 },
  ];
  const kinds = approvalKinds(texts);
  assert.deepEqual(kinds.map((k) => k.key), ["none", "datasheet", "explicit", "other"]);
  assert.deepEqual(kinds.map((k) => k.rev), [800, 30, 160, 10]);
  // the categories part the whole: they add up to it
  assert.equal(kinds.reduce((a, k) => a + k.rev, 0), 1000);
  assert.equal(kinds[2].margin, 70 / 160);
  const refs = approvalRefs(texts);
  assert.equal(refs.length, 8);
  assert.deepEqual(refs.slice(0, 3).map((r) => [r.name, r.rev]), [["FDA", 100], ["WRAS", 100], ["NSF", 60]]);
  // a text naming two counts in both - the references never add up to the explicit texts
  assert.ok(refs.reduce((a, r) => a + r.rev, 0) > kinds[2].rev);
  // no approval written is no reference, whatever its row says
  assert.equal(approvalRefs([{ name: "-", rev: 5, gp: 1 }]).every((r) => r.rev === 0), true);
});

test("sealing: the pilot's material cards - the named compounds of each family, how many, their share", () => {
  const fams = familyFigures([
    { key: "Kalrez 6375", name: "Kalrez® 6375", rev: 400, gp: 130, margin: 0.325 },
    { key: "FKM 75.16-04", name: "FKM 75.16-04", rev: 300, gp: 189, margin: 0.63 },
    { key: "FKM 75.00-01", name: "FKM 75.00-01", rev: 200, gp: 120, margin: 0.6 },
    { key: "No info", name: "No info", rev: 5000, gp: 0, margin: 0 },
  ]);
  assert.deepEqual(fams.map((x) => [x.key, x.count]), [["FKM", 2], ["FFKM", 1]]);
  assert.equal(fams[0].rev, 500);
  assert.equal(fams[0].margin, 309 / 500);
  assert.equal(fams[0].share, 500 / 900);
  assert.equal(fams[1].share, 400 / 900);
  assert.deepEqual(familyFigures([]), []);
});

test("sealing: the customers' and articles' review cards - the low-margin position, the concentration, the comparison", () => {
  const rows = [
    { name: "Big AG", rev: 1_000_000, margin: 0.35 },
    { name: "Thin GmbH", rev: 400_000, margin: 0.12 },
    { name: "Loss SA", rev: 300_000, margin: -0.03 },
    { name: "Thinner", rev: 100_000, margin: 0.05 },
  ];
  const r = reviewActions("customers", rows, 2_000_000, "FKM 75.16-04");
  assert.deepEqual(r.map((x) => x.kind), ["profit", "retain", "compare"]);
  assert.match(r[0].evidence, /^Thin GmbH has €400\.0k net revenue at 12\.0% GM/);
  assert.equal(r[0].effect, 20_000);
  assert.match(r[1].evidence, /The largest account, Big AG, represents 50\.0% of the net revenue/);
  assert.equal(r[2].compound, "FKM 75.16-04");
  assert.ok(r.every((x) => x.owner));
  // a loss is never the low-margin screen's position, nor 20% or more
  assert.equal(lowMarginLead([{ rev: 10, margin: -0.1 }, { rev: 9, margin: 0.2 }]), null);
  assert.equal(lowMarginLead([{ rev: 10, margin: 0.19 }, { rev: 50, margin: 0.05 }])?.rev, 50);
  // nothing low: the largest exposure, no effect
  const none = reviewActions("articles", [{ name: "A", rev: 10, margin: 0.5 }], 10);
  assert.equal(none[0].title, "Review the largest commercial exposure");
  assert.equal(none[0].effect, 0);
  assert.match(none[1].evidence, /The largest article, A, represents 100\.0%/);
});

test("sealing: a material family's cards - its priorities, else its portfolio review; the approvals' three", () => {
  const card = (kind: Priority["kind"], compound: string): Priority => ({ kind, compound, title: kind, evidence: "", effect: 0, effectLabel: "" });
  const all = [card("growth", "FKM 75.16-04"), card("margin", "DW EPDM 70.503-00")];
  assert.equal(familyActions(all, null, []).length, 2);
  assert.deepEqual(familyActions(all, "FKM", []).map((p) => p.kind), ["growth"]);
  const port = familyActions(all, "NBR", [{ name: "NBR 70.10-02", rev: 250_000 }, { name: "NBR 90", rev: 50_000 }]);
  assert.equal(port.length, 1);
  assert.equal(port[0].kind, "portfolio");
  assert.equal(port[0].compound, "NBR 70.10-02");
  assert.match(port[0].evidence, /The named NBR compounds shown represent €300\.0k/);
  assert.deepEqual(APPROVAL_ACTIONS.map((p) => p.kind), ["capture", "validate", "interpret"]);
  assert.ok(APPROVAL_ACTIONS.every((p) => !p.compound && !p.next));
});

test("sealing: the detail window opens a customer, an article or a compound - nothing else reaches the query", () => {
  for (const k of ["customer", "article", "compound"]) assert.equal(isDetailKind(k), true, k);
  for (const k of ["approval", "customer_name", "bu", "", null, undefined, 1]) assert.equal(isDetailKind(k), false, String(k));
});

test("sealing: the pilot's ranking - by revenue or gross profit, the first n or all, the scatter's ten the list's first", () => {
  const rows = [
    { label: "B", rev: 300, gp: 30 },
    { label: "A", rev: 300, gp: 90 },
    { label: "C", rev: 100, gp: 120 },
    { label: "D", rev: 50, gp: -10 },
  ];
  assert.deepEqual(rankBy(rows, "rev").map((r) => r.label), ["A", "B", "C", "D"], "a tie on revenue goes by the name");
  assert.deepEqual(rankBy(rows, "gp").map((r) => r.label), ["C", "A", "B", "D"]);
  assert.deepEqual(rankBy(rows, "rev", 2).map((r) => r.label), ["A", "B"]);
  assert.equal(rankBy(rows, "rev", 0).length, 4, "0 is the pilot's All entries");
  assert.deepEqual(rows.map((r) => r.label), ["B", "A", "C", "D"], "the rows given stay as they were");
});

test("sealing: the pilot's search, its cards' caption, the references named, its definitions", () => {
  assert.equal(matchesQuery("Hilti Aktiengesellschaft", "100234", "hilti"), true);
  assert.equal(matchesQuery("Hilti Aktiengesellschaft", "100234", "0023"), true, "the identifier too");
  assert.equal(matchesQuery("Hilti Aktiengesellschaft", "100234", "  "), true, "no search: everything");
  assert.equal(matchesQuery("Hilti Aktiengesellschaft", "100234", "geberit"), false);
  assert.equal(actionsCaption([]), "Commercial priorities");
  assert.equal(actionsCaption(["APDE"]), "APDE · account review priorities");
  assert.equal(actionsCaption(["APDE", "APCH"]), "Commercial priorities");
  assert.deepEqual(leadingRefs([{ name: "NSF", rev: 5 }, { name: "FDA", rev: 50 }, { name: "KTW", rev: 0 }, { name: "WRAS", rev: 20 }, { name: "ACS", rev: 1 }]), ["FDA", "WRAS", "NSF"]);
  assert.deepEqual(leadingRefs([{ name: "FDA", rev: 0 }]), []);
  assert.deepEqual(SEALING_DEFINITIONS.map((d) => d.title), [
    "Period and population", "Revenue and margin", "Compound treatment", "Material grouping", "Accounts and approvals",
    "Opportunity scenarios", "Recommendations", "Pending scope decisions",
  ]);
  assert.ok(SEALING_DEFINITIONS.every((d) => d.text.length > 60));
  assert.match(SEALING_DEFINITIONS[1].text, /never an average of margins/);
  assert.match(SEALING_DEFINITIONS[3].text, /Kalrez and Evolast treated as FFKM/);
});

test("sealing: every commercial priority ranked, the three kinds in turn, each with a stable key", () => {
  const compounds = [
    { key: "Kalrez 6375", name: "Kalrez 6375", rev: 4_100_000, gp: 4_100_000 * 0.325, margin: 0.325 },
    { key: "DW EPDM 70.503-00", name: "DW EPDM 70.503-00", rev: 3_030_000, gp: 3_030_000 * 0.565, margin: 0.565 },
    { key: "FKM 75.16-04", name: "FKM 75.16-04", rev: 2_730_000, gp: 2_730_000 * 0.629, margin: 0.629 },
    { key: "No info", name: "No info", rev: 9_000_000, gp: 900_000, margin: 0.1 },
  ];
  const pairs: CompoundCustomer[] = [
    { compound: "DW EPDM 70.503-00", customer: "1", customerName: "Elfo", rev: 122_900, gp: 122_900 * 0.24 },
    { compound: "FKM 75.16-04", customer: "2", customerName: "Huba", rev: 200_000, gp: 200_000 * 0.711 },
    { compound: "FKM 75.16-04", customer: "3", customerName: "Hilti", rev: 150_000, gp: 150_000 * 0.257 },
    { compound: "Kalrez 6375", customer: "4", customerName: "Sonceboz", rev: 900_000, gp: 900_000 * 0.12 },
    { compound: "No info", customer: "5", customerName: "Big", rev: 5_000_000, gp: 0 },
  ];
  const all = commercialCandidates(compounds, pairs);
  // margin, growth, spread, then the second of each that has one
  assert.deepEqual(all.map((p) => p.kind), ["margin", "growth", "spread", "margin", "growth", "margin", "growth"]);
  // the most gross profit at stake first: Sonceboz (32.5 - 12.0) x 900k
  assert.equal(all[0].id, "margin|4@Kalrez 6375|below-compound-margin");
  assert.equal(all[1].id, "growth|FKM 75.16-04|high-margin-1m");
  assert.equal(all[2].id, "spread|FKM 75.16-04|account-spread");
  assert.equal(new Set(all.map((p) => p.id)).size, all.length, "every key once");
  assert.ok(all.every((p) => p.compound !== "No info"), "an unnamed compound is never a priority");
  // the same figures, the same keys
  assert.deepEqual(commercialCandidates(compounds, pairs).map((p) => p.id), all.map((p) => p.id));
  // the three of the overview are still the first of each kind, without their keys
  const three = priorities(compounds, pairs);
  assert.deepEqual(three.map((p) => p.kind), ["margin", "growth", "spread"]);
  assert.ok(three.every((p) => p.id === undefined));
  assert.equal(candidateKey("profit", "customer:7", "negative-margin"), "profit|customer:7|negative-margin");
});

test("sealing: each block's cards ranked - the pilot's three first, then the losses and the low margins in turn", () => {
  const rows = [
    { key: "A", name: "Big AG", rev: 1_000_000, margin: 0.35 },
    { key: "B", name: "Thin GmbH", rev: 400_000, margin: 0.12 },
    { key: "C", name: "Loss SA", rev: 300_000, margin: -0.03 },
    { key: "D", name: "Thinner", rev: 100_000, margin: 0.05 },
    { key: "E", name: "Loss two", rev: 50_000, margin: -0.2 },
  ];
  const c = reviewCandidates("customers", rows, 2_000_000, "FKM 75.16-04");
  assert.deepEqual(c.slice(0, 3).map((x) => x.kind), ["profit", "retain", "compare"]);
  assert.deepEqual(c.slice(0, 3).map((x) => x.title), reviewActions("customers", rows, 2_000_000, "FKM 75.16-04").map((x) => x.title));
  assert.deepEqual(c.map((x) => x.id), [
    "profit|customer:B|low-margin", "retain|customer:A|concentration", "compare|compound:FKM 75.16-04|compound-comparison",
    "profit|customer:C|negative-margin", "profit|customer:D|low-margin", "profit|customer:E|negative-margin",
  ]);
  const loss = c.find((x) => x.id === "profit|customer:C|negative-margin")!;
  assert.equal(loss.title, "Explain the loss on Loss SA");
  assert.ok(Math.abs(loss.effect - 9_000) < 1e-6, "back to break-even: the loss itself");
  assert.deepEqual(reviewCandidates("articles", [], 0), []);

  const ov = overviewCandidates({
    commercial: [{ kind: "growth", compound: "X", title: "g", evidence: "", effect: 0, effectLabel: "", id: "growth|X|high-margin-1m" }],
    customers: rows, total: 2_000_000, noApprovalRev: 1_600_000,
    families: [{ key: "FKM", name: "FKM", rev: 900_000, margin: 0.4 }, { key: "Unclassified", name: "Unclassified", rev: 950_000, margin: 0.2 }],
  });
  assert.deepEqual(ov.map((x) => x.id), [
    "growth|X|high-margin-1m", "profit|customer:C|negative-margin", "retain|customer:A|concentration", "capture|approvals:none|revenue-without-approval",
    "portfolio|family:FKM|portfolio-review", "profit|customer:E|negative-margin",
  ]);
  assert.match(ov[3].evidence, /^80\.0% of the net revenue \(€1\.60m\) has no approval written/);

  const fam = familyCandidates([{ kind: "growth", compound: "FKM 75.16-04", title: "g", evidence: "", effect: 0, effectLabel: "", id: "growth|FKM 75.16-04|high-margin-1m" }], "NBR", [{ name: "NBR 70", rev: 10 }]);
  assert.deepEqual(fam.map((x) => x.id), ["portfolio|family:NBR|portfolio-review"]);

  const ap = approvalCandidates([{ name: "FDA", rev: 30 }, { name: "KTW", rev: 0 }, { name: "WRAS", rev: 50 }], 70, 100);
  assert.deepEqual(ap.map((x) => x.id), [
    "capture|approvals|explicit-fields", "validate|approvals|commercial-relevance", "interpret|approvals|no-double-count",
    "capture|approvals:none|revenue-without-approval", "validate|ref:WRAS|reference-relevance", "validate|ref:FDA|reference-relevance",
  ]);
});

test("sealing: a card's status - accepted, in progress, done, refused - and three open at a time", () => {
  assert.deepEqual(nextStatuses(null), ["accepted", "refused"]);
  assert.deepEqual(nextStatuses("accepted"), ["in_progress", "done", null]);
  assert.deepEqual(nextStatuses("in_progress"), ["done", "accepted"]);
  assert.deepEqual(nextStatuses("done"), ["in_progress"]);
  assert.deepEqual(nextStatuses("refused"), [null]);
  assert.equal(canMove(null, "accepted"), true);
  assert.equal(canMove(null, "done"), false, "a proposed card is accepted before it is done");
  assert.equal(canMove("refused", "accepted"), false, "a refused card comes back proposed first");
  assert.equal(canMove("accepted", "accepted"), false, "no move to where it is");
  assert.equal(canMove("done", "in_progress"), true);
  assert.ok(PRIORITY_STATUSES.every((s) => isPriorityStatus(s)));
  assert.equal(isPriorityStatus("closed"), false);
  assert.equal(STATUS_NAME.in_progress, "In progress");

  const cards = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  let o = openCards(cards, {});
  assert.deepEqual(o.shown.map((c) => c.id), ["a", "b", "c"]);
  assert.equal(o.waiting, 2);
  // a refused card leaves and the next comes in; an accepted one keeps its place; a done one leaves too
  o = openCards(cards, { b: "refused", a: "accepted", c: "done" });
  assert.deepEqual(o.shown.map((c) => c.id), ["a", "d", "e"]);
  assert.deepEqual(o.refused.map((c) => c.id), ["b"]);
  assert.deepEqual(o.done.map((c) => c.id), ["c"]);
  assert.equal(o.waiting, 0);
  assert.deepEqual(openCards([{ id: undefined }], { x: "refused" }).shown.length, 1, "a card with no key is always proposed");

  // a card's key as the request gives it: its three parts within the columns' widths
  assert.deepEqual(priorityKeyOf("profit", "customer:7", "negative-margin"), { kind: "profit", entity: "customer:7", rule: "negative-margin", id: "profit|customer:7|negative-margin" });
  assert.equal(priorityKeyOf("delete", "x", "y"), null);
  assert.equal(priorityKeyOf("profit", "x".repeat(401), "y"), null);
  assert.equal(priorityKeyOf("profit", "x", "DROP TABLE"), null);
  assert.equal(priorityKeyOf("profit", 7, "low-margin"), null);
});

test("sealing: a whole list a page at a time - the request kept within bounds, the compounds a list keeps, its pages", () => {
  const a = listAskOf(new URLSearchParams("kind=customer&by=gp&q=%20hilti%20&offset=60&limit=30"));
  assert.deepEqual(a, { kind: "customer", by: "gp", q: "hilti", offset: 60, limit: 30, family: null, unresolved: false, meaning: false });
  assert.equal(listAskOf(new URLSearchParams("kind=bu")), null);
  assert.equal(listAskOf(new URLSearchParams("")), null);
  const b = listAskOf(new URLSearchParams("kind=article&by=x&offset=-5&limit=5000&family=FKM&unresolved=1"))!;
  assert.equal(b.by, "rev");
  assert.equal(b.offset, 0);
  assert.equal(b.limit, 100, "a page holds 100 rows at most");
  assert.equal(b.family, "FKM");
  assert.equal(b.unresolved, true);
  assert.equal(listAskOf(new URLSearchParams("kind=approval&limit=abc"))!.limit, LIST_PAGE);
  assert.equal(listAskOf(new URLSearchParams(`kind=compound&q=${"x".repeat(300)}`))!.q.length, 100);

  const all = ["FKM 75.16-04", "Kalrez 6375", "No info", "", "EPDM 70.10-02", "Drawing : 12"];
  assert.deepEqual(compoundsKept(all, { kind: "compound", family: null, unresolved: false }), ["FKM 75.16-04", "Kalrez 6375", "EPDM 70.10-02"]);
  assert.equal(compoundsKept(all, { kind: "compound", family: null, unresolved: true }), null);
  assert.equal(compoundsKept(all, { kind: "article", family: null, unresolved: false }), null);
  assert.deepEqual(compoundsKept(all, { kind: "article", family: "FFKM", unresolved: false }), ["Kalrez 6375"]);
  assert.deepEqual(compoundsKept(all, { kind: "article", family: NO_COMPOUND_NAME, unresolved: false }), ["No info", "", "Drawing : 12"]);

  assert.deepEqual(pagesOf(7626, 0), { pages: 255, page: 0 });
  assert.deepEqual(pagesOf(7626, 7620), { pages: 255, page: 254 });
  assert.deepEqual(pagesOf(30, 0), { pages: 1, page: 0 });
  assert.deepEqual(pagesOf(0, 90), { pages: 1, page: 0 });
});

test("sealing: the material families by the standard and trade names - the specific first, short codes as words", () => {
  const cases: [string, string][] = [
    ["Kalrez® 6375", "FFKM"], ["Chemraz 505", "FFKM"], ["Perlast G75B", "FFKM"], ["Simriz 494", "FFKM"], ["Isolast J9503", "FFKM"], ["Parofluor V8545-75", "FFKM"], ["FFPM 75", "FFKM"],
    ["Aflas 80", "FEPM"], ["FEPM 75", "FEPM"],
    ["FVMQ 70.10-01", "FVMQ"], ["Fluorosilicone 60", "FVMQ"], ["FMQ 70", "FVMQ"],
    ["HNBR 80.45-02", "HNBR"],
    ["Viton® A 75", "FKM"], ["FPM 80", "FKM"], ["UP FKM 70.501-07 A", "FKM"], ["FKM 75.16-04", "FKM"],
    ["DW EPDM 70.503-00", "EPDM"], ["EPM 70", "EPDM"],
    ["XNBR 80", "NBR"], ["NBR 70.10-02", "NBR"],
    ["PERTEC® UP VMQ 70.501-01", "VMQ"], ["MVQ 60", "VMQ"], ["PVMQ 70", "VMQ"], ["Silikon 60 Shore A", "VMQ"], ["Silicone red", "VMQ"],
    ["PTFE virgin", "PTFE"], ["Teflon® FEP", "PTFE"],
    ["PU 92", "PU"], ["TPU 95 ShA", "PU"], ["AU 90", "PU"], ["Polyurethane blue", "PU"],
    ["ACM 70", "ACM"], ["Vamac G", "AEM"], ["AEM 70", "AEM"], ["CR 65", "CR"], ["Neoprene 60", "CR"], ["Butyl 70", "IIR"], ["IIR 60", "IIR"],
    ["NR 40", "NR"], ["SBR 70", "SBR"], ["PEEK GF30", "PEEK"], ["POM-C", "POM"], ["PA 6.6", "PA"], ["UHMW-PE", "PE"], ["PE 1000", "PE"],
    ["LUBROSEAL", "Unclassified"], ["PERTEC® CIP 70.100-01", "Unclassified"], ["something else", "Unclassified"],
  ];
  for (const [name, family] of cases) assert.equal(materialOf(name), family, name);
  // a short code never inside a word: PERTEC is not PE, PARKER is not PA, CRANE is not CR
  assert.equal(materialOf("PERTEC special"), "Unclassified");
  assert.equal(materialOf("PARKER 5100"), "Unclassified");
  assert.equal(materialOf("CRANE ring"), "Unclassified");
  assert.ok(MATERIAL_RULES.every(([, re]) => re instanceof RegExp));
  // the pilot's seven come first and keep their order
  assert.deepEqual(MATERIAL_RULES.map(([f]) => f).filter((f) => ["FFKM", "HNBR", "FKM", "EPDM", "NBR", "VMQ", "PTFE"].includes(f)), ["FFKM", "HNBR", "FKM", "EPDM", "NBR", "VMQ", "PTFE"]);
});

test("sealing: names as the pages show them - no trailing dash, the organisations short", () => {
  assert.equal(cleanName("Radial-shaft seal 13×19×3,SA,HNBR 80±5 ShA 6466P222.009 -"), "Radial-shaft seal 13×19×3,SA,HNBR 80±5 ShA 6466P222.009");
  assert.equal(cleanName("PERTEC O-Ring ID 5.60 × 2.40 mm UP FKM 70.501-07 A -"), "PERTEC O-Ring ID 5.60 × 2.40 mm UP FKM 70.501-07 A");
  assert.equal(cleanName("FKM 75.16-04"), "FKM 75.16-04", "a dash inside the name stays");
  assert.equal(shortName("Angst+Pfister Deutschland GmbH"), "A+P Deutschland");
  assert.equal(shortName("Angst + Pfister AG"), "A+P");
  assert.equal(shortName("Angst+Pfister S.A."), "A+P");
  assert.equal(shortName("Angst+Pfister Sp. z o.o."), "A+P");
  assert.equal(shortName("APSOparts web shop"), "APSOparts web shop");
});

test("sealing: an approval text read as its references - split where safe, the data-sheet phrases one, each once", () => {
  const t = "3-A Sanitary Standard; ACS; ADI free; AS/NZS4020; BfR XXI Category 4; DVGW W534;DVGW W270; EC 1935/2004, FDA 21 CFR 177.2600\nNSF 61 / NSF 51; ACS; gemäss dem technischen Datenblatt / acc. currently valid data sheet";
  assert.deepEqual(approvalParts(t), [
    "3-A Sanitary Standard", "ACS", "ADI free", "AS/NZS4020", "BfR XXI Category 4", "DVGW W534", "DVGW W270", "EC 1935/2004", "FDA 21 CFR 177.2600",
    "NSF 61", "NSF 51", PER_DATA_SHEET,
  ]);
  assert.deepEqual(approvalParts("as per data sheet"), [PER_DATA_SHEET]);
  assert.deepEqual(approvalParts("FDA acc. currently valid data sheet"), ["FDA", PER_DATA_SHEET]);
  assert.deepEqual(approvalParts(""), []);
  assert.deepEqual(approvalParts("(blank)"), []);
  assert.equal(approvalLabel("FDA; WRAS"), "FDA · WRAS");
  assert.equal(approvalLabel(t), "3-A Sanitary Standard · ACS · ADI free +9 more");
});

test("sealing: the answers kept - one stable key for the same question, a new delivery a new key, one reading shared", async () => {
  assert.equal(stableKey({ to: "2026-11", from: "2026-01", bus: ["APDE", "APCH"] }), stableKey({ bus: ["APCH", "APDE"], from: "2026-01", to: "2026-11" }));
  assert.notEqual(cacheKey("overview", "a", { from: "2026-01" }), cacheKey("overview", "b", { from: "2026-01" }));
  assert.notEqual(cacheKey("list", "a", { offset: 0 }), cacheKey("list", "a", { offset: 30 }));
  assert.equal(stableKey({ a: undefined, b: 1 }), stableKey({ b: 1 }));
  let runs = 0;
  const compute = async () => { runs++; await new Promise((r) => setTimeout(r, 5)); return { n: runs }; };
  const [x, y] = await Promise.all([sealingCached("test", "s1", { q: 1 }, compute), sealingCached("test", "s1", { q: 1 }, compute)]);
  assert.equal(runs, 1, "two requests at once share one reading");
  assert.deepEqual(x.value, y.value);
  const z = await sealingCached("test", "s1", { q: 1 }, compute);
  assert.equal(z.hit, true);
  assert.equal(runs, 1);
  const w = await sealingCached("test", "s2", { q: 1 }, compute);
  assert.equal(w.hit, false, "a new delivery is a new question");
  assert.equal(runs, 2);
  assert.equal(sealingCacheSize("test"), 1, "the older delivery's answers let go");
  sealingCacheClear();
  assert.equal(sealingCacheSize("test"), 0);
});

test("sealing: round 10 - the approvals our sold articles carry, how many articles each; the rows with no business unit", () => {
  const texts = [{ name: "FDA; WRAS", rev: 100, gp: 30 }, { name: "FDA 21 CFR", rev: 50, gp: 10 }, { name: "-", rev: 900, gp: 1 }, { name: "KTW", rev: 20, gp: 5 }];
  const pairs = refTexts(texts.map((t) => t.name));
  assert.deepEqual(pairs.filter((p) => p.ref === "FDA").map((p) => p.text), ["FDA; WRAS", "FDA 21 CFR"]);
  assert.ok(!pairs.some((p) => p.text === "-"), "no approval written names none");
  const refs = approvalRefs(texts, new Map([["FDA", 312], ["WRAS", 40]]));
  const fda = refs.find((r) => r.name === "FDA")!;
  assert.equal(fda.rev, 150);
  assert.equal(fda.articles, 312);
  assert.equal(refs.find((r) => r.name === "KTW")!.articles, 0, "counted, none: zero");
  assert.equal(approvalRefs(texts).every((r) => r.articles === null), true, "not counted: null");
  assert.match(approvalCandidates(refs, 900, 1070).find((p) => p.title.includes("FDA"))!.evidence, /articles carrying FDA \(312\)/);
  assert.equal(namesApproval("fda approved", "FDA"), true);
  assert.equal(namesApproval("-", "FDA"), false);
  assert.deepEqual(APPROVAL_KINDS.map((k) => k.name), ["No approval written", "Data sheet, no approval named", "Names an approval", "Other text"]);
  // the rows the ERP gives no company number: plainly named, out of the rings and bars while under 0.1% of the revenue
  assert.equal(buOf(""), "");
  assert.equal(NO_UNIT, "No business unit in the ERP");
  assert.equal(tinyNoUnit("", 1_404, 77_454_786), true);
  assert.equal(tinyNoUnit("", 100_000, 77_454_786), false, "0.1% or more: drawn");
  assert.equal(tinyNoUnit("APCH", 10, 77_454_786), false, "a unit with a number is always drawn");
});

test("sealing: round 11 - every data-sheet wording one meaning; the texts charted by meaning; the approvals against a year earlier", () => {
  const sheets = ["according to technical datasheet", "according to Technical Data Sheet", "acc. TDS", "acc TDS", "acc. current valid data sheet", "acc. currently valid data sheet",
    "gemäss technischem Datenblatt", "gemäss dem technischen Datenblatt", "as per data sheet", "Technical datasheet TDS 4711 available on request", "selon fiche technique", "secondo scheda tecnica", "gem. TDS"];
  for (const t of sheets) {
    assert.deepEqual(approvalParts(t), [PER_DATA_SHEET], t);
    assert.equal(approvalLabel(t), PER_DATA_SHEET, t);
    assert.equal(approvalKind(t), "datasheet", t);
    assert.equal(refersToDataSheet(t), true, t);
  }
  assert.deepEqual(approvalParts("FDA acc. currently valid data sheet"), ["FDA", PER_DATA_SHEET]);
  assert.deepEqual(approvalParts("Specific el. volume resistance min. 10^10 ohm/cm"), ["Specific el. volume resistance min. 10^10 ohm/cm"]);
  assert.equal(refersToDataSheet("Peroxide cured, STDS free"), false, "no data sheet inside a word");
  const long = "3-A Sanitary Standard; ACS; ADI free; AS/NZS 4020; BfR XXI Category 4; D.M. 06/04/04 n?74; DVGW W534; FDA; KIWA;";
  assert.equal(approvalLabel(long), "3-A Sanitary Standard · ACS · ADI free +6 more");
  // the texts by meaning: the eight data-sheet wordings one row, the largest its key; a year earlier summed the same way
  const now = sheets.slice(0, 8).map((t, i) => ({ key: t, name: t, rev: 1000 - i * 100, gp: 300, margin: 0 }));
  const rows = meaningRows([...now, { key: long, name: long, rev: 500, gp: 100, margin: 0 }, { key: "-", name: "-", rev: 9000, gp: 1, margin: 0 }], now.map((x) => ({ ...x, rev: 50 })));
  assert.equal(rows.length, 2, "no approval written is no row");
  assert.equal(rows[0].name, PER_DATA_SHEET);
  assert.equal(rows[0].texts.length, 8);
  assert.equal(rows[0].key, "according to technical datasheet");
  assert.equal(rows[0].rev, now.reduce((a, x) => a + x.rev, 0));
  assert.equal(rows[0].prev, 400);
  assert.equal(rows[1].name, "3-A Sanitary Standard · ACS · ADI free +6 more");
  // each approval and the data sheet, against a year earlier, how many articles
  const groups = approvalGroups([{ name: "acc. TDS", rev: 100, gp: 30 }, { name: "FDA; acc TDS", rev: 50, gp: 10 }, { name: "KTW", rev: 20, gp: 5 }], [{ name: "acc. TDS", rev: 80, gp: 20 }], new Map([[PER_DATA_SHEET, 12]]));
  const ds = groups.find((g) => g.name === PER_DATA_SHEET)!;
  assert.deepEqual([ds.rev, ds.prev, ds.articles], [150, 80, 12]);
  assert.equal(groups.find((g) => g.name === "FDA")!.rev, 50);
  assert.ok(!groups.some((g) => g.name === "WRAS"), "an approval no article carries is no row");
  assert.ok(APPROVAL_ROWS.includes(PER_DATA_SHEET));
  assert.equal(carriesApproval("gemäss technischem Datenblatt", PER_DATA_SHEET), true);
  assert.ok(refTexts(["acc. TDS"]).some((p) => p.ref === PER_DATA_SHEET));
  assert.equal(listAskOf(new URLSearchParams("kind=approval&meaning=1"))!.meaning, true);
  assert.equal(listAskOf(new URLSearchParams("kind=customer&meaning=1"))!.meaning, false);
  // a chart's name: two lines at most, an ellipsis where it does not end
  const w = (s: string) => s.length * 7;
  assert.deepEqual(twoLineLabel("acc. TDS", 140, w), ["acc. TDS"]);
  const two = twoLineLabel(long, 140, w);
  assert.equal(two.length, 2);
  assert.ok(two[1].endsWith("…"));
  assert.ok(two.every((l) => w(l) <= 140));
  assert.deepEqual(twoLineLabel("x".repeat(50), 140, w).length, 2);
});
