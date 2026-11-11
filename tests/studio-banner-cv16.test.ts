import assert from "node:assert/strict";
import { test } from "node:test";
import { guardCopy, guardVariants, knownText } from "../src/lib/content/studio/kinds/banner/guard";
import { placeChecks, promiseFlags } from "../src/lib/content/studio/kinds/banner/checks";
import { pasteHref } from "../src/lib/content/studio/kinds/banner/brand";
import { clearPart, clearWords, readPart, restorePart } from "../src/lib/content/studio/kinds/banner/edit";
import { emptyBanner, normalizeBanner, type BannerDoc } from "../src/lib/content/studio/kinds/banner/model";
import { bannerChange, changeIdFor, lookPrint, refreshedChange, whereOfChange, MAIN_SELECTOR, SLIDER_SELECTOR, type BannerOnPage } from "../src/lib/content/studio/kinds/banner/topage";
import type { CopyAnswer } from "../src/lib/content/studio/kinds/banner/ai";
import { bannerPictureWords, withStoredPictures } from "../src/lib/content/studio/kinds/banner/media";
import { pasteBlock } from "../src/lib/content/studio/kinds/banner/render";

// cv16 (SARCLA 11.11.2026: "compare the evolution of this page [the Page builder] to the other content types and improve
// them"): the banner studio brought up to the Page builder - its word rules on every AI text, its element popups' actions,
// "Write it all again > Start again", and the pages it is on brought up to date at once.

const answer = (over: Partial<CopyAnswer["content"]> = {}, own: CopyAnswer["own"] = {}): CopyAnswer => ({
  content: { eyebrow: "O-rings", headline: "The right O-ring, found faster", rotatingWords: [], line: "Every size and material, in one place.", button: "Find yours", ...over },
  own,
});

test("every AI text keeps the shop's word rules: stock, delivery, prices, Chemours and unnamed certificates are left out - and said", () => {
  const g = guardCopy(answer({ line: "All sizes in stock.", button: "From CHF 9", eyebrow: "FDA approved" }, { card: { eyebrow: "", headline: "Delivered within 24 h", line: "", button: "" } }), "", "EN");
  assert.equal(g.content.line, "");
  assert.equal(g.content.button, "");
  assert.equal(g.content.eyebrow, "", "a certificate nobody named");
  assert.equal(g.content.headline, "The right O-ring, found faster");
  assert.equal(g.own.card, undefined, "a place's own words that all went: no own words left");
  assert.ok(g.said.length >= 3 && g.said.every((x) => /left out/.test(x)));
  // named in the brief: it may stay
  const named = guardCopy(answer({ eyebrow: "FDA approved" }), knownText(["Goal: show the FDA compounds"]), "EN");
  assert.equal(named.content.eyebrow, "FDA approved");
  assert.deepEqual(named.said, []);
  // Chemours never
  assert.equal(guardCopy(answer({ headline: "Chemours Viton, here" }), "Chemours", "EN").content.headline, "");
});

test("the three other headlines: one that breaks a rule is not offered", () => {
  const v = guardVariants([{ headline: "Ab Lager lieferbar", angle: "x" }, { headline: "Der richtige O-Ring", angle: "y" }], "", "DE");
  assert.deepEqual(v.headlines.map((x) => x.headline), ["Der richtige O-Ring"]);
  assert.equal(v.said.length, 1);
});

test("the banner's checks say prices and delivery times too (the shared brandFlags stays as it is)", () => {
  assert.deepEqual(promiseFlags("The right O-ring"), []);
  assert.equal(promiseFlags("Ab 9.50 € das Stück").length, 1);
  assert.equal(promiseFlags("Geliefert innert 2 Tagen").length, 1);
  const d = normalizeBanner({ ...emptyBanner("EN"), content: { ...emptyBanner("EN").content, headline: "O-rings from CHF 2" } });
  assert.ok(placeChecks(d, "slider").some((c) => c.level === "stop" && /No prices/.test(c.text)));
});

test("a page picked with Find a page links as that exact page; a path without a store view, each store view's own", () => {
  assert.equal(pasteHref("/de-CH/dichtungstechnik.html"), "https://www.apsoparts.com/de-CH/dichtungstechnik.html");
  assert.equal(pasteHref("black-friday"), "{{store direct_url='black-friday'}}");
  assert.equal(pasteHref("https://www.apsoparts.com/en-INT/x"), "https://www.apsoparts.com/en-INT/x");
});

const words = (): BannerDoc => {
  const d = emptyBanner("EN");
  return { ...d, sizes: ["card"], content: { ...d.content, eyebrow: "Guide", headline: "Find it", rotatingWords: ["fast", "now"], line: "One line", button: { label: "Go", url: "x" } }, own: { card: { eyebrow: "G", headline: "", line: "L", button: "" } }, accent: "Find" };
};

