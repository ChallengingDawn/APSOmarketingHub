import assert from "node:assert/strict";
import { test } from "node:test";
import { addItem, emptyFields, setField, type Fields } from "../src/lib/content/studio/kinds/page/fields";
import { NEW_PAGE_CSS, framedPage, pageHtml, renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { FRAME_CSS, PAGE_LAYOUT, ROW_CLASS, SHOP_FONT, framePage, isFramed, oneColumn, unframe } from "../src/lib/content/studio/kinds/page/frame";
import {
  hubPicturesIn, mediaAddress, mediaFileOf, mediaGallerySteps, pictureAddressesIn, pictureState, picturesHold, withMediaAddresses,
  type MediaFile, type MediaHead,
} from "../src/lib/content/studio/kinds/page/media";
import { newModule, normalizeModule, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { MODULES } from "../src/lib/content/studio/kinds/page/modules/registry";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { SAMPLES2 } from "../src/lib/content/studio/kinds/page/modules/library2";
import { magentoRequest, writePage, type Backups, type FetchLike, type StoreRef, type Want } from "../src/lib/convert/cmsPage";

// SARCLA 10.11.2026 on the first page the Page builder put on ACC (Kalrez 6221 and 6230 discontinued): "also on the page
// what the hell" - "can't you see the code we generated for the new homepage?". A new page is now built the home page kit's
// way: ONE Full Width row, no padding, holding ONE HTML Code element, on a one-column page, in the theme's own container;
// one root for the shop's type and colours; every picture address absolute; the hub's pictures checked in the target's
// media before Publish.

const ACC = "https://acc.apsoparts.com";

/** The Kalrez page as SARCLA made it: a hero with the hub's picture, the campaign date module after it, tiles, a poster
 * and a brand spotlight with the shop's product photos. */
function kalrez(): Fields {
  let f = emptyFields();
  f = {
    ...f,
    hero: {
      ...f.hero, eyebrow: "Product change notice", title: "Kalrez® 6221 and 6230 discontinued – evolast® FFKM alternatives",
      sub: "Production of these FFKM compounds is ending.", button: { label: "View evolast® PB794 O-ring", url: "https://www.apsoparts.com/en-INT/10341004-ffkm-o-ring-evolastr-pb794.html" },
      picture: { url: "/api/content/picture/199-abcd1234", alt: "Black FFKM O-rings", idea: "" },
    },
  };
  const b = addItem(f, "benefits"); f = setField(b.fields, `benefits.${b.id}.title`, "Clear last order date");
  const date = newModule("campaign-date", "en-INT", "mdate");
  date.settings = { ...date.settings, eyebrow: "Last order date", title: "Order the affected ==FFKM== O-rings until 27 November 2026", text: "After this date they can only be supplied while stocks last.", extra: { to: "27.11. 2026", "look-text": "w=b" } };
  const brand = newModule("brand-spotlight", "en-INT", "mbrand");
  brand.settings = {
    ...brand.settings, title: "evolast® - the FFKM line", text: "PB794 and PN794 replace Kalrez® 6221 and 6230.",
    feature: null,
    items: [{ kind: "product", name: "FFKM O-ring evolast® PB794", url: "https://www.apsoparts.com/en-INT/10341004-ffkm-o-ring-evolastr-pb794.html", img: "/api/content/picture/7-wxyz9876", meta: "120 articles", number: "10341004", children: [] }],
  };
  return { ...f, order: ["hero", "benefits"], modules: [{ id: "x1", after: "hero", module: date }, { id: "x2", after: "benefits", module: brand }] };
}

/** What the API writes for a page (./shop.ts newPageContent, without the hub's database): framed, absolute pictures. */
function content(f: Fields, base = ACC) {
  const inner0 = pageHtml(renderNewPage(f, { store: "en-INT" }));
  const files = new Map<string, MediaFile>(hubPicturesIn(inner0).map((p) => [p.url, { file: mediaFileOf(p.id, "image/jpeg"), url: p.url }]));
  const inner = withMediaAddresses(inner0, files, base);
  return { inner, content: framePage(inner), files };
}

test("the frame wraps the page once: ONE Full Width row without padding, ONE HTML Code element, the stylesheet and ONE root", () => {
  const { content: c, inner } = content(kalrez());
  assert.equal(c.match(/data-content-type="row"/g)?.length, 1, "one row");
  assert.equal(c.match(/data-content-type="html"/g)?.length, 1, "one HTML Code element");
  assert.match(c, /^<div class="apx-np-row" data-content-type="row" data-appearance="full-width"[^>]*data-element="main" style="[^"]*margin: 0px; padding: 0px;"><div class="row-full-width-inner" data-element="inner"><div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true"/);
  assert.ok(c.endsWith("</div></div></div>"));
  assert.ok(isFramed(c));
  assert.equal(unframe(c), inner, "the hand-over pastes the element's own HTML");
  assert.equal(unframe(inner), inner);
  assert.equal(c.match(/class="apx-np"/g)?.length, 1, "one root");
  assert.ok(inner.startsWith(`<style>\n${FRAME_CSS}\n`), "the frame's rules first");
  assert.equal(inner.match(/<style>/g)?.length, 1 + 2, "the page's stylesheet and each module's own");
  // the preview draws the same: framedPage is what previewOf and the Stage put in the shop's page
  assert.equal(framedPage(renderNewPage(kalrez(), { store: "en-INT" })), framePage(pageHtml(renderNewPage(kalrez(), { store: "en-INT" }))));
  assert.equal(PAGE_LAYOUT, "1column");
});

test("in the theme's column at every width: the theme's container repeated, no width or gutter of the page's own", () => {
  // the theme: width 100 %, 10 px gutters, at most 1170 px from 1200 px on (styles-m: the breadcrumb, the header, a row)
  assert.match(FRAME_CSS, /\.apx-np-row>\.row-full-width-inner\{box-sizing:border-box;width:100%;max-width:none;margin:0 auto;padding:0 10px\}/);
  assert.match(FRAME_CSS, /@media \(min-width:1200px\)\{\.apx-np-row>\.row-full-width-inner\{max-width:1170px\}\}/);
  assert.match(FRAME_CSS, /\.page-layout-3columns[^{]*\.column\.main:has\(\.apx-np-row\)\{width:100%!important/, "a page left in three columns takes the whole width");
  assert.doesNotMatch(NEW_PAGE_CSS, /1180px|\.apx-np \.apx-np-in\{padding:0 20px\}/, "no container of its own any more");
  assert.match(NEW_PAGE_CSS, /\.apx-np \.apx-np-in\{width:100%;max-width:none;margin:0;padding:0\}/);
  assert.match(NEW_PAGE_CSS, /\.apx-np \[data-apx-module\]\{width:100%;max-width:none;margin:40px 0;padding-left:0;padding-right:0\}/, "a module fills the container (its own 1170 px and 10 px are the row's)");
  assert.match(NEW_PAGE_CSS, /box-shadow:0 0 0 100vmax var\(--band\);clip-path:inset\(0 -100vmax\)/, "a band's colour runs to the window's edges (the kit's tools band)");
  assert.equal(ROW_CLASS, "apx-np-row");
});

/** every font and font-family declaration of a stylesheet: [the whole value] */
const fontsIn = (css: string) => [...css.matchAll(/(?:^|[;{\s])font(?:-family)?\s*:\s*([^;{}]+)/g)].map((m) => m[1].trim());
const SYSTEM = /\b(Arial|system-ui|Helvetica|Segoe UI|sans-serif|serif|monospace)\b/i;
/** a font that is the shop's: futura-pt first (Arial only as a fallback after it), the page's token, or inherited */
const shopFont = (v: string) => {
  if (/^(inherit|unset)$/.test(v) || /var\(--(head|apx-head)\b/.test(v)) return true;
  const sys = v.search(SYSTEM);
  const fut = v.search(/futura-pt/i);
  return sys < 0 || (fut >= 0 && fut < sys);
};

test("one root for the type and the colours - no system font anywhere, in the page or in any module", () => {
  // the root: the shop's futura-pt, its petrol, red and text grey - given to every block and module (--apx-*)
  assert.ok(SHOP_FONT.startsWith(`"futura-pt"`));
  assert.match(NEW_PAGE_CSS, new RegExp(`^\\.apx-np\\{--apx-head:${SHOP_FONT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};--apx-red:#d80901;--apx-pet:#274e64;--apx-ink:#1d2326;--apx-txt:#5e5e5e;`));
  assert.match(NEW_PAGE_CSS, /^\.apx-np\{[^}]*font:400 16px\/1\.65 var\(--head\);color:var\(--text\)/);
  for (const v of fontsIn(NEW_PAGE_CSS)) assert.ok(shopFont(v), `the page: ${v}`);
  // every module of the library: its root takes the page's tokens, its words are the shop's type
  let n = 0;
  for (const d of MODULES) {
    const base = newModule(d.id, "de-CH", "mf");
    const m: ModuleRef = normalizeModule({ type: d.id, settings: { ...base.settings, ...(SAMPLES2[d.id]?.("de-CH") ?? {}) } })!;
    const html = renderModule(m);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    assert.match(css, /^\.apx-[a-z0-9]+\{--red:var\(--apx-red,#d80901\);[^}]*--txt:var\(--apx-txt,#5e5e5e\);[^}]*--head:var\(--apx-head,"futura-pt"[^}]*font:400 15px\/1\.55 var\(--head\)/, `${d.id}: its root reads the page's tokens`);
    for (const v of fontsIn(css)) assert.ok(shopFont(v), `${d.id}: a system font - ${v}`);
    n++;
  }
  assert.ok(n >= 100, `every module (${n})`);
  // the Kalrez page's date module: its bold text is the shop's type now (the root's), the page's root around it
  const { inner } = content(kalrez());
  assert.match(inner, /<div class="apx-mdate" data-apx-module="campaign-date">/);
  assert.match(inner, /\.apx-mdate :is\(h1,h2,h3,h4,p,div,span,small,b,strong,em\)\.am-l-text\{font-weight:700!important\}/);
  for (const v of fontsIn(inner.replace(/<svg[\s\S]*?<\/svg>/g, ""))) assert.ok(shopFont(v), `the page as Magento gets it: ${v}`);
});

test("every picture address is absolute: the shop's on www, the hub's at its file in the target's media", () => {
  const f = kalrez();
  const { inner, files } = content(f);
  assert.deepEqual([...files.values()].map((x) => x.file), ["apx-199.jpg", "apx-7.jpg"], "the hero's and a module's hub picture, each once");
  assert.doesNotMatch(inner, /\/api\/content\/picture\//, "no hub address left");
  assert.doesNotMatch(inner, /\{\{\s*media/, "no media directive");
  assert.match(inner, /src="https:\/\/acc\.apsoparts\.com\/media\/wysiwyg\/content\/apx-199\.jpg"/);
  assert.match(inner, /src="https:\/\/acc\.apsoparts\.com\/media\/wysiwyg\/content\/apx-7\.jpg"/);
  const all = pictureAddressesIn(inner);
  assert.ok(all.length >= 2);
  for (const u of all) assert.match(u, /^https:\/\/(www|acc)\.apsoparts\.com\/media\//, `absolute: ${u}`);
  // production: the same page names production's media
  assert.match(content(f, "https://www.apsoparts.com").inner, /src="https:\/\/www\.apsoparts\.com\/media\/wysiwyg\/content\/apx-199\.jpg"/);
  // a media directive (a banner, a pasted block) is the shop's own picture, on www (the kit's absolute_media)
  assert.equal(withMediaAddresses(`<img src="{{media url='wysiwyg/1_ORings.jpg'}}"><i style="background:url({{media url=&quot;wysiwyg/x.png&quot;}})"></i>`, new Map(), ACC),
    `<img src="https://www.apsoparts.com/media/wysiwyg/1_ORings.jpg"><i style="background:url(https://www.apsoparts.com/media/wysiwyg/x.png)"></i>`);
  assert.equal(mediaFileOf(12, "image/png"), "apx-12.png");
  assert.equal(mediaFileOf(12, null), "apx-12.jpg");
  assert.equal(mediaAddress(`${ACC}/`, "apx-12.png"), `${ACC}/media/wysiwyg/content/apx-12.png`);
});

test("the picture check: Magento's placeholder (200, 261,451 bytes, no ETag) is a missing file; Publish waits for it", () => {
  // read 10.11.2026: ACC and production answer a missing media file with the same grey placeholder; a file of their own
  // comes with its ETag and its date
  const placeholder: MediaHead = { status: 200, type: "image/jpeg", length: 261451, etag: "", modified: "" };
  const file: MediaHead = { status: 200, type: "image/jpeg", length: 144736, etag: "\"69eb3a18-23560\"", modified: "Fri, 24 Apr 2026 09:38:32 GMT" };
  assert.equal(pictureState(placeholder, placeholder), "missing");
  assert.equal(pictureState(file, placeholder), "there");
  assert.equal(pictureState({ ...file, length: 261451 }, placeholder), "there", "a file of that size with its own ETag is a file");
  assert.equal(pictureState({ ...file, status: 404 }, placeholder), "missing");
  assert.equal(pictureState({ ...file, type: "text/html" }, placeholder), "missing");
  assert.equal(pictureState(null, placeholder), "unknown");
  assert.equal(pictureState(placeholder, null), "unknown", "without the placeholder's answer a bare picture is not known");
  assert.equal(pictureState(file, null), "there");
  const list = [{ file: "apx-199.jpg", url: "/api/content/picture/199-abcd1234", address: `${ACC}/media/wysiwyg/content/apx-199.jpg`, state: "missing" as const }];
  assert.match(picturesHold(list, "ACC") ?? "", /^1 picture is not in ACC's media yet - the page would show Magento's grey placeholder/);
  assert.equal(picturesHold([{ ...list[0], state: "there" }], "ACC"), null);
  assert.match(picturesHold([{ ...list[0], state: "unknown" }], "ACC") ?? "", /could not be checked in ACC's media - read Magento again/);
  const steps = mediaGallerySteps("ACC", ["apx-199.jpg", "apx-7.jpg"]);
  assert.match(steps[0], /one zip.*apx-199\.jpg, apx-7\.jpg/);
  assert.ok(steps.some((s) => s.includes("Content > Media Gallery")));
  assert.ok(steps.some((s) => /wysiwyg, then content/.test(s)));
  assert.ok(steps.at(-1)!.includes("Read Magento again"));
});

test("the page's layout: one column in Magento, and in the preview's frame", async () => {
  // a fake Magento: the search finds nothing, the POST makes the page
  const calls: { method: string; body: unknown }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (init.method === "GET") return { status: 200, text: async () => JSON.stringify({ items: [] }) };
    return { status: 200, text: async () => JSON.stringify({ id: 901 }) };
  };
  const m = magentoRequest({ base: ACC, fetch, authorize: () => "OAuth test" });
  const backups: Backups = { add: async () => "1", written: async () => undefined, failed: async () => undefined };
  const store: StoreRef = { view: "en-INT", code: "international_eur_en", id: 12 };
  const want: Want = { kind: "page", identifier: "kalrez-6221-6230-discontinued", title: "Kalrez", metaTitle: "Kalrez", metaDescription: "", content: content(kalrez()).content, active: true, layout: PAGE_LAYOUT };
  await writePage(m, { env: "acc", view: "en-INT", store, want, ours: () => false, by: "SARCLA", backups });
  const post = calls.find((c) => c.method === "POST")!.body as { page: Record<string, unknown> };
  assert.equal(post.page.page_layout, "1column");
  assert.ok(isFramed(String(post.page.content)));
  // the preview: the store's page drawn in one column, whatever it was
  assert.equal(oneColumn(`<body id="html-body" class="cms-x cms-page-view page-layout-3columns">`), `<body id="html-body" class="cms-x cms-page-view page-layout-1column">`);
  assert.equal(oneColumn(`<body>`), `<body class="page-layout-1column">`);
});
