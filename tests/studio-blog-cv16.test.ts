import assert from "node:assert/strict";
import { test } from "node:test";
import { blogDoc, publishedOf } from "../src/lib/content/studio/kinds/blog/model";
import { guardPost, ruleBroken } from "../src/lib/content/studio/kinds/blog/guard";
import { doPartAction, partActions } from "../src/lib/content/studio/kinds/blog/elements";
import { cardPictures, followStore, livePathsIn, isLive, pagesOf, picturesIn, postFollowsStore, postPictures, publishedFrom, withStored } from "../src/lib/content/studio/kinds/blog/publish";

// cv16 (SARCLA 11.11.2026: "compare the evolution of this page to the other content types and improve them") - the blog
// brought up to the Page builder where it fits a post. Made-up words.

const post = () => blogDoc({
  title: "EPDM or FKM?", slug: "epdm-or-fkm", store: "de-CH", language: "DE", author: "Claudio Saraiva", excerpt: "Es kommt auf das Medium an.",
  hero: { url: "/api/content/picture/12-abcd", alt: "O-Ringe auf einer Werkbank", caption: "", prompt: "o-rings on a bench" },
  sections: [
    { id: "a", heading: "Kurz", body: "Erster Absatz.\n\n- Dampf\n- CIP\n\nDritter Absatz mit [Link](/de-CH/o-ringe).", quote: "Hitze altert Gummi.", image: { url: "/api/content/picture/13-efgh", alt: "", caption: "Unter dem Bild", prompt: "a seal in a pump" } },
    { id: "b", heading: "Temperaturen", body: "Zweiter.", quote: "" },
  ],
  faq: [{ id: "f1", q: "Beides?", a: "Nein." }, { id: "f2", q: "Und?", a: "Siehe [hier](https://www.apsoparts.com/de-CH/dichtungen)." }],
  relatedProducts: [{ id: "p1", name: "EPDM O-Ringe", url: "https://www.apsoparts.com/de-CH/o-ringe-epdm" }, { id: "p2", name: "FKM", url: "/de-CH/fkm" }],
  cta: { title: "", text: "", label: "", url: "https://www.apsoparts.com/de-CH/" },
  tags: ["O-Ringe", "Lebensmittel"],
});

test("the shop's word rules on an AI text: stock, delivery, prices, discounts, Chemours go - sentence by sentence", () => {
  const src = "the brief";
  assert.equal(ruleBroken("Alle Grössen ab Lager.", src), "a stock or delivery promise");
  assert.equal(ruleBroken("We ship within 48 hours.", src), "a stock or delivery promise");
  assert.equal(ruleBroken("Next-day delivery across Europe.", src), "a stock or delivery promise");
  assert.equal(ruleBroken("A kit costs CHF 12.50.", src), "a price");
  assert.equal(ruleBroken("Now 20% off all O-rings.", src), "a discount value");
  assert.equal(ruleBroken("Viton is made by Chemours.", src), "Chemours named");
  // general engineering facts stay: a percentage, a temperature, a norm, a test duration
  assert.equal(ruleBroken("EPDM swells by about 5 % in hot water.", src), null);
  assert.equal(ruleBroken("ISO 3601 gives the sizes; the compression set is read after 22 h at 150 °C.", src), null);
  const g = guardPost("EPDM suits hot water. All sizes are in stock. FKM suits oil.\n\n- steam\n- available in 24 hours\n\n| Medium | Price |\n|---|---|\n| Water | CHF 3 |\n| Oil | ask |", src);
  assert.equal(g.text, "EPDM suits hot water. FKM suits oil.\n\n- steam\n\n| Medium | Price |\n|---|---|\n| Oil | ask |");
  assert.equal(g.said.length, 3);
  assert.match(g.said[0], /left out \(a stock or delivery promise\)/);
});

test("a certificate claimed for us needs a source; explaining one stays", () => {
  assert.match(ruleBroken("Our EPDM O-rings are FDA compliant.", "brief: hot water seals") ?? "", /FDA claimed for us/);
  assert.equal(ruleBroken("Our EPDM O-rings are FDA compliant.", "brief: FDA compliant seals for dairies"), null);
  assert.equal(ruleBroken("FDA 21 CFR 177.2600 lists the ingredients a rubber in contact with food may hold.", "brief"), null);
  assert.match(ruleBroken("Unsere Dichtungen sind KTW-zugelassen.", "brief") ?? "", /KTW/);
});

