import assert from "node:assert/strict";
import { test } from "node:test";
import {
  effectiveLevel, canOpen, canWrite, ceiling, mfaRequired, levelsFor,
} from "../src/lib/auth/access";

// The two halves must stay apart: the role caps, the grant chooses.
test("an admin needs no grant", () => {
  assert.equal(effectiveLevel("admin", undefined), "write");
  assert.equal(effectiveLevel("admin", "none"), "write");
  assert.equal(canOpen("admin", undefined), true);
});

test("no grant means no access, for everybody else", () => {
  assert.equal(effectiveLevel("user", undefined), "none");
  assert.equal(effectiveLevel("viewer", undefined), "none");
  assert.equal(canOpen("viewer", undefined), false);
  // An account created by mistake can see nothing until somebody grants it.
  assert.equal(effectiveLevel("user", "none"), "none");
});

test("a viewer's grant never resolves above read, whatever the row says", () => {
  assert.equal(effectiveLevel("viewer", "write"), "read");
  assert.equal(canWrite("viewer", "write"), false);
  assert.equal(canOpen("viewer", "write"), true);
});

test("an editor's grant is honoured up to write", () => {
  assert.equal(effectiveLevel("user", "read"), "read");
  assert.equal(effectiveLevel("user", "write"), "write");
  assert.equal(canWrite("user", "read"), false);
});

test("a promotion needs no grant rewritten", () => {
  // The same stored row, read under two roles.
  const stored = "write" as const;
  assert.equal(effectiveLevel("viewer", stored), "read");
  assert.equal(effectiveLevel("user", stored), "write");
});

test("ceiling is the role's own limit", () => {
  assert.equal(ceiling("admin"), "write");
  assert.equal(ceiling("user"), "write");
  assert.equal(ceiling("viewer"), "read");
});

test("anyone who can change something carries a second factor", () => {
  assert.equal(mfaRequired("admin"), true);
  assert.equal(mfaRequired("user"), true);
  assert.equal(mfaRequired("viewer"), false);
  // Unless an admin asked for it on that person.
  assert.equal(mfaRequired("viewer", true), true);
});

test("a viewer is never offered Edit", () => {
  assert.deepEqual(levelsFor("viewer").map((l) => l.value), ["none", "read"]);
  assert.deepEqual(levelsFor("user").map((l) => l.value), ["none", "read", "write"]);
});
