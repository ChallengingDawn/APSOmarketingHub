import assert from "node:assert/strict";
import { test } from "node:test";
import { mailsFor, mentionsIn, moveError, stageMail, stageOf, type Mover, type PieceRef } from "../src/lib/content/pieceRules";

// Content projects as a team's work (SARCLA 07.11.2026). Made-up people.

test("a project's stage is where its pieces are", () => {
  assert.equal(stageOf([]), "planned");
  assert.equal(stageOf(["todo", "todo"]), "planned");
  assert.equal(stageOf(["todo", "writing"]), "making");
  assert.equal(stageOf(["review", "changes"]), "making");
  assert.equal(stageOf(["review", "approved"]), "review");
  assert.equal(stageOf(["approved", "live"]), "approved");
  assert.equal(stageOf(["live", "live"]), "live");
  // one piece not started holds the project back, whatever the others are
  assert.equal(stageOf(["todo", "approved"]), "making");
});

const writer: Mover = { username: "anna", canEdit: true, lead: false };
const reviewer: Mover = { username: "bert", canEdit: true, lead: false };
const owner: Mover = { username: "carl", canEdit: true, lead: true };
const commenter: Mover = { username: "dora", canEdit: false, lead: false };
const piece = (status: PieceRef["status"], rev: string | null = "bert"): PieceRef => ({ status, writer: "anna", reviewer: rev });

test("who may move a piece", () => {
  assert.equal(moveError(piece("todo"), "writing", writer), null);
  assert.equal(moveError(piece("writing"), "review", writer), null);
  assert.match(moveError(piece("writing", null), "review", writer)!, /reviewer first/);
  // the writer does not approve their own piece; its reviewer or the owner does
  assert.match(moveError(piece("review"), "approved", writer)!, /reviewer or the project's owner/);
  assert.equal(moveError(piece("review"), "approved", reviewer), null);
  assert.equal(moveError(piece("review"), "changes", owner), null);
  assert.match(moveError(piece("writing"), "approved", reviewer)!, /in review/);
  assert.match(moveError(piece("writing"), "live", writer)!, /approved piece/);
  assert.equal(moveError(piece("approved"), "live", writer), null);
  assert.match(moveError(piece("todo"), "writing", commenter)!, /comment on this project/);
  // a reviewer who can only comment still decides on the piece given to them
  assert.equal(moveError(piece("review", "dora"), "approved", commenter), null);
});

test("who gets a mail - never the person who did it", () => {
  const p = piece("writing");
  assert.deepEqual(mailsFor({ kind: "status", to: "review" }, p, "carl", "anna"), [{ username: "bert", kind: "review" }]);
  assert.deepEqual(mailsFor({ kind: "status", to: "approved" }, p, "carl", "bert"), [{ username: "anna", kind: "approved" }]);
  assert.deepEqual(mailsFor({ kind: "status", to: "changes" }, p, "carl", "bert"), [{ username: "anna", kind: "changes" }]);
  assert.deepEqual(mailsFor({ kind: "status", to: "live" }, p, "carl", "anna"), [{ username: "carl", kind: "live" }]);
  assert.deepEqual(mailsFor({ kind: "status", to: "live" }, p, "anna", "bert"), [{ username: "anna", kind: "live" }]);
  assert.deepEqual(mailsFor({ kind: "assign", role: "writer", username: "anna" }, p, "carl", "carl"), [{ username: "anna", kind: "write" }]);
  assert.deepEqual(mailsFor({ kind: "assign", role: "reviewer", username: "carl" }, p, "carl", "carl"), []);
  assert.deepEqual(mailsFor({ kind: "status", to: "writing" }, p, "carl", "anna"), []);
  assert.deepEqual(stageMail("making", "review", "carl", "anna"), [{ username: "carl", kind: "stage" }]);
  assert.deepEqual(stageMail("making", "making", "carl", "anna"), []);
  assert.deepEqual(stageMail("making", "review", "carl", "carl"), []);
});

test("who a comment tags", () => {
  const people = [
    { username: "ANNROS", name: "Anna Rossi" },
    { username: "ANNMAR", name: "Anna Maria Keller" },
    { username: "BERT", name: "Bert" },
  ];
  assert.deepEqual(mentionsIn("@Anna Rossi can you look?", people, "BERT"), ["ANNROS"]);
  assert.deepEqual(mentionsIn("@anna maria keller and @annros", people, "BERT"), ["ANNMAR", "ANNROS"]);
  // a whole word only, never the author, each person once
  assert.deepEqual(mentionsIn("@Bertha and @Bert and @Bert", people, "ANNROS"), ["BERT"]);
  assert.deepEqual(mentionsIn("@Bert", people, "BERT"), []);
  assert.deepEqual(mentionsIn("mail anna@rossi.ch", people, "BERT"), []);
});
