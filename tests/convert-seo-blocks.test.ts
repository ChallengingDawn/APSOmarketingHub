// APSOconvert > Problem pages' new kinds (SARCLA 09.11.2026: "SEO pages, Blog (to come), other pages that are not
// articles, block like newsletter block") and the optimization sent to a project with its versions.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SEO_RULES, bandOf, seoBands, seoPages, shopPathOf, type GscPageRow } from "../src/lib/convert/seoRules";
import { SHOP_BLOCKS, blockByKey, perThousand } from "../src/lib/convert/blocks";
import { markFocus } from "../src/lib/convert/preview";
import { markerOf, pageMarker, projectForPage } from "../src/lib/convert/handoff";

const page = (path: string, impressions: number, clicks: number, position: number): GscPageRow => ({ key: `https://www.apsoparts.com${path}`, impressions, clicks, position, ctr: impressions ? clicks / impressions : null });

test("shopPathOf: the shop's own address, nothing from another site", () => {
  assert.equal(shopPathOf("https://www.apsoparts.com/de-CH/o-ringe.html"), "/de-CH/o-ringe.html");
  assert.equal(shopPathOf("https://www.apsoparts.com/de-CH/%C3%BCber.html"), "/de-CH/über.html");
  assert.equal(shopPathOf("https://acc.apsoparts.com/de-CH/x.html"), null);
  assert.equal(shopPathOf("not an address"), null);
});

test("seoBands: the shop's own click rate per band of positions, where three pages or more sit", () => {
  const rows = [page("/a", 1000, 300, 1.2), page("/b", 1000, 200, 1.1), page("/c", 1000, 100, 1.4), page("/d", 500, 10, 7)];
  const b = seoBands(rows);
  assert.equal(b.find((x) => x.key === "1")!.rate, 0.2);
  assert.equal(b.find((x) => x.key === "6-10")!.rate, null, "one page only - too few to say what is typical");
  assert.equal(bandOf(15).key, "11-20");
  assert.equal(bandOf(42).key, "21+");
});

test("seoPages: shown a lot and clicked under half the typical rate at its position = a problem, clicks missed counted", () => {
  const pages = [page("/de-CH/a.html", 2000, 400, 1.2), page("/de-CH/b.html", 2000, 400, 1.3), page("/de-CH/c.html", 2000, 40, 1.4), page("/de-CH/d.html", 100, 0, 1.1)];
  const { rows } = seoPages(pages, [
    { query: "o-ring", page: "https://www.apsoparts.com/de-CH/c.html", clicks: 30, impressions: 1500, position: 1.3 },
    { query: "o ring kaufen", page: "https://www.apsoparts.com/de-CH/c.html", clicks: 10, impressions: 500, position: 1.6 },
  ]);
  const c = rows[0];
  assert.equal(c.path, "/de-CH/c.html", "the page missing the most clicks first");
  assert.ok(c.reasons[0].includes("Google showed it 2,000 times"));
  // typical at position 1 = (400 + 400 + 40 + 0) / 6100 shown
  assert.equal(c.missed, Math.round(2000 * (840 / 6100) - 40));
  assert.deepEqual(c.queries.map((q) => q.q), ["o-ring", "o ring kaufen"]);
  const d = rows.find((r) => r.path === "/de-CH/d.html")!;
  assert.equal(d.reasons.length, 0, `under ${SEO_RULES.minImpressions} showings - not judged`);
  assert.equal(d.missed, 0);
});

test("seoPages: a product page is never an SEO page, but it counts in what is typical at a position", () => {
  const { rows, bands } = seoPages([page("/de-CH/12202510-nivobloc.html", 3000, 30, 1.2), page("/de-CH/a.html", 1000, 300, 1.1), page("/de-CH/b.html", 1000, 200, 1.3)], []);
  assert.deepEqual(rows.map((r) => r.path), ["/de-CH/a.html", "/de-CH/b.html"]);
  assert.equal(bands.find((x) => x.key === "1")!.impressions, 5000);
});

