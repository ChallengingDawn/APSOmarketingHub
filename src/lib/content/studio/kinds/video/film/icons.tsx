// THE FILM'S ICONS (08.11.2026): the shop's own 24 px line icons (home-page-2026 gen_home_concepts.py ICON - the ones
// beside the shop's promises and tools), and four more drawn the same way (truck, grid, chat, pin). In the film they draw
// themselves on (each line at its own length, `t` 0..1). CSS and SVG only, like the rest of the film.
import React from "react";
import type { IconKey } from "../features";
import { ICON_PATHS } from "./iconPaths";

export { ICON_PATHS };


/** Each line of an icon measured as 1, so the whole icon draws on together. */
const measured = (paths: string) => paths.replace(/<(path|circle|rect)\b/g, '<$1 pathLength="1"');

/** An icon at `size` px, in `color`, drawn on as `t` goes 0..1 (1 = whole). */
export const Icon: React.FC<{ name: IconKey; size: number; color: string; t?: number; stroke?: number; style?: React.CSSProperties }> = ({ name, size, color, t = 1, stroke = 1.7, style }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden
    style={{ display: "block", strokeDasharray: 1, strokeDashoffset: Math.max(0, Math.min(1, 1 - t)), overflow: "visible", ...style }}
    dangerouslySetInnerHTML={{ __html: measured(ICON_PATHS[name] ?? ICON_PATHS.check) }} />
);
