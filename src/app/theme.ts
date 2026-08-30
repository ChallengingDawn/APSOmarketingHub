"use client";
import { createTheme, alpha } from "@mui/material/styles";

// ─────────────────────────────────────────────────────────────────────────────
// APSO design language, second pass — quieter, rounder, more air.
//
// The chrome carries the brand (navy, red). Data marks do not: chart series use
// the validated hues in src/app/charts/palette.ts, because brand navy fails the
// colour-vision checks as a data colour (too dark, reads as grey).
//
// One radius scale drives every corner: an sx `borderRadius: 1` is 5px,
// `2` is 10px, `3` is 15px. Depth is a hairline plus a soft two-layer shadow
// that appears on hover — nothing floats by default.
// ─────────────────────────────────────────────────────────────────────────────

const INK = "#1a1d21";
const MUTED = "#5b6470";
const BORDER = "#e6e8ec";
const SURFACE = "#f5f6f8";

const RADIUS_UNIT = 5;

const SHADOW_SOFT = "0 1px 2px rgba(26,58,76,0.05), 0 4px 14px rgba(26,58,76,0.06)";
const SHADOW_HOVER = "0 2px 4px rgba(26,58,76,0.06), 0 12px 32px rgba(26,58,76,0.10)";
const SHADOW_POPOVER = "0 4px 10px rgba(26,58,76,0.08), 0 16px 40px rgba(26,58,76,0.12)";

const FONT_TEXT = "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_DISPLAY = "var(--font-outfit), var(--font-inter), -apple-system, sans-serif";

const display = (size: string, weight = 600, tracking = "-0.025em") => ({
  fontFamily: FONT_DISPLAY,
  fontWeight: weight,
  fontSize: size,
  letterSpacing: tracking,
  lineHeight: 1.15,
  color: INK,
});

const theme = createTheme({
  palette: {
    primary: { main: "#274e64", light: "#35637d", dark: "#1a3a4c" },
    secondary: { main: "#ed1b2f", light: "#f04555", dark: "#c41527" },
    success: { main: "#1e7e45", light: "#34a06a", dark: "#155d33" },
    warning: { main: "#c77700", light: "#e08c1a", dark: "#9a5d00" },
    info: { main: "#2563a8", light: "#3b7dc4", dark: "#1b4a80" },
    error: { main: "#c5221f", light: "#d83a36", dark: "#9e1b18" },
    background: { default: SURFACE, paper: "#ffffff" },
    text: { primary: INK, secondary: MUTED },
    divider: BORDER,
  },
  typography: {
    fontFamily: FONT_TEXT,
    h1: display("2.25rem", 600, "-0.03em"),
    h2: display("1.75rem", 600, "-0.03em"),
    h3: display("1.4rem"),
    h4: display("1.2rem"),
    h5: display("1.05rem", 600, "-0.015em"),
    h6: display("0.95rem", 600, "-0.01em"),
    subtitle1: { fontWeight: 600, fontSize: "0.95rem", color: INK, letterSpacing: "-0.01em" },
    subtitle2: { fontWeight: 600, fontSize: "0.82rem", color: INK },
    body1: { fontSize: "0.925rem", lineHeight: 1.6, color: "#363c44" },
    body2: { fontSize: "0.84rem", lineHeight: 1.55, color: MUTED },
    caption: { fontSize: "0.74rem", lineHeight: 1.45, color: MUTED },
    overline: {
      fontSize: "0.7rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: MUTED,
      lineHeight: 1.4,
    },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: "-0.005em" },
  },
  shape: { borderRadius: RADIUS_UNIT },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
        body: { backgroundColor: SURFACE, color: INK },
        "*:focus-visible": { outline: "2px solid #274e64", outlineOffset: 2, borderRadius: 6 },
        "::selection": { backgroundColor: alpha("#274e64", 0.18) },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 9,
          padding: "8px 16px",
          fontSize: "0.86rem",
          boxShadow: "none",
          transition:
            "background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
          "&:hover": { boxShadow: "none" },
          "&:active": { transform: "translateY(0.5px)" },
        },
        sizeSmall: { padding: "5px 12px", fontSize: "0.79rem", borderRadius: 8 },
        sizeLarge: { padding: "11px 22px", fontSize: "0.95rem", borderRadius: 11 },
        contained: { "&:hover": { boxShadow: "0 2px 8px rgba(39,78,100,0.22)" } },
        outlined: {
          borderColor: "#d9dde3",
          color: "#363c44",
          backgroundColor: "#fff",
          "&:hover": { borderColor: "#274e64", backgroundColor: "#f3f6f8" },
        },
        text: { "&:hover": { backgroundColor: alpha("#274e64", 0.06) } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8, transition: "background-color 140ms ease" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          boxShadow: "none",
          backgroundImage: "none",
          transition: "border-color 180ms ease, box-shadow 180ms ease",
          "&:hover": { boxShadow: SHADOW_SOFT },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        rounded: { borderRadius: 12 },
        elevation1: { boxShadow: SHADOW_SOFT },
        elevation2: { boxShadow: SHADOW_SOFT },
        elevation3: { boxShadow: SHADOW_HOVER },
        elevation8: { boxShadow: SHADOW_POPOVER },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 14, boxShadow: SHADOW_POPOVER } },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          boxShadow: SHADOW_POPOVER,
          border: `1px solid ${BORDER}`,
          marginTop: 4,
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 7, fontSize: "0.875rem", minHeight: 36, margin: "1px 0" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.74rem", borderRadius: 6, height: 24 },
        filled: { backgroundColor: "#eef0f3" },
        label: { paddingLeft: 9, paddingRight: 9 },
        sizeSmall: { height: 22, fontSize: "0.7rem" },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: `1px solid ${BORDER}`, backgroundImage: "none" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${BORDER}`, fontSize: "0.86rem", padding: "11px 14px" },
        head: {
          fontWeight: 600,
          fontSize: "0.74rem",
          letterSpacing: "0.01em",
          color: MUTED,
          backgroundColor: "#fff",
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&:last-child td": { borderBottom: 0 } },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6, backgroundColor: "#eef0f3" },
        bar: { borderRadius: 4 },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: "1px solid", borderColor: BORDER, fontSize: "0.86rem" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          backgroundColor: "#fff",
          "& fieldset": { borderColor: "#d9dde3", transition: "border-color 140ms ease" },
          "&:hover fieldset": { borderColor: "#9aa4b1 !important" },
          "&.Mui-focused fieldset": { borderColor: "#274e64 !important", borderWidth: "1.5px" },
        },
        input: { padding: "10px 13px", fontSize: "0.9rem" },
        inputSizeSmall: { padding: "7px 11px", fontSize: "0.86rem" },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: "0.86rem" } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.82rem",
          borderColor: "#d9dde3",
          "&.Mui-selected": {
            backgroundColor: "#274e64",
            color: "#fff",
            "&:hover": { backgroundColor: "#1f4053" },
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          backgroundColor: INK,
          fontSize: "0.74rem",
          fontWeight: 500,
          padding: "6px 10px",
          lineHeight: 1.45,
        },
        arrow: { color: INK },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: "-0.005em",
          minHeight: 44,
          fontSize: "0.875rem",
        },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 2, borderRadius: 2 } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: BORDER } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
  },
});

export { alpha, SHADOW_SOFT, SHADOW_HOVER, SHADOW_POPOVER };
export default theme;
