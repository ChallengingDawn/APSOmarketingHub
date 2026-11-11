// CONTACT NAMES - the pure part (Duplicates & merges > Contacts > Name letters; the engine is engine.ts). Replaces the
// HubSpot workflow "SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE" (2865279175), SARCLA 10.11.2026: "this is a small tab on
// contact duplicate". A name stored with broken letters - "MÃ¼ller" for Müller, "RenÃ©" for René: a UTF-8 name read as
// Latin-1 / Windows-1252 somewhere on its way into HubSpot. The fix is the workflow's own, ported as it was: the name read
// back once or twice as Latin-1 and as Windows-1252, and its table of letter pairs; the candidate with the fewest broken
// markers wins (then the one that keeps its accents); spaces are tidied.

/** The HubSpot list the workflow enrolled from - "SARCLA | CONTACT WITH UFO-8 PROBLEM": first or last name contains Ã, Â,
 *  â, �, ¢, £ … (HubSpot keeps it up to date; its search cannot look for these letters, the list can). */
export const LIST_ID = "5943";
export const WORKFLOW_ID = "2865279175";

/** The markers of a broken letter (the workflow's BAD_MARKERS). */
const BAD = /[\u00c3\u00c2\u00e3\u00e2\u00c5\ufffd]/g;
/** Never meant in a name: a soft hyphen, the zero-width spaces. */
const INVISIBLE = /[\u00ad\u200b\u200c\u200d\ufeff]/g;

