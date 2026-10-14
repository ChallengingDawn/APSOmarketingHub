// The hub's side of each shop tool's gateway: its address (a setting, the Railway one until changed), the shop page
// it is meant for, and one call to its admin API - with the DirectUp Gateway's key (DIRECTUP_ADMIN_KEY), which the
// four gateways share by a Railway reference, so the hub needs no new secret.

import { kvGet, kvSet } from "@/lib/db/init";
import { adminKey } from "@/lib/directup/gateway";
import { SHOP_TOOLS, type ShopToolKey } from "./tools";

export type ToolSetting = { url: string; by: string | null; at: string | null; fromDefault: boolean; shopPath: string | null };

const kvUrl = (t: ShopToolKey) => `shoptool:${t}:gateway`;
const kvPath = (t: ShopToolKey) => `shoptool:${t}:path`;

export async function toolSetting(t: ShopToolKey): Promise<ToolSetting> {
  const [s, p] = await Promise.all([
    kvGet<{ url: string; by: string; at: string }>(kvUrl(t)).catch(() => null),
    kvGet<{ path: string }>(kvPath(t)).catch(() => null),
  ]);
  const shopPath = p?.path ?? SHOP_TOOLS[t].shopPath;
  return s?.url
    ? { url: s.url, by: s.by, at: s.at, fromDefault: false, shopPath }
    : { url: SHOP_TOOLS[t].gateway, by: null, at: null, fromDefault: true, shopPath };
}

/** https only, no path: the service's address, as the snippet puts it in front of /landing/tools/<page>. */
export async function setToolGateway(t: ShopToolKey, raw: string, by: string) {
  let origin = "";
  try { origin = new URL(raw.trim()).origin; } catch { /* below */ }
  if (!origin.startsWith("https://")) throw new Error(`Give the gateway's https address, e.g. ${SHOP_TOOLS[t].gateway}`);
  await kvSet(kvUrl(t), { url: origin, by, at: new Date().toISOString() });
}

/** The shop page's URL key after /<locale>/, e.g. "vulcanised-o-rings" or "service/oring-expert". */
export async function setToolPath(t: ShopToolKey, raw: string) {
  const path = raw.trim().replace(/^https?:\/\/[^/]+/i, "").replace(/^\/[a-z]{2}-[A-Za-z]{2,3}(\/(eur|chf))?\//i, "").replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9/_.-]{1,120}$/i.test(path)) throw new Error("Give the page's address after the store view, e.g. vulcanised-o-rings");
  await kvSet(kvPath(t), { path });
  return path;
}

/** One call to the tool gateway's admin API. Throws with the gateway's own sentence when it refuses. */
export async function toolGateway<T>(t: ShopToolKey, path: string): Promise<T> {
  const key = adminKey();
  if (!key) throw new Error("DIRECTUP_ADMIN_KEY is not set on the hub");
  const base = (await toolSetting(t)).url;
  const res = await fetch(`${base}/api/admin${path}`, { headers: { "x-admin-key": key }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : text.slice(0, 160);
    throw Object.assign(new Error(res.status === 403 ? "The gateway refused the hub's key" : `The gateway answered ${res.status}: ${said}`), { status: res.status });
  }
  return body as T;
}
