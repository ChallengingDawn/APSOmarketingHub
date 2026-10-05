"use client";
// WHAT GOES IN THE CIRCLE.
//
// Three things, in order: a photograph somebody uploaded, an icon they picked,
// or their initials. One component, so the header and the account page cannot
// disagree about which of the three you are looking at.
//
// A picked icon is stored as its NAME — five bytes — and drawn here in CSS. It
// used to be painted to a canvas and sent as a base64 image, which is how a
// 40-pixel circle became a 15 KB request body and ran into the 8 KB body rule
// in front of this app: HTTP 403, no message, nothing in the logs. An emoji on
// a gradient is two CSS properties; it never needed to be a file.

import Box from "@mui/material/Box";

export type IconChoice = { id: string; glyph: string; from: string; to: string };

/** Twelve, in the hub's own hues. Work-appropriate, not corporate. */
export const ICON_CHOICES: IconChoice[] = [
  { id: "spark", glyph: "✨", from: "#8b5cf6", to: "#6366f1" },
  { id: "rocket", glyph: "🚀", from: "#3b82f6", to: "#2459d1" },
  { id: "fox", glyph: "🦊", from: "#fb923c", to: "#ea580c" },
  { id: "cat", glyph: "🐱", from: "#a78bfa", to: "#7c3aed" },
  { id: "bolt", glyph: "⚡", from: "#fbbf24", to: "#f59e0b" },
  { id: "leaf", glyph: "🌿", from: "#34d399", to: "#059669" },
  { id: "target", glyph: "🎯", from: "#f87171", to: "#dc2626" },
  { id: "puzzle", glyph: "🧩", from: "#60a5fa", to: "#3b82f6" },
  { id: "coffee", glyph: "☕", from: "#d6a06a", to: "#92400e" },
  { id: "tools", glyph: "🛠️", from: "#94a3b8", to: "#475569" },
  { id: "box", glyph: "📦", from: "#fcd34d", to: "#d97706" },
  { id: "wave", glyph: "🌊", from: "#22d3ee", to: "#0891b2" },
];

export const findIcon = (id: string | null | undefined): IconChoice | null =>
  (id ? ICON_CHOICES.find((c) => c.id === id) ?? null : null);

export function AvatarFace({ photo, iconId, initials, size, tint, fg, fallback }: {
  photo?: string | null;
  iconId?: string | null;
  initials?: string;
  size: number;
  /** Used only for the initials, so the circle still carries the role's colour. */
  tint?: string;
  fg?: string;
  fallback?: React.ReactNode;
}) {
  const icon = findIcon(iconId);
  const base = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    display: "grid", placeItems: "center", userSelect: "none" as const,
  };

  if (photo) {
    return (
      <Box sx={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Box component="img" src={photo} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Box>
    );
  }
  if (icon) {
    return (
      <Box sx={{
        ...base,
        background: `linear-gradient(140deg, ${icon.from}, ${icon.to})`,
        fontSize: Math.round(size * 0.52), lineHeight: 1,
      }}>{icon.glyph}</Box>
    );
  }
  return (
    <Box sx={{
      ...base,
      bgcolor: tint ?? "#e9eef5", color: fg ?? "#4a5a70",
      fontSize: Math.round(size * 0.36), fontWeight: 700,
    }}>{initials || fallback}</Box>
  );
}
