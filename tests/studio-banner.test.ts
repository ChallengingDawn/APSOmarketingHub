import assert from "node:assert/strict";
import { test } from "node:test";
import { brandFlags, linkOf, mediaUrl, pasteHref, SHOP_PHOTOS } from "../src/lib/content/studio/kinds/banner/brand";
import { PRESETS, bannerText, emptyBanner, normalizeBanner, overLimits, sizesOf, wordsFor, type BannerDoc } from "../src/lib/content/studio/kinds/banner/model";
import { bannerCss, htmlFile, pasteBlock, prefixFor, previewDoc, stillMarkup, stillSheet } from "../src/lib/content/studio/kinds/banner/render";
import { cleanCopy, cleanVariants, sizesBrief } from "../src/lib/content/studio/kinds/banner/ai";

// The banner studio (08.11.2026): one banner, its sizes, a paste block for the shop and PNGs for the rest.

const P = prefixFor(42);
const doc = (over: Record<string, unknown> = {}): BannerDoc => normalizeBanner({
  format: "band", sizes: ["home", "mrec", "leader"], theme: "pale", language: "EN",
  content: {
    eyebrow: "Newsletter", headline: "Want to know more about", rotatingWords: ["sealing technology?", "fluid handling?"],
    line: "Receive the latest information about products and shop developments.", button: { label: "Subscribe", url: "newsletter" },
    image: { url: "wysiwyg/1_Sealing_Technology_1.jpg", alt: "", label: "Sealing technology" },
    photos: [{ url: SHOP_PHOTOS[0].url, label: "Sealing technology" }, { url: SHOP_PHOTOS[2].url, label: "Fluid handling" }],
  },
  ...over,
});

