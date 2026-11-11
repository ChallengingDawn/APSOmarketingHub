import assert from "node:assert/strict";
import { test } from "node:test";
import { abStore, abTestHref, lastWrite, liveOn, pageAddress, pathOf, sinceOf, type WrittenRecord } from "../src/lib/content/studio/kinds/page/published";
import { magentoRequest, planShared, writeShared, type Backups, type FetchLike, type StoreRef, type Target, type Want } from "../src/lib/convert/cmsPage";

// Content v12 (SARCLA 10.11.2026, after his first publish to ACC): "if already created I should have the link", "on send to
// Magento you should add another button - set up A/B testing optimization", "also I should be able to update current pages
// after changes here".

const KEY = "kalrez-6221-6230-discontinued";
const rec = (store: string, pageId: string, action: WrittenRecord["action"] = "created", at = "2026-11-10T22:06:00.000Z", env: "acc" | "prod" = "acc"): WrittenRecord =>
  ({ env, store, pageId, identifier: KEY, action, at, url: "" });

test("a page's address on each shop: its store view (the Swiss shop's EUR one too), then its URL key", () => {
  assert.equal(pageAddress("acc", "en-INT", KEY), "https://acc.apsoparts.com/en-INT/kalrez-6221-6230-discontinued");
  assert.equal(pageAddress("acc", "en-CH/eur", KEY), "https://acc.apsoparts.com/en-CH/eur/kalrez-6221-6230-discontinued");
  assert.equal(pageAddress("prod", "en-DE", `/${KEY}`), "https://www.apsoparts.com/en-DE/kalrez-6221-6230-discontinued");
  assert.equal(pathOf("https://acc.apsoparts.com/en-CH/eur/x?y=1#z"), "/en-CH/eur/x");
  assert.equal(pathOf("/en-INT/x"), "/en-INT/x");
});

test("the pages the to-do has on a shop: the newest record of each store view, the switched-off ones out, in the shop's order", () => {
  // newest first, as the document keeps them
  const records = [
    rec("en-DE", "741", "switched-off", "2026-11-10T22:30:00.000Z"),
    rec("en-INT", "738", "updated", "2026-11-10T22:20:00.000Z"),
    rec("en-INT", "738"), rec("en-CH/eur", "739"), rec("en-CH", "740"), rec("en-DE", "741"),
    rec("en-INT", "901", "created", "2026-11-10T22:40:00.000Z", "prod"),
  ];
  const acc = liveOn(records, "acc");
  assert.deepEqual(acc.map((p) => p.store), ["en-CH/eur", "en-CH", "en-INT"], "en-DE switched off since; Magento's order of store views");
  assert.equal(acc.find((p) => p.store === "en-INT")!.action, "updated");
  assert.equal(acc.find((p) => p.store === "en-CH/eur")!.url, "https://acc.apsoparts.com/en-CH/eur/kalrez-6221-6230-discontinued");
  assert.equal(acc.find((p) => p.store === "en-CH/eur")!.pageId, "739");
  assert.deepEqual(liveOn(records, "prod").map((p) => p.url), ["https://www.apsoparts.com/en-INT/kalrez-6221-6230-discontinued"]);
  assert.equal(lastWrite(records, "acc")!.at, "2026-11-10T22:30:00.000Z");
  assert.equal(lastWrite([], "prod"), null);
});

test("'Set up an A/B test': AI testing & personalization's preview, the PATH only and encoded, one store view", () => {
  const href = abTestHref("acc", "https://acc.apsoparts.com/en-CH/eur/kalrez-6221-6230-discontinued", 412);
  assert.equal(href, "/website/ai-personalization/preview?env=acc&path=%2Fen-CH%2Feur%2Fkalrez-6221-6230-discontinued&ask=1&from=content&piece=412");
  const u = new URL(href, "https://hub.example");
  assert.equal(u.searchParams.get("path"), "/en-CH/eur/kalrez-6221-6230-discontinued", "a path, never the whole address");
  assert.equal(u.searchParams.get("env"), "acc");
  assert.equal(abTestHref("prod", "/de-CH/a b&c", "7"), "/website/ai-personalization/preview?env=prod&path=%2Fde-CH%2Fa%20b%26c&ask=1&from=content&piece=7");
  const pages = liveOn([rec("en-INT", "738"), rec("en-CH", "740")], "acc");
  assert.equal(abStore(pages, ["en-CH", "en-INT"])!.store, "en-CH", "the store view the person works on");
  assert.equal(abStore(pages, ["de-CH", "en-INT"])!.store, "en-INT", "else the version's main one");
  assert.equal(abStore([], ["en-INT"]), null);
});

test("changed since the publish: what each store view's page got against what it would get now", () => {
  const written = [
    { env: "acc" as const, view: "en-INT", at: "2026-11-10T22:06:00.000Z", content: "<p>old</p>" },
    { env: "acc" as const, view: "en-CH", at: "2026-11-10T22:06:02.000Z", content: "<p>old</p>" },
    { env: "acc" as const, view: "de-CH", at: "2026-11-10T22:06:03.000Z", content: "<p>anders</p>" },
  ];
  assert.deepEqual(sinceOf("<p>new</p>", ["en-INT", "en-CH"], written), { acc: { at: "2026-11-10T22:06:02.000Z", pages: 2, changed: true } });
  assert.deepEqual(sinceOf("<p>old</p>", ["en-INT", "en-CH"], written), { acc: { at: "2026-11-10T22:06:02.000Z", pages: 2, changed: false } });
  assert.deepEqual(sinceOf("<p>old</p>", ["en-DE"], written), {}, "never written there: a first publish");
  assert.deepEqual(sinceOf(null, ["en-INT"], written), {}, "a page of the shop: not compared");
});

