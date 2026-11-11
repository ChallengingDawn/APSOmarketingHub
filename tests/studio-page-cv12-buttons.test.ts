import assert from "node:assert/strict";
import { test } from "node:test";
import { newModule, normalizeModule, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { MODULES } from "../src/lib/content/studio/kinds/page/modules/registry";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { SAMPLES2 } from "../src/lib/content/studio/kinds/page/modules/library2";
import { TILE_KEY, tileWordsOf } from "../src/lib/content/studio/kinds/page/modules/tilewords";
import { moduleFieldEdit, moduleFieldLabel, moduleWordsAt, moduleWordsEdit, sameWords } from "../src/lib/content/studio/kinds/page/blocklist";

// Content v12 (SARCLA 10.11.2026, 23:10): "on some bento I cannot edit the button". A click on a module's words opens the
// popup of the setting that holds them - its button's (words, page, look), its headline's, a date's - found by the words
// the page shows (lib .../blocklist.ts moduleWordsAt). They were missed where the page shows them otherwise than the
// setting holds them: the library's part 2 draws "O-Ring" with a hyphen that never breaks (U+2011), a small line above is
// in capitals (innerText gives "DICHTUNGSTECHNIK"), a date in two lines. And a tile's "Alle anzeigen" (a bento's big tile,
// a column, a wide card) was nobody's setting. This walks EVERY module of the library, in every layout, and checks that
// every button drawn from a setting maps to that setting, and every tile's button to its own words.

/** A tiny HTML reader: the elements, each with its tag, class, text (as textContent) and the link it is inside. */
type El = { tag: string; cls: string; text: string; href: string | null; kids: El[]; parent: El | null };
const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "source", "wbr", "col", "area"]);
const decode = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
function parse(html: string): El[] {
  const body = html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
  const root: El = { tag: "#root", cls: "", text: "", href: null, kids: [], parent: null };
  const all: El[] = [];
  let cur = root;
  for (const m of body.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>|([^<]+)/gi)) {
    if (m[4] !== undefined) { for (let e: El | null = cur; e; e = e.parent) e.text += decode(m[4]); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) { if (cur.tag === tag && cur.parent) cur = cur.parent; continue; }
    const attrs = m[3] ?? "";
    const own = /\shref="([^"]*)"/.exec(attrs)?.[1] ?? null;
    const el: El = { tag, cls: /\sclass="([^"]*)"/.exec(attrs)?.[1] ?? "", text: "", href: tag === "a" ? decode(own ?? "") : cur.href, kids: [], parent: cur };
    cur.kids.push(el);
    all.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(attrs)) cur = el;
  }
  return all;
}

const B = "https://www.apsoparts.com/de-CH/";
const prod = (n: number) => ({ kind: "product" as const, name: `Produkt ${n}`, url: `${B}produkt-${n}.html`, img: `https://www.apsoparts.com/media/catalog/product/p${n}.jpg`, meta: `${10 + n} Artikel`, number: `1140010${n}`, children: [] });
const cat = (n: number) => ({ kind: "category" as const, name: `Kategorie ${n}`, url: `${B}kategorie-${n}.html`, img: `https://www.apsoparts.com/media/wysiwyg/c${n}.jpg`, meta: `${100 + n} Produkte`, number: "", children: [prod(n * 10 + 1), prod(n * 10 + 2)] });
// words that the page shows otherwise than the setting holds them: "O-Ring" and "70-02" (part 2 never breaks them)
const LINK = { label: "Zu den O-Ringen 70-02", url: `${B}erster-knopf.html` };
const LINK2 = { label: "Alle X-Ringe", url: `${B}zweiter-knopf.html` };

