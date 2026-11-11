import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GATE, KEY_WAITING, gateOf, magentoRequest, planPage, restorePage, searchPath, storeRefIn, withInserts, writePage,
  type BackupIn, type Backups, type FetchLike, type StoreRef, type Want,
} from "../src/lib/convert/cmsPage";

// SARCLA 09.11.2026: "The Magento publish should occur via the API ... also be able to update ACC and/or PROD". Every rule
// of the page studio's last step against a FAKE Magento - never a real write to ACC or production, not even a test page.

type Call = { method: string; url: string; auth: string; body: unknown };
type Page = { id: number; identifier: string; title: string; content: string; active: boolean; page_layout?: string; meta_title?: string; meta_description?: string; stores: number[] };

/** A Magento in memory: CMS pages with their store views, the REST API the hub uses, every request kept in order. */
function fakeMagento(pages: Page[], opts: { failWrite?: number } = {}) {
  const calls: Call[] = [];
  let next = 900;
  const strip = ({ stores: _s, ...p }: Page) => p;
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, url: u.pathname + (u.search ? decodeURIComponent(u.search) : ""), auth: init.headers.Authorization, body });
    const ok = (j: unknown) => ({ status: 200, text: async () => JSON.stringify(j) });
    const m = /^\/rest\/([^/]+)\/V1\/cmsPage(?:\/(search|\d+))?$/.exec(u.pathname);
    if (!m) return { status: 404, text: async () => JSON.stringify({ message: "no route" }) };
    const [, store, rest] = m;
    if (init.method === "GET" && rest === "search") {
      const ident = u.searchParams.get("searchCriteria[filterGroups][0][filters][0][value]");
      const sid = Number(u.searchParams.get("searchCriteria[filterGroups][1][filters][0][value]"));
      const items = pages.filter((p) => p.identifier === ident && p.stores.includes(sid)).map(strip);
      return ok({ items, total_count: items.length });
    }
    if (init.method === "GET" && rest) {
      const p = pages.find((x) => x.id === Number(rest));
      return p ? ok(strip(p)) : { status: 404, text: async () => JSON.stringify({ message: "The CMS page with the \"%1\" ID doesn't exist.", parameters: [rest] }) };
    }
    if (opts.failWrite && (init.method === "POST" || init.method === "PUT")) return { status: opts.failWrite, text: async () => JSON.stringify({ message: "Could not save the page." }) };
    if (init.method === "POST" && !rest) {
      // the store of the request: a page made at /rest/<code>/ is in that store view
      const sid = store === "switzerland_chf_de" ? 6 : store === "germany_eur_de" ? 7 : store === "switzerland_chf_fr" ? 8 : 0;
      const p: Page = { ...body.page, id: next++, stores: [sid] };
      pages.push(p);
      return ok(strip(p));
    }
    if (init.method === "PUT" && rest) {
      const i = pages.findIndex((x) => x.id === Number(rest));
      pages[i] = { ...pages[i], ...body.page, id: pages[i].id, stores: pages[i].stores };
      return ok(strip(pages[i]));
    }
    return { status: 400, text: async () => "{}" };
  };
  const m = magentoRequest({ base: "https://acc.apsoparts.com", fetch, authorize: (method) => `OAuth test ${method}` });
  return { m, calls, pages, writes: () => calls.filter((c) => c.method !== "GET") };
}

/** Backups kept in memory, each step logged in one list with the requests - so the order is checked. */
function memoryBackups(log: string[]) {
  const rows: (BackupIn & { id: string; written: boolean; pageId: string | null; error: string | null })[] = [];
  const b: Backups = {
    add: async (x) => { const id = String(rows.length + 1); rows.push({ ...x, id, written: false, error: null }); log.push(`backup ${x.action}`); return id; },
    written: async (id, pageId) => { const r = rows.find((x) => x.id === id)!; r.written = true; r.pageId = pageId; log.push("backup written"); },
    failed: async (id, error) => { rows.find((x) => x.id === id)!.error = error; log.push("backup failed"); },
  };
  return { b, rows };
}

