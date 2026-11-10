import assert from "node:assert/strict";
import { test } from "node:test";
import { asCross, crossHiddenApi, crossUserMaySend, homeFor, mfaRequired } from "../src/lib/auth/access";
import { accessAt, levelsOf } from "../src/lib/auth/tree";
import { SealingSheet, buOf, isSealingHeader, materialOf, monthOf, noCompound, priorities, sumBy, type CompoundCustomer } from "../src/lib/apHub/sealingRules";
import { inviteContent, whatTheySee } from "../src/lib/auth/inviteMailRules";

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
});
