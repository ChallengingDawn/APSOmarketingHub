// TAKING STORE VIEWS OFF THE PAGE (Content v13, SARCLA 11.11.2026: "store view also broken: once it's selected I can't
// deselect it completely - the check is still there, can't take it out"). Pure: relative imports only - the studio and the
// tests.
//
// Until then the store view panel (src/app/projects/studio/kinds/page/StoreViewPicker.tsx) held every version's OWN store
// view fixed - the one a language's page is kept under and shown in (fr-CH for the French page): its tick stayed on and
// greyed, "All of a language" and "All of a country" left it out, and model.ts tickStore refused it - so a language once
// ticked could never be taken off completely; and every tick was greyed while a translation ran. Now:
//   - every store view comes off with one click - only the page's own (the main version, the one it is written in) stays;
//   - a version's own store view taken off while it still goes to others: the version is shown in another of them (its
//     language's own store view first, then its currency twin, then the shop's order) - the same words, nothing lost;
//   - a version's LAST store view taken off: the version goes (the panel asks first - dropQuestion);
//   - while a run translates, only the languages the page does not have yet wait for it.

import { HOME_STORE, baseStore, dropView, langName, langOfStore, leadOf, mainView, pathIn, storesOfView, versionOfStore, viewsOf, type PageDoc } from "./model";
import { countryStore, shopOrder, viewShort } from "./storeViews";

/** Why the page's own store view stays ticked - said on its tick. */
export const MAIN_STAYS = "The page is written here - another store view first";
/** Why a store view of a language the page does not have waits while a run goes. */
export const RUN_WAITS = "A translation is running - tick the new languages once it is done";

/** What taking store views off did. */
export type Untick = {
  doc: PageDoc;
  /** the store views taken off the page */
  off: string[];
  /** asked but kept: the page's own store view */
  refused: string[];
  /** versions removed - their last store view went (their words with them) */
  dropped: string[];
  /** versions now kept under another of their store views (their own was taken off): old key -> new key */
  moved: Record<string, string>;
};

/** Why a store view's tick can't be changed now - null when it can. `running`: a run of the plan goes. */
export function tickLock(d: PageDoc, store: string, running = false): string | null {
  const s = baseStore(store);
  if (!s) return null;
  if (s === mainView(d)) return MAIN_STAYS;
  if (running && !viewsOf(d).some((k) => langOfStore(k) === langOfStore(s))) return RUN_WAITS;
  return null;
}

/** One version's list set (its own key first) - model.ts setList, kept here (it is not exported there). */
function setList(d: PageDoc, k: string, list: string[]): PageDoc {
  if (k === mainView(d)) return { ...d, stores: list };
  const v = d.langs[k];
  return v ? { ...d, langs: { ...d.langs, [k]: { ...v, stores: list } } } : d;
}

/** The store view a version is shown in once its own is taken off: its language's own store view (fr-CH, en-INT ...),
 * else its currency twin (de-CH/eur for de-CH), else the first in the shop's order - for a page of the shop, one whose
 * address there is known first (never guessed: `pathOf`, or the twin's own prefix). */
function nextKey(d: PageDoc, k: string, left: string[], pathOf?: (store: string) => string | null | undefined): string {
  const l = langOfStore(k);
  const rank = (x: string) => (x === HOME_STORE[l] ? 0 : countryStore(x) === countryStore(k) ? 1 : 2);
  const order = [...left].sort((a, b) => rank(a) - rank(b) || shopOrder(a) - shopOrder(b));
  if (d.source !== "new") {
    const known = order.find((x) => pathOf?.(x) || pathIn(d.langs[k]?.path, x));
    if (known) return known;
  }
  return order[0];
}

/** The version kept under `k` moved to `to`, going to `list` - its words, versions and history the same. */
function rekey(d: PageDoc, k: string, to: string, list: string[], pathOf?: (store: string) => string | null | undefined): PageDoc {
  const v = d.langs[k];
  if (!v) return d;
  const langs = { ...d.langs };
  delete langs[k];
  const path = d.source === "new" ? "" : pathOf?.(to) || pathIn(v.path, to) || v.path;
  langs[to] = { ...v, store: to, path, stores: [to, ...list.filter((x) => x !== to)] };
  // a copy made from it reads its words where they are now
  for (const [x, o] of Object.entries(langs)) if (o.source === k) langs[x] = { ...o, source: to };
  return { ...d, langs };
}

/**
 * The page with these store views taken off: each out of the version that goes there. The page's own store view stays
 * (`refused`); a version whose own store view goes but which still goes to others is kept under one of them (`moved`); a
 * version left with none is removed (`dropped` - ask first: dropQuestion). Unchanged (the same object) when nothing went.
 * `pathOf`: a page of the shop's address in a store view (the shop's index), for a version moved there.
 */
export function untickStores(d: PageDoc, stores: readonly string[], pathOf?: (store: string) => string | null | undefined): Untick {
  const main = mainView(d);
  const asked = [...new Set(stores.map((s) => baseStore(s)).filter((s): s is string => !!s))];
  const refused = asked.filter((s) => s === main);
  const off = asked.filter((s) => s !== main && !!versionOfStore(d, s));
  const none: Untick = { doc: d, off: [], refused, dropped: [], moved: {} };
  if (!off.length) return none;
  const want = new Set(off);
  const versions = viewsOf(d);
  const lists = new Map(versions.map((k) => [k, storesOfView(d, k)]));
  // every version keeps its list as it is now, so nothing comes back by default once another moves or goes
  let doc = d;
  for (const [k, list] of lists) doc = setList(doc, k, list);
  const dropped: string[] = [];
  const moved: Record<string, string> = {};
  for (const k of versions) {
    const list = lists.get(k)!;
    const left = list.filter((x) => !want.has(x));
    if (left.length === list.length) continue;
    if (k === main || left.includes(k)) { doc = setList(doc, k, left); continue; }
    if (!left.length) { dropped.push(k); doc = dropView(doc, k); continue; }
    const to = nextKey(doc, k, left, pathOf);
    moved[k] = to;
    doc = rekey(doc, k, to, left, pathOf);
  }
  return { doc, off, refused, dropped, moved };
}

/** "Remove the German page? Its words are lost." - asked before a version goes with its last store view. */
export function dropQuestion(d: PageDoc, dropped: readonly string[]): string {
  if (!dropped.length) return "";
  const isPage = (k: string) => leadOf(d, langOfStore(k)) === k;
  const names = dropped.map((k) => (isPage(k) ? `the ${langName(k)} page` : `${viewShort(k)}'s own words`));
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const tail = dropped.length > 1 ? "Their words are lost." : isPage(dropped[0]) ? "Its words are lost." : "They are lost.";
  return `Remove ${list}? ${tail}`;
}
