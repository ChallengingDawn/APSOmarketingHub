// Number formatting shared by every chart and stat tile. A value the source
// did not return is rendered as an em dash, never as zero.

const FULL = new Intl.NumberFormat("en-US");

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return FULL.format(Math.round(n));
}

export function full(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return FULL.format(Math.round(n));
}

/** GA4 rates arrive as a 0–1 ratio. */
export function percent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function decimal(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Relative change between two values, as a ratio; null when it cannot be computed. */
export function change(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / previous;
}

export function signedPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  const v = ratio * 100;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-12" → "12 Aug". Accepts GA4's YYYYMMDD too. */
export function dayLabel(iso: string): string {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""}`;
}

/** Trim a URL or path to something that fits a bar label. */
export function shortLabel(value: string, max = 42): string {
  let s = value;
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      s = u.pathname + (u.search || "");
    }
  } catch {
    /* keep the raw string */
  }
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(8, max - 1))}…`;
}

/** A name's width in the axis's type - measured where a canvas is, else about 6.8px a letter. */
let pen: CanvasRenderingContext2D | null = null;
function textWidth(s: string): number {
  if (typeof document !== "undefined") {
    pen ??= document.createElement("canvas").getContext("2d");
    if (pen) { pen.font = `12.5px ${getComputedStyle(document.body).fontFamily || "sans-serif"}`; return pen.measureText(s).width; }
  }
  return s.length * 6.8;
}
/** A name on at most two lines of `max` pixels - by words, a word too long cut, an ellipsis where it does not end. */
export function twoLineLabel(label: string, max: number, width: (s: string) => number = textWidth): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  while (words.length && lines.length < 2) {
    const w = words[0];
    const next = line ? `${line} ${w}` : w;
    if (width(next) <= max) { line = next; words.shift(); continue; }
    if (line) { lines.push(line); line = ""; continue; }
    // one word wider than the line: as much of it as fits, the rest on the next line
    let k = w.length - 1;
    while (k > 1 && width(w.slice(0, k)) > max) k--;
    lines.push(w.slice(0, k));
    words[0] = w.slice(k);
  }
  if (line && lines.length < 2) { lines.push(line); line = ""; }
  if (words.length || line) {
    let last = lines[lines.length - 1] ?? "";
    while (last && width(`${last}…`) > max) last = last.slice(0, -1).trimEnd();
    lines[Math.max(0, lines.length - 1)] = `${last}…`;
  }
  return lines;
}