/** The workflow's PAIR_FIXES, in its order (applied one after the other). */
const PAIRS: [string, string][] = [
  ["\u00c3\u00bc", "\u00fc"], ["\u00c3\u0153", "\u00dc"], ["\u00e3\u00bc", "\u00fc"], ["\u00c3\u00b6", "\u00f6"], ["\u00c3\u2013", "\u00d6"], ["\u00e3\u00b6", "\u00f6"],
  ["\u00c3\u00a4", "\u00e4"], ["\u00c3\u201e", "\u00c4"], ["\u00e3\u00a4", "\u00e4"], ["\u00c3\u0178", "\u00df"], ["\u00c3\u009f", "\u00df"], ["\u00e3\u009f", "\u00df"],
  ["\u00c3\u00a1", "\u00e1"], ["\u00c3\u00c0", "\u00c0"], ["\u00c3\u00c1", "\u00c1"], ["\u00c3\u00e0", "\u00e0"], ["\u00c3\u00c2", "\u00c2"], ["\u00c3\u00e2", "\u00e2"],
  ["\u00c3\u00e3", "\u00e3"], ["\u00c3\u00c3", "\u00c3"], ["\u00c3\u00e5", "\u00e5"], ["\u00c3\u00c5", "\u00c5"], ["\u00c3\u00e6", "\u00e6"], ["\u00c3\u00c6", "\u00c6"],
  ["\u00c3\u00e7", "\u00e7"], ["\u00c3\u00c7", "\u00c7"], ["\u00c3\u00f0", "\u00f0"], ["\u00c3\u00d0", "\u00d0"], ["\u00c3\u00e9", "\u00e9"], ["\u00c3\u00c9", "\u00c9"],
  ["\u00c3\u00e8", "\u00e8"], ["\u00c3\u00c8", "\u00c8"], ["\u00c3\u00ea", "\u00ea"], ["\u00c3\u00ca", "\u00ca"], ["\u00c3\u00eb", "\u00eb"], ["\u00c3\u00cb", "\u00cb"],
  ["\u00c3\u00ed", "\u00ed"], ["\u00c3\u00cd", "\u00cd"], ["\u00c3\u00ec", "\u00ec"], ["\u00c3\u00cc", "\u00cc"], ["\u00c3\u00ee", "\u00ee"], ["\u00c3\u00ce", "\u00ce"],
  ["\u00c3\u00ef", "\u00ef"], ["\u00c3\u00cf", "\u00cf"], ["\u00c3\u00f1", "\u00f1"], ["\u00c3\u00d1", "\u00d1"], ["\u00c3\u00f3", "\u00f3"], ["\u00c3\u00d3", "\u00d3"],
  ["\u00c3\u00f2", "\u00f2"], ["\u00c3\u00d2", "\u00d2"], ["\u00c3\u00f4", "\u00f4"], ["\u00c3\u00d4", "\u00d4"], ["\u00c3\u00f5", "\u00f5"], ["\u00c3\u00d5", "\u00d5"],
  ["\u00c3\u00f8", "\u00f8"], ["\u00c3\u00d8", "\u00d8"], ["\u00c3\u00fa", "\u00fa"], ["\u00c3\u00da", "\u00da"], ["\u00c3\u00f9", "\u00f9"], ["\u00c3\u00d9", "\u00d9"],
  ["\u00c3\u00fb", "\u00fb"], ["\u00c3\u00db", "\u00db"], ["\u00c3\u00fd", "\u00fd"], ["\u00c3\u00dd", "\u00dd"], ["\u00c3\u00ff", "\u00ff"], ["\u00e3\u00a9", "\u00e9"],
  ["\u00e3\u00a8", "\u00e8"], ["\u00e3\u00aa", "\u00ea"], ["\u00e3\u00ab", "\u00eb"], ["\u00e3\u00ad", "\u00ed"], ["\u00e3\u00ac", "\u00ec"], ["\u00e3\u00ae", "\u00ee"],
  ["\u00e3\u00af", "\u00ef"], ["\u00e3\u00b3", "\u00f3"], ["\u00e3\u00b2", "\u00f2"], ["\u00e3\u00b4", "\u00f4"], ["\u00e3\u00b5", "\u00f5"], ["\u00e3\u00b8", "\u00f8"],
  ["\u00e3\u00ba", "\u00fa"], ["\u00e3\u00b9", "\u00f9"], ["\u00e3\u00bb", "\u00fb"], ["\u00e3\u00bd", "\u00fd"], ["\u00e3\u00bf", "\u00ff"], ["\u00e3\u00b1", "\u00f1"],
  ["\u00e3\u00a7", "\u00e7"], ["\u00e3\u00a1", "\u00e1"], ["\u00e3 ", "\u00e0"], ["\u00e3\u00a2", "\u00e2"], ["\u00e3\u00a3", "\u00e3"], ["\u00e3\u00a5", "\u00e5"],
  ["\u00e3\u00b0", "\u00f0"], ["\u00c5\u201a", "\u0142"], ["\u00c5\ufffd", "\u0150"], ["\u00c5\u201e", "\u0144"], ["\u00c5\u2021", "\u0143"], ["\u00c5\u203a", "\u015b"],
  ["\u00c5\u0161", "\u015a"], ["\u00c5\u00ba", "\u017a"], ["\u00c5\u00b9", "\u0179"], ["\u00c5\u00bc", "\u017c"], ["\u00c5\u00bb", "\u017b"], ["\u00c5\u2122", "\u0159"],
  ["\u00c5\u02dc", "\u0158"], ["\u00c5\u00a1", "\u0161"], ["\u00c5 ", "\u0160"], ["\u00c5\u00a5", "\u0165"], ["\u00c5\u00a4", "\u0164"], ["\u00c5\u00be", "\u017e"],
  ["\u00c5\u00bd", "\u017d"], ["\u00c5\u00af", "\u016f"], ["\u00c5\u00ae", "\u016e"], ["\u00c5\u2018", "\u0151"], ["\u00c5\u00b0", "\u0170"], ["\u00c5\u00b1", "\u0171"],
  ["\u00e2\u20ac\u2122", "\u2019"], ["\u00e2\u20ac\u02dc", "\u2018"], ["\u00e2\u20ac\u0153", "\u201c"], ["\u00e2\u20ac\u009d", "\u201d"], ["\u00e2\u20ac\u201c", "\u2013"], ["\u00e2\u20ac\u201d", "\u2014"],
  ["\u00e2\u20ac\u00a6", "\u2026"], ["\u00e2\u201a\u00ac", "\u20ac"], ["\u00c2\u00b0", "\u00b0"], ["\u00c2\u00b7", "\u00b7"], ["\u00c2\u00ae", "\u00ae"], ["\u00c2\u00a9", "\u00a9"],
  ["\u00c2\u00ab", "\u00ab"], ["\u00c2\u00bb", "\u00bb"], ["\u00c2\u00b1", "\u00b1"], ["\u00c2\u00bd", "\u00bd"], ["\u00c2\u00bc", "\u00bc"], ["\u00c2\u00be", "\u00be"],
  ["\u00c2\u00b9", "\u00b9"], ["\u00c2\u00b2", "\u00b2"], ["\u00c2\u00b3", "\u00b3"],
];

/** Windows-1252's letters in 0x80-0x9F (the rest of the byte range is Latin-1). */
const CP1252: Record<string, number> = {
  "\u20ac": 0x80, "\u201a": 0x82, "\u0192": 0x83, "\u201e": 0x84, "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02c6": 0x88,
  "\u2030": 0x89, "\u0160": 0x8a, "\u2039": 0x8b, "\u0152": 0x8c, "\u017d": 0x8e, "\u2018": 0x91, "\u2019": 0x92, "\u201c": 0x93,
  "\u201d": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97, "\u02dc": 0x98, "\u2122": 0x99, "\u0161": 0x9a, "\u203a": 0x9b,
  "\u0153": 0x9c, "\u017e": 0x9e, "\u0178": 0x9f,
};
/** Bytes Windows-1252 leaves undefined - Python's strict cp1252 refuses them, so here too. */
const CP1252_HOLES = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

