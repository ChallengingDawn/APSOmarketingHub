import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChanges, type AnyChange } from "../src/lib/content/studio/kinds/page/apply";
import {
  convertVersionsOf, finalChanges, mainView, openVersion, pageDoc, versionList, viewOf, withView, type ConvertVersion, type PageDoc,
} from "../src/lib/content/studio/kinds/page/model";
import { drawVersion, otherVersion } from "../src/lib/content/studio/kinds/page/versionDraw";
import { applyWithRoot, batches, diffOps, lightFirst, restoreLight } from "../src/lib/content/studio/doc";

// SARCLA 11.11.2026 ~15:30: "A/B testing is not that good, it doesn't switch version on Content." A Page builder to-do for
// the de-CH home page, from a BLOCK optimization of AI testing & personalization: versions A-D, each ONE change replacing
// the SAME block (by its position among the Page Builder rows) with another module. Clicking B / C / D left A on the stage.

const BLOCK = `div[data-content-type="row"]:nth-of-type(2)`;
const HOME = `<!doctype html><html><head><title>APSOparts</title></head><body class="cms-index-index">
<main id="maincontent" class="page-main"><div class="columns"><div class="column main">
<div data-content-type="row" class="r1"><h2>Willkommen</h2></div>
<div data-content-type="row" class="r2"><h2>Top-Kategorien</h2><a href="/de-CH/dichtungstechnik.html">Dichtungstechnik</a></div>
<div data-content-type="row" class="r3"><h2>Top-Produkte</h2></div>
</div></div></main><footer>F</footer></body></html>`;

// each version's module: its own words - and heavy, as a real module is (over the 5.5 KB a list item may weigh in one go)
const MODS = ["Beweise", "Produkte", "Antworten", "Naechster Schritt"];
const para = (letter: string) => `<p>${letter} ${"x".repeat(90)}</p>`;
const moduleHtml = (letter: string, i: number) =>
  `<div class="apx-mod apx-mod-${letter.toLowerCase()}"><style>.apx-mod-${letter.toLowerCase()}{padding:24px}</style><h2>Version ${letter}: ${MODS[i]}</h2>${para(letter).repeat(70)}</div>`;
const LETTERS = ["A", "B", "C", "D"];
const all: ConvertVersion[] = LETTERS.map((letter, i) => ({
  id: `v${i + 1}`, ideaId: "idea-1", letter, rev: 1, summary: `Version ${letter}`, updatedAt: "2026-11-11T14:00:00.000Z",
  changes: [{ op: "replace", selector: BLOCK, html: moduleHtml(letter, i), id: `c${letter}`, note: MODS[i] } as never],
}));

/** the to-do as the import leaves it (server.ts ~852): A sent and open, every version under its letter */
const imported = (): PageDoc => pageDoc({
  source: "convert", env: "acc", path: "/de-CH/", store: "de-CH", started: true,
  origin: { versionId: "v1", rev: 1, status: "approved", summary: "Version A", idea: "Top-Kategorien", letter: "A" },
  changes: all[0].changes, letter: "A", versions: convertVersionsOf(all, all[0]),
});
const open = (doc: PageDoc, letter: string) => withView(doc, mainView(doc), openVersion(viewOf(doc, mainView(doc)), letter));
const shows = (html: string, letter: string) => html.includes(`Version ${letter}: `);
const htmlOf = (c: unknown) => (c as { html: string }).html;

test("two versions replacing the SAME block: drawing A then B shows B, never A", () => {
  const a = viewOf(imported(), "de-CH");
  assert.deepEqual(versionList(a).map((v) => v.letter), LETTERS);
  const drawnA = drawVersion(HOME, a);
  assert.ok(shows(drawnA.html, "A") && !shows(drawnA.html, "B"));
  assert.equal(drawnA.hits[0].state, "found");
  for (const letter of ["B", "C", "D", "A"]) {
    const v = viewOf(open(imported(), letter), "de-CH");
    const drawn = drawVersion(HOME, v);
    assert.ok(shows(drawn.html, letter), `version ${letter} is on the stage`);
    for (const other of LETTERS.filter((x) => x !== letter)) assert.ok(!shows(drawn.html, other), `${other} is not on the stage with ${letter}`);
    assert.equal(drawn.hits[0].state, "found", `${letter}'s block is found on the page as the shop serves it`);
    // the shop's block stays in the page, hidden (the preview's "Show the old one")
    assert.ok(drawn.html.includes("Top-Kategorien"));
  }
});

