import assert from "node:assert/strict";
import { test } from "node:test";
import { pieceStep, projectStep } from "../src/lib/content/nextStep";

// SARCLA 08.11.2026: "the flow is not logical yet" - every to-do and every project says ONE next step, by status and person.

const names = (u: string) => ({ anna: "Anna", ben: "Ben" } as Record<string, string>)[u] ?? u;

test("next step: a to-do says what to do now, for whom is looking", () => {
  const page = { contentType: "landing-page", writer: "me", reviewer: "anna" };
  assert.equal(pieceStep({ ...page, status: "todo" }, "me", true).label, "Write it");
  assert.equal(pieceStep({ ...page, status: "writing", versions: 0 }, "me", true).label, "Write it", "nothing written yet: never 'Ask for review'");
  assert.deepEqual(pieceStep({ ...page, status: "writing", versions: 2 }, "me", true), { kind: "ask", label: "Ask for review", inStudio: false, mine: true });
  assert.equal(pieceStep({ ...page, status: "review" }, "anna", true).label, "Review it");
  assert.deepEqual(pieceStep({ ...page, status: "review" }, "me", true, names), { kind: "wait", label: "With Anna for review", inStudio: false, mine: false });
  assert.equal(pieceStep({ ...page, status: "changes" }, "me", true).label, "Make the changes");
  assert.equal(pieceStep({ ...page, status: "approved" }, "me", true).label, "Publish it");
  assert.equal(pieceStep({ ...page, status: "live" }, "me", true).kind, "done");
  assert.equal(pieceStep({ ...page, status: "todo", writer: "ben" }, "me", false, names).label, "Ben writes it", "one who may not edit is told, not offered");
  assert.equal(pieceStep({ contentType: "task", writer: null, status: "todo" }, "me", true).label, "Done");
});

test("next step: a project shows what waits for the person first, then what it needs", () => {
  const pieces = [
    { id: 1, title: "Landing page", contentType: "landing-page", status: "approved" as const, writer: "ben", reviewer: "anna" },
    { id: 2, title: "LinkedIn post", contentType: "linkedin", status: "review" as const, writer: "ben", reviewer: "me" },
    { id: 3, title: "Newsletter", contentType: "newsletter", status: "todo" as const, writer: "me", reviewer: null },
  ];
  const s = projectStep(pieces, "me", true, names);
  assert.equal(s.label, "Review it");
  assert.equal(s.piece?.id, 2, "a review asked of me comes first");
  assert.equal(projectStep(pieces.filter((p) => p.id !== 2), "me", true).piece?.id, 3, "then my own piece to write");
  assert.equal(projectStep([pieces[0]], "me", true).label, "Publish it");
  assert.equal(projectStep([{ ...pieces[0], status: "live" }], "me", true).kind, "done");
  assert.equal(projectStep([], "me", true).label, "Add a first to-do");
});
