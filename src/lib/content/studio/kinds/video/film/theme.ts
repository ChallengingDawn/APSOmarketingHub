// THE FILM'S LOOK (08.11.2026) - the shop's, as in the team's films: red #D80901 for the brand's own red (bars, the
// button), the campaign red #FF0000 only on the key words, petrol #274E64, ink #1D2A33 on the shop's light grey.
// One type family, two weights: Jost (the stand-in for the shop's futura-pt, an Adobe font that cannot be bundled),
// 500 and 700. No letter-spaced capitals.

export const B = {
  red: "#D80901",
  redDeep: "#B00700",
  key: "#FF0000",
  petrol: "#274E64",
  ink: "#1D2A33",
  bg: "#F4F6F8",
  grey: "#F3F3F3",
  grey2: "#E6E6E6",
  line: "#D9DEE3",
  mute: "#5C6670",
  white: "#FFFFFF",
} as const;

/** Its own family name, so nothing else on the page (the hub's fonts) can stand in for it. */
export const FAMILY = "APSO Film Jost";
export const FONT = `'${FAMILY}', 'Jost', 'Segoe UI', sans-serif`;
export const REG = 500;
export const BOLD = 700;

/** Where the film's files live (the hub's public/video; the render machine serves the same folder). */
export const asset = (base: string, path: string) => `${base.replace(/\/+$/, "")}/video/${path.replace(/^\/+/, "")}`;
export const LOGO = "brand/apsoparts-logo-black.svg";
/** The logo's width over its height (its viewBox, 119.24 x 36.42). */
export const LOGO_RATIO = 119.24 / 36.42;
