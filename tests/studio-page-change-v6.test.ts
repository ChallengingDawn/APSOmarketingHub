import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChanges } from "../src/lib/content/studio/kinds/page/apply";
import { finalChanges, insertChange, isLive, pageDoc, replaceChange, withChange, type PageChange } from "../src/lib/content/studio/kinds/page/model";
import { magentoRequest, writePage, type BackupIn, type Backups, type FetchLike, type StoreRef } from "../src/lib/convert/cmsPage";
import { applyToCms, withoutOwnWork } from "../src/lib/convert/ship";

// Content v6 (SARCLA 09.11.2026, point 10): "IF we can change the current element, the proposal when applied hides the
// element and replaces [it] for our high[-quality] generated code". In the preview a replace HIDES the page's element
// (kept: Undo and "Show the old one") and puts the block exactly where it stood; in what Content publishes to Magento the
// element is swapped for the block and its own HTML kept beside it in a comment (no hidden copy for search engines), put
// back by the next write when the change is gone. AI testing & personalization's winners keep the straight swap they were
// tested with. Magento is a FAKE here: nothing is ever written to ACC or production.

const BLOCK = `<style>.apx-hero{background:#274e64;color:#fff}</style><section class="apx-hero"><h1>Neu</h1></section>`;

test("the preview: a replace hides the element (kept, marked with its change) and puts the block where it stood", () => {
  const html = `<html><head></head><body><main id="maincontent"><div class="page-title-wrapper" style="padding:4px"><h1 class="page-title">Alt</h1></div><p>Weiter</p></main></body></html>`;
  const r = applyChanges(html, [{ op: "replace", selector: ".page-title-wrapper", html: BLOCK }], { marks: [3] });
  assert.equal(r.hits[0].state, "found");
  // the block first, then the original - hidden, never deleted
  const at = r.html.indexOf(`<section data-apso-v="" data-apx-c="3" data-apx-k="1" class="apx-hero">`);
  const old = r.html.indexOf(`<div data-apx-hid="3" class="page-title-wrapper" style="padding:4px;display:none !important">`);
  assert.ok(at > 0, r.html);
  assert.ok(old > at, "the block stands where the element was, the element right after it, hidden");
  assert.match(r.html, /<h1 class="page-title">Alt<\/h1>/, "the original's words are all still there");
  // without the studio's marks (the paste): hidden by its style only
  const plain = applyChanges(html, [{ op: "replace", selector: ".page-title-wrapper", html: BLOCK }]);
  assert.match(plain.html, /<div class="page-title-wrapper" style="padding:4px;display:none !important"><h1/);
  assert.doesNotMatch(plain.html, /data-apx-/);
  // a later change still finds the page's own element (hidden) - and leaves the block alone
  const next = applyChanges(html, [{ op: "replace", selector: ".page-title-wrapper", html: BLOCK }, { op: "text", selector: "h1", text: "x" }]);
  assert.match(next.html, /<h1>Neu<\/h1>/);
});

test("the preview: a replace of every match takes the outer one when one holds another", () => {
  const r = applyChanges(`<body><div class="a"><div class="a">in</div></div></body>`, [{ op: "replace", selector: "div.a", html: "<p>N</p>", all: true }]);
  assert.equal((r.html.match(/<p data-apso-v="">N<\/p>/g) ?? []).length, 1);
  assert.match(r.html, /<div style="display:none !important" class="a"><div class="a">in<\/div><\/div>/);
});

const KEEP = { replace: "keep" as const };
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