/* ── the second publish: the same pages updated, never a duplicate ─────── */

type FakePage = { id: number; identifier: string; title: string; content: string; active: boolean; stores: number[] };
const VIEWS: StoreRef[] = [
  { view: "en-INT", code: "international_eur_en", id: 26 }, { view: "en-CH/eur", code: "switzerland_eur_en", id: 2 }, { view: "en-CH", code: "switzerland_chf_en", id: 5 },
  { view: "en-DE", code: "germany_eur_en", id: 9 }, { view: "en-AT", code: "austria_eur_en", id: 11 }, { view: "en-FR", code: "france_eur_en", id: 17 },
  { view: "en-IT", code: "italy_eur_en", id: 19 }, { view: "en-NL", code: "netherlands_eur_en", id: 21 }, { view: "en-PL", code: "poland_eur_en", id: 33 },
];
function fakeMagento() {
  const pages: FakePage[] = [];
  const calls: { method: string; url: string }[] = [];
  let next = 738;
  const strip = ({ stores: _s, ...p }: FakePage) => p;
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, url: u.pathname });
    const ok = (j: unknown) => ({ status: 200, text: async () => JSON.stringify(j) });
    const [, store, rest] = /^\/rest\/([^/]+)\/V1\/cmsPage(?:\/(search|\d+))?$/.exec(u.pathname)!;
    if (init.method === "GET" && rest === "search") {
      const ident = u.searchParams.get("searchCriteria[filterGroups][0][filters][0][value]");
      const sid = Number(u.searchParams.get("searchCriteria[filterGroups][1][filters][0][value]"));
      return ok({ items: pages.filter((p) => p.identifier === ident && p.stores.includes(sid)).map(strip) });
    }
    if (init.method === "GET" && rest) { const p = pages.find((x) => x.id === Number(rest)); return p ? ok(strip(p)) : { status: 404, text: async () => "{}" }; }
    if (init.method === "POST") { const p: FakePage = { ...body.page, id: next++, stores: [VIEWS.find((v) => v.code === store)?.id ?? 0] }; pages.push(p); return ok(strip(p)); }
    if (init.method === "PUT") { const i = pages.findIndex((x) => x.id === Number(rest)); pages[i] = { ...pages[i], ...body.page, id: pages[i].id, stores: pages[i].stores }; return ok(strip(pages[i])); }
    return { status: 400, text: async () => "{}" };
  };
  return { m: magentoRequest({ base: "https://acc.apsoparts.com", fetch, authorize: () => "OAuth test" }), pages, calls, writes: () => calls.filter((c) => c.method !== "GET") };
}

test("SARCLA's Kalrez page published again after a change: its 9 pages updated in place - no new page, no duplicate", async () => {
  const f = fakeMagento();
  // the hub's backups, as src/lib/convert/cms.ts keeps them: "ours" = the pages this to-do created (written)
  const rows: { action: string; pageId: string | null; written: boolean; view: string }[] = [];
  const backups: Backups = {
    add: async (b) => { rows.push({ action: b.action, pageId: b.pageId, written: false, view: b.view }); return String(rows.length); },
    written: async (id, pageId) => { rows[Number(id) - 1].written = true; rows[Number(id) - 1].pageId = pageId; },
    failed: async () => undefined,
  };
  const ours = (id: string) => rows.some((r) => r.action === "create" && r.written && r.pageId === id);
  const targets: Target[] = VIEWS.map((v) => ({ view: v.view, ref: v }));
  const want = (content: string): Extract<Want, { kind: "page" }> => ({ kind: "page", identifier: KEY, title: "Kalrez 6221 and 6230 discontinued", metaTitle: "", metaDescription: "", content, active: true });
  const first = await writeShared(f.m, { env: "acc", view: "en-INT", targets, want: want("<p>first</p>"), language: VIEWS, ours, by: "sarcla", backups });
  assert.equal(first.action, "created");
  assert.equal(f.pages.length, 9, "one page in each of the 9 store views");
  const before = f.writes().length;
  // the page changed in the studio, then "Update on ACC"
  const plan = await planShared(f.m, { env: "acc", view: "en-INT", targets, want: want("<p>changed</p>"), language: VIEWS, ours });
  assert.equal(plan.action, "update");
  assert.deepEqual(plan.targets.map((t) => t.state), Array(9).fill("has"), "each store view: its page is this to-do's");
  assert.deepEqual(plan.targets.map((t) => t.pageId), ["738", "739", "740", "741", "742", "743", "744", "745", "746"]);
  const again = await writeShared(f.m, { env: "acc", view: "en-INT", targets, want: want("<p>changed</p>"), language: VIEWS, ours, by: "sarcla", backups });
  assert.equal(again.action, "updated");
  const second = f.writes().slice(before);
  assert.equal(second.length, 9);
  assert.ok(second.every((c) => c.method === "PUT"), "only updates - never a POST");
  assert.equal(f.pages.length, 9, "no duplicate");
  assert.ok(f.pages.every((p) => p.content === "<p>changed</p>"));
  assert.deepEqual(again.pages.map((p) => p.action), Array(9).fill("updated"));
});
