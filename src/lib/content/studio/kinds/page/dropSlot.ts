// PAGE - WHERE A DRAGGED BLOCK LANDS (Content v13, 11.11.2026). Pure, no imports (tests/studio-page-cv13-drop.test.ts).
//
// SARCLA 11.11.2026, ~09:10: "sometimes drag and drop on modules don't put it up". The Build list worked out the place
// from the row under the pointer, row by row - and the thin strip between two rows (the "+ Add a block here" over their
// border) is no row: a drop there, right where the pink line said it would land, was refused and lost. Moving a block UP
// was hit most (the pointer comes to rest on the line above the target row). Now the WHOLE list answers a drag: the
// place is worked out once from the pointer and the rows' boxes - the line shows it, the drop puts the block exactly
// there, up or down, the first place and the last included; a drop where the block already is changes nothing.

/** A row's box on the screen (its top and its height, in the pointer's coordinates). */
export type RowBox = { top: number; height: number };

/**
 * The gap a pointer at `y` stands for: 0 = above the first row, n = below the last - the gap before the first row whose
 * middle is still below the pointer. `min`: the first gap a block may take (1 when the first row stays first - the hero).
 */
export function slotAt(rows: RowBox[], y: number, min = 0): number {
  let slot = 0;
  for (const r of rows) {
    if (y >= r.top + r.height / 2) slot++;
    else break;
  }
  return Math.max(Math.min(min, rows.length), slot);
}

/**
 * The index a row takes once it is moved into a gap (the gaps counted with the row still in its place) - null when it
 * would stay where it is (dropped on itself, or on the gap just above or below it).
 */
export function moveTarget(from: number, slot: number, count: number): number | null {
  if (!Number.isInteger(from) || from < 0 || from >= count) return null;
  const s = Math.max(0, Math.min(count, Math.round(slot)));
  if (s === from || s === from + 1) return null;
  return s > from ? s - 1 : s;
}

/** Where the line shows for a gap: on the top edge of the row after it, or on the bottom edge of the last row. */
export function lineOf(slot: number | null, count: number): { row: number; edge: "top" | "bottom" } | null {
  if (slot === null || count <= 0) return null;
  return slot >= count ? { row: count - 1, edge: "bottom" } : { row: Math.max(0, slot), edge: "top" };
}

/** A list in the new order: the row at `from` put at `to` (moveTarget's index). */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}
