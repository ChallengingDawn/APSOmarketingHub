import assert from "node:assert/strict";
import { test } from "node:test";
import { APPS } from "../src/app/hubApps";
import { REPORT_CATEGORIES } from "../src/lib/reporting/categories";
import {
  ACCESS_TREE, accessAt, appOpen, appReachable, firstOpenPage, isNodeKey, levelsOf, nodeFor, opensAt, reportPathOfPage,
} from "../src/lib/auth/tree";

// SARCLA 01.11.2026: "sub hierarchy that needs to be updated at each new sub app" - the tree is read from the menus.
test("every sub-app the menus list is in the tree, so a new one needs nothing but its menu line", () => {
  for (const a of APPS) {
    for (const s of a.subs) {
      if (s.href.includes("#") || s.href.split("?")[0] === a.href) continue; // a tab of a page; the app's own front page
      assert.ok(isNodeKey(`${a.key}:${s.href.split("?")[0]}`), `${a.name} > ${s.name}`);
    }
  }
  for (const c of REPORT_CATEGORIES) {
    assert.ok(isNodeKey(`reporting:/reporting/${c.slug}`), c.name);
    for (const r of c.reports) for (const k of r.children ?? []) assert.ok(isNodeKey(`reporting:${k.href}`), `${c.name} > ${k.name}`);
  }
  // keys fit the column (VARCHAR(200)) and every parent comes before its children
  const seen = new Set<string>();
  for (const n of ACCESS_TREE) {
    assert.ok(n.key.length <= 200);
    if (n.parent) assert.ok(seen.has(n.parent), n.key);
    seen.add(n.key);
  }
});

test("a user: the Datatracker only, until more is given", () => {
  const lv = levelsOf("user", { datatracker: "read" });
  assert.equal(accessAt("/datatracker", lv).level, "read");
  assert.equal(accessAt("/uc/map-assignment", lv).level, "none");
  assert.equal(accessAt("/reporting/eso-benchmark/figures", lv).level, "none");
  assert.equal(appOpen("reporting", lv), false);
  // a page of no app is everybody's
  assert.equal(accessAt("/settings/you", lv).specific, null);
});

test("a sub-app given alone: that report and nothing beside it; its app opens on it", () => {
  const lv = levelsOf("user", { datatracker: "read", "reporting:/reporting/tsa": "read" });
  assert.deepEqual(accessAt("/reporting/tsa-benchmark/new-customers", lv), { level: "read", specific: true });
  assert.equal(accessAt("/reporting/tsa", lv).level, "read");
  assert.equal(accessAt("/reporting/eso-benchmark/new-customers", lv).level, "none");
  // the app opens (its landing lists what is theirs), its tile leads into what is theirs
  assert.equal(appOpen("reporting", lv), true);
  assert.equal(firstOpenPage("reporting", lv), "/reporting/tsa");
  assert.equal(firstOpenPage("datatracker", lv), null);
});

test("an app given, one sub-app taken away", () => {
  const lv = levelsOf("user", { uc: "write", "uc:/uc/map-assignment": "none" });
  assert.equal(accessAt("/uc/personas", lv).level, "write");
  assert.equal(accessAt("/uc/map-assignment", lv).level, "none");
  // its API answers to the same sub-app
  assert.equal(accessAt("/api/uc/map-assignment/leads", lv).level, "none");
  assert.equal(accessAt("/api/uc/personas", lv).level, "write");
});

test("a sales leader: views every app and sub-app, edits only the Advanced reports given (SARCLA 01.11.2026)", () => {
  const lv = levelsOf("sales_leader", { "reporting:/reporting/eso": "write", uc: "write" });
  assert.equal(accessAt("/reporting/eso-benchmark/new-customers", lv).level, "write");
  assert.equal(accessAt("/reporting/tsa-benchmark/new-customers", lv).level, "read");
  // a grant outside Advanced reporting gives no Edit
  assert.equal(accessAt("/uc/map-assignment", lv).level, "read");
  for (const a of ["datatracker", "website", "marketing", "journey", "reporting", "uc", "connectors"] as const) assert.equal(appOpen(a, lv), true);
});

