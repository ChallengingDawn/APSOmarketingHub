// BANNER - PUT IN A PAGE (08.11.2026; SARCLA: "the banner design: we should be able to push it inside a page visually as
// well"). Pure: tests/studio-banner-place.test.ts.
//
// The shared contract with the page studio (Content v2 brief): a page to-do's document holds
//   inserts?: { id, kind: "banner", pieceId, preset, where: "top" | "after-intro" | "bottom" }[]
// The page studio owns the page: it renders each insert in its own preview and output from the banner's document and
// pasteBlock(). The banner studio only ADDS an insert to a page of its project (or takes its own out), with small ops
// (studio/doc.ts: `insert` into the list, or `set` it when the page has none yet), and shows the page with the banner
// in it. Both sides live with a page that has no `inserts` and a banner that was removed.

import { PRESET, PAGE_PLACES, isPreset, type PresetKey } from "./model";

export type Where = "top" | "after-intro" | "bottom";
export const WHERES: { key: Where; label: string; hint: string }[] = [
  { key: "top", label: "At the top", hint: "Before the page's own content" },
  { key: "after-intro", label: "After the intro", hint: "Under the page's first block" },
  { key: "bottom", label: "At the bottom", hint: "After the page's content, before the footer" },
];
export const isWhere = (v: unknown): v is Where => v === "top" || v === "after-intro" || v === "bottom";

export type Insert = { id: string; kind: "banner"; pieceId: number; preset: string; where: Where };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A page document's inserts, whatever it holds (none, null, half-written ones) - only whole ones kept. */
export function insertsOf(pageDoc: unknown): Insert[] {
  const list = isObj(pageDoc) && Array.isArray(pageDoc.inserts) ? pageDoc.inserts : [];
  return list.filter(isObj).flatMap((x): Insert[] => {
    const pieceId = Number(x.pieceId);
    if (x.kind !== "banner" || !Number.isInteger(pieceId) || pieceId <= 0 || typeof x.id !== "string" || !x.id) return [];
    return [{ id: x.id.slice(0, 40), kind: "banner", pieceId, preset: String(x.preset ?? "band"), where: isWhere(x.where) ? x.where : "top" }];
  });
}

/** The place an insert shows the banner in: one of the shop's, else the home band. */
export const placeOf = (i: Pick<Insert, "preset">): PresetKey => (isPreset(i.preset) && PAGE_PLACES.includes(i.preset) ? i.preset : "band");

/** A new insert's id: short, unlike the others in the page. */
export function insertId(taken: string[], seed = Math.random()): string {
  let n = Math.floor(seed * 36 ** 6);
  let id = `bn${n.toString(36)}`;
  while (taken.includes(id)) { n += 1; id = `bn${n.toString(36)}`; }
  return id;
}

/**
 * The ops that put this banner in the page: added after the page's own inserts (`insert` - two people adding at once
 * both keep theirs), or the list itself when the page has none yet. The same banner, place and spot twice is one.
 */
export function placeOps(pageDoc: unknown, add: { pieceId: number; preset: PresetKey; where: Where }, seed?: number):
  { ops: { op: "set" | "insert"; path: string[]; index?: number; value: unknown }[]; insert: Insert; existed: boolean } {
  const raw = isObj(pageDoc) && Array.isArray(pageDoc.inserts) ? pageDoc.inserts : null;
  const have = insertsOf(pageDoc);
  const same = have.find((i) => i.pieceId === add.pieceId && i.preset === add.preset && i.where === add.where);
  if (same) return { ops: [], insert: same, existed: true };
  const insert: Insert = { id: insertId(have.map((i) => i.id), seed), kind: "banner", pieceId: add.pieceId, preset: add.preset, where: add.where };
  const ops = raw
    ? [{ op: "insert" as const, path: ["inserts"], index: raw.length, value: insert }]
    : [{ op: "set" as const, path: ["inserts"], value: [insert] }];
  return { ops, insert, existed: false };
}

/** The op that takes one insert out (by its place in the stored list), or null when it is not there. */
export function unplaceOp(pageDoc: unknown, insertIdToGo: string): { op: "remove"; path: string[]; index: number } | null {
  const raw = isObj(pageDoc) && Array.isArray(pageDoc.inserts) ? pageDoc.inserts : [];
  const index = raw.findIndex((x) => isObj(x) && x.id === insertIdToGo);
  return index >= 0 ? { op: "remove", path: ["inserts"], index } : null;
}

/** Where a page's own content is: a new page's body sits in #maincontent; a shop page's in its CMS column. */
const MAIN = "#maincontent .column.main";
const NEW_MAIN = "#maincontent";

/**
 * Where an insert goes, as a change on the shop's page (the page studio's change language, src/lib/convert/versions.ts):
 * the top and the bottom of the page's content; "after the intro" after its first block (a Page Builder row, the
 * category's description, the first heading or paragraph - whichever comes first).
 */
export function anchorOf(where: Where, newPage: boolean): { selector: string; where: "prepend" | "append" | "after" } {
  const main = newPage ? NEW_MAIN : MAIN;
  if (where === "top") return { selector: main, where: "prepend" };
  if (where === "bottom") return { selector: main, where: "append" };
  return {
    selector: [`${main} [data-content-type="row"]`, `${main} .category-description`, `${main} h1`, `${main} h2`, `${main} p`].join(", "),
    where: "after",
  };
}

/** A line for an insert: "Home band, at the top". */
export function insertLine(i: Pick<Insert, "preset" | "where">): string {
  const w = WHERES.find((x) => x.key === i.where)?.label.toLowerCase() ?? "at the top";
  return `${PRESET[placeOf(i)].label}, ${w}`;
}
