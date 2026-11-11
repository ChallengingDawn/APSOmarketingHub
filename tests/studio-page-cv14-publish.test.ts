import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACC_FIRST, AB_FROM_PAGE, PUB_SECTIONS, abActionsOf, abRows, changeWords, pageRows, plainChange, progressLine, stateLine, testsOfPage, updateAllOf, variantChanges,
  type AbTestLite, type PubVersion,
} from "../src/lib/content/studio/kinds/page/publishView";
import type { WrittenRecord } from "../src/lib/content/studio/kinds/page/published";

// Content v14 (SARCLA 11.11.2026, ~13:40, after publishing the first official page - Kalrez - with the picture storage):
// "On the Magento last step we should be able to see the current links in one tab, and in one click update them all";
// "we should see the setup as today"; "pictures should be a new tab"; "the A/B test on the publish modal: we need to
// control it from here".

const KEY = "kalrez-6221-6230-discontinued";
const rec = (store: string, env: "acc" | "prod" = "acc", action: WrittenRecord["action"] = "created", at = "2026-11-11T12:30:00.000Z"): WrittenRecord =>
  ({ env, store, pageId: String(700 + store.length), identifier: KEY, action, at, url: "" });

// his page: six languages, English in three store views, the rest in one or two
const VIEWS: PubVersion[] = [
  { view: "en-INT", label: "English · 3 store views", cms: true, stores: [{ view: "en-INT" }, { view: "en-CH" }, { view: "en-CH/eur" }], since: { acc: { at: "2026-11-11T12:30:00.000Z", pages: 3, changed: true } } },
  { view: "de-CH", label: "German · 2 store views", cms: true, stores: [{ view: "de-CH" }, { view: "de-DE" }], since: { acc: { at: "2026-11-11T12:31:00.000Z", pages: 2, changed: false } } },
  { view: "fr-CH", label: "French · 1 store view", cms: true, stores: [{ view: "fr-CH" }], since: { acc: { at: "2026-11-11T12:32:00.000Z", pages: 1, changed: true } } },
  { view: "it-CH", label: "Italian · 1 store view", cms: true, stores: [{ view: "it-CH" }], since: {} },
  { view: "pl-PL", label: "Polish", cms: true, blocked: "Words to finish first", stores: [{ view: "pl-PL" }], since: { acc: { at: "2026-11-11T12:33:00.000Z", pages: 1, changed: true } } },
  { view: "nl-NL", label: "Dutch", cms: false, why: "Not a CMS page", stores: [{ view: "nl-NL" }] },
];
const RECORDS: WrittenRecord[] = ["en-INT", "en-CH", "en-CH/eur", "de-CH", "de-DE", "fr-CH", "pl-PL"].map((s) => rec(s));

test("the sections: Pages first, then Pictures, A/B test, Setup", () => {
  assert.deepEqual(PUB_SECTIONS.map((s) => s.key), ["pages", "pictures", "ab", "setup"]);
});

test("a row per language: its links on each shop, changed since or as published, when", () => {
  const rows = pageRows(VIEWS, RECORDS);
  assert.equal(rows.length, 6);
  const en = rows[0];
  assert.deepEqual(en.stores, ["en-INT", "en-CH", "en-CH/eur"]);
  assert.equal(en.envs.acc.state, "changed");
  assert.deepEqual(en.envs.acc.pages.map((p) => p.url).sort(), [
    "https://acc.apsoparts.com/en-CH/eur/kalrez-6221-6230-discontinued",
    "https://acc.apsoparts.com/en-CH/kalrez-6221-6230-discontinued",
    "https://acc.apsoparts.com/en-INT/kalrez-6221-6230-discontinued",
  ]);
  assert.equal(en.envs.prod.state, "none");
  assert.equal(en.envs.prod.pages.length, 0);
  assert.equal(rows[1].envs.acc.state, "same");
  assert.equal(rows[3].envs.acc.state, "none");
  assert.equal(rows[4].writable, false, "words to finish: not written");
  assert.equal(rows[5].writable, false, "not a CMS page");
  const when = (iso: string) => iso.slice(11, 16);
  assert.equal(stateLine(en.envs.acc, when), "changed since the publish (12:30)");
  assert.equal(stateLine(rows[1].envs.acc, when), "as published · 12:31");
  assert.equal(stateLine(en.envs.prod, when), "not published here");
});

test("a page of the shop (no `since`): on the shop, not compared; a page switched off is not a link", () => {
  const rows = pageRows([{ view: "de-CH", cms: true, stores: [{ view: "de-CH" }, { view: "de-DE" }] }], [rec("de-CH", "acc", "switched-off", "2026-11-11T13:00:00.000Z"), rec("de-CH"), rec("de-DE")]);
  assert.equal(rows[0].envs.acc.state, "on");
  assert.deepEqual(rows[0].envs.acc.pages.map((p) => p.store), ["de-DE"]);
});

test("Update all on ACC: the changed pages, n pages for their store views; ticked all, every page that can be written", () => {
  const rows = pageRows(VIEWS, RECORDS);
  const acc = updateAllOf(rows, "acc", { all: false, accLive: true });
  assert.deepEqual(acc.views, ["en-INT", "fr-CH"], "German as published, Italian never written, Polish blocked, Dutch not CMS");
  assert.equal(acc.pages, 2);
  assert.equal(acc.storeViews, 4);
  assert.equal(acc.label, "Update all on ACC (2 pages)");
  assert.equal(acc.why, null);
  const every = updateAllOf(rows, "acc", { all: true, accLive: true });
  assert.deepEqual(every.views, ["en-INT", "de-CH", "fr-CH", "it-CH"]);
  assert.equal(every.storeViews, 7);
  assert.equal(every.label, "Update all on ACC (4 pages)");
});

