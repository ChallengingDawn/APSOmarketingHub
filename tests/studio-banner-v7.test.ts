import assert from "node:assert/strict";
import { test } from "node:test";
import { LOOKS, PRESETS, emptyBanner, normalizeBanner, sizesOf, type BannerDoc } from "../src/lib/content/studio/kinds/banner/model";
import { paletteOf, unreadable } from "../src/lib/content/studio/kinds/banner/looks";
import { bannerCss, headWords, keepWhole, pasteBlock, prefixFor, sizeOf, stillMarkup } from "../src/lib/content/studio/kinds/banner/render";
import { placeChecks } from "../src/lib/content/studio/kinds/banner/checks";

// Content v7 (10.11.2026, SARCLA point 11: "improve a lot the banner page"): the shop's own banners as designs, the shop
// slider's real sizes, the red word, product photos that stand free, and a readability guard on every word.

const P = prefixFor(7);
const PRODUCT = "https://www.apsoparts.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/std.lang.all/62/55/296255.jpg";
const doc = (over: Record<string, unknown> = {}): BannerDoc => normalizeBanner({
  format: "slider", sizes: PRESETS.map((p) => p.key), look: "petrol", theme: "petrol", language: "DE", accent: "",
  content: {
    eyebrow: "Dichtungstechnik", headline: "Finden Sie schneller den richtigen O-Ring", rotatingWords: [],
    line: "Vergleichen Sie Materialien und Anwendungen.", button: { label: "Leitfaden entdecken", url: "o-ring-auswahlleitfaden" },
    image: { url: PRODUCT, alt: "NORMATEC O-Ring NBR", label: "", fit: "product" }, photos: [],
  },
  ...over,
});

function selectors(css: string): string[] {
  const flat = css.replace(/@(media|supports|container)[^{]*\{/g, "");
  const out: string[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{[^{}]*\}/g)) out.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
  return out;
}

test("a new banner is the shop's own banner in petrol; a banner kept before opens as the newsletter band it was", () => {
  const e = normalizeBanner(emptyBanner("fr"));
  assert.equal(e.format, "slider");
  assert.equal(e.look, "petrol");
  const old = normalizeBanner({ format: "home", theme: "sand", content: { headline: "Old" } });
  assert.equal(old.look, "band");
  assert.equal(old.theme, "sand");
  // a colour a design does not take falls back to the design's own
  assert.equal(normalizeBanner({ look: "petrol", theme: "sand" }).theme, "petrol");
  assert.equal(normalizeBanner({ look: "nope", content: {} }).look, "band");
  assert.equal(normalizeBanner({ ...doc(), headColor: "pink" }).headColor, "auto");
  // a product photo keeps that it is one
  assert.equal(doc().content.image.fit, "product");
  assert.equal(normalizeBanner({ content: { image: { url: PRODUCT, fit: "x" } } }).content.image.fit, undefined);
});

test("every design draws every place under the banner's own class - nothing leaks into the shop's page", () => {
  for (const l of LOOKS) {
    const d = doc({ look: l.key, theme: l.themes[0] });
    for (const p of PRESETS) {
      const s = stillMarkup(d, p.key, P);
      for (const sel of selectors(s.css)) assert.ok(sel.startsWith(`.${P}`), `${l.key}/${p.key}: "${sel}" leaks`);
      if (l.key !== "band") assert.match(s.html, new RegExp(`${P}--look-${l.key}`));
    }
    for (const sel of selectors(bannerCss(P, { look: l.key, theme: l.themes[0] }, ["slidem"]))) assert.ok(sel.startsWith(`.${P}`), `${l.key}/slidem: "${sel}"`);
  }
});

test("the shop banner is the slider's real 1920 x 600, with its 1080 x 900 picture for phones", () => {
  assert.deepEqual(sizeOf("slider"), { w: 1920, h: 600 });
  assert.deepEqual(sizeOf("slider", true), { w: 1080, h: 900 });
  const phone = stillMarkup(doc(), "slider", P, { phone: true });
  assert.match(phone.html, new RegExp(`${P}--slidem`));
  assert.match(phone.css, /--w:1080/);
  assert.match(stillMarkup(doc(), "slider", P).css, /--w:1920/);
});

test("a product photo stands free (its own class); a scene photo fills its frame", () => {
  assert.match(stillMarkup(doc(), "slider", P).html, new RegExp(`class="${P}-c is-prod"`));
  const scene = doc({ content: { ...doc().content, image: { url: "https://www.apsoparts.com/media/wysiwyg/1_ORings_XRings_1.jpg", alt: "", label: "" } } });
  assert.doesNotMatch(stillMarkup(scene, "slider", P).html, /is-prod/);
});

test("the red word: the headline's own words in one span, the word in red, everything escaped", () => {
  assert.equal(headWords("Ihr persönliches <Angebot>", "persönliches", P), `Ihr <span class="${P}-r">persönliches</span> &lt;Angebot&gt;`);
  assert.equal(headWords("No such word", "other", P), "No such word");
  const d = doc({ look: "campaign", theme: "grey", accent: "richtigen" });
  const html = stillMarkup(d, "home", P).html;
  assert.match(html, new RegExp(`<span class="${P}-ht">Finden Sie schneller den <span class="${P}-r">richtigen</span>`));
  // a short compound never breaks after its hyphen ("O-" at a line's end)
  assert.match(keepWhole("den richtigen O-Ring finden"), /<span style="white-space:nowrap">O-Ring<\/span>/);
  assert.match(pasteBlock(d, "home", P), /-ht/);
});

test("the readability guard: each design's own colours read; a headline the colour of its ground is stopped", () => {
  for (const l of LOOKS) for (const t of l.themes) {
    const d = doc({ look: l.key, theme: t, accent: "richtigen" });
    assert.deepEqual(unreadable(d).map((u) => u.text), [], `${l.key}/${t} must read`);
  }
  // red on the red block, petrol on petrol, white on the light photo design
  const red = unreadable(doc({ look: "red", headColor: "red" }));
  assert.equal(red[0]?.part, "headline");
  assert.match(red[0].text, /colour of its ground|cannot be read|needs 3:1/);
  assert.equal(unreadable(doc({ look: "petrol", headColor: "petrol" }))[0]?.part, "headline");
  assert.equal(unreadable(doc({ look: "light", theme: "white", headColor: "white" }))[0]?.part, "headline");
  // the checks stop a place that cannot be read
  assert.ok(placeChecks(doc({ look: "red", headColor: "red" }), "slider").some((c) => c.level === "stop" && /headline/i.test(c.text)));
  assert.ok(!placeChecks(doc(), "slider").some((c) => c.level === "stop"));
  // the palette says where the words stand
  assert.equal(paletteOf("red", "grey").textOn, "panel");
  assert.equal(paletteOf("photo", "ink").textOn, "scrim");
});

test("the guard's words are plain: the colour names and the contrast a person can act on", () => {
  const u = unreadable(doc({ look: "petrol", headColor: "petrol" }))[0];
  assert.match(u.text, /^The headline is petrol #274e64 on /);
  assert.match(u.text, /Pick another colour or design\.$/);
  assert.equal(sizesOf(doc()).length, PRESETS.length);
});
