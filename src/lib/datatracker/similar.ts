// IS THIS ACTUALLY AN ALTERNATIVE?
//
// Being in the same sub-group is not enough. A Ø 6 round bar is not a substitute
// for a Ø 45 one, and offering it makes the whole list look like it was picked
// at random - which is worse than offering nothing.
//
// So the size is read out of the description and the candidates are ranked by
// how close they come. The descriptions are consistent enough for this:
//
//   POM-C round bar black Ø 45 +1.3/+0.3 mm
//   UNIPRESS™ Industrial hose ID 6.3 x OD 14.3 mm
//   HITEC® O-ring FKM 75.16-04 ID 3.68 x 1.78 mm
//
// The number after Ø or ID governs. Where there is none we fall back to the
// first plain measurement, and where there is still none the article simply
// cannot be ranked on size - it is kept, but behind everything that can.

/** The size a part is chosen by: after Ø, else after ID, else the first number. */
export function governingSize(description: string | null | undefined): number | null {
  const d = (description ?? "").replace(/,/g, ".");
  if (!d) return null;
  const dia = /[Ø⌀]\s*(\d+(?:\.\d+)?)/.exec(d);
  if (dia) return Number(dia[1]);
  const id = /\bID\s*(\d+(?:\.\d+)?)/i.exec(d);
  if (id) return Number(id[1]);
  // Not a tolerance (+0.8/+0.2) and not a material code (70.10-02): a plain
  // measurement, usually followed by the unit or a separator.
  const plain = /(?:^|[\s(])(\d+(?:\.\d+)?)\s*(?:mm|x|×)/i.exec(d);
  return plain ? Number(plain[1]) : null;
}

/** black / natural / white / transparent — a visible property people care about. */
export function colourOf(description: string | null | undefined): string | null {
  const d = (description ?? "").toLowerCase();
  for (const c of ["black", "natural", "white", "transparent", "blue", "red", "green", "grey", "gray"]) {
    if (d.includes(c)) return c === "gray" ? "grey" : c;
  }
  return null;
}

/**
 * How far apart two sizes are, as a share of the one asked for. 0 is identical,
 * 1 is twice (or half) the size. Null when either cannot be read.
 */
export function sizeDistance(want: number | null, have: number | null): number | null {
  if (want == null || have == null || want <= 0) return null;
  return Math.abs(have - want) / want;
}

/**
 * Close enough to put in front of a customer.
 *
 * A quarter either way: Ø 40 and Ø 55 are worth mentioning against a Ø 45, Ø 6
 * is not. Deliberately not generous - a long list of near-misses reads as a
 * machine that did not understand the question.
 */
export const SIZE_TOLERANCE = 0.25;

export type Rankable = { description: string | null; stock: number | null };

/**
 * Rank candidates against what the customer actually wanted. Closest size
 * first, same colour ahead of a different one, then whatever we hold most of.
 */
export function rankAlternatives<T extends Rankable>(
  target: { description: string | null },
  candidates: T[],
): (T & { size: number | null; distance: number | null; sameColour: boolean })[] {
  const want = governingSize(target.description);
  const wantColour = colourOf(target.description);

  return candidates
    .map((c) => {
      const size = governingSize(c.description);
      const distance = sizeDistance(want, size);
      return { ...c, size, distance, sameColour: !!wantColour && colourOf(c.description) === wantColour };
    })
    // Only when the target's own size could be read - otherwise there is nothing
    // to measure against and dropping candidates would be arbitrary.
    .filter((c) => want == null || c.distance == null || c.distance <= SIZE_TOLERANCE)
    .sort((a, b) => {
      if (a.distance != null && b.distance != null && a.distance !== b.distance) return a.distance - b.distance;
      if (a.distance == null !== (b.distance == null)) return a.distance == null ? 1 : -1;
      if (a.sameColour !== b.sameColour) return a.sameColour ? -1 : 1;
      return (b.stock ?? 0) - (a.stock ?? 0);
    });
}
