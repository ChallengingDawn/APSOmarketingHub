// BANNER - EACH DESIGN'S COLOURS, AND CAN ITS WORDS BE READ? (Content v7, 10.11.2026). Pure: tests/studio-banner-v7.test.ts.
//
// SARCLA 10.11.2026 (point 11): "improve a lot the banner page". The designs (model.ts LOOKS) are the shop's own best
// banners - the Evolast FFKM slide (petrol), the O-ring guide slide (light photo, red headline), the Variety Series slide
// (a red block), the Black Friday hero (light grey, a word in red) - plus the photo behind the words and the newsletter
// band every banner had before. One palette per design and colour, used twice: the renderer draws with it (render.ts),
// and the readability guard reads it - the same sums as the page studio's (../page/readable.ts, the "dark grey text on
// the dark petrol hero" of 09.11.2026 never again): each text against every ground it stands on, 4.5:1 for small words,
// 3:1 for the headline (large text), and a word the colour of its ground is refused.

import { colorName, contrast, over, parseColor, worstContrast, type Rgba } from "../page/readable";
import { HEAD_COLORS, THEMES, themeFor, type BannerDoc, type HeadColor, type LookKey, type ThemeKey } from "./model";

export const RED = "#d80901";
export const RED_D = "#b00700";
export const PETROL = "#274e64";
export const INK = "#1d2326";

export type Palette = {
  /** the banner's ground (a CSS background) and the colours it is made of (for the guard) */
  ground: string; grounds: string[];
  /** the red block of the "red" design (its words stand on it) */
  panel: string | null;
  /** a veil over the photo behind the words ("photo"): its colour and how strong it is where the words are */
  scrim: { color: string; at: number } | null;
  head: string;
  /** the accent word: in its own colour, or underlined in red (on a dark ground red would not read) */
  accent: string; accentLine: boolean;
  line: string; eyebrow: string; bar: string;
  button: { bg: string; fg: string; hover: string; pill: boolean };
  logo: string;
  /** the light disc a product photo stands on over a dark ground ("" = none: it stands on the ground itself) */
  disc: string;
  /** where the words stand: on the ground, on the red block, or on the veiled photo */
  textOn: "ground" | "panel" | "scrim";
};

const g = (css: string, stops: string[]) => ({ ground: css, grounds: stops });

/** The ground of the shop slider's petrol (and of its deep ink twin) - a soft light from the top left. */
const DARK: Partial<Record<ThemeKey, { ground: string; grounds: string[] }>> = {
  petrol: g("radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)", ["#2f5d76", "#274e64", "#1b3a4b"]),
  ink: g("radial-gradient(120% 140% at 0% 0%,#2c3438 0%,#1d2326 55%,#15191b 100%)", ["#2c3438", "#1d2326", "#15191b"]),
};
const LIGHT: Partial<Record<ThemeKey, { ground: string; grounds: string[] }>> = {
  white: g("linear-gradient(90deg,#ffffff 0%,#f3f5f6 100%)", ["#ffffff", "#f3f5f6"]),
  grey: g("linear-gradient(90deg,#f1f3f5 0%,#e4e8eb 100%)", ["#f1f3f5", "#e4e8eb"]),
  pale: g("linear-gradient(90deg,#edf3f6 0%,#dfe9ee 100%)", ["#edf3f6", "#dfe9ee"]),
  sand: g("linear-gradient(90deg,#f7f3ec 0%,#ece5d9 100%)", ["#f7f3ec", "#ece5d9"]),
};
/** The Black Friday hero's light: white top right, grey bottom left. */
const CAMPAIGN: Partial<Record<ThemeKey, { ground: string; grounds: string[] }>> = {
  grey: g("radial-gradient(120% 120% at 100% 0%,#ffffff 0%,#f1f2f4 45%,#e4e6e9 100%)", ["#ffffff", "#f1f2f4", "#e4e6e9"]),
  white: g("linear-gradient(135deg,#ffffff 0%,#f4f5f6 100%)", ["#ffffff", "#f4f5f6"]),
  sand: g("radial-gradient(120% 120% at 100% 0%,#fdfbf7 0%,#f3eee6 50%,#e8e0d2 100%)", ["#fdfbf7", "#f3eee6", "#e8e0d2"]),
};
const DISC = "radial-gradient(circle closest-side,#f7f9fa 0%,#e9eef1 78%,#dde5e9 91%,rgba(221,229,233,0) 92%)";
const PILL_RED = { bg: RED, fg: "#ffffff", hover: RED_D, pill: true };

