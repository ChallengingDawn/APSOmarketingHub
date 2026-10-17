// TICKET ASSOCIATIONS - the pure decisions (no database, no HubSpot) so they can be tested.
//
// The HubSpot workflow this replaces ran on two triggers: a ticket was created, or a ticket
// moved stage (re-enrolment). The hub sees tickets as "changed since my last look", so it
// keeps, per ticket, the stage it last processed it in: a ticket it has never processed is
// "created", one whose stage differs is "moved stage", and a change that is neither (an
// edit, or the hub's own write coming back) is left alone - as the workflow left it.

export type Seen = { stage: string | null; ok: boolean };

/** Why a ticket is processed now, or null when it is not. */
export function reason(stage: string | null, seen: Seen | undefined): "new" | "stage" | "retry" | null {
  if (!seen) return "new";
  if (!seen.ok) return "retry";
  return (seen.stage ?? "") !== (stage ?? "") ? "stage" : null;
}

/**
 * Where the next look starts. Tickets come oldest change first; when a run reads them all,
 * the next starts at the newest change it saw, and when it stops at its cap, at the last one
 * it read - so nothing is skipped and the window always moves on. The overlap (a few minutes,
 * for HubSpot's search index) is taken off when the window is used, not here.
 */
export function nextSince(prev: number, lastChanges: number[]): number {
  const seen = lastChanges.filter((n) => Number.isFinite(n) && n > 0);
  return seen.length ? Math.max(prev, ...seen) : prev;
}

/** The first look after a start, or after a long stop: the last half hour, never more. */
export function firstSince(stored: number | null, now: number, maxBackMs = 30 * 60_000): number {
  return stored && now - stored <= 24 * 3_600_000 ? stored : now - maxBackMs;
}
