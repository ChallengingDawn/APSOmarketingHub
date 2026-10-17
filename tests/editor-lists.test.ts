import assert from "node:assert/strict";
import { test } from "node:test";
import {
  itemCount,
  listify,
  markerFor,
  splitIntoItems,
  stripMarker,
} from "../src/lib/editor/lists";

test("no style leaves the text exactly as it is", () => {
  const t = "48 hours\nNo minimum";
  assert.equal(listify(t, undefined), t);
});

test("bullets go on each line", () => {
  assert.equal(
    listify("48 hours\nNo minimum", "bullet"),
    "•  48 hours\n•  No minimum",
  );
});

test("numbers count from one", () => {
  assert.equal(
    listify("Draw it\nCut it\nShip it", "number"),
    "1.  Draw it\n2.  Cut it\n3.  Ship it",
  );
});

test("a marker somebody typed is replaced, not doubled", () => {
  // Pressing the bullet button on text written by hand is the common case.
  assert.equal(listify("- 48 hours\n- No minimum", "bullet"), "•  48 hours\n•  No minimum");
  assert.equal(listify("1. Draw\n2. Cut", "bullet"), "•  Draw\n•  Cut");
  assert.equal(listify("• Draw", "number"), "1.  Draw");
  assert.equal(listify("✓ Done", "dash"), "–  Done");
});

test("a blank line stays blank and does not take a number", () => {
  const out = listify("Draw it\nCut it\n\nShip it", "number");
  assert.equal(out, "1.  Draw it\n2.  Cut it\n\n3.  Ship it");
  // The numbering continues across the gap: a breather in one list must not
  // turn it into two lists both starting at 1.
  assert.ok(out.includes("3.  Ship it"));
});

test("leading and trailing space inside an item is tidied", () => {
  assert.equal(listify("   48 hours   ", "bullet"), "•  48 hours");
});

test("the markers are what they claim to be", () => {
  assert.equal(markerFor("bullet", 0), "•");
  assert.equal(markerFor("dash", 3), "–");
  assert.equal(markerFor("check", 7), "✓");
  assert.equal(markerFor("number", 0), "1.");
  assert.equal(markerFor("number", 11), "12.");
});

test("stripping a marker does not eat a sentence that starts with a dash word", () => {
  // "-20 °C" is a temperature, not a bullet: a marker needs the space after it.
  assert.equal(stripMarker("-20 °C to +120 °C"), "-20 °C to +120 °C");
  assert.equal(stripMarker("- 20 °C"), "20 °C");
  // Neither is a date a numbered item.
  assert.equal(stripMarker("2026 was the year"), "2026 was the year");
});

test("the count is of items, not of lines", () => {
  assert.equal(itemCount("Draw\n\nCut\n\n\nShip"), 3);
  assert.equal(itemCount(""), 0);
  assert.equal(itemCount("   \n  "), 0);
});

test("a pasted paragraph becomes one item per sentence", () => {
  assert.deepEqual(
    splitIntoItems("48 hours. No minimum. Cut to size."),
    ["48 hours", "No minimum", "Cut to size"],
  );
});

test("a decimal or an abbreviation does not split a sentence in half", () => {
  assert.deepEqual(splitIntoItems("Tolerance 0.5 mm on every cut."), ["Tolerance 0.5 mm on every cut"]);
  assert.deepEqual(splitIntoItems("Rated to 2.5 bar. Tested at 4 bar."), ["Rated to 2.5 bar", "Tested at 4 bar"]);
});

test("text that is already lines keeps the lines it was given", () => {
  // Somebody's own layout beats our sentence splitter.
  assert.deepEqual(
    splitIntoItems("- One thing. And another\n- A second thing"),
    ["One thing. And another", "A second thing"],
  );
  assert.deepEqual(splitIntoItems("   "), []);
});
