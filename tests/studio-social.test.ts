import assert from "node:assert/strict";
import { test } from "node:test";
import { SHOP_PHOTOS } from "../src/lib/content/studio/kinds/banner/brand";
import {
  checks, cleanTag, composed, composedComment, emptySocial, exportPack, fold, normalizeSocial, slidesOf, socialText, splitTags,
  type SocialDoc,
} from "../src/lib/content/studio/kinds/social/model";
import { headSize, listItems, slideCss, slideHtml } from "../src/lib/content/studio/kinds/social/slides";
import { askedNetworks, cleanCarousel, cleanPostText, cleanTags, cleanText, cleanWrite } from "../src/lib/content/studio/kinds/social/ai";

// The social studio (08.11.2026): one post per network, its feed cut, its hashtags, its picture, card or carousel.

const post = (over: Partial<SocialDoc> = {}): SocialDoc => ({ ...emptySocial({ contentType: "social-post", dueDate: "2026-11-20" }), ...over });

test("a new post: LinkedIn alone for a LinkedIn post, three networks for a social post; the to-do's date", () => {
  const li = emptySocial({ contentType: "linkedin-post", dueDate: "2026-11-20" });
  assert.deepEqual([li.networks.linkedin.on, li.networks.instagram.on, li.networks.facebook.on], [true, false, false]);
  assert.equal(li.schedule.date, "2026-11-20");
  const all = emptySocial({ contentType: "social-post", dueDate: null });
  assert.deepEqual([all.networks.linkedin.on, all.networks.instagram.on, all.networks.facebook.on], [true, true, true]);
  assert.equal(all.schedule.date, "");
  assert.equal(all.networks.facebook.tags, false, "Facebook posts carry no hashtags by default");
});

test("anything stored opens as a whole post - the first shape, nulls from saves, nonsense", () => {
  const old = normalizeSocial({ v: 1, notes: "an idea" });
  assert.equal(old.notes, "an idea");
  assert.equal(old.networks.linkedin.on, true);
  const odd = normalizeSocial({
    networks: { linkedin: { on: false }, instagram: { on: false, text: null }, facebook: { on: false } },
    hashtags: ["#mro", "MRO", "sealing technology", 7, "#123"],
    media: { kind: "carousel", slides: [{ layout: "weird", headline: "A" }, null], size: "portrait", image: null, card: null },
    link: null, schedule: { date: "tomorrow", time: "9:00" },
  });
  assert.equal(odd.networks.linkedin.on, true, "one network stays on at least");
  assert.deepEqual(odd.hashtags, ["#mro", "#SealingTechnology"], "the same tag in another case is one tag");
  assert.equal(normalizeSocial({ networks: { instagram: null } }).networks.instagram.on, true, "a network cleared by a save takes its default");
  assert.equal(odd.media.slides.length, 2);
  assert.equal(odd.media.slides[0].layout, "statement");
  assert.equal(odd.media.slides[1].id, "s2");
  assert.equal(odd.media.size, "portrait");
  assert.equal(odd.media.card.layout, "cover");
  assert.deepEqual(odd.schedule, { date: "", time: "" });
});

test("hashtags are written the way people write them; a closing line of them comes out of a text", () => {
  assert.equal(cleanTag("sealing technology"), "#SealingTechnology");
  assert.equal(cleanTag("#Dichtungstechnik"), "#Dichtungstechnik");
  assert.equal(cleanTag("industrial-maintenance"), "#IndustrialMaintenance");
  assert.equal(cleanTag("2026"), "");
  assert.equal(cleanTag("   "), "");
  const s = splitTags("A seal rarely fails without warning.\n\nWhich sign do you see most?\n\n#SealingTechnology #MRO\n#Maintenance");
  assert.equal(s.text, "A seal rarely fails without warning.\n\nWhich sign do you see most?");
  assert.deepEqual(s.tags, ["#SealingTechnology", "#MRO", "#Maintenance"]);
  assert.equal(splitTags("We love #MRO work.").text, "We love #MRO work.", "a tag inside a sentence stays");
});

