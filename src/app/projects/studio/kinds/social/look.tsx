"use client";
// THE SOCIAL STUDIO'S LOOK (08.11.2026; SARCLA: "improve the canvas design page as well" - Canva / Figma quality). One
// set of tokens and a few pieces every panel is made of, so the rail, the panels, the bar and the inspector read as one
// calm product: white surfaces, hairlines, one accent, the design itself the only colourful thing on screen.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { PINK } from "../../parts";

export const T = {
  ink: "#16202a",
  ink2: "#4b5563",
  ink3: "#8a94a3",
  line: "rgba(17,24,39,.08)",
  line2: "rgba(17,24,39,.14)",
  hover: "#f3f4f6",
  sunken: "#f6f7f9",
  stage: "#eceef2",
  accent: PINK,
  accentSoft: "rgba(194,44,110,.08)",
  focus: "#2459d1",
  shadow: "0 1px 2px rgba(16,24,40,.05), 0 12px 32px -8px rgba(16,24,40,.18)",
  shadowLg: "0 2px 6px rgba(16,24,40,.06), 0 24px 56px -12px rgba(16,24,40,.28)",
} as const;

export const RAIL_W = 76;
export const BAR_H = 52;

/** A panel's title row and its scrolling body. */
export function PanelFrame({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, pt: 2, pb: 1.25, flexShrink: 0 }}>
        <Typography component="h2" sx={{ fontSize: "1rem", fontWeight: 700, color: T.ink, letterSpacing: "-0.01em", flex: 1 }}>{title}</Typography>
        {right}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2.25, pb: 3, "&::-webkit-scrollbar": { width: 8 }, "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(17,24,39,.12)", borderRadius: 4 } }}>
        {children}
      </Box>
    </Box>
  );
}

/** A small heading inside a panel. */
export const Head = ({ children, mt = 2.25, right }: { children: React.ReactNode; mt?: number; right?: React.ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", mt, mb: 1 }}>
    <Typography sx={{ flex: 1, fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.ink3 }}>{children}</Typography>
    {right}
  </Box>
);

/** A quiet sentence under a control. */
export const Note = ({ children, sx }: { children: React.ReactNode; sx?: object }) => (
  <Typography sx={{ fontSize: "0.78rem", color: T.ink3, lineHeight: 1.45, ...sx }}>{children}</Typography>
);

/** A tile you click to put something on the canvas. */
export function Tile({ onClick, children, title, sx, active, disabled }: { onClick: () => void; children: React.ReactNode; title?: string; sx?: object; active?: boolean; disabled?: boolean }) {
  const el = (
    <Box component="button" type="button" onClick={onClick} disabled={disabled} sx={{
      all: "unset", boxSizing: "border-box", cursor: disabled ? "default" : "pointer", display: "block", width: "100%", borderRadius: "10px",
      border: `1px solid ${active ? T.ink : T.line}`, bgcolor: "#fff", overflow: "hidden", position: "relative", opacity: disabled ? 0.5 : 1,
      transition: "border-color .12s, box-shadow .12s, transform .12s",
      "&:hover": disabled ? {} : { borderColor: T.line2, boxShadow: "0 6px 18px -8px rgba(16,24,40,.25)", transform: "translateY(-1px)" },
      "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: 2 },
      ...sx,
    }}>
      {children}
    </Box>
  );
  return title ? <Tooltip title={title} placement="top" enterDelay={400}><Box component="span" sx={{ display: "block" }}>{el}</Box></Tooltip> : el;
}

/** A plain button in the studio's look: quiet, or the accent. */
export function Btn({ children, onClick, main, disabled, icon, sx, title, type = "button" }: {
  children?: React.ReactNode; onClick?: (e: React.MouseEvent<HTMLElement>) => void; main?: boolean; disabled?: boolean; icon?: React.ReactNode; sx?: object; title?: string; type?: "button" | "submit";
}) {
  const el = (
    <Box component="button" type={type} onClick={onClick} disabled={disabled} aria-label={!children && title ? title : undefined} sx={{
      all: "unset", boxSizing: "border-box", cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.75,
      height: 34, px: children ? 1.5 : 0, minWidth: 34, borderRadius: "8px", fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap",
      color: main ? "#fff" : disabled ? T.ink3 : T.ink, bgcolor: main ? (disabled ? "#d9a8bf" : T.accent) : "transparent",
      border: main ? "none" : `1px solid ${T.line}`, transition: "background-color .12s, border-color .12s",
      "&:hover": disabled ? {} : main ? { bgcolor: "#a3245c" } : { bgcolor: T.hover, borderColor: T.line2 },
      "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: 2 },
      "& svg": { fontSize: 18 },
      ...sx,
    }}>
      {icon}{children}
    </Box>
  );
  return title ? <Tooltip title={title}>{el}</Tooltip> : el;
}

/** An icon button with no border (the bar's). */
export function IconBtn({ title, onClick, disabled, children, active }: { title: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; disabled?: boolean; children: React.ReactNode; active?: boolean }) {
  return (
    <Tooltip title={title}>
      <span>
        <Box component="button" type="button" aria-label={title} onClick={onClick} disabled={disabled} sx={{
          all: "unset", boxSizing: "border-box", cursor: disabled ? "default" : "pointer", width: 34, height: 34, borderRadius: "8px",
          display: "grid", placeItems: "center", color: disabled ? "#c3c9d2" : T.ink2, bgcolor: active ? T.hover : "transparent",
          "&:hover": disabled ? {} : { bgcolor: T.hover, color: T.ink }, "&:focus-visible": { outline: `2px solid ${T.focus}` },
          "& svg": { fontSize: 19 },
        }}>{children}</Box>
      </span>
    </Tooltip>
  );
}

/** A colour swatch, squared with soft corners. */
export function Swatch({ color, on, onClick, size = 30, title }: { color: string; on?: boolean; onClick: () => void; size?: number; title?: string }) {
  return (
    <Tooltip title={title ?? color} enterDelay={500}>
      <Box component="button" type="button" aria-label={title ?? color} onClick={onClick} sx={{
        all: "unset", cursor: "pointer", width: size, height: size, borderRadius: "7px", background: color, boxSizing: "border-box",
        boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${T.ink}` : "inset 0 0 0 1px rgba(17,24,39,.12)",
        transition: "transform .1s", "&:hover": { transform: "scale(1.06)" }, "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: 2 },
      }} />
    </Tooltip>
  );
}
