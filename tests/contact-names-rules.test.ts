import assert from "node:assert/strict";
import { test } from "node:test";
import { brokenMarks, decideName, fixLetters, isBroken } from "../src/lib/contactNames/rules";

test("broken letters are repaired as the workflow did (names from list 5943, 10.11.2026)", () => {
  assert.equal(fixLetters("DÃ¶rflein"), "Dörflein");
  assert.equal(fixLetters("ConceiÃ§Ã£o"), "Conceição");
  assert.equal(fixLetters("MÃ¼ller"), "Müller");
  assert.equal(fixLetters("RenÃ©"), "René");
  assert.equal(fixLetters("LÃ³pez"), "López");
  assert.equal(fixLetters("WÃ¤lti"), "Wälti");
  // lower-case "ã" path - the workflow's letter pairs
  assert.equal(fixLetters("Frã©dã©ric"), "Frédéric");
});

test("a right name is left as it is", () => {
  for (const n of ["João", "O’Reilly", "Vâju", "Müller", "Zürich AG – Technik", "Ïsabelle"]) assert.equal(fixLetters(n), n);
});

test("spaces tidied, invisible characters out", () => {
  assert.equal(fixLetters("  Hans   Peter "), "Hans Peter");
  assert.equal(fixLetters("Mac­ik"), "Macik");
});

test("sure only when no broken letter is left; the rest is for a person", () => {
  assert.deepEqual(decideName("Martin", "MÃ¼ller"), { first: "Martin", last: "Müller", write: { lastname: "Müller" }, status: "sure", changed: true });
  assert.equal(decideName("João", "Moreira").status, "check");
  assert.equal(decideName("João", "Moreira").changed, false);
  assert.deepEqual(decideName("João", "Moreira").write, {});
  assert.equal(decideName("R�gie", "Bois").status, "check");
  assert.equal(decideName("", "WÃ¤lti").status, "sure");
  assert.equal(brokenMarks("Müller"), 0);
  assert.ok(brokenMarks("MÃ¼ller") > 0);
});

test("a right ã is not a broken letter (the workflow counted it): Conceição and Dionísio are repaired", () => {
  assert.equal(isBroken("João"), false);
  assert.equal(isBroken("Conceição"), false);
  assert.equal(isBroken("Frã©dã©ric"), true);
  assert.equal(isBroken("Ãnlü"), true);
  assert.deepEqual(decideName("Daniel", "da ConceiÃ§Ã£o").write, { lastname: "da Conceição" });
  assert.equal(decideName("Daniel", "da ConceiÃ§Ã£o").status, "sure");
  // the last name is repaired; "João" is right and stays
  assert.deepEqual(decideName("João", "Dioní­sio").write, { lastname: "Dionísio" });
  // half repaired is not written: Ünlü came out as "Ãnlü" - a person
  const u = decideName("Faruk", "Ãnlã¼");
  assert.deepEqual(u.write, {});
  assert.equal(u.status, "check");
  assert.deepEqual(u.proposal, { first: "Faruk", last: "Ãnlü" });
});
