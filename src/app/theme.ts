"use client";
import { createTheme } from "@mui/material/styles";

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
    background: {
      default: "#f6f6f6",
      paper: "#ffffff",
    },
    text: {
      primary: "#050505",
      secondary: "#5e5e5e",
    },
    divider: "#e6e8ea",
  },
  typography: {
    fontFamily: "Arial, system-ui, sans-serif",
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid #e6e8ea",
        },
      },
    },
  },
});

export default theme;