test("a sales leader: a report, a team's reports or a whole app can be taken away (SARCLA 01.11.2026: \"i can't deny one of the reports - that's the point\")", () => {
  const lv = levelsOf("sales_leader", {
    "reporting:/reporting/tsa": "none", "connectors:/connectors/review": "none", uc: "none", "uc:/uc/personas": "read",
  });
  assert.equal(accessAt("/reporting/tsa-benchmark/new-customers", lv).level, "none");
  assert.equal(accessAt("/reporting/eso-benchmark/new-customers", lv).level, "read");
  assert.equal(accessAt("/connectors/review", lv).level, "none");
  assert.equal(appOpen("connectors", lv), true);
  // an app taken, one sub-app of it given back
  assert.equal(accessAt("/uc/map-assignment", lv).level, "none");
  assert.equal(accessAt("/uc/personas", lv).level, "read");
  assert.equal(firstOpenPage("uc", lv), "/uc/personas");
});

test("a page two menus list opens at the better of the two; a borrowed page opens itself, not its app's pages beneath it", () => {
  // Articles CY/LY: Products Reports' report, at UC's address
  const lv = levelsOf("user", { "reporting:/reporting/products": "read" });
  assert.equal(accessAt("/uc/articles", lv).level, "read");
  assert.equal(accessAt("/uc/articles/anything", lv).level, "none");
  // its data comes from UC's API: reachable, though no UC page is theirs
  assert.equal(appReachable("uc", lv), true);
  assert.equal(appOpen("uc", lv), false);
  // the Datatracker's Price checks opens its page and nothing of UC's
  const dt = levelsOf("user", { datatracker: "read" });
  assert.equal(accessAt("/uc/price-checks", dt).level, "read");
  assert.equal(appReachable("uc", dt), false);
});

test("Advanced reporting's data answers to anything open in it; its pages and other apps' stay with their sub-app (SARCLA 01.11.2026)", () => {
  // a sales rep given My Sales Reports alone
  const lv = levelsOf("user", { datatracker: "read", "reporting:/reporting/my-sales": "read" });
  // the customers' cube is read at Digital Growth's address - it feeds My Sales' pages too
  assert.equal(opensAt("reporting", "/api/reporting/marketing-kpis/customers", lv), true);
  assert.equal(opensAt("reporting", "/api/reporting/eso-visits", lv), true);
  // the page itself is not theirs
  assert.equal(opensAt("reporting", "/reporting/marketing-kpis/customers", lv), false);
  assert.equal(opensAt("reporting", "/reporting/my-sales/figures", lv), true);
  // another app's API keeps its sub-app's rule
  const uc = levelsOf("user", { uc: "read", "uc:/uc/map-assignment": "none" });
  assert.equal(opensAt("uc", "/api/uc/map-assignment/leads", uc), false);
  // nothing in Advanced reporting: none of its data
  assert.equal(opensAt("reporting", "/api/reporting/marketing-kpis/customers", levelsOf("user", { datatracker: "read" })), false);
});

test("the most specific address wins: a deeper sub-app before its sibling's prefix", () => {
  assert.equal(nodeFor("marketing", "/seo/quick-wins")?.name, "Quick wins");
  assert.equal(nodeFor("marketing", "/seo/something")?.name, "SEO");
  assert.equal(nodeFor("connectors", "/connectors/magento/orders")?.name, "Shop order list");
  assert.equal(nodeFor("reporting", "/reporting/eso-benchmark/revenue")?.name, "ESO Reports");
  // the app's own front page is the app; Live is a page of its section (SARCLA 03.11.2026)
  assert.equal(nodeFor("website", "/website")?.key, "website");
  assert.equal(nodeFor("website", "/live")?.key, "website:/live");
  assert.equal(nodeFor("website", "/live")?.parent, "website#Live");
});

test("a tile's or a view's page key leads to its report", () => {
  assert.equal(reportPathOfPage("eso-new-customers"), "/reporting/eso-benchmark/new-customers");
  assert.equal(reportPathOfPage("tsa-calls"), "/reporting/tsa-benchmark/calls");
  assert.equal(reportPathOfPage("nutshell:eso-shop"), "/reporting/eso-benchmark/shop");
  assert.equal(reportPathOfPage("eso-figures:panel:revenue"), "/reporting/eso-benchmark/figures");
  // Back-Office Reports (SARCLA 03.11.2026): its pages keyed "bo-<page>"
  assert.equal(reportPathOfPage("bo-figures:main:created"), "/reporting/back-office/figures");
  assert.equal(reportPathOfPage("nutshell:bo-topics"), "/reporting/back-office/topics");
  assert.equal(reportPathOfPage("reach"), "/reporting/marketing-kpis/reach");
  assert.equal(reportPathOfPage("nutshell"), "/reporting/marketing-kpis");
  assert.equal(reportPathOfPage(null), null);
});
