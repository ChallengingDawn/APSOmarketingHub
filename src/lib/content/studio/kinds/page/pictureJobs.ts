// PAGE - A PICTURE BEING MADE: WHICH WORDS IT IS MADE FROM, AND THE NEWEST ASK WINS (Content v13, 11.11.2026). Pure, no
// imports: the studio (../../../../../app/projects/studio/kinds/page/Studio.tsx makeOne), the picture's popup (pops.tsx
// PicturePop) and tests/studio-page-picture-newest.test.ts.
//
// SARCLA 11.11.2026 (screenshot 26, the hero's picture being made, his new words in "What should the picture show?"):
// "make another on photo don't take into account new prompt". The popup sent the box's words of the moment of the click;
// words typed while the picture was being made (10-40 s) were never used, and the button stayed grey until the old ask's
// picture landed. Now: the words a picture is being made from are shown under its progress; new words in the box while it
// is made give "Make it from these words instead" - a new ask that replaces the running one: its picture is the one that
// lands in the slot, the older ask's still arrives in the project's pictures (the gallery) and is never put in.

/** A slot's asks, newest last: its number goes up with each ask (`jobs[key]` = the newest's number). */
export type SlotJobs = Record<string, number>;

/** A new ask for a slot: its number - the newest from now on. */
export function startJob(jobs: SlotJobs, key: string): number {
  const n = (jobs[key] ?? 0) + 1;
  jobs[key] = n;
  return n;
}

/** Is this ask still the slot's newest? An older ask's picture never goes into the slot. */
export function isNewest(jobs: SlotJobs, key: string, n: number): boolean {
  return (jobs[key] ?? 0) === n;
}

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * The popup's make button: its words and whether it can be pressed.
 * - nothing being made: "Make it" (no picture yet) / "Make another", pressed when the box has words
 * - being made from the box's words: greyed, "Making it…"
 * - being made from OTHER words than the box's now: "Make it from these words instead"
 */
export function makeButton(p: { hasPicture: boolean; making: boolean; makingFrom: string | null; draft: string; canMake: boolean }): { label: string; disabled: boolean } {
  const draft = p.draft.trim();
  if (!p.making) return { label: p.hasPicture ? "Make another" : "Make it", disabled: !p.canMake || !draft };
  if (p.makingFrom !== null && draft && !same(draft, p.makingFrom)) return { label: "Make it from these words instead", disabled: !p.canMake };
  return { label: "Making it…", disabled: true };
}

/** The words a picture is being made from, short enough for one or two lines under its progress. */
export function madeFrom(words: string | null | undefined, max = 110): string {
  const w = String(words ?? "").replace(/\s+/g, " ").trim();
  if (!w) return "";
  return w.length > max ? `${w.slice(0, max - 1).trimEnd()}…` : w;
}
