// FIND AND REPLACE, AS A RULE RATHER THAN A HANDLER.
//
// Pulled out of EditorCanvas so it can be tested without a canvas, a browser
// or Konva. It earned that: three attempts to write the escaping inline
// produced three different mangled regular expressions, and nothing would
// have caught it except opening the editor and typing a product code with a
// dot in it.

/** The characters a regular expression treats as syntax. */
const RX_SPECIAL = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);

/**
 * A search for the literal text somebody typed.
 *
 * Built character by character rather than with a character class, because a
 * class containing an escaped backslash and an escaped bracket is the single
 * easiest thing in JavaScript to write wrongly — and a wrong one does not
 * throw, it just quietly matches the wrong thing.
 */
export function literalPattern(needle: string): RegExp | null {
  // NOT trimmed. Trimming looked tidy and was wrong: searching for " GmbH"
  // to delete it would have silently searched for "GmbH" instead and left the
  // space behind, so "APSOparts GmbH" became "APSOparts " with a dangling
  // space nobody asked for. A search is for what somebody typed. Only an
  // entirely blank search means "nothing to do".
  if (!needle || !needle.trim()) return null;
  const escaped = [...needle].map((c) => (RX_SPECIAL.has(c) ? "\\" + c : c)).join("");
  // Case-insensitive on the way IN: somebody typing "ffkm" means the "FFKM"
  // on the page. The replacement is literal, because it is what they typed
  // and nothing should re-case it for them.
  return new RegExp(escaped, "gi");
}

export type Replaceable = { text?: string; locked?: boolean; kind: string };

/**
 * What a replace would do, as a pure function of the blocks.
 *
 * Locked blocks are skipped — locking something is how you say "not this
 * one", and a sweep that ignores that is a sweep nobody can trust.
 */
export function applyReplace<T extends Replaceable>(
  blocks: T[],
  find: string,
  replaceWith: string,
): { blocks: T[]; changed: number } {
  const rx = literalPattern(find);
  if (!rx) return { blocks, changed: 0 };

  let changed = 0;
  const next = blocks.map((b) => {
    if (b.kind !== "text" || b.locked || !b.text) return b;
    const text = b.text.replace(rx, replaceWith);
    if (text === b.text) return b;
    changed += 1;
    return { ...b, text };
  });
  return { blocks: next, changed };
}
