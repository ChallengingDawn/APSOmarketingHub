"use client";

// THE AI'S BUTTON - every place where the AI does the work ("Discover the optimization", "Find optimizations", the AI
// helper): a gradient that moves slowly, in the hub's AI colours - the purple of "Create with AI", the hub's blue and the
// pink of Content's studios (SARCLA 09.11.2026: "put the button on Insights more AI, with a moving gradient"). Still
// for people who ask their system for less motion.

import Link from "next/link";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { keyframes } from "@mui/material/styles";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const flow = keyframes`0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; }`;
const twinkle = keyframes`0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; } 50% { transform: scale(1.18) rotate(12deg); opacity: .85; }`;

export const AI_GRADIENT = "linear-gradient(115deg, #5b3fd0 0%, #2459d1 30%, #b5359a 55%, #6a46c9 80%, #2459d1 100%)";

export const aiButtonSx = {
  color: "#fff",
  fontWeight: 700,
  textTransform: "none",
  borderRadius: "8px",
  px: 1.75,
  backgroundImage: AI_GRADIENT,
  backgroundSize: "300% 100%",
  animation: `${flow} 7s ease-in-out infinite`,
  boxShadow: "0 6px 16px rgba(91,63,208,.28)",
  transition: "box-shadow .15s, filter .15s",
  "& .MuiButton-startIcon svg": { animation: `${twinkle} 2.4s ease-in-out infinite` },
  "&:hover": { boxShadow: "0 8px 22px rgba(91,63,208,.42)", filter: "brightness(1.06)" },
  "&.Mui-disabled": { color: "rgba(255,255,255,.85)", filter: "grayscale(.35) opacity(.7)" },
  "@media (prefers-reduced-motion: reduce)": { animation: "none", "& .MuiButton-startIcon svg": { animation: "none" } },
} as const;

export function AiButton({ children, href, onClick, busy, disabled, size = "medium" }: {
  children: React.ReactNode; href?: string; onClick?: () => void; busy?: boolean; disabled?: boolean; size?: "small" | "medium";
}) {
  const icon = busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon sx={{ fontSize: size === "small" ? 16 : 18 }} />;
  if (href && !disabled) {
    return <Button size={size} disableElevation component={Link} href={href} startIcon={icon} sx={aiButtonSx}>{children}</Button>;
  }
  return <Button size={size} disableElevation onClick={onClick} disabled={disabled || busy} startIcon={icon} sx={aiButtonSx}>{children}</Button>;
}
