import assert from "node:assert/strict";
import { test } from "node:test";
import { asCross, crossClosed, crossHiddenApi, crossUserMaySend, homeFor, mfaRequired, planClosedTo } from "../src/lib/auth/access";
import { accessAt, levelsOf } from "../src/lib/auth/tree";
import { SealingSheet, buOf, isSealingHeader, keyMonths, materialOf, monthOf, monthsBetween, monthsSpan, noCompound, periodWords, priorities, rateMonths, sealingPeriod, sealingPresets, sumBy, sumMonths, tileSeries, topShare, yearBefore, type CompoundCustomer } from "../src/lib/apHub/sealingRules";
import { APPROVAL_ACTIONS, approvalKind, approvalKinds, approvalRefs, familyActions, familyFigures, isDetailKind, lowMarginLead, reviewActions, type Priority } from "../src/lib/apHub/sealingRules";
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

test("cross access: a cross-user views everything else, edits nothing", () => {
  const lv = levelsOf("user", { datatracker: "write", uc: "write" }, "user");
  assert.ok(Object.values(lv).every((l) => l !== "write"), "nothing at Edit");
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

test("sealing: the pages the side panel lists", () => {
  assert.deepEqual(SEALING_PAGES.map((p) => p.href), [
    "/ap/reporting/sealing", "/ap/reporting/sealing/units", "/ap/reporting/sealing/customers",
    "/ap/reporting/sealing/articles", "/ap/reporting/sealing/materials", "/ap/reporting/sealing/approvals",
  ]);
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