const DE_CH: StoreRef = { view: "de-CH", code: "switzerland_chf_de", id: 6 };
const DE_DE: StoreRef = { view: "de-DE", code: "germany_eur_de", id: 7 };
const newPage = (over: Partial<Extract<Want, { kind: "page" }>> = {}): Extract<Want, { kind: "page" }> => ({
  kind: "page", identifier: "dichtungen-lebensmittel", title: "Dichtungen für Lebensmittel", metaTitle: "Dichtungen für Lebensmittel | APSOparts",
  metaDescription: "Dichtungen für die Lebensmittelindustrie.", content: "<style>.apx-np{}</style><section class=\"apx-np\"><h1>Dichtungen</h1></section>", active: true, ...over,
});

test("a request: the store view's code in the address, signed, JSON in and out", async () => {
  const f = fakeMagento([]);
  await f.m("POST", "switzerland_chf_de", "/cmsPage", { page: { identifier: "x" } });
  assert.equal(f.calls[0].url, "/rest/switzerland_chf_de/V1/cmsPage");
  assert.equal(f.calls[0].auth, "OAuth test POST");
  assert.deepEqual(f.calls[0].body, { page: { identifier: "x" } });
  const q = decodeURIComponent(searchPath("ueber-uns", 6));
  assert.match(q, /\[filterGroups\]\[0\]\[filters\]\[0\]\[value\]=ueber-uns/);
  assert.match(q, /\[filterGroups\]\[1\]\[filters\]\[0\]\[field\]=store_id&.*\[value\]=6/, "AND its store view");
});

test("a store view's code and id come from its own page on the shop", () => {
  const html = `<script>window.checkout = {"websiteId":"2","storeId":"6","storeGroupId":"2","storeCode":"switzerland_chf_de","customerLoginUrl":"x"};</script>`;
  assert.deepEqual(storeRefIn(html, "de-CH"), { view: "de-CH", code: "switzerland_chf_de", id: 6 });
  assert.equal(storeRefIn("<html></html>", "de-CH"), null);
});

test("a new page: created in its store view - the backup row is written BEFORE the write", async () => {
  const f = fakeMagento([]);
  const log: string[] = [];
  const { b, rows } = memoryBackups(log);
  const plan = await planPage(f.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => false });
  assert.equal(plan.action, "create");
  assert.equal(plan.why, null);
  assert.equal(f.writes().length, 0, "a plan writes nothing");
  const logged = (method: string) => log.push(method);
  const m: typeof f.m = async (method, store, path, body) => { if (method !== "GET") logged(`${method} ${store}`); return f.m(method, store, path, body); };
  const w = await writePage(m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => false, by: "SARCLA", backups: b });
  assert.equal(w.action, "created");
  assert.deepEqual(log, ["backup create", "POST switzerland_chf_de", "backup written"], "backup first, then the write, then marked written");
  const post = f.writes()[0];
  assert.equal(post.url, "/rest/switzerland_chf_de/V1/cmsPage", "created through de-CH's store code: the page is in de-CH");
  assert.deepEqual(post.body, { page: {
    identifier: "dichtungen-lebensmittel", title: "Dichtungen für Lebensmittel", meta_title: "Dichtungen für Lebensmittel | APSOparts",
    meta_description: "Dichtungen für die Lebensmittelindustrie.", content: newPage().content, active: true,
  } });
  assert.deepEqual(f.pages[0].stores, [6]);
  assert.equal(rows[0].before, "", "nothing was there before");
  assert.equal(rows[0].pageId, w.pageId);
});

test("published again: the page this to-do made is updated, its other fields and store view kept", async () => {
  const f = fakeMagento([{ id: 42, identifier: "dichtungen-lebensmittel", title: "Alt", content: "<p>alt</p>", active: true, page_layout: "1column", stores: [6] }]);
  const log: string[] = [];
  const { b, rows } = memoryBackups(log);
  const m: typeof f.m = async (method, store, path, body) => { if (method !== "GET") log.push(`${method} ${path}`); return f.m(method, store, path, body); };
  const w = await writePage(m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: (id) => id === "42", by: "SARCLA", backups: b });
  assert.equal(w.action, "updated");
  assert.deepEqual(log, ["backup update", "PUT /cmsPage/42", "backup written"]);
  const put = f.writes()[0];
  assert.equal(put.url, "/rest/switzerland_chf_de/V1/cmsPage/42", "updated by its id, through its store view's own address (production refuses PUT /rest/all)");
  const page = (put.body as { page: Record<string, unknown> }).page;
  assert.equal(page.page_layout, "1column", "what the studio does not set is kept");
  assert.equal(page.title, "Dichtungen für Lebensmittel");
  assert.deepEqual(f.pages[0].stores, [6], "its store view kept");
  assert.equal(rows[0].before, "<p>alt</p>", "the page as it was, kept");
  assert.equal(rows[0].page?.title, "Alt");
});