/** The name as Latin-1 / Windows-1252 bytes, or null when a letter has no byte there (Python's strict encode). */
function toBytes(s: string, cp1252: boolean): Uint8Array | null {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (cp1252 && CP1252[ch] !== undefined) out.push(CP1252[ch]);
    else if (c <= 0xff && !(cp1252 && c >= 0x80 && c <= 0x9f && !CP1252_HOLES.has(c))) out.push(c);
    else return null;
  }
  return Uint8Array.from(out);
}
const STRICT = new TextDecoder("utf-8", { fatal: true });
/** Read back once: the bytes as UTF-8; unchanged when that is not possible (the workflow's try_fix_once). */
function once(s: string, cp1252: boolean): string {
  const b = toBytes(s, cp1252);
  if (!b) return s;
  try { return STRICT.decode(b); } catch { return s; }
}
const nfc = (s: string) => (s ?? "").normalize("NFC");
const pairs = (s: string) => PAIRS.reduce((x, [bad, good]) => x.split(bad).join(good), s);
/** How many broken markers a name still has (the workflow's score; an empty name never wins). */
export const brokenMarks = (s: string): number => (!s ? 1e9 : (s.match(BAD) ?? []).length);
const accents = (s: string) => /[^\x00-\x7f]/.test(s);

/** The workflow's fix_mojibake + clean_spaces, and the invisible characters out. */
export function fixLetters(input: string | null | undefined): string {
  const base = nfc(input ?? "");
  const tries = [base];
  for (const cp of [false, true]) { const a = nfc(once(base, cp)); tries.push(a, nfc(once(a, cp))); }
  tries.push(nfc(pairs(base)));
  // fewest markers, then the one that keeps its accents; a tie keeps the name as it was (first in the list)
  let best = base;
  for (const t of tries) {
    const k = brokenMarks(t), kb = brokenMarks(best);
    if (k < kb || (k === kb && accents(t) && !accents(best))) best = t;
  }
  return best.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** The second half of a broken letter: a byte 0x80-0xBF read as Latin-1, or as its Windows-1252 letter. */
const TAIL = "[\\u0080-\\u00bf\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e\\u0192\\u02c6\\u02dc\\u2013\\u2014\\u2018-\\u201e\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203a\\u20ac\\u2122]";
const BROKEN = new RegExp(`[\\u00c3\\u00c2\\u00c5\\ufffd]|[\\u00e3\\u00e2]${TAIL}`);
/**
 * A letter still broken - stricter than the workflow's markers, which count every "ã" and "â" (João, Conceição, Vâju are
 * right): an upper-case Ã, Â or Å, a replacement sign, or a lower-case ã / â followed by a byte-like letter ("Frã©dã©ric").
 */
export const isBroken = (s: string): boolean => BROKEN.test(s);

export type NameVerdict = {
  /** the name as it will be once the sure repairs are written */
  first: string; last: string;
  /** the repairs the hub writes by itself: a field whose fix changed it and left no broken letter */
  write: { firstname?: string; lastname?: string };
  /** "sure": nothing broken is left once written; "check": a person looks - a letter the fix could not repair, or a
   *  letter HubSpot's list flags that may well be right (João, O'Reilly, a company with a dash in the last name) */
  status: "sure" | "check";
  /** the fix proposes something different from HubSpot's name (written or not) */
  changed: boolean;
  /** what the fix proposes where it is not sure (shown to the person) */
  proposal?: { first: string; last: string };
};

/** One contact's first and last name, decided field by field. */
export function decideName(first: string | null | undefined, last: string | null | undefined): NameVerdict {
  const f0 = (first ?? "").trim(), l0 = (last ?? "").trim();
  const f = f0 ? fixLetters(f0) : f0, l = l0 ? fixLetters(l0) : l0;
  const write: NameVerdict["write"] = {};
  if (f !== f0 && !isBroken(f)) write.firstname = f;
  if (l !== l0 && !isBroken(l)) write.lastname = l;
  const first1 = write.firstname ?? f0, last1 = write.lastname ?? l0;
  const sure = Object.keys(write).length > 0 && !isBroken(first1) && !isBroken(last1);
  const changed = f !== f0 || l !== l0;
  const unsure = changed && (f !== first1 || l !== last1);
  return { first: first1, last: last1, write, status: sure ? "sure" : "check", changed, ...(unsure ? { proposal: { first: f, last: l } } : {}) };
}
