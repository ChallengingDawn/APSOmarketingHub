"use client";

// APSOconvert's shared helpers. The step strip that stood on top of its pages is gone (SARCLA 08.11.2026: "these tabs
// should be sub pages as the other, not like this on top") - each step is a page of its own in the side menu.

/** The preview's address for a page. */
export const previewHref = (env: string, path: string, idea?: string) =>
  `/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}${idea ? `&idea=${idea}` : ""}`;

/**
 * A POST to an APSOconvert route that may answer slowly (the AI): the answer can start with spaces kept alive, a
 * refused body (the 8 KB rule, an ended session) answers HTML - both read into {ok, error}.
 */
export async function convertPost<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const raw = JSON.stringify(body);
  if (raw.length > 7800) return { ok: false, error: `Too much at once (${Math.round(raw.length / 1000)} KB) - the hub takes 8 KB per request.` };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    const text = (await r.text()).trim();
    let j: { ok?: boolean; data?: T; error?: string };
    try { j = JSON.parse(text); } catch { return { ok: false, error: r.status === 403 ? "The hub refused the request (403) - is your session still open?" : `The hub answered ${r.status}.` }; }
    if (j.ok) return { ok: true, data: j.data as T };
    return { ok: false, error: j.error ?? `The hub answered ${r.status}.` };
  } catch (e) {
    return { ok: false, error: `No answer: ${(e as Error).message}` };
  }
}
