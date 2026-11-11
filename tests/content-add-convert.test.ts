import assert from "node:assert/strict";
import { test } from "node:test";
import { markerOf, pageMarker, projectForPage } from "../src/lib/convert/handoff";
import {
  TODO_BRIEF_MAX, checkAddConvert, markerFor, notesFor, pagesOf, sameTodo, shopPathOf, studioPath, todoBrief, todoLanguage, todoTitle,
} from "../src/lib/content/convertTodo";

// A page from AI testing & personalization added to a project that is there already (SARCLA 10.11.2026: "upon sending to
// Content allow to create a new project or associate to the current one + the ticket"). Made-up pages and ids.

const PAGE = "/de-CH/12202510-maschinenfuss.html";

test("the to-do's own brief ends with its page's marker - the page and the version", () => {
  const b = todoBrief({ env: "prod", path: PAGE, versionId: "41", brief: "Clearer sizes on top.\n\nWrite in German." });
  assert.ok(b.startsWith("Clearer sizes on top."));
  assert.ok(b.endsWith(pageMarker("prod", PAGE, null, "41")));
  assert.deepEqual(markerOf(b), { env: "prod", path: PAGE, versionId: "41" });
  // without a version: the page only
  assert.deepEqual(markerOf(todoBrief({ env: "acc", path: "/fr-CH/x.html", versionId: null, brief: "" })), { env: "acc", path: "/fr-CH/x.html" });
  assert.equal(todoBrief({ env: "acc", path: "/fr-CH/x.html", versionId: null, brief: "" }), "[APSOconvert page acc:/fr-CH/x.html]");
});

test("a marker already in the brief sent gives way to the to-do's own - one marker, the one asked for", () => {
  // the brief the app makes for Send to Content carries a marker of its own (another version, even a test)
  const sent = projectForPage({
    env: "prod", path: PAGE, url: `https://www.apsoparts.com${PAGE}`, h1: "Maschinenfuss", title: "", numbers: null,
    ideas: [{ title: "Sizes first", why: "", change: "Put the sizes table on top", expect: "" }], version: null,
    versions: [{ id: "7", letter: "A", rev: 1, summary: "Sizes on top" }], previewPath: "/website/ai-personalization/preview",
  }).brief;
  assert.deepEqual(markerOf(sent), { env: "prod", path: PAGE, versionId: "7" });
  const b = todoBrief({ env: "acc", path: PAGE, versionId: "8", brief: `${sent}\n\n[APSOconvert page prod:/de-CH/other.html test:3]` });
  assert.equal(b.match(/\[APSOconvert page /g)?.length, 1);
  assert.deepEqual(markerOf(b), { env: "acc", path: PAGE, versionId: "8" });
  assert.ok(b.includes("Sizes first"));
});

test("a long brief is cut, its marker kept whole", () => {
  const b = todoBrief({ env: "prod", path: PAGE, versionId: "41", brief: "x".repeat(20_000) });
  assert.ok(b.length <= TODO_BRIEF_MAX);
  assert.deepEqual(markerOf(b), { env: "prod", path: PAGE, versionId: "41" });
});

test("the studio reads the to-do's marker first, then the project's", () => {
  const project = "Shop page: Maschinenfuss\n\n[APSOconvert page prod:/de-CH/a.html test:12]";
  const todo = todoBrief({ env: "acc", path: "/de-CH/b.html", versionId: "5", brief: "Page two" });
  // the to-do's own: its page, its version - and no test's winner, whatever the project's marker says
  assert.deepEqual(markerFor(todo, project), { env: "acc", path: "/de-CH/b.html", versionId: "5" });
  assert.equal(markerFor(todo, project)?.testId, undefined);
  // a to-do with no notes of its own (every to-do before): the project's
  assert.deepEqual(markerFor(null, project), { env: "prod", path: "/de-CH/a.html", testId: "12" });
  assert.deepEqual(markerFor("", project), { env: "prod", path: "/de-CH/a.html", testId: "12" });
  assert.deepEqual(markerFor(undefined, project), { env: "prod", path: "/de-CH/a.html", testId: "12" });
  // notes without a marker do not hide the project's
  assert.deepEqual(markerFor("just words", project), { env: "prod", path: "/de-CH/a.html", testId: "12" });
  assert.equal(markerFor(null, "a project of the team"), null);
  assert.equal(markerFor(null, null), null);
  // the brief the studio keeps and shows: the one whose marker it opens
  assert.equal(notesFor(todo, project), todo);
  assert.equal(notesFor(null, project), project);
  assert.equal(notesFor("just words", project), project);
  assert.equal(notesFor(null, null), null);
});

test("the request: the shop, the page, the version, the brief, the ticket", () => {
  const ok = checkAddConvert({ action: "piece-add-convert", env: "prod", path: PAGE, versionId: 41, ideaTitle: "  Sizes   first ", brief: "Words", contentType: "page-builder" });
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.value, { env: "prod", path: PAGE, versionId: "41", ideaTitle: "Sizes   first", brief: "Words", kind: "page-refresh", ticket: null });
  const fail = (b: Record<string, unknown>) => { const r = checkAddConvert(b); assert.equal(r.ok, false); return r.ok ? "" : r.error; };
  assert.match(fail({ path: PAGE }), /env "prod" or "acc"/);
  assert.match(fail({ env: "live", path: PAGE }), /env "prod" or "acc"/);
  assert.match(fail({ env: "prod" }), /not a page of the shop/);
  assert.match(fail({ env: "prod", path: "de-CH/x.html" }), /not a page of the shop/);
  assert.match(fail({ env: "prod", path: "/de-CH/x].html" }), /not a page of the shop/);
  assert.match(fail({ env: "prod", path: "/de-CH/a b.html" }), /not a page of the shop/);
  assert.match(fail({ env: "prod", path: "/de-CH/checkout/cart" }), /not a page of the shop/);
  assert.match(fail({ env: "prod", path: PAGE, versionId: "v7" }), /versionId/);
  assert.match(fail({ env: "prod", path: PAGE, ideaTitle: 3 }), /ideaTitle/);
  assert.match(fail({ env: "prod", path: PAGE, brief: { a: 1 } }), /brief/);
  assert.match(fail({ env: "prod", path: PAGE, brief: "x".repeat(7001) }), /too long/);
  assert.match(fail({ env: "prod", path: PAGE, contentType: 5 }), /contentType/);
  // the shop's own address is read as its path; a store code in small letters as the shop writes it
  const url = checkAddConvert({ env: "acc", path: "https://acc.apsoparts.com/de-ch/o-ringe?x=1" });
  assert.equal(url.ok && url.value.path, "/de-CH/o-ringe");
  assert.equal(shopPathOf("https://example.com/de-CH/o-ringe"), null);
  // no version is the page only; a kind the board offers stays that kind, anything else is the Page builder
  const bare = checkAddConvert({ env: "prod", path: PAGE });
  assert.deepEqual(bare.ok && [bare.value.versionId, bare.value.kind, bare.value.ticket, bare.value.brief, bare.value.ideaTitle], [null, "page-refresh", null, "", ""]);
  assert.equal(((r) => r.ok && r.value.kind)(checkAddConvert({ env: "prod", path: PAGE, contentType: "landing-page" })), "landing-page");
  assert.equal(((r) => r.ok && r.value.kind)(checkAddConvert({ env: "prod", path: PAGE, contentType: "something" })), "page-refresh");
});

