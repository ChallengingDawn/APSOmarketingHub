// When the borrowed Google login's renewal mail is due - pure, so it is tested (googleLoginReminder.ts sends it).

/** Google ends a Testing app's login this long after it was given (memory: project_hub_google_oauth). */
export const LOGIN_LIFE_MS = 7 * 86_400_000;
/** The reminder goes this long before. */
export const WARN_BEFORE_MS = 24 * 3_600_000;

/** Which mail is due for a login given at `connectedAt`: none, the day-before reminder, or "it has stopped". */
export function reminderDue(connectedAt: string, now: number, stopped: boolean): "soon" | "ended" | null {
  const at = Date.parse(connectedAt);
  if (!Number.isFinite(at)) return null;
  if (stopped) return "ended";
  return now >= at + LOGIN_LIFE_MS - WARN_BEFORE_MS ? "soon" : null;
}
