import assert from "node:assert/strict";
import { test } from "node:test";
import type { Change } from "../src/lib/convert/versions";
import type { PageOutline } from "../src/lib/content/studio/kinds/page/model";
import { headKey, parseLine, sectionLevels, shopPartsOf } from "../src/lib/content/studio/kinds/page/shopParts";

// SARCLA's night list (09.11.2026): a page of the shop gets a parts outline too - its own sections from the outline the
// server reads, each with the changes the preview found in it.

const outline = (lines: string[], h1: string[] = []): PageOutline => ({ env: "prod", path: "/de-CH/dichtungstechnik.html", title: "T", description: "", h1, lines, truncated: false });

// the shape of /de-CH/dichtungstechnik.html as the server reads it (09.11.2026)
const PAGE = outline([
  "    #page-title-heading · Dichtungstechnik",
  "    div.page-title__sub-title · Eine grosse Vielfalt an Komponenten der Dichtungstechnik",
  "                        h3.subcategory-image-label · O-Ringe / X-Ringe",
  "                        h3.subcategory-image-label · Rotationsdichtungen",
  "              h2 · Ein umfangreiches Standardsortiment der Dichtungstechnik",
  "              p · Gegründet vor mehr als 100 Jahren, hat Angst+Pfister …",
  "              h2 · Wir kennen uns mit Dichtungen aus - und kennen die Bedürfnisse unserer Kunden",
  "              p · In der Dichtungstechnik hat sich Angst+Pfister …",
  "              h2 · Kurze Lieferzeiten dank unseres umfangreichen Lagersortiments",
  "              img.photo · [picture: Lager]",
  "              p · In unserem modernen Logistikzentrum …",
], ["Dichtungstechnik"]);

const ch = (op: string, extra: Record<string, unknown> = {}) => ({ op, selector: "h2", ...extra }) as unknown as Change;

test("shop parts: a line read, the heading levels a page is cut at", () => {
  assert.deepEqual(parseLine("      h2.title · Kurze Lieferzeiten"), { depth: 3, sel: "h2.title", tag: "h2", text: "Kurze Lieferzeiten" });
  assert.equal(parseLine("no dot here"), null);
  assert.deepEqual([...sectionLevels(["h1", "h2", "h3"])], ["h1", "h2"]);
  assert.deepEqual([...sectionLevels(["h1", "h3", "h3"])], ["h1", "h2", "h3"], "few top headings: the h3s cut it too");
  assert.equal(headKey("Wir kennen uns  mit\nDichtungen …"), headKey("Wir kennen uns mit Dichtungen"));
});

test("shop parts: the page's sections from its outline - the h1 known by its words, the rest by their headings", () => {
  const { parts } = shopPartsOf(PAGE, [], null);
  assert.deepEqual(parts.map((p) => p.name), [
    "Dichtungstechnik", "Ein umfangreiches Standardsortiment der…", "Wir kennen uns mit Dichtungen aus - und kennen die…", "Kurze Lieferzeiten dank unseres umfangreichen…",
  ]);
  assert.equal(parts[0].tag, "h1");
  assert.equal(parts[0].summary, "Eine grosse Vielfalt an Komponenten der Dichtungstechnik");
  assert.equal(parts[3].summary, "In unserem modernen Logistikzentrum …", "a picture's alt is no summary");
  assert.ok(parts.every((p) => p.name.length <= 52));
  assert.equal(shopPartsOf(null, [], null).parts.length, 0, "no outline read yet: no parts");
});

test("shop parts: each change under the section the preview found it in; a stylesheet is the whole page's", () => {
  const changes = [ch("text"), ch("css", { css: ".x{}" }), ch("insert", { html: "<p>x</p>" }), ch("hide")];
  const located = [
    { heading: "", changes: [] },
    { heading: "Dichtungstechnik", changes: [2] },
    { heading: "Wir kennen uns mit Dichtungen aus - und kennen die Bedürfnisse unserer Kunden", changes: [0, 0] },
  ];
  const r = shopPartsOf(PAGE, changes, located);
  assert.deepEqual(r.parts.map((p) => p.changes), [[2], [], [0], []]);
  assert.deepEqual(r.whole, [1]);
  assert.deepEqual(r.elsewhere, [3], "not found in any section: listed across the page");
  const before = shopPartsOf(PAGE, changes, null);
  assert.deepEqual(before.elsewhere, [], "before the preview answered nothing is said to be elsewhere");
});

test("shop parts: a page with words before its first heading starts with 'Top of the page'", () => {
  const r = shopPartsOf(outline(["  p.intro · Willkommen im Shop", "  h2 · Erste", "  p · a", "  h2 · Zweite"]), [], null);
  assert.deepEqual(r.parts.map((p) => p.name), ["Top of the page", "Erste", "Zweite"]);
  const quiet = shopPartsOf(outline(["  span · 1", "  h2 · Erste", "  h2 · Zweite"]), [], null);
  assert.equal(quiet.parts[0].name, "Erste", "nothing worth showing above: no top part");
  // a CMS page with no heading at all: one part, the whole page, its changes in it
  const flat = shopPartsOf(outline(["  p · Unsere Lieferbedingungen gelten für alle Bestellungen.", "  a.link · Zum Kontakt"]), [{ op: "text", selector: "p", text: "x" } as unknown as Change], [{ heading: "", changes: [0] }]);
  assert.deepEqual(flat.parts.map((p) => [p.name, p.changes]), [["The whole page", [0]]]);
  assert.deepEqual(flat.elsewhere, []);
});