test("the label over a picked part: move, duplicate and take out a block, a section, a question, a product", () => {
  const d = post();
  assert.deepEqual(partActions(d, "s:a:b:0"), { up: false, down: true, duplicate: true, remove: true, what: "block" });
  assert.deepEqual(partActions(d, "s:a:b:2"), { up: true, down: false, duplicate: true, remove: true, what: "block" });
  assert.equal(partActions(d, "title").remove, false);
  let r = doPartAction(d, "s:a:b:0", "down");
  assert.equal(r.doc.sections[0].body, "- Dampf\n- CIP\n\nErster Absatz.\n\nDritter Absatz mit [Link](/de-CH/o-ringe).");
  assert.equal(r.key, "s:a:b:1");
  r = doPartAction(d, "s:a:b:1", "duplicate");
  assert.equal(r.doc.sections[0].body, "Erster Absatz.\n\n- Dampf\n- CIP\n\n- Dampf\n- CIP\n\nDritter Absatz mit [Link](/de-CH/o-ringe).");
  r = doPartAction(d, "s:a:b:1", "remove");
  assert.equal(r.doc.sections[0].body, "Erster Absatz.\n\nDritter Absatz mit [Link](/de-CH/o-ringe).");
  assert.equal(r.key, null);
  r = doPartAction(d, "s:b:h", "up");
  assert.deepEqual(r.doc.sections.map((s) => s.id), ["b", "a"]);
  r = doPartAction(d, "s:a:h", "duplicate");
  assert.equal(r.doc.sections.length, 3);
  assert.equal(r.doc.sections[1].heading, "Kurz");
  assert.notEqual(r.doc.sections[1].id, "a");
  assert.equal(r.key, `s:${r.doc.sections[1].id}:h`);
  r = doPartAction(d, "faq:f2:a", "up");
  assert.deepEqual(r.doc.faq.map((f) => f.id), ["f2", "f1"]);
  r = doPartAction(d, "prod:p1", "remove");
  assert.deepEqual(r.doc.relatedProducts.map((x) => x.id), ["p2"]);
  r = doPartAction(d, "s:a:q", "remove");
  assert.equal(r.doc.sections[0].quote, "");
  // an action the part cannot do changes nothing
  assert.equal(doPartAction(d, "s:a:b:0", "up").doc, d);
});

test("the pictures in the hub's picture storage: the post's own and the home's, named at their address in the paste", () => {
  const d = post();
  assert.deepEqual(postPictures(d), [{ url: "/api/content/picture/12-abcd", words: "O-Ringe auf einer Werkbank" }, { url: "/api/content/picture/13-efgh", words: "a seal in a pump" }]);
  assert.deepEqual(cardPictures([{ hero: { url: "https://shop/x.jpg", alt: "" }, title: "x" }, { hero: { url: "/api/content/picture/14-ijkl", alt: "" }, title: "Other post" }]), [{ url: "/api/content/picture/14-ijkl", words: "Other post" }]);
  assert.deepEqual(picturesIn([{ url: "https://hub.example/api/content/picture/12-abcd", words: "w" }, { url: "/etc/passwd" }, { url: "/api/content/picture/12-abcd" }]).map((x) => x.id), [12]);
  const code = `<img src="https://hub.example/api/content/picture/12-abcd" alt="x"><img src="/api/content/picture/99-zzzz">"image":["https://hub.example/api/content/picture/12-abcd"]`;
  const out = withStored(code, new Map([["/api/content/picture/12-abcd", "https://cdn.example/content/o-ringe-auf-einer-werkbank-12.jpg"]]));
  assert.equal(out, `<img src="https://cdn.example/content/o-ringe-auf-einer-werkbank-12.jpg" alt="x"><img src="/api/content/picture/99-zzzz">"image":["https://cdn.example/content/o-ringe-auf-einer-werkbank-12.jpg"]`);
});

test("the post's pages read on the shop, and the record the Content library shows", () => {
  const d = post();
  const pages = pagesOf(d);
  assert.deepEqual(pages.map((p) => p.path), ["/de-CH/blog/epdm-or-fkm", "/de-CH/blog", "/de-CH/blog/tag/o-ringe", "/de-CH/blog/tag/lebensmittel"]);
  assert.deepEqual(livePathsIn([...pages.map((p) => p.path), "https://evil/", "/de-CH/checkout", "/de-CH/blog/a/b/c"]), pages.map((p) => p.path));
  assert.equal(isLive(200, '<article class="apx-blog apx-post">'), true);
  assert.equal(isLive(200, "<html>home</html>"), false);
  assert.equal(isLive(404, '<article class="apx-blog">'), false);
  const rec = publishedFrom(pages, [{ path: "/de-CH/blog/epdm-or-fkm", url: "", status: 200, live: true }, { path: "/de-CH/blog", url: "", status: 404, live: false }], "2026-11-11T18:00:00Z", "sarcla");
  assert.deepEqual(rec, { at: "2026-11-11T18:00:00Z", by: "sarcla", pages: [{ label: "The post", path: "/de-CH/blog/epdm-or-fkm", url: "https://www.apsoparts.com/de-CH/blog/epdm-or-fkm" }] });
  assert.equal(publishedFrom(pages, [], "x", "y"), null);
  // kept with the post through its normalisation, put right on the way in
  assert.deepEqual(blogDoc({ ...post(), published: rec }).published, rec);
  assert.equal(publishedOf({ pages: [{ path: "https://evil" }] }), null);
});

test("a translation's links follow the language: the text, the questions, the band, the products", () => {
  assert.equal(followStore("See [O-rings](/de-CH/o-ringe) and https://www.apsoparts.com/de-CH/ - not /de-CHX/.", "de-CH", "fr-CH"), "See [O-rings](/fr-CH/o-ringe) and https://www.apsoparts.com/fr-CH/ - not /de-CHX/.");
  const d = postFollowsStore(post(), "de-CH", "fr-CH");
  assert.match(d.sections[0].body, /\(\/fr-CH\/o-ringe\)/);
  assert.equal(d.faq[1].a, "Siehe [hier](https://www.apsoparts.com/fr-CH/dichtungen).");
  assert.equal(d.cta.url, "https://www.apsoparts.com/fr-CH/");
  assert.deepEqual(d.relatedProducts.map((p) => p.url), ["https://www.apsoparts.com/fr-CH/o-ringe-epdm", "/fr-CH/fkm"]);
});