test("Magento, Content's publish (keep): the element swapped for the block, its HTML kept beside it; written again never doubles; Undo puts it back exactly", () => {
  const content = `<div class="intro"><h2>Über uns</h2><p class="lead" id="lead" style="color:#333">Seit 1920</p></div>`;
  const changes = [{ op: "replace" as const, selector: "p.lead", html: BLOCK }];
  const r = applyToCms(content, changes, "content-de-CH", KEEP);
  assert.deepEqual(r.notPlaced, []);
  assert.equal(r.content,
    `<div class="intro"><h2>Über uns</h2><!--apx-was ${b64("content-de-CH")} ${b64(`<p class="lead" id="lead" style="color:#333">Seit 1920</p>`)}-->`
    + `<style data-apx-block="content-de-CH">.apx-hero{background:#274e64;color:#fff}</style><section data-apx-block="content-de-CH" class="apx-hero"><h1>Neu</h1></section></div>`);
  // no hidden copy left in the page: one H1, the id once (search engines, ids)
  assert.doesNotMatch(r.content, /display:none/);
  assert.doesNotMatch(r.content, /id="lead"/);
  // published again: the same content, not two blocks
  assert.equal(applyToCms(r.content, changes, "content-de-CH", KEEP).content, r.content);
  // published without the replace (an Undo): the original back, byte for byte
  assert.equal(applyToCms(r.content, [], "content-de-CH", KEEP).content, content);
  assert.equal(withoutOwnWork(r.content, "content-de-CH"), content);
  // another write's work (another tag) is left alone
  assert.equal(withoutOwnWork(r.content, "content-fr-CH"), r.content);
  // a hide and an insert: marked, taken out again on the next write
  const more = applyToCms(content, [{ op: "insert" as const, selector: "h2", where: "after", html: `<p class="apx-n">N</p>` }, { op: "hide" as const, selector: "#lead" }], "content-de-CH", KEEP);
  assert.match(more.content, /<h2>Über uns<\/h2><p data-apx-block="content-de-CH" class="apx-n">N<\/p><p class="lead" id="lead" style="color:#333; display:none !important" data-apx-hid="content-de-CH">/);
  assert.equal(applyToCms(more.content, [], "content-de-CH", KEEP).content, content);
});

test("Magento, keep: an original holding \"-->\", \"--\", \"<!--\" and an inline script never breaks out of its comment and comes back byte for byte", () => {
  const original = `<div class="pb" data-x="a--b"><!-- Page Builder: keep --><script>if (a-->0 && b) { document.title = "<!--x-->"; }</script><p>Text -- mit --> Pfeil</p></div>`;
  const content = `<main><h2>T</h2>${original}<p>after</p></main>`;
  const r = applyToCms(content, [{ op: "replace" as const, selector: "div.pb", html: `<div class="apx-r">R</div>` }], "content-de-CH", KEEP);
  // one comment of ours, whole: nothing of the original outside it
  const kept = /<!--apx-was ([A-Za-z0-9+/=]+) ([A-Za-z0-9+/=]+)-->/.exec(r.content);
  assert.ok(kept, r.content);
  assert.equal(Buffer.from(kept[2], "base64").toString("utf8"), original);
  assert.equal(r.content, `<main><h2>T</h2>${kept[0]}<div data-apx-block="content-de-CH" class="apx-r">R</div><p>after</p></main>`);
  assert.doesNotMatch(r.content.replace(kept[0], ""), /<script|a--b|Pfeil/);
  // written again with the change, then without it
  assert.equal(applyToCms(r.content, [{ op: "replace" as const, selector: "div.pb", html: `<div class="apx-r">R</div>` }], "content-de-CH", KEEP).content, r.content);
  assert.equal(applyToCms(r.content, [], "content-de-CH", KEEP).content, content);
});

