// APSO TRANSLATOR - DeepL, as the Railway translator used it (SARCLA 08.11.2026: "DeepL, as today"). The key is the hub's
// secret DEEPL_API_KEY (AWS apso-dev/DEEPL_API_KEY, injected at boot); a key ending in ":fx" is a free account and
// talks to DeepL's free address. Never logged, never sent anywhere but DeepL.

export type Translated = { text: string; detected: string };
export type Usage = { used: number; limit: number | null };

const key = () => (process.env.DEEPL_API_KEY ?? "").trim();
export const deeplConfigured = () => key().length > 0;
const host = () => (key().endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!deeplConfigured()) throw new Error("no DeepL key on the hub (DEEPL_API_KEY)");
  const r = await fetch(`${host()}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `DeepL-Auth-Key ${key()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const why = r.status === 403 ? "DeepL refused the key" : r.status === 456 ? "DeepL's character quota is used up" : r.status === 429 ? "DeepL is busy - too many requests" : `DeepL answered ${r.status}`;
    throw new Error(why);
  }
  return (await r.json()) as T;
}

/** One text into `target` (DeepL's code: EN-US, DE, PT-PT …); `source` only when the text is too short to tell. */
export async function translate(text: string, target: string, source?: string | null): Promise<Translated> {
  const j = await call<{ translations?: { text: string; detected_source_language: string }[] }>("/v2/translate", {
    text: [text], target_lang: target, ...(source ? { source_lang: source.split("-")[0] } : {}),
  });
  const t = j.translations?.[0];
  if (!t) throw new Error("DeepL gave no translation");
  return { text: t.text, detected: String(t.detected_source_language || source || "").toUpperCase() };
}

let usageCache: { at: number; v: Usage | null } | null = null;
/** The characters used this billing period, and the limit when the plan has one (read at most every 10 minutes). */
export async function usage(): Promise<Usage | null> {
  if (usageCache && Date.now() - usageCache.at < 10 * 60_000) return usageCache.v;
  let v: Usage | null = null;
  try {
    const j = await call<{ character_count?: number; character_limit?: number }>("/v2/usage");
    const limit = typeof j.character_limit === "number" && j.character_limit < 1e12 ? j.character_limit : null;
    v = { used: j.character_count ?? 0, limit };
  } catch { v = null; }
  usageCache = { at: Date.now(), v };
  return v;
}
