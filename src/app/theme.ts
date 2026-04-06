"use client";
import { createTheme, alpha } from "@mui/material/styles";

// Google-inspired flat design system
const theme = createTheme({
  palette: {
    primary: {
      main: "#274e64",
      light: "#325f78",
      dark: "#1a3a4c",
    },
    secondary: {
      main: "#ed1b2f",
      light: "#f14d5c",
      dark: "#d80901",
    },
    success: {
      main: "#34a853", // Google green
      light: "#5ec97f",
      dark: "#1e8e3e",
    },
    warning: {
      main: "#fbbc04", // Google yellow
      light: "#fdd663",
      dark: "#f9ab00",
    },
    info: {
      main: "#4285f4", // Google blue
      light: "#669df6",
      dark: "#1a73e8",
    },
    error: {
      main: "#ea4335", // Google red
      light: "#ee675c",
      dark: "#c5221f",
    },
    background: {
      default: "#f8f9fa", // Google grey 50
      paper: "#ffffff",
    },
    text: {
      primary: "#1f1f1f", // Google dark
      secondary: "#5f6368", // Google grey 700
    },
    divider: "#ececec",
  },
  typography: {
    fontFamily: "'Inter', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    h4: { fontWeight: 500, letterSpacing: "-0.02em", color: "#1f1f1f" },
    h5: { fontWeight: 500, letterSpacing: "-0.01em", color: "#1f1f1f" },
    h6: { fontWeight: 500, color: "#1f1f1f" },
    subtitle1: { fontWeight: 500, color: "#1f1f1f" },
    subtitle2: { fontWeight: 500, fontSize: "0.8rem", color: "#1f1f1f" },
    body1: { color: "#3c4043" },
    body2: { color: "#5f6368" },
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          borderRadius: 999, // Google pill shape
          padding: "8px 22px",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "0 1px 3px rgba(60,64,67,0.15)" },
        },
        outlined: {
          borderColor: "#dadce0",
          color: "#3c4043",
          "&:hover": { borderColor: "#274e64", bgcolor: "#f1f3f4" },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid #ececec",
          boxShadow: "none",
          backgroundImage: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          "&:hover": {
            boxShadow: "0 1px 2px rgba(60,64,67,0.04), 0 2px 6px rgba(60,64,67,0.06)",
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: "0.75rem", borderRadius: 8 },
        filled: { backgroundColor: "#f1f3f4" },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid #ececec",
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: "1px solid #ececec" },
        head: {
          fontWeight: 500,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#5f6368",
          backgroundColor: "#f8f9fa",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 6, backgroundColor: "#f1f3f4" },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: "1px solid", borderColor: "#ececec" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "& fieldset": { borderColor: "#dadce0" },
          "&:hover fieldset": { borderColor: "#274e64 !important" },
        },
      },
    },
  },
});

export { alpha };
export default theme;
