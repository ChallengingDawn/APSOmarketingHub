// THE MAGENTO CONNECTION, IN PLAIN WORDS (Content v6, 10.11.2026). Pure: the request is handed in, so the tests run it
// against a fake Magento (nothing here reaches a shop by itself).
//
// SARCLA 09.11.2026: "the Magento connection is not working yet". It was not: the hub has no CMS key for ACC nor for
// production yet (MAGENTO_CMS_ACC / MAGENTO_CMS_PROD are not in its task definition), so the last step could only wait.
// It says so now per environment, and "Check the connection" - once a key is there - makes ONE read: the first CMS page
// (GET /rest/all/V1/cmsPage/search?searchCriteria[pageSize]=1). Magento's REST API guards reading and saving a CMS page
// with the same right (Magento_Cms::page = Content > Elements > Pages), so a key that may read pages may save them; a
// 401 or 403 is a key Magento refuses, or an integration without that right. Never anything but a GET.

export type ConnEnv = "acc" | "prod";

/** Where an environment's key for pages comes from: its own CMS integration, the order connector's (an env flag), none. */
export type KeySource = "cms" | "order" | "none";

/** The read the check makes: one CMS page, nothing written. */
export const CHECK_PATH = "/cmsPage/search?searchCriteria%5BpageSize%5D=1&searchCriteria%5BcurrentPage%5D=1";

export type CheckState = "no-key" | "connected" | "refused" | "no-right" | "unreachable";
export type Check = { env: ConnEnv; state: CheckState; line: string; detail: string | null; pages: number | null; at: string };

/** The line each environment shows before any check: in plain words, what the hub has. */
export function connectionLine(env: ConnEnv, source: KeySource): { state: "no-key" | "key"; line: string } {
  if (source === "none") return { state: "no-key", line: env === "acc" ? "No key on the hub yet" : "No key for pages yet" };
  if (source === "order") return { state: "key", line: "The order connector's key - not checked yet" };
  return { state: "key", line: "Key set - not checked yet" };
}

/** What Magento's answer to the check says. */
export function verdictOf(env: ConnEnv, status: number, text: string, at = new Date().toISOString()): Check {
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  const msg = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : text.slice(0, 200);
  if (status >= 200 && status < 300) {
    const total = body && typeof body === "object" && "total_count" in body ? Number((body as { total_count: unknown }).total_count) : NaN;
    return { env, state: "connected", line: "Connected - the key may read and save pages", detail: Number.isFinite(total) ? `Magento holds ${total} CMS pages.` : null, pages: Number.isFinite(total) ? total : null, at };
  }
  if (status === 401 || status === 403) {
    // Magento says "The consumer isn't authorized to access %resources." when the integration lacks the right; a wrong or
    // inactive key is refused with the signature / token words
    const right = /authori[sz]ed to access|%resources|Magento_Cms/i.test(msg);
    return right
      ? { env, state: "no-right", line: "Refused - the integration lacks Content > Pages", detail: `Magento answered ${status}: ${msg.slice(0, 160)}`, pages: null, at }
      : { env, state: "refused", line: "Refused - the integration lacks Content > Pages, or the key is wrong", detail: `Magento answered ${status}: ${msg.slice(0, 160)}`, pages: null, at };
  }
  return { env, state: "unreachable", line: `Magento answered ${status}`, detail: msg ? msg.slice(0, 160) : null, pages: null, at };
}

/** The check itself: one GET, its answer in plain words. `get` is the environment's signed request (rest/all). */
export async function checkConnection(env: ConnEnv, source: KeySource, get: ((path: string) => Promise<{ status: number; text: string }>) | null): Promise<Check> {
  const at = new Date().toISOString();
  if (source === "none" || !get) return { env, state: "no-key", line: connectionLine(env, "none").line, detail: null, pages: null, at };
  try {
    const a = await get(CHECK_PATH);
    return verdictOf(env, a.status, a.text, at);
  } catch (e) {
    return { env, state: "unreachable", line: "Magento could not be reached", detail: String((e as Error)?.message ?? e).slice(0, 160), pages: null, at };
  }
}