test("the feed's cut: LinkedIn after ~210 characters or three lines, Instagram after 125, at a word", () => {
  const long = "A seal rarely fails without warning. ".repeat(10);
  const li = fold(long, "linkedin");
  assert.ok(li.cut);
  assert.ok(li.shown.length <= 210 && li.shown.length > 150);
  assert.ok(!li.shown.endsWith(" "));
  assert.equal(li.shown + li.hidden, long.trimEnd());
  const lines = fold("One\nTwo\nThree\nFour", "linkedin");
  assert.equal(lines.shown, "One\nTwo\nThree");
  assert.ok(fold(long, "instagram").shown.length <= 125);
  assert.deepEqual(fold("Short.", "facebook"), { shown: "Short.", hidden: "", cut: false });
});

test("what is posted: the link where it works (LinkedIn's in the comment when asked), the hashtags where they are on", () => {
  const d = post({ hashtags: ["#MRO", "#SealingTechnology"], link: { url: "https://www.apsoparts.com/seals", label: "Shop seals:", inComment: false }, firstComment: "Sizes in the shop." });
  d.networks.linkedin.text = "Hook line.";
  d.networks.instagram.text = "Caption.";
  d.networks.facebook.text = "Post.";
  assert.equal(composed(d, "linkedin"), "Hook line.\n\nShop seals: https://www.apsoparts.com/seals\n\n#MRO #SealingTechnology");
  assert.equal(composed(d, "instagram"), "Caption.\n\n#MRO #SealingTechnology", "no link on Instagram");
  assert.equal(composed(d, "facebook"), "Post.\n\nShop seals: https://www.apsoparts.com/seals", "no hashtags on Facebook by default");
  d.link.inComment = true;
  assert.equal(composed(d, "linkedin"), "Hook line.\n\n#MRO #SealingTechnology");
  assert.equal(composedComment(d), "Sizes in the shop.\n\nShop seals: https://www.apsoparts.com/seals");
});

test("before posting: empty texts, too long, hashtag soup, a link on Instagram, the brand's rules, a picture missing", () => {
  const d = post({ hashtags: ["#A", "#B", "#C", "#D", "#E", "#F"] });
  d.networks.linkedin.text = "Save up to 20% this week on every O-ring.";
  d.networks.instagram.text = "See www.apsoparts.com";
  const c = checks(d).map((x) => x.text);
  assert.ok(c.some((t) => t.startsWith("Facebook: no text")));
  assert.ok(c.some((t) => /LinkedIn: 6 hashtags read as hashtag soup/.test(t)));
  assert.ok(c.some((t) => /LinkedIn: No discount values/.test(t)));
  assert.ok(c.some((t) => /Instagram: a link in the caption cannot be clicked/.test(t)));
  assert.ok(c.some((t) => /Instagram needs a picture/.test(t)));
  const ok = post();
  ok.networks.instagram.on = false; ok.networks.facebook.on = false;
  ok.networks.linkedin.text = "A seal rarely fails without warning. It talks first, quietly.";
  assert.deepEqual(checks(ok), []);
  ok.networks.linkedin.text = "x".repeat(3100);
  assert.ok(checks(ok).some((x) => /100 characters over/.test(x.text)));
});