test("Magento, keep, Page Builder: a block among Page Builder's elements goes in as an HTML Code element (inside a row among rows), plain inside an HTML Code element; each comes back out", () => {
  const row = (inner: string) => `<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">${inner}</div></div>`;
  const pb = row(`<div data-content-type="text" data-element="main"><p>Text</p></div>`) + row(`<figure data-content-type="image" class="usp"><img src="u.png"></figure>`);
  // a whole row replaced: a row with one HTML Code element, the row's own HTML in the comment before it
  const ch = [{ op: "replace" as const, selector: "div[data-content-type=row]", html: `<div class="apx-x">X</div>` }];
  const a = applyToCms(pb, ch, "content-de-CH", KEEP);
  assert.match(a.content, /^<!--apx-was [^ ]+ [A-Za-z0-9+/=]+--><div data-content-type="row" data-appearance="contained" data-element="main" data-apx-block="content-de-CH"><div [^>]*data-element="inner"><div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true"><div data-apx-block="content-de-CH" class="apx-x">X<\/div><\/div><\/div><\/div><div data-content-type="row"/);
  assert.equal((a.content.match(/data-content-type="row"/g) ?? []).length, 2, "the replaced row is gone from the page (in the comment only)");
  assert.equal(applyToCms(a.content, ch, "content-de-CH", KEEP).content, a.content);
  assert.equal(applyToCms(a.content, [], "content-de-CH", KEEP).content, pb);
  // an element inside a row: an HTML Code element beside it
  const b = applyToCms(pb, [{ op: "insert" as const, selector: "figure.usp", where: "after", html: `<div class="apx-y">Y</div>` }], "content-de-CH", KEEP);
  assert.match(b.content, /<img src="u\.png"><\/figure><div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true" data-apx-block="content-de-CH"><div data-apx-block="content-de-CH" class="apx-y">Y<\/div><\/div>/);
  assert.equal(applyToCms(b.content, [], "content-de-CH", KEEP).content, pb);
  // inside an HTML Code element (the kit's home page is one): as it is
  const kit = row(`<div data-content-type="html" data-element="main"><div class="hxt"><section class="hxt-hero"><h1>T</h1></section></div></div>`);
  const c = applyToCms(kit, [{ op: "replace" as const, selector: ".hxt-hero", html: `<section class="apx-z">Z</section>` }], "content-de-CH", KEEP);
  assert.match(c.content, /<div class="hxt"><!--apx-was [^ ]+ [A-Za-z0-9+/=]+--><section data-apx-block="content-de-CH" class="apx-z">Z<\/section><\/div>/);
  assert.equal(applyToCms(c.content, [], "content-de-CH", KEEP).content, kit);
});

test("Magento, AI testing & personalization's winners (the default, swap): exactly as before this round - byte for byte", () => {
  // the output of applyToCms at da2afb94 (before Content v6) for this fixture, kept here as it was
  const content = `<div data-content-type="row" data-element="main"><div data-element="inner"><h2 class="t">Über uns</h2><p class="lead" style="color:#333">Seit 1920</p><div class="old" id="x">Alt<!-- note --></div><figure data-content-type="image"><img src="u.png"></figure></div></div>`;
  const changes = [
    { op: "css" as const, css: ".apx-a{color:#274e64}" },
    { op: "replace" as const, selector: "p.lead", html: `<style>.apx-a{color:#274e64}</style><div class="apx-a">Neu</div>` },
    { op: "insert" as const, selector: "h2.t", where: "after" as const, html: `<p class="apx-b">B</p>` },
    { op: "hide" as const, selector: "#x" },
    { op: "text" as const, selector: "h2.t", text: "Wir" },
    { op: "attr" as const, selector: "img", name: "alt", value: "U" },
  ];
  const before = "<style data-apso-version=\"test-7\">\n.apx-a{color:#274e64}\n</style>\n<div data-content-type=\"row\" data-element=\"main\"><div data-element=\"inner\"><h2 class=\"t\">Wir</h2><p class=\"apx-b\">B</p><style>.apx-a{color:#274e64}</style><div class=\"apx-a\">Neu</div><div class=\"old\" id=\"x\" style=\"display:none !important\">Alt<!-- note --></div><figure data-content-type=\"image\"><img src=\"u.png\" alt=\"U\"></figure></div></div>";
  assert.equal(applyToCms(content, changes, "test-7").content, before);
  assert.equal(applyToCms(content, changes, "test-7", { replace: "swap" }).content, before);
});

test("Magento through the REST API (a fake one): the page backed up first, then the block in the element's place, its HTML kept beside it", async () => {
  const pages = [{ id: 41, identifier: "ueber-uns", title: "Über uns", active: true, content: `<p class="lead">Seit 1920</p><p>Mehr</p>`, stores: [6] }];
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, url: u.pathname, body });
    const ok = (j: unknown) => ({ status: 200, text: async () => JSON.stringify(j) });
    if (/\/cmsPage\/search$/.test(u.pathname)) {
      const ident = u.searchParams.get("searchCriteria[filterGroups][0][filters][0][value]");
      const sid = Number(u.searchParams.get("searchCriteria[filterGroups][1][filters][0][value]"));
      return ok({ items: pages.filter((p) => p.identifier === ident && p.stores.includes(sid)).map(({ stores: _s, ...p }) => p) });
    }
    const m = /\/cmsPage\/(\d+)$/.exec(u.pathname);
    if (m && init.method === "GET") { const { stores: _s, ...p } = pages.find((x) => x.id === Number(m[1]))!; return ok(p); }
    if (m && init.method === "PUT") { const i = pages.findIndex((x) => x.id === Number(m[1])); pages[i] = { ...pages[i], ...body.page }; return ok(body.page); }
    return { status: 404, text: async () => "{}" };
  };
  const m = magentoRequest({ base: "https://acc.apsoparts.com", fetch, authorize: () => "OAuth fake" });
  const log: string[] = [];
  const rows: BackupIn[] = [];
  const backups: Backups = { add: async (b) => { rows.push(b); log.push("backup"); return String(rows.length); }, written: async () => { log.push("written"); }, failed: async () => { log.push("failed"); } };
  const store: StoreRef = { view: "de-CH", code: "switzerland_chf_de", id: 6 };
  const want = { kind: "changes" as const, identifier: "ueber-uns", changes: [{ op: "replace" as const, selector: "p.lead", html: BLOCK }], tag: "content-de-CH" };
  const w = await writePage(m, { env: "acc", view: "de-CH", store, want, ours: () => false, by: "SARCLA", backups });
  assert.equal(w.action, "updated");
  assert.deepEqual(log, ["backup", "written"], "the backup first");
  assert.equal(rows[0].before, `<p class="lead">Seit 1920</p><p>Mehr</p>`);
  const sent = (calls.find((c) => c.method === "PUT")!.body as { page: { content: string } }).page.content;
  assert.equal(sent, `<!--apx-was ${b64("content-de-CH")} ${b64(`<p class="lead">Seit 1920</p>`)}--><style data-apx-block="content-de-CH">.apx-hero{background:#274e64;color:#fff}</style><section data-apx-block="content-de-CH" class="apx-hero"><h1>Neu</h1></section><p>Mehr</p>`);
  // published again: Magento holds the same content as after the first write - not two blocks
  await writePage(m, { env: "acc", view: "de-CH", store, want, ours: () => false, by: "SARCLA", backups });
  assert.equal(pages[0].content, sent);
  // published after an Undo (no change left): the page's own paragraph back
  const undone = applyToCms(pages[0].content, [], "content-de-CH", KEEP);
  assert.equal(undone.content, `<p class="lead">Seit 1920</p><p>Mehr</p>`);
  assert.ok(calls.every((c) => c.url.startsWith("/rest/")), "only the fake was asked");
});

