"use client";
import { createTheme, alpha } from "@mui/material/styles";

// ─────────────────────────────────────────────────────────────────────────────
// APSO design system — square, industrial, premium.
// Brand: navy #274e64 + red #ed1b2f. Corners are near-square (2px) like the
// apsoparts identity; surfaces are flat with hairline borders and whisper-soft
// shadows. No pill shapes, no Google palette — every accent is brand-aligned.
// ─────────────────────────────────────────────────────────────────────────────

// Layered, whisper-soft elevation — the "Apple-level" depth cue: barely there,
// two stacked shadows so edges read crisp instead of muddy.
const SHADOW_SOFT = "0 1px 2px rgba(26,58,76,0.04), 0 2px 8px rgba(26,58,76,0.05)";
const SHADOW_HOVER = "0 2px 4px rgba(26,58,76,0.06), 0 8px 24px rgba(26,58,76,0.08)";

const BORDER = "#e6e8ec";

const theme = createTheme({
  palette: {
    primary: {
      main: "#274e64",
      light: "#35637d",
      dark: "#1a3a4c",
    },
    secondary: {
      main: "#ed1b2f",
      light: "#f04555",
      dark: "#c41527",
    },
    success: {
      main: "#1e7e45",
      light: "#34a06a",
      dark: "#155d33",
    },
    warning: {
      main: "#c77700",
      light: "#e08c1a",
      dark: "#9a5d00",
    },
    info: {
      main: "#2563a8",
      light: "#3b7dc4",
      dark: "#1b4a80",
    },
    error: {
      main: "#c5221f",
      light: "#d83a36",
      dark: "#9e1b18",
    },
    background: {
      default: "#f5f6f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#1a1d21",
      secondary: "#5b6470",
    },
    divider: BORDER,
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    h4: { fontFamily: "'Outfit', 'Inter', sans-serif", fontWeight: 600, letterSpacing: "-0.03em", color: "#1a1d21" },
    h5: { fontFamily: "'Outfit', 'Inter', sans-serif", fontWeight: 600, letterSpacing: "-0.025em", color: "#1a1d21" },
    h6: { fontFamily: "'Outfit', 'Inter', sans-serif", fontWeight: 600, letterSpacing: "-0.015em", color: "#1a1d21" },
    subtitle1: { fontWeight: 600, color: "#1a1d21" },
    subtitle2: { fontWeight: 600, fontSize: "0.8rem", color: "#1a1d21" },
    body1: { color: "#363c44" },
    body2: { color: "#5b6470" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: "-0.005em" },
  },
  shape: {
    // Master square lever: every sx `borderRadius: N` is N × this. 2px keeps a
    // hairline of softening on the corners — square, but not razor-sharp.
    borderRadius: 2,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 2,
          padding: "8px 18px",
          boxShadow: "none",
          letterSpacing: "-0.005em",
          "&:hover": { boxShadow: "none" },
        },
        sizeSmall: { padding: "5px 12px", fontSize: "0.78rem" },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "0 1px 3px rgba(26,58,76,0.18)" },
        },
        outlined: {
          borderColor: "#d3d7dd",
          color: "#363c44",
          "&:hover": { borderColor: "#274e64", backgroundColor: "#eef2f5" },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 3,
          border: `1px solid ${BORDER}`,
          boxShadow: "none",
          backgroundImage: "none",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
          "&:hover": { boxShadow: SHADOW_SOFT },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        rounded: { borderRadius: 3 },
        elevation1: { boxShadow: SHADOW_SOFT },
        elevation2: { boxShadow: SHADOW_SOFT },
        elevation3: { boxShadow: SHADOW_HOVER },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.72rem", borderRadius: 2 },
        filled: { backgroundColor: "#eef0f3" },
        label: { paddingLeft: 9, paddingRight: 9 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${BORDER}`,
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${BORDER}` },
        head: {
          fontWeight: 600,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#5b6470",
          backgroundColor: "#f5f6f8",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 2, height: 6, backgroundColor: "#eef0f3" },
        bar: { borderRadius: 2 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 2, border: "1px solid", borderColor: BORDER },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          "& fieldset": { borderColor: "#d3d7dd" },
          "&:hover fieldset": { borderColor: "#274e64 !important" },
          "&.Mui-focused fieldset": { borderColor: "#274e64 !important", borderWidth: "1.5px" },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { borderRadius: 2, textTransform: "none", fontWeight: 600 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 2,
          backgroundColor: "#1a1d21",
          fontSize: "0.72rem",
          fontWeight: 500,
          padding: "6px 10px",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, letterSpacing: "-0.005em" },
      },
    },
  },
});

export { alpha };
export default theme;
