// PAGE - A MODULE'S OWN BUTTON WORDS ON ITS TILES (Content v12, 10.11.2026). Pure: relative imports only (the registry, the
// studio and the tests read it).
//
// SARCLA 10.11.2026, 23:10: "on some bento I cannot edit the button". A bento's big tile says "Alle anzeigen", a wide card
// "Zum Produkt", a column "Alle anzeigen", a duo's teaser "Mehr erfahren" - the library's interface words in the store
// view's language (../kit.ts wordsFor, ./library2/kit.ts w2), each leading to the tile's own product or category. They
// were nobody's setting, so a click on them could change nothing. Now each module may say them its own way: the words
// kept in its settings' `extra` as "w-<key>" ("w-all": "Alle O-Ringe"), laid over the interface words while the module
// is drawn (./registry.ts drawModule sets kit.drawing.words) - on the page, in the thumbnail and in Magento's copy alike.

import { drawing, wordsFor } from "./kit";
import { w2 } from "./library2/kit";

/** The interface words a tile's button says (the ones a person may change on a module): their keys. */
export const TILE_WORDS = ["all", "allProducts", "go", "goCat", "more", "discover", "shop", "readMore", "download", "open", "watch", "tool", "search"] as const;
export type TileWord = (typeof TILE_WORDS)[number];
export const TILE_KEY = (k: TileWord) => `w-${k}`;
/** What each says, in plain English - the popup's line about it. */
export const TILE_WORD_NAME: Record<TileWord, string> = {
  all: "View all", allProducts: "All products", go: "View product", goCat: "View group", more: "Learn more", discover: "Discover", shop: "To the shop",
  readMore: "Read more", download: "Download", open: "Open", watch: "Watch the video", tool: "Open the tool", search: "Search",
};

/** The overrides a module's settings hold ({ all: "Alle O-Ringe" }) - what drawModule lays over the interface words. */
export function tileOverrides(extra: Record<string, string> | undefined): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const k of TILE_WORDS) { const v = (extra?.[TILE_KEY(k)] ?? "").trim(); if (v) out[k] = v.slice(0, 40); }
  return Object.keys(out).length ? out : null;
}

/** The words of each tile button for a module of this store view, as it draws them now (its own, else the shop's). */
export function tileWordsOf(store: string, extra: Record<string, string> | undefined): Record<TileWord, string> {
  const was = drawing.words;
  drawing.words = null;
  try {
    const a = wordsFor(store) as unknown as Record<string, string>;
    const b = w2(store) as unknown as Record<string, string>;
    const own = tileOverrides(extra) ?? {};
    return Object.fromEntries(TILE_WORDS.map((k) => [k, own[k] ?? a[k] ?? b[k] ?? ""])) as Record<TileWord, string>;
  } finally { drawing.words = was; }
}

/** The interface word of this store view a key says, the module's own aside (to know when an edit puts it back). */
export function shopTileWord(store: string, k: TileWord): string {
  return tileWordsOf(store, {})[k];
}
