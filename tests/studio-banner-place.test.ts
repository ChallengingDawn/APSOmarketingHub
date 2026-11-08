import assert from "node:assert/strict";
import { test } from "node:test";
import { absoluteMedia, isHubPicture, mediaUrl, SHOP_PHOTOS } from "../src/lib/content/studio/kinds/banner/brand";
import { placeChecks, placeState } from "../src/lib/content/studio/kinds/banner/checks";
import { GROUPS, PAGE_PLACES, PRESETS, normalizeBanner, roomiest, sizesOf, togglePlace, withPlaces, type BannerDoc } from "../src/lib/content/studio/kinds/banner/model";
import { anchorOf, insertsOf, placeOf, placeOps, unplaceOp } from "../src/lib/content/studio/kinds/banner/place";
import { bannerCss, pageParts, pasteBlock, prefixFor, stillMarkup } from "../src/lib/content/studio/kinds/banner/render";

// The banner in several places at once, and put into a page (SARCLA 08.11.2026: "the banner can be in multiple places",
// "we should be able to push it inside a page visually as well").

const HUB_PIC = "/api/content/picture/12-AbCdEf1234";
const doc = (over: Record<string, unknown> = {}): BannerDoc => normalizeBanner({
  format: "band", sizes: ["cat", "square", "story"], theme: "pale", language: "EN",
  content: {
    eyebrow: "DirectCUT", headline: "Plastics cut to", rotatingWords: ["your size", "your length"],
    line: "Configure cut-to-size plastics online.", button: { label: "Configure", url: "service/directcut-configurator" },
    image: { url: SHOP_PHOTOS[1].url, alt: "", label: "Engineering plastics" }, photos: [],
  },
  ...over,
});

