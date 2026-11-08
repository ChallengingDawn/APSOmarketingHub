// THE FILM'S WORDS (08.11.2026), as in the team's films (black-friday-2026/video src/text.tsx): copy carries *red*
// markup for the key word; every block is measured with the real font and shrunk to its box, so six languages never
// wrap by accident. Where a format is narrow (9:16, 1:1), a line too long for a big size is broken in two at its best
// word instead. Pure - the measuring is handed in (the browser's canvas with the loaded font; a close estimate in
// tests and on the server) - tests/studio-video.test.ts.

export type Tok = { t: string; red: boolean; space: boolean };
/** A line of words with their colour. */
export type Line = Tok[];

/**
 * "Cut to *your* size" -> words with their colour; `space` = a space follows the word, so "*away*." keeps its full stop
 * against the word. An unclosed * runs to the end of the line.
 */
export function parse(line: string): Line {
  const out: Tok[] = [];
  let red = false;
  let buf = "";
  const flush = (space: boolean) => {
    if (buf) out.push({ t: buf, red, space });
    else if (space && out.length) out[out.length - 1].space = true;
    buf = "";
  };
  for (const ch of line ?? "") {
    if (ch === "*") {
      flush(false);
      red = !red;
    } else if (/\s/.test(ch)) flush(true);
    else buf += ch;
  }
  flush(false);
  if (out.length) out[out.length - 1].space = false;
  return out;
}

/** The words without their markup. */
export const plain = (s: string) => (s ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
export const lineText = (l: Line) => l.map((w, i) => w.t + (w.space && i < l.length - 1 ? " " : "")).join("");
/** How many words a line or text has. */
export const wordCount = (s: string) => (plain(s) ? plain(s).split(" ").length : 0);

/** Width of `text` at 1 px font size and `weight` - multiply by the size. */
export type Measure = (text: string, weight: number) => number;

/** A close estimate of Jost's widths, for tests and the server (the browser measures the real font). */
export const estimate: Measure = (text, weight) => {
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += 0.25;
    else if (/[iljI.,:;'!|]/.test(ch)) w += 0.26;
    else if (/[mwMW]/.test(ch)) w += 0.82;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[0-9]/.test(ch)) w += 0.56;
    else w += 0.52;
  }
  return w * (weight >= 600 ? 1.05 : 1);
};

let measurer: Measure = estimate;
const cache = new Map<string, number>();
/** The film's measuring from now on (the browser sets the canvas one once the font is in). */
export function setMeasure(m: Measure) {
  measurer = m;
  cache.clear();
}
export function measure(text: string, weight: number): number {
  const k = `${weight}|${text}`;
  let w = cache.get(k);
  if (w === undefined) {
    w = measurer(text, weight);
    if (cache.size > 4000) cache.clear();
    cache.set(k, w);
  }
  return w;
}

/** The width of a line at size `fs`, a letter spacing `ls` (em) and `weight`. */
export const lineW = (l: Line | string, weight: number, fs: number, ls = 0) => {
  const s = typeof l === "string" ? plain(l) : lineText(l);
  return (measure(s, weight) + [...s].length * ls) * fs;
};

/** The largest size <= fsMax at which every line is at most maxW wide. */
export function fitFs(lines: (Line | string)[], weight: number, fsMax: number, maxW: number, ls = 0): number {
  const widest = Math.max(0.0001, ...lines.map((l) => lineW(l, weight, 1, ls)));
  return Math.max(1, Math.min(fsMax, (maxW / widest) * 0.98));
}

/** A line broken at the word that leaves its two halves the most even (null when it has one word). */
export function splitBest(l: Line, weight: number): [Line, Line] | null {
  if (l.length < 2) return null;
  let best: [Line, Line] | null = null;
  let score = Infinity;
  for (let i = 1; i < l.length; i++) {
    if (!l[i - 1].space) continue;
    const a = l.slice(0, i);
    const b = l.slice(i);
    const s = Math.max(lineW(a, weight, 1), lineW(b, weight, 1));
    if (s < score) {
      score = s;
      best = [a, b];
    }
  }
  return best;
}

export type Block = { lines: Line[]; fs: number };

/**
 * Lines into a box: the biggest size up to `fsMax` at which they fit its width and, at line height `lh`, its height.
 * With `breakable`, a line is broken in two when that gives a bigger size than shrinking it - never more lines than
 * `maxLines`.
 */
export function fitBlock(src: (Line | string)[], weight: number, fsMax: number, box: { w: number; h: number }, opts: { lh?: number; breakable?: boolean; maxLines?: number } = {}): Block {
  const lh = opts.lh ?? 1.08;
  const maxLines = opts.maxLines ?? 4;
  let lines = src.map((l) => (typeof l === "string" ? parse(l) : l)).filter((l) => l.length);
  if (!lines.length) return { lines: [], fs: fsMax };
  const size = (ls: Line[]) => Math.min(fitFs(ls, weight, fsMax, box.w), box.h / (ls.length * lh));
  let fs = size(lines);
  if (opts.breakable) {
    for (let guard = 0; guard < 6 && lines.length < maxLines; guard++) {
      // break the widest line, if that makes the block bigger
      let wi = 0;
      lines.forEach((l, i) => { if (lineW(l, weight, 1) > lineW(lines[wi], weight, 1)) wi = i; });
      const parts = splitBest(lines[wi], weight);
      if (!parts) break;
      const next = [...lines.slice(0, wi), parts[0], parts[1], ...lines.slice(wi + 1)];
      const nfs = size(next);
      if (nfs <= fs * 1.04) break;
      lines = next;
      fs = nfs;
    }
  }
  return { lines, fs };
}

/** Words flowed into lines at size `fs` within `maxW` (a quote). */
export function wrap(l: Line, weight: number, fs: number, maxW: number): Line[] {
  const out: Line[] = [];
  let cur: Line = [];
  for (const w of l) {
    const next = [...cur, w];
    if (cur.length && cur[cur.length - 1].space && lineW(next, weight, fs) > maxW) {
      out.push(cur);
      cur = [w];
    } else cur = next;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** A longer text (a quote) at the biggest size up to fsMax that fits the box, flowed into lines. */
export function fitFlow(text: string | Line, weight: number, fsMax: number, box: { w: number; h: number }, lh = 1.2, fsMin = 18): Block {
  const l = typeof text === "string" ? parse(text) : text;
  if (!l.length) return { lines: [], fs: fsMax };
  for (let fs = fsMax; fs > fsMin; fs *= 0.94) {
    const lines = wrap(l, weight, fs, box.w);
    const widest = Math.max(...lines.map((x) => lineW(x, weight, fs)));
    if (lines.length * fs * lh <= box.h && widest <= box.w) return { lines, fs };
  }
  return { lines: wrap(l, weight, fsMin, box.w), fs: fsMin };
}