/** A design's palette in a colour (a colour the design does not take falls back to its own). */
export function paletteOf(look: LookKey, themeRaw: ThemeKey, headColor: HeadColor = "auto"): Palette {
  const theme = themeFor(look, themeRaw);
  let p: Palette;
  if (look === "petrol") {
    const gr = DARK[theme] ?? DARK.petrol!;
    p = { ...gr, panel: null, scrim: null, head: "#ffffff", accent: "#ffffff", accentLine: true, line: "#dbe6ec", eyebrow: "#cddbe3", bar: RED,
      button: PILL_RED, logo: "#ffffff", disc: DISC, textOn: "ground" };
  } else if (look === "light") {
    const gr = LIGHT[theme] ?? LIGHT.white!;
    p = { ...gr, panel: null, scrim: null, head: RED, accent: PETROL, accentLine: false, line: PETROL, eyebrow: "#4a5257", bar: RED,
      button: PILL_RED, logo: RED, disc: "", textOn: "ground" };
  } else if (look === "red") {
    const gr = theme === "white" ? g("#ffffff", ["#ffffff"]) : g("linear-gradient(90deg,#f4f4f4 0%,#ececec 100%)", ["#f4f4f4", "#ececec"]);
    p = { ...gr, panel: RED, scrim: null, head: "#ffffff", accent: "#000000", accentLine: false, line: "#ffffff", eyebrow: "#ffffff", bar: "#ffffff",
      button: { bg: "#ffffff", fg: "#000000", hover: "#f0f0f0", pill: true }, logo: "#ffffff", disc: "", textOn: "panel" };
  } else if (look === "campaign") {
    const gr = CAMPAIGN[theme] ?? CAMPAIGN.grey!;
    p = { ...gr, panel: null, scrim: null, head: "#000000", accent: RED, accentLine: false, line: "#2a2a2a", eyebrow: "#000000", bar: RED,
      button: { bg: RED, fg: "#ffffff", hover: RED_D, pill: false }, logo: RED, disc: "", textOn: "ground" };
  } else if (look === "photo") {
    const veil = theme === "petrol" ? "#1b3a4b" : "#0e1418";
    p = { ground: veil, grounds: [veil], panel: null, scrim: { color: veil, at: 0.72 }, head: "#ffffff", accent: "#ffffff", accentLine: true, line: "#eef3f5", eyebrow: "#eef3f5", bar: RED,
      button: PILL_RED, logo: "#ffffff", disc: "", textOn: "scrim" };
  } else {
    // the newsletter band, as it was (model.ts THEMES)
    const t = THEMES[theme] ?? THEMES.pale;
    const stops = t.bg.includes("gradient") ? ["#f7f8f9", "#e3e9ed"] : [t.bg];
    p = { ground: t.bg, grounds: stops, panel: null, scrim: null, head: t.acc, accent: t.dark ? "#ffffff" : RED, accentLine: t.dark, line: t.mut, eyebrow: t.eb, bar: RED,
      button: { bg: RED, fg: "#ffffff", hover: RED_D, pill: false }, logo: t.dark ? "#ffffff" : RED, disc: "", textOn: "ground" };
  }
  const picked = HEAD_COLORS.find((c) => c.key === headColor && c.hex);
  return picked ? { ...p, head: picked.hex } : p;
}

export const paletteFor = (d: Pick<BannerDoc, "look" | "theme" | "headColor">) => paletteOf(d.look, d.theme, d.headColor);

/* ── the guard ────────────────────────────────────────────────────────── */

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const rgb = (hex: string): Rgba => parseColor(hex) ?? WHITE;

/** The colours the words stand on: the ground's, the red block, or the veil over the brightest and darkest photo. */
export function groundsOfText(p: Palette): Rgba[] {
  if (p.textOn === "panel" && p.panel) return [rgb(p.panel)];
  if (p.textOn === "scrim" && p.scrim) {
    const veil = { ...rgb(p.scrim.color), a: p.scrim.at };
    return [over(veil, WHITE), over(veil, BLACK)];
  }
  return p.grounds.map(rgb);
}

export type Unreadable = { part: "headline" | "accent" | "eyebrow" | "line" | "button"; ratio: number; needs: number; text: string };

/**
 * Which of the banner's words cannot be read on what they stand on (WCAG: 4.5:1 for small words, 3:1 for the headline
 * and its red word - large text). Each with its sentence in plain words for the studio. [] = it reads.
 */
export function unreadable(d: Pick<BannerDoc, "look" | "theme" | "headColor" | "accent" | "content">): Unreadable[] {
  const p = paletteFor(d);
  const grounds = groundsOfText(p);
  const out: Unreadable[] = [];
  const name: Record<Unreadable["part"], string> = { headline: "The headline", accent: "The word in red", eyebrow: "The small line over the headline", line: "The line", button: "The button's words" };
  const check = (part: Unreadable["part"], color: string, on: Rgba[], needs: number, present: boolean) => {
    if (!present) return;
    const c = rgb(color);
    const w = worstContrast(c, on);
    if (w.ratio >= needs) return;
    const same = w.ratio < 1.25;
    out.push({
      part, ratio: Math.round(w.ratio * 10) / 10, needs,
      text: same
        ? `${name[part]} is ${colorName(c)} on ${colorName(w.ground)} - the colour of its ground: it cannot be read. Pick another colour or design.`
        : `${name[part]} is ${colorName(c)} on ${colorName(w.ground)} - ${w.ratio.toFixed(1)}:1, it needs ${needs}:1 to be read. Pick another colour or design.`,
    });
  };
  const c = d.content;
  check("headline", p.head, grounds, 3, !!c.headline.trim());
  if (!p.accentLine) check("accent", p.accent, grounds, 3, !!d.accent.trim() && c.headline.includes(d.accent.trim()));
  check("eyebrow", p.eyebrow, grounds, 4.5, !!c.eyebrow.trim());
  check("line", p.line, grounds, 4.5, !!c.line.trim());
  check("button", p.button.fg, [rgb(p.button.bg)], 4.5, !!c.button.label.trim());
  return out;
}

/** The contrast of two colours (for a swatch's own hint). */
export const ratioOf = (a: string, b: string) => contrast(rgb(a), rgb(b));