test("seoPages: just below Google's first page with many showings is said so", () => {
  const { rows } = seoPages([page("/de-CH/p.html", 5000, 50, 11.5)], []);
  assert.ok(rows[0].reasons.some((t) => t.startsWith("Almost on Google's first page: position 11.5")));
});

test("blocks: the newsletter band first, every block found by its key, sign-ups per thousand views", () => {
  assert.equal(SHOP_BLOCKS[0].key, "newsletter");
  assert.equal(SHOP_BLOCKS[0].measure, "signups");
  assert.equal(new Set(SHOP_BLOCKS.map((b) => b.key)).size, SHOP_BLOCKS.length);
  assert.equal(blockByKey("home-slider")?.focus, "div.pagebuilder-slider");
  assert.equal(blockByKey("nope"), null);
  assert.equal(perThousand(12, 48000), 0.25);
  assert.equal(perThousand(3, 0), null);
});

test("markFocus: a block by its position among the Page Builder rows, and by its class", () => {
  const html = `<main id="maincontent"><div data-content-type="row" class="r">one</div><div data-content-type="row">two</div><div data-content-type="row">three</div></main><footer><div class="footer footer__newsletter">nl</div></footer>`;
  const second = markFocus(html, 'div[data-content-type="row"]:nth-of-type(2)');
  assert.ok(second.includes('<a id="apso-focus"></a><div class="apx-still-focus" data-content-type="row">two'));
  const first = markFocus(html, 'div[data-content-type="row"]:nth-of-type(1)');
  assert.ok(first.includes('<a id="apso-focus"></a><div data-content-type="row" class="apx-still-focus r">one'));
  const nl = markFocus(html, "div.footer__newsletter");
  assert.ok(nl.includes('<a id="apso-focus"></a><div class="apx-still-focus footer footer__newsletter">'));
  // a row the page does not have: the page's own top
  assert.ok(markFocus(html, 'div[data-content-type="row"]:nth-of-type(9)').includes('<a id="apso-focus"></a><main id="maincontent">'));
  for (const b of SHOP_BLOCKS) assert.ok(markFocus(`<div id="maincontent"></div>${"<div data-content-type=\"row\">x</div>".repeat(14)}<div class="pagebuilder-slider"></div><div class="footer footer__newsletter"></div>`, b.focus).includes("apx-still-focus"), b.key);
});

test("send to project: the marker carries the version sent, the brief every version", () => {
  assert.equal(pageMarker("prod", "/de-CH/x.html", null, "34"), "[APSOconvert page prod:/de-CH/x.html v:34]");
  assert.equal(pageMarker("prod", "/de-CH/x.html", "12", "34"), "[APSOconvert page prod:/de-CH/x.html test:12]", "a winner keeps its test");
  assert.deepEqual(markerOf("…\n[APSOconvert page acc:/de-CH/x.html v:34]"), { env: "acc", path: "/de-CH/x.html", versionId: "34" });
  const p = projectForPage({
    env: "prod", path: "/de-DE/kunststofftechnik/platte.html", url: "https://www.apsoparts.com/de-DE/kunststofftechnik/platte.html", h1: "Platte", title: "Platte",
    numbers: null, ideas: [{ title: "Compress the 17 material tiles into a chip row", why: "w", change: "c", expect: "e" }], version: null,
    versions: [{ id: "34", letter: "A", rev: 2, summary: "Chips" }, { id: "35", letter: "B", rev: 1, summary: "A dropdown" }], previewPath: "https://hub/p",
  });
  assert.ok(p.brief.includes("Its 2 versions, to test against the page as it is"));
  assert.ok(p.brief.includes("- Version A (revision 2): Chips\n- Version B (revision 1): A dropdown"));
  assert.deepEqual(markerOf(p.brief), { env: "prod", path: "/de-DE/kunststofftechnik/platte.html", versionId: "34" });
  assert.equal(p.contentType, "page-refresh");
});