test("the bug's shape: B laid over the picture of A keeps A on the stage", () => {
  const drawnA = drawVersion(HOME, viewOf(imported(), "de-CH"));
  const b = viewOf(open(imported(), "B"), "de-CH");
  // the old way: what was drawn at once went into the picture already on the stage (A's module in the block's place)
  const over = applyChanges(drawnA.html, finalChanges(b).changes as AnyChange[]);
  assert.ok(shows(over.html, "A"), "A stays when B is drawn over A's picture");
  assert.equal(over.hits[0].state, "missing", "the block moved down a row under A's module: B's selector finds nothing");
  // the fix: from the page as the shop serves it
  const fresh = drawVersion(HOME, b);
  assert.ok(shows(fresh.html, "B") && !shows(fresh.html, "A"));
});

test("the stage draws the open version itself only while its picture is another version's", () => {
  const b = viewOf(open(imported(), "B"), "de-CH");
  assert.equal(otherVersion("A", b), true);
  assert.equal(otherVersion("B", b), false);
  assert.equal(otherVersion(undefined, b), false);
  assert.equal(otherVersion("A", { letter: "" }), false, "no letter = A");
});

test("a version opened while the last switch is still saving is not swapped back, and no module is left empty", () => {
  const cur = imported();
  // B opened: A's module goes back under its letter - a list too heavy for one request, so it is written light first
  const nextB = open(cur, "B");
  const s1 = lightFirst(cur, nextB);
  assert.ok(s1, "the switch is heavy");
  const first1 = pageDoc(s1.first);
  assert.equal(first1.letter, "B");
  assert.equal(htmlOf(versionList(first1).find((v) => v.letter === "A")!.changes[0]), "", "A is light while it saves");
  // every request of that first step fits under the firewall's limit
  assert.ok(batches(diffOps(cur, s1.first)).every((b) => JSON.stringify(b).length < 8_000));

  // ... and while it saves ("Saving..."), C is clicked - from the document on the screen (A light)
  const nextC = open(first1, "C");
  const s2 = lightFirst(first1, nextC);
  const onScreen = s2 ? s2.first : nextC;
  // the old second step wrote `nextB` whole: C swapped back to B
  assert.equal(nextB.letter, "B");
  // now: the whole texts go back into the document as it is
  const back1 = restoreLight(onScreen, s1.pairs);
  const done = pageDoc(s2 ? restoreLight(back1, s2.pairs) : back1);
  assert.equal(done.letter, "C", "C stays open");
  for (const [i, letter] of LETTERS.entries()) {
    const v = versionList(done).find((x) => x.letter === letter)!;
    assert.equal(htmlOf(v.changes[0]), moduleHtml(letter, i), `version ${letter} keeps its whole module`);
  }
  assert.ok(shows(drawVersion(HOME, viewOf(done, "de-CH")).html, "C"));
});

test("A opened again while B's switch saves: A's module comes back whole, where it stands now", () => {
  const cur = imported();
  const s1 = lightFirst(cur, open(cur, "B"))!;
  const first1 = pageDoc(s1.first);
  // A's light list moves from versions to the open `changes`
  const nextA = open(first1, "A");
  assert.equal(htmlOf(nextA.changes[0]), "");
  const s2 = lightFirst(first1, nextA);
  const onScreen = s2 ? s2.first : nextA;
  const done = pageDoc(restoreLight(restoreLight(onScreen, s1.pairs), s2?.pairs ?? []));
  assert.equal(done.letter, "A");
  assert.equal(htmlOf(done.changes[0]), moduleHtml("A", 0));
  assert.equal(htmlOf(versionList(done).find((v) => v.letter === "B")!.changes[0]), moduleHtml("B", 1));
  const drawn = drawVersion(HOME, viewOf(done, "de-CH"));
  assert.ok(shows(drawn.html, "A") && !shows(drawn.html, "B"));
});

test("nothing happening meanwhile: the two steps end as the one change did", () => {
  const cur = imported();
  const next = open(cur, "D");
  const s = lightFirst(cur, next)!;
  assert.deepEqual(restoreLight(s.first, s.pairs), JSON.parse(JSON.stringify(next)));
  // a light change goes in one step
  assert.equal(lightFirst(cur, { ...cur, notes: "x" }), null);
  // a value changed since is left as it is
  const path = s.pairs[0].path;
  const moved = applyWithRoot(s.first, [{ op: "set", path, value: [] }]);
  let at: unknown = moved;
  for (const k of path) at = (at as Record<string | number, unknown>)[k];
  assert.deepEqual(at, []);
  let after: unknown = restoreLight(moved, s.pairs);
  for (const k of path) after = (after as Record<string | number, unknown>)[k];
  assert.deepEqual(after, []);
});