/** A module as a page holds it: the gallery's sample, the shop's products or categories, a picture, and both buttons. */
function sample(id: string, layout?: string): ModuleRef {
  const d = MODULES.find((x) => x.id === id)!;
  const m = newModule(id, "de-CH", "mtest");
  const s = { ...m.settings, ...(d.sample ?? {}), ...(SAMPLES2[id]?.("de-CH") ?? {}) } as ModuleRef["settings"];
  if (d.takes === "products" && !s.items.length) s.items = Array.from({ length: Math.max(d.min, Math.min(d.max || 6, 6)) }, (_, i) => prod(i + 1));
  if (d.takes === "categories" && !s.items.length) s.items = Array.from({ length: Math.max(d.min, Math.min(d.max || 6, 6)) }, (_, i) => cat(i + 1));
  if (d.needs.includes("picture") && !s.feature) s.feature = cat(9);
  if (!s.title) s.title = "Der Titel";
  if (d.fields.some((f) => f.kind === "link")) s.link = { ...LINK };
  if (d.fields.some((f) => f.kind === "link2")) s.link2 = { ...LINK2 };
  if (layout !== undefined) s.layout = layout;
  return normalizeModule({ type: id, settings: s })!;
}

/** The deepest elements whose words are these (a button, or the words inside it). */
const drawn = (els: El[], words: string) => els.filter((e) => sameWords(e.text, words) && !e.kids.some((k) => sameWords(k.text, words)));

// a module whose button is not drawn as words of its own: the whole teaser is the link, its words only its label for a
// screen reader (aria-label) - a click on it opens the module's settings, where its button is
const NOT_AS_WORDS = new Set(["media-video"]);

test("every module's button, in every layout, opens its own button's popup - words as the page shows them (U+2011, capitals)", () => {
  let checked = 0;
  const missing: string[] = [];
  for (const d of MODULES) {
    const fields = (["link", "link2"] as const).filter((f) => d.fields.some((x) => x.kind === f));
    if (!fields.length) continue;
    const layouts = d.layouts.length ? d.layouts.map((l) => l.key) : [undefined];
    let seen = { link: false, link2: false };
    // as the gallery fills it - and without its list, for a button drawn only in its place ("Or one download button")
    const tries = layouts.flatMap((l) => [sample(d.id, l), { ...sample(d.id, l), settings: { ...sample(d.id, l).settings, faq: [], points: [] } }]);
    for (const m of tries) {
      const l = m.settings.layout;
      const els = parse(renderModule(m));
      for (const f of fields) {
        const label = m.settings[f].label;
        for (const el of drawn(els, label)) {
          seen = { ...seen, [f]: true };
          checked++;
          // as the browser reads it (innerText): the page's own characters - and in capitals where the CSS writes them so
          for (const was of [el.text, el.text.toUpperCase()]) {
            const hit = moduleWordsAt(m, was, el.href);
            assert.equal(hit?.field, f, `${d.id}${l ? `/${l}` : ""}: <${el.tag} class="${el.cls}"> "${el.text}" (link ${el.href}) maps to ${hit?.field ?? "nothing"}, not its ${f}`);
            assert.equal(hit?.words, label, `${d.id}: the popup shows the setting's own words`);
          }
          // and what is typed there goes into that button
          const next = moduleWordsEdit(m, el.text.toUpperCase(), "Neue Worte", el.href);
          assert.equal(next?.module.settings[f].label, "Neue Worte", `${d.id}: the edit lands in its ${f}`);
        }
      }
    }
    for (const f of fields) if (!seen[f] && !NOT_AS_WORDS.has(d.id)) missing.push(`${d.id}.${f}`);
  }
  assert.ok(checked > 100, `${checked} buttons checked`);
  // a module offering a button it never draws as words would leave its popup out of reach on the page
  assert.deepEqual(missing, [], `buttons not drawn as words: ${missing.join(", ")}`);
});

