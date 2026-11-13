// APSOconvert > ADD-TO-CARTS BY WHERE, as shares (SARCLA 13.11.2026 on the tile "Search bar 136 91%": he read "13691%" -
// "% of what ="). The count and its share stood side by side and read as one number. Each share is of ALL the add-to-carts
// the shop counted (the search bar + the chat + the pages' own buttons), so the three are at most 100% - and the tile now
// says so in words. Pure, so it is tested.

import { pctOf } from "./heatDraw";

export type CartSource = "search" | "chat" | "page";
export type CartShare = { key: CartSource; n: number; pct: string };

/** Each source's add-to-carts and its share of all of them ("91%", "<1%", "0%"); `all` is the base of every share. */
export function cartShares(c: { search: number; chat: number; page: number }): { all: number; cells: CartShare[] } {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  const cells: CartShare[] = (["search", "chat", "page"] as const).map((key) => ({ key, n: n(c[key]), pct: "" }));
  const all = cells.reduce((t, x) => t + x.n, 0);
  for (const x of cells) x.pct = all > 0 ? pctOf(x.n, all) || "0%" : "";
  return { all, cells };
}
