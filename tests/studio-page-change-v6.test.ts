import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChanges } from "../src/lib/content/studio/kinds/page/apply";
import { finalChanges, insertChange, isLive, pageDoc, replaceChange, withChange, type PageChange } from "../src/lib/content/studio/kinds/page/model";
import { magentoRequest, writePage, type BackupIn, type Backups, type FetchLike, type StoreRef } from "../src/lib/convert/cmsPage";
import { applyToCms, withoutOwnWork } from "../src/lib/convert/ship";

// Content v6 (SARCLA 09.11.2026, point 10): "IF we can change the current element, the proposal when applied hides the
// element and replaces [it] for our high[-quality] generated code". A replace HIDES the page's element (kept: Undo and
// "Show the old one") and puts the block exactly where it stood - in the preview and in what goes to Magento. Magento is a
// FAKE here: nothing is ever written to ACC or production.

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

test("Magento: replace hides the element and puts the block there; a write made again never doubles; Undo brings it back", () => {
  const content = `<div class="intro"><h2>Über uns</h2><p class="lead" style="color:#333">Seit 1920</p></div>`;
  const changes = [{ op: "replace" as const, selector: "p.lead", html: BLOCK }];
  const r = applyToCms(content, changes, "content-de-CH");
  assert.deepEqual(r.notPlaced, []);
  assert.equal(r.content,
    `<div class="intro"><h2>Über uns</h2><style data-apx-block="content-de-CH">.apx-hero{background:#274e64;color:#fff}</style><section data-apx-block="content-de-CH" class="apx-hero"><h1>Neu</h1></section>`
    + `<p class="lead" style="color:#333; display:none !important" data-apx-hid="content-de-CH">Seit 1920</p></div>`);
  // written again (a second publish): the same content, not two blocks
  assert.equal(applyToCms(r.content, changes, "content-de-CH").content, r.content);
  // the change taken out (Undo), written again: the page's own element as it was
  assert.equal(applyToCms(r.content, [], "content-de-CH").content, content);
  assert.equal(withoutOwnWork(r.content, "content-de-CH"), content);
  // another write's work (another tag) is left alone
  assert.equal(withoutOwnWork(r.content, "content-fr-CH"), r.content);
});

test("Magento: among Page Builder's elements a block goes in as an HTML Code element (inside a row among rows), plain inside an HTML Code element", () => {
  const row = (inner: string) => `<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">${inner}</div></div>`;
  const pb = row(`<div data-content-type="text" data-element="main"><p>Text</p></div>`) + row(`<figure data-content-type="image" class="usp"><img src="u.png"></figure>`);
  // a whole row replaced: a row with one HTML Code element
  const a = applyToCms(pb, [{ op: "replace", selector: "div[data-content-type=row]", html: `<div class="apx-x">X</div>` }], "content-de-CH");
  assert.match(a.content, /^<div data-content-type="row" data-appearance="contained" data-element="main" data-apx-block="content-de-CH"><div [^>]*data-element="inner"><div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true"><div data-apx-block="content-de-CH" class="apx-x">X<\/div><\/div><\/div><\/div><div data-content-type="row"[^>]*style="display:none !important" data-apx-hid="content-de-CH">/);
  // an element inside a row: an HTML Code element beside it
  const b = applyToCms(pb, [{ op: "insert", selector: "figure.usp", where: "after", html: `<div class="apx-y">Y</div>` }], "content-de-CH");
  assert.match(b.content, /<img src="u\.png"><\/figure><div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true" data-apx-block="content-de-CH"><div data-apx-block="content-de-CH" class="apx-y">Y<\/div><\/div>/);
  // inside an HTML Code element (the kit's home page is one): as it is
  const kit = row(`<div data-content-type="html" data-element="main"><div class="hxt"><section class="hxt-hero"><h1>T</h1></section></div></div>`);
  const c = applyToCms(kit, [{ op: "replace", selector: ".hxt-hero", html: `<section class="apx-z">Z</section>` }], "content-de-CH");
  assert.match(c.content, /<div class="hxt"><section data-apx-block="content-de-CH" class="apx-z">Z<\/section><section class="hxt-hero" style="display:none !important" data-apx-hid="content-de-CH">/);
  // written again: unchanged
  for (const [x, ch] of [[a, "replace"], [b, "insert"], [c, "replace"]] as const) assert.ok(x.content.length > 0, ch);
  assert.equal(applyToCms(a.content, [{ op: "replace", selector: "div[data-content-type=row]", html: `<div class="apx-x">X</div>` }], "content-de-CH").content, a.content);
});

test("Magento through the REST API (a fake one): the page as it is backed up, then the content with the block and the element hidden", async () => {
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
  const put = calls.find((c) => c.method === "PUT")!;
  const sent = (put.body as { page: { content: string } }).page.content;
  assert.match(sent, /<section data-apx-block="content-de-CH" class="apx-hero"><h1>Neu<\/h1><\/section><p class="lead" style="display:none !important" data-apx-hid="content-de-CH">Seit 1920<\/p><p>Mehr<\/p>$/);
  // published again: Magento holds the same content as after the first write - not two blocks
  await writePage(m, { env: "acc", view: "de-CH", store, want, ours: () => false, by: "SARCLA", backups });
  assert.equal(pages[0].content, sent);
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
  list = withChange(list, { ...a, html: "<div class='apx-a2'>2</div>" });
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
