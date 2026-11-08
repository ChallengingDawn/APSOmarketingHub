// THE FILM'S FONT IN THE BROWSER (08.11.2026): Jost 500 and 700, latin and latin-ext (Polish needs ą ę ł ś ż ź ć ń),
// from the hub's public/video/fonts - the same files the render machine serves. Once they are in, the film measures
// its words with the real font (engine/text.ts), so what fits in the studio fits in the render.
import { estimate, setMeasure, type Measure } from "../engine/text";
import { asset, FAMILY } from "./theme";

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

let loading: Promise<boolean> | null = null;

let ctx: CanvasRenderingContext2D | null = null;
const canvasMeasure: Measure = (text, weight) => {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return estimate(text, weight);
  ctx.font = `${weight} 100px '${FAMILY}'`;
  return ctx.measureText(text).width / 100;
};

/** Loads the font once; true when it is in (false: the film shows in a fallback font, measured by estimate). */
export function loadFilmFonts(base = ""): Promise<boolean> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve(false);
  loading ??= Promise.all(
    ["500", "700"].flatMap((w) => [
      new FontFace(FAMILY, `url(${asset(base, `fonts/jost-latin-${w}-normal.woff2`)})`, { weight: w, unicodeRange: LATIN }),
      new FontFace(FAMILY, `url(${asset(base, `fonts/jost-latin-ext-${w}-normal.woff2`)})`, { weight: w, unicodeRange: LATIN_EXT }),
    ].map((face) => face.load().then((f) => { document.fonts.add(f); }))),
  )
    .then(() => document.fonts.ready)
    .then(() => { setMeasure(canvasMeasure); return true; })
    .catch(() => { loading = null; return false; });
  return loading;
}