test("every tile's button (a bento's 'Alle anzeigen', a card's 'Zum Produkt') opens its words, kept in the module", () => {
  let checked = 0;
  for (const d of MODULES) {
    const layouts = d.layouts.length ? d.layouts.map((l) => l.key) : [undefined];
    for (const l of layouts) {
      const m = sample(d.id, l);
      const tiles = tileWordsOf("de-CH", {});
      const els = parse(renderModule(m));
      for (const el of els) {
        if (!el.href || el.kids.length) continue;
        const k = (Object.keys(tiles) as (keyof typeof tiles)[]).find((x) => sameWords(el.text, tiles[x]));
        if (!k) continue;
        const hit = moduleWordsAt(m, el.text, el.href);
        // the module's own button may say the same words and lead to the same page: then it is that button
        if (hit?.field === "link" || hit?.field === "link2") continue;
        checked++;
        assert.equal(hit?.field, `words.${k}`, `${d.id}${l ? `/${l}` : ""}: "${el.text}" in <${el.tag} class="${el.cls}"> maps to ${hit?.field ?? "nothing"}`);
        assert.equal(moduleFieldLabel(m, hit!.field), "The tiles' button");
        const next = moduleFieldEdit(m, hit!.field, "Alle Dichtungen");
        assert.equal(next?.settings.extra[TILE_KEY(k)], "Alle Dichtungen", d.id);
        assert.match(renderModule(next!), /Alle Dichtungen/, `${d.id}: drawn with its own words`);
        // empty again: the shop's words
        assert.equal(moduleFieldEdit(next!, hit!.field, "")?.settings.extra[TILE_KEY(k)], undefined, d.id);
      }
    }
  }
  assert.ok(checked >= 10, `${checked} tile buttons checked`);
});

test("SARCLA's bento: the big tile's 'View all' is the tile's words, not the module's empty link of the same words", () => {
  const m = newModule("bento", "en-INT", "mbento");
  const s = { ...m.settings, title: "Products", items: [prod(1), prod(2), prod(3), prod(4)], feature: cat(1) };
  const b = normalizeModule({ type: "bento", settings: s })!;
  assert.equal(b.settings.link.label, "View all", "the module's own link starts with the same words, no page");
  const big = parse(renderModule(b)).find((e) => e.cls === "am-go")!;
  assert.equal(big.text, "View all");
  assert.equal(moduleWordsAt(b, big.text, big.href)?.field, "words.all");
  const next = moduleWordsEdit(b, big.text, "All O-rings", big.href)!;
  assert.match(renderModule(next.module), /<span class="am-go">All O-rings<\/span>/);
  assert.equal(next.module.settings.link.label, "View all", "the link at the top right untouched");
});

test("a module's words open their own setting: capitals, red words, a date in two lines, a date's setting by its name", () => {
  const m = sample("campaign-date");
  assert.equal(moduleWordsAt(m, "BLACK FRIDAY")?.field, "eyebrow");
  assert.equal(moduleWordsAt(m, "BLACK FRIDAY")?.words, "Black Friday");
  assert.equal(moduleWordsAt(m, "Ihr persönliches Black-Friday-Angebot")?.field, "title");
  assert.equal(moduleWordsAt(m, "Ihr persönliches Black-Friday-Angebot")?.words, "Ihr persönliches Black-Friday-Angebot", "without its red marks");
  assert.equal(moduleWordsAt(m, "06.12.\n2026")?.field, "extra.to");
  assert.equal(moduleWordsAt(m, "16.11.")?.field, "extra.from");
  assert.equal(moduleFieldLabel(m, "extra.to"), "Ends (e.g. 06.12.2026)");
  assert.equal(moduleFieldLabel(m, "title"), "Headline");
  assert.equal(moduleWordsAt(m, "Produkt 1"), null, "the shop's words are none of its settings");
  // a red word kept red when the headline is written again
  assert.equal(moduleWordsEdit(m, "IHR PERSÖNLICHES BLACK-FRIDAY-ANGEBOT", "Ihr persönliches Angebot")?.module.settings.title, "Ihr ==persönliches== Angebot");
});
