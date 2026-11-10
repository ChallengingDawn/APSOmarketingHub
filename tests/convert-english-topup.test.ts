// APSOconvert > everything in English, also what was written before; the types' own top-up; a new block never in the
// page's title band (SARCLA 10.11.2026: "still text in German"; "we should have already SEO pages waiting for design,
// and newsletter, banner"; a tile block squeezed into the "Über uns" band - "still not up to expected").
import assert from "node:assert/strict";
import { test } from "node:test";
import { languageScore, looksEnglish } from "../src/lib/convert/lang";
import { TOPUP, typesToTopUp } from "../src/lib/convert/scanRules";
import { qualityOf } from "../src/lib/convert/safety";
import { seoLine, type SeoRow } from "../src/lib/convert/seoRules";

test("looksEnglish: his screenshot's German optimization is not English", () => {
  assert.equal(looksEnglish("Sortiment-Einstiege als Kachelblock einbauen"), false);
  assert.equal(looksEnglish("45 % verlassen den Shop von dieser Seite, Weiterklicks gehen fast nur zur Startseite oder zum Kontakt; die sechs Technikbereiche werden im Text genannt, sind aber nirgends verlinkt."), false);
  assert.equal(looksEnglish("Weniger Ausstiege von dieser Seite, mehr Weiterklicks in Kategorien und damit mehr Produktseiten-Aufrufe und Warenkorb-Legungen."), false);
  assert.equal(looksEnglish("Quantità superiore allo stock: richiedi la disponibilità per questa quantità"), false);
  assert.equal(looksEnglish("Afficher les filtres avant la liste des articles pour les acheteurs"), false);
});

test("looksEnglish: English with a quoted shop label stays English", () => {
  assert.equal(looksEnglish("Add a block of six linked tiles under the \"Über uns\" section, each to its category page."), true);
  assert.equal(looksEnglish("Open the filters (\"Filter anzeigen\") by default on the category page"), true);
  assert.equal(looksEnglish("Six technology tiles under About us"), true);
  assert.equal(looksEnglish(""), true);
  assert.deepEqual(languageScore("the page and die Seite"), { en: 3, other: 2 });
});

test("typesToTopUp: a type under 3 waiting gets its batch, once a day", () => {
  assert.equal(TOPUP.waiting, 3);
  assert.deepEqual(typesToTopUp({ "page-refresh": 44 }, []), ["landing-page", "banner", "newsletter"]);
  assert.deepEqual(typesToTopUp({ "landing-page": 3, banner: 2, newsletter: 0 }, ["newsletter"]), ["banner"]);
  assert.deepEqual(typesToTopUp({ "landing-page": 5, banner: 5, newsletter: 5 }, []), []);
});

test("qualityOf: a new block after the h1 or into the title band is sent back; after the band it is fine", () => {
  const tiles = "<div class=\"apx-tiles\"><h2>Our six technology ranges</h2></div>";
  assert.ok(qualityOf([{ op: "insert", selector: "h1.page-title", where: "after", html: tiles }]).some((p) => p.includes("title band")));
  assert.ok(qualityOf([{ op: "insert", selector: ".page-title-wrapper", where: "append", html: tiles }]).some((p) => p.includes("title band")));
  assert.ok(qualityOf([{ op: "insert", selector: "div.breadcrumbs", where: "after", html: tiles }]).some((p) => p.includes("title band")));
  assert.deepEqual(qualityOf([{ op: "insert", selector: ".page-title-wrapper", where: "after", html: tiles }]), []);
  assert.deepEqual(qualityOf([{ op: "insert", selector: "#maincontent div[data-content-type=\"row\"]:nth-of-type(2)", where: "after", html: tiles }]), []);
});

test("seoLine: the searches with how often they were shown and clicked", () => {
  const row: SeoRow = {
    path: "/de-CH/support/about-us", url: "https://www.apsoparts.com/de-CH/support/about-us", kind: "cms",
    clicks: 2, impressions: 1990, ctr: 2 / 1990, position: 46.1, typical: 0.012, missed: 22, reasons: ["x"],
    queries: [{ q: "apsoparts", clicks: 2, impressions: 306, position: 40 }],
  };
  const l = seoLine(row, "2026-10-11", "2026-11-07");
  assert.match(l, /shown 1990 times, 2 clicks/);
  assert.match(l, /"apsoparts" 306 shown, 2 clicked/);
  assert.match(l, /1\.2% is typical/);
});
