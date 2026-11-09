// KEY WORDS IN RED ON THE CANVAS (SARCLA 08.11.2026: "allow generating text with AI by describing, and this should be
// motion-design quality we are used to" - bold Futura, red key words, a clean grid, as in our films).
//
// A text says which words are its key words the way the films' scripts do: between stars. "Seals cut to *your size*"
// draws "your size" in the key colour and the rest in the text's own. Konva has no mixed colours in one text, so a text
// with stars is laid out here (pure: words, lines, where each word sits) and drawn word by word by the canvas
// (src/app/editor/richKonva.ts). Pure - tests/editor-rich-text.test.ts.

export type Span = { t: string; key: boolean };
export type Word = { t: string; key: boolean; w: number; x: number };
export type RichLine = { words: Word[]; width: number };
export type RichLayout = { lines: RichLine[]; width: number; height: number };

/** Measures a piece of text in the text's own font, in px, letter-spacing not included. */
export type Measure = (text: string) => number;

/** A text marks key words with stars - and at least one pair of them encloses something. */
export const hasKeyWords = (text: string | undefined | null): boolean => /\*[^*\n]+\*/.test(text ?? "");

/** The words without their stars (what a reader sees; what the checks and the AI read). */
export const plainText = (text: string | undefined | null): string => (text ?? "").replace(/\*([^*\n]+)\*/g, "$1");

/** The text cut into runs: key ("*...*") and plain. An unpaired star stays a star. */
export function spans(text: string): Span[] {
  const out: Span[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), key: false });
    out.push({ t: m[1], key: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), key: false });
  return out;
}

/** A word, or the piece of one that follows a key run with no space between ("*size*," - the comma is glued on). */
type Piece = Span & { glue?: boolean };

/** Each paragraph's words, each carrying whether it is a key word (a key run of three words is three key words). */
function paragraphs(text: string, upper: boolean): Piece[][] {
  const paras: Piece[][] = [[]];
  // the run before ended inside a word: what follows without a space belongs to that word (09.11.2026: "Your *exact
  // size*, ordered online" drew "size ," - the comma with a space before it)
  let touching = false;
  for (const s of spans(text)) {
    const parts = s.t.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) { paras.push([]); touching = false; }
      const para = paras[paras.length - 1];
      part.split(/[ \t]+/).forEach((w, j) => {
        if (w) para.push({ t: upper ? w.toUpperCase() : w, key: s.key, ...(j === 0 && touching && para.length ? { glue: true } : {}) });
      });
      touching = part.length > 0 && !/[ \t]$/.test(part);
    });
  }
  return paras;
}

/**
 * The text in lines no wider than `width` (a word longer than the line is kept whole on its own line), each word's x
 * inside its line, the line's width; the block's height is lines x size x line height (as Konva's own text counts it).
 */
export function layoutRich(text: string, o: {
  width: number; fontSize: number; lineHeight?: number; letterSpacing?: number; upper?: boolean; measure: Measure;
}): RichLayout {
  const ls = o.letterSpacing ?? 0;
  const lh = o.lineHeight ?? 1.25;
  const wOf = (s: string) => o.measure(s) + ls * s.length;
  const space = wOf(" ");
  const lines: RichLine[] = [];
  for (const para of paragraphs(text, !!o.upper)) {
    let cur: Word[] = [];
    let x = 0;
    for (const sp of para) {
      const w = wOf(sp.t);
      // a glued piece sits right after the word it belongs to, on its line, with no space
      if (sp.glue && cur.length) { cur.push({ t: sp.t, key: sp.key, w, x }); x += w; continue; }
      if (cur.length && x + space + w > o.width + 0.5) {
        lines.push({ words: cur, width: x });
        cur = []; x = 0;
      }
      const at = cur.length ? x + space : 0;
      cur.push({ t: sp.t, key: sp.key, w, x: at });
      x = at + w;
    }
    lines.push({ words: cur, width: x });
  }
  const width = Math.max(0, ...lines.map((l) => l.width));
  return { lines, width, height: lines.length * o.fontSize * lh };
}

/** Where a line starts inside the box, for its alignment. */
export const lineStart = (line: RichLine, box: number, align: "left" | "center" | "right" | undefined) =>
  align === "center" ? (box - line.width) / 2 : align === "right" ? box - line.width : 0;

/** A rough measure for when no canvas is there (tests, the server): Jost-like widths per character, in em. */
export function estimateMeasure(fontSize: number, bold = true): Measure {
  const narrow = /[ilIjtf.,;:!'|()\[\] ]/;
  const wide = /[mwMW@%]/;
  const caps = /[A-Z0-9]/;
  return (s: string) => {
    let em = 0;
    for (const ch of s) em += narrow.test(ch) ? 0.28 : wide.test(ch) ? 0.82 : caps.test(ch) ? 0.64 : 0.52;
    return em * fontSize * (bold ? 1.04 : 1);
  };
}