/** Every selector of a stylesheet, outside its @media / @supports / @container wrappers. */
function selectors(css: string): string[] {
  const flat = css.replace(/@(media|supports|container)[^{]*\{/g, "");
  const out: string[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{[^{}]*\}/g)) out.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
  return out;
}

test("a new banner is the shop band in pale petrol with the shop's first photo; anything stored opens as a whole banner", () => {
  const e = emptyBanner("de");
  assert.equal(e.format, "band");
  assert.equal(e.theme, "pale");
  assert.equal(e.language, "DE");
  assert.equal(e.content.image.url, SHOP_PHOTOS[0].url);
  assert.equal(e.content.image.label, "Dichtungstechnik");
  // the first shape held notes only; saves set a removed key to null
  const old = normalizeBanner({ v: 1, notes: "keep me" });
  assert.equal(old.notes, "keep me");
  assert.equal(old.format, "band");
  const nulls = normalizeBanner({ format: "card", sizes: ["card", "nope", "sky", "sky"], theme: "pink", content: null, own: { sky: { headline: "Short" }, nope: {} } });
  assert.equal(nulls.format, "card");
  assert.deepEqual(nulls.sizes, ["sky"]);
  assert.equal(nulls.theme, "pale");
  assert.equal(nulls.own.sky?.headline, "Short");
  assert.equal(Object.keys(nulls.own).length, 1);
  assert.deepEqual(sizesOf(nulls), ["card", "sky"]);
});

test("each size shows its own words where it has them, and nothing it has no room for", () => {
  const d = doc({ own: { mrec: { eyebrow: "", headline: "Seals, explained", line: "", button: "" } } });
  const band = wordsFor(d, "band");
  assert.equal(band.headline, "Want to know more about");
  assert.deepEqual(band.words, ["sealing technology?", "fluid handling?"]);
  const mrec = wordsFor(d, "mrec");
  assert.equal(mrec.headline, "Seals, explained");
  assert.equal(mrec.eyebrow, "", "the 300x250 has no eyebrow");
  assert.deepEqual(mrec.words, []);
  // a size without room for the changing word reads the headline with the first word
  assert.equal(wordsFor(d, "leader").headline, "Want to know more about sealing technology?");
  assert.equal(wordsFor(d, "leader").line, "");
  const long = doc({ content: { ...d.content, headline: "x".repeat(70) } });
  assert.ok(overLimits(long, "band").some((o) => o.field === "headline" && o.by === 10));
  assert.deepEqual(overLimits(d, "band"), []);
});

test("the paste block keeps every rule under its own class, respects reduced motion and moves only while on screen", () => {
  const d = doc();
  const block = pasteBlock(d, "band", P, "Newsletter -- band");
  const css = /<style>\n([\s\S]*?)\n<\/style>/.exec(block)?.[1] ?? "";
  assert.ok(css.length > 500);
  for (const s of selectors(css)) assert.ok(s.startsWith(`.${P}`), `"${s}" leaks out of .${P}`);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(block, /IntersectionObserver/);
  assert.match(block, /prefers-reduced-motion: reduce/, "the script checks it too");
  assert.match(block, / data-motion/);
  // full picture addresses, the shop's own link per store view, no "--" inside the comment
  assert.match(block, /src="https:\/\/www\.apsoparts\.com\/media\/wysiwyg\/1_Sealing_Technology_1\.jpg"/);
  assert.match(block, /href="\{\{store direct_url='newsletter'\}\}"/);
  assert.equal((block.split("\n")[0].match(/--/g) ?? []).length, 2, "only the comment's own markers");
  // every fixed size too
  for (const p of PRESETS) for (const s of selectors(bannerCss(P, "petrol", [p.key]))) assert.ok(s.startsWith(`.${P}`), `${p.key}: "${s}"`);
});

test("a banner without a second word or photo has no script; text is escaped; the PNG markup is still", () => {
  const d = doc({ content: { eyebrow: "<b>x</b>", headline: "Seals </script><script>alert(1)</script>", rotatingWords: [], line: "a & b", button: { label: "Go", url: "javascript:alert(1)" }, image: { url: "wysiwyg/a.jpg", label: "" }, photos: [] } });
  const block = pasteBlock(d, "home", P);
  assert.doesNotMatch(block, /<script>/);
  assert.doesNotMatch(block, /data-motion/);
  assert.match(block, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(block, /a &amp; b/);
  assert.doesNotMatch(block, /javascript:/, "an address that is no address is dropped");
  assert.match(block, /<span class="apb42-b">Go/);
  const still = stillMarkup(doc(), "card", P);
  assert.match(still.html, /is-still/);
  assert.equal((still.html.match(/<img /g) ?? []).length, 1, "the PNG draws the first photo only");
  assert.doesNotMatch(still.html, /data-motion/);
  const sheet = stillSheet(doc(), ["band", "sky"], P);
  assert.deepEqual(Object.keys(sheet.html), ["band", "sky"]);
  assert.match(sheet.css, /--sky/);
  assert.doesNotMatch(sheet.css, /--hero/);
});

test("the preview and the download open outside Magento: shop links become full addresses", () => {
  const block = pasteBlock(doc(), "band", P);
  const page = previewDoc(block, "@font-face{}");
  assert.match(page, /href="https:\/\/www\.apsoparts\.com\/newsletter"/);
  assert.doesNotMatch(page, /direct_url/);
  assert.match(page, /apsoBanner/);
  const file = htmlFile(block, "My <banner>");
  assert.match(file, /<title>My &lt;banner&gt;<\/title>/);
  assert.match(file, /fonts\.googleapis\.com/);
});

test("addresses: shop media made absolute, other schemes refused; shop paths become store links", () => {
  assert.equal(mediaUrl("wysiwyg/x.jpg"), "https://www.apsoparts.com/media/wysiwyg/x.jpg");
  assert.equal(mediaUrl("/media/catalog/p.jpg"), "https://www.apsoparts.com/media/catalog/p.jpg");
  assert.equal(mediaUrl("{{media url='wysiwyg/y.png'}}"), "https://www.apsoparts.com/media/wysiwyg/y.png");
  assert.equal(mediaUrl("http://www.apsoparts.com/media/z.jpg"), "https://www.apsoparts.com/media/z.jpg");
  assert.equal(mediaUrl("data:image/png;base64,AAAA"), "");
  assert.equal(mediaUrl("javascript:alert(1)"), "");
  assert.deepEqual(linkOf("black-friday"), { href: "https://www.apsoparts.com/black-friday", shopPath: "black-friday" });
  assert.equal(pasteHref("/dichtungstechnik.html"), "{{store direct_url='dichtungstechnik.html'}}");
  assert.equal(pasteHref("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(pasteHref("javascript:alert(1)"), "");
});

test("the brand's rules: no discount value, never Chemours; plain figures are fine", () => {
  assert.equal(brandFlags("Save up to 20% on seals").length, 1);
  assert.equal(brandFlags("20% off all O-rings").length, 1);
  assert.equal(brandFlags("Jetzt -15% Rabatt").length, 1);
  assert.equal(brandFlags("Bis zu 30% sparen").length, 1);
  assert.deepEqual(brandFlags("Made with Chemours materials"), ["Never name Chemours."]);
  assert.deepEqual(brandFlags("FKM works to around 200 °C; searches grew 6× in a year"), []);
  assert.deepEqual(brandFlags("95% of orders ship in 48 hours"), []);
});

test("the AI's words are kept within reason, only for this banner's sizes, and only where they differ", () => {
  const d = doc();
  const a = cleanCopy({
    eyebrow: "  Newsletter  ", headline: "“Want to know more about”", rotatingWords: ["sealing?"], line: "x".repeat(900), button: "Subscribe",
    sizes: [
      { size: "mrec", eyebrow: "ignored", headline: "Seals, explained", line: "", button: "Subscribe" },
      { size: "hero", eyebrow: "", headline: "Not made in this size", line: "", button: "" },
      { size: "leader", eyebrow: "", headline: "", line: "", button: "" },
    ],
  }, d);
  assert.equal(a.content.eyebrow, "Newsletter");
  assert.equal(a.content.headline, "Want to know more about sealing?", "one changing word joins the headline");
  assert.deepEqual(a.content.rotatingWords, []);
  assert.ok(a.content.line.length <= 330);
  assert.deepEqual(Object.keys(a.own), ["mrec"]);
  assert.equal(a.own.mrec?.eyebrow, "", "the 300x250 has no eyebrow");
  assert.equal(a.own.mrec?.button, "", "the same as the main words = no own words");
  const v = cleanVariants({ headlines: [{ headline: "A", angle: "x" }, { headline: "a", angle: "dup" }, { headline: "B", angle: "" }, { headline: "C", angle: "" }, { headline: "D", angle: "" }] }, d);
  assert.deepEqual(v.headlines.map((x) => x.headline), ["A", "B", "C"]);
  // 08.11.2026 "the banner can be in multiple places": no main size - the banner's own words fit the roomiest place
  assert.match(sizesBrief(d), /band \(Home band, full width, the most room - the banner's own words\)/);
  assert.match(sizesBrief(d), /leader \(Display 728×90, 728x90\): no eyebrow/);
});

test("the banner as text, for the versions and the search", () => {
  const t = bannerText(doc({ own: { mrec: { eyebrow: "", headline: "Seals, explained", line: "", button: "" } }, notes: "For the November push" }));
  assert.match(t, /Want to know more about \[sealing technology\? \/ fluid handling\?\]/);
  assert.match(t, /Subscribe -> newsletter/);
  assert.match(t, /Display 300×250: Seals, explained/);
  assert.match(t, /For the November push/);
});