test("never a page somebody else made under the same URL key, never a page of All Store Views", async () => {
  const theirs = fakeMagento([{ id: 5, identifier: "dichtungen-lebensmittel", title: "Eine andere Seite", content: "x", active: true, stores: [6] }]);
  const { b, rows } = memoryBackups([]);
  const p = await planPage(theirs.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => false });
  assert.equal(p.action, "none");
  assert.match(p.why ?? "", /already \(#5 "Eine andere Seite"\) that this to-do did not make/);
  await assert.rejects(writePage(theirs.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => false, by: "x", backups: b }), /did not make/);
  assert.equal(theirs.writes().length, 0, "nothing written");
  assert.equal(rows.length, 0, "no backup either");

  const all = fakeMagento([{ id: 1, identifier: "dichtungen-lebensmittel", title: "Für alle", content: "x", active: true, stores: [0] }]);
  const q = await planPage(all.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => true });
  assert.equal(q.action, "none");
  assert.match(q.why ?? "", /All Store Views/);
  await assert.rejects(writePage(all.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => true, by: "x", backups: b }), /All Store Views/);
  assert.equal(all.writes().length, 0);
});

test("a store view whose code could not be read, a page without a URL key: said, not written", async () => {
  const f = fakeMagento([]);
  assert.match((await planPage(f.m, { env: "acc", view: "de-CH", store: null, want: newPage(), ours: () => false })).why ?? "", /could not read de-CH's store code/);
  assert.match((await planPage(f.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage({ identifier: "" }), ours: () => false })).why ?? "", /no URL key/);
  assert.equal(f.calls.length, 0);
});

test("an existing CMS page of the shop: its change list put into Magento's content; one page serving two store views is said", async () => {
  const content = `<div class="intro"><h2>Über uns</h2><p>Seit 1920.</p></div>`;
  const f = fakeMagento([{ id: 12, identifier: "ueber-uns", title: "Über uns", content, active: true, stores: [6, 7] }]);
  const want: Want = {
    kind: "changes", identifier: "ueber-uns", tag: "content-de-CH",
    changes: [{ op: "text", selector: ".intro h2", text: "Wer wir sind" }],
    inserts: { top: "", afterIntro: `<div class="apx-ins">Banner</div>`, bottom: "" },
  };
  const plan = await planPage(f.m, { env: "acc", view: "de-CH", store: DE_CH, want, others: [DE_CH, DE_DE], ours: () => false });
  assert.equal(plan.action, "update", "an existing page is updated even though this to-do did not make it");
  assert.deepEqual(plan.shared, ["de-DE"], "the same Magento page serves de-DE: a write changes it too");
  assert.deepEqual(plan.placed, { placed: 1, total: 1 });
  const { b } = memoryBackups([]);
  await writePage(f.m, { env: "acc", view: "de-CH", store: DE_CH, want, ours: () => false, by: "x", backups: b });
  const sent = (f.writes()[0].body as { page: { content: string } }).page.content;
  assert.match(sent, /<h2>Wer wir sind<\/h2>/);
  assert.match(sent, /<p>Seit 1920\.<\/p><div class="apx-ins">Banner<\/div>/, "the banner after the first paragraph");

  // a change that finds no place in Magento's content: not written - it goes to dotSource as code
  const lost: Want = { ...want, changes: [{ op: "text", selector: "h1.page-title", text: "x" }] };
  const p2 = await planPage(f.m, { env: "acc", view: "de-CH", store: DE_CH, want: lost, ours: () => false });
  assert.equal(p2.action, "none");
  assert.match(p2.why ?? "", /dotSource/);
  // and a store view without such a page: said
  const p3 = await planPage(f.m, { env: "acc", view: "fr-CH", store: { view: "fr-CH", code: "switzerland_chf_fr", id: 8 }, want, ours: () => false });
  assert.match(p3.why ?? "", /no CMS page "ueber-uns" in fr-CH/);
});

