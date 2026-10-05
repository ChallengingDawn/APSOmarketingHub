"use client";
// A PICTURE WITHOUT A PHOTOGRAPH.
//
// Most people will not upload a photo of themselves to an internal tool, and
// two grey initials is what they get instead. A dozen icons costs nothing and
// gives the hub some faces.
//
// Drawn into the same 256px square an uploaded photo is resized to, and saved
// to the same field — so everywhere that already shows a picture shows these,
// and nothing else had to learn about them.

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

/**
 * Paint one into a square and hand back a data URI.
 *
 * PNG rather than JPEG: an emoji on a gradient is flat colour with hard edges,
 * which is what JPEG is worst at. It still lands far inside the size cap.
 */
export function drawIcon(choice: IconChoice): string {
  const SIDE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the icon.");

  const g = ctx.createLinearGradient(0, 0, SIDE, SIDE);
  g.addColorStop(0, choice.from);
  g.addColorStop(1, choice.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIDE, SIDE);

  ctx.font = `${Math.round(SIDE * 0.52)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  // Optical centre, not geometric: emoji sit high in their box, and a glyph
  // centred by its baseline looks like it is falling out of the circle.
  ctx.textBaseline = "middle";
  ctx.fillText(choice.glyph, SIDE / 2, SIDE / 2 + SIDE * 0.03);

  return canvas.toDataURL("image/png");
}
