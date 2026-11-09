import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_REVIEWER_EMAIL, defaultReviewerOf, newTodoPeople, reviewerChoices } from "../src/lib/content/people";
import { AUTO_MARK, versionName, wholeTaskLabel, whenLabel } from "../src/lib/content/studio/versionNames";

// SARCLA 09.11.2026: "on all projects the owner is the person who creates it and the reviewer is Claudio - keep the
// dropdown but prefill"; "Versions is not working correctly as it should".

test("the default reviewer is Claudio, found by username or by e-mail", () => {
  assert.equal(DEFAULT_REVIEWER_EMAIL, "claudio.saraiva@apsoparts.com");
  assert.equal(defaultReviewerOf([{ username: "anna@apsoparts.com" }, { username: "Claudio.Saraiva@apsoparts.com" }]), "Claudio.Saraiva@apsoparts.com");
  assert.equal(defaultReviewerOf([{ username: "SARCLA", email: "claudio.saraiva@apsoparts.com" }]), "SARCLA");
  assert.equal(defaultReviewerOf([{ username: "anna", email: "anna@apsoparts.com" }]), null);
});

test("a new to-do: the owner is who makes it, the reviewer the default one - what was picked wins", () => {
  const base = { me: "anna", defaultReviewer: "claudio" };
  assert.deepEqual(newTodoPeople({ ...base, kind: "landing-page" }), { writer: "anna", reviewer: "claudio" });
  assert.deepEqual(newTodoPeople({ ...base, kind: "landing-page", writer: "ben", reviewer: "carla" }), { writer: "ben", reviewer: "carla" });
  assert.deepEqual(newTodoPeople({ ...base, kind: "blog-article", reviewer: null }), { writer: "anna", reviewer: null }); // nobody, chosen
  assert.deepEqual(newTodoPeople({ ...base, kind: "task" }), { writer: "anna", reviewer: null });                         // an action
  assert.deepEqual(newTodoPeople({ me: "anna", defaultReviewer: null, kind: "video" }), { writer: "anna", reviewer: null });
});

test("'Who reviews it?': the default reviewer first and picked, the owner not offered", () => {
  const people = [{ username: "anna" }, { username: "ben" }, { username: "claudio" }];
  assert.deepEqual(reviewerChoices(people, "anna", "claudio"), { list: [{ username: "claudio" }, { username: "ben" }], picked: "claudio" });
  // Claudio's own to-do: he still stands first (he reviews every project)
  assert.deepEqual(reviewerChoices(people, "claudio", "claudio"), { list: [{ username: "claudio" }, { username: "anna" }, { username: "ben" }], picked: "claudio" });
  assert.deepEqual(reviewerChoices(people, "anna", null), { list: [{ username: "ben" }, { username: "claudio" }], picked: null });
});

test("a version kept automatically before an AI writes the whole thing", () => {
  assert.equal(wholeTaskLabel("page", "fill_all"), `${AUTO_MARK} wrote the page`);
  assert.equal(wholeTaskLabel("page", "rewrite", {}), `${AUTO_MARK} changed the page`);
  assert.equal(wholeTaskLabel("page", "rewrite", { selector: "h1" }), `${AUTO_MARK} changed a part of the page`);
  assert.equal(wholeTaskLabel("page", "translate", { to: "fr" }), `${AUTO_MARK} translated the page into FR`);
  assert.equal(wholeTaskLabel("social", "write"), `${AUTO_MARK} wrote the post's texts`);
  assert.equal(wholeTaskLabel("banner", "copy"), `${AUTO_MARK} wrote the banner's words`);
  assert.equal(wholeTaskLabel("video", "storyboard"), `${AUTO_MARK} wrote the film`);
  assert.equal(wholeTaskLabel("page", "fill_hero"), null);          // a part
  assert.equal(wholeTaskLabel("blog", "outline"), null);            // the blog keeps its own before each change
});

test("the Versions menu says what each version is and when - never a change's number", () => {
  const now = new Date(2026, 10, 9, 15, 0);
  const at = (h: number, m: number, day = 9) => new Date(2026, 10, day, h, m).toISOString();
  const o = { nameOf: (u: string) => (u === "claudio" ? "Claudio Saraiva" : u), me: "anna", now };
  assert.deepEqual(versionName({ id: 1, label: null, by: "claudio", at: at(10, 12) }, o), { title: "Kept by Claudio", sub: "10:12", auto: false });
  assert.deepEqual(versionName({ id: 2, label: null, by: "anna", at: at(9, 5, 8) }, o), { title: "Kept by you", sub: "Yesterday 09:05", auto: false });
  assert.deepEqual(versionName({ id: 3, label: "Shorter subject", by: "claudio", at: at(10, 12, 2) }, o), { title: "Shorter subject", sub: "Kept by Claudio · 2 Nov 10:12", auto: false });
  assert.equal(versionName({ id: 4, label: "Before the AI: wrote the page", by: "claudio", at: at(10, 12) }, o).title, "Before the AI wrote the page");
  // the blog's and the newsletter's own, kept before each change - their number gone
  const blog = versionName({ id: 5, label: "Before the AI: Before: The post: 5 sections, 3 lines \"in short\" #1794201096866", by: "claudio", at: at(11, 0) }, o);
  assert.equal(blog.title, "Before the AI wrote the post");
  assert.equal(blog.auto, true);
  assert.ok(!/#\d/.test(blog.title + blog.sub));
  assert.equal(versionName({ id: 6, label: "Before: Translated into French: 4 sections #1794201096999", by: "x", at: at(11, 0) }, o).title, "Before the AI translated it into French");
  assert.equal(versionName({ id: 7, label: "Before: Layout: Classic - the words already written are kept. #1794201097000", by: "x", at: at(11, 0) }, o).title, "Before the layout “Classic”");
  assert.equal(versionName({ id: 8, label: "Before: Subject: “New FKM cords” #1794201097001", by: "x", at: at(11, 0) }, o).title, "Before: Subject: “New FKM cords”");
  assert.equal(versionName({ id: 9, label: "Before the AI: Make it more convincing", by: "x", at: at(11, 0) }, o).title, "Before the AI: Make it more convincing");
  assert.equal(versionName({ id: 10, label: "Before bringing back “Kept by Claudio”", by: "claudio", at: at(12, 0) }, o).sub, "Kept on its own · 12:00");
  assert.equal(whenLabel(new Date(2025, 0, 3, 8, 7).toISOString(), now), "3 Jan 2025 08:07");
});
