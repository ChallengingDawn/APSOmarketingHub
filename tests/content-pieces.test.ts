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
  // the reviewer gets no mail: asked to review, or named reviewer (SARCLA 10.11.2026) - they find it in the hub
  assert.deepEqual(mailsFor({ kind: "status", to: "review" }, p, "carl", "anna"), []);
  assert.deepEqual(mailsFor({ kind: "assign", role: "reviewer", username: "bert" }, p, "carl", "anna"), []);
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

test("a piece's status and its sub-action's stage go both ways", async () => {
  const { STATUS_STAGE, statusOfStage, PIECE_STATUSES } = await import("../src/lib/content/pieceRules");
  for (const s of PIECE_STATUSES) {
    // "changes asked" is back at writing in the pipeline; every other status comes back as itself
    assert.equal(statusOfStage(STATUS_STAGE[s]), s === "changes" ? "writing" : s);
  }
  assert.equal(statusOfStage(null), "todo");
  assert.equal(statusOfStage("6161860810"), "live"); // killed is closed
});

test("the stage ids are the plan's own", async () => {
  const { S2S_STAGE } = await import("../src/lib/content/pieceRules");
  const { STAGES } = await import("../src/lib/reporting/actionPlanRules");
  for (const id of Object.values(S2S_STAGE)) assert.ok(STAGES.some((s) => s.id === id), id);
});

test("a task is ticked off by whoever may edit - no review", async () => {
  const { taskMoveError } = await import("../src/lib/content/pieceRules");
  assert.equal(taskMoveError("live", writer), null);
  assert.equal(taskMoveError("writing", writer), null);
  assert.match(taskMoveError("live", commenter)!, /comment on this project/);
  assert.match(taskMoveError("review", writer)!, /no review/);
});