test("Update all on production: refused until the page is on ACC; never there yet, ticked all = Publish all", () => {
  const rows = pageRows(VIEWS, RECORDS);
  assert.equal(updateAllOf(rows, "prod", { all: true, accLive: false }).why, ACC_FIRST);
  const none = updateAllOf(rows, "prod", { all: false, accLive: true });
  assert.equal(none.pages, 0);
  assert.equal(none.label, "Update all on production");
  assert.match(none.why ?? "", /Not on production yet - tick "all"/);
  const all = updateAllOf(rows, "prod", { all: true, accLive: true });
  assert.equal(all.verb, "Publish");
  assert.equal(all.label, "Publish all on production (4 pages)");
  assert.equal(all.why, null);
});

test("Update all: nothing changed says so; what holds every write (the review, the key, the pictures) is said instead", () => {
  const same = pageRows([{ ...VIEWS[1] }], RECORDS);
  assert.match(updateAllOf(same, "acc", { all: false, accLive: true }).why ?? "", /Nothing changed since the publish on ACC/);
  const held = updateAllOf(pageRows(VIEWS, RECORDS), "acc", { all: false, accLive: true, held: "2 pictures are not in ACC's media yet." });
  assert.equal(held.why, "2 pictures are not in ACC's media yet.");
  assert.equal(updateAllOf(pageRows([VIEWS[5]], []), "acc", { all: true, accLive: true }).why, "No page can be written - see Setup.");
  assert.equal(progressLine("German · 2 store views", "ACC", 2, 6), "Writing German · 2 store views into ACC · 2 of 6…");
});

const test1 = (id: string, env: "acc" | "prod", pages: string[], status: AbTestLite["status"], updatedAt = "2026-11-11T12:00:00.000Z", piece: number | null = null): AbTestLite => ({ id, env, pages, status, updatedAt, piece });

test("the page's A/B tests: on one of its published addresses on that test's shop, or made from this to-do", () => {
  const tests = [
    test1("1", "acc", ["/en-INT/kalrez-6221-6230-discontinued"], "running"),
    test1("2", "prod", ["/en-INT/kalrez-6221-6230-discontinued"], "draft"), // not on production yet: not this page's there
    test1("3", "acc", ["/de-CH/other-page"], "running"),
    test1("4", "acc", ["/fr-CH/somewhere"], "draft", undefined, 7),
    test1("5", "acc", ["https://acc.apsoparts.com/de-DE/kalrez-6221-6230-discontinued"], "paused"),
  ];
  assert.deepEqual(testsOfPage(tests, RECORDS, 7).map((t) => t.id), ["1", "4", "5"]);
});

test("each published store view with its A/B state: live first, then a draft, then the newest ended one", () => {
  const tests = [
    test1("a", "acc", ["/en-INT/kalrez-6221-6230-discontinued"], "stopped", "2026-11-11T09:00:00.000Z"),
    test1("b", "acc", ["/en-INT/kalrez-6221-6230-discontinued"], "running", "2026-11-10T09:00:00.000Z"),
    test1("c", "acc", ["/de-CH/kalrez-6221-6230-discontinued"], "stopped", "2026-11-09T09:00:00.000Z"),
    test1("d", "acc", ["/de-CH/kalrez-6221-6230-discontinued"], "shipped", "2026-11-11T09:00:00.000Z"),
  ];
  const rows = abRows(RECORDS, tests);
  assert.equal(rows.length, 7);
  assert.equal(rows.find((r) => r.store === "en-INT")?.test?.id, "b");
  assert.equal(rows.find((r) => r.store === "de-CH")?.test?.id, "c", "stopped before shipped");
  assert.equal(rows.find((r) => r.store === "fr-CH")?.test, null);
  assert.equal(rows.find((r) => r.store === "en-CH/eur")?.path, "/en-CH/eur/kalrez-6221-6230-discontinued");
});

test("what a person may do with a test from here: start a draft, pause or stop a live one, resume a paused one", () => {
  assert.deepEqual(abActionsOf("draft"), ["start"]);
  assert.deepEqual(abActionsOf("running"), ["pause", "stop"]);
  assert.deepEqual(abActionsOf("paused"), ["resume", "stop"]);
  assert.deepEqual(abActionsOf("stopped"), []);
  assert.deepEqual(abActionsOf("shipped"), []);
});

test("a test made from the page: version B over the page as it is - what A already put live is left out, as the studio's off ones", () => {
  const hero = { op: "replace", selector: ".hero", html: "<section class=\"np-hero\">A</section>", id: "c1", module: { type: "hero", settings: {} } };
  const intro = { op: "text", selector: "h1", text: "Order until 27 November", id: "c2" };
  const cta = { op: "insert", selector: ".footer", where: "before", html: "<div>CTA</div>", id: "c3" };
  const broken = { op: "insert", selector: ".x", where: "after", html: "<div>x</div>", id: "c4", off: "Looks wrong" };
  const v = variantChanges([hero, intro], [hero, { ...intro, text: "Order now" }, cta, broken]);
  assert.deepEqual(v, [{ op: "text", selector: "h1", text: "Order now" }, { op: "insert", selector: ".footer", where: "before", html: "<div>CTA</div>" }]);
  assert.deepEqual(plainChange(hero), { op: "replace", selector: ".hero", html: "<section class=\"np-hero\">A</section>" });
  assert.equal(changeWords(cta), "Added before .footer");
  assert.equal(changeWords({ op: "hide", selector: ".old", note: "the old banner" }), "Hidden in .old - the old banner");
});

test("making a test from the page waits for AI testing & personalization's release (one flag)", () => {
  assert.equal(AB_FROM_PAGE, false);
});
