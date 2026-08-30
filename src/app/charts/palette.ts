// Chart colour roles.
//
// Validated with the dataviz six-checks validator on the white chart surface
// (2026-08-30): the four series slots pass the lightness band, the chroma
// floor and colour-vision separation (worst adjacent pair ΔE 9.1). Aqua and
// yellow sit under 3:1 contrast, so any chart using them ships visible labels
// or the table view — the ChartFrame table toggle is that relief.
//
// Brand navy is deliberately NOT a data colour: it fails the chroma floor and
// reads as grey next to other marks. It stays in the chrome.

// Slot 1 is the brand-leaning blue that still clears the chroma floor.
export const SERIES = ["#2d6fa8", "#eb6834", "#1baf7a", "#eda100"] as const;
export const ACCENT = SERIES[0];

/** Previous period, "other", and anything that is context rather than the point. */
export const DEEMPHASIS = "#b9c0c9";

export const AREA_WASH_OPACITY = 0.1;

/** One-hue ramp for magnitude, light → dark. */
export const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#2a78d6", "#1c5cab", "#0d366b"] as const;

export const CHROME = {
  surface: "#ffffff",
  grid: "#e9ebef",
  axis: "#cfd4db",
  ink: "#1a1d21",
  muted: "#5b6470",
  label: "#6b7380",
} as const;

/** Delta colouring is direction × whether up is good — never the series colour. */
export const DELTA = { good: "#1e7e45", bad: "#c5221f", flat: "#5b6470" } as const;

export const FONT = "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif";
