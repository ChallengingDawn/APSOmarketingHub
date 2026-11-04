"use client";
// FROM A TILE TO ITS ACTIONS PAGE (SARCLA 04.11.2026: "open the action page on the KPI ... a creation action module on
// Advanced reporting"). The Actions tab on a graph opens /reporting/actions with the tile in its address - what it is,
// where it lives, its target - so the page can be reloaded or sent. The graph itself, as its page drew it, comes along
// in memory only: a copy of the card the tab sits on, shown as it was when no style of its own can be drawn (the
// page's styles are still loaded after a move inside the hub; after a reload the copy is gone and the page says where
// the graph lives instead).

import type { Placement } from "@/lib/reporting/kpiActions";
import type { TileInfo } from "@/app/reporting/marketing-kpis/tiles/TileActions";

/** A tile as its Actions page needs it: the tile, where it starts, the page it was opened from, what it shows now. */
export type ActionsTile = TileInfo & {
  start: Placement;
  /** where the tab was: the BUC View or the tile's own page */
  where?: "nutshell" | "tab";
  /** the address it was opened from - "Back" goes there */
  back?: string;
  /** what the tile shows now, in its target's terms (a rate as a fraction) */
  current?: number | null;
};

export const ACTIONS_PATH = "/reporting/actions";
type Snap = { html: string; width: number };
const snaps = new Map<string, Snap>();

/** The card a tab sits on: the first box around it with a card's round corners and a card's size. */
function cardOf(from: HTMLElement): HTMLElement | null {
  for (let el = from.parentElement; el && el !== document.body; el = el.parentElement) {
    const cs = window.getComputedStyle(el);
    if (parseFloat(cs.borderTopLeftRadius) >= 12 && el.offsetWidth >= 200 && el.offsetHeight >= 100) return el;
  }
  return null;
}

/** A copy of the card as drawn now, without its Actions tab. */
function snapshot(button: HTMLElement): Snap | null {
  const card = cardOf(button);
  if (!card) return null;
  const copy = card.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-label^="Actions for "]').forEach((b) => b.parentElement?.remove());
  const html = copy.outerHTML;
  return html.length > 600_000 ? null : { html, width: card.offsetWidth };
}

export const snapOf = (key: string): Snap | undefined => snaps.get(key);

/** The page's address for a tile: everything in it but the copy of the card (the 2 KB address rule - filters dropped if long). */
export function actionsHref(t: ActionsTile): string {
  const { summary, filters, ...rest } = t;
  const full = JSON.stringify({ ...rest, ...(summary ? { summary } : {}), ...(filters ? { filters } : {}) });
  const json = full.length <= 1600 ? full : JSON.stringify({ ...rest, ...(summary ? { summary: summary.slice(0, 200) } : {}) });
  return `${ACTIONS_PATH}?tile=${encodeURIComponent(json)}`;
}

/** Its tab clicked: the card copied, then the page. */
export function openActions(t: ActionsTile, button: HTMLElement, go: (href: string) => void): void {
  try {
    const s = snapshot(button);
    if (s) snaps.set(t.key, s);
  } catch { /* the page says where the graph lives */ }
  go(actionsHref({ ...t, back: t.back ?? `${window.location.pathname}${window.location.search}` }));
}

/** The tile from the page's address; null when it is not one. */
export function readTile(param: string | null): ActionsTile | null {
  if (!param) return null;
  try {
    const t = JSON.parse(param) as ActionsTile;
    if (!t || typeof t.key !== "string" || !/^[a-z0-9-]+:/i.test(t.key) || typeof t.page !== "string" || typeof t.title !== "string") return null;
    // only addresses inside the hub
    const local = (h?: string) => (typeof h === "string" && h.startsWith("/") && !h.startsWith("//") ? h : undefined);
    return { ...t, start: t.start === "nutshell" ? "nutshell" : "tab", href: local(t.href), back: local(t.back) };
  } catch { return null; }
}
