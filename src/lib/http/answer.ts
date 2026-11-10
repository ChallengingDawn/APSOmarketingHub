// A HUB ANSWER, READ IN PLAIN WORDS (Content v7, 10.11.2026). Pure: no "@/" imports - the studios, keepAlive and the
// tests read it.
//
// SARCLA 10.11.2026, on the Page builder's Magento check: "The hub answered 200." - a line that says nothing. It came from
// the studios' fetch helper: a slow action is kept alive (./keepAlive.ts), so its status is ALWAYS 200 and is sent before
// the work ends; when the JSON behind the spaces never came whole (the hub restarted, the connection was cut on the way),
// `r.json()` failed and the helper printed the status. A status is never what a person reads: this says what it means.

/** What a status means for the person who clicked - never the number itself. */
export function plainStatus(status: number): string {
  if (status === 200 || status === 0) return "The answer was cut off on the way - the hub may have restarted. Try again in a moment.";
  if (status === 401) return "Your session has ended - sign in again.";
  if (status === 403) return "The hub's firewall turned this away (too big, or too many at once) - wait a minute and try again.";
  if (status === 404) return "The hub does not know this any more - reload the page.";
  if (status === 413) return "This is too big to send in one go.";
  if (status === 429) return "Too many at once - wait a minute and try again.";
  if (status === 502 || status === 503 || status === 504) return "The hub is restarting or busy - try again in a minute.";
  if (status >= 500) return "The hub ran into a problem - try again; if it stays, tell the digital team.";
  return "The hub could not answer - try again.";
}

/** The JSON an answer holds (spaces before it are fine - keepAlive sends them), or null. */
export function jsonOf(text: string): unknown {
  const t = text.trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

/**
 * An answer as the studios read it: its JSON object when it has one, else `{ ok: false, error }` in plain words. A JSON
 * error message is kept (the hub writes those for people); an HTML page or a cut answer is not shown.
 */
export function answerOf(status: number, text: string): Record<string, unknown> {
  const j = jsonOf(text);
  if (j && typeof j === "object" && !Array.isArray(j)) {
    const o = j as Record<string, unknown>;
    // a refusal without words of its own (a bare {"ok":false}) gets the status's meaning
    if (o.ok === false && (typeof o.error !== "string" || !o.error.trim())) return { ...o, error: plainStatus(status) };
    return o;
  }
  return { ok: false, error: plainStatus(status) };
}

/** Reads a fetch's answer in plain words; a network failure is said too (never thrown). */
export async function readAnswer(r: Response | Promise<Response>): Promise<Record<string, unknown>> {
  try {
    const res = await r;
    const text = await res.text().catch(() => "");
    return answerOf(res.status, text);
  } catch {
    return { ok: false, error: "The hub could not be reached - check your connection and try again." };
  }
}