function selectors(css: string): string[] {
  const flat = css.replace(/@(media|supports|container)[^{]*\{/g, "");
  const out: string[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{[^{}]*\}/g)) out.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
  return out;
}

test("the places: every one in a group, the shop's four can go into a page, a banner keeps one place at least", () => {
  for (const p of PRESETS) assert.ok(GROUPS.some((g) => g.key === p.group), `${p.key} has a group`);
  for (const k of ["band", "cat", "hero", "home", "mail", "card", "square", "portrait", "story"]) assert.ok(PRESETS.some((p) => p.key === k), `${k} is a place`);
  assert.deepEqual(PAGE_PLACES, ["band", "cat", "hero", "home"]);
  const d = doc();
  assert.deepEqual(sizesOf(d), ["band", "cat", "square", "story"]);
  assert.deepEqual(sizesOf(togglePlace(d, "cat")), ["band", "square", "story"]);
  assert.deepEqual(sizesOf(togglePlace(d, "mail")), ["band", "cat", "square", "story", "mail"]);
  // taking out the first moves the next one up; the last one stays
  assert.deepEqual(sizesOf(togglePlace(d, "band")), ["cat", "square", "story"]);
  const one = withPlaces(d, ["story"]);
  assert.deepEqual(sizesOf(togglePlace(one, "story")), ["story"]);
  // the banner's own words are counted against the roomiest place
  assert.equal(roomiest(d), "band");
  assert.equal(roomiest(withPlaces(d, ["square", "story"])), "story");
  // what the first studio saved still opens (format + sizes)
  assert.deepEqual(sizesOf(normalizeBanner({ format: "card", sizes: ["mrec"] })), ["card", "mrec"]);
});

test("the new places draw under the banner's own class; the category band is a band, the social ones pictures", () => {
  const d = doc();
  const P = prefixFor(77);
  for (const k of ["cat", "square", "portrait", "story"] as const) {
    const css = bannerCss(P, d.theme, [k]);
    for (const s of selectors(css)) assert.ok(s.startsWith(`.${P}`), `${k}: "${s}" leaks out of .${P}`);
  }
  const cat = pasteBlock(d, "cat", P, "Cut");
  assert.match(cat, new RegExp(`class="${P} ${P}--cat"`));
  assert.match(cat, / data-motion/, "the category band changes its word on the shop");
  const story = stillMarkup(d, "story", P);
  assert.match(story.html, new RegExp(`${P}--story ${P}--fx`));
  assert.match(story.css, /aspect-ratio:1080\/1920/);
  assert.match(story.html, /Plastics cut to your size/, "no room for changing words: the headline reads with the first");
  assert.match(story.html, /<svg class="[^"]*-lg"/, "the logo on a social picture");
});

test("a picture kept in the hub shows in the studio, goes out with the hub's address, and the shop's places say so", () => {
  assert.equal(isHubPicture(HUB_PIC), true);
  assert.equal(isHubPicture("/api/content/picture/x"), false);
  assert.equal(mediaUrl(HUB_PIC), HUB_PIC);
  assert.equal(absoluteMedia(HUB_PIC, "https://hub.example"), `https://hub.example${HUB_PIC}`);
  assert.equal(absoluteMedia(SHOP_PHOTOS[0].url, "https://hub.example"), SHOP_PHOTOS[0].url);
  const d = doc({ content: { ...doc().content, image: { url: HUB_PIC, alt: "", label: "" } } });
  const P = prefixFor(5);
  assert.match(pasteBlock(d, "band", P), new RegExp(`src="${HUB_PIC}"`));
  assert.match(pasteBlock(d, "band", P, "", { origin: "https://hub.example" }), new RegExp(`src="https://hub.example${HUB_PIC}"`));
  assert.ok(placeChecks(d, "band").some((c) => /kept in the hub/.test(c.text)));
  assert.ok(!placeChecks(d, "square").some((c) => /kept in the hub/.test(c.text)), "a PNG carries the picture itself");
});

test("each place has its own checks: its room, the brand's rules, a button that goes nowhere", () => {
  const d = doc();
  assert.equal(placeState(placeChecks(d, "band")), "ready");
  const long = doc({ content: { ...doc().content, headline: "x".repeat(60), rotatingWords: [] } });
  assert.equal(placeState(placeChecks(long, "band")), "ready", "60 characters fit the home band");
  assert.ok(placeChecks(long, "square").some((c) => c.level === "stop" && /headline/.test(c.text)), "the square has 44");
  const own = { ...long, own: { square: { eyebrow: "", headline: "Cut to size", line: "", button: "" } } };
  assert.equal(placeChecks(own, "square").some((c) => /headline/.test(c.text)), false, "shorter words for that place fix it");
  const disc = doc({ content: { ...doc().content, line: "Up to 20% off plastics" } });
  assert.ok(placeChecks(disc, "story").some((c) => c.level === "stop" && /discount/i.test(c.text)));
  const nowhere = doc({ content: { ...doc().content, button: { label: "Go", url: "" } } });
  assert.ok(placeChecks(nowhere, "band").some((c) => /goes nowhere/.test(c.text)));
  assert.ok(!placeChecks(nowhere, "square").some((c) => /goes nowhere/.test(c.text)), "a picture's button is drawn, not clicked");
});

test("putting it in a page: an insert added to the page's list, the list made when the page has none, once only", () => {
  // a page never given an insert: the list is set
  const first = placeOps({ v: 1, source: "pick" }, { pieceId: 9, preset: "cat", where: "top" }, 0.5);
  assert.equal(first.existed, false);
  assert.deepEqual(first.ops, [{ op: "set", path: ["inserts"], value: [first.insert] }]);
  assert.deepEqual(first.insert, { id: first.insert.id, kind: "banner", pieceId: 9, preset: "cat", where: "top" });
  // a page with inserts: one more at its end (two people adding at once both keep theirs)
  const page = { inserts: [first.insert, { id: "x", kind: "banner", pieceId: 3, preset: "band", where: "bottom" }] };
  const next = placeOps(page, { pieceId: 9, preset: "band", where: "after-intro" }, 0.5);
  assert.equal(next.ops[0].op, "insert");
  assert.equal(next.ops[0].index, 2);
  assert.notEqual(next.insert.id, first.insert.id);
  // the same banner, place and spot again: nothing to do
  const again = placeOps(page, { pieceId: 9, preset: "cat", where: "top" });
  assert.equal(again.existed, true);
  assert.deepEqual(again.ops, []);
  // taken out by its place in the stored list
  assert.deepEqual(unplaceOp(page, "x"), { op: "remove", path: ["inserts"], index: 1 });
  assert.equal(unplaceOp(page, "gone"), null);
  assert.equal(unplaceOp({}, "x"), null);
});

test("a page's inserts are read whatever the page holds; an unknown place shows as the home band", () => {
  assert.deepEqual(insertsOf(null), []);
  assert.deepEqual(insertsOf({ inserts: null }), []);
  const got = insertsOf({ inserts: [null, { kind: "video", pieceId: 1, id: "a" }, { kind: "banner", pieceId: "4", id: "b", preset: "zzz", where: "middle" }, { kind: "banner", pieceId: 0, id: "c" }] });
  assert.deepEqual(got, [{ id: "b", kind: "banner", pieceId: 4, preset: "zzz", where: "top" }]);
  assert.equal(placeOf(got[0]), "band");
  assert.equal(placeOf({ preset: "square" }), "band", "a picture place is not a page's");
  assert.equal(placeOf({ preset: "hero" }), "hero");
});

test("in a page's preview the banner comes as markup and styles without a script, its motion apart", () => {
  const P = prefixFor(9);
  const parts = pageParts(doc(), "band", P, { origin: "https://hub.example" });
  assert.equal(/<script/i.test(parts.html), false, "a page's change may not carry a script");
  assert.ok(parts.script && /IntersectionObserver/.test(parts.script));
  const json = /data-list-json="([^"]*)"/.exec(parts.html)?.[1] ?? "";
  const list = JSON.parse(json.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'"));
  assert.deepEqual(list.w, ["your size", "your length"]);
  assert.match(parts.script!, /getAttribute\("data-list-json"\)/);
  const still = pageParts(doc({ content: { ...doc().content, rotatingWords: [] } }), "hero", P);
  assert.equal(still.script, null, "nothing moves: no script");
  // where it goes: the top or bottom of the page's content, or after its first block
  assert.deepEqual(anchorOf("top", false), { selector: "#maincontent .column.main", where: "prepend" });
  assert.deepEqual(anchorOf("bottom", true), { selector: "#maincontent", where: "append" });
  assert.equal(anchorOf("after-intro", false).where, "after");
  assert.match(anchorOf("after-intro", false).selector, /\[data-content-type="row"\]/);
});

test("the category band stacks on a phone, as the home band does", () => {
  const css = bannerCss("apbz", "pale", ["cat"]);
  const phone = css.slice(css.lastIndexOf("@media (max-width:900px)"));
  assert.match(phone, /\.apbz--cat \.apbz-g\{grid-template-columns:minmax\(0,1fr\)/);
});