test("a slide is the shop's look at its real size: escaped words, a page counter, the swipe hint on the cover", () => {
  const css = slideCss("aps1");
  for (const sel of css.replace(/@media[^{]*\{/g, "").matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const s of sel[1].split(",")) assert.ok(s.trim().startsWith(".aps1"), `"${s.trim()}" leaks`);
  }
  const s = { id: "1", layout: "cover" as const, eyebrow: "Seals", headline: "Five <signs>", text: "a & b", image: { url: "wysiwyg/1_Sealing_Technology_1.jpg", alt: "Three seals" } };
  const h = slideHtml(s, { prefix: "aps1", w: 1080, h: 1350, index: 0, total: 6 });
  assert.match(h, /width:1080px;height:1350px/);
  assert.match(h, /Five &lt;signs&gt;/);
  assert.match(h, /a &amp; b/);
  assert.match(h, /1 \/ 6/);
  assert.match(h, /aps1-sw/);
  assert.match(h, /src="https:\/\/www\.apsoparts\.com\/media\/wysiwyg\/1_Sealing_Technology_1\.jpg" alt="Three seals"/);
  assert.match(h, /aps1--tall/);
  const card = slideHtml(s, { prefix: "aps1", w: 1200, h: 627, index: 0, total: 1 });
  assert.match(card, /aps1--wide/);
  assert.doesNotMatch(card, /1 \/ 1/, "a single card has no counter");
  const end = slideHtml({ ...s, layout: "end", image: null }, { prefix: "aps1", w: 1080, h: 1080, index: 5, total: 6, linkLabel: "Shop seals" });
  assert.match(end, /Shop seals/);
  assert.doesNotMatch(end, /<img/);
  assert.ok(headSize("Short", "cover", "sq") > headSize("A much longer headline that keeps going and going on", "cover", "sq"));
  assert.ok(headSize("Short", "cover", "wide") < headSize("Short", "cover", "sq"));
  assert.deepEqual(listItems("- one\n• two\n3. three\n\n"), ["one", "two", "three"]);
});

test("the AI's post: hashtags out of the texts, each network's limit, only real slides with the shop's photos", () => {
  const w = cleanWrite({
    linkedin: { text: "**Hook.** Body.\n\n#MRO #SealingTechnology", firstComment: "Sizes here." },
    instagram: { text: "x".repeat(2500) }, facebook: { text: "" }, hashtags: ["mro", "#Maintenance"],
  }, ["linkedin", "instagram", "facebook"]);
  assert.equal(w.texts.linkedin, "Hook. Body.");
  assert.equal(w.texts.instagram?.length, 2200);
  assert.equal(w.texts.facebook, undefined, "an empty text leaves the network as it is");
  assert.deepEqual(w.hashtags, ["#mro", "#Maintenance", "#SealingTechnology"]);
  assert.equal(w.firstComment, "Sizes here.");
  assert.deepEqual(cleanTags(["a", "A", "b", "c", "d", "e", "f"]), ["#a", "#b", "#c", "#d", "#e"]);
  assert.equal(cleanPostText("Caption\n#tag", "instagram").text, "Caption");
  assert.deepEqual(cleanText({ text: "Hi\n\n#One" }, "facebook"), { text: "Hi", hashtags: ["#One"] });
  const c = cleanCarousel({ slides: [
    { layout: "statement", eyebrow: "Seals", headline: "Five signs", text: "", photo: "sealing" },
    { layout: "list", eyebrow: "", headline: "Check", text: "- a\n- b", photo: "invented" },
    { layout: "end", eyebrow: "", headline: "", text: "", photo: "none" },
  ] });
  assert.equal(c.slides.length, 2, "an empty slide is dropped");
  assert.equal(c.slides[0].layout, "cover", "the first is the cover");
  assert.equal(c.slides[0].image?.url, SHOP_PHOTOS[0].url);
  assert.equal(c.slides[1].image, null, "only the shop's photos");
  assert.deepEqual(askedNetworks({ networks: ["instagram", "x", "instagram"] }, ["linkedin"]), ["instagram"]);
  assert.deepEqual(askedNetworks({}, ["linkedin"]), ["linkedin"]);
});

test("the post as text, and the pack to copy by hand", () => {
  const d = post({ hashtags: ["#MRO"], link: { url: "https://www.apsoparts.com/seals", label: "", inComment: false } });
  d.networks.linkedin.text = "Hook.";
  d.networks.instagram.text = "Caption.";
  d.networks.facebook.on = false;
  d.media = { ...d.media, kind: "carousel", slides: [{ id: "a", layout: "cover", eyebrow: "Seals", headline: "Five signs", text: "", image: null }] };
  assert.equal(slidesOf(d).length, 1);
  const t = socialText(d);
  assert.match(t, /^LinkedIn\nHook\./);
  assert.match(t, /Slide 1: Seals - Five signs/);
  assert.doesNotMatch(t, /Facebook/);
  const pack = exportPack(d, "Seal week");
  assert.match(pack, /^Seal week\n=========\n\nTo post on 2026-11-20/);
  assert.match(pack, /--- Instagram ---\nCaption\.\n\n#MRO/);
  assert.match(pack, /the link goes in the bio - https:\/\/www\.apsoparts\.com\/seals/);
  assert.match(pack, /--- Carousel, 1 slides \(Square 1080 × 1080\) ---\n1\. Seals \| Five signs/);
});