test("the request's ticket: link one of Scroll to Sale, or make one - nothing else", () => {
  const ticket = (t: unknown) => { const r = checkAddConvert({ env: "prod", path: PAGE, ticket: t }); return r.ok ? r.value.ticket : r.error; };
  assert.deepEqual(ticket({ link: "448924014805" }), { link: "448924014805" });
  assert.deepEqual(ticket({ link: 448924014805 }), { link: "448924014805" });
  assert.deepEqual(ticket({ create: true }), { create: true });
  assert.equal(ticket(null), null);
  assert.equal(ticket(false), null);
  assert.equal(ticket(undefined), null);
  assert.match(String(ticket({ link: "123", create: true })), /not both/);
  assert.match(String(ticket({ link: "TCK-1" })), /not a ticket number/);
  assert.match(String(ticket({ create: "yes" })), /"create": true/);
  assert.match(String(ticket({})), /"link"/);
  assert.match(String(ticket("448924014805")), /"link"/);
});

test("the to-do's name, language and studio", () => {
  assert.equal(todoTitle("Sizes first", PAGE, "page-refresh"), `Page builder · Sizes first · ${PAGE}`);
  assert.equal(todoTitle("", PAGE, "page-refresh"), `Page builder · ${PAGE}`);
  assert.ok(todoTitle("y".repeat(400), PAGE, "page-refresh").length <= 200);
  assert.equal(todoLanguage(PAGE), "DE");
  assert.equal(todoLanguage("/fr-CH/x.html"), "FR");
  assert.equal(studioPath(12, 345), "/projects/12/pieces/345");
});

test("the pages a project holds, for the picker: its own marker, then each to-do's", () => {
  const pages = pagesOf("Brief\n\n[APSOconvert page prod:/de-CH/a.html v:3]", [
    { id: 10, brief: null },
    { id: 11, brief: todoBrief({ env: "acc", path: "/de-CH/b.html", versionId: "9", brief: "" }) },
    { id: 12, brief: "notes without a page" },
  ]);
  assert.deepEqual(pages, [
    { pieceId: null, env: "prod", path: "/de-CH/a.html", versionId: "3", testId: null },
    { pieceId: 11, env: "acc", path: "/de-CH/b.html", versionId: "9", testId: null },
  ]);
  assert.deepEqual(pagesOf(null, []), []);
});

test("the same page and version sent again finds the to-do it made - nothing made twice", () => {
  const pieces = [
    { id: 20, brief: todoBrief({ env: "prod", path: "/de-CH/b.html", versionId: "9", brief: "first" }) },
    { id: 21, brief: todoBrief({ env: "prod", path: "/de-CH/b.html", versionId: null, brief: "" }) },
  ];
  assert.equal(sameTodo(pieces, { env: "prod", path: "/de-CH/b.html", versionId: "9" }), 20);
  assert.equal(sameTodo(pieces, { env: "prod", path: "/de-CH/b.html", versionId: null }), 21);
  // another version, the other shop, another page: a new to-do
  assert.equal(sameTodo(pieces, { env: "prod", path: "/de-CH/b.html", versionId: "10" }), null);
  assert.equal(sameTodo(pieces, { env: "acc", path: "/de-CH/b.html", versionId: "9" }), null);
  assert.equal(sameTodo(pieces, { env: "prod", path: "/de-CH/c.html", versionId: "9" }), null);
  assert.equal(sameTodo([], { env: "prod", path: "/de-CH/b.html", versionId: "9" }), null);
});
