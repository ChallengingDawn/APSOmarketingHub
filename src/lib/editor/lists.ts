// BULLETS AND NUMBERED LISTS (canvas list 22).
//
// Three proofs, four steps, a spec sheet: most of what marketing writes is a
// list, and a canvas without one leaves people typing "- " by hand and then
// aligning the dash column by eye with the space bar.
//
// A list is a PROPERTY OF A TEXT NODE, not a new kind of object. The text
// stays the text - one item per line, which is what somebody typing already
// does - and the markers are added when it is drawn. That means turning a
// list back into a paragraph loses nothing, and a list that has been through
// the assistant, a translation or find-and-replace is still editable as the
// words somebody wrote.

export type ListStyle = "bullet" | "number" | "check" | "dash";

export const LIST_STYLES: { key: ListStyle; label: string; sample: string }[] = [
  { key: "bullet", label: "Bullets", sample: "•" },
  { key: "dash", label: "Dashes", sample: "–" },
  { key: "number", label: "Numbered", sample: "1." },
  { key: "check", label: "Ticks", sample: "✓" },
];

/**
 * The markers a person may already have typed.
 *
 * Stripped before ours go on, or "- Three proofs" becomes "• - Three proofs"
 * the moment somebody presses the bullet button on text they wrote by hand.
 */
const EXISTING = /^\s*(?:[-–—•‣◦⁃∙*✓✔]|\d{1,3}[.)])\s+/;

export function stripMarker(line: string): string {
  return line.replace(EXISTING, "");
}

/** Two spaces after the marker: one reads as a typo, three as a tab stop. */
const GAP = "  ";

export function markerFor(style: ListStyle, index: number): string {
  if (style === "number") return `${index + 1}.`;
  if (style === "check") return "✓";
  if (style === "dash") return "–";
  return "•";
}

/**
 * The text as it is drawn.
 *
 * Blank lines are kept blank and do NOT take a number: a gap between two
 * groups of steps is a gap, not step 4. The numbering continues across it,
 * because the alternative - restarting at 1 after every blank line - turns
 * one list with a breather in it into two lists.
 */
export function listify(text: string, style: ListStyle | undefined): string {
  if (!style) return text;
  let n = 0;
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const bare = stripMarker(line).trim();
      if (!bare) return "";
      const marker = markerFor(style, n);
      n += 1;
      return `${marker}${GAP}${bare}`;
    })
    .join("\n");
}

/**
 * How many items a list holds - what the panel says, so "Numbered" is not a
 * button somebody presses twice because nothing visibly happened on a node
 * whose text is one long paragraph.
 */
export function itemCount(text: string): number {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => stripMarker(l).trim().length > 0).length;
}

/**
 * Split a pasted paragraph into list items.
 *
 * People paste "48 hours. No minimum. Cut to size." and expect three items.
 * Sentence ends are the only reliable break - a comma list is as often one
 * sentence - and a decimal number or an abbreviation must not split, which is
 * why the full stop has to be followed by a space and a capital.
 */
export function splitIntoItems(text: string): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  // Already lines: respect them, and do not second-guess somebody's layout.
  const lines = t.split("\n").map((l) => stripMarker(l).trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  // Written as a replace rather than a split on a lookbehind: lookbehind is
  // recent in Safari, and this runs in whatever browser somebody opens the
  // hub in.
  return t
    .replace(/([.!?;])\s+(?=[A-ZÀ-Þ])/g, "$1\n")
    .split("\n")
    .map((s) => s.trim().replace(/[.;]$/, ""))
    .filter(Boolean);
}
