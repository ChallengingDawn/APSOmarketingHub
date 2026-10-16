// SEARCH BAR - one call to the smart-bar gateway's admin API, without the hub's database (so it can be tested
// alone): the key travels as X-Admin-Token, the gateway's requireAdmin; a refused key is named, any other
// refusal carries the gateway's own words.

export async function callGateway<T>(base: string, key: string | null, path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  if (!key) throw new Error("SMART_BAR_ADMIN_TOKEN is not set on the hub");
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: { "x-admin-token": key, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 25_000),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : text.slice(0, 160);
    throw Object.assign(new Error(res.status === 401 ? "The gateway refused the hub's key (SMART_BAR_ADMIN_TOKEN differs)" : `The gateway answered ${res.status}: ${said}`), { status: res.status });
  }
  return body as T;
}

/** The key from the hub's environment, or null. */
export function adminToken(): string | null {
  const v = (process.env.SMART_BAR_ADMIN_TOKEN || "").trim();
  return v ? v : null;
}
