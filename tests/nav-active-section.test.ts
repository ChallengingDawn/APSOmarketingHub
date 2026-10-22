import assert from "node:assert/strict";
import { test } from "node:test";
import { appOfSection, listsHref, pickActiveSection, type NavShape } from "../src/lib/nav/activeSection";
import { REPORT_CATEGORIES } from "../src/lib/reporting/categories";
import { appForPath } from "../src/lib/auth/access";

/**
 * The report categories as the side panel builds them (Sidebar.tsx): a section
 * per category, its own page its home, every report and sub-page an item. Only
 * the addresses matter here.
 */
const categorySections = REPORT_CATEGORIES.map((c) => ({
  title: c.name,
  home: `/reporting/${c.slug}`,
  items: c.reports.flatMap((r) => (r.children?.length
    ? [{ href: r.overviewHref ?? r.href }, ...r.children.map((ch) => ({ href: ch.href }))]
    : [{ href: r.href }])),
}));

/** The UC app's section, with the pages it actually lists. */
const ucSection = {
  title: "UC & HubSpot Apps",
  items: [
    { href: "/uc/lifecycle" }, { href: "/uc/lifecycle/welcome" }, { href: "/uc/erosion" },
    { href: "/uc/segmentation" }, { href: "/uc/holiday-redirection" }, { href: "/uc/ticket-value" },
  ],
};

// The panel's real order: the categories are spliced in AHEAD of the apps.
const sections = [...categorySections, ucSection];

test("the UC tile's landing page opens UC's panel, not Digital Growth's", () => {
  // The cross-link that caused it: Digital Growth lists UC's overview page
  // (SARCLA 21.10.2026). If this ever goes, the clash below goes with it.
  const borrowers = categorySections.filter((s) => listsHref(s, "/uc/lifecycle"));
  assert.deepEqual(borrowers.map((s) => s.title), ["Digital Growth Reports"]);

  // Two sections list the address, and the borrower comes first in the list -
  // which is exactly what the old rule picked.
  assert.equal(sections.filter((s) => listsHref(s, "/uc/lifecycle")).length, 2);
  assert.equal(sections.find((s) => listsHref(s, "/uc/lifecycle"))?.title, "Digital Growth Reports");

  // The owner wins.
  assert.equal(pickActiveSection(sections, "/uc/lifecycle")?.title, "UC & HubSpot Apps");
});

test("no cross-linked page in the real categories can steal its app's panel", () => {
  let checked = 0;
  for (const s of categorySections) {
    for (const i of s.items) {
      const app = appForPath(i.href.split("?")[0]);
      if (!app || app === appOfSection(s)) continue; // the category's own page
      // A page this category borrowed: whoever owns it must still be able to
      // win it, so put an owning section after the categories and ask.
      const owner = { title: `owner:${app}`, items: [{ href: i.href }, { href: `${i.href}/x` }] };
      assert.equal(pickActiveSection([...categorySections, owner], i.href)?.title, `owner:${app}`, i.href);
      checked += 1;
    }
  }
  assert.ok(checked > 0, "no borrowed page found - the guard above would be empty");
});

test("a section's app is counted, not read off its first entry", () => {
  // No home, and the borrowed page listed FIRST: the section is still UC's.
  const s: NavShape = { items: [{ href: "/reporting/marketing-kpis/customers" }, { href: "/uc/erosion" }, { href: "/uc/segmentation" }] };
  assert.equal(appOfSection(s), "uc");
  // With a home, the home decides - it is the section's own page.
  assert.equal(appOfSection({ home: "/reporting/marketing", items: [{ href: "/uc/lifecycle" }] }), "reporting");
});

test("one listing, or none, answers as before", () => {
  assert.equal(pickActiveSection(sections, "/uc/segmentation")?.title, "UC & HubSpot Apps");
  assert.equal(pickActiveSection(sections, "/reporting/marketing-kpis/customers")?.title, "Digital Growth Reports");
  assert.equal(pickActiveSection(sections, "/nowhere"), undefined);
});

test("a page no section owns keeps the first that lists it", () => {
  // /tools/thing belongs to no app, so there is nothing to prefer: first wins.
  const a = { title: "A", items: [{ href: "/tools/thing" }] };
  const b = { title: "B", items: [{ href: "/tools/thing" }] };
  assert.equal(appForPath("/tools/thing"), null);
  assert.equal(pickActiveSection([a, b], "/tools/thing")?.title, "A");
});

test("a sub-page listed under an entry counts as listed", () => {
  const s = { title: "S", items: [{ href: "/uc/map-assignment", children: [{ href: "/uc/map-assignment/redirections" }] }] };
  assert.equal(listsHref(s, "/uc/map-assignment/redirections"), true);
  assert.equal(pickActiveSection([s], "/uc/map-assignment/redirections")?.title, "S");
});
