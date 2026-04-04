"use client";
import { createTheme, alpha } from "@mui/material/styles";

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
      main: "#10b981",
      light: "#34d399",
      dark: "#059669",
    },
    warning: {
      main: "#f59e0b",
      light: "#fbbf24",
      dark: "#d97706",
    },
    info: {
      main: "#3b82f6",
      light: "#60a5fa",
      dark: "#2563eb",
    },
    error: {
      main: "#ef4444",
      light: "#f87171",
      dark: "#dc2626",
    },
    background: {
      default: "#f0f2f5",
      paper: "#ffffff",
    },
    text: {
      primary: "#050505",
      secondary: "#5e5e5e",
    },
    divider: "#e6e8ea",
  },
  typography: {
    fontFamily: "'Inter', Arial, system-ui, sans-serif",
    h4: { fontWeight: 800, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, fontSize: "0.8rem" },
    body2: { color: "#5e5e5e" },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
          padding: "8px 20px",
        },
        contained: {
          boxShadow: "none",
          "&:hover": { boxShadow: "0 2px 8px rgba(39,78,100,0.2)" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid #e6e8ea",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.75rem" },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid #e6e8ea",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#5e5e5e" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
      },
    },
  },
});

export { alpha };
export default theme;
