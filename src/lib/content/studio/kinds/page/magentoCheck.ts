// THE MAGENTO CONNECTION, IN PLAIN WORDS (Content v6, 10.11.2026). Pure: the request is handed in, so the tests run it
// against a fake Magento (nothing here reaches a shop by itself).
//
// SARCLA 09.11.2026: "the Magento connection is not working yet". It was not: the hub has no CMS key for ACC nor for
// production yet (MAGENTO_CMS_ACC / MAGENTO_CMS_PROD are not in its task definition), so the last step could only wait.
// It says so now per environment, and "Check the connection" - once a key is there - makes ONE read: the first CMS page
// (GET /rest/all/V1/cmsPage/search?searchCriteria[pageSize]=1). Reading pages needs the integration's right Content >
// Elements > Pages (Magento_Cms::page); saving one may also need its "Save Page" right - no read can tell, so the line says what
// was proven and names the right. A 401 or 403 is a key Magento refuses, or an integration without the right. GET only.

export type ConnEnv = "acc" | "prod";

/** Where an environment's key for pages comes from: its own CMS integration, the order connector's (an env flag), none. */
export type KeySource = "cms" | "order" | "none";

/** The read the check makes: one CMS page, nothing written. */
export const CHECK_PATH = "/cmsPage/search?searchCriteria%5BpageSize%5D=1&searchCriteria%5BcurrentPage%5D=1";

export type CheckState = "no-key" | "connected" | "refused" | "no-right" | "unreachable";
export type Check = { env: ConnEnv; state: CheckState; line: string; detail: string | null; pages: number | null; at: string };

/** The four words a connection is in (SARCLA 10.11.2026: the check must say what it means, not a status). */
export const STATE_WORD: Record<CheckState | "key", string> = {
  "no-key": "No key", key: "Not checked", connected: "Connected", refused: "Refused", "no-right": "Refused", unreachable: "Not reachable",
};

/** Where in Magento's admin the hub's integration gets the right to save pages - said once, the same everywhere. */
export const MAGENTO_PATH = "System > Extensions > Integrations > the hub's integration (or Add New Integration) > API > Resource Access: Custom > tick Content > Elements > Pages, with Save Page > Save, then Activate (or Reauthorize)";

/**
 * "No key?" (SARCLA 10.11.2026) - what an admin does, in plain words: three steps, the exact Magento menu path, who to ask.
 * The same for both shops; `env` names the right Magento admin.
 */
export function noKeySteps(env: ConnEnv): { title: string; steps: string[]; ask: string } {
  return {
    title: "No key yet - three steps",
    steps: [
      `Give the hub's integration the right to save pages - in ${env === "acc" ? "ACC's" : "production's"} Magento admin: ${MAGENTO_PATH}.`,
      "Put its key on the hub - one AWS command.",
      "Then we switch the hub on.",
    ],
    ask: "Ask Claudio or the digital team.",
  };
}

/** The line each environment shows before any check: in plain words, what the hub has. */
export function connectionLine(env: ConnEnv, source: KeySource): { state: "no-key" | "key"; line: string } {
  if (source === "none") return { state: "no-key", line: "No key yet" };
  if (source === "order") return { state: "key", line: "A key (the order connector's) - not checked yet" };
  return { state: "key", line: "Key set - not checked yet" };
}

/** Magento's own words, when they are words (never a page of HTML), short. */
function said(msg: string): string | null {
  const t = msg.replace(/\s+/g, " ").trim();
  if (!t || /^</.test(t) || /<html|<body|<!doctype/i.test(t)) return null;
  return t.slice(0, 160);
}

/** Why Magento could not be used, in plain words, from its answer's status (never the number itself). */
function unreachableWhy(status: number): string {
  if (status === 404) return "Not reachable - Magento's address for pages was not found";
  if (status === 429) return "Not reachable - Magento asks to wait (too many asks); try again in a minute";
  if (status >= 500) return "Not reachable - Magento had a problem on its side";
  return "Not reachable - Magento did not answer as expected";
}

/** What Magento's answer to the check says. */
export function verdictOf(env: ConnEnv, status: number, text: string, at = new Date().toISOString()): Check {
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  const msg = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : text.slice(0, 200);
  const words = said(msg);
  if (status >= 200 && status < 300) {
    const total = body && typeof body === "object" && "total_count" in body ? Number((body as { total_count: unknown }).total_count) : NaN;
    return { env, state: "connected", line: "Connected - the hub may read pages", detail: `${Number.isFinite(total) ? `Magento holds ${total} CMS pages. ` : ""}To save pages too, the integration needs Save Page ticked (Content > Elements > Pages).`, pages: Number.isFinite(total) ? total : null, at };
  }
  if (status === 401 || status === 403) {
    // Magento says "The consumer isn't authorized to access %resources." when the integration lacks the right; a wrong or
    // inactive key is refused with the signature / token words
    const right = /authori[sz]ed to access|%resources|Magento_Cms/i.test(msg);
    return right
      ? { env, state: "no-right", line: "Refused - the integration may not read pages", detail: `In Magento: ${MAGENTO_PATH}.`, pages: null, at }
      : { env, state: "refused", line: "Refused - Magento does not accept the key", detail: `The key may be wrong, or its integration switched off in Magento.${words ? ` Magento said: "${words}"` : ""}`, pages: null, at };
  }
  return { env, state: "unreachable", line: unreachableWhy(status), detail: words ? `Magento said: "${words}"` : null, pages: null, at };
}

/** The check itself: one GET, its answer in plain words. `get` is the environment's signed request (rest/all). */
export async function checkConnection(env: ConnEnv, source: KeySource, get: ((path: string) => Promise<{ status: number; text: string }>) | null): Promise<Check> {
  const at = new Date().toISOString();
  if (source === "none" || !get) return { env, state: "no-key", line: connectionLine(env, "none").line, detail: null, pages: null, at };
  try {
    const a = await get(CHECK_PATH);
    return verdictOf(env, a.status, a.text, at);
  } catch {
    return { env, state: "unreachable", line: "Not reachable - Magento could not be reached", detail: "Try again in a minute; if it stays, the shop may be down.", pages: null, at };
  }
}