test("a write Magento refuses: the backup keeps the error, the error is said", async () => {
  const f = fakeMagento([], { failWrite: 500 });
  const log: string[] = [];
  const { b, rows } = memoryBackups(log);
  await assert.rejects(writePage(f.m, { env: "acc", view: "de-CH", store: DE_CH, want: newPage(), ours: () => false, by: "x", backups: b }), /Magento answered 500: Could not save the page/);
  assert.deepEqual(log, ["backup create", "backup failed"]);
  assert.match(rows[0].error ?? "", /500/);
});

test("bring the page back: an update's backup written back; a page the to-do created switched off, never deleted", async () => {
  const f = fakeMagento([{ id: 42, identifier: "ueber-uns", title: "Neu", content: "<p>neu</p>", active: true, meta_title: "Neu", stores: [6] }]);
  const log: string[] = [];
  const { b, rows } = memoryBackups(log);
  const r = await restorePage(f.m, { id: "1", env: "acc", view: "de-CH", identifier: "ueber-uns", pageId: "42", action: "update", page: { title: "Alt", meta_title: "Alt", active: true }, before: "<p>alt</p>", written: true }, { by: "x", backups: b });
  assert.equal(r.action, "restored");
  assert.equal(f.pages[0].content, "<p>alt</p>");
  assert.equal(f.pages[0].title, "Alt");
  assert.equal(rows[0].before, "<p>neu</p>", "the page as it was before the restore is backed up too");
  assert.deepEqual(log, ["backup restore", "backup written"]);

  const r2 = await restorePage(f.m, { id: "2", env: "acc", view: "de-CH", identifier: "ueber-uns", pageId: "42", action: "create", page: null, before: "", written: true }, { by: "x", backups: b });
  assert.equal(r2.action, "switched-off");
  assert.equal(f.pages[0].active, false);
  assert.equal(f.pages.length, 1, "never deleted");
  await assert.rejects(restorePage(f.m, { id: "3", env: "acc", view: "de-CH", identifier: "x", pageId: "42", action: "update", page: null, before: "", written: false }, { by: "x", backups: b }), /never reached Magento/);
});

test("the gate: approved, the person's grant, the environment's key - each refusal said plainly", () => {
  const ok = { canEdit: true, status: "approved", grant: true, key: true, env: "acc" as const };
  assert.equal(gateOf(ok), null);
  assert.equal(gateOf({ ...ok, status: "live" }), null, "a live page can be written again");
  assert.equal(gateOf({ ...ok, status: "writing" }), GATE.review, "not without its review");
  assert.equal(gateOf({ ...ok, status: "review" }), GATE.review);
  assert.equal(gateOf({ ...ok, grant: false }), GATE.grant, "not without Edit on Winners");
  assert.equal(gateOf({ ...ok, canEdit: false }), GATE.comment);
  assert.equal(gateOf({ ...ok, key: false }), "ACC is waiting for its key (MAGENTO_CMS_ACC).");
  assert.equal(gateOf({ ...ok, key: false, env: "prod" }), KEY_WAITING.prod);
  assert.match(KEY_WAITING.prod, /production's Magento integration is not made yet/);
  assert.equal(gateOf({ ...ok, status: "writing", restore: true }), null, "bringing a page back needs no review");
  assert.equal(gateOf({ ...ok, grant: false, restore: true }), GATE.grant, "but the grant");
});

test("banners in an existing page's content: top, after the first paragraph, end", () => {
  assert.equal(withInserts("<p>a</p><p>b</p>", { top: "T", afterIntro: "I", bottom: "B" }), "T<p>a</p>I<p>b</p>B");
  assert.equal(withInserts("<div>x</div>", { top: "", afterIntro: "I", bottom: "" }), "<div>x</div>I");
  assert.equal(withInserts("x"), "x");
});

// Content v14 (SARCLA 11.11.2026: production answered every PUT /rest/all/V1/cmsPage/<id> with a 403 and the shop's home
// page - "updating, it's still not working"): an update goes through its store view's own address, like a create
import { putStore } from "../src/lib/convert/cmsPage";
test("an update is written through its store view's own code; 'all' only when none is known", () => {
  assert.equal(putStore("de-CH"), "switzerland_chf_de");
  assert.equal(putStore("de-CH/eur"), "switzerland_eur_de");
  assert.equal(putStore("en-INT", { code: "international_eur_en" }), "international_eur_en");
  assert.equal(putStore("xx-YY"), "all");
  assert.equal(putStore(null), "all");
});