test("the document: a change's id, its module and its check are kept beside it; a change the check held back goes nowhere", () => {
  const a = replaceChange(".page-title-wrapper", BLOCK, { note: "A clearer hero", module: { type: "hero", settings: { tone: "petrol" } } });
  assert.match(a.id ?? "", /^c[a-z0-9]+$/);
  assert.deepEqual(a.module, { type: "hero", settings: { tone: "petrol" } });
  const b = insertChange("#maincontent .column.main > div:nth-of-type(2)", "after", `<div class="apx-b">B</div>`);
  let list: PageChange[] = withChange([], a);
  list = withChange(list, b);
  // the same id: in its place, not added twice; a replace of the same element: in its place too
  list = withChange(list, { ...a, html: "<div class='apx-a2'>2</div>" } as PageChange);
  list = withChange(list, replaceChange(".page-title-wrapper", "<div class='apx-a3'>3</div>"));
  assert.equal(list.length, 2);
  assert.match(String((list[0] as { html: string }).html), /apx-a3/);
  // held back by the check: kept in the document, left out of the preview and of Magento
  const held: PageChange = { ...b, off: "The words cannot be read: dark grey on petrol (1.9:1)." };
  assert.equal(isLive(held), false);
  assert.equal(isLive(b), true);
  const doc = pageDoc({ source: "pick", path: "/de-CH/ueber-uns", store: "de-CH", changes: [list[0], held] });
  assert.equal(doc.changes.length, 2, "the document keeps both");
  assert.equal((doc.changes[1] as PageChange).off, held.off);
  const f = finalChanges(doc);
  assert.equal(f.changes.length, 1);
  assert.deepEqual(f.from, [0]);
  assert.equal("id" in f.changes[0], false, "the preview and Magento get the change without the studio's notes");
});
