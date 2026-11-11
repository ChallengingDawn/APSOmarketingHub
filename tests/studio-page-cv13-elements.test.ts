import assert from "node:assert/strict";
import { test } from "node:test";
import { newModule, normalizeModule, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { addOptions, addPart, addPicture, partAt, partInfo, partsOf, takeOutPart, withPartLook, withPartPicture, withPartUrl, withPartWords, type Probe } from "../src/lib/content/studio/kinds/page/modules/elements";
import { addsOf } from "../src/lib/content/studio/kinds/page/modules/adds";
import { groundOf, groundsOfModule, isLookKey, withGroundOf } from "../src/lib/content/studio/kinds/page/modules/looks";
import { moduleWordsAt } from "../src/lib/content/studio/kinds/page/blocklist";
import { nowWords } from "../src/lib/content/studio/kinds/page/modules/words";

// Content v13 (SARCLA 11.11.2026, screenshot 25 - the popup of a "Campaign with its dates" with all its words as fields):
// "still confusing - can not change the background of some block. You should allow editing per element, therefore also
// the AI per element, like a text, a button. I should be able to add another button, take out elements ... Allow element
// create inside of the block."

const B = "https://www.apsoparts.com";
const dated = (): ModuleRef => {
  const m = newModule("campaign-date", "en-INT", "mcamp");
  return normalizeModule({ ...m, settings: { ...m.settings, eyebrow: "Last order date", title: "Order the affected ==FFKM== O-rings until 27 November 2026",
    text: "After this date, the discontinued compounds can only be supplied while stocks last.", link: { label: "To the FFKM O-rings", url: `${B}/en-INT/ffkm.html` },
    extra: { to: "27.11.2026" }, feature: { kind: "category", name: "O-rings", url: `${B}/en-INT/o-rings.html`, img: `${B}/media/wysiwyg/orings.jpg`, meta: "", number: "", children: [] } } })!;
};
const probe = (p: Partial<Probe>): Probe => ({ tag: "p", text: "", words: false, href: null, src: null, inLink: null, cls: "", srcs: [], hrefs: [], ...p });

test("a click is the element it landed on: its headline, its line, its button, its date, its picture", () => {
  const m = dated();
  assert.equal(partAt(m, probe({ tag: "h2", text: "Order the affected FFKM O-rings until 27 November 2026", words: true })), "title");
  assert.equal(partAt(m, probe({ tag: "p", text: "LAST ORDER DATE", words: true })), "eyebrow", "a small line drawn in capitals");
  assert.equal(partAt(m, probe({ tag: "a", text: "To the FFKM O-rings", words: true, href: "/en-INT/ffkm.html" })), "link");
  assert.equal(partAt(m, probe({ tag: "b", text: "27.11.\n2026", words: true })), "extra.to", "a date drawn in two lines");
  assert.equal(partAt(m, probe({ tag: "img", src: `http://localhost/media/wysiwyg/orings.jpg` })), "feature");
  assert.equal(partAt(m, probe({ tag: "div", srcs: [`${B}/media/wysiwyg/orings.jpg`] })), "feature", "the box around the picture");
  assert.equal(partAt(m, probe({ tag: "div", text: "27.11. 2026 Order the affected...", words: false })), null, "the module's own ground: the whole block");
});

test("a product card of the shop, a point, a question, a cell are each an element", () => {
  const prod = (n: number) => ({ kind: "product" as const, name: `O-Ring ${n}`, url: `${B}/en-INT/p${n}.html`, img: `${B}/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/p${n}.jpg`, meta: "", number: "", children: [] });
  const row = normalizeModule({ ...newModule("row", "en-INT", "mrow1"), settings: { ...newModule("row", "en-INT", "mrow1").settings, title: "O-rings", items: [prod(1), prod(2), prod(3), prod(4)] } })!;
  assert.equal(partAt(row, probe({ tag: "a", href: "/en-CH/p3.html", srcs: [] })), "items.2", "its link, in another store view");
  assert.equal(partAt(row, probe({ tag: "img", src: `${B}/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/p2.jpg` })), "items.1", "its sharp photo");
  assert.equal(partAt(row, probe({ tag: "b", text: "O-Ring 4", words: true })), null, "a product's name is the shop's: the card around it is the element");
  assert.equal(partInfo(row, "items.1")!.kind, "item");
  const out = takeOutPart(row, "items.1")!;
  assert.deepEqual(out.module.settings.items.map((c) => c.name), ["O-Ring 1", "O-Ring 3", "O-Ring 4"]);

  const faq = normalizeModule({ ...newModule("faq", "en-INT", "mfaq1"), settings: { ...newModule("faq", "en-INT", "mfaq1").settings, faq: [{ q: "Until when?", a: "Until 27 November 2026." }, { q: "Which compounds?", a: "6221 and 6230." }] } });
  if (faq) {
    assert.equal(partAt(faq, probe({ tag: "summary", text: "Which compounds?", words: true })), "faq.1.q");
    assert.equal(partAt(faq, probe({ tag: "details", text: "Which compounds?\n6221 and 6230." })), "faq.1", "the box of one question");
    assert.equal(partAt(faq, probe({ tag: "div", text: "Until when?\nUntil 27 November 2026.\nWhich compounds?\n6221 and 6230." })), null, "the list of all: none");
  }
});

test("every element's words change on their own; the AI's words land in the element only", () => {
  const m = dated();
  assert.equal(withPartWords(m, "title", "A new headline")!.settings.title, "A new headline");
  assert.equal(withPartWords(m, "extra.to", "30.11.2026")!.settings.extra.to, "30.11.2026");
  assert.equal(withPartWords(m, "extra.from", "")!.settings.extra.from, undefined, "an empty date is not drawn");
  assert.equal(withPartWords(m, "link", "To the O-rings")!.settings.link.label, "To the O-rings");
  assert.equal(withPartUrl(m, "link", "/en-INT/o-rings.html")!.settings.link.url, "/en-INT/o-rings.html");
  const info = partInfo(m, "text")!;
  assert.equal(info.kind, "words");
  assert.ok(info.multiline);
  assert.equal(partInfo(m, "link")!.kind, "button");
});

test("Add: a 3rd and a 4th button, a line, a small line, a headline - drawn in the module and in Magento's copy", () => {
  let m = dated();
  const keys = addOptions(m).map((o) => o.key);
  assert.ok(keys.includes("button") && keys.includes("text") && keys.includes("title") && keys.includes("eyebrow"));
  assert.ok(keys.includes("extra.from"), "its empty start date can be added");
  // its own second button is free? campaign-date has one button: the next goes inside, outlined
  const b1 = addPart(m, "button") as { module: ModuleRef; part: string };
  assert.match(b1.part, /^add\.x/);
  m = b1.module;
  const b2 = addPart(m, "button") as { module: ModuleRef; part: string };
  m = b2.module;
  assert.equal((m.settings.adds ?? []).filter((a) => a.kind === "button").length, 2);
  m = withPartWords(m, b2.part, "Ask our team")!;
  m = withPartUrl(m, b2.part, "/en-INT/contact")!;
  const t = addPart(m, "text") as { module: ModuleRef; part: string };
  m = withPartWords(t.module, t.part, "Other compounds: case by case.")!;
  const html = renderModule(m);
  assert.match(html, /class="[^"]*am-x-[a-z0-9]+[^"]*am-xb"[^>]*>Learn more<\/a>/, "the 3rd button, in the store view's words");
  assert.match(html, />Ask our team<\/a>/, "the 4th");
  assert.match(html, /<p class="am-x am-x-[a-z0-9]+ am-xt">Other compounds: case by case\.<\/p>/);
  // it stands after the module's own button, not at the end of the module
  assert.ok(html.indexOf("Ask our team") < html.indexOf('class="am-dp"') && html.indexOf("Ask our team") > html.indexOf(">To the FFKM O-rings</a>"), "inside the words' column, before the picture");
  // normalized again (a document saved and opened): the same elements
  const again = normalizeModule(JSON.parse(JSON.stringify(m)))!;
  assert.deepEqual(again.settings.adds, m.settings.adds);
  // a click on it finds it; its popup; its look; out again
  const id = b2.part.slice(4);
  assert.equal(partAt(m, probe({ tag: "a", text: "Ask our team", words: true, cls: `am-btn am-x am-x-${id} am-xb` })), b2.part);
  assert.equal(partInfo(m, b2.part)!.kind, "button");
  const looked = withPartLook(m, b2.part, "s=filled;c=petrol")!;
  assert.match(renderModule(looked), new RegExp(`a\\.am-x-${id}\\{[^}]*background:#274e64`));
  const out = takeOutPart(m, b2.part)!;
  assert.equal(out.label, "Take the button out");
  assert.ok(!renderModule(out.module).includes("Ask our team"));
});

test("Add on a module whose own setting is free fills that setting first; a point, a question where it has a list", () => {
  const m = normalizeModule({ ...newModule("campaign-date", "en-INT", "mc2"), settings: { ...newModule("campaign-date", "en-INT", "mc2").settings, title: "A campaign" } })!;
  const e = addPart(m, "eyebrow") as { module: ModuleRef; part: string };
  assert.equal(e.part, "eyebrow");
  assert.equal(e.module.settings.eyebrow, "Topic");
  const b = addPart(m, "button") as { module: ModuleRef; part: string };
  assert.equal(b.part, "link", "its own empty button takes it");
  assert.ok(b.module.settings.link.url, "with a page of the shop, so it shows");
  assert.deepEqual(addPart(m, "picture"), { pick: "feature" }, "a picture where it takes one: which one is asked");
  const pic = withPartPicture(m, "feature", { url: "/api/content/picture/12-abcd" })!;
  assert.equal(pic.settings.feature!.img, "/api/content/picture/12-abcd");
  assert.equal(pic.settings.feature!.from, "person");

  const trio = newModule("campaign-trio", "en-INT", "mtrio");
  const p = addPart(trio, "point") as { module: ModuleRef; part: string };
  assert.equal(p.part, "points.0.title");
  assert.equal(p.module.settings.points.length, 1);
  assert.ok(addOptions(trio).some((o) => o.key === "point" && o.label === "A teaser"));
});

test("an added picture where the module takes none; old documents open unchanged", () => {
  const m = newModule("campaign-trio", "en-INT", "mtr2");
  assert.deepEqual(addPart(m, "picture"), { pick: "add" });
  const r = addPicture(m, { url: "/api/content/picture/7-wxyz", alt: "Seals" })!;
  assert.match(renderModule(r.module), /<figure class="am-x am-x-[a-z0-9]+ am-xp"><img src="\/api\/content\/picture\/7-wxyz" alt="Seals"/);
  // a module saved before Content v13: no `adds` at all, the same HTML
  const old = dated();
  assert.equal(old.settings.adds, undefined);
  assert.equal(renderModule(normalizeModule(JSON.parse(JSON.stringify(old)))!), renderModule(old));
  assert.deepEqual(addsOf([{ id: "bad id", kind: "button" }, { id: "xok12", kind: "nope" }, { id: "xok13", kind: "text", text: "Hi", url: "javascript:alert(1)" }]), [{ id: "xok13", kind: "text", text: "Hi", url: "", img: "", look: "" }]);
});

test("Background: petrol on the module's own panel, its words switched to white, kept in the module's settings", () => {
  const m = dated();
  const p = withGroundOf(m, { color: "petrol" });
  assert.equal(p.settings.extra.bg, "petrol");
  assert.deepEqual(groundOf(p), { color: "petrol", picture: "" });
  assert.deepEqual(groundsOfModule(p), ["#274e64"]);
  const html = renderModule(p);
  assert.match(html, /\.apx-mcamp \.am-da\{background:#274e64!important;--ink:#ffffff/, "on the campaign's own grey card");
  assert.ok(!renderModule(m).includes("#274e64!important"), "none until asked");
  // a white card inside keeps its dark words
  const row = normalizeModule({ ...newModule("row", "en-INT", "mrow2"), settings: { ...newModule("row", "en-INT", "mrow2").settings, title: "O-rings", extra: { bg: "#1b3a4b" } } })!;
  assert.match(renderModule(row), /\.apx-mrow2 \.am-pc\{--ink:#1d2326/);
  // a picture under it: the hub's own address, white words
  const pic = withGroundOf(m, { picture: "/api/content/picture/9-abcd" });
  assert.match(renderModule(pic), /url\("\/api\/content\/picture\/9-abcd"\)/);
  assert.equal(withGroundOf(pic, { color: null, picture: null }).settings.extra.bgpic, undefined, "back to the shop's own");
  assert.equal(withGroundOf(m, { color: "#zzzzzz" }).settings.extra.bg, undefined, "not a colour: none");
  // a ground is never words: no click lands on it, the AI is never told it
  assert.ok(isLookKey("bg") && isLookKey("bgpic") && isLookKey("w-all") && !isLookKey("to"));
  assert.equal(moduleWordsAt(p, "petrol"), null);
  assert.ok(!(nowWords(p).extras as { key: string }[]).some((e) => e.key === "bg"));
});

test("the block popup lists what is in it, in order", () => {
  const m = dated();
  const parts = partsOf(m).map((p) => p.part);
  assert.deepEqual(parts.slice(0, 2), ["extra.to", "eyebrow"]);
  assert.ok(parts.includes("title") && parts.includes("link") && parts.includes("feature"));
  assert.equal(takeOutPart(m, "title"), null, "a module that stands on its headline keeps it");
});