test("Take it out: a part's words gone everywhere; its Undo brings exactly that part back", () => {
  const d = words();
  const out = clearPart(d, "eyebrow");
  assert.equal(out.content.eyebrow, "");
  assert.equal(out.own.card?.eyebrow, "");
  assert.equal(out.own.card?.line, "L", "the other parts as they were");
  const later = { ...out, content: { ...out.content, line: "Changed since" } };
  const back = restorePart(later, d, "eyebrow");
  assert.equal(back.content.eyebrow, "Guide");
  assert.equal(back.own.card?.eyebrow, "G");
  assert.equal(back.content.line, "Changed since", "only that part comes back");
  assert.equal(readPart(clearPart(d, "button"), "slider", "button"), "");
  assert.equal(clearPart(d, "button").content.button.url, "x", "the button's page kept");
  const h = clearPart(d, "headline");
  assert.deepEqual([h.content.headline, h.content.rotatingWords], ["", []]);
});

test("Start again: every word out - its design, places, picture and the button's page kept", () => {
  const d = words();
  const e = clearWords(d);
  assert.deepEqual([e.content.eyebrow, e.content.headline, e.content.line, e.content.button.label, e.accent], ["", "", "", "", ""]);
  assert.deepEqual(e.own, {});
  assert.deepEqual([e.look, e.theme, e.format, e.sizes, e.content.image, e.content.button.url], [d.look, d.theme, d.format, d.sizes, d.content.image, "x"]);
});

const B: Omit<BannerOnPage, "where"> = { pieceId: 42, store: "de-CH", desktop: "/api/content/picture/12-abcdEFGH12", phone: "/api/content/picture/13-ijklMNOP34", alt: "Der richtige O-Ring", link: "o-ringe" };

test("Update all: the banner's change on a page with its new pictures, at the same place, with the same id", () => {
  for (const where of ["slider", "top", "after"] as const) {
    const old = bannerChange({ ...B, where }, { selector: '[data-pb-style="BBB222"]' });
    assert.equal(whereOfChange(old as { selector?: string }), where);
    const next = refreshedChange({ ...old, note: "kept by the page" }, { ...B, desktop: "/api/content/picture/99-newPICTURE1", alt: "Neu" });
    type Ins = { id?: string; selector?: string; where?: string; html?: string };
    const n = next as Ins;
    const o = old as Ins;
    assert.equal(n.id, changeIdFor(42));
    assert.equal(n.selector, o.selector);
    assert.equal(n.where, o.where);
    assert.ok(n.html?.includes("/api/content/picture/99-newPICTURE1"));
    assert.ok(!n.html?.includes("12-abcdEFGH12"));
  }
  assert.equal(whereOfChange({ selector: SLIDER_SELECTOR, where: "prepend" }), "slider");
  assert.equal(whereOfChange({ selector: MAIN_SELECTOR, where: "prepend" }), "top");
});

test("the look's print: the same drawing, the same print; another, another", () => {
  assert.equal(lookPrint("a", "b"), lookPrint("a", "b"));
  assert.notEqual(lookPrint("a", "b"), lookPrint("a", "c"));
  assert.notEqual(lookPrint("ab", ""), lookPrint("a", "b"));
});

test("the banner keeps its picture's words and the look it drew for pages - and opens as before without them", () => {
  const shot = { print: "x1", desktop: "/api/content/picture/12-abcdEFGH12", phone: "/api/content/picture/13-ijklMNOP34", at: "2026-11-11T18:00:00.000Z" };
  const d = normalizeBanner({ ...emptyBanner("DE"), idea: "Ein O-Ring auf Stahl", shot });
  assert.equal(d.idea, "Ein O-Ring auf Stahl");
  assert.deepEqual(d.shot, shot);
  assert.equal(normalizeBanner({ ...emptyBanner("DE"), shot: { desktop: "data:image/png;base64,xx" } }).shot, undefined, "only the hub's pictures");
  const plain = normalizeBanner(emptyBanner("DE"));
  assert.ok(!("idea" in plain) && !("shot" in plain));
});

test("the paste block names the banner's own hub pictures at the hub's picture storage, named from their words", () => {
  const d0 = emptyBanner("EN");
  const hub = "/api/content/picture/448-abcdEFGH12";
  const d: BannerDoc = { ...d0, format: "band", look: "band", theme: "pale", content: { ...d0.content, headline: "Kalrez is going", image: { url: hub, alt: "Black FFKM O-rings", label: "" }, button: { label: "Go", url: "x" } } };
  assert.deepEqual([...bannerPictureWords(d)], [[hub, "Black FFKM O-rings"]]);
  assert.deepEqual([...bannerPictureWords({ ...d, content: { ...d.content, image: { url: hub, alt: "", label: "" } } })], [[hub, "Kalrez is going"]], "no alt text: the headline");
  assert.equal(bannerPictureWords(emptyBanner("EN")).size, 0, "the shop's own photos are not the hub's");
  const at = { [hub]: "https://dss0ijjcuug27.cloudfront.net/content/black-ffkm-o-rings-448.jpg" };
  const out = withStoredPictures(d, at);
  assert.equal(out.content.image.url, at[hub]);
  assert.equal(d.content.image.url, hub, "the banner itself keeps the hub's address");
  const block = pasteBlock(out, "band", "apb5", "Kalrez");
  assert.ok(block.includes("cloudfront.net/content/black-ffkm-o-rings-448.jpg"));
  assert.ok(!block.includes("/api/content/picture/"));
  assert.equal(withStoredPictures(d, { [hub]: "javascript:x" }).content.image.url, hub, "only an https address");
});
